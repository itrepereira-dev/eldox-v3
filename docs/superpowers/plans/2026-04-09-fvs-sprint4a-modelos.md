# FVS Sprint 4a — Templates de Inspeção (fvs_modelos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o sistema de templates de inspeção (`fvs_modelos`) com ciclo de vida rascunho→concluido→bloqueado, vinculação N:N obra-template, criação de Ficha via template e respeito às flags de workflow (`exige_ro`, `exige_reinspecao`, `exige_parecer`).

**Architecture:** NestJS + Prisma raw SQL (`$queryRawUnsafe`/`$executeRawUnsafe`/$transaction). Novo módulo `modelos/` dentro de `backend/src/fvs/`. `ModeloService` é o único ponto de escrita para `fvs_modelos`; `InspecaoService.createFicha` delega a ele para obter o template e executa o bloqueio+fichas_count dentro da mesma `$transaction`. Frontend segue o padrão existente: tipos em `fvs.service.ts`, hooks React Query em `modelos/hooks/useModelos.ts`.

**Tech Stack:** NestJS, TypeScript, Prisma raw SQL, PostgreSQL, React, @tanstack/react-query, axios, class-validator

---

## Padrões do Codebase (ler antes de implementar)

- **Prisma raw SQL exclusivo.** Nunca use `prisma.model.findMany()`. Sempre `$queryRawUnsafe` / `$executeRawUnsafe`.
- **tenant_id em toda query.** Todo WHERE inclui `AND tenant_id = $N`. Sem exceção.
- **deleted_at IS NULL.** Toda listagem filtra `AND deleted_at IS NULL`.
- **Testes sem NestJS Testing.** Mocks manuais do Prisma, `new Service(mockPrisma)`. Ver `inspecao.service.spec.ts`.
- **Controladores finos.** Toda lógica vai no Service. Controlador só extrai params e chama o service.
- **Roles no controlador.** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('ADMIN_TENANT', 'ENGENHEIRO')`.
- **Frontend:** tipos em `src/services/fvs.service.ts`, hooks em `src/modules/fvs/modelos/hooks/`, pages em `src/modules/fvs/modelos/pages/`.

---

## Mapa de Arquivos

**Criar (backend):**
- `backend/prisma/migrations/20260410000000_fvs_sprint4a_modelos/migration.sql`
- `backend/src/fvs/modelos/dto/create-modelo.dto.ts`
- `backend/src/fvs/modelos/dto/update-modelo.dto.ts`
- `backend/src/fvs/modelos/dto/create-modelo-servico.dto.ts`
- `backend/src/fvs/modelos/dto/update-modelo-servico.dto.ts`
- `backend/src/fvs/modelos/dto/vincular-obras.dto.ts`
- `backend/src/fvs/modelos/modelo.service.ts`
- `backend/src/fvs/modelos/modelo.service.spec.ts`
- `backend/src/fvs/modelos/modelo.controller.ts`

**Modificar (backend):**
- `backend/src/fvs/types/fvs.types.ts` — add FvsModelo, FvsModeloServico, ObraModeloFvs; update FichaFvs
- `backend/src/fvs/fvs.module.ts` — register ModeloService, ModeloController
- `backend/src/fvs/inspecao/dto/create-ficha.dto.ts` — add modeloId, tornar regime/servicos opcionais
- `backend/src/fvs/inspecao/inspecao.service.ts` — createFicha com template + patchFicha flags + autoCreateRo
- `backend/src/fvs/inspecao/inspecao.service.spec.ts` — novos testes
- `backend/src/fvs/inspecao/ro.service.ts` — patchServicoNc verifica exige_reinspecao
- `backend/src/fvs/inspecao/ro.service.spec.ts` — novo teste
- `backend/src/obras/obras.controller.ts` — rotas /obras/:obraId/modelos
- `backend/src/obras/obras.module.ts` — importar FvsModule

**Criar (frontend):**
- `frontend-web/src/modules/fvs/modelos/hooks/useModelos.ts`
- `frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx`
- `frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx`
- `frontend-web/src/modules/fvs/modelos/pages/ModeloDetailPage.tsx`

**Modificar (frontend):**
- `frontend-web/src/services/fvs.service.ts` — tipos + chamadas de API para modelos; atualizar CreateFichaPayload
- `frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts` — atualizar CreateFichaPayload
- `frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx` — step de seleção de template
- `frontend-web/src/pages/obras/ObraDetalhePage.tsx` — aba de templates

---

## Task 1: Migration SQL — Sprint 4a

**Files:**
- Create: `backend/prisma/migrations/20260410000000_fvs_sprint4a_modelos/migration.sql`

- [ ] **Step 1: Criar diretório e arquivo de migration**

```bash
mkdir -p backend/prisma/migrations/20260410000000_fvs_sprint4a_modelos
```

- [ ] **Step 2: Escrever o SQL completo**

```sql
-- migration: 20260410000000_fvs_sprint4a_modelos
-- Sprint 4a: templates de inspeção (fvs_modelos), vinculação obra-template, flags de workflow em fvs_fichas

-- ── 1. fvs_modelos ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvs_modelos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  nome             VARCHAR(200) NOT NULL,
  descricao        TEXT,
  versao           INT NOT NULL DEFAULT 1,
  escopo           VARCHAR(20) NOT NULL DEFAULT 'empresa',
  obra_id          INT REFERENCES "Obra"(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  bloqueado        BOOL NOT NULL DEFAULT false,
  regime           VARCHAR(20) NOT NULL DEFAULT 'livre',
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

CREATE INDEX IF NOT EXISTS idx_fvs_modelos_tenant_status ON fvs_modelos(tenant_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fvs_modelos_tenant_escopo ON fvs_modelos(tenant_id, escopo)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fvs_modelos_obra_id       ON fvs_modelos(obra_id)
  WHERE obra_id IS NOT NULL;

-- ── 2. fvs_modelo_servicos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvs_modelo_servicos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  modelo_id        INT NOT NULL REFERENCES fvs_modelos(id) ON DELETE CASCADE,
  servico_id       INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  ordem            INT NOT NULL DEFAULT 0,
  itens_excluidos  INT[] NULL,
  UNIQUE(modelo_id, servico_id)
);

CREATE INDEX IF NOT EXISTS idx_fvs_modelo_servicos_modelo ON fvs_modelo_servicos(modelo_id);
CREATE INDEX IF NOT EXISTS idx_fvs_modelo_servicos_tenant ON fvs_modelo_servicos(tenant_id);

-- ── 3. obra_modelo_fvs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS obra_modelo_fvs (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id),
  modelo_id     INT NOT NULL REFERENCES fvs_modelos(id),
  vinculado_por INT NOT NULL REFERENCES "Usuario"(id),
  fichas_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP NULL,
  UNIQUE(obra_id, modelo_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_modelo_fvs_obra        ON obra_modelo_fvs(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_modelo_fvs_tenant_obra ON obra_modelo_fvs(tenant_id, obra_id);

-- ── 4. fvs_fichas: novas colunas ────────────────────────────────────────────

ALTER TABLE fvs_fichas
  ADD COLUMN IF NOT EXISTS modelo_id        INT REFERENCES fvs_modelos(id),
  ADD COLUMN IF NOT EXISTS exige_ro         BOOL NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exige_reinspecao BOOL NOT NULL DEFAULT true;
-- exige_parecer já existe desde Sprint 2

CREATE INDEX IF NOT EXISTS idx_fvs_fichas_modelo_id ON fvs_fichas(modelo_id)
  WHERE modelo_id IS NOT NULL;

-- ROLLBACK:
-- ALTER TABLE fvs_fichas DROP COLUMN IF EXISTS exige_reinspecao, DROP COLUMN IF EXISTS exige_ro, DROP COLUMN IF EXISTS modelo_id;
-- DROP TABLE IF EXISTS obra_modelo_fvs;
-- DROP TABLE IF EXISTS fvs_modelo_servicos;
-- DROP TABLE IF EXISTS fvs_modelos;
```

- [ ] **Step 3: Aplicar a migration no banco de desenvolvimento**

```bash
cd backend && npx prisma migrate dev --name fvs_sprint4a_modelos
```

Saída esperada: `Your database is now in sync with your schema.`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260410000000_fvs_sprint4a_modelos/
git commit -m "feat(fvs): migration Sprint 4a — fvs_modelos, obra_modelo_fvs, flags em fvs_fichas"
```

---

## Task 2: Backend Types — FvsModelo, FvsModeloServico, ObraModeloFvs

**Files:**
- Modify: `backend/src/fvs/types/fvs.types.ts`

- [ ] **Step 1: Adicionar tipos ao final de fvs.types.ts**

Abrir `backend/src/fvs/types/fvs.types.ts` e adicionar no final do arquivo, após a seção Sprint 3:

```typescript
// ─── Sprint 4a: Templates de Inspeção ───────────────────────────────────────

export type StatusModelo = 'rascunho' | 'concluido';
export type EscopoModelo = 'empresa' | 'obra';
export type RegimeModelo = 'livre' | 'pbqph';

export interface FvsModelo {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  versao: number;
  escopo: EscopoModelo;
  obra_id: number | null;
  status: StatusModelo;
  bloqueado: boolean;
  regime: RegimeModelo;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer: boolean;
  concluido_por: number | null;
  concluido_em: Date | null;
  criado_por: number;
  deleted_at: Date | null;
  // joined (opcional)
  servicos?: FvsModeloServico[];
  obras_count?: number; // COUNT de obra_modelo_fvs ativo
}

export interface FvsModeloServico {
  id: number;
  tenant_id: number;
  modelo_id: number;
  servico_id: number;
  ordem: number;
  itens_excluidos: number[] | null;
  // joined
  servico_nome?: string;
}

export interface ObraModeloFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  modelo_id: number;
  vinculado_por: number;
  fichas_count: number;
  created_at: Date;
  deleted_at: Date | null;
  // joined
  modelo_nome?: string;
  obra_nome?: string;
}
```

- [ ] **Step 2: Atualizar FichaFvs para incluir os novos campos**

Localizar a interface `FichaFvs` e adicionar os novos campos:

```typescript
export interface FichaFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  nome: string;
  regime: RegimeFicha;
  status: StatusFicha;
  criado_por: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  // Sprint 4a
  modelo_id: number | null;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  // exige_parecer já existia desde Sprint 2 — se ainda não estiver aqui, adicionar:
  exige_parecer?: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/fvs/types/fvs.types.ts
git commit -m "feat(fvs): types Sprint 4a — FvsModelo, FvsModeloServico, ObraModeloFvs"
```

---

## Task 3: DTOs — Modelos

**Files:**
- Create: `backend/src/fvs/modelos/dto/create-modelo.dto.ts`
- Create: `backend/src/fvs/modelos/dto/update-modelo.dto.ts`
- Create: `backend/src/fvs/modelos/dto/create-modelo-servico.dto.ts`
- Create: `backend/src/fvs/modelos/dto/update-modelo-servico.dto.ts`
- Create: `backend/src/fvs/modelos/dto/vincular-obras.dto.ts`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p backend/src/fvs/modelos/dto
```

- [ ] **Step 2: create-modelo.dto.ts**

```typescript
// backend/src/fvs/modelos/dto/create-modelo.dto.ts
import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean,
  IsNumber, MaxLength, ValidateIf,
} from 'class-validator';

export class CreateModeloDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsEnum(['empresa', 'obra'])
  escopo: 'empresa' | 'obra';

  @ValidateIf((o) => o.escopo === 'obra')
  @IsNumber()
  obraId?: number;

  @IsEnum(['livre', 'pbqph'])
  regime: 'livre' | 'pbqph';

  @IsOptional()
  @IsBoolean()
  exigeRo?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeReinspecao?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeParecer?: boolean;
}
```

- [ ] **Step 3: update-modelo.dto.ts**

```typescript
// backend/src/fvs/modelos/dto/update-modelo.dto.ts
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, MaxLength, ValidateIf } from 'class-validator';

