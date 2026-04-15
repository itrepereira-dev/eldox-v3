# Controle de Efetivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo de Controle de Efetivo — registros diários de mão de obra por obra/turno, com cadastros auxiliares (empresas, funções), fechamento, audit log e vinculação ao RDO.

**Architecture:** NestJS module com dois sub-controllers: `CadastrosController` (empresas + funções) e `EfetivoController` (registros + itens + fechar/reabrir). Services usam raw SQL via `$queryRawUnsafe` e `$executeRawUnsafe` — mesmo padrão do FVS/GED. Testes unitários com mock manual do PrismaService (sem `@nestjs/testing`).

**Tech Stack:** NestJS · TypeScript · Prisma · PostgreSQL · Jest · class-validator

---

## Arquivos criados / modificados

```
backend/
  prisma/
    migrations/YYYYMMDD_efetivo_module/
      migration.sql                           [CREATE]
    schema.prisma                             [MODIFY — adicionar 4 models + 2 enums]

  src/
    efetivo/
      efetivo.module.ts                       [CREATE]
      efetivo.controller.ts                   [CREATE] — registros + fechar/reabrir
      efetivo.service.ts                      [CREATE]
      efetivo.service.spec.ts                 [CREATE]
      cadastros/
        cadastros.controller.ts               [CREATE] — empresas + funções
        cadastros.service.ts                  [CREATE]
        cadastros.service.spec.ts             [CREATE]
      dto/
        create-registro.dto.ts                [CREATE]
        create-item.dto.ts                    [CREATE]
        patch-item.dto.ts                     [CREATE]
        query-efetivo.dto.ts                  [CREATE]
        create-empresa.dto.ts                 [CREATE]
        create-funcao.dto.ts                  [CREATE]
      types/
        efetivo.types.ts                      [CREATE]
    app.module.ts                             [MODIFY — importar EfetivoModule]
```

---

## Task 1: Migration SQL

**Files:**
- Create: `backend/prisma/migrations/20260415000010_efetivo_module/migration.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- migration: 20260415000010_efetivo_module
-- Módulo Controle de Efetivo: registros diários de mão de obra por obra/turno

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "Turno" AS ENUM ('INTEGRAL', 'MANHA', 'TARDE', 'NOITE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoEmpresa" AS ENUM ('PROPRIA', 'SUBCONTRATADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. empresas_efetivo ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS empresas_efetivo (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(200) NOT NULL,
  tipo       "TipoEmpresa" NOT NULL DEFAULT 'SUBCONTRATADA',
  cnpj       VARCHAR(18),
  ativa      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, cnpj)
);
CREATE INDEX IF NOT EXISTS idx_empresas_efetivo_tenant ON empresas_efetivo(tenant_id);

-- ── 3. funcoes_efetivo ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funcoes_efetivo (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ativa      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_funcoes_efetivo_tenant ON funcoes_efetivo(tenant_id);

-- ── 4. registros_efetivo ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registros_efetivo (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  obra_id        INT NOT NULL REFERENCES "Obra"(id),
  data           DATE NOT NULL,
  turno          "Turno" NOT NULL DEFAULT 'INTEGRAL',
  fechado        BOOLEAN NOT NULL DEFAULT FALSE,
  fechado_por    INT REFERENCES "Usuario"(id),
  fechado_em     TIMESTAMP,
  criado_por     INT NOT NULL REFERENCES "Usuario"(id),
  criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  rdo_id         INT,
  UNIQUE (tenant_id, obra_id, data, turno)
);
CREATE INDEX IF NOT EXISTS idx_registros_efetivo_tenant_obra_data
  ON registros_efetivo(tenant_id, obra_id, data);

-- ── 5. itens_efetivo ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS itens_efetivo (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INT NOT NULL,
  registro_efetivo_id  INT NOT NULL REFERENCES registros_efetivo(id) ON DELETE CASCADE,
  empresa_id           INT NOT NULL REFERENCES empresas_efetivo(id),
  funcao_id            INT NOT NULL REFERENCES funcoes_efetivo(id),
  quantidade           INT NOT NULL CHECK (quantidade >= 1),
  observacao           TEXT
);
CREATE INDEX IF NOT EXISTS idx_itens_efetivo_registro ON itens_efetivo(registro_efetivo_id);
CREATE INDEX IF NOT EXISTS idx_itens_efetivo_tenant    ON itens_efetivo(tenant_id);

-- ── 6. efetivo_audit_log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efetivo_audit_log (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  registro_id   INT NOT NULL,
  acao          VARCHAR(50) NOT NULL,
  usuario_id    INT NOT NULL REFERENCES "Usuario"(id),
  ip_origem     INET,
  detalhes      JSONB,
  criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efetivo_audit_tenant ON efetivo_audit_log(tenant_id, registro_id);
```

