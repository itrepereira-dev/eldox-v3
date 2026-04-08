# FVS Sprint 1 — Catálogo de Serviços — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o catálogo de serviços FVS (categorias + serviços + itens de verificação), com seed automático dos 8 serviços PBQP-H, API REST completa e UI web em split layout para administração do catálogo.

**Architecture:** Módulo NestJS `FvsModule` com sub-módulo `CatalogoModule`. Backend usa `prisma.$queryRawUnsafe` (padrão do projeto). Frontend usa React Query + Axios service. Isolamento multi-tenant via `WHERE tenant_id IN (0, :tenantId)` — `tenant_id=0` é o catálogo PBQP-H do sistema (somente leitura).

**Tech Stack:** NestJS 11 + PostgreSQL + Prisma (raw SQL) · React 19 + Vite + TanStack Query 5 + Axios + Tailwind · Jest (backend) · class-validator + class-transformer

---

## Mapa de Arquivos

### Criar (backend)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `backend/prisma/migrations/20260408000000_fvs_catalogo/migration.sql` | CREATE TABLEs + seed completo PBQP-H |
| `backend/src/fvs/types/fvs.types.ts` | Tipos e enums compartilhados do módulo FVS |
| `backend/src/fvs/catalogo/dto/create-categoria.dto.ts` | Payload criação de categoria |
| `backend/src/fvs/catalogo/dto/create-servico.dto.ts` | Payload criação de serviço (inclui itens inline) |
| `backend/src/fvs/catalogo/dto/create-item.dto.ts` | Payload criação de item avulso |
| `backend/src/fvs/catalogo/dto/update-categoria.dto.ts` | Payload edição de categoria |
| `backend/src/fvs/catalogo/dto/update-servico.dto.ts` | Payload edição de serviço |
| `backend/src/fvs/catalogo/dto/update-item.dto.ts` | Payload edição de item |
| `backend/src/fvs/catalogo/dto/reorder.dto.ts` | Payload reordenação de itens ou categorias |
| `backend/src/fvs/catalogo/dto/import-query.dto.ts` | Query param `dry_run` do endpoint de importação |
| `backend/src/fvs/catalogo/catalogo.service.ts` | Toda a lógica de negócio do catálogo |
| `backend/src/fvs/catalogo/catalogo.service.spec.ts` | Testes unitários do service |
| `backend/src/fvs/catalogo/catalogo.controller.ts` | 15 endpoints REST |
| `backend/src/fvs/fvs.module.ts` | Módulo NestJS raiz do FVS |

### Modificar (backend)
| Arquivo | O que muda |
|---------|-----------|
| `backend/src/app.module.ts` | Adicionar `FvsModule` nos imports |

### Criar (frontend)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `frontend-web/src/services/fvs.service.ts` | Todas as chamadas Axios para `/api/v1/fvs/*` |
| `frontend-web/src/modules/fvs/catalogo/hooks/useCatalogo.ts` | React Query hooks (categorias + serviços) |
| `frontend-web/src/modules/fvs/catalogo/components/CategoriasList.tsx` | Coluna esquerda do split layout |
| `frontend-web/src/modules/fvs/catalogo/components/ServicosPanel.tsx` | Coluna direita — lista serviços da categoria |
| `frontend-web/src/modules/fvs/catalogo/components/ServicoCard.tsx` | Card de serviço com itens inline |
| `frontend-web/src/modules/fvs/catalogo/components/ServicoModal.tsx` | Modal criar/editar serviço + itens |
| `frontend-web/src/modules/fvs/catalogo/components/ImportarCsvModal.tsx` | Modal import CSV com dry-run preview |
| `frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx` | Página principal (split layout, orquestra os componentes) |

### Modificar (frontend)
| Arquivo | O que muda |
|---------|-----------|
| `frontend-web/src/App.tsx` | Adicionar rota `/configuracoes/fvs/catalogo` |

---

## Task 1: Migration e Seed PBQP-H

**Files:**
- Create: `backend/prisma/migrations/20260408000000_fvs_catalogo/migration.sql`

- [ ] **Criar o arquivo de migration com as 3 tabelas e o seed completo**

```sql
-- =============================================================================
-- Eldox v3 — Migration: FVS Catálogo de Serviços
-- Sprint: FVS-1 | Data: 2026-04-08
-- Spec: docs/superpowers/specs/2026-04-08-fvs-sprint1-catalogo-servicos-design.md
-- Aplicar com: psql $DATABASE_URL -f migration.sql
-- =============================================================================

-- ── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvs_categorias_servico (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ordem      SMALLINT DEFAULT 0,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvs_cat_tenant_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_fvs_cat_tenant ON fvs_categorias_servico(tenant_id);

CREATE TABLE IF NOT EXISTS fvs_catalogo_servicos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  categoria_id     INT REFERENCES fvs_categorias_servico(id) ON DELETE RESTRICT,
  codigo           VARCHAR(30),
  nome             VARCHAR(200) NOT NULL,
  norma_referencia VARCHAR(200),
  ordem            SMALLINT DEFAULT 0,
  ativo            BOOLEAN DEFAULT true,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_fvs_srv_tenant ON fvs_catalogo_servicos(tenant_id, ativo);

CREATE TABLE IF NOT EXISTS fvs_catalogo_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  servico_id      INT NOT NULL REFERENCES fvs_catalogo_servicos(id) ON DELETE CASCADE,
  descricao       VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade     VARCHAR(10) NOT NULL DEFAULT 'menor',
  foto_modo       VARCHAR(15) NOT NULL DEFAULT 'opcional',
  foto_minimo     SMALLINT DEFAULT 0,
  foto_maximo     SMALLINT DEFAULT 2,
  ordem           SMALLINT DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fvs_item_criticidade CHECK (criticidade IN ('critico','maior','menor')),
  CONSTRAINT chk_fvs_item_foto_modo   CHECK (foto_modo IN ('nenhuma','opcional','obrigatoria'))
);
CREATE INDEX IF NOT EXISTS idx_fvs_item_servico ON fvs_catalogo_itens(servico_id, ativo);

-- ── Seed: 12 categorias PBQP-H (tenant_id = 0 = sistema) ─────────────────────

INSERT INTO fvs_categorias_servico (tenant_id, nome, ordem) VALUES
(0, 'Estrutura', 1),
(0, 'Alvenaria', 2),
(0, 'Revestimento', 3),
(0, 'Acabamento', 4),
(0, 'Instalações Elétricas', 5),
(0, 'Instalações Hidráulicas', 6),
(0, 'Impermeabilização', 7),
(0, 'Cobertura', 8),
(0, 'Esquadrias', 9),
(0, 'Pintura', 10),
(0, 'Combate a Incêndio', 11),
(0, 'Infraestrutura', 12)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- ── Seed: 8 serviços PO com itens ────────────────────────────────────────────

DO $$
DECLARE
  cat_acabamento   INT;
  cat_instalacoes_ele INT;
  cat_instalacoes_hid INT;
  cat_incendio     INT;
  cat_pintura      INT;
  s_portas         INT;
  s_pintura_int    INT;
  s_pintura_ext    INT;
  s_eletrica       INT;
  s_hidro          INT;
  s_bancadas       INT;
  s_incendio       INT;
  s_spda           INT;
BEGIN
  SELECT id INTO cat_acabamento   FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Acabamento';
  SELECT id INTO cat_instalacoes_ele FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Elétricas';
  SELECT id INTO cat_instalacoes_hid FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Hidráulicas';
  SELECT id INTO cat_incendio     FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Combate a Incêndio';
  SELECT id INTO cat_pintura      FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Pintura';

  -- PO 19.20 — Portas
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_acabamento, 'PO 19.20', 'EXECUÇÃO DE INSTALAÇÃO DE PORTAS', 1)
  RETURNING id INTO s_portas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_portas, 'ABERTURA E FECHAMENTO REGULAR?', 'maior', 1),
  (0, s_portas, 'ALISAR INSTALADO E BEM FIXADO?', 'menor', 2),
  (0, s_portas, 'ALISAR INSTALADO FACIANDO A PAREDE?', 'menor', 3),
  (0, s_portas, 'GUARNIÇÕES INSTALADAS?', 'menor', 4);

  -- PO 21.22 — Pintura Interna
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_pintura, 'PO 21.22', 'EXECUÇÃO DE PINTURA INTERNA', 2)
  RETURNING id INTO s_pintura_int;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_pintura_int, 'PINTURA UNIFORME (COR / TEXTURA)?', 'maior', 1),
  (0, s_pintura_int, 'CANTOS E ARESTAS BEM PINTADAS?', 'menor', 2),
  (0, s_pintura_int, 'PRESENÇA DE ALGUM ELEMENTO QUE NÃO SEJA DA PAREDE?', 'menor', 3);

  -- PO 21.22 — Pintura Externa
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_pintura, 'PO 21.22', 'EXECUÇÃO DE PINTURA EXTERNA', 3)
  RETURNING id INTO s_pintura_ext;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_pintura_ext, 'PINTURA UNIFORME, SEM NENHUM TIPO DE MANCHAS?', 'maior', 1),
  (0, s_pintura_ext, 'PRESENÇA DE ALGUM ELEMENTO QUE NÃO SEJA DA PAREDE?', 'menor', 2);

  -- PO 23 — Elétrica
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_instalacoes_ele, 'PO 23', 'EXECUÇÃO DE INSTALAÇÕES ELÉTRICAS E TELEFÔNICAS', 4)
  RETURNING id INTO s_eletrica;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, foto_modo, ordem) VALUES
  (0, s_eletrica, 'PRESENÇA DE ENFIAÇÃO EM TODOS OS PONTOS ELÉTRICOS?', 'critico', 'obrigatoria', 1),
  (0, s_eletrica, 'PRESENÇA DE TOMADAS / INTERRUPTORES EM TODOS AS CAIXAS ELÉTRICAS?', 'maior', 'opcional', 2),
  (0, s_eletrica, 'QUADRO DE DISTRIBUIÇÃO COMPLETO COM DISJUNTORES?', 'critico', 'obrigatoria', 3),
  (0, s_eletrica, 'PONTOS ELÉTRICOS NIVELADOS E LIVRE DE RESÍDUOS?', 'menor', 'opcional', 4);

  -- PO 24 — Hidro
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_instalacoes_hid, 'PO 24', 'EXECUÇÃO DE INSTALAÇÕES HIDRO SANITÁRIAS', 5)
  RETURNING id INTO s_hidro;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_hidro, 'TUBULAÇÕES FIXADAS E CHUMBADAS?', 'maior', 1),
  (0, s_hidro, 'REGISTROS INSTALADOS?', 'maior', 2),
  (0, s_hidro, 'HIDRÔMETROS INSTALADOS?', 'critico', 3);

  -- PO 25 — Bancadas e Louças
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_acabamento, 'PO 25', 'COLOCAÇÃO DE BANCADAS, LOUÇAS E METAIS SANITÁRIOS', 6)
  RETURNING id INTO s_bancadas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS EM NÍVEL?', 'maior', 1),
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS ENTRE 85 A 95CM DE ALTURA?', 'menor', 2),
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS COM SELANTE PRÓXIMO À PAREDE?', 'menor', 3),
  (0, s_bancadas, 'VASO SANITÁRIO INSTALADO COM TODOS OS ACESSÓRIOS?', 'maior', 4),
  (0, s_bancadas, 'TORNEIRAS, ENGATE E SIFÃO INSTALADOS?', 'maior', 5);

  -- PO 43 — Incêndio
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_incendio, 'PO 43', 'EXECUÇÃO DE SISTEMA DE COMBATE A INCÊNDIO', 7)
  RETURNING id INTO s_incendio;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, foto_modo, ordem) VALUES
  (0, s_incendio, 'EXTINTORES INSTALADOS E FIXADOS EM TODOS OS PAVIMENTOS COM PLACA DE IDENTIFICAÇÃO?', 'critico', 'obrigatoria', 1),
  (0, s_incendio, 'CENTRAL DE ALARME DE INCÊNDIO INSTALADO COM PLACA DE IDENTIFICAÇÃO?', 'critico', 'obrigatoria', 2),
  (0, s_incendio, 'QUEBRA-VIDRO E SIRENE INSTALADOS EM TODOS OS PAVIMENTOS COM PLACA DE IDENTIFICAÇÃO?', 'maior', 'opcional', 3),
  (0, s_incendio, 'PLACA DE SAÍDA DE EMERGÊNCIA INSTALADA?', 'maior', 'opcional', 4);

  -- PO 44 — SPDA
  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_incendio, 'PO 44', 'EXECUÇÃO DE SPDA', 8)
  RETURNING id INTO s_spda;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_spda, 'TORRE COM ANTENA FRANKLIN INSTALADA?', 'critico', 1),
  (0, s_spda, 'FIOS DE COBRE FIXADOS?', 'maior', 2);

END $$;
```