export class UpdateModeloDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsEnum(['empresa', 'obra'])
  escopo?: 'empresa' | 'obra';

  @IsOptional()
  @ValidateIf((o) => o.escopo === 'obra')
  @IsNumber()
  obraId?: number;

  @IsOptional()
  @IsEnum(['livre', 'pbqph'])
  regime?: 'livre' | 'pbqph';

  @IsOptional()
  @IsBoolean()
  exigeRo?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeReinspecao?: boolean;

  @IsOptional()
  @IsBoolean()
  exigeParecer?: boolean;
}
```

- [ ] **Step 4: create-modelo-servico.dto.ts**

```typescript
// backend/src/fvs/modelos/dto/create-modelo-servico.dto.ts
import { IsNumber, IsOptional, IsArray, IsInt } from 'class-validator';

export class CreateModeloServicoDto {
  @IsNumber()
  servicoId: number;

  @IsOptional()
  @IsNumber()
  ordem?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  itensExcluidos?: number[];
}
```

- [ ] **Step 5: update-modelo-servico.dto.ts**

```typescript
// backend/src/fvs/modelos/dto/update-modelo-servico.dto.ts
import { IsOptional, IsNumber, IsArray, IsInt } from 'class-validator';

export class UpdateModeloServicoDto {
  @IsOptional()
  @IsNumber()
  ordem?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  itensExcluidos?: number[];
}
```

- [ ] **Step 6: vincular-obras.dto.ts**

```typescript
// backend/src/fvs/modelos/dto/vincular-obras.dto.ts
import { IsArray, IsInt, ArrayNotEmpty } from 'class-validator';

export class VincularObrasDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  obraIds: number[];
}
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/fvs/modelos/dto/
git commit -m "feat(fvs): DTOs Sprint 4a — CreateModeloDto, VincularObrasDto e derivados"
```

---

## Task 4: ModeloService — TDD (CRUD + Lifecycle)

**Files:**
- Create: `backend/src/fvs/modelos/modelo.service.spec.ts` (escrever primeiro)
- Create: `backend/src/fvs/modelos/modelo.service.ts`

- [ ] **Step 1: Escrever testes (arquivo de spec)**

```typescript
// backend/src/fvs/modelos/modelo.service.spec.ts
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ModeloService } from './modelo.service';

const TENANT_ID = 5;
const USER_ID = 42;
const MODELO_ID = 1;

const MODELO_RASCUNHO = {
  id: MODELO_ID, tenant_id: TENANT_ID,
  nome: 'Template Alvenaria', descricao: null, versao: 1,
  escopo: 'empresa', obra_id: null, status: 'rascunho',
  bloqueado: false, regime: 'livre',
  exige_ro: true, exige_reinspecao: true, exige_parecer: true,
  concluido_por: null, concluido_em: null, criado_por: USER_ID, deleted_at: null,
};

const MODELO_CONCLUIDO = { ...MODELO_RASCUNHO, status: 'concluido', concluido_por: USER_ID };
const MODELO_BLOQUEADO = { ...MODELO_CONCLUIDO, bloqueado: true };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService() {
  return new (ModeloService as any)(mockPrisma);
}

describe('ModeloService', () => {
  let svc: ModeloService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createModelo ──────────────────────────────────────────────────────────
  describe('createModelo()', () => {
    it('cria modelo com status=rascunho e criado_por=userId', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      const dto = { nome: 'Template Alvenaria', escopo: 'empresa' as const, regime: 'livre' as const };
      const result = await svc.createModelo(TENANT_ID, USER_ID, dto);
      expect(result.status).toBe('rascunho');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_modelos'),
        TENANT_ID, dto.nome, undefined, 'empresa', null, 'livre',
        true, true, true, USER_ID,
      );
    });

    it('escopo=obra com obraId válido — grava obra_id', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...MODELO_RASCUNHO, escopo: 'obra', obra_id: 99 }]);
      const dto = { nome: 'T', escopo: 'obra' as const, regime: 'livre' as const, obraId: 99 };
      const result = await svc.createModelo(TENANT_ID, USER_ID, dto);
      expect(result.obra_id).toBe(99);
    });
  });

  // ── getModelo ─────────────────────────────────────────────────────────────
  describe('getModelo()', () => {
    it('lança NotFoundException se não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.getModelo(TENANT_ID, 999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna modelo com serviços', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10, modelo_id: MODELO_ID, servico_id: 1, servico_nome: 'Alvenaria', ordem: 0, itens_excluidos: null }]);
      const result = await svc.getModelo(TENANT_ID, MODELO_ID);
      expect(result.servicos).toHaveLength(1);
    });
  });

  // ── concluirModelo ────────────────────────────────────────────────────────
  describe('concluirModelo()', () => {
    it('lança UnprocessableEntityException se não há serviços', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([]); // sem serviços
      await expect(svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID))
        .rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança ConflictException se já concluido', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      await expect(svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('grava concluido_por e concluido_em ao concluir', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10 }])           // 1 serviço
        .mockResolvedValueOnce([MODELO_CONCLUIDO]);    // UPDATE retorno
      const result = await svc.concluirModelo(TENANT_ID, MODELO_ID, USER_ID);
      expect(result.status).toBe('concluido');
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('concluido_por'),
        USER_ID, TENANT_ID, MODELO_ID,
      );
    });
  });

  // ── reabrirModelo ─────────────────────────────────────────────────────────
  describe('reabrirModelo()', () => {
    it('lança ForbiddenException se bloqueado=true', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_BLOQUEADO]);
      await expect(svc.reabrirModelo(TENANT_ID, MODELO_ID))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança ConflictException se status=rascunho', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      await expect(svc.reabrirModelo(TENANT_ID, MODELO_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('reverte para rascunho quando concluido e não bloqueado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_CONCLUIDO])
        .mockResolvedValueOnce([{ ...MODELO_RASCUNHO }]);
      const result = await svc.reabrirModelo(TENANT_ID, MODELO_ID);
      expect(result.status).toBe('rascunho');
    });
  });

  // ── duplicarModelo ────────────────────────────────────────────────────────
  describe('duplicarModelo()', () => {
    it('cria novo modelo com versao+1, status=rascunho, escopo=empresa, criado_por=userId', async () => {
      const servicos = [{ id: 10, servico_id: 1, ordem: 0, itens_excluidos: null }];
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_CONCLUIDO])      // buscar original
        .mockResolvedValueOnce(servicos)                // buscar serviços
        .mockResolvedValueOnce([{ ...MODELO_RASCUNHO, id: 2, versao: 2, nome: 'Template Alvenaria (cópia)' }]); // INSERT

      const result = await svc.duplicarModelo(TENANT_ID, MODELO_ID, USER_ID);
      expect(result.versao).toBe(2);
      expect(result.status).toBe('rascunho');
      expect(result.nome).toContain('(cópia)');
    });
  });

  // ── vincularObras ─────────────────────────────────────────────────────────
  describe('vincularObras()', () => {
    it('lança ConflictException se modelo não está concluido', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_RASCUNHO]);
      await expect(svc.vincularObras(TENANT_ID, MODELO_ID, [10], USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('lança ConflictException se escopo=obra e obraId diferente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { ...MODELO_CONCLUIDO, escopo: 'obra', obra_id: 77 }
      ]);
      await expect(svc.vincularObras(TENANT_ID, MODELO_ID, [99], USER_ID))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('insere em obra_modelo_fvs para cada obraId', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);
      await svc.vincularObras(TENANT_ID, MODELO_ID, [10, 11], USER_ID);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO obra_modelo_fvs'),
        TENANT_ID, 10, MODELO_ID, USER_ID,
      );
    });
  });

  // ── addServicoModelo ──────────────────────────────────────────────────────
  describe('addServicoModelo()', () => {
    it('lança ForbiddenException se modelo está bloqueado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_BLOQUEADO]);
      await expect(svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança ForbiddenException se modelo está concluido (não rascunho)', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([MODELO_CONCLUIDO]);
      await expect(svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 }))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('insere serviço quando modelo em rascunho', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([MODELO_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10 }]); // INSERT retorno
      await svc.addServicoModelo(TENANT_ID, MODELO_ID, { servicoId: 1 });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_modelo_servicos'),
        TENANT_ID, MODELO_ID, 1, 0, null,
      );
    });
  });
});
```

- [ ] **Step 2: Executar testes para confirmar falha**

```bash
cd backend && npx jest modelo.service.spec.ts --no-coverage 2>&1 | tail -20
```

Esperado: falha com `Cannot find module './modelo.service'`

- [ ] **Step 3: Implementar ModeloService**

```typescript
// backend/src/fvs/modelos/modelo.service.ts
import {
  Injectable, NotFoundException, ConflictException,
  ForbiddenException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvsModelo, FvsModeloServico, ObraModeloFvs } from '../types/fvs.types';
import type { CreateModeloDto } from './dto/create-modelo.dto';
import type { UpdateModeloDto } from './dto/update-modelo.dto';
import type { CreateModeloServicoDto } from './dto/create-modelo-servico.dto';
import type { UpdateModeloServicoDto } from './dto/update-modelo-servico.dto';