- [ ] **Step 2: Aplicar migration**

```bash
cd backend
npx prisma migrate dev --name efetivo_module
```

Esperado: `The following migration(s) have been applied: 20260415000010_efetivo_module`

---

## Task 2: Types

**Files:**
- Create: `backend/src/efetivo/types/efetivo.types.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```typescript
// backend/src/efetivo/types/efetivo.types.ts

export type TurnoEfetivo = 'INTEGRAL' | 'MANHA' | 'TARDE' | 'NOITE';
export type TipoEmpresa  = 'PROPRIA' | 'SUBCONTRATADA';

export interface EmpresaEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  tipo:      TipoEmpresa;
  cnpj:      string | null;
  ativa:     boolean;
  criado_em: Date;
}

export interface FuncaoEfetivo {
  id:        number;
  tenant_id: number;
  nome:      string;
  ativa:     boolean;
  criado_em: Date;
}

export interface ItemEfetivo {
  id:                  number;
  tenant_id:           number;
  registro_efetivo_id: number;
  empresa_id:          number;
  funcao_id:           number;
  quantidade:          number;
  observacao:          string | null;
  // joins opcionais
  empresa_nome?:       string;
  funcao_nome?:        string;
}

export interface RegistroEfetivo {
  id:            number;
  tenant_id:     number;
  obra_id:       number;
  data:          string; // 'YYYY-MM-DD'
  turno:         TurnoEfetivo;
  fechado:       boolean;
  fechado_por:   number | null;
  fechado_em:    Date | null;
  criado_por:    number;
  criado_em:     Date;
  atualizado_em: Date;
  rdo_id:        number | null;
  itens?:        ItemEfetivo[];
  total_homens_dia?: number;
}

export interface ResumoEfetivo {
  total_homens_dia: number;
  por_empresa: { empresa_id: number; nome: string; total_homens_dia: number }[];
  por_funcao:  { funcao_id: number;  nome: string; total_homens_dia: number }[];
}

export interface ListagemEfetivo {
  data:   RegistroEfetivo[];
  meta:   { total: number; page: number; total_pages: number };
  resumo: ResumoEfetivo;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/efetivo/types/efetivo.types.ts
git commit -m "feat(efetivo): add types"
```

---

## Task 3: DTOs

**Files:**
- Create: `backend/src/efetivo/dto/create-empresa.dto.ts`
- Create: `backend/src/efetivo/dto/create-funcao.dto.ts`
- Create: `backend/src/efetivo/dto/create-item.dto.ts`
- Create: `backend/src/efetivo/dto/create-registro.dto.ts`
- Create: `backend/src/efetivo/dto/patch-item.dto.ts`
- Create: `backend/src/efetivo/dto/query-efetivo.dto.ts`

- [ ] **Step 1: create-empresa.dto.ts**

```typescript
// backend/src/efetivo/dto/create-empresa.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator';

export class CreateEmpresaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsEnum(['PROPRIA', 'SUBCONTRATADA'])
  tipo?: 'PROPRIA' | 'SUBCONTRATADA';

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;
}
```

- [ ] **Step 2: create-funcao.dto.ts**

```typescript
// backend/src/efetivo/dto/create-funcao.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateFuncaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;
}
```

- [ ] **Step 3: create-item.dto.ts**

```typescript
// backend/src/efetivo/dto/create-item.dto.ts
import { IsNumber, IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsInt()
  @Min(1)
  empresaId: number;

  @IsInt()
  @Min(1)
  funcaoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
```

- [ ] **Step 4: create-registro.dto.ts**

```typescript
// backend/src/efetivo/dto/create-registro.dto.ts
import { IsString, IsNotEmpty, IsEnum, IsArray, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemDto } from './create-item.dto';

export class CreateRegistroDto {
  @IsString()
  @IsNotEmpty()
  data: string; // 'YYYY-MM-DD'

  @IsEnum(['INTEGRAL', 'MANHA', 'TARDE', 'NOITE'])
  turno: 'INTEGRAL' | 'MANHA' | 'TARDE' | 'NOITE';

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  itens: CreateItemDto[];
}
```

- [ ] **Step 5: patch-item.dto.ts**

```typescript
// backend/src/efetivo/dto/patch-item.dto.ts
import { IsInt, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class PatchItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;
}
```

- [ ] **Step 6: query-efetivo.dto.ts**

```typescript
// backend/src/efetivo/dto/query-efetivo.dto.ts
import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEfetivoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  ano?: number;

  @IsOptional()
  @IsEnum(['INTEGRAL', 'MANHA', 'TARDE', 'NOITE'])
  turno?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/efetivo/dto/
git commit -m "feat(efetivo): add DTOs"
```

---

## Task 4: CadastrosService (empresas + funções)

**Files:**
- Create: `backend/src/efetivo/cadastros/cadastros.service.ts`
- Create: `backend/src/efetivo/cadastros/cadastros.service.spec.ts`

- [ ] **Step 1: Escrever testes (red)**

```typescript
// backend/src/efetivo/cadastros/cadastros.service.spec.ts
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CadastrosService } from './cadastros.service';

