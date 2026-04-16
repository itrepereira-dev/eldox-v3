# FVS Sprint 3 — RO, Reinspeção e Parecer do Engenheiro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo de qualidade da FVS: NCs geram um RO rastreável, cada serviço NC passa por ação corretiva e reinspeção ciclo a ciclo, e o ciclo termina com o Parecer formal do Engenheiro que aprova ou rejeita a ficha.

**Architecture:** `InspecaoService` injeta `RoService` (não circular). `autoCreateRo()` é método privado de `InspecaoService`, chamado dentro da transação de `patchFicha` ao concluir FVS com NCs. `checkAndAdvanceRoStatus()` é método público de `RoService`, chamado após `putRegistro` de ciclo > 1. `ParecerService` é independente, gerencia `solicitar-parecer` e `parecer`.

**Tech Stack:** NestJS + raw SQL (prisma.$queryRawUnsafe / $executeRawUnsafe / $transaction), class-validator DTOs, React + TanStack Query v5, inline styles

---

## Mapa de Arquivos

| Arquivo | Ação |
|---|---|
| `backend/prisma/migrations/20260409000000_fvs_sprint3_ro_parecer/migration.sql` | criar |
| `backend/src/fvs/types/fvs.types.ts` | modificar |
| `backend/src/fvs/inspecao/dto/patch-ro.dto.ts` | criar |
| `backend/src/fvs/inspecao/dto/patch-servico-nc.dto.ts` | criar |
| `backend/src/fvs/inspecao/dto/submit-parecer.dto.ts` | criar |
| `backend/src/fvs/inspecao/dto/put-registro.dto.ts` | modificar (+ciclo) |
| `backend/src/fvs/inspecao/ro.service.ts` | criar |
| `backend/src/fvs/inspecao/ro.service.spec.ts` | criar |
| `backend/src/fvs/inspecao/parecer.service.ts` | criar |
| `backend/src/fvs/inspecao/parecer.service.spec.ts` | criar |
| `backend/src/fvs/inspecao/inspecao.service.ts` | modificar |
| `backend/src/fvs/inspecao/inspecao.service.spec.ts` | modificar |
| `backend/src/fvs/inspecao/ro.controller.ts` | criar |
| `backend/src/fvs/inspecao/inspecao.controller.ts` | modificar |
| `backend/src/fvs/fvs.module.ts` | modificar |
| `frontend-web/src/services/fvs.service.ts` | modificar |
| `frontend-web/src/modules/fvs/inspecao/hooks/useRo.ts` | criar |
| `frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx` | modificar |
| `frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx` | criar |
| `frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx` | criar |
| `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx` | modificar |
| `frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx` | modificar |

---

## Task 1: Migration SQL

**Files:**
- Create: `backend/prisma/migrations/20260409000000_fvs_sprint3_ro_parecer/migration.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- migration: 20260409000000_fvs_sprint3_ro_parecer

-- ── 1. Modificar fvs_registros: adicionar ciclo + campos ai_* ─────────────────

-- Dropar UNIQUE antiga (ficha_id, item_id, obra_local_id) e criar com ciclo
ALTER TABLE fvs_registros
  DROP CONSTRAINT IF EXISTS fvs_registros_ficha_id_item_id_obra_local_id_key;

ALTER TABLE fvs_registros
  ADD COLUMN IF NOT EXISTS ciclo            INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_sugestao      VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS ai_confianca     DECIMAL(3,2) NULL,
  ADD COLUMN IF NOT EXISTS ai_observacao    TEXT NULL,
  ADD COLUMN IF NOT EXISTS ai_processado_em TIMESTAMP NULL;

ALTER TABLE fvs_registros
  ADD CONSTRAINT fvs_registros_ficha_item_local_ciclo_key
    UNIQUE (ficha_id, item_id, obra_local_id, ciclo);

-- ── 2. Registro de Ocorrência ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_ocorrencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_id            INT NOT NULL REFERENCES fvs_fichas(id),
  numero              VARCHAR(50) NOT NULL,
  tipo                VARCHAR(20) NOT NULL DEFAULT 'real',
  responsavel_id      INT NOT NULL REFERENCES "Usuario"(id),
  data_ocorrencia     DATE NOT NULL DEFAULT CURRENT_DATE,
  o_que_aconteceu     TEXT,
  acao_imediata       TEXT,
  causa_6m            VARCHAR(20),
  justificativa_causa TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'aberto',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, ficha_id)
);
CREATE INDEX IF NOT EXISTS idx_ro_ocorrencias_tenant_status ON ro_ocorrencias(tenant_id, status);

-- ── 3. Serviços NC do RO ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_servicos_nc (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_id               INT NOT NULL REFERENCES ro_ocorrencias(id) ON DELETE CASCADE,
  servico_id          INT NOT NULL,
  servico_nome        VARCHAR(200) NOT NULL,
  acao_corretiva      TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
  ciclo_reinspecao    INT NULL,
  desbloqueado_em     TIMESTAMP NULL,
  verificado_em       TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 4. Itens NC por serviço ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_servico_itens_nc (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_servico_nc_id    INT NOT NULL REFERENCES ro_servicos_nc(id) ON DELETE CASCADE,
  registro_id         INT NOT NULL REFERENCES fvs_registros(id),
  item_descricao      TEXT NOT NULL,
  item_criticidade    VARCHAR(20) NOT NULL
);

-- ── 5. Evidências da ação corretiva ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_servico_evidencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_servico_nc_id    INT NOT NULL REFERENCES ro_servicos_nc(id) ON DELETE CASCADE,
  versao_ged_id       INT NOT NULL REFERENCES ged_versoes(id),
  descricao           TEXT NULL,
  ai_sugestao         VARCHAR(20) NULL,
  ai_confianca        DECIMAL(3,2) NULL,
  ai_observacao       TEXT NULL,
  ai_processado_em    TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── 6. Parecer do Engenheiro ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvs_pareceres (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_id            INT NOT NULL REFERENCES fvs_fichas(id),
  decisao             VARCHAR(20) NOT NULL,
  observacao          TEXT,
  itens_referenciados JSONB,
  criado_por          INT NOT NULL REFERENCES "Usuario"(id),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvs_pareceres_tenant_ficha ON fvs_pareceres(tenant_id, ficha_id);
```

- [ ] **Step 2: Executar migration**

```bash
cd "backend"
npx prisma migrate deploy
```

Expected: `Migration 20260409000000_fvs_sprint3_ro_parecer applied successfully`

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/migrations/20260409000000_fvs_sprint3_ro_parecer/migration.sql
git commit -m "feat(fvs): migration sprint3 — ro_ocorrencias, fvs_pareceres, ciclos em fvs_registros"
```

---

## Task 2: Backend Types

**Files:**
- Modify: `backend/src/fvs/types/fvs.types.ts`

- [ ] **Step 1: Expandir StatusFicha e adicionar tipos RO/Parecer**

Substituir as linhas de `StatusFicha` e adicionar os novos tipos **ao final** do arquivo:

```typescript
// Substituir a linha:
// export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida';
// Por:
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
```

Adicionar ao final do arquivo (após `FvsAuditLog`):

```typescript
// ─── Sprint 3: RO, Reinspeção e Parecer ─────────────────────────────────────

export type StatusRo = 'aberto' | 'concluido';
export type StatusServicoNc = 'pendente' | 'desbloqueado' | 'verificado';
export type DecisaoParecer = 'aprovado' | 'rejeitado';
export type Causa6M = 'mao_obra' | 'material' | 'metodo' | 'gestao' | 'medida' | 'meio_ambiente' | 'maquina';

export interface RoOcorrencia {
  id: number;
  tenant_id: number;
  ficha_id: number;
  numero: string;
  tipo: 'real' | 'potencial';
  responsavel_id: number;
  data_ocorrencia: string; // DATE → string no raw SQL
  o_que_aconteceu: string | null;
  acao_imediata: string | null;
  causa_6m: Causa6M | null;
  justificativa_causa: string | null;
  status: StatusRo;
  created_at: Date;
  updated_at: Date;
  // joined
  servicos?: RoServicoNc[];
}

export interface RoServicoNc {
  id: number;
  tenant_id: number;
  ro_id: number;
  servico_id: number;
  servico_nome: string;
  acao_corretiva: string | null;
  status: StatusServicoNc;
  ciclo_reinspecao: number | null;
  desbloqueado_em: Date | null;
  verificado_em: Date | null;
  created_at: Date;
  // joined
  itens?: RoServicoItemNc[];
  evidencias?: RoServicoEvidencia[];
}

export interface RoServicoItemNc {
  id: number;
  tenant_id: number;
  ro_servico_nc_id: number;
  registro_id: number;
  item_descricao: string;
  item_criticidade: Criticidade;
}

export interface RoServicoEvidencia {
  id: number;
  tenant_id: number;
  ro_servico_nc_id: number;
  versao_ged_id: number;
  descricao: string | null;
  created_at: Date;
  // joined
  url?: string;
  nome_original?: string;
}

export interface FvsParecer {
  id: number;
  tenant_id: number;
  ficha_id: number;
  decisao: DecisaoParecer;
  observacao: string | null;
  itens_referenciados: { registro_id: number; item_descricao: string; servico_nome: string }[] | null;
  criado_por: number;
  created_at: Date;
}

// FvsRegistro com campos de ciclo e desbloqueado (Sprint 3)
export interface FvsRegistroComCiclo extends FvsRegistro {
  ciclo: number;
  desbloqueado: boolean; // item está em ro_servico_itens_nc (reinspecao desbloqueada)
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/fvs/types/fvs.types.ts
git commit -m "feat(fvs): expandir types — StatusFicha, RO, Parecer, FvsRegistroComCiclo"
```

---

## Task 3: DTOs Novos + PutRegistroDto

**Files:**
- Create: `backend/src/fvs/inspecao/dto/patch-ro.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/patch-servico-nc.dto.ts`
- Create: `backend/src/fvs/inspecao/dto/submit-parecer.dto.ts`
- Modify: `backend/src/fvs/inspecao/dto/put-registro.dto.ts`

- [ ] **Step 1: Criar patch-ro.dto.ts**

```typescript
// backend/src/fvs/inspecao/dto/patch-ro.dto.ts
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';

export class PatchRoDto {
  @IsOptional()
  @IsEnum(['real', 'potencial'])
  tipo?: 'real' | 'potencial';

  @IsOptional()
  @IsNumber()
  responsavel_id?: number;

  @IsOptional()
  @IsString()
  o_que_aconteceu?: string;

  @IsOptional()
  @IsString()
  acao_imediata?: string;

  @IsOptional()
  @IsEnum(['mao_obra', 'material', 'metodo', 'gestao', 'medida', 'meio_ambiente', 'maquina'])
  causa_6m?: string;