@Injectable()
export class ModeloService {
  private readonly logger = new Logger(ModeloService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helper ─────────────────────────────────────────────────────────────────

  private async getModeloOuFalhar(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `SELECT * FROM fvs_modelos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      modeloId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Template ${modeloId} não encontrado`);
    return rows[0];
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createModelo(tenantId: number, userId: number, dto: CreateModeloDto): Promise<FvsModelo> {
    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `INSERT INTO fvs_modelos
         (tenant_id, nome, descricao, escopo, obra_id, regime,
          exige_ro, exige_reinspecao, exige_parecer, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      tenantId, dto.nome, dto.descricao ?? null,
      dto.escopo, dto.escopo === 'obra' ? (dto.obraId ?? null) : null,
      dto.regime,
      dto.exigeRo    ?? true,
      dto.exigeReinspecao ?? true,
      dto.exigeParecer    ?? true,
      userId,
    );
    return rows[0];
  }

  async getModelos(
    tenantId: number,
    filters: { escopo?: string; status?: string; bloqueado?: boolean } = {},
  ): Promise<FvsModelo[]> {
    const conditions: string[] = ['tenant_id = $1', 'deleted_at IS NULL'];
    const vals: unknown[] = [tenantId];
    let i = 2;
    if (filters.escopo) { conditions.push(`escopo = $${i++}`); vals.push(filters.escopo); }
    if (filters.status) { conditions.push(`status = $${i++}`); vals.push(filters.status); }
    if (filters.bloqueado !== undefined) { conditions.push(`bloqueado = $${i++}`); vals.push(filters.bloqueado); }

    return this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `SELECT m.*,
              (SELECT COUNT(*) FROM obra_modelo_fvs omf WHERE omf.modelo_id = m.id AND omf.deleted_at IS NULL)::int AS obras_count
       FROM fvs_modelos m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.nome ASC`,
      ...vals,
    );
  }

  async getModelo(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    const servicos = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `SELECT ms.*, s.nome AS servico_nome
       FROM fvs_modelo_servicos ms
       JOIN fvs_catalogo_servicos s ON s.id = ms.servico_id
       WHERE ms.modelo_id = $1 AND ms.tenant_id = $2
       ORDER BY ms.ordem ASC`,
      modeloId, tenantId,
    );
    return { ...modelo, servicos };
  }

  async updateModelo(tenantId: number, modeloId: number, dto: UpdateModeloDto): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado não pode ser editado. Use duplicar.');
    if (modelo.status !== 'rascunho') throw new ConflictException('Apenas templates em rascunho podem ser editados.');

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (dto.nome        !== undefined) { sets.push(`nome = $${i++}`);             vals.push(dto.nome); }
    if (dto.descricao   !== undefined) { sets.push(`descricao = $${i++}`);        vals.push(dto.descricao); }
    if (dto.escopo      !== undefined) { sets.push(`escopo = $${i++}`);           vals.push(dto.escopo); }
    if (dto.obraId      !== undefined) { sets.push(`obra_id = $${i++}`);          vals.push(dto.obraId); }
    if (dto.regime      !== undefined) { sets.push(`regime = $${i++}`);           vals.push(dto.regime); }
    if (dto.exigeRo     !== undefined) { sets.push(`exige_ro = $${i++}`);         vals.push(dto.exigeRo); }
    if (dto.exigeReinspecao !== undefined) { sets.push(`exige_reinspecao = $${i++}`); vals.push(dto.exigeReinspecao); }
    if (dto.exigeParecer    !== undefined) { sets.push(`exige_parecer = $${i++}`);    vals.push(dto.exigeParecer); }

    if (!sets.length) return modelo;

    const idIdx = i++;
    const tenantIdx = i++;
    vals.push(modeloId, tenantId);

    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos SET ${sets.join(', ')} WHERE id = $${idIdx} AND tenant_id = $${tenantIdx} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteModelo(tenantId: number, modeloId: number): Promise<void> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_modelos SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      modeloId, tenantId,
    );
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async concluirModelo(tenantId: number, modeloId: number, userId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.status !== 'rascunho') {
      throw new ConflictException(`Template já está ${modelo.status}`);
    }

    const servicos = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2`,
      modeloId, tenantId,
    );
    if (!servicos.length) {
      throw new UnprocessableEntityException('Template precisa de pelo menos 1 serviço para ser concluído');
    }

    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos
       SET status = 'concluido', concluido_por = $1, concluido_em = NOW()
       WHERE id = $3 AND tenant_id = $2  -- note: $3 is modeloId after tenant_id
       RETURNING *`,
      userId, tenantId, modeloId,
    );
    // Acima tem bug intencional corrigido abaixo — escrever corretamente:
    return rows[0];
  }

  async reabrirModelo(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado (já foi usado em fichas). Use duplicar.');
    if (modelo.status !== 'concluido') throw new ConflictException('Apenas templates concluídos podem ser reabertos');

    const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
      `UPDATE fvs_modelos
       SET status = 'rascunho', concluido_por = NULL, concluido_em = NULL
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      modeloId, tenantId,
    );
    return rows[0];
  }

  async duplicarModelo(tenantId: number, modeloId: number, userId: number): Promise<FvsModelo> {
    return this.prisma.$transaction(async (tx) => {
      const original = await this.getModeloOuFalhar(tenantId, modeloId);
      const servicos = await tx.$queryRawUnsafe<FvsModeloServico[]>(
        `SELECT * FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2`,
        modeloId, tenantId,
      );

      const novoRows = await tx.$queryRawUnsafe<FvsModelo[]>(
        `INSERT INTO fvs_modelos
           (tenant_id, nome, descricao, versao, escopo, obra_id, regime,
            exige_ro, exige_reinspecao, exige_parecer, criado_por)
         VALUES ($1, $2, $3, $4, 'empresa', NULL, $5, $6, $7, $8, $9)
         RETURNING *`,
        tenantId,
        `${original.nome} (cópia)`,
        original.descricao,
        original.versao + 1,
        original.regime,
        original.exige_ro,
        original.exige_reinspecao,
        original.exige_parecer,
        userId,
      );
      const novoModelo = novoRows[0];

      for (const svc of servicos) {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_modelo_servicos (tenant_id, modelo_id, servico_id, ordem, itens_excluidos)
           VALUES ($1, $2, $3, $4, $5)`,
          tenantId, novoModelo.id, svc.servico_id, svc.ordem,
          svc.itens_excluidos ? JSON.stringify(svc.itens_excluidos) : null,
        );
      }

      return novoModelo;
    });
  }

  // ── Vinculação Obra ────────────────────────────────────────────────────────

  async vincularObras(
    tenantId: number,
    modeloId: number,
    obraIds: number[],
    userId: number,
  ): Promise<void> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.status !== 'concluido') {
      throw new ConflictException('Apenas templates concluídos podem ser vinculados a obras');
    }

    if (modelo.escopo === 'obra') {
      const obraIdsInvalidos = obraIds.filter(id => id !== modelo.obra_id);
      if (obraIdsInvalidos.length) {
        throw new ConflictException(
          `Template de escopo 'obra' só pode ser vinculado à obra ${modelo.obra_id}`,
        );
      }
    }

    for (const obraId of obraIds) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO obra_modelo_fvs (tenant_id, obra_id, modelo_id, vinculado_por)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (obra_id, modelo_id) DO UPDATE SET deleted_at = NULL`,
        tenantId, obraId, modeloId, userId,
      );
    }
  }

  async desvincularObra(tenantId: number, modeloId: number, obraId: number): Promise<void> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE obra_modelo_fvs SET deleted_at = NOW()
       WHERE obra_id = $1 AND modelo_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      obraId, modeloId, tenantId,
    );
  }

  async getObrasByModelo(tenantId: number, modeloId: number): Promise<ObraModeloFvs[]> {
    await this.getModeloOuFalhar(tenantId, modeloId);
    return this.prisma.$queryRawUnsafe<ObraModeloFvs[]>(
      `SELECT omf.*, o.nome AS obra_nome
       FROM obra_modelo_fvs omf
       JOIN "Obra" o ON o.id = omf.obra_id
       WHERE omf.modelo_id = $1 AND omf.tenant_id = $2 AND omf.deleted_at IS NULL
       ORDER BY omf.created_at DESC`,
      modeloId, tenantId,
    );
  }

  async getModelosByObra(tenantId: number, obraId: number): Promise<ObraModeloFvs[]> {
    return this.prisma.$queryRawUnsafe<ObraModeloFvs[]>(
      `SELECT omf.*, m.nome AS modelo_nome
       FROM obra_modelo_fvs omf
       JOIN fvs_modelos m ON m.id = omf.modelo_id
       WHERE omf.obra_id = $1 AND omf.tenant_id = $2 AND omf.deleted_at IS NULL
         AND m.status = 'concluido' AND m.deleted_at IS NULL
       ORDER BY m.nome ASC`,
      obraId, tenantId,
    );
  }

  // ── Serviços do template ───────────────────────────────────────────────────

  private async assertModeloEditavel(tenantId: number, modeloId: number): Promise<FvsModelo> {
    const modelo = await this.getModeloOuFalhar(tenantId, modeloId);
    if (modelo.bloqueado) throw new ForbiddenException('Template bloqueado não pode ser editado');
    if (modelo.status !== 'rascunho') throw new ForbiddenException('Apenas templates em rascunho podem ter serviços alterados');
    return modelo;
  }

  async addServicoModelo(
    tenantId: number,
    modeloId: number,
    dto: CreateModeloServicoDto,
  ): Promise<FvsModeloServico> {
    await this.assertModeloEditavel(tenantId, modeloId);
    const rows = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `INSERT INTO fvs_modelo_servicos (tenant_id, modelo_id, servico_id, ordem, itens_excluidos)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      tenantId, modeloId, dto.servicoId, dto.ordem ?? 0,
      dto.itensExcluidos ? JSON.stringify(dto.itensExcluidos) : null,
    );
    return rows[0];
  }

  async updateServicoModelo(
    tenantId: number,
    modeloId: number,
    servicoId: number,
    dto: UpdateModeloServicoDto,
  ): Promise<FvsModeloServico> {
    await this.assertModeloEditavel(tenantId, modeloId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.ordem           !== undefined) { sets.push(`ordem = $${i++}`);           vals.push(dto.ordem); }
    if (dto.itensExcluidos  !== undefined) { sets.push(`itens_excluidos = $${i++}`); vals.push(dto.itensExcluidos ? JSON.stringify(dto.itensExcluidos) : null); }
    if (!sets.length) throw new UnprocessableEntityException('Nada para atualizar');
    const midx = i++; const tidx = i++; const sidx = i++;
    vals.push(modeloId, tenantId, servicoId);
    const rows = await this.prisma.$queryRawUnsafe<FvsModeloServico[]>(
      `UPDATE fvs_modelo_servicos SET ${sets.join(', ')} WHERE modelo_id = $${midx} AND tenant_id = $${tidx} AND servico_id = $${sidx} RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException('Serviço não encontrado no template');
    return rows[0];
  }

  async deleteServicoModelo(tenantId: number, modeloId: number, servicoId: number): Promise<void> {
    await this.assertModeloEditavel(tenantId, modeloId);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2 AND servico_id = $3`,
      modeloId, tenantId, servicoId,
    );
  }

  // ── Usado por InspecaoService.createFicha ─────────────────────────────────

  /**
   * Retorna o template e bloqueia se necessário.
   * Chamado DENTRO de uma $transaction da criação de Ficha.
   * @returns { modelo, servicos }
   */
  async getModeloParaFicha(
    tx: any,
    tenantId: number,
    modeloId: number,
  ): Promise<{ modelo: FvsModelo; servicos: FvsModeloServico[] }> {
    const rows = await tx.$queryRawUnsafe<FvsModelo[]>(
      `SELECT * FROM fvs_modelos WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      modeloId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Template ${modeloId} não encontrado`);
    const modelo = rows[0];
    if (modelo.status !== 'concluido') {
      throw new ConflictException('Apenas templates concluídos podem ser usados para criar Fichas');
    }

    const servicos = await tx.$queryRawUnsafe<FvsModeloServico[]>(
      `SELECT * FROM fvs_modelo_servicos WHERE modelo_id = $1 AND tenant_id = $2 ORDER BY ordem ASC`,
      modeloId, tenantId,
    );

    // Bloquear template se ainda não bloqueado (1ª vez)
    await tx.$executeRawUnsafe(
      `UPDATE fvs_modelos SET bloqueado = true WHERE id = $1 AND tenant_id = $2 AND bloqueado = false`,
      modeloId, tenantId,
    );

    return { modelo, servicos };
  }

  async incrementFichasCount(tx: any, tenantId: number, modeloId: number, obraId: number): Promise<void> {
    await tx.$executeRawUnsafe(
      `UPDATE obra_modelo_fvs SET fichas_count = fichas_count + 1
       WHERE obra_id = $1 AND modelo_id = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      obraId, modeloId, tenantId,
    );
  }
}
```

**Nota importante:** Na implementação de `concluirModelo`, corrigir a query para:
```typescript
const rows = await this.prisma.$queryRawUnsafe<FvsModelo[]>(
  `UPDATE fvs_modelos
   SET status = 'concluido', concluido_por = $1, concluido_em = NOW()
   WHERE id = $2 AND tenant_id = $3
   RETURNING *`,
  userId, modeloId, tenantId,
);
```

- [ ] **Step 4: Executar testes**

```bash
cd backend && npx jest modelo.service.spec.ts --no-coverage 2>&1 | tail -30
```

Esperado: todos os testes passando. Se algum falhar, ajustar a implementação (não o teste).

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/modelos/
git commit -m "feat(fvs): ModeloService — CRUD, lifecycle e vinculação obra (TDD)"
```