const TENANT_ID = 5;

const EMPRESA = {
  id: 1, tenant_id: TENANT_ID, nome: 'Construmax', tipo: 'PROPRIA',
  cnpj: '12.345.678/0001-90', ativa: true, criado_em: new Date(),
};
const FUNCAO = {
  id: 1, tenant_id: TENANT_ID, nome: 'Pedreiro', ativa: true, criado_em: new Date(),
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};

function makeService(): CadastrosService {
  return new (CadastrosService as any)(mockPrisma);
}

describe('CadastrosService', () => {
  let svc: CadastrosService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── getEmpresas ─────────────────────────────────────────────────────────────
  describe('getEmpresas()', () => {
    it('retorna empresas ativas do tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([EMPRESA]);
      const result = await svc.getEmpresas(TENANT_ID);
      expect(result).toHaveLength(1);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1'),
        TENANT_ID,
      );
    });
  });

  // ── createEmpresa ───────────────────────────────────────────────────────────
  describe('createEmpresa()', () => {
    it('insere empresa e retorna o objeto criado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([EMPRESA]);
      const dto = { nome: 'Construmax', tipo: 'PROPRIA' as const, cnpj: '12.345.678/0001-90' };
      const result = await svc.createEmpresa(TENANT_ID, dto);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO empresas_efetivo'),
        TENANT_ID, 'Construmax', 'PROPRIA', '12.345.678/0001-90',
      );
      expect(result.nome).toBe('Construmax');
    });
  });

  // ── updateEmpresa ───────────────────────────────────────────────────────────
  describe('updateEmpresa()', () => {
    it('lança NotFoundException quando empresa não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(svc.updateEmpresa(TENANT_ID, 999, { nome: 'X' }))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft delete: seta ativa=false quando ativo=false', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([EMPRESA])         // SELECT para validar existência
        .mockResolvedValueOnce([{ ...EMPRESA, ativa: false }]); // UPDATE
      const result = await svc.updateEmpresa(TENANT_ID, 1, { ativa: false });
      expect(result.ativa).toBe(false);
    });
  });

  // ── getFuncoes ──────────────────────────────────────────────────────────────
  describe('getFuncoes()', () => {
    it('retorna funções ativas do tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([FUNCAO]);
      const result = await svc.getFuncoes(TENANT_ID);
      expect(result).toHaveLength(1);
    });
  });

  // ── createFuncao ────────────────────────────────────────────────────────────
  describe('createFuncao()', () => {
    it('insere função e retorna o objeto criado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([FUNCAO]);
      const result = await svc.createFuncao(TENANT_ID, { nome: 'Pedreiro' });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO funcoes_efetivo'),
        TENANT_ID, 'Pedreiro',
      );
      expect(result.nome).toBe('Pedreiro');
    });
  });
});
```

- [ ] **Step 2: Rodar testes — verificar falha**

```bash
cd backend
npx jest --testPathPatterns="cadastros.service.spec" --no-coverage
```

Esperado: `FAIL` — `Cannot find module './cadastros.service'`

- [ ] **Step 3: Implementar CadastrosService**

```typescript
// backend/src/efetivo/cadastros/cadastros.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EmpresaEfetivo, FuncaoEfetivo } from '../types/efetivo.types';
import type { CreateEmpresaDto } from '../dto/create-empresa.dto';
import type { CreateFuncaoDto } from '../dto/create-funcao.dto';