- [ ] **Aplicar a migration no banco**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
psql $DATABASE_URL -f prisma/migrations/20260408000000_fvs_catalogo/migration.sql
```

Saída esperada: `CREATE TABLE`, `CREATE INDEX`, `INSERT 12`, `DO` (sem erros).

- [ ] **Verificar seed no banco**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM fvs_categorias_servico WHERE tenant_id=0;"
# Esperado: 12

psql $DATABASE_URL -c "SELECT COUNT(*) FROM fvs_catalogo_servicos WHERE tenant_id=0;"
# Esperado: 8

psql $DATABASE_URL -c "SELECT COUNT(*) FROM fvs_catalogo_itens WHERE tenant_id=0;"
# Esperado: 27
```

- [ ] **Commit**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add backend/prisma/migrations/20260408000000_fvs_catalogo/
git commit -m "feat(fvs): migration fvs_catalogo com seed PBQP-H (8 serviços, 27 itens)"
```

---

## Task 2: Tipos e DTOs (Backend)

**Files:**
- Create: `backend/src/fvs/types/fvs.types.ts`
- Create: `backend/src/fvs/catalogo/dto/create-categoria.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/update-categoria.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/create-item.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/create-servico.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/update-servico.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/update-item.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/reorder.dto.ts`
- Create: `backend/src/fvs/catalogo/dto/import-query.dto.ts`

- [ ] **Criar `fvs.types.ts`**

```typescript
// backend/src/fvs/types/fvs.types.ts

export type Criticidade = 'critico' | 'maior' | 'menor';
export type FotoModo = 'nenhuma' | 'opcional' | 'obrigatoria';

export interface FvsCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  is_sistema: boolean; // computed: tenant_id === 0
}

export interface FvsServico {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  codigo: string | null;
  nome: string;
  norma_referencia: string | null;
  ordem: number;
  ativo: boolean;
  created_at: Date;
  deleted_at: Date | null;
  is_sistema: boolean; // computed: tenant_id === 0
  itens?: FvsItem[];
}

export interface FvsItem {
  id: number;
  tenant_id: number;
  servico_id: number;
  descricao: string;
  criterio_aceite: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  foto_minimo: number;
  foto_maximo: number;
  ordem: number;
  ativo: boolean;
  created_at: Date;
}
```

- [ ] **Criar DTOs de categoria**

```typescript
// backend/src/fvs/catalogo/dto/create-categoria.dto.ts
import { IsString, IsOptional, IsInt, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoriaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number = 0;
}
```

```typescript
// backend/src/fvs/catalogo/dto/update-categoria.dto.ts
import { IsString, IsOptional, IsInt, IsBoolean, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
```

- [ ] **Criar DTOs de item**

```typescript
// backend/src/fvs/catalogo/dto/create-item.dto.ts
import { IsString, IsOptional, IsInt, IsEnum, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Criticidade, FotoModo } from '../../types/fvs.types';

export class CreateItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  descricao: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  criterioAceite?: string;

  @IsOptional()
  @IsEnum(['critico', 'maior', 'menor'])
  criticidade?: Criticidade = 'menor';

  @IsOptional()
  @IsEnum(['nenhuma', 'opcional', 'obrigatoria'])
  fotoModo?: FotoModo = 'opcional';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMinimo?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMaximo?: number = 2;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number = 0;
}
```

```typescript
// backend/src/fvs/catalogo/dto/update-item.dto.ts
import { IsString, IsOptional, IsInt, IsEnum, IsBoolean, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { Criticidade, FotoModo } from '../../types/fvs.types';

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  criterioAceite?: string;

  @IsOptional()
  @IsEnum(['critico', 'maior', 'menor'])
  criticidade?: Criticidade;

  @IsOptional()
  @IsEnum(['nenhuma', 'opcional', 'obrigatoria'])
  fotoModo?: FotoModo;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fotoMaximo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
```

- [ ] **Criar DTOs de serviço**

```typescript
// backend/src/fvs/catalogo/dto/create-servico.dto.ts
import { IsString, IsOptional, IsInt, IsArray, ValidateNested, MinLength, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateItemDto } from './create-item.dto';

export class CreateServicoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  codigo?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  normaReferencia?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number = 0;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItemDto)
  itens?: CreateItemDto[];
}
```

```typescript
// backend/src/fvs/catalogo/dto/update-servico.dto.ts
import { IsString, IsOptional, IsInt, IsBoolean, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateServicoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  categoriaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  normaReferencia?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
```

- [ ] **Criar DTOs de reordenação e importação**

```typescript
// backend/src/fvs/catalogo/dto/reorder.dto.ts
import { IsArray, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  id: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  ordem: number;
}

export class ReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  itens: ReorderItemDto[];
}
```

```typescript
// backend/src/fvs/catalogo/dto/import-query.dto.ts
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  dry_run?: boolean = false;
}
```

- [ ] **Commit**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add backend/src/fvs/
git commit -m "feat(fvs): tipos e DTOs do catálogo de serviços"
```

