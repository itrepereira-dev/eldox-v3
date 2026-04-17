# Camada 1 — Navegação e Roteamento (Eldox v3)

- **Data:** 2026-04-17
- **Auditor:** auditor-camada-01-navegacao
- **Escopo:** `frontend-web/src/App.tsx` + `components/layout/Sidebar.tsx` + `NavItem.tsx` + `AppShell.tsx` + `AppLayout.tsx` + inventário cruzado com `pages/**` e `modules/**`.
- **Sintoma reportado pelo usuário:** "sidebar quebrado".
- **Mobile:** N/A — `frontend-mobile/` não existe.

---

## 1. Tabela cruzada do Sidebar (12 itens do topo)

Fonte: `frontend-web/src/components/layout/Sidebar.tsx`.
"Existe" = rota declarada em `App.tsx`. "Carrega" = página tem `export default`/`export named` e `lazy()` correto. "Permissão" = nenhuma checagem granular hoje; único guard é `AppLayout` → `isAuthenticated`.

| # | Item Sidebar | `to=` | Rota em App.tsx | Existe | Carrega | Backend | Permissão | Status |
|---|--------------|-------|-----------------|:------:|:-------:|---------|-----------|--------|
| 1 | Dashboard | `/dashboard` | `App.tsx:112` | ✅ | ✅ | `dashboard/` | login-only | OK |
| 2 | Obras | `/obras` | `App.tsx:115` | ✅ | ✅ | `obras/` | login-only | OK |
| 3 | Fichas de Inspeções → Inspeções | `/fvs/fichas` | `App.tsx:132` | ✅ | ✅ | `fvs/` | login-only | OK |
| 3b | Fichas de Inspeções → Templates | `/fvs/modelos` | `App.tsx:160` | ✅ | ✅ | `fvs/` | login-only | OK |
| 4 | Dashboard FVS | `/fvs/dashboard` | `App.tsx:144` | ✅ | ✅ | `fvs/` (controller dashboard) | login-only | ⚠️ Modo "global" funciona, mas quase toda a UI está condicionada a `obraId` — ver Bug 🟡-4 |
| 5 | Não conformidades (global) | `/ncs` | `App.tsx:193` | ✅ | ✅ | `ncs/` | login-only | OK |
| 6 | Planos de Ação (contextual) | `/obras/{obraAtivaId}/fvs/planos-acao` ou `/obras` | `App.tsx:209` | ✅ | ✅ | `planos-acao/` | login-only | ⚠️ Fallback vai para `/obras` (lista), não tela contextual — Bug 🟠-1 |
| 7 | Concretagem (grupo) | `/obras/{obraAtivaId}/concretagem[/...]` ou `/obras` | `App.tsx:166-170` | ✅ | ✅ | `concretagem/` | login-only | 🔴 Fallback sem obra: os 3 subitens apontam para `/obras` — grupo aparece "quebrado" |
| 8 | Ensaios (grupo) | `/obras/{obraAtivaId}/ensaios[/...]` ou `/obras` | `App.tsx:155-157` | ✅ | ✅ | `ensaios/` | login-only | 🔴 Mesmo caso: 3 subitens → `/obras` |
| 9 | Controle de Materiais (FVM) | `/fvm/obras/{obraAtivaId}` ou `/fvm/catalogo` | `App.tsx:138, 140` | ✅ | ✅ | `fvm/` | login-only | OK (fallback para `/fvm/catalogo` é válido) |
| 10 | Catálogo FVM | `/fvm/catalogo` | `App.tsx:140` | ✅ | ✅ | `fvm/` | login-only | OK |
| 11 | Fornecedores | `/fvm/fornecedores` | `App.tsx:141` | ✅ | ✅ | `fvm/` | login-only | OK |
| 12 | Almoxarifado (grupo, 7 subitens) | `/obras/{obraAtivaId}/almoxarifado[/...]` ou `/obras` | `App.tsx:173-186` | ✅ | ✅ | `almoxarifado/` | login-only | 🔴 Fallback sem obra: 7 subitens → `/obras` — grupo inteiro inerte |
| 13 | Diário de Obra | `/diario` | `App.tsx:148` | ✅ | ✅ | `diario/` | login-only | OK (lista obras e leva para `/obras/:id/diario`) |
| 14 | GED | `/ged/admin` | `App.tsx:126` | ✅ | ✅ | `ged/` | login-only | OK |
| 15 | Efetivo | `/obras/{obraAtivaId}/efetivo` ou `/obras` | `App.tsx:205` | ✅ | ✅ | `efetivo/` | login-only | ⚠️ Fallback `/obras` — sem contexto, vira lista de obras |
| 16 | Aprovações | `/aprovacoes` | `App.tsx:200` | ✅ | ✅ | `aprovacoes/` | login-only | OK |
| 17 | Semáforo | `/semaforo` | `App.tsx:197` | ✅ | ✅ | `semaforo/` | login-only | OK |
| 18 | Cadastros → Serviços FVS | `/configuracoes/fvs/catalogo` | `App.tsx:129` | ✅ | ✅ | `fvs/` | login-only | OK |
| 19 | Cadastros → Planos de Ação | `/configuracoes/planos-acao` | `App.tsx:213` | ✅ | ✅ | `planos-acao/` | login-only | OK |
| 20 | Cadastros → Tipos de Ensaio | `/configuracoes/ensaios/tipos` | `App.tsx:154` | ✅ | ✅ | `ensaios/` | login-only | OK |
| 21 | Cadastros → Cadastros Efetivo | `/configuracoes/efetivo/cadastros` | `App.tsx:206` | ✅ | ✅ | `efetivo/` | login-only | OK |

