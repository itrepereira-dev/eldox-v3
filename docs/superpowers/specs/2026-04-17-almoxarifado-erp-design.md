# Almoxarifado ERP — Authoritative Design Spec

**Date:** 2026-04-17
**Status:** APPROVED — Authoritative design (supersedes ADR-001-almoxarifado-tenant.md and 2026-04-17-almoxarifado-tenant-spec.md)
**Author:** Eldox Architecture Team
**Scope:** Full redesign of the Almoxarifado module — clean model from scratch (database is empty, no migration needed)

---

## Table of Contents

1. [Goal & Architecture](#1-goal--architecture)
2. [Data Model Delta](#2-data-model-delta)
3. [API Endpoints](#3-api-endpoints)
4. [Business Rules](#4-business-rules)
5. [TypeScript Types](#5-typescript-types)
6. [Frontend Changes Summary](#6-frontend-changes-summary)
7. [What Does NOT Change](#7-what-does-not-change)
8. [Historical Reference](#8-historical-reference)

---

## 1. Goal & Architecture

### Goal

The Almoxarifado module redesign removes the conceptual coupling between stock and obras (`obra_id`), replacing it with a unified **location axis** (`local_id`). A tenant-owned location (`alm_locais`) becomes the single organizing unit for all stock operations — balances, movements, purchase orders, supply requests, and NF-e receipts. Locations of type `OBRA` carry an `obra_id` FK to retain the obra context where needed, while locations of types `CENTRAL`, `CD`, and `DEPOSITO` are pure tenant-level logistics nodes. This model accurately reflects how construction companies actually manage materials across warehouses, distribution centers, and job sites without forcing every stock record to belong to a specific obra.

### Architecture

The module follows the existing Eldox multi-tenant service layer pattern. All tables carry `tenant_id` (enforced at the application service layer, never raw SQL in controllers). The location entity (`alm_locais`) is the anchor for estoque, movements, OCs, solicitações, and NF-e receipt. A new first-class `alm_transferencias` entity handles inter-location movement with a configurable approval threshold stored in `alm_config_transferencia`: when a transfer's `valor_total` is at or below `valor_limite_direto` (or when `valor_limite_direto = 0`), it requires explicit approval by a user with a role listed in `roles_aprovadores`; otherwise it can be directly executed. Transfer execution is atomic — SAIDA at origin and ENTRADA at destination are written in a single database transaction. The NF-e import infrastructure (webhooks, AI matching) requires only a field swap (`obra_id → local_id`) and is otherwise untouched.

---

## 2. Data Model Delta

### 2.1 Tables That Change

#### `alm_estoque_locais` → replaced by `alm_locais`

The existing `alm_estoque_locais` table is dropped and replaced by `alm_locais`. All references throughout the codebase that point to `alm_estoque_locais` must be updated to `alm_locais`.

**Fields removed:**
- `obra_id INT NOT NULL` — the old mandatory obra scope

**Fields added / changed:**
- `tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('CENTRAL','CD','DEPOSITO','OBRA'))` — location category
- `obra_id INT REFERENCES obras(id)` — nullable; populated only when `tipo = 'OBRA'`
- `descricao TEXT` — optional
- `endereco VARCHAR(500)` — optional physical address
- `responsavel_nome VARCHAR(255)` — optional person responsible for the location
- `ativo BOOLEAN NOT NULL DEFAULT true` — soft-delete flag

**New indexes:**
```sql
CREATE INDEX idx_alm_locais_tenant ON alm_locais(tenant_id);
CREATE INDEX idx_alm_locais_obra ON alm_locais(obra_id) WHERE obra_id IS NOT NULL;
```

**New check constraints:**
```sql
CHECK (tipo != 'OBRA' OR obra_id IS NOT NULL)   -- OBRA type must have obra_id
CHECK (tipo = 'OBRA' OR obra_id IS NULL)         -- non-OBRA must not have obra_id
```

---

#### `alm_estoque_saldo`

**Fields removed:**
- `obra_id INT NOT NULL`

**Fields changed:**
- `local_id INT` → `local_id INT NOT NULL REFERENCES alm_locais(id)`

**Unique constraint changed:**
- Old: `UNIQUE (tenant_id, obra_id, catalogo_id)`
- New: `UNIQUE (tenant_id, local_id, catalogo_id)`

**Index changes:**
- Remove: `idx_alm_estoque_saldo_obra` (on `obra_id`)
- Add: `CREATE INDEX idx_alm_estoque_saldo_local ON alm_estoque_saldo(local_id);`

---

#### `alm_movimentos`

**Fields removed:**
- `obra_id INT NOT NULL`

**Fields changed:**
- `local_id INT` → `local_id INT NOT NULL REFERENCES alm_locais(id)`

**Index changes:**
- Remove: index on `obra_id`
- Add: `CREATE INDEX idx_alm_movimentos_local ON alm_movimentos(local_id);`

---

#### `alm_ordens_compra`

**Fields removed:**
- `obra_id INT` (formerly used to indicate delivery destination)

**Fields added:**
- `local_destino_id INT NOT NULL REFERENCES alm_locais(id)` — the location where purchased materials will be delivered

**Index changes:**
- Remove: index on `obra_id`
- Add: `CREATE INDEX idx_alm_ordens_compra_local_destino ON alm_ordens_compra(local_destino_id);`

---

#### `alm_solicitacoes`

**Fields removed:**
- `obra_id INT`

**Fields added:**
- `local_destino_id INT NOT NULL REFERENCES alm_locais(id)` — the location requesting/receiving the materials

**Index changes:**
- Remove: index on `obra_id`
- Add: `CREATE INDEX idx_alm_solicitacoes_local_destino ON alm_solicitacoes(local_destino_id);`

---

#### `alm_notas_fiscais`

**Fields removed:**
- `obra_id INT` (nullable)

**Fields added:**
- `local_id INT REFERENCES alm_locais(id)` — nullable until NF-e is accepted; set to NOT NULL upon acceptance

**Index changes:**
- Remove: index on `obra_id`
- Add: `CREATE INDEX idx_alm_notas_fiscais_local ON alm_notas_fiscais(local_id) WHERE local_id IS NOT NULL;`

---

#### `alm_alertas_estoque`

**Single field change only:**
- `obra_id INT` → `local_id INT NOT NULL REFERENCES alm_locais(id)`

**Index changes:**
- Remove: index on `obra_id`
- Add: `CREATE INDEX idx_alm_alertas_estoque_local ON alm_alertas_estoque(local_id);`

---

### 2.2 New Tables — Full DDL

#### `alm_locais`

```sql
CREATE TABLE alm_locais (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  tipo              VARCHAR(20) NOT NULL
                    CHECK (tipo IN ('CENTRAL', 'CD', 'DEPOSITO', 'OBRA')),
  nome              VARCHAR(255) NOT NULL,
  descricao         TEXT,
  obra_id           INT REFERENCES obras(id),       -- populated only when tipo = 'OBRA'
  endereco          VARCHAR(500),
  responsavel_nome  VARCHAR(255),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alm_locais_obra_required
    CHECK (tipo != 'OBRA' OR obra_id IS NOT NULL),   -- OBRA type must have obra_id
  CONSTRAINT chk_alm_locais_obra_forbidden
    CHECK (tipo = 'OBRA' OR obra_id IS NULL)          -- non-OBRA must not have obra_id
);

CREATE INDEX idx_alm_locais_tenant ON alm_locais(tenant_id);
CREATE INDEX idx_alm_locais_obra ON alm_locais(obra_id) WHERE obra_id IS NOT NULL;
CREATE INDEX idx_alm_locais_tipo ON alm_locais(tenant_id, tipo);
CREATE INDEX idx_alm_locais_ativo ON alm_locais(tenant_id, ativo);
```

---

#### `alm_transferencias`

```sql
CREATE TABLE alm_transferencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  local_origem_id     INT NOT NULL REFERENCES alm_locais(id),
  local_destino_id    INT NOT NULL REFERENCES alm_locais(id),
  status              VARCHAR(30) NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN (
                        'rascunho',
                        'aguardando_aprovacao',
                        'aprovada',
                        'executada',
                        'cancelada'
                      )),
  valor_total         NUMERIC(15,2),                  -- NULL until itens are priced
  solicitante_id      INT NOT NULL,                   -- FK to users(id)
  aprovador_id        INT,                            -- FK to users(id); set upon approval
  aprovado_at         TIMESTAMPTZ,
  observacao          TEXT,
  executada_parcial   BOOLEAN NOT NULL DEFAULT false, -- true if any item has qtd_executada < quantidade
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alm_transferencias_locais_distintos
    CHECK (local_origem_id != local_destino_id)
);

CREATE INDEX idx_alm_transferencias_tenant ON alm_transferencias(tenant_id);
CREATE INDEX idx_alm_transferencias_status ON alm_transferencias(tenant_id, status);
CREATE INDEX idx_alm_transferencias_origem ON alm_transferencias(local_origem_id);
CREATE INDEX idx_alm_transferencias_destino ON alm_transferencias(local_destino_id);
CREATE INDEX idx_alm_transferencias_solicitante ON alm_transferencias(solicitante_id);
```

---

#### `alm_transferencia_itens`

```sql
CREATE TABLE alm_transferencia_itens (
  id                SERIAL PRIMARY KEY,
  transferencia_id  INT NOT NULL REFERENCES alm_transferencias(id) ON DELETE CASCADE,
  catalogo_id       INT NOT NULL,                     -- FK to alm_catalogo(id)
  quantidade        NUMERIC(15,4) NOT NULL CHECK (quantidade > 0),
  unidade           VARCHAR(20) NOT NULL,
  qtd_executada     NUMERIC(15,4) NOT NULL DEFAULT 0
                    CHECK (qtd_executada >= 0),
  CONSTRAINT chk_alm_trans_itens_qtd_max
    CHECK (qtd_executada <= quantidade)
);

CREATE INDEX idx_alm_trans_itens_transferencia ON alm_transferencia_itens(transferencia_id);
CREATE INDEX idx_alm_trans_itens_catalogo ON alm_transferencia_itens(catalogo_id);
```

---

#### `alm_config_transferencia`

```sql
CREATE TABLE alm_config_transferencia (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT NOT NULL UNIQUE,
  valor_limite_direto   NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- 0 means ALL transfers require approval regardless of value
  -- > 0 means transfers with valor_total <= valor_limite_direto can be executed directly
  roles_aprovadores     TEXT[] NOT NULL DEFAULT '{}',
  -- e.g. ['ADMIN_TENANT', 'ENGENHEIRO_SENIOR']
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alm_config_trans_tenant ON alm_config_transferencia(tenant_id);
```

---

## 3. API Endpoints

All endpoints are prefixed `/api/v1`. All require a valid JWT (`Authorization: Bearer <token>`). `tenant_id` is always inferred from the authenticated user's token — it is never accepted as a request parameter.

Error envelope format (all 4xx/5xx):
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Saldo insuficiente para o item 42 no local 7.",
    "details": {}
  }
}
```

---

### 3.1 Locais (`/almoxarifado/locais`)

#### `GET /almoxarifado/locais`

**Auth:** `TECNICO` or above

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `tipo` | `CENTRAL \| CD \| DEPOSITO \| OBRA` | No | Filter by location type |
| `ativo` | `boolean` | No | Default: `true`. Pass `false` to include inactive |
| `obra_id` | `integer` | No | Filter by linked obra (only returns OBRA-type locations) |

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "tenantId": 5,
      "tipo": "CENTRAL",
      "nome": "Almoxarifado Central SP",
      "descricao": "Galpão principal zona leste",
      "obraId": null,
      "endereco": "Rua das Acácias, 200, São Paulo",
      "responsavelNome": "Carlos Mendes",
      "ativo": true,
      "createdAt": "2026-04-17T10:00:00Z",
      "updatedAt": "2026-04-17T10:00:00Z"
    }
  ],
  "total": 1
}
```

**Error cases:**
- `403` — authenticated role does not meet `TECNICO` minimum

---

#### `POST /almoxarifado/locais`

**Auth:** `ADMIN_TENANT`

**Request body:**
```json
{
  "tipo": "OBRA",
  "nome": "Depósito Obra Guarulhos A",
  "descricao": "string | null",
  "obraId": 12,
  "endereco": "string | null",
  "responsavelNome": "string | null"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `tipo` | `CENTRAL \| CD \| DEPOSITO \| OBRA` | Yes | |
| `nome` | `string` max 255 | Yes | |
| `descricao` | `string \| null` | No | |
| `obraId` | `integer \| null` | Conditional | Required when `tipo = OBRA`; forbidden otherwise |
| `endereco` | `string \| null` | No | max 500 chars |
| `responsavelNome` | `string \| null` | No | max 255 chars |

**Response 201:**
```json
{
  "data": { /* AlmLocal object */ }
}
```

**Error cases:**
- `400 VALIDATION_ERROR` — missing required fields, `obraId` present for non-OBRA type, `obraId` absent for OBRA type
- `400 OBRA_NOT_FOUND` — `obraId` does not exist or belongs to a different tenant
- `403` — role is not `ADMIN_TENANT`
- `409 DUPLICATE_NOME` — a location with the same `nome` already exists for this tenant (case-insensitive)

---

#### `PUT /almoxarifado/locais/:id`

**Auth:** `ADMIN_TENANT`

**Request body:** Same fields as POST. All fields optional (partial update). `tipo` cannot be changed after creation if any stock movements exist.

**Response 200:**
```json
{
  "data": { /* AlmLocal object */ }
}
```

**Error cases:**
- `400 VALIDATION_ERROR` — field type mismatch or constraint violation
- `400 TIPO_IMMUTABLE` — attempting to change `tipo` when stock movements exist for this location
- `403` — role is not `ADMIN_TENANT`
- `404` — location not found or belongs to a different tenant
- `409 DUPLICATE_NOME` — name collision

---

#### `DELETE /almoxarifado/locais/:id`

**Auth:** `ADMIN_TENANT`

Soft-delete: sets `ativo = false`. Does not physically delete the record.

**Response 200:**
```json
{
  "data": { "id": 1, "ativo": false }
}
```

**Error cases:**
- `400 LOCAL_COM_SALDO` — location has non-zero stock balance; cannot deactivate
- `400 LOCAL_COM_OC_ABERTA` — location is referenced by open purchase orders
- `403` — role is not `ADMIN_TENANT`
- `404` — location not found or belongs to a different tenant

---

### 3.2 Transferências (`/almoxarifado/transferencias`)

#### `GET /almoxarifado/transferencias`

**Auth:** `TECNICO` or above

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `rascunho \| aguardando_aprovacao \| aprovada \| executada \| cancelada` | No | Filter by status |
| `local_origem_id` | `integer` | No | Filter by origin location |
| `local_destino_id` | `integer` | No | Filter by destination location |
| `page` | `integer` | No | Default: 1 |
| `per_page` | `integer` | No | Default: 20, max: 100 |

**Response 200:**
```json
{
  "data": [
    {
      "id": 10,
      "tenantId": 5,
      "localOrigemId": 1,
      "localOrigemNome": "Almoxarifado Central SP",
      "localDestinoId": 3,
      "localDestinoNome": "Depósito Obra Guarulhos A",
      "status": "aguardando_aprovacao",
      "valorTotal": 1500.00,
      "solicitanteId": 22,
      "aprovadorId": null,
      "aprovadoAt": null,
      "observacao": null,
      "executadaParcial": false,
      "createdAt": "2026-04-17T11:00:00Z",
      "updatedAt": "2026-04-17T11:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "perPage": 20
}
```

**Error cases:**
- `403` — role does not meet `TECNICO` minimum

---

#### `POST /almoxarifado/transferencias`

**Auth:** `ENGENHEIRO` or above

**Request body:**
```json
{
  "localOrigemId": 1,
  "localDestinoId": 3,
  "observacao": "string | null",
  "itens": [
    {
      "catalogoId": 88,
      "quantidade": 50,
      "unidade": "UN"
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `localOrigemId` | `integer` | Yes | Must be active location in same tenant |
| `localDestinoId` | `integer` | Yes | Must differ from `localOrigemId` |
| `observacao` | `string \| null` | No | |
| `itens` | `array` | Yes | Min 1 item |
| `itens[].catalogoId` | `integer` | Yes | Must exist in catalog |
| `itens[].quantidade` | `number` > 0 | Yes | |
| `itens[].unidade` | `string` max 20 | Yes | |

**Business logic on create:**
1. Validates both locations belong to the same tenant and are active.
2. Calculates `valor_total` by joining `itens.catalogoId` with catalog prices (nullable — if price not available, `valor_total` remains NULL).
3. Compares `valor_total` against `alm_config_transferencia.valor_limite_direto`:
   - If `valor_limite_direto = 0` → status is set to `aguardando_aprovacao`
   - If `valor_total <= valor_limite_direto` → status is set to `aprovada` (direct approval)
   - If `valor_total > valor_limite_direto` → status is set to `aguardando_aprovacao`
   - If `valor_total IS NULL` → status is set to `aguardando_aprovacao` (conservative)
4. If `alm_config_transferencia` does not exist for the tenant, create it with defaults (`valor_limite_direto = 0`, `roles_aprovadores = []`) and treat as requiring approval.

**Response 201:**
```json
{
  "data": { /* AlmTransferencia object with itens[] */ }
}
```

**Error cases:**
- `400 VALIDATION_ERROR` — missing fields, invalid types
- `400 MESMO_LOCAL` — `localOrigemId` equals `localDestinoId`
- `400 LOCAL_INATIVO` — one or both locations are inactive
- `400 CATALOGO_NAO_ENCONTRADO` — one or more `catalogoId` values not found
- `403` — role does not meet `ENGENHEIRO` minimum
- `404` — local not found in this tenant

---

#### `POST /almoxarifado/transferencias/:id/aprovar`

**Auth:** User must have a role listed in `alm_config_transferencia.roles_aprovadores`. Falls back to `ADMIN_TENANT` if `roles_aprovadores` is empty.

**Request body:** (empty `{}`)

**Business logic:**
1. Transfer must be in status `aguardando_aprovacao`.
2. Authenticated user must satisfy the roles check described above.
3. Sets `status = 'aprovada'`, `aprovador_id = user.id`, `aprovado_at = NOW()`.

**Response 200:**
```json
{
  "data": { /* AlmTransferencia object */ }
}
```

**Error cases:**
- `400 STATUS_INVALIDO` — transfer is not in `aguardando_aprovacao` status
- `403 SEM_PERMISSAO_APROVACAO` — authenticated user does not hold an approved role
- `404` — transfer not found or belongs to a different tenant

---

#### `POST /almoxarifado/transferencias/:id/executar`

**Auth:** `ALMOXARIFE` or `ENGENHEIRO` or above

**Request body:** (optional partial execution)
```json
{
  "itens": [
    {
      "itemId": 55,
      "qtdExecutada": 30
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `itens` | `array` | No | If omitted, executes full quantity for all items |
| `itens[].itemId` | `integer` | Yes | ID of `alm_transferencia_itens` record |
| `itens[].qtdExecutada` | `number` > 0 | Yes | Must be <= `quantidade` for that item |

**Business logic (atomic transaction):**
1. Transfer must be in status `aprovada`.
2. For each item being executed, verify `alm_estoque_saldo` at `local_origem_id` has sufficient balance (`saldo >= qtdExecutada`). If any check fails, the entire transaction is aborted with `400 INSUFFICIENT_STOCK`.
3. For each item:
   a. INSERT or UPDATE `alm_movimentos`: type `SAIDA`, `local_id = local_origem_id`, `catalogo_id`, `quantidade = qtdExecutada`.
   b. UPSERT `alm_estoque_saldo`: decrement at `local_origem_id`.
   c. INSERT or UPDATE `alm_movimentos`: type `ENTRADA`, `local_id = local_destino_id`, `catalogo_id`, `quantidade = qtdExecutada`.
   d. UPSERT `alm_estoque_saldo`: increment at `local_destino_id`.
   e. Update `alm_transferencia_itens.qtd_executada += qtdExecutada`.
4. After execution, if any item has `qtd_executada < quantidade`, set `executada_parcial = true` on the transfer.
5. Set `status = 'executada'` on the transfer (even if partial — status signals the execution phase was reached).

**Response 200:**
```json
{
  "data": { /* AlmTransferencia object with updated itens[] */ }
}
```

**Error cases:**
- `400 STATUS_INVALIDO` — transfer is not in `aprovada` status
- `400 INSUFFICIENT_STOCK` — `{ "catalogoId": 88, "local": "Almoxarifado Central SP", "saldoDisponivel": 10, "qtdSolicitada": 30 }`
- `400 QTD_EXCEDE_SOLICITADA` — `qtdExecutada` exceeds item's `quantidade`
- `400 ITEM_NAO_PERTENCE_TRANSFERENCIA` — `itemId` does not belong to this transfer
- `403` — role does not meet minimum
- `404` — transfer not found or belongs to a different tenant

---

#### `POST /almoxarifado/transferencias/:id/cancelar`

**Auth:** `ENGENHEIRO` or above (or the original `solicitante_id`)

**Request body:**
```json
{
  "motivo": "string | null"
}
```

**Business logic:**
1. Transfer must be in status `rascunho` or `aguardando_aprovacao` or `aprovada`.
2. Cannot cancel a transfer in `executada` status (even partially executed).
3. Sets `status = 'cancelada'`, appends motivo to `observacao` if provided.

**Response 200:**
```json
{
  "data": { /* AlmTransferencia object */ }
}
```

**Error cases:**
- `400 STATUS_INVALIDO` — transfer is in `executada` or already `cancelada`
- `403` — role does not meet minimum and user is not the solicitante
- `404` — transfer not found or belongs to a different tenant

---

### 3.3 Config de Transferência (`/almoxarifado/config-transferencia`)

#### `GET /almoxarifado/config-transferencia`

**Auth:** `ADMIN_TENANT`

**Response 200:**
```json
{
  "data": {
    "id": 1,
    "tenantId": 5,
    "valorLimiteDireto": 0,
    "rolesAprovadores": ["ADMIN_TENANT"],
    "createdAt": "2026-04-17T10:00:00Z",
    "updatedAt": "2026-04-17T10:00:00Z"
  }
}
```

If no config record exists yet, returns the default values (does not create):
```json
{
  "data": {
    "id": null,
    "tenantId": 5,
    "valorLimiteDireto": 0,
    "rolesAprovadores": [],
    "createdAt": null,
    "updatedAt": null
  }
}
```

**Error cases:**
- `403` — role is not `ADMIN_TENANT`

---

#### `PUT /almoxarifado/config-transferencia`

**Auth:** `ADMIN_TENANT`

**Request body:**
```json
{
  "valorLimiteDireto": 5000.00,
  "rolesAprovadores": ["ADMIN_TENANT", "ENGENHEIRO_SENIOR"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `valorLimiteDireto` | `number` >= 0 | Yes | 0 = all transfers require approval |
| `rolesAprovadores` | `string[]` | Yes | Each role must be a valid system role; can be empty array |

**Business logic:** Upserts `alm_config_transferencia` for the tenant.

**Response 200:**
```json
{
  "data": { /* AlmConfigTransferencia object */ }
}
```

**Error cases:**
- `400 VALOR_NEGATIVO` — `valorLimiteDireto` < 0
- `400 ROLE_INVALIDO` — one or more entries in `rolesAprovadores` are not recognized system roles
- `403` — role is not `ADMIN_TENANT`

---

### 3.4 Changed: Estoque Queries

All estoque-related endpoints that previously accepted `obra_id` as a query parameter now accept `local_id` instead.

**Affected endpoints:**

| Endpoint | Old param | New param |
|----------|-----------|-----------|
| `GET /almoxarifado/estoque/saldo` | `obra_id` | `local_id` |
| `GET /almoxarifado/estoque/movimentos` | `obra_id` | `local_id` |
| `GET /almoxarifado/estoque/relatorio` | `obra_id` | `local_id` |

**New optional filter:** `tipo_local` (`CENTRAL | CD | DEPOSITO | OBRA`) — filters saldo/movimentos by location type.

**Response additions:** All saldo and movimento responses now include `localId`, `localNome`, and `localTipo` fields in each record row. The `obraId` field is removed from responses.

---

### 3.5 Changed: OC (`/almoxarifado/ordens-compra`)

**`POST /almoxarifado/ordens-compra` — request body change:**

| Old field | New field | Type | Notes |
|-----------|-----------|------|-------|
| `obraId` | `localDestinoId` | `integer NOT NULL` | Must be active location in same tenant |

**`PUT /almoxarifado/ordens-compra/:id` — same change.**

**`GET /almoxarifado/ordens-compra` — query param change:**

| Old param | New param |
|-----------|-----------|
| `obra_id` | `local_destino_id` |

**Response change:** `obraId` field replaced by `localDestinoId` and `localDestinoNome`.

---

### 3.6 Changed: Solicitações (`/almoxarifado/solicitacoes`)

**`POST /almoxarifado/solicitacoes` — request body change:**

| Old field | New field | Type | Notes |
|-----------|-----------|------|-------|
| `obraId` | `localDestinoId` | `integer NOT NULL` | Must be active location in same tenant |

**`PUT /almoxarifado/solicitacoes/:id` — same change.**

**`GET /almoxarifado/solicitacoes` — query param change:**

| Old param | New param |
|-----------|-----------|
| `obra_id` | `local_destino_id` |

**Response change:** `obraId` field replaced by `localDestinoId` and `localDestinoNome`.

---

### 3.7 Changed: NF-e Recebimento

**`POST /almoxarifado/notas-fiscais/:id/aceitar` — request body addition:**

```json
{
  "localId": 3
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `localId` | `integer` | Yes | Destination location for received materials; must be active |

**Business logic:** On acceptance, sets `alm_notas_fiscais.local_id = localId`, then creates `ENTRADA` movements and upserts saldo for each NF-e item into the chosen location.

**Error cases added:**
- `400 LOCAL_INATIVO` — specified location is inactive
- `400 LOCAL_NOT_FOUND` — location not found in this tenant

---

## 4. Business Rules

### 4.1 Transfer Atomicity

Transfer execution (`POST /transferencias/:id/executar`) is fully atomic. The following operations occur inside a single database transaction:

1. Lock relevant `alm_estoque_saldo` rows at `local_origem_id` for update (`SELECT ... FOR UPDATE`).
2. Validate sufficient stock for every item being executed.
3. Insert `SAIDA` movement records at origin.
4. Upsert `alm_estoque_saldo` at origin (decrement).
5. Insert `ENTRADA` movement records at destination.
6. Upsert `alm_estoque_saldo` at destination (increment).
7. Update `alm_transferencia_itens.qtd_executada`.
8. Update `alm_transferencias.status` and `executada_parcial`.

If any step fails, the entire transaction rolls back. No partial state is persisted.

### 4.2 Partial Execution

- A transfer can be executed in multiple calls if needed, as long as it remains in `aprovada` status (which is maintained until fully or partially executed, at which point status moves to `executada`).
- Actually, once `executar` is called for the first time, status becomes `executada` regardless of whether all items were executed.
- `executada_parcial = true` signals that not all requested quantities were fulfilled.
- Items where `qtd_executada = quantidade` are considered fully executed.
- Items where `qtd_executada < quantidade` are considered partially executed.
- Re-execution (calling `executar` again) is NOT permitted once status is `executada`. Remaining quantities must be handled via a new transfer request.

### 4.3 Stock Balance Upsert Pattern

`alm_estoque_saldo` is always updated via upsert:

```sql
INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, saldo, unidade, updated_at)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (tenant_id, local_id, catalogo_id)
DO UPDATE SET
  saldo = alm_estoque_saldo.saldo + EXCLUDED.saldo,
  updated_at = NOW();
```

For SAIDA movements, use a negative delta in the upsert.

### 4.4 Negative Stock Prevention

Before any SAIDA or transfer execution:

```sql
SELECT saldo FROM alm_estoque_saldo
WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3
FOR UPDATE;
```

If `saldo < quantidade_saida`, return `400 INSUFFICIENT_STOCK` immediately. Stock can never go negative.

### 4.5 Transfer Approval Threshold

```
valor_limite_direto = 0   → ALL transfers require approval (no direct execution path)
valor_limite_direto > 0   → transfers with valor_total <= valor_limite_direto are auto-approved at creation (status = 'aprovada')
valor_total IS NULL       → treat as requiring approval (conservative default)
```

### 4.6 OBRA-type Local Auto-Creation

When an obra is created in the system, the `obras.service.ts` create handler must call `alm_locais.service.ts` to auto-create an OBRA-type location:

```typescript
// In obras.service.ts, after obra INSERT:
await almLocaisService.createObraLocal({
  tenantId: obra.tenantId,
  tipo: 'OBRA',
  nome: `Depósito — ${obra.nome}`,
  obraId: obra.id,
  ativo: true,
});
```

This ensures every obra always has an associated stock location. The auto-created local can be renamed by `ADMIN_TENANT` but cannot have its `tipo` changed or `obra_id` removed.

### 4.7 Local Deactivation Guard

A location cannot be deactivated if:
- It has any `alm_estoque_saldo` records with `saldo > 0`.
- It is referenced by any `alm_ordens_compra` with status not in `('cancelada', 'encerrada')`.
- It is referenced by any `alm_solicitacoes` with status not in `('cancelada', 'encerrada')`.
- It is referenced by any `alm_transferencias` with status not in `('executada', 'cancelada')`.

### 4.8 Tenant Isolation

All service methods receive `tenantId` from the authenticated JWT. All database queries include `WHERE tenant_id = $tenantId` as a mandatory clause. The controller layer never passes `tenantId` from the request body.

### 4.9 OBRA-type Local and Obra Deletion

If an obra is soft-deleted (inactivated), the corresponding OBRA-type location must also be soft-deleted (set `ativo = false`), subject to the deactivation guard in Rule 4.7. If the guard blocks deactivation (e.g., remaining stock), the obra deactivation must also be blocked with an appropriate error.

---

## 5. TypeScript Types

These types belong in `alm.types.ts` (new additions alongside existing types).

```typescript
// ============================================================
// Location (alm_locais)
// ============================================================

export type AlmLocalTipo = 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

export interface AlmLocal {
  id: number;
  tenantId: number;
  tipo: AlmLocalTipo;
  nome: string;
  descricao: string | null;
  obraId: number | null;
  endereco: string | null;
  responsavelNome: string | null;
  ativo: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface AlmLocalWithObraNome extends AlmLocal {
  obraNome: string | null; // joined from obras.nome; populated when tipo = 'OBRA'
}

export type CreateAlmLocalDto = {
  tipo: AlmLocalTipo;
  nome: string;
  descricao?: string | null;
  obraId?: number | null;   // required when tipo = 'OBRA'; forbidden otherwise
  endereco?: string | null;
  responsavelNome?: string | null;
};

export type UpdateAlmLocalDto = Partial<Omit<CreateAlmLocalDto, 'tipo'>>;
// Note: 'tipo' is intentionally excluded from updates when movements exist

// ============================================================
// Transferências (alm_transferencias)
// ============================================================

export type AlmTransferenciaStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'executada'
  | 'cancelada';

export interface AlmTransferenciaItem {
  id: number;
  transferenciaId: number;
  catalogoId: number;
  quantidade: number;
  unidade: string;
  qtdExecutada: number;
}

export interface AlmTransferencia {
  id: number;
  tenantId: number;
  localOrigemId: number;
  localDestinoId: number;
  status: AlmTransferenciaStatus;
  valorTotal: number | null;
  solicitanteId: number;
  aprovadorId: number | null;
  aprovadoAt: string | null;     // ISO 8601
  observacao: string | null;
  executadaParcial: boolean;
  itens?: AlmTransferenciaItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AlmTransferenciaWithLocais extends AlmTransferencia {
  localOrigemNome: string;
  localDestinoNome: string;
}

export type CreateAlmTransferenciaDto = {
  localOrigemId: number;
  localDestinoId: number;
  observacao?: string | null;
  itens: Array<{
    catalogoId: number;
    quantidade: number;
    unidade: string;
  }>;
};

export type ExecutarTransferenciaDto = {
  itens?: Array<{
    itemId: number;
    qtdExecutada: number;
  }>;
};

// ============================================================
// Config de Transferência (alm_config_transferencia)
// ============================================================

export interface AlmConfigTransferencia {
  id: number | null;
  tenantId: number;
  valorLimiteDireto: number;
  rolesAprovadores: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export type UpdateAlmConfigTransferenciaDto = {
  valorLimiteDireto: number;       // >= 0
  rolesAprovadores: string[];
};

// ============================================================
// Changed DTOs — existing types that need field renames
// ============================================================

// Previously had 'obraId'; now uses 'localDestinoId'
export type CreateAlmOrdemCompraDto = {
  localDestinoId: number;          // replaces obraId
  // ... all other existing fields unchanged
};

// Previously had 'obraId'; now uses 'localDestinoId'
export type CreateAlmSolicitacaoDto = {
  localDestinoId: number;          // replaces obraId
  // ... all other existing fields unchanged
};

// NF-e acceptance: new required field
export type AceitarAlmNotaFiscalDto = {
  localId: number;                 // destination location chosen at acceptance time
};

// ============================================================
// Query filter types
// ============================================================

export type AlmLocaisFilter = {
  tipo?: AlmLocalTipo;
  ativo?: boolean;
  obraId?: number;
};

export type AlmTransferenciasFilter = {
  status?: AlmTransferenciaStatus;
  localOrigemId?: number;
  localDestinoId?: number;
  page?: number;
  perPage?: number;
};

export type AlmEstoqueFilter = {
  localId?: number;          // replaces obraId
  tipoLocal?: AlmLocalTipo;  // new optional filter
};
```

---

## 6. Frontend Changes Summary

### 6.1 New Pages / Components

#### Locais de Estoque (new page)

- **Route:** `/almoxarifado/locais`
- **Access:** All authenticated users can view; `ADMIN_TENANT` can create/edit/delete
- **List view:** Table with columns: Nome, Tipo (badge), Obra (link, only for OBRA type), Responsável, Status (Ativo/Inativo)
- **Grouping:** Tabs or accordion grouped by `tipo` (CENTRAL, CD, DEPOSITO, OBRA)
- **Create/Edit modal:** Fields: Tipo (select), Nome, Descrição, Obra (conditional dropdown — shown only when Tipo = OBRA), Endereço, Responsável
- **Delete:** Soft-delete with confirmation dialog; display guard error if deactivation is blocked

#### Transferências (new page)

- **Route:** `/almoxarifado/transferencias`
- **List view:** Table with columns: ID, Origem, Destino, Status (badge with color coding), Valor Total, Solicitante, Data
- **Filters:** Status, Local de Origem, Local de Destino
- **Create form:** Origem (dropdown of active locais), Destino (dropdown, excluding origem), Observação, Items table (add rows with Catálogo, Quantidade, Unidade)
- **Detail view:** Shows all fields + itens table + approval/execution action buttons
- **Approval queue:** Filtered view (status = `aguardando_aprovacao`) with Aprovar button (shown only to users with approved roles)
- **Execute button:** Shown when status = `aprovada`; opens partial execution modal allowing per-item quantity entry
- **Cancel button:** Shown for `rascunho`, `aguardando_aprovacao`, `aprovada` statuses

### 6.2 Changed Screens

| Screen | Change Description |
|--------|--------------------|
| **Estoque > Saldo** | Replace "Obra" filter dropdown with "Local" dropdown (populated from `GET /almoxarifado/locais`). Add "Tipo de Local" filter. Column "Obra" renamed to "Local". |
| **Estoque > Movimentos** | Replace "Obra" filter with "Local" filter. Column header "Obra" → "Local". Each row shows `localNome` and `localTipo` badge. |
| **OC > Nova Ordem de Compra** | Field "Obra" → "Local de Destino" (dropdown with all active locais, grouped by tipo). Remove obra-based filtering of the field. |
| **OC > Lista** | Filter "Obra" → "Local de Destino". Column "Obra" → "Local de Destino". |
| **Solicitações > Nova Solicitação** | Field "Obra" → "Local de Destino" (same dropdown as OC). |
| **Solicitações > Lista** | Filter "Obra" → "Local de Destino". Column updated accordingly. |
| **NF-e > Aceitar NF-e modal** | Add required field "Local de Destino" — dropdown of active locais. Validation: cannot confirm acceptance without selecting a local. |
| **Almoxarifado sidebar** | Add two new items under the Almoxarifado submenu: "Locais de Estoque" and "Transferências". |

### 6.3 Component Changes

| Component | Change |
|-----------|--------|
| `AlmLocalSelector` (new) | Reusable dropdown component for selecting a `alm_locais` entry. Props: `value`, `onChange`, `filterTipo`, `filterAtivo`, `placeholder`. Used in OC, Solicitação, NF-e, Transferência forms. |
| `AlmStatusBadge` (new) | Badge component for `AlmTransferenciaStatus` with color coding: rascunho=gray, aguardando_aprovacao=yellow, aprovada=blue, executada=green, cancelada=red. |
| Existing `AlmObraSelector` | Deprecated — replaced by `AlmLocalSelector` in all almoxarifado contexts. Keep only where non-almoxarifado modules reference obras. |

---

## 7. What Does NOT Change

The following tables, services, and integrations are **entirely unmodified** by this redesign:

### Database Tables — Unchanged

| Table | Reason |
|-------|--------|
| `alm_cotacoes` | Cotação is linked to OC, not to obra/local directly |
| `alm_cotacao_itens` | Same as above |
| `alm_planejamento_itens` | Planning is obra-scoped by nature; not an almoxarifado stock concept |
| `alm_orcamento_versoes` | Budget versioning is obra-scoped; unchanged |
| `alm_orcamento_itens` | Same as above |
| `alm_fluxo_aprovacao_config` | Approval flow for solicitações is unchanged |
| `alm_aprovacoes` | Approval records for solicitações are unchanged |
| `alm_unidades_conversao` | Unit conversion table; no location dependency |
| `alm_ai_analises` | AI analysis records; location context passed via `local_id` in IA query params, no schema change |
| `alm_nfe_webhooks` | NF-e webhook infrastructure unchanged |
| `alm_catalogo` | Product catalog; no location dependency |
| `alm_fornecedores` | Supplier table; unchanged |

### Services — Unchanged

| Service / Integration | Notes |
|-----------------------|-------|
| NF-e AI matching pipeline | Webhook receives NF-e → AI matches items to catalog → result stored. Only the acceptance step changes (`obra_id → local_id`). The pipeline itself is unchanged. |
| Approval flow for solicitações | The `alm_fluxo_aprovacao_config` and `alm_aprovacoes` logic is untouched. |
| SINAPI integration | Price reference service; no location dependency. |
| IA anomaly detection service | Receives `local_id` instead of `obra_id` in filter params; no service logic changes. |
| IA reorder suggestion service | Same: replace `obra_id` filter with `local_id` in the query that feeds the model; no logic changes. |
| Cotação flow | Request-for-quote flow linked to OC; OC's `local_destino_id` is a display field only in cotação context; cotação logic unchanged. |
| Unit conversion service | Standalone utility; unchanged. |

---

## 8. Historical Reference

The following files are kept as historical reference and are superseded by this document:

- `docs/superpowers/specs/ADR-001-almoxarifado-tenant.md` — original ADR proposing tenant-level locations
- `docs/superpowers/specs/2026-04-17-almoxarifado-tenant-spec.md` — earlier spec draft with option analysis

**Do not use those files as implementation guides.** This document is the single source of truth for the Almoxarifado redesign.

---

*End of spec — 2026-04-17*
