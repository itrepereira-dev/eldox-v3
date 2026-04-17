# Spec: Efetivo como Recurso do Tenant

**Data:** 2026-04-17
**Status:** Aprovado para implementação
**ADR:** ADR-002-efetivo-tenant.md
**Módulo backend:** `backend/src/efetivo/`
**Módulo frontend:** `frontend-web/src/modules/efetivo/`

---

## 1. Novo Modelo de Entidades (Prisma Schema Delta)

### 1.1 Enums novos

```prisma
enum StatusPessoa {
  ATIVO
  INATIVO
  AFASTADO
}

enum StatusAlocacao {
  ATIVO
  ENCERRADO
  SUSPENSO
}

enum TipoEquipe {
  ESTRUTURA
  ACABAMENTO
  INSTALACOES
  FUNDACAO
  DEMOLICAO
  GERAL
}
```

### 1.2 Model: `Pessoa`

Trabalhador individual cadastrado no nível do tenant. Independente de obras.

```prisma
model Pessoa {
  id           Int          @id @default(autoincrement())
  tenantId     Int

  // Identificação
  nome         String       @db.VarChar(200)
  cpf          String?      @db.VarChar(14)   // formato "000.000.000-00", unique por tenant
  rg           String?      @db.VarChar(20)
  dataNascimento DateTime?  @db.Date

  // Contato
  telefone     String?      @db.VarChar(20)
  email        String?      @db.VarChar(254)

  // Profissional
  funcaoId     Int?                            // FK para funcoes_efetivo (cargo base)
  empresaId    Int?                            // FK para empresas_efetivo (empresa de origem)
  matricula    String?      @db.VarChar(50)   // matrícula interna do tenant
  cnh          String?      @db.VarChar(11)   // categoria CNH se aplicável
  registro     String?      @db.VarChar(50)   // CREA, CRT, etc.

  // Status
  status       StatusPessoa @default(ATIVO)

  // Auditoria
  criadoPor    Int
  criadoEm    DateTime     @default(now())    @map("criado_em")
  atualizadoEm DateTime    @updatedAt         @map("atualizado_em")
  deletadoEm  DateTime?                       @map("deletado_em")

  // Relações
  alocacoes    ObraAlocacao[]
  equipes      PessoaEquipe[]

  @@unique([tenantId, cpf])
  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, empresaId])
  @@map("pessoas")
}
```

**Campos obrigatórios na criação:** `tenantId`, `nome`
**Campos opcionais mas recomendados:** `cpf`, `telefone`, `funcaoId`, `empresaId`
**Soft-delete:** via `deletadoEm` (queries devem filtrar `deletadoEm IS NULL`)

---

### 1.3 Model: `Equipe`

Equipe nominal reutilizável, cadastrada no nível do tenant.

```prisma
model Equipe {
  id           Int        @id @default(autoincrement())
  tenantId     Int

  nome         String     @db.VarChar(200)
  tipo         TipoEquipe @default(GERAL)
  descricao    String?    @db.Text
  ativa        Boolean    @default(true)

  // Auditoria
  criadoPor    Int
  criadoEm    DateTime   @default(now())    @map("criado_em")
  atualizadoEm DateTime  @updatedAt         @map("atualizado_em")

  // Relações
  membros      PessoaEquipe[]

  @@unique([tenantId, nome])
  @@index([tenantId])
  @@map("equipes")
}
```

**Campos obrigatórios:** `tenantId`, `nome`

---

### 1.4 Model: `PessoaEquipe`

Join table entre `Pessoa` e `Equipe`. Uma pessoa pode pertencer a múltiplas equipes. O campo `funcaoNaEquipe` permite que a mesma pessoa exerça papéis diferentes em equipes diferentes.

```prisma
model PessoaEquipe {
  id             Int      @id @default(autoincrement())
  tenantId       Int

  pessoaId       Int
  pessoa         Pessoa   @relation(fields: [pessoaId], references: [id], onDelete: Cascade)

  equipeId       Int
  equipe         Equipe   @relation(fields: [equipeId], references: [id], onDelete: Cascade)

  funcaoNaEquipe String?  @db.VarChar(100)  // ex: "Encarregado", "Oficial", "Ajudante"
  lider          Boolean  @default(false)   // true = líder desta equipe

  adicionadoEm   DateTime @default(now())   @map("adicionado_em")
  adicionadoPor  Int

  @@unique([pessoaId, equipeId])
  @@index([tenantId, equipeId])
  @@index([tenantId, pessoaId])
  @@map("pessoas_equipes")
}
```

---

### 1.5 Model: `ObraAlocacao`

Vínculo entre uma `Pessoa` e uma `Obra` com período e função definidos. É a tabela central do novo modelo de efetivo.

```prisma
model ObraAlocacao {
  id             Int            @id @default(autoincrement())
  tenantId       Int

  pessoaId       Int
  pessoa         Pessoa         @relation(fields: [pessoaId], references: [id])

  obraId         Int
  // Não adicionar FK Prisma para Obra aqui para evitar ciclos no schema existente;
  // integridade garantida pela constraint de banco abaixo

  // Período
  dataInicio     DateTime       @db.Date
  dataFim        DateTime?      @db.Date    // null = sem previsão de encerramento

  // Função e status
  funcaoNaObra   String         @db.VarChar(100)  // ex: "Encarregado de Alvenaria"
  status         StatusAlocacao @default(ATIVO)

  // Observações
  observacao     String?        @db.Text

  // Auditoria
  criadoPor      Int
  criadoEm      DateTime       @default(now())  @map("criado_em")
  atualizadoEm  DateTime       @updatedAt       @map("atualizado_em")
  encerradoPor  Int?
  encerradoEm   DateTime?      @map("encerrado_em")

  @@unique([tenantId, pessoaId, obraId, dataInicio])   // evita alocação duplicada na mesma data
  @@index([tenantId, obraId])
  @@index([tenantId, pessoaId])
  @@index([tenantId, status])
  @@map("obra_alocacoes")
}
```