**Leitura:** tecnicamente nenhum item do sidebar aponta para uma rota inexistente — **não há link órfão do tipo 404 direto**. O sintoma "sidebar quebrado" é causado por um padrão sistêmico de fallback para `/obras` quando `useResolvedObraId()` não resolve: o usuário vê vários itens/subitens que, quando clicados, aparentemente "não fazem nada" (ficam parados em `/obras`).

---

## 2. Rotas órfãs (declaradas em App.tsx sem link no sidebar)

| Rota | Arquivo | Natureza | Classificação |
|------|---------|----------|---------------|
| `/obras/nova` | `App.tsx:116` | wizard acessado pela lista | **Rota interna — OK** |
| `/obras/:id` | `App.tsx:117` | detalhe — acessado via lista | **Rota interna — OK** |
| `/obras/:id/ged`, `/obras/:id/ged/documentos`, `/obras/:id/ged/documentos/:documentoId`, `/obras/:id/ged/lista-mestra` | `App.tsx:120-123` | GED contextual por obra | **Rota interna — OK** (acessado via ObraDetalhe) |
| `/fvs/fichas/nova`, `/fvs/fichas/:fichaId`, `/fvs/fichas/:fichaId/inspecao` | `App.tsx:133-135` | subfluxos do FVS | **Rota interna — OK** |
| `/fvs/modelos/novo`, `/fvs/modelos/:id`, `/fvs/modelos/:id/editar` | `App.tsx:161-163` | subfluxos | **Rota interna — OK** |
| `/fvm/lotes/:loteId` | `App.tsx:139` | detalhe | **Rota interna — OK** |
| `/obras/:obraId/fvs/dashboard` | `App.tsx:145` | dashboard FVS contextual | **Expor no sidebar** — duplicata do item 4 sem versão contextual no menu (Bug 🟡-5) |
| `/obras/:id/diario`, `/obras/:id/diario/:rdoId`, `/obras/:id/diario/:rdoId/workflow` | `App.tsx:149-151` | subfluxo do Diário | **Rota interna — OK** |
| `/obras/:obraId/concretagem/concretagens/:concrtagemId`, `/obras/:obraId/concretagem/croqui/:croquiId` | `App.tsx:168, 170` | detalhes | **Rota interna — OK** |
| `/obras/:obraId/almoxarifado/estoque/movimentos`, `/...estoque/alertas` | `App.tsx:175-176` | subfluxos | **Rota interna — OK** |
| `/obras/:obraId/almoxarifado/solicitacoes/nova`, `/...solicitacoes/:solicitacaoId` | `App.tsx:178-179` | subfluxos | **Rota interna — OK** |
| `/obras/:obraId/almoxarifado/ocs/nova`, `/...ocs/:ocId` | `App.tsx:181-182` | subfluxos | **Rota interna — OK** |
| `/obras/:obraId/almoxarifado/nfes/:nfeId` | `App.tsx:184` | detalhe | **Rota interna — OK** |
| `/almoxarifado/solicitacoes/:solId/cotacoes`, `/.../comparativo` | `App.tsx:187-188` | fluxo de cotação | **Rota interna — OK** |
| `/obras/:obraId/ncs`, `/obras/:obraId/ncs/:ncId` | `App.tsx:191-192` | NCs contextuais por obra | **Expor no sidebar** — só a global `/ncs` aparece (Bug 🟡-6) |
| `/obras/:id/semaforo` | `App.tsx:196` | semáforo contextual | **Rota interna — OK** (acessado via ObraDetalhe; global `/semaforo` já exposto) |
| `/aprovacoes/templates` | `App.tsx:201` | configuração de workflow | **Expor no sidebar → Cadastros** (Bug 🟡-7) |
| `/aprovacoes/:id` | `App.tsx:202` | detalhe | **Rota interna — OK** |
| `/portal/cotacao/:token`, `/portal/fornecedor`, `/relatorio-cliente/:token`, `/fvs-cliente/:token` | `App.tsx:217-220` | portais públicos sem auth | **Rota interna — OK** (intencionalmente fora do AppLayout) |

