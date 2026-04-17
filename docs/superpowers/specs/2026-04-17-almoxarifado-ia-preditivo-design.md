# Almoxarifado IA Preditivo — Design Spec

**Data:** 2026-04-17
**Status:** Aprovado

---

## Goal

Transformar os agentes de IA do almoxarifado de informativos em acionáveis: job agendado gera insights persistidos com ciclo de vida, e o engenheiro pode criar uma Solicitação de Compra com um clique a partir de cada sugestão.

## Contexto

Os agentes `AgenteReorderService` e `AgenteAnomaliaService` já existem e funcionam, mas têm três problemas:

1. **SQL desatualizado** — usam `obra_id` nas queries; após o ERP redesign as tabelas usam `local_id`
2. **Endpoint obsoleto** — `/obras/:obraId/insights` é obra-scoped; o almoxarifado é tenant-level
3. **Sem persistência de sugestões** — insights somem quando o usuário fecha a página; sem ciclo de vida; sem ação integrada ao fluxo de compras

## Arquitetura

```
BullMQ Job (a cada 6h)
  └─► AgenteReorderService.executar(tenantId)   ─► alm_sugestoes_ia (upsert)
  └─► AgenteAnomaliaService.executar(tenantId)  ─► alm_sugestoes_ia (upsert)

GET  /almoxarifado/insights          → lê alm_sugestoes_ia (banco, rápido)
POST /almoxarifado/insights/reanalisar → enfileira job manualmente
PATCH /almoxarifado/insights/:id/aplicar → cria Solicitação + marca aplicado
PATCH /almoxarifado/insights/:id/ignorar → marca ignorado

InsightsPage
  useInsights()           → GET /insights
  useAplicarSugestao()    → PATCH /insights/:id/aplicar
  useIgnorarSugestao()    → PATCH /insights/:id/ignorar
  useReanalisarInsights() → POST /insights/reanalisar
```

## Banco de Dados

### Nova tabela: `alm_sugestoes_ia`

```sql
CREATE TABLE alm_sugestoes_ia (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  tipo           VARCHAR(20) NOT NULL,   -- 'reorder' | 'anomalia'
  catalogo_id    INT NOT NULL,
  catalogo_nome  VARCHAR(255) NOT NULL,
  local_id       INT NOT NULL,
  unidade        VARCHAR(20) NOT NULL,
  dados_json     JSONB NOT NULL,         -- payload completo do agente
  status         VARCHAR(20) NOT NULL DEFAULT 'pendente',  -- 'pendente' | 'aplicado' | 'ignorado'
  solicitacao_id INT,                    -- FK para alm_solicitacoes quando aplicado
  criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (tenant_id, catalogo_id, local_id, tipo)  -- sem duplicatas por ciclo
);
CREATE INDEX idx_alm_sugestoes_tenant_status ON alm_sugestoes_ia (tenant_id, status);
```

### `dados_json` por tipo

**reorder:**
```json
{
  "quantidade_atual": 12.5,
  "consumo_medio_diario": 2.1,
  "dias_restantes": 5,
  "recomendacao_qty": 63,
  "nivel": "critico",
  "analise_ia": "Consumo acelerado — risco de ruptura antes do fim de semana."
}
```

**anomalia:**
```json
{
  "consumo_recente_7d": 84.0,
  "consumo_medio_30d": 28.0,
  "fator_desvio": 3.0,
  "nivel": "atencao",
  "explicacao_ia": "Pico de consumo pode indicar nova frente ou desperdício."
}
```

### Migração das queries existentes

Substituir `obra_id` por `local_id` em:
- `AgenteReorderService` — `alm_estoque_saldo.local_id`, `alm_movimentos.local_id`
- `AgenteAnomaliaService` — `alm_estoque_saldo.local_id`, `alm_movimentos.local_id`

Os agentes passam a receber `localId` em vez de `obraId`. O job itera por todos os locais ativos do tenant.

## Backend

### BullMQ Job: `AlmInsightsJob`

**Arquivo:** `src/almoxarifado/ia/alm-insights.job.ts`

- Registrado como `@Processor('alm-insights')`
- Agendado com `@Cron` ou `BullMQ repeat` a cada `ALM_INSIGHTS_INTERVAL_HOURS` horas (default: 6)
- Fluxo por tenant:
  1. Busca todos os `alm_locais` ativos do tenant
  2. Para cada local, executa `reorder.executar(tenantId, localId)` e `anomalia.executar(tenantId, localId)` em paralelo
  3. Upsert em `alm_sugestoes_ia`: se status for `pendente`, atualiza dados; se `aplicado` ou `ignorado`, não sobrescreve

**Módulo:** `AlmInsightsModule` registra `BullModule.registerQueue({ name: 'alm-insights' })` e o job.

### Endpoints: `InsightsController`

**Arquivo:** `src/almoxarifado/ia/insights.controller.ts`

