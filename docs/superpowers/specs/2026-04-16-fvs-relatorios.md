# Spec: FVS — Relatórios Exportáveis (5 tipos)
Versão: 1.0
Status: Aprovada
Data: 2026-04-16

---

## Contexto

O Eldox FVS possui inspeções ricas (checklist, NCs, evidências, fotos) mas nenhum mecanismo
de exportação. Engenheiros precisam enviar relatórios para clientes, fiscais e acervos de obra.
O AutoDoc exporta 5 tipos distintos de relatório (PDF + Excel). Esta spec define os mesmos 5
tipos com a identidade visual do Eldox.

---

## Tipos de Relatório

### R1 — Ficha de Inspeção Individual
**Conteúdo:** Uma inspeção completa em PDF formal.
- Cabeçalho: logo do tenant, nome da obra, serviço, data, responsável
- Checklist item a item (ícones ✓/✗/—, observações)
- Galeria de evidências (fotos em grid 2×N, documentos listados)
- NCs registradas (tabela: item, criticidade, descrição, ação tomada)
- Assinatura digital do inspetor (nome + data + papel)
- Rodapé: "Gerado pelo Eldox em {data}" + número da ficha
**Formato:** PDF only
**Trigger:** Botão "Exportar PDF" na página de detalhes da inspeção

### R2 — Relatório de Conformidade por Serviço
**Conteúdo:** Consolidado de todas as inspeções de um serviço numa obra.
- Filtros aplicados: obra, serviço, período
- Tabela: ficha # | data | inspetor | local | itens OK | itens NC | taxa %
- Gráfico de barras inline (base64 no PDF): taxa de conformidade por semana
- Total de NCs por criticidade
- Última inspeção de cada local (destaca pendências)
**Formato:** PDF + Excel
**Trigger:** Botão "Exportar" na página de grade FVS com filtro ativo

### R3 — Relatório de Pendências
**Conteúdo:** Fichas não concluídas e itens reprovados sem ação.
- Filtros: obra, período, inspetor, criticidade
- Seção 1: Inspeções em aberto (nunca finalizadas)
- Seção 2: NCs sem Plano de Ação vinculado
- Seção 3: Planos de Ação vencidos (prazo ultrapassado)
- Por local: prioridade de atenção (badge URGENTE / NORMAL)
**Formato:** PDF + Excel
**Trigger:** Atalho no Dashboard FVS — "Gerar Relatório de Pendências"

### R4 — Relatório de Não Conformidades
**Conteúdo:** Todas as NCs de uma obra num período.
- Filtros: obra, status NC, criticidade, serviço, período
- Tabela detalhada: NC # | ficha | serviço | item | criticidade | status | responsável | prazo
- Agrupamento por serviço (separador com sub-total)
- Gráfico pizza inline: distribuição por criticidade
- SLA stats: % no prazo, % vencidas
**Formato:** PDF + Excel
**Trigger:** Botão "Exportar" na lista de NCs FVS

### R5 — Relatório de Planos de Ação
**Conteúdo:** Status de todos os PAs de uma obra.
- Filtros: obra, etapa, prioridade, responsável, período
- Tabela: PA # | título | origem | etapa atual | prioridade | responsável | prazo | dias aberto
- Agrupamento por etapa (Kanban em texto)
- Destaque para PAs vencidos (linha em vermelho)
- Resumo: abertos, em andamento, fechados este mês
**Formato:** PDF + Excel
**Trigger:** Botão "Exportar" na PlanosAcaoPage

---

## Decisões Técnicas

### Geração de PDF
Usar **`@react-pdf/renderer`** (já disponível como dependência comum em projetos React).
- Templates React → renderizados no browser → blob → download
- Gráficos inline: gerar SVG/canvas via recharts no DOM, converter para base64, embeddar no PDF
- Vantagem: templates reutilizáveis entre relatórios, sem dependência de servidor