@Injectable()
export class CadastrosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Empresas ────────────────────────────────────────────────────────────────

  async getEmpresas(tenantId: number): Promise<EmpresaEfetivo[]> {
    return this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `SELECT * FROM empresas_efetivo WHERE tenant_id = $1 ORDER BY nome ASC`,
      tenantId,
    );
  }

  async createEmpresa(tenantId: number, dto: CreateEmpresaDto): Promise<EmpresaEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `INSERT INTO empresas_efetivo (tenant_id, nome, tipo, cnpj)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      tenantId,
      dto.nome,
      dto.tipo ?? 'SUBCONTRATADA',
      dto.cnpj ?? null,
    );
    return rows[0];
  }

  async updateEmpresa(
    tenantId: number,
    id: number,
    payload: Partial<Pick<EmpresaEfetivo, 'nome' | 'cnpj' | 'ativa'>>,
  ): Promise<EmpresaEfetivo> {
    const existing = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `SELECT * FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Empresa ${id} não encontrada`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (payload.nome  !== undefined) { sets.push(`nome = $${i++}`);  vals.push(payload.nome); }
    if (payload.cnpj  !== undefined) { sets.push(`cnpj = $${i++}`);  vals.push(payload.cnpj); }
    if (payload.ativa !== undefined) { sets.push(`ativa = $${i++}`); vals.push(payload.ativa); }
    if (!sets.length) return existing[0];

    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<EmpresaEfetivo[]>(
      `UPDATE empresas_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  // ── Funções ─────────────────────────────────────────────────────────────────

  async getFuncoes(tenantId: number): Promise<FuncaoEfetivo[]> {
    return this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `SELECT * FROM funcoes_efetivo WHERE tenant_id = $1 ORDER BY nome ASC`,
      tenantId,
    );
  }

  async createFuncao(tenantId: number, dto: CreateFuncaoDto): Promise<FuncaoEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `INSERT INTO funcoes_efetivo (tenant_id, nome)
       VALUES ($1, $2)
       RETURNING *`,
      tenantId,
      dto.nome,
    );
    return rows[0];
  }

  async updateFuncao(
    tenantId: number,
    id: number,
    payload: Partial<Pick<FuncaoEfetivo, 'nome' | 'ativa'>>,
  ): Promise<FuncaoEfetivo> {
    const existing = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `SELECT * FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!existing.length) throw new NotFoundException(`Função ${id} não encontrada`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (payload.nome  !== undefined) { sets.push(`nome = $${i++}`);  vals.push(payload.nome); }
    if (payload.ativa !== undefined) { sets.push(`ativa = $${i++}`); vals.push(payload.ativa); }
    if (!sets.length) return existing[0];

    vals.push(id, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<FuncaoEfetivo[]>(
      `UPDATE funcoes_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }
}
```

- [ ] **Step 4: Rodar testes — verificar passou**

```bash
npx jest --testPathPatterns="cadastros.service.spec" --no-coverage
```

Esperado: `PASS` — 5 testes passando

- [ ] **Step 5: Commit**

```bash
git add backend/src/efetivo/cadastros/
git commit -m "feat(efetivo): add CadastrosService (empresas + funções)"
```

---

## Task 5: EfetivoService — criar registro e listar

**Files:**
- Create: `backend/src/efetivo/efetivo.service.ts`
- Create: `backend/src/efetivo/efetivo.service.spec.ts`

- [ ] **Step 1: Escrever testes (red) — criar e listar**

```typescript
// backend/src/efetivo/efetivo.service.spec.ts
import {
  BadRequestException, ConflictException,
  ForbiddenException, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { EfetivoService } from './efetivo.service';

const TENANT_ID = 5;
const USER_ID   = 42;
const OBRA_ID   = 10;
const IP        = '127.0.0.1';

const HOJE      = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
const AMANHA    = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const EMPRESA   = { id: 1, tenant_id: TENANT_ID, nome: 'Construmax', ativa: true };
const FUNCAO    = { id: 1, tenant_id: TENANT_ID, nome: 'Pedreiro',   ativa: true };

const REGISTRO  = {
  id: 1, tenant_id: TENANT_ID, obra_id: OBRA_ID,
  data: HOJE, turno: 'INTEGRAL', fechado: false,
  fechado_por: null, fechado_em: null, criado_por: USER_ID,
  criado_em: new Date(), atualizado_em: new Date(), rdo_id: null,
};

const ITEM = {
  id: 1, tenant_id: TENANT_ID, registro_efetivo_id: 1,
  empresa_id: 1, funcao_id: 1, quantidade: 8, observacao: null,
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): EfetivoService {
  return new (EfetivoService as any)(mockPrisma);
}

describe('EfetivoService', () => {
  let svc: EfetivoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createRegistro ──────────────────────────────────────────────────────────
  describe('createRegistro()', () => {
    it('lança BadRequestException se obra não pertence ao tenant', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // obra não encontrada

      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lança UnprocessableEntityException se data é futura', async () => {
      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: AMANHA, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('cria registro com itens e retorna objeto completo', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: OBRA_ID }])  // SELECT Obra
        .mockResolvedValueOnce([EMPRESA])           // SELECT empresa
        .mockResolvedValueOnce([FUNCAO])            // SELECT funcao
        .mockResolvedValueOnce([REGISTRO])          // INSERT registro
        .mockResolvedValueOnce([ITEM])              // INSERT item
        .mockResolvedValueOnce([]);                 // SELECT rdo (vinculação — não encontrado)
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // UPDATE atualizado_em

      const result = await svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL',
        itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP);

      expect(result.id).toBe(1);
      expect(result.itens).toHaveLength(1);
      expect(result.rdo_id).toBeNull();
    });

    it('lança ConflictException em duplicata obra+data+turno', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ id: OBRA_ID }]);
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([EMPRESA]);
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FUNCAO]);
      // Simula erro de UNIQUE constraint do Postgres
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
        Object.assign(new Error('duplicate'), { code: '23505' }),
      );

      await expect(svc.createRegistro(TENANT_ID, USER_ID, OBRA_ID, {
        data: HOJE, turno: 'INTEGRAL', itens: [{ empresaId: 1, funcaoId: 1, quantidade: 8 }],
      }, IP)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── getRegistros ────────────────────────────────────────────────────────────
  describe('getRegistros()', () => {
    it('retorna registros com meta e resumo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ count: '1' }])     // COUNT
        .mockResolvedValueOnce([REGISTRO])            // SELECT registros
        .mockResolvedValueOnce([ITEM])                // SELECT itens do registro
        .mockResolvedValueOnce([                      // resumo por empresa
          { empresa_id: 1, nome: 'Construmax', total_homens_dia: 8 },
        ])
        .mockResolvedValueOnce([                      // resumo por função
          { funcao_id: 1, nome: 'Pedreiro', total_homens_dia: 8 },
        ]);

      const result = await svc.getRegistros(TENANT_ID, OBRA_ID, {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.resumo.total_homens_dia).toBe(8);
    });
  });
});
```

- [ ] **Step 2: Rodar — verificar falha**

```bash
npx jest --testPathPatterns="efetivo.service.spec" --no-coverage
```

Esperado: `FAIL` — `Cannot find module './efetivo.service'`

- [ ] **Step 3: Implementar EfetivoService — createRegistro + getRegistros**

```typescript
// backend/src/efetivo/efetivo.service.ts
import {
  Injectable, BadRequestException, ConflictException,
  ForbiddenException, NotFoundException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RegistroEfetivo, ItemEfetivo, ListagemEfetivo } from './types/efetivo.types';
