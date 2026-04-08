# FVS Sprint 2 — Abertura e Execução de Inspeção — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o módulo FVS Sprint 2 — criação de Fichas FVS, grade visual serviços×locais, execução de inspeção por local com registro de status, evidências fotográficas e audit log PBQP-H.

**Architecture:** Backend NestJS com `InspecaoService` + `InspecaoController` registrados em `FvsModule` (padrão idêntico ao `CatalogoService`). Raw SQL via `prisma.$queryRawUnsafe` / `prisma.$executeRawUnsafe`. Frontend com hooks TanStack Query v5 por domínio (fichas, grade, registros) e 4 páginas React.

**Tech Stack:** NestJS 11, PostgreSQL, Prisma (raw SQL), React 19, TanStack Query v5, React Router v6, TypeScript, Multer (upload de arquivos).

---

## Contexto obrigatório antes de começar

Leia estes arquivos antes de qualquer implementação:

- `docs/superpowers/specs/2026-04-08-fvs-sprint2-inspecao-design.md` — spec completo
- `backend/src/fvs/catalogo/catalogo.service.ts` — padrão de raw SQL e guards
- `backend/src/fvs/catalogo/catalogo.service.spec.ts` — padrão de testes (mock direto, sem NestJS testing module)
- `backend/src/fvs/catalogo/catalogo.controller.ts` — padrão de decorators e guards
- `backend/src/fvs/types/fvs.types.ts` — tipos existentes
- `backend/src/common/decorators/tenant.decorator.ts` — `@TenantId()` e `@CurrentUser()`
- `frontend-web/src/services/fvs.service.ts` — padrão de serviço frontend
- `frontend-web/src/modules/fvs/catalogo/hooks/useCatalogo.ts` — padrão de hooks

### Regras do projeto (NUNCA violar)

1. **Raw SQL obrigatório** — usar `prisma.$queryRawUnsafe` / `prisma.$executeRawUnsafe`. Nunca usar `prisma.table.findMany()` ou Prisma ORM methods.
2. **Multi-tenant** — todo SELECT/UPDATE/DELETE inclui `tenant_id`. Catálogo sistema: `WHERE tenant_id IN (0, $1)`. Fichas do tenant: `WHERE tenant_id = $1`.
3. **PascalCase com aspas duplas** nas FKs de tabelas existentes: `"Obra"`, `"ObraLocal"`, `"Usuario"`, `"GedVersao"`.
4. **fvs_audit_log** — INSERT ONLY, nunca UPDATE/DELETE. Sem FK (intencional). Só gravar quando `regime = 'pbqph'`.
5. **Testes** — mesmo padrão de `catalogo.service.spec.ts`: mock direto do `prisma`, sem `@nestjs/testing`. Sempre `jest.resetAllMocks()` no `beforeEach`.
6. **Frontend** — hooks em arquivo separado, service em `fvs.service.ts`, TanStack Query v5 (invalidateQueries com `{ queryKey: [...] }`).

---

## Estrutura de Arquivos

### Backend — criar
- `backend/prisma/migrations/20260408000001_fvs_inspecao/migration.sql`
- `backend/src/fvs/inspecao/dto/create-ficha.dto.ts`
- `backend/src/fvs/inspecao/dto/update-ficha.dto.ts`
- `backend/src/fvs/inspecao/dto/put-registro.dto.ts`
- `backend/src/fvs/inspecao/dto/update-local.dto.ts`
- `backend/src/fvs/inspecao/inspecao.service.ts`
- `backend/src/fvs/inspecao/inspecao.service.spec.ts`
- `backend/src/fvs/inspecao/inspecao.controller.ts`

### Backend — modificar
- `backend/src/fvs/types/fvs.types.ts` — adicionar tipos FichaFvs, FvsGrade, FvsRegistro, etc.
- `backend/src/fvs/fvs.module.ts` — registrar InspecaoService + InspecaoController + importar GedModule

### Frontend — criar
- `frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts`
- `frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts`
- `frontend-web/src/modules/fvs/inspecao/hooks/useRegistros.ts`
- `frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx`
- `frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx`
- `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`
- `frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx`
- `frontend-web/src/modules/fvs/inspecao/components/FotosModal.tsx`
- `frontend-web/src/modules/fvs/inspecao/components/RegistroNcModal.tsx`

### Frontend — modificar
- `frontend-web/src/services/fvs.service.ts` — adicionar types e métodos de inspeção
- `frontend-web/src/App.tsx` — adicionar rotas FVS inspeção

---

## Task 1: SQL Migration — 6 tabelas FVS inspeção

**Files:**
- Create: `backend/prisma/migrations/20260408000001_fvs_inspecao/migration.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- =============================================================================
-- Eldox v3 — Migration: FVS Inspeção (Sprint 2)
-- Data: 2026-04-08
-- Spec: docs/superpowers/specs/2026-04-08-fvs-sprint2-inspecao-design.md
-- Aplicar com: psql $DATABASE_URL -f migration.sql
-- =============================================================================

-- 1. Ficha FVS — documento principal auditável
CREATE TABLE IF NOT EXISTS fvs_fichas (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id),
  nome          VARCHAR(200) NOT NULL,
  regime        VARCHAR(20) NOT NULL DEFAULT 'livre',
  status        VARCHAR(20) NOT NULL DEFAULT 'rascunho',
  criado_por    INT NOT NULL REFERENCES "Usuario"(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_fvs_fichas_tenant_obra   ON fvs_fichas(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_fvs_fichas_tenant_status ON fvs_fichas(tenant_id, status);

-- 2. Serviços vinculados à ficha
CREATE TABLE IF NOT EXISTS fvs_ficha_servicos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  ficha_id        INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE CASCADE,
  servico_id      INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  itens_excluidos INT[] NULL,
  ordem           INT NOT NULL DEFAULT 0,
  UNIQUE(ficha_id, servico_id)
);
CREATE INDEX IF NOT EXISTS idx_fvs_ficha_servicos_tenant ON fvs_ficha_servicos(tenant_id);

-- 3. Locais vinculados a cada serviço na ficha
CREATE TABLE IF NOT EXISTS fvs_ficha_servico_locais (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_servico_id    INT NOT NULL REFERENCES fvs_ficha_servicos(id) ON DELETE CASCADE,
  obra_local_id       INT NOT NULL REFERENCES "ObraLocal"(id),
  equipe_responsavel  VARCHAR(200) NULL,
  UNIQUE(ficha_servico_id, obra_local_id)
);
CREATE INDEX IF NOT EXISTS idx_fvs_ficha_servico_locais_tenant ON fvs_ficha_servico_locais(tenant_id);

-- 4. Registros de inspeção — cada célula (item × local)
CREATE TABLE IF NOT EXISTS fvs_registros (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id),
  servico_id        INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  item_id           INT NOT NULL REFERENCES fvs_catalogo_itens(id),
  obra_local_id     INT NOT NULL REFERENCES "ObraLocal"(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'nao_avaliado',
  observacao        TEXT NULL,
  inspecionado_por  INT NULL REFERENCES "Usuario"(id),
  inspecionado_em   TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ficha_id, item_id, obra_local_id)
);
CREATE INDEX IF NOT EXISTS idx_fvs_registros_tenant_ficha_servico ON fvs_registros(tenant_id, ficha_id, servico_id);
CREATE INDEX IF NOT EXISTS idx_fvs_registros_tenant_ficha_local   ON fvs_registros(tenant_id, ficha_id, obra_local_id);

-- 5. Evidências fotográficas (fotos via GED)
CREATE TABLE IF NOT EXISTS fvs_evidencias (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  registro_id     INT NOT NULL REFERENCES fvs_registros(id) ON DELETE CASCADE,
  ged_versao_id   INT NOT NULL REFERENCES "GedVersao"(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvs_evidencias_tenant   ON fvs_evidencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvs_evidencias_registro ON fvs_evidencias(registro_id);

-- 6. Audit log imutável (INSERT ONLY — sem FK intencional)
CREATE TABLE IF NOT EXISTS fvs_audit_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  ficha_id    INT NOT NULL,
  registro_id INT NULL,
  acao        VARCHAR(30) NOT NULL,
  status_de   VARCHAR(20) NULL,
  status_para VARCHAR(20) NULL,
  usuario_id  INT NOT NULL,
  ip_origem   INET NULL,
  detalhes    JSONB NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvs_audit_log_tenant_ficha  ON fvs_audit_log(tenant_id, ficha_id);
CREATE INDEX IF NOT EXISTS idx_fvs_audit_log_tenant_criado ON fvs_audit_log(tenant_id, criado_em DESC);
```

- [ ] **Step 2: Aplicar migration no banco de desenvolvimento**

```bash
cd /caminho/para/o/projeto
psql $DATABASE_URL -f backend/prisma/migrations/20260408000001_fvs_inspecao/migration.sql
```

Esperado: `CREATE TABLE` × 6, `CREATE INDEX` × 10, sem erros.

- [ ] **Step 3: Verificar tabelas criadas**

```bash
psql $DATABASE_URL -c "\dt fvs_*"
```

Esperado: listar `fvs_audit_log`, `fvs_evidencias`, `fvs_ficha_servico_locais`, `fvs_ficha_servicos`, `fvs_fichas`, `fvs_registros` (além das Sprint 1).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260408000001_fvs_inspecao/migration.sql
git commit -m "chore(db): migration FVS Sprint 2 — 6 tabelas de inspeção"
```

---

## Task 2: Backend types e DTOs

**Files:**
- Modify: `backend/src/fvs/types/fvs.types.ts`
- Create: `backend/src/fvs/inspecao/dto/create-ficha.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/update-ficha.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/put-registro.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/update-local.dto.ts`

- [ ] **Step 1: Adicionar tipos em `backend/src/fvs/types/fvs.types.ts`**

Adicionar ao final do arquivo existente (manter os tipos do Sprint 1 intactos):

```typescript
// ─── Sprint 2: Inspeção ──────────────────────────────────────────────────────

export type RegimeFicha = 'pbqph' | 'norma_tecnica' | 'livre';
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';

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
}

export interface FichaFvsComProgresso extends FichaFvs {
  progresso: number; // 0-100, percentual de itens avaliados (não nao_avaliado)
}

export interface FichaServico {
  id: number;
  tenant_id: number;
  ficha_id: number;
  servico_id: number;
  itens_excluidos: number[] | null;
  ordem: number;
  // joined
  servico_nome?: string;
  locais?: FichaServicoLocal[];
}

