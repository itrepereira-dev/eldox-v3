# Controle de Efetivo — Design: Frontend + Agentes de IA

**Data:** 2026-04-15  
**Status:** Aprovado pelo PO  
**Contexto:** Complementa `SPEC-controle-efetivo-eldox.md` (v2.0) e o plano de backend `2026-04-15-efetivo-module.md`.

---

## 1. Arquitetura de IA — Abordagem Escolhida

**Opção B: Assistente Proativo — 3 agentes especializados.**

| Agente | Modelo | Trigger | Responsabilidade |
|---|---|---|---|
| `EfetivoSuggesterAgent` | Sonnet 4.6 | `GET /api/v1/obras/:id/efetivo/ia/sugestao` (síncrono, ao abrir form) | Analisa histórico de registros similares (obra, dia da semana, turno) e retorna equipe sugerida com confiança |
| `EfetivoAnalystAgent` | Haiku 4.5 | BullMQ pós-`createRegistro` (assíncrono) | Atualiza padrão histórico da obra após cada registro salvo |
| `EfetivoAlerterAgent` | Haiku 4.5 | Cron diário 7h + pós-`createRegistro` | Detecta anomalias (queda brusca ≥ 50%, empresa ausente ≥ 3 dias, obra sem efetivo) e grava alertas |

### Tools por agente

**EfetivoSuggesterAgent:**
- `get_obra_info` — tipo de obra, fase atual, locais ativos
- `get_historico_efetivo` — últimos 30 registros filtrados por dia da semana e turno
- `get_empresas_ativas` — empresas cadastradas e ativas no tenant
- `get_funcoes_ativas` — funções cadastradas e ativas no tenant

**EfetivoAnalystAgent:**
- `get_historico_efetivo` — leitura do histórico para recalcular padrão
- `upsert_padrao_efetivo` — grava/atualiza `efetivo_padroes` (tabela de cache de padrões)

**EfetivoAlerterAgent:**
- `detectar_queda_efetivo` — compara último registro com média dos 7 dias anteriores
- `detectar_empresa_ausente` — verifica empresas sem presença nos últimos N dias
- `detectar_obra_parada` — obras sem qualquer registro nas últimas 24h
- `criar_alerta` — grava na tabela `efetivo_alertas` com tipo, severidade e mensagem

---

## 2. Arquitetura Backend — Módulo IA

```
/backend/src/efetivo/
  ia/
    efetivo-ia.controller.ts     ← GET /efetivo/ia/sugestao?obraId=X
    efetivo-ia.service.ts        ← orquestra SuggesterAgent
    agents/
      suggester.agent.ts         ← EfetivoSuggesterAgent
      analyst.agent.ts           ← EfetivoAnalystAgent
      alerter.agent.ts           ← EfetivoAlerterAgent
    tools/
      efetivo.tools.ts           ← implementação das tools SQL
    prompts/
      suggester.prompt.ts        ← prompt versionado
      analyst.prompt.ts
      alerter.prompt.ts
```

**Tabelas auxiliares novas:**
- `efetivo_padroes` — cache de padrão histórico por obra/dia_semana/turno (atualizado pelo AnalystAgent)
- `efetivo_alertas` — alertas gerados pelo AlerterAgent (tipo, severidade, obra_id, lido, criado_em)

**Endpoint adicional:**
- `GET /api/v1/obras/:obraId/efetivo/ia/sugestao` — roles: TECNICO, ENGENHEIRO, ADMIN_TENANT
- `GET /api/v1/efetivo/alertas` — lista alertas ativos do tenant (para o dashboard)
- `PATCH /api/v1/efetivo/alertas/:id/lido` — marca alerta como lido

---

## 3. Arquitetura Frontend

### Páginas e rotas

| Rota | Componente | Descrição |
|---|---|---|
| `/efetivo` | `EfetivoListPage` | Lista de registros + cards de resumo + alertas IA |
| `/configuracoes/efetivo/empresas` | `CadastrosPage` (tab Empresas) | CRUD de empresas |
| `/configuracoes/efetivo/funcoes` | `CadastrosPage` (tab Funções) | CRUD de funções |

