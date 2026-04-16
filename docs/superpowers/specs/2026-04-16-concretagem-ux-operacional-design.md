# Concretagem UX Operacional — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevar o módulo de concretagem do Eldox v3 ao nível operacional: rename global betonada→concretagem, novo status EM_RASTREABILIDADE, Kanban como view padrão com cards ricos, e visualizações interativas de CPs e curva de resistência na página de detalhe.

**Data:** 2026-04-16

---

## 1. Rename Global: betonada → concretagem

### Escopo — full rename em todo o stack

| Camada | De | Para |
|---|---|---|
| Tabela Postgres | `betonadas` | `concretagens` |
| Enum Postgres | `StatusBetonada` | `StatusConcretagem` |
| Prisma model | `Betonada` | `Concretagem` |
| Rotas API | `/obras/:id/betonadas` | `/obras/:id/concretagens` |
| NestJS controller | `BetonadasController` | `ConcrtagensController` |
| NestJS service | `BetonadasService` | `ConcrtagensService` |
| NestJS module | `BetonadasModule` | `ConcrtagensModule` |
| DTOs | `CreateBetonadaDto` etc. | `CreateConcrtagemDto` etc. |
| Frontend hook | `useBetonadas` | `useConcretagens` |
| Frontend service | `concretagem.service` (já correto) | atualizar tipos internos |
| Frontend pages | `BetonadasListPage` | `ConcrtagensListPage` |
| Frontend components | `BetonadaFormModal` etc. | `ConcrtagemFormModal` etc. |
| Labels UI | "Betonada/Betonadas" | "Concretagem/Concretagens" |

### O que NÃO muda
- Módulo pai `ConcretagemModule` (já tem o nome correto)
- Estrutura de pastas `concretagem/` (mantém)
- Caminhões, CPs, dashboard — apenas remover referências a "betonada" nos labels

---

## 2. Novo Status: EM_RASTREABILIDADE

### Enum final: StatusConcretagem
```
PROGRAMADA | EM_LANCAMENTO | EM_RASTREABILIDADE | CONCLUIDA | CANCELADA
```

### Máquina de estados
```
PROGRAMADA → EM_LANCAMENTO      (início do lançamento / chegada do 1º caminhão)
EM_LANCAMENTO → EM_RASTREABILIDADE   (último caminhão concluído — todos os CPs coletados)
EM_RASTREABILIDADE → CONCLUIDA  (todos os CPs de 28d com resultado)
PROGRAMADA → CANCELADA          (cancelamento)
EM_LANCAMENTO → CANCELADA       (cancelamento em andamento)
```

### Transição automática EM_LANCAMENTO → EM_RASTREABILIDADE
Ao concluir um caminhão (`PATCH /caminhoes/:id/concluir`), o service verifica:
- Todos os caminhões desta concretagem têm `status = CONCLUIDO`
- Se sim: atualiza `concretagem.status = EM_RASTREABILIDADE`

### Transição automática EM_RASTREABILIDADE → CONCLUIDA
Ao registrar resultado de CP (`PATCH /cps/:id/resultado`), o service verifica:
- Todos os CPs desta concretagem com `idade_dias = 28` têm resultado (não estão em `AGUARDANDO_RUPTURA`)
- Se sim: atualiza `concretagem.status = CONCLUIDA`

### Migration
```sql
ALTER TYPE "StatusBetonada" RENAME TO "StatusConcretagem";
ALTER TYPE "StatusConcretagem" ADD VALUE 'EM_RASTREABILIDADE';
ALTER TABLE "betonadas" RENAME TO "concretagens";
```

---

## 3. Backend — listar() retorna dados de CPs

O endpoint `GET /obras/:obraId/concretagens` passa a incluir por concretagem:
- `cp_total: number` — total de CPs programados
- `cp_rompidos: number` — CPs com resultado (ROMPIDO_APROVADO ou ROMPIDO_REPROVADO)
- `proxima_ruptura_data: string | null` — data mais próxima entre CPs em AGUARDANDO_RUPTURA

Implementado via subquery/LEFT JOIN na query do `listar()`.

---

## 4. Frontend — ConcrtagensListPage

### Toggle kanban ↔ lista
- View padrão: **Kanban**
- Toggle (ícones ⊞ / ☰) no header direito
- Preferência persistida em `localStorage` key `eldox.concretagens.view`

### Kanban — 4 colunas
| Coluna | Status | Cor |
|---|---|---|
| Programadas | PROGRAMADA | accent (indigo) |
| Em Lançamento | EM_LANCAMENTO | warn (amber) |
| Em Rastreabilidade | EM_RASTREABILIDADE | ok (emerald) |
| Concluídas | CONCLUIDA | faint (slate) |