export interface FichaServicoLocal {
  id: number;
  tenant_id: number;
  ficha_servico_id: number;
  obra_local_id: number;
  equipe_responsavel: string | null;
  // joined
  local_nome?: string;
}

export interface FvsRegistro {
  id: number;
  tenant_id: number;
  ficha_id: number;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: Date | null;
  created_at: Date;
  updated_at: Date;
  // joined (na listagem de registros por local)
  item_descricao?: string;
  item_criticidade?: string;
  item_criterio_aceite?: string | null;
  evidencias_count?: number;
  equipe_responsavel?: string | null;
}

export interface FvsGrade {
  servicos: { id: number; nome: string }[];
  locais: { id: number; nome: string; pavimento_id: number | null }[];
  celulas: Record<number, Record<number, StatusGrade>>; // celulas[servicoId][obraLocalId]
}

export interface FvsEvidencia {
  id: number;
  tenant_id: number;
  registro_id: number;
  ged_versao_id: number;
  created_at: Date;
  // joined
  url?: string;
  nome_original?: string;
}

export interface FichaDetalhada extends FichaFvs {
  servicos: (FichaServico & { locais: FichaServicoLocal[] })[];
  progresso: number;
}
```

- [ ] **Step 2: Criar `backend/src/fvs/inspecao/dto/create-ficha.dto.ts`**

```typescript
import { IsString, IsNotEmpty, IsEnum, IsNumber, IsArray, IsOptional, ValidateNested, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

class ServicoFichaDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayNotEmpty()
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

  @IsEnum(['pbqph', 'norma_tecnica', 'livre'])
  regime: 'pbqph' | 'norma_tecnica' | 'livre';

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ServicoFichaDto)
  servicos: ServicoFichaDto[];
}

export type CreateFichaDtoServico = ServicoFichaDto;
```

- [ ] **Step 3: Criar `backend/src/fvs/inspecao/dto/update-ficha.dto.ts`**

```typescript
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateFichaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsEnum(['rascunho', 'em_inspecao', 'concluida'])
  status?: 'rascunho' | 'em_inspecao' | 'concluida';
}
```

- [ ] **Step 4: Criar `backend/src/fvs/inspecao/dto/put-registro.dto.ts`**

```typescript
import { IsNumber, IsEnum, IsOptional, IsString } from 'class-validator';

export class PutRegistroDto {
  @IsNumber()
  servicoId: number;

  @IsNumber()
  itemId: number;

  @IsNumber()
  localId: number;

  @IsEnum(['nao_avaliado', 'conforme', 'nao_conforme', 'excecao'])
  status: 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';

  @IsOptional()
  @IsString()
  observacao?: string;
}
```

- [ ] **Step 5: Criar `backend/src/fvs/inspecao/dto/update-local.dto.ts`**

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLocalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  equipeResponsavel?: string | null;
}
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/types/fvs.types.ts backend/src/fvs/inspecao/dto/
git commit -m "feat(fvs): tipos Sprint 2 e DTOs de inspeção"
```

---

## Task 3: InspecaoService — Fichas CRUD + testes

**Files:**
- Create: `backend/src/fvs/inspecao/inspecao.service.ts` (parte 1 — Fichas)
- Create: `backend/src/fvs/inspecao/inspecao.service.spec.ts` (parte 1)

- [ ] **Step 1: Escrever os testes de Fichas CRUD (falham primeiro)**

Criar `backend/src/fvs/inspecao/inspecao.service.spec.ts`:

```typescript
// backend/src/fvs/inspecao/inspecao.service.spec.ts
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InspecaoService } from './inspecao.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_RASCUNHO = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'rascunho', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

const FICHA_EM_INSPECAO = { ...FICHA_RASCUNHO, status: 'em_inspecao' };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockGed = {
  upload: jest.fn(),
};

function makeService(): InspecaoService {
  return new (InspecaoService as any)(mockPrisma, mockGed);
}

describe('InspecaoService', () => {
  let svc: InspecaoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── createFicha ─────────────────────────────────────────────────────────────
  describe('createFicha()', () => {
    it('cria ficha com rascunho e grava audit_log quando regime=pbqph', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      // ficha insert
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_RASCUNHO])       // INSERT fvs_fichas
        .mockResolvedValueOnce([{ id: 10 }])            // INSERT fvs_ficha_servicos
        .mockResolvedValueOnce([{ id: 20 }]);           // INSERT fvs_ficha_servico_locais (localId 1)
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const dto = {
        obraId: 10, nome: 'FVS Torre 1', regime: 'pbqph' as const,
        servicos: [{ servicoId: 1, localIds: [1], itensExcluidos: undefined }],
      };
      const result = await svc.createFicha(TENANT_ID, USER_ID, dto, '127.0.0.1');

      expect(result.status).toBe('rascunho');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'),
        expect.anything(), expect.anything(), expect.anything(),
        'abertura_ficha', expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      );
    });

    it('NÃO grava audit_log quando regime=livre', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_RASCUNHO, regime: 'livre' }])
        .mockResolvedValueOnce([{ id: 10 }])
        .mockResolvedValueOnce([{ id: 20 }]);

      await svc.createFicha(TENANT_ID, USER_ID, {
        obraId: 10, nome: 'FVS Torre 1', regime: 'livre',
        servicos: [{ servicoId: 1, localIds: [1] }],
      }, '127.0.0.1');

      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });

  // ── patchFicha ──────────────────────────────────────────────────────────────
  describe('patchFicha()', () => {
    it('lança NotFoundException se ficha não existe no tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.patchFicha(TENANT_ID, 999, USER_ID, { status: 'em_inspecao' }, '127.0.0.1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('transição rascunho→em_inspecao válida', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_RASCUNHO])             // buscar ficha
        .mockResolvedValueOnce([FICHA_EM_INSPECAO]);         // UPDATE retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'em_inspecao' }, '127.0.0.1');
      expect(result.status).toBe('em_inspecao');
    });

    it('transição inválida lança ConflictException', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_RASCUNHO]); // status=rascunho
      await expect(
        svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1'), // rascunho→concluida = inválido
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('DELETE retorna 409 se status ≠ rascunho', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_EM_INSPECAO]);
      await expect(svc.deleteFicha(TENANT_ID, 1)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
```

- [ ] **Step 2: Confirmar que os testes falham**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage 2>&1 | tail -20
```

Esperado: `FAIL` com `Cannot find module './inspecao.service'`.

- [ ] **Step 3: Criar `backend/src/fvs/inspecao/inspecao.service.ts` (métodos de Fichas)**

```typescript
// backend/src/fvs/inspecao/inspecao.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';
import type {
  FichaFvs, FichaFvsComProgresso, FichaDetalhada, FvsGrade,
  FvsRegistro, FvsEvidencia, StatusFicha, StatusGrade,
} from '../types/fvs.types';
import type { CreateFichaDto } from './dto/create-ficha.dto';
import type { UpdateFichaDto } from './dto/update-ficha.dto';
import type { PutRegistroDto } from './dto/put-registro.dto';
import type { UpdateLocalDto } from './dto/update-local.dto';

// Transições de status válidas: de → [destinos permitidos]
const TRANSICOES_VALIDAS: Record<StatusFicha, StatusFicha[]> = {
  rascunho: ['em_inspecao'],
  em_inspecao: ['concluida', 'rascunho'],
  concluida: ['em_inspecao'],
};

@Injectable()
export class InspecaoService {
  private readonly logger = new Logger(InspecaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
  ) {}

  // ── Helper: buscar ficha com validação de tenant ────────────────────────────

  private async getFichaOuFalhar(tenantId: number, fichaId: number): Promise<FichaFvs> {
    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    return rows[0];
  }

  // ── Helper: audit_log (INSERT ONLY) ────────────────────────────────────────

  private async gravarAuditLog(
    tx: any,
    params: {
      tenantId: number; fichaId: number; usuarioId: number;
      acao: string; statusDe?: string; statusPara?: string;
      registroId?: number; ip?: string; detalhes?: object;
    },
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO fvs_audit_log
         (tenant_id, ficha_id, registro_id, acao, status_de, status_para, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9::jsonb, NOW())`,
      params.tenantId, params.fichaId, params.registroId ?? null,
      params.acao, params.statusDe ?? null, params.statusPara ?? null,
      params.usuarioId, params.ip ?? null,
      params.detalhes ? JSON.stringify(params.detalhes) : null,
    );
  }

  // ── createFicha ─────────────────────────────────────────────────────────────

  async createFicha(
    tenantId: number,
    userId: number,
    dto: CreateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Inserir a ficha
      const fichas = await tx.$queryRawUnsafe<FichaFvs[]>(
        `INSERT INTO fvs_fichas (tenant_id, obra_id, nome, regime, status, criado_por)
         VALUES ($1, $2, $3, $4, 'rascunho', $5)
         RETURNING *`,
        tenantId, dto.obraId, dto.nome, dto.regime, userId,
      );
      const ficha = fichas[0];

      // 2. Inserir serviços + locais
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

      // 3. Audit log se pbqph
      if (dto.regime === 'pbqph') {
        await this.gravarAuditLog(tx, {
          tenantId, fichaId: ficha.id, usuarioId: userId,
          acao: 'abertura_ficha', ip,
        });
      }

      return ficha;
    });
  }

  // ── getFichas ───────────────────────────────────────────────────────────────

  async getFichas(
    tenantId: number,
    obraId?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: FichaFvsComProgresso[]; total: number; page: number }> {
    const offset = (page - 1) * limit;
    const whereExtra = obraId ? `AND f.obra_id = ${obraId}` : '';

    const rows = await this.prisma.$queryRawUnsafe<(FichaFvsComProgresso & { total_count: string })[]>(
      `SELECT f.*,
              COUNT(*)          OVER()                                             AS total_count,
              COALESCE(
                ROUND(
                  100.0 * COUNT(r.id) FILTER (WHERE r.status <> 'nao_avaliado') /
                  NULLIF(COUNT(r.id), 0)
                )::int, 0
              )                                                                   AS progresso
       FROM fvs_fichas f
       LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
       WHERE f.tenant_id = $1 AND f.deleted_at IS NULL ${whereExtra}
       GROUP BY f.id
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      tenantId, limit, offset,
    );