### Geração de Excel
Usar **`exceljs`** (biblioteca leve, 100% browser-side via webpack).
- Criar workbook programaticamente
- Estilos: cabeçalho em azul Eldox (#2563EB), bordas leves, zebra-striping
- Congelar primeira linha (headers fixos ao scroll)

### Arquitetura de módulo
```
frontend-web/src/modules/fvs/relatorios/
├── types.ts                   (ReportConfig, ReportFilter interfaces)
├── hooks/
│   └── useRelatorioFvs.ts     (TanStack Query + download trigger)
├── pdf/
│   ├── templates/
│   │   ├── FichaInspecaoPdf.tsx      (R1)
│   │   ├── ConformidadePdf.tsx       (R2)
│   │   ├── PendenciasPdf.tsx         (R3)
│   │   ├── NcsPdf.tsx                (R4)
│   │   └── PlanoAcaoPdf.tsx          (R5)
│   └── PdfRenderer.tsx              (wrapper: pdf() → blob → URL.createObjectURL)
└── excel/
    ├── ConformidadeXlsx.ts   (R2)
    ├── PendenciasXlsx.ts     (R3)
    ├── NcsXlsx.ts            (R4)
    └── PlanoAcaoXlsx.ts      (R5)
```

### Backend (dados apenas)
Os relatórios são gerados 100% no browser. O backend fornece dados existentes via endpoints
já especificados. **Não há endpoint novo de "relatório"** — os dados vêm dos endpoints normais
com filtros existentes ou pequenas extensões.

Exceção: R2 (Conformidade por Serviço) precisa de um endpoint novo de agregação:
```
GET /api/v1/fvs/obras/:obraId/relatorio-conformidade
Query params: servico_id, data_inicio, data_fim
Response: { por_semana: [{semana, total, aprovadas, taxa}], por_local: [...], ncs_por_criticidade: {...} }
```

---

## Interface de Download

### Componente `RelatorioBotao`
```tsx
<RelatorioBotao
  tipo="R1_FICHA" | "R2_CONFORMIDADE" | "R3_PENDENCIAS" | "R4_NCS" | "R5_PA"
  filtros={{ obraId, ...parametros }}
  formatos={['pdf'] | ['pdf','excel']}
/>
```

Comportamento:
1. Usuário clica no botão
2. Se filtros incompletos → abre modal de seleção de filtros
3. Loading spinner enquanto busca dados
4. Após dados carregados → gera PDF/Excel no browser
5. Dispara download automático com nome: `eldox-{tipo}-{obra}-{data}.pdf`

### Integração nas páginas existentes
- `InspecaoDetalhePage`: adicionar `<RelatorioBotao tipo="R1_FICHA" />` no header
- `GradeMateriaisPage` (FVS): adicionar `<RelatorioBotao tipo="R2_CONFORMIDADE" />` na toolbar
- `DashboardFvsPage`: card atalho "Relatório de Pendências" → `RelatorioBotao tipo="R3_PENDENCIAS"`
- `NcsPage` (FVS): botão "Exportar" → `RelatorioBotao tipo="R4_NCS" formatos={['pdf','excel']}`
- `PlanosAcaoPage`: botão "Exportar" → `RelatorioBotao tipo="R5_PA" formatos={['pdf','excel']}`

---

## Cenários GWT

**Cenário 1: Engenheiro exporta ficha de inspeção (R1)**
- Given: Inspeção concluída com 3 NCs e 2 fotos anexadas
- When: Clica "Exportar PDF" na página de detalhes
- Then: PDF gerado no browser, download automático, conteúdo inclui checklist completo,
  fotos em grid, tabela de NCs, assinatura do inspetor

**Cenário 2: Engenheiro exporta conformidade por serviço em Excel (R2)**
- Given: Filtro ativo: obra=5, serviço="Alvenaria", período=Março 2026
- When: Clica "Exportar Excel"
- Then: .xlsx gerado, linhas zebradas, cabeçalho em azul Eldox, primeira linha congelada

**Cenário 3: Relatório com dados insuficientes**
- Given: Filtro sem `data_inicio` em R3 (campo obrigatório)
- When: Usuário tenta gerar
- Then: Modal de filtros abre, campo destacado em vermelho, geração bloqueada até preencher

**Cenário 4: Gráfico inline no PDF (R2)**
- Given: R2 com 8 semanas de dados
- When: PDF gerado
- Then: Gráfico de barras inline como base64, legível sem zoom, cores da identidade Eldox

**Edge cases:**
- Inspeção sem fotos: seção de evidências omitida no PDF (sem espaço em branco)
- Excel com 0 linhas: sheet com cabeçalho + linha "Nenhum registro encontrado"
- Ficha com observações muito longas: truncado em 500 chars com "..." no PDF

---

## Checklist de Validação

- [x] 5 tipos de relatório especificados com conteúdo preciso
- [x] Geração 100% client-side (sem carga extra no servidor)
- [x] Único endpoint backend novo identificado (R2 agregação)
- [x] Integração nas páginas existentes mapeada
- [x] Comportamento de loading e erro especificado
- [x] Nome de arquivo de download padronizado
- [x] Edge cases de dados vazios cobertos
