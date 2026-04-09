# FVS Sprint 4a — Templates de Inspeção (fvs_modelos)

**Data:** 09/04/2026
**Spec:** `docs/superpowers/specs/2026-04-09-fvs-sprint4a-templates-design.md`
**Sprint anterior:** Sprint 3 — RO, Reinspeção, Parecer (mergeado em main, commit 472be30)
**Próximo:** Sprint 4b — NCs Explícitas (fvs_nao_conformidades)

---

## 1. Objetivo

Introduzir o conceito de **template de inspeção** (`fvs_modelos`) no Eldox v3. Um template define quais serviços do catálogo e quais itens de cada serviço serão inspecionados, além de configurar o regime e as etapas obrigatórias do workflow (RO, reinspeção, parecer).

Templates são criados uma vez, aproveitados em múltiplas obras. A criação de uma Ficha a partir de um template pré-popula serviços e propaga flags de workflow — tornando o processo mais padronizado e auditável.

---

## 2. Contexto e Motivação

### Estado anterior (Sprints 1–3)

Cada Ficha era criada com seleção manual de serviços e locais. Não havia padronização: duas Fichas da mesma obra podiam ter serviços diferentes sem justificativa. As flags de workflow (`exige_ro`, `exige_reinspecao`, `exige_parecer`) não existiam — todos os fluxos eram obrigatórios para todas as Fichas.

### O que muda no Sprint 4a

- Templates reutilizáveis com serviços e itens pré-configurados
- Dois processos suportados: **PBQP-H** (regime pbqph, todas etapas) e **Inspeção Interna** (regime livre, etapas configuráveis)
- Vinculação N:N entre obras e templates
- Criação de Ficha via template pré-popula serviços e flags
- Sprint 3 atualizado para respeitar as flags `exige_ro`, `exige_reinspecao`, `exige_parecer` da Ficha

### Retrocompatibilidade

Fichas criadas sem `modelo_id` (Sprints 2 e 3) continuam funcionando. As novas colunas `exige_ro`, `exige_reinspecao` em `fvs_fichas` têm `DEFAULT true` — comportamento idêntico ao atual para fichas legadas.

---

## 3. Processos Suportados

Não há templates de sistema pré-instalados. Cada empresa cria seus próprios templates.

| Processo | regime | exige_ro | exige_reinspecao | exige_parecer | Caso de uso |
|---|---|---|---|---|---|
| PBQP-H | pbqph | true | true | true | Obras com certificação PBQP-H, processo completo obrigatório |
| Inspeção Interna | livre | configurável | configurável | configurável | Processo interno da empresa, etapas definidas pelo procedimento |

A empresa cria um template, escolhe o regime e as flags conforme seu procedimento, adiciona os serviços do catálogo e seleciona os itens de cada serviço que serão inspecionados.

---

## 4. Modelo de Dados

### 4.1 Tabela `fvs_modelos`

```sql
CREATE TABLE IF NOT EXISTS fvs_modelos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  nome             VARCHAR(200) NOT NULL,
  descricao        TEXT,
  versao           INT NOT NULL DEFAULT 1,
  escopo           VARCHAR(20) NOT NULL DEFAULT 'empresa',
  -- 'empresa': disponível para vincular a qualquer obra do tenant
  -- 'obra': exclusivo de uma obra específica (obra_id obrigatório)
  obra_id          INT REFERENCES "Obra"(id),
  -- NULL quando escopo='empresa', NOT NULL quando escopo='obra'
  status           VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  -- 'rascunho' | 'concluido'
  bloqueado        BOOL NOT NULL DEFAULT false,
  -- true = imutável (setado ao criar 1ª Ficha com este template)
  regime           VARCHAR(20) NOT NULL DEFAULT 'livre',
  -- 'livre' | 'pbqph'
  exige_ro         BOOL NOT NULL DEFAULT true,
  exige_reinspecao BOOL NOT NULL DEFAULT true,
  exige_parecer    BOOL NOT NULL DEFAULT true,
  concluido_por    INT REFERENCES "Usuario"(id),
  concluido_em     TIMESTAMP,
  criado_por       INT NOT NULL REFERENCES "Usuario"(id),
  deleted_at       TIMESTAMP NULL,

  CONSTRAINT chk_fvs_modelos_status  CHECK (status  IN ('rascunho', 'concluido')),
  CONSTRAINT chk_fvs_modelos_escopo  CHECK (escopo  IN ('empresa', 'obra')),
  CONSTRAINT chk_fvs_modelos_regime  CHECK (regime  IN ('livre', 'pbqph')),
  CONSTRAINT chk_fvs_modelos_obra_escopo CHECK (
    (escopo = 'obra'    AND obra_id IS NOT NULL) OR
    (escopo = 'empresa' AND obra_id IS NULL)
  )
);

CREATE INDEX idx_fvs_modelos_tenant_status ON fvs_modelos(tenant_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_fvs_modelos_tenant_escopo ON fvs_modelos(tenant_id, escopo)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_fvs_modelos_obra_id       ON fvs_modelos(obra_id)
  WHERE obra_id IS NOT NULL;
```

