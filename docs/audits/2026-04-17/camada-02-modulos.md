# Camada 2 — Integridade dos Módulos

**Auditor:** auditor-camada-02-modulos
**Data:** 2026-04-17
**Escopo:** Eldox v3 (`/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3`)
**Mobile:** N/A — mobile não desenvolvido nesta fase.

---

## 1. Matriz de Módulos

Legenda: ✅ presente · ⚠️ parcial · ❌ ausente · — N/A

| # | Módulo | Prisma (schema + migrations) | Backend (NestJS) | Web (React) | Sidebar | Docs | Status |
|---|--------|------------------------------|------------------|-------------|---------|------|--------|
| 1 | Obras | ✅ `Obra`, `ObraLocal`, `ObraTipo*`, `ObraNivelConfig`, `ObraQualityConfig` (schema.prisma:146-307) | ✅ `obras.controller.ts` 22 endpoints | ✅ `pages/obras/*` (List, Wizard, Detalhe) | ✅ `/obras` | ✅ | OK |
| 2 | FVS (Inspeção + Modelos + Catálogo) | ✅ migrations: `fvs_catalogo`, `fvs_inspecao`, `fvs_sprint3_ro_parecer`, `fvs_sprint4a_modelos`, `fvs_sprint4b_nc_ciclo`, `fvs_sprint_c` | ✅ 6 controllers (inspecao, modelos, catalogo, ro, dashboard, cliente) + ia-service | ✅ `modules/fvs/*` (catalogo, inspecao, modelos, dashboard, planos-acao, cliente, relatorios) | ✅ Grupo "Fichas de Inspeções" + "Dashboard FVS" + Cadastros | ✅ | OK |
| 3 | FVM (Materiais) | ✅ `20260414000000_fvm_module` (10+ tabelas) + `20260414000002_fvm_quarentena_evidencia` + `20260416000010_fvm_ensaios` | ✅ 5 controllers (catalogo, fornecedores, recebimento, evidencias, ensaios-fvm) | ✅ `modules/fvm/*` (catalogo, fornecedores, grade, relatorios, dashboard) | ✅ "Controle de Materiais", "Catálogo FVM", "Fornecedores" | ✅ | OK |
| 4 | NC / CAPA | ✅ `NaoConformidade` (schema.prisma:597) + `fvs_nao_conformidades` + `fvs_nc_tratamentos` + `fvm_nao_conformidades` | ✅ `ncs.controller.ts` (7 endpoints) + `planos-acao` (pa + config) | ✅ `modules/ncs/*`, `modules/fvs/planos-acao/*` | ✅ "Não conformidades" + "Planos de Ação" + "Planos de Ação (Configuração)" | ⚠️ | OK c/ ressalva |
| 5 | Concretagem | ✅ `ConcretagemCroqui` + migrations `sprint8_concretagem` (betonadas/concretagens, caminhões, CPs, fotos), `concretagem_gaps2`, `concretagem_consultegeo_gaps` | ✅ 8 controllers (concretagens, caminhoes, cps, racs, laudos, croqui, dashboard, portal-fornecedor) | ✅ `modules/concretagem/*` (concretagens, croqui, dashboard, laudos, racs) | ✅ Grupo "Concretagem" (Dashboard/Concretagens/Croqui) | ⚠️ | OK c/ ressalva |
| 6 | Diário / RDO | ✅ `Rdo`, `RdoClima`, `RdoMaoDeObra`, `RdoEquipamento`, `RdoAtividade`, `RdoOcorrencia`, `RdoChecklistItem`, `RdoFoto`, `RdoAssinatura`, `RdoSugestaoIa`, `RdoLogEdicao` (schema.prisma:309-697) | ✅ `rdo.controller.ts` (32 endpoints) + `rdo-cliente.controller.ts` + `whatsapp.controller.ts` + processor IA | ✅ `modules/diario/*` (Home, List, Form, Workflow, RelatorioCliente) | ✅ "Diário de Obra" | ✅ | OK |
| 7 | Ensaios Laboratoriais | ✅ migrations `ensaio_tipos`, `ensaio_laboratorial`, `ensaio_alertas` | ✅ 6 controllers (ensaios, tipos, laboratorios, revisoes, dashboard, ia) + alertas BullMQ | ✅ `modules/ensaios/*` (dashboard, laboratoriais, laboratorios, revisoes, tipos) | ✅ Grupo "Ensaios" + "Tipos de Ensaio" | ✅ | OK |
| 8 | GED | ✅ `20260407000000_ged_module` (15 tabelas) | ✅ `ged.controller.ts` (18 endpoints) + workers (OCR, qrcode, pdf) + workflow + pastas + storage | ✅ `pages/ged/*` (Admin, Hub, Documentos, Detalhe, ListaMestra) | ⚠️ só `/ged/admin` exposto; hub/lista-mestra só via `/obras/:id/ged` | ✅ | OK c/ ressalva |
| 9 | Efetivo | ✅ `EmpresaEfetivo`, `FuncaoEfetivo`, `RegistroEfetivo`, `ItemEfetivo` (schema.prisma:793-870) + migration `efetivo_module` (7 tabelas: audit, padroes, alertas) | ✅ `efetivo.controller.ts` (6 endpoints) + `cadastros.controller.ts` (9 endpoints) + service IA | ✅ `modules/efetivo/pages/` (EfetivoListPage, CadastrosPage) | ✅ "Efetivo" + "Cadastros Efetivo" | ⚠️ | OK c/ ressalva |
| 10 | Aprovações / Workflow | ✅ `WorkflowTemplate`, `WorkflowTemplateEtapa`, `AprovacaoInstancia`, `AprovacaoDecisao` (schema.prisma:698-792) | ✅ `aprovacoes.controller.ts` (10 endpoints) + notifier + escalacao.processor | ✅ `modules/aprovacoes/pages/` (List, Detalhe, Templates) | ⚠️ só `/aprovacoes`; `/aprovacoes/templates` sem link no sidebar | ⚠️ | OK c/ ressalva |
| 11 | Almoxarifado | ✅ `20260416000001_almoxarifado_init` (20 tabelas) + `sinapi_variantes` + `cotacoes_completo` | ✅ 11 controllers (estoque, solicitacao, compras, cotacoes, portal-fornecedor, nfe, planejamento, orcamento, sinapi, variantes-ia, ia) | ✅ `modules/almoxarifado/*` (dashboard, estoque, solicitacao, compras, nfe, planejamento, cotacoes, ia) | ✅ Grupo "Almoxarifado" (7 sub-links) | ✅ | OK |
| 12 | Semáforo PBQP-H | ✅ `SemaforoPbqphCache` (schema.prisma:554) | ✅ `semaforo.controller.ts` (3 endpoints: list, por obra, recalcular) | ✅ `modules/semaforo/pages/SemaforoPage.tsx` | ✅ `/semaforo` | ⚠️ | OK |
| 13 | Dashboard (home) | — (apenas agrega) | ✅ `dashboard.controller.ts` (4 endpoints) | ✅ `pages/DashboardPage.tsx` + `modules/dashboard/*` (widgets, grid, registry) | ✅ `/dashboard` | ⚠️ | OK |
| 14 | EldoX.IA (assistente) | ✅ `20260407000001_eldoxia_mvp` (5 tabelas: ia_conversas, ia_mensagens, ia_acoes_pendentes, ia_uso_tokens, ia_memoria) + `ai_usage_log` | ✅ `ia.controller.ts` (`POST /api/v1/ia/chat`) + `agente.controller.ts` (IA FVS: gerar-catalogo/gerar-modelo/assistente) + `src/ai/agents/*` (12 agentes: 5 FVS + 7 RDO) | ✅ `components/agente/AgenteFloat.tsx` (widget flutuante, montado em `AppShell.tsx:127`) | ⚠️ sem link dedicado; acesso via widget flutuante apenas | ⚠️ | OK c/ ressalva |
| 15 | Portal (público) | — (usa tabelas existentes — tokens em `fornecedor_portal_tokens` migration `concretagem_gaps2`) | ✅ `portal-fornecedor.controller.ts` (almoxarifado + concretagem) + `fvs-cliente.controller.ts` + `rdo-cliente.controller.ts` | ✅ `modules/portal/PortalCotacaoPage.tsx` + `PortalFornecedorPage.tsx` + `RelatorioClientePage` + `FvsRelatorioClientePage` | — (público) | ⚠️ | OK |
| **— Gestão de Frota / Equipamentos** | ❌ | ❌ | ❌ | ❌ | ❌ | **AUSENTE** |
| **— Rastreabilidade (módulo dedicado)** | ⚠️ só sub-feature (Croqui de Concretagem + `RdoAtividade.quantidade/localId`) | ⚠️ subset via concretagem/croqui.controller.ts e diario | ⚠️ só `CroquiRastreabilidadePage` | — | ⚠️ | **SUB-FEATURE** |
| **— Usuários / Permissões / Tenants** | ✅ `Tenant`, `Usuario`, `Plano` no schema | ⚠️ apenas `AuthModule` (login); sem endpoints de CRUD de usuários / convites / papéis | ❌ sem telas | ❌ | ❌ | **ÓRFÃO BACKEND-ONLY** |

