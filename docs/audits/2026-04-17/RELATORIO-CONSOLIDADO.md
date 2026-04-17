# Relatório de Auditoria — Eldox SaaS — 2026-04-17

**Orquestrador:** pipeline paralelo de 11 auditores de camada (camada 5 Mobile propositalmente omitida).
**Base:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3` (NestJS 11 + Prisma 7 + PostgreSQL + React 19/Vite 8).
**Contexto compartilhado:** [`_context.md`](_context.md).

---

## 1. Resumo Executivo

### Totais consolidados (pós dedup de cross-refs)

| Severidade | Antes dedup | Após dedup | O que significa |
|---|---:|---:|---|
| 🔴 Críticos | 43 | **40** | Impedem uso, vazam dados, quebram segurança ou compliance legal |
| 🟠 Altos | 75 | **~68** | Módulo inacessível, feature quebrada, risco de segurança defense-in-depth |
| 🟡 Médios | 82 | **~78** | Funcionalidade parcial, UX ruim mas contornável |
| 🔵 Baixos | 41 | **~40** | Polimento, inconsistências visuais/textuais |
| ⚠️ Pendentes | ~15 | 15 | Itens que exigem ambiente de staging ou decisão de produto |

**Bugs válidos totais:** ~226 achados com arquivo:linha (após dedup ~210).

### Top 5 problemas mais críticos

1. **[C1] Sidebar quebrado** (sintoma reportado pelo usuário) — `Sidebar.tsx:206-208, 225-227, 259-265`. Grupos Concretagem/Ensaios/Almoxarifado e links Efetivo/Planos-de-Ação colapsam ~15 subitens para `/obras` quando `useResolvedObraId()` retorna `null` (tenant novo sem obra). Combinado com `NavItem.tsx:117 isAnyActive`, todos subitens ficam "ativos" simultaneamente em `/obras`. **Causa-raiz confirmada.**
2. **[C2] Multi-tenancy com RLS morto** — `PrismaService.prisma/prisma.service.ts:8-9` conecta como SUPERUSER; nenhum `$use` / `$extends` / `SET LOCAL app.tenant_id` no código. RLS habilitado em `prisma/rls/*.sql` é **inerte**. Sem middleware Prisma global injetando `tenantId` — toda proteção depende de disciplina manual.
3. **[C3] `VariantesController` + `SinapiController` sem `@UseGuards`** — `backend/src/almoxarifado/ia/variantes.controller.ts:20` e `sinapi/sinapi.controller.ts:15`. Endpoints autenticados "em intenção" aceitam chamadas anônimas que escrevem no banco (Sinapi aceita xlsx 50 MB). Fix = 2 linhas.
4. **[C4] Tabela `audit_log` NÃO EXISTE** — referenciada por INSERT em **16 services** (ncs, cps, laudos, racs, caminhoes, croqui, fvm/recebimento, evidencias, laboratorios, tipos, ensaios, revisoes, email-concretagem). Todos falham silenciosamente em `.catch`. Compliance PBQP-H/ISO 9001/LGPD **quebrado**.
5. **[C5] LGPD zero + NBR 12655 incompleto** — `Usuario.deletedAt` mantém PII sem anonimização; sem consentimento/DPO/export. `traco_especificado VARCHAR(100)` é texto livre; cura **não registrada em lugar nenhum**; CP liga a caminhão, não a elemento estrutural do croqui.

### Módulos órfãos identificados

| Módulo | Status | Decisão necessária |
|---|---|---|
| **Gestão de Frota / Equipamentos** | ❌ Declarado em `AGENTS.md` + skill; **0 tabelas / 0 controller / 0 página** | Remover do escopo **OU** abrir sprint dedicado |
| **Rastreabilidade NBR 12655 (módulo dedicado)** | ⚠️ Existe só como sub-feature de Concretagem/Croqui; sem rota `/rastreabilidade` | Remover ou criar página agregadora |
| **Usuários / Tenants / Planos (CRUD)** | ❌ Tabelas no Prisma mas **zero endpoint** (só `/auth/login`) | Bloqueante para SaaS multi-usuário — abrir sprint |
| **EldoX.IA (página dedicada)** | ⚠️ Só existe como widget flutuante `AgenteFloat`; sem rota própria | Baixo — decidir se merece entrada no menu |
| **Laboratórios (`LaboratoriosPage.tsx`)** | ⚠️ Arquivo existe mas nunca importado em `App.tsx` | Expor ou arquivar |
| **Tela `/aprovacoes/templates`** | ⚠️ Rota existe mas sem link no sidebar | Adicionar link no grupo Cadastros |
| **`TestShellPage.tsx`** | ⚠️ Página órfã de teste | Arquivar |
| **`AppController` raiz** | ❌ Existe em disco mas **não registrado** em `app.module.ts` → `GET /` retorna 404 | Registrar ou remover |

### Cobertura da auditoria

- ✅ **Camadas 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12 auditadas** em paralelo, cada uma com relatório próprio em `docs/audits/2026-04-17/camada-NN-*.md`.
- ❌ **Camada 5 (Mobile & Offline-First) não auditada** — app mobile ainda não desenvolvido. Pasta `frontend-mobile/` inexistente. ADR-013/014 projetam React Native + Expo + WatermelonDB, mas ainda não iniciado. Qualquer referência a "mobile" nas demais camadas foi marcada como "N/A — mobile não desenvolvido nesta fase".
- ⚠️ **Verificações pendentes** (15 itens) — requerem ambiente de staging com banco real para confirmar (testes adversariais IDOR em runtime, smoke test de upload MinIO, stress test de concorrência, etc.).

### Divergências stack × skill

- Skill menciona **Fastify** — o real é **NestJS 11** (`@nestjs/platform-express`).
- Skill menciona **mobile desenvolvido** — não existe.
- Skill menciona **monorepo formal** — `backend/` e `frontend-web/` são siblings sem workspace.

---

## 2. 🔴 Problemas Críticos (40)

### Bloco A — Sidebar e Navegação (sintoma reportado)

#### [C1] Submenus contextuais do sidebar colapsam para `/obras` sem obra ativa
- **Camada:** 1 (Navegação)
- **Onde:** `frontend-web/src/components/layout/Sidebar.tsx:206-208, 225-227, 259-265` + `NavItem.tsx:117 (isAnyActive)`
- **Sintoma:** tenant novo (sem obra) vê Concretagem/Ensaios/Almoxarifado/Efetivo/Planos-de-Ação todos apontando para `/obras`; em `/obras`, todos submenus abrem e ficam "ativos" simultaneamente.
- **Causa:** `useResolvedObraId()` retorna `null` e os helpers fazem fallback silencioso para `/obras`.
- **Correção:** renderizar grupos contextuais como `disabled` com tooltip "Cadastre uma obra primeiro" em vez de fallback; **OU** redirecionar clique para wizard de nova obra.
- **Esforço:** P (2-3h). **Risco de regressão:** baixo.
- **Cross-ref:** [A12] (M02-012).

### Bloco B — Multi-tenancy e Segurança crítica

#### [C2] PrismaService não ativa RLS — políticas inertes em produção
- **Camadas:** 3 + 7 (dedup)
- **Onde:** `backend/src/prisma/prisma.service.ts:1-19`
- **Sintoma:** RLS está habilitado em `backend/prisma/rls/rls.sql` e `rls_rdo.sql`, mas nenhum middleware Prisma (`$use`/`$extends`) executa `SET LOCAL app.tenant_id`. O app conecta como SUPERUSER (bypassa RLS automaticamente) → políticas nunca são exercidas.
- **Correção:** criar `PrismaMiddleware` fail-closed que (a) exige `tenantId` no contexto ou lança; (b) injeta `tenantId` em todo `where`; (c) executa `SET LOCAL app.tenant_id` na sessão. Usar role `eldox_app` (não SUPERUSER) em produção.
- **Esforço:** M (1 sprint). **Risco:** médio (pode revelar queries hoje sem filtro).

#### [C3] Cobertura RLS parcial — ~33 de 60+ tabelas sem política
- **Camada:** 7
- **Onde:** `backend/prisma/rls/rls.sql`, `rls_rdo.sql`
- **Sintoma:** FVS completo, FVM, ensaios, aprovações, concretagem (exceto croqui), almoxarifado, efetivo, semaforo, planos_acao, NCs unificadas **sem** política RLS.
- **Correção:** completar script RLS para todas as tabelas de negócio; aplicar automaticamente no deploy via migration hook.
- **Esforço:** M. **Risco:** médio.
- **Cross-ref:** [A5] (M02-013).

#### [C4] `VariantesController` sem `@UseGuards` — IDOR/bypass total
- **Camada:** 3
- **Onde:** `backend/src/almoxarifado/ia/variantes.controller.ts:20-21`
- **Sintoma:** qualquer visitante anônimo pode ler sugestões IA, criar variantes, marcar ativas de qualquer tenant. `req.user === undefined` → `tenantId === undefined` → query raw insere `NULL`.
- **Correção:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@TenantId()`.
- **Esforço:** XS (1 linha). **Risco:** nulo.

#### [C5] `SinapiController` sem `@UseGuards` + aceita xlsx 50 MB anônimo
- **Camada:** 3
- **Onde:** `backend/src/almoxarifado/sinapi/sinapi.controller.ts:15`
- **Sintoma:** DoS via arquivo gigante; poluição do catálogo SINAPI compartilhado; exposição a CVEs conhecidos de `xlsx@0.18.5`.
- **Correção:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('SUPER_ADMIN')`; limite de 10 MB específico.
- **Esforço:** XS. **Risco:** nulo.

#### [C6] Webhooks WhatsApp/NF-e fail-open se secret ausente
- **Camada:** 3
- **Onde:** `backend/src/diario/whatsapp/whatsapp.controller.ts:84-92`, `backend/src/almoxarifado/nfe/nfe.controller.ts:38-44`
- **Sintoma:** padrão `if (APP_SECRET) { verifica HMAC }` — se secret não configurado, aceita qualquer payload.
- **Correção:** fail-closed: rejeitar requisição se secret não presente em produção; logar e alertar.
- **Esforço:** XS.

#### [C7] 17+ endpoints com `@Body()` tipado inline escapam do ValidationPipe
- **Camada:** 3
- **Onde:** `rdo.controller.ts:345/486/544`, `inspecao.controller.ts:350/390/502`, `obras.controller.ts:141`, `variantes.controller.ts:30/52/92`, `cotacoes/portal-fornecedor:82`, etc.
- **Sintoma:** `image_base64`, `dados_json` sem limite de tamanho; ValidationPipe global só valida classes com decorators.
- **Correção:** migrar para DTOs com `class-validator`.
- **Esforço:** M.

### Bloco C — Autenticação / Autorização

#### [C8] `/auth/login` sem rate-limit nem lockout
- **Camada:** 6. **Onde:** `backend/src/auth/auth.controller.ts:30`. **Correção:** `@nestjs/throttler` + contador de falhas/IP+email. **Esforço:** P.

#### [C9] JWT persistido em `localStorage` por default 8h
- **Camada:** 6. **Onde:** `frontend-web/src/store/auth.store.ts:30`, `auth.service.ts:110`, contradiz `.env.example` (15m). **Correção:** access token em memória; forçar `JWT_EXPIRES_IN=15m`. **Esforço:** M.

#### [C10] Sem invalidação de refresh token server-side; [C11] refresh não rotativo com detecção de reuso
- **Camada:** 6. **Correção:** tabela `refresh_tokens` com revogação; rotação + detecção de reuso. **Esforço:** M.

#### [C12] Frontend sem proteção por role; sidebar igual para todas as roles
- **Camadas:** 1 + 6 (dedup)
- **Onde:** `layouts/AppLayout.tsx:9-21` (único guard é `isAuthenticated`)
- **Sintoma:** `VISITANTE` acessa `/configuracoes/*`, `/fvs/modelos/novo`, `/aprovacoes/templates`.
- **Correção:** componente `RequireRole` + filtrar itens do sidebar por `user.role`. **Esforço:** M.

#### [C13] Role `LABORATORIO` existe no enum mas não aparece em nenhum `@Roles(...)` de controller
- **Camada:** 6. **Correção:** definir política por módulo ou remover do enum. **Esforço:** P.

### Bloco D — Frontend quebrado funcionalmente

#### [C14] Duplo prefixo `/api/v1` em chamadas FVM — 404 silencioso
- **Camada:** 4. **Onde:** `frontend-web/src/modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage.tsx:53`, `modules/almoxarifado/compras/pages/NovaOcPage.tsx:54, 78`. **Correção:** remover prefixo duplicado. **Esforço:** XS.

#### [C15] Links absolutos `<a href="/api/v1/...">` no RDO ignoram backend separado
- **Camada:** 4. **Onde:** `modules/diario/pages/RdoFormPage.tsx`. **Correção:** usar `apiBase` ou `axios.get` + blob. **Esforço:** P.

#### [C16] Interceptor de refresh não unwrappa `{data:{token}}`, não exclui `/auth/refresh` do 401, queue trava no logout
- **Camada:** 4. **Onde:** `frontend-web/src/services/api.ts:21-75`. **Correção:** rewrite do interceptor. **Esforço:** P.

### Bloco E — Dados, Enums, Integridade Referencial

#### [C17] Enums RDO Prisma × frontend totalmente desalinhados
- **Camada:** 8
- **Onde:** `schema.prisma:279-307` (`RdoStatus {PREENCHENDO REVISAO APROVADO}`) vs `frontend-web/src/services/rdo.service.ts:6` (`'preenchendo'|'revisao'|'aprovado'|'cancelado'`).
- **Sintoma:** `22P02 invalid_text_representation` em todo POST/PATCH de RDO. `RdoCondicaoClima`, `RdoTipoMaoDeObra`, `RdoPeriodo` também divergem.
- **Correção:** sincronizar tipos + testes de contrato. **Esforço:** P. **Severidade:** bug runtime.

#### [C18] `schema.prisma` tem apenas 1 `onDelete` explícito em 859 linhas
- **Camadas:** 2 + 3 + 8 (dedup C21/M02-003)
- **Onde:** `backend/prisma/schema.prisma:848` (única ocorrência). RDO: 0 onDeletes em 17 FKs. GED mistura CASCADE/RESTRICT/SET NULL.
- **Correção:** ADR de política de exclusão + revisão de todas as @relation + migration aditiva. **Esforço:** G.

#### [C19] `NaoConformidade`, `ConcretagemCroqui`, `SemaforoPbqphCache` com FKs apenas como `Int` (sem `@relation`)
- **Camada:** 2. **Onde:** `schema.prisma:609-613, 534, 557`. **Correção:** declarar `@relation` + FK real no SQL. **Esforço:** M. **Risco:** dados órfãos não detectados hoje.

#### [C20] Três convenções de soft-delete no mesmo schema
- **Camada:** 8. **Correção:** padronizar em `deletedAt` + ADR. **Esforço:** M.

#### [C21] `date-fns-tz` ausente; timezone nunca convertido
- **Camada:** 8. **Onde:** `America/Cuiaba` aparece 0x; `fvs-dashboard.controller.ts:129` usa `.toISOString()` puro. **Correção:** instalar `date-fns-tz` + helper central. **Esforço:** P.

#### [C22] Sem validação matemática de CNPJ (DTOs só checam `@MaxLength(18)`)
- **Camada:** 8. **Correção:** validador customizado. **Esforço:** XS.

#### [C23] Seed "Celina Bezerra" não é idempotente
- **Camada:** 8. **Onde:** `prisma/seed-obra-celina-bezerra.ts:62` faz `create` sem check, sem `@@unique` em Obra. **Correção:** `upsert` + constraint única. **Esforço:** P.

### Bloco F — Infraestrutura e Deploy

#### [C24] Sem backup automatizado do PostgreSQL em produção
- **Camada:** 10. **Onde:** `infra/docker-compose.prod.yml:4-21` + ausência em `docs/`. **Correção:** `pg_dump` diário para S3/MinIO externo, retenção 30d, smoke-test mensal. **Esforço:** 4h.

#### [C25] Sem `/healthz` + compose-prod sem healthcheck backend/frontend
- **Camadas:** 10 + 11 (dedup BUG-11-002)
- **Onde:** `backend/src/` sem `@Get('/health')`; `docker-compose.prod.yml:52-87` sem `healthcheck:`.
- **Correção:** `@nestjs/terminus` + `GET /api/v1/health` (Prisma + Redis + MinIO) + healthcheck em compose. **Esforço:** P (2h).

#### [C26] `AppController` não registrado no `AppModule` → `GET /` retorna 404
- **Camada:** 11. **Onde:** `backend/src/app.module.ts:22-54` + `app.controller.ts:1-12`. **Correção:** registrar ou remover. **Esforço:** XS.

#### [C27] CI/CD sem gates de qualidade (lint/test/type-check) antes de build+deploy
- **Camada:** 10. **Onde:** `.github/workflows/deploy.yml:1-76`. **Correção:** jobs `test` e `lint` com `needs:`. **Esforço:** 2h.

#### [C28] Rollback não documentado nem automatizado (`:latest` sem tags versionadas)
- **Camada:** 10. **Correção:** tagear `:sha-<commit>` + runbook em `docs/runbooks/rollback.md`. **Esforço:** 3h.

#### [C29] `minio/minio:latest` em produção (sem versão fixa)
- **Camada:** 10. **Onde:** `infra/docker-compose.prod.yml:34`. **Correção:** pinar release estável. **Esforço:** 10min.

#### [C30] Container backend roda como root
- **Camada:** 10. **Onde:** `backend/Dockerfile:13-27`. **Correção:** `USER node`. **Esforço:** 30min.

### Bloco G — Observabilidade / Audit Log

#### [C31] Tabela `audit_log` referenciada por INSERT em 16 services NÃO existe em nenhuma migration
- **Camada:** 11
- **Onde (call sites):** `ncs.service.ts:292`, `cps.service.ts:241/261`, `laudos.service.ts:137`, `email-concretagem.service.ts:103`, `concretagens.service.ts:350`, `racs.service.ts:200`, `caminhoes.service.ts:396/416`, `croqui.service.ts:236`, `recebimento.service.ts:440`, `evidencias.service.ts:250`, `laboratorios.service.ts:24`, `tipos.service.ts:77`, `ensaios.service.ts:59`, `revisoes.service.ts:46`.
- **Sintoma:** Erro `relation "audit_log" does not exist` engolido por `.catch`. Sistema "parece" auditado mas não é. Viola retenção PBQP-H/ISO/LGPD.
- **Correção:** migration `audit_log_core` com trigger append-only. **Esforço:** M (4h dev + 2h QA).

### Bloco H — i18n/UX crítica

#### [C32] Ausência total de dicionário/helpers pt-BR; 48 arquivos repetem `toLocaleDateString('pt-BR')`
- **Camada:** 9. **Correção:** `lib/format.ts` + `lib/i18n/ptBR.ts` centrais. **Esforço:** M.

#### [C33] `err?.response?.data?.message ?? 'Erro ao ...'` em 48 arquivos expõe stack técnico (Prisma P2002, JWT) direto ao usuário
- **Camada:** 9. **Correção:** tradutor de erros no `api.ts` interceptor + mensagens genéricas em pt-BR. **Esforço:** M.

### Bloco I — Compliance (PBQP-H / ISO 9001 / NBR 12655 / LGPD)

#### [C34] Rastreabilidade de traço não estruturada (NBR 12655 §5.4.2.1)
- **Camada:** 12. **Onde:** `migrations/20260415000002_sprint8_concretagem/migration.sql:41` — `traco_especificado VARCHAR(100)` texto livre. **Correção:** tabela `concretagem_tracos` estruturada. **Esforço:** M.

#### [C35] Cura do concreto não é registrada em lugar nenhum (NBR 14931 §10.5)
- **Camada:** 12. **Correção:** adicionar `concretagem_cura` (inicio/fim/metodo). **Esforço:** P.

#### [C36] Vínculo CP ↔ elemento estrutural do croqui é apenas texto livre
- **Camada:** 12. **Correção:** FK `cp_id → croqui_elemento_id`. **Esforço:** M.

#### [C37] Efetivo não identifica trabalhadores individualmente (NR-18, MTE 671/2021)
- **Camada:** 12. **Onde:** `migrations/20260415000010_efetivo_module/migration.sql:64-73` — só `empresa_id, funcao_id, quantidade`. **Correção:** nova tabela nominal com CPF/CBO/ASO/entrada/saída. **Esforço:** G.

#### [C38] LGPD zero — sem consentimento, DPO, export, anonimização
- **Camada:** 12. **Sintoma:** `Usuario.deletedAt` mantém PII; destinatários externos de Transmittal sem base legal. **Impacto:** multa até 2% faturamento; bloqueia enterprise/gov. **Esforço:** G (sprint dedicado).

#### [C39] Assinatura digital do Diário é só `assinaturaBase64 @db.Text` (imagem) sem força probatória
- **Camada:** 12. **Onde:** `schema.prisma:492`. **Correção:** hash SHA-256 do payload + timestamp externo + cadeia de custódia (ou integração com e-CPF/gov.br). **Esforço:** G.

#### [C40] FKs órfãs — deletar Obra pode deixar ~15 entidades sem error do banco
- **Camada:** 2/3/8 (dedup final de C18/C19).

---

## 3. 🟠 Problemas Altos (agrupados — 75 bugs em 68 após dedup)

### Segurança / Auth / CORS
- [A1] CORS hardcoded `localhost:*` — produção ficará bloqueada (`auth.service.ts` + `main.ts:48-51`).
- [A2] Sem Helmet, sem `@nestjs/throttler` (`backend/package.json` limpo).
- [A3] Login vaza distinção "tenant inexistente/inativo" vs "credenciais inválidas" (enumeração).
- [A4] Sem audit log de login (sucesso/falha).
- [A5] Sem recuperação de senha, sem convite, sem 2FA — **inviável para lançamento**.
- [A6] JWT default 8h no service contradiz `.env.example` 15m.
- [A7] Frontend lê `role` do body do login, não do JWT.
- [A8] Portais públicos (`/portal/cotacao`, `/relatorio-cliente`, `/fvs-cliente`) sem rate limit; tokens em URL logada.
- [A9] Webhook NF-e deriva `tenantId` do payload externo com secret global (BUG-MT-006).
- [A10] Workers Bull GED ignoram `tenantId` no payload (BUG-MT-005).
- [A11] `UPDATE ged_versoes WHERE id=$1` em `ged.service.ts:478/512/548/576` sem `tenantId` (BUG-MT-004).

### Navegação / Rotas / RBAC
- [A12] Sem guards por role em rotas; `VISITANTE` acessa `/configuracoes/*` (cross-ref [C12]).
- [A13] Breadcrumb global sempre vazio (`AppLayout.tsx:17` nunca passa a prop).
- [A14] Fallback `/obras` no `PlanosAcaoLink` e `EfetivoNavLink` (cross-ref [C1]).
- [A15] Sistema de Usuários/Tenants sem CRUD (M02-013).

### Dados e Performance
- [A16] Unicidade de Obra inexistente — permite duplicatas.
- [A17] Schema Prisma omite modelos que existem no banco.
- [A18] `DELETE FROM` direto em 16 services (hard delete).
- [A19] Filtro "últimos 30 dias" em UTC ignora timezone local.
- [A20] Unidade `m3` (ASCII) aparece como valor de enum/dado, não só como label.
- [A21] Máscara de CNPJ no frontend sem validação de dígitos.
- [A22] Busca textual não é accent-insensitive.
- [A23] Sem constraint de unicidade para numeração de NC.
- [A24] TOCTOU `findFirst(tenantId) → update(id)` em Obras/Aprovações.
- [A25] `findMany` sem `take` em `aprovacoes.pendentesParaMim`, `obraLocal.findLocais`.

### Frontend / UX
- [A26] **1396 ocorrências** de `style={{...}}` inline em 100 arquivos — design system vazado.
- [A27] Quase nenhum `<label htmlFor>` — a11y severa (apenas 3 em 195 arquivos).
- [A28] **460 cores hardcoded** em 52 arquivos.
- [A29] `useEffect` com dep object-path em `InspecaoModal`.
- [A30] `key={i}` (index) em listas re-renderizáveis.
- [A31] `NcsListPage` silencia erros da API.
- [A32] **19 `window.confirm`/`alert`** quebrando dark theme.

### Infra
- [A33] `ConfigModule` sem `validationSchema` — boot sobe mesmo sem `JWT_SECRET`/`DATABASE_URL`.
- [A34] `.env.example` desatualizado (faltam 10+ envs: `ANTHROPIC_API_KEY`, `SMTP_*`, `EVOLUTION_*`, `WHATSAPP_*`, `ENCRYPTION_KEY`, `REDIS_PASSWORD`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `APP_URL`, `WEBHOOK_NFE_SECRET`, `MINIO_PUBLIC_URL`).
- [A35] `frontend-web/` sem `.env.example` apesar de consumir `VITE_API_URL`.
- [A36] `backend/Dockerfile:19` copia `node_modules` completo (~636 MB) para imagem final.
- [A37] Script RLS não é aplicado automaticamente no deploy.
- [A38] nginx sem headers de segurança (HSTS, CSP, X-Content-Type-Options).
- [A39] Redis prod sem senha.

### Compliance
- [A40] NC global sem ciclo CAPA (causa_raiz/eficácia ausentes).
- [A41] Planos de Ação restritos a FVS (não generalizados para Ensaio/FVM).
- [A42] GED documentos sem `responsavel_tecnico_id` / `numero_art`.
- [A43] RDO mão-de-obra sem CPF/CBO (livre).
- [A44] Três tabelas paralelas de NC (global, FVS, FVM) sem unificação.
- [A45] Versão GED editável em metadados (só `audit_log` tem trigger).
- [A46] Sem retenção programática de documentos.
- [A47] Laboratórios sem validação INMETRO.

### i18n
- [A48] Padrão `err?.response?.data?.message ?? 'Erro ao ...'` em 48 arquivos (cross-ref [C33]).

---

## 4. 🟡 Problemas Médios (~78)

Resumido — lista completa nos relatórios por camada:
- "(s)/(ns)" espalhado em 15+ locais (inclusive PDFs para cliente).
- `m³` colado sem espaço em `ConcrtagemDetalhePage:257`, `ConcretagemVolumeWidget:28`.
- "Excluir" vs "Remover" inconsistente entre módulos.
- `toFixed(1)` gera `"75.5%"` (ponto inglês) em 14 pontos.
- 14+ `window.confirm/alert/prompt` nativos em vez de `Modal/Toast` do DS.
- Dois `useToast` diferentes coexistindo.
- Apenas 29 `aria-label` em 195 arquivos.
- `/fvs/fichas/:fichaId/inspecao` — label "Templates" vs "Modelos" (M02-011).
- `TestShellPage.tsx` dead code.
- Avatar da topbar sem `onClick`, iniciais "IP" hardcoded.
- Badge de 3 notificações hardcoded.
- `AgenteFloat` não-lazy.
- Reticências `...` (125x) vs `…` (47x) misturadas.
- Bundle de 2.27 MB sem code-splitting agressivo.
- Dashboard referencia colunas inexistentes (`aprovadorId`, `GedVersao` CamelCase).

---

## 5. 🔵 Problemas Baixos (~40)

Polimento visual, renomeações de labels, TODOs espalhados, etc. — detalhados nos 11 relatórios de camada.

---

## 6. ⚠️ Verificações Pendentes (15)

Requerem ambiente de staging ou decisão de produto:
- [V1] Teste IDOR em runtime (payload cruzado entre tenants).
- [V2] Stress test de upload MinIO (limites, concorrência).
- [V3] Smoke test do script RLS após aplicação em banco vazio.
- [V4] Validação da cadeia de refresh token sob carga.
- [V5] Teste de restauração de backup (quando existir).
- [V6] Decisão de produto: Frota/Rastreabilidade — remover do escopo ou implementar?
- [V7] Decisão: migrar EldoX.IA para página dedicada?
- [V8] Auditoria dependências (npm audit) em staging.
- [V9] Pen-test em portais públicos (`/portal/*`).
- [V10-15] Testes cross-tenant específicos, validação de LGPD, cobertura RLS empírica.

---

## 7. 📊 Tabela-Cruzada do Sidebar (Camada 1)

| # | Item Sidebar | Rota | Existe | Carrega | Backend | Permissão | Status |
|---|---|---|:---:|:---:|---|---|---|
| 1 | Dashboard | `/dashboard` | ✅ | ✅ | `dashboard/` | login-only | OK |
| 2 | Obras | `/obras` | ✅ | ✅ | `obras/` | login-only | OK |
| 3 | FVS → Inspeções | `/fvs/fichas` | ✅ | ✅ | `fvs/` | login-only | OK |
| 3b | FVS → Templates | `/fvs/modelos` | ✅ | ✅ | `fvs/` | login-only | ⚠️ label "Templates" inconsistente |
| 4 | Dashboard FVS | `/fvs/dashboard` | ✅ | ✅ | `fvs/` | login-only | ⚠️ UI condicionada a `obraId` |
| 5 | NCs (global) | `/ncs` | ✅ | ✅ | `ncs/` | login-only | OK |
| 6 | Planos de Ação | `/obras/{id}/fvs/planos-acao` ou `/obras` | ✅ | ✅ | `planos-acao/` | login-only | 🟠 fallback `/obras` |
| 7 | Concretagem (grupo) | `/obras/{id}/concretagem[/...]` ou `/obras` | ✅ | ✅ | `concretagem/` | login-only | 🔴 3 subitens → `/obras` |
| 8 | Ensaios (grupo) | `/obras/{id}/ensaios[/...]` ou `/obras` | ✅ | ✅ | `ensaios/` | login-only | 🔴 3 subitens → `/obras` |
| 9 | Controle de Materiais | `/fvm/obras/{id}` ou `/fvm/catalogo` | ✅ | ✅ | `fvm/` | login-only | OK |
| 10 | Catálogo FVM | `/fvm/catalogo` | ✅ | ✅ | `fvm/` | login-only | OK |
| 11 | Fornecedores | `/fvm/fornecedores` | ✅ | ✅ | `fvm/` | login-only | OK |
| 12 | Almoxarifado (grupo) | `/obras/{id}/almoxarifado[/...]` ou `/obras` | ✅ | ✅ | `almoxarifado/` | login-only | 🔴 7 subitens → `/obras` |
| 13 | Diário de Obra | `/diario` | ✅ | ✅ | `diario/` | login-only | OK |
| 14 | GED | `/ged/admin` | ✅ | ✅ | `ged/` | login-only | OK |
| 15 | Efetivo | `/obras/{id}/efetivo` ou `/obras` | ✅ | ✅ | `efetivo/` | login-only | ⚠️ fallback `/obras` |
| 16 | Aprovações | `/aprovacoes` | ✅ | ✅ | `aprovacoes/` | login-only | OK |
| 17 | Semáforo | `/semaforo` | ✅ | ✅ | `semaforo/` | login-only | OK |
| 18-21 | Cadastros (4 itens) | `/configuracoes/*` | ✅ | ✅ | vários | login-only | OK |

**Leitura:** tecnicamente nenhum link aponta para rota 404 — o sintoma "sidebar quebrado" é o padrão sistêmico de fallback para `/obras` quando `useResolvedObraId()` não resolve.

---

## 8. 📦 Matriz de Módulos (Camada 2) — sem coluna Mobile

| # | Módulo | Prisma | Backend | Web | Sidebar | Docs | Status |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| 1 | Obras | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 2 | FVS | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 3 | FVM | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 4 | NC / CAPA | ✅ | ✅ | ✅ | ✅ | ⚠️ | Ciclo CAPA incompleto (global) |
| 5 | Concretagem | ✅ | ✅ | ✅ | ✅ | ⚠️ | Traço/cura/CP↔elemento incompletos (NBR 12655) |
| 6 | Diário (RDO) | ✅ | ✅ | ✅ | ✅ | ✅ | Enums desync + assinatura só imagem |
| 7 | Ensaios | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 8 | GED | ✅ | ✅ | ✅ | ⚠️ | ✅ | OK c/ ressalva (hub só via obra) |
| 9 | Efetivo | ✅ | ✅ | ✅ | ✅ | ⚠️ | **Não-nominal** — viola NR-18 |
| 10 | Aprovações | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | `/templates` sem link |
| 11 | Almoxarifado | ✅ | ✅ | ✅ | ✅ | ✅ | OK |
| 12 | Semáforo | ✅ | ✅ | ✅ | ✅ | ⚠️ | OK |
| 13 | Dashboard | — | ✅ | ✅ | ✅ | ⚠️ | OK |
| 14 | EldoX.IA | ✅ | ✅ | ⚠️ | ❌ | ⚠️ | Só widget flutuante |
| 15 | Portal (público) | — | ✅ | ✅ | — | ⚠️ | OK |
| — | **Frota/Equipamentos** | ❌ | ❌ | ❌ | ❌ | ❌ | **AUSENTE** |
| — | **Rastreabilidade (dedicado)** | ⚠️ | ⚠️ | ⚠️ | — | ⚠️ | **SUB-FEATURE** de Concretagem |
| — | **Usuários/Tenants/Planos** | ✅ | ⚠️ | ❌ | ❌ | ❌ | **ÓRFÃO BACKEND** (só login) |

---

## 9. 💸 Débito Técnico Agregado

- **Testes:** apenas 99 testes (Sprint 3 FVS) + alguns outros — não rodam no CI.
- **Código morto:** `TestShellPage.tsx`, `LaboratoriosPage.tsx` órfão, `App.css` não usado, `AppController` não registrado.
- **TODOs/FIXMEs:** não contabilizados — auditoria pendente.
- **Dependências:**
  - `xlsx@0.18.5` (CVEs históricos conhecidos).
  - `minio:latest` não pinado.
  - `@nestjs/terminus` ausente (healthcheck).
  - `@nestjs/throttler` ausente.
  - `date-fns-tz` ausente.
- **Duplicação:** dois `useToast` convivendo; breadcrumb interno + global; três convenções de soft-delete; três tabelas de NC paralelas.
- **1396 `style={{...}}` inline + 460 cores hardcoded** = design system ~50% vazado.

---

## 10. 🗺️ Plano de Ataque em 4 Sprints

### Sprint 1 — Desbloqueio (5 dias) — **Foco: sintoma reportado + segurança elementar**
- **[C1]** Corrigir sidebar (submenus contextuais com disabled/tooltip) → fecha o sintoma reportado pelo usuário.
- **[C4] [C5]** Adicionar `@UseGuards` em `VariantesController` e `SinapiController` (2 linhas).
- **[C6]** Fail-closed nos webhooks WhatsApp/NFe.
- **[C8]** Instalar `@nestjs/throttler` + rate-limit em `/auth/login` + `/auth/refresh`.
- **[C14] [C15] [C16]** Consertar os 3 bugs funcionais do frontend (duplo `/api/v1`, links absolutos, interceptor de refresh) **antes** de rodar `ui-upgrade-engine`.
- **[C17]** Sincronizar enums RDO Prisma↔frontend (bug runtime em produção).
- **[C24] [C29]** Backup PostgreSQL + pinar MinIO.
- **[C25] [C26]** `@nestjs/terminus` + `GET /healthz` + registrar/remover `AppController`.
- **[C27]** CI/CD com gates (lint/test/type-check) antes de deploy.
- **[C31]** Migration `audit_log_core` (destrava compliance + testes silenciosos).

### Sprint 2 — Fundação (8 dias) — **Multi-tenancy + Auth + Dados**
- **[C2] [C3] [C19]** Middleware Prisma fail-closed + cobertura RLS completa + script aplicado no deploy.
- **[C7]** DTOs nos 17+ endpoints com `@Body()` inline.
- **[C9] [C10] [C11]** Access token em memória + refresh rotativo com revogação + detecção de reuso.
- **[C12] [C13]** `RequireRole` + filtragem de sidebar por role + política `LABORATORIO`.
- **[C18] [C20]** ADR de política de exclusão + padronizar soft-delete em `deletedAt`.
- **[C21] [C22] [C23]** Timezone (`date-fns-tz`) + validação CNPJ + seed idempotente.
- **[C28] [C30]** Tags versionadas + runbook de rollback + `USER node` no Dockerfile.
- **[A1] [A2] [A4] [A5]** CORS prod + Helmet + audit log de login + recuperação de senha + convite + 2FA opcional.
- **[A15]** CRUD de Usuários/Tenants (módulo dedicado).

### Sprint 3 — Polimento (5 dias) — **UX, Design System, i18n**
- **[C32] [C33]** `lib/format.ts` + `lib/i18n/ptBR.ts` + tradutor de erros no `api.ts`.
- **[A26] [A27] [A28] [A32]** Substituir `style={{}}` inline, cores hardcoded e `window.confirm` por componentes do DS; `<label htmlFor>` em todos os forms.
- Estados UX (loading/empty/error) padronizados em todas as páginas com fetch.
- Executar `ui-upgrade-engine` **agora** (bugs funcionais já resolvidos no Sprint 1).

### Sprint 4 — Compliance e Operação (contínuo)
- **[C34] [C35] [C36]** Traço estruturado + cura + CP↔elemento (NBR 12655).
- **[C37]** Efetivo nominal (NR-18).
- **[C38]** Infra LGPD (consentimento, DPO, anonimização, export).
- **[C39]** Assinatura digital avançada (gov.br ou e-CPF).
- **[A40] [A41] [A44]** Ciclo CAPA unificado + Planos de Ação generalizados + NC unificado.
- **[A45] [A46]** Imutabilidade e retenção programática no GED.
- Observabilidade completa (correlation ID, Prometheus, tracing, Sentry, Langfuse, alertas, dashboard, runbook).

### Decisões de produto bloqueantes (antes do Sprint 4)
- [V6] Frota/Equipamentos: manter no escopo ou remover do AGENTS.md?
- [V6] Rastreabilidade dedicada vs sub-feature de Concretagem?
- [V7] EldoX.IA: página dedicada ou só widget?

---

## Próximos passos

Deseja que eu aplique correções? Posso:
- [ ] Aplicar todos os 🔴 do Sprint 1 (11 itens, estimado 3-5 dias)
- [ ] Começar por um bug específico (me diga qual)
- [ ] Detalhar algum bug antes de corrigir
- [ ] Re-rodar uma camada específica com mais rigor

> **Recomendação do orquestrador:** não iniciar correções em lote. Revisar primeiro este relatório + decisões de produto pendentes. O Sprint 1 é o único onde podemos agir imediatamente; Sprint 2+ depende de alinhamento.
