# FVS Sprint 4b — NCs Explícitas + Ciclo de Status Completo

**Data:** 13/04/2026
**Spec:** `docs/superpowers/specs/2026-04-13-fvs-sprint4b-nc-ciclo-completo.md`
**Sprint anterior:** Sprint 4a — Templates de Inspeção (em implementação)
**Próximo:** Sprint 5 — Grade Visual Completa
**Fonte de requisito:** Engenharia reversa do AutoDoc FVS (fvsautodoc.docx) + PLANO_FVS_REDESENHO.docx

---

## 1. Objetivo

Fechar o ciclo de não conformidades no Eldox v3 com:

1. **4 novos estados de reinspeção** no `StatusRegistro` — eliminar o gap crítico identificado na engenharia reversa
2. **fvs_nao_conformidades** — tabela de NCs explícitas e rastreáveis com ciclo NC → NCT → NCTF
3. **Inspeção em massa** — marcar múltiplos locais como conforme em uma única ação
4. **Observação obrigatória em NC** — garantida no backend (já pode existir parcialmente no front)
5. **Parecer lock** — ficha `aprovada` bloqueada para qualquer alteração de registro

---

## 2. Contexto e Motivação

### Gap crítico identificado na engenharia reversa

O `StatusRegistro` atual tem 4 estados:

```typescript
// ATUAL — insuficiente
type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
```

O sistema de referência (AutoDoc FVS) opera com **8 estados por local × serviço**, incluindo 4 desfechos de reinspeção:

| Estado | Descrição | Quem pode aplicar |
|--------|-----------|------------------|
| `nao_avaliado` | Estado inicial | — |
| `conforme` | Aprovado na primeira inspeção | Inspetor |
| `nao_conforme` | Reprovado — aguarda correção | Inspetor |
| `excecao` | Não se aplica a este local | Inspetor / Coordenador |
| `conforme_apos_reinspecao` | NC foi corrigida — **ESTADO FINAL** | Inspetor / Engenheiro |
| `nc_apos_reinspecao` | NC não foi corrigida — **ESTADO FINAL** | Inspetor / Engenheiro |
| `liberado_com_concessao` | NC reconhecida mas local liberado mesmo assim | Engenheiro |
| `retrabalho` | Correção executada mas inadequada — reabre ciclo | Engenheiro |

> **Por que isso importa:** O sistema de referência tinha um problema operacional grave — sem offline real, o campo de reinspeção ficava bloqueado por 1h, fazendo inspetores marcarem NC direto como conforme para evitar retrabalho. O Eldox deve resolver isso com estado explícito e offline-first (Sprint 7).

### O que o Sprint 3 já implementou

O Sprint 3 implementou o ciclo de RO (Registro de Ocorrência) ao nível de **serviço × RO**:
- `StatusServicoNc = 'pendente' | 'desbloqueado' | 'verificado'`
- Esse ciclo rastreia o RO por serviço, não o status individual do item/local

O Sprint 4b complementa isso com:
- Status de reinspeção ao nível do **registro individual** (`fvs_registros`)
- Tabela `fvs_nao_conformidades` para NCs explícitas e rastreáveis para relatórios PBQP-H

---

## 3. Mudanças no Modelo de Dados

### 3.1 Estender `StatusRegistro` — `fvs.types.ts`

```typescript
// NOVO — Sprint 4b
export type StatusRegistro =
  | 'nao_avaliado'
  | 'conforme'
  | 'nao_conforme'
  | 'excecao'
  | 'conforme_apos_reinspecao'   // NC corrigida — estado final ✅
  | 'nc_apos_reinspecao'          // NC permanece — estado final ❌
  | 'liberado_com_concessao'      // liberado com ressalva
  | 'retrabalho';                 // reabre o ciclo
```

**Regra de transições válidas:**

```
nao_avaliado → conforme | nao_conforme | excecao
conforme     → nao_conforme (retrabalho detectado pelo inspetor)
nao_conforme → conforme_apos_reinspecao | nc_apos_reinspecao | liberado_com_concessao | retrabalho
retrabalho   → conforme | nao_conforme | excecao   (reabre como novo ciclo)

conforme_apos_reinspecao → [BLOQUEADO — estado final]
nc_apos_reinspecao       → [BLOQUEADO — estado final] *
liberado_com_concessao   → [BLOQUEADO — estado final]

* nc_apos_reinspecao pode voltar para nao_conforme apenas via permissão especial fvs.registro.reabrir
```