---

## Task 3: CatalogoService — Testes + Implementação

**Files:**
- Create: `backend/src/fvs/catalogo/catalogo.service.spec.ts`
- Create: `backend/src/fvs/catalogo/catalogo.service.ts`

- [ ] **Escrever o arquivo de testes (falharão — TDD)**

```typescript
// backend/src/fvs/catalogo/catalogo.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const TENANT_ID = 5;

const CAT_SISTEMA = { id: 1, tenant_id: 0, nome: 'Acabamento', ordem: 4, ativo: true, created_at: new Date() };
const CAT_TENANT  = { id: 99, tenant_id: TENANT_ID, nome: 'Minha Categoria', ordem: 0, ativo: true, created_at: new Date() };

const SRV_SISTEMA = { id: 10, tenant_id: 0, categoria_id: 1, codigo: 'PO 19.20', nome: 'EXECUÇÃO DE INSTALAÇÃO DE PORTAS', norma_referencia: null, ordem: 1, ativo: true, created_at: new Date(), deleted_at: null };
const SRV_TENANT  = { id: 200, tenant_id: TENANT_ID, categoria_id: 99, codigo: null, nome: 'Serviço Custom', norma_referencia: null, ordem: 0, ativo: true, created_at: new Date(), deleted_at: null };

const ITEM_SISTEMA = { id: 50, tenant_id: 0, servico_id: 10, descricao: 'ABERTURA E FECHAMENTO REGULAR?', criterio_aceite: null, criticidade: 'maior', foto_modo: 'opcional', foto_minimo: 0, foto_maximo: 2, ordem: 1, ativo: true, created_at: new Date() };

// ── Mock PrismaService ────────────────────────────────────────────────────────
const mockPrisma = {
  $queryRawUnsafe: jest.fn(),
  $executeRawUnsafe: jest.fn(),
  $transaction: jest.fn(),
};

function makeService(): CatalogoService {
  return new (CatalogoService as any)(mockPrisma);
}

describe('CatalogoService', () => {
  let svc: CatalogoService;

  beforeEach(() => {
    jest.resetAllMocks();
    svc = makeService();
  });

  // ── getCategorias ───────────────────────────────────────────────────────────
  describe('getCategorias()', () => {
    it('retorna categorias do sistema e do tenant com is_sistema calculado', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { ...CAT_SISTEMA },
        { ...CAT_TENANT },
      ]);
      const result = await svc.getCategorias(TENANT_ID);
      expect(result).toHaveLength(2);
      expect(result[0].is_sistema).toBe(true);
      expect(result[1].is_sistema).toBe(false);
    });
  });

  // ── createCategoria ─────────────────────────────────────────────────────────
  describe('createCategoria()', () => {
    it('insere com tenant_id correto e retorna a categoria criada', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ ...CAT_TENANT }]);
      const dto = { nome: 'Minha Categoria', ordem: 0 };
      const result = await svc.createCategoria(TENANT_ID, dto as any);
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fvs_categorias_servico'),
        TENANT_ID,
        'Minha Categoria',
        0,
      );
      expect(result.nome).toBe('Minha Categoria');
    });
  });

  // ── assertNotSistema guard ──────────────────────────────────────────────────
  describe('updateCategoria() — guard sistema', () => {
    it('lança ForbiddenException ao tentar editar categoria do sistema', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([{ tenant_id: 0 }]);
      await expect(
        svc.updateCategoria(TENANT_ID, CAT_SISTEMA.id, { nome: 'hack' } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lança NotFoundException se categoria não existe', async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      await expect(
        svc.updateCategoria(TENANT_ID, 999, { nome: 'x' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── clonarServico ───────────────────────────────────────────────────────────
  describe('clonarServico()', () => {
    it('cria cópia do serviço com tenant_id do usuário, não do sistema', async () => {
      // 1ª chamada: busca o original com itens
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ ...SRV_SISTEMA }])          // getServico
        .mockResolvedValueOnce([{ ...ITEM_SISTEMA }])         // getItens do original
        .mockResolvedValueOnce([{ ...SRV_TENANT, id: 300 }]) // insert serviço clone
        .mockResolvedValue([]);                               // insert itens

      const clone = await svc.clonarServico(TENANT_ID, SRV_SISTEMA.id);
      expect(clone.tenant_id).toBe(TENANT_ID);
      expect(clone.is_sistema).toBe(false);
    });
  });

  // ── reordenarItens ──────────────────────────────────────────────────────────
  describe('reordenarItens()', () => {
    it('executa UPDATE para cada item com a nova ordem', async () => {
      mockPrisma.$transaction.mockResolvedValue(undefined);
      await svc.reordenarItens(TENANT_ID, SRV_TENANT.id, [
        { id: 50, ordem: 2 },
        { id: 51, ordem: 1 },
      ]);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Rodar testes para confirmar que falham**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx jest catalogo.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: `FAIL` — `Cannot find module './catalogo.service'`

- [ ] **Implementar `catalogo.service.ts`**

```typescript
// backend/src/fvs/catalogo/catalogo.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FvsCategoria, FvsServico, FvsItem } from '../types/fvs.types';
import type { CreateCategoriaDto } from './dto/create-categoria.dto';
import type { UpdateCategoriaDto } from './dto/update-categoria.dto';
import type { CreateServicoDto } from './dto/create-servico.dto';
import type { UpdateServicoDto } from './dto/update-servico.dto';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { ReorderItemDto } from './dto/reorder.dto';

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Guard helper ────────────────────────────────────────────────────────────

  private async assertNotSistema(tabela: string, id: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ tenant_id: number }[]>(
      `SELECT tenant_id FROM ${tabela} WHERE id = $1`,
      id,
    );
    if (!rows.length) throw new NotFoundException(`Registro ${id} não encontrado`);
    if (rows[0].tenant_id === 0) {
      throw new ForbiddenException(
        'Registros do sistema (PBQP-H) não podem ser modificados. Use "Clonar" para criar uma cópia editável.',
      );
    }
  }

  // ── Categorias ──────────────────────────────────────────────────────────────

  async getCategorias(tenantId: number): Promise<FvsCategoria[]> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema
       FROM fvs_categorias_servico
       WHERE tenant_id IN (0, $1) AND ativo = true
       ORDER BY ordem ASC, nome ASC`,
      tenantId,
    );
    return rows;
  }

  async createCategoria(tenantId: number, dto: CreateCategoriaDto): Promise<FvsCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `INSERT INTO fvs_categorias_servico (tenant_id, nome, ordem)
       VALUES ($1, $2, $3)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      dto.nome,
      dto.ordem ?? 0,
    );
    return rows[0];
  }

  async updateCategoria(tenantId: number, id: number, dto: UpdateCategoriaDto): Promise<FvsCategoria> {
    await this.assertNotSistema('fvs_categorias_servico', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.nome    !== undefined) { sets.push(`nome = $${i++}`);   vals.push(dto.nome); }
    if (dto.ordem   !== undefined) { sets.push(`ordem = $${i++}`);  vals.push(dto.ordem); }
    if (dto.ativo   !== undefined) { sets.push(`ativo = $${i++}`);  vals.push(dto.ativo); }
    if (!sets.length) return this.getCategoriaById(tenantId, id);
    vals.push(id);
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `UPDATE fvs_categorias_servico SET ${sets.join(', ')} WHERE id = $${i} RETURNING *, (tenant_id = 0) AS is_sistema`,
      ...vals,
    );
    return rows[0];
  }

  async deleteCategoria(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_categorias_servico', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_categorias_servico SET ativo = false WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async reordenarCategorias(tenantId: number, itens: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      itens.map((item) =>
        this.prisma.$executeRawUnsafe(
          `UPDATE fvs_categorias_servico SET ordem = $1 WHERE id = $2 AND tenant_id = $3`,
          item.ordem,
          item.id,
          tenantId,
        ),
      ),
    );
  }

  private async getCategoriaById(tenantId: number, id: number): Promise<FvsCategoria> {
    const rows = await this.prisma.$queryRawUnsafe<FvsCategoria[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema FROM fvs_categorias_servico WHERE id = $1 AND tenant_id IN (0, $2)`,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException();
    return rows[0];
  }

  // ── Serviços ────────────────────────────────────────────────────────────────

  async getServicos(tenantId: number, categoriaId?: number): Promise<FvsServico[]> {
    const where = categoriaId
      ? `AND s.categoria_id = ${Number(categoriaId)}`
      : '';
    const servicos = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `SELECT s.*, (s.tenant_id = 0) AS is_sistema
       FROM fvs_catalogo_servicos s
       WHERE s.tenant_id IN (0, $1) AND s.ativo = true AND s.deleted_at IS NULL ${where}
       ORDER BY s.ordem ASC, s.nome ASC`,
      tenantId,
    );
    if (!servicos.length) return [];
    const ids = servicos.map((s) => s.id);
    const itens = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `SELECT * FROM fvs_catalogo_itens
       WHERE servico_id = ANY($1::int[]) AND ativo = true
       ORDER BY servico_id, ordem ASC`,
      ids,
    );
    const itensByServico = new Map<number, FvsItem[]>();
    for (const item of itens) {
      if (!itensByServico.has(item.servico_id)) itensByServico.set(item.servico_id, []);
      itensByServico.get(item.servico_id)!.push(item);
    }
    return servicos.map((s) => ({ ...s, itens: itensByServico.get(s.id) ?? [] }));
  }

  async getServico(tenantId: number, id: number): Promise<FvsServico> {
    const rows = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `SELECT *, (tenant_id = 0) AS is_sistema
       FROM fvs_catalogo_servicos
       WHERE id = $1 AND tenant_id IN (0, $2) AND deleted_at IS NULL`,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException();
    const servico = rows[0];
    const itens = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `SELECT * FROM fvs_catalogo_itens WHERE servico_id = $1 AND ativo = true ORDER BY ordem ASC`,
      id,
    );
    return { ...servico, itens };
  }

  async createServico(tenantId: number, dto: CreateServicoDto): Promise<FvsServico> {
    const rows = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia, ordem)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      dto.categoriaId ?? null,
      dto.codigo ?? null,
      dto.nome,
      dto.normaReferencia ?? null,
      dto.ordem ?? 0,
    );
    const servico = rows[0];
    if (dto.itens?.length) {
      for (let i = 0; i < dto.itens.length; i++) {
        await this._insertItem(tenantId, servico.id, dto.itens[i], i);
      }
    }
    return this.getServico(tenantId, servico.id);
  }

  async updateServico(tenantId: number, id: number, dto: UpdateServicoDto): Promise<FvsServico> {
    await this.assertNotSistema('fvs_catalogo_servicos', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.categoriaId    !== undefined) { sets.push(`categoria_id = $${i++}`);     vals.push(dto.categoriaId); }
    if (dto.codigo         !== undefined) { sets.push(`codigo = $${i++}`);           vals.push(dto.codigo); }
    if (dto.nome           !== undefined) { sets.push(`nome = $${i++}`);             vals.push(dto.nome); }
    if (dto.normaReferencia !== undefined){ sets.push(`norma_referencia = $${i++}`); vals.push(dto.normaReferencia); }
    if (dto.ordem          !== undefined) { sets.push(`ordem = $${i++}`);            vals.push(dto.ordem); }
    if (dto.ativo          !== undefined) { sets.push(`ativo = $${i++}`);            vals.push(dto.ativo); }
    if (sets.length) {
      vals.push(id);
      await this.prisma.$executeRawUnsafe(
        `UPDATE fvs_catalogo_servicos SET ${sets.join(', ')} WHERE id = $${i}`,
        ...vals,
      );
    }
    return this.getServico(tenantId, id);
  }

  async deleteServico(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_catalogo_servicos', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_catalogo_servicos SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async clonarServico(tenantId: number, originalId: number): Promise<FvsServico> {
    const original = await this.getServico(tenantId, originalId);
    const clone = await this.prisma.$queryRawUnsafe<FvsServico[]>(
      `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia, ordem)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *, (tenant_id = 0) AS is_sistema`,
      tenantId,
      original.categoria_id,
      original.codigo,
      `${original.nome} (cópia)`,
      original.norma_referencia,
      original.ordem,
    );
    const novoId = clone[0].id;
    if (original.itens?.length) {
      for (let i = 0; i < original.itens.length; i++) {
        await this._insertItem(tenantId, novoId, original.itens[i] as any, i);
      }
    }
    return this.getServico(tenantId, novoId);
  }

  // ── Itens ───────────────────────────────────────────────────────────────────

  async createItem(tenantId: number, servicoId: number, dto: CreateItemDto): Promise<FvsItem> {
    const rows = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*)::int FROM fvs_catalogo_servicos WHERE id = $1 AND tenant_id IN (0, $2)`,
      servicoId,
      tenantId,
    );
    if (!rows[0]?.count) throw new NotFoundException('Serviço não encontrado');
    return this._insertItem(tenantId, servicoId, dto);
  }

  async updateItem(tenantId: number, id: number, dto: UpdateItemDto): Promise<FvsItem> {
    await this.assertNotSistema('fvs_catalogo_itens', id);
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (dto.descricao      !== undefined) { sets.push(`descricao = $${i++}`);       vals.push(dto.descricao); }
    if (dto.criterioAceite !== undefined) { sets.push(`criterio_aceite = $${i++}`); vals.push(dto.criterioAceite); }
    if (dto.criticidade    !== undefined) { sets.push(`criticidade = $${i++}`);     vals.push(dto.criticidade); }
    if (dto.fotoModo       !== undefined) { sets.push(`foto_modo = $${i++}`);       vals.push(dto.fotoModo); }
    if (dto.fotoMinimo     !== undefined) { sets.push(`foto_minimo = $${i++}`);     vals.push(dto.fotoMinimo); }
    if (dto.fotoMaximo     !== undefined) { sets.push(`foto_maximo = $${i++}`);     vals.push(dto.fotoMaximo); }
    if (dto.ordem          !== undefined) { sets.push(`ordem = $${i++}`);           vals.push(dto.ordem); }
    if (dto.ativo          !== undefined) { sets.push(`ativo = $${i++}`);           vals.push(dto.ativo); }
    if (!sets.length) throw new BadRequestException('Nenhum campo para atualizar');
    vals.push(id);
    const rows = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `UPDATE fvs_catalogo_itens SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      ...vals,
    );
    return rows[0];
  }

  async deleteItem(tenantId: number, id: number): Promise<void> {
    await this.assertNotSistema('fvs_catalogo_itens', id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_catalogo_itens SET ativo = false WHERE id = $1 AND tenant_id = $2`,
      id,
      tenantId,
    );
  }

  async reordenarItens(tenantId: number, servicoId: number, itens: ReorderItemDto[]): Promise<void> {
    await this.prisma.$transaction(
      itens.map((item) =>
        this.prisma.$executeRawUnsafe(
          `UPDATE fvs_catalogo_itens SET ordem = $1 WHERE id = $2 AND servico_id = $3`,
          item.ordem,
          item.id,
          servicoId,
        ),
      ),
    );
  }

  // ── Importar CSV ────────────────────────────────────────────────────────────

  async importarCsv(
    tenantId: number,
    fileBuffer: Buffer,
    dryRun: boolean,
  ): Promise<{ preview: unknown[]; errors: string[]; total: number }> {
    const csv = fileBuffer.toString('utf-8');
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    const [header, ...dataLines] = lines;
    const cols = header.split(',').map((c) => c.trim().toLowerCase());
    const required = ['nome'];
    const missing = required.filter((r) => !cols.includes(r));
    if (missing.length) throw new BadRequestException(`Colunas obrigatórias ausentes: ${missing.join(', ')}`);

    const idx = (col: string) => cols.indexOf(col);
    const preview: unknown[] = [];
    const errors: string[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const cells = dataLines[i].split(',').map((c) => c.trim());
      const nome = cells[idx('nome')];
      if (!nome) { errors.push(`Linha ${i + 2}: campo "nome" obrigatório`); continue; }
      preview.push({
        categoria: cells[idx('categoria')] ?? null,
        codigo:    cells[idx('codigo')]    ?? null,
        nome,
        norma:     cells[idx('norma')]     ?? null,
        item_descricao: cells[idx('item_descricao')] ?? null,
        criticidade: cells[idx('criticidade')] ?? 'menor',
        foto_modo:   cells[idx('foto_modo')]   ?? 'opcional',
      });
    }

    if (dryRun || errors.length) return { preview, errors, total: preview.length };

    for (const row of preview as any[]) {
      let categoriaId: number | null = null;
      if (row.categoria) {
        const cats = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM fvs_categorias_servico WHERE tenant_id IN (0, $1) AND LOWER(nome) = LOWER($2) LIMIT 1`,
          tenantId,
          row.categoria,
        );
        if (cats.length) categoriaId = cats[0].id;
      }
      const srvRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, norma_referencia)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        tenantId, categoriaId, row.codigo, row.nome, row.norma,
      );
      if (row.item_descricao && srvRows[0]) {
        await this._insertItem(tenantId, srvRows[0].id, {
          descricao: row.item_descricao,
          criticidade: row.criticidade,
          fotoModo: row.foto_modo,
        } as any);
      }
    }
    return { preview, errors: [], total: preview.length };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  private async _insertItem(
    tenantId: number,
    servicoId: number,
    dto: CreateItemDto,
    ordemOverride?: number,
  ): Promise<FvsItem> {
    const rows = await this.prisma.$queryRawUnsafe<FvsItem[]>(
      `INSERT INTO fvs_catalogo_itens
         (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, foto_minimo, foto_maximo, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      tenantId,
      servicoId,
      dto.descricao,
      dto.criterioAceite ?? null,
      dto.criticidade ?? 'menor',
      dto.fotoModo ?? 'opcional',
      dto.fotoMinimo ?? 0,
      dto.fotoMaximo ?? 2,
      ordemOverride ?? dto.ordem ?? 0,
    );
    return rows[0];
  }
}
```

- [ ] **Rodar os testes**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx jest catalogo.service.spec --no-coverage 2>&1 | tail -20
```

Esperado: `PASS` — 6 testes passando.

- [ ] **Commit**

```bash
git add backend/src/fvs/catalogo/catalogo.service.ts backend/src/fvs/catalogo/catalogo.service.spec.ts
git commit -m "feat(fvs): CatalogoService com testes (TDD)"
```

---

## Task 4: Controller, Module e Registro

**Files:**
- Create: `backend/src/fvs/catalogo/catalogo.controller.ts`
- Create: `backend/src/fvs/fvs.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Criar `catalogo.controller.ts`**

```typescript
// backend/src/fvs/catalogo/catalogo.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseIntPipe, UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CatalogoService } from './catalogo.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ImportQueryDto } from './dto/import-query.dto';

@Controller('api/v1/fvs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  // ── Categorias ──────────────────────────────────────────────────────────────

  @Get('categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getCategorias(@TenantId() tenantId: number) {
    return this.catalogo.getCategorias(tenantId);
  }

  @Post('categorias')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createCategoria(@TenantId() tenantId: number, @Body() dto: CreateCategoriaDto) {
    return this.catalogo.createCategoria(tenantId, dto);
  }

  @Patch('categorias/ordem')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reordenarCategorias(@TenantId() tenantId: number, @Body() dto: ReorderDto) {
    return this.catalogo.reordenarCategorias(tenantId, dto.itens);
  }

  @Patch('categorias/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateCategoria(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.catalogo.updateCategoria(tenantId, id, dto);
  }

  @Delete('categorias/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategoria(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteCategoria(tenantId, id);
  }

  // ── Serviços ────────────────────────────────────────────────────────────────

  @Get('servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getServicos(
    @TenantId() tenantId: number,
    @Query('categoriaId', new ParseIntPipe({ optional: true })) categoriaId?: number,
  ) {
    return this.catalogo.getServicos(tenantId, categoriaId);
  }

  @Get('servicos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.getServico(tenantId, id);
  }

  @Post('servicos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createServico(@TenantId() tenantId: number, @Body() dto: CreateServicoDto) {
    return this.catalogo.createServico(tenantId, dto);
  }

  @Post('servicos/:id/clonar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  clonarServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.clonarServico(tenantId, id);
  }

  @Post('servicos/importar')
  @Roles('ADMIN_TENANT')
  @UseInterceptors(FileInterceptor('arquivo'))
  importarCsv(
    @TenantId() tenantId: number,
    @UploadedFile() file: Express.Multer.File,
    @Query() query: ImportQueryDto,
  ) {
    if (!file) throw new Error('Arquivo CSV obrigatório');
    return this.catalogo.importarCsv(tenantId, file.buffer, query.dry_run ?? false);
  }

  @Patch('servicos/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateServico(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServicoDto,
  ) {
    return this.catalogo.updateServico(tenantId, id, dto);
  }

  @Delete('servicos/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteServico(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteServico(tenantId, id);
  }

  // ── Itens ───────────────────────────────────────────────────────────────────

  @Post('servicos/:id/itens')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  createItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) servicoId: number,
    @Body() dto: CreateItemDto,
  ) {
    return this.catalogo.createItem(tenantId, servicoId, dto);
  }

  @Patch('servicos/:id/itens/ordem')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  reordenarItens(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) servicoId: number,
    @Body() dto: ReorderDto,
  ) {
    return this.catalogo.reordenarItens(tenantId, servicoId, dto.itens);
  }

  @Patch('itens/:id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  updateItem(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateItemDto,
  ) {
    return this.catalogo.updateItem(tenantId, id, dto);
  }

  @Delete('itens/:id')
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(@TenantId() tenantId: number, @Param('id', ParseIntPipe) id: number) {
    return this.catalogo.deleteItem(tenantId, id);
  }
}
```

- [ ] **Criar `fvs.module.ts`**

```typescript
// backend/src/fvs/fvs.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogoService } from './catalogo/catalogo.service';
import { CatalogoController } from './catalogo/catalogo.controller';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB para CSV
    }),
  ],
  providers: [CatalogoService],
  controllers: [CatalogoController],
  exports: [CatalogoService],
})
export class FvsModule {}
```

- [ ] **Registrar `FvsModule` no `app.module.ts`**

```typescript
// backend/src/app.module.ts — adicionar linha abaixo de GedModule
import { FvsModule } from './fvs/fvs.module';