### 4.2 Tabela `fvs_modelo_servicos`

```sql
CREATE TABLE IF NOT EXISTS fvs_modelo_servicos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  modelo_id        INT NOT NULL REFERENCES fvs_modelos(id) ON DELETE CASCADE,
  servico_id       INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  ordem            INT NOT NULL DEFAULT 0,
  itens_excluidos  INT[] NULL,
  -- Array de IDs de itens do catálogo desativados neste template
  -- NULL ou array vazio = todos os itens do serviço incluídos
  UNIQUE(modelo_id, servico_id)
);

CREATE INDEX idx_fvs_modelo_servicos_modelo ON fvs_modelo_servicos(modelo_id);
CREATE INDEX idx_fvs_modelo_servicos_tenant ON fvs_modelo_servicos(tenant_id);
```

### 4.3 Tabela `obra_modelo_fvs`

```sql
CREATE TABLE IF NOT EXISTS obra_modelo_fvs (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id),
  modelo_id     INT NOT NULL REFERENCES fvs_modelos(id),
  vinculado_por INT NOT NULL REFERENCES "Usuario"(id),
  fichas_count  INT NOT NULL DEFAULT 0,
  -- Contador de Fichas criadas nesta obra com este template (leitura rápida)
  -- Incrementado atomicamente na mesma transaction de criação de Ficha
  -- Representa "Fichas criadas", não "Fichas ativas"
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP NULL,
  -- Soft-delete: desvincular preserva histórico; fichas existentes não afetadas
  UNIQUE(obra_id, modelo_id)
);

CREATE INDEX idx_obra_modelo_fvs_obra        ON obra_modelo_fvs(obra_id);
CREATE INDEX idx_obra_modelo_fvs_tenant_obra ON obra_modelo_fvs(tenant_id, obra_id);
```

### 4.4 Alterações em `fvs_fichas`

```sql
ALTER TABLE fvs_fichas
  ADD COLUMN IF NOT EXISTS modelo_id        INT REFERENCES fvs_modelos(id),
  ADD COLUMN IF NOT EXISTS exige_ro         BOOL NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exige_reinspecao BOOL NOT NULL DEFAULT true;
-- exige_parecer já existe desde Sprint 2

CREATE INDEX idx_fvs_fichas_modelo_id ON fvs_fichas(modelo_id)
  WHERE modelo_id IS NOT NULL;
```

**Impacto em fichas legadas:** `DEFAULT true` em ambas as colunas — fichas do Sprint 2/3 mantêm comportamento atual sem nenhuma mudança.

---

## 5. Ciclo de Vida do Template

```
[rascunho]
  Criado por ADMIN_TENANT ou ENGENHEIRO
  Pode editar: nome, descricao, escopo, obra_id, regime, flags, serviços, itens_excluidos
  Não pode: vincular a obra, criar Ficha
       ↓ concluir (ação explícita)
[concluido]
  Read-only
  Pode: vincular a obras, criar Fichas
  Pode voltar a rascunho → se bloqueado=false
       ↓ (automático ao criar 1ª Ficha, dentro da mesma transaction)
[concluido + bloqueado=true]
  Imutável para rastreabilidade PBQP-H
  Não pode ser editado nem reaberto
  Para evoluir: duplicar → nova versão (versao + 1, bloqueado=false, status=rascunho)
```

### Regras de transição