### 3.2 Estender `StatusGrade` — agregação por célula da grade

```typescript
// NOVO — Sprint 4b
export type StatusGrade =
  | 'nao_avaliado'              // nenhum item avaliado
  | 'parcial'                   // NOVO: alguns itens avaliados, não todos
  | 'aprovado'                  // todos conforme ou conforme_apos_reinspecao
  | 'nc'                        // ao menos 1 item nao_conforme ou retrabalho
  | 'nc_final'                  // NOVO: ao menos 1 nc_apos_reinspecao, sem nao_conforme pendente
  | 'liberado'                  // NOVO: liberado_com_concessao (todos resolvidos)
  | 'pendente';                 // ao menos 1 nao_avaliado restante (mas já começou)
```

**Regra de cálculo da célula da grade** (aplicar em ordem de prioridade):

```
SE qualquer item = nao_conforme ou retrabalho → 'nc'
SE qualquer item = nc_apos_reinspecao          → 'nc_final'
SE qualquer item = nao_avaliado               → (SE tem algum avaliado → 'parcial') SENÃO 'nao_avaliado'
SE todos = conforme | conforme_apos_reinspecao → 'aprovado'
SE todos = liberado_com_concessao              → 'liberado'
SENÃO                                          → 'pendente'
```

### 3.3 Nova tabela `fvs_nao_conformidades`

> NC explícita — criada automaticamente ao concluir uma ficha com itens NC.  
> Rastreável individualmente para relatórios PBQP-H.

```sql
CREATE TABLE IF NOT EXISTS fvs_nao_conformidades (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE RESTRICT,
  registro_id       INT NOT NULL REFERENCES fvs_registros(id) ON DELETE RESTRICT,
  -- Identificador legível: ex. "NC-{ficha_id}-{servico_codigo}-{seq}"
  numero            VARCHAR(60) NOT NULL,
  servico_id        INT NOT NULL,
  item_id           INT NOT NULL,
  obra_local_id     INT NOT NULL,
  criticidade       VARCHAR(20) NOT NULL DEFAULT 'menor',  -- critico | maior | menor
  -- Ciclo NC → NCT → NCTF
  status            VARCHAR(40) NOT NULL DEFAULT 'aberta',
  -- aberta | em_tratamento | aguardando_reinspecao | encerrada | cancelada
  ciclo_numero      INT NOT NULL DEFAULT 1,
  -- Tratamento
  responsavel_id    INT,
  prazo_resolucao   DATE,
  acao_corretiva    TEXT,
  causa_raiz        TEXT,
  -- SLA
  sla_prazo_dias    INT,           -- prazo em dias configurado no template
  sla_status        VARCHAR(20) DEFAULT 'no_prazo',  -- no_prazo | alerta | vencido
  -- Encerramento
  encerrada_em      TIMESTAMP,
  encerrada_por     INT,
  resultado_final   VARCHAR(40),   -- conforme_apos_reinspecao | nc_apos_reinspecao | liberado_com_concessao
  -- Auditoria
  criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
  criado_por        INT NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP,
  INDEX idx_nc_ficha     (ficha_id, tenant_id),
  INDEX idx_nc_status    (status, tenant_id),
  INDEX idx_nc_sla       (sla_status, tenant_id)
);
```

### 3.4 Nova tabela `fvs_nc_tratamentos`

> Histórico de tratamentos de uma NC (pode haver múltiplos ciclos).