// No array imports:
FvsModule,
```

Arquivo final:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ObrasModule } from './obras/obras.module';
import { GedModule } from './ged/ged.module';
import { FvsModule } from './fvs/fvs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
      },
    }),
    PrismaModule,
    AuthModule,
    ObrasModule,
    GedModule,
    FvsModule,
  ],
})
export class AppModule {}
```

- [ ] **Verificar que o backend compila sem erros**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx tsc --noEmit 2>&1 | head -30
```

Esperado: nenhuma saída (0 erros).

- [ ] **Testar os endpoints manualmente com curl**

```bash
# Obter token primeiro (ajuste email/senha conforme seu usuário de teste)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"eldox@eldox.com.br","password":"eldox123"}' \
  | jq -r '.access_token')

# Listar categorias — espera 12 do sistema
curl -s http://localhost:3000/api/v1/fvs/categorias \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Esperado: 12

# Listar serviços — espera 8 do sistema
curl -s http://localhost:3000/api/v1/fvs/servicos \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
# Esperado: 8

# Tentar editar categoria do sistema — espera 403
curl -s -X PATCH http://localhost:3000/api/v1/fvs/categorias/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"nome":"hack"}' | jq '.statusCode'
# Esperado: 403
```

- [ ] **Commit**

```bash
git add backend/src/fvs/catalogo/catalogo.controller.ts backend/src/fvs/fvs.module.ts backend/src/app.module.ts
git commit -m "feat(fvs): controller, módulo e registro no AppModule"
```

---

## Task 5: Frontend — Service e Hooks

**Files:**
- Create: `frontend-web/src/services/fvs.service.ts`
- Create: `frontend-web/src/modules/fvs/catalogo/hooks/useCatalogo.ts`

- [ ] **Criar `fvs.service.ts`**

```typescript
// frontend-web/src/services/fvs.service.ts
import { api } from './api';
import type { FvsCategoria, FvsServico, FvsItem } from '../types/fvs.types';