**Regra de negócio:** uma pessoa não pode ter duas alocações `ATIVO` para a mesma obra simultaneamente. Validar no service antes do INSERT.

---

### 1.6 `Ponto` — Decisão sobre registro diário de presença

O modelo atual (`registros_efetivo` + `itens_efetivo`) representa presença agregada (empresa + função + quantidade). Ele **não é removido** nesta versão.

**Decisão:** O `RegistroEfetivo` existente permanece como "efetivo agregado" para o RDO. O controle nominal de presença diária (ponto) por pessoa é um módulo futuro (`Ponto`) que depende das `ObraAlocacao` desta spec. Esta spec não introduz tabela `Ponto` — apenas provê a fundação (`ObraAlocacao`) necessária para ela.

**Referência cruzada futura:** Uma tabela `Ponto` deverá referenciar `alocacaoId` (FK para `obra_alocacoes.id`) e `data` como chave composta.

---

## 2. API Endpoints — Novos e Modificados

### Autenticação e Autorização

Todos os endpoints usam `JwtAuthGuard` + `RolesGuard`. O `tenantId` é extraído do JWT via `@TenantId()`. Nunca aceitar `tenantId` no body.

**Hierarquia de roles:**
- `ADMIN_TENANT` — acesso total (leitura + escrita + exclusão)
- `ENGENHEIRO` — leitura + escrita (criar, editar, alocar); sem exclusão permanente
- `TECNICO` — leitura + alocar; sem criar/editar pessoas ou equipes
- `VISITANTE` — somente leitura

---

### 2.1 Pessoas (tenant-level)

#### `GET /api/v1/efetivo/pessoas`

Lista todas as pessoas do tenant.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Query params:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | `StatusPessoa` (`ATIVO`\|`INATIVO`\|`AFASTADO`) | Não | Filtra por status. Default: retorna todos. |
| `funcaoId` | `number` (inteiro) | Não | Filtra por função base |
| `empresaId` | `number` (inteiro) | Não | Filtra por empresa |
| `search` | `string` (max 100 chars) | Não | Busca ILIKE em `nome`, `cpf`, `matricula` |
| `page` | `number` (inteiro, min 1) | Não | Default: 1 |
| `limit` | `number` (inteiro, 1–100) | Não | Default: 30 |

**Response 200:**
```json
{
  "data": [
    {
      "id": 42,
      "nome": "João da Silva",
      "cpf": "123.456.789-00",
      "telefone": "(11) 99999-0001",
      "email": "joao@exemplo.com",
      "funcaoId": 3,
      "funcaoNome": "Pedreiro",
      "empresaId": 7,
      "empresaNome": "Construtora Alfa",
      "matricula": "MAT-001",
      "status": "ATIVO",
      "totalAlocacoesAtivas": 1,
      "criadoEm": "2026-04-17T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "total_pages": 4
  }
}
```

**Erros:**
- `400 Bad Request` — parâmetros de query inválidos (ex: `limit > 100`)
- `401 Unauthorized` — token ausente ou inválido
- `403 Forbidden` — role insuficiente

---

#### `POST /api/v1/efetivo/pessoas`

Cria uma nova pessoa no tenant.

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Request Body:**
```json
{
  "nome": "string, obrigatório, max 200 chars",
  "cpf": "string, opcional, formato '000.000.000-00'",
  "rg": "string, opcional, max 20 chars",
  "dataNascimento": "string ISO 8601 date, opcional, ex: '1985-03-20'",
  "telefone": "string, opcional, max 20 chars",
  "email": "string, opcional, formato email, max 254 chars",
  "funcaoId": "number, inteiro, opcional — deve existir em funcoes_efetivo do tenant",
  "empresaId": "number, inteiro, opcional — deve existir em empresas_efetivo do tenant",
  "matricula": "string, opcional, max 50 chars",
  "cnh": "string, opcional, max 11 chars",
  "registro": "string, opcional, max 50 chars (CREA, CRT, etc.)"
}
```

**Response 201:**
```json
{
  "id": 43,
  "tenantId": 1,
  "nome": "Maria Souza",
  "cpf": "987.654.321-00",
  "status": "ATIVO",
  "criadoEm": "2026-04-17T10:05:00.000Z"
}
```

**Erros:**
- `400 Bad Request` — body inválido (campos faltando ou com tipos errados)
- `409 Conflict` — CPF já cadastrado para o mesmo tenant (`unique([tenantId, cpf])`)
- `422 Unprocessable Entity` — `funcaoId` não existe no tenant; `empresaId` não existe no tenant; `dataNascimento` futura

---

#### `GET /api/v1/efetivo/pessoas/:id`

Retorna detalhes de uma pessoa, incluindo alocações ativas e equipes.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Path params:**
- `id` — inteiro, obrigatório