---

## 2. Bugs / Achados por severidade

### 🔴 Críticos (bloqueiam uso ou geram dados inconsistentes)

#### 🔴 BUG-M02-001 — Módulo "Gestão de Frota / Equipamentos" declarado mas inexistente
- **Arquivo:** N/A (ausência)
- **Sintoma:** Skill `camada-02-modulos.md` (linha 16) e `_context.md` (linha 108-109) declaram módulo oficial; `schema.prisma` e `backend/src/` não têm nenhuma tabela ou controller de frota. Busca `grep -i "frota|fleet|veiculo"` em todo o backend retorna 0 matches de negócio (apenas `RdoEquipamento` como campo de RDO).
- **Causa:** Módulo planejado mas nunca implementado.
- **Evidência:** `backend/prisma/schema.prisma` (32 models, nenhum relacionado a veículos/frota); `backend/src/` (19 módulos, sem pasta `frota`).
- **Correção sugerida:** Decidir: (a) remover do escopo oficial em AGENTS.md / skill; ou (b) abrir sprint para implementar com tabelas `Veiculo`, `Equipamento`, `ManutencaoPreventiva`, `AlocacaoObra`.
- **Esforço:** Decisão de produto (pequena); implementação (2 sprints).
- **Risco:** Alto se houver clientes PBQP-H Nível A esperando controle de equipamentos calibrados.