| Transição | Condição | Quem pode |
|---|---|---|
| rascunho → concluido | Pelo menos 1 serviço com pelo menos 1 item | ADMIN_TENANT, ENGENHEIRO |
| concluido → rascunho | `bloqueado = false` | ADMIN_TENANT, ENGENHEIRO |
| concluido → bloqueado | Automático na 1ª criação de Ficha | Sistema (transaction) |

### Duplicação de template

- Cria novo template com: mesmo nome + " (cópia)", mesmo conteúdo, `versao = original.versao + 1`
- `status = 'rascunho'`, `bloqueado = false`
- `escopo = 'empresa'`, `obra_id = null` (independente do original)
- `criado_por` = usuário que executou a duplicação (não o criador original)
- `obra_modelo_fvs` não é copiado — novo template começa sem vínculos

---

## 6. Vinculação Obra ↔ Template

### Regras

- Só templates `status = 'concluido'` podem ser vinculados
- `UNIQUE(obra_id, modelo_id)` — sem duplicata
- `escopo = 'obra'`: template só pode ser vinculado à sua própria `obra_id`
- `escopo = 'empresa'`: pode ser vinculado a qualquer obra do tenant
- Desvincular: soft-delete em `obra_modelo_fvs.deleted_at`; histórico e `fichas_count` preservados

### Fluxo bidirecional

**Da tela da Obra ("Adicionar template"):**
- Lista templates `status='concluido'` do tenant que ainda não estão vinculados à obra
- Incluí templates `escopo='empresa'` e templates `escopo='obra' AND obra_id = :obraId`

**Da tela do Template ("Vincular a obras"):**
- Lista obras do tenant
- Admin seleciona uma ou mais obras
- Sistema cria registros em `obra_modelo_fvs` para cada seleção

---

## 7. Criação de Ficha via Template

### Fluxo

1. Usuário seleciona a obra
2. `GET /api/v1/obras/:obraId/modelos` retorna templates concluídos vinculados à obra
3. Usuário escolhe template (ou opta por criação manual — retrocompatível)
4. Backend executa em uma única `$transaction`:
   a. `INSERT INTO fvs_fichas` com `modelo_id`, `regime`, `exige_ro`, `exige_reinspecao`, `exige_parecer` copiados do template
   b. Para cada `fvs_modelo_servicos` do template: `INSERT INTO fvs_ficha_servicos` com `itens_excluidos` preservados
   c. `UPDATE fvs_modelos SET bloqueado = true WHERE id = :modeloId AND bloqueado = false`
   d. `UPDATE obra_modelo_fvs SET fichas_count = fichas_count + 1 WHERE obra_id = :obraId AND modelo_id = :modeloId`
5. Usuário ainda precisa informar os **locais** de inspeção por serviço (templates não armazenam locais — locais são específicos por obra e por execução)

### CreateFichaDto (atualizado)

```typescript
class CreateFichaDto {
  obraId: number;        // obrigatório
  nome: string;          // obrigatório
  modeloId?: number;     // opcional — se fornecido, pré-popula tudo
  regime?: string;       // opcional se modeloId fornecido (sobrescrito pelo template)
  // Se sem modeloId: servicos obrigatório (fluxo manual atual)
  servicos?: { servicoId: number; localIds: number[]; itensExcluidos?: number[] }[];
}
```

---

## 8. Atualização do Workflow (Sprint 3)

As três flags `exige_ro`, `exige_reinspecao`, `exige_parecer` da Ficha passam a controlar o workflow. Com `DEFAULT true`, fichas legadas não são afetadas.

### 8.1 `autoCreateRo` — checar `exige_ro`

```typescript
// inspecao.service.ts — patchFicha (transição concluida)
private async autoCreateRo(...) {
  const ficha = await this.getFicha(tenantId, fichaId);
  if (!ficha.exige_ro) return;  // ← NOVO: pula RO se não exigido
  // ... lógica existente
}
```

### 8.2 `patchServicoNc (desbloquear)` — checar `exige_reinspecao`

```typescript
// ro.service.ts — patchServicoNc
if (dto.desbloquear) {
  const ficha = await getFicha(tenantId, fichaId);
  if (!ficha.exige_reinspecao) {          // ← NOVO
    throw new UnprocessableEntityException(
      'Esta ficha não exige reinspeção — desbloqueio não permitido',
    );
  }
  // ... lógica existente
}
```

