# FVS — Plano de Ação Configurável: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully configurable corrective action plan (PA) system for FVS, with configurable lifecycle stages, auto-trigger rules, and a full frontend for creating, tracking, and closing action plans.

**Architecture:** NestJS module PlanosAcaoModule with two sub-modules (config + pa), 6 new PostgreSQL tables via Prisma migration, React pages for listing/detail/admin-config with dynamic field rendering per lifecycle stage.

**Tech Stack:** NestJS, Prisma, PostgreSQL, React 19, TanStack Query, lucide-react icons

---

## File Map

### Backend — New files
| File | Responsibility |
|------|----------------|
| `backend/prisma/migrations/20260416200000_add_planos_acao/migration.sql` | 6 new tables |
| `backend/src/planos-acao/planos-acao.module.ts` | NestJS module declaration |
| `backend/src/planos-acao/config/config.controller.ts` | CRUD ciclos/etapas/campos/gatilhos |
| `backend/src/planos-acao/config/config.service.ts` | Business logic for config entities |
| `backend/src/planos-acao/pa/pa.controller.ts` | CRUD PAs + transição de etapa |
| `backend/src/planos-acao/pa/pa.service.ts` | Business logic for PAs, number generation, avaliarGatilhos |
| `backend/src/planos-acao/dto/create-ciclo.dto.ts` | DTO: criar ciclo |
| `backend/src/planos-acao/dto/update-ciclo.dto.ts` | DTO: editar ciclo |
| `backend/src/planos-acao/dto/create-etapa.dto.ts` | DTO: criar etapa |
| `backend/src/planos-acao/dto/update-etapa.dto.ts` | DTO: editar etapa |
| `backend/src/planos-acao/dto/create-campo.dto.ts` | DTO: criar campo configurável |
| `backend/src/planos-acao/dto/update-campo.dto.ts` | DTO: editar campo |
| `backend/src/planos-acao/dto/create-gatilho.dto.ts` | DTO: criar gatilho |
| `backend/src/planos-acao/dto/update-gatilho.dto.ts` | DTO: editar gatilho |
| `backend/src/planos-acao/dto/create-pa.dto.ts` | DTO: criar PA |
| `backend/src/planos-acao/dto/update-pa.dto.ts` | DTO: editar PA |
| `backend/src/planos-acao/dto/transicao.dto.ts` | DTO: transicionar etapa |
| `backend/src/planos-acao/pa/pa.service.spec.ts` | Unit tests for PaService |

### Backend — Modified files
| File | Change |
|------|--------|
| `backend/src/app.module.ts` | Add PlanosAcaoModule to imports |
| `backend/src/fvs/fvs.module.ts` | Import PlanosAcaoModule, inject PaService |
| `backend/src/fvs/inspecao/inspecao.service.ts` | Call avaliarGatilhos after concluir |

### Frontend — New files
| File | Responsibility |
|------|----------------|
| `frontend-web/src/services/planos-acao.service.ts` | All API calls for planos-acao |
| `frontend-web/src/modules/fvs/planos-acao/hooks/usePlanosAcao.ts` | TanStack Query hooks |
| `frontend-web/src/modules/fvs/planos-acao/hooks/useConfigPlanosAcao.ts` | TanStack Query hooks for config |
| `frontend-web/src/modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx` | List + kanban toggle |
| `frontend-web/src/modules/fvs/planos-acao/pages/PlanoAcaoDetalhe.tsx` | Detail + stage pipeline + history |
| `frontend-web/src/modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx` | Admin config (ciclos/etapas/campos/gatilhos) |
| `frontend-web/src/modules/fvs/planos-acao/components/PaKanban.tsx` | Kanban board by stage |
| `frontend-web/src/modules/fvs/planos-acao/components/PaCard.tsx` | Card for list and kanban |
| `frontend-web/src/modules/fvs/planos-acao/components/PaStagePipeline.tsx` | Horizontal stage pipeline |
| `frontend-web/src/modules/fvs/planos-acao/components/PaHistoryTimeline.tsx` | Transition history |
| `frontend-web/src/modules/fvs/planos-acao/components/PaDynamicFields.tsx` | Dynamic field rendering per etapa |
| `frontend-web/src/modules/fvs/planos-acao/components/TransicaoModal.tsx` | Modal to advance/retreat stage |
| `frontend-web/src/modules/fvs/planos-acao/components/NovoPaModal.tsx` | Modal to create PA |

### Frontend — Modified files
| File | Change |
|------|--------|
| `frontend-web/src/App.tsx` | Add 3 new lazy routes |
| `frontend-web/src/components/layout/Sidebar.tsx` | Add Planos de Ação nav item to Qualidade section |

---

## Task 1: Prisma Migration — 6 New Tables

**Files:**
- Create: `backend/prisma/migrations/20260416200000_add_planos_acao/migration.sql`

- [ ] **Step 1.1: Create migration directory and SQL file**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend/prisma/migrations/20260416200000_add_planos_acao"
```

- [ ] **Step 1.2: Write migration SQL**

Create `backend/prisma/migrations/20260416200000_add_planos_acao/migration.sql`:

```sql
-- Migration: add_planos_acao
-- Creates 6 tables for the configurable corrective action plan (PA) system.

-- 1. Ciclo de vida configurável
CREATE TABLE pa_config_ciclo (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  modulo      VARCHAR(20) NOT NULL DEFAULT 'FVS',
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ciclo_tenant_modulo_nome UNIQUE (tenant_id, modulo, nome)
);