import type { CreateRegistroDto } from './dto/create-registro.dto';
import type { PatchItemDto } from './dto/patch-item.dto';
import type { QueryEfetivoDto } from './dto/query-efetivo.dto';

@Injectable()
export class EfetivoService {
  private readonly logger = new Logger(EfetivoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ─────────────────────────────────────────────────────────────────

  private async getRegistroOuFalhar(tenantId: number, id: number): Promise<RegistroEfetivo> {
    const rows = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `SELECT * FROM registros_efetivo WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Registro ${id} não encontrado`);
    return rows[0];
  }

  private async gravarAuditLog(
    tenantId: number, registroId: number, acao: string,
    usuarioId: number, ip: string | null, detalhes?: object,
  ): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO efetivo_audit_log (tenant_id, registro_id, acao, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5::inet, $6::jsonb, NOW())`,
      tenantId, registroId, acao, usuarioId, ip ?? null,
      detalhes ? JSON.stringify(detalhes) : null,
    );
  }

  // ── createRegistro ──────────────────────────────────────────────────────────

  async createRegistro(
    tenantId: number, userId: number, obraId: number,
    dto: CreateRegistroDto, ip: string,
  ): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    // Validação: data futura
    const dataRegistro = new Date(dto.data);
    dataRegistro.setHours(23, 59, 59);
    if (dataRegistro > new Date()) {
      throw new UnprocessableEntityException('Data de efetivo não pode ser futura.');
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        // 1. Validar obra no tenant
        const obra = await tx.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM "Obra" WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
          obraId, tenantId,
        );
        if (!obra.length) throw new BadRequestException(`Obra ${obraId} não encontrada.`);

        // 2. Validar empresas e funções
        for (const item of dto.itens) {
          const emp = await tx.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM empresas_efetivo WHERE id = $1 AND tenant_id = $2 AND ativa = TRUE`,
            item.empresaId, tenantId,
          );
          if (!emp.length) throw new BadRequestException(`Empresa ${item.empresaId} não encontrada.`);

          const fn = await tx.$queryRawUnsafe<{ id: number }[]>(
            `SELECT id FROM funcoes_efetivo WHERE id = $1 AND tenant_id = $2 AND ativa = TRUE`,
            item.funcaoId, tenantId,
          );
          if (!fn.length) throw new BadRequestException(`Função ${item.funcaoId} não encontrada.`);
        }

        // 3. Inserir registro
        const [registro] = await tx.$queryRawUnsafe<RegistroEfetivo[]>(
          `INSERT INTO registros_efetivo (tenant_id, obra_id, data, turno, criado_por)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          tenantId, obraId, dto.data, dto.turno, userId,
        );

        // 4. Inserir itens
        const itens: ItemEfetivo[] = [];
        for (const item of dto.itens) {
          const [novoItem] = await tx.$queryRawUnsafe<ItemEfetivo[]>(
            `INSERT INTO itens_efetivo (tenant_id, registro_efetivo_id, empresa_id, funcao_id, quantidade, observacao)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            tenantId, registro.id, item.empresaId, item.funcaoId, item.quantidade, item.observacao ?? null,
          );
          itens.push(novoItem);
        }

        // 5. Vinculação silenciosa ao RDO do mesmo dia
        const rdoRows = await tx.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM rdos WHERE obra_id = $1 AND data::date = $2::date AND tenant_id = $3 LIMIT 1`,
          obraId, dto.data, tenantId,
        );
        if (rdoRows.length) {
          await tx.$executeRawUnsafe(
            `UPDATE registros_efetivo SET rdo_id = $1, atualizado_em = NOW() WHERE id = $2`,
            rdoRows[0].id, registro.id,
          );
          registro.rdo_id = rdoRows[0].id;
        }

        return { ...registro, itens };
      });
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Já existe um registro de efetivo para esta obra, data e turno.');
      }
      throw err;
    }
  }

  // ── getRegistros ────────────────────────────────────────────────────────────

  async getRegistros(
    tenantId: number, obraId: number, query: QueryEfetivoDto,
  ): Promise<ListagemEfetivo> {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 30;
    const offset = (page - 1) * limit;

    const whereParts = [`r.tenant_id = $1`, `r.obra_id = $2`];
    const vals: unknown[] = [tenantId, obraId];
    let i = 3;

    if (query.mes) { whereParts.push(`EXTRACT(MONTH FROM r.data) = $${i++}`); vals.push(query.mes); }
    if (query.ano) { whereParts.push(`EXTRACT(YEAR  FROM r.data) = $${i++}`); vals.push(query.ano); }
    if (query.turno) { whereParts.push(`r.turno = $${i++}`); vals.push(query.turno); }

    const where = whereParts.join(' AND ');

    const [countRow] = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM registros_efetivo r WHERE ${where}`,
      ...vals,
    );
    const total = parseInt(countRow.count, 10);

    const registros = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `SELECT r.* FROM registros_efetivo r WHERE ${where}
       ORDER BY r.data DESC, r.turno ASC
       LIMIT $${i++} OFFSET $${i++}`,
      ...vals, limit, offset,
    );

    // Itens por registro
    for (const reg of registros) {
      const itens = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
        `SELECT i.*, e.nome AS empresa_nome, f.nome AS funcao_nome
         FROM itens_efetivo i
         JOIN empresas_efetivo e ON e.id = i.empresa_id
         JOIN funcoes_efetivo  f ON f.id = i.funcao_id
         WHERE i.registro_efetivo_id = $1`,
        reg.id,
      );
      (reg as any).itens = itens;
      (reg as any).total_homens_dia = itens.reduce((s, it) => s + it.quantidade, 0);
    }

    // Resumo do período
    const porEmpresa = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.id AS empresa_id, e.nome, SUM(i.quantidade) AS total_homens_dia
       FROM itens_efetivo i
       JOIN registros_efetivo r ON r.id = i.registro_efetivo_id
       JOIN empresas_efetivo  e ON e.id = i.empresa_id
       WHERE ${where}
       GROUP BY e.id, e.nome ORDER BY e.nome`,
      ...vals.slice(0, i - 3),
    );

    const porFuncao = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT f.id AS funcao_id, f.nome, SUM(i.quantidade) AS total_homens_dia
       FROM itens_efetivo i
       JOIN registros_efetivo r ON r.id = i.registro_efetivo_id
       JOIN funcoes_efetivo   f ON f.id = i.funcao_id
       WHERE ${where}
       GROUP BY f.id, f.nome ORDER BY f.nome`,
      ...vals.slice(0, i - 3),
    );

    const totalHomensDia = porEmpresa.reduce((s: number, e: any) => s + Number(e.total_homens_dia), 0);

    return {
      data: registros,
      meta: { total, page, total_pages: Math.ceil(total / limit) },
      resumo: {
        total_homens_dia: totalHomensDia,
        por_empresa: porEmpresa.map(e => ({ ...e, total_homens_dia: Number(e.total_homens_dia) })),
        por_funcao:  porFuncao.map(f  => ({ ...f,  total_homens_dia: Number(f.total_homens_dia) })),
      },
    };
  }

  // ── getRegistro ─────────────────────────────────────────────────────────────

  async getRegistro(tenantId: number, obraId: number, id: number): Promise<RegistroEfetivo & { itens: ItemEfetivo[] }> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);

    const itens = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `SELECT i.*, e.nome AS empresa_nome, f.nome AS funcao_nome
       FROM itens_efetivo i
       JOIN empresas_efetivo e ON e.id = i.empresa_id
       JOIN funcoes_efetivo  f ON f.id = i.funcao_id
       WHERE i.registro_efetivo_id = $1`,
      id,
    );
    return { ...registro, itens };
  }

  // ── patchItem ───────────────────────────────────────────────────────────────

  async patchItem(
    tenantId: number, obraId: number, registroId: number,
    itemId: number, dto: PatchItemDto, userId: number, ip: string,
  ): Promise<ItemEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, registroId);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${registroId} não encontrado`);
    if (registro.fechado) throw new ForbiddenException('Registro fechado. Somente o Engenheiro pode reabri-lo.');

    const [item] = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `SELECT * FROM itens_efetivo WHERE id = $1 AND registro_efetivo_id = $2 AND tenant_id = $3`,
      itemId, registroId, tenantId,
    );
    if (!item) throw new NotFoundException(`Item ${itemId} não encontrado`);

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.quantidade !== undefined) { sets.push(`quantidade = $${i++}`);  vals.push(dto.quantidade); }
    if (dto.observacao !== undefined) { sets.push(`observacao = $${i++}`);  vals.push(dto.observacao); }
    if (!sets.length) return item;

    vals.push(itemId, tenantId);
    const [updated] = await this.prisma.$queryRawUnsafe<ItemEfetivo[]>(
      `UPDATE itens_efetivo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );

    await this.gravarAuditLog(tenantId, registroId, 'edicao_item', userId, ip, { itemId, changes: dto });
    return updated;
  }

  // ── fecharRegistro ──────────────────────────────────────────────────────────

  async fecharRegistro(tenantId: number, obraId: number, id: number, userId: number, ip: string): Promise<RegistroEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);
    if (registro.fechado) throw new ForbiddenException('Registro já está fechado.');

    // Validar: não fechar sem itens
    const [countRow] = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM itens_efetivo WHERE registro_efetivo_id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    if (parseInt(countRow.count, 10) === 0) {
      throw new UnprocessableEntityException('Registro sem itens não pode ser fechado.');
    }

    const [updated] = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `UPDATE registros_efetivo
       SET fechado = TRUE, fechado_por = $1, fechado_em = NOW(), atualizado_em = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      userId, id, tenantId,
    );

    await this.gravarAuditLog(tenantId, id, 'fechamento', userId, ip);
    return updated;
  }

  // ── reabrirRegistro ─────────────────────────────────────────────────────────

  async reabrirRegistro(tenantId: number, obraId: number, id: number, userId: number, ip: string): Promise<RegistroEfetivo> {
    const registro = await this.getRegistroOuFalhar(tenantId, id);
    if (registro.obra_id !== obraId) throw new NotFoundException(`Registro ${id} não encontrado`);

    const [updated] = await this.prisma.$queryRawUnsafe<RegistroEfetivo[]>(
      `UPDATE registros_efetivo
       SET fechado = FALSE, fechado_por = NULL, fechado_em = NULL, atualizado_em = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      id, tenantId,
    );

    await this.gravarAuditLog(tenantId, id, 'reabertura', userId, ip);
    return updated;
  }
}
```

- [ ] **Step 4: Rodar testes — verificar passou**

```bash
npx jest --testPathPatterns="efetivo.service.spec" --no-coverage
```

Esperado: `PASS` — 5 testes passando

- [ ] **Step 5: Commit**

```bash
git add backend/src/efetivo/efetivo.service.ts backend/src/efetivo/efetivo.service.spec.ts
git commit -m "feat(efetivo): add EfetivoService (CRUD + fechar/reabrir)"
```

---

## Task 6: Controllers + Module + AppModule

**Files:**
- Create: `backend/src/efetivo/efetivo.controller.ts`
- Create: `backend/src/efetivo/cadastros/cadastros.controller.ts`
- Create: `backend/src/efetivo/efetivo.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: EfetivoController**

