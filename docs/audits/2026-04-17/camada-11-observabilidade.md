# Camada 11 — Observabilidade e Operação

**Auditor:** auditor-camada-11-observabilidade
**Data:** 2026-04-17
**Escopo:** Logs, correlation ID, métricas, tracing, health, alertas, audit log, runbook
**Repositório:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3`
**Mobile:** N/A — mobile não desenvolvido nesta fase.

---

## Sumário executivo

A stack de observabilidade do Eldox v3 está em **estado embrionário**. Existe
somente um logger central Winston configurado em JSON (bom) e uma tabela
`ai_usage_log` que rastreia consumo Claude (bom). **Tudo o mais está
ausente**: nenhum endpoint de healthcheck/readiness exposto pela API (há
apenas healthchecks de contêiner no `docker-compose`), nenhuma correlation
ID, nenhuma métrica Prometheus/OTLP, nenhum tracing, nenhum Sentry no
frontend, nenhum runbook, nenhum plano de incidente, nenhum dashboard,
nenhum alerta configurado a nível de aplicação. Há ainda um **bug grave de
integridade**: 16 services chamam `INSERT INTO audit_log` mas a tabela
`audit_log` **não existe em nenhuma migration** — só existem tabelas
por-domínio (`fvs_audit_log`, `ged_audit_log`, `efetivo_audit_log`), o que
significa que todos esses INSERTs falham silenciosamente em runtime (o erro
é engolido por `.catch((e) => this.logger.error(...))`).

Total de bugs: **17** (3 🔴 críticos, 7 🟠 altos, 6 🟡 médios, 1 🔵 baixo).

---

## 🔴 Críticos

### BUG-11-001 🔴 Tabela `audit_log` referenciada por 16 services **não existe** em migration nenhuma

- **Arquivos:linha** (todos os call sites):
  - `backend/src/ncs/ncs.service.ts:292`
  - `backend/src/concretagem/corpos-de-prova/cps.service.ts:241` e `:261`
  - `backend/src/concretagem/laudos/laudos.service.ts:137`
  - `backend/src/concretagem/concretagens/email-concretagem.service.ts:103`
  - `backend/src/concretagem/concretagens/concretagens.service.ts:350`
  - `backend/src/concretagem/racs/racs.service.ts:200`
  - `backend/src/concretagem/caminhoes/caminhoes.service.ts:396` e `:416`
  - `backend/src/concretagem/croqui/croqui.service.ts:236`
  - `backend/src/fvm/recebimento/recebimento.service.ts:440`
  - `backend/src/fvm/recebimento/evidencias/evidencias.service.ts:250`
  - `backend/src/ensaios/laboratorios/laboratorios.service.ts:24`
  - `backend/src/ensaios/tipos/tipos.service.ts:77`
  - `backend/src/ensaios/ensaios.service.ts:59`
  - `backend/src/ensaios/revisoes/revisoes.service.ts:46`
- **Evidência da ausência:** `grep audit_log backend/prisma/migrations/**` só
  encontra `fvs_audit_log`, `ged_audit_log`, `efetivo_audit_log` — nunca o
  nome genérico `audit_log`.
- **Sintoma:** nenhuma ação sensível (aprovação de laudo, emissão de RAC,
  recepção de material, revisão de ensaio, criação/edição/exclusão de NC
  etc.) é de fato persistida em log de auditoria. Todos os `$executeRawUnsafe`
  disparam um `relation "audit_log" does not exist` que é engolido por
  `.catch((e) => this.logger.error('audit falhou'))`. O sistema "parece"
  auditado mas não é.
- **Causa:** migration que cria `audit_log` genérico nunca foi criada.
  Parece que cada módulo assumiu que a tabela global existia, mas na
  prática só existem tabelas `<dominio>_audit_log`.
- **Correção sugerida:** criar migration `audit_log_core` com schema
  `(id BIGSERIAL, tenant_id INT NOT NULL, usuario_id INT, acao VARCHAR,
  entidade VARCHAR, entidade_id INT, dados_antes JSONB, dados_depois JSONB,
  detalhes JSONB, ip VARCHAR(45), user_agent TEXT, created_at TIMESTAMPTZ)`,
  indexes por `(tenant_id, entidade, created_at DESC)` e trigger
  append-only. Em seguida rodar smoke test em cada um dos 16 services.
- **Esforço:** M (4 h dev + 2 h QA).
- **Risco de regressão:** Baixo — o caminho atual já não grava nada.
- **Cross-ref:** [Cross-ref camada 3] — camada de dados / migrations
  faltando. [Cross-ref camada 7] — violação de ISO/PBQP-H (requisito legal
  de 5 anos de retenção não está sendo cumprido).

### BUG-11-002 🔴 Nenhum endpoint HTTP de healthcheck/readiness

- **Arquivo:linha:** `backend/src/app.module.ts:22-54` (AppController sequer
  está registrado no módulo) e `backend/src/app.controller.ts:1-12` (só
  tem `GET /` retornando "Hello World!" — e esse controller **não está
  nos imports de nenhum módulo**, logo nem essa rota existe).
- **Sintoma:** Coolify e Traefik não têm como saber se o backend está
  vivo ou pronto para receber tráfego. `docker-compose.prod.yml:52-87` não
  define `healthcheck:` para o serviço `backend` (os containers de
  Postgres, Redis e MinIO têm — o backend não). Deploys quebrados só são
  percebidos quando um usuário reclama.
- **Causa:** `@nestjs/terminus` não está instalado (`backend/package.json`
  não lista — confirmado). Nenhuma rota `/healthz` / `/readyz` / `/health`
  implementada em parte alguma do código.
- **Correção sugerida:** adicionar `@nestjs/terminus`, expor
  `GET /api/v1/health` e `GET /api/v1/ready` com checks de Prisma
  (`$queryRaw SELECT 1`), Redis (`ioredis.ping()`) e MinIO
  (`bucketExists()`), adicionar `healthcheck:` no `docker-compose.prod.yml`
  do serviço `backend`.
- **Esforço:** P (2 h).
- **Risco de regressão:** Nulo — adição pura.
- **Cross-ref:** [Cross-ref camada 8] (deploy/infra) — Traefik deveria
  usar esses endpoints como liveness probes.

### BUG-11-003 🔴 AppController não registrado no AppModule — rota raiz inexistente

- **Arquivo:linha:** `backend/src/app.module.ts:22-54` — o decorator
  `@Module({ imports: [...] })` não inclui `controllers: [AppController]`
  nem `providers: [AppService]`.
- **Sintoma:** Qualquer tentativa de `GET /` na API retorna 404. Já é
  estranho por si só, mas indica que **a app não foi instrumentada com
  rota de fallback nem de boas-vindas**, dificultando troubleshooting
  (usuários e operadores batem na raiz para testar conectividade).
- **Causa:** AppModule foi reescrito quando os módulos de domínio foram
  adicionados e AppController/AppService ficaram órfãos — continuam no
  filesystem, continuam tendo teste (`app.controller.spec.ts`) mas não
  são mais bootstrapados.
- **Correção sugerida:** decidir: ou remover `app.controller.ts`,
  `app.service.ts` e `app.controller.spec.ts`; ou registrar no AppModule
  e converter em endpoint `/healthz` + versão da app. Recomendado:
  substituir por HealthController (ver BUG-11-002).
- **Esforço:** P (15 min).
- **Risco de regressão:** Nulo.
- **Cross-ref:** [Cross-ref camada 2] (módulos órfãos).

---

## 🟠 Altos

### BUG-11-004 🟠 Ausência total de Correlation ID / X-Request-Id

- **Evidência:** `grep -ri "X-Request-Id\|correlationId\|requestId" backend/src`
  não retorna nada. `main.ts` (`backend/src/main.ts:32-56`) não usa
  nenhum middleware de correlação (nada como `nestjs-cls`, `AsyncLocalStorage`,
  `@nestjs/pino` com `genReqId`).
- **Sintoma:** impossível correlacionar um erro reportado pelo usuário
  com o log do backend. Impossível seguir a cadeia `request → fila Bull
  → worker IA → MinIO`. Suporte perde horas a cada incidente.
- **Causa:** observabilidade não foi parte da definição de pronto ao
  levantar o esqueleto NestJS.
- **Correção sugerida:** instalar `nestjs-cls` + middleware que lê
  `X-Request-Id` ou gera UUID v4, propaga via AsyncLocalStorage, inclui
  em todos os `WinstonModule` logs e em todo payload de job Bull. Incluir
  também no axios do frontend (`frontend-web/src/services/api.ts:11-15`).
- **Esforço:** M (4 h).
- **Risco de regressão:** Baixo.

### BUG-11-005 🟠 Nenhuma métrica exposta (Prometheus / OTLP / StatsD)

- **Evidência:** nenhuma dependência `prom-client`, `@nestjs/prometheus`,
  `@opentelemetry/*`, `@willsoto/nestjs-prometheus` em
  `backend/package.json:22-54`. Nenhuma rota `/metrics`.
- **Sintoma:** o único "KPI" de produção hoje é log grep. Ninguém sabe
  p50/p95, taxa de erro por endpoint, throughput, conexões DB ativas,
  tamanho da fila Bull, uso de memória por container. Relato clássico
  "o sistema tá lento" fica indemonstrável.
- **Causa:** instrumentação nunca foi priorizada.
- **Correção sugerida:** expor `/api/v1/metrics` com `prom-client`
  (histogramas por rota via interceptor global) e adicionar Prometheus +
  Grafana no `docker-compose` (ou ligar ao stack Coolify que já tem
  Traefik — Traefik já gera métricas próprias que podem ser raspadas).
- **Esforço:** G (1 dia).
- **Risco de regressão:** Nulo.

### BUG-11-006 🟠 Nenhum tracing / OpenTelemetry / Langfuse, apesar de IA em produção

- **Evidência:** `grep -ri "langfuse\|opentelemetry\|otel\|tracer" .` só
  retorna ocorrências em package-lock.json (transitivas). Nenhuma
  inicialização em `main.ts`. Memória do projeto (`project_ensaios_sprint_state.md`,
  ADR-019..030) menciona Langfuse como padrão para IA, mas não há traço
  de integração no código.
- **Sintoma:** em 10 agentes IA (RDO: `backend/src/ai/agents/rdo/*`, FVS:
  `backend/src/ai/agents/fvs/*`, Efetivo: `backend/src/efetivo/ia/agents/*`,
  EnsaioIa: `backend/src/ensaios/ia/ensaio-ia.service.ts`, IaService:
  `backend/src/ia/ia.service.ts`), nenhum prompt/resposta é rastreado em
  sistema externo — só tokens e custo vão para `ai_usage_log`. Debugging
  de alucinação ou prompt quebrado é feito na mão, relendo `JSON.stringify`
  no log do Winston.
- **Causa:** ADR aprovado mas implementação pendente.
- **Correção sugerida:** instalar `langfuse-node`, instrumentar
  `IaService.callClaude*` (`backend/src/ia/ia.service.ts:150-181`) para
  enviar spans com `tenantId`, `usuarioId`, `handlerName`, prompt e
  resposta (mascarando PII).
- **Esforço:** M (6 h).
- **Risco de regressão:** Baixo.

### BUG-11-007 🟠 Nenhum Sentry / crash reporting no frontend web

- **Evidência:** `grep -ri "sentry" frontend-web/src` → 0 matches.
  `frontend-web/package.json` não importa `@sentry/*`. Nenhum
  `ErrorBoundary` de aplicação raiz em `frontend-web/src/App.tsx:1-40`
  (existem 5 referências pontuais em páginas — `ObrasListPage.tsx`,
  `CadastroObraWizard.tsx`, `EditarObraModal.tsx`, `RdoFormPage.tsx`,
  `RdosListPage.tsx` — mas aparentemente como comentário, não `class extends
  ErrorBoundary`; pesquisa por `componentDidCatch` retorna 0).
- **Sintoma:** se um componente React crashar com "white screen", ninguém
  fica sabendo. Usuário reporta depois, sem stack.
- **Causa:** observabilidade frontend não foi contemplada.
- **Correção sugerida:** adicionar `@sentry/react` com DSN por env,
  envelope raiz de `<ErrorBoundary>` em `App.tsx`, upload de source maps
  no build.
- **Esforço:** P (3 h).
- **Risco de regressão:** Nulo.

### BUG-11-008 🟠 `audit_log` (quando/se existir) não guarda IP nem User-Agent

- **Arquivo:linha:** `backend/src/ncs/ncs.service.ts:282-302` (assinatura
  `auditLog(tenantId, userId, acao, entidadeId, antes, depois)`), idem
  nos outros 15 services que escrevem em `audit_log`. O schema referencial
  mais próximo (`RdoLogEdicao` em `backend/prisma/schema.prisma:635-653`)
  tem `ipOrigem VARCHAR(45)` mas os writers passam argumento nenhum.
- **Sintoma:** audit log (quando for corrigido no BUG-11-001) não terá IP
  nem user-agent — informação exigida por auditorias PBQP-H/ISO 9001:2015
  para rastreabilidade forense.
- **Causa:** padrão de assinatura da função `auditLog` privada foi copiado
  e colado em todos os módulos sem incluir `Request` / `req.ip` /
  `req.headers['user-agent']`.
- **Correção sugerida:** extrair `AuditLogService` centralizado que
  recebe `request` (via `@Req()` ou ClsService) e preenche IP/UA
  automaticamente.
- **Esforço:** M (4 h).
- **Risco de regressão:** Médio — mexe em 16 call sites.
- **Cross-ref:** [Cross-ref camada 7] — compliance PBQP-H/ISO.

### BUG-11-009 🟠 Log de PII sem mascaramento: número de WhatsApp cru

- **Arquivo:linha:**
  - `backend/src/diario/whatsapp/whatsapp.service.ts:45-51`
  - `backend/src/diario/whatsapp/whatsapp.service.ts:62`
  - `backend/src/diario/whatsapp/whatsapp.service.ts:86-96` (`numero: dto.numero`)
  - `backend/src/diario/rdo/rdo.processor.ts:149` (`numero`)
- **Sintoma:** o número de telefone completo do trabalhador é escrito em
  `JSON.stringify` direto no log (Winston → stdout e arquivo em prod).
  É PII e, para casos BR, equivale a informação pessoal sob LGPD.
- **Causa:** ausência de helper `mask(numero)` / `redact({fields:['numero']})`.
- **Correção sugerida:** mascarar para `+55***********NN` antes de logar.
  Centralizar em util `common/log/mask.ts`.
- **Esforço:** P (2 h).
- **Risco de regressão:** Nulo.
- **Cross-ref:** [Cross-ref camada 7] — LGPD / segurança.

### BUG-11-010 🟠 Nenhum interceptor HTTP global que emita `method path status durationMs`

- **Evidência:** `grep -rn "durationMs\|duration_ms\|method.*path.*status"
  backend/src` só retorna uso em `almoxarifado.processor.ts` (um worker
  BullMQ, não rotas HTTP). Nenhum arquivo em `backend/src/common/` define
  `LoggingInterceptor`. `main.ts:42-46` só registra `ValidationPipe`.
- **Sintoma:** logger Winston não tem entrada por request, só tem logs
  ad-hoc que cada service escolhe fazer. Latência por endpoint e taxa de
  erro são impossíveis de extrair.
- **Correção sugerida:** criar `common/logging.interceptor.ts` com
  `NestInterceptor`, medir `Date.now()` antes/depois, emitir
  `{ level, requestId, method, path, status, durationMs, tenantId,
  userId }`. Registrar como `APP_INTERCEPTOR` em `AppModule`.
- **Esforço:** P (2 h).
- **Risco de regressão:** Baixo.

---

## 🟡 Médios

### BUG-11-011 🟡 Nenhuma configuração de alertas em lugar algum

- **Evidência:** `grep -ri "alert\|telegram\|slack webhook" infra/` → 0
  (há uso da palavra "alerta" no domínio — ex: `alertas/alertas.service.ts`
  no contexto ensaios —, mas nada de alerta operacional). Nem
  `docker-compose.yml` nem `docker-compose.prod.yml` mencionam Uptime
  Kuma, Prometheus Alertmanager, Better Stack, HealthChecks.io, nada.
- **Sintoma:** healthz falhando por 2 minutos → ninguém é notificado.
  Disco a 99% → ninguém é notificado. Taxa de erro 50% → ninguém é
  notificado.
- **Correção sugerida:** MVP = Uptime Kuma em contêiner próprio
  pingando `/api/v1/health` e enviando para Telegram/WhatsApp. Médio
  prazo = Prometheus + Alertmanager.
- **Esforço:** M (3 h para MVP).
- **Risco de regressão:** Nulo.

### BUG-11-012 🟡 Nenhum dashboard operacional (Grafana/Kuma/Datadog)

- **Evidência:** nada em `infra/`, nada em `docs/`. Coolify já oferece
  dashboard de containers mas não foi extraído/documentado.
- **Sintoma:** operador não tem pintura única — precisa SSH, precisa
  `docker logs`, precisa abrir Coolify, precisa abrir banco.
- **Correção sugerida:** após resolver BUG-11-005, subir Grafana com 2
  dashboards: "Operacional" e "Negócio" (ver referência §11.8).
- **Esforço:** G (1 dia).
- **Risco de regressão:** Nulo.

### BUG-11-013 🟡 Nenhum runbook / procedimentos operacionais

- **Evidência:** `grep -ri "runbook\|plano.*incidente\|procedimento" docs/`
  só retorna arquivos de spec de feature (nada de operação). `backend/README.md`
  e `frontend-web/README.md` são boilerplate NestJS/Vite sem qualquer
  procedimento.
- **Sintoma:** restart, restore, rollback, invalidar sessões, aumentar
  memória — nada documentado. Dependência total da memória de quem fez.
- **Correção sugerida:** criar `docs/operations/runbook.md` com: restart
  Coolify, restore de backup Postgres, rollback via tag Docker, procedimento
  de incidente (quem é acionado, canal, template de comunicação).
- **Esforço:** M (1 dia).
- **Risco de regressão:** Nulo.

### BUG-11-014 🟡 Nenhum plano de incidente documentado

- **Evidência:** idem BUG-11-013. Nem `AGENTS.md` nem `CONTEXT.md` (não
  presentes no repo) nem `docs/` contêm decisão sobre SLA, canal de
  comunicação com cliente, template de status e post-mortem.
- **Correção sugerida:** junto com BUG-11-013, adicionar seção
  "incident response".
- **Esforço:** P (meio dia).
- **Risco de regressão:** Nulo.

### BUG-11-015 🟡 Log em arquivo `logs/app.log` só em produção, sem rotação

- **Arquivo:linha:** `backend/src/main.ts:20-30`. Em produção cria
  `new winston.transports.File({ filename: 'logs/app.log' })` sem
  `maxsize`, sem `maxFiles`, sem `winston-daily-rotate-file`.
- **Sintoma:** disco enche com o tempo. Como não há alerta de disco
  (BUG-11-011), a API cai sem aviso.
- **Correção sugerida:** trocar para `winston-daily-rotate-file`
  com `maxSize: '20m'` e `maxFiles: '14d'`. Ou apenas confiar no stdout
  do contêiner + driver de log Docker com `max-size`.
- **Esforço:** P (1 h).
- **Risco de regressão:** Baixo.

### BUG-11-016 🟡 Níveis de log uniformemente "log/info" — não há `debug` segmentado

- **Evidência:** 272 ocorrências de `logger.*` em 60 arquivos (grep). Dos
  exemplos inspecionados, quase todos usam `logger.log(...)` (Nest trata
  como `info`). Raríssimos `debug` (só
  `backend/src/ensaios/ia/ensaio-ia.service.ts:246` e
  `backend/src/ensaios/whatsapp/evolution.service.ts:27`). Mensagens de
  fluxo normal (`Upload concluído`, `Versão aprovada`) estão em `info`,
  enchendo o log em produção.
- **Sintoma:** grep fica difícil; separação sinal/ruído ruim.
- **Correção sugerida:** auditar os 272 call sites e reclassificar:
  `info` = evento de negócio importante; `debug` = fluxo interno;
  `warn/error` como já estão. Configurar `winston` com `level: 'info'` em
  prod e `'debug'` em dev.
- **Esforço:** G (1 dia de cosmética).
- **Risco de regressão:** Nulo.

---

## 🔵 Baixos

### BUG-11-017 🔵 `console.log` residual no bootstrap

- **Arquivo:linha:** `backend/src/main.ts:54` (`console.log('API rodando
  em http://localhost:...')`).
- **Sintoma:** mensagem de boot fora do pipeline Winston — não vira JSON,
  não tem requestId (não teria mesmo, mas fica fora do padrão).
- **Correção sugerida:** trocar por `new Logger('Bootstrap').log(...)`.
- **Esforço:** trivial (2 min).
- **Risco de regressão:** Nulo.

---

## O que funciona bem (não-bugs)

1. **Winston configurado cedo** (`backend/src/main.ts:32-38`) — passa o
   WinstonModule como `logger` do Nest, já em JSON via
   `winston.format.json()`. Base sólida.
2. **`ai_usage_log` (migration `20260413000001_ai_usage_log`)** — tabela
   com `tenant_id, usuario_id, handler_name, modelo, tokens_in/out,
   custo_estimado, duracao_ms` e indexes. Confirmado uso em
   `backend/src/ia/ia.service.ts:61-78` (`logUsage`) e rate limit em
   `:41-57` (`checkRateLimit`) — 20 req/hora por usuário+handler.
3. **Rdo_log_edicoes** (`schema.prisma:635-653`) — audit log imutável já
   com `valor_anterior/valor_novo/via/ip_origem`. Bom padrão —
   deveria ser generalizado (ver BUG-11-008).
4. **Logs estruturados em JSON** em alguns módulos de alto risco:
   `backend/src/almoxarifado/jobs/almoxarifado.processor.ts:27,70,79` já
   escrevem `logger.log(JSON.stringify({...}))`. Idem em
   `ensaios.service.ts:63` e `whatsapp.service.ts:86-96`.
5. **Healthchecks em contêiner** (Postgres, Redis, MinIO) em
   `docker-compose.yml:16-20, 30-34, 49-53` e
   `docker-compose.prod.yml:17-21, 46-50`. Só falta o próprio backend
   (BUG-11-002).

---

## Ferramentas recomendadas (ordem de prioridade)

1. **@nestjs/terminus** — healthz/readyz. Leve, já Nest-native. (resolve BUG-11-002)
2. **nestjs-cls** — correlation ID via AsyncLocalStorage. (resolve BUG-11-004)
3. **@sentry/react + @sentry/node** — crash reporting ponta a ponta.
   (resolve BUG-11-007 e cobre backend gratuitamente)
4. **prom-client + Grafana** ou **Better Stack / Uptime Kuma** para MVP
   rápido. (resolve BUG-11-005 e parte de BUG-11-012)
5. **langfuse-node** — tracing de IA. (resolve BUG-11-006, alinha com ADR)
6. **winston-daily-rotate-file** — rotação de logs. (resolve BUG-11-015)

---

## Resumo para orquestrador

**Totais:** 17 bugs — 3 🔴 / 7 🟠 / 6 🟡 / 1 🔵.

**Top 3:**
1. **BUG-11-001 🔴** — tabela `audit_log` não existe, 16 services gravam
   em buraco negro. Ação crítica: criar migration.
2. **BUG-11-002 🔴** — zero endpoints HTTP de health/readiness; backend
   sem healthcheck no `docker-compose.prod.yml`. Coolify não sabe se
   está vivo.
3. **BUG-11-004 🟠** — nenhuma correlation ID em lugar algum; impossível
   rastrear incidente do frontend até o worker Bull.

**Ação urgente:** criar migration `audit_log_core` e `HealthModule` no
mesmo PR — ambos destravam o fluxo de produção/compliance e não têm
dependência de nada.

**Cross-refs ativas:**
- [Camada 3 — Dados/ORM] ghost-table `audit_log` (BUG-11-001).
- [Camada 7 — Segurança/Compliance] PBQP-H/ISO 9001 retenção 5 anos
  quebrada (BUG-11-001); IP/UA ausentes (BUG-11-008); LGPD + número de
  WhatsApp cru em logs (BUG-11-009).
- [Camada 8 — Deploy/Infra] falta de healthcheck no contêiner backend
  (BUG-11-002); ausência de alertas e dashboards (BUG-11-011, 11-012);
  rotação de log (BUG-11-015).
- [Camada 2 — Módulos] AppController órfão (BUG-11-003).
- [Camada 10 — IA/Prompts] Langfuse ausente apesar de ADR-019..030
  (BUG-11-006).

Fim da auditoria da Camada 11.
