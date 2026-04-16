# Spec: Dashboard Geral Configurável
Versão: 1.0
Status: Aprovada
Data: 2026-04-15

---

## Visão Geral

Substituir a `DashboardPage` atual (3 KPIs estáticos + 3 quick links) por um **dashboard configurável por usuário**, baseado em drag & drop e um catálogo de 60+ widgets. Cada usuário monta sua própria grade — quais widgets exibir, em qual posição e tamanho. O layout é persistido no banco por usuário. Novos KPIs podem ser adicionados ao catálogo sem modificar o core do dashboard (Widget Generator).

---

## 1. Arquitetura Frontend

### 1.1 Estrutura de arquivos

```
src/
  pages/
    DashboardPage.tsx              ← substitui o atual (shell apenas)
  modules/
    dashboard/
      DashboardGrid.tsx            ← react-grid-layout wrapper
      AddWidgetDrawer.tsx          ← drawer lateral com catálogo de widgets
      WidgetConfigModal.tsx        ← modal de configuração por widget
      WidgetWrapper.tsx            ← container com handles de edição
      registry/
        index.ts                   ← WidgetRegistry (singleton)
        types.ts                   ← WidgetDefinition interface
        widgets.ts                 ← import e registro de todos os widgets
      widgets/
        global/
          ObrasStatusWidget.tsx
          NcsAbertasWidget.tsx
          AprovacoesPendentesWidget.tsx
          SemaforoGeralWidget.tsx
          AlertasCriticosWidget.tsx
        obra/
          FvsConformidadeWidget.tsx
          FvsEvolucaoWidget.tsx
          ConcretagemVolumeWidget.tsx
          ConcretagemCpsWidget.tsx
          EnsaiosConformidadeWidget.tsx
          EnsaiosLaudosWidget.tsx
          AlmoxarifadoCriticoWidget.tsx
          AlmoxarifadoOcsWidget.tsx
          EfetivoHojeWidget.tsx
          GedDocsWidget.tsx
          RdoRecenteWidget.tsx
          FvmLotesWidget.tsx
        feed/
          AtividadeRecenteWidget.tsx
  services/
    dashboard.service.ts           ← chamadas ao endpoint unificado
```

### 1.2 WidgetDefinition

```typescript
// modules/dashboard/registry/types.ts

export type GridSize = '1x1' | '2x1' | '1x2' | '2x2' | '4x1' | '4x2'

export interface WidgetInstance {
  instanceId: string       // uuid gerado no frontend
  widgetId: string         // referência ao WidgetDefinition.id
  x: number
  y: number
  w: number                // em colunas (grid de 12)
  h: number                // em linhas (altura fixa por unidade)
  config: Record<string, unknown>  // params validados por configSchema
}

export interface WidgetDefinition {
  id: string               // slug único, ex: 'ncs-abertas'
  titulo: string
  descricao: string
  icone: React.ReactNode
  modulo: string           // 'ncs' | 'fvs' | 'almoxarifado' | ...
  tier: 1 | 2 | 3          // 1=global | 2=por obra | 3=cruzado
  tamanhosPadrao: GridSize // tamanho ao adicionar
  tamanhoMinimo: { w: number; h: number }
  tamanhoMaximo: { w: number; h: number }
  configSchema: ZodSchema  // valida config ao adicionar/editar
  roles: Role[]            // quem pode ver este widget
  component: React.FC<{ config: Record<string, unknown>; instanceId: string }>
  previewImagem?: string   // screenshot estático para o catálogo
}
```

### 1.3 WidgetRegistry

```typescript
// modules/dashboard/registry/index.ts

class WidgetRegistry {
  private map = new Map<string, WidgetDefinition>()

  register(def: WidgetDefinition) {
    this.map.set(def.id, def)
  }

  get(id: string): WidgetDefinition | undefined {
    return this.map.get(id)
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.map.values())
  }

  getByModulo(modulo: string): WidgetDefinition[] {
    return this.getAll().filter(d => d.modulo === modulo)
  }

  getByTier(tier: 1 | 2 | 3): WidgetDefinition[] {
    return this.getAll().filter(d => d.tier === tier)
  }
}

export const widgetRegistry = new WidgetRegistry()
```