  @IsOptional()
  @IsString()
  justificativa_causa?: string;
}
```

- [ ] **Step 2: Criar patch-servico-nc.dto.ts**

```typescript
// backend/src/fvs/inspecao/dto/patch-servico-nc.dto.ts
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class PatchServicoNcDto {
  @IsOptional()
  @IsString()
  acao_corretiva?: string;

  @IsOptional()
  @IsBoolean()
  desbloquear?: boolean;
}
```

- [ ] **Step 3: Criar submit-parecer.dto.ts**

```typescript
// backend/src/fvs/inspecao/dto/submit-parecer.dto.ts
import { IsEnum, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ItemReferenciadoDto {
  @IsOptional() registro_id?: number;
  @IsOptional() item_descricao?: string;
  @IsOptional() servico_nome?: string;
}

export class SubmitParecerDto {
  @IsEnum(['aprovado', 'rejeitado'])
  decisao: 'aprovado' | 'rejeitado';

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemReferenciadoDto)
  itens_referenciados?: ItemReferenciadoDto[];
}
```

- [ ] **Step 4: Adicionar campo ciclo ao PutRegistroDto**

No arquivo `backend/src/fvs/inspecao/dto/put-registro.dto.ts`, adicionar o campo `ciclo` no final:

```typescript
import { IsNumber, IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';

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

  @IsOptional()
  @IsInt()
  @Min(1)
  ciclo?: number; // Sprint 3: default 1, reinspeções usam ciclo > 1
}
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/dto/
git commit -m "feat(fvs): DTOs sprint3 — PatchRoDto, PatchServicoNcDto, SubmitParecerDto, PutRegistroDto+ciclo"
```

---

## Task 4: RoService

**Files:**
- Create: `backend/src/fvs/inspecao/ro.service.spec.ts`
- Create: `backend/src/fvs/inspecao/ro.service.ts`

- [ ] **Step 1: Escrever os testes (ro.service.spec.ts)**

```typescript
// backend/src/fvs/inspecao/ro.service.spec.ts
import { NotFoundException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { RoService } from './ro.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_CONCLUIDA = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'concluida', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
};

const RO_ABERTO = {
  id: 1, tenant_id: TENANT_ID, ficha_id: 1, numero: 'RO-1-1',
  tipo: 'real', responsavel_id: USER_ID, data_ocorrencia: '2026-04-09',
  o_que_aconteceu: null, acao_imediata: null, causa_6m: null,
  justificativa_causa: null, status: 'aberto',
  created_at: new Date(), updated_at: new Date(),
};

const SERVICO_NC_PENDENTE = {
  id: 1, tenant_id: TENANT_ID, ro_id: 1, servico_id: 10,
  servico_nome: 'Alvenaria', acao_corretiva: null,
  status: 'pendente', ciclo_reinspecao: null,
  desbloqueado_em: null, verificado_em: null, created_at: new Date(),
};

const SERVICO_NC_DESBLOQUEADO = { ...SERVICO_NC_PENDENTE, status: 'desbloqueado', ciclo_reinspecao: 2 };

const ITEM_NC = {
  id: 1, tenant_id: TENANT_ID, ro_servico_nc_id: 1,
  registro_id: 10, item_descricao: 'Espessura da argamassa', item_criticidade: 'maior',
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

const mockGed = { upload: jest.fn() };

function makeService(): RoService {
  return new (RoService as any)(mockPrisma, mockGed);
}

describe('RoService', () => {
  let svc: RoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── getRo ─────────────────────────────────────────────────────────────────────
  describe('getRo()', () => {
    it('retorna RO completo com servicos e itens', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])
        .mockResolvedValueOnce([ITEM_NC])     // itens do serviço 1
        .mockResolvedValueOnce([]);           // evidencias do serviço 1

      const result = await svc.getRo(TENANT_ID, 1);
      expect(result.id).toBe(1);
      expect(result.servicos).toHaveLength(1);
      expect(result.servicos![0].itens).toHaveLength(1);
    });

    it('lança NotFoundException se RO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.getRo(TENANT_ID, 999)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchRo ───────────────────────────────────────────────────────────────────
  describe('patchRo()', () => {
    it('atualiza campos do cabeçalho do RO', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])   // buscar RO
        .mockResolvedValueOnce([{ ...RO_ABERTO, tipo: 'potencial' }]); // UPDATE
      const result = await svc.patchRo(TENANT_ID, 1, { tipo: 'potencial' });
      expect(result.tipo).toBe('potencial');
    });

    it('lança NotFoundException se RO não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(svc.patchRo(TENANT_ID, 999, {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── patchServicoNc ────────────────────────────────────────────────────────────
  describe('patchServicoNc()', () => {
    it('atualiza acao_corretiva sem desbloquear', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([RO_ABERTO])
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE])
        .mockResolvedValueOnce([{ ...SERVICO_NC_PENDENTE, acao_corretiva: 'Refazer argamassa' }]);

      const result = await svc.patchServicoNc(TENANT_ID, 1, 1, { acao_corretiva: 'Refazer argamassa' });
      expect(result.acao_corretiva).toBe('Refazer argamassa');
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('desbloquear com regime=pbqph sem campos obrigatórios → 422', async () => {
      const fichaRo = { ...RO_ABERTO };
      const fichaBase = { ...FICHA_CONCLUIDA };
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaRo])            // buscar RO
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE]) // buscar serviço
        .mockResolvedValueOnce([fichaBase]);          // buscar ficha (para regime)

      await expect(
        svc.patchServicoNc(TENANT_ID, 1, 1, { desbloquear: true }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('desbloquear serviço com campos preenchidos → cria fvs_registros ciclo=2', async () => {
      const roPreenchido = {
        ...RO_ABERTO,
        responsavel_id: USER_ID,
        causa_6m: 'material',
        tipo: 'real',
      };
      const fichaBase = { ...FICHA_CONCLUIDA };
      const itenNc = [{ id: 1, registro_id: 10, item_id: 5 }];
      const registroOriginal = {
        id: 10, tenant_id: TENANT_ID, ficha_id: 1, servico_id: 10, item_id: 5,
        obra_local_id: 20, status: 'nao_conforme', ciclo: 1,
      };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roPreenchido])        // buscar RO
        .mockResolvedValueOnce([SERVICO_NC_PENDENTE]) // buscar serviço
        .mockResolvedValueOnce([fichaBase])           // buscar ficha
        .mockResolvedValueOnce([itenNc[0]])           // buscar itens NC
        .mockResolvedValueOnce([registroOriginal])    // buscar registro original
        .mockResolvedValueOnce([{ ...SERVICO_NC_DESBLOQUEADO }]); // UPDATE servico_nc

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // INSERT fvs_registros + audit_log

      const result = await svc.patchServicoNc(TENANT_ID, 1, 1, { desbloquear: true });
      expect(result.status).toBe('desbloqueado');
      // INSERT INTO fvs_registros (ciclo=2) foi chamado
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_registros'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), 2, // ciclo=2
        'nao_avaliado', expect.anything(),
      );
    });

    it('lança ConflictException se serviço já está verificado', async () => {
      const roComVerificado = { ...RO_ABERTO };
      const servicoVerificado = { ...SERVICO_NC_PENDENTE, status: 'verificado' };
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roComVerificado])
        .mockResolvedValueOnce([servicoVerificado]);

      await expect(
        svc.patchServicoNc(TENANT_ID, 1, 1, { acao_corretiva: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── checkAndAdvanceRoStatus ───────────────────────────────────────────────────
  describe('checkAndAdvanceRoStatus()', () => {
    it('marca serviço verificado quando todos NC do ciclo são conformes', async () => {
      const roComServico = { ...RO_ABERTO };
      // Serviço desbloqueado com 1 item NC — ciclo=2 conforme
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([roComServico])                  // buscar RO da ficha
        .mockResolvedValueOnce([SERVICO_NC_DESBLOQUEADO])       // servicos desbloqueados
        .mockResolvedValueOnce([{ pendente_count: '0' }]);      // itens NC ainda pendentes = 0

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);

      // Deve marcar serviço como verificado
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'verificado'"),
        expect.anything(), // servicoNcId
      );
    });

    it('marca RO concluido quando todos servicos estao verificados', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...RO_ABERTO }])
        .mockResolvedValueOnce([SERVICO_NC_DESBLOQUEADO])
        .mockResolvedValueOnce([{ pendente_count: '0' }])    // serviço 1 ficou verificado
        .mockResolvedValueOnce([{ pendente_count: '0' }]);   // todos servicos verificados (nenhum pendente/desbloqueado)

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("status = 'concluido'"),
        expect.anything(), // roId
      );
    });

    it('não faz nada se RO não existe para a ficha', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // sem RO
      await svc.checkAndAdvanceRoStatus(TENANT_ID, 1);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Rodar os testes — verificar que falham**

```bash
cd backend
npx jest ro.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './ro.service'`

- [ ] **Step 3: Criar ro.service.ts**

```typescript
// backend/src/fvs/inspecao/ro.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';
import { UploadDocumentoDto } from '../../ged/dto/upload-documento.dto';
import type {
  RoOcorrencia, RoServicoNc, RoServicoEvidencia, FichaFvs,
} from '../types/fvs.types';
import type { PatchRoDto } from './dto/patch-ro.dto';
import type { PatchServicoNcDto } from './dto/patch-servico-nc.dto';

@Injectable()
export class RoService {
  private readonly logger = new Logger(RoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
  ) {}

  // ── getRo ───────────────────────────────────────────────────────────────────

  async getRo(tenantId: number, fichaId: number): Promise<RoOcorrencia> {
    const rows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);

    const ro = rows[0];

    const servicos = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `SELECT * FROM ro_servicos_nc WHERE ro_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
      ro.id, tenantId,
    );

    for (const svc of servicos) {
      svc.itens = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM ro_servico_itens_nc WHERE ro_servico_nc_id = $1 AND tenant_id = $2`,
        svc.id, tenantId,
      );
      svc.evidencias = await this.prisma.$queryRawUnsafe<RoServicoEvidencia[]>(
        `SELECT e.*, gv.nome_original, gv.storage_key
         FROM ro_servico_evidencias e
         JOIN ged_versoes gv ON gv.id = e.versao_ged_id
         WHERE e.ro_servico_nc_id = $1 AND e.tenant_id = $2 ORDER BY e.created_at ASC`,
        svc.id, tenantId,
      );
    }

    ro.servicos = servicos;
    return ro;
  }

  // ── patchRo ─────────────────────────────────────────────────────────────────

  async patchRo(tenantId: number, fichaId: number, dto: PatchRoDto): Promise<RoOcorrencia> {
    const roRows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);
    const ro = roRows[0];

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.tipo                !== undefined) { sets.push(`tipo = $${i++}`);                vals.push(dto.tipo); }
    if (dto.responsavel_id      !== undefined) { sets.push(`responsavel_id = $${i++}`);      vals.push(dto.responsavel_id); }
    if (dto.o_que_aconteceu     !== undefined) { sets.push(`o_que_aconteceu = $${i++}`);     vals.push(dto.o_que_aconteceu); }
    if (dto.acao_imediata       !== undefined) { sets.push(`acao_imediata = $${i++}`);       vals.push(dto.acao_imediata); }
    if (dto.causa_6m            !== undefined) { sets.push(`causa_6m = $${i++}`);            vals.push(dto.causa_6m); }
    if (dto.justificativa_causa !== undefined) { sets.push(`justificativa_causa = $${i++}`); vals.push(dto.justificativa_causa); }
    sets.push(`updated_at = NOW()`);
    vals.push(ro.id, tenantId);

    const updated = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `UPDATE ro_ocorrencias SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return updated[0];
  }

  // ── patchServicoNc ───────────────────────────────────────────────────────────

  async patchServicoNc(
    tenantId: number,
    fichaId: number,
    servicoNcId: number,
    dto: PatchServicoNcDto,
    userId?: number,
    ip?: string,
  ): Promise<RoServicoNc> {
    const roRows = await this.prisma.$queryRawUnsafe<RoOcorrencia[]>(
      `SELECT * FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) throw new NotFoundException(`RO não encontrado para ficha ${fichaId}`);
    const ro = roRows[0];

    const svcRows = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `SELECT * FROM ro_servicos_nc WHERE id = $1 AND ro_id = $2 AND tenant_id = $3`,
      servicoNcId, ro.id, tenantId,
    );
    if (!svcRows.length) throw new NotFoundException(`ServicoNC ${servicoNcId} não encontrado`);
    const svc = svcRows[0];

    if (svc.status === 'verificado') {
      throw new ConflictException(`Serviço ${servicoNcId} já está verificado — status imutável`);
    }

    if (dto.desbloquear) {
      // Buscar ficha para verificar regime
      const fichaRows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
        `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
        fichaId, tenantId,
      );
      const ficha = fichaRows[0];

      // PBQP-H: campos obrigatórios antes de desbloquear
      if (ficha?.regime === 'pbqph') {
        if (!ro.tipo || !ro.responsavel_id || !ro.causa_6m) {
          throw new UnprocessableEntityException(
            'PBQP-H: tipo, responsavel_id e causa_6m obrigatórios no RO antes de desbloquear',
          );
        }
      }

      return this.prisma.$transaction(async (tx) => {
        // Buscar itens NC do serviço
        const itens = await tx.$queryRawUnsafe<{ id: number; registro_id: number; item_id?: number }[]>(
          `SELECT rsni.id, rsni.registro_id
           FROM ro_servico_itens_nc rsni
           WHERE rsni.ro_servico_nc_id = $1 AND rsni.tenant_id = $2`,
          servicoNcId, tenantId,
        );

        // Determinar próximo ciclo
        const novoCiclo = (svc.ciclo_reinspecao ?? 1) + 1;

        // Para cada item NC, criar fvs_registros com ciclo=novoCiclo
        for (const item of itens) {
          const regOriginal = await tx.$queryRawUnsafe<any[]>(
            `SELECT * FROM fvs_registros WHERE id = $1 AND tenant_id = $2`,
            item.registro_id, tenantId,
          );
          if (!regOriginal.length) continue;
          const orig = regOriginal[0];

          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_registros
               (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, inspecionado_por, inspecionado_em)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
            tenantId, fichaId, orig.servico_id, orig.item_id, orig.obra_local_id, novoCiclo,
            'nao_avaliado', userId ?? null,
          );
        }

        // Marcar serviço como desbloqueado
        const updatedSvc = await tx.$queryRawUnsafe<RoServicoNc[]>(
          `UPDATE ro_servicos_nc
           SET status = 'desbloqueado', ciclo_reinspecao = $1, desbloqueado_em = NOW()
           WHERE id = $2 AND tenant_id = $3
           RETURNING *`,
          novoCiclo, servicoNcId, tenantId,
        );

        // Audit log (PBQP-H)
        if (ficha?.regime === 'pbqph' && userId) {
          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_audit_log
               (tenant_id, ficha_id, acao, usuario_id, ip_origem, detalhes, criado_em)
             VALUES ($1, $2, $3, $4, $5::inet, $6::jsonb, NOW())`,
            tenantId, fichaId, 'desbloqueio_servico_nc',
            userId, ip ?? null,
            JSON.stringify({ servicoNcId, novoCiclo }),
          );
        }

        return updatedSvc[0];
      });
    }

    // Apenas atualizar acao_corretiva (sem desbloquear)
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.acao_corretiva !== undefined) { sets.push(`acao_corretiva = $${i++}`); vals.push(dto.acao_corretiva); }
    if (!sets.length) return svc;

    vals.push(servicoNcId, tenantId);
    const updated = await this.prisma.$queryRawUnsafe<RoServicoNc[]>(
      `UPDATE ro_servicos_nc SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i++} RETURNING *`,
      ...vals,
    );
    return updated[0];
  }

  // ── createRoEvidencia ────────────────────────────────────────────────────────

  async createRoEvidencia(
    tenantId: number,
    fichaId: number,
    servicoNcId: number,
    userId: number,
    file: Express.Multer.File,
    descricao?: string,
    ip?: string,
  ): Promise<RoServicoEvidencia> {
    const fichaRows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!fichaRows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    const ficha = fichaRows[0];

    const catRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias WHERE codigo = 'FTO' AND tenant_id IN (0, $1) LIMIT 1`,
      tenantId,
    );
    if (!catRows.length) throw new NotFoundException('Categoria GED FTO não configurada');

    const pastaRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_pastas
       WHERE tenant_id = $1 AND obra_id = $2 AND nome = 'Evidências RO' AND escopo = 'OBRA' LIMIT 1`,
      tenantId, ficha.obra_id,
    );
    let pastaId: number;
    if (pastaRows.length) {
      pastaId = pastaRows[0].id;
    } else {
      const np = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ged_pastas (tenant_id, escopo, obra_id, nome, caminho)
         VALUES ($1, 'OBRA', $2, 'Evidências RO', '/0/') RETURNING id`,
        tenantId, ficha.obra_id,
      );
      pastaId = np[0].id;
    }

    const gedResult = await this.ged.upload(
      tenantId, userId, ficha.obra_id, file,
      {
        titulo: `RO Evidência — servico_nc ${servicoNcId}`,
        categoriaId: catRows[0].id,
        pastaId,
        escopo: 'OBRA',
      } as UploadDocumentoDto,
      ip,
    );

    const evRows = await this.prisma.$queryRawUnsafe<RoServicoEvidencia[]>(
      `INSERT INTO ro_servico_evidencias (tenant_id, ro_servico_nc_id, versao_ged_id, descricao)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      tenantId, servicoNcId, gedResult.versaoId, descricao ?? null,
    );
    return evRows[0];
  }

  // ── deleteRoEvidencia ─────────────────────────────────────────────────────────

  async deleteRoEvidencia(
    tenantId: number,
    servicoNcId: number,
    evidenciaId: number,
  ): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; versao_ged_id: number }[]>(
      `SELECT id, versao_ged_id FROM ro_servico_evidencias
       WHERE id = $1 AND ro_servico_nc_id = $2 AND tenant_id = $3`,
      evidenciaId, servicoNcId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Evidência ${evidenciaId} não encontrada`);

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM ro_servico_evidencias WHERE id = $1 AND tenant_id = $2`,
      evidenciaId, tenantId,
    );
    // Marcar versão GED como obsoleta
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_versoes SET status = 'obsoleta', atualizado_em = NOW() WHERE id = $1`,
      rows[0].versao_ged_id,
    );
  }

  // ── checkAndAdvanceRoStatus ────────────────────────────────────────────────────

  async checkAndAdvanceRoStatus(tenantId: number, fichaId: number): Promise<void> {
    const roRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 AND status = 'aberto' LIMIT 1`,
      fichaId, tenantId,
    );
    if (!roRows.length) return; // sem RO aberto → nada a fazer

    const roId = roRows[0].id;

    await this.prisma.$transaction(async (tx) => {
      // Verificar cada serviço desbloqueado
      const svcDesbloqueados = await tx.$queryRawUnsafe<{ id: number; ciclo_reinspecao: number }[]>(
        `SELECT id, ciclo_reinspecao FROM ro_servicos_nc
         WHERE ro_id = $1 AND tenant_id = $2 AND status = 'desbloqueado'`,
        roId, tenantId,
      );

      for (const svc of svcDesbloqueados) {
        // Contar itens NC deste serviço que ainda não estão conformes no ciclo de reinspeção
        const pendentes = await tx.$queryRawUnsafe<{ pendente_count: string }[]>(
          `SELECT COUNT(*) AS pendente_count
           FROM ro_servico_itens_nc rsni
           JOIN fvs_registros r
             ON r.id IN (
               SELECT id FROM fvs_registros r2
               WHERE r2.ficha_id = (SELECT ficha_id FROM ro_ocorrencias WHERE id = $1)
                 AND r2.item_id = (SELECT r3.item_id FROM fvs_registros r3 WHERE r3.id = rsni.registro_id)
                 AND r2.obra_local_id = (SELECT r3.obra_local_id FROM fvs_registros r3 WHERE r3.id = rsni.registro_id)
                 AND r2.ciclo = $2
                 AND r2.tenant_id = $3
             )
             AND r.status <> 'conforme'
           WHERE rsni.ro_servico_nc_id = $4 AND rsni.tenant_id = $3`,
          roId, svc.ciclo_reinspecao, tenantId, svc.id,
        );

        if (Number(pendentes[0].pendente_count) === 0) {
          await tx.$executeRawUnsafe(
            `UPDATE ro_servicos_nc SET status = 'verificado', verificado_em = NOW() WHERE id = $1`,
            svc.id,
          );
        }
      }

      // Verificar se todos os serviços do RO estão verificados
      const naoVerificados = await tx.$queryRawUnsafe<{ pendente_count: string }[]>(
        `SELECT COUNT(*) AS pendente_count FROM ro_servicos_nc
         WHERE ro_id = $1 AND tenant_id = $2 AND status IN ('pendente', 'desbloqueado')`,
        roId, tenantId,
      );

      if (Number(naoVerificados[0].pendente_count) === 0) {
        await tx.$executeRawUnsafe(
          `UPDATE ro_ocorrencias SET status = 'concluido', updated_at = NOW() WHERE id = $1`,
          roId,
        );
      }
    });
  }
}
```

- [ ] **Step 4: Rodar testes — verificar que passam**

```bash
cd backend
npx jest ro.service.spec.ts --no-coverage
```

Expected: PASS — todos os testes verdes

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/ro.service.ts backend/src/fvs/inspecao/ro.service.spec.ts
git commit -m "feat(fvs): RoService — getRo, patchRo, patchServicoNc, evidencias, checkAndAdvanceRoStatus"
```

---

## Task 5: ParecerService

**Files:**
- Create: `backend/src/fvs/inspecao/parecer.service.spec.ts`
- Create: `backend/src/fvs/inspecao/parecer.service.ts`

- [ ] **Step 1: Escrever os testes (parecer.service.spec.ts)**

```typescript
// backend/src/fvs/inspecao/parecer.service.spec.ts
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ParecerService } from './parecer.service';

