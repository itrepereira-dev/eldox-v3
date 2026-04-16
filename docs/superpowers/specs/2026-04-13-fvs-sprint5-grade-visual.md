# FVS Sprint 5 — Grade Visual Completa

**Data:** 13/04/2026
**Spec:** `docs/superpowers/specs/2026-04-13-fvs-sprint5-grade-visual.md`
**Sprint anterior:** Sprint 4b — NCs Explícitas + Ciclo de Status Completo
**Próximo:** Sprint 6 — Relatórios e Dossiê PBQP-H
**Fonte de requisito:** Engenharia reversa AutoDoc FVS + SugestãoFVSGRID.jpeg + PLANO_FVS_REDESENHO.docx

---

## 1. Objetivo

Entregar a tela mais importante do produto: a **Grade Matricial de Status** (serviços × unidades), funcional, filtrada e com ações contextuais — equivalente ao "FVS Principal" do AutoDoc.

O `FichaGradePage.tsx` atual exibe a grade mas está incompleta. Este sprint o torna o núcleo da experiência do módulo FVS.

---

## 2. Contexto

### O que já existe

- `FichaGradePage.tsx` — grade funcional com células coloridas (Sprint 2)
- `GET /fvs/fichas/:fichaId/grade` — endpoint de grade com `celulas[servicoId][localId]`
- `FichaLocalPage.tsx` — preenchimento de itens por local, funcional

### Gaps identificados na engenharia reversa

| Gap | Impacto |
|-----|---------|
| Sem filtros por torre/bloco, pavimento ou serviço na grade | Gestor não consegue focar em um subconjunto da obra |
| Clicar na célula navega para outra página | Interrompe o contexto — no AutoDoc abre drawer lateral |
| Sem inspeção em massa na grade | Inspecionar uma torre inteira requer clicar célula por célula |
| Sem indicador de progresso geral proeminente | Gestor não vê % de aprovação da obra de relance |
| `StatusGrade` com 4 estados não reflete ciclo completo | Após Sprint 4b, novos estados precisam de cores/ícones |
| Grade não agrupa locais por pavimento | Difícil navegar em obras com 200+ unidades |

---

## 3. Layout e UX

### 3.1 Estrutura da tela

```
┌─ Header ────────────────────────────────────────────────────────────┐
│  FVS: Europarques Torre 1    [Ficha: Em Inspeção]    [Exportar ▼]   │
│  Progresso geral: ████████░░ 78% aprovadas (94/120 unidades)       │
└─────────────────────────────────────────────────────────────────────┘
┌─ Filtros ───────────────────────────────────────────────────────────┐
│  Torre/Bloco: [Torre 1 ▼]  Pavimento: [Todos ▼]  Status: [Todos ▼] │
│  Serviço:    [Todos ▼]                          [Limpar filtros]    │
└─────────────────────────────────────────────────────────────────────┘
┌─ Grade ─────────────────────────────────────────────────────────────┐
│  Serviço        │ 101 │ 102 │ 103 │ 201 │ 202 │ 203 │ 301 │ 302   │
│─────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────  │
│  Alvenaria      │  ✅  │  ✅  │  ⚠️  │  ✅  │  ──  │  ──  │  ──  │  ──  │
│  Revestimento   │  ✅  │  ❌  │  ──  │  ──  │  ──  │  ──  │  ──  │  ──  │
│  Inst. Elétrica │  ⚠️  │  ──  │  ──  │  ──  │  ──  │  ──  │  ──  │  ──  │
└─────────────────────────────────────────────────────────────────────┘
┌─ Legenda ───────────────────────────────────────────────────────────┐
│  ✅ Aprovado  ❌ NC  ⚠️ Pendente  ── Não avaliado  🔒 NC Final       │
└─────────────────────────────────────────────────────────────────────┘
```

> **Referência visual:** `screen-analysis/FVS/SugestãoFVSGRID.jpeg`

### 3.2 Comportamento dos filtros

- Todos os filtros são **client-side** sobre os dados já carregados (`/grade` response)
- Filtro de **Pavimento**: agrupa locais por pavimento e exibe só as colunas do pavimento selecionado
- Filtro de **Serviço**: exibe apenas as linhas do serviço selecionado
- Filtro de **Status**: exibe apenas células com o status selecionado (oculta células de outros status)
- Filtros combinam com AND
- URL atualiza query params ao aplicar filtros (deep linking)

### 3.3 Células da grade

| Status | Cor | Ícone | Tooltip |
|--------|-----|-------|---------|
| `nao_avaliado` | Cinza #E5E7EB | `—` | "Não inspecionado" |
| `parcial` | Azul claro #BFDBFE | `◐` | "Em andamento (X/Y itens)" |
| `aprovado` | Verde #BBFFD9 | `✅` | "Aprovado — {inspetor} em {data}" |
| `nc` | Vermelho #FECACA | `❌` | "NC aberta — {N} itens pendentes" |
| `nc_final` | Vermelho escuro #991B1B | `🔒` | "NC após reinspeção (não corrigida)" |
| `liberado` | Amarelo #FEF08A | `⚡` | "Liberado com concessão" |
| `pendente` | Laranja #FED7AA | `⚠️` | "Pendente — {N} itens não avaliados" |