#### 🔴 BUG-M02-002 — Módulo "Rastreabilidade do Concreto (NBR 12655)" não é módulo próprio
- **Arquivo:** `backend/prisma/schema.prisma:531-548` (`ConcretagemCroqui`) + `backend/src/concretagem/croqui/croqui.controller.ts`
- **Sintoma:** Skill descreve "Rastreabilidade do Concreto — NBR 12655" como módulo independente com vínculo "traço ↔ caminhão ↔ horário ↔ local aplicado ↔ CPs ↔ resultados". O código entrega isso como sub-feature de Concretagem (Croqui) + tabelas `caminhoes_concreto`, `corpos_de_prova`, `betonadas` (renomeado `concretagens`). Não há entidade dedicada "Rastreabilidade" nem página com linha do tempo completa.
- **Causa:** Implementação funcional (dados existem) mas não foi criado um "módulo de rastreabilidade" unificado; a rastreabilidade é montada ad-hoc a partir de Concretagem.
- **Evidência:** `frontend-web/src/App.tsx:169-170` (rotas `/concretagem/croqui` sob Concretagem, sem rota `/rastreabilidade`); sidebar `Sidebar.tsx:196-213` grupo "Concretagem" com `Croqui` mas sem `Rastreabilidade`.
- **Correção sugerida:** Ou (a) remover "Rastreabilidade" da lista oficial (fica como subcapítulo de Concretagem); ou (b) criar página `/rastreabilidade` global com filtros traço/caminhão/lote/CP e linha do tempo NBR 12655.
- **Esforço:** Pequeno (documental) ou médio (view + endpoint agregador).
- **Risco:** Auditoria externa PBQP-H pode cobrar rastreabilidade como capítulo separado.

#### 🔴 BUG-M02-003 — NaoConformidade sem relações Prisma (FKs apenas lógicas)
- **Arquivo:** `backend/prisma/schema.prisma:597-632`
- **Sintoma:** Campos `caminhaoId`, `cpId`, `fvsFichaId`, `fvmLoteId`, `ensaioId`, `obraId`, `responsavelId`, `abertaPor` são `Int?` ou `Int` **sem `@relation`** — Prisma não cria FK real, não há integridade referencial garantida a nível de ORM, e não há cascade. A mesma inconsistência em `ConcretagemCroqui` (obraId sem @relation), `SemaforoPbqphCache` (obraId sem @relation), `EmpresaEfetivo`, etc.
- **Causa:** Decisão (implícita) de usar FK só no SQL, não no Prisma. Problema: não há `ALTER TABLE ... ADD CONSTRAINT FOREIGN KEY` em nenhuma migration buscada.
- **Evidência:** `schema.prisma:609-613` (5 Int? sem relation); grep `CONSTRAINT.*FOREIGN KEY` em `backend/prisma/migrations/20260415000003_nao_conformidades/migration.sql` precisa confirmação — [Cross-ref camada 3 / DB].
- **Correção sugerida:** Declarar `@relation` em Prisma OU garantir FK via SQL puro em migration. Mínimo: `obraId` → `Obra`.
- **Esforço:** Médio (mudança de schema + migration aditiva).
- **Risco:** Alto — deletar Obra pode deixar NCs órfãs sem error do banco.