    const total = rows.length ? Number(rows[0].total_count) : 0;
    return { data: rows, total, page };
  }

  // ── getFicha (detalhada) ────────────────────────────────────────────────────

  async getFicha(tenantId: number, fichaId: number): Promise<FichaDetalhada> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    const servicos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT fs.*, s.nome AS servico_nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2
       ORDER BY fs.ordem ASC`,
      fichaId, tenantId,
    );

    for (const srv of servicos) {
      srv.locais = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT fsl.*, ol.nome AS local_nome
         FROM fvs_ficha_servico_locais fsl
         JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
         WHERE fsl.ficha_servico_id = $1 AND fsl.tenant_id = $2`,
        srv.id, tenantId,
      );
    }

    // progresso geral
    const prog = await this.prisma.$queryRawUnsafe<{ progresso: number }[]>(
      `SELECT COALESCE(
         ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'nao_avaliado') / NULLIF(COUNT(*), 0))::int, 0
       ) AS progresso
       FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );

    return { ...ficha, servicos, progresso: prog[0].progresso };
  }

  // ── patchFicha ──────────────────────────────────────────────────────────────

  async patchFicha(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: UpdateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    // Validar transição de status
    if (dto.status && dto.status !== ficha.status) {
      const permitidos = TRANSICOES_VALIDAS[ficha.status as StatusFicha] ?? [];
      if (!permitidos.includes(dto.status as StatusFicha)) {
        throw new ConflictException(
          `Transição de status inválida: ${ficha.status} → ${dto.status}`,
        );
      }

      // Validação extra ao concluir em regime pbqph
      if (dto.status === 'concluida' && ficha.regime === 'pbqph') {
        await this.validarConclusaoPbqph(tenantId, fichaId);
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome   !== undefined) { sets.push(`nome = $${i++}`);   vals.push(dto.nome); }
    if (dto.status !== undefined) { sets.push(`status = $${i++}`); vals.push(dto.status); }
    sets.push(`updated_at = NOW()`);
    vals.push(fichaId);
    vals.push(tenantId);

    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `UPDATE fvs_fichas SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );

    // Audit log de mudança de status (pbqph)
    if (dto.status && dto.status !== ficha.status && ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId, usuarioId: userId,
        acao: 'alteracao_status', statusDe: ficha.status, statusPara: dto.status, ip,
      });
    }

    return rows[0];
  }

  // ── deleteFicha ─────────────────────────────────────────────────────────────

  async deleteFicha(tenantId: number, fichaId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Só é possível excluir fichas com status rascunho');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_fichas SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
  }

  // ── validarConclusaoPbqph ──────────────────────────────────────────────────

  private async validarConclusaoPbqph(tenantId: number, fichaId: number): Promise<void> {
    // Itens críticos NC sem evidência
    const pendentes = await this.prisma.$queryRawUnsafe<{ item_id: number; descricao: string }[]>(
      `SELECT r.item_id, i.descricao
       FROM fvs_registros r
       JOIN fvs_catalogo_itens i ON i.id = r.item_id
       WHERE r.ficha_id = $1 AND r.tenant_id = $2
         AND r.status = 'nao_conforme'
         AND i.criticidade = 'critico'
         AND NOT EXISTS (
           SELECT 1 FROM fvs_evidencias e WHERE e.registro_id = r.id AND e.tenant_id = r.tenant_id
         )`,
      fichaId, tenantId,
    );

    if (pendentes.length) {
      throw new UnprocessableEntityException({
        message: 'Itens críticos NC sem evidência fotográfica',
        itensPendentes: pendentes,
      });
    }
  }

  // ─── Grade, Registros, Evidências, Local — continuação nas Tasks 4, 5, 6 ───
}
```

- [ ] **Step 4: Executar os testes**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage 2>&1 | tail -20
```

Esperado: todos os testes do describe `createFicha` e `patchFicha` PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/
git commit -m "feat(fvs): InspecaoService — Fichas CRUD com audit log"
```

---

## Task 4: InspecaoService — Grade (agregação server-side)

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts` (adicionar métodos de grade)
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts` (adicionar testes de grade)

- [ ] **Step 1: Adicionar testes de grade no spec**

Adicionar ao `inspecao.service.spec.ts`, após o último describe:

```typescript
  // ── getGrade ────────────────────────────────────────────────────────────────
  describe('getGrade()', () => {
    it('retorna grade com células agregadas por 4 estados', async () => {
      // ficha existe
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])   // getFichaOuFalhar
        // serviços
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        // locais
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }, { id: 11, nome: 'Ap 102', pavimento_id: 1 }])
        // registros raw
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'nao_conforme' },   // NC
          { servico_id: 1, obra_local_id: 11, status: 'conforme' },        // conforme
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nc');
      expect(result.celulas[1][11]).toBe('aprovado');
    });

    it('célula sem registros = nao_avaliado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([]); // sem registros

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('nao_avaliado');
    });

    it('mix de conforme e nao_avaliado (sem NC) = pendente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        .mockResolvedValueOnce([
          { servico_id: 1, obra_local_id: 10, status: 'conforme' },
          { servico_id: 1, obra_local_id: 10, status: 'nao_avaliado' },
        ]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('pendente');
    });
  });
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage -t "getGrade" 2>&1 | tail -10
```

Esperado: `FAIL` com `svc.getGrade is not a function`.

- [ ] **Step 3: Adicionar `getGrade` no service**

Adicionar após `validarConclusaoPbqph` em `inspecao.service.ts`:

```typescript
  // ── getGrade ─────────────────────────────────────────────────────────────────

  async getGrade(
    tenantId: number,
    fichaId: number,
    filtros?: { pavimentoId?: number; servicoId?: number },
  ): Promise<FvsGrade> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    const servicoWhere = filtros?.servicoId
      ? `AND fs.servico_id = ${filtros.servicoId}`
      : '';

    const servicos = await this.prisma.$queryRawUnsafe<{ id: number; nome: string }[]>(
      `SELECT s.id, s.nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2 ${servicoWhere}
       ORDER BY fs.ordem ASC`,
      fichaId, tenantId,
    );

    const pavimentoWhere = filtros?.pavimentoId
      ? `AND ol.pavimento_id = ${filtros.pavimentoId}`
      : '';

    const locais = await this.prisma.$queryRawUnsafe<{ id: number; nome: string; pavimento_id: number | null }[]>(
      `SELECT DISTINCT ol.id, ol.nome, ol.pavimento_id
       FROM fvs_ficha_servico_locais fsl
       JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
       JOIN fvs_ficha_servicos fs ON fs.id = fsl.ficha_servico_id
       WHERE fs.ficha_id = $1 AND fsl.tenant_id = $2 ${pavimentoWhere}
       ORDER BY ol.nome ASC`,
      fichaId, tenantId,
    );

    // Buscar todos os registros da ficha para calcular agregação
    const registros = await this.prisma.$queryRawUnsafe<{ servico_id: number; obra_local_id: number; status: string }[]>(
      `SELECT servico_id, obra_local_id, status
       FROM fvs_registros
       WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );

    // Algoritmo de agregação: NC > Aprovado > Não avaliado > Pendente
    const celulas: Record<number, Record<number, StatusGrade>> = {};
    for (const srv of servicos) {
      celulas[srv.id] = {};
      for (const loc of locais) {
        const celReg = registros.filter(r => r.servico_id === srv.id && r.obra_local_id === loc.id);
        celulas[srv.id][loc.id] = this.calcularStatusCelula(celReg.map(r => r.status));
      }
    }

    return { servicos, locais, celulas };
  }

  private calcularStatusCelula(statuses: string[]): StatusGrade {
    if (!statuses.length) return 'nao_avaliado';
    if (statuses.some(s => s === 'nao_conforme'))                              return 'nc';
    if (statuses.every(s => s === 'conforme' || s === 'excecao'))              return 'aprovado';
    if (statuses.every(s => s === 'nao_avaliado'))                             return 'nao_avaliado';
    return 'pendente';
  }
```

- [ ] **Step 4: Executar testes de grade**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage -t "getGrade" 2>&1 | tail -10
```

Esperado: `PASS` em todos os 3 testes de `getGrade`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): InspecaoService — grade com algoritmo de agregação 4 estados"
```

---

## Task 5: InspecaoService — Registros (PUT upsert + validação mode-aware)

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts` (adicionar getRegistros + putRegistro)
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts` (adicionar testes)

- [ ] **Step 1: Adicionar testes de registros**

Adicionar ao `inspecao.service.spec.ts`:

```typescript
  // ── putRegistro ──────────────────────────────────────────────────────────────
  describe('putRegistro()', () => {
    it('retorna 409 se ficha não está em_inspecao', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_RASCUNHO]);
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'conforme' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('regime=pbqph, status=nao_conforme sem observacao → 422', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_EM_INSPECAO]);
      await expect(
        svc.putRegistro(TENANT_ID, 1, USER_ID, { servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme' }, '127.0.0.1'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('regime=pbqph, status=nao_conforme COM observacao → salva sem bloqueio', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])             // getFichaOuFalhar
        .mockResolvedValueOnce([{ criticidade: 'critico' }])    // buscar item
        .mockResolvedValueOnce([{ id: 5, status: 'nao_conforme' }]); // upsert retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme', observacao: 'Desvio observado',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_audit_log'), expect.anything(), expect.anything(), expect.anything(), 'inspecao', expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      );
    });

    it('regime=livre, status=nao_conforme sem observacao → salva (sem validação)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, regime: 'livre' }])
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 5, status: 'nao_conforme' }]);

      const result = await svc.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'nao_conforme',
      }, '127.0.0.1');

      expect(result.status).toBe('nao_conforme');
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Confirmar falha**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage -t "putRegistro" 2>&1 | tail -10
```

- [ ] **Step 3: Adicionar `getRegistros` e `putRegistro` no service**

Adicionar após `calcularStatusCelula` em `inspecao.service.ts`:

```typescript
  // ── getRegistros ──────────────────────────────────────────────────────────────

  async getRegistros(
    tenantId: number,
    fichaId: number,
    servicoId: number,
    localId: number,
  ): Promise<FvsRegistro[]> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    return this.prisma.$queryRawUnsafe<FvsRegistro[]>(
      `SELECT
         i.id           AS item_id,
         i.descricao    AS item_descricao,
         i.criticidade  AS item_criticidade,
         i.criterio_aceite AS item_criterio_aceite,
         COALESCE(r.status, 'nao_avaliado') AS status,
         r.id,
         r.ficha_id,
         r.servico_id,
         r.obra_local_id,
         r.observacao,
         r.inspecionado_por,
         r.inspecionado_em,
         r.created_at,
         r.updated_at,
         COUNT(e.id)::int AS evidencias_count,
         fsl.equipe_responsavel
       FROM fvs_catalogo_itens i
       JOIN fvs_ficha_servicos fs
         ON fs.servico_id = $2 AND fs.ficha_id = $3 AND fs.tenant_id = $4
       LEFT JOIN fvs_registros r
         ON r.item_id = i.id AND r.ficha_id = $3 AND r.obra_local_id = $5 AND r.tenant_id = $4
       LEFT JOIN fvs_evidencias e ON e.registro_id = r.id AND e.tenant_id = $4
       LEFT JOIN fvs_ficha_servico_locais fsl
         ON fsl.ficha_servico_id = fs.id AND fsl.obra_local_id = $5
       WHERE i.servico_id = $2 AND i.tenant_id IN (0, $4) AND i.ativo = true
         AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))
       GROUP BY i.id, i.descricao, i.criticidade, i.criterio_aceite,
                r.id, r.ficha_id, r.servico_id, r.obra_local_id, r.status,
                r.observacao, r.inspecionado_por, r.inspecionado_em, r.created_at, r.updated_at,
                fsl.equipe_responsavel
       ORDER BY i.ordem ASC`,
      tenantId, servicoId, fichaId, tenantId, localId,
    );
  }

  // ── putRegistro ────────────────────────────────────────────────────────────────

  async putRegistro(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: PutRegistroDto,
    ip?: string,
  ): Promise<FvsRegistro> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'em_inspecao') {
      throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
    }

    // Validação mode-aware (somente pbqph)
    if (ficha.regime === 'pbqph' && dto.status === 'nao_conforme') {
      if (!dto.observacao?.trim()) {
        throw new UnprocessableEntityException(
          'Observação obrigatória para item não conforme em regime PBQP-H',
        );
      }
    }

    // Buscar criticidade do item (para log de detalhes)
    const itemRows = await this.prisma.$queryRawUnsafe<{ criticidade: string }[]>(
      `SELECT criticidade FROM fvs_catalogo_itens WHERE id = $1`,
      dto.itemId,
    );
    const criticidade = itemRows[0]?.criticidade ?? 'menor';

    // Upsert via INSERT ... ON CONFLICT
    const rows = await this.prisma.$queryRawUnsafe<FvsRegistro[]>(
      `INSERT INTO fvs_registros
         (tenant_id, ficha_id, servico_id, item_id, obra_local_id, status, observacao, inspecionado_por, inspecionado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (ficha_id, item_id, obra_local_id) DO UPDATE SET
         status          = EXCLUDED.status,
         observacao      = EXCLUDED.observacao,
         inspecionado_por = EXCLUDED.inspecionado_por,
         inspecionado_em = EXCLUDED.inspecionado_em,
         updated_at      = NOW()
       RETURNING *`,
      tenantId, fichaId, dto.servicoId, dto.itemId, dto.localId,
      dto.status, dto.observacao ?? null, userId,
    );

    // Audit log (somente pbqph)
    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId, usuarioId: userId,
        acao: 'inspecao', registroId: rows[0].id, ip,
        statusPara: dto.status,
        detalhes: { itemId: dto.itemId, localId: dto.localId, criticidade },
      });
    }

    return rows[0];
  }
```

- [ ] **Step 4: Executar testes**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage 2>&1 | tail -15
```

Esperado: todos os testes `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): InspecaoService — getRegistros e putRegistro com validação mode-aware"
```

---

## Task 6: InspecaoService — Evidências e PATCH local

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Adicionar testes de evidências e PATCH local**

Adicionar ao `inspecao.service.spec.ts`:

```typescript
  // ── deleteEvidencia ──────────────────────────────────────────────────────────
  describe('deleteEvidencia()', () => {
    it('remove evidência e grava audit_log (pbqph)', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ id: 1, tenant_id: TENANT_ID, registro_id: 5, ged_versao_id: 99 }]) // buscar evidencia
        .mockResolvedValueOnce([FICHA_EM_INSPECAO]); // getFichaOuFalhar
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.deleteEvidencia(TENANT_ID, 1, USER_ID, '127.0.0.1');

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // DELETE + audit_log
    });

    it('lança NotFoundException se evidência não pertence ao tenant', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.deleteEvidencia(TENANT_ID, 999, USER_ID, '127.0.0.1'))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchLocal ───────────────────────────────────────────────────────────────
  describe('patchLocal()', () => {
    it('lança ConflictException se ficha está concluída', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...FICHA_RASCUNHO, status: 'concluida' }]);
      await expect(svc.patchLocal(TENANT_ID, 1, 1, { equipeResponsavel: 'Equipe A' }))
        .rejects.toBeInstanceOf(ConflictException);
    });

    it('atualiza equipe_responsavel com sucesso', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])          // getFichaOuFalhar
        .mockResolvedValueOnce([{ id: 1, equipe_responsavel: 'Equipe A' }]); // UPDATE retorno
      const result = await svc.patchLocal(TENANT_ID, 1, 1, { equipeResponsavel: 'Equipe A' });
      expect(result.equipe_responsavel).toBe('Equipe A');
    });
  });