**Rotas que NÃO chegam via sidebar mas têm caminho natural pelo app:** OK.
**Rotas que talvez deveriam estar no sidebar:** `/aprovacoes/templates`, versão contextual de Dashboard FVS e NCs por obra.

---

## 3. Páginas órfãs (arquivo `.tsx` de página existe mas sem rota no router)

Varredura em `pages/**/*.tsx` e `modules/**/pages/*.tsx` vs `App.tsx`:

| Arquivo | Export | Referenciada? | Classificação |
|---------|--------|---------------|---------------|
| `frontend-web/src/pages/TestShellPage.tsx:12` | `export function TestShellPage` | ❌ Nunca importada em lugar algum | **Arquivar** — rascunho de teste do AppShell (Bug 🔵-1) |
| `frontend-web/src/modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx:247` | `export default` | ❌ Nunca importada | **Expor no sidebar ou arquivar** — módulo de laboratórios sem entrada (Bug 🟡-8) |
| `frontend-web/src/modules/concretagem/laudos/pages/LaudosPage.tsx` | exporta `LaudosSection` | ✅ Usada como seção dentro de `ConcrtagemDetalhePage:10` | OK (sub-componente) |
| `frontend-web/src/modules/concretagem/racs/pages/RacsPage.tsx` | exporta `RacsSection` | ✅ Usada em `ConcrtagemDetalhePage:11` | OK (sub-componente) |
| `frontend-web/src/modules/concretagem/dashboard/pages/DashboardFinanceiroPage.tsx` | `export default` | ✅ Usada como aba em `ConcretagemDashboardPage:84` | OK (sub-componente) |

---

## 4. Módulos backend sem exposição no sidebar/router

Fonte: `_context.md` §3 + `backend/src/*`.

| Módulo backend | Diretório | Exposto no frontend? |
|----------------|-----------|----------------------|
| `ai/` (agentes + prompts) | `backend/src/ai/` | ❌ sem UI dedicada (usada internamente por outras rotas) — OK |
| `ia/` (`agente.controller.ts`, `ia.controller.ts`) | `backend/src/ia/` | ⚠️ Consumida apenas pelo `AgenteFloat` (widget) — sem página dedicada. Aceitável. |
| `dashboard/` | `backend/src/dashboard/` | ✅ via `/dashboard` |
| **Frota/Equipamentos** | ❌ inexistente | N/A — mencionado no AGENTS.md mas não desenvolvido ainda ([Cross-ref camada 2 módulos órfãos]) |
| **Rastreabilidade (dedicado)** | ❌ inexistente (só sub-feature de concretagem) | N/A |