### 🟠 Altos

#### 🟠 BUG-M02-010 — Tela `/aprovacoes/templates` registrada mas sem link no sidebar
- **Arquivo:** `frontend-web/src/App.tsx:201` (rota) vs `frontend-web/src/components/layout/Sidebar.tsx:394-401` (só `/aprovacoes`)
- **Sintoma:** Página `TemplatesPage` (configuração de workflows) existe e tem rota, mas não há link na sidebar. Usuário só chega digitando URL.
- **Causa:** Sidebar não foi atualizado após criar a página de templates no módulo de aprovações.
- **Correção sugerida:** Adicionar item no grupo "Operacional" / "Cadastros" apontando para `/aprovacoes/templates`.
- **Esforço:** Mínimo (1 linha).
- **Risco:** Baixo.

#### 🟠 BUG-M02-011 — Página `/fvs/fichas` e `/fvs/modelos` sem link direto no sidebar
- **Arquivo:** `frontend-web/src/components/layout/Sidebar.tsx:332-341`
- **Sintoma:** O grupo "Fichas de Inspeções" aponta para `/fvs/fichas` e `/fvs/modelos`. Mas a rota `/fvs/fichas/nova` (AbrirFichaWizard) e `/fvs/modelos/novo` só são acessíveis via botões dentro das páginas-pai — aceitável. Porém, a label "Templates" (Sidebar.tsx:338) é ambígua para usuário leigo (seria melhor "Modelos de FVS").
- **Causa:** Terminologia inconsistente (Template vs Modelo — no backend a entidade chama `fvs_modelos`).
- **Correção sugerida:** Renomear label para "Modelos de FVS".
- **Esforço:** Mínimo.
- **Risco:** Baixo.

#### 🟠 BUG-M02-012 — Módulos Concretagem/Ensaios/Almoxarifado/Efetivo/Planos de Ação do sidebar apontam para `/obras` quando não há obra ativa
- **Arquivo:** `frontend-web/src/components/layout/Sidebar.tsx:197-270` (`ConcretagemNavGroup`, `EnsaiosNavGroup`, `AlmoxarifadoNavGroup`, `EfetivoNavLink`, `PlanosAcaoLink`)
- **Sintoma:** Se o tenant não tem nenhuma obra cadastrada, `useResolvedObraId()` retorna null e TODOS os links desses grupos (~15 links) apontam para `/obras`. Usuário clica "Estoque" e é levado à lista de obras sem feedback explicativo.
- **Causa:** Fallback silencioso. A primeira obra é selecionada automaticamente (Sidebar.tsx:51-59), mas em tenant novo não há obra.
- **Evidência:** `Sidebar.tsx:206-208`, `258-265`, `218-230`.
- **Correção sugerida:** (a) mostrar link disabled + tooltip "Cadastre uma obra primeiro"; (b) redirecionar para wizard de nova obra.
- **Esforço:** Pequeno (lógica de disabled no NavItem).
- **Risco:** Baixo.
- **[Cross-ref camada 1 — UX/Sidebar]**

#### 🟠 BUG-M02-013 — Sistema de Usuários/Permissões/Tenants sem CRUD no backend
- **Arquivo:** `backend/src/auth/*` (apenas login); `backend/src/` não tem pasta `usuarios/` nem `tenants/` nem `planos/`
- **Sintoma:** Tabelas `Tenant` (schema.prisma:26), `Usuario` (55), `Plano` (13) existem. Não há endpoints para: criar usuário, editar papel, convidar, listar usuários do tenant, trocar senha, gerenciar planos, admin de tenants.
- **Causa:** Módulo ainda não construído — registrado em MEMORY.md como "Permissões Granulares — Pendente (só roles fixos)".
- **Correção sugerida:** Criar módulo `users/` + `admin/` com CRUD + convite por e-mail. [Cross-ref MEMORY: `project_permissions_system_pending.md`]
- **Esforço:** Médio (1-2 sprints).
- **Risco:** Alto — sem isso não dá para liberar o SaaS para mais de um usuário por tenant em autoatendimento.

### 🟡 Médios