```sql
CREATE TABLE IF NOT EXISTS fvs_nc_tratamentos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  nc_id           INT NOT NULL REFERENCES fvs_nao_conformidades(id) ON DELETE CASCADE,
  ciclo_numero    INT NOT NULL,
  descricao       TEXT NOT NULL,
  acao_corretiva  TEXT,
  responsavel_id  INT NOT NULL,
  prazo           DATE,
  evidencias      JSONB,           -- [{ ged_versao_id, descricao }]
  registrado_por  INT NOT NULL,
  criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.5 Alterar `fvs_registros` — adicionar campo `ciclo`

O campo `ciclo` já existe nos dados (Sprint 3 usa `ORDER BY ciclo DESC`), mas pode não estar na DDL formal. Confirmar e adicionar se ausente:

```sql
ALTER TABLE fvs_registros
  ADD COLUMN IF NOT EXISTS ciclo INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_por INT,
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_em TIMESTAMP;
```

---

## 4. Endpoints Novos / Modificados

### 4.1 `PUT /fvs/fichas/:fichaId/locais/:localId/registros/:servicoId`

**Action:** `putRegistroServico` (modificar endpoint existente)  
**Permissão:** `requireAuth()` + verificar ficha pertence ao tenant

**Mudança:** aceitar os 4 novos estados e validar transições.

#### Request Body

```typescript
{
  status: StatusRegistro,   // obrigatório
  observacao?: string,       // obrigatório quando status = 'nao_conforme' | 'nc_apos_reinspecao'
  itemIds?: number[],        // itens específicos (se omitido = todos os itens do serviço no local)
}
```

#### Validações adicionais

| Regra | HTTP | Mensagem |
|-------|------|---------|
| `status = 'nao_conforme'` sem `observacao` | 400 | `"Observação é obrigatória para não conformidade"` |
| `status = 'nc_apos_reinspecao'` sem `observacao` | 400 | `"Observação é obrigatória para NC após reinspeção"` |
| Transição inválida (conforme → aprovado) | 422 | `"Transição inválida: {de} → {para}"` |
| Ficha com status `aprovada` | 409 | `"Ficha aprovada. Nenhuma alteração permitida."` |
| Registro com estado final sem permissão especial | 403 | `"Estado final. Requer permissão fvs.registro.reabrir"` |

#### Behavior: auto-geração de NC explícita

Quando `status` transiciona **para** `nao_conforme`:
1. Verificar se já existe `fvs_nao_conformidades` para este `(registro_id, ciclo_numero)`
2. Se não existe → criar registro em `fvs_nao_conformidades` com `status = 'aberta'`
3. Gerar `numero` = `NC-{fichaId}-{servicoCodigo}-{seq:03d}` (seq = próximo por ficha)

Quando `status` transiciona **de** `nao_conforme` **para** `conforme_apos_reinspecao`:
1. Buscar NC aberta pelo `registro_id`
2. Atualizar `status = 'encerrada'`, `resultado_final = 'conforme_apos_reinspecao'`, `encerrada_em = NOW()`

Quando `status` = `liberado_com_concessao`:
1. Buscar NC aberta pelo `registro_id`
2. Atualizar `status = 'encerrada'`, `resultado_final = 'liberado_com_concessao'`

---

### 4.2 `POST /fvs/fichas/:fichaId/registros/bulk`

> **Novo endpoint** — inspeção em massa de múltiplos locais com o mesmo status.

**Action:** `bulkInspecaoLocais`  
**Permissão:** `requireAuth()` + ficha `em_inspecao`

#### Request Body

```typescript
{
  servicoId: number,          // obrigatório
  localIds: number[],         // obrigatório, min 1, max 200
  status: 'conforme' | 'excecao',  // apenas 1ª inspeção — NC não permitida em bulk
  observacao?: string,
}
```

**Restrições de negócio:**
- `nao_conforme` **não é permitido** em bulk (requer observação individual por local)
- Apenas locais com status `nao_avaliado` são processados — locais já avaliados são ignorados silenciosamente
- Estados finais (`conforme_apos_reinspecao`, etc.) são ignorados silenciosamente

#### Response 200

```json
{
  "status": "success",
  "data": {
    "processados": 12,
    "ignorados": 3,
    "erros": 0
  }
}
```

---

### 4.3 `GET /fvs/fichas/:fichaId/ncs`

> Lista todas as NCs explícitas de uma ficha.

**Permissão:** `requireAuth()`

#### Query params

| Param | Tipo | Default |
|-------|------|---------|
| `status` | `aberta\|em_tratamento\|encerrada\|cancelada` | todos |
| `criticidade` | `critico\|maior\|menor` | todos |
| `servicoId` | number | — |
| `slaStatus` | `no_prazo\|alerta\|vencido` | todos |

#### Response 200

```json
{
  "status": "success",
  "data": {
    "total": 14,
    "ncs": [
      {
        "id": 1,
        "numero": "NC-42-PO-23-001",
        "status": "aberta",
        "criticidade": "critico",
        "servico_nome": "Instalações Elétricas",
        "item_descricao": "PRESENÇA DE ENFIAÇÃO EM TODOS OS PONTOS ELÉTRICOS?",
        "local_nome": "Ap. 302",
        "sla_status": "alerta",
        "prazo_resolucao": "2026-04-20",
        "criado_em": "2026-04-13T10:00:00Z"
      }
    ]
  }
}
```

---

### 4.4 `POST /fvs/fichas/:fichaId/ncs/:ncId/tratamento`

> Registra tratamento de uma NC (ação corretiva + responsável + prazo).

**Permissão:** `requireAuth()`

#### Request Body

```typescript
{
  descricao: string,          // obrigatório, max 500
  acaoCorretiva: string,      // obrigatório, max 500
  responsavelId: number,      // obrigatório
  prazo: string,              // obrigatório, ISO date, deve ser >= hoje
  evidencias?: {
    gedVersaoId: number,
    descricao?: string,
  }[],
}
```

**Behavior:**
1. Inserir em `fvs_nc_tratamentos`
2. Atualizar NC: `status = 'em_tratamento'`, `responsavel_id`, `prazo_resolucao`, `acao_corretiva`
3. Audit log: `acao = 'tratamento_nc'`

---

### 4.5 `GET /fvs/fichas/:fichaId/grade`

> **Modificar** o endpoint de grade existente para incluir novos StatusGrade.

**Mudança:** recalcular `celulas[servicoId][localId]` usando as novas regras de cálculo definidas em §3.2.

**Adicionar** `filtros` no response para suportar os filtros da Sprint 5:

```json
{
  "status": "success",
  "data": {
    "servicos": [...],
    "locais": [...],
    "celulas": { "1": { "42": "nc", "43": "aprovado" } },
    "resumo": {
      "total_celulas": 120,
      "aprovadas": 80,
      "nc": 15,
      "nc_final": 3,
      "liberadas": 2,
      "parciais": 10,
      "nao_avaliadas": 10
    }
  }
}
```

---

## 5. Cenários GWT

### Feature: Ciclo de Status de Reinspeção
**Módulo:** FVS — Inspeção  
**Ator:** Inspetor (role: inspetor), Engenheiro (role: engenheiro)

---

**Cenário 1 (caminho feliz) — NC corrigida e confirmada**

```
Given: Ficha em_inspecao, registro item_id=5 local_id=302 servico_id=3
       com status = 'nao_conforme', NC aberta id=7
