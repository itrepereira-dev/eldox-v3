# Camada 10 — Infraestrutura, Deploy e Build — Auditoria 2026-04-17

**Auditor:** auditor-camada-10-infra
**Data:** 2026-04-17
**Escopo:** `.env.example`, `infra/docker-compose*.yml`, `Dockerfile` (backend + frontend), `nginx.conf`, CI/CD GitHub Actions, migrations Prisma no deploy, secrets management, backup, rollback, HTTPS/TLS, tamanho de imagem.
**Mobile:** N/A — mobile não desenvolvido nesta fase.

---

## Sumário executivo

| Severidade | Qtd |
|---|---:|
| 🔴 Crítico | 6 |
| 🟠 Alto | 7 |
| 🟡 Médio | 7 |
| 🔵 Baixo | 4 |
| **Total** | **24** |

**Veredito:** infraestrutura **funcional mas frágil**. Deploy sobe via GitHub Actions + Coolify/Traefik com certificado Let's Encrypt automatizado (bom), mas há ausências graves de operacionalidade — **sem healthcheck de aplicação, sem backup automatizado de Postgres, sem validação de envs no boot, sem rollback documentado, sem CI gate (lint/test/typecheck) antes de build, sem limite de recursos nos containers, `minio:latest` em produção, imagem de backend com `node_modules` completo copiado (636 MB)**. Segredos de dev são **fracos mas não expõem produção** (não committados). Frontend-web **não tem `.env.example`** apesar de ler `VITE_API_URL`.

---

## Bugs encontrados

### 🔴 CRÍTICO

---

#### BUG 10-001 🔴 Sem backup automatizado do PostgreSQL em produção
- **Sintoma:** volume `postgres_v3_data` roda no mesmo VPS que o resto do sistema; não existe cron, script, snapshot off-site, nem retenção documentada. Em caso de perda do VPS → **perda total de dados dos tenants**.
- **Evidência:** `infra/docker-compose.prod.yml:4-21` (só declara volume, sem backup) + `docs/` não contém runbook/script.
- **Causa:** item nunca implementado.
- **Correção sugerida:** `pg_dump` diário para MinIO/S3 externo (ou Backblaze/OCI Object) com retenção 30 dias + smoke-test mensal de restore. Coolify tem addon de backup nativo que pode ser ativado.
- **Esforço:** 4 h.
- **Risco de regressão:** nenhum (adiciona).

---

#### BUG 10-002 🔴 Backend não expõe `/healthz` e compose-prod não faz healthcheck do container
- **Sintoma:** Traefik roteia tráfego para backend mesmo se ele ainda estiver iniciando (ou travado). Rollout fica "verde" no Coolify mesmo com API 500. Uptime Kuma não tem o que monitorar.
- **Evidência:** busca `@Get('/health'` no `backend/src/` → 0 matches. `infra/docker-compose.prod.yml:52-87` (service `backend`) → **não declara `healthcheck:`**. Mesma ausência para service `frontend` (linha 89-110).
- **Causa:** endpoint não implementado; compose não exige.
- **Correção sugerida:** criar `HealthController` com `GET /api/v1/healthz` (checa Prisma + Redis + MinIO); adicionar `healthcheck: test: curl -f http://localhost:3000/api/v1/healthz` no compose-prod.
- **Esforço:** 2 h.
- **Risco de regressão:** nenhum.
- **Cross-ref:** Camada 6/7 (observabilidade / release gate).

---

#### BUG 10-003 🔴 Pipeline CI/CD sem gates (lint, type-check, testes) antes de build+deploy
- **Sintoma:** qualquer push em `main` que quebre typescript, jest ou eslint **vai direto para produção** (a menos que o Dockerfile de build falhe no `npm run build`). 99 testes do Sprint 3 FVS + testes de outros módulos **nunca rodam no CI**.
- **Evidência:** `.github/workflows/deploy.yml:1-76` — passos são: checkout → docker login → `docker build-push-action` (backend) → `docker build-push-action` (frontend) → scp → ssh-deploy. Não há `npm ci && npm run lint && npm run test && npm run build` antes.
- **Causa:** workflow criado só para "entregar imagem", sem qualidade.
- **Correção sugerida:** adicionar `jobs.test` e `jobs.lint` rodando antes de `build-and-deploy` (via `needs:`). Bloqueia merge se falhar.
- **Esforço:** 2 h.
- **Risco de regressão:** inicial — PRs vão falhar até fixarem testes quebrados, mas é o comportamento desejado.