-- 2. Etapas do ciclo
CREATE TABLE pa_config_etapa (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  ciclo_id         INT NOT NULL REFERENCES pa_config_ciclo(id) ON DELETE CASCADE,
  nome             VARCHAR(100) NOT NULL,
  ordem            INT NOT NULL,
  cor              VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  is_inicial       BOOLEAN NOT NULL DEFAULT FALSE,
  is_final         BOOLEAN NOT NULL DEFAULT FALSE,
  prazo_dias       INT,
  roles_transicao  TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Campos configuráveis por etapa
CREATE TABLE pa_config_campo (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  etapa_id    INT NOT NULL REFERENCES pa_config_etapa(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  chave       VARCHAR(50) NOT NULL,
  tipo        VARCHAR(20) NOT NULL,
  opcoes      JSONB,
  obrigatorio BOOLEAN NOT NULL DEFAULT FALSE,
  ordem       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_campo_tipo CHECK (tipo IN ('texto','numero','data','select','usuario','arquivo'))
);

-- 4. Gatilhos de abertura automática
CREATE TABLE pa_config_gatilho (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  ciclo_id        INT NOT NULL REFERENCES pa_config_ciclo(id) ON DELETE CASCADE,
  modulo          VARCHAR(20) NOT NULL DEFAULT 'FVS',
  condicao        VARCHAR(30) NOT NULL,
  valor_limiar    NUMERIC,
  criticidade_min VARCHAR(10),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gatilho_condicao CHECK (condicao IN ('TAXA_CONFORMIDADE_ABAIXO','ITEM_CRITICO_NC','NC_ABERTA'))
);

-- 5. Planos de Ação
CREATE TABLE pa_plano_acao (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  ciclo_id       INT NOT NULL REFERENCES pa_config_ciclo(id),
  etapa_atual_id INT NOT NULL REFERENCES pa_config_etapa(id),
  modulo         VARCHAR(20) NOT NULL DEFAULT 'FVS',
  origem_tipo    VARCHAR(30),
  origem_id      INT,
  obra_id        INT NOT NULL,
  numero         VARCHAR(20) NOT NULL,
  titulo         VARCHAR(200) NOT NULL,
  descricao      TEXT,
  prioridade     VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
  responsavel_id INT,
  prazo          DATE,
  campos_extras  JSONB NOT NULL DEFAULT '{}',
  aberto_por     INT NOT NULL,
  fechado_em     TIMESTAMPTZ,
  fechado_por    INT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pa_tenant_numero UNIQUE (tenant_id, numero),
  CONSTRAINT chk_pa_prioridade CHECK (prioridade IN ('BAIXA','MEDIA','ALTA','CRITICA')),
  CONSTRAINT chk_pa_origem_tipo CHECK (origem_tipo IN ('INSPECAO_FVS','NC_FVS','MANUAL') OR origem_tipo IS NULL)
);

-- 6. Histórico de transições
CREATE TABLE pa_historico (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  pa_id         INT NOT NULL REFERENCES pa_plano_acao(id) ON DELETE CASCADE,
  etapa_de_id   INT REFERENCES pa_config_etapa(id),
  etapa_para_id INT NOT NULL REFERENCES pa_config_etapa(id),
  comentario    TEXT,
  campos_extras JSONB NOT NULL DEFAULT '{}',
  criado_por    INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pa_plano_acao_tenant_obra ON pa_plano_acao(tenant_id, obra_id);
CREATE INDEX idx_pa_plano_acao_tenant_etapa ON pa_plano_acao(tenant_id, etapa_atual_id);
CREATE INDEX idx_pa_plano_acao_origem ON pa_plano_acao(tenant_id, origem_tipo, origem_id);
CREATE INDEX idx_pa_historico_pa ON pa_historico(pa_id);
CREATE INDEX idx_pa_config_etapa_ciclo ON pa_config_etapa(ciclo_id);
CREATE INDEX idx_pa_config_campo_etapa ON pa_config_campo(etapa_id);
CREATE INDEX idx_pa_config_gatilho_tenant ON pa_config_gatilho(tenant_id, modulo, ativo);
```

- [ ] **Step 1.3: Run migration**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx prisma migrate dev --name add_planos_acao
```

Expected output:
```
Applying migration `20260416200000_add_planos_acao`
The following migration(s) have been applied:
migrations/
  └─ 20260416200000_add_planos_acao/
    └─ migration.sql
Your database is now in sync with your schema.
```

- [ ] **Step 1.4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/prisma/migrations/20260416200000_add_planos_acao/migration.sql
git commit -m "feat(planos-acao): add prisma migration for 6 PA tables"
```

---

## Task 2: DTOs

**Files:**
- Create: `backend/src/planos-acao/dto/create-ciclo.dto.ts`
- Create: `backend/src/planos-acao/dto/update-ciclo.dto.ts`
- Create: `backend/src/planos-acao/dto/create-etapa.dto.ts`
- Create: `backend/src/planos-acao/dto/update-etapa.dto.ts`
- Create: `backend/src/planos-acao/dto/create-campo.dto.ts`
- Create: `backend/src/planos-acao/dto/update-campo.dto.ts`
- Create: `backend/src/planos-acao/dto/create-gatilho.dto.ts`
- Create: `backend/src/planos-acao/dto/update-gatilho.dto.ts`
- Create: `backend/src/planos-acao/dto/create-pa.dto.ts`
- Create: `backend/src/planos-acao/dto/update-pa.dto.ts`
- Create: `backend/src/planos-acao/dto/transicao.dto.ts`

- [ ] **Step 2.1: Create dto directory**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend/src/planos-acao/dto"
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend/src/planos-acao/config"
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend/src/planos-acao/pa"
```

- [ ] **Step 2.2: Write create-ciclo.dto.ts**

```typescript
// backend/src/planos-acao/dto/create-ciclo.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateCicloDto {
  @IsIn(['FVS', 'FVM', 'NC'])
  modulo: 'FVS' | 'FVM' | 'NC';

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;
}
```

- [ ] **Step 2.3: Write update-ciclo.dto.ts**

```typescript
// backend/src/planos-acao/dto/update-ciclo.dto.ts
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateCicloDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
```

- [ ] **Step 2.4: Write create-etapa.dto.ts**

```typescript
// backend/src/planos-acao/dto/create-etapa.dto.ts
import {
  IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional,
  IsArray, Matches, MaxLength, Min,
} from 'class-validator';

export class CreateEtapaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsNumber()
  @Min(0)
  ordem: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'cor deve ser hex de 6 dígitos ex: #6B7280' })
  cor?: string;

  @IsOptional()
  @IsBoolean()
  isInicial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  prazoDias?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rolesTransicao?: string[];
}
```

- [ ] **Step 2.5: Write update-etapa.dto.ts**

```typescript
// backend/src/planos-acao/dto/update-etapa.dto.ts
import {
  IsString, IsOptional, IsNumber, IsBoolean, IsArray, Matches, MaxLength, Min,
} from 'class-validator';

export class UpdateEtapaDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'cor deve ser hex de 6 dígitos ex: #6B7280' })
  cor?: string;

  @IsOptional()
  @IsBoolean()
  isInicial?: boolean;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  prazoDias?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rolesTransicao?: string[];
}
```

- [ ] **Step 2.6: Write create-campo.dto.ts**

```typescript
// backend/src/planos-acao/dto/create-campo.dto.ts
import {
  IsString, IsNotEmpty, IsBoolean, IsOptional, IsIn, IsNumber, MaxLength, Matches, Min,
} from 'class-validator';

export class CreateCampoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'chave deve ser snake_case começando com letra minúscula' })
  chave: string;

  @IsIn(['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'])
  tipo: 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

  @IsOptional()
  opcoes?: string[];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ordem?: number;
}
```

- [ ] **Step 2.7: Write update-campo.dto.ts**

```typescript
// backend/src/planos-acao/dto/update-campo.dto.ts
import {
  IsString, IsOptional, IsBoolean, IsIn, IsNumber, MaxLength, Matches, Min,
} from 'class-validator';

export class UpdateCampoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsIn(['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'])
  tipo?: 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

  @IsOptional()
  opcoes?: string[];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ordem?: number;
}
```

- [ ] **Step 2.8: Write create-gatilho.dto.ts**

```typescript
// backend/src/planos-acao/dto/create-gatilho.dto.ts
import {
  IsIn, IsOptional, IsNumber, IsString, Min, Max,
} from 'class-validator';

export class CreateGatilhoDto {
  @IsIn(['TAXA_CONFORMIDADE_ABAIXO', 'ITEM_CRITICO_NC', 'NC_ABERTA'])
  condicao: 'TAXA_CONFORMIDADE_ABAIXO' | 'ITEM_CRITICO_NC' | 'NC_ABERTA';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valorLimiar?: number;

  @IsOptional()
  @IsIn(['critico', 'major', 'minor'])
  @IsString()
  criticidadeMin?: 'critico' | 'major' | 'minor';
}
```

- [ ] **Step 2.9: Write update-gatilho.dto.ts**

```typescript
// backend/src/planos-acao/dto/update-gatilho.dto.ts
import {
  IsOptional, IsBoolean, IsIn, IsNumber, IsString, Min, Max,
} from 'class-validator';

export class UpdateGatilhoDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valorLimiar?: number;

  @IsOptional()
  @IsIn(['critico', 'major', 'minor'])
  @IsString()
  criticidadeMin?: 'critico' | 'major' | 'minor';

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
```

- [ ] **Step 2.10: Write create-pa.dto.ts**

```typescript
// backend/src/planos-acao/dto/create-pa.dto.ts
import {
  IsNumber, IsString, IsNotEmpty, IsOptional, IsIn, IsDateString, MaxLength, Min,
} from 'class-validator';

export class CreatePaDto {
  @IsNumber()
  @Min(1)
  cicloId: number;

  @IsNumber()
  @Min(1)
  obraId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'])
  prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

  @IsOptional()
  @IsNumber()
  @Min(1)
  responsavelId?: number;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsOptional()
  @IsIn(['INSPECAO_FVS', 'NC_FVS', 'MANUAL'])
  origemTipo?: 'INSPECAO_FVS' | 'NC_FVS' | 'MANUAL';

  @IsOptional()
  @IsNumber()
  @Min(1)
  origemId?: number;

  @IsOptional()
  camposExtras?: Record<string, unknown>;
}
```

- [ ] **Step 2.11: Write update-pa.dto.ts**

```typescript
// backend/src/planos-acao/dto/update-pa.dto.ts
import {
  IsString, IsOptional, IsIn, IsNumber, IsDateString, MaxLength, Min,
} from 'class-validator';

export class UpdatePaDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsIn(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'])
  prioridade?: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

  @IsOptional()
  @IsNumber()
  @Min(1)
  responsavelId?: number;

  @IsOptional()
  @IsDateString()
  prazo?: string;

  @IsOptional()
  camposExtras?: Record<string, unknown>;
}
```

- [ ] **Step 2.12: Write transicao.dto.ts**

```typescript
// backend/src/planos-acao/dto/transicao.dto.ts
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransicaoDto {
  @IsNumber()
  @Min(1)
  etapaParaId: number;

  @IsOptional()
  @IsString()
  comentario?: string;

  @IsOptional()
  camposExtras?: Record<string, unknown>;
}
```

- [ ] **Step 2.13: Commit DTOs**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/planos-acao/dto/
git commit -m "feat(planos-acao): add all DTOs for config and PA endpoints"
```

---

## Task 3: Backend Config Service + Controller

**Files:**
- Create: `backend/src/planos-acao/config/config.service.ts`
- Create: `backend/src/planos-acao/config/config.controller.ts`

- [ ] **Step 3.1: Write config.service.ts**

```typescript
// backend/src/planos-acao/config/config.service.ts
import {
  Injectable, NotFoundException, ConflictException, UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCicloDto } from '../dto/create-ciclo.dto';
import { UpdateCicloDto } from '../dto/update-ciclo.dto';
import { CreateEtapaDto } from '../dto/create-etapa.dto';
import { UpdateEtapaDto } from '../dto/update-etapa.dto';
import { CreateCampoDto } from '../dto/create-campo.dto';
import { UpdateCampoDto } from '../dto/update-campo.dto';
import { CreateGatilhoDto } from '../dto/create-gatilho.dto';
import { UpdateGatilhoDto } from '../dto/update-gatilho.dto';

@Injectable()
export class ConfigPlanosAcaoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Ciclos ──────────────────────────────────────────────────────────────────

  async listCiclos(tenantId: number, modulo?: string): Promise<any[]> {
    const filter = modulo
      ? `AND modulo = '${modulo.replace(/'/g, "''")}'`
      : '';
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.*, json_agg(
         json_build_object(
           'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
           'cor', e.cor, 'is_inicial', e.is_inicial, 'is_final', e.is_final,
           'prazo_dias', e.prazo_dias, 'roles_transicao', e.roles_transicao
         ) ORDER BY e.ordem
       ) FILTER (WHERE e.id IS NOT NULL) AS etapas
       FROM pa_config_ciclo c
       LEFT JOIN pa_config_etapa e ON e.ciclo_id = c.id
       WHERE c.tenant_id = $1 ${filter}
       GROUP BY c.id
       ORDER BY c.id`,
      tenantId,
    );
  }

  async createCiclo(tenantId: number, dto: CreateCicloDto): Promise<any> {
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_ciclo WHERE tenant_id = $1 AND modulo = $2 AND nome = $3`,
      tenantId, dto.modulo, dto.nome,
    );
    if (existing.length) {
      throw new ConflictException(`Já existe um ciclo "${dto.nome}" para o módulo ${dto.modulo}`);
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_ciclo (tenant_id, modulo, nome, descricao)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      tenantId, dto.modulo, dto.nome, dto.descricao ?? null,
    );
    return rows[0];
  }

  async updateCiclo(tenantId: number, cicloId: number, dto: UpdateCicloDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome      !== undefined) { sets.push(`nome = $${i++}`);      vals.push(dto.nome); }
    if (dto.descricao !== undefined) { sets.push(`descricao = $${i++}`); vals.push(dto.descricao); }
    if (dto.ativo     !== undefined) { sets.push(`ativo = $${i++}`);     vals.push(dto.ativo); }
    sets.push(`updated_at = NOW()`);
    vals.push(cicloId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_ciclo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCiclo(tenantId: number, cicloId: number): Promise<void> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE pa_config_ciclo SET ativo = FALSE, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      cicloId, tenantId,
    );
  }

  private async getCicloOuFalhar(tenantId: number, cicloId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_ciclo WHERE id = $1 AND tenant_id = $2`,
      cicloId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ciclo ${cicloId} não encontrado`);
    return rows[0];
  }

  // ── Etapas ──────────────────────────────────────────────────────────────────

  async listEtapas(tenantId: number, cicloId: number): Promise<any[]> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT e.*, json_agg(
         json_build_object(
           'id', c.id, 'nome', c.nome, 'chave', c.chave,
           'tipo', c.tipo, 'opcoes', c.opcoes, 'obrigatorio', c.obrigatorio, 'ordem', c.ordem
         ) ORDER BY c.ordem
       ) FILTER (WHERE c.id IS NOT NULL) AS campos
       FROM pa_config_etapa e
       LEFT JOIN pa_config_campo c ON c.etapa_id = e.id
       WHERE e.ciclo_id = $1 AND e.tenant_id = $2
       GROUP BY e.id
       ORDER BY e.ordem`,
      cicloId, tenantId,
    );
  }

  async createEtapa(tenantId: number, cicloId: number, dto: CreateEtapaDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    const rolesJson = JSON.stringify(dto.rolesTransicao ?? []);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_etapa
         (tenant_id, ciclo_id, nome, ordem, cor, is_inicial, is_final, prazo_dias, roles_transicao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[])
       RETURNING *`,
      tenantId, cicloId, dto.nome, dto.ordem,
      dto.cor ?? '#6B7280',
      dto.isInicial ?? false,
      dto.isFinal ?? false,
      dto.prazoDias ?? null,
      `{${(dto.rolesTransicao ?? []).join(',')}}`,
    );
    return rows[0];
  }

  async updateEtapa(tenantId: number, etapaId: number, dto: UpdateEtapaDto): Promise<any> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome           !== undefined) { sets.push(`nome = $${i++}`);           vals.push(dto.nome); }
    if (dto.ordem          !== undefined) { sets.push(`ordem = $${i++}`);          vals.push(dto.ordem); }
    if (dto.cor            !== undefined) { sets.push(`cor = $${i++}`);            vals.push(dto.cor); }
    if (dto.isInicial      !== undefined) { sets.push(`is_inicial = $${i++}`);     vals.push(dto.isInicial); }
    if (dto.isFinal        !== undefined) { sets.push(`is_final = $${i++}`);       vals.push(dto.isFinal); }
    if (dto.prazoDias      !== undefined) { sets.push(`prazo_dias = $${i++}`);     vals.push(dto.prazoDias); }
    if (dto.rolesTransicao !== undefined) {
      sets.push(`roles_transicao = $${i++}::text[]`);
      vals.push(`{${dto.rolesTransicao.join(',')}}`);
    }
    vals.push(etapaId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_etapa SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteEtapa(tenantId: number, etapaId: number): Promise<void> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    // Check no PAs are currently in this stage
    const inUse = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_plano_acao WHERE etapa_atual_id = $1 AND deleted_at IS NULL LIMIT 1`,
      etapaId,
    );
    if (inUse.length) {
      throw new ConflictException('Não é possível remover etapa com PAs ativos nela');
    }
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_etapa WHERE id = $1 AND tenant_id = $2`,
      etapaId, tenantId,
    );
  }

  private async getEtapaOuFalhar(tenantId: number, etapaId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE id = $1 AND tenant_id = $2`,
      etapaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Etapa ${etapaId} não encontrada`);
    return rows[0];
  }

  // ── Campos ──────────────────────────────────────────────────────────────────

  async createCampo(tenantId: number, etapaId: number, dto: CreateCampoDto): Promise<any> {
    await this.getEtapaOuFalhar(tenantId, etapaId);
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_campo WHERE etapa_id = $1 AND chave = $2`,
      etapaId, dto.chave,
    );
    if (existing.length) {
      throw new ConflictException(`Campo com chave "${dto.chave}" já existe nesta etapa`);
    }
    const opcoesJson = dto.opcoes ? JSON.stringify(dto.opcoes) : null;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_campo (tenant_id, etapa_id, nome, chave, tipo, opcoes, obrigatorio, ordem)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING *`,
      tenantId, etapaId, dto.nome, dto.chave, dto.tipo,
      opcoesJson, dto.obrigatorio ?? false, dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateCampo(tenantId: number, campoId: number, dto: UpdateCampoDto): Promise<any> {
    const rows0 = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
    if (!rows0.length) throw new NotFoundException(`Campo ${campoId} não encontrado`);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome       !== undefined) { sets.push(`nome = $${i++}`);       vals.push(dto.nome); }
    if (dto.tipo       !== undefined) { sets.push(`tipo = $${i++}`);       vals.push(dto.tipo); }
    if (dto.opcoes     !== undefined) { sets.push(`opcoes = $${i++}::jsonb`); vals.push(JSON.stringify(dto.opcoes)); }
    if (dto.obrigatorio !== undefined) { sets.push(`obrigatorio = $${i++}`); vals.push(dto.obrigatorio); }
    if (dto.ordem      !== undefined) { sets.push(`ordem = $${i++}`);      vals.push(dto.ordem); }
    vals.push(campoId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_campo SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCampo(tenantId: number, campoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Campo ${campoId} não encontrado`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_campo WHERE id = $1 AND tenant_id = $2`,
      campoId, tenantId,
    );
  }

  // ── Gatilhos ────────────────────────────────────────────────────────────────

  async listGatilhos(tenantId: number, cicloId: number): Promise<any[]> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_gatilho WHERE tenant_id = $1 AND ciclo_id = $2 ORDER BY id`,
      tenantId, cicloId,
    );
  }

  async createGatilho(tenantId: number, cicloId: number, dto: CreateGatilhoDto): Promise<any> {
    await this.getCicloOuFalhar(tenantId, cicloId);
    if (dto.condicao === 'TAXA_CONFORMIDADE_ABAIXO' && dto.valorLimiar === undefined) {
      throw new UnprocessableEntityException('valorLimiar é obrigatório para TAXA_CONFORMIDADE_ABAIXO');
    }
    if (dto.condicao === 'ITEM_CRITICO_NC' && !dto.criticidadeMin) {
      throw new UnprocessableEntityException('criticidadeMin é obrigatório para ITEM_CRITICO_NC');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_config_gatilho (tenant_id, ciclo_id, modulo, condicao, valor_limiar, criticidade_min)
       VALUES ($1, $2, 'FVS', $3, $4, $5) RETURNING *`,
      tenantId, cicloId, dto.condicao,
      dto.valorLimiar ?? null, dto.criticidadeMin ?? null,
    );
    return rows[0];
  }

  async updateGatilho(tenantId: number, gatilhoId: number, dto: UpdateGatilhoDto): Promise<any> {
    const rows0 = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
    if (!rows0.length) throw new NotFoundException(`Gatilho ${gatilhoId} não encontrado`);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.valorLimiar    !== undefined) { sets.push(`valor_limiar = $${i++}`);    vals.push(dto.valorLimiar); }
    if (dto.criticidadeMin !== undefined) { sets.push(`criticidade_min = $${i++}`); vals.push(dto.criticidadeMin); }
    if (dto.ativo          !== undefined) { sets.push(`ativo = $${i++}`);           vals.push(dto.ativo); }
    vals.push(gatilhoId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_config_gatilho SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteGatilho(tenantId: number, gatilhoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Gatilho ${gatilhoId} não encontrado`);
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM pa_config_gatilho WHERE id = $1 AND tenant_id = $2`,
      gatilhoId, tenantId,
    );
  }
}
```

- [ ] **Step 3.2: Write config.controller.ts**

```typescript
// backend/src/planos-acao/config/config.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseIntPipe, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ConfigPlanosAcaoService } from './config.service';
import { CreateCicloDto } from '../dto/create-ciclo.dto';
import { UpdateCicloDto } from '../dto/update-ciclo.dto';
import { CreateEtapaDto } from '../dto/create-etapa.dto';
import { UpdateEtapaDto } from '../dto/update-etapa.dto';
import { CreateCampoDto } from '../dto/create-campo.dto';
import { UpdateCampoDto } from '../dto/update-campo.dto';
import { CreateGatilhoDto } from '../dto/create-gatilho.dto';
import { UpdateGatilhoDto } from '../dto/update-gatilho.dto';

@Controller('api/v1/planos-acao/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigController {
  constructor(private readonly config: ConfigPlanosAcaoService) {}

  // ── Ciclos ──────────────────────────────────────────────────────────────────

  @Get('ciclos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listCiclos(
    @TenantId() tenantId: number,
    @Query('modulo') modulo?: string,
  ) {
    return this.config.listCiclos(tenantId, modulo);
  }

  @Post('ciclos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createCiclo(
    @TenantId() tenantId: number,
    @Body() dto: CreateCicloDto,
  ) {
    return this.config.createCiclo(tenantId, dto);
  }

  @Patch('ciclos/:id')
  @Roles('ADMIN_TENANT')
  updateCiclo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCicloDto,
  ) {
    return this.config.updateCiclo(tenantId, id, dto);
  }

  @Delete('ciclos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCiclo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteCiclo(tenantId, id);
  }

  // ── Etapas ──────────────────────────────────────────────────────────────────

  @Get('ciclos/:id/etapas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listEtapas(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
  ) {
    return this.config.listEtapas(tenantId, cicloId);
  }

  @Post('ciclos/:id/etapas')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
    @Body() dto: CreateEtapaDto,
  ) {
    return this.config.createEtapa(tenantId, cicloId, dto);
  }

  @Patch('etapas/:id')
  @Roles('ADMIN_TENANT')
  updateEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEtapaDto,
  ) {
    return this.config.updateEtapa(tenantId, id, dto);
  }

  @Delete('etapas/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEtapa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteEtapa(tenantId, id);
  }

  // ── Campos ──────────────────────────────────────────────────────────────────

  @Post('etapas/:id/campos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) etapaId: number,
    @Body() dto: CreateCampoDto,
  ) {
    return this.config.createCampo(tenantId, etapaId, dto);
  }

  @Patch('campos/:id')
  @Roles('ADMIN_TENANT')
  updateCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampoDto,
  ) {
    return this.config.updateCampo(tenantId, id, dto);
  }

  @Delete('campos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCampo(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteCampo(tenantId, id);
  }

  // ── Gatilhos ────────────────────────────────────────────────────────────────

  @Get('ciclos/:id/gatilhos')
  @Roles('ADMIN_TENANT')
  listGatilhos(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
  ) {
    return this.config.listGatilhos(tenantId, cicloId);
  }

  @Post('ciclos/:id/gatilhos')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  createGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) cicloId: number,
    @Body() dto: CreateGatilhoDto,
  ) {
    return this.config.createGatilho(tenantId, cicloId, dto);
  }

  @Patch('gatilhos/:id')
  @Roles('ADMIN_TENANT')
  updateGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGatilhoDto,
  ) {
    return this.config.updateGatilho(tenantId, id, dto);
  }

  @Delete('gatilhos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGatilho(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.config.deleteGatilho(tenantId, id);
  }
}
```

- [ ] **Step 3.3: Commit config module**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/planos-acao/config/
git commit -m "feat(planos-acao): add config service and controller (ciclos/etapas/campos/gatilhos)"
```