When:  PUT /fvs/fichas/42/locais/302/registros/3
       { status: 'conforme_apos_reinspecao', observacao: 'Correção verificada' }
Then:  HTTP 200
       fvs_registros atualizado: status = 'conforme_apos_reinspecao', ciclo = 2
       fvs_nao_conformidades id=7: status = 'encerrada', resultado_final = 'conforme_apos_reinspecao'
       fvs_audit_log: acao = 'reinspecao_aprovada', status_de = 'nao_conforme', status_para = 'conforme_apos_reinspecao'
```

---

**Cenário 2 (erro) — tentativa de transição inválida**

```
Given: Registro com status = 'conforme'
When:  PUT ... { status: 'conforme_apos_reinspecao' }
Then:  HTTP 422
       { "status": "error", "message": "Transição inválida: conforme → conforme_apos_reinspecao" }
```

---

**Cenário 3 (erro) — NC sem observação**

```
Given: Registro com status = 'nao_avaliado'
When:  PUT ... { status: 'nao_conforme' }  (sem observacao)
Then:  HTTP 400
       { "status": "error", "message": "Observação é obrigatória para não conformidade" }
```

---

**Cenário 4 (erro) — ficha aprovada bloqueada**

```
Given: Ficha com status = 'aprovada'
When:  PUT ... { status: 'conforme' }
Then:  HTTP 409
       { "status": "error", "message": "Ficha aprovada. Nenhuma alteração permitida." }