---

## Task 5: ModeloController

**Files:**
- Create: `backend/src/fvs/modelos/modelo.controller.ts`

- [ ] **Step 1: Implementar o controlador**

```typescript
// backend/src/fvs/modelos/modelo.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { ModeloService } from './modelo.service';
import { CreateModeloDto } from './dto/create-modelo.dto';
import { UpdateModeloDto } from './dto/update-modelo.dto';
import { CreateModeloServicoDto } from './dto/create-modelo-servico.dto';
import { UpdateModeloServicoDto } from './dto/update-modelo-servico.dto';
import { VincularObrasDto } from './dto/vincular-obras.dto';

interface JwtUser { sub: number; tenantId: number; role: string }

@Controller('api/v1/fvs/modelos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModeloController {
  constructor(private readonly modeloService: ModeloService) {}

  // ─── Templates ────────────────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateModeloDto,
  ) {
    return this.modeloService.createModelo(tenantId, user.sub, dto);
  }

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getModelos(
    @TenantId() tenantId: number,
    @Query('escopo') escopo?: string,
    @Query('status') status?: string,
  ) {
    return this.modeloService.getModelos(tenantId, { escopo, status });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.getModelo(tenantId, id);
  }

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateModelo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateModeloDto,
  ) {
    return this.modeloService.updateModelo(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.deleteModelo(tenantId, id);
  }

  @Post(':id/concluir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  concluirModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modeloService.concluirModelo(tenantId, id, user.sub);
  }

  @Post(':id/reabrir')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reabrirModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.reabrirModelo(tenantId, id);
  }

  @Post(':id/duplicar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  duplicarModelo(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.modeloService.duplicarModelo(tenantId, id, user.sub);
  }

  // ─── Obras vinculadas ao template ─────────────────────────────────────────

  @Get(':id/obras')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getObrasModelo(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.modeloService.getObrasByModelo(tenantId, id);
  }

  @Post(':id/obras')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  vincularObras(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VincularObrasDto,
  ) {
    return this.modeloService.vincularObras(tenantId, id, dto.obraIds, user.sub);
  }

  // ─── Serviços do template ─────────────────────────────────────────────────

  @Post(':id/servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  addServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateModeloServicoDto,
  ) {
    return this.modeloService.addServicoModelo(tenantId, id, dto);
  }

  @Patch(':id/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
    @Body() dto: UpdateModeloServicoDto,
  ) {
    return this.modeloService.updateServicoModelo(tenantId, id, servicoId, dto);
  }

  @Delete(':id/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.modeloService.deleteServicoModelo(tenantId, id, servicoId);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/fvs/modelos/modelo.controller.ts
git commit -m "feat(fvs): ModeloController — endpoints CRUD, lifecycle e serviços do template"
```

---

## Task 6: FvsModule + ObrasController — Registrar ModeloService e rotas de obra

**Files:**
- Modify: `backend/src/fvs/fvs.module.ts`
- Modify: `backend/src/obras/obras.controller.ts`
- Modify: `backend/src/obras/obras.module.ts` (verificar se FvsModule está exportado)

- [ ] **Step 1: Registrar ModeloService e ModeloController no FvsModule**

Em `backend/src/fvs/fvs.module.ts`, adicionar as imports e registros:

```typescript
// Adicionar imports no topo:
import { ModeloService } from './modelos/modelo.service';
import { ModeloController } from './modelos/modelo.controller';

// Dentro de @Module:
providers: [CatalogoService, InspecaoService, RoService, ParecerService, ModeloService],
controllers: [CatalogoController, InspecaoController, RoController, ModeloController],
exports: [CatalogoService, InspecaoService, RoService, ParecerService, ModeloService],
```

- [ ] **Step 2: Verificar se FvsModule está no ObrasModule**

Ler `backend/src/obras/obras.module.ts`. Se FvsModule não estiver nos `imports`, adicionar:

```typescript
import { FvsModule } from '../fvs/fvs.module';
// ...
imports: [PrismaModule, FvsModule],
```

- [ ] **Step 3: Adicionar rotas de modelo em ObrasController**

Em `backend/src/obras/obras.controller.ts`, adicionar:

```typescript
// Adicionar import no topo:
import { ModeloService } from '../fvs/modelos/modelo.service';

// Atualizar construtor:
constructor(
  private readonly obrasService: ObrasService,
  private readonly modeloService: ModeloService,
) {}

// Adicionar endpoints no final da classe:

@Get('obras/:obraId/modelos')
@Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any, 'TECNICO' as any, 'VISITANTE' as any)
getModelosByObra(
  @TenantId() tenantId: number,
  @Param('obraId', ParseIntPipe) obraId: number,
) {
  return this.modeloService.getModelosByObra(tenantId, obraId);
}

@Post('obras/:obraId/modelos')
@Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
@HttpCode(HttpStatus.CREATED)
vincularModeloObra(
  @TenantId() tenantId: number,
  @CurrentUser() user: JwtUser,
  @Param('obraId', ParseIntPipe) obraId: number,
  @Body() dto: { modeloId: number },
) {
  return this.modeloService.vincularObras(tenantId, dto.modeloId, [obraId], user.sub);
}

@Delete('obras/:obraId/modelos/:modeloId')
@Roles('ADMIN_TENANT' as any, 'ENGENHEIRO' as any)
@HttpCode(HttpStatus.NO_CONTENT)
desvincularModeloObra(
  @TenantId() tenantId: number,
  @Param('obraId', ParseIntPipe) obraId: number,
  @Param('modeloId', ParseIntPipe) modeloId: number,
) {
  return this.modeloService.desvincularObra(tenantId, modeloId, obraId);
}
```

Adicionar imports faltantes em obras.controller.ts: `HttpCode, HttpStatus, CurrentUser` se não estiverem.

- [ ] **Step 4: Build para verificar sem erros de compilação**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros. Se houver, corrigir antes de continuar.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/fvs.module.ts backend/src/obras/
git commit -m "feat(fvs): registrar ModeloService no FvsModule e rotas /obras/:obraId/modelos"
```

---

## Task 7: InspecaoService — createFicha com template (TDD)

**Files:**
- Modify: `backend/src/fvs/inspecao/dto/create-ficha.dto.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever os novos testes em inspecao.service.spec.ts**

Adicionar ao final do arquivo, dentro do `describe('InspecaoService')`:

```typescript
  // ── createFicha com modeloId ─────────────────────────────────────────────
  describe('createFicha() com template', () => {
    const MODELO = {
      id: 5, regime: 'pbqph', exige_ro: false, exige_reinspecao: true, exige_parecer: true,
    };
    const SERVICOS_MODELO = [
      { servico_id: 1, ordem: 0, itens_excluidos: null },
      { servico_id: 2, ordem: 1, itens_excluidos: [10] },
    ];

    it('cria ficha com dados do template e pré-popula serviços', async () => {
      const mockModeloService = {
        getModeloParaFicha: jest.fn().mockResolvedValue({ modelo: MODELO, servicos: SERVICOS_MODELO }),
        incrementFichasCount: jest.fn().mockResolvedValue(undefined),
      };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_RASCUNHO, modelo_id: 5, exige_ro: false, regime: 'pbqph' }]) // INSERT ficha
        .mockResolvedValueOnce([{ id: 10 }])  // INSERT fvs_ficha_servicos servico_id=1
        .mockResolvedValueOnce([{ id: 20 }]); // INSERT fvs_ficha_servicos servico_id=2
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      // Precisa de um service com modeloService mockado
      const svcComModelo = new (InspecaoService as any)(mockPrisma, mockGed, mockRoService, mockModeloService);

      const dto = { obraId: 10, nome: 'FVS via template', modeloId: 5, servicos: [] };
      const result = await svcComModelo.createFicha(TENANT_ID, USER_ID, dto, '127.0.0.1');
      expect(result.modelo_id).toBe(5);
      expect(mockModeloService.getModeloParaFicha).toHaveBeenCalledWith(expect.anything(), TENANT_ID, 5);
      expect(mockModeloService.incrementFichasCount).toHaveBeenCalledWith(expect.anything(), TENANT_ID, 5, 10);
    });

    it('createFicha sem modeloId continua funcionando (retrocompatível)', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_RASCUNHO])
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const dto = {
        obraId: 10, nome: 'FVS manual', regime: 'livre' as const,
        servicos: [{ servicoId: 1, localIds: [1] }],
      };
      const result = await svc.createFicha(TENANT_ID, USER_ID, dto, '127.0.0.1');
      expect(result.status).toBe('rascunho');
    });
  });
```

- [ ] **Step 2: Executar para confirmar falha**

```bash
cd backend && npx jest inspecao.service.spec.ts --no-coverage 2>&1 | grep -E "(FAIL|PASS|Error)" | head -10
```

- [ ] **Step 3: Atualizar create-ficha.dto.ts**

```typescript
// backend/src/fvs/inspecao/dto/create-ficha.dto.ts
import {
  IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, IsOptional,
  ValidateNested, ArrayNotEmpty, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class ServicoFichaDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  localIds: number[];

  @IsOptional()
  @IsArray()
  itensExcluidos?: number[];
}

export class CreateFichaDto {
  @IsNumber()
  obraId: number;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsNumber()
  modeloId?: number;

  // Obrigatório apenas quando modeloId não fornecido
  @ValidateIf((o) => !o.modeloId)
  @IsEnum(['pbqph', 'norma_tecnica', 'livre'])
  regime?: 'pbqph' | 'norma_tecnica' | 'livre';

  // Obrigatório apenas quando modeloId não fornecido
  @ValidateIf((o) => !o.modeloId)
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ServicoFichaDto)
  servicos?: ServicoFichaDto[];
}

export type CreateFichaDtoServico = ServicoFichaDto;
```