---

## Task 4: Backend PA Service + PA Controller

**Files:**
- Create: `backend/src/planos-acao/pa/pa.service.ts`
- Create: `backend/src/planos-acao/pa/pa.controller.ts`

- [ ] **Step 4.1: Write pa.service.ts**

```typescript
// backend/src/planos-acao/pa/pa.service.ts
import {
  Injectable, NotFoundException, ForbiddenException,
  UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaDto } from '../dto/create-pa.dto';
import { UpdatePaDto } from '../dto/update-pa.dto';
import { TransicaoDto } from '../dto/transicao.dto';

export interface AvaliarGatilhosContexto {
  taxaConformidade?: number;
  temItemCriticoNc?: boolean;
  obraId: number;
  tituloSugerido?: string;
}

@Injectable()
export class PaService {
  private readonly logger = new Logger(PaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async getPaOuFalhar(tenantId: number, paId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT p.*, e.nome AS etapa_nome, e.cor AS etapa_cor,
              e.is_final AS etapa_is_final, e.roles_transicao AS etapa_roles_transicao
       FROM pa_plano_acao p
       JOIN pa_config_etapa e ON e.id = p.etapa_atual_id
       WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
      paId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Plano de Ação ${paId} não encontrado`);
    return rows[0];
  }

  private async gerarNumero(tenantId: number): Promise<string> {
    const ano = new Date().getFullYear();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) AS total FROM pa_plano_acao WHERE tenant_id = $1 AND numero LIKE $2`,
      tenantId, `PA-${ano}-%`,
    );
    const seq = Number(rows[0].total) + 1;
    return `PA-${ano}-${String(seq).padStart(4, '0')}`;
  }

  private async getEtapaInicialDoCiclo(cicloId: number): Promise<any> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE ciclo_id = $1 AND is_inicial = TRUE ORDER BY ordem LIMIT 1`,
      cicloId,
    );
    if (!rows.length) {
      throw new UnprocessableEntityException(
        `O ciclo ${cicloId} não possui etapa inicial configurada (is_inicial = true)`,
      );
    }
    return rows[0];
  }

  private validarCamposObrigatorios(
    campos: any[],
    camposExtras: Record<string, unknown>,
  ): void {
    for (const campo of campos) {
      if (campo.obrigatorio) {
        const val = camposExtras[campo.chave];
        if (val === undefined || val === null || val === '') {
          throw new UnprocessableEntityException(
            `Campo obrigatório ausente na transição: "${campo.nome}" (chave: ${campo.chave})`,
          );
        }
      }
    }
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async listPas(
    tenantId: number,
    filters: {
      obraId?: number;
      etapaId?: number;
      prioridade?: string;
      responsavelId?: number;
      modulo?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{ items: any[]; total: number }> {
    const conditions: string[] = [`p.tenant_id = $1`, `p.deleted_at IS NULL`];
    const vals: unknown[] = [tenantId];
    let i = 2;

    if (filters.obraId)       { conditions.push(`p.obra_id = $${i++}`);          vals.push(filters.obraId); }
    if (filters.etapaId)      { conditions.push(`p.etapa_atual_id = $${i++}`);   vals.push(filters.etapaId); }
    if (filters.prioridade)   { conditions.push(`p.prioridade = $${i++}`);       vals.push(filters.prioridade); }
    if (filters.responsavelId){ conditions.push(`p.responsavel_id = $${i++}`);   vals.push(filters.responsavelId); }
    if (filters.modulo)       { conditions.push(`p.modulo = $${i++}`);           vals.push(filters.modulo); }

    const where = conditions.join(' AND ');
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 30;
    const offset = (page - 1) * limit;

    const [countRows, items] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) AS total FROM pa_plano_acao p WHERE ${where}`,
        ...vals,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT p.*, e.nome AS etapa_nome, e.cor AS etapa_cor, e.ordem AS etapa_ordem
         FROM pa_plano_acao p
         JOIN pa_config_etapa e ON e.id = p.etapa_atual_id
         WHERE ${where}
         ORDER BY p.created_at DESC
         LIMIT $${i++} OFFSET $${i}`,
        ...vals, limit, offset,
      ),
    ]);

    return { items, total: Number(countRows[0].total) };
  }

  async getPa(tenantId: number, paId: number): Promise<any> {
    const pa = await this.getPaOuFalhar(tenantId, paId);

    const [etapas, historico, campos] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM pa_config_etapa WHERE ciclo_id = $1 ORDER BY ordem`,
        pa.ciclo_id,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT h.*, ed.nome AS etapa_de_nome, ep.nome AS etapa_para_nome
         FROM pa_historico h
         LEFT JOIN pa_config_etapa ed ON ed.id = h.etapa_de_id
         JOIN pa_config_etapa ep ON ep.id = h.etapa_para_id
         WHERE h.pa_id = $1
         ORDER BY h.created_at DESC`,
        paId,
      ),
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM pa_config_campo WHERE etapa_id = $1 ORDER BY ordem`,
        pa.etapa_atual_id,
      ),
    ]);

    return { ...pa, etapas_ciclo: etapas, historico, campos_etapa_atual: campos };
  }

  async createPa(tenantId: number, userId: number, dto: CreatePaDto): Promise<any> {
    const etapaInicial = await this.getEtapaInicialDoCiclo(dto.cicloId);
    const numero = await this.gerarNumero(tenantId);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO pa_plano_acao
         (tenant_id, ciclo_id, etapa_atual_id, modulo, origem_tipo, origem_id,
          obra_id, numero, titulo, descricao, prioridade, responsavel_id,
          prazo, campos_extras, aberto_por)
       VALUES ($1,$2,$3,'FVS',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
       RETURNING *`,
      tenantId,
      dto.cicloId,
      etapaInicial.id,
      dto.origemTipo ?? 'MANUAL',
      dto.origemId ?? null,
      dto.obraId,
      numero,
      dto.titulo,
      dto.descricao ?? null,
      dto.prioridade ?? 'MEDIA',
      dto.responsavelId ?? null,
      dto.prazo ?? null,
      JSON.stringify(dto.camposExtras ?? {}),
      userId,
    );

    const pa = rows[0];

    // Record initial history entry
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO pa_historico
         (tenant_id, pa_id, etapa_de_id, etapa_para_id, comentario, campos_extras, criado_por)
       VALUES ($1, $2, NULL, $3, 'PA aberto', '{}'::jsonb, $4)`,
      tenantId, pa.id, etapaInicial.id, userId,
    );

    return pa;
  }

  async updatePa(tenantId: number, paId: number, dto: UpdatePaDto): Promise<any> {
    await this.getPaOuFalhar(tenantId, paId);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.titulo         !== undefined) { sets.push(`titulo = $${i++}`);          vals.push(dto.titulo); }
    if (dto.descricao      !== undefined) { sets.push(`descricao = $${i++}`);        vals.push(dto.descricao); }
    if (dto.prioridade     !== undefined) { sets.push(`prioridade = $${i++}`);       vals.push(dto.prioridade); }
    if (dto.responsavelId  !== undefined) { sets.push(`responsavel_id = $${i++}`);   vals.push(dto.responsavelId); }
    if (dto.prazo          !== undefined) { sets.push(`prazo = $${i++}`);            vals.push(dto.prazo); }
    if (dto.camposExtras   !== undefined) {
      sets.push(`campos_extras = $${i++}::jsonb`);
      vals.push(JSON.stringify(dto.camposExtras));
    }
    sets.push(`updated_at = NOW()`);
    vals.push(paId, tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `UPDATE pa_plano_acao SET ${sets.join(', ')} WHERE id = $${i++} AND tenant_id = $${i} AND deleted_at IS NULL RETURNING *`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Plano de Ação ${paId} não encontrado`);
    return rows[0];
  }

  async transicionarEtapa(
    tenantId: number,
    paId: number,
    userId: number,
    userRole: string,
    dto: TransicaoDto,
  ): Promise<any> {
    const pa = await this.getPaOuFalhar(tenantId, paId);

    // Verify role permission for current stage
    const rolesPermitidos: string[] = pa.etapa_roles_transicao ?? [];
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(userRole)) {
      throw new ForbiddenException('Sem permissão para transicionar nesta etapa');
    }

    // Verify target stage belongs to same cycle
    const etapaParaRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_etapa WHERE id = $1 AND ciclo_id = $2`,
      dto.etapaParaId, pa.ciclo_id,
    );
    if (!etapaParaRows.length) {
      throw new UnprocessableEntityException(
        `Etapa ${dto.etapaParaId} não pertence ao ciclo do PA`,
      );
    }
    const etapaPara = etapaParaRows[0];

    // Validate required fields for target stage
    const camposProxEtapa = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pa_config_campo WHERE etapa_id = $1 ORDER BY ordem`,
      dto.etapaParaId,
    );
    this.validarCamposObrigatorios(camposProxEtapa, dto.camposExtras ?? {});

    // Merge campos_extras
    const camposAtualizados = { ...pa.campos_extras, ...(dto.camposExtras ?? {}) };

    const fechadoEm = etapaPara.is_final ? 'NOW()' : 'NULL';
    const fechadoPor = etapaPara.is_final ? userId : null;

    return this.prisma.$transaction(async (tx) => {
      const paRows = await tx.$queryRawUnsafe<any[]>(
        `UPDATE pa_plano_acao
         SET etapa_atual_id = $1,
             campos_extras = $2::jsonb,
             fechado_em = ${etapaPara.is_final ? 'NOW()' : 'NULL'},
             fechado_por = $3,
             updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5 AND deleted_at IS NULL
         RETURNING *`,
        dto.etapaParaId,
        JSON.stringify(camposAtualizados),
        fechadoPor,
        paId,
        tenantId,
      );

      await tx.$executeRawUnsafe(
        `INSERT INTO pa_historico
           (tenant_id, pa_id, etapa_de_id, etapa_para_id, comentario, campos_extras, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
        tenantId,
        paId,
        pa.etapa_atual_id,
        dto.etapaParaId,
        dto.comentario ?? null,
        JSON.stringify(dto.camposExtras ?? {}),
        userId,
      );

      return paRows[0];
    });
  }

  async deletePa(tenantId: number, paId: number): Promise<void> {
    await this.getPaOuFalhar(tenantId, paId);
    await this.prisma.$executeRawUnsafe(
      `UPDATE pa_plano_acao SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      paId, tenantId,
    );
  }

  // ── Auto-trigger ─────────────────────────────────────────────────────────────

  async avaliarGatilhos(
    tenantId: number,
    origemTipo: 'INSPECAO_FVS' | 'NC_FVS',
    origemId: number,
    contexto: AvaliarGatilhosContexto,
  ): Promise<void> {
    const gatilhos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT g.*, c.id AS ciclo_id
       FROM pa_config_gatilho g
       JOIN pa_config_ciclo c ON c.id = g.ciclo_id
       WHERE g.tenant_id = $1 AND g.modulo = 'FVS' AND g.ativo = TRUE AND c.ativo = TRUE`,
      tenantId,
    );

    for (const gatilho of gatilhos) {
      let deveAbrir = false;

      if (
        gatilho.condicao === 'TAXA_CONFORMIDADE_ABAIXO' &&
        contexto.taxaConformidade !== undefined &&
        contexto.taxaConformidade < Number(gatilho.valor_limiar)
      ) {
        deveAbrir = true;
      } else if (
        gatilho.condicao === 'ITEM_CRITICO_NC' &&
        contexto.temItemCriticoNc === true
      ) {
        deveAbrir = true;
      }

      if (!deveAbrir) continue;

      // Check for existing open PA with same origin
      const existing = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM pa_plano_acao
         WHERE tenant_id = $1 AND origem_tipo = $2 AND origem_id = $3
           AND deleted_at IS NULL AND fechado_em IS NULL
         LIMIT 1`,
        tenantId, origemTipo, origemId,
      );
      if (existing.length) {
        this.logger.log(
          `Gatilho ${gatilho.id} disparou mas PA já existe para ${origemTipo}#${origemId} — ignorando`,
        );
        continue;
      }

      try {
        await this.createPa(tenantId, 0 /* sistema */, {
          cicloId: gatilho.ciclo_id,
          obraId: contexto.obraId,
          titulo: contexto.tituloSugerido ?? `PA automático — ${origemTipo}#${origemId}`,
          origemTipo,
          origemId,
          prioridade: 'ALTA',
        });
        this.logger.log(
          `PA criado automaticamente via gatilho ${gatilho.id} para ${origemTipo}#${origemId}`,
        );
      } catch (err) {
        this.logger.error(
          `Falha ao criar PA automático via gatilho ${gatilho.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
```

- [ ] **Step 4.2: Write pa.controller.ts**

```typescript
// backend/src/planos-acao/pa/pa.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  ParseIntPipe, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId, CurrentUser } from '../../common/decorators/tenant.decorator';
import { PaService } from './pa.service';
import { CreatePaDto } from '../dto/create-pa.dto';
import { UpdatePaDto } from '../dto/update-pa.dto';
import { TransicaoDto } from '../dto/transicao.dto';

interface JwtUser { id: number; tenantId: number; role: string }

@Controller('api/v1/planos-acao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaController {
  constructor(private readonly pa: PaService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listPas(
    @TenantId() tenantId: number,
    @Query('obraId',        new ParseIntPipe({ optional: true })) obraId?: number,
    @Query('etapaId',       new ParseIntPipe({ optional: true })) etapaId?: number,
    @Query('responsavelId', new ParseIntPipe({ optional: true })) responsavelId?: number,
    @Query('page',          new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit',         new ParseIntPipe({ optional: true })) limit?: number,
    @Query('prioridade') prioridade?: string,
    @Query('modulo')     modulo?: string,
  ) {
    return this.pa.listPas(tenantId, { obraId, etapaId, prioridade, responsavelId, modulo, page, limit });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getPa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pa.getPa(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createPa(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaDto,
  ) {
    return this.pa.createPa(tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updatePa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaDto,
  ) {
    return this.pa.updatePa(tenantId, id, dto);
  }

  @Post(':id/transicao')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  transicionarEtapa(
    @TenantId() tenantId: number,
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TransicaoDto,
  ) {
    return this.pa.transicionarEtapa(tenantId, id, user.id, user.role, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePa(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.pa.deletePa(tenantId, id);
  }
}
```

- [ ] **Step 4.3: Commit PA service and controller**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/planos-acao/pa/
git commit -m "feat(planos-acao): add PA service and controller with transitions and number generation"
```

---

## Task 5: Unit Tests for PaService

**Files:**
- Create: `backend/src/planos-acao/pa/pa.service.spec.ts`

- [ ] **Step 5.1: Write failing tests**

```typescript
// backend/src/planos-acao/pa/pa.service.spec.ts
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PaService } from './pa.service';

const TENANT_ID = 10;
const USER_ID = 99;

const CICLO = { id: 1, tenant_id: TENANT_ID, nome: 'Ciclo FVS', ativo: true };
const ETAPA_INICIAL = {
  id: 1, ciclo_id: 1, nome: 'Aberto', ordem: 0, cor: '#EF4444',
  is_inicial: true, is_final: false, roles_transicao: [],
};
const ETAPA_RESOLUCAO = {
  id: 2, ciclo_id: 1, nome: 'Em Resolução', ordem: 1, cor: '#F59E0B',
  is_inicial: false, is_final: false, roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};
const ETAPA_FINAL = {
  id: 3, ciclo_id: 1, nome: 'Fechado', ordem: 2, cor: '#10B981',
  is_inicial: false, is_final: true, roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};

const PA_ABERTO = {
  id: 1, tenant_id: TENANT_ID, ciclo_id: 1, etapa_atual_id: 1,
  numero: 'PA-2026-0001', titulo: 'Desvio estrutural',
  prioridade: 'ALTA', deleted_at: null, fechado_em: null,
  campos_extras: {},
  etapa_roles_transicao: [],
};

const PA_EM_RESOLUCAO = {
  ...PA_ABERTO, etapa_atual_id: 2,
  etapa_roles_transicao: ['ENGENHEIRO', 'ADMIN_TENANT'],
};

const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): PaService {
  return new (PaService as any)(mockPrisma);
}

describe('PaService', () => {
  let svc: PaService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── gerarNumero ─────────────────────────────────────────────────────────────
  describe('gerarNumero (via createPa)', () => {
    it('gera PA-{ANO}-0001 quando não há PAs no tenant', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ETAPA_INICIAL])           // getEtapaInicialDoCiclo
        .mockResolvedValueOnce([{ total: '0' }])          // COUNT para gerarNumero
        .mockResolvedValueOnce([{ ...PA_ABERTO, numero: `PA-${ano}-0001` }]); // INSERT
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createPa(TENANT_ID, USER_ID, {
        cicloId: 1, obraId: 5, titulo: 'Desvio estrutural',
      });

      expect(result.numero).toBe(`PA-${ano}-0001`);
    });

    it('gera PA-{ANO}-0003 quando já existem 2 PAs', async () => {
      const ano = new Date().getFullYear();
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([ETAPA_INICIAL])
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([{ ...PA_ABERTO, numero: `PA-${ano}-0003` }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.createPa(TENANT_ID, USER_ID, {
        cicloId: 1, obraId: 5, titulo: 'Desvio 2',
      });

      expect(result.numero).toBe(`PA-${ano}-0003`);
    });
  });

  // ── createPa — ciclo sem etapa inicial ─────────────────────────────────────
  describe('createPa()', () => {
    it('lança UnprocessableEntityException se ciclo não tem etapa inicial', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]); // sem etapa inicial

      await expect(
        svc.createPa(TENANT_ID, USER_ID, { cicloId: 1, obraId: 5, titulo: 'Teste' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  // ── transicionarEtapa ───────────────────────────────────────────────────────
  describe('transicionarEtapa()', () => {
    it('lança ForbiddenException se role não está em roles_transicao', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([PA_EM_RESOLUCAO]);

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'TECNICO', {
          etapaParaId: 3, comentario: 'ok',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança UnprocessableEntityException se etapa destino não pertence ao ciclo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO]) // getPaOuFalhar
        .mockResolvedValueOnce([]);               // etapa destino não encontrada no ciclo

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
          etapaParaId: 999,
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('lança UnprocessableEntityException se campo obrigatório ausente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO])
        .mockResolvedValueOnce([ETAPA_FINAL])
        .mockResolvedValueOnce([{ id: 1, chave: 'evidencia_acao', obrigatorio: true, nome: 'Evidência' }]);

      await expect(
        svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
          etapaParaId: 3, camposExtras: {},
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('seta fechado_em quando etapa destino is_final=true', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_EM_RESOLUCAO])
        .mockResolvedValueOnce([ETAPA_FINAL])
        .mockResolvedValueOnce([]); // sem campos obrigatórios

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...PA_ABERTO, etapa_atual_id: 3, fechado_em: new Date() }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
        etapaParaId: 3,
      });

      expect(result.fechado_em).toBeTruthy();
    });

    it('avança etapa com sucesso quando role autorizado', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([PA_ABERTO])
        .mockResolvedValueOnce([ETAPA_RESOLUCAO])
        .mockResolvedValueOnce([]);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...PA_ABERTO, etapa_atual_id: 2 }]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const result = await svc.transicionarEtapa(TENANT_ID, 1, USER_ID, 'ENGENHEIRO', {
        etapaParaId: 2, comentario: 'Iniciando resolução',
      });

      expect(result.etapa_atual_id).toBe(2);
    });
  });

  // ── avaliarGatilhos ─────────────────────────────────────────────────────────
  describe('avaliarGatilhos()', () => {
    it('não abre PA se taxa acima do limiar', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
      ]);
      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 85, obraId: 5,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('abre PA quando taxa abaixo do limiar e sem PA existente', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
        ])
        .mockResolvedValueOnce([]) // sem PA existente
        .mockResolvedValueOnce([ETAPA_INICIAL]) // getEtapaInicial
        .mockResolvedValueOnce([{ total: '0' }]) // gerarNumero
        .mockResolvedValueOnce([PA_ABERTO]); // INSERT
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 65, obraId: 5,
      });

      expect(createSpy).toHaveBeenCalledWith(
        TENANT_ID, 0,
        expect.objectContaining({ origemTipo: 'INSPECAO_FVS', origemId: 42 }),
      );
    });

    it('não abre PA duplicado quando já existe PA aberto para mesma origem', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 1, ciclo_id: 1, condicao: 'TAXA_CONFORMIDADE_ABAIXO', valor_limiar: 80, ativo: true },
        ])
        .mockResolvedValueOnce([{ id: 99 }]); // PA existente

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 42, {
        taxaConformidade: 65, obraId: 5,
      });

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('abre PA quando temItemCriticoNc=true e gatilho ITEM_CRITICO_NC ativo', async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { id: 2, ciclo_id: 1, condicao: 'ITEM_CRITICO_NC', criticidade_min: 'critico', ativo: true },
        ])
        .mockResolvedValueOnce([]) // sem PA existente
        .mockResolvedValueOnce([ETAPA_INICIAL])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([PA_ABERTO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      const createSpy = jest.spyOn(svc, 'createPa');

      await svc.avaliarGatilhos(TENANT_ID, 'INSPECAO_FVS', 10, {
        temItemCriticoNc: true, obraId: 5,
      });

      expect(createSpy).toHaveBeenCalled();
    });
  });

  // ── deletePa ─────────────────────────────────────────────────────────────────
  describe('deletePa()', () => {
    it('lança NotFoundException para PA inexistente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([]);

      await expect(svc.deletePa(TENANT_ID, 9999)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('executa soft delete no PA existente', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([PA_ABERTO]);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(undefined);

      await svc.deletePa(TENANT_ID, 1);

      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('deleted_at = NOW()'),
        1, TENANT_ID,
      );
    });
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail initially**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx jest src/planos-acao/pa/pa.service.spec.ts --no-coverage
```

Expected: Tests pass (since service is already written in Task 4). If any fail, debug by comparing method signatures in pa.service.ts.

- [ ] **Step 5.3: Commit tests**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/planos-acao/pa/pa.service.spec.ts
git commit -m "test(planos-acao): add unit tests for PaService"
```

---

## Task 6: NestJS Module + App Module Registration

**Files:**
- Create: `backend/src/planos-acao/planos-acao.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 6.1: Write planos-acao.module.ts**

```typescript
// backend/src/planos-acao/planos-acao.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigPlanosAcaoService } from './config/config.service';
import { ConfigController } from './config/config.controller';
import { PaService } from './pa/pa.service';
import { PaController } from './pa/pa.controller';

@Module({
  imports: [PrismaModule],
  providers: [ConfigPlanosAcaoService, PaService],
  controllers: [ConfigController, PaController],
  exports: [PaService],
})
export class PlanosAcaoModule {}
```

- [ ] **Step 6.2: Register PlanosAcaoModule in app.module.ts**

In `backend/src/app.module.ts`, add the import at the top:
```typescript
import { PlanosAcaoModule } from './planos-acao/planos-acao.module';
```

And add `PlanosAcaoModule` to the `imports` array after `EfetivoModule`:
```typescript
    EfetivoModule,
    DashboardModule,
    PlanosAcaoModule,
```

- [ ] **Step 6.3: Verify backend compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx tsc --noEmit
```

Expected output: no errors.

- [ ] **Step 6.4: Commit module registration**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/planos-acao/planos-acao.module.ts backend/src/app.module.ts
git commit -m "feat(planos-acao): register PlanosAcaoModule in AppModule"
```

---

## Task 7: Hook avaliarGatilhos into FVS Inspection Conclusion

**Files:**
- Modify: `backend/src/fvs/fvs.module.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`

- [ ] **Step 7.1: Import PlanosAcaoModule into FvsModule**

In `backend/src/fvs/fvs.module.ts`, add to imports at top:
```typescript
import { PlanosAcaoModule } from '../planos-acao/planos-acao.module';
```

Add `PlanosAcaoModule` to the `imports` array in the `@Module` decorator:
```typescript
  imports: [
    PrismaModule,
    GedModule,
    IaModule,
    PlanosAcaoModule,
    MulterModule.register({
```

- [ ] **Step 7.2: Inject PaService into InspecaoService**

In `backend/src/fvs/inspecao/inspecao.service.ts`, add import at the top of the file (after existing imports):
```typescript
import { PaService } from '../../planos-acao/pa/pa.service';
```

In the `InspecaoService` constructor, add the `PaService` parameter:
```typescript
  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
    private readonly roService: RoService,
    private readonly modeloService: ModeloService,
    private readonly paService: PaService,
  ) {}
```

- [ ] **Step 7.3: Call avaliarGatilhos after concluir**

In `backend/src/fvs/inspecao/inspecao.service.ts`, locate the block that runs after `dto.status === 'concluida'` (around line 431, inside the `$transaction`). After the `autoCreateRo` call, add:

```typescript
      // Após concluir inspeção, avaliar gatilhos de PA automático
      if (dto.status === 'concluida' && ficha.status === 'em_inspecao') {
        await this.autoCreateRo(tx, tenantId, fichaId, userId, ficha.regime, ip);

        // Calcular taxa de conformidade para gatilhos de PA
        const statsRows = await tx.$queryRawUnsafe<any[]>(
          `SELECT
             COUNT(*) FILTER (WHERE status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS conformes,
             COUNT(*) FILTER (WHERE status != 'nao_avaliado') AS avaliados,
             COUNT(*) FILTER (WHERE status IN ('nao_conforme','nc_apos_reinspecao') AND criticidade = 'critico') AS criticos_nc
           FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
          fichaId, tenantId,
        );
        const stats = statsRows[0];
        const avaliados = Number(stats.avaliados);
        const taxaConformidade = avaliados > 0
          ? (Number(stats.conformes) / avaliados) * 100
          : 100;
        const temItemCriticoNc = Number(stats.criticos_nc) > 0;

        // Fire-and-forget: não bloqueia a transação principal
        setImmediate(() => {
          this.paService.avaliarGatilhos(tenantId, 'INSPECAO_FVS', fichaId, {
            taxaConformidade,
            temItemCriticoNc,
            obraId: ficha.obra_id,
            tituloSugerido: `PA automático — Inspeção #${fichaId} (${taxaConformidade.toFixed(0)}% conformidade)`,
          }).catch((err) => this.logger.error(`avaliarGatilhos failed: ${err.message}`));
        });
      }
```

Note: The existing `autoCreateRo` call that was already there must remain. The stats query and `setImmediate` block are added after it. Remove the duplicate `if` wrapper — replace the entire existing block:

```typescript
      // Sprint 3: ao concluir, criar RO automático se há NCs
      if (dto.status === 'concluida' && ficha.status === 'em_inspecao') {
        await this.autoCreateRo(tx, tenantId, fichaId, userId, ficha.regime, ip);
      }
```

with:

```typescript
      // Sprint 3: ao concluir, criar RO automático se há NCs
      if (dto.status === 'concluida' && ficha.status === 'em_inspecao') {
        await this.autoCreateRo(tx, tenantId, fichaId, userId, ficha.regime, ip);

        // Sprint PA: avaliar gatilhos de abertura automática de Plano de Ação
        const statsRows = await tx.$queryRawUnsafe<any[]>(
          `SELECT
             COUNT(*) FILTER (WHERE status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS conformes,
             COUNT(*) FILTER (WHERE status != 'nao_avaliado') AS avaliados,
             COUNT(*) FILTER (WHERE status IN ('nao_conforme','nc_apos_reinspecao') AND criticidade = 'critico') AS criticos_nc
           FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
          fichaId, tenantId,
        );
        const stats = statsRows[0];
        const avaliados = Number(stats.avaliados);
        const taxaConformidade = avaliados > 0
          ? (Number(stats.conformes) / avaliados) * 100
          : 100;
        const temItemCriticoNc = Number(stats.criticos_nc) > 0;
        setImmediate(() => {
          this.paService.avaliarGatilhos(tenantId, 'INSPECAO_FVS', fichaId, {
            taxaConformidade,
            temItemCriticoNc,
            obraId: ficha.obra_id,
            tituloSugerido: `PA automático — Inspeção #${fichaId} (${taxaConformidade.toFixed(0)}% conformidade)`,
          }).catch((err) => this.logger.error(`avaliarGatilhos falhou: ${err.message}`));
        });
      }