```

- [ ] **Step 2: Confirmar falha**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage -t "deleteEvidencia|patchLocal" 2>&1 | tail -10
```

- [ ] **Step 3: Adicionar métodos no service**

Adicionar ao `inspecao.service.ts`:

```typescript
  // ── createEvidencia ──────────────────────────────────────────────────────────

  async createEvidencia(
    tenantId: number,
    registroId: number,
    userId: number,
    file: Express.Multer.File,
    ip?: string,
  ): Promise<FvsEvidencia> {
    // Buscar registro para obter ficha
    const regRows = await this.prisma.$queryRawUnsafe<{ ficha_id: number }[]>(
      `SELECT ficha_id FROM fvs_registros WHERE id = $1 AND tenant_id = $2`,
      registroId, tenantId,
    );
    if (!regRows.length) throw new NotFoundException(`Registro ${registroId} não encontrado`);

    const ficha = await this.getFichaOuFalhar(tenantId, regRows[0].ficha_id);

    // Buscar categoria FTO para o GED
    const catRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias WHERE codigo = 'FTO' AND tenant_id IN (0, $1) LIMIT 1`,
      tenantId,
    );
    if (!catRows.length) throw new NotFoundException('Categoria GED FTO não configurada');

    // Fazer upload via GedService
    const gedResult = await this.ged.upload(tenantId, userId, ficha.obra_id, file, {
      titulo: `FVS Evidência — registro ${registroId}`,
      categoriaId: catRows[0].id,
      escopo: 'OBRA',
    } as any, ip);

    // Vincular evidência ao registro
    const evRows = await this.prisma.$queryRawUnsafe<FvsEvidencia[]>(
      `INSERT INTO fvs_evidencias (tenant_id, registro_id, ged_versao_id)
       VALUES ($1, $2, $3) RETURNING *`,
      tenantId, registroId, gedResult.versaoId,
    );

    // Audit log (pbqph)
    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId: ficha.id, usuarioId: userId,
        acao: 'upload_evidencia', registroId, ip,
      });
    }

    return evRows[0];
  }

  // ── deleteEvidencia ──────────────────────────────────────────────────────────

  async deleteEvidencia(
    tenantId: number,
    evidenciaId: number,
    userId: number,
    ip?: string,
  ): Promise<void> {
    const evRows = await this.prisma.$queryRawUnsafe<(FvsEvidencia & { ficha_id: number })[]>(
      `SELECT e.*, r.ficha_id FROM fvs_evidencias e
       JOIN fvs_registros r ON r.id = e.registro_id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      evidenciaId, tenantId,
    );
    if (!evRows.length) throw new NotFoundException(`Evidência ${evidenciaId} não encontrada`);

    const ev = evRows[0];
    const ficha = await this.getFichaOuFalhar(tenantId, ev.ficha_id);

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_evidencias WHERE id = $1 AND tenant_id = $2`,
      evidenciaId, tenantId,
    );

    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId: ficha.id, usuarioId: userId,
        acao: 'remover_evidencia', registroId: ev.registro_id, ip,
      });
    }
  }

  // ── getEvidencias ────────────────────────────────────────────────────────────

  async getEvidencias(tenantId: number, registroId: number): Promise<FvsEvidencia[]> {
    return this.prisma.$queryRawUnsafe<FvsEvidencia[]>(
      `SELECT e.*, gv.nome_original, gv.storage_key
       FROM fvs_evidencias e
       JOIN "GedVersao" gv ON gv.id = e.ged_versao_id
       WHERE e.registro_id = $1 AND e.tenant_id = $2
       ORDER BY e.created_at ASC`,
      registroId, tenantId,
    );
  }

  // ── patchLocal ────────────────────────────────────────────────────────────────

  async patchLocal(
    tenantId: number,
    fichaId: number,
    localId: number,
    dto: { equipeResponsavel?: string | null },
  ): Promise<{ id: number; equipe_responsavel: string | null }> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status === 'concluida') {
      throw new ConflictException('Não é possível editar local de ficha concluída');
    }

    const rows = await this.prisma.$queryRawUnsafe<{ id: number; equipe_responsavel: string | null }[]>(
      `UPDATE fvs_ficha_servico_locais SET equipe_responsavel = $1
       WHERE obra_local_id = $2 AND tenant_id = $3
         AND ficha_servico_id IN (
           SELECT id FROM fvs_ficha_servicos WHERE ficha_id = $4
         )
       RETURNING id, equipe_responsavel`,
      dto.equipeResponsavel ?? null, localId, tenantId, fichaId,
    );
    if (!rows.length) throw new NotFoundException(`Local ${localId} não vinculado à ficha ${fichaId}`);
    return rows[0];
  }
```

- [ ] **Step 4: Executar todos os testes**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage 2>&1 | tail -20
```

Esperado: todos `PASS`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): InspecaoService — evidências (GED FTO) e equipe responsável"
```

---

## Task 7: InspecaoController + FvsModule

**Files:**
- Create: `backend/src/fvs/inspecao/inspecao.controller.ts`
- Modify: `backend/src/fvs/fvs.module.ts`

- [ ] **Step 1: Criar `backend/src/fvs/inspecao/inspecao.controller.ts`**

```typescript
// backend/src/fvs/inspecao/inspecao.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Put, Body, Param, Query,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/tenant.decorator';
import { InspecaoService } from './inspecao.service';
import { CreateFichaDto } from './dto/create-ficha.dto';
import { UpdateFichaDto } from './dto/update-ficha.dto';
import { PutRegistroDto } from './dto/put-registro.dto';
import { UpdateLocalDto } from './dto/update-local.dto';