```

---

**Cenário 5 — inspeção em massa**

```
Given: Serviço id=3, locais [101, 102, 103, 104] todos nao_avaliado
       local 105 com status = 'nao_conforme' (já avaliado)
When:  POST /fvs/fichas/42/registros/bulk
       { servicoId: 3, localIds: [101, 102, 103, 104, 105], status: 'conforme' }
Then:  HTTP 200
       { processados: 4, ignorados: 1, erros: 0 }
       Apenas os locais nao_avaliado foram atualizados para 'conforme'
```

---

**Cenário 6 — auto-geração de NC ao marcar nao_conforme**

```
Given: Registro item_id=7, local_id=302, servico_id=3 com status = 'nao_avaliado'
When:  PUT ... { status: 'nao_conforme', observacao: 'Junta fora da tolerância' }
Then:  HTTP 200
       fvs_nao_conformidades criado: numero = 'NC-42-PO-23-001', status = 'aberta'
       fvs_registros: status = 'nao_conforme', ciclo = 1
```

---

**Edge cases:**

| Situação | Comportamento esperado |
|----------|----------------------|
| Bulk com `localIds` vazio | HTTP 400: "localIds deve ter ao menos 1 elemento" |
| Bulk com `status = 'nao_conforme'` | HTTP 400: "Inspeção em massa não permite não conformidade" |
| Reabrir estado final sem permissão especial | HTTP 403: "Estado final. Requer permissão fvs.registro.reabrir" |
| `prazo_resolucao` no passado em tratamento NC | HTTP 400: "Prazo deve ser igual ou posterior à data atual" |
| NC encerrada recebendo novo tratamento | HTTP 409: "NC já encerrada" |

---

## 6. Permissões Novas

| Permissão | Descrição | Quem tem por padrão |
|-----------|-----------|---------------------|
| `fvs.registro.reinspecionar` | Pode aplicar estados de reinspeção | inspetor, engenheiro, admin |
| `fvs.registro.concessao` | Pode aplicar `liberado_com_concessao` | engenheiro, admin |
| `fvs.registro.reabrir` | Pode reabrir estado final | admin |
| `fvs.registro.bulk` | Pode usar inspeção em massa | inspetor, engenheiro, admin |
| `fvs.nc.tratar` | Pode registrar tratamento de NC | inspetor, engenheiro, admin |

---

## 7. Schema Delta

### 7.1 Tabelas novas

Ver §3.3 (`fvs_nao_conformidades`) e §3.4 (`fvs_nc_tratamentos`) acima.

### 7.2 Tabelas alteradas

```sql
-- Estender o tipo ENUM de status do registro
-- (PostgreSQL: criar novo type e atualizar coluna)
ALTER TYPE status_registro_enum
  ADD VALUE IF NOT EXISTS 'conforme_apos_reinspecao';
ALTER TYPE status_registro_enum
  ADD VALUE IF NOT EXISTS 'nc_apos_reinspecao';
ALTER TYPE status_registro_enum
  ADD VALUE IF NOT EXISTS 'liberado_com_concessao';
ALTER TYPE status_registro_enum
  ADD VALUE IF NOT EXISTS 'retrabalho';

-- Garantir campo ciclo na tabela de registros
ALTER TABLE fvs_registros
  ADD COLUMN IF NOT EXISTS ciclo INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_por INT REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_em TIMESTAMP;

-- Índice para buscas por status
CREATE INDEX IF NOT EXISTS idx_fvs_reg_status_tenant
  ON fvs_registros (tenant_id, ficha_id, status);