**Response 200:**
```json
{
  "id": 42,
  "nome": "João da Silva",
  "cpf": "123.456.789-00",
  "rg": "12.345.678-9",
  "dataNascimento": "1985-03-20",
  "telefone": "(11) 99999-0001",
  "email": "joao@exemplo.com",
  "funcaoId": 3,
  "funcaoNome": "Pedreiro",
  "empresaId": 7,
  "empresaNome": "Construtora Alfa",
  "matricula": "MAT-001",
  "cnh": null,
  "registro": null,
  "status": "ATIVO",
  "criadoEm": "2026-04-17T10:00:00.000Z",
  "alocacoesAtivas": [
    {
      "alocacaoId": 10,
      "obraId": 5,
      "obraNome": "Residencial Sol Nascente",
      "funcaoNaObra": "Encarregado de Alvenaria",
      "dataInicio": "2026-03-01",
      "dataFim": null,
      "status": "ATIVO"
    }
  ],
  "equipes": [
    {
      "equipeId": 2,
      "equipeNome": "Equipe Alvenaria A",
      "funcaoNaEquipe": "Encarregado",
      "lider": true
    }
  ]
}
```

**Erros:**
- `404 Not Found` — `id` não existe ou pertence a outro tenant

---

#### `PUT /api/v1/efetivo/pessoas/:id`

Atualiza uma pessoa existente. Todos os campos do body são opcionais (PATCH semântico via PUT).

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Path params:**
- `id` — inteiro, obrigatório

**Request Body:** (todos opcionais)
```json
{
  "nome": "string, max 200 chars",
  "cpf": "string, formato '000.000.000-00'",
  "rg": "string, max 20 chars",
  "dataNascimento": "string ISO 8601 date",
  "telefone": "string, max 20 chars",
  "email": "string, formato email, max 254 chars",
  "funcaoId": "number, inteiro",
  "empresaId": "number, inteiro",
  "matricula": "string, max 50 chars",
  "cnh": "string, max 11 chars",
  "registro": "string, max 50 chars",
  "status": "StatusPessoa: ATIVO | INATIVO | AFASTADO"
}
```

**Response 200:** objeto `Pessoa` completo atualizado (mesma estrutura do GET :id, sem `alocacoesAtivas` e `equipes`)

**Erros:**
- `404 Not Found` — pessoa não encontrada no tenant
- `409 Conflict` — CPF atualizado já existe em outra pessoa do tenant
- `422 Unprocessable Entity` — `funcaoId` não existe; `empresaId` não existe

---

#### `DELETE /api/v1/efetivo/pessoas/:id`

Soft-delete: seta `status = INATIVO` e `deletadoEm = NOW()`. Não remove da base de dados.

**Auth:** ADMIN_TENANT

**Path params:**
- `id` — inteiro, obrigatório

**Response 204:** No Content

**Erros:**
- `404 Not Found` — pessoa não encontrada no tenant
- `409 Conflict` — pessoa tem alocações `ATIVO` em andamento; encerrar as alocações antes de inativar

---

### 2.2 Equipes (tenant-level)

#### `GET /api/v1/efetivo/equipes`

Lista todas as equipes do tenant.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Query params:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `ativa` | `boolean` | Não | Filtra por status ativo/inativo. Default: retorna todas. |
| `tipo` | `TipoEquipe` | Não | Filtra por tipo de equipe |
| `search` | `string` (max 100 chars) | Não | Busca ILIKE em `nome` |

**Response 200:**
```json
{
  "data": [
    {
      "id": 2,
      "nome": "Equipe Alvenaria A",
      "tipo": "ESTRUTURA",
      "descricao": "Equipe principal de alvenaria",
      "ativa": true,
      "totalMembros": 8,
      "criadoEm": "2026-04-01T09:00:00.000Z"
    }
  ]
}
```

**Erros:**
- `400 Bad Request` — parâmetros inválidos
- `401 Unauthorized`

---

#### `POST /api/v1/efetivo/equipes`

Cria uma nova equipe no tenant.

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Request Body:**
```json
{
  "nome": "string, obrigatório, max 200 chars",
  "tipo": "TipoEquipe, opcional — ESTRUTURA|ACABAMENTO|INSTALACOES|FUNDACAO|DEMOLICAO|GERAL. Default: GERAL",
  "descricao": "string, opcional, max 2000 chars"
}
```

**Response 201:**
```json
{
  "id": 3,
  "tenantId": 1,
  "nome": "Equipe Hidráulica B",
  "tipo": "INSTALACOES",
  "descricao": null,
  "ativa": true,
  "criadoEm": "2026-04-17T10:10:00.000Z"
}
```

**Erros:**
- `400 Bad Request` — body inválido
- `409 Conflict` — nome de equipe já existe no tenant

---

#### `GET /api/v1/efetivo/equipes/:id`

Retorna detalhes de uma equipe com lista de membros.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Response 200:**
```json
{
  "id": 2,
  "nome": "Equipe Alvenaria A",
  "tipo": "ESTRUTURA",
  "descricao": "Equipe principal de alvenaria",
  "ativa": true,
  "criadoEm": "2026-04-01T09:00:00.000Z",
  "membros": [
    {
      "pessoaEquipeId": 5,
      "pessoaId": 42,
      "pessoaNome": "João da Silva",
      "pessoaCpf": "123.456.789-00",
      "funcaoNaEquipe": "Encarregado",
      "lider": true,
      "adicionadoEm": "2026-04-01T09:05:00.000Z"
    }
  ]
}
```