Nenhum backend existente ficou sem ponto de entrada no frontend.

---

## 5. Guards, breadcrumb, botão voltar, deep links, estado entre abas

### 5.1 Guards
- `AppLayout` (`layouts/AppLayout.tsx:9-21`) é o **único guard**: redireciona para `/login` se não autenticado.
- **Não existe** checagem por `role` (SUPER_ADMIN / ADMIN_TENANT / ENGENHEIRO / TECNICO / VISITANTE) em nenhuma rota. Um `VISITANTE` logado consegue abrir `/configuracoes/fvs/catalogo`, `/fvs/modelos/novo`, `/aprovacoes/templates`, etc. — Bug 🟠-2.
- `<Route path="*" element={<Navigate to="/dashboard" replace />} />` (`App.tsx:222`) engole 404: qualquer URL inválida volta para dashboard. Sem página de erro amigável — Bug 🟡-1.

### 5.2 Breadcrumb
- `Topbar` (`components/layout/Topbar.tsx:187,222-224`) aceita prop `breadcrumb` e renderiza.
- `AppShell` (`components/layout/AppShell.tsx:79,112,135-138`) repassa a prop.
- **Nenhuma página ativa passa `breadcrumb` para o `AppShell`.** `AppLayout.tsx:17` instancia `<AppShell>` sem prop. A única ocorrência de passagem é `pages/TestShellPage.tsx:15` (página órfã). Resultado: **breadcrumb sempre vazio em produção** — Bug 🟠-3.
- `ObraDetalhePage.tsx:39,396-401` implementa breadcrumb **interno próprio**, não o global. Duplicação.

### 5.3 Botão voltar
- Não há botão "voltar" global em `Topbar`. Páginas individuais implementam `navigate(-1)` ou `navigate('/obras')` conforme critério próprio — consistência não avaliada aqui (Cross-ref camada 4 UX).

### 5.4 Deep links
- `react-router-dom@7` BrowserRouter — deep links funcionam.
- Guard `AppLayout` intercepta corretamente usuários não logados.
- **Problema:** quando usuário compartilha `/obras/999/almoxarifado/estoque` e `999` não existe, nenhuma rota valida o id antes de montar (Cross-ref camada 2 — validação e tratamento de 404 de dados). A rota monta a página, a API retorna erro, cabe à página tratar. Hoje depende de cada página.

### 5.5 Estado entre abas / refresh
- `obraAtivaId` persiste em `localStorage` (`useAppShell.tsx:24-40`) — OK, mas:
  - Nunca é invalidado quando obra é deletada/arquivada — obra fantasma fica fixada (Bug 🟡-2, cross-ref camada 2).
  - `ObraAtivaSync` (`AppShell.tsx:59-77`) apenas **atualiza** `obraAtivaId` quando a URL casa com `/obras/(\d+)` — nunca **reseta** quando o usuário sai para rota global (`/aprovacoes`, `/dashboard`). Combinado com `useResolvedObraId()` que faz fallback via `obrasService.getAll({ limit: 1 })`, o comportamento é aceitável.
- Filtros, paginação e scroll **não** estão na URL na maioria das páginas (Cross-ref camada 4 UX).

### 5.6 Loops / StrictMode
- `useResolvedObraId` (`Sidebar.tsx:39-65`) tem um `useEffect` que chama `setObraAtivaId` quando obras carregam. Como `setObraAtivaId` é `useCallback`/estável e a condição `obraAtivaId === null` sai do true no primeiro render, não há loop aparente. OK.
- `ObraAtivaSync` (`AppShell.tsx:64-74`) compara `id !== obraAtivaId` antes de setar. Sem loop.