---

#### BUG 10-004 🔴 Rollback não documentado e não automatizado
- **Sintoma:** deploy usa tag `:latest` (única); não há histórico de tags versionadas. Reverter exige conhecimento de docker + ssh + rebuild da imagem antiga — em incidente, operador humano precisa improvisar.
- **Evidência:** `.github/workflows/deploy.yml:34` (`tags: .../eldox-backend:latest`) e `:43` (frontend idem). `docs/` não contém runbook de rollback.
- **Causa:** estratégia de tag não definida.
- **Correção sugerida:** tagear `:sha-<commit>` + `:latest`. No Coolify, manter últimas 5 imagens. Documentar procedimento em `docs/runbooks/rollback.md`. Migrations Prisma precisam estratégia separada (BUG 10-014).
- **Esforço:** 3 h.
- **Risco de regressão:** nenhum.

---

#### BUG 10-005 🔴 `minio/minio:latest` em produção (sem versão fixa)
- **Sintoma:** qualquer deploy pode trazer uma versão nova do MinIO com breaking change silencioso (APIs, SDK, presigned URL). Ataque supply-chain se registry comprometido.
- **Evidência:** `infra/docker-compose.prod.yml:34` → `image: minio/minio:latest`.
- **Causa:** tag não pinada.
- **Correção sugerida:** fixar em `minio/minio:RELEASE.2026-03-12T18-19-41Z` (ou a última release estável) e revisar trimestralmente.
- **Esforço:** 10 min.
- **Risco de regressão:** nenhum.

---

#### BUG 10-006 🔴 Container backend roda como root (sem `USER node`)
- **Sintoma:** qualquer RCE via dependência compromete o container com uid 0. Aumenta blast radius de CVEs do Node/NestJS.
- **Evidência:** `backend/Dockerfile:13-27` — stage `runner` não tem `USER node` (ou similar).
- **Causa:** omissão no Dockerfile.
- **Correção sugerida:** adicionar `RUN chown -R node:node /app && USER node` antes do `CMD`.
- **Esforço:** 30 min.
- **Risco de regressão:** baixo — `prisma migrate deploy` grava em `prisma/migrations/` mas read-only ok.
- **Cross-ref:** Camada 7 (segurança).

---

### 🟠 ALTO

---

#### BUG 10-007 🟠 Nenhuma validação de envs no boot (NestJS ConfigModule sem `validationSchema`)
- **Sintoma:** container sobe mesmo se `JWT_SECRET` ou `DATABASE_URL` estiverem vazias → falhas em runtime (500) difíceis de diagnosticar; `JWT_SECRET` ausente → tokens assinados com `undefined`.
- **Evidência:** `backend/src/app.module.ts:24` → `ConfigModule.forRoot({ isGlobal: true })` sem `validationSchema` (Joi/Zod).
- **Correção sugerida:** adicionar `Joi` schema validando as envs obrigatórias (DATABASE_URL, REDIS_URL/HOST/PORT, JWT_SECRET, MINIO_*, ANTHROPIC_API_KEY opcional, etc.). Container para de subir se faltar.
- **Esforço:** 2 h.
- **Risco de regressão:** médio — pode revelar envs faltantes no dev.

---

