# Spec: Almoxarifado como Recurso do Tenant

**Versão:** 1.0
**Data:** 2026-04-17
**ADR de referência:** ADR-001-almoxarifado-tenant.md
**Status:** Pronto para implementação

---

## 1. Visão geral do domínio

Após esta mudança, o fluxo de vida de um material no Eldox é:

```
Fornecedor
    │
    ▼ POST /almoxarifado/estoque/entrada
alm_estoque_global  (pool tenant)
    │
    ├─── POST /almoxarifado/alocacoes  ──────► alm_alocacoes (obra A reserva N unidades)
    │
    ├─── POST /almoxarifado/transferencias ──► alm_transferencias (obra A → obra B)
    │
    └─── [consumo interno pela obra]  ───────► alm_cpv (custo lançado por obra)
```

O modelo de dados atual (`alm_estoque_saldo`, `alm_movimentos`) continua existindo como ledger histórico por obra. Novas operações escrevem nos dois conjuntos durante a fase de dual-write, e exclusivamente nas novas tabelas após o cutover.

---

## 2. Prisma Schema — modelos novos e alterados

> Os modelos abaixo usam sintaxe Prisma v5. Todos os nomes de tabela usam `@@map()` com snake_case para compatibilidade com a convenção existente de raw SQL no codebase.

### 2.1 `AlmItemCatalogoTenant` (novo)

Vista materializada do catálogo por tenant. Armazena métricas derivadas de consumo e o ponto de pedido calculado para cada item que o tenant efetivamente usa. Atualizada por job assíncrono.