```

- [ ] **Step 7.4: Verify backend still compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7.5: Commit integration**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/fvs/fvs.module.ts backend/src/fvs/inspecao/inspecao.service.ts
git commit -m "feat(planos-acao): hook avaliarGatilhos into FVS inspection conclusion"
```

---

## Task 8: Frontend Service + Hooks

**Files:**
- Create: `frontend-web/src/services/planos-acao.service.ts`
- Create: `frontend-web/src/modules/fvs/planos-acao/hooks/usePlanosAcao.ts`
- Create: `frontend-web/src/modules/fvs/planos-acao/hooks/useConfigPlanosAcao.ts`

- [ ] **Step 8.1: Create directory structure**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/modules/fvs/planos-acao/hooks"
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/modules/fvs/planos-acao/pages"
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/modules/fvs/planos-acao/components"
```

- [ ] **Step 8.2: Write planos-acao.service.ts**

```typescript
// frontend-web/src/services/planos-acao.service.ts
import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PaModulo = 'FVS' | 'FVM' | 'NC';
export type PaCondicao = 'TAXA_CONFORMIDADE_ABAIXO' | 'ITEM_CRITICO_NC' | 'NC_ABERTA';
export type PaPrioridade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
export type PaCampoTipo = 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo';

export interface PaConfigCiclo {
  id: number;
  tenant_id: number;
  modulo: PaModulo;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  etapas?: PaConfigEtapa[];
}