const TENANT_ID = 5;
const USER_ID = 42;

const FICHA_CONCLUIDA = {
  id: 1, tenant_id: TENANT_ID, obra_id: 10, nome: 'FVS Torre 1',
  regime: 'pbqph', status: 'concluida', criado_por: USER_ID,
  created_at: new Date(), updated_at: new Date(), deleted_at: null,
  exige_parecer: true,
};

const FICHA_AGUARDANDO = { ...FICHA_CONCLUIDA, status: 'aguardando_parecer' };
const FICHA_LIVRE_CONCLUIDA = { ...FICHA_CONCLUIDA, regime: 'livre' };

const RO_CONCLUIDO = {
  id: 1, tenant_id: TENANT_ID, ficha_id: 1, numero: 'RO-1-1',
  tipo: 'real', responsavel_id: USER_ID, data_ocorrencia: '2026-04-09',
  status: 'concluido', created_at: new Date(), updated_at: new Date(),
};

const RO_ABERTO = { ...RO_CONCLUIDO, status: 'aberto' };

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): ParecerService {
  return new (ParecerService as any)(mockPrisma);
}

describe('ParecerService', () => {
  let svc: ParecerService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── solicitarParecer ─────────────────────────────────────────────────────────
  describe('solicitarParecer()', () => {
    it('transita concluida → aguardando_parecer quando sem RO', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])  // getFicha
        .mockResolvedValueOnce([])                  // sem RO
        .mockResolvedValueOnce([FICHA_AGUARDANDO]); // UPDATE
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.solicitarParecer(TENANT_ID, 1, USER_ID, '127.0.0.1');
      expect(result.status).toBe('aguardando_parecer');
    });

    it('transita quando RO existe e está concluido', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])  // getFicha
        .mockResolvedValueOnce([RO_CONCLUIDO])     // RO concluido
        .mockResolvedValueOnce([FICHA_AGUARDANDO]); // UPDATE
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.solicitarParecer(TENANT_ID, 1, USER_ID, '127.0.0.1');
      expect(result.status).toBe('aguardando_parecer');
    });

    it('retorna 409 quando RO existe e está aberto', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_CONCLUIDA])
        .mockResolvedValueOnce([RO_ABERTO]);

      await expect(svc.solicitarParecer(TENANT_ID, 1, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    });

    it('retorna 409 quando ficha não está concluida', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([{ ...FICHA_CONCLUIDA, status: 'em_inspecao' }]);
      await expect(svc.solicitarParecer(TENANT_ID, 1, USER_ID)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ── submitParecer ────────────────────────────────────────────────────────────
  describe('submitParecer()', () => {
    it('aprovado: FVS → aprovada', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_AGUARDANDO])
        .mockResolvedValueOnce([{ id: 99 }])        // INSERT parecer
        .mockResolvedValueOnce([{ ...FICHA_AGUARDANDO, status: 'aprovada' }]); // UPDATE ficha
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'aprovado' }, '127.0.0.1');
      expect(result.status).toBe('aprovada');
    });

    it('rejeitado (livre): FVS → em_inspecao, cria registros ciclo+1', async () => {
      const fichaLivre = { ...FICHA_LIVRE_CONCLUIDA, status: 'aguardando_parecer' };
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaLivre])
        .mockResolvedValueOnce([{ id: 99 }])   // INSERT parecer
        .mockResolvedValueOnce([{ max_ciclo: '1' }])  // MAX ciclo
        .mockResolvedValueOnce([{ id: 5, item_id: 1, servico_id: 10, obra_local_id: 20 }]) // itens NC ciclo atual
        .mockResolvedValueOnce([{ ...fichaLivre, status: 'em_inspecao' }]); // UPDATE ficha
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // INSERT registros ciclo+1

      const result = await svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'rejeitado', observacao: 'Pendências encontradas' });
      expect(result.status).toBe('em_inspecao');
    });

    it('rejeitado PBQP-H sem observacao → 422', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_AGUARDANDO]);
      await expect(
        svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'rejeitado' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('retorna 409 se ficha não está aguardando_parecer', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([FICHA_CONCLUIDA]);
      await expect(
        svc.submitParecer(TENANT_ID, 1, USER_ID, { decisao: 'aprovado' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
```

- [ ] **Step 2: Rodar os testes — verificar que falham**

```bash
cd backend
npx jest parecer.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './parecer.service'`

- [ ] **Step 3: Criar parecer.service.ts**

```typescript
// backend/src/fvs/inspecao/parecer.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FichaFvs } from '../types/fvs.types';
import type { SubmitParecerDto } from './dto/submit-parecer.dto';

@Injectable()
export class ParecerService {
  private readonly logger = new Logger(ParecerService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getFichaOuFalhar(tenantId: number, fichaId: number): Promise<FichaFvs> {
    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    return rows[0];
  }

  // ── solicitarParecer ─────────────────────────────────────────────────────────

  async solicitarParecer(
    tenantId: number,
    fichaId: number,
    userId: number,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'concluida') {
      throw new ConflictException(
        `Não é possível solicitar parecer: ficha está ${ficha.status} (esperado: concluida)`,
      );
    }

    // Verificar RO: se existe, deve estar concluido
    const roRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string }[]>(
      `SELECT id, status FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2 LIMIT 1`,
      fichaId, tenantId,
    );

    if (roRows.length && roRows[0].status !== 'concluido') {
      throw new ConflictException(
        'RO ainda em aberto — conclua todas as reinspeções antes de solicitar parecer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET status = 'aguardando_parecer', updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2 RETURNING *`,
        fichaId, tenantId,
      );

      if (ficha.regime === 'pbqph') {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_audit_log
             (tenant_id, ficha_id, acao, status_de, status_para, usuario_id, ip_origem, criado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7::inet, NOW())`,
          tenantId, fichaId, 'solicitar_parecer',
          'concluida', 'aguardando_parecer', userId, ip ?? null,
        );
      }

      return updated[0];
    });
  }

  // ── submitParecer ────────────────────────────────────────────────────────────

  async submitParecer(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: SubmitParecerDto,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'aguardando_parecer') {
      throw new ConflictException(
        `Ficha não está aguardando parecer (status: ${ficha.status})`,
      );
    }

    // PBQP-H: observação obrigatória em rejeição
    if (ficha.regime === 'pbqph' && dto.decisao === 'rejeitado' && !dto.observacao?.trim()) {
      throw new UnprocessableEntityException(
        'PBQP-H: observação obrigatória no parecer de rejeição',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Inserir parecer (append-only)
      await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_pareceres (tenant_id, ficha_id, decisao, observacao, itens_referenciados, criado_por)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
        tenantId, fichaId, dto.decisao,
        dto.observacao ?? null,
        dto.itens_referenciados ? JSON.stringify(dto.itens_referenciados) : null,
        userId,
      );

      let novoStatus: string;

      if (dto.decisao === 'aprovado') {
        novoStatus = 'aprovada';
      } else {
        // Rejeitado: criar fvs_registros ciclo+1 para todos os itens NC do ciclo atual
        const maxCicloRows = await tx.$queryRawUnsafe<{ max_ciclo: string }[]>(
          `SELECT COALESCE(MAX(ciclo), 1) AS max_ciclo FROM fvs_registros
           WHERE ficha_id = $1 AND tenant_id = $2`,
          fichaId, tenantId,
        );
        const cicloAtual = Number(maxCicloRows[0].max_ciclo);
        const novoCiclo = cicloAtual + 1;

        const itensNc = await tx.$queryRawUnsafe<{ id: number; item_id: number; servico_id: number; obra_local_id: number }[]>(
          `SELECT DISTINCT ON (item_id, obra_local_id) id, item_id, servico_id, obra_local_id
           FROM fvs_registros
           WHERE ficha_id = $1 AND tenant_id = $2 AND status = 'nao_conforme' AND ciclo = $3`,
          fichaId, tenantId, cicloAtual,
        );

        for (const item of itensNc) {
          await tx.$executeRawUnsafe(
            `INSERT INTO fvs_registros
               (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, inspecionado_por, inspecionado_em)
             VALUES ($1, $2, $3, $4, $5, $6, 'nao_avaliado', $7, NOW())
             ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
            tenantId, fichaId, item.servico_id, item.item_id, item.obra_local_id, novoCiclo, userId,
          );
        }

        novoStatus = 'em_inspecao';
      }

      const updated = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET status = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3 RETURNING *`,
        novoStatus, fichaId, tenantId,
      );

      // Audit log (PBQP-H)
      if (ficha.regime === 'pbqph') {
        await tx.$executeRawUnsafe(
          `INSERT INTO fvs_audit_log
             (tenant_id, ficha_id, acao, status_de, status_para, usuario_id, ip_origem, detalhes, criado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8::jsonb, NOW())`,
          tenantId, fichaId, 'emissao_parecer',
          'aguardando_parecer', novoStatus, userId, ip ?? null,
          JSON.stringify({ decisao: dto.decisao }),
        );
      }

      return updated[0];
    });
  }
}
```

- [ ] **Step 4: Rodar testes — verificar que passam**

```bash
cd backend
npx jest parecer.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/parecer.service.ts backend/src/fvs/inspecao/parecer.service.spec.ts
git commit -m "feat(fvs): ParecerService — solicitarParecer, submitParecer com máquina de estados"
```

---

## Task 6: InspecaoService — Modificações

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever testes adicionais em inspecao.service.spec.ts**

Adicionar os seguintes blocos `describe` ao final do arquivo `inspecao.service.spec.ts`, ANTES do `});` final:

```typescript
  // ── autoCreateRo (via patchFicha em_inspecao→concluida) ──────────────────────
  describe('patchFicha() em_inspecao→concluida com NCs → autoCreateRo', () => {
    it('cria ro_ocorrencias quando há itens NC ao concluir', async () => {
      const fichaEmInspecao = { ...FICHA_EM_INSPECAO };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([fichaEmInspecao])       // getFichaOuFalhar
        // validarConclusaoPbqph: sem itens críticos sem foto
        .mockResolvedValueOnce([])
        // UPDATE fvs_fichas
        .mockResolvedValueOnce([{ ...fichaEmInspecao, status: 'concluida' }])
        // autoCreateRo: buscar itens NC
        .mockResolvedValueOnce([{
          registro_id: 5, item_id: 3, servico_id: 10, obra_local_id: 20,
          item_descricao: 'Prumo da alvenaria', item_criticidade: 'maior',
          servico_nome: 'Alvenaria',
        }])
        // INSERT ro_ocorrencias
        .mockResolvedValueOnce([{ id: 1, numero: 'RO-1-1' }])
        // INSERT ro_servicos_nc
        .mockResolvedValueOnce([{ id: 1 }]);

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log + INSERT ro_servico_itens_nc

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      expect(result.status).toBe('concluida');
      // ro_ocorrencias inserido
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ro_ocorrencias'),
        expect.anything(), expect.anything(), expect.anything(),
        expect.anything(), expect.anything(), expect.anything(),
      );
    });

    it('NÃO cria RO quando não há NCs', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])     // getFichaOuFalhar
        .mockResolvedValueOnce([])                       // validarConclusaoPbqph
        .mockResolvedValueOnce([{ ...FICHA_EM_INSPECAO, status: 'concluida' }]) // UPDATE
        .mockResolvedValueOnce([]);                      // autoCreateRo: sem NCs

      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      const result = await svc.patchFicha(TENANT_ID, 1, USER_ID, { status: 'concluida' }, '127.0.0.1');
      expect(result.status).toBe('concluida');
      // ro_ocorrencias NÃO foi inserido
      const insertRoCalls = (mockPrisma.$queryRawUnsafe as jest.Mock).mock.calls
        .filter((call: any[]) => typeof call[0] === 'string' && call[0].includes('INSERT INTO ro_ocorrencias'));
      expect(insertRoCalls).toHaveLength(0);
    });
  });

  // ── getGrade ciclo-aware ──────────────────────────────────────────────────────
  describe('getGrade() com ciclos', () => {
    it('usa ciclo mais recente por item para calcular status da célula', async () => {
      // Item teve NC no ciclo 1, mas conforme no ciclo 2 → célula deve ser 'aprovado'
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria' }])
        .mockResolvedValueOnce([{ id: 10, nome: 'Ap 101', pavimento_id: 1 }])
        // getGrade retorna status do ciclo mais recente por (servico_id, obra_local_id)
        .mockResolvedValueOnce([{ servico_id: 1, obra_local_id: 10, status: 'conforme' }]);

      const result = await svc.getGrade(TENANT_ID, 1);
      expect(result.celulas[1][10]).toBe('aprovado');
    });
  });

  // ── putRegistro com ciclo > 1 ─────────────────────────────────────────────────
  describe('putRegistro() com ciclo > 1 (reinspeção)', () => {
    it('salva registro com ciclo=2 e chama checkAndAdvanceRoStatus', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])          // getFichaOuFalhar
        .mockResolvedValueOnce([{ criticidade: 'maior' }])   // buscar item
        .mockResolvedValueOnce([{ id: 5, status: 'conforme', ciclo: 2 }]); // upsert retorno
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined); // audit_log

      // checkAndAdvanceRoStatus é mockado via mockRoService
      const mockRoService = { checkAndAdvanceRoStatus: jest.fn().mockResolvedValue(undefined) };
      const svcComRo = new (InspecaoService as any)(mockPrisma, {}, mockRoService);

      const result = await svcComRo.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'conforme', ciclo: 2,
      }, '127.0.0.1');

      expect(result.status).toBe('conforme');
      expect(mockRoService.checkAndAdvanceRoStatus).toHaveBeenCalledWith(TENANT_ID, 1);
    });

    it('NÃO chama checkAndAdvanceRoStatus para ciclo=1', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([FICHA_EM_INSPECAO])
        .mockResolvedValueOnce([{ criticidade: 'menor' }])
        .mockResolvedValueOnce([{ id: 5, status: 'conforme', ciclo: 1 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const mockRoService = { checkAndAdvanceRoStatus: jest.fn() };
      const svcComRo = new (InspecaoService as any)(mockPrisma, {}, mockRoService);

      await svcComRo.putRegistro(TENANT_ID, 1, USER_ID, {
        servicoId: 1, itemId: 1, localId: 1, status: 'conforme',
        // ciclo não informado → padrão 1
      }, '127.0.0.1');

      expect(mockRoService.checkAndAdvanceRoStatus).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Rodar testes novos — verificar que falham**

```bash
cd backend
npx jest inspecao.service.spec.ts --no-coverage
```

Expected: falham os 3 novos describes (autoCreateRo, getGrade ciclo-aware, putRegistro ciclo>1)

- [ ] **Step 3: Modificar inspecao.service.ts**

**3a. Adicionar imports e RoService no construtor:**

```typescript
// Adicionar ao import existente:
import { RoService } from './ro.service';
import type { FvsRegistroComCiclo } from '../types/fvs.types';
```

Substituir o construtor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly ged: GedService,
  private readonly roService: RoService,
) {}
```

**3b. Atualizar TRANSICOES_VALIDAS** (para aceitar os novos estados em patchFicha, mesmo que solicitar-parecer e parecer usem endpoints separados):

```typescript
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  rascunho: ['em_inspecao'],
  em_inspecao: ['concluida', 'rascunho'],
  concluida: ['em_inspecao'],          // reabrir manualmente ainda permitido
  aguardando_parecer: [],              // transições gerenciadas por ParecerService
  aprovada: [],                        // estado final
};
```

**3c. Adicionar método privado autoCreateRo** (antes de `createFicha`):

```typescript
private async autoCreateRo(
  tx: any,
  tenantId: number,
  fichaId: number,
  userId: number,
  regime: string,
  ip?: string,
): Promise<void> {
  // Buscar todos os itens NC do ciclo mais recente por item+local
  const itensNc = await tx.$queryRawUnsafe<{
    registro_id: number; item_id: number; servico_id: number; obra_local_id: number;
    item_descricao: string; item_criticidade: string; servico_nome: string;
  }[]>(
    `SELECT DISTINCT ON (r.item_id, r.obra_local_id)
       r.id AS registro_id, r.item_id, r.servico_id, r.obra_local_id,
       i.descricao AS item_descricao, i.criticidade AS item_criticidade,
       s.nome AS servico_nome
     FROM fvs_registros r
     JOIN fvs_catalogo_itens i ON i.id = r.item_id
     JOIN fvs_catalogo_servicos s ON s.id = r.servico_id
     WHERE r.ficha_id = $1 AND r.tenant_id = $2 AND r.status = 'nao_conforme'
     ORDER BY r.item_id, r.obra_local_id, r.ciclo DESC`,
    fichaId, tenantId,
  );

  if (!itensNc.length) return; // sem NCs, não cria RO

  const numero = `RO-${fichaId}-1`;

  const roRows = await tx.$queryRawUnsafe<{ id: number }[]>(
    `INSERT INTO ro_ocorrencias (tenant_id, ficha_id, numero, responsavel_id, status)
     VALUES ($1, $2, $3, $4, 'aberto') RETURNING id`,
    tenantId, fichaId, numero, userId,
  );
  const roId = roRows[0].id;

  // Agrupar itens por servico_id
  const porServico = new Map<number, { servicoNome: string; itens: typeof itensNc }>();
  for (const item of itensNc) {
    if (!porServico.has(item.servico_id)) {
      porServico.set(item.servico_id, { servicoNome: item.servico_nome, itens: [] });
    }
    porServico.get(item.servico_id)!.itens.push(item);
  }

  for (const [servicoId, { servicoNome, itens }] of porServico) {
    const svcRows = await tx.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO ro_servicos_nc (tenant_id, ro_id, servico_id, servico_nome)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      tenantId, roId, servicoId, servicoNome,
    );
    const svcNcId = svcRows[0].id;

    for (const item of itens) {
      await tx.$executeRawUnsafe(
        `INSERT INTO ro_servico_itens_nc (tenant_id, ro_servico_nc_id, registro_id, item_descricao, item_criticidade)
         VALUES ($1, $2, $3, $4, $5)`,
        tenantId, svcNcId, item.registro_id, item.item_descricao, item.item_criticidade,
      );
    }
  }

  // Audit log (PBQP-H)
  if (regime === 'pbqph') {
    await tx.$executeRawUnsafe(
      `INSERT INTO fvs_audit_log
         (tenant_id, ficha_id, acao, status_para, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6::inet, $7::jsonb, NOW())`,
      tenantId, fichaId, 'criacao_ro', 'concluida', userId, ip ?? null,
      JSON.stringify({ roId, totalServicos: porServico.size, totalItens: itensNc.length }),
    );
  }
}
```

**3d. Modificar `patchFicha` para chamar `autoCreateRo` ao concluir:**

Dentro do bloco `return this.prisma.$transaction(async (tx) => {`, após a linha `if (!rows.length) throw new NotFoundException(...)`, adicionar chamada a autoCreateRo quando transição for `em_inspecao → concluida`:

```typescript
      // Após: if (!rows.length) throw new NotFoundException(...)
      const fichaAtualizada = rows[0];

      if (dto.status === 'concluida' && ficha.status === 'em_inspecao') {
        await this.autoCreateRo(tx, tenantId, fichaId, userId, ficha.regime, ip);
      }

      if (dto.status && dto.status !== ficha.status && ficha.regime === 'pbqph') {
        await this.gravarAuditLog(tx, { ... }); // linha já existente
      }

      return fichaAtualizada;
```

**3e. Modificar `getGrade` para usar ciclo mais recente por célula:**

Substituir a query dos registros (última query em getGrade):

```typescript
    // Substituir:
    // const registros = await this.prisma.$queryRawUnsafe<{ servico_id: number; obra_local_id: number; status: string }[]>(
    //   `SELECT servico_id, obra_local_id, status FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
    //   fichaId, tenantId,
    // );
    // Por:
    const registros = await this.prisma.$queryRawUnsafe<{ servico_id: number; obra_local_id: number; status: string }[]>(
      `SELECT DISTINCT ON (item_id, obra_local_id)
         servico_id, obra_local_id, status
       FROM fvs_registros
       WHERE ficha_id = $1 AND tenant_id = $2
       ORDER BY item_id, obra_local_id, ciclo DESC`,
      fichaId, tenantId,
    );
```

**3f. Modificar `getRegistros` para retornar desbloqueado e ciclo mais recente:**

Substituir a query do `getRegistros` inteira pelo seguinte:

```typescript
    return this.prisma.$queryRawUnsafe<FvsRegistroComCiclo[]>(
      `SELECT
         i.id           AS item_id,
         i.descricao    AS item_descricao,
         i.criticidade  AS item_criticidade,
         i.criterio_aceite AS item_criterio_aceite,
         COALESCE(latest_r.status, 'nao_avaliado') AS status,
         latest_r.id,
         latest_r.ficha_id,
         latest_r.servico_id,
         latest_r.obra_local_id,
         COALESCE(latest_r.ciclo, 1) AS ciclo,
         latest_r.observacao,
         latest_r.inspecionado_por,
         latest_r.inspecionado_em,
         latest_r.created_at,
         latest_r.updated_at,
         COUNT(e.id)::int AS evidencias_count,
         fsl.equipe_responsavel,
         CASE WHEN ro_nc.item_id IS NOT NULL THEN true ELSE false END AS desbloqueado
       FROM fvs_catalogo_itens i
       JOIN fvs_ficha_servicos fs
         ON fs.servico_id = $2 AND fs.ficha_id = $3 AND fs.tenant_id = $4
       LEFT JOIN LATERAL (
         SELECT * FROM fvs_registros r
         WHERE r.item_id = i.id AND r.ficha_id = $3 AND r.obra_local_id = $5 AND r.tenant_id = $4
         ORDER BY r.ciclo DESC
         LIMIT 1
       ) latest_r ON true
       LEFT JOIN fvs_evidencias e ON e.registro_id = latest_r.id AND e.tenant_id = $4
       LEFT JOIN fvs_ficha_servico_locais fsl
         ON fsl.ficha_servico_id = fs.id AND fsl.obra_local_id = $5
       LEFT JOIN (
         SELECT DISTINCT r_orig.item_id, r_orig.obra_local_id
         FROM ro_servico_itens_nc rsni
         JOIN ro_servicos_nc rsn ON rsn.id = rsni.ro_servico_nc_id
         JOIN ro_ocorrencias ro ON ro.id = rsn.ro_id
         JOIN fvs_registros r_orig ON r_orig.id = rsni.registro_id
         WHERE ro.ficha_id = $3 AND ro.tenant_id = $4
       ) ro_nc ON ro_nc.item_id = i.id AND ro_nc.obra_local_id = $5
       WHERE i.servico_id = $2 AND i.tenant_id IN (0, $4) AND i.ativo = true
         AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))
       GROUP BY i.id, i.descricao, i.criticidade, i.criterio_aceite,
                latest_r.id, latest_r.ficha_id, latest_r.servico_id, latest_r.obra_local_id,
                latest_r.status, latest_r.ciclo, latest_r.observacao,
                latest_r.inspecionado_por, latest_r.inspecionado_em,
                latest_r.created_at, latest_r.updated_at,
                fsl.equipe_responsavel, ro_nc.item_id
       ORDER BY i.ordem ASC`,
      tenantId, servicoId, fichaId, tenantId, localId,
    );
```

**3g. Modificar `putRegistro` para aceitar ciclo e chamar checkAndAdvanceRoStatus:**

```typescript
  async putRegistro(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: PutRegistroDto,
    ip?: string,
  ): Promise<FvsRegistroComCiclo> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (ficha.status !== 'em_inspecao') {
      throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
    }

    if (ficha.regime === 'pbqph' && dto.status === 'nao_conforme') {
      if (!dto.observacao?.trim()) {
        throw new UnprocessableEntityException(
          'Observação obrigatória para item não conforme em regime PBQP-H',
        );
      }
    }

    const itemRows = await this.prisma.$queryRawUnsafe<{ criticidade: string }[]>(
      `SELECT criticidade FROM fvs_catalogo_itens WHERE id = $1 AND tenant_id IN (0, $2)`,
      dto.itemId, tenantId,
    );
    const criticidade = itemRows[0]?.criticidade ?? 'menor';
    const ciclo = dto.ciclo ?? 1;

    const rows = await this.prisma.$queryRawUnsafe<FvsRegistroComCiclo[]>(
      `INSERT INTO fvs_registros
         (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, observacao, inspecionado_por, inspecionado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO UPDATE SET
         status           = EXCLUDED.status,
         observacao       = EXCLUDED.observacao,
         inspecionado_por = EXCLUDED.inspecionado_por,
         inspecionado_em  = EXCLUDED.inspecionado_em,
         updated_at       = NOW()
       RETURNING *`,
      tenantId, fichaId, dto.servicoId, dto.itemId, dto.localId, ciclo,
      dto.status, dto.observacao ?? null, userId,
    );

    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId, usuarioId: userId,
        acao: 'inspecao', registroId: rows[0].id, ip,
        statusPara: dto.status,
        detalhes: { itemId: dto.itemId, localId: dto.localId, criticidade, ciclo },
      });
    }

    // Sprint 3: se ciclo > 1 (reinspeção), verificar avanço do RO
    if (ciclo > 1) {
      await this.roService.checkAndAdvanceRoStatus(tenantId, fichaId);
    }

    return rows[0];
  }
```

- [ ] **Step 4: Rodar todos os testes — verificar que passam**

```bash
cd backend
npx jest inspecao.service.spec.ts ro.service.spec.ts parecer.service.spec.ts --no-coverage
```

Expected: PASS em todos

- [ ] **Step 5: Commit**

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): InspecaoService — autoCreateRo, getGrade ciclo-aware, getRegistros+desbloqueado, putRegistro+ciclo"
```

---

## Task 7: RoController + InspecaoController + Module

**Files:**
- Create: `backend/src/fvs/inspecao/ro.controller.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.controller.ts`
- Modify: `backend/src/fvs/fvs.module.ts`

- [ ] **Step 1: Criar ro.controller.ts**

```typescript
// backend/src/fvs/inspecao/ro.controller.ts
import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Ip,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { RoService } from './ro.service';
import { PatchRoDto } from './dto/patch-ro.dto';
import { PatchServicoNcDto } from './dto/patch-servico-nc.dto';

interface JwtUser { sub: number; tenantId: number; role: string }

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoController {
  constructor(private readonly ro: RoService) {}

  @Get('fichas/:fichaId/ro')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRo(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
  ) {
    return this.ro.getRo(tenantId, fichaId);
  }

  @Patch('fichas/:fichaId/ro')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchRo(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Body() dto: PatchRoDto,
  ) {
    return this.ro.patchRo(tenantId, fichaId, dto);
  }

  @Patch('fichas/:fichaId/ro/servicos/:servicoNcId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  patchServicoNc(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @Body() dto: PatchServicoNcDto,
    @Ip() ip: string,
  ) {
    return this.ro.patchServicoNc(tenantId, fichaId, servicoNcId, dto, user.sub, ip);
  }

  @Post('fichas/:fichaId/ro/servicos/:servicoNcId/evidencias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('arquivo'))
  createRoEvidencia(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @UploadedFile() file: Express.Multer.File,
    @Ip() ip: string,
  ) {
    const descricao = undefined; // pode adicionar @Body('descricao') depois se necessário
    return this.ro.createRoEvidencia(tenantId, fichaId, servicoNcId, user.sub, file, descricao, ip);
  }

  @Delete('fichas/:fichaId/ro/servicos/:servicoNcId/evidencias/:evidenciaId')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRoEvidencia(
    @TenantId() tenantId: number,
    @Param('fichaId', ParseIntPipe) fichaId: number,
    @Param('servicoNcId', ParseIntPipe) servicoNcId: number,
    @Param('evidenciaId', ParseIntPipe) evidenciaId: number,
  ) {
    return this.ro.deleteRoEvidencia(tenantId, servicoNcId, evidenciaId);
  }
}
```

- [ ] **Step 2: Adicionar endpoints solicitar-parecer e parecer ao InspecaoController**

Adicionar import `ParecerService` e `SubmitParecerDto` no topo do `inspecao.controller.ts`:

```typescript
import { ParecerService } from './parecer.service';
import { SubmitParecerDto } from './dto/submit-parecer.dto';
```

Injetar no construtor:

```typescript
constructor(
  private readonly inspecao: InspecaoService,
  private readonly parecer: ParecerService,
) {}
```

Adicionar os endpoints ao final da classe:

```typescript
  // ─── Parecer ─────────────────────────────────────────────────────────────────

  @Post('fichas/:id/solicitar-parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.OK)
  solicitarParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Ip() ip: string,
  ) {
    return this.parecer.solicitarParecer(tenantId, id, user.sub, ip);
  }

  @Post('fichas/:id/parecer')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  submitParecer(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitParecerDto,
    @Ip() ip: string,
  ) {
    return this.parecer.submitParecer(tenantId, id, user.sub, dto, ip);
  }
```

- [ ] **Step 3: Atualizar fvs.module.ts**

```typescript
// backend/src/fvs/fvs.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { GedModule } from '../ged/ged.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';
import { InspecaoService } from './inspecao/inspecao.service';
import { InspecaoController } from './inspecao/inspecao.controller';
import { RoService } from './inspecao/ro.service';
import { RoController } from './inspecao/ro.controller';
import { ParecerService } from './inspecao/parecer.service';

@Module({
  imports: [
    PrismaModule,
    GedModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  providers: [CatalogoService, InspecaoService, RoService, ParecerService],
  controllers: [CatalogoController, InspecaoController, RoController],
  exports: [CatalogoService, InspecaoService, RoService, ParecerService],
})
export class FvsModule {}
```

- [ ] **Step 4: Verificar que o backend compila**

```bash
cd backend
npx tsc --noEmit
```

Expected: sem erros de compilação

- [ ] **Step 5: Rodar todos os testes**

```bash
cd backend
npx jest --testPathPattern="fvs" --no-coverage
```

Expected: PASS em todos

- [ ] **Step 6: Commit**

```bash
git add backend/src/fvs/
git commit -m "feat(fvs): RoController, endpoints solicitar-parecer/parecer, module atualizado"
```

---

## Task 8: Frontend — fvs.service.ts

**Files:**
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 1: Adicionar tipos RO e Parecer ao fvs.service.ts**

Após a linha `export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida';`, substituir por:

```typescript
export type StatusFicha = 'rascunho' | 'em_inspecao' | 'concluida' | 'aguardando_parecer' | 'aprovada';
export type StatusRo = 'aberto' | 'concluido';
export type StatusServicoNc = 'pendente' | 'desbloqueado' | 'verificado';
export type DecisaoParecer = 'aprovado' | 'rejeitado';

export interface RoServicoItemNc {
  id: number;
  ro_servico_nc_id: number;
  registro_id: number;
  item_descricao: string;
  item_criticidade: Criticidade;
}

export interface RoServicoEvidencia {
  id: number;
  ro_servico_nc_id: number;
  versao_ged_id: number;
  descricao: string | null;
  created_at: string;
  url?: string;
  nome_original?: string;
}

export interface RoServicoNc {
  id: number;
  ro_id: number;
  servico_id: number;
  servico_nome: string;
  acao_corretiva: string | null;
  status: StatusServicoNc;
  ciclo_reinspecao: number | null;
  desbloqueado_em: string | null;
  verificado_em: string | null;
  created_at: string;
  itens?: RoServicoItemNc[];
  evidencias?: RoServicoEvidencia[];
}

export interface RoOcorrencia {
  id: number;
  ficha_id: number;
  numero: string;
  tipo: 'real' | 'potencial';
  responsavel_id: number;
  data_ocorrencia: string;
  o_que_aconteceu: string | null;
  acao_imediata: string | null;
  causa_6m: string | null;
  justificativa_causa: string | null;
  status: StatusRo;
  created_at: string;
  updated_at: string;
  servicos?: RoServicoNc[];
}

export interface SubmitParecerPayload {
  decisao: DecisaoParecer;
  observacao?: string;
  itens_referenciados?: { registro_id: number; item_descricao: string; servico_nome: string }[];
}

export interface FvsRegistro {
  // ... manter campos existentes + adicionar:
  id: number;
  tenant_id?: number;
  ficha_id?: number;
  servico_id?: number;
  item_id: number;
  obra_local_id?: number;
  status: StatusRegistro;
  observacao: string | null;
  inspecionado_por: number | null;
  inspecionado_em: string | null;
  created_at?: string;
  updated_at?: string;
  item_descricao?: string;
  item_criticidade?: Criticidade;
  item_criterio_aceite?: string | null;
  evidencias_count?: number;
  equipe_responsavel?: string | null;
  ciclo?: number;          // Sprint 3
  desbloqueado?: boolean;  // Sprint 3
}
```

- [ ] **Step 2: Adicionar métodos de API ao objeto fvsService**

Adicionar após os métodos existentes de `patchFicha`/`deleteFicha`:

```typescript
  // ─── RO ─────────────────────────────────────────────────────────────────────

  async getRo(fichaId: number): Promise<RoOcorrencia> {
    const res = await api.get(`/api/v1/fvs/fichas/${fichaId}/ro`);
    return res.data;
  },

  async patchRo(fichaId: number, payload: {
    tipo?: 'real' | 'potencial';
    responsavel_id?: number;
    o_que_aconteceu?: string;
    acao_imediata?: string;
    causa_6m?: string;
    justificativa_causa?: string;
  }): Promise<RoOcorrencia> {
    const res = await api.patch(`/api/v1/fvs/fichas/${fichaId}/ro`, payload);
    return res.data;
  },

  async patchServicoNc(fichaId: number, servicoNcId: number, payload: {
    acao_corretiva?: string;
    desbloquear?: boolean;
  }): Promise<RoServicoNc> {
    const res = await api.patch(`/api/v1/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}`, payload);
    return res.data;
  },

  async createRoEvidencia(fichaId: number, servicoNcId: number, file: File): Promise<RoServicoEvidencia> {
    const fd = new FormData();
    fd.append('arquivo', file);
    const res = await api.post(`/api/v1/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}/evidencias`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async deleteRoEvidencia(fichaId: number, servicoNcId: number, evidenciaId: number): Promise<void> {
    await api.delete(`/api/v1/fvs/fichas/${fichaId}/ro/servicos/${servicoNcId}/evidencias/${evidenciaId}`);
  },

  // ─── Parecer ─────────────────────────────────────────────────────────────────

  async solicitarParecer(fichaId: number): Promise<FichaFvs> {
    const res = await api.post(`/api/v1/fvs/fichas/${fichaId}/solicitar-parecer`);
    return res.data;
  },

  async submitParecer(fichaId: number, payload: SubmitParecerPayload): Promise<FichaFvs> {
    const res = await api.post(`/api/v1/fvs/fichas/${fichaId}/parecer`, payload);
    return res.data;
  },
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs): fvs.service.ts — tipos e métodos RO + Parecer"
```