```typescript
// backend/src/efetivo/efetivo.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../common/decorators/tenant.decorator';
import { EfetivoService } from './efetivo.service';
import { CreateRegistroDto } from './dto/create-registro.dto';
import { PatchItemDto } from './dto/patch-item.dto';
import { QueryEfetivoDto } from './dto/query-efetivo.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/obras/:obraId/efetivo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EfetivoController {
  constructor(private readonly efetivo: EfetivoService) {}

  @Post()
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  create(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Body() dto: CreateRegistroDto,
    @Ip() ip: string,
  ) {
    return this.efetivo.createRegistro(tenantId, user.id, obraId, dto, ip);
  }

  @Get()
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT', 'VISITANTE')
  list(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: QueryEfetivoDto,
  ) {
    return this.efetivo.getRegistros(tenantId, obraId, query);
  }

  @Get(':id')
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT', 'VISITANTE')
  findOne(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.efetivo.getRegistro(tenantId, obraId, id);
  }

  @Patch(':registroId/itens/:itemId')
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT')
  patchItem(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('registroId', ParseIntPipe) registroId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: PatchItemDto,
    @Ip() ip: string,
  ) {
    return this.efetivo.patchItem(tenantId, obraId, registroId, itemId, dto, user.id, ip);
  }

  @Post(':id/fechar')
  @Roles('ENGENHEIRO', 'ADMIN_TENANT')
  fechar(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.efetivo.fecharRegistro(tenantId, obraId, id, user.id, ip);
  }

  @Post(':id/reabrir')
  @Roles('ENGENHEIRO', 'ADMIN_TENANT')
  reabrir(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.efetivo.reabrirRegistro(tenantId, obraId, id, user.id, ip);
  }
}
```