#### 🟡 BUG-M02-020 — CRUD de "Ficha FVS" sem bulk-delete, sem export global, sem filtros persistentes na URL
- **Arquivo:** `backend/src/fvs/inspecao/inspecao.controller.ts:48-100`
- **Sintoma:** Só endpoints unitários (POST, PATCH, DELETE por id). `registros/bulk` (PUT/POST) existe mas só para registros dentro de uma ficha; não há ação em massa sobre fichas.
- **Correção sugerida:** Adicionar `DELETE /fichas/bulk` (arquivar N fichas) e `GET /fichas/export` (xlsx global). Filtros na URL via querystring já parecem existir (lista aceita filtros).
- **Esforço:** Médio.
- **Risco:** Médio.

#### 🟡 BUG-M02-021 — `ensaios/ensaios.controller.ts` só tem 3 endpoints (GET list, POST create, GET :id) — sem UPDATE ou DELETE
- **Arquivo:** `backend/src/ensaios/ensaios.controller.ts:23-53`
- **Sintoma:** CRUD incompleto para "ensaio" (entidade-mãe programada). A atualização vem via `revisoes.controller.ts` (POST revisão) — aceitável para rastreabilidade, mas não há endpoint de soft-delete ou correção simples.
- **Correção sugerida:** Clarificar na spec se é intencional (imutável) ou adicionar PATCH limitado.
- **Esforço:** Pequeno.
- **Risco:** Baixo.

#### 🟡 BUG-M02-022 — Semáforo sem endpoint de histórico / export
- **Arquivo:** `backend/src/semaforo/semaforo.controller.ts:18-47`
- **Sintoma:** 3 endpoints apenas (list, por obra, recalcular). Sem histórico temporal de semáforo (necessário para tendência PBQP-H) nem export.
- **Correção sugerida:** Adicionar `GET /obras/:id/semaforo/historico?from=&to=` e export XLSX.
- **Esforço:** Médio.
- **Risco:** Médio (auditoria PBQP-H pede evolução temporal).

#### 🟡 BUG-M02-023 — GED: rotas internas `/obras/:id/ged/*` só acessíveis pela detalhe da obra (sem link direto no sidebar)
- **Arquivo:** `frontend-web/src/App.tsx:120-126` vs `Sidebar.tsx:387-393` (só `/ged/admin`)
- **Sintoma:** Para o usuário chegar em "Documentos" de uma obra, ele precisa entrar no Detalhe da Obra e navegar. Não há link "GED da obra ativa" no sidebar (seria natural pelo padrão `useResolvedObraId` já usado em outros grupos).
- **Correção sugerida:** Adicionar `GedNavGroup` espelhando `AlmoxarifadoNavGroup` com `Hub/Documentos/Lista-Mestra`.
- **Esforço:** Pequeno.
- **Risco:** Baixo (usabilidade).

#### 🟡 BUG-M02-024 — EldoX.IA sem página dedicada nem cadastro de memória/configurações
- **Arquivo:** `backend/src/ia/ia.controller.ts:16` (só `POST /chat`) + frontend `components/agente/AgenteFloat.tsx`
- **Sintoma:** A tabela `ia_memoria` e `ia_acoes_pendentes` existe na migration `eldoxia_mvp`, mas não há tela para listar memórias, ver ações pendentes ou administrar. O widget flutuante só permite chat.
- **Correção sugerida:** Criar `pages/eldoxia/*` (Conversas, Memória, Ações Pendentes, Uso de Tokens) para SUPER_ADMIN.
- **Esforço:** Médio.
- **Risco:** Médio.

#### 🟡 BUG-M02-025 — Dashboard não consome EldoX.IA (ia_conversas/ia_uso_tokens sem widget)
- **Arquivo:** `backend/src/dashboard/dashboard.controller.ts:11-37`
- **Sintoma:** Endpoint `dashboard/summary` e `dashboard/feed` mas sem widget para uso de IA / custo / saúde dos agentes.
- **Correção sugerida:** Adicionar widget "IA Uso" no registry.
- **Esforço:** Pequeno.
- **Risco:** Baixo.

### 🔵 Baixos / Cosméticos

#### 🔵 BUG-M02-030 — Concretagem usa dois nomes para a mesma entidade (`betonadas` → renomeado `concretagens`)
- **Arquivo:** migrations `20260416100000_rename_betonadas_to_concretagens` e `20260416100001_rename_fk_constraints`
- **Sintoma:** Histórico mostra renomeação. Verificar se restou referência antiga em código/docs. Não encontrada no audit rápido.
- **Correção sugerida:** Grep por `betonadas?` em código e remover se restar. [Cross-ref camada 3 — DB].
- **Esforço:** Mínimo.
- **Risco:** Baixo.