- [ ] **Step 4: Atualizar createFicha em inspecao.service.ts**

Substituir o método `createFicha` completo:

```typescript
async createFicha(
  tenantId: number,
  userId: number,
  dto: CreateFichaDto,
  ip?: string,
): Promise<FichaFvs> {
  return this.prisma.$transaction(async (tx) => {
    let regime = dto.regime ?? 'livre';
    let exigeRo = true;
    let exigeReinspecao = true;
    let exigeParecer = true;
    let modeloId: number | null = dto.modeloId ?? null;
    let servicosDoTemplate: { servico_id: number; ordem: number; itens_excluidos: number[] | null }[] = [];

    // Se tem template, buscar e bloquear dentro da mesma transaction
    if (dto.modeloId) {
      const { modelo, servicos } = await this.modeloService.getModeloParaFicha(tx, tenantId, dto.modeloId);
      regime = modelo.regime;
      exigeRo = modelo.exige_ro;
      exigeReinspecao = modelo.exige_reinspecao;
      exigeParecer = modelo.exige_parecer;
      servicosDoTemplate = servicos;
    }

    const fichas = await tx.$queryRawUnsafe<FichaFvs[]>(
      `INSERT INTO fvs_fichas (tenant_id, obra_id, nome, regime, status, criado_por, modelo_id, exige_ro, exige_reinspecao, exige_parecer)
       VALUES ($1, $2, $3, $4, 'rascunho', $5, $6, $7, $8, $9)
       RETURNING *`,
      tenantId, dto.obraId, dto.nome, regime, userId, modeloId, exigeRo, exigeReinspecao, exigeParecer,
    );
    const ficha = fichas[0];

    // Serviços do template
    for (const svc of servicosDoTemplate) {
      await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        tenantId, ficha.id, svc.servico_id,
        svc.itens_excluidos ? JSON.stringify(svc.itens_excluidos) : null,
      );
      // Nota: locais não são copiados do template — usuário adiciona manualmente
    }

    // Serviços manuais (sem template)
    if (!dto.modeloId && dto.servicos) {
      for (const svc of dto.servicos) {
        const fichaServicos = await tx.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          tenantId, ficha.id, svc.servicoId,
          svc.itensExcluidos ? JSON.stringify(svc.itensExcluidos) : null,
        );
        const fichaServicoId = fichaServicos[0].id;
        for (const localId of svc.localIds) {
          await tx.$queryRawUnsafe(
            `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id)
             VALUES ($1, $2, $3)`,
            tenantId, fichaServicoId, localId,
          );
        }
      }
    }

    // Incrementar fichas_count na vinculação obra-template
    if (dto.modeloId) {
      await this.modeloService.incrementFichasCount(tx, tenantId, dto.modeloId, dto.obraId);
    }

    if (regime === 'pbqph') {
      await this.gravarAuditLog(tx, {
        tenantId, fichaId: ficha.id, usuarioId: userId,
        acao: 'abertura_ficha', ip,
      });
    }

    return ficha;
  });
}
```

Adicionar `ModeloService` no construtor de `InspecaoService`:

```typescript
import { ModeloService } from '../modelos/modelo.service';

// Atualizar construtor:
constructor(
  private readonly prisma: PrismaService,
  private readonly ged: GedService,
  private readonly roService: RoService,
  private readonly modeloService: ModeloService,
) {}
```

Também atualizar `FvsModule.providers` para garantir ordem correta: `[CatalogoService, ModeloService, InspecaoService, RoService, ParecerService]`.

- [ ] **Step 5: Executar todos os testes**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -15
```

Esperado: todos passando. Ajustar mocks se necessário (o construtor de InspecaoService mudou — atualizar `makeService()` em `inspecao.service.spec.ts` para incluir um mock de ModeloService).

Atualizar `makeService()` no spec existente:

```typescript
const mockModeloService = { getModeloParaFicha: jest.fn(), incrementFichasCount: jest.fn() };

function makeService(): InspecaoService {
  return new (InspecaoService as any)(mockPrisma, mockGed, mockRoService, mockModeloService);
}
```

- [ ] **Step 6: Executar de novo e confirmar**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -5
```

Esperado: `Tests: N passed, N total`

- [ ] **Step 7: Commit**

```bash
git add backend/src/fvs/inspecao/dto/create-ficha.dto.ts \
        backend/src/fvs/inspecao/inspecao.service.ts \
        backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): createFicha com template — pré-popula serviços e bloqueia template atomicamente"
```

---