```

### 7.3 Retrocompatibilidade

- Os 4 estados atuais (`nao_avaliado`, `conforme`, `nao_conforme`, `excecao`) continuam válidos
- Registros existentes não são afetados — nenhuma migration de dados
- O cálculo de `StatusGrade` é retrocompatível: grades calculadas antes do sprint continuam corretas
- `fvs_nao_conformidades` é criado com `deleted_at` nullable — não quebra fichas antigas

### 7.4 Impacto multi-tenant

- [ ] `tenant_id` presente em `fvs_nao_conformidades` e `fvs_nc_tratamentos` ✅
- [ ] Todas as queries filtram por `tenant_id` ✅
- [ ] Nenhum dado cross-tenant exposto ✅

---

## 8. ADRs

### ADR-001: Estender StatusRegistro vs. criar tabela fvs_reinspecoes

**Status:** Aceito  
**Data:** 2026-04-13

**Contexto:**  
Para rastrear reinspeções, havia duas opções:
- Opção A: Adicionar 4 novos valores ao `StatusRegistro` enum existente
- Opção B: Criar tabela `fvs_reinspecoes` separada com histórico de inspeções

**Decisão:**  
Opção A — estender o enum.

**Consequências positivas:**
- O campo `ciclo` em `fvs_registros` já registra quantos ciclos aconteceram
- A grade (`FvsGrade`) já lê o `status` diretamente — zero mudança na query principal
- Menos joins para renderizar a grade (performance)
- Retrocompatível: queries existentes continuam funcionando

**Trade-offs negativos:**
- Histórico de mudanças de status fica apenas no `fvs_audit_log`, não em tabela dedicada
- Se um local passar por múltiplos ciclos NC→retrabalho, o histórico está no audit_log (aceitável para PBQP-H)

---

### ADR-002: NC explícita como tabela separada de fvs_registros

**Status:** Aceito  
**Data:** 2026-04-13

**Contexto:**  
O `fvs_registros` com `status = 'nao_conforme'` já registra a NC implicitamente. A `fvs_nao_conformidades` cria uma NC explícita com número, responsável e prazo.

**Decisão:**  
Manter ambos: `fvs_registros` para o status atual, `fvs_nao_conformidades` para rastreabilidade de gestão.

**Consequências:**  
- Relatórios PBQP-H usam `fvs_nao_conformidades` (com número de NC, prazo, responsável)
- Grade e inspeção usam `fvs_registros` (performance, sem join extra)
- Consistência garantida via transação: ao mudar `fvs_registros.status` para `nao_conforme`, criar NC automaticamente

---

## 9. Critérios de Aceite (Sprint 4b)

| CA | Descrição |
|----|-----------|
| CA-01 | `PUT .../registros/:servicoId` aceita os 8 estados e valida transições |
| CA-02 | NC sem observação retorna 400 |
| CA-03 | Transição inválida retorna 422 com mensagem descritiva |
| CA-04 | Ficha `aprovada` bloqueia qualquer PUT em registros (409) |
| CA-05 | Ao transicionar para `nao_conforme`, cria entrada em `fvs_nao_conformidades` automaticamente |
| CA-06 | Ao transicionar para `conforme_apos_reinspecao`, encerra NC correspondente |
| CA-07 | `POST .../registros/bulk` processa locais `nao_avaliado`, ignora os já avaliados |
| CA-08 | Bulk não permite `nao_conforme` como status |
| CA-09 | `GET .../ncs` retorna lista de NCs com filtros por status, criticidade, serviço, sla_status |
| CA-10 | `POST .../ncs/:ncId/tratamento` persiste tratamento e atualiza NC para `em_tratamento` |
| CA-11 | `StatusGrade` da grade reflete os novos estados (nc_final, liberado, parcial) |
| CA-12 | `fvs_audit_log` registra todas as transições de status com `status_de` e `status_para` |

---

## 10. Checklist de Validação da Spec

- [x] Todos os campos têm tipo definido
- [x] Todos os erros HTTP têm código e mensagem
- [x] `tenant_id` presente em todas as tabelas novas
- [x] Permissões definidas para cada ação
- [x] Edge cases cobertos
- [x] Audit log indicado em todos os handlers de escrita
- [x] ADRs criados para as 2 decisões técnicas não-óbvias
- [x] Retrocompatibilidade com Sprints 1-4a garantida
- [x] Migration reversível (ADD COLUMN, ADD VALUE — não destrutiva)