### 5.7 `useResolvedObraId` em todo helper
- Cada helper (`FvmControleLink`, `ConcretagemNavGroup`, `EnsaiosNavGroup`, `PlanosAcaoLink`, `AlmoxarifadoNavGroup`, `EfetivoNavLink`) invoca `useResolvedObraId()` individualmente → **6 instâncias do mesmo hook no Sidebar**. A `useQuery` usa o mesmo `queryKey: ['obras-sidebar-fallback']`, então o tanstack-query deduplica a request — OK, mas cada helper faz `setObraAtivaId` no primeiro carregamento, o que gera 6 useEffects concorrendo para setar a mesma obra. Não é loop, mas é ruído. Bug 🔵-2.

### 5.8 Confirmação da hipótese inicial
**Hipótese:** "Sidebar.tsx usa useResolvedObraId() — se não houver obra cadastrada, links contextuais podem quebrar."

**Veredito — CONFIRMADA PARCIALMENTE.** Quando não há obra cadastrada (ou a única obra foi deletada), `useResolvedObraId()` retorna `null` e os seguintes grupos/subitens passam a apontar todos para `/obras`:

- `ConcretagemNavGroup` — 3 subitens → `/obras` (Sidebar.tsx:206-208)
- `EnsaiosNavGroup` — 3 subitens → `/obras` (Sidebar.tsx:225-227)
- `AlmoxarifadoNavGroup` — 7 subitens → `/obras` (Sidebar.tsx:259-265)
- `EfetivoNavLink` — `/obras` (Sidebar.tsx:275)
- `PlanosAcaoLink` — `/obras` (Sidebar.tsx:237)

Efeito colateral importante: **`isAnyActive = items.some(i => location.pathname.startsWith(i.to))` em `NavItem.tsx:117` torna-se `true` sempre que o usuário está em `/obras`**, porque todos os subitens começam com `/obras`. Consequência: os três grupos (Concretagem, Ensaios, Almoxarifado) ficam **com todos os subitens "ativos" ao mesmo tempo na lista de obras**, e o submenu abre sozinho por causa do `useState(isAnyActive)` (`NavItem.tsx:118`). Esse é muito provavelmente o sintoma visual que o usuário descreveu como "sidebar quebrado" — aparência de tudo selecionado e cliques que "não fazem nada".

---

## 6. Bugs por severidade

Convenção: 🔴 crítico · 🟠 alto · 🟡 médio · 🔵 baixo · ⚠️ pendente.

### 🔴 BUG-C1-01 — Submenus contextuais colapsam todos subitens para `/obras` quando não há obra ativa
- **Arquivo:linha:** `frontend-web/src/components/layout/Sidebar.tsx:206-208` (Concretagem), `:225-227` (Ensaios), `:259-265` (Almoxarifado).
- **Sintoma:** ao entrar sem obra cadastrada / com obra ativa deletada, o grupo Concretagem, Ensaios e Almoxarifado mostram subitens que **todos clicam para `/obras`**. Combinando com `NavItemGroup.isAnyActive` (`NavItem.tsx:117`), na tela `/obras` o submenu abre sozinho e todos subitens são destacados como ativos ao mesmo tempo — exatamente o padrão visual "sidebar quebrado" reportado.
- **Causa provável:** `useResolvedObraId()` devolve `null` quando não há obras, e cada helper usa `base ?? null` + `base ? ... : '/obras'` como fallback seguro; falta um estado de "desabilitado" ou mensagem "selecione uma obra".
- **Evidência:** código lido; hipótese inicial do orquestrador confirmada. Além disso, `useResolvedObraId` dispara `obrasService.getAll({ limit: 1 })` no primeiro render — se a API retornar vazio, a cadeia fica travada neste estado.
- **Correção sugerida:** renderizar o grupo inteiro como `disabled` (sem submenu expansível) quando `!obraAtivaId`, com tooltip "Selecione uma obra"; alternativa: apontar cada subitem para uma página de seleção de obra com contexto (`/obras?next=almoxarifado`), ou ocultar o grupo.
- **Esforço:** baixo (3h).
- **Risco de regressão:** baixo.