**Clique na célula** → abre **Drawer lateral** (não navega para outra página).

### 3.4 Drawer lateral (Detail Drawer)

Abre ao clicar em qualquer célula avaliada (não `nao_avaliado`):

```
┌─ Drawer: Alvenaria · Ap 302 ──────────────────────────┐
│  Status: ⚠️ Pendente                                   │
│  Inspetor: João Silva                                  │
│  Última atividade: 13/04/2026 09:32                    │
├───────────────────────────────────────────────────────┤
│  # │ Item de Verificação              │ Status  │ Obs │
│  1 │ Blocos alinhados (máx. 3mm/m)   │ CONF.   │ —   │
│  2 │ Juntas com espessura uniforme    │ N.CONF. │ ... │
│  3 │ Amarração na estrutura (3 fiadas)│ N.AVAL. │ —   │
│  4 │ Vergas e contravergas instaladas │ CONF.   │ —   │
│  5 │ Encunhamento correto             │ EXCEÇÃO │ ... │
├───────────────────────────────────────────────────────┤
│  [Ir para inspeção completa →]                        │
└───────────────────────────────────────────────────────┘
```

O drawer não permite edição — é somente visualização. Para inspecionar, o botão "Ir para inspeção completa" navega para `FichaLocalPage`.

### 3.5 Seleção em massa (header de coluna/linha)

- **Clicar no nome da unidade** (ex: "Ap 102") → seleciona todos os serviços dessa unidade
- **Clicar no nome do serviço** (ex: "Alvenaria") → seleciona todas as unidades desse serviço
- **Barra de ação flutuante** aparece quando há seleção:
  - `Inspecionar todos como Conforme`
  - `Marcar como Exceção`
  - `Cancelar seleção`
- Ação em massa chama o `POST .../registros/bulk` (definido no Sprint 4b)
- Células já avaliadas na seleção são ignoradas (comportamento definido no bulk endpoint)

### 3.6 Agrupamento por pavimento

Quando o filtro de Pavimento está em "Todos":
- Colunas são agrupadas visualmente com cabeçalho de pavimento:

```
         │──── 1º Pavimento ────│──── 2º Pavimento ─────│
Serviço  │ 101 │ 102 │ 103 │ 104 │ 201 │ 202 │ 203 │ 204 │
```

---

## 4. Endpoints Novos / Modificados

### 4.1 `GET /fvs/fichas/:fichaId/grade` — modificar

> Adicionar suporte a filtros e agrupamento por pavimento.

**Parâmetros novos:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `pavimentoId` | number (opcional) | Filtra locais de um pavimento específico |
| `servicoId` | number (opcional) | Filtra por serviço específico |

> Os filtros de `status` e `torre` são client-side (não precisam de param no backend).

**Mudanças no response:**

```typescript
interface FvsGrade {
  servicos: { id: number; nome: string; codigo?: string }[];
  locais: {
    id: number;
    nome: string;
    pavimento_id: number | null;
    pavimento_nome: string | null;  // NOVO
    ordem: number;                  // NOVO — para ordenação correta
  }[];
  celulas: Record<number, Record<number, StatusGrade>>;  // [servicoId][localId]
  // NOVO: metadados por célula para o tooltip
  celulas_meta: Record<number, Record<number, {
    itens_total: number;
    itens_avaliados: number;
    itens_nc: number;
    ultimo_inspetor?: string;
    ultima_atividade?: string; // ISO 8601
  }>>;
  // NOVO: resumo geral
  resumo: {
    total_celulas: number;
    aprovadas: number;
    nc: number;
    nc_final: number;
    liberadas: number;
    parciais: number;
    nao_avaliadas: number;
    pendentes: number;
    progresso_pct: number;  // aprovadas / total_celulas * 100
  };
}
```

---

### 4.2 `GET /fvs/fichas/:fichaId/locais/:localId/servico/:servicoId/preview`

> Dados do drawer lateral — itens do serviço no local, com status de cada item.

**Permissão:** `requireAuth()`

```typescript
// Response 200
{
  "status": "success",
  "data": {
    "servico_nome": "Alvenaria de Vedação",
    "local_nome": "Ap. 302",
    "status_geral": "pendente",
    "inspetor_nome": "João Silva",
    "ultima_atividade": "2026-04-13T09:32:00Z",
    "itens": [
      {
        "id": 1,
        "descricao": "Blocos alinhados (desvio máx. 3mm/m)",
        "criterio_aceite": "Desvio ≤ 3mm/m verificado com régua",
        "criticidade": "maior",
        "status": "conforme",
        "observacao": null
      }
    ]
  }
}
```

---

## 5. Performance

### Requisito de performance

- Grade com até **500 unidades × 20 serviços** (10.000 células) deve carregar em **< 3 segundos**
- Drawer lateral deve abrir em **< 500ms**
- Filtro client-side deve responder em **< 100ms** (sem requisição ao backend)