### Componentes principais

| Componente | Responsabilidade |
|---|---|
| `EfetivoListPage` | Página principal: summary cards, banner de alertas IA, tabs, tabela paginada |
| `RegistroModal` | Modal popup para criar novo registro (substituiu drawer) |
| `SugestaoIABanner` | Banner roxo com sugestão do SuggesterAgent + botão "Aplicar" |
| `EquipeGrid` | Grade inline empresa × função × quantidade, editável, com total H·dia |
| `AlertaEfetivoCard` | Banner âmbar com anomalias detectadas pelo AlerterAgent |
| `RdoVinculacaoChip` | Chip azul mostrando vinculação automática ao RDO do dia |
| `useEfetivo` | Hook: CRUD de registros, fechar, reabrir |
| `useSugestaoIA` | Hook: `GET /ia/sugestao` ao montar `RegistroModal` |
| `useAlertasEfetivo` | Hook: lista alertas ativos, marca como lido |

### Fluxo do modal "Novo Registro"

```
Técnico clica "Novo Registro"
  → Modal abre
  → useSugestaoIA dispara GET /ia/sugestao?obraId=X
  → SugestaoIABanner renderiza equipe sugerida com confiança
  → Técnico clica "Aplicar sugestão" → EquipeGrid preenchida automaticamente
  → Técnico confirma/ajusta quantidades
  → Clica "Salvar Registro" → POST /obras/:id/efetivo
  → Sucesso: modal fecha, lista atualiza, toast de confirmação
```

### Estrutura de arquivos frontend

```
/frontend-web/src/modules/efetivo/
  pages/
    EfetivoListPage.tsx
    CadastrosPage.tsx
  components/
    RegistroModal.tsx
    SugestaoIABanner.tsx
    EquipeGrid.tsx
    AlertaEfetivoCard.tsx
    RdoVinculacaoChip.tsx
  hooks/
    useEfetivo.ts
    useSugestaoIA.ts
    useAlertasEfetivo.ts
/frontend-web/src/services/
  efetivo.service.ts             ← todos os calls à API
```

---

## 4. Design Visual (Precision Ops Dark)

- **Modal:** centralizado, `max-width: 800px`, `max-height: 90vh`, scroll interno, overlay com `backdrop-filter: blur(4px)` — blur remove ao fechar
- **Sugestão IA:** fundo `--purple-bg`, borda `--purple-border`, badge `✦ EldoxIA`
- **Alerta:** fundo `--warn-bg`, borda `--warn-border`
- **Vinculação RDO:** chip `--accent-dim` com ✓ verde
- **EquipeGrid:** grade sem bordas externas, separadores internos, total H·dia calculado em tempo real
- **Badges de status:** `Aberto` (azul) / `Fechado` (verde)

---

## 5. Decisões registradas

| Decisão | Escolha | Motivo |
|---|---|---|
| Abertura do form | Modal popup (não drawer) | Formulário completo com 4 seções — drawer ficaria apertado |
| Sugestão IA | Síncrona ao abrir o modal | Técnico vê sugestão antes de começar a preencher |
| Análise histórica | Assíncrona pós-save (BullMQ) | Não bloqueia o save do registro |
| Alertas | Cron 7h + pós-save | Alertas disponíveis no início do expediente |
| Relatório PDF/XLSX | Fora do escopo desta sprint | Depende de lib de geração — sprint separada |

---

## 6. O que NÃO está neste design (escopo futuro)

- Relatório PDF/XLSX (`GET /efetivo/relatorio`)
- Tela de detalhe do registro com histórico de edições
- Integração com cronograma (EfetivoForecasterAgent — opção C descartada)
- App mobile (fora do MVP)

---

*Design aprovado em sessão de brainstorming — 2026-04-15*  
*Mockup salvo em `.superpowers/brainstorm/2751-1776231124/content/mockup-efetivo-v2.html`*