#### 🔵 BUG-M02-031 — `AiModule` não existe (pasta `backend/src/ai/` contém só agents e prompts — biblioteca, sem controllers próprios)
- **Arquivo:** `backend/src/ai/` (agents/fvs, agents/rdo, prompts/rdo)
- **Sintoma:** Contexto declara `ai/ + ia/` como backend do EldoX.IA. Na prática `ai/` é biblioteca de helpers importada por `fvs/` e `diario/`. O app-module.ts importa só `IaModule` (de `ia/`).
- **Correção sugerida:** Clarificar no `_context.md` / AGENTS.md que `ai/` é biblioteca (não módulo NestJS).
- **Esforço:** Mínimo (doc).
- **Risco:** Nenhum.

#### 🔵 BUG-M02-032 — Labels de sidebar têm "Templates" (FVS) e "Cadastros" (múltiplos) — nomenclatura inconsistente
- **Arquivo:** `Sidebar.tsx:338, 407-417`
- **Sintoma:** "Templates" usado só em FVS; demais módulos usam "Modelos" ou "Cadastros". Gera fricção cognitiva.
- **Correção sugerida:** Padronizar "Modelos de FVS".
- **Esforço:** Mínimo.
- **Risco:** Nenhum (cosmético).

#### 🔵 BUG-M02-033 — Módulo Portal sem docs explícitas sobre quais tokens são aceitos
- **Arquivo:** `backend/prisma/migrations/20260416000020_concretagem_gaps2/migration.sql:28` (`fornecedor_portal_tokens`)
- **Sintoma:** Existem 4 portais públicos (`/portal/cotacao/:token`, `/portal/fornecedor`, `/relatorio-cliente/:token`, `/fvs-cliente/:token`) mas não há tabela unificada de tokens — cada um parece ter sua tabela (`fornecedor_portal_tokens`, tokens em `fvs_fichas`, tokens em `rdos`).
- **Correção sugerida:** Unificar tabela `portal_tokens` com tipo discriminador.
- **Esforço:** Médio.
- **Risco:** Baixo (mas facilita RLS e expiração).

---

## 3. CRUDs incompletos — sumário

| Módulo | List | Create | Read | Update | Delete | Bulk | Export | Observação |
|--------|------|--------|------|--------|--------|------|--------|------------|
| Obras | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ locais em massa | ❌ | ok |
| FVS Fichas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ registros | ✅ pdf/xlsx | sem bulk fichas |
| FVS Modelos | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| FVS Catálogo | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ ordem | ❌ | ok |
| FVM Catálogo | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| FVM Fornecedores | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| FVM Recebimento | ✅ grade | ✅ lote | ✅ | ✅ registros | ❌ soft | ✅ | ❌ | ok |
| NC | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | sem bulk |
| Planos de Ação | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| Concretagens | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| Concretagem Caminhões | — | ✅ | — | ✅ | ⚠️ reject | ❌ | ❌ | sem list/delete real |
| Croqui | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ok |
| CPs | ⚠️ por concretagem | ✅ | ❌ por id | ✅ ruptura | ❌ | ❌ | ❌ | sem GET /cps/:id |
| Laudos | ✅ | ✅ | ✅ | ⚠️ aprovar/reprovar | ❌ | ❌ | ❌ | ok |
| RACs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | sem delete |
| RDO | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ seções | ✅ xls/pdf | ok |
| Ensaios Lab | ✅ | ✅ | ✅ | ⚠️ via revisão | ❌ | ❌ | ❌ | sem update direto |
| Ensaios Tipos | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ seed | ❌ | ok |
| Ensaios Laboratorios | ✅ | ✅ | ❌ | ⚠️ toggle-ativo | ❌ | ❌ | ❌ | CRUD incompleto |
| GED Documentos | ✅ | ✅ | ✅ | ❌ update direto | ❌ | ❌ | ❌ | imutável (versionado) — ok por spec |
| Efetivo (Registro) | ✅ | ✅ | ✅ | ✅ item | ❌ | ⚠️ fechar | ❌ | sem DELETE de registro |
| Efetivo (Cadastros) | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | sem GET por id |
| Aprovações | ✅ | ✅ | ✅ | ✅ decidir | ⚠️ cancelar | ❌ | ❌ | ok |
| Aprovações Templates | ❌ sem controller dedicado | — | — | — | — | — | — | **ÓRFÃO FRONTEND** — página existe mas não há endpoints específicos |
| Almoxarifado Estoque | ✅ | ✅ mov | ✅ | ⚠️ alertas | ❌ | ⚠️ ler-todos | ❌ | ok |
| Almoxarifado Solicitação | ✅ | ✅ | ✅ | ✅ submeter/aprovar/cancelar | ❌ hard | ❌ | ❌ | ok |
| Almoxarifado OCs | ✅ | ✅ | ✅ | ✅ confirmar/emitir/receber/cancelar | ❌ | ❌ | ❌ | ok |
| Almoxarifado NFe | ✅ | ✅ webhook | ✅ | ✅ vincular/aceitar/rejeitar | ❌ | ❌ | ❌ | ok |
| Semáforo | ✅ | ✅ recalcular | ✅ | ❌ | ❌ | ❌ | ❌ | cache — ok |
| Dashboard | ✅ widgets | ✅ layout | — | ✅ layout | — | — | — | ok |
| IA Chat | — | ✅ chat | — | — | — | — | — | endpoint único |
| Usuários / Tenants | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **AUSENTE** |
| Frota | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **AUSENTE** |