**Erros:**
- `404 Not Found` — equipe não encontrada no tenant

---

#### `PUT /api/v1/efetivo/equipes/:id`

Atualiza nome, tipo ou descrição de uma equipe.

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Request Body:** (todos opcionais)
```json
{
  "nome": "string, max 200 chars",
  "tipo": "TipoEquipe",
  "descricao": "string, max 2000 chars",
  "ativa": "boolean"
}
```

**Response 200:** objeto `Equipe` completo atualizado (sem `membros`)

**Erros:**
- `404 Not Found` — equipe não encontrada
- `409 Conflict` — novo nome já existe em outra equipe do tenant

---

#### `POST /api/v1/efetivo/equipes/:id/membros`

Adiciona uma pessoa à equipe.

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Path params:**
- `id` — `equipeId`, inteiro, obrigatório

**Request Body:**
```json
{
  "pessoaId": "number, inteiro, obrigatório",
  "funcaoNaEquipe": "string, opcional, max 100 chars",
  "lider": "boolean, opcional, default false"
}
```

**Response 201:**
```json
{
  "id": 12,
  "pessoaId": 55,
  "pessoaNome": "Carlos Ferreira",
  "equipeId": 2,
  "funcaoNaEquipe": "Oficial",
  "lider": false,
  "adicionadoEm": "2026-04-17T10:15:00.000Z"
}
```

**Erros:**
- `404 Not Found` — equipe não encontrada; pessoa não encontrada no tenant
- `409 Conflict` — pessoa já é membro desta equipe
- `422 Unprocessable Entity` — pessoa com status `INATIVO`

---

#### `DELETE /api/v1/efetivo/equipes/:id/membros/:pessoaEquipeId`

Remove uma pessoa de uma equipe (hard delete do vínculo `PessoaEquipe`).

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Path params:**
- `id` — `equipeId`, inteiro
- `pessoaEquipeId` — inteiro

**Response 204:** No Content

**Erros:**
- `404 Not Found` — vínculo não encontrado no tenant

---

### 2.3 Alocações por Obra

#### `GET /api/v1/obras/:obraId/efetivo/alocacoes`

Lista todas as alocações (nominais) de uma obra, com filtros.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Path params:**
- `obraId` — inteiro, obrigatório

**Query params:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | `StatusAlocacao` | Não | Default: `ATIVO` |
| `funcaoNaObra` | `string` (max 100) | Não | Filtra por função na obra (ILIKE) |
| `search` | `string` (max 100) | Não | Busca ILIKE em `pessoa.nome`, `pessoa.cpf` |
| `page` | `number` (min 1) | Não | Default: 1 |
| `limit` | `number` (1–100) | Não | Default: 30 |

**Response 200:**
```json
{
  "data": [
    {
      "alocacaoId": 10,
      "pessoaId": 42,
      "pessoaNome": "João da Silva",
      "pessoaCpf": "123.456.789-00",
      "pessoaTelefone": "(11) 99999-0001",
      "empresaNome": "Construtora Alfa",
      "funcaoBase": "Pedreiro",
      "funcaoNaObra": "Encarregado de Alvenaria",
      "dataInicio": "2026-03-01",
      "dataFim": null,
      "status": "ATIVO",
      "observacao": null
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "total_pages": 1
  },
  "resumo": {
    "totalAtivos": 22,
    "totalEncerrados": 3
  }
}
```

**Erros:**
- `404 Not Found` — obra não encontrada no tenant
- `400 Bad Request` — parâmetros inválidos

---

#### `POST /api/v1/obras/:obraId/efetivo/alocar`

Aloca uma pessoa a uma obra. Cria um registro `ObraAlocacao`.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO

**Path params:**
- `obraId` — inteiro, obrigatório

**Request Body:**
```json
{
  "pessoaId": "number, inteiro, obrigatório",
  "funcaoNaObra": "string, obrigatório, max 100 chars — ex: 'Encarregado de Alvenaria'",
  "dataInicio": "string ISO 8601 date, obrigatório — ex: '2026-04-17'",
  "dataFim": "string ISO 8601 date, opcional — null = sem previsão de encerramento",
  "observacao": "string, opcional, max 2000 chars"
}
```

**Response 201:**
```json
{
  "id": 11,
  "tenantId": 1,
  "pessoaId": 55,
  "pessoaNome": "Carlos Ferreira",
  "obraId": 5,
  "obraNome": "Residencial Sol Nascente",
  "funcaoNaObra": "Oficial de Alvenaria",
  "dataInicio": "2026-04-17",
  "dataFim": null,
  "status": "ATIVO",
  "criadoEm": "2026-04-17T10:20:00.000Z"
}
```

**Erros:**
- `404 Not Found` — obra não encontrada no tenant; pessoa não encontrada no tenant
- `409 Conflict` — pessoa já tem alocação `ATIVO` nesta obra
- `422 Unprocessable Entity` — `dataInicio` futura por mais de 30 dias (regra de negócio configurável); `dataFim` anterior a `dataInicio`; pessoa com status `INATIVO`; obra com `ativo = false`

---

#### `POST /api/v1/obras/:obraId/efetivo/alocar-equipe`

