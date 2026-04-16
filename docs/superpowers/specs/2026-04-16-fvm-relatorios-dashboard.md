# Spec: FVM — Relatórios Exportáveis + Dashboard
Versão: 1.0
Status: Aprovada
Data: 2026-04-16

---

## Contexto

O módulo FVM tem dados ricos em `fvm_lotes`, `fvm_registros`, `fvm_nao_conformidades` e
`fvm_ensaios` mas nenhum dashboard de KPIs nem exportação. Esta spec adiciona:
1. **Dashboard FVM** — KPIs + 2 gráficos agregados por obra
2. **3 Relatórios exportáveis** — Ficha de Recebimento (PDF), NCs FVM (PDF+Excel), 
   Performance de Fornecedores (PDF+Excel)

Avaliação automática de fornecedores e rastreabilidade de usos (`fvm_lote_usos`) ficam
para spec posterior.

---

## Escopo

- Nova página: `DashboardFvmPage` em `/obras/:obraId/fvm`
  - Atualmente `/obras/:obraId/fvm` não existe como rota — a entrada principal é `/fvm/obras/:obraId`
  - **Não criar nova rota**: adicionar dashboard como tab dentro de `GradeMateriaisPage`
- Relatórios gerados 100% client-side (@react-pdf/renderer + exceljs)
- Dois endpoints backend novos (agregação)

---

## 1. Dashboard FVM

### Integração na GradeMateriaisPage

A `GradeMateriaisPage` ganha uma tab "Dashboard" no topo (junto à grade que já existe):

```tsx
// Tabs adicionadas ao topo da GradeMateriaisPage
const [aba, setAba] = useState<'grade' | 'dashboard'>('grade')
```

### KPIs (linha de 4 cards)

Dados de `GET /api/v1/fvm/obras/:obraId/dashboard`:

```typescript
interface FvmDashboardKpis {
  lotes_recebidos_total: number
  lotes_aprovados: number
  lotes_em_quarentena: number
  lotes_reprovados: number
  taxa_aprovacao: number          // (aprovados + aprovados_com_ressalva) / total * 100
  ncs_abertas: number
  ncs_criticas_abertas: number
  ensaios_reprovados: number      // fvm_ensaios com resultado = 'REPROVADO'
}
```

Cards:
```
[Total Lotes Recebidos]  [Taxa Aprovação %]  [NCs Abertas]  [Em Quarentena]
```

### G1 — Aprovação por Categoria de Material (BarChart horizontal)
- Eixo Y: categorias (ex: Aço, Cimento, Concreto...)
- Eixo X: taxa aprovação 0–100%
- Cor por taxa: verde/amarelo/vermelho (mesma lógica FVS)
- Badge: total de lotes por categoria ao lado

### G2 — Evolução de Lotes Recebidos por Semana (BarChart empilhado)
- Eixo X: semanas
- Barras empilhadas: aprovado (verde), quarentena (amarelo), reprovado (vermelho)
- Útil para ver sazonalidade de recebimentos

### Endpoint de Agregação
```
GET /api/v1/fvm/obras/:obraId/dashboard
Query: data_inicio, data_fim (opcional, default: últimos 90 dias)
Authorization: VISITOR+

Response:
{
  kpis: FvmDashboardKpis,
  por_categoria: {
    categoria_id: number,
    categoria_nome: string,
    total_lotes: number,
    taxa_aprovacao: number,
  }[],
  evolucao_semanal: {
    semana: string,      // "2026-W15"
    aprovados: number,
    quarentena: number,
    reprovados: number,
    aguardando: number,
  }[]
}
```

**SQL de referência:**
```sql
-- KPIs
SELECT
  COUNT(*)::int AS lotes_recebidos_total,
  COUNT(*) FILTER (WHERE status IN ('aprovado','aprovado_com_ressalva'))::int AS lotes_aprovados,
  COUNT(*) FILTER (WHERE status = 'quarentena')::int AS lotes_em_quarentena,
  COUNT(*) FILTER (WHERE status = 'reprovado')::int AS lotes_reprovados,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('aprovado','aprovado_com_ressalva')) /
    NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('aguardando_inspecao','cancelado')), 0),
    1
  ) AS taxa_aprovacao
FROM fvm_lotes
WHERE tenant_id = $1 AND obra_id = $2 AND deleted_at IS NULL;

-- NCs abertas
SELECT COUNT(*)::int AS ncs_abertas,
       COUNT(*) FILTER (WHERE criticidade = 'critico')::int AS ncs_criticas_abertas
FROM fvm_nao_conformidades
WHERE tenant_id = $1 AND obra_id = $2
  AND status NOT IN ('encerrada','cancelada');
```

---

## 2. Relatórios FVM

### R-FVM1 — Ficha de Recebimento (PDF)
**Conteúdo:** Documento formal de recebimento de um lote.
- Cabeçalho: logo tenant, obra, data de geração
- Seção 1 — Identificação do Lote: material, fornecedor, NF, número do lote, data entrega,
  qtd NF vs qtd recebida, observação geral
- Seção 2 — Resultado da Inspeção: status badge, inspecionado por, data/hora
- Seção 3 — Checklist: tabela item | tipo | resultado | observação
- Seção 4 — Ensaios (se houver): tabela ensaio | norma | valor medido | min/max | resultado
- Seção 5 — Evidências: lista de documentos vinculados (tipo + nome)
- Seção 6 — NCs (se houver): tabela NC # | item | criticidade | ação imediata | status
- Rodapé: "Gerado pelo Eldox em {data}" + lote ID
**Formato:** PDF only
**Trigger:** Botão "Exportar Ficha" na `FichaLotePage`