### 8.3 `patchFicha` — transição `concluida → aprovada` direta (exige_parecer=false)

```typescript
// inspecao.service.ts — patchFicha
// Mapa de transições válidas (atualizado):
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  rascunho:           ['em_inspecao'],
  em_inspecao:        ['concluida'],
  concluida:          ['em_inspecao', 'aguardando_parecer', 'aprovada'],  // ← 'aprovada' adicionado
  aguardando_parecer: ['aprovada', 'em_inspecao'],
};

// Na transição concluida → aguardando_parecer OU concluida → aprovada:
if (novoStatus === 'aguardando_parecer' && !ficha.exige_parecer) {
  throw new UnprocessableEntityException(
    'Esta ficha não exige parecer — use transição direta para aprovada',
  );
}
if (novoStatus === 'aprovada' && ficha.status === 'concluida' && ficha.exige_parecer) {
  throw new UnprocessableEntityException(
    'Esta ficha exige parecer — solicite parecer antes de aprovar',
  );
}
```

---

## 9. API — Endpoints

### Templates (ModeloController)

| Método | Endpoint | Roles | Descrição |
|---|---|---|---|
| GET | `/api/v1/fvs/modelos` | todos | Lista templates do tenant (filtros: escopo, status, bloqueado) |
| GET | `/api/v1/fvs/modelos/:id` | todos | Template completo com serviços |
| POST | `/api/v1/fvs/modelos` | ADMIN_TENANT, ENGENHEIRO | Criar template (rascunho) |
| PATCH | `/api/v1/fvs/modelos/:id` | ADMIN_TENANT, ENGENHEIRO | Editar (bloqueado por template bloqueado) |
| DELETE | `/api/v1/fvs/modelos/:id` | ADMIN_TENANT, ENGENHEIRO | Soft-delete |
| POST | `/api/v1/fvs/modelos/:id/concluir` | ADMIN_TENANT, ENGENHEIRO | rascunho → concluido |
| POST | `/api/v1/fvs/modelos/:id/reabrir` | ADMIN_TENANT, ENGENHEIRO | concluido → rascunho (se não bloqueado) |
| POST | `/api/v1/fvs/modelos/:id/duplicar` | ADMIN_TENANT, ENGENHEIRO | Clonar → nova versão |
| GET | `/api/v1/fvs/modelos/:id/obras` | todos | Obras vinculadas ao template |
| POST | `/api/v1/fvs/modelos/:id/obras` | ADMIN_TENANT, ENGENHEIRO | Vincular template a obras (array de obraIds) |

### Serviços do template

| Método | Endpoint | Roles | Descrição |
|---|---|---|---|
| GET | `/api/v1/fvs/modelos/:id/servicos` | todos | Lista serviços do template |
| POST | `/api/v1/fvs/modelos/:id/servicos` | ADMIN_TENANT, ENGENHEIRO | Adicionar serviço |
| PATCH | `/api/v1/fvs/modelos/:id/servicos/:servicoId` | ADMIN_TENANT, ENGENHEIRO | Editar ordem ou itens_excluidos |
| DELETE | `/api/v1/fvs/modelos/:id/servicos/:servicoId` | ADMIN_TENANT, ENGENHEIRO | Remover serviço |

### Obras (ObrasController — adição)

| Método | Endpoint | Roles | Descrição |
|---|---|---|---|
| GET | `/api/v1/obras/:obraId/modelos` | todos | Templates concluídos vinculados à obra |
| POST | `/api/v1/obras/:obraId/modelos` | ADMIN_TENANT, ENGENHEIRO | Vincular template à obra |
| DELETE | `/api/v1/obras/:obraId/modelos/:modeloId` | ADMIN_TENANT, ENGENHEIRO | Desvincular (soft-delete) |

---

## 10. Critérios de Aceite (23 CAs)