### Estratégias

1. **Query otimizada da grade:** usar `GROUP BY servico_id, obra_local_id` com `MAX(ciclo)` para obter o status mais recente por célula — evitar N+1 queries
2. **celulas_meta** é opcional: incluir no response apenas quando `include_meta=true` no query param (não carregar por padrão para grades grandes)
3. **Virtualização de linhas:** `FichaGradePage` deve usar lista virtualizada (react-virtual ou similar) quando houver mais de 50 serviços ou 100 locais
4. **Agrupamento no frontend:** agrupamento por pavimento é 100% client-side (dados já vêm com `pavimento_id`)

---

## 6. Cenários GWT

### Feature: Grade Visual com Filtros
**Módulo:** FVS — Grade  
**Ator:** Gestor de Qualidade, Engenheiro

---

**Cenário 1 (caminho feliz) — Grade carregada com resumo**

```
Given: Ficha id=42 em_inspecao, 3 serviços, 8 locais (120 celulas total)
       80 células aprovadas, 15 nc, 25 nao_avaliadas
When:  GET /fvs/fichas/42/grade
Then:  HTTP 200
       celulas[1][101] = 'aprovado', celulas[2][102] = 'nc', etc.
       resumo.aprovadas = 80, resumo.nc = 15, resumo.nao_avaliadas = 25
       resumo.progresso_pct = 66.7
```

---

**Cenário 2 — Drawer lateral abre com dados corretos**

```
Given: Serviço id=1 (Alvenaria), local id=302, 5 itens
       2 itens conforme, 1 nao_conforme, 1 nao_avaliado, 1 excecao
When:  GET /fvs/fichas/42/locais/302/servico/1/preview
Then:  HTTP 200
       status_geral = 'pendente'
       itens.length = 5
       itens[1].status = 'nao_conforme'
```

---

**Cenário 3 — Filtro por pavimento retorna só locais do pavimento**

```
Given: Ficha com locais: 101-108 (1º pav), 201-208 (2º pav)
When:  GET /fvs/fichas/42/grade?pavimentoId=1
Then:  HTTP 200
       locais.length = 8 (apenas 101-108)
       celulas contém apenas chaves 101-108
```

---

**Cenário 4 (erro) — Acesso a ficha de outro tenant**

```
Given: Ficha id=42 pertence ao tenant 1
       Requisição com JWT do tenant 2
When:  GET /fvs/fichas/42/grade
Then:  HTTP 404
       { "status": "error", "message": "Ficha 42 não encontrada" }
```

---

**Edge cases:**

| Situação | Comportamento esperado |
|----------|----------------------|
| Grade com 0 locais | `locais: [], celulas: {}`, `resumo.total_celulas = 0` |
| Ficha sem nenhum item inspecionado | Todas as células `nao_avaliado`, `progresso_pct = 0` |
| Local com todos os itens marcados como `excecao` | StatusGrade = `aprovado` (exceção é um resultado válido) |
| Filtro `pavimentoId` para pavimento inexistente | HTTP 404: `"Pavimento não encontrado"` |
| `include_meta=true` em grade com 500+ unidades | Permitido — avisar no response se duração > 2s via header `X-Warning` |

---

## 7. Critérios de Aceite (Sprint 5)

| CA | Descrição |
|----|-----------|
| CA-01 | Grade exibe todos os serviços × todas as unidades do filtro ativo |
| CA-02 | Filtro de pavimento atualiza colunas sem reload da página |
| CA-03 | Filtro de serviço atualiza linhas sem reload da página |
| CA-04 | Filtro de status oculta células de outros status |
| CA-05 | Clicar numa célula abre drawer lateral sem navegar de página |
| CA-06 | Drawer lateral exibe itens do local com status individual correto |
| CA-07 | Clique no nome da unidade seleciona todos os serviços daquela unidade |
| CA-08 | Ação "Inspecionar todos como Conforme" chama bulk endpoint e atualiza grade |
| CA-09 | Barra de progresso exibe % correto (aprovadas / total) |
| CA-10 | Novos status (nc_final, liberado, parcial) têm cor e ícone corretos |
| CA-11 | Locais são agrupados por pavimento no cabeçalho quando Pavimento = Todos |
| CA-12 | Grade com 500 unidades × 20 serviços carrega em < 3 segundos |
| CA-13 | URL atualiza query params ao aplicar filtros (deep linking) |

---

## 8. Checklist de Validação da Spec

- [x] Layout e comportamento UX definidos com clareza
- [x] Mudanças no response do endpoint de grade especificadas
- [x] Endpoint de preview do drawer lateral especificado
- [x] Requisitos de performance com métricas concretas
- [x] Todos os cenários GWT cobertos (feliz, erro, edge cases)
- [x] Status gráficos mapeados para cores e ícones
- [x] Seleção em massa integrada com bulk endpoint do Sprint 4b
- [x] `tenant_id` em todas as queries
- [x] 13 Critérios de Aceite verificáveis