export interface PaConfigEtapa {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  nome: string;
  ordem: number;
  cor: string;
  is_inicial: boolean;
  is_final: boolean;
  prazo_dias: number | null;
  roles_transicao: string[];
  created_at: string;
  campos?: PaConfigCampo[];
}

export interface PaConfigCampo {
  id: number;
  tenant_id: number;
  etapa_id: number;
  nome: string;
  chave: string;
  tipo: PaCampoTipo;
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  created_at: string;
}

export interface PaConfigGatilho {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  modulo: PaModulo;
  condicao: PaCondicao;
  valor_limiar: number | null;
  criticidade_min: string | null;
  ativo: boolean;
  created_at: string;
}

export interface PlanoAcao {
  id: number;
  tenant_id: number;
  ciclo_id: number;
  etapa_atual_id: number;
  etapa_nome: string;
  etapa_cor: string;
  etapa_is_final: boolean;
  modulo: PaModulo;
  origem_tipo: string | null;
  origem_id: number | null;
  obra_id: number;
  numero: string;
  titulo: string;
  descricao: string | null;
  prioridade: PaPrioridade;
  responsavel_id: number | null;
  prazo: string | null;
  campos_extras: Record<string, unknown>;
  aberto_por: number;
  fechado_em: string | null;
  fechado_por: number | null;
  created_at: string;
  updated_at: string;
  // detail fields
  etapas_ciclo?: PaConfigEtapa[];
  historico?: PaHistoricoEntry[];
  campos_etapa_atual?: PaConfigCampo[];
}

export interface PaHistoricoEntry {
  id: number;
  pa_id: number;
  etapa_de_id: number | null;
  etapa_para_id: number;
  etapa_de_nome: string | null;
  etapa_para_nome: string;
  comentario: string | null;
  campos_extras: Record<string, unknown>;
  criado_por: number;
  created_at: string;
}

export interface PaListResult {
  items: PlanoAcao[];
  total: number;
}

// ── Config API calls ───────────────────────────────────────────────────────────

export const planosAcaoService = {
  // Ciclos
  getCiclos: (modulo?: string) =>
    api.get<PaConfigCiclo[]>('/api/v1/planos-acao/config/ciclos', { params: { modulo } }),

  createCiclo: (data: { modulo: PaModulo; nome: string; descricao?: string }) =>
    api.post<PaConfigCiclo>('/api/v1/planos-acao/config/ciclos', data),

  updateCiclo: (id: number, data: { nome?: string; descricao?: string; ativo?: boolean }) =>
    api.patch<PaConfigCiclo>(`/api/v1/planos-acao/config/ciclos/${id}`, data),

  deleteCiclo: (id: number) =>
    api.delete(`/api/v1/planos-acao/config/ciclos/${id}`),

  // Etapas
  getEtapas: (cicloId: number) =>
    api.get<PaConfigEtapa[]>(`/api/v1/planos-acao/config/ciclos/${cicloId}/etapas`),

  createEtapa: (cicloId: number, data: {
    nome: string; ordem: number; cor?: string;
    isInicial?: boolean; isFinal?: boolean;
    prazoDias?: number; rolesTransicao?: string[];
  }) =>
    api.post<PaConfigEtapa>(`/api/v1/planos-acao/config/ciclos/${cicloId}/etapas`, data),

  updateEtapa: (id: number, data: {
    nome?: string; ordem?: number; cor?: string;
    isInicial?: boolean; isFinal?: boolean;
    prazoDias?: number | null; rolesTransicao?: string[];
  }) =>
    api.patch<PaConfigEtapa>(`/api/v1/planos-acao/config/etapas/${id}`, data),

  deleteEtapa: (id: number) =>
    api.delete(`/api/v1/planos-acao/config/etapas/${id}`),

  // Campos
  createCampo: (etapaId: number, data: {
    nome: string; chave: string; tipo: PaCampoTipo;
    opcoes?: string[]; obrigatorio?: boolean; ordem?: number;
  }) =>
    api.post<PaConfigCampo>(`/api/v1/planos-acao/config/etapas/${etapaId}/campos`, data),

  updateCampo: (id: number, data: {
    nome?: string; tipo?: PaCampoTipo; opcoes?: string[];
    obrigatorio?: boolean; ordem?: number;
  }) =>
    api.patch<PaConfigCampo>(`/api/v1/planos-acao/config/campos/${id}`, data),

  deleteCampo: (id: number) =>
    api.delete(`/api/v1/planos-acao/config/campos/${id}`),

  // Gatilhos
  getGatilhos: (cicloId: number) =>
    api.get<PaConfigGatilho[]>(`/api/v1/planos-acao/config/ciclos/${cicloId}/gatilhos`),

  createGatilho: (cicloId: number, data: {
    condicao: PaCondicao; valorLimiar?: number; criticidadeMin?: string;
  }) =>
    api.post<PaConfigGatilho>(`/api/v1/planos-acao/config/ciclos/${cicloId}/gatilhos`, data),

  updateGatilho: (id: number, data: { valorLimiar?: number; criticidadeMin?: string; ativo?: boolean }) =>
    api.patch<PaConfigGatilho>(`/api/v1/planos-acao/config/gatilhos/${id}`, data),

  deleteGatilho: (id: number) =>
    api.delete(`/api/v1/planos-acao/config/gatilhos/${id}`),

  // PA CRUD
  listPas: (params: {
    obraId?: number; etapaId?: number; prioridade?: string;
    responsavelId?: number; modulo?: string; page?: number; limit?: number;
  }) =>
    api.get<PaListResult>('/api/v1/planos-acao', { params }),

  getPa: (id: number) =>
    api.get<PlanoAcao>(`/api/v1/planos-acao/${id}`),

  createPa: (data: {
    cicloId: number; obraId: number; titulo: string; descricao?: string;
    prioridade?: PaPrioridade; responsavelId?: number; prazo?: string;
    origemTipo?: string; origemId?: number; camposExtras?: Record<string, unknown>;
  }) =>
    api.post<PlanoAcao>('/api/v1/planos-acao', data),

  updatePa: (id: number, data: {
    titulo?: string; descricao?: string; prioridade?: PaPrioridade;
    responsavelId?: number; prazo?: string; camposExtras?: Record<string, unknown>;
  }) =>
    api.patch<PlanoAcao>(`/api/v1/planos-acao/${id}`, data),

  transicionarEtapa: (id: number, data: {
    etapaParaId: number; comentario?: string; camposExtras?: Record<string, unknown>;
  }) =>
    api.post<PlanoAcao>(`/api/v1/planos-acao/${id}/transicao`, data),

  deletePa: (id: number) =>
    api.delete(`/api/v1/planos-acao/${id}`),
};
```

- [ ] **Step 8.3: Write usePlanosAcao.ts**

```typescript
// frontend-web/src/modules/fvs/planos-acao/hooks/usePlanosAcao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  planosAcaoService,
  type PaPrioridade,
} from '../../../../services/planos-acao.service';

export function usePlanosAcao(params: {
  obraId?: number; etapaId?: number; prioridade?: string;
  responsavelId?: number; modulo?: string; page?: number; limit?: number;
}) {
  return useQuery({
    queryKey: ['pa-list', params],
    queryFn: () => planosAcaoService.listPas(params),
  });
}

export function usePlanoAcao(id: number) {
  return useQuery({
    queryKey: ['pa-detail', id],
    queryFn: () => planosAcaoService.getPa(id),
    enabled: !!id,
  });
}

export function useCreatePa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      cicloId: number; obraId: number; titulo: string; descricao?: string;
      prioridade?: PaPrioridade; responsavelId?: number; prazo?: string;
    }) => planosAcaoService.createPa(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-list'] }),
  });
}

export function useUpdatePa(paId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      titulo?: string; descricao?: string; prioridade?: PaPrioridade;
      responsavelId?: number; prazo?: string;
    }) => planosAcaoService.updatePa(paId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-detail', paId] });
      qc.invalidateQueries({ queryKey: ['pa-list'] });
    },
  });
}

export function useTransicionarEtapa(paId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      etapaParaId: number; comentario?: string; camposExtras?: Record<string, unknown>;
    }) => planosAcaoService.transicionarEtapa(paId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-detail', paId] });
      qc.invalidateQueries({ queryKey: ['pa-list'] });
    },
  });
}

export function useDeletePa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deletePa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-list'] }),
  });
}
```

- [ ] **Step 8.4: Write useConfigPlanosAcao.ts**

```typescript
// frontend-web/src/modules/fvs/planos-acao/hooks/useConfigPlanosAcao.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  planosAcaoService,
  type PaModulo,
  type PaCampoTipo,
  type PaCondicao,
} from '../../../../services/planos-acao.service';

export function useCiclos(modulo?: string) {
  return useQuery({
    queryKey: ['pa-ciclos', modulo],
    queryFn: () => planosAcaoService.getCiclos(modulo),
  });
}

export function useCreateCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { modulo: PaModulo; nome: string; descricao?: string }) =>
      planosAcaoService.createCiclo(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useUpdateCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nome?: string; descricao?: string; ativo?: boolean } }) =>
      planosAcaoService.updateCiclo(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useDeleteCiclo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteCiclo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-ciclos'] }),
  });
}

export function useEtapas(cicloId: number) {
  return useQuery({
    queryKey: ['pa-etapas', cicloId],
    queryFn: () => planosAcaoService.getEtapas(cicloId),
    enabled: !!cicloId,
  });
}

export function useCreateEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      nome: string; ordem: number; cor?: string;
      isInicial?: boolean; isFinal?: boolean;
      prazoDias?: number; rolesTransicao?: string[];
    }) => planosAcaoService.createEtapa(cicloId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] });
      qc.invalidateQueries({ queryKey: ['pa-ciclos'] });
    },
  });
}

export function useUpdateEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: number;
      data: { nome?: string; ordem?: number; cor?: string; prazoDias?: number | null; rolesTransicao?: string[] };
    }) => planosAcaoService.updateEtapa(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useDeleteEtapa(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteEtapa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useCreateCampo(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ etapaId, data }: {
      etapaId: number;
      data: { nome: string; chave: string; tipo: PaCampoTipo; opcoes?: string[]; obrigatorio?: boolean; ordem?: number };
    }) => planosAcaoService.createCampo(etapaId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useDeleteCampo(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteCampo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-etapas', cicloId] }),
  });
}

export function useGatilhos(cicloId: number) {
  return useQuery({
    queryKey: ['pa-gatilhos', cicloId],
    queryFn: () => planosAcaoService.getGatilhos(cicloId),
    enabled: !!cicloId,
  });
}

export function useCreateGatilho(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { condicao: PaCondicao; valorLimiar?: number; criticidadeMin?: string }) =>
      planosAcaoService.createGatilho(cicloId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-gatilhos', cicloId] }),
  });
}

export function useDeleteGatilho(cicloId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => planosAcaoService.deleteGatilho(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pa-gatilhos', cicloId] }),
  });
}
```

- [ ] **Step 8.5: Commit service and hooks**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/services/planos-acao.service.ts \
        frontend-web/src/modules/fvs/planos-acao/hooks/
git commit -m "feat(planos-acao): add frontend service and TanStack Query hooks"
```

---

## Task 9: Frontend Shared Components

**Files:**
- Create: `frontend-web/src/modules/fvs/planos-acao/components/PaCard.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/PaKanban.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/PaStagePipeline.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/PaHistoryTimeline.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/PaDynamicFields.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/TransicaoModal.tsx`
- Create: `frontend-web/src/modules/fvs/planos-acao/components/NovoPaModal.tsx`

- [ ] **Step 9.1: Write PaCard.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/PaCard.tsx
import { Link } from 'react-router-dom';
import { Calendar, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PlanoAcao } from '../../../../services/planos-acao.service';