---

## 4. Relações entre módulos — verificação

| Relação | Existe? | Evidência |
|---------|--------|-----------|
| FVS → Obra | ✅ lógica | `fvs_fichas.obra_id` (migration 20260408000001) — FK física não confirmada |
| FVS → Modelo | ✅ | `fvs_modelos` (20260410000000) + `obra_modelo_fvs` |
| FVS → Serviço (catálogo) | ✅ | `fvs_ficha_servicos` + `fvs_catalogo_servicos` |
| NC → FVS (ficha) | ✅ lógica (`fvsFichaId Int?`) | schema.prisma:611 — **sem `@relation`** 🔴 |
| NC → Concretagem (caminhão/CP) | ✅ lógica (`caminhaoId Int?`, `cpId Int?`) | schema.prisma:609-610 — **sem `@relation`** 🔴 |
| NC → FVM (lote) | ✅ lógica (`fvmLoteId`) | schema.prisma:612 — **sem `@relation`** 🔴 |
| NC → Ensaio | ✅ lógica (`ensaioId`) | schema.prisma:613 — **sem `@relation`** 🔴 |
| NC → Plano de Ação (CAPA) | ⚠️ via `pa_plano_acao.origem_tipo/origem_id` | migration `add_planos_acao:62` — polimórfico |
| Concretagem → Obra | ✅ | `concretagens.obra_id` (migration sprint8) |
| Concretagem → Traço | ⚠️ | `concretagens` tem `traco` como campo String, sem entidade Traco |
| Concretagem → Caminhão → CP | ✅ | `caminhoes_concreto.concretagem_id`, `corpos_de_prova.caminhao_id` |
| Rdo → Obra → Efetivo do dia | ✅ | `Rdo.obraId` (schema.prisma:312) + `RdoMaoDeObra.rdoId` |
| Rdo → Sync Efetivo | ✅ | endpoint `POST /rdos/:id/sincronizar-efetivo` (rdo.controller.ts:560) |
| Efetivo → Funcao (CBO) | ✅ | `ItemEfetivo.funcaoId` + `FuncaoEfetivo` |
| Efetivo → Funcionário em 2 obras no mesmo dia | ⚠️ sem validação evidente | migration `efetivo_module` tem `efetivo_alertas` mas sem unique |
| GED → Obra + Módulo + Versão | ✅ | migration ged_module (15 tabelas) |
| EldoX.IA → Contexto de Obra | ⚠️ | `ia_conversas` tem tenant_id mas obra_id não confirmado |
| Semáforo → Obra + Módulo | ✅ | `SemaforoPbqphCache.obraId + modulo` (schema.prisma:565) |
| Aprovacao → Origem (polimórfico) | ✅ | `AprovacaoInstancia.origem_tipo/origem_id` (schema.prisma:734) |

---

## 5. Módulos órfãos

**Órfão = código existe mas não acessível pela navegação padrão.**

| Orfão | Classificação | Justificativa |
|-------|---------------|---------------|
| `/aprovacoes/templates` | **Expor** | Rota legítima (cadastro de workflows) — sem link no sidebar |
| `pages/TestShellPage.tsx` | **Arquivar** | Página de teste; rota não registrada no App.tsx; deve ir para `_archived/` ou ser removida |
| `backend/src/ai/agents/*` | **Rota interna** | Biblioteca importada por outros módulos — OK |
| Portal (routes `/portal/*`, `/relatorio-cliente/:token`, `/fvs-cliente/:token`) | **Rota interna** | Acesso via token por e-mail — OK |
| Backend de Usuários/Tenants/Planos | **Expor (sprint dedicado)** | Modelos existem (Usuario, Tenant, Plano) mas sem controller; bloqueante para SaaS multi-usuário |
| `concretagem/dashboard/financeiro` endpoint | **Rota interna?** | `GET /obras/:obraId/concretagem/financeiro` existe mas página `ConcretagemDashboardPage` precisa confirmar se consome — [Cross-ref camada 4] |
| `dashboard/materiais` endpoint | **Verificar** | `GET /api/v1/dashboard/materiais` solitário — possível órfão backend-only ou usado por widget — [Cross-ref camada 4] |