```
GET  /api/v1/almoxarifado/insights
  → SELECT * FROM alm_sugestoes_ia
    WHERE tenant_id = $1 AND status = 'pendente'
    ORDER BY (dados_json->>'nivel' = 'critico') DESC, criado_em DESC
  → Roles: ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

POST /api/v1/almoxarifado/insights/reanalisar
  → Enfileira job: queue.add('executar', { tenantId }, { priority: 1 })
  → Retorna: { enqueued: true }
  → Roles: ADMIN_TENANT, ENGENHEIRO

PATCH /api/v1/almoxarifado/insights/:id/aplicar
  → Valida: sugestao.tenant_id === tenantId, status === 'pendente'
  → Cria alm_solicitacoes com status 'rascunho':
      { tenant_id, local_destino_id: sugestao.local_id,
        itens: [{ catalogo_id, quantidade: dados_json.recomendacao_qty }],
        observacao: `Gerada por IA — ${sugestao.dados_json.analise_ia}` }
  → UPDATE alm_sugestoes_ia SET status='aplicado', solicitacao_id=<novo>, atualizado_em=NOW()
  → Retorna: { solicitacao_id }
  → Roles: ADMIN_TENANT, ENGENHEIRO

PATCH /api/v1/almoxarifado/insights/:id/ignorar
  → UPDATE alm_sugestoes_ia SET status='ignorado', atualizado_em=NOW()
  → Roles: ADMIN_TENANT, ENGENHEIRO, TECNICO
```

O endpoint antigo `GET /obras/:obraId/insights` é removido do `IaController`.

### Agentes atualizados

- `AgenteReorderService.executar(tenantId, localId)` — troca `obraId` por `localId`
- `AgenteAnomaliaService.executar(tenantId, localId)` — troca `obraId` por `localId`
- Resultado de cada agente é persistido em `alm_sugestoes_ia` (upsert) pelo job, não pelos próprios agentes
- Agentes continuam retornando arrays — o job é responsável pela persistência

## Frontend

### `useInsights` (atualizado)

**Arquivo:** `frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts`

```ts
export function useInsights() {
  return useQuery({
    queryKey: ['alm-insights'],
    queryFn: () => almoxarifadoService.getInsights(),
    staleTime: 5 * 60_000,
  })
}

export function useAplicarSugestao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.aplicarSugestao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  })
}

export function useIgnorarSugestao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.ignorarSugestao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  })
}

export function useReanalisarInsights() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => almoxarifadoService.reanalisarInsights(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  })
}
```

### `almoxarifado.service.ts` (métodos novos)

```ts
getInsights(): Promise<AlmSugestaoIa[]>
  GET /almoxarifado/insights

aplicarSugestao(id: number): Promise<{ solicitacao_id: number }>
  PATCH /almoxarifado/insights/:id/aplicar

ignorarSugestao(id: number): Promise<void>
  PATCH /almoxarifado/insights/:id/ignorar

reanalisarInsights(): Promise<{ enqueued: boolean }>
  POST /almoxarifado/insights/reanalisar
```

### `InsightsPage` (atualizado)

**Arquivo:** `frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx`

Mudanças em relação à versão atual:

1. Remove `useParams<{ obraId }>` — sem escopo de obra
2. Usa `useInsights()`, `useAplicarSugestao()`, `useIgnorarSugestao()`, `useReanalisarInsights()`
3. Botão "Reanalisar" chama `reanalisar.mutate()` em vez de `refetch()`
4. `ReorderCard` ganha botão "Criar Solicitação":
   - Ao clicar, chama `aplicar.mutate(sugestao.id)`
   - On success, navega para `/almoxarifado/solicitacoes/:solicitacao_id`
5. Cards de anomalia ganham botão "Ignorar":
   - Chama `ignorar.mutate(sugestao.id)`
   - Card some da lista (invalidate query)
6. Estado vazio quando `data.length === 0`:
   - "Estoque saudável — próxima análise automática a cada 6h"

### Tipo `AlmSugestaoIa`

Adicionado em `almoxarifado.service.ts`:

```ts
export interface AlmSugestaoIa {
  id: number
  tipo: 'reorder' | 'anomalia'
  catalogo_id: number
  catalogo_nome: string
  local_id: number
  unidade: string
  dados_json: AlmReorderPrediction | AlmAnomaliaDetectada
  status: 'pendente' | 'aplicado' | 'ignorado'
  solicitacao_id?: number
  criado_em: string
}
```

## Fluxo completo

```
06:00 → BullMQ dispara AlmInsightsJob
  └─► Para cada local ativo do tenant:
        reorder.executar(tenantId, localId)   → 3 itens críticos
        anomalia.executar(tenantId, localId)  → 1 anomalia
  └─► Upsert em alm_sugestoes_ia (4 sugestões status='pendente')

Engenheiro abre /almoxarifado/insights
  └─► GET /insights → 4 cards (rápido, sem IA)
  └─► Clica "Criar Solicitação" no item crítico
        PATCH /insights/3/aplicar
        └─► Solicitação #12 criada em rascunho
        └─► Redireciona para /almoxarifado/solicitacoes/12
  └─► Clica "Ignorar" na anomalia
        PATCH /insights/4/ignorar
        └─► Card some da lista
```

## O que NÃO está no escopo

- Badge/notificação no sidebar (pode ser fase 2)
- Configuração de frequência do job via UI (usa env var)
- Insights para módulos além de reorder e anomalia (fase 2)
- Email/WhatsApp quando sugestão crítica é gerada (fase 2)