```prisma
model AlmItemCatalogoTenant {
  id               Int      @id @default(autoincrement())
  tenantId         Int      @map("tenant_id")
  catalogoId       Int      @map("catalogo_id")            // FK lógica para fvm_catalogo_materiais.id (raw table, sem Prisma model)
  unidadePadrao    String   @map("unidade_padrao") @db.VarChar(20)
  estoqueMinGlobal Decimal  @map("estoque_min_global") @db.Decimal(14, 4) @default(0)
  pontoReposicao   Decimal  @map("ponto_reposicao")  @db.Decimal(14, 4) @default(0)   // calculado: consumo_medio_diario * lead_time_dias
  leadTimeDias     Int      @map("lead_time_dias")   @default(0)
  ativo            Boolean  @default(true)
  criadoEm        DateTime  @map("criado_em")  @default(now())
  atualizadoEm    DateTime  @map("atualizado_em") @updatedAt

  estoqueGlobal    AlmEstoqueGlobal[]

  @@unique([tenantId, catalogoId], map: "uq_alm_item_catalogo_tenant")
  @@index([tenantId], map: "idx_alm_item_catalogo_tenant_tenant")
  @@map("alm_item_catalogo_tenant")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `catalogoId` | `Int` | sim | ID em `fvm_catalogo_materiais` |
| `unidadePadrao` | `String(20)` | sim | Unidade padrão de medida (ex: "kg", "un", "m³") |
| `estoqueMinGlobal` | `Decimal(14,4)` | sim, default 0 | Estoque mínimo do pool global (soma de todos as obras) |
| `pontoReposicao` | `Decimal(14,4)` | sim, default 0 | Saldo que dispara alerta de reposição |
| `leadTimeDias` | `Int` | sim, default 0 | Prazo médio de entrega do fornecedor em dias |
| `ativo` | `Boolean` | sim, default true | Se false, item desativado do catálogo do tenant |
| `criadoEm` | `DateTime` | auto | Timestamp de criação |
| `atualizadoEm` | `DateTime` | auto | Timestamp de última atualização |

---

### 2.2 `AlmEstoqueGlobal` (novo)

Saldo autoritativo do pool de materiais do tenant. Uma linha por `(tenantId, itemCatalogoTenantId)`.

```prisma
model AlmEstoqueGlobal {
  id                   Int                    @id @default(autoincrement())
  tenantId             Int                    @map("tenant_id")
  itemCatalogoTenantId Int                    @map("item_catalogo_tenant_id")
  itemCatalogoTenant   AlmItemCatalogoTenant  @relation(fields: [itemCatalogoTenantId], references: [id])
  quantidadeDisponivel Decimal                @map("quantidade_disponivel") @db.Decimal(14, 4) @default(0)  // saldo livre (não alocado)
  quantidadeAlocada    Decimal                @map("quantidade_alocada")   @db.Decimal(14, 4) @default(0)  // soma de alocações ativas
  quantidadeTotal      Decimal                @map("quantidade_total")     @db.Decimal(14, 4) @default(0)  // disponivel + alocado
  custoMedioUnitario   Decimal?               @map("custo_medio_unitario") @db.Decimal(14, 4)              // weighted average cost
  atualizadoEm        DateTime               @map("atualizado_em") @updatedAt

  alocacoes            AlmAlocacao[]
  movimentosGlobais    AlmMovimentoGlobal[]

  @@unique([tenantId, itemCatalogoTenantId], map: "uq_alm_estoque_global")
  @@index([tenantId], map: "idx_alm_estoque_global_tenant")
  @@map("alm_estoque_global")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `itemCatalogoTenantId` | `Int` | sim | FK para `AlmItemCatalogoTenant` |
| `quantidadeDisponivel` | `Decimal(14,4)` | sim | Quantidade livre para novas alocações |
| `quantidadeAlocada` | `Decimal(14,4)` | sim | Quantidade reservada para obras (soma de `alm_alocacoes` com status `ativa`) |
| `quantidadeTotal` | `Decimal(14,4)` | sim | `disponivel + alocada` — mantido consistente por trigger ou pelo serviço |
| `custoMedioUnitario` | `Decimal(14,4)?` | não | Custo médio ponderado; atualizado a cada entrada |
| `atualizadoEm` | `DateTime` | auto | Timestamp de última atualização |

**Invariante:** `quantidadeTotal = quantidadeDisponivel + quantidadeAlocada`. O backend garante isso via transação.

---

### 2.3 `AlmMovimentoGlobal` (novo)

Ledger imutável de movimentos no pool global (equivalente ao `alm_movimentos`, mas no nível tenant).

```prisma
enum AlmMovimentoGlobalTipo {
  ENTRADA
  AJUSTE_POSITIVO
  AJUSTE_NEGATIVO
  PERDA
  ENTRADA_TRANSFERENCIA   // crédito de transferência entre obras (retorno ao pool)
}

model AlmMovimentoGlobal {
  id                   Int                      @id @default(autoincrement())
  tenantId             Int                      @map("tenant_id")
  estoqueGlobalId      Int                      @map("estoque_global_id")
  estoqueGlobal        AlmEstoqueGlobal         @relation(fields: [estoqueGlobalId], references: [id])
  tipo                 AlmMovimentoGlobalTipo
  quantidade           Decimal                  @db.Decimal(14, 4)
  unidade              String                   @db.VarChar(20)
  saldoAnterior        Decimal                  @map("saldo_anterior")  @db.Decimal(14, 4)
  saldoPosterior       Decimal                  @map("saldo_posterior") @db.Decimal(14, 4)
  custoUnitario        Decimal?                 @map("custo_unitario")  @db.Decimal(14, 4)  // preço unitário desta entrada
  referenciaOcId       Int?                     @map("referencia_oc_id")   // FK lógica para alm_ordens_compra.id
  referenciaNfeId      Int?                     @map("referencia_nfe_id")  // FK lógica para alm_notas_fiscais.id
  observacao           String?                  @db.Text
  criadoPor            Int?                     @map("criado_por")
  criadoEm            DateTime                  @map("criado_em") @default(now())

  @@index([tenantId], map: "idx_alm_mov_global_tenant")
  @@index([estoqueGlobalId], map: "idx_alm_mov_global_estoque")
  @@index([tenantId, criadoEm(sort: Desc)], map: "idx_alm_mov_global_tenant_data")
  @@map("alm_movimentos_global")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `estoqueGlobalId` | `Int` | sim | FK para `AlmEstoqueGlobal` |
| `tipo` | `AlmMovimentoGlobalTipo` | sim | Tipo do movimento |
| `quantidade` | `Decimal(14,4)` | sim | Quantidade movimentada (sempre positivo; o tipo define a direção) |
| `unidade` | `String(20)` | sim | Unidade de medida |
| `saldoAnterior` | `Decimal(14,4)` | sim | `quantidadeTotal` antes do movimento |
| `saldoPosterior` | `Decimal(14,4)` | sim | `quantidadeTotal` depois do movimento |
| `custoUnitario` | `Decimal(14,4)?` | não | Custo unitário desta leva (usado para recalcular CMU) |
| `referenciaOcId` | `Int?` | não | ID da OC que originou a entrada (rastreabilidade) |
| `referenciaNfeId` | `Int?` | não | ID da NF-e que confirmou a entrada |
| `observacao` | `String?` | não | Texto livre |
| `criadoPor` | `Int?` | não | ID do usuário |
| `criadoEm` | `DateTime` | auto | Timestamp imutável |

---

### 2.4 `AlmAlocacao` (novo)

Reserva de quantidade do pool global para uma obra específica.

```prisma
enum AlmAlocacaoStatus {
  ATIVA        // material reservado para a obra, ainda não consumido
  CONSUMIDA    // material foi efetivamente usado pela obra (gera AlmCpv)
  CANCELADA    // alocação cancelada; quantidade retorna ao pool
  PARCIAL      // parte consumida, parte devolvida
}

model AlmAlocacao {
  id                   Int                @id @default(autoincrement())
  tenantId             Int                @map("tenant_id")
  estoqueGlobalId      Int                @map("estoque_global_id")
  estoqueGlobal        AlmEstoqueGlobal   @relation(fields: [estoqueGlobalId], references: [id])
  obraId               Int                @map("obra_id")
  quantidade           Decimal            @db.Decimal(14, 4)
  quantidadeConsumida  Decimal            @map("quantidade_consumida") @db.Decimal(14, 4) @default(0)
  quantidadeDevolvida  Decimal            @map("quantidade_devolvida") @db.Decimal(14, 4) @default(0)
  unidade              String             @db.VarChar(20)
  status               AlmAlocacaoStatus  @default(ATIVA)
  solicitacaoId        Int?               @map("solicitacao_id")  // FK lógica para alm_solicitacoes.id (origem)
  localDestinoId       Int?               @map("local_destino_id") // FK lógica para alm_estoque_locais.id
  observacao           String?            @db.Text
  criadoPor            Int?               @map("criado_por")
  aprovadoPor          Int?               @map("aprovado_por")
  aprovadoEm          DateTime?           @map("aprovado_em")
  criadoEm            DateTime            @map("criado_em") @default(now())
  atualizadoEm        DateTime            @map("atualizado_em") @updatedAt

  cpvEntradas          AlmCpv[]

  @@index([tenantId], map: "idx_alm_alocacao_tenant")
  @@index([tenantId, obraId], map: "idx_alm_alocacao_tenant_obra")
  @@index([estoqueGlobalId, status], map: "idx_alm_alocacao_estoque_status")
  @@map("alm_alocacoes")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `estoqueGlobalId` | `Int` | sim | Item alocado do pool |
| `obraId` | `Int` | sim | Obra beneficiária |
| `quantidade` | `Decimal(14,4)` | sim | Quantidade alocada inicialmente |
| `quantidadeConsumida` | `Decimal(14,4)` | sim, default 0 | Acumulado consumido pela obra |
| `quantidadeDevolvida` | `Decimal(14,4)` | sim, default 0 | Devolvido ao pool |
| `unidade` | `String(20)` | sim | Unidade de medida |
| `status` | `AlmAlocacaoStatus` | sim, default ATIVA | Estado da alocação |
| `solicitacaoId` | `Int?` | não | Solicitação de material que originou esta alocação |
| `localDestinoId` | `Int?` | não | Local físico na obra onde o material será armazenado |
| `observacao` | `String?` | não | Texto livre |
| `criadoPor` | `Int?` | não | ID do usuário que criou |
| `aprovadoPor` | `Int?` | não | ID do usuário que aprovou (ADMIN_TENANT ou ENGENHEIRO) |
| `aprovadoEm` | `DateTime?` | não | Timestamp da aprovação |
| `criadoEm` | `DateTime` | auto | Timestamp imutável |
| `atualizadoEm` | `DateTime` | auto | Última atualização |

**Invariante:** `quantidadeConsumida + quantidadeDevolvida <= quantidade`.

---

### 2.5 `AlmTransferencia` (novo)

Entidade de transferência de material entre duas obras. Substitui a abordagem atual de dois movimentos avulsos.

```prisma
enum AlmTransferenciaStatus {
  PENDENTE      // criada, aguardando aprovação
  APROVADA      // aprovada, aguardando despacho físico
  DESPACHADA    // enviada pela obra origem
  RECEBIDA      // confirmada pela obra destino
  CANCELADA     // cancelada antes do recebimento
}

model AlmTransferencia {
  id                   Int                      @id @default(autoincrement())
  tenantId             Int                      @map("tenant_id")
  estoqueGlobalId      Int                      @map("estoque_global_id")   // item transferido
  obraOrigemId         Int                      @map("obra_origem_id")
  obraDestinoId        Int                      @map("obra_destino_id")
  alocacaoOrigemId     Int?                     @map("alocacao_origem_id")  // alocação consumida na origem (se existir)
  quantidade           Decimal                  @db.Decimal(14, 4)
  unidade              String                   @db.VarChar(20)
  status               AlmTransferenciaStatus   @default(PENDENTE)
  motivacao            String?                  @db.Text                    // justificativa da transferência
  observacaoDespacho   String?                  @map("observacao_despacho") @db.Text
  observacaoRecebimento String?                 @map("observacao_recebimento") @db.Text
  solicitadoPor        Int?                     @map("solicitado_por")
  aprovadoPor          Int?                     @map("aprovado_por")
  despachoPor          Int?                     @map("despacho_por")
  recebidoPor          Int?                     @map("recebido_por")
  aprovadoEm          DateTime?                 @map("aprovado_em")
  despachoPorEm       DateTime?                 @map("despacho_em")
  recebidoEm          DateTime?                 @map("recebido_em")
  criadoEm            DateTime                  @map("criado_em") @default(now())
  atualizadoEm        DateTime                  @map("atualizado_em") @updatedAt

  @@index([tenantId], map: "idx_alm_transf_tenant")
  @@index([tenantId, obraOrigemId], map: "idx_alm_transf_origem")
  @@index([tenantId, obraDestinoId], map: "idx_alm_transf_destino")
  @@index([tenantId, status], map: "idx_alm_transf_status")
  @@map("alm_transferencias")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `estoqueGlobalId` | `Int` | sim | Item sendo transferido |
| `obraOrigemId` | `Int` | sim | Obra que envia o material |
| `obraDestinoId` | `Int` | sim | Obra que recebe o material |
| `alocacaoOrigemId` | `Int?` | não | Alocação da obra origem que será parcialmente consumida |
| `quantidade` | `Decimal(14,4)` | sim | Quantidade a transferir |
| `unidade` | `String(20)` | sim | Unidade de medida |
| `status` | `AlmTransferenciaStatus` | sim, default PENDENTE | Estado do fluxo |
| `motivacao` | `String?` | não | Justificativa da solicitação de transferência |
| `observacaoDespacho` | `String?` | não | Notas ao despachar |
| `observacaoRecebimento` | `String?` | não | Notas ao receber |
| `solicitadoPor` | `Int?` | não | Quem criou a solicitação de transferência |
| `aprovadoPor` | `Int?` | não | Quem aprovou |
| `despachoPor` | `Int?` | não | Quem confirmou o despacho |
| `recebidoPor` | `Int?` | não | Quem confirmou o recebimento |
| `aprovadoEm` | `DateTime?` | não | Quando aprovado |
| `despachoPorEm` | `DateTime?` | não | Quando despachado |
| `recebidoEm` | `DateTime?` | não | Quando recebido |
| `criadoEm` | `DateTime` | auto | Timestamp imutável |
| `atualizadoEm` | `DateTime` | auto | Última atualização |

---

### 2.6 `AlmCpv` (novo)

Registro de custo do produto vendido/consumido por obra. Cada vez que um material é consumido definitivamente por uma obra (saída para uso em serviço), um registro de CPV é criado.

```prisma
enum AlmCpvTipoConsumo {
  SAIDA_DIRETA     // saída registrada diretamente sem solicitação
  SAIDA_SOLICITACAO // saída vinculada a uma solicitação aprovada
  PERDA            // perda registrada (roubo, avaria, vencimento)
  AJUSTE           // ajuste de inventário (negativo)
}

model AlmCpv {
  id                   Int                @id @default(autoincrement())
  tenantId             Int                @map("tenant_id")
  obraId               Int                @map("obra_id")
  alocacaoId           Int?               @map("alocacao_id")
  alocacao             AlmAlocacao?       @relation(fields: [alocacaoId], references: [id])
  catalogoId           Int                @map("catalogo_id")           // FK lógica para fvm_catalogo_materiais.id
  tipoConsumo          AlmCpvTipoConsumo  @map("tipo_consumo")
  quantidade           Decimal            @db.Decimal(14, 4)
  unidade              String             @db.VarChar(20)
  custoUnitario        Decimal            @map("custo_unitario")  @db.Decimal(14, 4)  // CMU no momento do consumo
  custoTotal           Decimal            @map("custo_total")     @db.Decimal(14, 4)  // quantidade * custo_unitario
  periodoAno           Int                @map("periodo_ano")     // ano do consumo (desnormalizado para relatórios)
  periodoMes           Int                @map("periodo_mes")     // mês do consumo (1-12)
  solicitacaoId        Int?               @map("solicitacao_id")
  movimentoObraId      Int?               @map("movimento_obra_id")  // FK lógica para alm_movimentos.id
  observacao           String?            @db.Text
  criadoPor            Int?               @map("criado_por")
  criadoEm            DateTime            @map("criado_em") @default(now())

  @@index([tenantId], map: "idx_alm_cpv_tenant")
  @@index([tenantId, obraId], map: "idx_alm_cpv_tenant_obra")
  @@index([tenantId, obraId, periodoAno, periodoMes], map: "idx_alm_cpv_periodo")
  @@index([tenantId, catalogoId], map: "idx_alm_cpv_catalogo")
  @@map("alm_cpv")
}
```

**Campos:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | `Int` | auto | PK |
| `tenantId` | `Int` | sim | Tenant owner |
| `obraId` | `Int` | sim | Obra que consumiu |
| `alocacaoId` | `Int?` | não | Alocação de origem do consumo |
| `catalogoId` | `Int` | sim | Item do catálogo consumido |
| `tipoConsumo` | `AlmCpvTipoConsumo` | sim | Como o material foi consumido |
| `quantidade` | `Decimal(14,4)` | sim | Quantidade consumida |
| `unidade` | `String(20)` | sim | Unidade de medida |
| `custoUnitario` | `Decimal(14,4)` | sim | CMU no momento do consumo (snap do custo médio) |
| `custoTotal` | `Decimal(14,4)` | sim | `quantidade * custoUnitario` |
| `periodoAno` | `Int` | sim | Ano (ex: 2026) |
| `periodoMes` | `Int` | sim | Mês (1-12) |
| `solicitacaoId` | `Int?` | não | Solicitação que originou o consumo |
| `movimentoObraId` | `Int?` | não | `alm_movimentos.id` correspondente na tabela legada |
| `observacao` | `String?` | não | Texto livre |
| `criadoPor` | `Int?` | não | ID do usuário |
| `criadoEm` | `DateTime` | auto | Timestamp imutável |

---

### 2.7 Alterações em tabelas existentes

#### `alm_estoque_saldo` — campos adicionados

```sql
ALTER TABLE alm_estoque_saldo
  ADD COLUMN saldo_global_id INT REFERENCES alm_estoque_global(id) ON DELETE SET NULL;
```

Mapeamento Prisma (adição ao model existente):
```prisma
saldoGlobalId  Int?  @map("saldo_global_id")
// Relação não declarada no model legado para não quebrar queries existentes.
// Usada apenas em nova lógica.
```

#### `alm_movimentos` — campos adicionados

```sql
ALTER TABLE alm_movimentos
  ADD COLUMN alocacao_id      INT REFERENCES alm_alocacoes(id) ON DELETE SET NULL,
  ADD COLUMN transferencia_id INT REFERENCES alm_transferencias(id) ON DELETE SET NULL;
```

#### `alm_ordens_compra` — `obra_id` passa a nullable

```sql
ALTER TABLE alm_ordens_compra ALTER COLUMN obra_id DROP NOT NULL;
```

OCs sem `obra_id` são OCs de tenant (compra centralizada). O campo `obra_id` é mantido para OCs criadas dentro do contexto de uma obra.

---

## 3. API Endpoints

### Convenções

- Base path: `/api/v1/almoxarifado`
- Autenticação: JWT via `Authorization: Bearer <token>`
- Tenant extraído do JWT via `@TenantId()` decorator
- Erros retornam `{ statusCode, message, error }` no padrão NestJS

---

### 3.1 `GET /almoxarifado/estoque` — Visão global do estoque do tenant

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Query params:**

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nivel` | `"critico" \| "atencao" \| "normal"` | não | Filtro por nível de alerta |
| `catalogoId` | `number` | não | Filtro por item do catálogo |
| `apenasComSaldo` | `"true" \| "false"` | não | Se true, omite itens com saldo zero |
| `limit` | `number` | não | Máximo de resultados (default 50, máx 200) |
| `offset` | `number` | não | Offset para paginação (default 0) |

**Response 200:**

```json
{
  "total": 42,
  "items": [
    {
      "id": 1,
      "catalogoId": 10,
      "catalogoNome": "Cimento CP-II 50kg",
      "catalogoCodigo": "CIM-001",
      "unidade": "sc",
      "quantidadeDisponivel": 120.00,
      "quantidadeAlocada": 80.00,
      "quantidadeTotal": 200.00,
      "estoqueMinGlobal": 50.00,
      "pontoReposicao": 70.00,
      "custoMedioUnitario": 38.50,
      "valorTotalEstoque": 7700.00,
      "nivel": "normal",
      "alocacoesPorObra": [
        { "obraId": 3, "obraNome": "Edif. Centro", "quantidadeAlocada": 50.00 },
        { "obraId": 7, "obraNome": "Residencial Norte", "quantidadeAlocada": 30.00 }
      ]
    }
  ]
}
```

**Erros:**
- `403 Forbidden` — papel insuficiente (`TECNICO`, `VISITANTE`)

---

### 3.2 `POST /almoxarifado/estoque/entrada` — Entrada de material no pool global

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Request body:**

```json
{
  "catalogoId": 10,
  "quantidade": 100.00,
  "unidade": "sc",
  "custoUnitario": 38.50,
  "referenciaOcId": 55,
  "referenciaNfeId": 22,
  "observacao": "Recebimento OC-055 NF 001234"
}
```

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `catalogoId` | `number` (int) | sim | Deve existir em `fvm_catalogo_materiais` para o tenant |
| `quantidade` | `number` (decimal) | sim | > 0 |
| `unidade` | `string` | sim | Máximo 20 caracteres |
| `custoUnitario` | `number` (decimal) | não | >= 0; se omitido, usa CMU atual do `alm_estoque_global` |
| `referenciaOcId` | `number` (int) | não | Deve existir em `alm_ordens_compra` para o tenant |
| `referenciaNfeId` | `number` (int) | não | Deve existir em `alm_notas_fiscais` para o tenant |
| `observacao` | `string` | não | Máximo 1000 caracteres |

**Response 201:**

```json
{
  "id": 301,
  "estoqueGlobal": {
    "id": 1,
    "catalogoId": 10,
    "quantidadeTotal": 300.00,
    "quantidadeDisponivel": 220.00,
    "custoMedioUnitario": 38.50
  },
  "movimentoId": 4501
}
```

**Erros:**
- `400 Bad Request` — `quantidade <= 0`, `catalogoId` inválido, `unidade` ausente
- `403 Forbidden` — papel insuficiente
- `404 Not Found` — `referenciaOcId` ou `referenciaNfeId` não pertencem ao tenant

---

### 3.3 `POST /almoxarifado/alocacoes` — Alocar material do pool para uma obra

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Request body:**

```json
{
  "estoqueGlobalId": 1,
  "obraId": 3,
  "quantidade": 50.00,
  "unidade": "sc",
  "solicitacaoId": 12,
  "localDestinoId": 5,
  "observacao": "Material para fundação bloco B"
}
```

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `estoqueGlobalId` | `number` (int) | sim | Deve existir para o tenant |
| `obraId` | `number` (int) | sim | Deve existir e pertencer ao tenant; não pode estar com `status = 'encerrada'` |
| `quantidade` | `number` (decimal) | sim | > 0; deve ser <= `quantidadeDisponivel` do pool |
| `unidade` | `string` | sim | Deve coincidir com `unidadePadrao` do item (ou ser conversível — validação futura) |
| `solicitacaoId` | `number` (int) | não | Deve existir em `alm_solicitacoes` para o tenant |
| `localDestinoId` | `number` (int) | não | Deve existir em `alm_estoque_locais` para a obra |
| `observacao` | `string` | não | Máximo 1000 caracteres |

**Response 201:**

```json
{
  "id": 88,
  "tenantId": 1,
  "estoqueGlobalId": 1,
  "obraId": 3,
  "quantidade": 50.00,
  "quantidadeConsumida": 0.00,
  "quantidadeDevolvida": 0.00,
  "unidade": "sc",
  "status": "ATIVA",
  "criadoEm": "2026-04-17T14:00:00.000Z"
}
```

**Erros:**
- `400 Bad Request` — `quantidade <= 0`, unidade incompatível, obra encerrada
- `400 Bad Request` — saldo insuficiente no pool (`"Saldo insuficiente. Disponível: X sc"`)
- `403 Forbidden` — papel insuficiente
- `404 Not Found` — `estoqueGlobalId` ou `obraId` não encontrado para o tenant

---

### 3.4 `GET /almoxarifado/alocacoes` — Listar alocações do tenant

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO`

**Query params:**

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `obraId` | `number` | não | Filtrar por obra |
| `estoqueGlobalId` | `number` | não | Filtrar por item do pool |
| `status` | `AlmAlocacaoStatus` | não | Filtrar por status |
| `limit` | `number` | não | Default 50, máx 200 |
| `offset` | `number` | não | Default 0 |

**Response 200:**

```json
{
  "total": 15,
  "items": [
    {
      "id": 88,
      "obraId": 3,
      "obraNome": "Edif. Centro",
      "catalogoId": 10,
      "catalogoNome": "Cimento CP-II 50kg",
      "quantidade": 50.00,
      "quantidadeConsumida": 10.00,
      "quantidadeDevolvida": 0.00,
      "saldoRestante": 40.00,
      "unidade": "sc",
      "status": "ATIVA",
      "criadoEm": "2026-04-17T14:00:00.000Z"
    }
  ]
}
```

**Erros:**
- `403 Forbidden` — papel insuficiente (`VISITANTE`)

---

### 3.5 `PATCH /almoxarifado/alocacoes/:id/consumir` — Registrar consumo de alocação

Registra que a obra efetivamente utilizou uma quantidade da alocação. Cria registro em `alm_cpv`.

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO`

**Request body:**

```json
{
  "quantidade": 10.00,
  "tipoConsumo": "SAIDA_SOLICITACAO",
  "solicitacaoId": 12,
  "observacao": "Consumo fundação bloco B semana 15"
}
```

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `quantidade` | `number` | sim | > 0; <= `saldo restante da alocação` |
| `tipoConsumo` | `AlmCpvTipoConsumo` | sim | Enum válido |
| `solicitacaoId` | `number` | não | Obrigatório se `tipoConsumo = 'SAIDA_SOLICITACAO'` |
| `observacao` | `string` | não | Máximo 1000 caracteres |

**Response 200:**

```json
{
  "alocacaoId": 88,
  "status": "PARCIAL",
  "quantidadeConsumida": 10.00,
  "saldoRestante": 40.00,
  "cpvId": 201,
  "custoTotal": 385.00
}
```

**Erros:**
- `400 Bad Request` — quantidade excede saldo disponível na alocação
- `400 Bad Request` — alocação com status `CANCELADA` ou `CONSUMIDA` não pode ser consumida
- `403 Forbidden` — papel insuficiente
- `404 Not Found` — alocação não encontrada para o tenant

---

### 3.6 `POST /almoxarifado/transferencias` — Solicitar transferência entre obras

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Request body:**

```json
{
  "estoqueGlobalId": 1,
  "obraOrigemId": 3,
  "obraDestinoId": 7,
  "alocacaoOrigemId": 88,
  "quantidade": 20.00,
  "unidade": "sc",
  "motivacao": "Obra destino com ruptura crítica de cimento"
}
```

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `estoqueGlobalId` | `number` | sim | Deve existir para o tenant |
| `obraOrigemId` | `number` | sim | Deve existir, pertencer ao tenant, não estar encerrada |
| `obraDestinoId` | `number` | sim | Deve existir, pertencer ao tenant, não estar encerrada; != `obraOrigemId` |
| `alocacaoOrigemId` | `number` | não | Se informado, a transferência consome desta alocação específica |
| `quantidade` | `number` | sim | > 0 |
| `unidade` | `string` | sim | Deve coincidir com `unidadePadrao` do item |
| `motivacao` | `string` | não | Máximo 2000 caracteres |

**Response 201:**

```json
{
  "id": 15,
  "tenantId": 1,
  "estoqueGlobalId": 1,
  "obraOrigemId": 3,
  "obraDestinoId": 7,
  "quantidade": 20.00,
  "unidade": "sc",
  "status": "PENDENTE",
  "criadoEm": "2026-04-17T14:30:00.000Z"
}
```

**Erros:**
- `400 Bad Request` — obras iguais na origem e destino
- `400 Bad Request` — obra encerrada
- `400 Bad Request` — quantidade excede saldo disponível na alocação de origem (se `alocacaoOrigemId` informado)
- `403 Forbidden` — papel insuficiente
- `404 Not Found` — `estoqueGlobalId`, `obraOrigemId` ou `obraDestinoId` não encontrado

---

### 3.7 `PATCH /almoxarifado/transferencias/:id/aprovar` — Aprovar transferência

**Auth:** `ADMIN_TENANT`

**Request body:** `{}` (sem campos obrigatórios)

**Response 200:**

```json
{
  "id": 15,
  "status": "APROVADA",
  "aprovadoPor": 42,
  "aprovadoEm": "2026-04-17T15:00:00.000Z"
}
```

**Erros:**
- `400 Bad Request` — transferência não está com status `PENDENTE`
- `403 Forbidden` — apenas `ADMIN_TENANT`
- `404 Not Found` — transferência não encontrada para o tenant

---

### 3.8 `PATCH /almoxarifado/transferencias/:id/despachar` — Confirmar despacho

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Request body:**

```json
{ "observacao": "Saiu com o caminhão às 08h00 do dia 18/04" }
```

**Response 200:**

```json
{ "id": 15, "status": "DESPACHADA", "despachoPorEm": "2026-04-18T08:00:00.000Z" }
```

**Erros:**
- `400 Bad Request` — transferência não está com status `APROVADA`
- `403 Forbidden` — papel insuficiente
- `404 Not Found`

---

### 3.9 `PATCH /almoxarifado/transferencias/:id/receber` — Confirmar recebimento

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO`

**Request body:**

```json
{
  "quantidadeRecebida": 20.00,
  "localDestinoId": 9,
  "observacao": "Recebido em bom estado"
}
```

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| `quantidadeRecebida` | `number` | sim | > 0; <= quantidade da transferência |
| `localDestinoId` | `number` | não | Local na obra destino |
| `observacao` | `string` | não | Máximo 1000 caracteres |

Ao confirmar recebimento, o backend:
1. Cria uma `AlmAlocacao` para a obra destino com `quantidade = quantidadeRecebida`.
2. Se `alocacaoOrigemId` existia, consome `quantidadeRecebida` da alocação de origem.
3. Atualiza status da transferência para `RECEBIDA`.

**Response 200:**

```json
{
  "id": 15,
  "status": "RECEBIDA",
  "recebidoEm": "2026-04-18T10:00:00.000Z",
  "novaAlocacaoDestinoId": 97
}
```

**Erros:**
- `400 Bad Request` — transferência não está com status `DESPACHADA`
- `400 Bad Request` — `quantidadeRecebida > quantidade` da transferência
- `403 Forbidden` — papel insuficiente
- `404 Not Found`

---

### 3.10 `GET /almoxarifado/transferencias` — Listar transferências do tenant

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO`

**Query params:**

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `obraId` | `number` | não | Filtra por obra envolvida (origem OU destino) |
| `status` | `AlmTransferenciaStatus` | não | Filtra por status |
| `dataInicio` | `string` (ISO 8601) | não | Filtra por `criadoEm >= dataInicio` |
| `dataFim` | `string` (ISO 8601) | não | Filtra por `criadoEm <= dataFim` |
| `limit` | `number` | não | Default 50, máx 200 |
| `offset` | `number` | não | Default 0 |

**Response 200:**

```json
{
  "total": 8,
  "items": [
    {
      "id": 15,
      "catalogoNome": "Cimento CP-II 50kg",
      "obraOrigemId": 3,
      "obraOrigemNome": "Edif. Centro",
      "obraDestinoId": 7,
      "obraDestinoNome": "Residencial Norte",
      "quantidade": 20.00,
      "unidade": "sc",
      "status": "RECEBIDA",
      "criadoEm": "2026-04-17T14:30:00.000Z",
      "recebidoEm": "2026-04-18T10:00:00.000Z"
    }
  ]
}
```

---

### 3.11 `GET /almoxarifado/cpv` — Relatório de CPV por obra e período

**Auth:** `ADMIN_TENANT`, `ENGENHEIRO`

**Query params:**

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `obraId` | `number` | não | Filtrar por obra específica |
| `ano` | `number` | sim | Ano do período (ex: 2026) |
| `mesInicio` | `number` | não | Mês início (1-12, default 1) |
| `mesFim` | `number` | não | Mês fim (1-12, default 12) |
| `catalogoId` | `number` | não | Filtrar por item do catálogo |
| `agruparPor` | `"obra" \| "catalogo" \| "mes"` | não | Agrupamento dos resultados (default `"obra"`) |

**Response 200 (agruparPor = "obra"):**

```json
{
  "periodo": { "ano": 2026, "mesInicio": 1, "mesFim": 4 },
  "totalGeral": 154320.50,
  "itens": [
    {
      "obraId": 3,
      "obraNome": "Edif. Centro",
      "totalCpv": 98400.00,
      "percentualDoTotal": 63.8,
      "porMes": [
        { "ano": 2026, "mes": 1, "total": 22000.00 },
        { "ano": 2026, "mes": 2, "total": 31500.00 },
        { "ano": 2026, "mes": 3, "total": 29900.00 },
        { "ano": 2026, "mes": 4, "total": 15000.00 }
      ]
    },
    {
      "obraId": 7,
      "obraNome": "Residencial Norte",
      "totalCpv": 55920.50,
      "percentualDoTotal": 36.2,
      "porMes": [...]
    }
  ]
}
```

**Response 200 (agruparPor = "catalogo"):**

```json
{
  "periodo": { "ano": 2026, "mesInicio": 1, "mesFim": 4 },
  "totalGeral": 154320.50,
  "itens": [
    {
      "catalogoId": 10,
      "catalogoNome": "Cimento CP-II 50kg",
      "totalCpv": 42000.00,
      "quantidadeTotalConsumida": 1090.91,
      "unidade": "sc",
      "custoMedioUnitario": 38.50,
      "percentualDoTotal": 27.2
    }
  ]
}
```

**Erros:**
- `400 Bad Request` — `ano` ausente ou inválido; `mesInicio > mesFim`; `agruparPor` inválido
- `403 Forbidden` — papel insuficiente

---

### 3.12 Endpoints existentes — mudanças de comportamento

#### `GET /almoxarifado/obras/:obraId/estoque` (mantido, comportamento alterado)

Após a migração, o saldo retornado é derivado das alocações ativas para a obra (soma de `alm_alocacoes.quantidade - quantidadeConsumida - quantidadeDevolvida` por `estoqueGlobalId`). O campo `nivel` continua sendo calculado comparando o saldo alocado restante com o `estoque_min` original.

Adição ao response: campo `alocacaoId` em cada linha, permitindo que o frontend inicie operações de consumo diretamente.

#### `POST /almoxarifado/obras/:obraId/estoque/movimentos` com `tipo: 'entrada'` (deprecado)

- Rota mantida por 90 dias.
- Internamente faz: entrada no pool global + alocação automática para a obra.
- Response adiciona header `Deprecation: true` e `Sunset: <data 90 dias>`.
- Após o prazo, retorna `410 Gone` com body `{ "message": "Use POST /almoxarifado/estoque/entrada seguido de POST /almoxarifado/alocacoes" }`.

#### `POST /almoxarifado/obras/:obraId/estoque/transferencias` (deprecado)

- Rota mantida por 90 dias.
- Internamente cria uma `AlmTransferencia` com status imediatamente avançado para `RECEBIDA` (sem aprovação) para compatibilidade retroativa.
- Response adiciona header `Deprecation: true`.
- Após o prazo, retorna `410 Gone`.

---

## 4. Plano de migração

### Pré-requisitos

- Backup completo do banco executado imediatamente antes de cada fase.
- Scripts executados em janela de manutenção (exceto Fase 1, que é aditiva e pode ser feita em produção).
- Ambiente de staging deve passar por todas as fases antes de produção.

---

### Fase 1 — Criar novas tabelas (sem downtime)

```sql
-- 1.1 alm_item_catalogo_tenant
CREATE TABLE alm_item_catalogo_tenant (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INT NOT NULL,
  catalogo_id        INT NOT NULL,
  unidade_padrao     VARCHAR(20) NOT NULL,
  estoque_min_global NUMERIC(14,4) NOT NULL DEFAULT 0,
  ponto_reposicao    NUMERIC(14,4) NOT NULL DEFAULT 0,
  lead_time_dias     INT NOT NULL DEFAULT 0,
  ativo              BOOLEAN NOT NULL DEFAULT true,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_alm_item_catalogo_tenant UNIQUE (tenant_id, catalogo_id)
);
CREATE INDEX idx_alm_item_catalogo_tenant_tenant ON alm_item_catalogo_tenant(tenant_id);

-- 1.2 alm_estoque_global
CREATE TABLE alm_estoque_global (
  id                     SERIAL PRIMARY KEY,
  tenant_id              INT NOT NULL,
  item_catalogo_tenant_id INT NOT NULL REFERENCES alm_item_catalogo_tenant(id),
  quantidade_disponivel  NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantidade_alocada     NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantidade_total       NUMERIC(14,4) NOT NULL DEFAULT 0,
  custo_medio_unitario   NUMERIC(14,4),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_alm_estoque_global UNIQUE (tenant_id, item_catalogo_tenant_id)
);
CREATE INDEX idx_alm_estoque_global_tenant ON alm_estoque_global(tenant_id);

-- 1.3 alm_movimentos_global
CREATE TYPE alm_movimento_global_tipo AS ENUM (
  'ENTRADA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PERDA', 'ENTRADA_TRANSFERENCIA'
);
CREATE TABLE alm_movimentos_global (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  estoque_global_id   INT NOT NULL REFERENCES alm_estoque_global(id),
  tipo                alm_movimento_global_tipo NOT NULL,
  quantidade          NUMERIC(14,4) NOT NULL,
  unidade             VARCHAR(20) NOT NULL,
  saldo_anterior      NUMERIC(14,4) NOT NULL,
  saldo_posterior     NUMERIC(14,4) NOT NULL,
  custo_unitario      NUMERIC(14,4),
  referencia_oc_id    INT,
  referencia_nfe_id   INT,
  observacao          TEXT,
  criado_por          INT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alm_mov_global_tenant        ON alm_movimentos_global(tenant_id);
CREATE INDEX idx_alm_mov_global_estoque       ON alm_movimentos_global(estoque_global_id);
CREATE INDEX idx_alm_mov_global_tenant_data   ON alm_movimentos_global(tenant_id, criado_em DESC);

-- 1.4 alm_alocacoes
CREATE TYPE alm_alocacao_status AS ENUM ('ATIVA', 'CONSUMIDA', 'CANCELADA', 'PARCIAL');
CREATE TABLE alm_alocacoes (
  id                     SERIAL PRIMARY KEY,
  tenant_id              INT NOT NULL,
  estoque_global_id      INT NOT NULL REFERENCES alm_estoque_global(id),
  obra_id                INT NOT NULL,
  quantidade             NUMERIC(14,4) NOT NULL,
  quantidade_consumida   NUMERIC(14,4) NOT NULL DEFAULT 0,
  quantidade_devolvida   NUMERIC(14,4) NOT NULL DEFAULT 0,
  unidade                VARCHAR(20) NOT NULL,
  status                 alm_alocacao_status NOT NULL DEFAULT 'ATIVA',
  solicitacao_id         INT,
  local_destino_id       INT,
  observacao             TEXT,
  criado_por             INT,
  aprovado_por           INT,
  aprovado_em            TIMESTAMPTZ,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alm_alocacao_tenant        ON alm_alocacoes(tenant_id);
CREATE INDEX idx_alm_alocacao_tenant_obra   ON alm_alocacoes(tenant_id, obra_id);
CREATE INDEX idx_alm_alocacao_estoque_status ON alm_alocacoes(estoque_global_id, status);

-- 1.5 alm_transferencias
CREATE TYPE alm_transferencia_status AS ENUM (
  'PENDENTE', 'APROVADA', 'DESPACHADA', 'RECEBIDA', 'CANCELADA'
);
CREATE TABLE alm_transferencias (
  id                      SERIAL PRIMARY KEY,
  tenant_id               INT NOT NULL,
  estoque_global_id       INT NOT NULL REFERENCES alm_estoque_global(id),
  obra_origem_id          INT NOT NULL,
  obra_destino_id         INT NOT NULL,
  alocacao_origem_id      INT REFERENCES alm_alocacoes(id),
  quantidade              NUMERIC(14,4) NOT NULL,
  unidade                 VARCHAR(20) NOT NULL,
  status                  alm_transferencia_status NOT NULL DEFAULT 'PENDENTE',
  motivacao               TEXT,
  observacao_despacho     TEXT,
  observacao_recebimento  TEXT,
  solicitado_por          INT,
  aprovado_por            INT,
  despacho_por            INT,
  recebido_por            INT,
  aprovado_em             TIMESTAMPTZ,
  despacho_em             TIMESTAMPTZ,
  recebido_em             TIMESTAMPTZ,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alm_transf_tenant   ON alm_transferencias(tenant_id);
CREATE INDEX idx_alm_transf_origem   ON alm_transferencias(tenant_id, obra_origem_id);
CREATE INDEX idx_alm_transf_destino  ON alm_transferencias(tenant_id, obra_destino_id);
CREATE INDEX idx_alm_transf_status   ON alm_transferencias(tenant_id, status);

-- 1.6 alm_cpv
CREATE TYPE alm_cpv_tipo_consumo AS ENUM (
  'SAIDA_DIRETA', 'SAIDA_SOLICITACAO', 'PERDA', 'AJUSTE'
);
CREATE TABLE alm_cpv (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  obra_id          INT NOT NULL,
  alocacao_id      INT REFERENCES alm_alocacoes(id),
  catalogo_id      INT NOT NULL,
  tipo_consumo     alm_cpv_tipo_consumo NOT NULL,
  quantidade       NUMERIC(14,4) NOT NULL,
  unidade          VARCHAR(20) NOT NULL,
  custo_unitario   NUMERIC(14,4) NOT NULL,
  custo_total      NUMERIC(14,4) NOT NULL,
  periodo_ano      INT NOT NULL,
  periodo_mes      INT NOT NULL,
  solicitacao_id   INT,
  movimento_obra_id INT,
  observacao       TEXT,
  criado_por       INT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_alm_cpv_tenant         ON alm_cpv(tenant_id);
CREATE INDEX idx_alm_cpv_tenant_obra    ON alm_cpv(tenant_id, obra_id);
CREATE INDEX idx_alm_cpv_periodo        ON alm_cpv(tenant_id, obra_id, periodo_ano, periodo_mes);
CREATE INDEX idx_alm_cpv_catalogo       ON alm_cpv(tenant_id, catalogo_id);

-- 1.7 Colunas adicionadas em tabelas existentes
ALTER TABLE alm_estoque_saldo
  ADD COLUMN IF NOT EXISTS saldo_global_id INT REFERENCES alm_estoque_global(id) ON DELETE SET NULL;

ALTER TABLE alm_movimentos
  ADD COLUMN IF NOT EXISTS alocacao_id      INT REFERENCES alm_alocacoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferencia_id INT REFERENCES alm_transferencias(id) ON DELETE SET NULL;

ALTER TABLE alm_ordens_compra
  ALTER COLUMN obra_id DROP NOT NULL;
```

---

### Fase 2 — Backfill de dados existentes

Este script popula as novas tabelas a partir dos dados legados. Deve ser executado em transação. Estimativa: ~1–5 minutos para tenants com até 100 mil movimentos.

```sql
-- Executar dentro de uma transação
BEGIN;

-- 2.1 Popular alm_item_catalogo_tenant
-- Para cada (tenant_id, catalogo_id) que aparece em alm_estoque_saldo, criar entrada no catálogo do tenant
INSERT INTO alm_item_catalogo_tenant (tenant_id, catalogo_id, unidade_padrao, criado_em)
SELECT DISTINCT
  s.tenant_id,
  s.catalogo_id,
  s.unidade,
  MIN(s.updated_at) OVER (PARTITION BY s.tenant_id, s.catalogo_id)
FROM alm_estoque_saldo s
ON CONFLICT (tenant_id, catalogo_id) DO NOTHING;

-- 2.2 Popular alm_estoque_global
-- Saldo = soma de alm_estoque_saldo por (tenant_id, catalogo_id)
-- Custo médio = derivado da OC mais recente com preco_unitario para o item
INSERT INTO alm_estoque_global (
  tenant_id,
  item_catalogo_tenant_id,
  quantidade_disponivel,
  quantidade_alocada,
  quantidade_total,
  custo_medio_unitario,
  atualizado_em
)
SELECT
  ict.tenant_id,
  ict.id                                       AS item_catalogo_tenant_id,
  0                                            AS quantidade_disponivel,  -- será 0; toda quantidade fica alocada
  SUM(s.quantidade)                            AS quantidade_alocada,
  SUM(s.quantidade)                            AS quantidade_total,
  (
    SELECT oi.preco_unitario
    FROM alm_oc_itens oi
    JOIN alm_ordens_compra oc ON oc.id = oi.oc_id
    WHERE oc.tenant_id = ict.tenant_id
      AND oi.catalogo_id = ict.catalogo_id
      AND oi.preco_unitario IS NOT NULL
      AND oc.status IN ('recebida', 'parcialmente_recebida')
    ORDER BY oc.created_at DESC
    LIMIT 1
  )                                            AS custo_medio_unitario,
  NOW()                                        AS atualizado_em
FROM alm_item_catalogo_tenant ict
JOIN alm_estoque_saldo s ON s.tenant_id = ict.tenant_id AND s.catalogo_id = ict.catalogo_id
GROUP BY ict.tenant_id, ict.id, ict.catalogo_id
ON CONFLICT (tenant_id, item_catalogo_tenant_id) DO NOTHING;

-- 2.3 Criar alocações para cada registro de alm_estoque_saldo com saldo > 0
-- Cada (tenant, obra, catalogo) vira uma alocação "histórica" com status ATIVA
INSERT INTO alm_alocacoes (
  tenant_id,
  estoque_global_id,
  obra_id,
  quantidade,
  quantidade_consumida,
  unidade,
  status,
  observacao,
  criado_em
)
SELECT
  s.tenant_id,
  eg.id                                        AS estoque_global_id,
  s.obra_id,
  s.quantidade,
  0                                            AS quantidade_consumida,
  s.unidade,
  'ATIVA'::alm_alocacao_status,
  'Migração automática — saldo pré-existente por obra',
  NOW()
FROM alm_estoque_saldo s
JOIN alm_item_catalogo_tenant ict ON ict.tenant_id = s.tenant_id AND ict.catalogo_id = s.catalogo_id
JOIN alm_estoque_global eg ON eg.tenant_id = ict.tenant_id AND eg.item_catalogo_tenant_id = ict.id
WHERE s.quantidade > 0;

-- 2.4 Atualizar foreign key saldo_global_id em alm_estoque_saldo
UPDATE alm_estoque_saldo s
SET saldo_global_id = eg.id
FROM alm_item_catalogo_tenant ict
JOIN alm_estoque_global eg ON eg.tenant_id = ict.tenant_id AND eg.item_catalogo_tenant_id = ict.id
WHERE s.tenant_id = ict.tenant_id
  AND s.catalogo_id = ict.catalogo_id
  AND s.saldo_global_id IS NULL;

-- 2.5 Popular alm_cpv a partir do histórico de saídas
-- Usa preco_unitario da OC mais próxima no tempo; se não existir, usa custo_medio_unitario atual
INSERT INTO alm_cpv (
  tenant_id,
  obra_id,
  catalogo_id,
  tipo_consumo,
  quantidade,
  unidade,
  custo_unitario,
  custo_total,
  periodo_ano,
  periodo_mes,
  movimento_obra_id,
  observacao,
  criado_por,
  criado_em
)
SELECT
  mv.tenant_id,
  mv.obra_id,
  mv.catalogo_id,
  CASE mv.tipo
    WHEN 'saida'    THEN 'SAIDA_DIRETA'::alm_cpv_tipo_consumo
    WHEN 'perda'    THEN 'PERDA'::alm_cpv_tipo_consumo
    ELSE                 'SAIDA_DIRETA'::alm_cpv_tipo_consumo
  END                                              AS tipo_consumo,
  mv.quantidade,
  mv.unidade,
  COALESCE(
    (
      SELECT oi.preco_unitario
      FROM alm_oc_itens oi
      JOIN alm_ordens_compra oc ON oc.id = oi.oc_id
      WHERE oc.tenant_id = mv.tenant_id
        AND oi.catalogo_id = mv.catalogo_id
        AND oi.preco_unitario IS NOT NULL
        AND oc.created_at <= mv.created_at
      ORDER BY oc.created_at DESC
      LIMIT 1
    ),
    eg.custo_medio_unitario,
    0
  )                                                AS custo_unitario,
  mv.quantidade * COALESCE(
    (
      SELECT oi.preco_unitario
      FROM alm_oc_itens oi
      JOIN alm_ordens_compra oc ON oc.id = oi.oc_id
      WHERE oc.tenant_id = mv.tenant_id
        AND oi.catalogo_id = mv.catalogo_id
        AND oi.preco_unitario IS NOT NULL
        AND oc.created_at <= mv.created_at
      ORDER BY oc.created_at DESC
      LIMIT 1
    ),
    eg.custo_medio_unitario,
    0
  )                                                AS custo_total,
  EXTRACT(YEAR  FROM mv.created_at)::INT           AS periodo_ano,
  EXTRACT(MONTH FROM mv.created_at)::INT           AS periodo_mes,
  mv.id                                            AS movimento_obra_id,
  'Migração automática de histórico',
  mv.criado_por,
  mv.created_at
FROM alm_movimentos mv
JOIN alm_item_catalogo_tenant ict ON ict.tenant_id = mv.tenant_id AND ict.catalogo_id = mv.catalogo_id
JOIN alm_estoque_global eg ON eg.tenant_id = ict.tenant_id AND eg.item_catalogo_tenant_id = ict.id
WHERE mv.tipo IN ('saida', 'perda');

COMMIT;
```

---

### Fase 3 — Dual-write no backend

Atualizar `EstoqueService.registrarMovimento()` para escrever nas tabelas novas simultaneamente às legadas:

- `tipo: 'entrada'` → escreve em `alm_movimentos_global` + atualiza `alm_estoque_global`.
- `tipo: 'saida' | 'perda'` → escreve em `alm_cpv`.
- `tipo: 'transferencia'` → cria `AlmTransferencia` com status `RECEBIDA` (retrocompatível).

Duração recomendada da Fase 3: mínimo 2 semanas de estabilização.

---

### Fase 4 — Cutover de leituras

- `GET /almoxarifado/obras/:obraId/estoque` passa a ler de `alm_alocacoes` ao invés de `alm_estoque_saldo`.
- `GET /almoxarifado/estoque` passa a ler de `alm_estoque_global`.
- Alertas passam a ser disparados pelo `alm_estoque_global.quantidade_disponivel`.
- Headers `Deprecation` adicionados nas rotas legadas.

---

### Fase 5 — Cleanup (90 dias após cutover)

1. Remover rotas deprecadas (retornam `410 Gone`).
2. Remover colunas legadas das novas tabelas (ex: `saldo_global_id` pode virar `NOT NULL`).
3. Opcionalmente arquivar `alm_estoque_saldo` e `alm_movimentos` para tabela histórica read-only.
4. Remover código de dual-write.

---

## 5. Mudanças de Frontend

### 5.1 Nova tela: Almoxarifado Central (`/almoxarifado/central`)

**Rota:** `/almoxarifado/central`
**Acesso:** `ADMIN_TENANT`, `ENGENHEIRO`

**Componentes:**

1. **KPI bar (topo):**
   - Total de itens no pool
   - Valor total do estoque (CMU × quantidade_total)
   - Itens em nível crítico (quantidade_disponivel <= ponto_reposicao × 0.3)
   - Transferências pendentes de aprovação

2. **Tabela "Estoque Global":** lista de `AlmEstoqueGlobal` com colunas:
   - Item (nome + código)
   - Quantidade Disponível / Alocada / Total
   - CMU (custo médio unitário)
   - Valor Total
   - Nível (badge `critico` / `atencao` / `normal`)
   - Ações: [Entrada] [Alocar]

3. **Painel lateral "Distribuição por Obra":** ao clicar em um item da tabela, abre panel com `alocacoesPorObra`.

4. **Modal "Nova Entrada":** formulário `POST /almoxarifado/estoque/entrada`.

5. **Modal "Nova Alocação":** formulário `POST /almoxarifado/alocacoes`.

---

### 5.2 Tela existente por obra — Almoxarifado da Obra (`/obras/:id/almoxarifado`)

**Mudanças:**

- Saldo exibido passa a ser saldo alocado (de `alm_alocacoes`), não saldo proprietário.
- Coluna "Alocação" adicionada à tabela de estoque mostrando `alocacaoId` e status.
- Botão "Registrar Consumo" (novo) abre modal de `PATCH /almoxarifado/alocacoes/:id/consumir`.
- Botão "Solicitar Transferência" (novo) abre modal de `POST /almoxarifado/transferencias`.
- Tab "Entradas" agora exibe o histórico de `alm_movimentos_global` filtrado pelas entradas que geraram alocações para esta obra.
- Banner informativo: "O estoque desta obra faz parte do pool centralizado do tenant."

---

### 5.3 Nova tela: Transferências (`/almoxarifado/transferencias`)

**Rota:** `/almoxarifado/transferencias`
**Acesso:** `ADMIN_TENANT`, `ENGENHEIRO`, `TECNICO` (leitura)

**Componentes:**

1. **Lista de transferências** com tabs: Todas / Pendentes / Aprovadas / Em trânsito / Concluídas.
2. **Card de transferência:** exibe item, origem→destino, quantidade, status com timeline visual dos passos (Solicitada → Aprovada → Despachada → Recebida).
3. **Ações por status:**
   - `PENDENTE`: [Aprovar] (apenas ADMIN_TENANT) / [Cancelar]
   - `APROVADA`: [Confirmar Despacho] (ADMIN_TENANT ou ENGENHEIRO)
   - `DESPACHADA`: [Confirmar Recebimento] (qualquer papel com acesso à obra destino)
4. **Filtros:** por obra, por status, por período.

---

### 5.4 Nova tela: CPV Dashboard (`/almoxarifado/cpv`)

**Rota:** `/almoxarifado/cpv`
**Acesso:** `ADMIN_TENANT`, `ENGENHEIRO`

**Componentes:**

1. **Filtros:** Ano / Mês início-fim / Obra / Agrupamento (por obra / por material / por mês).
2. **Gráfico de barras empilhadas:** CPV por obra ao longo dos meses do período selecionado.
3. **Tabela detalhada:** conforme agrupamento selecionado (dados de `GET /almoxarifado/cpv`).
4. **KPI cards:**
   - CPV total do período
   - Obra com maior CPV
   - Material com maior CPV
   - Variação % em relação ao período anterior (meses equivalentes do ano anterior)
5. **Exportar CSV** (botão) — gera download dos dados da tabela atual.

---

## 6. Regras de negócio adicionais

### 6.1 Cálculo do Custo Médio Unitário (CMU)

O CMU é calculado pelo método **Custo Médio Ponderado Móvel** a cada entrada no pool:

```
novo_cmu = (quantidade_total_atual × cmu_atual + quantidade_entrada × custo_entrada) 
           / (quantidade_total_atual + quantidade_entrada)
```

Se não há CMU definido (primeiro recebimento), o CMU = `custoUnitario` da entrada.

### 6.2 Invariante de saldo global

O backend garante via `SELECT FOR UPDATE` no row de `alm_estoque_global` que `quantidade_disponivel >= 0` antes de qualquer alocação. Alocações concorrentes que excederiam o saldo disponível recebem `400 Bad Request`.

### 6.3 Devoluções de alocação ao pool

Quando `quantidadeDevolvida > 0` é registrada em uma alocação:
1. `alm_alocacoes.quantidade_devolvida` é incrementado.
2. `alm_estoque_global.quantidade_disponivel` é incrementado com a quantidade devolvida.
3. `alm_estoque_global.quantidade_alocada` é decrementado.
4. Nenhum registro de CPV é gerado (devolução não é custo).
5. Se `quantidadeConsumida + quantidadeDevolvida == quantidade`, status da alocação muda para `CONSUMIDA` ou `CANCELADA` conforme o caso.

### 6.4 Validação de unidade

Por ora, o sistema valida que a unidade informada em `POST /almoxarifado/alocacoes` e `POST /almoxarifado/estoque/entrada` é idêntica à `unidadePadrao` do `alm_item_catalogo_tenant`. Conversão de unidades (ex: kg ↔ sc) é fora do escopo desta spec e tratada em release futura.

### 6.5 Permissão de aprovação de transferência

Somente `ADMIN_TENANT` pode aprovar transferências (`PATCH /almoxarifado/transferencias/:id/aprovar`). O `ENGENHEIRO` pode solicitar e despachar, mas não aprovar. Esta regra pode ser relaxada via configuração do `WorkflowTemplate` do tenant em release futura.
