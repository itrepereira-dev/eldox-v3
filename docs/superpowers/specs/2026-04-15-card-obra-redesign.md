# Design Spec — Card de Obra Redesenhado
**Data:** 2026-04-15
**Status:** Aprovado pelo PO
**Escopo:** SPEC 03 (cards visuais) — subset do P1 de melhorias de obras

---

## Contexto

O card atual de obra na `ObrasListPage` tem três problemas:
1. Barra de prazo hardcoded em 40% (bug visual)
2. Contador mostra apenas `totalLocais` — faltam inspeções e fotos
3. Sem foto de capa real (usa gradient CSS como placeholder)

O redesign resolve os três sem quebrar o que já funciona bem: toggle grid/lista/kanban, semáforo PBQP-H, gradient rotativo por obra.

---

## Layout do card

```
┌─────────────────────────────────────┐
│  [foto ou gradient]                 │  ← 130px altura, object-fit:cover
│  [badge status]        [badge PBQP] │
│                        [OBR-código] │
├─────────────────────────────────────┤
│  Nome da obra (até 2 linhas)        │
│  📍 Cidade / UF                     │
│  ┌──────────┬──────────┬──────────┐ │
│  │    23    │   134    │    48    │ │  ← counters (grid 3 cols)
│  │Inspeções │  Fotos   │  Locais  │ │
│  └──────────┴──────────┴──────────┘ │
│  Início jan/26          Prazo vencido│
│  ████████████████████████           │  ← barra de prazo real
│  ─────────────────────────────────  │
│  Residencial          [semáforo 42%]│  ← semáforo só em PBQP-H
└─────────────────────────────────────┘
```

---

## Foto de capa

### Armazenamento
- **Storage:** MinIO (mesmo bucket `eldox-ged`, prefixo `{tenantId}/obras/{obraId}/capa/`)
- **Campo no banco:** `fotoCapa String?` — armazena a **MinIO key** (não URL direta)
- **URL de acesso:** presigned URL gerada pelo backend no `GET /obras` — campo `fotoCapaUrl String?` no response (nunca retornar a key diretamente ao frontend)

### Upload
- **Endpoint:** `POST /obras/:id/foto-capa` (multipart/form-data)
- **Auth:** JWT obrigatório; roles permitidas: `TECNICO`, `ENGENHEIRO`, `ADMIN_TENANT`, `SUPER_ADMIN`
- **Formatos aceitos:** JPEG, PNG, WebP, HEIC
- **Tamanho máximo de entrada:** 10 MB (rejeitar com 413 antes do processamento)
- **Processamento no servidor:** sharp — redimensionar para máx 800px de largura, converter para WebP, qualidade 80
- **Substituição:** se `fotoCapa` já existir, deletar o objeto antigo do MinIO antes de salvar o novo
- **Migration:** puramente aditiva — campo nullable, nenhum backfill necessário

### Placeholder (sem foto)
- Gradient rotativo: `CARD_GRADIENTS[obra.id % 8]` — usar `obra.id` em vez do índice da lista para garantir cor estável em paginação e re-renders

### Estados de erro
- **Upload falhou** (rede, formato, tamanho): toast de erro no frontend; nenhum rollback necessário (não há estado otimista)
- **URL quebrada** (`fotoCapaUrl` retornada mas asset deletado do MinIO): `onError` no `<img>` → fallback para gradient `CARD_GRADIENTS[obra.id % 8]`

---

## Barra de prazo

### Cálculo
```
percentual = clamp(
  (hoje - dataInicioPrevista) / (dataFimPrevista - dataInicioPrevista) * 100,
  min: 0,
  max: Infinity  ← sem cap no cálculo; a barra é clamped visualmente a 100%
)
```

### Regras de exibição
| Condição | Barra | Texto direito |
|---|---|---|
| `dataInicioPrevista` ou `dataFimPrevista` ausente | **Oculta** | — |
| `percentual < 0` (obra não iniciada) | Barra vazia (0%) | "Não iniciada" |
| `0 ≤ percentual < 80` | Laranja (`var(--accent)`) | "{N}d restantes" |
| `80 ≤ percentual < 100` | Amarelo (`#fbbf24`) | "{N}d restantes" |
| `percentual ≥ 100` | Vermelho (`#f85149`) | "Prazo vencido" (vermelho) |