interface JwtUser { sub: number; tenantId: number; role: string }

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspecaoController {
  constructor(private readonly inspecao: InspecaoService) {}

  // ─── Fichas ─────────────────────────────────────────────────────────────────

  @Post('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.createFicha(tenantId, user.sub, dto, ip);
  }

  @Get('fichas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFichas(
    @TenantId() tenantId: number,
    @Query('obraId', new ParseIntPipe({ optional: true })) obraId?: number,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.inspecao.getFichas(tenantId, obraId, page, limit);
  }

  @Get('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getFicha(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inspecao.getFicha(tenantId, id);
  }

  @Patch('fichas/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  patchFicha(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFichaDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.patchFicha(tenantId, id, user.sub, dto, ip);
  }

  @Delete('fichas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFicha(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.inspecao.deleteFicha(tenantId, id);
  }

  // ─── Grade ──────────────────────────────────────────────────────────────────

  @Get('fichas/:id/grade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getGrade(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('pavimentoId', new ParseIntPipe({ optional: true })) pavimentoId?: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
  ) {
    return this.inspecao.getGrade(tenantId, id, { pavimentoId, servicoId });
  }

  // ─── Registros ───────────────────────────────────────────────────────────────

  @Get('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRegistros(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Query('servicoId', new ParseIntPipe({ optional: true })) servicoId?: number,
    @Query('localId', new ParseIntPipe({ optional: true })) localId?: number,
  ) {
    return this.inspecao.getRegistros(tenantId, fichaId, servicoId!, localId!);
  }

  @Put('fichas/:fichaId/registros')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  putRegistro(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: PutRegistroDto,
    @Ip() ip: string,
  ) {
    return this.inspecao.putRegistro(tenantId, fichaId, user.sub, dto, ip);
  }

  // ─── Locais ──────────────────────────────────────────────────────────────────

  @Patch('fichas/:fichaId/locais/:localId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchLocal(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('localId', ParseIntPipe) localId: number,
    @Body() dto: UpdateLocalDto,
  ) {
    return this.inspecao.patchLocal(tenantId, fichaId, localId, {
      equipeResponsavel: dto.equipeResponsavel,
    });
  }

  // ─── Serviços da ficha ───────────────────────────────────────────────────────

  @Post('fichas/:id/servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  addServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) fichaId: number,
    @Body() dto: { servicoId: number; localIds: number[]; itensExcluidos?: number[] },
  ) {
    return this.inspecao.addServico(tenantId, fichaId, dto);
  }

  @Delete('fichas/:fichaId/servicos/:servicoId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeServico(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoId', ParseIntPipe) servicoId: number,
  ) {
    return this.inspecao.removeServico(tenantId, fichaId, servicoId);
  }

  // ─── Evidências ───────────────────────────────────────────────────────────────

  @Post('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('arquivo'))
  createEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) registroId: number,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    return this.inspecao.createEvidencia(tenantId, registroId, user.sub, file, ip);
  }

  @Get('registros/:id/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getEvidencias(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) registroId: number,
  ) {
    return this.inspecao.getEvidencias(tenantId, registroId);
  }

  @Delete('evidencias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.inspecao.deleteEvidencia(tenantId, id, user.sub, ip);
  }
}
```

- [ ] **Step 2: Adicionar `addServico` e `removeServico` ao InspecaoService**

Adicionar ao `inspecao.service.ts`:

```typescript
  // ── addServico ────────────────────────────────────────────────────────────────

  async addServico(
    tenantId: number,
    fichaId: number,
    dto: { servicoId: number; localIds: number[]; itensExcluidos?: number[] },
  ): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser adicionados com ficha em rascunho');
    }

    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      tenantId, fichaId, dto.servicoId,
      dto.itensExcluidos ? JSON.stringify(dto.itensExcluidos) : null,
    );
    const fichaServicoId = rows[0].id;

    for (const localId of dto.localIds) {
      await this.prisma.$queryRawUnsafe(
        `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id) VALUES ($1, $2, $3)`,
        tenantId, fichaServicoId, localId,
      );
    }
  }

  // ── removeServico ─────────────────────────────────────────────────────────────

  async removeServico(tenantId: number, fichaId: number, servicoId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser removidos com ficha em rascunho');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_ficha_servicos WHERE ficha_id = $1 AND servico_id = $2 AND tenant_id = $3`,
      fichaId, servicoId, tenantId,
    );
  }
```

- [ ] **Step 3: Atualizar `backend/src/fvs/fvs.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { InspecaoService } from './inspecao/inspecao.service';
import { InspecaoController } from './inspecao/inspecao.controller';

@Module({
  imports: [
    PrismaModule,
    GedModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB para fotos
    }),
  ],
  providers: [CatalogoService, InspecaoService],
  controllers: [CatalogoController, InspecaoController],
  exports: [CatalogoService, InspecaoService],
})
export class FvsModule {}
```

- [ ] **Step 4: Verificar compilação do backend**

```bash
cd backend
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros. Se houver erro de tipo, corrigir antes de prosseguir.

- [ ] **Step 5: Rodar todos os testes**

```bash
cd backend
npx jest --no-coverage 2>&1 | tail -20
```

Esperado: todos `PASS`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/
git commit -m "feat(fvs): InspecaoController + FvsModule com GedModule"
```

---

## Task 8: Frontend — fvs.service.ts (tipos e métodos de inspeção)

**Files:**
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 1: Adicionar tipos ao final da seção de tipos em `fvs.service.ts`**

Após `export interface ImportResult { ... }`, adicionar:

```typescript
// ─── Inspeção Sprint 2 ────────────────────────────────────────────────────────

export type RegimeFicha = 'pbqph' | 'norma_tecnica' | 'livre';
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida';
export type StatusRegistro = 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao';
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';

export interface FichaFvs {
  id: number;
  tenant_id: number;
  obra_id: number;
  nome: string;
  regime: RegimeFicha;
  status: StatusFicha;
  criado_por: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  progresso?: number;
}

export interface FichaDetalhada extends FichaFvs {
  servicos: FichaServico[];
  progresso: number;
}

export interface FichaServico {
  id: number;
  ficha_id: number;
  servico_id: number;
  servico_nome: string;
  ordem: number;
  itens_excluidos: number[] | null;
  locais: FichaServicoLocal[];
}

export interface FichaServicoLocal {
  id: number;
  ficha_servico_id: number;
  obra_local_id: number;
  local_nome: string;
  equipe_responsavel: string | null;
}

export interface FvsGrade {
  servicos: { id: number; nome: string }[];
  locais: { id: number; nome: string; pavimento_id: number | null }[];
  celulas: Record<number, Record<number, StatusGrade>>;
}

export interface FvsRegistro {
  id: number;
  ficha_id: number;
  servico_id: number;
  item_id: number;
  obra_local_id: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: string | null;
  item_descricao: string;
  item_criticidade: 'critico' | 'maior' | 'menor';
  item_criterio_aceite: string | null;
  evidencias_count: number;
  equipe_responsavel: string | null;
  created_at: string;
  updated_at: string;
}

export interface FvsEvidencia {
  id: number;
  registro_id: number;
  ged_versao_id: number;
  nome_original: string;
  created_at: string;
  url?: string;
}

export interface CreateFichaPayload {
  obraId: number;
  nome: string;
  regime: RegimeFicha;
  servicos: { servicoId: number; localIds: number[]; itensExcluidos?: number[] }[];
}

export interface PaginatedFichas {
  data: FichaFvs[];
  total: number;
  page: number;
}
```

- [ ] **Step 2: Adicionar métodos ao `fvsService` em `fvs.service.ts`**

Adicionar dentro do objeto `export const fvsService = { ... }`, após `deleteItem`:

```typescript
  // ─── Fichas ────────────────────────────────────────────────────────────────────
  async createFicha(payload: CreateFichaPayload): Promise<FichaFvs> {
    const { data } = await api.post('/fvs/fichas', payload);
    return data;
  },
  async getFichas(params?: { obraId?: number; page?: number; limit?: number }): Promise<PaginatedFichas> {
    const { data } = await api.get('/fvs/fichas', { params });
    return data;
  },
  async getFicha(id: number): Promise<FichaDetalhada> {
    const { data } = await api.get(`/fvs/fichas/${id}`);
    return data;
  },
  async patchFicha(id: number, payload: { nome?: string; status?: StatusFicha }): Promise<FichaFvs> {
    const { data } = await api.patch(`/fvs/fichas/${id}`, payload);
    return data;
  },
  async deleteFicha(id: number): Promise<void> {
    await api.delete(`/fvs/fichas/${id}`);
  },

  // ─── Grade ─────────────────────────────────────────────────────────────────────
  async getGrade(fichaId: number, params?: { pavimentoId?: number; servicoId?: number }): Promise<FvsGrade> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/grade`, { params });
    return data;
  },

  // ─── Registros ─────────────────────────────────────────────────────────────────
  async getRegistros(fichaId: number, servicoId: number, localId: number): Promise<FvsRegistro[]> {
    const { data } = await api.get(`/fvs/fichas/${fichaId}/registros`, {
      params: { servicoId, localId },
    });
    return data;
  },
  async putRegistro(
    fichaId: number,
    payload: { servicoId: number; itemId: number; localId: number; status: StatusRegistro; observacao?: string },
  ): Promise<FvsRegistro> {
    const { data } = await api.put(`/fvs/fichas/${fichaId}/registros`, payload);
    return data;
  },

  // ─── Local (equipe) ────────────────────────────────────────────────────────────
  async patchLocal(fichaId: number, localId: number, payload: { equipeResponsavel?: string | null }): Promise<void> {
    await api.patch(`/fvs/fichas/${fichaId}/locais/${localId}`, payload);
  },

  // ─── Evidências ────────────────────────────────────────────────────────────────
  async getEvidencias(registroId: number): Promise<FvsEvidencia[]> {
    const { data } = await api.get(`/fvs/registros/${registroId}/evidencias`);
    return data;
  },
  async createEvidencia(registroId: number, file: File): Promise<FvsEvidencia> {
    const form = new FormData();
    form.append('arquivo', file);
    const { data } = await api.post(`/fvs/registros/${registroId}/evidencias`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async deleteEvidencia(id: number): Promise<void> {
    await api.delete(`/fvs/evidencias/${id}`);
  },
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | head -20
```

Esperado: sem erros relacionados a `fvs.service.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs-fe): tipos e métodos de inspeção em fvs.service.ts"
```

---

## Task 9: Frontend — Hooks de inspeção

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts`
- Create: `frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts`
- Create: `frontend-web/src/modules/fvs/inspecao/hooks/useRegistros.ts`

- [ ] **Step 1: Criar `useFichas.ts`**

```typescript
// frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type CreateFichaPayload, type StatusFicha } from '../../../../services/fvs.service';

