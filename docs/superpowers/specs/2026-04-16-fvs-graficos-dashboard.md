# Spec: FVS — Gráficos Avançados (Dashboard)
Versão: 1.0
Status: Aprovada
Data: 2026-04-16

---

## Contexto

O Dashboard FVS atual (`/fvs/dashboard`) tem apenas KPIs estáticos sem visualização temporal
ou espacial. O AutoDoc mostra 4 visualizações que são o diferencial do produto: evolução
temporal, conformidade por serviço, heatmap e funil. Esta spec adiciona esses 4 gráficos ao
dashboard existente, usando recharts (já instalado no projeto).

---

## Arquivo existente a modificar

`frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx`

Não criar nova página — expandir a existente com nova seção de gráficos abaixo dos KPIs.

---

## Novos Endpoints de Agregação (Backend)

Todos em `GET /api/v1/fvs/obras/:obraId/dashboard-graficos`

### Endpoint único com múltiplos blocos
```
GET /api/v1/fvs/obras/:obraId/dashboard-graficos
Query: data_inicio, data_fim, granularidade=semana|mes, servico_ids (opcional, multi-value)
Authorization: VISITOR+
```

**Response:**
```typescript
{
  evolucao_temporal: {
    labels: string[],          // ["Sem 1", "Sem 2", ...] ou ["Jan", "Fev", ...]
    series: {
      servico_id: number,
      servico_nome: string,
      cor: string,             // hex gerado deterministicamente por servico_id
      valores: number[],       // taxa_conformidade % por label, null se sem dado
    }[]
  },
  conformidade_por_servico: {
    servico_id: number,
    servico_nome: string,
    total_inspecoes: number,
    taxa_conformidade: number, // 0–100
    ncs_abertas: number,
    tendencia: 'subindo' | 'caindo' | 'estavel',  // delta últimas 2 semanas
  }[],
  heatmap: {
    servicos: string[],        // eixo Y
    periodos: string[],        // eixo X (semanas ou meses)
    celulas: {
      servico_idx: number,
      periodo_idx: number,
      taxa: number | null,     // 0–100, null = sem inspeção
      total_inspecoes: number,
    }[]
  },
  funil: {
    total_fichas: number,
    concluidas: number,
    aprovadas: number,
    com_nc: number,
    com_pa: number,            // fichas que geraram PA
  }
}
```

### SQL de referência (PostgreSQL)

**Evolução temporal:**
```sql
-- Por semana, por serviço
SELECT
  DATE_TRUNC('week', i.data_inspecao) AS periodo,
  s.id AS servico_id,
  s.nome AS servico_nome,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE i.status_resultado = 'APROVADO') /
    NULLIF(COUNT(*) FILTER (WHERE i.status_resultado IN ('APROVADO','REPROVADO','APROVADO_COM_RESSALVA')), 0),
    1
  ) AS taxa_conformidade
FROM fvs_inspecoes i
JOIN fvs_servicos_catalogo s ON s.id = i.servico_id
WHERE i.tenant_id = $1 AND i.obra_id = $2
  AND i.data_inspecao BETWEEN $3 AND $4
  AND i.deleted_at IS NULL
GROUP BY DATE_TRUNC('week', i.data_inspecao), s.id, s.nome
ORDER BY periodo, s.nome;
```

**Funil:**
```sql
SELECT
  COUNT(*)                                                          AS total_fichas,
  COUNT(*) FILTER (WHERE i.concluida_em IS NOT NULL)                AS concluidas,
  COUNT(*) FILTER (WHERE i.status_resultado = 'APROVADO')           AS aprovadas,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM nao_conformidades nc WHERE nc.inspecao_id = i.id AND nc.deleted_at IS NULL
  ))                                                                AS com_nc,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM pa_plano_acao pa WHERE pa.origem_id = i.id AND pa.origem_tipo = 'INSPECAO_FVS' AND pa.deleted_at IS NULL
  ))                                                                AS com_pa
FROM fvs_inspecoes i
WHERE i.tenant_id = $1 AND i.obra_id = $2
  AND i.data_inspecao BETWEEN $3 AND $4
  AND i.deleted_at IS NULL;
```

---

## Frontend — 4 Componentes de Gráfico

### Localização dos arquivos
```
frontend-web/src/modules/fvs/dashboard/
├── pages/
│   └── FvsDashboardPage.tsx        (MODIFICAR — adicionar seção GraficosAvancados)
├── components/
│   ├── GraficosAvancados.tsx       (CRIAR — container que busca dados e renderiza os 4)
│   ├── EvolucaoTemporalChart.tsx   (CRIAR)
│   ├── ConformidadeBarChart.tsx    (CRIAR)
│   ├── HeatmapServicos.tsx         (CRIAR)
│   └── FunilInspecoes.tsx          (CRIAR)
└── hooks/
    └── useDashboardGraficos.ts     (CRIAR)
```

### Hook `useDashboardGraficos`
```typescript
export function useDashboardGraficos(obraId: number, filtros: GraficosFiltros) {
  return useQuery({
    queryKey: ['fvs-graficos', obraId, filtros],
    queryFn: () => fvsService.getDashboardGraficos(obraId, filtros),
    staleTime: 5 * 60_000,
    enabled: obraId > 0,
  })
}
```