CANCELADA não aparece no Kanban. Fica acessível apenas na Lista com tab dedicada.

### Card rico (KanbanCard)
```
┌─────────────────────────────────┐
│ CONC-001              📅 15/04  │
│ Pilar P5 — Bloco A              │
│ 12 m³ · C30                     │
│ 🚛 2 caminhões  🧪 3/9 CPs      │
│ ████░░░░░░  próx: 30/04         │
└─────────────────────────────────┘
```
- Número da concretagem (font-mono)
- Elemento estrutural
- Volume previsto + fck
- Badge de caminhões (só se > 0)
- Badge de CPs + progress bar (só na coluna RASTREABILIDADE)
- Data do próximo rompimento (só na coluna RASTREABILIDADE)
- Border-left colorida pelo status

### Lista — tabs
Todas / Programadas / Em Lançamento / Em Rastreabilidade / Concluídas / Canceladas

Colunas da tabela: Número, Elemento, Vol. (m³), fck, Data Prog., CPs, Status, →

---

## 5. Frontend — ConcrtagemDetalhePage (CPs)

### Toggle timeline ↔ tabela
Mesmo padrão do toggle kanban/lista. Preferência em localStorage `eldox.concretagem.cp_view`.

### Timeline (view padrão)
Por caminhão, uma linha horizontal com 3 dots: **3d / 7d / 28d**

Estados dos dots:
- **Verde sólido** ✓ — rompido e aprovado (MPa ≥ fck)
- **Vermelho sólido** ✗ — rompido e reprovado (MPa < fck), gera NC automática
- **Tracejado cinza** … — data futura (mostra data prevista abaixo)
- **Tracejado âmbar** ⏱ — data vencida sem resultado (alerta)

Cada dot ao hover mostra tooltip com: data, resistência medida (se houver), resultado.

Cabeçalho do caminhão: `🚛 CONC-001-C01 · NF 4821 · 4,2 m³ · chegou 08:15`

### Tabela (view alternativa)
Colunas: Nº CP · Caminhão · Idade · Data Rup. · Resistência · Status

---

## 6. Frontend — Curva de Resistência (Recharts)

### Comportamento
- Uma linha por caminhão, cada um com cor distinta do palette
- Linha horizontal vermelha tracejada = fck especificado
- Eixo X: dias (0, 3, 7, 28) — escala logarítmica opcional
- Eixo Y: MPa

### Interatividade
**Legenda clicável** (abaixo do gráfico):
- Clique em um caminhão na legenda: isola aquele caminhão (outros ficam com opacity 0.2)
- Clique no caminhão já isolado: volta a mostrar todos
- Estado "todos visíveis" é o padrão

**Clique em linha/ponto do caminhão:**
- Abre drawer lateral (ou modal) com o histórico completo do caminhão:
  - NF / romaneio
  - Fornecedor, volume, hora chegada, hora saída
  - Responsável pelo recebimento
  - Tabela de todos os CPs daquele caminhão com resultados
  - Se houve NC automática gerada, link para a NC

### Implementação
- Biblioteca: `recharts` (já usada no projeto)
- Componente: `CurvaResistenciaChart` em `concretagem/concretagens/components/`
- Props: `concretagemId`, `fck`
- Busca dados via `useQuery` próprio (`/concretagens/:id/curva-resistencia` ou derivado dos CPs já carregados)

---

## 7. Arquivo de referência de rotas após rename

| Método | Rota | Descrição |
|---|---|---|
| GET | `/obras/:obraId/concretagens` | Listar com cp_total, cp_rompidos, proxima_ruptura_data |
| POST | `/obras/:obraId/concretagens` | Criar |
| GET | `/obras/:obraId/concretagens/:id` | Detalhe |
| PATCH | `/obras/:obraId/concretagens/:id` | Atualizar |
| DELETE | `/obras/:obraId/concretagens/:id` | Cancelar |
| GET | `/obras/:obraId/concretagens/:id/caminhoes` | Caminhões da concretagem |
| GET | `/obras/:obraId/concretagens/:id/cps` | CPs da concretagem |

Caminhões e CPs mantêm suas rotas internas (não são renomeados).

---

## 8. Fora de escopo (próxima sprint)

- Laboratórios e laudos
- Exportação PDF da curva de resistência
- Filtro por período no Kanban
- Arrastar cards entre colunas (drag-and-drop Kanban)
- Cálculo estatístico (desvio padrão, fck característico)