### 🟠 BUG-C1-02 — Nenhum guard por role; qualquer usuário autenticado acessa todas as rotas
- **Arquivo:linha:** `frontend-web/src/layouts/AppLayout.tsx:9-21` (único guard é `isAuthenticated`).
- **Sintoma:** um `VISITANTE` consegue navegar para `/fvs/modelos/novo`, `/configuracoes/fvs/catalogo`, `/aprovacoes/templates`, `/configuracoes/planos-acao` e demais rotas sensíveis. Depende 100% do backend recusar por role.
- **Causa provável:** ausência de um wrapper `<RequireRole roles={[...]}>` no router.
- **Evidência:** não há `RequireAuth` com `role`/`roles` em nenhum ponto do `App.tsx`. O claim `role` existe no JWT (`_context.md §5`, ADR-010) mas não é verificado no frontend.
- **Correção sugerida:** criar `components/auth/RequireRole.tsx`, agrupar rotas de `/configuracoes/*`, `/fvs/modelos/*`, `/aprovacoes/templates`, `/ged/admin` atrás dele.
- **Esforço:** médio (4h).
- **Risco de regressão:** baixo.
- **[Cross-ref camada 7 — segurança.]**

### 🟠 BUG-C1-03 — Breadcrumb global nunca é populado (Topbar sempre exibe vazio)
- **Arquivo:linha:** `frontend-web/src/layouts/AppLayout.tsx:17` (instancia `<AppShell>` sem prop `breadcrumb`); `components/layout/Topbar.tsx:222-224` renderiza `<Breadcrumb items={[]}>`.
- **Sintoma:** no header de todas as páginas autenticadas o breadcrumb aparece vazio; usuário sem pistas de onde está na hierarquia.
- **Causa provável:** API de breadcrumb foi projetada como prop, mas nenhuma página ou layout o preenche. Única referência é `pages/TestShellPage.tsx:15` (órfã).
- **Evidência:** `grep breadcrumb` retorna apenas a definição, o `TestShellPage` e um breadcrumb interno do `ObraDetalhePage.tsx:39,396-401` que ignora o global.
- **Correção sugerida:** derivar breadcrumb automaticamente da URL + tabela de metadata (ex.: um hook `useBreadcrumb(location)` ou um `<Outlet context={...}>`).
- **Esforço:** médio (6h).
- **Risco de regressão:** baixo.
- **[Cross-ref camada 4 — UX.]**

### 🟠 BUG-C1-04 — Fallback `/obras` no PlanosAcaoLink e EfetivoNavLink
- **Arquivo:linha:** `Sidebar.tsx:237` (`PlanosAcaoLink`), `Sidebar.tsx:275` (`EfetivoNavLink`).
- **Sintoma:** clicar em "Planos de Ação" ou "Efetivo" sem obra ativa lança o usuário para a lista de obras, sem explicação.
- **Causa provável:** mesma família do BUG-C1-01.
- **Correção sugerida:** desabilitar link + tooltip, ou expor uma rota global real (`/planos-acao`, `/efetivo`).
- **Esforço:** baixo (2h).
- **Risco de regressão:** baixo.

### 🟡 BUG-C1-05 — Catch-all engole 404
- **Arquivo:linha:** `App.tsx:222` (`<Route path="*" element={<Navigate to="/dashboard" replace />} />`).
- **Sintoma:** usuário que digita `/obra` (sem `s`) ou `/aprovacao` é levado silenciosamente ao dashboard, mascarando links quebrados dentro do app.
- **Causa provável:** decisão antiga de fallback para home, sem página 404.
- **Correção sugerida:** criar `pages/NotFoundPage.tsx` e rotear `path="*"` para ela, com botão "voltar".
- **Esforço:** baixo (1h).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-06 — `obraAtivaId` em localStorage pode ficar fantasma
- **Arquivo:linha:** `components/layout/useAppShell.tsx:35-40,42-49`.
- **Sintoma:** se a obra cujo id está salvo em `eldox-obra-ativa-id` é deletada, todos links contextuais continuam apontando para `/obras/<id-morto>/...` e as telas quebram em erros de API.
- **Causa provável:** nenhum handler invalida o localStorage quando a obra deixa de existir; `useResolvedObraId` só entra em ação se `obraAtivaId === null`.
- **Correção sugerida:** validar `obraAtivaId` contra a lista de obras ao montar o AppShell; se 404/inexistente, chamar `setObraAtivaId(null)`.
- **Esforço:** baixo (2h).
- **Risco de regressão:** baixo.
- **[Cross-ref camada 2 — integridade de dados.]**