Aloca todos os membros ativos de uma equipe a uma obra em uma operação. Cria múltiplos `ObraAlocacao` em transação. Membros já alocados (`ATIVO`) na obra são ignorados (não geram erro, apenas `skipped` no response).

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Path params:**
- `obraId` — inteiro, obrigatório

**Request Body:**
```json
{
  "equipeId": "number, inteiro, obrigatório",
  "funcaoNaObra": "string, obrigatório, max 100 chars — função padrão para todos os membros",
  "dataInicio": "string ISO 8601 date, obrigatório",
  "dataFim": "string ISO 8601 date, opcional",
  "observacao": "string, opcional, max 2000 chars"
}
```

**Response 201:**
```json
{
  "equipeId": 2,
  "equipeNome": "Equipe Alvenaria A",
  "obraId": 5,
  "alocados": 6,
  "skipped": 2,
  "detalhes": [
    { "pessoaId": 42, "pessoaNome": "João da Silva", "resultado": "ALOCADO" },
    { "pessoaId": 43, "pessoaNome": "Ana Lima", "resultado": "JA_ALOCADO" }
  ]
}
```

**Erros:**
- `404 Not Found` — equipe não encontrada; obra não encontrada
- `422 Unprocessable Entity` — equipe sem membros ativos; data inválida

---

#### `GET /api/v1/obras/:obraId/efetivo/alocacoes/:alocacaoId`

Retorna detalhes de uma alocação específica.

**Auth:** ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE

**Response 200:**
```json
{
  "id": 10,
  "pessoaId": 42,
  "pessoaNome": "João da Silva",
  "pessoaCpf": "123.456.789-00",
  "obraId": 5,
  "funcaoNaObra": "Encarregado de Alvenaria",
  "dataInicio": "2026-03-01",
  "dataFim": null,
  "status": "ATIVO",
  "observacao": null,
  "criadoPor": 1,
  "criadoEm": "2026-03-01T08:00:00.000Z",
  "encerradoPor": null,
  "encerradoEm": null
}
```

**Erros:**
- `404 Not Found` — alocação não encontrada ou pertence a outra obra/tenant

---

#### `PUT /api/v1/obras/:obraId/efetivo/alocacoes/:alocacaoId/encerrar`

Encerra uma alocação: seta `status = ENCERRADO`, `encerradoEm = NOW()`, `encerradoPor = userId`.

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Path params:**
- `obraId` — inteiro, obrigatório
- `alocacaoId` — inteiro, obrigatório

**Request Body:**
```json
{
  "dataFim": "string ISO 8601 date, obrigatório — data efetiva de encerramento",
  "observacao": "string, opcional, max 2000 chars"
}
```

**Response 200:**
```json
{
  "id": 10,
  "pessoaId": 42,
  "obraId": 5,
  "status": "ENCERRADO",
  "dataFim": "2026-04-17",
  "encerradoEm": "2026-04-17T14:30:00.000Z"
}
```

**Erros:**
- `404 Not Found` — alocação não encontrada
- `409 Conflict` — alocação já está `ENCERRADO` ou `SUSPENSO`
- `422 Unprocessable Entity` — `dataFim` anterior a `dataInicio` da alocação

---

#### `PUT /api/v1/obras/:obraId/efetivo/alocacoes/:alocacaoId`

Atualiza dados de uma alocação ativa (função na obra, datas, observação).

**Auth:** ADMIN_TENANT, ENGENHEIRO

**Request Body:** (todos opcionais)
```json
{
  "funcaoNaObra": "string, max 100 chars",
  "dataInicio": "string ISO 8601 date",
  "dataFim": "string ISO 8601 date ou null",
  "observacao": "string, max 2000 chars"
}
```

**Response 200:** objeto `ObraAlocacao` completo atualizado

**Erros:**
- `404 Not Found` — alocação não encontrada
- `409 Conflict` — alocação já encerrada (status `ENCERRADO`)
- `422 Unprocessable Entity` — `dataFim` anterior a `dataInicio`

---

### 2.4 Endpoints existentes mantidos (sem breaking change)

Os endpoints abaixo continuam funcionando exatamente como hoje:

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/obras/:obraId/efetivo` | Cria registro de efetivo agregado (contagens homens·dia) |
| `GET` | `/api/v1/obras/:obraId/efetivo` | Lista registros de efetivo agregado |
| `GET` | `/api/v1/obras/:obraId/efetivo/:id` | Detalha registro de efetivo agregado |
| `PATCH` | `/api/v1/obras/:obraId/efetivo/:registroId/itens/:itemId` | Edita item de registro |
| `POST` | `/api/v1/obras/:obraId/efetivo/:id/fechar` | Fecha registro |
| `POST` | `/api/v1/obras/:obraId/efetivo/:id/reabrir` | Reabre registro |
| `GET` | `/api/v1/efetivo/cadastros/empresas` | Lista empresas |
| `POST` | `/api/v1/efetivo/cadastros/empresas` | Cria empresa |
| `GET` | `/api/v1/efetivo/cadastros/funcoes` | Lista funções |
| `POST` | `/api/v1/efetivo/cadastros/funcoes` | Cria função |

---

## 3. Plano de Migração

### Fase 1 — Additive (sem downtime, sem breaking change)

**Objetivo:** Criar as novas tabelas sem alterar nada existente.

**Step 1.1** — Gerar migration Prisma com os novos models (`Pessoa`, `Equipe`, `PessoaEquipe`, `ObraAlocacao`).

```bash
npx prisma migrate dev --name add-efetivo-tenant-level
```

**Step 1.2** — Adicionar constraint de integridade referencial para `ObraAlocacao.obraId`:

```sql
ALTER TABLE obra_alocacoes
  ADD CONSTRAINT fk_obra_alocacoes_obra
  FOREIGN KEY (obra_id, tenant_id)
  REFERENCES "Obra" (id, "tenantId")
  ON DELETE RESTRICT;