---

## 6. Regras de negócio — achados rápidos

(Auditoria superficial — camada 6 (Regras) aprofundará.)

- **FVS — não permite aprovar com itens reprovados sem NC vinculada?** Endpoint `POST /fichas/:id/parecer` e fluxo de RO+NC existe (migration `fvs_sprint3_ro_parecer` + `fvs_sprint4b_nc_ciclo`). Precisa confirmar gate no service.
- **NC — fechada sem CAPA bloqueada?** `status=FECHADA` existe (enum NcStatus); relação com `pa_plano_acao` é polimórfica → possível fechar NC sem CAPA. [Cross-ref camada 6]
- **Concretagem — CP programado 7/14/28 dias auto?** `corpos_de_prova` tem campos, mas geração automática precisa ser confirmada em service. [Cross-ref camada 6]
- **Diário — unique por obra+data?** `migration rdo_module` define unique `(tenant_id, obra_id, data)`. ✅
- **Efetivo — funcionário em 2 obras mesmo dia?** Não há unique constraint evidente. 🟠
- **Aprovações — escalação por prazo?** `escalacao.processor.ts` existe (Bull). ✅

---

## 7. Cross-refs para outras camadas

- **Camada 1 (UX / Sidebar):** BUG-M02-010, BUG-M02-011, BUG-M02-012, BUG-M02-023, BUG-M02-032 (sidebar inconsistente, labels ambíguas, links dead-end sem obra).
- **Camada 3 (DB / Migrations):** BUG-M02-003, BUG-M02-030, BUG-M02-033 (FKs Prisma ausentes; nome antigo `betonadas`; tokens de portal não unificados). Confirmar via migrations SQL se FKs físicas existem.
- **Camada 4 (Frontend):** BUG-M02-024, órfãos `concretagem/financeiro` e `dashboard/materiais` (verificar consumo).
- **Camada 6 (Regras):** gates de FVS/NC/Concretagem/Efetivo (ver seção 6).
- **Camada 7 (Security):** BUG-M02-013 (Usuários sem CRUD — bloqueante para SaaS real); BUG-M02-033 (portal tokens).
- **MEMORY (MEMORY.md):** `project_permissions_system_pending.md` já registra o débito técnico de permissões granulares.

---

## Resumo para orquestrador

**Totais:**
- Módulos declarados oficialmente: 15 ativos + 2 ausentes (Frota, Rastreabilidade dedicada) + 1 órfão backend-only (Usuários/Tenants)
- Matriz: 13 ✅, 5 ⚠️ c/ ressalva, 2 ❌ ausentes, 1 sub-feature
- Bugs levantados: **18** (3 🔴, 4 🟠, 6 🟡, 5 🔵)
- CRUDs: 7 módulos com CRUD incompleto (sem DELETE, sem bulk, sem export)
- Relações Prisma sem `@relation`: 8+ FKs críticas (NC, Croqui, Semáforo)

**Top 3 (mais críticos):**
1. **BUG-M02-001 — Módulo Frota ausente** — declarado em doc oficial mas nunca implementado. Decisão de produto necessária.
2. **BUG-M02-003 — NCs e Croquis sem FKs Prisma** — risco de dados órfãos / perda de integridade referencial.
3. **BUG-M02-013 — Usuários/Tenants sem CRUD** — bloqueante para liberar SaaS para mais de um usuário por tenant.

**Ação urgente:**
Discutir com PO se **Gestão de Frota** e **Rastreabilidade NBR 12655 dedicada** continuam no escopo oficial. Se sim, criar sprints; se não, remover da documentação para evitar confusão de auditoria futura. Em paralelo, criar sprint "Usuários & Tenants" — bloqueante para venda SaaS.

**Cross-refs principais:**
- Camada 1 (UX): 5 bugs de sidebar → ver seção 7
- Camada 3 (DB): FKs Prisma ausentes → pedir validação de constraints SQL
- Camada 6 (Regras): vários gates de negócio não confirmados em service
- MEMORY: permissões granulares já é débito conhecido (`project_permissions_system_pending.md`)