### R-FVM2 — Relatório de NCs FVM
**Conteúdo:** Todas as NCs de materiais numa obra num período.
- Filtros: obra, período, status, criticidade, fornecedor
- Tabela: NC # | lote | material | fornecedor | criticidade | tipo | status | prazo | SLA
- Agrupamento por fornecedor (separadores)
- Resumo por criticidade (pizza inline)
- SLA: % no prazo, % vencidas
**Formato:** PDF + Excel
**Trigger:** Botão "Exportar" em painel de NCs FVM (a ser criado junto com o dashboard)

### R-FVM3 — Performance de Fornecedores
**Conteúdo:** Score por fornecedor baseado nos dados reais de inspeção.
- Filtros: obra (opcional — pode ser por tenant), período
- Por fornecedor: nome, CNPJ, total lotes, taxa aprovação, total NCs, NCs críticas, 
  ensaios reprovados, score composto (0–100)
- Cálculo do score:
  ```
  score = (taxa_aprovacao * 0.5) 
        + ((1 - ncs_criticas/total_lotes) * 100 * 0.3)
        + ((1 - ensaios_reprovados/total_ensaios) * 100 * 0.2)
  ```
  Score salvo em `fvm_fornecedores.avaliacao_score` após geração
- Ranking visual no PDF: posição, nome, score com semáforo (verde/amarelo/vermelho)
**Formato:** PDF + Excel
**Trigger:** Botão "Relatório de Performance" na `FornecedoresPage`

---

## Arquitetura de Arquivos Frontend

```
frontend-web/src/modules/fvm/
├── dashboard/
│   ├── DashboardFvmTab.tsx          (CRIAR — conteúdo da tab Dashboard)
│   ├── hooks/
│   │   └── useFvmDashboard.ts       (CRIAR)
│   └── components/
│       ├── FvmKpiCards.tsx          (CRIAR)
│       ├── AprovacaoCategoriaChart.tsx (CRIAR)
│       └── EvolucaoLotesChart.tsx   (CRIAR)
└── relatorios/
    ├── pdf/
    │   ├── FichaRecebimentoPdf.tsx      (CRIAR — R-FVM1)
    │   ├── NcsFvmPdf.tsx               (CRIAR — R-FVM2)
    │   └── PerformanceFornecedoresPdf.tsx (CRIAR — R-FVM3)
    └── excel/
        ├── NcsFvmXlsx.ts               (CRIAR — R-FVM2)
        └── PerformanceFornecedoresXlsx.ts (CRIAR — R-FVM3)
```

`GradeMateriaisPage.tsx` — MODIFICAR: adicionar tabs grade/dashboard e botão exportar na toolbar.
`FichaLotePage.tsx` — MODIFICAR: adicionar botão "Exportar Ficha PDF".
`FornecedoresPage.tsx` — MODIFICAR: adicionar botão "Relatório de Performance".

---

## Cenários GWT

**Cenário 1: Técnico abre tab Dashboard FVM**
- Given: Obra com 50 lotes recebidos no último trimestre
- When: Acessa `/fvm/obras/5` e clica na tab "Dashboard"
- Then: KPIs mostram 50 lotes, taxa 84%, 3 NCs abertas, 2 em quarentena
  BarChart mostra categorias com Aço em 95% e Cimento em 72%

**Cenário 2: Exporta ficha de recebimento (R-FVM1)**
- Given: Lote aprovado_com_ressalva, 2 NCs registradas, 3 itens do checklist avaliados
- When: Engenheiro clica "Exportar Ficha PDF" na FichaLotePage
- Then: PDF gerado com todas as seções, NCs com ação imediata descritas

**Cenário 3: Performance de fornecedor calculada e salva (R-FVM3)**
- Given: Fornecedor "Concretex" com 20 lotes, taxa_aprovacao=80%, 1 NC crítica, 2 ensaios reprovados
- When: Relatório de Performance gerado
- Then: Score calculado = (80*0.5) + ((1-1/20)*100*0.3) + ((1-2/10)*100*0.2)
  = 40 + 28.5 + 16 = 84.5 — `avaliacao_score` atualizado no banco

**Cenário 4: Dashboard sem inspeções concluídas**
- Given: Obra com 5 lotes todos em `aguardando_inspecao`
- When: Tab Dashboard aberta
- Then: KPIs mostram "0%" taxa aprovação com estado vazio amigável:
  "Nenhuma inspeção concluída ainda — comece pela Grade de Materiais"

**Edge cases:**
- Fornecedor sem nenhum lote no período: omitido do relatório R-FVM3 (sem divisão por zero)
- Lote sem ensaios: seção 4 omitida no PDF R-FVM1
- Score negativo (edge matemático): clamped to 0

---

## Checklist de Validação

- [x] Dashboard integrado como tab (sem nova rota)
- [x] KPIs com campos e SQL especificados
- [x] 2 gráficos especificados com recharts
- [x] Endpoint de agregação único especificado
- [x] 3 relatórios com conteúdo detalhado
- [x] Score de fornecedor com fórmula explícita e atualização no banco
- [x] Geração 100% client-side
- [x] Integração em páginas existentes mapeada
- [x] Dependências: @react-pdf/renderer + exceljs (mesmas dos relatórios FVS)
