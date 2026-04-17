# Eldox v3 — Pacote de Contexto Compartilhado (Auditoria 2026-04-17)

Distribuído para todos os auditores de camada. Fonte única de verdade sobre
o estado atual do sistema no momento da varredura.

---

## 0. Escopo da auditoria

- **Data:** 2026-04-17
- **Repositório:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3`
- **Monorepo:** ❌ Não é monorepo formal (sem `pnpm-workspace`, `turbo.json`,
  `nx.json`). São **2 projetos siblings** (`backend/` e `frontend-web/`)
  + `infra/` + `docs/`.
- **Camada 5 (Mobile):** **PULADA** — pasta `frontend-mobile/` **não existe**
  no repositório. AGENTS.md referencia mobile via ADR-013/014, mas ainda não
  foi desenvolvido. Qualquer referência a mobile nas outras camadas deve ser
  marcada como "N/A — mobile não desenvolvido".

---

## 1. Stack confirmada

### Backend (`eldox-v3/backend`)
- **Framework:** NestJS 11 (⚠️ skill menciona Fastify — **divergência**:
  o real é NestJS 11 com `@nestjs/platform-express`).
- **ORM:** Prisma 7.6 + `@prisma/adapter-pg` (pg 8.20)
- **Banco:** PostgreSQL
- **Auth:** `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` + `bcryptjs`
- **Filas:** `@nestjs/bull` 11 + `bull` 4.16 + `ioredis` 5.10
- **Storage:** MinIO 8.0 (S3-compatible)
- **IA:** `@anthropic-ai/sdk` 0.88
- **Logs:** `nest-winston` + `winston` 3.19
- **Outros:** pdfkit, sharp (imagens), xlsx, class-validator, class-transformer
- **Testes:** Jest 30 + Supertest 7
- **TypeScript:** 5.7
- **Node types:** 24.x

### Frontend Web (`eldox-v3/frontend-web`)
- **Framework:** React 19.2 + Vite 8
- **Roteamento:** `react-router-dom` 7.14 (browser router)
- **Estado servidor:** `@tanstack/react-query` 5.96 (staleTime 60s, gcTime 5min)
- **Estado local:** `zustand` 5.0
- **Formulários:** `react-hook-form` 7.72 + `@hookform/resolvers` + `zod` 4
- **HTTP:** `axios` 1.14
- **UI:** Tailwind 3.4 + `clsx` + `tailwind-merge` + `lucide-react`
- **Gráficos/Grid:** `recharts` 3.8, `react-grid-layout`
- **Export:** `exceljs`, `xlsx`, `@react-pdf/renderer`
- **TypeScript:** 5.9
- **Node types:** 24.x

### Infra (`eldox-v3/infra`)
- `docker-compose.yml` + `docker-compose.prod.yml`
- Dockerfile em cada app + `nginx.conf` no frontend
- Deploy: Coolify no VPS Hostinger (portável para OCI conforme ADR-006)

### Mobile
- ❌ **Não existe** no repositório. AGENTS.md projeta `frontend-mobile/` com
  React Native + Expo + WatermelonDB, mas ainda não iniciado.

---

## 2. Multi-tenancy (padrão oficial)

**Modelo:** Schema compartilhado + `tenantId` em toda tabela de negócio
+ PostgreSQL Row Level Security (RLS) como camada defensiva adicional.

Evidências:
- `backend/prisma/rls/rls.sql` — script SQL aplicado manualmente após
  migrations. Habilita RLS em Usuario, Obra, ObraLocal, ObraTipo (e demais
  via changelog).
- `backend/prisma/rls/rls_rdo.sql` — RLS específico para módulo Diário (RDO).
- **88 ocorrências** de `tenantId`/`tenant_id` no `schema.prisma`.
- Role PG: `eldox_app` (criada pelo script RLS; app deve usar `SET LOCAL
  app.tenant_id = '<id>'` antes de cada query).
- SUPERUSER (Prisma migrations/seeds) bypassa RLS — **ponto de atenção da
  Camada 7**.

**Regra não-negociável (AGENTS.md):** "Nenhuma query sem WHERE tenant_id.
RLS é complementar, não substituto."

---

## 3. Módulos declarados oficialmente

Fonte: `AGENTS.md` + pastas `backend/src/` + `frontend-web/src/modules/`
+ `pages/`.

| # | Módulo | Backend (NestJS) | Frontend (React) | Tabelas Prisma |
|---|--------|------------------|------------------|----------------|
| 1 | Obras | `obras/` ✅ | `pages/obras/` ✅ | Obra, ObraLocal, ObraTipo, ObraTipoNivel, ObraTipoCampo, ObraNivelConfig, ObraQualityConfig |
| 2 | FVS (Inspeção) | `fvs/` ✅ | `modules/fvs/` ✅ | (via migrations fvs_*) |
| 3 | FVM (Materiais) | `fvm/` ✅ | `modules/fvm/` ✅ | (via migration fvm_module) |
| 4 | NC / CAPA | `ncs/` + `planos-acao/` ✅ | `modules/ncs/` ✅ | NaoConformidade, (planos-acao) |
| 5 | Concretagem | `concretagem/` ✅ | `modules/concretagem/` ✅ | ConcretagemCroqui, (sprint8_concretagem) |
| 6 | Diário de Obra (RDO) | `diario/` ✅ | `modules/diario/` ✅ | Rdo, RdoClima, RdoMaoDeObra, RdoEquipamento, RdoAtividade, RdoOcorrencia, RdoChecklistItem, RdoFoto, RdoAssinatura, RdoSugestaoIa, RdoLogEdicao |
| 7 | Ensaios Laboratoriais | `ensaios/` ✅ | `modules/ensaios/` ✅ | (via ensaio_tipos, ensaio_laboratorial, ensaio_alertas) |
| 8 | GED (Documentos) | `ged/` ✅ | `pages/ged/` ✅ | (via ged_module — 14 tabelas) |
| 9 | Efetivo | `efetivo/` ✅ | `modules/efetivo/` ✅ | EmpresaEfetivo, FuncaoEfetivo, RegistroEfetivo, ItemEfetivo |
| 10 | Aprovações / Workflow | `aprovacoes/` ✅ | `modules/aprovacoes/` ✅ | WorkflowTemplate, WorkflowTemplateEtapa, AprovacaoInstancia, AprovacaoDecisao |
| 11 | Almoxarifado | `almoxarifado/` ✅ | `modules/almoxarifado/` ✅ | (via almoxarifado_init) |
| 12 | Semáforo PBQP-H | `semaforo/` ✅ | `modules/semaforo/` ✅ | SemaforoPbqphCache |
| 13 | Dashboard | `dashboard/` ✅ | `pages/DashboardPage.tsx` ✅ | — |
| 14 | EldoX.IA (camada IA) | `ai/` + `ia/` ✅ | — | (via eldoxia_mvp — 5 tabelas) |
| 15 | Portal (público) | — | `modules/portal/` ✅ | — |

**Módulos declarados em AGENTS.md ainda ausentes:**
- ❌ **Gestão de Frota / Frotas & Equipamentos** — mencionado no escopo oficial
  (skill + AGENTS.md) mas **não há pasta no backend nem no frontend**.
- ❌ **Rastreabilidade** (módulo dedicado além do croqui de concretagem) —
  mencionado na skill como módulo separado; existe só como sub-feature de
  concretagem.

Essas ausências são candidatas a **"módulos órfãos"** para a Camada 2.

---

## 4. Inventário quantitativo

| Item | Quantidade |
|------|-----------:|
| Módulos NestJS (`*.module.ts`) | **19** |
| Controllers NestJS (`*.controller.ts`) | **55** |
| Decoradores HTTP (`@Get/@Post/@Put/@Patch/@Delete/@Controller`) | **429** |
| Modelos Prisma (`model X`) | **32** |
| Migrations Prisma | **30** |
| Scripts RLS SQL | **2** (`rls.sql`, `rls_rdo.sql`) |
| Seeds | **2** (`seed.ts`, `seed-obra-celina-bezerra.ts`) |
| Arquivos `.tsx` no frontend | **195** |
| Páginas (`pages/**`) | **75** |
| Módulos frontend (`modules/*`) | **12** |
| Rotas registradas em `App.tsx` | **~65** (incluindo públicas) |
| Itens do Sidebar principal | **12** |

### Sidebar — links extraídos de `components/layout/Sidebar.tsx`

| # | Label (inferido pelos ícones) | `to=` |
|---|-------------------------------|-------|
| 1 | Dashboard | `/dashboard` |
| 2 | Obras | `/obras` |
| 3 | FVS Dashboard | `/fvs/dashboard` |
| 4 | NCs (Global) | `/ncs` |
| 5 | FVM Catálogo | `/fvm/catalogo` |
| 6 | FVM Fornecedores | `/fvm/fornecedores` |
| 7 | Diário (Home) | `/diario` |
| 8 | GED Admin | `/ged/admin` |
| 9 | Aprovações | `/aprovacoes` |
| 10 | Semáforo | `/semaforo` |
| (outros links contextuais via `to={to}` dinâmicos) | | |

**Cross-ref importante para Camada 1:** o Sidebar usa hook
`useResolvedObraId()` para resolver uma obra ativa e montar os links
contextuais. Se nenhuma obra existir, muitos links do sidebar ficam sem
destino válido — potencial causa do sintoma "sidebar quebrado" reportado
pelo usuário.

---

## 5. Convenções oficiais (extraídas de AGENTS.md)

- **Versionamento de API:** prefixo `/api/v1/` (ADR-007).
- **Autenticação:** JWT com claims `tenant_id`, `user_id`, `role`, `plano`
  (ADR-010). Nenhum endpoint sem JWT.
- **Segredos:** somente em variáveis de ambiente. Nenhum hardcoded.
- **Deploy:** gate aprovado pelo PO obrigatório.
- **Design System:** Precision Ops Dark (referenciado em
  `frontend-web/src/styles/` — tokens CSS).

---

## 6. Artefatos pré-existentes relevantes

- `docs/ui-audit-fase1.html` — auditoria de UI anterior (fase 1). Os
  auditores de Camada 4 devem lê-lo para evitar duplicação.
- `backend/README.md`, `frontend-web/README.md` — READMEs dos apps.
- `Agente e Contexto/AGENTS.md` — pipeline agêntico e ADRs.
- `Agente e Contexto/CONTEXT.md` — memória viva do projeto.
- `Agente e Contexto/2026-04-04-gaps-pipeline-agentes.md` — SDD aprovado.

---

## 7. Instruções para todos os auditores

1. **Leia este arquivo primeiro.**
2. **Leia a referência da sua camada** em
   `~/.claude/skills/eldox-auditor/references/camada-NN-*.md`.
3. **Rode os comandos sugeridos** na sua referência dentro de
   `eldox-v3/`.
4. **Salve o relatório** em
   `eldox-v3/docs/audits/2026-04-17/camada-NN-<nome>.md`.
5. **Todo bug exige arquivo e linha** (ou rota/URL).
6. **Nunca invente.** Se não confirmou, use ⚠️ Verificação Pendente.
7. **Não corrija nada.** Apenas audite e relate.
8. **Mobile = N/A.** Se sua camada referenciar mobile/RN/offline, marque
   como "N/A — mobile não desenvolvido nesta fase".
9. **Cross-refs:** se encontrar algo de outra camada, anote como
   `[Cross-ref camada X]` e siga em frente.

Formato do relatório: seguir rigorosamente a seção "Etapa 5" da skill
eldox-auditor (bugs por severidade 🔴🟠🟡🔵, evidência em arquivo:linha,
sintoma, causa, correção sugerida, esforço, risco de regressão).
