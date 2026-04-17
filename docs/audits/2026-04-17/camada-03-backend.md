# Camada 3 — Backend (NestJS 11 + Prisma 7 + PostgreSQL)

**Auditor:** auditor-camada-03-backend
**Data:** 2026-04-17
**Repo base:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend`
**Stack real:** NestJS 11 + `@nestjs/platform-express` + Prisma 7.6 + Postgres + Bull/Redis + MinIO
(skill referencia Fastify — adaptado: DTO class-validator ≡ Zod; NestJS guards ≡ hooks Fastify)

---

## 1. Inventário observado

| Item | Qtd |
|------|----:|
| Controllers (`*.controller.ts`) | 55 |
| Decoradores HTTP (endpoints) | ≈ 189 POST/PATCH/PUT + GET/DELETE |
| Services usando Prisma | 89 |
| Ocorrências `$queryRawUnsafe` / `$executeRawUnsafe` | 1.243 em 89 arquivos |
| DTOs com `class-validator` | 128 |
| Migrations Prisma | 38 + `migration_lock.toml` |
| Scripts RLS SQL | 2 (`rls.sql`, `rls_rdo.sql`) |
| Jobs Bull / Processors | 8 |
| Endpoints com `@Body()` tipado como inline (sem DTO) | ≥ 17 endpoints |
| Controllers sem `@UseGuards` no topo | 8 |

---

## 2. Bugs por severidade

---

### 🔴 CRÍTICO #1 — `VariantesController` sem autenticação (IDOR + bypass total)

**Evidência:** `backend/src/almoxarifado/ia/variantes.controller.ts:20-21`

```ts
@Controller('api/v1/almoxarifado/catalogo')
export class VariantesController {
```

Não há `@UseGuards(JwtAuthGuard, ...)` no topo da classe **nem** em nenhum método.
Todos os endpoints (`POST /identificar`, `GET /sugestoes`, `PATCH /sugestoes/:id/aprovar`,
`POST /variantes`, `DELETE /variantes/:id`, etc.) dependem de `req.user?.tenantId`
— mas sem o guard JWT, `req.user` é `undefined` → `tenantId === undefined`,
e a query raw insere `NULL` em `tenant_id`.

**Sintoma:** qualquer visitante anônimo pode ler sugestões de IA, criar variantes e
marcar variantes como ativas/inativas de qualquer tenant (se fornecer `catalogo_id`).
Quebra o princípio de tenant isolation.

**Causa:** controller registrado no `AlmoxarifadoModule`
(`backend/src/almoxarifado/almoxarifado.module.ts:91`) sem guard global nem per-class.

**Correção sugerida:** aplicar `@UseGuards(JwtAuthGuard, RolesGuard)` na classe;
usar `@TenantId()` decorator em vez de `req.user?.tenantId`.

**Esforço:** XS (1 linha)  ·  **Regressão:** Baixa  ·  **[Cross-ref Camada 7]**

---

### 🔴 CRÍTICO #2 — `SinapiController` sem autenticação + upload de 50 MB

**Evidência:** `backend/src/almoxarifado/sinapi/sinapi.controller.ts:15`

```ts
@Controller('api/v1/almoxarifado/sinapi')
export class SinapiController {
  @Post('importar')
  @UseInterceptors(FileInterceptor('arquivo'))
  async importar(@UploadedFile() file, @Body('uf') uf, ...)
```

Nenhum `@UseGuards`. `POST /api/v1/almoxarifado/sinapi/importar` aceita
**upload de `.xlsx` de até 50 MB** (limite global do módulo em
`backend/src/almoxarifado/almoxarifado.module.ts:79`), parseia com `xlsx.read` e
insere linhas na tabela `alm_sinapi_insumos`.

**Sintoma:** qualquer um pode (a) causar DoS via arquivo gigante, (b) poluir o
catálogo SINAPI compartilhado de todos os tenants, (c) explorar CVE do pacote
`xlsx@0.18.5` (historicamente com RCE em prototype pollution / formula parsing).

**Causa:** ausência de decorator de guard.

**Correção sugerida:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('SUPER_ADMIN')`.
Limitar tamanho específico (≤10 MB).

**Esforço:** XS  ·  **Regressão:** Baixa

---

### 🔴 CRÍTICO #3 — Webhooks com HMAC/secret opcional (fail-open)

**Evidência:**
- `backend/src/diario/whatsapp/whatsapp.controller.ts:84-92`
- `backend/src/almoxarifado/nfe/nfe.controller.ts:38-44`

WhatsApp:
```ts
if (this.APP_SECRET) {
  ...verifica HMAC...
} else {
  this.logger.warn(...'whatsapp.hmac.skip_dev_mode');
}
```

NF-e:
```ts
const secret = this.config.get<string>('WEBHOOK_NFE_SECRET');
if (secret) { ...valida... }
// senão passa direto
```

**Sintoma:** se as env `WHATSAPP_APP_SECRET` / `WEBHOOK_NFE_SECRET` não estiverem
configuradas em produção, os webhooks aceitam **qualquer** request e disparam jobs
Bull que consomem Anthropic API e inserem NF-e no banco (pode criar spam/lixo e
estourar custos de IA).

**Correção:** exigir secret em produção (`throw` se `NODE_ENV==='production'` e secret vazio).

**Esforço:** XS  ·  **Regressão:** Nenhuma (já falha em dev se faltar, nada muda)

---

### 🔴 CRÍTICO #4 — PrismaService não ativa RLS (`SET LOCAL app.tenant_id`)

**Evidência:** `backend/src/prisma/prisma.service.ts:1-19`

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
super({ adapter } as any);
```

Não há `$executeRawUnsafe('SET LOCAL app.tenant_id = ...')` antes das queries
nem middleware Prisma que o faça. O script RLS (`prisma/rls/rls.sql`) habilita
RLS nas tabelas, mas com o usuário do app sem o `SET LOCAL`, as políticas não
têm `current_setting('app.tenant_id', true)` válido.

**Sintoma:** RLS é **camada defensiva inexistente**. Qualquer bug em filtro
`WHERE tenantId = $` em raw query vaza dados entre tenants.

**Correção:** criar middleware Prisma ou interceptor NestJS que execute
`SET LOCAL app.tenant_id = ${user.tenantId}` em cada request autenticado.

**Esforço:** M  ·  **Regressão:** Média (requires audit da role DB usada)
**[Cross-ref Camada 7]**

---

### 🟠 ALTO #5 — 17+ endpoints aceitam `@Body()` com tipo inline (sem class-validator)

**Evidência — amostra:**
- `backend/src/obras/obras.controller.ts:141` — `@Body() body: { niveis: UpsertNivelConfigDto[] }`
- `backend/src/diario/rdo/rdo.controller.ts:345` — `@Body() body: { base64: string; mime_type: string; legenda?: string }`
- `backend/src/diario/rdo/rdo.controller.ts:486` — `@Body() body: { expira_em_dias?: number }`
- `backend/src/diario/rdo/rdo.controller.ts:544` — `@Body() body: { orcamento_item_id: number; quantidade_executada: number }`
- `backend/src/fvs/inspecao/inspecao.controller.ts:350` — `@Body() body: { dias_validade?: number }`
- `backend/src/fvs/inspecao/inspecao.controller.ts:390` — `@Body() body: { tipo: string; dados_json: object }`
- `backend/src/fvs/inspecao/inspecao.controller.ts:502` — `@Body() body: { image_base64: string; mime_type?: string }`
- `backend/src/fvs/dashboard/fvs-dashboard.controller.ts:97`
- `backend/src/concretagem/caminhoes/caminhoes.controller.ts:105, 119`
- `backend/src/almoxarifado/estoque/estoque.controller.ts:36`
- `backend/src/almoxarifado/cotacoes/portal-fornecedor.controller.ts:82` (público!)
- `backend/src/almoxarifado/cotacoes/cotacoes.controller.ts:27, 80`
- `backend/src/almoxarifado/ia/variantes.controller.ts:30, 52, 92`

`ValidationPipe` global (`main.ts:42-46`) usa `whitelist: true, forbidNonWhitelisted: true`,
mas como o tipo é um **literal inline** (não uma classe com decorators),
o pipe **não faz validação** — apenas recebe o objeto cru. String com `image_base64`
pode ser de tamanho ilimitado, objeto `dados_json` pode ter qualquer forma,
`mime_type` pode ser arbitrário.

**Sintoma:** falta de validação semântica (tamanhos, tipos, formatos), brecha
para injection nos agentes IA, DoS por payload grande (ex: `image_base64`).

**Correção:** criar DTOs reais (`class` com `@IsString`, `@IsInt`, `@MaxLength`, etc.).

**Esforço:** M (17 DTOs)  ·  **Regressão:** Baixa

---

### 🟠 ALTO #6 — Rate limiting, Helmet e proteção DoS **ausentes**

**Evidência:**
- `backend/package.json:21-52` — não há `@nestjs/throttler` nem `helmet` nas deps.
- `backend/src/main.ts` — apenas CORS e ValidationPipe. Sem `app.use(helmet())`,
  sem `ThrottlerModule`.
- CORS: `backend/src/main.ts:48-51` só libera `localhost:5173-5176, :3001` —
  nenhuma origin de produção.

**Sintoma:** (a) API vulnerável a brute-force em `/auth/login`, (b) falta de
headers `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`,
(c) em produção o frontend não consegue chamar a API sem sobrescrever CORS.

**Correção:** `npm i helmet @nestjs/throttler` + configurar em `main.ts` e `app.module.ts`
(`ThrottlerGuard` global, 100 req/min por IP e 5/min em `/auth/login`).

**Esforço:** M  ·  **Regressão:** Média (CORS pode quebrar deploy)

---

### 🟠 ALTO #7 — Padrão TOCTOU: `findFirst(tenantId) → update(id)` sem tenant no WHERE

**Evidência (amostra):**
- `backend/src/obras/obras.service.ts:215-218` — `prisma.obra.update({ where: { id: obraId } })`
- `backend/src/obras/obras.service.ts:297-298`
- `backend/src/obras/obras.service.ts:334-336`
- `backend/src/obras/obras.service.ts:365` — `deleteMany({ where: { obraId } })` sem `tenantId`
- `backend/src/obras/obras.service.ts:512-513` — `update({ where: { id: localId } })`
- `backend/src/aprovacoes/aprovacoes.service.ts:203-204, 220-221, 290-291, 652-653`

O padrão é: `findFirst({ where: { id, tenantId } })` para validar ownership,
depois `update({ where: { id } })` sem `tenantId`. Funciona pq Prisma `update`
exige chave única, mas abre janela TOCTOU se houver concorrência e o registro
mudar de tenant (improvável, mas quebra defense-in-depth).

**Correção:** usar `updateMany({ where: { id, tenantId } })` ou garantir
`@@unique([id, tenantId])` + usar esse composite key.

**Esforço:** M  ·  **Regressão:** Baixa  ·  **[Cross-ref Camada 7]**

---

### 🟠 ALTO #8 — Prisma schema: apenas 1 de 29 relações com `onDelete` explícito

**Evidência:** `backend/prisma/schema.prisma`

```
@relation(fields:  → 29 ocorrências
onDelete:          → 1 ocorrência
```

**Sintoma:** deletar um `Tenant`, `Obra`, `Usuario`, `ObraTipo` etc. cai no
default `NoAction` do Prisma (dispara erro FK) — deletes ficam impossíveis ou
o código precisa cascatear à mão. Uso pesado de `deletadoEm` (soft delete) mascara
parcialmente, mas queda real (ex: remover tenant churn) fica arriscada.

**Correção:** definir `onDelete: Cascade` (filhos) ou `Restrict` (FK crítica)
caso a caso.

**Esforço:** M  ·  **Regressão:** Alta (requires nova migration testada)

---

### 🟠 ALTO #9 — `findMany` sem `take` em listagens potencialmente grandes

**Evidência:**
- `backend/src/aprovacoes/aprovacoes.service.ts:591-595` — `pendentesParaMim` (admin vê tudo sem limite)
- `backend/src/aprovacoes/aprovacoes.service.ts:622-626`
- `backend/src/obras/obras.service.ts:410-416` — `obraLocal.findMany` sem paginação
  (obras grandes podem ter milhares de locais)
- `backend/src/obras/obras.service.ts:594-605` — lista locais recém-criados
- `backend/src/semaforo/semaforo.service.ts:325-329` — `obra.findMany` em mass compute

**Sintoma:** API lenta ou OOM em tenants com muitos registros; heartbeat Bull
pode estourar ao processar admin com 5000 aprovações pendentes.

**Correção:** adicionar paginação (`take`, `skip`) ou pelo menos `take: 500` defensivo.

**Esforço:** S por endpoint  ·  **Regressão:** Baixa

---

### 🟡 MÉDIO #10 — `$queryRawUnsafe` em Controller (viola camada)

**Evidência:**
- `backend/src/fvs/inspecao/inspecao.controller.ts:504-513` — query de evidência
- `backend/src/fvs/inspecao/inspecao.controller.ts:479-482`
- `backend/src/diario/rdo/rdo-cliente.controller.ts:21-30`
- `backend/src/fvs/cliente/fvs-cliente.controller.ts:21-28, 44-91`
- `backend/src/almoxarifado/ia/variantes.controller.ts:78-85, 104-114, 125-128`

Controllers fazem raw SQL direto em vez de delegar ao service. Viola o princípio
de camadas do NestJS e dificulta testes/reuso.

**Correção:** mover queries para `*.service.ts`.

**Esforço:** M  ·  **Regressão:** Baixa

---

### 🟡 MÉDIO #11 — Portais públicos com escopo frouxo

**Evidência:**
- `backend/src/fvs/cliente/fvs-cliente.controller.ts:18` — `GET /fvs-cliente/:token`
- `backend/src/diario/rdo/rdo-cliente.controller.ts:19` — `GET /relatorio-cliente/:token`
- `backend/src/concretagem/concretagens/portal-fornecedor.controller.ts:11` — `?token=`
- `backend/src/almoxarifado/cotacoes/portal-fornecedor.controller.ts:28` — `/portal/cotacao/:token`

Todos acessados apenas por token em URL. Problemas:
1. Token na URL é logado por nginx/proxies (fvs-cliente.controller.ts:21, rdo-cliente.controller.ts:21).
2. Sem rate limiting para brute-force (Camada 3 não tem throttler).
3. `portal-fornecedor.controller.ts:13-19` aceita `token` via `?token=` (query string).
4. FVS cliente expõe resumo IA, lista de NCs e IA-sugestões — pode vazar info sensível se
   link for compartilhado além do cliente pretendido.
5. Cotação fornecedor pode ser respondida múltiplas vezes enquanto o token não expirar
   (controller.ts:80 — comentário explícito).

**Correção:** validação de assinatura do token, rate limiting por IP, logs sem token,
one-time-use.

**Esforço:** M  ·  **Regressão:** Média

---

### 🟡 MÉDIO #12 — Logs de PII (número de WhatsApp em claro)

**Evidência:**
- `backend/src/diario/whatsapp/whatsapp.service.ts:49, 62`

```ts
this.logger.warn(JSON.stringify({ level: 'warn',
  action: 'whatsapp.numero_nao_cadastrado', numero: dto.numero }));
```

Número de celular é PII LGPD (pode identificar pessoa). Persistido em `logs/app.log`
(`main.ts:22-28`) em produção.

**Correção:** mascarar (`****1234`) ou hashear antes de logar.

**Esforço:** XS  ·  **Regressão:** Nenhuma

---

### 🟡 MÉDIO #13 — `app.controller.ts` público sem finalidade clara

**Evidência:** `backend/src/app.controller.ts:4-12`

```ts
@Controller()
export class AppController {
  @Get() getHello(): string { return this.appService.getHello(); }
}
```

`GET /` retorna `"Hello World!"` sem guard. Não é health check útil
(sem `{ status, version, db: 'ok' }`) e não retorna `/health`.

**Correção:** remover ou transformar em `/health` real com ping ao Prisma.

**Esforço:** XS

---

### 🟡 MÉDIO #14 — CORS sem origens de produção

**Evidência:** `backend/src/main.ts:48-51`

```ts
app.enableCors({
  origin: ['http://localhost:5173', ..., 'http://localhost:3001'],
  credentials: true,
});
```

Origens de produção ausentes. Em deploy Coolify, CORS travará requests do frontend
real (`http://<dominio-produção>/api`). Cookie `refresh_token` com
`sameSite: 'lax'` + `secure: production` só funciona se front+back em mesma origin
(com proxy) — caso contrário falha silenciosamente.

**Correção:** ler lista de origens de env (`CORS_ALLOWED_ORIGINS`).

**Esforço:** XS  ·  **Regressão:** Baixa

---

### 🟡 MÉDIO #15 — Upload de arquivo sem validação real de MIME

**Evidência:**
- `backend/src/ged/ged.service.ts:110-118` — `validarFormatoArquivo` valida
  `file.mimetype` contra whitelist, mas `mimetype` vem do client (multer confia no header).
  Não há verificação de magic bytes (ex: `file-type` npm pkg).
- `backend/src/almoxarifado/sinapi/sinapi.controller.ts:23-34` — sem validação.
- `backend/src/almoxarifado/orcamento/orcamento.controller.ts:34` — `@UseInterceptors(FileInterceptor('file'))` sem limite específico.

**Sintoma:** atacante envia `.exe` renomeado como `.pdf` com `Content-Type: application/pdf`
e passa pela validação.

**Correção:** validar magic bytes com `file-type` após receber buffer.

**Esforço:** S

---

### 🟡 MÉDIO #16 — Auth: não emite 403 vs 404 de forma consistente

**Evidência:**
- `backend/src/aprovacoes/aprovacoes.service.ts:265-278` — `NotFoundException` e `ForbiddenException`
  claramente separados (OK).
- Mas em muitos services (`obras.service.ts:241, 255, 504`, `inspecao.service.ts`),
  se o registro é de outro tenant → `NotFoundException` (vazamento de existência).

**Sintoma:** atacante enumera IDs e `404` vs `403` distingue "tenant vizinho" de "inexistente".

**Correção:** retornar sempre `404` para recursos que não pertencem ao tenant
(já é o padrão aqui — mas conferir consistência).

**Esforço:** S

---

### 🔵 BAIXO #17 — Many `require()` em vez de `import` (xlsx, minio, cookie-parser)

- `backend/src/main.ts:7` — `const cookieParser = require('cookie-parser');`
- `backend/src/almoxarifado/sinapi/sinapi.service.ts:13` — `require('xlsx')`
- `backend/src/ged/storage/minio.service.ts:31` — `require('minio')`

Funciona mas quebra tipagem estática.

---

### 🔵 BAIXO #18 — Status 422 vs 400

Todo retorno de validação do `ValidationPipe` é HTTP **400** (default). Boa prática
REST usa **422 Unprocessable Entity** para erro semântico. Referência da skill pede 422.

**Correção:** `new ValidationPipe({ errorHttpStatusCode: 422 })` em `main.ts:42`.

---

### 🔵 BAIXO #19 — Prisma deploy target não declarado (schema.prisma)

`schema.prisma:1-7` — `datasource db { provider = "postgresql" }` mas sem `url = env("DATABASE_URL")`.
A connection string vem via `PrismaPg` adapter (prisma.service.ts:8). Funciona,
mas inconsistente (ferramentas Prisma CLI podem não achar a URL).

---

### 🔵 BAIXO #20 — 2 migrations com mesmo propósito ("init")

`20260405050940_init` e `20260406211348_init` — duas migrations iniciais. Migrations subsequentes
referenciam a segunda. Não é bug funcional, mas confunde rebuilds de banco.

---

## 3. Status HTTP

| Endpoint | Status usado | Correto? |
|----------|:------------:|:--------:|
| `POST /auth/login` | 200 (via `@HttpCode(200)`) | ✅ |
| `POST /auth/register` | 201 default | ✅ |
| `POST /ged/documentos` | 201 | ✅ |
| `DELETE /ged/versoes/...` (inspeção) | 204 | ✅ |
| `POST /webhooks/nfe` | 202 | ✅ |
| Validação falha | 400 | ⚠️ Preferível 422 (#18) |

Mensagens de erro: maioria usa `NotFoundException`/`BadRequestException` (retorna
`{ statusCode, message, error }` — formato NestJS default, NÃO o recomendado
na skill `{ error, code, details }`).

**Esforço:** M para padronizar via `ExceptionFilter` global.

---

## 4. Multi-tenancy nas raw queries — **amostra auditada**

✅ **OK (confere `WHERE tenant_id = $N` explícito):**
- `rdo.service.ts` (`getRdoOuFalhar`, `getObraOuFalhar` — rdo.service.ts:66-75, 110-119)
- `ged.service.ts` (diversos — 311-316, 333-343, 400-408)
- `dashboard.service.ts:28-62`
- `fvs-cliente.controller.ts:44-91` (usa `e.tenant_id = $2`)
- `fvs/catalogo/catalogo.service.ts` (com whitelist de tabelas)
- `aprovacoes.service.ts:599-617`

⚠️ **Depende de context externo (não valida tenant em raw):**
- `ged/workers/ged-ocr.worker.ts:34-38` — `UPDATE ged_versoes SET ocr_texto WHERE id = $1`
  sem `tenant_id`. Mitigação: versaoId único globalmente.

❌ **Não revisado individualmente:** 1.243 ocorrências de raw query em 89 arquivos —
auditoria exaustiva exigiria sessão dedicada (ver recomendação final).

---

## 5. Migrations / índices

- 38 migrations, lock file presente, nomes cronologicamente ordenados: ✅
- Índices: schema tem `@@index` massivo em tabelas RDO/Obra por `(tenantId)`, `(tenantId, obraId)` etc.
  ✅ (ver `schema.prisma:190-193, 236-240, 356-358`).
- Duas migrations `_init` (bug #20).

---

## 6. Jobs / filas

**Processors identificados:**
- `aprovacoes/escalacao.processor.ts` — cron horário, busca cross-tenant corretamente.
- `diario/rdo/rdo.processor.ts`
- `ensaios/alertas/alertas.processor.ts`
- `concretagem/alertas/alertas-cp.processor.ts`
- `almoxarifado/jobs/almoxarifado.processor.ts`
- `fvs/fvs.processor.ts`
- `ged/workers/ged-ocr.worker.ts`, `ged-classifier.worker.ts`

✅ Payload Bull inclui `tenantId` na maioria (`OcrJobData { versaoId, tenantId }`).
✅ Retry/backoff definidos (`attempts: 3, backoff: exponential`).
❌ Não vi **dead-letter queue** configurada.

---

## 7. Resumo para orquestrador

**Totais de bugs encontrados:** 20
- 🔴 Críticos: **4**
- 🟠 Altos:   **5**
- 🟡 Médios:  **7**
- 🔵 Baixos:  **4**

**Top 3 (agir primeiro):**

1. **`VariantesController` e `SinapiController` sem JwtAuthGuard** — qualquer
   internauta acessa endpoints que escrevem no banco. Correção: 2 linhas.
2. **PrismaService não emite `SET LOCAL app.tenant_id`** → RLS é cosmético.
   Qualquer bug em `WHERE tenant_id` vira vazamento real. Cross-ref Camada 7.
3. **17+ endpoints com `@Body()` tipado inline** → nenhuma validação
   class-validator acontece; `image_base64` e `dados_json` passam sem controle
   de tamanho/forma.

**Ação urgente:**
Aplicar `@UseGuards(JwtAuthGuard, RolesGuard)` em `VariantesController`
(`variantes.controller.ts:20`) e `SinapiController`
(`sinapi.controller.ts:15`) — **deploy não deveria ocorrer** enquanto estes
endpoints estiverem abertos. Desabilitar temporariamente os webhooks que
fazem fail-open sem secret (WhatsApp e NF-e) ou exigir secret em prod.

**Cross-refs:**
- **Camada 7 (multi-tenancy):** bugs #1, #2, #4, #7. Especialmente #4 (RLS inerte)
  afeta a defesa em profundidade — prioritário para aquela camada.
- **Camada 6 (segurança):** #3, #6, #15, #11 (portais).
- **Camada 4 (frontend):** #14 (CORS de produção).
- **Camada 8 (observabilidade):** #12 (PII em logs), #13 (ausência de /health).

**Recomendação:** antes de produção, rodar **sprint de hardening de 1 semana**
cobrindo: (a) adicionar `helmet` + `@nestjs/throttler`, (b) DTOs faltantes,
(c) ativar RLS efetivo, (d) revisão completa das 1.243 raw queries por script,
(e) padronizar exception filter.