export function useFichas(obraId?: number, page = 1) {
  return useQuery({
    queryKey: ['fvs-fichas', obraId, page],
    queryFn: () => fvsService.getFichas({ obraId, page }),
  });
}

export function useFicha(id: number) {
  return useQuery({
    queryKey: ['fvs-ficha', id],
    queryFn: () => fvsService.getFicha(id),
    enabled: !!id,
  });
}

export function useCreateFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFichaPayload) => fvsService.createFicha(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-fichas'] }),
  });
}

export function usePatchFicha(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { nome?: string; status?: StatusFicha }) =>
      fvsService.patchFicha(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
    },
  });
}

export function useDeleteFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteFicha(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-fichas'] }),
  });
}
```

- [ ] **Step 2: Criar `useGrade.ts`**

```typescript
// frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
import { useQuery } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useGrade(fichaId: number, filtros?: { pavimentoId?: number; servicoId?: number }) {
  return useQuery({
    queryKey: ['fvs-grade', fichaId, filtros],
    queryFn: () => fvsService.getGrade(fichaId, filtros),
    enabled: !!fichaId,
    staleTime: 10_000, // 10s — grade pode ser grande, evitar refetch excessivo
  });
}
```

- [ ] **Step 3: Criar `useRegistros.ts`**

```typescript
// frontend-web/src/modules/fvs/inspecao/hooks/useRegistros.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type StatusRegistro } from '../../../../services/fvs.service';

export function useRegistros(fichaId: number, servicoId: number, localId: number) {
  return useQuery({
    queryKey: ['fvs-registros', fichaId, servicoId, localId],
    queryFn: () => fvsService.getRegistros(fichaId, servicoId, localId),
    enabled: !!fichaId && !!servicoId && !!localId,
  });
}

export function usePutRegistro(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      servicoId: number; itemId: number; localId: number;
      status: StatusRegistro; observacao?: string;
    }) => fvsService.putRegistro(fichaId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId, vars.servicoId, vars.localId] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}

export function usePatchLocal(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ localId, equipeResponsavel }: { localId: number; equipeResponsavel?: string | null }) =>
      fvsService.patchLocal(fichaId, localId, { equipeResponsavel }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId] }),
  });
}

export function useEvidencias(registroId: number | null) {
  return useQuery({
    queryKey: ['fvs-evidencias', registroId],
    queryFn: () => fvsService.getEvidencias(registroId!),
    enabled: !!registroId,
  });
}

export function useCreateEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registroId, file }: { registroId: number; file: File }) =>
      fvsService.createEvidencia(registroId, file),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-evidencias', vars.registroId] });
    },
  });
}

export function useDeleteEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, registroId }: { id: number; registroId: number }) =>
      fvsService.deleteEvidencia(id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fvs-evidencias', vars.registroId] });
    },
  });
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/hooks/
git commit -m "feat(fvs-fe): hooks TanStack Query para fichas, grade e registros"
```

---

## Task 10: Frontend — Tela 1 (FichasListPage)

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx`