const PRIORIDADE_STYLES: Record<string, string> = {
  BAIXA:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIA:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ALTA:    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface PaCardProps {
  pa: PlanoAcao;
  obraId: number;
}

function isSlaVencido(prazo: string | null): boolean {
  if (!prazo) return false;
  return new Date(prazo) < new Date();
}

export function PaCard({ pa, obraId }: PaCardProps) {
  const vencido = isSlaVencido(pa.prazo);

  return (
    <Link
      to={`/obras/${obraId}/fvs/planos-acao/${pa.id}`}
      className={cn(
        'block rounded-lg border p-3 transition-shadow hover:shadow-md',
        'bg-[var(--bg-surface)] border-[var(--border-dim)]',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-mono text-[var(--text-faint)]">{pa.numero}</span>
        <span
          className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
            PRIORIDADE_STYLES[pa.prioridade] ?? PRIORIDADE_STYLES.MEDIA,
          )}
        >
          {pa.prioridade}
        </span>
      </div>

      <p className="text-[13px] font-medium text-[var(--text-high)] line-clamp-2 mb-2">
        {pa.titulo}
      </p>

      <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)]">
        {pa.responsavel_id && (
          <span className="flex items-center gap-1">
            <User size={11} />
            #{pa.responsavel_id}
          </span>
        )}
        {pa.prazo && (
          <span className={cn('flex items-center gap-1', vencido && 'text-red-500 font-semibold')}>
            {vencido && <AlertTriangle size={11} />}
            <Calendar size={11} />
            {new Date(pa.prazo).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: pa.etapa_cor }}
        />
        <span className="text-[11px] text-[var(--text-faint)]">{pa.etapa_nome}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 9.2: Write PaKanban.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/PaKanban.tsx
import { PaCard } from './PaCard';
import type { PlanoAcao, PaConfigEtapa } from '../../../../services/planos-acao.service';

interface PaKanbanProps {
  pas: PlanoAcao[];
  etapas: PaConfigEtapa[];
  obraId: number;
}

export function PaKanban({ pas, etapas, obraId }: PaKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[400px]">
      {etapas.map((etapa) => {
        const etapaPas = pas.filter((p) => p.etapa_atual_id === etapa.id);
        return (
          <div key={etapa.id} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: etapa.cor }}
              />
              <h3 className="text-[13px] font-semibold text-[var(--text-high)]">
                {etapa.nome}
              </h3>
              <span className="ml-auto text-[11px] text-[var(--text-faint)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-full">
                {etapaPas.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2">
              {etapaPas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-dim)] p-4 text-center">
                  <p className="text-[12px] text-[var(--text-faint)]">Nenhum PA</p>
                </div>
              ) : (
                etapaPas.map((pa) => <PaCard key={pa.id} pa={pa} obraId={obraId} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9.3: Write PaStagePipeline.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/PaStagePipeline.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

interface PaStagePipelineProps {
  etapas: PaConfigEtapa[];
  etapaAtualId: number;
}

export function PaStagePipeline({ etapas, etapaAtualId }: PaStagePipelineProps) {
  const sorted = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const atualIdx = sorted.findIndex((e) => e.id === etapaAtualId);

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {sorted.map((etapa, idx) => {
        const isAtual     = etapa.id === etapaAtualId;
        const isConcluida = idx < atualIdx;

        return (
          <div key={etapa.id} className="flex items-center min-w-0">
            {/* Stage bubble */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'text-[11px] font-bold border-2 transition-colors',
                  isAtual
                    ? 'text-white border-transparent'
                    : isConcluida
                    ? 'border-transparent text-white'
                    : 'border-[var(--border-dim)] bg-[var(--bg-surface)] text-[var(--text-faint)]',
                )}
                style={
                  isAtual || isConcluida
                    ? { backgroundColor: etapa.cor }
                    : undefined
                }
              >
                {isConcluida ? <Check size={14} /> : idx + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] whitespace-nowrap max-w-[80px] text-center truncate',
                  isAtual ? 'font-semibold text-[var(--text-high)]' : 'text-[var(--text-faint)]',
                )}
              >
                {etapa.nome}
              </span>
            </div>

            {/* Connector */}
            {idx < sorted.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-8 flex-shrink-0 -mt-4',
                  isConcluida ? 'bg-[var(--accent)]' : 'bg-[var(--border-dim)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9.4: Write PaHistoryTimeline.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/PaHistoryTimeline.tsx
import { ArrowRight } from 'lucide-react';
import type { PaHistoricoEntry } from '../../../../services/planos-acao.service';

interface PaHistoryTimelineProps {
  historico: PaHistoricoEntry[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export function PaHistoryTimeline({ historico }: PaHistoryTimelineProps) {
  if (!historico.length) {
    return <p className="text-[13px] text-[var(--text-faint)]">Nenhum histórico.</p>;
  }

  return (
    <ol className="relative border-l border-[var(--border-dim)] ml-3">
      {historico.map((entry) => (
        <li key={entry.id} className="mb-6 ml-5">
          <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg-surface)]">
            <ArrowRight size={10} className="text-white" />
          </span>

          <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {entry.etapa_de_nome && (
                <>
                  <span className="text-[12px] text-[var(--text-faint)]">{entry.etapa_de_nome}</span>
                  <ArrowRight size={12} className="text-[var(--text-faint)]" />
                </>
              )}
              <span className="text-[12px] font-semibold text-[var(--text-high)]">
                {entry.etapa_para_nome}
              </span>
              <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                {timeAgo(entry.created_at)}
              </span>
            </div>
            {entry.comentario && (
              <p className="text-[12px] text-[var(--text-medium)] mt-1 italic">
                "{entry.comentario}"
              </p>
            )}
            <p className="text-[11px] text-[var(--text-faint)] mt-1">
              Por usuário #{entry.criado_por}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 9.5: Write PaDynamicFields.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/PaDynamicFields.tsx
import type { PaConfigCampo } from '../../../../services/planos-acao.service';

interface PaDynamicFieldsProps {
  campos: PaConfigCampo[];
  values: Record<string, unknown>;
  onChange: (chave: string, value: unknown) => void;
  readOnly?: boolean;
}

export function PaDynamicFields({ campos, values, onChange, readOnly }: PaDynamicFieldsProps) {
  if (!campos.length) return null;

  return (
    <div className="flex flex-col gap-4">
      {campos.map((campo) => (
        <div key={campo.id} className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[var(--text-medium)]">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>

          {campo.tipo === 'texto' && (
            <textarea
              className="input-base min-h-[72px] resize-y text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
              placeholder={`Informe ${campo.nome.toLowerCase()}`}
            />
          )}

          {campo.tipo === 'numero' && (
            <input
              type="number"
              className="input-base text-[13px]"
              value={(values[campo.chave] as number) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.valueAsNumber)}
              disabled={readOnly}
            />
          )}

          {campo.tipo === 'data' && (
            <input
              type="date"
              className="input-base text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
            />
          )}

          {campo.tipo === 'select' && campo.opcoes && (
            <select
              className="input-base text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
            >
              <option value="">Selecione…</option>
              {campo.opcoes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {campo.tipo === 'usuario' && (
            <input
              type="number"
              className="input-base text-[13px]"
              value={(values[campo.chave] as number) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.valueAsNumber)}
              disabled={readOnly}
              placeholder="ID do usuário"
            />
          )}

          {campo.tipo === 'arquivo' && !readOnly && (
            <input
              type="file"
              className="input-base text-[13px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(campo.chave, file.name);
              }}
            />
          )}

          {campo.tipo === 'arquivo' && readOnly && values[campo.chave] && (
            <span className="text-[12px] text-[var(--accent)] underline cursor-pointer">
              {values[campo.chave] as string}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9.6: Write TransicaoModal.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/TransicaoModal.tsx
import { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PaDynamicFields } from './PaDynamicFields';
import { useTransicionarEtapa } from '../hooks/usePlanosAcao';
import type { PlanoAcao, PaConfigEtapa } from '../../../../services/planos-acao.service';

interface TransicaoModalProps {
  pa: PlanoAcao;
  etapasProximas: PaConfigEtapa[];
  onClose: () => void;
}

export function TransicaoModal({ pa, etapasProximas, onClose }: TransicaoModalProps) {
  const [etapaParaId, setEtapaParaId] = useState<number | null>(
    etapasProximas.length === 1 ? etapasProximas[0].id : null,
  );
  const [comentario, setComentario] = useState('');
  const [camposExtras, setCamposExtras] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const transicionar = useTransicionarEtapa(pa.id);
  const etapaSelecionada = etapasProximas.find((e) => e.id === etapaParaId);
  const camposObrigatorios = pa.campos_etapa_atual?.filter((c) => c.obrigatorio) ?? [];

  const handleSubmit = async () => {
    if (!etapaParaId) { setError('Selecione a próxima etapa'); return; }
    setError(null);
    try {
      await transicionar.mutateAsync({ etapaParaId, comentario: comentario || undefined, camposExtras });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao transicionar etapa');
    }
  };

  const isFinal = etapaSelecionada?.is_final ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-high)]">
            {isFinal ? 'Encerrar PA' : 'Avançar Etapa'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Stage selector (only if multiple options) */}
          {etapasProximas.length > 1 && (
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Próxima etapa <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col gap-2">
                {etapasProximas.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEtapaParaId(e.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors',
                      etapaParaId === e.id
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border-dim)] hover:border-[var(--accent)]',
                    )}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.cor }} />
                    <span className="text-[13px] text-[var(--text-high)]">{e.nome}</span>
                    {e.is_final && (
                      <span className="ml-auto text-[10px] text-emerald-600 font-semibold uppercase">
                        Encerra
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Required dynamic fields for next stage */}
          {etapaSelecionada && (pa.campos_etapa_atual?.length ?? 0) > 0 && (
            <div>
              <p className="text-[12px] font-medium text-[var(--text-medium)] mb-2">
                Campos obrigatórios da etapa "{etapaSelecionada.nome}"
              </p>
              <PaDynamicFields
                campos={pa.campos_etapa_atual ?? []}
                values={camposExtras}
                onChange={(chave, value) => setCamposExtras((prev) => ({ ...prev, [chave]: value }))}
              />
            </div>
          )}

          {/* Comment */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Comentário
            </label>
            <textarea
              className="input-base w-full min-h-[72px] resize-y text-[13px]"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Descreva o que foi feito (opcional)"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border-dim)] text-[var(--text-medium)] hover:bg-[var(--bg-hover)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!etapaParaId || transicionar.isPending}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-lg font-medium text-white',
              'bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <ArrowRight size={14} />
            {isFinal ? 'Encerrar PA' : 'Avançar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9.7: Write NovoPaModal.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/components/NovoPaModal.tsx
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCreatePa } from '../hooks/usePlanosAcao';
import { useCiclos } from '../hooks/useConfigPlanosAcao';
import type { PaPrioridade } from '../../../../services/planos-acao.service';

interface NovoPaModalProps {
  obraId: number;
  onClose: () => void;
}

const PRIORIDADES: PaPrioridade[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

export function NovoPaModal({ obraId, onClose }: NovoPaModalProps) {
  const [cicloId, setCicloId]     = useState('');
  const [titulo, setTitulo]       = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<PaPrioridade>('MEDIA');
  const [prazo, setPrazo]         = useState('');
  const [error, setError]         = useState<string | null>(null);

  const { data: ciclos } = useCiclos('FVS');
  const createPa = useCreatePa();

  const handleSubmit = async () => {
    if (!cicloId)  { setError('Selecione um ciclo'); return; }
    if (!titulo.trim()) { setError('Informe o título do PA'); return; }
    setError(null);
    try {
      await createPa.mutateAsync({
        cicloId: Number(cicloId),
        obraId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        prioridade,
        prazo: prazo || undefined,
        origemTipo: 'MANUAL',
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao criar PA');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-high)]">Novo Plano de Ação</h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Ciclo */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Ciclo <span className="text-red-500">*</span>
            </label>
            <select
              className="input-base w-full text-[13px]"
              value={cicloId}
              onChange={(e) => setCicloId(e.target.value)}
            >
              <option value="">Selecione o ciclo…</option>
              {ciclos?.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-base w-full text-[13px]"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Descreva o desvio ou ação necessária"
              maxLength={200}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
              Descrição
            </label>
            <textarea
              className="input-base w-full min-h-[72px] resize-y text-[13px]"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes adicionais (opcional)"
            />
          </div>

          {/* Prioridade + Prazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Prioridade
              </label>
              <select
                className="input-base w-full text-[13px]"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PaPrioridade)}
              >
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[var(--text-medium)] mb-1 block">
                Prazo
              </label>
              <input
                type="date"
                className="input-base w-full text-[13px]"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] rounded-lg border border-[var(--border-dim)] text-[var(--text-medium)] hover:bg-[var(--bg-hover)]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={createPa.isPending}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-[13px] rounded-lg font-medium text-white',
              'bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Plus size={14} />
            Criar PA
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9.8: Commit components**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/planos-acao/components/
git commit -m "feat(planos-acao): add shared UI components (card, kanban, pipeline, timeline, modals)"
```

---

## Task 10: Frontend — PlanosAcaoPage (List + Kanban)

**Files:**
- Create: `frontend-web/src/modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx`

- [ ] **Step 10.1: Write PlanosAcaoPage.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePlanosAcao } from '../hooks/usePlanosAcao';
import { useCiclos } from '../hooks/useConfigPlanosAcao';
import { PaCard } from '../components/PaCard';
import { PaKanban } from '../components/PaKanban';
import { NovoPaModal } from '../components/NovoPaModal';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

type ViewMode = 'list' | 'kanban';

export function PlanosAcaoPage() {
  const { obraId } = useParams<{ obraId: string }>();
  const numericObraId = Number(obraId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showNovo, setShowNovo] = useState(false);

  const etapaId    = searchParams.get('etapaId')    ? Number(searchParams.get('etapaId'))    : undefined;
  const prioridade = searchParams.get('prioridade') ?? undefined;
  const page       = searchParams.get('page')       ? Number(searchParams.get('page'))       : 1;

  const { data, isLoading, isError } = usePlanosAcao({
    obraId: numericObraId, etapaId, prioridade, page, modulo: 'FVS',
  });
  const { data: ciclos } = useCiclos('FVS');

  // Collect all unique stages from active cycles for kanban columns
  const todasEtapas: PaConfigEtapa[] = [];
  if (ciclos) {
    for (const ciclo of ciclos) {
      for (const etapa of ciclo.etapas ?? []) {
        if (!todasEtapas.find((e) => e.id === etapa.id)) {
          todasEtapas.push(etapa);
        }
      }
    }
    todasEtapas.sort((a, b) => a.ordem - b.ordem);
  }

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm animate-pulse">
        Carregando planos de ação…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        Erro ao carregar planos de ação.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-high)]">Planos de Ação</h1>
          <p className="text-[13px] text-[var(--text-faint)] mt-0.5">
            {data?.total ?? 0} plano(s) encontrado(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--border-dim)] overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'px-3 py-1.5 text-[12px] flex items-center gap-1',
                viewMode === 'kanban'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-faint)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'px-3 py-1.5 text-[12px] flex items-center gap-1',
                viewMode === 'list'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-faint)] hover:bg-[var(--bg-hover)]',
              )}
            >
              <List size={13} /> Lista
            </button>
          </div>

          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90"
          >
            <Plus size={14} /> Novo PA
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="input-base text-[12px] h-8 min-w-[140px]"
          value={prioridade ?? ''}
          onChange={(e) => setFilter('prioridade', e.target.value || undefined)}
        >
          <option value="">Todas prioridades</option>
          <option value="BAIXA">Baixa</option>
          <option value="MEDIA">Média</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>

        <select
          className="input-base text-[12px] h-8 min-w-[160px]"
          value={etapaId ?? ''}
          onChange={(e) => setFilter('etapaId', e.target.value || undefined)}
        >
          <option value="">Todas as etapas</option>
          {todasEtapas.map((e) => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {!data?.items.length ? (
        <div className="flex flex-col items-center justify-center h-48 text-[var(--text-faint)] gap-2">
          <p className="text-[14px]">Nenhum plano de ação encontrado.</p>
          <button
            onClick={() => setShowNovo(true)}
            className="text-[13px] text-[var(--accent)] underline"
          >
            Criar primeiro PA
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        <PaKanban
          pas={data.items}
          etapas={todasEtapas}
          obraId={numericObraId}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.items.map((pa) => (
            <PaCard key={pa.id} pa={pa} obraId={numericObraId} />
          ))}
        </div>
      )}

      {/* Pagination (list mode) */}
      {viewMode === 'list' && (data?.total ?? 0) > 30 && (
        <div className="flex justify-center gap-2 mt-2">
          <button
            disabled={page <= 1}
            onClick={() => setFilter('page', String(page - 1))}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border-dim)] disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-[12px] text-[var(--text-faint)]">
            Página {page}
          </span>
          <button
            disabled={(data?.items.length ?? 0) < 30}
            onClick={() => setFilter('page', String(page + 1))}
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border-dim)] disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {showNovo && (
        <NovoPaModal obraId={numericObraId} onClose={() => setShowNovo(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 10.2: Commit PlanosAcaoPage**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx
git commit -m "feat(planos-acao): add PlanosAcaoPage with list and kanban toggle"
```

---

## Task 11: Frontend — PlanoAcaoDetalhe

**Files:**
- Create: `frontend-web/src/modules/fvs/planos-acao/pages/PlanoAcaoDetalhe.tsx`

- [ ] **Step 11.1: Write PlanoAcaoDetalhe.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/pages/PlanoAcaoDetalhe.tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, ExternalLink, Calendar, User,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePlanoAcao } from '../hooks/usePlanosAcao';
import { PaStagePipeline } from '../components/PaStagePipeline';
import { PaHistoryTimeline } from '../components/PaHistoryTimeline';
import { PaDynamicFields } from '../components/PaDynamicFields';
import { TransicaoModal } from '../components/TransicaoModal';
import type { PaConfigEtapa } from '../../../../services/planos-acao.service';

const PRIORIDADE_STYLES: Record<string, string> = {
  BAIXA:   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIA:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  ALTA:    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICA: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function PlanoAcaoDetalhe() {
  const { obraId, paId } = useParams<{ obraId: string; paId: string }>();
  const numericPaId = Number(paId);
  const numericObraId = Number(obraId);

  const { data: pa, isLoading, isError } = usePlanoAcao(numericPaId);
  const [showTransicao, setShowTransicao] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm animate-pulse">
        Carregando PA…
      </div>
    );
  }

  if (isError || !pa) {
    return (
      <div className="flex items-center justify-center h-48 text-red-500 text-sm">
        PA não encontrado.
      </div>
    );
  }

  // Stages after the current one (excluding current) for transition options
  const etapasOrdenadas: PaConfigEtapa[] = [...(pa.etapas_ciclo ?? [])].sort((a, b) => a.ordem - b.ordem);
  const idxAtual = etapasOrdenadas.findIndex((e) => e.id === pa.etapa_atual_id);
  // Allow going to any stage that's not the current one (forward or backward)
  const etapasDisponiveis = etapasOrdenadas.filter((_, i) => i !== idxAtual);

  const origemLink =
    pa.origem_tipo === 'INSPECAO_FVS' && pa.origem_id
      ? `/fvs/fichas/${pa.origem_id}`
      : pa.origem_tipo === 'NC_FVS' && pa.origem_id
      ? `/obras/${numericObraId}/ncs/${pa.origem_id}`
      : null;

  const isFechado = !!pa.fechado_em;

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to={`/obras/${numericObraId}/fvs/planos-acao`}
        className="flex items-center gap-1.5 text-[13px] text-[var(--text-faint)] hover:text-[var(--text-high)] w-fit"
      >
        <ArrowLeft size={14} /> Planos de Ação
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[12px] font-mono text-[var(--text-faint)]">{pa.numero}</span>
            <span
              className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                PRIORIDADE_STYLES[pa.prioridade] ?? PRIORIDADE_STYLES.MEDIA,
              )}
            >
              {pa.prioridade}
            </span>
            {isFechado && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                Encerrado
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-bold text-[var(--text-high)]">{pa.titulo}</h1>

          {/* Origin link */}
          {origemLink && (
            <Link
              to={origemLink}
              className="flex items-center gap-1 text-[12px] text-[var(--accent)] mt-1 hover:underline"
            >
              <ExternalLink size={12} />
              {pa.origem_tipo === 'INSPECAO_FVS' ? `Inspeção #${pa.origem_id}` : `NC #${pa.origem_id}`}
            </Link>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2 text-[12px] text-[var(--text-faint)] flex-wrap">
            {pa.responsavel_id && (
              <span className="flex items-center gap-1"><User size={12} />Resp. #{pa.responsavel_id}</span>
            )}
            {pa.prazo && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                Prazo: {new Date(pa.prazo).toLocaleDateString('pt-BR')}
              </span>
            )}
            <span>Aberto em {new Date(pa.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Advance button */}
        {!isFechado && etapasDisponiveis.length > 0 && (
          <button
            onClick={() => setShowTransicao(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 flex-shrink-0"
          >
            {pa.etapa_is_final ? 'Encerrar PA' : 'Avançar'}
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* Stage pipeline */}
      {etapasOrdenadas.length > 0 && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">Etapas do Ciclo</h2>
          <PaStagePipeline etapas={etapasOrdenadas} etapaAtualId={pa.etapa_atual_id} />
        </div>
      )}

      {/* Description */}
      {pa.descricao && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-2">Descrição</h2>
          <p className="text-[13px] text-[var(--text-medium)] whitespace-pre-wrap">{pa.descricao}</p>
        </div>
      )}

      {/* Dynamic fields for current stage */}
      {(pa.campos_etapa_atual?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-3">
            Campos da Etapa Atual — {pa.etapa_nome}
          </h2>
          <PaDynamicFields
            campos={pa.campos_etapa_atual!}
            values={pa.campos_extras}
            onChange={() => {/* read-only view; edit via transição */ }}
            readOnly
          />
        </div>
      )}

      {/* History timeline */}
      <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">Histórico</h2>
        <PaHistoryTimeline historico={pa.historico ?? []} />
      </div>

      {/* Transition modal */}
      {showTransicao && (
        <TransicaoModal
          pa={pa}
          etapasProximas={etapasDisponiveis}
          onClose={() => setShowTransicao(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: Commit detail page**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/planos-acao/pages/PlanoAcaoDetalhe.tsx
git commit -m "feat(planos-acao): add PlanoAcaoDetalhe with pipeline, dynamic fields, and history"
```

---

## Task 12: Frontend — ConfigPlanosAcaoPage (Admin)

**Files:**
- Create: `frontend-web/src/modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx`

- [ ] **Step 12.1: Write ConfigPlanosAcaoPage.tsx**

```tsx
// frontend-web/src/modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx
import { useState } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  useCiclos, useCreateCiclo, useDeleteCiclo,
  useEtapas, useCreateEtapa, useDeleteEtapa,
  useCreateCampo, useDeleteCampo,
  useGatilhos, useCreateGatilho, useDeleteGatilho,
} from '../hooks/useConfigPlanosAcao';
import type {
  PaConfigCiclo, PaConfigEtapa,
  PaCampoTipo, PaCondicao,
} from '../../../../services/planos-acao.service';

// ── Ciclo Row ──────────────────────────────────────────────────────────────────

function CicloRow({ ciclo }: { ciclo: PaConfigCiclo }) {
  const [open, setOpen] = useState(false);
  const deleteCiclo = useDeleteCiclo();

  return (
    <div className="rounded-lg border border-[var(--border-dim)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="text-[14px] font-semibold text-[var(--text-high)]">{ciclo.nome}</span>
          <span className="text-[11px] text-[var(--text-faint)] ml-1">{ciclo.modulo}</span>
          {!ciclo.ativo && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
              Inativo
            </span>
          )}
        </button>
        <button
          onClick={() => {
            if (confirm(`Desativar ciclo "${ciclo.nome}"?`)) deleteCiclo.mutate(ciclo.id);
          }}
          className="text-[var(--text-faint)] hover:text-red-500 p-1"
          title="Desativar ciclo"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded: stages */}
      {open && <EtapasEditor cicloId={ciclo.id} />}
    </div>
  );
}

// ── Etapas Editor ──────────────────────────────────────────────────────────────

function EtapasEditor({ cicloId }: { cicloId: number }) {
  const { data: etapas } = useEtapas(cicloId);
  const createEtapa = useCreateEtapa(cicloId);
  const deleteEtapa = useDeleteEtapa(cicloId);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome]         = useState('');
  const [cor, setCor]           = useState('#6B7280');
  const [isInicial, setIsInicial] = useState(false);
  const [isFinal, setIsFinal]   = useState(false);
  const [prazoDias, setPrazoDias] = useState('');

  const handleAddEtapa = async () => {
    if (!nome.trim()) return;
    await createEtapa.mutateAsync({
      nome: nome.trim(),
      ordem: (etapas?.length ?? 0),
      cor,
      isInicial,
      isFinal,
      prazoDias: prazoDias ? Number(prazoDias) : undefined,
    });
    setNome(''); setCor('#6B7280'); setIsInicial(false); setIsFinal(false); setPrazoDias('');
    setShowForm(false);
  };

  return (
    <div className="px-4 pb-4 pt-2 border-t border-[var(--border-dim)] bg-[var(--bg-subtle)]">
      <div className="flex flex-col gap-2 mb-3">
        {(etapas ?? []).sort((a, b) => a.ordem - b.ordem).map((etapa) => (
          <EtapaRow key={etapa.id} etapa={etapa} cicloId={cicloId} onDelete={() => {
            if (confirm(`Remover etapa "${etapa.nome}"?`)) deleteEtapa.mutate(etapa.id);
          }} />
        ))}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              className="input-base text-[12px]"
              placeholder="Nome da etapa"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-[var(--text-faint)]">Cor</label>
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-7 w-14 cursor-pointer rounded border-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isInicial} onChange={(e) => setIsInicial(e.target.checked)} />
              Etapa inicial
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} />
              Etapa final
            </label>
            <div className="flex items-center gap-1 ml-auto">
              <label className="text-[var(--text-faint)]">Prazo (dias)</label>
              <input
                type="number"
                className="input-base text-[12px] w-16"
                value={prazoDias}
                onChange={(e) => setPrazoDias(e.target.value)}
                min="1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1 text-[12px] rounded border border-[var(--border-dim)] text-[var(--text-faint)]"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddEtapa}
              disabled={!nome.trim()}
              className="px-3 py-1 text-[12px] rounded bg-[var(--accent)] text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-[12px] text-[var(--accent)] hover:underline"
        >
          <Plus size={12} /> Adicionar etapa
        </button>
      )}
    </div>
  );
}

// ── Etapa Row ─────────────────────────────────────────────────────────────────

function EtapaRow({
  etapa, cicloId, onDelete,
}: { etapa: PaConfigEtapa; cicloId: number; onDelete: () => void }) {
  const [openCampos, setOpenCampos] = useState(false);

  return (
    <div className="rounded-md border border-[var(--border-dim)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: etapa.cor }} />
        <span className="text-[13px] text-[var(--text-high)] flex-1">{etapa.nome}</span>
        {etapa.is_inicial && <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">Inicial</span>}
        {etapa.is_final   && <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Final</span>}
        {etapa.prazo_dias && <span className="text-[10px] text-[var(--text-faint)]">{etapa.prazo_dias}d</span>}
        <button
          onClick={() => setOpenCampos((v) => !v)}
          className="text-[11px] text-[var(--accent)] hover:underline ml-auto"
        >
          Campos ({etapa.campos?.length ?? 0})
        </button>
        <button onClick={onDelete} className="text-[var(--text-faint)] hover:text-red-500 p-0.5">
          <Trash2 size={12} />
        </button>
      </div>
      {openCampos && <CamposEditor etapa={etapa} cicloId={cicloId} />}
    </div>
  );
}

// ── Campos Editor ─────────────────────────────────────────────────────────────

const TIPOS: PaCampoTipo[] = ['texto', 'numero', 'data', 'select', 'usuario', 'arquivo'];

function CamposEditor({ etapa, cicloId }: { etapa: PaConfigEtapa; cicloId: number }) {
  const createCampo = useCreateCampo(cicloId);
  const deleteCampo = useDeleteCampo(cicloId);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome]         = useState('');
  const [chave, setChave]       = useState('');
  const [tipo, setTipo]         = useState<PaCampoTipo>('texto');
  const [obrigatorio, setObrigatorio] = useState(false);
  const [opcoesStr, setOpcoesStr] = useState('');

  const handleAdd = async () => {
    if (!nome.trim() || !chave.trim()) return;
    const opcoes = tipo === 'select' && opcoesStr.trim()
      ? opcoesStr.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    await createCampo.mutateAsync({
      etapaId: etapa.id,
      data: { nome: nome.trim(), chave: chave.trim(), tipo, obrigatorio, opcoes },
    });
    setNome(''); setChave(''); setTipo('texto'); setObrigatorio(false); setOpcoesStr('');
    setShowForm(false);
  };

  return (
    <div className="px-3 pb-3 border-t border-[var(--border-dim)] bg-[var(--bg-subtle)]">
      <div className="flex flex-col gap-1 my-2">
        {(etapa.campos ?? []).map((campo) => (
          <div key={campo.id} className="flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
            <span className="font-mono">{campo.chave}</span>
            <span>{campo.nome}</span>
            <span className="px-1 py-0.5 rounded bg-[var(--bg-subtle)] capitalize">{campo.tipo}</span>
            {campo.obrigatorio && <span className="text-red-400 font-semibold">*</span>}
            <button
              onClick={() => { if (confirm(`Remover campo "${campo.nome}"?`)) deleteCampo.mutate(campo.id); }}
              className="ml-auto hover:text-red-500"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 rounded border border-[var(--border-dim)] bg-[var(--bg-surface)] p-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input-base text-[11px]"
              placeholder="Nome do campo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="input-base text-[11px] font-mono"
              placeholder="chave_snake_case"
              value={chave}
              onChange={(e) => setChave(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              className="input-base text-[11px] flex-1"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as PaCampoTipo)}
            >
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1 text-[11px]">
              <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} />
              Obrigatório
            </label>
          </div>
          {tipo === 'select' && (
            <input
              className="input-base text-[11px]"
              placeholder="Opções separadas por vírgula: Op1, Op2, Op3"
              value={opcoesStr}
              onChange={(e) => setOpcoesStr(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-2 py-1 text-[11px] rounded border border-[var(--border-dim)] text-[var(--text-faint)]">
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={!nome.trim() || !chave.trim()}
              className="px-2 py-1 text-[11px] rounded bg-[var(--accent)] text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
        >
          <Plus size={11} /> Campo
        </button>
      )}
    </div>
  );
}

// ── Gatilhos Tab ──────────────────────────────────────────────────────────────

function GatilhosTab({ ciclos }: { ciclos: PaConfigCiclo[] }) {
  const [selectedCiclo, setSelectedCiclo] = useState<number | null>(ciclos[0]?.id ?? null);
  const { data: gatilhos } = useGatilhos(selectedCiclo ?? 0);
  const createGatilho = useCreateGatilho(selectedCiclo ?? 0);
  const deleteGatilho = useDeleteGatilho(selectedCiclo ?? 0);

  const [condicao, setCondicao]     = useState<PaCondicao>('TAXA_CONFORMIDADE_ABAIXO');
  const [valorLimiar, setValorLimiar] = useState('');
  const [criticidadeMin, setCriticidadeMin] = useState('');
  const [formError, setFormError]   = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedCiclo) return;
    setFormError(null);
    try {
      await createGatilho.mutateAsync({
        condicao,
        valorLimiar: valorLimiar ? Number(valorLimiar) : undefined,
        criticidadeMin: criticidadeMin || undefined,
      });
      setValorLimiar(''); setCriticidadeMin('');
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Erro ao criar gatilho');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ciclo selector */}
      <div className="flex items-center gap-2">
        <label className="text-[12px] font-medium text-[var(--text-medium)]">Ciclo:</label>
        <select
          className="input-base text-[13px] min-w-[180px]"
          value={selectedCiclo ?? ''}
          onChange={(e) => setSelectedCiclo(Number(e.target.value))}
        >
          {ciclos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {/* Existing triggers */}
      {(gatilhos ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          {gatilhos!.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] px-3 py-2 text-[12px]">
              <span className="font-semibold text-[var(--text-high)]">{g.condicao}</span>
              {g.valor_limiar !== null && (
                <span className="text-[var(--text-faint)]">limiar: {g.valor_limiar}%</span>
              )}
              {g.criticidade_min && (
                <span className="text-[var(--text-faint)]">criticidade: {g.criticidade_min}</span>
              )}
              <span
                className={cn(
                  'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase',
                  g.ativo
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500',
                )}
              >
                {g.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <button
                onClick={() => { if (confirm('Remover gatilho?')) deleteGatilho.mutate(g.id); }}
                className="text-[var(--text-faint)] hover:text-red-500"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--text-faint)]">Nenhum gatilho configurado para este ciclo.</p>
      )}

      {/* New trigger form */}
      <div className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-4 flex flex-col gap-3">
        <h3 className="text-[13px] font-semibold text-[var(--text-high)]">Adicionar Gatilho</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            className="input-base text-[13px]"
            value={condicao}
            onChange={(e) => setCondicao(e.target.value as PaCondicao)}
          >
            <option value="TAXA_CONFORMIDADE_ABAIXO">Taxa Conformidade Abaixo</option>
            <option value="ITEM_CRITICO_NC">Item Crítico NC</option>
            <option value="NC_ABERTA">NC Aberta</option>
          </select>

          {condicao === 'TAXA_CONFORMIDADE_ABAIXO' && (
            <input
              type="number"
              className="input-base text-[13px]"
              placeholder="Limiar % (ex: 80)"
              min="0"
              max="100"
              value={valorLimiar}
              onChange={(e) => setValorLimiar(e.target.value)}
            />
          )}

          {condicao === 'ITEM_CRITICO_NC' && (
            <select
              className="input-base text-[13px]"
              value={criticidadeMin}
              onChange={(e) => setCriticidadeMin(e.target.value)}
            >
              <option value="">Criticidade mínima…</option>
              <option value="critico">Crítico</option>
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          )}
        </div>

        {formError && (
          <p className="text-[12px] text-red-500">{formError}</p>
        )}

        <button
          onClick={handleCreate}
          disabled={!selectedCiclo}
          className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg bg-[var(--accent)] text-white disabled:opacity-40 hover:opacity-90"
        >
          <Plus size={13} /> Criar Gatilho
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type TabKey = 'ciclos' | 'gatilhos';

export function ConfigPlanosAcaoPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('ciclos');
  const { data: ciclos } = useCiclos('FVS');
  const createCiclo = useCreateCiclo();
  const [showNovoCiclo, setShowNovoCiclo] = useState(false);
  const [novoCicloNome, setNovoCicloNome] = useState('');
  const [cicloError, setCicloError]       = useState<string | null>(null);

  const handleCreateCiclo = async () => {
    if (!novoCicloNome.trim()) return;
    setCicloError(null);
    try {
      await createCiclo.mutateAsync({ modulo: 'FVS', nome: novoCicloNome.trim() });
      setNovoCicloNome(''); setShowNovoCiclo(false);
    } catch (err: any) {
      setCicloError(err?.response?.data?.message ?? 'Erro ao criar ciclo');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text-high)]">Configuração — Planos de Ação</h1>
        <p className="text-[13px] text-[var(--text-faint)] mt-0.5">
          Gerencie ciclos de vida, etapas, campos e gatilhos de abertura automática.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-dim)]">
        {(['ciclos', 'gatilhos'] as TabKey[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors',
              activeTab === tab
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
            )}
          >
            {tab === 'ciclos' ? 'Ciclos' : 'Gatilhos'}
          </button>
        ))}
      </div>

      {/* Tab: Ciclos */}
      {activeTab === 'ciclos' && (
        <div className="flex flex-col gap-4">
          {/* Create ciclo */}
          {showNovoCiclo ? (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                className="input-base text-[13px] flex-1 min-w-[200px]"
                placeholder="Nome do ciclo (ex: Ciclo FVS Padrão)"
                value={novoCicloNome}
                onChange={(e) => setNovoCicloNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCiclo()}
                autoFocus
              />
              <button
                onClick={handleCreateCiclo}
                disabled={!novoCicloNome.trim()}
                className="px-3 py-1.5 text-[13px] rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
              >
                Criar
              </button>
              <button
                onClick={() => setShowNovoCiclo(false)}
                className="px-3 py-1.5 text-[13px] rounded-lg border border-[var(--border-dim)] text-[var(--text-faint)]"
              >
                Cancelar
              </button>
              {cicloError && <p className="w-full text-[12px] text-red-500">{cicloError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setShowNovoCiclo(true)}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-lg bg-[var(--accent)] text-white hover:opacity-90"
            >
              <Plus size={14} /> Novo Ciclo
            </button>
          )}

          {/* Ciclo list */}
          {(!ciclos || ciclos.length === 0) ? (
            <p className="text-[13px] text-[var(--text-faint)]">
              Nenhum ciclo FVS criado. Crie o primeiro ciclo acima.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {ciclos.map((ciclo) => <CicloRow key={ciclo.id} ciclo={ciclo} />)}
            </div>
          )}
        </div>
      )}

      {/* Tab: Gatilhos */}
      {activeTab === 'gatilhos' && (
        ciclos && ciclos.length > 0
          ? <GatilhosTab ciclos={ciclos} />
          : <p className="text-[13px] text-[var(--text-faint)]">Crie um ciclo primeiro para configurar gatilhos.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 12.2: Commit config page**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx
git commit -m "feat(planos-acao): add ConfigPlanosAcaoPage with ciclos, etapas, campos, and gatilhos management"
```

---

## Task 13: App.tsx Routes + Sidebar Nav

**Files:**
- Modify: `frontend-web/src/App.tsx`
- Modify: `frontend-web/src/components/layout/Sidebar.tsx`

- [ ] **Step 13.1: Add lazy imports in App.tsx**

In `frontend-web/src/App.tsx`, add these three lazy imports after the existing `FvsRelatorioClientePage` import (around line 74):

```typescript
const PlanosAcaoPage       = lazy(() => import('./modules/fvs/planos-acao/pages/PlanosAcaoPage').then(m => ({ default: m.PlanosAcaoPage })));
const PlanoAcaoDetalhe     = lazy(() => import('./modules/fvs/planos-acao/pages/PlanoAcaoDetalhe').then(m => ({ default: m.PlanoAcaoDetalhe })));
const ConfigPlanosAcaoPage = lazy(() => import('./modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage').then(m => ({ default: m.ConfigPlanosAcaoPage })));
```

- [ ] **Step 13.2: Add routes in App.tsx**

In `frontend-web/src/App.tsx`, locate the `{/* Efetivo */}` section (around line 199). Add the new routes immediately after the efetivo route block and before `</Route>` of the `AppLayout`:

```tsx
                {/* Planos de Ação — por obra */}
                <Route path="/obras/:obraId/fvs/planos-acao" element={<PlanosAcaoPage />} />
                <Route path="/obras/:obraId/fvs/planos-acao/:paId" element={<PlanoAcaoDetalhe />} />

                {/* Planos de Ação — configuração */}
                <Route path="/configuracoes/planos-acao" element={<ConfigPlanosAcaoPage />} />
```

- [ ] **Step 13.3: Add sidebar nav item**

In `frontend-web/src/components/layout/Sidebar.tsx`, locate the `<NavSection label="Qualidade">` block (around line 317). Add a `PlanosAcaoLink` helper component before the `Sidebar` component definition:

```tsx
/* ── Planos de Ação Nav helper ───────────────────────────── */
function PlanosAcaoLink({ onClick }: { onClick?: () => void }) {
  const obraAtivaId = useResolvedObraId()
  const to = obraAtivaId ? `/obras/${obraAtivaId}/fvs/planos-acao` : '/obras'

  return (
    <NavItem
      to={to}
      icon={<ListChecks size={18} />}
      label="Planos de Ação"
      onClick={onClick}
    />
  )
}
```

Then, inside the `<NavSection label="Qualidade">` block, add the nav item after the `<NavItem to="/ncs" .../>` item:

```tsx
          <PlanosAcaoLink onClick={onNavClick} />
```

Also add the config link to the Cadastros `NavItemGroup` items array (after `'Serviços FVS'`):

```tsx
              { to: '/configuracoes/planos-acao',      label: 'Planos de Ação' },
```

- [ ] **Step 13.4: Verify TypeScript**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 13.5: Commit routes and sidebar**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/App.tsx frontend-web/src/components/layout/Sidebar.tsx
git commit -m "feat(planos-acao): add routes to App.tsx and nav items to Sidebar"
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 14.1: Start backend**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npm run start:dev
```

Expected: NestJS starts on port 3000 with no module injection errors.

- [ ] **Step 14.2: Test config endpoints with curl**

```bash
# Create ciclo
curl -s -X POST http://localhost:3000/api/v1/planos-acao/config/ciclos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"modulo":"FVS","nome":"Ciclo Padrão FVS","descricao":"Ciclo principal"}' | jq .

# Expected: { id: 1, modulo: "FVS", nome: "Ciclo Padrão FVS", ativo: true, ... }

# Add initial stage
curl -s -X POST http://localhost:3000/api/v1/planos-acao/config/ciclos/1/etapas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Aberto","ordem":0,"cor":"#EF4444","isInicial":true,"isFinal":false}' | jq .

# Add final stage
curl -s -X POST http://localhost:3000/api/v1/planos-acao/config/ciclos/1/etapas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nome":"Fechado","ordem":2,"cor":"#10B981","isInicial":false,"isFinal":true}' | jq .

# Create trigger
curl -s -X POST http://localhost:3000/api/v1/planos-acao/config/ciclos/1/gatilhos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"condicao":"TAXA_CONFORMIDADE_ABAIXO","valorLimiar":80}' | jq .
```

- [ ] **Step 14.3: Test PA CRUD**

```bash
# Create manual PA
curl -s -X POST http://localhost:3000/api/v1/planos-acao \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cicloId":1,"obraId":1,"titulo":"Desvio no reboco","prioridade":"ALTA"}' | jq .

# Expected: { id: 1, numero: "PA-2026-0001", etapa_atual_id: <id_etapa_inicial>, ... }

# List PAs
curl -s "http://localhost:3000/api/v1/planos-acao?obraId=1" \
  -H "Authorization: Bearer $TOKEN" | jq .total

# Get PA detail
curl -s http://localhost:3000/api/v1/planos-acao/1 \
  -H "Authorization: Bearer $TOKEN" | jq '{numero: .numero, etapa: .etapa_nome, historico_count: (.historico | length)}'
```

- [ ] **Step 14.4: Test stage transition**

```bash
# Advance to next stage (replace ETAPA_FINAL_ID with actual id from step 14.2)
curl -s -X POST http://localhost:3000/api/v1/planos-acao/1/transicao \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"etapaParaId\": ETAPA_FINAL_ID, \"comentario\": \"Problema resolvido\"}" | jq '{etapa: .etapa_atual_id, fechado_em: .fechado_em}'

# Expected: fechado_em is set (not null) since the stage is_final=true
```

- [ ] **Step 14.5: Test 403 for unauthorized role**

```bash
# Using a token with TECNICO role, attempt transition on stage with roles_transicao=['ENGENHEIRO']
# Expected: HTTP 403 with message "Sem permissão para transicionar nesta etapa"
curl -s -X POST http://localhost:3000/api/v1/planos-acao/1/transicao \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TECNICO_TOKEN" \
  -d '{"etapaParaId": 1}' | jq .statusCode
# Expected: 403
```

- [ ] **Step 14.6: Start frontend and verify pages load**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npm run dev
```

Navigate to:
1. `/obras/1/fvs/planos-acao` — list page loads, kanban columns visible
2. `/obras/1/fvs/planos-acao/1` — detail page loads with pipeline and history
3. `/configuracoes/planos-acao` — config page loads with Ciclos tab
4. Sidebar shows "Planos de Ação" in Qualidade section

- [ ] **Step 14.7: Final commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add -A
git commit -m "feat(planos-acao): complete FVS Plano de Ação feature — smoke tests passed"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| `pa_config_ciclo` table | Task 1 |
| `pa_config_etapa` table | Task 1 |
| `pa_config_campo` table | Task 1 |
| `pa_config_gatilho` table | Task 1 |
| `pa_plano_acao` table | Task 1 |
| `pa_historico` table | Task 1 |
| CRUD ciclos/etapas/campos/gatilhos | Tasks 2, 3 |
| CRUD PAs + transição de etapa | Tasks 2, 4 |
| Número sequencial PA-{ANO}-{SEQ:0000} | Task 4 (PaService.gerarNumero) |
| Regra de abertura automática avaliarGatilhos | Task 4 (PaService.avaliarGatilhos) |
| Hook avaliarGatilhos após conclusão de inspeção | Task 7 |
| Role guard na transição (403 when not in roles_transicao) | Task 4 (transicionarEtapa) |
| Etapa is_final seta fechado_em | Task 4 (transicionarEtapa) |
| Ciclo sem etapa inicial: 422 ao criar PA | Task 4 (getEtapaInicialDoCiclo) |
| Snapshot campos_extras no histórico | Task 4 (transicionarEtapa → INSERT pa_historico) |
| Não abre PA duplicado para mesma origem | Task 4 (avaliarGatilhos existing check) |
| Route /obras/:obraId/fvs/planos-acao | Task 13 |
| Route /obras/:obraId/fvs/planos-acao/:paId | Task 13 |
| Route /configuracoes/planos-acao | Task 13 |
| PlanosAcaoPage list + kanban toggle | Task 10 |
| PlanoAcaoDetalhe: pipeline + dynamic fields + history | Task 11 |
| ConfigPlanosAcaoPage: ciclos + etapas + campos + gatilhos | Task 12 |
| Sidebar nav item Planos de Ação in Qualidade | Task 13 |
| URL-synced filters (etapa, prioridade) | Task 10 (useSearchParams) |
| NovoPaModal with ciclo selection | Task 9 |
| TransicaoModal with required fields + role check | Task 9 |
| PaStagePipeline horizontal component | Task 9 |
| PaHistoryTimeline | Task 9 |
| PaDynamicFields per etapa | Task 9 |
| Unit tests for PaService | Task 5 |

All 30 spec requirements are covered.

### Placeholder Scan

No placeholders found. All steps contain complete code, exact commands with expected output, and concrete type names.

### Type Consistency

Types used consistently across all tasks:
- `PaConfigCiclo`, `PaConfigEtapa`, `PaConfigCampo`, `PaConfigGatilho` — defined in `planos-acao.service.ts` (Task 8), used in hooks (Task 8) and pages (Tasks 10–12)
- `PlanoAcao`, `PaHistoricoEntry` — defined in service, used in all PA components
- `CreateCicloDto`, `UpdateCicloDto`, etc. — defined in Task 2, consumed in Task 3 service and controller
- `CreatePaDto`, `UpdatePaDto`, `TransicaoDto` — defined in Task 2, consumed in Task 4
- `AvaliarGatilhosContexto` — exported interface in `pa.service.ts` (Task 4), consumed in `inspecao.service.ts` (Task 7)
- `PaService.avaliarGatilhos` signature: `(tenantId, origemTipo, origemId, contexto: AvaliarGatilhosContexto)` — consistent in Task 4 definition and Task 7 call site
- `PaService` exported from `PlanosAcaoModule` (Task 6), injected into `InspecaoService` (Task 7)