export interface CreateCategoriaPayload { nome: string; ordem?: number }
export interface CreateServicoPayload {
  categoriaId?: number; codigo?: string; nome: string;
  normaReferencia?: string; ordem?: number;
  itens?: { descricao: string; criticidade?: string; fotoModo?: string }[];
}
export interface CreateItemPayload {
  descricao: string; criterioAceite?: string;
  criticidade?: 'critico' | 'maior' | 'menor';
  fotoModo?: 'nenhuma' | 'opcional' | 'obrigatoria';
  fotoMinimo?: number; fotoMaximo?: number; ordem?: number;
}
export interface ReorderPayload { itens: { id: number; ordem: number }[] }
export interface ImportResult { preview: unknown[]; errors: string[]; total: number }

export const fvsService = {
  // Categorias
  async getCategorias(): Promise<FvsCategoria[]> {
    const { data } = await api.get('/fvs/categorias');
    return data;
  },
  async createCategoria(payload: CreateCategoriaPayload): Promise<FvsCategoria> {
    const { data } = await api.post('/fvs/categorias', payload);
    return data;
  },
  async updateCategoria(id: number, payload: Partial<CreateCategoriaPayload>): Promise<FvsCategoria> {
    const { data } = await api.patch(`/fvs/categorias/${id}`, payload);
    return data;
  },
  async deleteCategoria(id: number): Promise<void> {
    await api.delete(`/fvs/categorias/${id}`);
  },
  async reordenarCategorias(payload: ReorderPayload): Promise<void> {
    await api.patch('/fvs/categorias/ordem', payload);
  },

  // Serviços
  async getServicos(categoriaId?: number): Promise<FvsServico[]> {
    const { data } = await api.get('/fvs/servicos', {
      params: categoriaId ? { categoriaId } : undefined,
    });
    return data;
  },
  async getServico(id: number): Promise<FvsServico> {
    const { data } = await api.get(`/fvs/servicos/${id}`);
    return data;
  },
  async createServico(payload: CreateServicoPayload): Promise<FvsServico> {
    const { data } = await api.post('/fvs/servicos', payload);
    return data;
  },
  async updateServico(id: number, payload: Partial<CreateServicoPayload>): Promise<FvsServico> {
    const { data } = await api.patch(`/fvs/servicos/${id}`, payload);
    return data;
  },
  async deleteServico(id: number): Promise<void> {
    await api.delete(`/fvs/servicos/${id}`);
  },
  async clonarServico(id: number): Promise<FvsServico> {
    const { data } = await api.post(`/fvs/servicos/${id}/clonar`);
    return data;
  },
  async importarCsv(file: File, dryRun = false): Promise<ImportResult> {
    const form = new FormData();
    form.append('arquivo', file);
    const { data } = await api.post(`/fvs/servicos/importar?dry_run=${dryRun}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  async reordenarItens(servicoId: number, payload: ReorderPayload): Promise<void> {
    await api.patch(`/fvs/servicos/${servicoId}/itens/ordem`, payload);
  },

  // Itens
  async createItem(servicoId: number, payload: CreateItemPayload): Promise<FvsItem> {
    const { data } = await api.post(`/fvs/servicos/${servicoId}/itens`, payload);
    return data;
  },
  async updateItem(id: number, payload: Partial<CreateItemPayload>): Promise<FvsItem> {
    const { data } = await api.patch(`/fvs/itens/${id}`, payload);
    return data;
  },
  async deleteItem(id: number): Promise<void> {
    await api.delete(`/fvs/itens/${id}`);
  },
};
```

- [ ] **Criar tipos TypeScript do frontend**

```typescript
// frontend-web/src/types/fvs.types.ts
export type Criticidade = 'critico' | 'maior' | 'menor';
export type FotoModo = 'nenhuma' | 'opcional' | 'obrigatoria';

export interface FvsCategoria {
  id: number;
  tenant_id: number;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  is_sistema: boolean;
}

export interface FvsServico {
  id: number;
  tenant_id: number;
  categoria_id: number | null;
  codigo: string | null;
  nome: string;
  norma_referencia: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
  is_sistema: boolean;
  itens?: FvsItem[];
}

export interface FvsItem {
  id: number;
  tenant_id: number;
  servico_id: number;
  descricao: string;
  criterio_aceite: string | null;
  criticidade: Criticidade;
  foto_modo: FotoModo;
  foto_minimo: number;
  foto_maximo: number;
  ordem: number;
  ativo: boolean;
  created_at: string;
}
```

- [ ] **Criar `useCatalogo.ts`**

```typescript
// frontend-web/src/modules/fvs/catalogo/hooks/useCatalogo.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService, type CreateCategoriaPayload, type CreateServicoPayload, type CreateItemPayload } from '../../../../services/fvs.service';

export function useCategorias() {
  return useQuery({
    queryKey: ['fvs-categorias'],
    queryFn: () => fvsService.getCategorias(),
  });
}

export function useServicos(categoriaId?: number) {
  return useQuery({
    queryKey: ['fvs-servicos', categoriaId],
    queryFn: () => fvsService.getServicos(categoriaId),
    enabled: true,
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCategoriaPayload) => fvsService.createCategoria(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateCategoriaPayload>) =>
      fvsService.updateCategoria(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteCategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-categorias'] }),
  });
}

export function useCreateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServicoPayload) => fvsService.createServico(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useUpdateServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Partial<CreateServicoPayload>) =>
      fvsService.updateServico(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useDeleteServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteServico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useClonarServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.clonarServico(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ servicoId, ...payload }: { servicoId: number } & CreateItemPayload) =>
      fvsService.createItem(servicoId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fvsService.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fvs-servicos'] }),
  });
}
```

- [ ] **Commit**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add frontend-web/src/services/fvs.service.ts frontend-web/src/types/fvs.types.ts frontend-web/src/modules/fvs/
git commit -m "feat(fvs): fvsService + tipos TS + hooks React Query"
```

---

## Task 6: Componentes Frontend — Split Layout

**Files:**
- Create: `frontend-web/src/modules/fvs/catalogo/components/CategoriasList.tsx`
- Create: `frontend-web/src/modules/fvs/catalogo/components/ServicosPanel.tsx`
- Create: `frontend-web/src/modules/fvs/catalogo/components/ServicoCard.tsx`

- [ ] **Criar `CategoriasList.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/components/CategoriasList.tsx
import { cn } from '@/lib/cn'
import type { FvsCategoria } from '@/types/fvs.types'
import { Plus } from 'lucide-react'

interface Props {
  categorias: FvsCategoria[]
  selectedId: number | null
  onSelect: (id: number) => void
  onNovaCategoria: () => void
}

export function CategoriasList({ categorias, selectedId, onSelect, onNovaCategoria }: Props) {
  const sistema = categorias.filter(c => c.is_sistema)
  const tenant  = categorias.filter(c => !c.is_sistema)

  return (
    <div className="flex flex-col h-full border-r border-[var(--border-dim)]">
      <div className="px-4 py-3 border-b border-[var(--border-dim)]">
        <p className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">Categorias</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {sistema.length > 0 && (
          <>
            <p className="px-4 pt-2 pb-1 text-[10px] text-[var(--text-faint)] uppercase tracking-wide">PBQP-H / Sistema</p>
            {sistema.map(cat => (
              <CatItem key={cat.id} cat={cat} selected={selectedId === cat.id} onSelect={onSelect} />
            ))}
          </>
        )}
        {tenant.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1 text-[10px] text-[var(--text-faint)] uppercase tracking-wide">Personalizadas</p>
            {tenant.map(cat => (
              <CatItem key={cat.id} cat={cat} selected={selectedId === cat.id} onSelect={onSelect} />
            ))}
          </>
        )}
      </div>
      <div className="p-3 border-t border-[var(--border-dim)]">
        <button
          onClick={onNovaCategoria}
          className={cn(
            'flex items-center gap-1.5 w-full px-3 py-2 rounded-sm text-[12px]',
            'text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors',
          )}
        >
          <Plus size={12} />
          Nova Categoria
        </button>
      </div>
    </div>
  )
}