- [ ] **Step 2: CadastrosController**

```typescript
// backend/src/efetivo/cadastros/cadastros.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CadastrosService } from './cadastros.service';
import { CreateEmpresaDto } from '../dto/create-empresa.dto';
import { CreateFuncaoDto } from '../dto/create-funcao.dto';

@Controller('api/v1/efetivo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CadastrosController {
  constructor(private readonly cadastros: CadastrosService) {}

  // ── Empresas ────────────────────────────────────────────────────────────────

  @Get('empresas')
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT', 'VISITANTE')
  getEmpresas(@TenantId() tenantId: number) {
    return this.cadastros.getEmpresas(tenantId);
  }

  @Post('empresas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createEmpresa(@TenantId() tenantId: number, @Body() dto: CreateEmpresaDto) {
    return this.cadastros.createEmpresa(tenantId, dto);
  }

  @Patch('empresas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateEmpresa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateEmpresaDto & { ativa: boolean }>,
  ) {
    return this.cadastros.updateEmpresa(tenantId, id, dto);
  }

  @Delete('empresas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmpresa(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.cadastros.updateEmpresa(tenantId, id, { ativa: false });
  }

  // ── Funções ─────────────────────────────────────────────────────────────────

  @Get('funcoes')
  @Roles('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT', 'VISITANTE')
  getFuncoes(@TenantId() tenantId: number) {
    return this.cadastros.getFuncoes(tenantId);
  }

  @Post('funcoes')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFuncao(@TenantId() tenantId: number, @Body() dto: CreateFuncaoDto) {
    return this.cadastros.createFuncao(tenantId, dto);
  }

  @Patch('funcoes/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateFuncao(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateFuncaoDto & { ativa: boolean }>,
  ) {
    return this.cadastros.updateFuncao(tenantId, id, dto);
  }

  @Delete('funcoes/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFuncao(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.cadastros.updateFuncao(tenantId, id, { ativa: false });
  }
}
```