#### BUG 10-008 🟠 `backend/.env.example` está desatualizado — falta >10 envs usadas pelo código
- **Sintoma:** desenvolvedor novo / deploy novo não sabe que precisa setar `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`, `SMTP_*`, `EVOLUTION_API_*`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `FRONTEND_URL`, `APP_URL`, `MINIO_PUBLIC_URL`, `WEBHOOK_NFE_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_USE_SSL`.
- **Evidência:** `backend/.env.example` (29 linhas) só menciona DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, MINIO_*, PORT, NODE_ENV. Código consome:
  - `backend/src/app.module.ts:29-31` → `REDIS_HOST/PORT/PASSWORD`
  - `backend/src/auth/auth.service.ts:87,118` + `auth.module.ts:17` → `JWT_SECRET` (ok) mas **não há `JWT_REFRESH_SECRET`** e refresh usa mesmo `JWT_SECRET` (cross-ref Camada 7).
  - `backend/src/ia/ia.service.ts:35,114,156` + outros 5 agentes → `ANTHROPIC_API_KEY`
  - `backend/src/ensaios/whatsapp/evolution.service.ts:18-20` → `EVOLUTION_API_URL/KEY/INSTANCE`
  - `backend/src/concretagem/concretagens/email-concretagem.service.ts:217-260` → `SMTP_HOST/PORT/SECURE/USER/PASS/FROM` + `APP_URL`
  - `backend/src/diario/whatsapp/whatsapp.controller.ts:49-50` → `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
  - `backend/src/almoxarifado/cotacoes/cotacoes.service.ts:191` → `FRONTEND_URL`
  - `backend/src/almoxarifado/nfe/nfe.controller.ts:38` → `WEBHOOK_NFE_SECRET`
  - `backend/src/diario/rdo/rdo-fotos.service.ts:224` → `MINIO_PUBLIC_URL`
  - `backend/.env:24` → `ENCRYPTION_KEY` (usado no código?)
- **Correção sugerida:** completar `.env.example` + agrupar por módulo + comentar cada variável.
- **Esforço:** 1 h.

---

#### BUG 10-009 🟠 `frontend-web/` não tem `.env.example` (mesmo usando `VITE_API_URL`)
- **Sintoma:** fluxo de setup local quebra sem aviso; nenhum onboarding documentado para frontend.
- **Evidência:** `ls frontend-web/` → não contém `.env.example`. `src/services/api.ts:3`, `src/lib/apiBase.ts:2`, `src/modules/fvs/cliente/FvsRelatorioClientePage.tsx:8`, `src/modules/fvs/inspecao/pages/FichaGradePage.tsx:15`, `src/modules/diario/pages/RelatorioClientePage.tsx:10` consomem `import.meta.env.VITE_API_URL`.
- **Correção sugerida:** criar `frontend-web/.env.example` com `VITE_API_URL=http://localhost:3000/api/v1` + comentário. Mencionar no README.
- **Esforço:** 15 min.

---

#### BUG 10-010 🟠 Dockerfile backend copia `node_modules` inteiro do builder (~636 MB)
- **Sintoma:** imagem final do backend provavelmente >800 MB (base `node:20-alpine` + 636 MB de deps dev+prod). Push/pull lento, uso de disco no VPS alto, superfície de ataque maior.
- **Evidência:** `backend/Dockerfile:19` → `COPY --from=builder /app/node_modules ./node_modules` (incluindo devDeps e tooling). Também faz `COPY --from=builder /app/prisma.config.ts` + `CMD ... npx prisma migrate deploy && node dist/src/main` → precisa de `prisma`, `ts-node`, `typescript` em runtime (isso explica o node_modules completo, mas a solução é outra).
- **Causa:** `prisma.config.ts` é consumido pelo CLI Prisma em runtime; para evitar devDeps completas, gerar o `schema.prisma` com `prisma migrate deploy` (que só precisa do `@prisma/client` + `prisma` CLI). Alternativa: rodar `npm ci --omit=dev` no stage final.
- **Correção sugerida:** stage runtime com `npm ci --omit=dev` + `@prisma/engines` + copiar só `dist/`, `prisma/schema.prisma`, `prisma/migrations/`, `prisma/rls/`, `package*.json`. Elimina ~400-500 MB.
- **Esforço:** 3 h (requer teste).
- **Risco de regressão:** alto — `prisma.config.ts` (TypeScript) no CMD atual depende de `ts-node`; precisa mudar para `npx prisma migrate deploy` sem config TS ou compilar o config.

---

#### BUG 10-011 🟠 CORS hardcoded para `localhost:*` em produção
- **Sintoma:** `main.ts` libera somente `http://localhost:5173-5176` e `:3001`. Em produção (domínio `v3.eldox.com.br`), toda requisição do frontend sofre bloqueio de CORS se saída pelo browser for para domínio diferente do backend — **só não quebra porque Traefik põe tudo no mesmo host**. Qualquer subdomínio dedicado ao frontend quebra.
- **Evidência:** `backend/src/main.ts:48-51` → lista estática, sem leitura de env.
- **Correção sugerida:** `app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') ?? [...], credentials: true })`.
- **Esforço:** 30 min.
- **Cross-ref:** Camada 7 (segurança).