## Task 8: Workflow Flags — patchFicha + autoCreateRo + patchServicoNc (TDD)

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts`
- Modify: `backend/src/fvs/inspecao/ro.service.ts`
- Modify: `backend/src/fvs/inspecao/ro.service.spec.ts`

- [ ] **Step 1: Escrever testes para patchFicha com flags**

Adicionar ao `describe('patchFicha()')` em `inspecao.service.spec.ts`:

```typescript
    it('concluida→aprovada direto quando exige_parecer=false', async () => {
      const fichaComParecer = { ...FICHA_EM_INSPECAO, status: 'concluida', exige_parecer: false, exige_ro: false };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaComParecer])
        .mockResolvedValueOnce([{ ...fichaComParecer, status: 'aprovada' }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'aprovada' }, '127.0.0.1');
      expect(result.status).toBe('aprovada');
    });

    it('concluida→aprovada lança erro quando exige_parecer=true', async () => {
      const fichaComParecer = { ...FICHA_EM_INSPECAO, status: 'concluida', exige_parecer: true, exige_ro: false };
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([fichaComParecer]);
      await expect(
        svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'aprovada' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('autoCreateRo não é chamado quando exige_ro=false', async () => {
      const ficha = { ...FICHA_EM_INSPECAO, status: 'em_inspecao', exige_ro: false, exige_parecer: true };
      const fichaAtualizada = { ...ficha, status: 'concluida' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ficha])
        .mockResolvedValueOnce([fichaAtualizada]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      // autoCreateRo executa $queryRawUnsafe para buscar NCs; se exige_ro=false, não deve ter sido chamado
      // Verificar: $queryRawUnsafe foi chamado apenas 2x (buscar ficha + UPDATE)
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
```

- [ ] **Step 2: Implementar as mudanças em inspecao.service.ts**

**2a) Atualizar TRANSICOES_VALIDAS:**

```typescript
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  rascunho: ['em_inspecao'],
  em_inspecao: ['concluida', 'rascunho'],
  concluida: ['em_inspecao', 'aguardando_parecer', 'aprovada'], // ← 'aprovada' adicionado
  aguardando_parecer: ['aprovada', 'em_inspecao'],
  aprovada: [],
};
```

**2b) No método `patchFicha`, após a verificação de transição inválida, adicionar validações de flag:**

```typescript
// Após: if (!permitidos.includes(dto.status)) { throw new ConflictException... }

// Regras de exige_parecer:
if (dto.status === 'aguardando_parecer' && !ficha.exige_parecer) {
  throw new UnprocessableEntityException(
    'Esta ficha não exige parecer — use transição direta concluida → aprovada',
  );
}
if (dto.status === 'aprovada' && ficha.status === 'concluida' && ficha.exige_parecer) {
  throw new UnprocessableEntityException(
    'Esta ficha exige parecer — solicite parecer antes de aprovar',
  );
}
```

**2c) Em `autoCreateRo`, adicionar guarda no início:**

```typescript
private async autoCreateRo(tx: any, tenantId: number, fichaId: number, userId: number, regime: string, ip?: string): Promise<void> {
  // Sprint 4a: verificar se ficha exige RO
  const fichaRows = await tx.$queryRawUnsafe<{ exige_ro: boolean }[]>(
    `SELECT exige_ro FROM fvs_fichas WHERE id = $1 AND tenant_id = $2`,
    fichaId, tenantId,
  );
  if (!fichaRows.length || !fichaRows[0].exige_ro) return;

  // ... resto da lógica existente (sem mudanças)
```

**Atenção:** A chamada a `autoCreateRo` na `patchFicha` já passa `ficha.regime`. Não alterar a assinatura.

- [ ] **Step 3: Escrever teste para patchServicoNc em ro.service.spec.ts**

As constantes já existem no arquivo: `RO_ABERTO` (id=1, ficha_id=1), `SERVICO_NC_PENDENTE` (id=1, ro_id=1), `TENANT_ID=5`.
A assinatura do método é: `patchServicoNc(tenantId, fichaId, servicoNcId, dto, userId?, ip?)`.

Adicionar no `describe('patchServicoNc()')`:

```typescript
    it('lança UnprocessableEntityException ao desbloquear quando exige_reinspecao=false', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])                      // ro_ocorrencias WHERE ficha_id
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])            // ro_servicos_nc WHERE id
        .mockResolvedValueOnce([{ exige_reinspecao: false }]);   // fvs_fichas WHERE id (nova query Sprint 4a)
      await expect(
        svc.patchServicoNc(TENANT_ID, RO_ABERTO.ficha_id, SERVICO_NC_PENDENTE.id, { desbloquear: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
```

- [ ] **Step 4: Implementar a verificação em ro.service.ts**

Dentro do bloco `if (dto.desbloquear)` em `patchServicoNc`, adicionar:

```typescript
if (dto.desbloquear) {
  // Sprint 4a: verificar se ficha exige reinspeção
  const fichaRows = await this.prisma.$queryRawUnsafe<{ exige_reinspecao: boolean }[]>(
    `SELECT exige_reinspecao FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    fichaId, tenantId,
  );
  if (!fichaRows.length || !fichaRows[0].exige_reinspecao) {
    throw new UnprocessableEntityException(
      'Esta ficha não exige reinspeção — desbloqueio não permitido',
    );
  }
  // ... resto da lógica de desbloqueio existente
```

- [ ] **Step 5: Executar todos os testes**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -10
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts \
        backend/src/fvs/inspecao/inspecao.service.spec.ts \
        backend/src/fvs/inspecao/ro.service.ts \
        backend/src/fvs/inspecao/ro.service.spec.ts
git commit -m "feat(fvs): workflow flags — exige_ro, exige_reinspecao, exige_parecer respeitados no ciclo"
```

---

## Task 9: Frontend — Tipos e Service Layer

**Files:**
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 1: Adicionar tipos de template em fvs.service.ts**

No final da seção de tipos (antes das funções de serviço), adicionar:

```typescript
// ─── Sprint 4a: Templates ──────────────────────────────────────────────────

export type StatusModelo = 'rascunho' | 'concluido';
export type EscopoModelo = 'empresa' | 'obra';
export type RegimeModelo = 'livre' | 'pbqph';

export interface FvsModelo {
  id: number;
  tenant_id: number;
  nome: string;
  descricao: string | null;
  versao: number;
  escopo: EscopoModelo;
  obra_id: number | null;
  status: StatusModelo;
  bloqueado: boolean;
  regime: RegimeModelo;
  exige_ro: boolean;
  exige_reinspecao: boolean;
  exige_parecer: boolean;
  concluido_por: number | null;
  concluido_em: string | null;
  criado_por: number;
  deleted_at: string | null;
  servicos?: FvsModeloServico[];
  obras_count?: number;
}

export interface FvsModeloServico {
  id: number;
  tenant_id: number;
  modelo_id: number;
  servico_id: number;
  ordem: number;
  itens_excluidos: number[] | null;
  servico_nome?: string;
}

export interface ObraModeloFvs {
  id: number;
  obra_id: number;
  modelo_id: number;
  fichas_count: number;
  created_at: string;
  modelo_nome?: string;
  obra_nome?: string;
}

export interface CreateModeloPayload {
  nome: string;
  descricao?: string;
  escopo: EscopoModelo;
  obraId?: number;
  regime: RegimeModelo;
  exigeRo?: boolean;
  exigeReinspecao?: boolean;
  exigeParecer?: boolean;
}

export interface CreateModeloServicoPayload {
  servicoId: number;
  ordem?: number;
  itensExcluidos?: number[];
}
```

- [ ] **Step 2: Atualizar CreateFichaPayload para incluir modeloId**

Localizar a interface `CreateFichaPayload` (ou onde a função `createFicha` está tipada) e atualizar:

```typescript
export interface CreateFichaPayload {
  obraId: number;
  nome: string;
  modeloId?: number;
  regime?: 'pbqph' | 'norma_tecnica' | 'livre';
  servicos?: { servicoId: number; localIds: number[]; itensExcluidos?: number[] }[];
}
```

- [ ] **Step 3: Adicionar funções de API para modelos no objeto fvsService**

```typescript
// Dentro do objeto fvsService (ou exportações), adicionar:

getModelos: (params?: { escopo?: string; status?: string }) =>
  api.get<FvsModelo[]>('/fvs/modelos', { params }).then(r => r.data),

getModelo: (id: number) =>
  api.get<FvsModelo>(`/fvs/modelos/${id}`).then(r => r.data),

createModelo: (payload: CreateModeloPayload) =>
  api.post<FvsModelo>('/fvs/modelos', payload).then(r => r.data),

updateModelo: (id: number, payload: Partial<CreateModeloPayload>) =>
  api.patch<FvsModelo>(`/fvs/modelos/${id}`, payload).then(r => r.data),

deleteModelo: (id: number) =>
  api.delete(`/fvs/modelos/${id}`),

concluirModelo: (id: number) =>
  api.post<FvsModelo>(`/fvs/modelos/${id}/concluir`).then(r => r.data),

reabrirModelo: (id: number) =>
  api.post<FvsModelo>(`/fvs/modelos/${id}/reabrir`).then(r => r.data),

duplicarModelo: (id: number) =>
  api.post<FvsModelo>(`/fvs/modelos/${id}/duplicar`).then(r => r.data),

addServicoModelo: (modeloId: number, payload: CreateModeloServicoPayload) =>
  api.post<FvsModeloServico>(`/fvs/modelos/${modeloId}/servicos`, payload).then(r => r.data),

updateServicoModelo: (modeloId: number, servicoId: number, payload: { ordem?: number; itensExcluidos?: number[] }) =>
  api.patch<FvsModeloServico>(`/fvs/modelos/${modeloId}/servicos/${servicoId}`, payload).then(r => r.data),

deleteServicoModelo: (modeloId: number, servicoId: number) =>
  api.delete(`/fvs/modelos/${modeloId}/servicos/${servicoId}`),

vincularModeloObras: (modeloId: number, obraIds: number[]) =>
  api.post(`/fvs/modelos/${modeloId}/obras`, { obraIds }),

getModelosByObra: (obraId: number) =>
  api.get<ObraModeloFvs[]>(`/obras/${obraId}/modelos`).then(r => r.data),

desvincularModeloObra: (obraId: number, modeloId: number) =>
  api.delete(`/obras/${obraId}/modelos/${modeloId}`),
```

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs-web): tipos e service layer para templates de inspeção"
```

---

## Task 10: Frontend — Hooks useModelos

**Files:**
- Create: `frontend-web/src/modules/fvs/modelos/hooks/useModelos.ts`

- [ ] **Step 1: Criar diretório e arquivo**

```bash
mkdir -p frontend-web/src/modules/fvs/modelos/hooks
```

- [ ] **Step 2: Implementar o hook**

```typescript
// frontend-web/src/modules/fvs/modelos/hooks/useModelos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type CreateModeloPayload, type CreateModeloServicoPayload } from '../../../../services/fvs.service';

export function useModelos(params?: { escopo?: string; status?: string }) {
  return useQuery({
    queryKey: ['fvs-modelos', params],
    queryFn: () => fvsService.getModelos(params),
  });
}

export function useModelo(id: number) {
  return useQuery({
    queryKey: ['fvs-modelo', id],
    queryFn: () => fvsService.getModelo(id),
    enabled: !!id,
  });
}

export function useCreateModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModeloPayload) => fvsService.createModelo(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useUpdateModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateModeloPayload>) =>
      fvsService.updateModelo(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useDeleteModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useConcluirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.concluirModelo(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useReabrirModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.reabrirModelo(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['fvs-modelos'] });
      qc.invalidateQueries({ queryKey: ['fvs-modelo', id] });
    },
  });
}

export function useDuplicarModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.duplicarModelo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelos'] }),
  });
}

export function useAddServicoModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModeloServicoPayload) => fvsService.addServicoModelo(modeloId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelo', modeloId] }),
  });
}

export function useDeleteServicoModelo(modeloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (servicoId: number) => fvsService.deleteServicoModelo(modeloId, servicoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-modelo', modeloId] }),
  });
}

export function useModelosByObra(obraId: number) {
  return useQuery({
    queryKey: ['obra-modelos', obraId],
    queryFn: () => fvsService.getModelosByObra(obraId),
    enabled: !!obraId,
  });
}

export function useVincularModeloObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, modeloId }: { obraId: number; modeloId: number }) =>
      fvsService.vincularModeloObras(modeloId, [obraId]),
    onSuccess: (_, { obraId }) => qc.invalidateQueries({ queryKey: ['obra-modelos', obraId] }),
  });
}

export function useDesvincularModeloObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ obraId, modeloId }: { obraId: number; modeloId: number }) =>
      fvsService.desvincularModeloObra(obraId, modeloId),
    onSuccess: (_, { obraId }) => qc.invalidateQueries({ queryKey: ['obra-modelos', obraId] }),
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/fvs/modelos/hooks/useModelos.ts
git commit -m "feat(fvs-web): hooks useModelos — query e mutations para templates"
```

---

## Task 11: Frontend — ModelosListPage

**Files:**
- Create: `frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx`

- [ ] **Step 1: Criar o diretório**

```bash
mkdir -p frontend-web/src/modules/fvs/modelos/pages
```

- [ ] **Step 2: Implementar a página**

```tsx
// frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useModelos, useDeleteModelo, useConcluirModelo,
  useReabrirModelo, useDuplicarModelo,
} from '../hooks/useModelos';
import type { FvsModelo } from '../../../../services/fvs.service';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:  { label: 'Rascunho',  color: '#6b7280' },
  concluido: { label: 'Concluído', color: '#22c55e' },
};

const REGIME_LABEL: Record<string, string> = {
  livre:  'Inspeção Interna',
  pbqph:  'PBQP-H',
};

export function ModelosListPage() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<string | undefined>(undefined);
  const { data: modelos = [], isLoading } = useModelos({ status: filtroStatus });
  const deletar = useDeleteModelo();
  const concluir = useConcluirModelo();
  const reabrir = useReabrirModelo();
  const duplicar = useDuplicarModelo();
  const [erro, setErro] = useState('');

  async function handleAcao(acao: 'concluir' | 'reabrir' | 'duplicar' | 'excluir', modelo: FvsModelo) {
    setErro('');
    try {
      if (acao === 'excluir') {
        if (!confirm(`Excluir template "${modelo.nome}"?`)) return;
        await deletar.mutateAsync(modelo.id);
      } else if (acao === 'concluir') {
        await concluir.mutateAsync(modelo.id);
      } else if (acao === 'reabrir') {
        await reabrir.mutateAsync(modelo.id);
      } else if (acao === 'duplicar') {
        const novo = await duplicar.mutateAsync(modelo.id);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? `Erro ao ${acao} template`);
    }
  }

  if (isLoading) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Templates de Inspeção</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={filtroStatus ?? ''}
            onChange={(e) => setFiltroStatus(e.target.value || undefined)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="concluido">Concluído</option>
          </select>
          <button
            onClick={() => navigate('/fvs/modelos/novo')}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
          >
            + Novo Template
          </button>
        </div>
      </div>

      {erro && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{erro}</p>}

      {modelos.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhum template encontrado. Crie o primeiro!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Regime</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Escopo</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Bloqueado</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Versão</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {modelos.map((m) => {
              const st = STATUS_LABEL[m.status] ?? { label: m.status, color: '#6b7280' };
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                    <span
                      onClick={() => navigate(`/fvs/modelos/${m.id}`)}
                      style={{ cursor: 'pointer', color: '#3b82f6' }}
                    >
                      {m.nome}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{REGIME_LABEL[m.regime] ?? m.regime}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{m.escopo}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: st.color + '22', color: st.color,
                      borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                    }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: m.bloqueado ? '#dc2626' : '#22c55e' }}>
                    {m.bloqueado ? 'Sim' : 'Não'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>v{m.versao}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {m.status === 'rascunho' && !m.bloqueado && (
                        <button onClick={() => handleAcao('concluir', m)} style={btnStyle('#22c55e')}>Concluir</button>
                      )}
                      {m.status === 'concluido' && !m.bloqueado && (
                        <button onClick={() => handleAcao('reabrir', m)} style={btnStyle('#f59e0b')}>Reabrir</button>
                      )}
                      <button onClick={() => handleAcao('duplicar', m)} style={btnStyle('#6b7280')}>Duplicar</button>
                      {!m.bloqueado && (
                        <button onClick={() => handleAcao('excluir', m)} style={btnStyle('#dc2626')}>Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: 'transparent', color, border: `1px solid ${color}`,
    borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 12,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/fvs/modelos/pages/ModelosListPage.tsx
git commit -m "feat(fvs-web): ModelosListPage — lista templates com ações de ciclo de vida"
```

---

## Task 12: Frontend — ModeloFormPage e ModeloDetailPage

**Files:**
- Create: `frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx`
- Create: `frontend-web/src/modules/fvs/modelos/pages/ModeloDetailPage.tsx`

- [ ] **Step 1: ModeloFormPage (criação/edição)**

```tsx
// frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateModelo, useUpdateModelo, useModelo } from '../hooks/useModelos';
import type { EscopoModelo, RegimeModelo } from '../../../../services/fvs.service';

export function ModeloFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const modeloId = id ? parseInt(id) : undefined;
  const isEdit = !!modeloId;

  const { data: modeloExistente } = useModelo(modeloId ?? 0);
  const createModelo = useCreateModelo();
  const updateModelo = useUpdateModelo();

  const [nome, setNome] = useState(modeloExistente?.nome ?? '');
  const [descricao, setDescricao] = useState(modeloExistente?.descricao ?? '');
  const [escopo, setEscopo] = useState<EscopoModelo>(modeloExistente?.escopo ?? 'empresa');
  const [regime, setRegime] = useState<RegimeModelo>(modeloExistente?.regime ?? 'livre');
  const [exigeRo, setExigeRo] = useState(modeloExistente?.exige_ro ?? true);
  const [exigeReinspecao, setExigeReinspecao] = useState(modeloExistente?.exige_reinspecao ?? true);
  const [exigeParecer, setExigeParecer] = useState(modeloExistente?.exige_parecer ?? true);
  const [erro, setErro] = useState('');

  // Se pbqph, flags são sempre true (processo obrigatório)
  const isPbqph = regime === 'pbqph';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const payload = {
      nome, descricao: descricao || undefined, escopo, regime,
      exigeRo: isPbqph ? true : exigeRo,
      exigeReinspecao: isPbqph ? true : exigeReinspecao,
      exigeParecer: isPbqph ? true : exigeParecer,
    };
    try {
      if (isEdit) {
        await updateModelo.mutateAsync({ id: modeloId!, ...payload });
        navigate(`/fvs/modelos/${modeloId}`);
      } else {
        const novo = await createModelo.mutateAsync(payload);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar template');
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 };
  const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#374151' };

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ marginTop: 0, fontSize: 20, fontWeight: 600 }}>
        {isEdit ? 'Editar Template' : 'Novo Template de Inspeção'}
      </h1>
      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Nome *</label>
          <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} required maxLength={200} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={descricao} onChange={e => setDescricao(e.target.value)} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Processo / Regime *</label>
          <select style={inputStyle} value={regime} onChange={e => setRegime(e.target.value as RegimeModelo)}>
            <option value="livre">Inspeção Interna (Livre)</option>
            <option value="pbqph">PBQP-H (todas etapas obrigatórias)</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Escopo *</label>
          <select style={inputStyle} value={escopo} onChange={e => setEscopo(e.target.value as EscopoModelo)}>
            <option value="empresa">Empresa (disponível para qualquer obra)</option>
            <option value="obra">Obra específica</option>
          </select>
        </div>

        {!isPbqph && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Etapas do workflow</p>
            {[
              { label: 'Exige Relatório de Ocorrências (RO)', value: exigeRo, set: setExigeRo },
              { label: 'Exige Reinspeção', value: exigeReinspecao, set: setExigeReinspecao },
              { label: 'Exige Parecer de Qualidade', value: exigeParecer, set: setExigeParecer },
            ].map(({ label, value, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        )}

        {isPbqph && (
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            Processo PBQP-H: RO, Reinspeção e Parecer são obrigatórios e não podem ser desativados.
          </p>
        )}

        {erro && <p style={{ color: '#dc2626', fontSize: 13 }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}>
            {isEdit ? 'Salvar' : 'Criar Template'}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: ModeloDetailPage (detalhe com serviços)**

```tsx
// frontend-web/src/modules/fvs/modelos/pages/ModeloDetailPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useModelo, useConcluirModelo, useReabrirModelo, useDuplicarModelo,
  useAddServicoModelo, useDeleteServicoModelo, useModelosByObra,
  useVincularModeloObra, useDesvincularModeloObra,
} from '../hooks/useModelos';
import { useServicos } from '../../catalogo/hooks/useCatalogo';

export function ModeloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const modeloId = parseInt(id!);
  const navigate = useNavigate();

  const { data: modelo, isLoading } = useModelo(modeloId);
  const { data: catalogo = [] } = useServicos();
  const concluir = useConcluirModelo();
  const reabrir = useReabrirModelo();
  const duplicar = useDuplicarModelo();
  const addServico = useAddServicoModelo(modeloId);
  const deleteServico = useDeleteServicoModelo(modeloId);

  const [novoServico, setNovoServico] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  async function handleAddServico() {
    if (!novoServico) return;
    setErro('');
    try {
      await addServico.mutateAsync({ servicoId: novoServico });
      setNovoServico(null);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao adicionar serviço');
    }
  }

  async function handleRemoveServico(servicoId: number) {
    if (!confirm('Remover serviço do template?')) return;
    setErro('');
    try { await deleteServico.mutateAsync(servicoId); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao remover'); }
  }

  async function handleCiclo(acao: 'concluir' | 'reabrir' | 'duplicar') {
    setErro('');
    try {
      if (acao === 'concluir') await concluir.mutateAsync(modeloId);
      else if (acao === 'reabrir') await reabrir.mutateAsync(modeloId);
      else { const n = await duplicar.mutateAsync(modeloId); navigate(`/fvs/modelos/${n.id}`); }
    } catch (e: any) { setErro(e?.response?.data?.message ?? `Erro ao ${acao}`); }
  }

  if (isLoading || !modelo) return <div style={{ padding: 24 }}>Carregando...</div>;

  const editavel = modelo.status === 'rascunho' && !modelo.bloqueado;
  const servicosIds = new Set(modelo.servicos?.map(s => s.servico_id) ?? []);

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>{modelo.nome}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            v{modelo.versao} · {modelo.regime === 'pbqph' ? 'PBQP-H' : 'Inspeção Interna'} · {modelo.escopo}
            {modelo.bloqueado ? ' · 🔒 Bloqueado' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editavel && (
            <button onClick={() => navigate(`/fvs/modelos/${modeloId}/editar`)} style={btn('#3b82f6')}>Editar</button>
          )}
          {modelo.status === 'rascunho' && !modelo.bloqueado && (
            <button onClick={() => handleCiclo('concluir')} style={btn('#22c55e')}>Concluir</button>
          )}
          {modelo.status === 'concluido' && !modelo.bloqueado && (
            <button onClick={() => handleCiclo('reabrir')} style={btn('#f59e0b')}>Reabrir</button>
          )}
          <button onClick={() => handleCiclo('duplicar')} style={btn('#6b7280')}>Duplicar</button>
        </div>
      </div>

      {erro && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

      {/* Flags de workflow */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Exige RO', val: modelo.exige_ro },
          { label: 'Exige Reinspeção', val: modelo.exige_reinspecao },
          { label: 'Exige Parecer', val: modelo.exige_parecer },
        ].map(({ label, val }) => (
          <span key={label} style={{
            background: val ? '#dcfce7' : '#f3f4f6', color: val ? '#15803d' : '#6b7280',
            borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600,
          }}>
            {val ? '✓' : '✗'} {label}
          </span>
        ))}
      </div>

      {/* Serviços do template */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Serviços do Template</h2>

      {editavel && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={novoServico ?? ''}
            onChange={e => setNovoServico(parseInt(e.target.value) || null)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1 }}
          >
            <option value="">Selecionar serviço do catálogo...</option>
            {catalogo.filter(s => !servicosIds.has(s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <button onClick={handleAddServico} disabled={!novoServico} style={btn('#3b82f6')}>+ Adicionar</button>
        </div>
      )}

      {(modelo.servicos?.length ?? 0) === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Nenhum serviço adicionado ainda.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {modelo.servicos!.map((svc, i) => (
            <div key={svc.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderBottom: i < modelo.servicos!.length - 1 ? '1px solid #f3f4f6' : undefined,
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{svc.servico_nome}</p>
                {svc.itens_excluidos?.length ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#f59e0b' }}>
                    {svc.itens_excluidos.length} item(s) excluído(s)
                  </p>
                ) : null}
              </div>
              {editavel && (
                <button onClick={() => handleRemoveServico(svc.servico_id)} style={{ ...btn('#dc2626'), fontSize: 12, padding: '3px 10px' }}>
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: color, color: '#fff', border: 'none',
    borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/fvs/modelos/pages/
git commit -m "feat(fvs-web): ModeloFormPage e ModeloDetailPage — criar, editar e gerenciar serviços do template"
```

---

## Task 13: Frontend — AbrirFichaWizard com seleção de template

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx`

- [ ] **Step 1: Atualizar o wizard para incluir step de seleção de template**

Ler o arquivo atual em `frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx` (já lido acima).

Substituir o arquivo completo com a versão abaixo que adiciona:
- Step 0: seleção opcional de template (usar template OU criar manualmente)
- Se template selecionado: serviços pré-selecionados, step de locais ainda necessário

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateFicha } from '../hooks/useFichas';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
import { useModelosByObra } from '../../modelos/hooks/useModelos';
import type { RegimeFicha } from '../../../../services/fvs.service';

interface StepOneData {
  nome: string;
  obraId: number | null;
  regime: RegimeFicha;
}

interface ServicoComLocais {
  servicoId: number;
  localIds: number[];
}

interface Props {
  obras?: { id: number; nome: string }[];
  locaisPorObra?: Record<number, { id: number; nome: string; pavimento_nome?: string }[]>;
}

export function AbrirFichaWizard({ obras = [], locaisPorObra = {} }: Props) {
  const navigate = useNavigate();
  const createFicha = useCreateFicha();
  const { data: servicos = [] } = useServicos();

  const [step, setStep] = useState(1);
  const [stepOne, setStepOne] = useState<StepOneData>({ nome: '', obraId: null, regime: 'livre' });
  const [modeloId, setModeloId] = useState<number | null>(null);
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoComLocais[]>([]);
  const [error, setError] = useState('');

  const { data: modelosDisponiveis = [] } = useModelosByObra(stepOne.obraId ?? 0);
  const locais = stepOne.obraId ? (locaisPorObra[stepOne.obraId] ?? []) : [];

  function toggleServico(servicoId: number) {
    setServicosSelecionados(prev => {
      const exists = prev.find(s => s.servicoId === servicoId);
      return exists ? prev.filter(s => s.servicoId !== servicoId) : [...prev, { servicoId, localIds: [] }];
    });
  }

  function toggleLocal(servicoId: number, localId: number) {
    setServicosSelecionados(prev =>
      prev.map(s => {
        if (s.servicoId !== servicoId) return s;
        const ids = s.localIds.includes(localId)
          ? s.localIds.filter(id => id !== localId)
          : [...s.localIds, localId];
        return { ...s, localIds: ids };
      }),
    );
  }

  // Quando o usuário seleciona um template, pré-selecionar os serviços dele
  function handleSelecionarModelo(mId: number | null) {
    setModeloId(mId);
    if (!mId) {
      setServicosSelecionados([]);
      return;
    }
    const modelo = modelosDisponiveis.find(m => m.modelo_id === mId);
    // Não temos os serviços do modelo na lista de obra — o usuário ainda configura locais no step 3
    setServicosSelecionados([]);
  }

  async function handleConfirmar() {
    setError('');
    if (!stepOne.obraId) { setError('Obra é obrigatória.'); return; }

    if (modeloId) {
      // Com template: serviços pré-populados pelo backend, locais ainda precisam ser configurados
      // Por simplicidade, criar a ficha e redirecionar para configurar locais na tela de detalhe
      try {
        const ficha = await createFicha.mutateAsync({
          obraId: stepOne.obraId,
          nome: stepOne.nome,
          modeloId,
        });
        navigate(`/fvs/fichas/${ficha.id}`);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
      }
      return;
    }

    // Sem template: fluxo manual existente
    const servicosComLocais = servicosSelecionados.filter(s => s.localIds.length > 0);
    if (!servicosComLocais.length) {
      setError('Selecione ao menos um serviço com um local para inspecionar.');
      return;
    }
    try {
      const ficha = await createFicha.mutateAsync({
        obraId: stepOne.obraId,
        nome: stepOne.nome,
        regime: stepOne.regime,
        servicos: servicosComLocais,
      });
      navigate(`/fvs/fichas/${ficha.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
  };

  // Step 1: Dados básicos + seleção de obra
  if (step === 1) {
    return (
      <div style={{ maxWidth: 500, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Nova Ficha FVS — Dados Básicos</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Nome da Ficha *</label>
          <input style={inputStyle} value={stepOne.nome} onChange={e => setStepOne(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: FVS Bloco A - Alvenaria" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Obra *</label>
          <select style={inputStyle} value={stepOne.obraId ?? ''} onChange={e => setStepOne(p => ({ ...p, obraId: parseInt(e.target.value) || null }))}>
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <button
          onClick={() => { if (!stepOne.nome || !stepOne.obraId) { setError('Nome e Obra são obrigatórios.'); return; } setError(''); setStep(2); }}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}
        >
          Próximo →
        </button>
      </div>
    );
  }

  // Step 2: Selecionar template OU prosseguir manualmente
  if (step === 2) {
    const temModelos = modelosDisponiveis.length > 0;
    return (
      <div style={{ maxWidth: 500, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Usar Template?</h2>
        {temModelos ? (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Há {modelosDisponiveis.length} template(s) vinculado(s) a esta obra. Selecione um ou prossiga sem template.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '2px solid ' + (modeloId === null ? '#3b82f6' : '#e5e7eb'), borderRadius: 8, cursor: 'pointer' }}>
                <input type="radio" checked={modeloId === null} onChange={() => handleSelecionarModelo(null)} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Criar manualmente</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Selecionar serviços e locais individualmente</p>
                </div>
              </label>
              {modelosDisponiveis.map(m => (
                <label key={m.modelo_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '2px solid ' + (modeloId === m.modelo_id ? '#3b82f6' : '#e5e7eb'), borderRadius: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={modeloId === m.modelo_id} onChange={() => handleSelecionarModelo(m.modelo_id)} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.modelo_nome}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                      Criadas nesta obra: {m.fichas_count} fichas
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Nenhum template vinculado a esta obra. A ficha será criada manualmente.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
          <button
            onClick={() => {
              if (modeloId) { handleConfirmar(); } // com template: criar direto
              else setStep(3); // sem template: ir para seleção de serviços
            }}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}
          >
            {modeloId ? 'Criar Ficha com Template' : 'Próximo →'}
          </button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  // Step 3: Seleção manual de serviços e regime (apenas quando sem template)
  if (step === 3) {
    return (
      <div style={{ maxWidth: 600, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Selecionar Serviços e Locais</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Regime</label>
          <select style={inputStyle} value={stepOne.regime} onChange={e => setStepOne(p => ({ ...p, regime: e.target.value as RegimeFicha }))}>
            <option value="livre">Livre</option>
            <option value="pbqph">PBQP-H</option>
            <option value="norma_tecnica">Norma Técnica</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          {servicos.map(svc => {
            const sel = servicosSelecionados.find(s => s.servicoId === svc.id);
            return (
              <div key={svc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: sel ? '#eff6ff' : '#fff' }}>
                  <input type="checkbox" checked={!!sel} onChange={() => toggleServico(svc.id)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{svc.nome}</span>
                </label>
                {sel && locais.length > 0 && (
                  <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Locais para este serviço:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {locais.map(local => (
                        <label key={local.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={sel.localIds.includes(local.id)} onChange={() => toggleLocal(svc.id, local.id)} />
                          {local.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
          <button onClick={handleConfirmar} disabled={createFicha.isPending} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}>
            {createFicha.isPending ? 'Criando...' : 'Criar Ficha'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
git commit -m "feat(fvs-web): AbrirFichaWizard — step de seleção de template (opcional)"
```

---

## Task 14: Frontend — ObraDetalhePage com aba de Templates

**Files:**
- Modify: `frontend-web/src/pages/obras/ObraDetalhePage.tsx`

- [ ] **Step 1: Adicionar aba de templates vinculados à obra**

Ler o arquivo atual (`ObraDetalhePage.tsx`) e adicionar:

1. Import do hook:
```typescript
import { useModelosByObra, useDesvincularModeloObra, useVincularModeloObra } from '../../modules/fvs/modelos/hooks/useModelos';
import { useModelos } from '../../modules/fvs/modelos/hooks/useModelos';
```

2. No componente, adicionar estado para aba ativa e para vincular template:
```typescript
const [abaAtiva, setAbaAtiva] = useState<'locais' | 'templates'>('locais');
const [modeloParaVincular, setModeloParaVincular] = useState<number | null>(null);

const { data: modelosVinculados = [] } = useModelosByObra(obraId);
const { data: todosModelos = [] } = useModelos({ status: 'concluido' });
const vincularModelo = useVincularModeloObra();
const desvincularModelo = useDesvincularModeloObra();
```

3. Renderizar a aba de templates (adicionar após o conteúdo de locais existente):
```tsx
{/* Tabs */}
<div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
  {(['locais', 'templates'] as const).map(aba => (
    <button
      key={aba}
      onClick={() => setAbaAtiva(aba)}
      style={{
        background: 'none', border: 'none', padding: '8px 20px', cursor: 'pointer',
        fontSize: 14, fontWeight: abaAtiva === aba ? 700 : 400,
        color: abaAtiva === aba ? '#3b82f6' : '#6b7280',
        borderBottom: abaAtiva === aba ? '2px solid #3b82f6' : '2px solid transparent',
        marginBottom: -2,
      }}
    >
      {aba === 'locais' ? 'Locais de Inspeção' : 'Templates FVS'}
    </button>
  ))}
</div>

{abaAtiva === 'templates' && (
  <div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <select
        value={modeloParaVincular ?? ''}
        onChange={e => setModeloParaVincular(parseInt(e.target.value) || null)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1 }}
      >
        <option value="">Selecionar template para vincular...</option>
        {todosModelos
          .filter(m => !modelosVinculados.find(mv => mv.modelo_id === m.id))
          .map(m => <option key={m.id} value={m.id}>{m.nome} (v{m.versao})</option>)}
      </select>
      <button
        onClick={async () => {
          if (!modeloParaVincular) return;
          await vincularModelo.mutateAsync({ obraId, modeloId: modeloParaVincular });
          setModeloParaVincular(null);
        }}
        disabled={!modeloParaVincular}
        style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
      >
        Vincular
      </button>
    </div>

    {modelosVinculados.length === 0 ? (
      <p style={{ color: '#6b7280', fontSize: 13 }}>Nenhum template vinculado a esta obra.</p>
    ) : (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        {modelosVinculados.map((mv, i) => (
          <div key={mv.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 16px', borderBottom: i < modelosVinculados.length - 1 ? '1px solid #f3f4f6' : undefined,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{mv.modelo_nome}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                {mv.fichas_count} ficha(s) criada(s) com este template nesta obra
              </p>
            </div>
            <button
              onClick={() => desvincularModelo.mutateAsync({ obraId, modeloId: mv.modelo_id })}
              style={{ background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}
            >
              Desvincular
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Build de verificação**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros. Se houver, corrigir types/imports.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/pages/obras/ObraDetalhePage.tsx
git commit -m "feat(fvs-web): ObraDetalhePage — aba Templates com vincular/desvincular"
```

---

## Task 15: Executar todos os testes e verificar build final

- [ ] **Step 1: Executar suite completa de testes backend**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -15
```

Esperado: todos passando (o número de testes vai ser maior que 99 — Sprint 4a adicionou novos testes).

- [ ] **Step 2: Verificar build TypeScript backend**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 3: Verificar build TypeScript frontend**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros.

- [ ] **Step 4: Commit final de ajustes (se necessário)**

Se houver quaisquer ajustes de tipos ou imports:

```bash
git add -p  # ou git add <arquivos modificados>
git commit -m "fix(fvs): ajustes de tipos e imports Sprint 4a"
```

---

## Checklist de CAs — Verificação Final

Antes de marcar como concluído, verificar cada CA da spec:

| CA | Onde verificar |
|---|---|
| CA-01 | ModeloController: roles ADMIN_TENANT, ENGENHEIRO em POST/PATCH/DELETE |
| CA-02 | ModeloService.vincularObras: checa status='concluido'; createFicha checa também |
| CA-03 | ModeloService.updateModelo: checa bloqueado=true → ForbiddenException |
| CA-04 | ModeloService.getModeloParaFicha: UPDATE bloqueado=true dentro da $transaction |
| CA-05 | ModeloService.getModelos: retorna todos do tenant (sem filtro de obra) |
| CA-06 | ModeloService.vincularObras: escopo='obra' só permite obra_id do template |
| CA-07 | CreateModeloDto: ValidateIf(escopo='obra') obraId obrigatório |
| CA-08 | Constraint SQL: chk_fvs_modelos_obra_escopo |
| CA-09 | ModeloService.concluirModelo: grava concluido_por, concluido_em |
| CA-10 | ModeloService.reabrirModelo: permite se bloqueado=false AND status=concluido |
| CA-11 | ModeloService.deleteModelo: soft-delete; getModelos filtra deleted_at IS NULL |
| CA-12 | UNIQUE(modelo_id, servico_id) em fvs_modelo_servicos |
| CA-13 | ModeloService.assertModeloEditavel: checa bloqueado E status=rascunho |
| CA-14 | ModeloService.vincularObras: checa status='concluido' |
| CA-15 | UNIQUE(obra_id, modelo_id) em obra_modelo_fvs |
| CA-16 | ModeloService.incrementFichasCount: UPDATE fichas_count atomicamente |
| CA-17 | InspecaoService.createFicha: loop sobre servicosDoTemplate → INSERT fvs_ficha_servicos |
| CA-18 | InspecaoService.createFicha: copia regime, exige_ro, exige_reinspecao, exige_parecer |
| CA-19 | InspecaoService.createFicha: INSERT inclui modelo_id |
| CA-20 | InspecaoService.createFicha: sem modeloId usa dto.servicos (caminho antigo) |
| CA-21 | InspecaoService.autoCreateRo: retorna early se exige_ro=false |
| CA-22 | RoService.patchServicoNc: checa exige_reinspecao=false → UnprocessableEntityException |
| CA-23 | TRANSICOES_VALIDAS: 'concluida' inclui 'aprovada'; validação de exige_parecer |

---

## Commit Final

```bash
git log --oneline -12
```

Verificar se todos os commits do Sprint 4a estão presentes, então o Sprint está pronto para review.