### G1 — Evolução Temporal (LineChart)
Componente: `EvolucaoTemporalChart`
```
- recharts LineChart com múltiplas séries (uma por serviço)
- Eixo X: períodos (semanas/meses)
- Eixo Y: taxa de conformidade 0–100%
- Tooltip: mostra todas as séries no hover
- Legenda interativa: clique esconde/mostra série
- Linha pontilhada horizontal em 85% (target padrão, configurável)
- Se sem dados no período: linha interrompida (connectNulls=false)
- Seletor de granularidade: Semana | Mês (state local, re-fetch)
```

### G2 — Conformidade por Serviço (BarChart horizontal)
Componente: `ConformidadeBarChart`
```
- recharts BarChart layout="vertical"
- Eixo Y: nomes dos serviços
- Eixo X: taxa 0–100%
- Cor da barra: verde ≥85%, amarelo ≥70%, vermelho <70%
- Label dentro da barra: "XX.X%"
- Badge de tendência ao lado: ↑ ↓ → (cores ok/warn/nc)
- Ordenado: menor taxa primeiro (destaca problemas no topo)
```

### G3 — Heatmap de Serviços × Período
Componente: `HeatmapServicos`
```
- Grid CSS (não recharts — mais controle)
- Célula: 40×40px, cor por taxa:
    null  → bg-[var(--bg-raised)] com "–"
    0–59  → vermelho [var(--nc-bg)] texto [var(--nc-text)]
    60–79 → amarelo [var(--warn-bg)] texto [var(--warn-text)]
    80–89 → verde claro
    90+   → verde forte [var(--ok-bg)] texto [var(--ok-text)]
- Tooltip ao hover: "Serviço X — Semana Y: Z% (N inspeções)"
- Header: períodos (sticky top)
- Coluna esquerda: serviços (sticky left)
- Scroll horizontal se muitos períodos
```

### G4 — Funil de Inspeções (custom SVG)
Componente: `FunilInspecoes`
```
- Funil SVG custom (não recharts — shape de funil real)
- 5 estágios verticais, cada um mais estreito:
    Total de Fichas (100% largura)
    Concluídas    (% concluidas/total)
    Aprovadas     (% aprovadas/total)
    Com NC        (% com_nc/total)  — cor alerta
    Com PA        (% com_pa/total)  — cor NC
- Label direita de cada etapa: número + %
- Hover: tooltip com definição do estágio
```

---

## Integração em `FvsDashboardPage`

```tsx
// Após o bloco de KPI existente:
<section className="space-y-6">
  <div className="flex items-center justify-between">
    <h2 className="text-base font-semibold text-[var(--text-high)]">Análise Visual</h2>
    <FiltrosPeriodo value={filtros} onChange={setFiltros} />
  </div>
  <GraficosAvancados obraId={obraIdNum} filtros={filtros} />
</section>
```

### Componente `FiltrosPeriodo`
- Seletor de período: Últimas 4 semanas | Últimos 3 meses | Últimos 6 meses | Personalizado
- Seletor de serviços: multi-select com "Todos" como padrão
- Estado no URL via `useSearchParams` (compartilhável)

### Skeleton loading
Cada gráfico tem seu skeleton de altura fixa (h-48 para barras, h-64 para heatmap e funil)
com `animate-pulse` enquanto `isLoading`.

---

## Cenários GWT

**Cenário 1: Engenheiro visualiza evolução temporal**
- Given: 3 meses de inspeções para serviços Alvenaria, Concreto, Impermeabilização
- When: Acessa Dashboard FVS, seleciona "Últimos 3 meses"
- Then: LineChart com 3 linhas coloridas, eixo X com semanas, linha target em 85%

**Cenário 2: Sem dados no período**
- Given: Dashboard filtrado para período sem inspeções
- When: Dados carregados
- Then: Gráficos mostram estado vazio ("Nenhuma inspeção no período selecionado")
  com ícone e sugestão de ampliar o filtro. Funil mostra zeros.

**Cenário 3: Heatmap destaca serviço crítico**
- Given: Serviço "Revestimento" com taxa 45% na semana 3
- When: Heatmap renderizado
- Then: Célula [Revestimento][Semana 3] em vermelho, tooltip: "45% (4 inspeções)"

**Cenário 4: Funil revela gargalo**
- Given: 100 fichas totais, 60 concluídas, 30 aprovadas, 20 com NC, 5 com PA
- When: Funil renderizado
- Then: Funil visualmente estreitando em cada etapa, label "20 com NC (20%)" em amarelo

**Edge cases:**
- Serviço com 0 inspeções no período: omitido do BarChart (não plotar zero)
- Muitos períodos no heatmap (>12): scroll horizontal ativo, células 32px
- API timeout: skeleton substituído por mensagem de erro com botão "Tentar novamente"

---

## Checklist de Validação

- [x] 4 componentes de gráfico especificados com tipo de chart e dados
- [x] Endpoint de agregação único especificado com response shape
- [x] SQL de referência para as queries mais complexas
- [x] Estados de loading, vazio e erro cobertos
- [x] Integração na página existente sem criar nova rota
- [x] Filtros URL-synced para compartilhamento
- [x] recharts usado (já instalado, sem nova dependência)
- [x] Heatmap com CSS Grid (melhor controle para essa visualização)