| CA | Descrição |
|---|---|
| CA-01 | ADMIN_TENANT e ENGENHEIRO podem criar, editar e concluir templates |
| CA-02 | Template `rascunho` não pode ser vinculado a obra nem usado para criar Ficha |
| CA-03 | Template `bloqueado=true` não pode ser editado; somente duplicado |
| CA-04 | Ao criar 1ª Ficha com template, `bloqueado=true` setado atomicamente na mesma transaction |
| CA-05 | `escopo='empresa'`: disponível para qualquer obra do tenant |
| CA-06 | `escopo='obra'`: visível e vinculável apenas à obra referenciada |
| CA-07 | `escopo='obra'` sem `obra_id` é rejeitado (constraint + validação de DTO) |
| CA-08 | `escopo='empresa'` com `obra_id` preenchido é rejeitado |
| CA-09 | Ao concluir: `concluido_por` e `concluido_em` gravados |
| CA-10 | Template com `bloqueado=false` pode voltar de `concluido` para `rascunho` |
| CA-11 | Soft-delete disponível; templates excluídos não aparecem em listagens |
| CA-12 | `(modelo_id, servico_id)` únicos em `fvs_modelo_servicos` |
| CA-13 | Serviços de template bloqueado não podem ser alterados |
| CA-14 | Só templates `concluido` podem ser vinculados a obras |
| CA-15 | `(obra_id, modelo_id)` únicos em `obra_modelo_fvs` |
| CA-16 | `fichas_count` incrementa +1 atomicamente ao criar Ficha; representa Fichas criadas |
| CA-17 | Ao criar Ficha com `modelo_id`: serviços pré-populados, `itens_excluidos` preservados |
| CA-18 | Flags `regime`, `exige_ro`, `exige_reinspecao`, `exige_parecer` copiados do template para a Ficha |
| CA-19 | `modelo_id` gravado em `fvs_fichas` para rastreabilidade |
| CA-20 | Criação de Ficha sem `modelo_id` funciona exatamente como antes (retrocompatível) |
| CA-21 | `autoCreateRo` não cria RO quando `ficha.exige_ro = false` |
| CA-22 | Desbloquear serviço NC retorna erro quando `ficha.exige_reinspecao = false` |
| CA-23 | Ficha com `exige_parecer=false` avança de `concluida` para `aprovada` diretamente, sem `aguardando_parecer` |

---

## 11. Permissões

Sistema atual: roles fixos (`ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO`, `VISITANTE`).

| Ação | Roles autorizados |
|---|---|
| Criar / editar / concluir / reabrir / duplicar / excluir template | ADMIN_TENANT, ENGENHEIRO |
| Vincular / desvincular template de obra | ADMIN_TENANT, ENGENHEIRO |
| Listar e visualizar templates | Todos os roles autenticados |
| Criar Ficha via template | ADMIN_TENANT, ENGENHEIRO, TECNICO |

> **Nota:** Sistema de permissões avulsas (`fvs.modelos`) está pendente para sprint dedicado. No Sprint 4a, controle é por role apenas. Quando o sistema de permissões for implementado, ENGENHEIRO poderá ser granularizado (nem todo ENGENHEIRO cria templates).

---

## 12. Decisões de Design Documentadas

| Decisão | Justificativa |
|---|---|
| Templates não armazenam locais | Locais são específicos por obra e por execução — o mesmo template pode ser executado em diferentes apartamentos, andares, blocos |
| Duplicação sempre cria `escopo='empresa'` | Template `escopo='obra'` clonado pode ser reutilizado em outra obra — usuário re-configura escopo se necessário |
| `fichas_count` desnormalizado | Leitura rápida para dashboard; representa criações, não Fichas ativas; incrementado atomicamente |
| Desvincular = soft-delete | Preserva histórico e `fichas_count` para auditoria PBQP-H |
| `DEFAULT true` nas novas flags de Ficha | Fichas legadas (Sprint 2/3) mantêm comportamento atual sem nenhuma migração de dados |
| Sem templates de sistema pré-instalados | Cada empresa define seus próprios templates conforme seu procedimento interno |

---

## 13. Fora do Escopo (Sprint 4a)

- **Sistema de permissões avulsas** — `fvs.modelos` por usuário individual → Sprint dedicado
- **NCs explícitas** (`fvs_nao_conformidades` substituindo `ro_servicos_nc`) → Sprint 4b
- **Relatórios de cobertura de templates** (% de obras com template vinculado, ranking de templates por uso) → Sprint 5
- **IA para sugestão de templates** a partir da descrição da obra → Sprint futuro