### 1.4 DashboardGrid

- Usa `react-grid-layout` com grade de **12 colunas**
- Em modo visualização: `isDraggable={false}`, `isResizable={false}`
- Em modo edição: drag & drop e resize habilitados
- Cada célula renderiza `<WidgetWrapper>` → `<WidgetDefinition.component config={...} />`
- Layout vazio mostra mensagem "Seu dashboard está vazio — clique em Editar para começar"

### 1.5 AddWidgetDrawer

- Drawer lateral (direita), 360px, abre ao clicar "Adicionar widget"
- Tabs por módulo: Global | FVS | Concretagem | Ensaios | Almoxarifado | Efetivo | RDO | GED | NCs | FVM
- Cada widget exibido como card com: ícone, título, descrição, preview estático
- Ao clicar num widget: abre `WidgetConfigModal` se o widget precisar de config (ex: qual `obraId`); senão adiciona diretamente

### 1.6 Fluxo de edição

1. Usuário clica "Editar dashboard"
2. Grade entra em modo edição (borda tracejada, handles visíveis, botão ✕ em cada widget)
3. Usuário arrasta, redimensiona, adiciona ou remove widgets
4. Usuário clica "Salvar" → `PUT /api/v1/usuarios/me/dashboard-layout` com o JSON do layout
5. Feedback de sucesso, grade volta ao modo visualização

### 1.7 Layout padrão (primeiro acesso)

Se o banco não tiver layout salvo para o usuário, o sistema usa um layout padrão conforme o role:

| Role | Widgets padrão |
|---|---|
| ADMIN_TENANT | ObrasStatus · NcsAbertas · AprovacoesPendentes · SemaforoGeral |
| ENGENHEIRO | NcsAbertas · FvsConformidade · ConcretagemVolume · EnsaiosLaudos |
| TECNICO | AprovacoesPendentes · FvsConformidade · AlmoxarifadoCritico |
| VISITANTE | ObrasStatus · SemaforoGeral |

---

## 2. Catálogo de Widgets (v1.0)

### Tier 1 — Globais (sem filtro de obra)

| ID | Título | Tamanho padrão | Dados |
|---|---|---|---|
| `obras-status` | Obras — Status | 2x1 | `GET /dashboard/summary` |
| `ncs-abertas` | NCs Abertas | 1x1 | `GET /dashboard/summary` |
| `aprovacoes-pendentes` | Aprovações Pendentes | 1x1 | `GET /dashboard/summary` |
| `semaforo-geral` | Semáforo de Obras | 4x2 | `GET /semaforo` |
| `alertas-criticos` | Alertas Críticos | 4x1 | `GET /dashboard/summary` |
| `feed-atividade` | Feed de Atividade | 4x3 | `GET /dashboard/feed` |

### Tier 2 — Por Obra (config: `obraId`)

| ID | Título | Tamanho padrão | Dados |
|---|---|---|---|
| `fvs-conformidade` | FVS — Conformidade | 2x1 | `GET /fvs/dashboard/obras/:id` |
| `fvs-evolucao` | FVS — Evolução | 4x2 | `GET /fvs/dashboard/obras/:id/evolucao` |
| `fvs-top-ncs` | FVS — Pareto NCs | 4x2 | `GET /fvs/dashboard/obras/:id/top-ncs` |
| `concretagem-volume` | Concretagem — Volume | 2x1 | `GET /obras/:id/concretagem/dashboard` |
| `concretagem-cps` | Concretagem — CPs | 2x1 | `GET /obras/:id/concretagem/dashboard` |
| `ensaios-conformidade` | Ensaios — Conformidade | 2x1 | `GET /dashboard/materiais` |
| `ensaios-laudos` | Ensaios — Laudos Pend. | 1x1 | `GET /dashboard/materiais` |
| `ensaios-cupons` | Ensaios — Cupons | 1x1 | `GET /dashboard/materiais` |
| `alm-critico` | Estoque Crítico | 2x2 | `GET /almoxarifado/obras/:id/dashboard` |
| `alm-ocs` | OCs Pendentes | 2x1 | `GET /almoxarifado/obras/:id/ocs` |
| `efetivo-hoje` | Efetivo Hoje | 2x1 | `GET /obras/:id/efetivo/dashboard` |
| `efetivo-evolucao` | Efetivo — Evolução | 4x2 | `GET /obras/:id/efetivo/dashboard` |
| `ged-docs` | GED — Documentos | 2x1 | `GET /obras/:id/ged/stats` |
| `rdo-recente` | Diário — Últimos RDOs | 4x2 | `GET /obras/:id/rdo/dashboard` |
| `fvm-lotes` | FVM — Lotes | 2x1 | `GET /obras/:id/fvm/dashboard` |
| `ncs-por-obra` | NCs da Obra | 2x1 | `GET /obras/:id/ncs/dashboard` |