function CatItem({ cat, selected, onSelect }: { cat: FvsCategoria; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <button
      onClick={() => onSelect(cat.id)}
      className={cn(
        'flex items-center justify-between w-full px-4 py-2.5 text-left',
        'text-[13px] transition-colors',
        selected
          ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-l-2 border-[var(--accent)]'
          : 'text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
      )}
    >
      <span className="truncate">{cat.nome}</span>
    </button>
  )
}
```

- [ ] **Criar `ServicoCard.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/components/ServicoCard.tsx
import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { FvsServico } from '@/types/fvs.types'
import { ChevronDown, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react'

const CRITICIDADE_STYLE: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
}

interface Props {
  servico: FvsServico
  onClonar: (id: number) => void
  onEditar: (servico: FvsServico) => void
  onExcluir: (id: number) => void
}

export function ServicoCard({ servico, onClonar, onEditar, onExcluir }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-[var(--border-dim)] last:border-0">
      <div className="flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown size={14} className="text-[var(--text-faint)] flex-shrink-0" />
            : <ChevronRight size={14} className="text-[var(--text-faint)] flex-shrink-0" />}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {servico.codigo && (
                <span className="text-[11px] text-[var(--accent)] font-mono font-semibold">{servico.codigo}</span>
              )}
              <span className="text-[13px] font-medium text-[var(--text-high)] truncate">{servico.nome}</span>
              {servico.is_sistema && (
                <span className="text-[10px] bg-[var(--run-bg)] text-[var(--run-text)] border border-[var(--run-border)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                  SISTEMA
                </span>
              )}
            </div>
            {servico.norma_referencia && (
              <span className="text-[11px] text-[var(--text-faint)]">{servico.norma_referencia}</span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <span className="text-[11px] text-[var(--text-faint)] mr-1">{servico.itens?.length ?? 0} itens</span>
          <button
            onClick={() => onClonar(servico.id)}
            title="Clonar"
            className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
          >
            <Copy size={13} />
          </button>
          {!servico.is_sistema && (
            <>
              <button
                onClick={() => onEditar(servico)}
                title="Editar"
                className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onExcluir(servico.id)}
                title="Excluir"
                className="p-1.5 rounded text-[var(--text-faint)] hover:text-[var(--nc)] hover:bg-[var(--nc-bg)] transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && servico.itens && servico.itens.length > 0 && (
        <div className="pl-10 pr-4 pb-3 space-y-1">
          {servico.itens.map((item, i) => (
            <div key={item.id} className="flex items-start gap-2 py-1">
              <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 flex-shrink-0 pt-0.5">{i + 1}.</span>
              <span className="text-[12px] text-[var(--text-mid)] flex-1">{item.descricao}</span>
              <span className={cn('text-[9px] px-1.5 py-0.5 rounded uppercase font-semibold flex-shrink-0', CRITICIDADE_STYLE[item.criticidade])}>
                {item.criticidade}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Criar `ServicosPanel.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/components/ServicosPanel.tsx
import { cn } from '@/lib/cn'
import type { FvsCategoria, FvsServico } from '@/types/fvs.types'
import { ServicoCard } from './ServicoCard'
import { Plus, Loader2 } from 'lucide-react'

interface Props {
  categoria: FvsCategoria | null
  servicos: FvsServico[]
  isLoading: boolean
  onNovoServico: () => void
  onClonar: (id: number) => void
  onEditar: (servico: FvsServico) => void
  onExcluir: (id: number) => void
}

export function ServicosPanel({ categoria, servicos, isLoading, onNovoServico, onClonar, onEditar, onExcluir }: Props) {
  if (!categoria) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-faint)] text-sm">
        Selecione uma categoria
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text-high)]">{categoria.nome}</p>
          <p className="text-[11px] text-[var(--text-faint)]">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={onNovoServico}
          className={cn(
            'flex items-center gap-1.5 px-3 h-8 rounded-sm text-[12px] font-semibold',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors',
          )}
        >
          <Plus size={12} />
          Novo Serviço
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-faint)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Carregando...
          </div>
        ) : servicos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--text-faint)]">
            <p className="text-sm mb-3">Nenhum serviço nesta categoria</p>
            <button onClick={onNovoServico} className="text-[var(--accent)] text-sm hover:underline">
              + Adicionar primeiro serviço
            </button>
          </div>
        ) : (
          <div>
            {servicos.map(s => (
              <ServicoCard
                key={s.id}
                servico={s}
                onClonar={onClonar}
                onEditar={onEditar}
                onExcluir={onExcluir}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add frontend-web/src/modules/fvs/catalogo/components/
git commit -m "feat(fvs): componentes CategoriasList, ServicoCard e ServicosPanel"
```

---

## Task 7: Modais — ServicoModal e ImportarCsvModal

**Files:**
- Create: `frontend-web/src/modules/fvs/catalogo/components/ServicoModal.tsx`
- Create: `frontend-web/src/modules/fvs/catalogo/components/ImportarCsvModal.tsx`

- [ ] **Criar `ServicoModal.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/components/ServicoModal.tsx
import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { FvsCategoria, FvsServico } from '@/types/fvs.types'
import { X, Plus, Trash2 } from 'lucide-react'

interface ItemDraft { descricao: string; criticidade: 'critico' | 'maior' | 'menor'; fotoModo: 'nenhuma' | 'opcional' | 'obrigatoria' }

interface Props {
  open: boolean
  categorias: FvsCategoria[]
  servico?: FvsServico | null  // null = criação, FvsServico = edição
  onSave: (payload: { categoriaId?: number; codigo?: string; nome: string; normaReferencia?: string; itens?: ItemDraft[] }) => void
  onClose: () => void
}

export function ServicoModal({ open, categorias, servico, onSave, onClose }: Props) {
  const [nome, setNome]                 = useState('')
  const [codigo, setCodigo]             = useState('')
  const [norma, setNorma]               = useState('')
  const [categoriaId, setCategoriaId]   = useState<number | ''>('')
  const [itens, setItens]               = useState<ItemDraft[]>([])

  useEffect(() => {
    if (servico) {
      setNome(servico.nome)
      setCodigo(servico.codigo ?? '')
      setNorma(servico.norma_referencia ?? '')
      setCategoriaId(servico.categoria_id ?? '')
      setItens(
        (servico.itens ?? []).map(i => ({
          descricao: i.descricao,
          criticidade: i.criticidade,
          fotoModo: i.foto_modo,
        })),
      )
    } else {
      setNome(''); setCodigo(''); setNorma(''); setCategoriaId(''); setItens([])
    }
  }, [servico, open])

  if (!open) return null

  const addItem = () => setItens(v => [...v, { descricao: '', criticidade: 'menor', fotoModo: 'opcional' }])
  const removeItem = (i: number) => setItens(v => v.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof ItemDraft, value: string) =>
    setItens(v => v.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSave = () => {
    if (!nome.trim()) return
    onSave({
      nome: nome.trim(),
      codigo: codigo.trim() || undefined,
      normaReferencia: norma.trim() || undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      itens: itens.filter(i => i.descricao.trim()),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">
            {servico ? 'Editar Serviço' : 'Novo Serviço'}
          </h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Nome *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: EXECUÇÃO DE ALVENARIA DE VEDAÇÃO"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Código PO</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: PO 19.20"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Norma de Referência</label>
              <input
                value={norma}
                onChange={e => setNorma(e.target.value)}
                placeholder="Ex: NBR 15696"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Categoria</label>
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">Sem categoria</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[var(--text-high)]">Itens de Verificação</p>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
              >
                <Plus size={11} /> Adicionar Item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-[var(--bg-raised)] rounded border border-[var(--border-dim)]">
                  <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 pt-2">{i + 1}.</span>
                  <input
                    value={item.descricao}
                    onChange={e => updateItem(i, 'descricao', e.target.value)}
                    placeholder="Descrição do item de verificação..."
                    className="flex-1 h-8 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                  />
                  <select
                    value={item.criticidade}
                    onChange={e => updateItem(i, 'criticidade', e.target.value)}
                    className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                  >
                    <option value="menor">Menor</option>
                    <option value="maior">Maior</option>
                    <option value="critico">Crítico</option>
                  </select>
                  <select
                    value={item.fotoModo}
                    onChange={e => updateItem(i, 'fotoModo', e.target.value)}
                    className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                  >
                    <option value="nenhuma">Sem foto</option>
                    <option value="opcional">Foto opcional</option>
                    <option value="obrigatoria">Foto obrigatória</option>
                  </select>
                  <button onClick={() => removeItem(i)} className="p-1.5 text-[var(--text-faint)] hover:text-[var(--nc)] mt-0.5">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-[12px] text-[var(--text-faint)] py-2">Nenhum item adicionado ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-sm text-[13px] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!nome.trim()}
            className="px-4 h-9 rounded-sm text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Criar `ImportarCsvModal.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/components/ImportarCsvModal.tsx
import { useState, useRef } from 'react'
import { cn } from '@/lib/cn'
import { fvsService, type ImportResult } from '@/services/fvs.service'
import { X, Upload, Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const CSV_TEMPLATE = `categoria,codigo,nome,norma,item_descricao,criticidade,foto_modo
Alvenaria,PO 10.01,EXECUÇÃO DE ALVENARIA DE VEDAÇÃO,NBR 8545,BLOCOS ALINHADOS (DESVIO MÁX. 3MM/M)?,maior,opcional
Alvenaria,PO 10.01,EXECUÇÃO DE ALVENARIA DE VEDAÇÃO,NBR 8545,JUNTAS COM ESPESSURA UNIFORME (10±3MM)?,menor,opcional`

interface Props { open: boolean; onSuccess: () => void; onClose: () => void }

export function ImportarCsvModal({ open, onSuccess, onClose }: Props) {
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<ImportResult | null>(null)
  const [loading, setLoading]     = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = async (f: File) => {
    setFile(f)
    setLoading(true)
    try {
      const result = await fvsService.importarCsv(f, true) // dry_run = true
      setPreview(result)
    } catch {
      setPreview({ preview: [], errors: ['Erro ao ler o arquivo. Verifique o formato CSV.'], total: 0 })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!file) return
    setConfirming(true)
    try {
      await fvsService.importarCsv(file, false) // dry_run = false — persiste
      onSuccess()
      onClose()
    } finally {
      setConfirming(false)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template-servicos-fvs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const hasErrors = (preview?.errors?.length ?? 0) > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-lg',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">Importar Serviços via CSV</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between p-3 bg-[var(--bg-raised)] rounded border border-[var(--border-dim)]">
            <div>
              <p className="text-[12px] font-medium text-[var(--text-high)]">Template CSV</p>
              <p className="text-[11px] text-[var(--text-faint)]">Colunas: categoria, codigo, nome, norma, item_descricao, criticidade, foto_modo</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 h-8 rounded-sm text-[12px] border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Download size={12} /> Baixar
            </button>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center p-6 rounded border-2 border-dashed cursor-pointer transition-colors',
              file ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] hover:border-[var(--accent)]',
            )}
          >
            <Upload size={20} className={cn('mb-2', file ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]')} />
            <p className="text-[13px] text-[var(--text-mid)]">
              {file ? file.name : 'Clique para selecionar arquivo .csv ou .xlsx'}
            </p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-[var(--text-faint)] text-[13px]">
              <Loader2 size={14} className="animate-spin" /> Analisando arquivo...
            </div>
          )}

          {preview && !loading && (
            <div className="space-y-2">
              {hasErrors ? (
                <div className="flex items-start gap-2 p-3 bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded">
                  <AlertCircle size={14} className="text-[var(--nc)] mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[12px] font-medium text-[var(--nc-text)]">Erros encontrados</p>
                    {preview.errors.map((e, i) => <p key={i} className="text-[11px] text-[var(--nc-text)]">{e}</p>)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-[var(--ok-bg)] border border-[var(--ok-border)] rounded">
                  <CheckCircle size={14} className="text-[var(--ok)]" />
                  <p className="text-[12px] text-[var(--ok-text)]">{preview.total} registro{preview.total !== 1 ? 's' : ''} prontos para importar</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button onClick={onClose} className="px-4 h-9 rounded-sm text-[13px] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview || hasErrors || confirming}
            className="px-4 h-9 rounded-sm text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            {confirming ? <Loader2 size={14} className="animate-spin" /> : 'Confirmar Importação'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add frontend-web/src/modules/fvs/catalogo/components/ServicoModal.tsx frontend-web/src/modules/fvs/catalogo/components/ImportarCsvModal.tsx
git commit -m "feat(fvs): modais ServicoModal e ImportarCsvModal"
```

---

## Task 8: CatalogoPage e Rota

**Files:**
- Create: `frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx`
- Modify: `frontend-web/src/App.tsx`

- [ ] **Criar `CatalogoPage.tsx`**

```tsx
// frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Upload } from 'lucide-react'
import { CategoriasList } from './components/CategoriasList'
import { ServicosPanel } from './components/ServicosPanel'
import { ServicoModal } from './components/ServicoModal'
import { ImportarCsvModal } from './components/ImportarCsvModal'
import {
  useCategorias, useServicos,
  useCreateServico, useUpdateServico, useDeleteServico, useClonarServico,
  useCreateCategoria,
} from './hooks/useCatalogo'
import type { FvsServico } from '@/types/fvs.types'

export default function CatalogoPage() {
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [servicoEditando, setServicoEditando] = useState<FvsServico | null | undefined>(undefined)
  // undefined = modal fechado, null = criação, FvsServico = edição
  const [importarOpen, setImportarOpen] = useState(false)

  const { data: categorias = [], isLoading: loadingCats } = useCategorias()
  const { data: servicos = [], isLoading: loadingSrv } = useServicos(selectedCatId ?? undefined)

  const createServico  = useCreateServico()
  const updateServico  = useUpdateServico()
  const deleteServico  = useDeleteServico()
  const clonarServico  = useClonarServico()
  const createCategoria = useCreateCategoria()

  const selectedCat = categorias.find(c => c.id === selectedCatId) ?? null

  const handleSaveServico = (payload: any) => {
    if (servicoEditando) {
      updateServico.mutate({ id: servicoEditando.id, ...payload })
    } else {
      createServico.mutate({ ...payload, categoriaId: selectedCatId ?? payload.categoriaId })
    }
    setServicoEditando(undefined)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <h1 className="text-[18px] font-semibold text-[var(--text-high)]">Catálogo de Serviços FVS</h1>
          <p className="text-[12px] text-[var(--text-faint)] mt-0.5">
            {categorias.length} categorias · {/* total global omitido para simplicidade */}
          </p>
        </div>
        <button
          onClick={() => setImportarOpen(true)}
          className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px]',
            'border border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors',
          )}
        >
          <Upload size={14} />
          Importar CSV
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: categories */}
        <div className="w-56 flex-shrink-0">
          {loadingCats ? (
            <div className="p-4 text-[var(--text-faint)] text-sm">Carregando...</div>
          ) : (
            <CategoriasList
              categorias={categorias}
              selectedId={selectedCatId}
              onSelect={setSelectedCatId}
              onNovaCategoria={() => {
                const nome = window.prompt('Nome da nova categoria:')
                if (nome?.trim()) createCategoria.mutate({ nome: nome.trim() })
              }}
            />
          )}
        </div>

        {/* Right: services */}
        <ServicosPanel
          categoria={selectedCat}
          servicos={selectedCatId ? servicos.filter(s => s.categoria_id === selectedCatId) : servicos}
          isLoading={loadingSrv}
          onNovoServico={() => setServicoEditando(null)}
          onClonar={(id) => clonarServico.mutate(id)}
          onEditar={(s) => setServicoEditando(s)}
          onExcluir={(id) => {
            if (window.confirm('Excluir este serviço?')) deleteServico.mutate(id)
          }}
        />
      </div>

      {/* Modais */}
      <ServicoModal
        open={servicoEditando !== undefined}
        categorias={categorias}
        servico={servicoEditando ?? null}
        onSave={handleSaveServico}
        onClose={() => setServicoEditando(undefined)}
      />
      <ImportarCsvModal
        open={importarOpen}
        onSuccess={() => {}}
        onClose={() => setImportarOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Adicionar rota em `App.tsx`**

Adicionar dentro do bloco `<Route element={<AppLayout />}>`:

```tsx
import CatalogoPage from './modules/fvs/catalogo/CatalogoPage'

// dentro de <Route element={<AppLayout />}>:
<Route path="/configuracoes/fvs/catalogo" element={<CatalogoPage />} />
```

- [ ] **Verificar que o frontend compila**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/frontend-web
npx tsc --noEmit 2>&1 | head -30
```

Esperado: nenhum erro de tipo.

- [ ] **Acessar no browser e verificar**

```
http://localhost:5173/configuracoes/fvs/catalogo
```

Verificar:
1. Coluna esquerda mostra 12 categorias do sistema
2. Clicar numa categoria mostra os serviços do sistema à direita
3. Serviços do sistema têm badge `SISTEMA` e botão `Clonar`
4. Clicar `Clonar` cria cópia editável (sem badge SISTEMA)
5. `+ Novo Serviço` abre o modal com formulário
6. `Importar CSV` abre o modal com download de template

- [ ] **Commit final**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3
git add frontend-web/src/modules/fvs/catalogo/CatalogoPage.tsx frontend-web/src/App.tsx
git commit -m "feat(fvs): CatalogoPage com split layout + rota /configuracoes/fvs/catalogo"
```

---

## Checklist Final

- [ ] `GET /fvs/categorias` retorna 12 categorias para qualquer tenant após seed
- [ ] `GET /fvs/servicos` retorna 8 serviços com itens embedded
- [ ] `PATCH /fvs/categorias/1` retorna 403 (sistema imutável)
- [ ] `POST /fvs/servicos/:id/clonar` cria cópia com tenant_id do usuário
- [ ] Import CSV dry_run retorna preview sem persistir; sem dry_run persiste
- [ ] UI mostra badge `SISTEMA` nos serviços PBQP-H e desabilita edição/exclusão
- [ ] Busca filtra em tempo real (implementação futura — não bloqueia aceite do sprint)
- [ ] 6 testes unitários do service passando (`npx jest catalogo.service.spec`)