- [ ] **Step 1: Criar `FichasListPage.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFichas, useDeleteFicha } from '../hooks/useFichas';
import type { FichaFvs } from '../../../../services/fvs.service';

const REGIME_LABEL: Record<string, string> = {
  pbqph: 'PBQP-H',
  norma_tecnica: 'Norma Técnica',
  livre: 'Livre',
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#6b7280' },
  em_inspecao: { label: 'Em Inspeção', color: '#3b82f6' },
  concluida: { label: 'Concluída', color: '#22c55e' },
};

export function FichasListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useFichas(undefined, page);
  const deleteFicha = useDeleteFicha();

  const fichas: FichaFvs[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  if (isLoading) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Fichas FVS</h1>
        <button
          onClick={() => navigate('/fvs/fichas/nova')}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
          }}
        >
          + Nova Ficha
        </button>
      </div>

      {fichas.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Nenhuma ficha encontrada. Crie a primeira!</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Regime</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Progresso</th>
              <th style={{ padding: '8px 12px' }}></th>
            </tr>
          </thead>
          <tbody>
            {fichas.map((f) => {
              const statusInfo = STATUS_LABEL[f.status] ?? { label: f.status, color: '#6b7280' };
              return (
                <tr key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{f.nome}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: '#f3f4f6', borderRadius: 4, padding: '2px 8px', fontSize: 12,
                    }}>
                      {REGIME_LABEL[f.regime] ?? f.regime}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      color: statusInfo.color, fontSize: 12, fontWeight: 600,
                    }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', minWidth: 120 }}>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 6, width: '100%' }}>
                      <div style={{
                        background: '#22c55e', height: '100%', borderRadius: 99,
                        width: `${f.progresso ?? 0}%`, transition: 'width 0.3s',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{f.progresso ?? 0}%</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/fvs/fichas/${f.id}`)}
                      style={{
                        background: 'transparent', border: '1px solid #d1d5db',
                        borderRadius: 5, padding: '4px 12px', cursor: 'pointer', fontSize: 13,
                        marginRight: 8,
                      }}
                    >
                      Abrir
                    </button>
                    {f.status === 'rascunho' && (
                      <button
                        onClick={() => {
                          if (confirm(`Excluir "${f.nome}"?`)) deleteFicha.mutate(f.id);
                        }}
                        style={{
                          background: 'transparent', border: '1px solid #fca5a5',
                          borderRadius: 5, padding: '4px 12px', cursor: 'pointer',
                          fontSize: 13, color: '#ef4444',
                        }}
                      >
                        Excluir
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            ← Anterior
          </button>
          <span style={{ padding: '4px 8px', fontSize: 13 }}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '4px 12px', cursor: 'pointer' }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx
git commit -m "feat(fvs-fe): Tela 1 — FichasListPage com paginação"
```

---

## Task 11: Frontend — Tela 2 (AbrirFichaWizard)

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx`

- [ ] **Step 1: Criar `AbrirFichaWizard.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateFicha } from '../hooks/useFichas';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
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

// Nota: obras e locais virão de hooks do módulo de obras quando disponíveis.
// Por enquanto, os selects de obra e local recebem dados como props ou são mockados.
// O componente está preparado para receber `obras: {id, nome}[]` e `locaisPorObra: Record<obraId, {id, nome}[]>`.

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
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoComLocais[]>([]);
  const [error, setError] = useState('');

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

  async function handleConfirmar() {
    setError('');
    const servicosComLocais = servicosSelecionados.filter(s => s.localIds.length > 0);
    if (!servicosComLocais.length) {
      setError('Selecione ao menos um serviço com um local para inspecionar.');
      return;
    }
    try {
      const ficha = await createFicha.mutateAsync({
        obraId: stepOne.obraId!,
        nome: stepOne.nome,
        regime: stepOne.regime,
        servicos: servicosComLocais,
      });
      navigate(`/fvs/fichas/${ficha.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
    }
  }

  if (step === 1) {
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h2 style={{ marginBottom: 20 }}>Nova Ficha FVS — Passo 1 de 2</h2>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Nome da Ficha *</span>
          <input
            type="text"
            value={stepOne.nome}
            onChange={e => setStepOne(p => ({ ...p, nome: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            placeholder="Ex: FVS Alvenaria Torre 1"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Obra *</span>
          <select
            value={stepOne.obraId ?? ''}
            onChange={e => setStepOne(p => ({ ...p, obraId: Number(e.target.value) || null }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Regime</span>
          <select
            value={stepOne.regime}
            onChange={e => setStepOne(p => ({ ...p, regime: e.target.value as RegimeFicha }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            <option value="livre">Livre (procedimento interno)</option>
            <option value="norma_tecnica">Norma Técnica (NBR)</option>
            <option value="pbqph">PBQP-H (SiAC / ISO 9001)</option>
          </select>
        </label>

        <button
          onClick={() => {
            if (!stepOne.nome.trim() || !stepOne.obraId) {
              setError('Nome e obra são obrigatórios.');
              return;
            }
            setError('');
            setStep(2);
          }}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontSize: 14,
          }}
        >
          Próximo →
        </button>
        {error && <p style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2 style={{ marginBottom: 8 }}>Nova Ficha FVS — Passo 2 de 2</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Selecione os serviços e os locais a inspecionar por serviço.
        {stepOne.regime === 'pbqph' && (
          <strong style={{ color: '#f59e0b' }}> Modo PBQP-H: use serviços do catálogo do sistema.</strong>
        )}
      </p>

      {servicos.map(srv => {
        const sel = servicosSelecionados.find(s => s.servicoId === srv.id);
        return (
          <div key={srv.id} style={{
            border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12,
            background: sel ? '#f0f9ff' : '#fff',
          }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
              cursor: 'pointer', fontWeight: sel ? 600 : 400,
            }}>
              <input
                type="checkbox"
                checked={!!sel}
                onChange={() => toggleServico(srv.id)}
              />
              {srv.nome}
              {srv.is_sistema && (
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>
                  PBQP-H
                </span>
              )}
            </label>

            {sel && locais.length > 0 && (
              <div style={{ padding: '0 16px 12px 40px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {locais.map(loc => (
                  <label key={loc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    background: sel.localIds.includes(loc.id) ? '#dbeafe' : '#f9fafb',
                    border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={sel.localIds.includes(loc.id)}
                      onChange={() => toggleLocal(srv.id, loc.id)}
                    />
                    {loc.nome}
                  </label>
                ))}
              </div>
            )}

            {sel && locais.length === 0 && (
              <p style={{ padding: '0 16px 12px 40px', color: '#f59e0b', fontSize: 13 }}>
                Nenhum local cadastrado para esta obra.
              </p>
            )}
          </div>
        );
      })}

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          onClick={() => setStep(1)}
          style={{ padding: '10px 20px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: 6 }}
        >
          ← Voltar
        </button>
        <button
          onClick={handleConfirmar}
          disabled={createFicha.isPending}
          style={{
            background: '#22c55e', color: '#fff', border: 'none',
            borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontSize: 14,
          }}
        >
          {createFicha.isPending ? 'Criando...' : 'Confirmar e Criar Ficha'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
git commit -m "feat(fvs-fe): Tela 2 — AbrirFichaWizard (2 passos)"
```

---

## Task 12: Frontend — Tela 3 (FichaGradePage)

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`

- [ ] **Step 1: Criar `FichaGradePage.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFicha, usePatchFicha } from '../hooks/useFichas';
import { useGrade } from '../hooks/useGrade';
import type { StatusGrade } from '../../../../services/fvs.service';

const CELL_COLOR: Record<StatusGrade, string> = {
  nc: '#ef4444',
  aprovado: '#22c55e',
  pendente: '#f59e0b',
  nao_avaliado: '#d1d5db',
};

const CELL_ICON: Record<StatusGrade, string> = {
  nc: '✗',
  aprovado: '✓',
  pendente: '!',
  nao_avaliado: '—',
};

export function FichaGradePage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const navigate = useNavigate();

  const { data: ficha } = useFicha(id);
  const { data: grade, isLoading } = useGrade(id);
  const patchFicha = usePatchFicha(id);

  const [confirmando, setConfirmando] = useState<'iniciar' | 'concluir' | null>(null);
  const [erroConcluso, setErroConcluso] = useState<{ message: string; itensPendentes?: any[] } | null>(null);

  async function handleStatusChange(novoStatus: 'em_inspecao' | 'concluida') {
    setErroConcluso(null);
    try {
      await patchFicha.mutateAsync({ status: novoStatus });
      setConfirmando(null);
    } catch (e: any) {
      const data = e?.response?.data;
      setErroConcluso({
        message: data?.message ?? 'Erro ao alterar status',
        itensPendentes: data?.itensPendentes,
      });
    }
  }

  if (isLoading || !grade || !ficha) {
    return <div style={{ padding: 24 }}>Carregando...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/fvs/fichas')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
        >
          ←
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{ficha.nome}</h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {ficha.regime.toUpperCase()} · {ficha.status.replace('_', ' ')} · {ficha.progresso ?? 0}% concluído
          </span>
        </div>
      </div>

      {/* Botões de ação */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        {ficha.status === 'rascunho' && (
          <button
            onClick={() => setConfirmando('iniciar')}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
          >
            Iniciar Inspeção
          </button>
        )}
        {ficha.status === 'em_inspecao' && (
          <button
            onClick={() => setConfirmando('concluir')}
            style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
          >
            Concluir Ficha
          </button>
        )}
      </div>

      {/* Modal de confirmação */}
      {confirmando && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px' }}>
              {confirmando === 'iniciar' ? 'Iniciar Inspeção?' : 'Concluir Ficha?'}
            </h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              {confirmando === 'iniciar'
                ? 'A ficha passará para o status "Em Inspeção" e os registros poderão ser gravados.'
                : ficha.regime === 'pbqph'
                  ? 'Itens críticos NC sem evidência fotográfica serão verificados antes de concluir.'
                  : 'A ficha será marcada como concluída.'}
            </p>
            {erroConcluso && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <p style={{ color: '#ef4444', margin: 0, fontSize: 13, fontWeight: 600 }}>{erroConcluso.message}</p>
                {erroConcluso.itensPendentes?.map((ip: any) => (
                  <p key={ip.item_id} style={{ color: '#7f1d1d', fontSize: 12, margin: '4px 0 0' }}>• {ip.descricao}</p>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmando(null); setErroConcluso(null); }}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleStatusChange(confirmando === 'iniciar' ? 'em_inspecao' : 'concluida')}
                disabled={patchFicha.isPending}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                {patchFicha.isPending ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 16px', minWidth: 220, borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                Serviço
              </th>
              {grade.locais.map(loc => (
                <th key={loc.id} style={{
                  padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid #e5e7eb',
                  color: '#6b7280', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden',
                  textOverflow: 'ellipsis', fontSize: 12,
                }}>
                  {loc.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.servicos.map((srv, i) => (
              <tr key={srv.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{srv.nome}</td>
                {grade.locais.map(loc => {
                  const status: StatusGrade = grade.celulas[srv.id]?.[loc.id] ?? 'nao_avaliado';
                  const canClick = ficha.status === 'em_inspecao';
                  return (
                    <td key={loc.id} style={{ textAlign: 'center', padding: '6px' }}>
                      <span
                        onClick={() => {
                          if (canClick) navigate(`/fvs/fichas/${id}/inspecao?servicoId=${srv.id}&localId=${loc.id}`);
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 32, height: 32, borderRadius: 6,
                          background: CELL_COLOR[status],
                          color: '#fff', fontSize: 14, fontWeight: 700,
                          cursor: canClick ? 'pointer' : 'default',
                          opacity: ficha.status === 'rascunho' ? 0.5 : 1,
                        }}
                        title={`${srv.nome} — ${loc.nome}: ${status}`}
                      >
                        {CELL_ICON[status]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12, color: '#6b7280' }}>
        {Object.entries(CELL_COLOR).map(([status, color]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {status === 'nc' ? 'Não Conforme' : status === 'aprovado' ? 'Aprovado' : status === 'pendente' ? 'Pendente' : 'Não Avaliado'}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
git commit -m "feat(fvs-fe): Tela 3 — FichaGradePage com grade colorida e transições de status"
```

---

## Task 13: Frontend — Tela 4 (FichaLocalPage + FotosModal + RegistroNcModal)

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/components/FotosModal.tsx`
- Create: `frontend-web/src/modules/fvs/inspecao/components/RegistroNcModal.tsx`
- Create: `frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx`

- [ ] **Step 1: Criar `FotosModal.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/components/FotosModal.tsx
import { useRef } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro } from '../../../../services/fvs.service';

interface Props {
  registro: FvsRegistro;
  regime: string;
  onClose: () => void;
}

export function FotosModal({ registro, regime, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: evidencias = [] } = useEvidencias(registro.id ?? null);
  const createEv = useCreateEvidencia();
  const deleteEv = useDeleteEvidencia();

  const isCriticoNcSemFoto =
    regime === 'pbqph' &&
    registro.item_criticidade === 'critico' &&
    registro.status === 'nao_conforme' &&
    evidencias.length === 0;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registro.id) return;
    createEv.mutate({ registroId: registro.id, file });
    e.target.value = '';
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 520, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>
            Fotos — {registro.item_descricao}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {isCriticoNcSemFoto && (
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6,
            padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#92400e',
          }}>
            ⚠ Foto obrigatória para item crítico NC em PBQP-H — será validada na conclusão da ficha.
          </div>
        )}

        {/* Grade de fotos */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 80, marginBottom: 16 }}>
          {evidencias.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Nenhuma foto adicionada.</p>
          ) : (
            evidencias.map(ev => (
              <div key={ev.id} style={{ position: 'relative' }}>
                <div style={{
                  width: 80, height: 80, background: '#f3f4f6', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 4,
                }}>
                  {ev.nome_original ?? 'foto'}
                </div>
                <button
                  onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff', border: 'none',
                    borderRadius: '50%', width: 18, height: 18, fontSize: 11,
                    cursor: 'pointer', lineHeight: '18px', padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={createEv.isPending}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6,
            padding: '8px 16px', cursor: 'pointer', fontSize: 14,
          }}
        >
          {createEv.isPending ? 'Enviando...' : '+ Adicionar Foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `RegistroNcModal.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/components/RegistroNcModal.tsx
import { useState, useRef } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro } from '../../../../services/fvs.service';

interface Props {
  registro: FvsRegistro;
  regime: string;
  onSalvar: (observacao: string) => void;
  onCancelar: () => void;
  salvando?: boolean;
}

export function RegistroNcModal({ registro, regime, onSalvar, onCancelar, salvando }: Props) {
  const [obs, setObs] = useState(registro.observacao ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: evidencias = [] } = useEvidencias(registro.id ?? null);
  const createEv = useCreateEvidencia();
  const deleteEv = useDeleteEvidencia();

  const isPbqph = regime === 'pbqph';
  const isCritico = registro.item_criticidade === 'critico';
  const semFoto = evidencias.length === 0;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registro.id) return;
    createEv.mutate({ registroId: registro.id, file });
    e.target.value = '';
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 540, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#ef4444' }}>
            Não Conforme — {registro.item_descricao}
          </h3>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {isCritico && (
          <span style={{
            display: 'inline-block', background: '#fef2f2', color: '#ef4444',
            fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', marginBottom: 12,
          }}>
            CRÍTICO
          </span>
        )}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>
            Observação {isPbqph ? '(obrigatória)' : '(opcional)'}
          </span>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={4}
            style={{
              display: 'block', width: '100%', marginTop: 6,
              padding: '8px 10px', border: `1px solid ${isPbqph && !obs.trim() ? '#ef4444' : '#d1d5db'}`,
              borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
            }}
            placeholder="Descreva a não conformidade observada..."
          />
          {isPbqph && !obs.trim() && (
            <span style={{ fontSize: 12, color: '#ef4444' }}>Obrigatório em PBQP-H</span>
          )}
        </label>

        {/* Fotos inline */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              Fotos {isPbqph && isCritico ? '(obrigatória na conclusão)' : '(opcional)'}
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={createEv.isPending}
              style={{
                fontSize: 12, background: 'transparent', border: '1px solid #d1d5db',
                borderRadius: 5, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              + Foto
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          </div>

          {isPbqph && isCritico && semFoto && (
            <p style={{ color: '#f59e0b', fontSize: 12, margin: '0 0 8px' }}>
              ⚠ Foto obrigatória — será validada ao concluir a ficha.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {evidencias.map(ev => (
              <div key={ev.id} style={{ position: 'relative' }}>
                <div style={{
                  width: 64, height: 64, background: '#f3f4f6', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#6b7280', textAlign: 'center', padding: 2,
                }}>
                  {ev.nome_original ?? 'foto'}
                </div>
                <button
                  onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    background: '#ef4444', color: '#fff', border: 'none',
                    borderRadius: '50%', width: 16, height: 16, fontSize: 10,
                    cursor: 'pointer', lineHeight: '16px', padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {evidencias.length === 0 && (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>Nenhuma foto</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancelar}
            style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(obs)}
            disabled={salvando || (isPbqph && !obs.trim())}
            style={{
              padding: '8px 20px', background: '#ef4444', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
          >
            {salvando ? 'Salvando...' : 'Salvar NC'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `FichaLocalPage.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFicha } from '../hooks/useFichas';
import { useRegistros, usePutRegistro, usePatchLocal } from '../hooks/useRegistros';
import { FotosModal } from '../components/FotosModal';
import { RegistroNcModal } from '../components/RegistroNcModal';
import type { FvsRegistro, StatusRegistro } from '../../../../services/fvs.service';

const STATUS_OPTIONS: { value: StatusRegistro; label: string; color: string }[] = [
  { value: 'conforme',      label: 'Conforme',     color: '#22c55e' },
  { value: 'nao_conforme',  label: 'Não Conforme', color: '#ef4444' },
  { value: 'excecao',       label: 'Exceção',       color: '#f59e0b' },
  { value: 'nao_avaliado',  label: 'Não Avaliado', color: '#d1d5db' },
];

const CRIT_COLOR: Record<string, string> = {
  critico: '#ef4444',
  maior: '#f59e0b',
  menor: '#6b7280',
};

export function FichaLocalPage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const [searchParams] = useSearchParams();
  const servicoId = Number(searchParams.get('servicoId'));
  const localId = Number(searchParams.get('localId'));
  const navigate = useNavigate();

  const { data: ficha } = useFicha(id);
  const { data: registros = [], isLoading } = useRegistros(id, servicoId, localId);
  const putRegistro = usePutRegistro(id);
  const patchLocal = usePatchLocal(id);

  const [fotosRegistro, setFotosRegistro] = useState<FvsRegistro | null>(null);
  const [ncRegistro, setNcRegistro] = useState<FvsRegistro | null>(null);
  const [equipe, setEquipe] = useState<string>(registros[0]?.equipe_responsavel ?? '');
  const [editandoEquipe, setEditandoEquipe] = useState(false);

  const regime = ficha?.regime ?? 'livre';
  const podeEditar = ficha?.status === 'em_inspecao';

  const totalItens = registros.length;
  const avaliados = registros.filter(r => r.status !== 'nao_avaliado').length;
  const progresso = totalItens > 0 ? Math.round((avaliados / totalItens) * 100) : 0;

  async function handleStatusChange(reg: FvsRegistro, novoStatus: StatusRegistro) {
    if (!podeEditar) return;
    if (novoStatus === 'nao_conforme') {
      // Abrir modal NC para observação
      setNcRegistro({ ...reg, status: novoStatus });
      return;
    }
    await putRegistro.mutateAsync({
      servicoId, itemId: reg.item_id, localId, status: novoStatus,
    });
  }

  async function handleSalvarNc(obs: string) {
    if (!ncRegistro) return;
    await putRegistro.mutateAsync({
      servicoId, itemId: ncRegistro.item_id, localId,
      status: 'nao_conforme', observacao: obs,
    });
    setNcRegistro(null);
  }

  if (isLoading || !ficha) return <div style={{ padding: 24 }}>Carregando...</div>;

  const servicoNome = registros[0] ? `Serviço ${servicoId}` : `Serviço ${servicoId}`;
  const localNome = `Local ${localId}`;

  return (
    <div style={{ padding: 24 }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate(`/fvs/fichas/${id}`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, marginBottom: 8 }}
        >
          ← Voltar à Grade
        </button>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{servicoNome} — {localNome}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Progresso: {progresso}% ({avaliados}/{totalItens} itens)
          </span>
          {/* Equipe responsável */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Equipe:</span>
            {editandoEquipe ? (
              <input
                value={equipe}
                onChange={e => setEquipe(e.target.value)}
                onBlur={async () => {
                  setEditandoEquipe(false);
                  await patchLocal.mutateAsync({ localId, equipeResponsavel: equipe || null });
                }}
                autoFocus
                style={{ fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px' }}
              />
            ) : (
              <span
                onClick={() => podeEditar && setEditandoEquipe(true)}
                style={{
                  fontSize: 12, cursor: podeEditar ? 'pointer' : 'default',
                  color: equipe ? '#111827' : '#9ca3af',
                  borderBottom: podeEditar ? '1px dashed #d1d5db' : 'none',
                }}
              >
                {equipe || (podeEditar ? 'Clique para adicionar equipe...' : '—')}
              </span>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 4, marginTop: 10, width: '100%', maxWidth: 400 }}>
          <div style={{ background: '#22c55e', height: '100%', borderRadius: 99, width: `${progresso}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Tabela de itens */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', width: 32, color: '#6b7280' }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280' }}>Item de Verificação</th>
              <th style={{ padding: '8px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>Criticidade</th>
              <th style={{ padding: '8px 8px', color: '#6b7280' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280' }}>Observação</th>
              <th style={{ padding: '8px 8px', color: '#6b7280' }}>Fotos</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((reg, i) => {
              const isCriticoNcSemFoto =
                regime === 'pbqph' &&
                reg.item_criticidade === 'critico' &&
                reg.status === 'nao_conforme' &&
                reg.evidencias_count === 0;

              return (
                <tr key={reg.item_id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', color: '#111827' }}>
                    {reg.item_descricao}
                    {reg.item_criterio_aceite && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                        {reg.item_criterio_aceite}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: CRIT_COLOR[reg.item_criticidade] ?? '#6b7280',
                      textTransform: 'uppercase',
                    }}>
                      {reg.item_criticidade}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <select
                      value={reg.status}
                      disabled={!podeEditar}
                      onChange={e => handleStatusChange(reg, e.target.value as StatusRegistro)}
                      style={{
                        border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 6px',
                        fontSize: 12, cursor: podeEditar ? 'pointer' : 'default',
                        color: STATUS_OPTIONS.find(o => o.value === reg.status)?.color ?? '#111',
                      }}
                    >
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reg.status === 'nao_conforme' ? (
                      <span
                        onClick={() => podeEditar && setNcRegistro(reg)}
                        style={{ cursor: podeEditar ? 'pointer' : 'default', borderBottom: podeEditar ? '1px dashed #d1d5db' : 'none' }}
                      >
                        {reg.observacao ?? <span style={{ color: '#d1d5db' }}>sem observação</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <button
                      onClick={() => setFotosRegistro(reg)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        position: 'relative', fontSize: 18,
                      }}
                      title="Ver / adicionar fotos"
                    >
                      📷
                      {reg.evidencias_count > 0 && !isCriticoNcSemFoto && (
                        <span style={{
                          position: 'absolute', top: -4, right: -6,
                          background: '#3b82f6', color: '#fff', borderRadius: '50%',
                          width: 16, height: 16, fontSize: 10, lineHeight: '16px', textAlign: 'center',
                        }}>
                          {reg.evidencias_count}
                        </span>
                      )}
                      {isCriticoNcSemFoto && (
                        <span style={{
                          position: 'absolute', top: -4, right: -6,
                          background: '#f59e0b', color: '#fff', borderRadius: '50%',
                          width: 16, height: 16, fontSize: 10, lineHeight: '16px', textAlign: 'center',
                        }}>
                          ⚠
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modais */}
      {fotosRegistro && (
        <FotosModal
          registro={fotosRegistro}
          regime={regime}
          onClose={() => setFotosRegistro(null)}
        />
      )}

      {ncRegistro && (
        <RegistroNcModal
          registro={ncRegistro}
          regime={regime}
          onSalvar={handleSalvarNc}
          onCancelar={() => setNcRegistro(null)}
          salvando={putRegistro.isPending}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/components/ frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx
git commit -m "feat(fvs-fe): Tela 4 — FichaLocalPage, FotosModal e RegistroNcModal"
```

---

## Task 14: Wiring — App.tsx + sidebar

**Files:**
- Modify: `frontend-web/src/App.tsx`

- [ ] **Step 1: Adicionar imports no App.tsx**

Adicionar após `import CatalogoFvsPage from './modules/fvs/catalogo/CatalogoPage';`:

```tsx
import { FichasListPage } from './modules/fvs/inspecao/pages/FichasListPage';
import { AbrirFichaWizard } from './modules/fvs/inspecao/pages/AbrirFichaWizard';
import { FichaGradePage } from './modules/fvs/inspecao/pages/FichaGradePage';
import { FichaLocalPage } from './modules/fvs/inspecao/pages/FichaLocalPage';
```

- [ ] **Step 2: Adicionar rotas FVS inspeção no App.tsx**

Dentro do `<Route element={<AppLayout />}>`, após a rota do catálogo FVS, adicionar:

```tsx
{/* FVS — Inspeção */}
<Route path="/fvs/fichas" element={<FichasListPage />} />
<Route path="/fvs/fichas/nova" element={<AbrirFichaWizard />} />
<Route path="/fvs/fichas/:fichaId" element={<FichaGradePage />} />
<Route path="/fvs/fichas/:fichaId/inspecao" element={<FichaLocalPage />} />
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros. Se houver erros de tipo, corrigir antes de prosseguir.

- [ ] **Step 4: Verificar build**

```bash
cd frontend-web
npm run build 2>&1 | tail -20
```

Esperado: `built in Xs` sem erros.

- [ ] **Step 5: Commit final**

```bash
git add frontend-web/src/App.tsx
git commit -m "feat(fvs-fe): rotas FVS inspeção em App.tsx"
```

---

## Checklist de critérios de aceite

Verificar manualmente após implementação completa:

- [ ] **CA1** — `POST /fvs/fichas` cria ficha + serviços + locais em transaction; retorna 201
- [ ] **CA2** — `GET /fvs/fichas/:id/grade` retorna matriz com 4 status agregados corretamente
- [ ] **CA3** — `PATCH /fvs/fichas/:id` com `status='em_inspecao'` retorna 409 se atual ≠ `rascunho`
- [ ] **CA4** — `PUT /registros` com `regime=pbqph`, `status=nao_conforme`, sem `observacao` → 422
- [ ] **CA5** — `PUT /registros` com item `critico` NC sem evidência → salva normalmente (não bloqueia)
- [ ] **CA6** — `PATCH /fvs/fichas/:id` com `status='concluida'` e itens críticos NC sem foto → 422
- [ ] **CA7** — Toda ação listada gera linha em `fvs_audit_log` quando `regime=pbqph`
- [ ] **CA8** — `PUT /registros` com `ficha.status ≠ 'em_inspecao'` → 409
- [ ] **CA9** — Grade exibe as 4 cores corretamente no frontend
- [ ] **CA10** — `POST /evidencias` cria `GedVersao` com categoria `FTO`
- [ ] **CA11** — `DELETE /fvs/fichas/:id` retorna 409 se status ≠ `rascunho`
- [ ] **CA12** — `GET /fvs/fichas?obraId=&page=1` retorna paginado com `total` e `page`
- [ ] **CA13** — `PATCH /fichas/:fichaId/locais/:localId` atualiza `equipe_responsavel`; 409 se concluída
- [ ] **CA14** — `GET /registros` retorna `evidencias_count` e `equipe_responsavel` por item
- [ ] **CA15** — Ícone câmera clicável em qualquer item abre `FotosModal`
- [ ] **CA16** — Badge ⚠ aparece em item crítico NC sem evidência no PBQP-H