### Tier 3 — Cruzados (fase futura, não implementar no v1)

- Score geral composto (FVS + CPs + Ensaios + NCs)
- Correlação RDO ↔ NC
- Ranking de qualidade entre obras

---

## 3. Backend

### 3.1 Persistência do layout

**Migração:** Adicionar campo `dashboardLayout` na tabela `"Usuario"`:

```sql
ALTER TABLE "Usuario"
  ADD COLUMN "dashboardLayout" JSONB NULL;
```

**Endpoints:**

```
GET  /api/v1/usuarios/me/dashboard-layout
→ 200: { layout: WidgetInstance[] | null }

PUT  /api/v1/usuarios/me/dashboard-layout
Body: { layout: WidgetInstance[] }
→ 200: { layout: WidgetInstance[] }
```

O backend valida apenas que `layout` é um array JSON válido com até 50 itens. Não valida os `widgetId` — isso é responsabilidade do frontend.

### 3.2 Endpoint unificado de KPIs globais

```
GET /api/v1/dashboard/summary
→ 200:
{
  obras: { total, em_execucao, paralisadas, concluidas },
  ncs: { abertas, criticas, vencidas },
  aprovacoes: { pendentes_do_usuario, vencidas },
  ged: { vencendo_30d, pendentes_ifa },
  alertas: AlertaItem[]     // lista de alertas críticos cross-módulo
}
```

Este endpoint faz queries paralelas em `Obra`, `NaoConformidade`, `AprovacaoInstancia` e `GedVersao` filtradas por `tenantId`.

### 3.3 Endpoint de feed de atividade

```
GET /api/v1/dashboard/feed?limit=20
→ 200:
{
  items: FeedItem[]
}

FeedItem: {
  id: string
  tipo: 'nc_aberta' | 'laudo_aprovado' | 'doc_enviado' | 'estoque_critico' | 'rdo_registrado' | ...
  titulo: string
  subtitulo?: string
  obra_nome?: string
  created_at: string
  link: string   // rota do frontend para navegar direto ao item
  cor: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
}
```

### 3.4 Endpoints de KPI por módulo ainda ausentes

Os endpoints abaixo precisam ser criados (os demais já existem):

| Endpoint | Módulo | Dados |
|---|---|---|
| `GET /obras/:id/efetivo/dashboard` | Efetivo | Total hoje, evolução 30d, proporção |
| `GET /obras/:id/ncs/dashboard` | NCs | Total, por criticidade, vencidas |
| `GET /obras/:id/fvm/dashboard` | FVM | Lotes conformes, em quarentena, rejeitados |
| `GET /obras/:id/rdo/dashboard` | RDO | Últimos 5 RDOs, taxa de aprovação |

Endpoints já existentes reutilizáveis sem alteração:
- `GET /fvs/dashboard/global` e `GET /fvs/dashboard/obras/:id` (FVS)
- `GET /obras/:id/concretagem/dashboard` (Concretagem)
- `GET /semaforo` e `GET /obras/:id/semaforo` (Semáforo)
- `GET /obras/:id/ged/stats` (GED)
- `GET /almoxarifado/obras/:id/dashboard` (Almoxarifado)
- `GET /dashboard/materiais` (Ensaios)

---

## 4. Comportamentos e Regras

### 4.1 Permissões