- `N = Math.ceil((dataFimPrevista - hoje) / 86_400_000)`
- A barra visual é clamped a `width: min(percentual, 100)%`

---

## Counters

### Dados
O endpoint `GET /obras` retorna, por obra:
```json
{
  "totalInspecoes": 23,
  "totalFotos": 134,
  "totalLocais": 48
}
```
Implementado via JOIN no `obras.service.ts`. Valores ausentes ou nulos renderizam como `0`.

---

## O que muda vs. hoje

| Elemento | Status | Detalhe |
|---|---|---|
| Caixa de counters (Inspeções / Fotos / Locais) | **NOVO** | Grid 3 colunas com número grande |
| Barra de prazo com cálculo real | **NOVO** | Substitui o 40% hardcoded |
| Foto real de capa | **NOVO** | Upload via wizard + edit modal |
| Gradient rotativo sem foto | **MANTÉM** | Agora baseado em `obra.id % 8` (era `index % 8`) |
| Badge status sobreposto | **MANTÉM** | Canto superior esquerdo |
| Badge PBQP-H | **MANTÉM** | Canto superior direito |
| Semáforo no footer | **MANTÉM** | Cor + % — só para obras PBQP-H |
| Toggle grid / lista / kanban | **MANTÉM** | Sem alteração |
| Barra de prazo hardcoded | **CORRIGE** | Bug atual |
| Contador só de locais | **CORRIGE** | Agora mostra os 3 |

### Superioridades preservadas
- **Wizard de 4 etapas** com hierarquia de locais e estratégias (Genérica, Edificação, Linear, Instalação) — intocado
- **Kanban view** — intocado
- **Semáforo PBQP-H** — mantido; dados e lógica existentes não alterados

---

## Arquivos afetados

### Backend
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | `fotoCapa String?` no model `Obra` |
| `prisma/migrations/…` | `add_foto_capa_to_obras` — migration aditiva |
| `src/obras/obras.service.ts` | JOIN para `totalInspecoes`, `totalFotos`; geração de presigned URL para `fotoCapaUrl` |
| `src/obras/obras.controller.ts` | Novo endpoint `POST /obras/:id/foto-capa` |
| `src/ged/storage/minio.service.ts` | Reutilizado sem alteração |

### Frontend
| Arquivo | Mudança |
|---|---|
| `src/pages/obras/ObrasListPage.tsx` | `ObraCard` — counters, barra de prazo real, foto |
| `src/pages/obras/CadastroObraWizard.tsx` | Upload de foto na etapa Localização (opcional/skippável) |
| `src/pages/obras/EditarObraModal.tsx` | Upload de foto |
| `src/services/obras.service.ts` | Adicionar `totalInspecoes`, `totalFotos`, `fotoCapaUrl` nos tipos |

---

## Critérios de aceite

| Dado | Quando | Então |
|---|---|---|
| Obra sem foto cadastrada | Grid carrega | Gradient `CARD_GRADIENTS[obra.id % 8]` aparece |
| Obra com foto cadastrada | Grid carrega | Foto aparece em `object-fit: cover` |
| `fotoCapaUrl` quebrada (asset deletado) | Img dispara `onError` | Fallback para gradient |
| Obra com prazo vencido | Card renderiza | Barra vermelha + "Prazo vencido" |
| Obra sem datas preenchidas | Card renderiza | Barra de prazo não aparece |
| Obra não iniciada (percentual < 0) | Card renderiza | Barra vazia + "Não iniciada" |
| Obra PBQP-H com semáforo | Card renderiza | Badge semáforo no footer com cor correta |
| Obra não-PBQP-H | Card renderiza | Sem badge semáforo |
| Upload válido (JPEG/PNG/WebP/HEIC ≤ 10MB) | Usuário salva | Foto salva como WebP máx 800px no MinIO |
| Upload > 10MB | Usuário tenta | Erro 413; toast no frontend |
| Upload de formato inválido | Usuário tenta | Erro 422; toast no frontend |
| Substituição de foto | Segunda foto enviada | Objeto antigo deletado do MinIO; nova foto salva |