---

## Task 9: Frontend — useRo.ts

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/hooks/useRo.ts`

- [ ] **Step 1: Criar useRo.ts**

```typescript
// frontend-web/src/modules/fvs/inspecao/hooks/useRo.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useRo(fichaId: number, enabled = true) {
  return useQuery({
    queryKey: ['fvs-ro', fichaId],
    queryFn: () => fvsService.getRo(fichaId),
    enabled: !!fichaId && enabled,
    retry: (count, err: any) => err?.response?.status !== 404 && count < 2,
  });
}

export function usePatchRo(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof fvsService.patchRo>[1]) =>
      fvsService.patchRo(fichaId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] }),
  });
}

export function usePatchServicoNc(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, payload }: {
      servicoNcId: number;
      payload: { acao_corretiva?: string; desbloquear?: boolean };
    }) => fvsService.patchServicoNc(fichaId, servicoNcId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-registros', fichaId] });
    },
  });
}

export function useCreateRoEvidencia(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, file }: { servicoNcId: number; file: File }) =>
      fvsService.createRoEvidencia(fichaId, servicoNcId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] }),
  });
}

export function useDeleteRoEvidencia(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoNcId, evidenciaId }: { servicoNcId: number; evidenciaId: number }) =>
      fvsService.deleteRoEvidencia(fichaId, servicoNcId, evidenciaId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-ro', fichaId] }),
  });
}