```

**Step 1.3** — Deploy do backend com os novos endpoints (`/efetivo/pessoas`, `/efetivo/equipes`, `/obras/:id/efetivo/alocacoes`). Endpoints existentes não mudam.

**Step 1.4** — Deploy do frontend com as novas telas (sem remover nenhuma tela existente).

---

### Fase 2 — Backfill de dados (opcional, por tenant)

Como os dados existentes em `registros_efetivo` são contagens numéricas (empresa + função + quantidade), **não há como extrair identidades nominais de trabalhadores automaticamente**. O backfill é semi-automático:

**Step 2.1** — Script de importação CSV disponibilizado para ADMIN_TENANT:

```
pessoas_import.csv:
nome, cpf, rg, data_nascimento, telefone, email, funcao_nome, empresa_nome, matricula
```

O script faz:
1. Upsert em `funcoes_efetivo` (por nome + tenantId)
2. Upsert em `empresas_efetivo` (por nome + tenantId)
3. INSERT em `pessoas` (por CPF + tenantId, se CPF presente; por nome + tenantId caso contrário)

**Step 2.2** — Script SQL de deduplicação para casos onde múltiplas importações criaram duplicatas por nome:

```sql
-- Identificar duplicatas por nome dentro do tenant
WITH duplicatas AS (
  SELECT
    tenant_id,
    LOWER(TRIM(nome)) AS nome_normalizado,
    COUNT(*) AS qtd,
    MIN(id) AS id_canonico,
    ARRAY_AGG(id ORDER BY id) AS todos_ids
  FROM pessoas
  WHERE cpf IS NULL   -- foca em casos sem CPF (CPF já garante unicidade)
  GROUP BY tenant_id, LOWER(TRIM(nome))
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicatas ORDER BY tenant_id, nome_normalizado;

-- Para cada grupo de duplicatas, migrar alocacoes para o id_canonico e remover os duplicados:
-- (executar por tenant_id, nome_normalizado após revisão manual)
UPDATE obra_alocacoes
SET pessoa_id = <id_canonico>
WHERE pessoa_id IN (<todos_ids_exceto_canonico>)
  AND tenant_id = <tenant_id>;

DELETE FROM pessoas
WHERE id IN (<todos_ids_exceto_canonico>)
  AND tenant_id = <tenant_id>;
```

**Step 2.3** — Script de criação retroativa de `ObraAlocacao` a partir de `registros_efetivo` (apenas se o tenant já tiver importado as pessoas):

```sql
-- Para cada combinação (tenant_id, obra_id) em registros_efetivo,
-- criar uma ObraAlocacao genérica "Efetivo Histórico" se ainda não existir:
-- (Este script é OPCIONAL e só faz sentido para tenants que queiram histórico retroativo)

INSERT INTO obra_alocacoes (
  tenant_id, pessoa_id, obra_id,
  funcao_na_obra, data_inicio, status,
  criado_por, criado_em
)
SELECT DISTINCT
  re.tenant_id,
  p.id AS pessoa_id,
  re.obra_id,
  'Efetivo Histórico' AS funcao_na_obra,
  MIN(re.data) OVER (PARTITION BY re.tenant_id, re.obra_id) AS data_inicio,
  'ENCERRADO' AS status,
  1 AS criado_por,  -- usuário sistema
  NOW() AS criado_em
FROM registros_efetivo re
JOIN pessoas p ON p.tenant_id = re.tenant_id
  -- Esse join só funciona se houver correspondência nominal,
  -- caso contrário a obra fica sem alocação retroativa (aceitável)
WHERE NOT EXISTS (
  SELECT 1 FROM obra_alocacoes oa
  WHERE oa.tenant_id = re.tenant_id
    AND oa.obra_id = re.obra_id
    AND oa.pessoa_id = p.id
);
```

---

### Fase 3 — Deprecation (v4, após 6 meses)

Após validação da adoção das novas telas:

1. Avaliar se `registros_efetivo` ainda é necessário ou se pode ser substituído por contagem derivada das `ObraAlocacao` + ponto nominal.
2. Se mantido: renomear semanticamente para "efetivo_agregado" e documentar como dado legacy.
3. Se removido: criar migration de remoção, anunciada com 60 dias de antecedência para os tenants.

---

## 4. Mudancas no Frontend

### 4.1 Nova tela: Cadastro de Pessoas (tenant-level)

**Rota:** `/efetivo/pessoas`
**Posição na sidebar:** Módulo "Efetivo" > subitem "Pessoas" (nível tenant, não dentro de obra)
**Componente principal:** `PessoasListPage`

**Conteúdo:**
- Tabela paginada com colunas: Nome, CPF, Empresa, Função, Status, Alocações Ativas, Ações
- Filtros: status (dropdown), empresa (dropdown), função (dropdown), busca por nome/CPF
- Botão "Nova Pessoa" abre `PessoaModal` (create)
- Cada linha: botão "Editar" abre `PessoaModal` (edit), botão "Inativar" chama `DELETE /efetivo/pessoas/:id`
- Click na linha navega para `/efetivo/pessoas/:id` (detalhe)

**Componente detalhe:** `PessoaDetailPage` (rota `/efetivo/pessoas/:id`)
- Dados cadastrais completos
- Card "Alocações Ativas" com lista de obras atuais
- Card "Equipes" com equipes de pertencimento
- Histórico de alocações encerradas

---

### 4.2 Nova tela: Equipes (tenant-level)

**Rota:** `/efetivo/equipes`
**Posição na sidebar:** Módulo "Efetivo" > subitem "Equipes"
**Componente principal:** `EquipesListPage`

**Conteúdo:**
- Grid de cards de equipes (nome, tipo, total membros, status ativo/inativo)
- Filtros: tipo (dropdown), status (toggle ativa/inativa)
- Botão "Nova Equipe" abre `EquipeModal` (create)
- Click num card navega para `/efetivo/equipes/:id` (detalhe)

**Componente detalhe:** `EquipeDetailPage` (rota `/efetivo/equipes/:id`)
- Nome, tipo, descrição, status
- Tabela de membros: Nome, CPF, Função na Equipe, Líder (badge), Adicionado em, Ações (Remover)
- Botão "Adicionar Membro" abre `AdicionarMembroModal` (busca pessoa por nome/CPF + define função na equipe)

---

### 4.3 Tela existente modificada: Efetivo por Obra

**Rota atual:** `/obras/:id/efetivo`
**Comportamento atual:** Lista `registros_efetivo` (contagens homens·dia)

**Alteração:** Adicionar aba "Alocações Nominais" à tela existente, mantendo a aba original "Registros Agregados".

**Nova aba "Alocações Nominais":**
- Tabela com colunas: Nome, CPF, Empresa, Função na Obra, Início, Previsão Fim, Status, Ações
- Filtros: status (ATIVO/ENCERRADO), função na obra (busca livre)
- Botão "Alocar Pessoa" abre `AlocarPessoaModal`
- Botão "Alocar Equipe" abre `AlocarEquipeModal`
- Cada linha com status `ATIVO`: botão "Encerrar" abre modal de encerramento

**Componente `AlocarPessoaModal`:**
- Campo de busca de pessoa (typeahead: busca por nome ou CPF em `GET /efetivo/pessoas?search=`)
- Campo "Função na Obra" (texto livre, sugestões baseadas em `funcoes_efetivo`)
- Campo "Data de Início" (date picker, default hoje)
- Campo "Previsão de Fim" (date picker, opcional)
- Campo "Observação" (textarea, opcional)

**Componente `AlocarEquipeModal`:**
- Dropdown de equipes ativas do tenant (`GET /efetivo/equipes?ativa=true`)
- Campo "Função padrão na Obra" (aplicada a todos os membros)
- Campo "Data de Início"
- Campo "Previsão de Fim" (opcional)
- Preview: lista de membros que serão alocados (com indicação de quem já está alocado → will be skipped)

---

### 4.4 Nova tela: Detalhe de Alocação

**Rota:** `/obras/:obraId/efetivo/alocacoes/:alocacaoId`
**Componente:** `AlocacaoDetailPage`

**Conteúdo:**
- Card de pessoa: foto (futura), nome, CPF, telefone, empresa, função base
- Dados da alocação: função na obra, data início, previsão fim, status
- Histórico de alterações (se auditoria for implementada)
- Botão "Encerrar Alocação" (para ADMIN_TENANT / ENGENHEIRO)
- Botão "Editar" (para alterar função na obra ou datas)

---

### 4.5 Hooks React novos necessários

| Hook | Endpoints consumidos | Arquivo sugerido |
|---|---|---|
| `usePessoas(filters)` | `GET /efetivo/pessoas` | `hooks/usePessoas.ts` |
| `usePessoa(id)` | `GET /efetivo/pessoas/:id` | `hooks/usePessoa.ts` |
| `useCreatePessoa()` | `POST /efetivo/pessoas` | `hooks/usePessoas.ts` |
| `useUpdatePessoa()` | `PUT /efetivo/pessoas/:id` | `hooks/usePessoas.ts` |
| `useDeletePessoa()` | `DELETE /efetivo/pessoas/:id` | `hooks/usePessoas.ts` |
| `useEquipes(filters)` | `GET /efetivo/equipes` | `hooks/useEquipes.ts` |
| `useEquipe(id)` | `GET /efetivo/equipes/:id` | `hooks/useEquipes.ts` |
| `useCreateEquipe()` | `POST /efetivo/equipes` | `hooks/useEquipes.ts` |
| `useAddMembroEquipe()` | `POST /efetivo/equipes/:id/membros` | `hooks/useEquipes.ts` |
| `useAlocacoes(obraId, filters)` | `GET /obras/:obraId/efetivo/alocacoes` | `hooks/useAlocacoes.ts` |
| `useAlocarPessoa(obraId)` | `POST /obras/:obraId/efetivo/alocar` | `hooks/useAlocacoes.ts` |
| `useAlocarEquipe(obraId)` | `POST /obras/:obraId/efetivo/alocar-equipe` | `hooks/useAlocacoes.ts` |
| `useEncerrarAlocacao(obraId)` | `PUT /obras/:obraId/efetivo/alocacoes/:id/encerrar` | `hooks/useAlocacoes.ts` |

---

## 5. Regras de Negocio Criticas

### 5.1 Alocação duplicada
Uma pessoa não pode ter duas alocações com `status = ATIVO` na mesma obra. O service deve verificar antes do INSERT:

```sql
SELECT id FROM obra_alocacoes
WHERE tenant_id = $1 AND pessoa_id = $2 AND obra_id = $3 AND status = 'ATIVO'
LIMIT 1;
```

Se encontrado: retornar `409 Conflict` com mensagem: `"Pessoa já possui alocação ativa nesta obra."`.

### 5.2 Inativar pessoa com alocações ativas
Antes de setar `deletadoEm` em `Pessoa`, verificar:

```sql
SELECT COUNT(*) FROM obra_alocacoes
WHERE tenant_id = $1 AND pessoa_id = $2 AND status = 'ATIVO';
```

Se `> 0`: retornar `409 Conflict` com mensagem: `"Pessoa possui X alocações ativas. Encerre as alocações antes de inativar."`.

### 5.3 Multi-tenancy
Toda query deve incluir `tenant_id = $tenantId`. Nunca expor dados de outro tenant. Validar em todos os lookups de FK:
- `pessoaId` deve pertencer ao `tenantId`
- `equipeId` deve pertencer ao `tenantId`
- `obraId` deve pertencer ao `tenantId`
- `funcaoId` (de `funcoes_efetivo`) deve pertencer ao `tenantId`
- `empresaId` (de `empresas_efetivo`) deve pertencer ao `tenantId`

### 5.4 Soft-delete e queries
Queries de listagem sempre filtrar `deletado_em IS NULL` em `pessoas`. Registros com `deletadoEm` preenchido não aparecem em listagens, mas alocações históricas associadas a eles devem ser preservadas (não cascade-delete).

### 5.5 Equipe sem membros
Não é erro criar uma equipe vazia. Mas `POST /obras/:obraId/efetivo/alocar-equipe` deve retornar `422` se `totalMembros = 0`.

---

## 6. Indices de Performance

Além dos índices definidos nos models Prisma, adicionar via migration:

```sql
-- Busca de pessoas por nome (busca textual frequente)
CREATE INDEX idx_pessoas_tenant_nome ON pessoas (tenant_id, nome text_pattern_ops);

-- Alocações ativas por obra (query mais frequente da nova feature)
CREATE INDEX idx_obra_alocacoes_obra_status ON obra_alocacoes (tenant_id, obra_id, status)
  WHERE status = 'ATIVO';

-- Alocações ativas por pessoa (para verificar conflito de alocação)
CREATE INDEX idx_obra_alocacoes_pessoa_status ON obra_alocacoes (tenant_id, pessoa_id, status)
  WHERE status = 'ATIVO';
```

---

## 7. Checklist de Implementacao

### Backend
- [ ] Adicionar enums `StatusPessoa`, `StatusAlocacao`, `TipoEquipe` ao `schema.prisma`
- [ ] Adicionar models `Pessoa`, `Equipe`, `PessoaEquipe`, `ObraAlocacao` ao `schema.prisma`
- [ ] Gerar e revisar migration Prisma
- [ ] Adicionar FK constraint `obra_alocacoes → Obra` via migration SQL raw
- [ ] Criar `backend/src/efetivo/pessoas/pessoas.service.ts`
- [ ] Criar `backend/src/efetivo/pessoas/pessoas.controller.ts`
- [ ] Criar `backend/src/efetivo/equipes/equipes.service.ts`
- [ ] Criar `backend/src/efetivo/equipes/equipes.controller.ts`
- [ ] Criar `backend/src/efetivo/alocacoes/alocacoes.service.ts`
- [ ] Criar `backend/src/efetivo/alocacoes/alocacoes.controller.ts`
- [ ] Criar DTOs para todos os endpoints novos
- [ ] Registrar novos controllers/services no `EfetivoModule`
- [ ] Adicionar índices de performance via migration

### Frontend
- [ ] Criar `src/modules/efetivo/pages/PessoasListPage.tsx`
- [ ] Criar `src/modules/efetivo/pages/PessoaDetailPage.tsx`
- [ ] Criar `src/modules/efetivo/pages/EquipesListPage.tsx`
- [ ] Criar `src/modules/efetivo/pages/EquipeDetailPage.tsx`
- [ ] Criar `src/modules/efetivo/components/PessoaModal.tsx`
- [ ] Criar `src/modules/efetivo/components/EquipeModal.tsx`
- [ ] Criar `src/modules/efetivo/components/AlocarPessoaModal.tsx`
- [ ] Criar `src/modules/efetivo/components/AlocarEquipeModal.tsx`
- [ ] Criar `src/modules/efetivo/hooks/usePessoas.ts`
- [ ] Criar `src/modules/efetivo/hooks/useEquipes.ts`
- [ ] Criar `src/modules/efetivo/hooks/useAlocacoes.ts`
- [ ] Adicionar rotas no router principal
- [ ] Adicionar itens na sidebar: "Pessoas" e "Equipes" sob módulo Efetivo
- [ ] Modificar `EfetivoListPage.tsx` para adicionar aba "Alocações Nominais"
- [ ] Criar `src/services/pessoas.service.ts` (API client)
- [ ] Criar `src/services/equipes.service.ts` (API client)
- [ ] Criar `src/services/alocacoes.service.ts` (API client)