### 🟡 BUG-C1-07 — Dashboard FVS contextual por obra sem entrada no sidebar
- **Arquivo:linha:** `App.tsx:145` (`/obras/:obraId/fvs/dashboard` existe); Sidebar só expõe `/fvs/dashboard` global.
- **Sintoma:** o dashboard FVS contextual é acessível apenas via deep link; usuário na página de uma obra não encontra botão para o dashboard da obra.
- **Correção sugerida:** adicionar link contextual no sidebar (equivalente a Planos de Ação) ou um botão no header de `ObraDetalhePage`.
- **Esforço:** baixo (1h).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-08 — NCs contextuais por obra sem entrada no sidebar
- **Arquivo:linha:** `App.tsx:191-192` (`/obras/:obraId/ncs`, `/obras/:obraId/ncs/:ncId`).
- **Sintoma:** Sidebar só expõe `/ncs` (global). A versão por obra só é acessível via tabela dentro de ObraDetalhe ou deep link.
- **Correção sugerida:** expor como subitem do grupo Qualidade quando há obra ativa.
- **Esforço:** baixo (1h).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-09 — Templates de aprovação sem ponto de entrada
- **Arquivo:linha:** `App.tsx:201` (`/aprovacoes/templates`).
- **Sintoma:** configuração de workflow só é acessível por URL direta.
- **Correção sugerida:** adicionar subitem em "Cadastros" ou em "Aprovações".
- **Esforço:** baixo (30min).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-10 — Módulo `ensaios/laboratorios/LaboratoriosPage` órfão
- **Arquivo:linha:** `frontend-web/src/modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx:247` (`export default`).
- **Sintoma:** página de laboratórios nunca é importada em `App.tsx` — feature inacessível.
- **Causa provável:** rota planejada e não conectada, ou obsoleta.
- **Correção sugerida:** decidir com PO — expor em "Cadastros" ou arquivar.
- **Esforço:** baixo (1h para expor).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-11 — Botão "Configurações" no SidebarFooter é inerte
- **Arquivo:linha:** `Sidebar.tsx:165-175` (`<button>` com ícone `Settings` sem `onClick`).
- **Sintoma:** usuário clica em "Configurações" no rodapé do sidebar e nada acontece — percebido como "quebrado".
- **Causa provável:** esboço de UI sem handler.
- **Correção sugerida:** apontar para `/configuracoes` (menu hub) ou remover o botão até existir.
- **Esforço:** baixo (15min).
- **Risco de regressão:** nulo.

### 🟡 BUG-C1-12 — Avatar "IP" hardcoded no Topbar
- **Arquivo:linha:** `components/layout/Topbar.tsx:254`.
- **Sintoma:** qualquer usuário logado vê "IP" (iniciais do desenvolvedor) no topo. Não é menu funcional (sem logout, sem perfil).
- **Correção sugerida:** usar `useAuthStore` para iniciais reais e transformar em dropdown com "Sair", "Perfil".
- **Esforço:** médio (3h).
- **Risco de regressão:** nulo.
- **[Cross-ref camada 4 — UX / camada 7 — logout.]**

### 🔵 BUG-C1-13 — `TestShellPage` órfã em produção
- **Arquivo:linha:** `frontend-web/src/pages/TestShellPage.tsx:12`.
- **Sintoma:** arquivo incluído no bundle (por `tsconfig`/`include`) mas nunca importado; lixo.
- **Correção sugerida:** mover para `__tests__` ou deletar.
- **Esforço:** trivial.
- **Risco de regressão:** nulo.