export function useSolicitarParecer(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fvsService.solicitarParecer(fichaId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
    },
  });
}

export function useSubmitParecer(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof fvsService.submitParecer>[1]) =>
      fvsService.submitParecer(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-ficha', fichaId] });
      qc.invalidateQueries({ queryKey: ['fvs-fichas'] });
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/hooks/useRo.ts
git commit -m "feat(fvs): hooks useRo — useRo, usePatchRo, usePatchServicoNc, evidencias, solicitar/submitParecer"
```

---

## Task 10: Frontend — FichasListPage (novos status)

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx`

- [ ] **Step 1: Adicionar novos status ao STATUS_LABEL**

Substituir o bloco `STATUS_LABEL`:

```typescript
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:          { label: 'Rascunho',           color: '#6b7280' },
  em_inspecao:       { label: 'Em Inspeção',         color: '#3b82f6' },
  concluida:         { label: 'Concluída',            color: '#22c55e' },
  aguardando_parecer:{ label: 'Aguard. Parecer',     color: '#f97316' }, // laranja
  aprovada:          { label: 'Aprovada',             color: '#15803d' }, // verde escuro
};
```

- [ ] **Step 2: Adicionar badge "RO aberto" na linha da ficha**

Na `<td>` do status, adicionar badge condicional após o span de status:

```tsx
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: statusInfo.color, fontSize: 12, fontWeight: 600 }}>
                      {statusInfo.label}
                    </span>
                    {f.status === 'concluida' && (f as any).tem_ro_aberto && (
                      <span style={{
                        marginLeft: 6, background: '#fef3c7', color: '#d97706',
                        borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
                      }}>
                        RO aberto
                      </span>
                    )}
                  </td>
```

> Nota: `tem_ro_aberto` é um campo opcional que o backend pode retornar na listagem futuramente. Por ora o badge só aparece se o backend incluir esse campo.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichasListPage.tsx
git commit -m "feat(fvs): FichasListPage — status aguardando_parecer (laranja) e aprovada (verde escuro)"
```

---

## Task 11: Frontend — RoPanel Component

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx`

- [ ] **Step 1: Criar RoPanel.tsx**

```tsx
// frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx
import { useState } from 'react';
import { useRo, usePatchRo, usePatchServicoNc, useCreateRoEvidencia, useDeleteRoEvidencia } from '../hooks/useRo';
import type { RoServicoNc } from '../../../../services/fvs.service';

const STATUS_SVC_COLOR: Record<string, string> = {
  pendente: '#6b7280',
  desbloqueado: '#3b82f6',
  verificado: '#22c55e',
};

const STATUS_SVC_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  desbloqueado: 'Em Reinspeção',
  verificado: 'Verificado ✓',
};

const CAUSA_OPTIONS = [
  { value: 'mao_obra',     label: 'Mão de Obra' },
  { value: 'material',     label: 'Material' },
  { value: 'metodo',       label: 'Método' },
  { value: 'gestao',       label: 'Gestão' },
  { value: 'medida',       label: 'Medida' },
  { value: 'meio_ambiente',label: 'Meio Ambiente' },
  { value: 'maquina',      label: 'Máquina' },
];

interface Props {
  fichaId: number;
  regime: string;
}

export function RoPanel({ fichaId, regime }: Props) {
  const { data: ro, isLoading, error } = useRo(fichaId);
  const patchRo = usePatchRo(fichaId);
  const patchServico = usePatchServicoNc(fichaId);
  const createEvidencia = useCreateRoEvidencia(fichaId);
  const deleteEvidencia = useDeleteRoEvidencia(fichaId);

  const [editandoAcao, setEditandoAcao] = useState<Record<number, string>>({});
  const [expandido, setExpandido] = useState<Record<number, boolean>>({});
  const [erroDesbloquear, setErroDesbloquear] = useState<string | null>(null);

  if (isLoading) return <div style={{ padding: 16, color: '#6b7280', fontSize: 13 }}>Carregando RO...</div>;
  if (error || !ro) return null; // Sem RO = sem NCs, não exibe painel

  const totalServicos = ro.servicos?.length ?? 0;
  const verificados = ro.servicos?.filter(s => s.status === 'verificado').length ?? 0;

  return (
    <div style={{
      border: '1px solid #fbbf24', borderRadius: 8, padding: 16, marginTop: 20,
      background: '#fffbeb',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: '#92400e' }}>
          📋 Registro de Ocorrência — {ro.numero}
        </h3>
        <span style={{
          background: ro.status === 'concluido' ? '#d1fae5' : '#fef3c7',
          color: ro.status === 'concluido' ? '#065f46' : '#92400e',
          borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600,
        }}>
          {ro.status === 'concluido' ? 'Concluído' : `${verificados}/${totalServicos} serviços verificados`}
        </span>
      </div>

      {/* Cabeçalho do RO */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Tipo</label>
          <select
            value={ro.tipo}
            onChange={e => patchRo.mutate({ tipo: e.target.value as any })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="real">Real</option>
            <option value="potencial">Potencial</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>
            Causa Raiz (6M) {regime === 'pbqph' && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <select
            value={ro.causa_6m ?? ''}
            onChange={e => patchRo.mutate({ causa_6m: e.target.value || undefined })}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13 }}
          >
            <option value="">Selecionar...</option>
            {CAUSA_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>O que aconteceu</label>
          <textarea
            defaultValue={ro.o_que_aconteceu ?? ''}
            onBlur={e => patchRo.mutate({ o_que_aconteceu: e.target.value })}
            rows={2}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>Ação Imediata</label>
          <textarea
            defaultValue={ro.acao_imediata ?? ''}
            onBlur={e => patchRo.mutate({ acao_imediata: e.target.value })}
            rows={2}
            style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Serviços NC */}
      <div style={{ borderTop: '1px solid #fde68a', paddingTop: 12 }}>
        <h4 style={{ fontSize: 13, margin: '0 0 8px', color: '#92400e' }}>Serviços com Não Conformidade</h4>
        {ro.servicos?.map((svc: RoServicoNc) => (
          <div key={svc.id} style={{
            border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 8,
            background: '#fff', overflow: 'hidden',
          }}>
            <div
              onClick={() => setExpandido(e => ({ ...e, [svc.id]: !e[svc.id] }))}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 12px', cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 13 }}>{svc.servico_nome}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: STATUS_SVC_COLOR[svc.status],
                }}>
                  {STATUS_SVC_LABEL[svc.status]}
                </span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>
                  {expandido[svc.id] ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {expandido[svc.id] && (
              <div style={{ padding: '0 12px 12px', borderTop: '1px solid #f3f4f6' }}>
                {/* Itens NC */}
                <div style={{ marginTop: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>ITENS NÃO CONFORMES</span>
                  {svc.itens?.map(item => (
                    <div key={item.id} style={{ fontSize: 12, padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{
                        background: item.item_criticidade === 'critico' ? '#fee2e2' : '#fef3c7',
                        color: item.item_criticidade === 'critico' ? '#dc2626' : '#d97706',
                        borderRadius: 3, padding: '1px 5px', fontSize: 10, fontWeight: 600,
                      }}>
                        {item.item_criticidade.toUpperCase()}
                      </span>
                      {item.item_descricao}
                    </div>
                  ))}
                </div>

                {/* Ação corretiva */}
                {svc.status !== 'verificado' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 3 }}>
                      Ação Corretiva
                    </label>
                    <textarea
                      value={editandoAcao[svc.id] ?? svc.acao_corretiva ?? ''}
                      onChange={e => setEditandoAcao(a => ({ ...a, [svc.id]: e.target.value }))}
                      onBlur={e => patchServico.mutate({ servicoNcId: svc.id, payload: { acao_corretiva: e.target.value } })}
                      rows={2}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Evidências da ação corretiva */}
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>FOTOS DA CORREÇÃO</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {svc.evidencias?.map(ev => (
                      <div key={ev.id} style={{ position: 'relative' }}>
                        <span style={{
                          background: '#f3f4f6', borderRadius: 4, padding: '3px 8px',
                          fontSize: 11, display: 'block',
                        }}>
                          {ev.nome_original ?? `Foto ${ev.id}`}
                        </span>
                        {svc.status !== 'verificado' && (
                          <button
                            onClick={() => deleteEvidencia.mutate({ servicoNcId: svc.id, evidenciaId: ev.id })}
                            style={{
                              position: 'absolute', top: -4, right: -4, background: '#ef4444',
                              color: '#fff', border: 'none', borderRadius: '50%',
                              width: 14, height: 14, fontSize: 9, cursor: 'pointer', lineHeight: '14px', padding: 0,
                            }}
                          >×</button>
                        )}
                      </div>
                    ))}
                    {svc.status !== 'verificado' && (
                      <label style={{
                        background: '#e5e7eb', borderRadius: 4, padding: '3px 8px',
                        fontSize: 11, cursor: 'pointer',
                      }}>
                        + Foto
                        <input
                          type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) createEvidencia.mutate({ servicoNcId: svc.id, file });
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Botão desbloquear */}
                {svc.status === 'pendente' && (
                  <div>
                    {erroDesbloquear && (
                      <p style={{ color: '#ef4444', fontSize: 12, margin: '0 0 6px' }}>{erroDesbloquear}</p>
                    )}
                    <button
                      onClick={async () => {
                        setErroDesbloquear(null);
                        try {
                          await patchServico.mutateAsync({ servicoNcId: svc.id, payload: { desbloquear: true } });
                        } catch (e: any) {
                          setErroDesbloquear(e?.response?.data?.message ?? 'Erro ao desbloquear');
                        }
                      }}
                      disabled={patchServico.isPending}
                      style={{
                        background: '#3b82f6', color: '#fff', border: 'none',
                        borderRadius: 5, padding: '6px 14px', fontSize: 13,
                        cursor: patchServico.isPending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {patchServico.isPending ? 'Aguarde...' : '🔓 Desbloquear para Reinspeção'}
                    </button>
                  </div>
                )}
                {svc.status === 'desbloqueado' && (
                  <p style={{ fontSize: 12, color: '#3b82f6', margin: 0 }}>
                    ✓ Desbloqueado para reinspeção — Ciclo {svc.ciclo_reinspecao}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/components/RoPanel.tsx
git commit -m "feat(fvs): RoPanel — cabeçalho RO, serviços NC, ação corretiva, evidências, desbloquear"
```

---

## Task 12: Frontend — ParecerModal Component

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx`

- [ ] **Step 1: Criar ParecerModal.tsx**

```tsx
// frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx
import { useState } from 'react';
import { useSubmitParecer } from '../hooks/useRo';
import type { FvsGrade } from '../../../../services/fvs.service';

interface Props {
  fichaId: number;
  regime: string;
  grade?: FvsGrade;
  onClose: () => void;
  onSuccess: () => void;
}

export function ParecerModal({ fichaId, regime, grade, onClose, onSuccess }: Props) {
  const [decisao, setDecisao] = useState<'aprovado' | 'rejeitado' | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const submit = useSubmitParecer(fichaId);

  const ncs = grade ? Object.entries(grade.celulas).flatMap(([svcId, locais]) =>
    Object.entries(locais)
      .filter(([, status]) => status === 'nc')
      .map(([localId]) => ({
        servicoId: Number(svcId),
        localId: Number(localId),
        servicoNome: grade.servicos.find(s => s.id === Number(svcId))?.nome ?? '',
        localNome: grade.locais.find(l => l.id === Number(localId))?.nome ?? '',
      }))
  ) : [];

  async function handleSubmit() {
    if (!decisao) { setErro('Selecione a decisão'); return; }
    if (regime === 'pbqph' && decisao === 'rejeitado' && !observacao.trim()) {
      setErro('Observação obrigatória no parecer de rejeição (PBQP-H)');
      return;
    }
    setErro(null);
    try {
      await submit.mutateAsync({ decisao, observacao: observacao || undefined });
      onSuccess();
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao emitir parecer');
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 24,
        width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 17 }}>Parecer do Engenheiro</h2>

        {/* Resumo de NCs */}
        {ncs.length > 0 && (
          <div style={{ background: '#fef3c7', borderRadius: 6, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>
              {ncs.length} célula(s) NC na grade:
            </p>
            {ncs.slice(0, 5).map((nc, i) => (
              <div key={i} style={{ fontSize: 12, color: '#78350f' }}>
                {nc.servicoNome} × {nc.localNome}
              </div>
            ))}
            {ncs.length > 5 && <div style={{ fontSize: 12, color: '#9ca3af' }}>...e mais {ncs.length - 5}</div>}
          </div>
        )}

        {/* Decisão */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['aprovado', 'rejeitado'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDecisao(d)}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 7, border: '2px solid',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                borderColor: decisao === d ? (d === 'aprovado' ? '#22c55e' : '#ef4444') : '#e5e7eb',
                background: decisao === d ? (d === 'aprovado' ? '#f0fdf4' : '#fef2f2') : '#fff',
                color: decisao === d ? (d === 'aprovado' ? '#15803d' : '#dc2626') : '#374151',
              }}
            >
              {d === 'aprovado' ? '✓ Aprovar' : '✗ Rejeitar'}
            </button>
          ))}
        </div>

        {/* Observação */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 4 }}>
            Observação
            {regime === 'pbqph' && decisao === 'rejeitado' && (
              <span style={{ color: '#ef4444' }}> *</span>
            )}
          </label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={4}
            placeholder={decisao === 'rejeitado' ? 'Descreva os motivos da rejeição...' : 'Observações opcionais...'}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 6,
              border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {erro && <p style={{ color: '#ef4444', fontSize: 13, margin: '0 0 12px' }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!decisao || submit.isPending}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: !decisao ? '#d1d5db' : (decisao === 'aprovado' ? '#22c55e' : '#ef4444'),
              color: '#fff', fontSize: 13, cursor: !decisao ? 'not-allowed' : 'pointer', fontWeight: 600,
            }}
          >
            {submit.isPending ? 'Enviando...' : 'Confirmar Parecer'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx
git commit -m "feat(fvs): ParecerModal — decisão aprovado/rejeitado, observação, resumo NCs"
```

---

## Task 13: Frontend — FichaGradePage (RoPanel + Parecer)

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`

- [ ] **Step 1: Adicionar imports ao FichaGradePage.tsx**

```typescript
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFicha, usePatchFicha } from '../hooks/useFichas';
import { useGrade } from '../hooks/useGrade';
import { useSolicitarParecer } from '../hooks/useRo';
import { RoPanel } from '../components/RoPanel';
import { ParecerModal } from '../components/ParecerModal';
import type { StatusGrade } from '../../../../services/fvs.service';
```

- [ ] **Step 2: Adicionar estado e lógica de parecer**

Após a linha `const [erroConcluso, setErroConcluso] = useState...`, adicionar:

```typescript
  const [showParecer, setShowParecer] = useState(false);
  const solicitarParecer = useSolicitarParecer(id);
  const [erroSolicitar, setErroSolicitar] = useState<string | null>(null);

  async function handleSolicitarParecer() {
    setErroSolicitar(null);
    try {
      await solicitarParecer.mutateAsync();
    } catch (e: any) {
      setErroSolicitar(e?.response?.data?.message ?? 'Erro ao solicitar parecer');
    }
  }
```

- [ ] **Step 3: Adicionar botão "Solicitar Parecer" e RoPanel no JSX**

Na seção de botões (`<div style={{ marginBottom: 16, display: 'flex', gap: 10 }}`), adicionar após os botões existentes de iniciar/concluir:

```tsx
        {ficha.status === 'concluida' && (
          <button
            onClick={handleSolicitarParecer}
            disabled={solicitarParecer.isPending}
            style={{
              background: '#f97316', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            {solicitarParecer.isPending ? 'Aguarde...' : '📋 Solicitar Parecer'}
          </button>
        )}
        {ficha.status === 'aguardando_parecer' && (
          <button
            onClick={() => setShowParecer(true)}
            style={{
              background: '#7c3aed', color: '#fff', border: 'none',
              borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
            }}
          >
            ✍️ Emitir Parecer
          </button>
        )}
        {ficha.status === 'aprovada' && (
          <span style={{
            background: '#d1fae5', color: '#065f46', borderRadius: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
          }}>
            ✓ Ficha Aprovada
          </span>
        )}
```

Depois do erro de conclusão, adicionar erro de solicitar:

```tsx
        {erroSolicitar && (
          <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0 0' }}>{erroSolicitar}</p>
        )}
```

- [ ] **Step 4: Adicionar RoPanel e ParecerModal após a grade**

Após o fechamento da `<table>` da grade (ou após a div principal da grade), adicionar:

```tsx
      {/* RO Panel — aparece quando ficha está concluida com RO aberto */}
      {(ficha.status === 'concluida' || ficha.status === 'aguardando_parecer') && (
        <RoPanel fichaId={id} regime={ficha.regime} />
      )}

      {/* Modal de Parecer */}
      {showParecer && (
        <ParecerModal
          fichaId={id}
          regime={ficha.regime}
          grade={grade}
          onClose={() => setShowParecer(false)}
          onSuccess={() => setShowParecer(false)}
        />
      )}
```

- [ ] **Step 5: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
git commit -m "feat(fvs): FichaGradePage — botão Solicitar Parecer, Emitir Parecer, RoPanel integrado"
```

---

## Task 14: Frontend — FichaLocalPage (ciclo-aware)

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx`

- [ ] **Step 1: Ler ciclo do primeiro registro e mostrar header de reinspeção**

Adicionar após as declarações de estado existentes (após `const podeEditar = ...`):

```typescript
  const maxCiclo = Math.max(...registros.map(r => r.ciclo ?? 1), 1);
  const eReinsspecao = maxCiclo > 1;
```

- [ ] **Step 2: Adicionar header de reinspeção quando ciclo > 1**

Dentro do return, antes da listagem de itens, adicionar:

```tsx
      {eReinsspecao && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
          padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#1d4ed8',
        }}>
          🔄 <strong>Reinspeção — Ciclo {maxCiclo}</strong>
          {' '} — Apenas itens desbloqueados para reinspecionar
        </div>
      )}
```

- [ ] **Step 3: Filtrar e bloquear itens conformes em reinspeção**

Na função `handleStatusChange`, adicionar guarda no início:

```typescript
  async function handleStatusChange(reg: FvsRegistro, novoStatus: StatusRegistro) {
    if (!podeEditar) return;
    if (eReinsspecao && !reg.desbloqueado) return; // itens não desbloqueados ficam bloqueados
    if (novoStatus === 'nao_conforme') {
      setNcRegistro({ ...reg, status: novoStatus });
      return;
    }
    await putRegistro.mutateAsync({ servicoId, itemId: reg.item_id, localId, status: novoStatus, ciclo: maxCiclo });
  }
```

- [ ] **Step 4: Aplicar visual de bloqueado para itens não desbloqueados em reinspeção**

Na renderização de cada registro, adicionar estilo condicional baseado em `desbloqueado`:

```tsx
// Dentro do map de registros, adicionar variável:
const bloqueado = eReinsspecao && !reg.desbloqueado;

// Aplicar ao container do item:
style={{
  ...(bloqueado ? { opacity: 0.4, pointerEvents: 'none' } : {}),
  // ... demais estilos existentes
}}
```

- [ ] **Step 5: Passar ciclo ao putRegistro no RegistroNcModal**

No handler que confirma NC (após `setNcRegistro`), garantir que ciclo seja passado:

```typescript
// Onde putRegistro.mutateAsync é chamado após confirmar NC no modal:
await putRegistro.mutateAsync({
  servicoId, itemId: ncRegistro.item_id, localId,
  status: 'nao_conforme', observacao: obs,
  ciclo: maxCiclo,  // Sprint 3: passar ciclo atual
});
```

- [ ] **Step 6: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx
git commit -m "feat(fvs): FichaLocalPage — ciclo-aware, reinspeção com header, itens bloqueados/desbloqueados"
```

---

## Self-Review

### Cobertura da Spec

| Critério de Aceite | Task que implementa |
|---|---|
| CA1 — RO criado automaticamente com NCs | Task 6 (autoCreateRo em InspecaoService) |
| CA2 — Desbloqueio cria ciclo=2 apenas para NC | Task 4 (RoService.patchServicoNc) |
| CA3 — Todos ciclo=2 conforme → serviço verificado | Task 4 (checkAndAdvanceRoStatus) |
| CA4 — Último serviço verificado → RO concluido | Task 4 (checkAndAdvanceRoStatus) |
| CA5 — Solicitar Parecer com RO aberto → 409 | Task 5 (ParecerService.solicitarParecer) |
| CA6 — Parecer aprovado → aprovada | Task 5 (ParecerService.submitParecer) |
| CA7 — Parecer rejeitado → em_inspecao + ciclo+1 | Task 5 (ParecerService.submitParecer) |
| CA8 — Grade retorna ciclo mais recente | Task 6 (InspecaoService.getGrade modificado) |
| CA9 — FichaLocalPage ciclo=2: só NC desbloqueados | Task 14 |
| CA10 — PBQP-H: desbloquear sem campos → 422 | Task 4 (patchServicoNc validação) |
| CA11 — PBQP-H: parecer rejeitado sem obs → 422 | Task 5 (submitParecer validação) |
| CA12 — Upload foto evidência RO → GED FTO | Task 4 (createRoEvidencia) |
| CA13 — FichasListPage status aguardando/aprovada | Task 10 |
| CA14 — PBQP-H audit_log em todos os eventos | Tasks 4, 5, 6 (gravarAuditLog em cada evento) |

### Checagem de Tipos Consistentes

- `FvsRegistroComCiclo` definido em `fvs.types.ts` (Task 2) e usado em `InspecaoService.getRegistros` e `putRegistro` (Task 6) ✓
- `StatusFicha` expandido em backend (Task 2) e frontend (Task 8) com mesmos valores ✓
- `RoOcorrencia.servicos?: RoServicoNc[]` — preenchido por `getRo()` (Task 4) ✓
- `RoServicoNc.itens?: RoServicoItemNc[]` e `evidencias?: RoServicoEvidencia[]` — preenchidos em `getRo()` ✓
- `useRo` retorna `RoOcorrencia` — `RoPanel` usa `ro.servicos?.map((svc: RoServicoNc)` ✓
- `FvsGrade` passado ao `ParecerModal` — tipo vem de `fvs.service.ts` existente ✓

### Verificação de Placeholders

Nenhum placeholder encontrado — todos os steps contêm código completo.

---

**Plano completo salvo em `docs/superpowers/plans/2026-04-09-fvs-sprint3-ro-reinspecao-parecer.md`.**

**Duas opções de execução:**

**1. Subagent-Driven (recomendado)** — Despacha um subagente por task, revisa entre tasks, iteração rápida

**2. Inline Execution** — Executa as tasks nesta sessão com checkpoints de revisão

**Qual abordagem?**
