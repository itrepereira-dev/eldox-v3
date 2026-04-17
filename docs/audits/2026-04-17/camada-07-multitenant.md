# Camada 7 — Multi-Tenancy e Isolamento de Dados — Auditoria 2026-04-17

**Auditor:** auditor-camada-07-multitenant
**Repo:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3`
**Stack real:** NestJS 11 + Prisma 7.6 + PostgreSQL + JWT (passport-jwt)
**Modelo multi-tenant oficial:** schema compartilhado + `tenantId` em toda tabela de negócio + PostgreSQL RLS complementar
**Data:** 2026-04-17

---

## 0. Sumário Executivo

Eldox v3 implementa multi-tenancy **row-level** com razoável disciplina: o JWT carrega `tenantId`, o decorator `@TenantId()` propaga para os services, e a grande maioria das queries passa o filtro explicitamente. Os testes adversariais em `ObrasController`, `InspecaoController` (FVS) e `GedController` **não encontraram IDOR estático explorável**.

No entanto, há **três riscos arquiteturais graves** (🔴) que impedem considerar o isolamento "blindado":

1. **RLS está documentado mas está morto em produção.** O README prescreve um middleware Prisma `$use` que aplica `SET LOCAL app.tenant_id`, mas esse middleware **não existe no código**. A conexão Prisma usa SUPERUSER, que bypassa RLS. A defesa em profundidade prometida é ilusória.
2. **Cobertura RLS incompleta.** Apenas ~33 tabelas (de 60+) têm `ENABLE ROW LEVEL SECURITY`. Módulos inteiros (FVS completo, FVM, ensaios, aprovações, NCs unificadas, concretagem, almoxarifado, efetivo, planos_acao, semaforo) estão **sem nenhuma política RLS**.
3. **NÃO existe Prisma middleware/interceptor global que injete tenantId.** Todo o isolamento depende do desenvolvedor lembrar de incluir `tenantId` em cada query. Qualquer esquecimento futuro = vazamento direto.

Essas três falhas não são IDOR hoje, mas são **multiplicadores de risco sistemático**: qualquer bug de esquecimento de `tenantId` numa query futura vira vazamento cross-tenant sem qualquer barreira.

---

## 1. Estratégia de Isolamento — Confirmação

| Item | Status | Evidência |
|------|--------|-----------|
| Padrão row-level | ✅ Confirmado | 88 ocorrências de `tenantId`/`tenant_id` em `backend/prisma/schema.prisma` |
| Middleware global Prisma (`$use`, `$extends`) | ❌ **NÃO EXISTE** | `grep` em todo `backend/src/` retorna 0 matches para `prisma.$use`, `prisma.$extends`, `prismaExtension`, `withTenant` |
| Role aplicação (`eldox_app`) criada | ✅ Sim (`backend/prisma/rls/rls.sql:39`) | Mas Prisma não conecta como `eldox_app` |
| `SET LOCAL app.tenant_id` chamado no código | ❌ **NUNCA** | `grep "app.tenant_id"` só aparece em `rls.sql` e `README.md`; 0 chamadas em `backend/src/` |
| JWT carrega `tenantId` + `role` + `plano` | ✅ Sim | `backend/src/auth/auth.service.ts:109` e `backend/src/auth/jwt.strategy.ts:19` |
| Decorator `@TenantId()` + `@CurrentUser()` | ✅ Sim | `backend/src/common/decorators/tenant.decorator.ts:3-15` |
| Guard `JwtAuthGuard` + `RolesGuard` em rotas privadas | ✅ Sim | ~50 controllers usam `@UseGuards(JwtAuthGuard, RolesGuard)` |

---

## 2. Achados — Por Severidade

### 🔴 BUG-MT-001 — RLS documentado mas nunca ativado em runtime (CRITICAL)

- **Arquivo:evidência:** `backend/prisma/rls/README.md:57-69` prescreve explicitamente o middleware Prisma `$use`. `backend/src/prisma/prisma.service.ts:1-19` apenas estende `PrismaClient` sem `$use` nem `$extends`. Busca global em `backend/src/` por `SET LOCAL app.tenant_id` retorna **zero** ocorrências. `grep` por `\$use\(` em todo o backend retorna **zero** matches.
- **Sintoma:** O script `rls.sql` habilita RLS e cria políticas, mas a aplicação conecta via `PrismaPg({ connectionString: process.env.DATABASE_URL })` usando SUPERUSER (o mesmo que roda migrations). SUPERUSER bypassa RLS automaticamente (declarado em `rls/README.md:46`). Resultado: as políticas estão inertes em produção.
- **Causa:** middleware nunca implementado; não há separação entre conexão de migration e conexão de app.
- **Correção sugerida (referência):** criar `backend/src/prisma/tenant-context.interceptor.ts` + middleware Prisma que faz `SET LOCAL` no início da transação, e trocar a string de conexão runtime para um role não-superuser (`eldox_app`).
- **Esforço:** M (8-12h); requer refatorar PrismaService para usar `$transaction` interactive em toda request.
- **Risco regressão:** ALTO (pode quebrar queries públicas como `rdo-cliente`, QR Code).

### 🔴 BUG-MT-002 — RLS com cobertura parcial (tabelas críticas descobertas)

- **Arquivo:evidência:** `backend/prisma/rls/rls.sql` habilita RLS apenas para: `Usuario`, `Obra`, `ObraLocal`, `ObraTipo`, 12 tabelas `ged_*`, `whatsapp_configuracoes`, 5 tabelas `ia_*`. `backend/prisma/rls/rls_rdo.sql` adiciona 11 tabelas `rdo_*`. **Nenhuma tabela FVS**, **nenhuma tabela FVM**, **nenhuma tabela ensaio_***, **nenhuma tabela aprovacao_***, **nenhuma workflow_**, **concretagem_croquis**, `semaforo_pbqph_cache`, `nao_conformidades`, `empresas_efetivo`, `registros_efetivo`, `itens_efetivo`, `alm_*`, `pa_*`, `ro_*`, `fvs_markup_anotacoes`, `fvs_timeline` têm políticas RLS.
- **Sintoma:** Mesmo que BUG-MT-001 fosse corrigido, metade do schema ficaria sem a camada defensiva — ou seja, se um desenvolvedor esquecer `tenant_id` numa query de `fvs_fichas` ou `ensaio_laboratorial`, o vazamento é total.
- **Correção sugerida (referência):** criar `rls_fvs.sql`, `rls_fvm.sql`, `rls_ensaios.sql`, `rls_aprovacoes.sql`, `rls_concretagem.sql`, `rls_almoxarifado.sql`, `rls_ncs.sql`, `rls_efetivo.sql`, `rls_planos_acao.sql`, `rls_semaforo.sql` com o mesmo padrão.
- **Esforço:** L (12-20h) — mapear 30+ tabelas.
- **Risco regressão:** MÉDIO — exige combo com BUG-MT-001.

### 🔴 BUG-MT-003 — Ausência de Prisma middleware que injete tenantId automaticamente

- **Arquivo:evidência:** `backend/src/prisma/prisma.service.ts:1-19` — nenhum `$use` nem `$extends`. `backend/src/prisma/prisma.module.ts:1-9` — módulo global apenas re-exporta o service. Não existe pasta `backend/src/prisma/middleware/`.
- **Sintoma:** Todo filtro `WHERE tenantId` é manual em cada service. Qualquer refactor futuro que esqueça o filtro numa query (especialmente em `findUnique`, `update`, `delete` por id) vaza dados. Padrão de arquitetura defensiva recomendado (referência camada-07 7.2) não implementado.
- **Correção sugerida (referência):** criar Prisma Client Extension que, para todo model com `tenantId` no schema, injeta `where: { ...existing, tenantId }` automaticamente; e lança erro se tenant não setado.
- **Esforço:** L (20-30h) — exige tratar caso `tenantId = 0` (registros de sistema) e rotas públicas.
- **Risco regressão:** ALTO — pode quebrar queries legítimas que usam `tenantId = 0`.

---

### 🟠 BUG-MT-004 — `UPDATE ged_versoes ... WHERE id = $1` sem tenant_id (4 ocorrências)

- **Arquivo:linha:**
  - `backend/src/ged/ged.service.ts:478` — `UPDATE ged_versoes SET status = 'IFA' WHERE id = $1`
  - `backend/src/ged/ged.service.ts:512` — `UPDATE ... SET status = $1, aprovado_por = $2, aprovado_em = NOW() WHERE id = $3`
  - `backend/src/ged/ged.service.ts:548` — `UPDATE ged_versoes SET status = 'OBSOLETO' WHERE id = $1`
  - `backend/src/ged/ged.service.ts:576` — `UPDATE ged_versoes SET status = 'REJEITADO' WHERE id = $1`
- **Sintoma:** Atualizações por `id` puro; porém cada chamada é precedida por `buscarVersao(tenantId, versaoId)` em `ged.service.ts:369-381` que valida o tenant via JOIN com `ged_documentos`. Hoje: **SEGURO**.
- **Risco latente:** Se alguém refatorar e remover o `buscarVersao()`, as updates viram IDOR instantâneo porque a tabela `ged_versoes` NÃO tem coluna `tenant_id` direta — depende sempre de JOIN. Como `ged_versoes` **também não tem RLS** em `rls.sql`, não há rede de segurança.
- **Correção sugerida (referência):** adicionar `tenant_id` em `ged_versoes` desnormalizado + RLS, ou converter updates para `UPDATE ... FROM ged_documentos d WHERE v.id = $1 AND d.tenant_id = $2`.
- **Esforço:** S (2h) — trivial após desnormalizar.
- **Risco regressão:** BAIXO.

---

### 🟠 BUG-MT-005 — Workers Bull (GED) usam `WHERE id = $1` sem tenant_id

- **Arquivo:linha:**
  - `backend/src/ged/workers/ged-classifier.worker.ts:32` — `SELECT id, ocr_texto FROM ged_versoes WHERE id = $1`
  - `backend/src/ged/workers/ged-classifier.worker.ts:73` — `UPDATE ged_versoes SET ai_categorias=..., WHERE id = $4`
  - `backend/src/ged/workers/ged-ocr.worker.ts:37` — `WHERE id = $1` (update)
  - `backend/src/ged/workflow/workflow.service.ts:143,201,222` — `WHERE id = $1`
- **Sintoma:** Jobs processam por `versaoId` do payload sem conferir `tenantId` embora ele venha no payload (`ClassifyJobData`: `{ versaoId, tenantId }` em linha 7-10). Se um job malicioso for enfileirado, atualizará a versão de outro tenant.
- **Risco:** BAIXO (enqueue é interno). Mas quebra o princípio "payload sempre carrega tenantId e jobs validam" da referência camada-07 7.4.
- **Correção sugerida:** adicionar `AND <fk_tenant> = $2` ou desnormalizar `tenant_id`.
- **Esforço:** S (2h).

---

### 🟠 BUG-MT-006 — Webhook NF-e: payload externo decide `tenantId`

- **Arquivo:linha:**
  - `backend/src/almoxarifado/nfe/nfe.service.ts:58` — `const tenantId = extractTenantIdFromPayload(raw);`
  - `backend/src/almoxarifado/nfe/nfe.controller.ts:29-47` — rota `POST /api/v1/almoxarifado/webhooks/nfe` sem `JwtAuthGuard`; autenticação apenas por Bearer token compartilhado (`WEBHOOK_NFE_SECRET`).
  - `backend/src/almoxarifado/nfe/nfe.service.ts:49-52` — idempotência `WHERE chave_nfe = $1` SEM tenantId (cross-tenant).
- **Sintoma:** Se o secret vazar ou se o provedor for comprometido, qualquer atacante com o secret pode criar NF-e no tenant que quiser. Alternativa segura: o `tenantId` deveria ser derivado do endpoint (ex: `webhooks/:tenantSlug/nfe`) com secret por tenant.
- **Correção sugerida:** migrar para HMAC-SHA256 + secret por tenant, endpoint com `:tenantSlug`.
- **Esforço:** M (6-8h).
- **Risco regressão:** MÉDIO — provedor Qive precisa ajustar integração.

---

### 🟡 BUG-MT-007 — `Dashboard.getLayout/saveLayout` sem verificação de `tenantId`

- **Arquivo:linha:**
  - `backend/src/dashboard/dashboard.service.ts:10-14` — `findUnique({ where: { id: usuarioId }, select: { dashboardLayout: true } })`
  - `backend/src/dashboard/dashboard.service.ts:18-22` — `update({ where: { id: usuarioId } })`
- **Sintoma:** Busca layout de qualquer usuário por id. Na prática o `usuarioId` vem do JWT (que foi validado contra tenantId em `jwt.strategy.ts:20-24`), então hoje é SEGURO. Mas se no futuro passar o `usuarioId` por parâmetro de rota, vira IDOR.
- **Correção sugerida:** adicionar `tenantId` no where.
- **Esforço:** S (15min).

### 🟡 BUG-MT-008 — `Aprovacoes.canaprove` consulta `Obra` sem tenantId

- **Arquivo:linha:** `backend/src/aprovacoes/aprovacoes.service.ts:745-747` — `this.prisma.obra.findUnique({ where: { id: instancia.obraId } })`
- **Sintoma:** Busca obra do `instancia.obraId` sem tenantId. `instancia` foi carregada com tenantId já filtrado, portanto `obraId` já é do mesmo tenant. SEGURO hoje, mas depende de invariante implícita.
- **Correção sugerida:** adicionar `tenantId` explícito.
- **Esforço:** S (5min).

### 🟡 BUG-MT-009 — Dashboard feed tem JOIN com `"Obra"` por `obra_id` sem filtro de tenant

- **Arquivo:linha:** `backend/src/dashboard/dashboard.service.ts:80-87` — `(SELECT nome FROM "Obra" WHERE id = nc.obra_id)` dentro de subquery sem `"tenantId" = $1`.
- **Sintoma:** Se uma NC existisse com `obra_id` apontando para obra de OUTRO tenant (bug upstream), o feed retornaria o nome da obra cross-tenant. Hoje proteção depende de integridade dos dados, não da query.
- **Correção sugerida:** adicionar `AND "tenantId" = $1`.
- **Esforço:** S (5min).

### 🟡 BUG-MT-010 — Queries de dashboard referenciam colunas inexistentes

- **Arquivo:linha:**
  - `backend/src/dashboard/dashboard.service.ts:52` — `"aprovadorId"` não existe em `AprovacaoInstancia` (schema tem apenas `solicitanteId`, `etapaAtual`).
  - `backend/src/dashboard/dashboard.service.ts:55-62` — referencia `"GedVersao"` e `"GedDocumento"` CamelCase; schema usa `@@map("ged_versoes")` snake_case. Provavelmente quebra em runtime.
- **Sintoma:** Não é falha de multi-tenant, mas indica que o serviço dashboard pode não estar exercitado em produção — o que é coerente com a ausência de feedback deste bug. [Cross-ref camada 2 — módulos órfãos].

---

### 🔵 INFO-MT-011 — Modelos sem `tenantId` direto (dependem do pai)

Os seguintes modelos do schema NÃO têm `tenantId` explícito, apenas o parent com FK:

- `ObraTipoNivel` (só `obraTipoId`) — schema.prisma:100
- `ObraTipoCampo` (só `obraTipoId`) — schema.prisma:114
- `ObraNivelConfig` (só `obraId`) — schema.prisma:246
- `ObraQualityConfig` (só `obraId`) — schema.prisma:262
- `WorkflowTemplateEtapa` (só `templateId`) — schema.prisma:716
- `AprovacaoDecisao` tem `tenantId` — ok

Risco real: baixo, mas qualquer query direta por id nesses modelos vira IDOR trivial porque o modelo desconhece tenant. A tabela `ObraQualityConfig` é acessada via `prisma.obraQualityConfig.findUnique({ where: { obraId } })` em `obras.service.ts:719`. Protegido hoje por `findOne(tenantId, obraId)` acima (`obras.service.ts:718`).

- **Correção sugerida (referência):** desnormalizar `tenantId` em todos esses modelos para permitir RLS e queries defensivas.

---

### 🔵 INFO-MT-012 — SUPERUSER bypass em produção = RLS inerte

- **Arquivo:linha:** `backend/prisma/rls/rls.sql:84-86` e `README.md:46` explicitam que SUPERUSER bypassa RLS.
- **Sintoma:** como confirmado em BUG-MT-001, o app usa SUPERUSER. A role `eldox_app` é criada mas nunca usada.
- **Cross-ref camada 9 — backup/restore:** restore via `pg_restore` também SUPERUSER — não há como fazer restore parcial por tenant sem BYPASSRLS explícito.

---

## 3. Teste Adversarial (IDOR estático)

### 3.1 `/api/v1/obras/:id` (ObrasController.findOne)

- **Path:** `backend/src/obras/obras.controller.ts:87-92` → `obras.service.ts:230-244`
- **Análise:** `findOne(tenantId, id)` usa `findFirst({ where: { id, tenantId, deletadoEm: null } })`. ✅ **SEM IDOR**.

### 3.2 `/api/v1/obras/:id` (PUT) — `ObrasService.update`

- **Path:** `obras.controller.ts:94-102` → `obras.service.ts:290-329`
- **Análise:** chama `findOne(tenantId, id)` primeiro (linha 291). Depois `obra.update({ where: { id } })` sem tenantId — mas já validou. ✅ **SEM IDOR**.

### 3.3 `/api/v1/fvs/fichas/:id` (InspecaoController)

- **Path:** `backend/src/fvs/inspecao/inspecao.controller.ts:71-78` → `inspecao.service.ts:63` (`WHERE id = $1 AND tenant_id = $2`). ✅ **SEM IDOR**.
- **Path PATCH:** `inspecao.controller.ts:80-90` → mesma validação. ✅.

### 3.4 `/api/v1/ged/versoes/:versaoId/download`

- **Path:** `ged.controller.ts:140-147` → `ged.service.ts:buscarVersao` (linha 369: `WHERE v.id = $1 AND d.tenant_id = $2`). ✅ **SEM IDOR**.

### 3.5 `/api/v1/diario/rdos/:id`

- **Path:** `rdo.controller.ts:110-117` → `rdo.service.ts:67` (`WHERE id = $1 AND tenant_id = $2`). ✅ **SEM IDOR**.

### 3.6 Conclusão dos testes adversariais

Em análise estática dos três módulos solicitados (obras, fvs, ged) **não há IDOR explorável**. A disciplina do time é alta em nível de service. A vulnerabilidade real é arquitetural (BUG-MT-001/002/003): qualquer refactor futuro que esqueça `tenantId` estaria totalmente desprotegido porque NÃO há rede de segurança RLS/middleware.

---

## 4. Isolamento de Storage (MinIO)

- **Arquivo:linha:** `backend/src/ged/storage/minio.service.ts:33` — bucket único `eldox-ged` compartilhado.
- **Arquivo:linha:** `minio.service.ts:120-129` (`buildStorageKey`) — path por tenant: `{tenantId}/{obraId}/{documentoId}/{filename}`. ✅
- **Arquivo:linha:** `backend/src/obras/obras.service.ts:210` — foto capa: `${tenantId}/obras/${obraId}/capa/${uuid}.webp`. ✅
- **Arquivo:linha:** `backend/src/diario/rdo/rdo-fotos.service.ts:89` — `rdo-fotos/tenant-${tenantId}/rdo-${rdoId}/{...}`. ✅
- **Risco:** presigned URLs de download (`minio.service.ts:75-82`) são geradas SEM verificar que a key começa com o tenant correto. Depende 100% do caller (service) ter validado antes. Aceitável, mas pode ser reforçado com validação defensiva: `if (!key.startsWith(\`\${tenantId}/\`)) throw`.

---

## 5. Jobs e Filas

- **Payload de job carrega tenantId?** Parcialmente.
  - ✅ `GedClassifierWorker` recebe `{ versaoId, tenantId }` mas ignora tenantId (BUG-MT-005).
  - ✅ `NfeService.processarWebhook` recebe `{ webhookId }` e busca tenantId da tabela (`alm_nfe_webhooks.tenant_id`).
  - ✅ `EscalacaoProcessor` roda cron global e itera todas as instâncias, propagando tenant_id por linha.
- **Logs identificam tenantId?** Sim (logs estruturados em `rdo-fotos.service.ts:118-127`, `ged.service.ts`, etc.).

---

## 6. Endpoints Públicos (sem JWT)

| Rota | Arquivo | Mecanismo de escopo | Risco |
|------|---------|---------------------|-------|
| `GET /fvs-cliente/:token` | `fvs/cliente/fvs-cliente.controller.ts:18` | Token `fvs_fichas.token_cliente` (unique) | ✅ OK |
| `GET /fvs-cliente/:token/pdf` | idem | idem | ✅ OK |
| `GET /relatorio-cliente/:token` (RDO) | `diario/rdo/rdo-cliente.controller.ts:19` | `rdos.token_cliente` + expiração | ✅ OK |
| `GET /api/v1/ged/qr/:qrToken` | `ged/ged.controller.ts:215` | `ged_versoes.qr_token` (unique) | ✅ OK (presigned URL curta) |
| `GET /portal/cotacao/:token` | `almoxarifado/cotacoes/portal-fornecedor.controller.ts:28` | Token da cotação | ✅ OK |
| `GET /api/v1/portal/concretagem?token=xxx` | `concretagem/concretagens/portal-fornecedor.controller.ts:11` | Token | ✅ OK |
| `POST /api/v1/almoxarifado/webhooks/nfe` | `almoxarifado/nfe/nfe.controller.ts:29` | Bearer secret global | 🟠 BUG-MT-006 |
| `POST /api/v1/diario/whatsapp/campo` | `diario/whatsapp/whatsapp.controller.ts:77` | HMAC do Meta + lookup por número | ✅ OK |

---

## 7. Checklist de Sanidade (referência camada-07 7.10)

| Item | Estado |
|------|--------|
| TODA tabela de negócio no schema tem `tenantId`? | **Parcialmente** — 32 modelos, 88 ocorrências. Faltam tenantId direto em: ObraTipoNivel, ObraTipoCampo, ObraNivelConfig, ObraQualityConfig, WorkflowTemplateEtapa (dependem do parent — INFO-MT-011) |
| TODA query Prisma filtra por tenantId? | **Quase** — achados pontuais 🟡 e 🟠; módulos auditados (obras, fvs, ged, rdo, aprovacoes) estão SEGUROS na análise estática |
| Middleware/interceptor global Prisma? | ❌ **NÃO EXISTE** (BUG-MT-003) |
| JWT carrega tenantId + Guard valida? | ✅ Sim (`auth/jwt.strategy.ts:19-24`) |
| Endpoints `:id` validam ownership? | ✅ Sim nos módulos testados |
| Upload MinIO isola por tenant? | ✅ Sim (path prefix) |
| Jobs carregam tenantId no payload? | ✅ Sim (com ressalva BUG-MT-005) |
| Listagens retornam cross-tenant? | ❌ Não — todas filtram |
| Convite de usuário vincula no tenant certo? | ✅ Sim (`auth.service.ts:34-48`) |
| RLS em rls.sql + rls_rdo.sql completo? | ❌ **NÃO** (BUG-MT-002) |
| SUPERUSER bypass riscado? | ❌ **NÃO** (BUG-MT-001/012) — risco ativo |
| Admin global vs admin de tenant — escopo correto? | ✅ `SUPER_ADMIN` existe em enum mas não é implementado como cross-tenant (nenhuma lógica de impersonação/bypass) |
| Query de sanidade (linhas com tenantId NULL)? | ⚠️ Não executada — não executei SQL ao vivo |
| Log de "quase vazamento" | ❌ Não existe (depende de BUG-MT-003) |
| Testes CI de isolamento | ❌ Não encontrei testes e2e de isolamento multi-tenant nos specs |

---

## 8. Cross-refs

- **[Cross-ref camada 1 — lint/schema]:** tabelas `ged_versoes` (snake_case, em migration) vs `"GedVersao"` (referenciado em dashboard) indicam inconsistência de naming — Dashboard provavelmente quebra em runtime.
- **[Cross-ref camada 2 — módulos órfãos]:** Dashboard (BUG-MT-010) com colunas inexistentes reforça suspeita de módulo não exercitado.
- **[Cross-ref camada 6 — segurança/Auth]:** validar se `JwtAuthGuard` está aplicado em TODOS os controllers (há controllers sem `@UseGuards` a nível de classe — portal, fvs-cliente, rdo-cliente, whatsapp, webhooks/nfe — todos intencionais, mas confirmar).
- **[Cross-ref camada 8 — IA]:** agentes Anthropic (`backend/src/ai/agents/`) também deveriam validar tenantId ao buscar contexto para prompt. Não auditei esta camada.
- **[Cross-ref camada 9 — backup/restore]:** restore parcial por tenant é impossível hoje (ver INFO-MT-012).

---

## Resumo para Orquestrador

- **Total de achados:** 12 (3 🔴 / 3 🟠 / 4 🟡 / 2 🔵)
- **Top 3 (ação imediata):**
  1. 🔴 **BUG-MT-001** — RLS está morto em produção (middleware Prisma `$use` nunca foi implementado; app conecta como SUPERUSER que bypassa RLS). *Arquivo:* `backend/src/prisma/prisma.service.ts:1-19` vs `backend/prisma/rls/README.md:57-69`.
  2. 🔴 **BUG-MT-002** — RLS cobre apenas ~33 de 60+ tabelas: FVS, FVM, ensaios, aprovações, concretagem, almoxarifado, efetivo, semaforo e planos_acao **não têm política RLS alguma**. *Arquivo:* `backend/prisma/rls/rls.sql` (só Usuario, Obra, ObraLocal, ObraTipo, ged_*, ia_*).
  3. 🔴 **BUG-MT-003** — Nenhum Prisma Extension/middleware global que injete `tenantId` automaticamente. Isolamento depende 100% de cada service lembrar de filtrar. *Evidência:* `grep "prisma.$use\|$extends"` em `backend/src` = 0 matches.
- **Ação urgente recomendada:** implementar middleware Prisma que **fail-closed** se `tenantId` ausente no contexto, mesmo antes de completar RLS de todas as tabelas. Isso fecha 80% do risco residual em menos de um sprint.
- **IDOR testado (estática):** Obras, FVS fichas, GED versões, RDO — **nenhum IDOR explorável encontrado** na análise de código.
- **Mobile:** N/A — `frontend-mobile/` não existe no repo.
- **Cross-refs:** camada 1 (inconsistência naming dashboard), camada 2 (dashboard órfão), camada 6 (auth guards), camada 8 (agentes IA), camada 9 (restore por tenant).