- Widgets com `roles` definidos só aparecem no catálogo para usuários com aquele role
- Um `VISITANTE` vê apenas Tier 1 (globais) e não pode editar o dashboard
- O layout de cada usuário é privado — não é compartilhado

### 4.2 Widget com obra não encontrada

Se um widget de Tier 2 foi salvo com `obraId: 5` e essa obra foi deletada, o widget renderiza um estado de erro inline (`ObraId 5 não encontrada`), sem quebrar o dashboard inteiro.

### 4.3 Erro de carregamento de dados

Cada widget gerencia seu próprio estado de loading/error (React Query). Erro em um widget não afeta os demais.

### 4.4 Responsividade

- Desktop (≥1280px): grade de 12 colunas
- Tablet (768px–1279px): grade de 6 colunas, widgets redimensionados automaticamente
- Mobile (<768px): lista vertical, sem drag & drop, apenas visualização

### 4.5 Limite de widgets

Máximo de 30 widgets simultaneamente no dashboard para evitar sobrecarga de requisições.

---

## 5. Identidade Visual — Tokens de Tema

### 5.1 Dark Mode — Slate Deep

Substituir o tema GitHub atual (`#0d1117`) pelo Slate Deep baseado na paleta Tailwind slate:

```css
[data-theme="dark"] {
  --bg-void:    #0f172a;   /* slate-950 */
  --bg-base:    #0f172a;
  --bg-surface: #1e293b;   /* slate-800 */
  --bg-raised:  #1e293b;
  --bg-hover:   #334155;   /* slate-700 */

  --accent:       #3b82f6; /* blue-500 */
  --accent-hover: #60a5fa; /* blue-400 */
  --accent-dim:   rgba(59, 130, 246, 0.18);

  --border:        #334155;
  --border-bright: #475569;
  --border-dim:    #1e293b;

  --text-high:  #f1f5f9;   /* slate-100 */
  --text-mid:   #e2e8f0;   /* slate-200 */
  --text-low:   #94a3b8;   /* slate-400 */
  --text-faint: #64748b;   /* slate-500 */

  --ok:    #22c55e; --ok-bg:   rgba(34,197,94,.12);   --ok-border:  rgba(34,197,94,.25);
  --run:   #3b82f6; --run-bg:  rgba(59,130,246,.12);  --run-border: rgba(59,130,246,.25);
  --warn:  #f59e0b; --warn-bg: rgba(245,158,11,.12);  --warn-border:rgba(245,158,11,.25);
  --nc:    #ef4444; --nc-bg:   rgba(239,68,68,.12);   --nc-border:  rgba(239,68,68,.25);

  --shadow-xs:    0 1px 2px rgba(0,0,0,.40);
  --shadow-sm:    0 2px 8px rgba(0,0,0,.35);
  --shadow-md:    0 4px 16px rgba(0,0,0,.40);
  --shadow-lg:    0 8px 32px rgba(0,0,0,.50);
  --shadow-hover: 0 2px 12px rgba(59,130,246,.20);
  --shadow-glow:  0 0 24px rgba(59,130,246,.15);

  --glass-bg:          rgba(15, 23, 42, 0.85);
  --gradient-accent:   linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  --gradient-surface:  linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
}
```

### 5.2 Light Mode — Slate Cool

Substituir o tema branco clínico atual por Slate Cool:

```css
[data-theme="light"] {
  --bg-void:    #f1f5f9;   /* slate-100 */
  --bg-base:    #f8fafc;   /* slate-50  */
  --bg-surface: #ffffff;
  --bg-raised:  #f1f5f9;
  --bg-hover:   #e2e8f0;   /* slate-200 */

  --accent:       #2563eb; /* blue-600 */
  --accent-hover: #1d4ed8; /* blue-700 */
  --accent-dim:   rgba(37, 99, 235, 0.10);

  --border:        #e2e8f0; /* slate-200 */
  --border-bright: #cbd5e1; /* slate-300 */
  --border-dim:    #e8edf2;

  --text-high:  #0f172a;   /* slate-950 */
  --text-mid:   #1e293b;   /* slate-800 */
  --text-low:   #475569;   /* slate-600 */
  --text-faint: #94a3b8;   /* slate-400 */

  --ok:    #16a34a; --ok-bg:   #f0fdf4; --ok-border:  rgba(22,163,74,.20);
  --run:   #2563eb; --run-bg:  #eff6ff; --run-border: rgba(37,99,235,.20);
  --warn:  #d97706; --warn-bg: #fffbeb; --warn-border:rgba(217,119,6,.20);
  --nc:    #dc2626; --nc-bg:   #fef2f2; --nc-border:  rgba(220,38,38,.20);

  --shadow-xs:    0 1px 2px rgba(15,23,42,.06);
  --shadow-sm:    0 2px 8px rgba(15,23,42,.08);
  --shadow-md:    0 4px 16px rgba(15,23,42,.10);
  --shadow-lg:    0 8px 32px rgba(15,23,42,.14);
  --shadow-hover: 0 2px 12px rgba(37,99,235,.12);
  --shadow-glow:  0 0 24px rgba(37,99,235,.10);

  --glass-bg:         rgba(255, 255, 255, 0.90);
  --gradient-surface: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}
```

### 5.3 Dimensões de widgets editáveis

No modo edição, cada widget expõe um **handle de resize** no canto inferior direito (fornecido pelo `react-grid-layout`). O usuário pode:
- Arrastar o handle para redimensionar livremente dentro dos limites `tamanhoMinimo` e `tamanhoMaximo` definidos no `WidgetDefinition`
- O tamanho escolhido é salvo junto com o layout no `dashboardLayout JSONB`
- Widgtes têm `minW: 1, minH: 1` e `maxW: 12, maxH: 6` como limite absoluto do grid
- Cada `WidgetDefinition` pode restringir esses limites (ex: widget de feed mínimo `2x2`)

---

## 6. Dependências

| Pacote | Versão | Motivo |
|---|---|---|
| `react-grid-layout` | ^1.4 | Grid drag & drop |
| `react-grid-layout` CSS | incluído | Estilos da grade |
| `zod` | já presente | Validação de configSchema dos widgets |
| `uuid` | já presente (ou crypto.randomUUID) | Geração de instanceId |

---

## 6. Fluxo de adição de novos widgets (Widget Generator)

Para adicionar um novo KPI como widget no futuro:

1. Criar `src/modules/dashboard/widgets/<modulo>/<NomeWidget>.tsx`
   - Recebe `{ config, instanceId }` como props
   - Usa React Query para buscar seus próprios dados
   - Renderiza estado de loading, erro e sucesso
2. Registrar em `src/modules/dashboard/registry/widgets.ts`:
   ```typescript
   widgetRegistry.register({
     id: 'meu-novo-kpi',
     titulo: 'Meu Novo KPI',
     descricao: 'Descrição curta',
     icone: <MeuIcone size={16} />,
     modulo: 'meu-modulo',
     tier: 2,
     tamanhosPadrao: '2x1',
     tamanhoMinimo: { w: 1, h: 1 },
     tamanhoMaximo: { w: 4, h: 4 },
     configSchema: z.object({ obraId: z.number() }),
     roles: ['ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO'],
     component: MeuNovoKpiWidget,
   })
   ```
3. **Pronto.** O widget aparece automaticamente no catálogo, suporta drag & drop, resize, configuração individual e persistência — sem nenhuma alteração adicional.

---

## 7. Checklist de Validação

- [x] Todos os campos têm tipo definido
- [x] Layout salvo como JSONB — sem schema rígido no banco, flexível para evolução
- [x] Permissões definidas por widget (roles) e por role (layout de quem pode editar)
- [x] Edge case: obra deletada → widget com erro inline, não quebra o dashboard
- [x] Edge case: primeiro acesso → layout padrão por role
- [x] Edge case: widget com erro de dados → estado de erro isolado
- [x] Mobile: lista vertical sem drag & drop
- [x] Limite de 30 widgets para não sobrecarregar
- [x] Novos widgets: apenas 2 passos (criar componente + registrar)
- [x] Endpoints ausentes identificados (4 a criar)
- [x] Endpoints existentes reutilizáveis identificados (7)
- [x] Sem breaking changes nos módulos existentes