---

#### BUG 10-012 🟠 `nginx.conf` do frontend sem headers de segurança (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **Sintoma:** clickjacking, MIME-sniff, injeção de script — ataques triviais possíveis. Nota: HSTS é tipicamente aplicado pelo Traefik, mas CSP e X-Frame-Options são responsabilidade do nginx do frontend.
- **Evidência:** `frontend-web/nginx.conf:1-21` não declara `add_header X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `Permissions-Policy`.
- **Correção sugerida:** adicionar bloco com os headers padrão. Começar com `Content-Security-Policy` em report-only para não quebrar SPA.
- **Esforço:** 2 h.
- **Cross-ref:** Camada 7.

---

#### BUG 10-013 🟠 Script RLS SQL (`backend/prisma/rls/rls.sql` + `rls_rdo.sql`) **NÃO é aplicado automaticamente no deploy**
- **Sintoma:** Camada 2 do AGENTS.md exige RLS como defesa em profundidade. No deploy, `npx prisma migrate deploy` roda; **os `.sql` de RLS precisam ser aplicados manualmente** (`psql < rls.sql`) após cada migration que altere tabelas. Se alguém esquecer → RLS fica desabilitado em tabelas novas.
- **Evidência:** `backend/Dockerfile:27` → `CMD ... npx prisma migrate deploy && node dist/src/main` (sem `psql < prisma/rls/*.sql`). Pasta `backend/prisma/rls/` existe com 2 scripts.
- **Correção sugerida:** transformar os scripts RLS em migrations Prisma versionadas OU adicionar step no entrypoint que aplique os `.sql` de forma idempotente (`CREATE POLICY IF NOT EXISTS` equivalente — no Postgres, usar `DO $$ ... $$` guarded).
- **Esforço:** 4 h.
- **Cross-ref:** Camada 7 (segurança multi-tenant).

---

### 🟡 MÉDIO

---

#### BUG 10-014 🟡 Migrations Prisma sem estratégia de rollback documentada
- **Sintoma:** Prisma não gera "down migration". Em caso de `migrate deploy` falhar a meio → estado inconsistente, sem receita de volta.
- **Evidência:** `backend/prisma/migrations/` tem só `up` (arquivo `migration.sql` por pasta). Sem `docs/runbooks/migration-rollback.md`.
- **Correção sugerida:** política: "rollback de schema = restore do backup (BUG 10-001)". Documentar + smoke test.
- **Esforço:** 2 h.

---

#### BUG 10-015 🟡 `docker-compose.prod.yml` sem `resource limits` (memory, cpu)
- **Sintoma:** um leak em BullMQ / Sharp / PDFKit pode travar o VPS inteiro (Postgres + Redis + MinIO caem juntos).
- **Evidência:** `infra/docker-compose.prod.yml:52-110` — services `backend`, `frontend`, `postgres`, `redis`, `minio` sem `deploy.resources.limits` / `mem_limit`.
- **Correção sugerida:** limites conservadores (backend 1 GB, frontend 256 MB, postgres 1 GB, redis 256 MB, minio 512 MB) + revisar após observabilidade.
- **Esforço:** 30 min.

---

#### BUG 10-016 🟡 Redis em produção **sem senha** (`REDIS_PASSWORD` não setada, sem healthcheck, sem AUTH)
- **Sintoma:** qualquer container na network `coolify` (que pode ser compartilhada com outros projetos no VPS) pode conectar no Redis sem autenticação.
- **Evidência:** `infra/docker-compose.prod.yml:23-31` — service `redis` não declara `command: redis-server --requirepass ...` nem variável. `backend/src/app.module.ts:31` → `password: process.env.REDIS_PASSWORD ?? undefined`. `.env.prod.example` não menciona `REDIS_PASSWORD`.
- **Correção sugerida:** setar `REDIS_PASSWORD` forte + passar como `--requirepass` ao container.
- **Esforço:** 1 h.
- **Cross-ref:** Camada 7.

---

#### BUG 10-017 🟡 `docker-compose.yml` (dev) expõe Postgres/MinIO/Redis em `0.0.0.0`
- **Sintoma:** em dev local de quem trabalha em Wi-Fi pública, qualquer outro dispositivo na rede alcança o Postgres com senha fraca (`eldox_dev_pass`).
- **Evidência:** `infra/docker-compose.yml:12-13` → `ports: ['5432:5432']` (sem bind 127.0.0.1). Idem `9000:9000`, `9001:9001`, `6379:6379`.
- **Correção sugerida:** `ports: ['127.0.0.1:5432:5432']` etc.
- **Esforço:** 5 min.

---

#### BUG 10-018 🟡 `infra/.env` commitado localmente com senhas dev (mas não no git)
- **Sintoma:** arquivo presente em `infra/.env` (confirmado pelo `ls`) com `eldox_dev_pass`. Está no `.gitignore` (`infra/.env` aparece em `eldox-v3/.gitignore:13,45`) — não está tracked (`git ls-files` limpo) — **risco = zero**, mas senha dev é previsível.
- **Evidência:** `infra/.env:9` → `POSTGRES_PASSWORD=eldox_dev_pass`. `git ls-files` não lista `infra/.env`.
- **Correção sugerida:** trocar para senha randômica gerada por dev; documentar no README.
- **Esforço:** 10 min.

---

#### BUG 10-019 🟡 `.dockerignore` minimalista — não exclui `.git`, `test/`, `coverage/`, `logs/`, `README.md`, `*.md`, `prisma/seed*.ts`
- **Sintoma:** build context maior → upload lento ao Docker daemon + surface para leak de credenciais em `.git/`. `test/` e `coverage/` vão pro builder (mas não runtime).
- **Evidência:** `backend/.dockerignore` (6 linhas) e `frontend-web/.dockerignore` (6 linhas) só têm `.env`, `.env.*`, `!.env.example`, `node_modules`, `dist`, `*.log`.
- **Correção sugerida:** adicionar `.git`, `.github`, `coverage`, `logs`, `test`, `*.md`, `.vscode`, `.idea`, `.DS_Store`.
- **Esforço:** 5 min.

---

#### BUG 10-020 🟡 `version: '3.9'` no compose — deprecated em Docker Compose v2
- **Sintoma:** warning em log do deploy; em versão futura pode falhar.
- **Evidência:** `infra/docker-compose.yml:1`, `infra/docker-compose.prod.yml:1`.
- **Correção sugerida:** remover linha `version:` (Compose v2 ignora).
- **Esforço:** 1 min.

---

### 🔵 BAIXO

---

#### BUG 10-021 🔵 Nenhuma documentação de infraestrutura em `docs/`
- **Sintoma:** ausência de diagrama de arquitetura, runbook de deploy, lista de dependências externas (Let's Encrypt, registrar, SMTP, Evolution, Anthropic), contatos.
- **Evidência:** `docs/` contém só `audits/`, `superpowers/`, `autodoc-gap-analysis.html`, `ui-audit-fase1.html`.
- **Correção sugerida:** `docs/runbooks/{deploy,rollback,restore-backup,incident}.md` + `docs/arquitetura.md`.
- **Esforço:** 6 h.

---

#### BUG 10-022 🔵 Source maps em produção — decisão não documentada
- **Sintoma:** Vite build gera source maps por default se configurado, expondo código fonte a engenharia reversa. Decisão "on/off" não consta.
- **Evidência:** `frontend-web/vite.config.ts:1-41` → não declara `build.sourcemap`. Default do Vite é `false`, então ok por acidente.
- **Correção sugerida:** explicitar `build: { sourcemap: false }` + comentário.
- **Esforço:** 2 min.

---

#### BUG 10-023 🔵 Bundle frontend único de 2.27 MB (sem code-splitting efetivo)
- **Sintoma:** `vite.config.ts` tem `manualChunks` configurado mas o build gera apenas `index-<hash>.js` (2.27 MB) + CSS — não há evidência de chunks separados em `frontend-web/dist/assets/`. Time-to-interactive no mobile 3G sofre.
- **Evidência:** `ls frontend-web/dist/assets/` → 1 JS, 1 CSS, 2 PNG. `vite.config.ts:14-38` promete 8+ chunks (`vendor-react`, `vendor-query`, `mod-fvs`, etc.).
- **Causa provável:** ausência de `React.lazy` + dynamic imports nas rotas; o `manualChunks` só funciona se algo importar dinamicamente.
- **Correção sugerida:** adicionar `React.lazy(() => import('@/pages/...'))` no `App.tsx` para rotas pesadas.
- **Esforço:** 4 h.
- **Cross-ref:** Camada 4 (frontend).

---

#### BUG 10-024 🔵 Sem monitoramento de uptime externo
- **Sintoma:** queda de API só é percebida quando cliente abre chamado. Sem histórico de incidentes.
- **Evidência:** `docs/` vazio para `uptime|monitoring|alert`.
- **Correção sugerida:** Uptime Kuma self-hosted ou UptimeRobot free apontando para `GET /api/v1/healthz` (depende de BUG 10-002).
- **Esforço:** 2 h.

---

## Itens OK / positivos observados

- ✅ Multi-stage build em ambos Dockerfiles (`backend/Dockerfile:1,13`, `frontend-web/Dockerfile:1,15`).
- ✅ Postgres e MinIO pinados em versão `16-alpine` e `7-alpine` respectivamente (`infra/docker-compose.prod.yml:5,24`).
- ✅ `restart: unless-stopped` em todos os services.
- ✅ Volumes persistentes nomeados (`postgres_v3_data`, `redis_v3_data`, `minio_v3_data`).
- ✅ Network interna `eldox_v3` (`bridge`) + externa `coolify` corretamente isolada.
- ✅ Traefik + Let's Encrypt configurado (`certresolver=letsencrypt`) — HTTPS automatizado.
- ✅ HTTP→HTTPS via router dedicado para ACME challenge (`eldox-v3-web-http`).
- ✅ `.env` real nunca committado (git ls-files confirmou só `.env.example` + `.env.prod.example`).
- ✅ `.gitignore` raiz lista `infra/.env` explicitamente (`.gitignore:13,45`).
- ✅ Sem segredos hardcoded em código TypeScript (todo acesso via `process.env.X` ou `ConfigService`).
- ✅ GHCR usado como registry (privado por default para repos privados).
- ✅ `prisma migrate deploy` no entrypoint — migrations automáticas.
- ✅ Build backend `tsc -b && vite build` rodando no stage builder.
- ✅ Gzip habilitado no nginx (`nginx.conf:7-8`).
- ✅ Cache immutable para assets hashados (`nginx.conf:11-14`).
- ✅ SPA fallback correto (`nginx.conf:17-19`).

---

## Cross-references

| Bug | Camada relacionada | Observação |
|-----|---|---|
| 10-002 | 6 / 7 | healthz afeta observabilidade + release gate |
| 10-006 | 7 | root em container = segurança |
| 10-011 | 7 | CORS em prod = segurança |
| 10-012 | 7 | headers HTTP = segurança |
| 10-013 | 2 / 7 | RLS desaplicado = isolamento multi-tenant quebrado |
| 10-016 | 7 | Redis sem senha = segurança |
| 10-023 | 4 | code-splitting no frontend |
| 10-014 | 8 | migrations = qualidade de banco |

---

## Resumo para orquestrador

**Totais:** 24 bugs (6 🔴 / 7 🟠 / 7 🟡 / 4 🔵).

**Top 3 dores:**
1. **BUG 10-001** — Backup de Postgres inexistente (perda total possível).
2. **BUG 10-002** — Backend sem `/healthz` + compose-prod sem healthcheck (rollouts cegos).
3. **BUG 10-003** — CI/CD sem gates de lint/test/type-check antes de `main` deployar.

**Ação urgente (hoje):** implementar backup automatizado de Postgres (BUG 10-001) e fixar `minio:latest` em versão (BUG 10-005) — ambos têm risco alto e esforço <4h somado. Em seguida, rodar BUG 10-002 + 10-003 antes do próximo deploy grande.

**Cross-refs principais:** Camada 7 (8 bugs de segurança ligados), Camada 2 (BUG 10-013 RLS), Camada 4 (BUG 10-023 bundle), Camada 6 (BUG 10-002 health para observabilidade).

**Gap de processo:** nenhum runbook operacional em `docs/`. Infraestrutura funciona no "dia bom" mas não está preparada para o "dia ruim" (incidente, restore, rollback).