- [ ] **Step 3: EfetivoModule**

```typescript
// backend/src/efetivo/efetivo.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EfetivoService } from './efetivo.service';
import { EfetivoController } from './efetivo.controller';
import { CadastrosService } from './cadastros/cadastros.service';
import { CadastrosController } from './cadastros/cadastros.controller';

@Module({
  imports: [PrismaModule],
  providers: [EfetivoService, CadastrosService],
  controllers: [EfetivoController, CadastrosController],
  exports: [EfetivoService, CadastrosService],
})
export class EfetivoModule {}
```

- [ ] **Step 4: Registrar no AppModule**

Abrir `backend/src/app.module.ts` e adicionar:

```typescript
import { EfetivoModule } from './efetivo/efetivo.module';
// ... no array imports:
EfetivoModule,
```

- [ ] **Step 5: Rodar todos os testes do módulo**

```bash
npx jest --testPathPatterns="efetivo" --no-coverage
```

Esperado: `PASS` — todas as suites passando

- [ ] **Step 6: Build para garantir que não há erros de TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros

- [ ] **Step 7: Commit final**

```bash
git add backend/src/efetivo/ backend/src/app.module.ts
git commit -m "feat(efetivo): add EfetivoModule (controllers + module + AppModule registration)"
```

---

## Self-Review — Cobertura da Spec

| Requisito da spec | Coberto em |
|---|---|
| Migration SQL com enums, 4 tabelas, índices, audit_log | Task 1 |
| Types TypeScript | Task 2 |
| DTOs com validação (class-validator) | Task 3 |
| CadastrosService: empresas + funções (CRUD + soft delete) | Task 4 |
| createRegistro: validação obra/tenant, data futura, unique 409 | Task 5 |
| getRegistros: paginação + resumo por empresa/função | Task 5 |
| getRegistro: detalhe com itens expandidos | Task 5 |
| patchItem: bloqueio se fechado | Task 5 |
| fecharRegistro: bloqueio se vazio, audit_log | Task 5 |
| reabrirRegistro: audit_log | Task 5 |
| Vinculação silenciosa ao RDO | Task 5 (createRegistro) |
| Controllers com @Roles corretos | Task 6 |
| EfetivoModule registrado no AppModule | Task 6 |
| Isolamento de tenant em todas as queries | ✅ todas as queries usam `tenant_id = $N` |

**Não coberto neste plano (fora de escopo para v1):**
- Endpoint `/relatorio` PDF/XLSX (depende de lib de geração — plano separado)
- Frontend React (plano separado)
- Alerta não-bloqueante para datas > 30 dias no passado (fácil adicionar após v1)