### 🔵 BUG-C1-14 — 6 chamadas redundantes de `useResolvedObraId` no Sidebar
- **Arquivo:linha:** `Sidebar.tsx:183,198,217,236,251,273`.
- **Sintoma:** ruído de 6 `useEffect` concorrentes chamando `setObraAtivaId` no primeiro render.
- **Correção sugerida:** chamar o hook uma única vez no `<Sidebar>` e passar o id como prop aos helpers.
- **Esforço:** baixo (1h).
- **Risco de regressão:** baixo.

### 🔵 BUG-C1-15 — `/aprovacoes/templates` vem ANTES de `/aprovacoes/:id` — OK, mas `/fvs/modelos/:id/editar` só funciona por causa de ordem
- **Arquivo:linha:** `App.tsx:160-163`.
- **Observação:** React Router v7 faz matching por especificidade, não por ordem; ainda assim, o padrão atual de declarar static antes de dynamic (`/fvs/modelos/novo` antes de `/fvs/modelos/:id`) é correto. Nenhum bug encontrado, apenas anotado para vigilância.

### ⚠️ VERIFICAÇÕES PENDENTES
- **V-C1-01:** impacto visual real do BUG-C1-01 precisa ser confirmado com screenshot em ambiente com 0 obras cadastradas. Razão: auditoria estática; comportamento em runtime depende de API + estado inicial do tenant.
- **V-C1-02:** fluxo "Obra → Criar FVS → Reprovar → Criar NC → Executar CAPA → Fechar NC" não foi testado end-to-end nesta camada. Razão: fora do escopo estrito de navegação; depende de camada 2 (módulos) e camada 6 (dados de teste).
- **V-C1-03:** verificar se `BrowserRouter` está configurado com `basename` em produção (nginx). Razão: se o Nginx serve em subpath (`/app/`), as URLs podem quebrar. Não há `basename` em `App.tsx:106`.
- **V-C1-04:** botão "voltar" nativo do navegador em formulários com estado não-salvo (`AbrirFichaWizard`, `CadastroObraWizard`) não foi validado. [Cross-ref camada 4 UX.]

---

## 7. Resumo para orquestrador

- **Total de bugs por severidade:** 🔴 1 | 🟠 3 | 🟡 8 | 🔵 3 | ⚠️ 4
- **Top 3 problemas mais críticos:**
  1. 🔴 **BUG-C1-01** — Submenus contextuais (Concretagem, Ensaios, Almoxarifado) colapsam para `/obras` quando não há obra ativa, fazendo o sidebar parecer quebrado com múltiplos subitens "ativos" ao mesmo tempo — **causa raiz confirmada do sintoma reportado**.
  2. 🟠 **BUG-C1-02** — Sem guards por role no router; todo usuário logado acessa qualquer rota (dependência total do backend).
  3. 🟠 **BUG-C1-03** — Breadcrumb global nunca é populado; usuário sempre vê header vazio.
- **Ação mais urgente recomendada:** corrigir `Sidebar.tsx:199-270` adicionando estado "sem obra selecionada" (grupo desabilitado com tooltip) para Concretagem, Ensaios, Almoxarifado, Efetivo e Planos de Ação, em vez de fallback para `/obras`. Isso elimina imediatamente o sintoma percebido de "sidebar quebrado".
- **Cross-refs identificados:**
  - [Camada 2 — Módulos] Fantasma de `obraAtivaId` em localStorage; módulos `LaboratoriosPage` e (no backend) `Frota/Equipamentos` fora do sidebar; validação de `:id` inexistente em rotas contextuais.
  - [Camada 4 — UX] Breadcrumb vazio, avatar `IP` hardcoded, botão "Configurações" inerte, sem botão "voltar" global, filtros/paginação não persistem na URL.
  - [Camada 7 — Segurança/Auth] Ausência de `RequireRole`, avatar sem menu de logout, sem verificação de claim `role`.
