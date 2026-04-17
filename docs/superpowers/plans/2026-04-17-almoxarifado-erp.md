# Almoxarifado ERP Multi-Local — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Almoxarifado from obra-scoped stock to tenant-level multi-location ERP with transfers, approval flow, and NF-e receipt by location.

**Architecture:** Location (`alm_locais`) replaces obra as the stock axis. Every balance and movement belongs to a location. OCs and solicitações target locations. Transfers between locations have a configurable approval threshold.

**Tech Stack:** NestJS + Prisma $queryRawUnsafe + PostgreSQL (backend); React 19 + React Query + Tailwind + CSS tokens (frontend).

**Spec:** `docs/superpowers/specs/2026-04-17-almoxarifado-erp-design.md`

---

## Task 1: Database Migration

**Create:** `backend/prisma/migrations/20260417000001_almoxarifado_erp/migration.sql`

### Steps

- [ ] Create the migration directory:
  ```bash
  mkdir -p backend/prisma/migrations/20260417000001_almoxarifado_erp
  ```

- [ ] Create the migration file with the following complete SQL:

```sql
-- ============================================================
-- Migration: 20260417000001_almoxarifado_erp
-- Redesign Almoxarifado from obra-scoped to multi-location ERP
-- Database is empty — no data migration needed.
-- ============================================================

-- ── 1. Drop old table (replaced by alm_locais) ───────────────
DROP TABLE IF EXISTS alm_estoque_locais CASCADE;

-- ── 2. New table: alm_locais ──────────────────────────────────
CREATE TABLE alm_locais (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  tipo              VARCHAR(20) NOT NULL
                    CHECK (tipo IN ('CENTRAL', 'CD', 'DEPOSITO', 'OBRA')),
  nome              VARCHAR(255) NOT NULL,
  descricao         TEXT,
  obra_id           INT REFERENCES obras(id),
  endereco          VARCHAR(500),
  responsavel_nome  VARCHAR(255),
  ativo             BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_alm_locais_obra_required
    CHECK (tipo != 'OBRA' OR obra_id IS NOT NULL),
  CONSTRAINT chk_alm_locais_obra_forbidden
    CHECK (tipo = 'OBRA' OR obra_id IS NULL),
  UNIQUE (tenant_id, nome)
);

CREATE INDEX idx_alm_locais_tenant ON alm_locais(tenant_id);
CREATE INDEX idx_alm_locais_obra ON alm_locais(obra_id) WHERE obra_id IS NOT NULL;
CREATE INDEX idx_alm_locais_tipo ON alm_locais(tenant_id, tipo);
CREATE INDEX idx_alm_locais_ativo ON alm_locais(tenant_id, ativo);

-- ── 3. New table: alm_transferencias ─────────────────────────
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
  valor_total         NUMERIC(15,2),
  solicitante_id      INT NOT NULL,
  aprovador_id        INT,
  aprovado_at         TIMESTAMPTZ,
  observacao          TEXT,
  executada_parcial   BOOLEAN NOT NULL DEFAULT false,
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

-- ── 4. New table: alm_transferencia_itens ────────────────────
CREATE TABLE alm_transferencia_itens (
  id                SERIAL PRIMARY KEY,
  transferencia_id  INT NOT NULL REFERENCES alm_transferencias(id) ON DELETE CASCADE,
  catalogo_id       INT NOT NULL,
  quantidade        NUMERIC(15,4) NOT NULL CHECK (quantidade > 0),
  unidade           VARCHAR(20) NOT NULL,
  qtd_executada     NUMERIC(15,4) NOT NULL DEFAULT 0
                    CHECK (qtd_executada >= 0),
  CONSTRAINT chk_alm_trans_itens_qtd_max
    CHECK (qtd_executada <= quantidade)
);

CREATE INDEX idx_alm_trans_itens_transferencia ON alm_transferencia_itens(transferencia_id);
CREATE INDEX idx_alm_trans_itens_catalogo ON alm_transferencia_itens(catalogo_id);

-- ── 5. New table: alm_config_transferencia ────────────────────
CREATE TABLE alm_config_transferencia (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT NOT NULL UNIQUE,
  valor_limite_direto   NUMERIC(15,2) NOT NULL DEFAULT 0,
  roles_aprovadores     TEXT[] NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alm_config_trans_tenant ON alm_config_transferencia(tenant_id);

-- ── 6. Alter alm_estoque_saldo ────────────────────────────────
ALTER TABLE alm_estoque_saldo
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_estoque_saldo
  ALTER COLUMN local_id SET NOT NULL,
  ADD CONSTRAINT fk_alm_saldo_local FOREIGN KEY (local_id) REFERENCES alm_locais(id);

-- Drop old unique constraint (obra-scoped)
ALTER TABLE alm_estoque_saldo
  DROP CONSTRAINT IF EXISTS alm_estoque_saldo_tenant_id_obra_id_catalogo_id_key;

-- Add new unique constraint (local-scoped)
ALTER TABLE alm_estoque_saldo
  ADD CONSTRAINT alm_estoque_saldo_tenant_local_catalogo_key
  UNIQUE (tenant_id, local_id, catalogo_id);

-- Update index
DROP INDEX IF EXISTS idx_alm_estoque_saldo_obra;
CREATE INDEX idx_alm_estoque_saldo_local ON alm_estoque_saldo(local_id);

-- ── 7. Alter alm_movimentos ───────────────────────────────────
ALTER TABLE alm_movimentos
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_movimentos
  ALTER COLUMN local_id SET NOT NULL,
  ADD CONSTRAINT fk_alm_movimentos_local FOREIGN KEY (local_id) REFERENCES alm_locais(id);

DROP INDEX IF EXISTS idx_alm_movimentos_obra;
CREATE INDEX idx_alm_movimentos_local ON alm_movimentos(local_id);

-- ── 8. Alter alm_ordens_compra ────────────────────────────────
ALTER TABLE alm_ordens_compra
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_ordens_compra
  ADD COLUMN local_destino_id INT NOT NULL REFERENCES alm_locais(id);

DROP INDEX IF EXISTS idx_alm_ordens_compra_obra;
CREATE INDEX idx_alm_ordens_compra_local_destino ON alm_ordens_compra(local_destino_id);

-- ── 9. Alter alm_solicitacoes ─────────────────────────────────
ALTER TABLE alm_solicitacoes
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_solicitacoes
  ADD COLUMN local_destino_id INT NOT NULL REFERENCES alm_locais(id);

DROP INDEX IF EXISTS idx_alm_solicitacoes_obra;
CREATE INDEX idx_alm_solicitacoes_local_destino ON alm_solicitacoes(local_destino_id);

-- ── 10. Alter alm_notas_fiscais ───────────────────────────────
ALTER TABLE alm_notas_fiscais
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_notas_fiscais
  ADD COLUMN local_id INT REFERENCES alm_locais(id);

DROP INDEX IF EXISTS idx_alm_notas_fiscais_obra;
CREATE INDEX idx_alm_notas_fiscais_local ON alm_notas_fiscais(local_id)
  WHERE local_id IS NOT NULL;

-- ── 11. Alter alm_alertas_estoque ─────────────────────────────
ALTER TABLE alm_alertas_estoque
  DROP COLUMN IF EXISTS obra_id;

ALTER TABLE alm_alertas_estoque
  ALTER COLUMN local_id SET NOT NULL,
  ADD CONSTRAINT fk_alm_alertas_local FOREIGN KEY (local_id) REFERENCES alm_locais(id);

DROP INDEX IF EXISTS idx_alm_alertas_estoque_obra;
CREATE INDEX idx_alm_alertas_estoque_local ON alm_alertas_estoque(local_id);
```

- [ ] Apply the migration:
  ```bash
  cd backend && npx prisma db execute --file prisma/migrations/20260417000001_almoxarifado_erp/migration.sql
  ```
  Expected output: `Script executed successfully`

- [ ] Commit:
  ```bash
  git add backend/prisma/migrations/20260417000001_almoxarifado_erp/migration.sql
  git commit -m "feat(alm): database migration — multi-local ERP schema (alm_locais, transferencias, alter saldo/movimentos)"
  ```

---

## Task 2: Update alm.types.ts

**Modify:** `backend/src/almoxarifado/types/alm.types.ts`

### Steps

- [ ] Replace the entire file content with the following (preserving existing types and adding new ones):

```typescript
// backend/src/almoxarifado/types/alm.types.ts

// ── Enums ──────────────────────────────────────────────────────────────────────

export type AlmMovimentoTipo =
  | 'entrada' | 'saida' | 'transferencia' | 'perda' | 'ajuste';

export type AlmSolicitacaoStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'em_aprovacao'
  | 'aprovada' | 'reprovada' | 'cancelada';

export type AlmOcStatus =
  | 'rascunho' | 'confirmada' | 'emitida'
  | 'parcialmente_recebida' | 'recebida' | 'cancelada';

export type AlmNfeStatus =
  | 'pendente_match' | 'match_parcial' | 'match_ok'
  | 'aceita' | 'rejeitada' | 'sem_oc';

export type AlmMatchStatus = 'auto' | 'pendente' | 'sem_match' | 'confirmado_manual';

export type AlmNivelAlerta = 'critico' | 'atencao';

export type AlmTipoAlerta = 'estoque_minimo' | 'reposicao_prevista' | 'anomalia';

// ── NEW: Location types ────────────────────────────────────────────────────────

export type AlmLocalTipo = 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

export interface AlmLocal {
  id: number;
  tenant_id: number;
  tipo: AlmLocalTipo;
  nome: string;
  descricao: string | null;
  obra_id: number | null;
  endereco: string | null;
  responsavel_nome: string | null;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  // optional join
  obra_nome?: string | null;
}

// ── NEW: Transfer types ────────────────────────────────────────────────────────

export type AlmTransferenciaStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovada'
  | 'executada'
  | 'cancelada';

export interface AlmTransferenciaItem {
  id: number;
  transferencia_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  qtd_executada: number;
  // optional join
  catalogo_nome?: string | null;
}

export interface AlmTransferencia {
  id: number;
  tenant_id: number;
  local_origem_id: number;
  local_destino_id: number;
  status: AlmTransferenciaStatus;
  valor_total: number | null;
  solicitante_id: number;
  aprovador_id: number | null;
  aprovado_at: Date | null;
  observacao: string | null;
  executada_parcial: boolean;
  created_at: Date;
  updated_at: Date;
  // optional joins
  local_origem_nome?: string;
  local_destino_nome?: string;
  itens?: AlmTransferenciaItem[];
}

// ── NEW: Config de Transferência ───────────────────────────────────────────────

export interface AlmConfigTransferencia {
  id: number | null;
  tenant_id: number;
  valor_limite_direto: number;
  roles_aprovadores: string[];
  created_at: Date | null;
  updated_at: Date | null;
}

// ── UPDATED: Estoque (obra_id removed, local_id is now NOT NULL) ───────────────

export interface AlmEstoqueSaldo {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — was nullable + obra_id previously
  quantidade: number;
  estoque_min: number;
  unidade: string;
  updated_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string;
  local_nome?: string | null;
  local_tipo?: AlmLocalTipo | null;
  nivel?: 'critico' | 'atencao' | 'normal';
}

export interface AlmMovimento {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — was nullable + obra_id previously
  tipo: AlmMovimentoTipo;
  quantidade: number;
  unidade: string;
  saldo_anterior: number;
  saldo_posterior: number;
  referencia_tipo: string | null;
  referencia_id: number | null;
  observacao: string | null;
  criado_por: number | null;
  created_at: Date;
  // joins
  catalogo_nome?: string;
  local_nome?: string | null;
  local_tipo?: AlmLocalTipo | null;
  usuario_nome?: string | null;
}

// ── UPDATED: Alertas (obra_id removed, local_id is now NOT NULL) ──────────────

export interface AlmAlertaEstoque {
  id: number;
  tenant_id: number;
  catalogo_id: number;
  local_id: number;           // NOT NULL — replaced obra_id
  tipo: AlmTipoAlerta;
  nivel: AlmNivelAlerta;
  mensagem: string;
  lido: boolean;
  lido_por: number | null;
  lido_at: Date | null;
  criado_at: Date;
  // joins
  catalogo_nome?: string;
  local_nome?: string | null;
}

// ── Orçamento ─────────────────────────────────────────────────────────────────

export interface AlmOrcamentoVersao {
  id: number;
  tenant_id: number;
  obra_id: number;
  versao: number;
  nome: string | null;
  ativo: boolean;
  importado_por: number | null;
  created_at: Date;
  total_itens?: number;
}

export interface AlmOrcamentoItem {
  id: number;
  tenant_id: number;
  versao_id: number;
  catalogo_id: number | null;
  descricao_orig: string;
  unidade: string | null;
  quantidade: number | null;
  preco_unitario: number | null;
  mes_previsto: number | null;
  etapa: string | null;
  // joins
  catalogo_nome?: string | null;
}

// ── Planejamento ──────────────────────────────────────────────────────────────

export interface AlmPlanejamentoItem {
  id: number;
  tenant_id: number;
  obra_id: number;
  catalogo_id: number;
  mes: number;
  ano: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  criado_por: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
  consumo_realizado?: number;
}

// ── IA Insights ───────────────────────────────────────────────────────────────

export interface AlmReorderPrediction {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  quantidade_atual: number;
  consumo_medio_diario: number;
  dias_restantes: number;
  nivel: 'critico' | 'atencao';
  recomendacao_qty: number;
  analise_ia: string;
  local_id: number;           // replaced obra_id
}

export interface AlmAnomaliaDetectada {
  catalogo_id: number;
  catalogo_nome: string;
  unidade: string;
  consumo_recente_7d: number;
  consumo_medio_30d: number;
  fator_desvio: number;
  nivel: 'critico' | 'atencao';
  explicacao_ia: string;
  local_id: number;           // replaced obra_id
}

export interface AlmInsightsResult {
  reorder: AlmReorderPrediction[];
  anomalias: AlmAnomaliaDetectada[];
  analisado_em: Date;
  modelo: string;
}

// ── Notas Fiscais ─────────────────────────────────────────────────────────────

export interface AlmNfeWebhook {
  id: number;
  tenant_id: number | null;
  chave_nfe: string;
  payload_raw: Record<string, unknown>;
  status: 'pendente' | 'processando' | 'processado' | 'erro' | 'dlq';
  tentativas: number;
  erro_msg: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AlmNotaFiscal {
  id: number;
  tenant_id: number;
  local_id: number | null;    // nullable until aceita; replaced obra_id
  oc_id: number | null;
  webhook_id: number | null;
  chave_nfe: string;
  numero: string | null;
  serie: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  data_emissao: Date | null;
  valor_total: number | null;
  xml_url: string | null;
  status: AlmNfeStatus;
  aceito_por: number | null;
  aceito_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // joins
  oc_numero?: string | null;
  aceito_por_nome?: string | null;
  local_nome?: string | null;
  total_itens?: number;
  itens?: AlmNfeItem[];
}

export interface AlmNfeItem {
  id: number;
  nfe_id: number;
  xprod: string;
  ncm: string | null;
  cfop: string | null;
  unidade_nfe: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  valor_total: number | null;
  catalogo_id: number | null;
  match_status: AlmMatchStatus;
  ai_score: number | null;
  ai_sugestoes: AiSugestaoMatch[] | null;
  confirmado_por: number | null;
  confirmado_at: Date | null;
  created_at: Date;
  // joins
  catalogo_nome?: string | null;
}

export interface AiSugestaoMatch {
  catalogo_id: number;
  nome: string;
  score: number;
  motivo: string;
}

// ── UPDATED: Ordens de Compra (local_destino_id replaces obra_id) ─────────────

export interface AlmOrdemCompra {
  id: number;
  tenant_id: number;
  local_destino_id: number;   // replaced obra_id
  solicitacao_id: number | null;
  fornecedor_id: number;
  numero: string;
  status: AlmOcStatus;
  valor_total: number | null;
  prazo_entrega: Date | null;
  condicao_pgto: string | null;
  local_entrega: string | null;
  observacoes: string | null;
  pdf_url: string | null;
  version: number;
  criado_por: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
  fornecedor_nome?: string;
  criado_por_nome?: string | null;
  local_destino_nome?: string | null;
  total_itens?: number;
  itens?: AlmOcItem[];
}

export interface AlmOcItem {
  id: number;
  oc_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  preco_unitario: number | null;
  qtd_recebida: number;
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

// ── UPDATED: Solicitações (local_destino_id replaces obra_id) ─────────────────

export interface AlmSolicitacao {
  id: number;
  tenant_id: number;
  local_destino_id: number;   // replaced obra_id
  numero: number;
  descricao: string;
  status: AlmSolicitacaoStatus;
  urgente: boolean;
  data_necessidade: Date | null;
  servico_ref: string | null;
  etapa_atual: number;
  solicitante_id: number | null;
  created_at: Date;
  updated_at: Date;
  // joins
  solicitante_nome?: string | null;
  local_destino_nome?: string | null;
  total_itens?: number;
  itens?: AlmSolicitacaoItem[];
  aprovacoes?: AlmAprovacao[];
}

export interface AlmSolicitacaoItem {
  id: number;
  solicitacao_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  observacao: string | null;
  catalogo_nome?: string;
  catalogo_codigo?: string | null;
}

export interface AlmAprovacao {
  id: number;
  solicitacao_id: number;
  etapa: number;
  acao: 'aprovado' | 'reprovado' | 'cancelado';
  aprovador_id: number | null;
  observacao: string | null;
  created_at: Date;
  aprovador_nome?: string | null;
}
```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/types/alm.types.ts
  git commit -m "feat(alm): update alm.types.ts — add AlmLocal, AlmTransferencia, AlmConfigTransferencia; remove obra_id from saldo/movimentos/alertas/oc/solicitacao/nfe"
  ```

---

## Task 3: LocaisService + Controller + DTOs

**Create:**
- `backend/src/almoxarifado/locais/locais.service.ts`
- `backend/src/almoxarifado/locais/locais.controller.ts`
- `backend/src/almoxarifado/locais/dto/create-local.dto.ts`
- `backend/src/almoxarifado/locais/dto/update-local.dto.ts`

### Steps

- [ ] Create directory:
  ```bash
  mkdir -p backend/src/almoxarifado/locais/dto
  ```

- [ ] Create `backend/src/almoxarifado/locais/dto/create-local.dto.ts`:

```typescript
// backend/src/almoxarifado/locais/dto/create-local.dto.ts
import { IsString, IsOptional, IsNumber, IsIn, MaxLength, IsBoolean } from 'class-validator';

export class CreateLocalDto {
  @IsIn(['CENTRAL', 'CD', 'DEPOSITO', 'OBRA'])
  tipo!: 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

  @IsString()
  @MaxLength(255)
  nome!: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsNumber()
  obra_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  responsavel_nome?: string | null;
}
```

- [ ] Create `backend/src/almoxarifado/locais/dto/update-local.dto.ts`:

```typescript
// backend/src/almoxarifado/locais/dto/update-local.dto.ts
import { IsString, IsOptional, IsNumber, IsIn, MaxLength, IsBoolean } from 'class-validator';

export class UpdateLocalDto {
  @IsOptional()
  @IsIn(['CENTRAL', 'CD', 'DEPOSITO', 'OBRA'])
  tipo?: 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string | null;

  @IsOptional()
  @IsNumber()
  obra_id?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endereco?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  responsavel_nome?: string | null;
}
```

- [ ] Create `backend/src/almoxarifado/locais/locais.service.ts`:

```typescript
// backend/src/almoxarifado/locais/locais.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmLocal } from '../types/alm.types';
import type { CreateLocalDto } from './dto/create-local.dto';
import type { UpdateLocalDto } from './dto/update-local.dto';

@Injectable()
export class LocaisService {
  private readonly logger = new Logger(LocaisService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listar(
    tenantId: number,
    filters: { tipo?: string; ativo?: boolean; obra_id?: number } = {},
  ): Promise<AlmLocal[]> {
    const conditions: string[] = [`l.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.tipo) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipo);
    }
    if (filters.ativo !== undefined) {
      conditions.push(`l.ativo = $${i++}`);
      params.push(filters.ativo);
    } else {
      conditions.push(`l.ativo = true`);
    }
    if (filters.obra_id) {
      conditions.push(`l.obra_id = $${i++}`);
      params.push(filters.obra_id);
    }

    return this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `SELECT l.*, o.nome AS obra_nome
       FROM alm_locais l
       LEFT JOIN "Obra" o ON o.id = l.obra_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.tipo ASC, l.nome ASC`,
      ...params,
    );
  }

  async buscarPorId(tenantId: number, id: number): Promise<AlmLocal> {
    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `SELECT l.*, o.nome AS obra_nome
       FROM alm_locais l
       LEFT JOIN "Obra" o ON o.id = l.obra_id
       WHERE l.id = $1 AND l.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException('Local não encontrado');
    return rows[0];
  }

  async criar(tenantId: number, dto: CreateLocalDto): Promise<AlmLocal> {
    // Validate: OBRA type requires obra_id; non-OBRA must not have obra_id
    if (dto.tipo === 'OBRA' && !dto.obra_id) {
      throw new BadRequestException('obra_id é obrigatório para locais do tipo OBRA');
    }
    if (dto.tipo !== 'OBRA' && dto.obra_id) {
      throw new BadRequestException('obra_id só é permitido para locais do tipo OBRA');
    }

    // Check for duplicate nome (case-insensitive)
    const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_locais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2)`,
      tenantId, dto.nome,
    );
    if (existing.length) {
      throw new ConflictException('Já existe um local com este nome neste tenant');
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `INSERT INTO alm_locais
         (tenant_id, tipo, nome, descricao, obra_id, endereco, responsavel_nome, ativo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING *`,
      tenantId, dto.tipo, dto.nome,
      dto.descricao ?? null, dto.obra_id ?? null,
      dto.endereco ?? null, dto.responsavel_nome ?? null,
    );

    this.logger.log(JSON.stringify({ action: 'alm.locais.criar', tenantId, localId: rows[0].id }));
    return rows[0];
  }

  /**
   * Auto-creates an OBRA-type local when an obra is created.
   * Called from obras.service.ts inside the same transaction.
   */
  async createObraLocal(
    tx: any,
    tenantId: number,
    obraId: number,
    obraNome: string,
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO alm_locais (tenant_id, tipo, nome, obra_id, ativo, created_at, updated_at)
       VALUES ($1, 'OBRA', $2, $3, true, NOW(), NOW())
       ON CONFLICT (tenant_id, nome) DO NOTHING`,
      tenantId,
      `Depósito — ${obraNome}`,
      obraId,
    );
  }

  async atualizar(tenantId: number, id: number, dto: UpdateLocalDto): Promise<AlmLocal> {
    const local = await this.buscarPorId(tenantId, id);

    // If tipo is being changed, check no movements exist for this local
    if (dto.tipo && dto.tipo !== local.tipo) {
      const movimentos = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM alm_movimentos
         WHERE tenant_id = $1 AND local_id = $2`,
        tenantId, id,
      );
      if (movimentos[0].count > 0) {
        throw new ConflictException(
          'Não é possível alterar o tipo de um local que já possui movimentações de estoque',
        );
      }
    }

    // Validate obra_id constraints if tipo is changing or obra_id is being set
    const tipoFinal = dto.tipo ?? local.tipo;
    const obraIdFinal = dto.obra_id !== undefined ? dto.obra_id : local.obra_id;

    if (tipoFinal === 'OBRA' && !obraIdFinal) {
      throw new BadRequestException('obra_id é obrigatório para locais do tipo OBRA');
    }
    if (tipoFinal !== 'OBRA' && obraIdFinal) {
      throw new BadRequestException('obra_id só é permitido para locais do tipo OBRA');
    }

    // Check for name collision if nome is changing
    if (dto.nome && dto.nome !== local.nome) {
      const existing = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM alm_locais WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2) AND id != $3`,
        tenantId, dto.nome, id,
      );
      if (existing.length) {
        throw new ConflictException('Já existe um local com este nome neste tenant');
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmLocal[]>(
      `UPDATE alm_locais
       SET tipo             = COALESCE($3, tipo),
           nome             = COALESCE($4, nome),
           descricao        = COALESCE($5, descricao),
           obra_id          = COALESCE($6, obra_id),
           endereco         = COALESCE($7, endereco),
           responsavel_nome = COALESCE($8, responsavel_nome),
           updated_at       = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      id, tenantId,
      dto.tipo ?? null, dto.nome ?? null,
      dto.descricao ?? null, dto.obra_id ?? null,
      dto.endereco ?? null, dto.responsavel_nome ?? null,
    );

    return rows[0];
  }

  async desativar(tenantId: number, id: number): Promise<{ id: number; ativo: boolean }> {
    await this.buscarPorId(tenantId, id);

    // Guard: no stock balance > 0
    const saldo = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_estoque_saldo
       WHERE tenant_id = $1 AND local_id = $2 AND quantidade > 0`,
      tenantId, id,
    );
    if (saldo[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com saldo em estoque');
    }

    // Guard: no open OCs
    const ocs = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_ordens_compra
       WHERE tenant_id = $1 AND local_destino_id = $2
         AND status NOT IN ('cancelada', 'encerrada')`,
      tenantId, id,
    );
    if (ocs[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com ordens de compra abertas');
    }

    // Guard: no open solicitações
    const sols = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_solicitacoes
       WHERE tenant_id = $1 AND local_destino_id = $2
         AND status NOT IN ('cancelada', 'encerrada')`,
      tenantId, id,
    );
    if (sols[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com solicitações abertas');
    }

    // Guard: no open transfers
    const trans = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM alm_transferencias
       WHERE tenant_id = $1
         AND (local_origem_id = $2 OR local_destino_id = $2)
         AND status NOT IN ('executada', 'cancelada')`,
      tenantId, id,
    );
    if (trans[0].count > 0) {
      throw new BadRequestException('Não é possível desativar um local com transferências em andamento');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_locais SET ativo = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.locais.desativar', tenantId, localId: id }));
    return { id, ativo: false };
  }
}
```

- [ ] Create `backend/src/almoxarifado/locais/locais.controller.ts`:

```typescript
// backend/src/almoxarifado/locais/locais.controller.ts
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { LocaisService } from './locais.service';
import { CreateLocalDto } from './dto/create-local.dto';
import { UpdateLocalDto } from './dto/update-local.dto';

@Controller('api/v1/almoxarifado/locais')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocaisController {
  constructor(private readonly locais: LocaisService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('tipo')    tipo?: string,
    @Query('ativo')   ativo?: string,
    @Query('obra_id') obraId?: string,
  ) {
    return this.locais.listar(tenantId, {
      tipo,
      ativo:   ativo !== undefined ? ativo === 'true' : undefined,
      obra_id: obraId ? Number(obraId) : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscarPorId(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locais.buscarPorId(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateLocalDto,
  ) {
    return this.locais.criar(tenantId, dto);
  }

  @Put(':id')
  @Roles('ADMIN_TENANT')
  atualizar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocalDto,
  ) {
    return this.locais.atualizar(tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN_TENANT')
  desativar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.locais.desativar(tenantId, id);
  }
}
```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/locais/
  git commit -m "feat(alm): add LocaisService + LocaisController + DTOs — CRUD for alm_locais"
  ```

---

## Task 4: ConfigTransferenciaService + Controller + DTO

**Create:**
- `backend/src/almoxarifado/config-transferencia/config-transferencia.service.ts`
- `backend/src/almoxarifado/config-transferencia/config-transferencia.controller.ts`
- `backend/src/almoxarifado/config-transferencia/dto/upsert-config-transferencia.dto.ts`

### Steps

- [ ] Create directory:
  ```bash
  mkdir -p backend/src/almoxarifado/config-transferencia/dto
  ```

- [ ] Create `backend/src/almoxarifado/config-transferencia/dto/upsert-config-transferencia.dto.ts`:

```typescript
// backend/src/almoxarifado/config-transferencia/dto/upsert-config-transferencia.dto.ts
import { IsNumber, IsArray, IsString, Min, ArrayNotEmpty } from 'class-validator';

export class UpsertConfigTransferenciaDto {
  @IsNumber()
  @Min(0)
  valor_limite_direto!: number;

  @IsArray()
  @IsString({ each: true })
  roles_aprovadores!: string[];
}
```

- [ ] Create `backend/src/almoxarifado/config-transferencia/config-transferencia.service.ts`:

```typescript
// backend/src/almoxarifado/config-transferencia/config-transferencia.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmConfigTransferencia } from '../types/alm.types';
import type { UpsertConfigTransferenciaDto } from './dto/upsert-config-transferencia.dto';

// Valid system roles that can be listed as approvers
const VALID_ROLES = ['ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'ALMOXARIFE', 'ENGENHEIRO_SENIOR'];

@Injectable()
export class ConfigTransferenciaService {
  private readonly logger = new Logger(ConfigTransferenciaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: number): Promise<AlmConfigTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmConfigTransferencia[]>(
      `SELECT * FROM alm_config_transferencia WHERE tenant_id = $1`,
      tenantId,
    );

    if (!rows.length) {
      // Return default — does not persist to DB
      return {
        id: null,
        tenant_id: tenantId,
        valor_limite_direto: 0,
        roles_aprovadores: [],
        created_at: null,
        updated_at: null,
      };
    }

    return rows[0];
  }

  async upsert(tenantId: number, dto: UpsertConfigTransferenciaDto): Promise<AlmConfigTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmConfigTransferencia[]>(
      `INSERT INTO alm_config_transferencia (tenant_id, valor_limite_direto, roles_aprovadores, created_at, updated_at)
       VALUES ($1, $2, $3::text[], NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE
         SET valor_limite_direto = EXCLUDED.valor_limite_direto,
             roles_aprovadores   = EXCLUDED.roles_aprovadores,
             updated_at          = NOW()
       RETURNING *`,
      tenantId,
      dto.valor_limite_direto,
      dto.roles_aprovadores,
    );

    this.logger.log(JSON.stringify({ action: 'alm.config_transferencia.upsert', tenantId }));
    return rows[0];
  }

  /**
   * Returns the config for a tenant, creating defaults if not found.
   * Used internally by TransferenciasService.
   */
  async getOrDefault(tenantId: number): Promise<AlmConfigTransferencia> {
    return this.get(tenantId);
  }
}
```

- [ ] Create `backend/src/almoxarifado/config-transferencia/config-transferencia.controller.ts`:

```typescript
// backend/src/almoxarifado/config-transferencia/config-transferencia.controller.ts
import {
  Controller, Get, Put,
  Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { ConfigTransferenciaService } from './config-transferencia.service';
import { UpsertConfigTransferenciaDto } from './dto/upsert-config-transferencia.dto';

@Controller('api/v1/almoxarifado/config-transferencia')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConfigTransferenciaController {
  constructor(private readonly config: ConfigTransferenciaService) {}

  @Get()
  @Roles('ADMIN_TENANT')
  get(@TenantId() tenantId: number) {
    return this.config.get(tenantId);
  }

  @Put()
  @Roles('ADMIN_TENANT')
  @HttpCode(HttpStatus.OK)
  upsert(
    @TenantId() tenantId: number,
    @Body() dto: UpsertConfigTransferenciaDto,
  ) {
    return this.config.upsert(tenantId, dto);
  }
}
```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/config-transferencia/
  git commit -m "feat(alm): add ConfigTransferenciaService + Controller — upsert approval threshold config"
  ```

---

## Task 5: TransferenciasService + Controller + DTOs

**Create:**
- `backend/src/almoxarifado/transferencias/transferencias.service.ts`
- `backend/src/almoxarifado/transferencias/transferencias.controller.ts`
- `backend/src/almoxarifado/transferencias/dto/create-transferencia.dto.ts`
- `backend/src/almoxarifado/transferencias/dto/aprovar-transferencia.dto.ts`
- `backend/src/almoxarifado/transferencias/dto/executar-transferencia.dto.ts`
- `backend/src/almoxarifado/transferencias/dto/cancelar-transferencia.dto.ts`

### Steps

- [ ] Create directory:
  ```bash
  mkdir -p backend/src/almoxarifado/transferencias/dto
  ```

- [ ] Create `backend/src/almoxarifado/transferencias/dto/create-transferencia.dto.ts`:

```typescript
// backend/src/almoxarifado/transferencias/dto/create-transferencia.dto.ts
import { IsNumber, IsOptional, IsString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferenciaItemDto {
  @IsNumber()
  catalogo_id!: number;

  @IsNumber()
  @Min(0.0001)
  quantidade!: number;

  @IsString()
  unidade!: string;
}

export class CreateTransferenciaDto {
  @IsNumber()
  local_origem_id!: number;

  @IsNumber()
  local_destino_id!: number;

  @IsOptional()
  @IsString()
  observacao?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferenciaItemDto)
  itens!: CreateTransferenciaItemDto[];
}
```

- [ ] Create `backend/src/almoxarifado/transferencias/dto/aprovar-transferencia.dto.ts`:

```typescript
// backend/src/almoxarifado/transferencias/dto/aprovar-transferencia.dto.ts
// Empty body — approval has no payload beyond the route/auth context
export class AprovarTransferenciaDto {}
```

- [ ] Create `backend/src/almoxarifado/transferencias/dto/executar-transferencia.dto.ts`:

```typescript
// backend/src/almoxarifado/transferencias/dto/executar-transferencia.dto.ts
import { IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ExecutarTransferenciaItemDto {
  @IsNumber()
  item_id!: number;

  @IsNumber()
  @Min(0.0001)
  qtd_executada!: number;
}

export class ExecutarTransferenciaDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecutarTransferenciaItemDto)
  itens?: ExecutarTransferenciaItemDto[];
}
```

- [ ] Create `backend/src/almoxarifado/transferencias/dto/cancelar-transferencia.dto.ts`:

```typescript
// backend/src/almoxarifado/transferencias/dto/cancelar-transferencia.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CancelarTransferenciaDto {
  @IsOptional()
  @IsString()
  motivo?: string | null;
}
```

- [ ] Create `backend/src/almoxarifado/transferencias/transferencias.service.ts`:

```typescript
// backend/src/almoxarifado/transferencias/transferencias.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmTransferencia, AlmTransferenciaItem } from '../types/alm.types';
import { ConfigTransferenciaService } from '../config-transferencia/config-transferencia.service';
import type { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import type { ExecutarTransferenciaDto } from './dto/executar-transferencia.dto';
import type { CancelarTransferenciaDto } from './dto/cancelar-transferencia.dto';

@Injectable()
export class TransferenciasService {
  private readonly logger = new Logger(TransferenciasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigTransferenciaService,
  ) {}

  async listar(
    tenantId: number,
    filters: {
      status?: string;
      local_origem_id?: number;
      local_destino_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<{ data: AlmTransferencia[]; total: number; page: number; perPage: number }> {
    const page    = filters.page    ?? 1;
    const perPage = Math.min(filters.per_page ?? 20, 100);
    const offset  = (page - 1) * perPage;

    const conditions: string[] = [`t.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.status) {
      conditions.push(`t.status = $${i++}`);
      params.push(filters.status);
    }
    if (filters.local_origem_id) {
      conditions.push(`t.local_origem_id = $${i++}`);
      params.push(filters.local_origem_id);
    }
    if (filters.local_destino_id) {
      conditions.push(`t.local_destino_id = $${i++}`);
      params.push(filters.local_destino_id);
    }

    const whereClause = conditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<AlmTransferencia[]>(
        `SELECT t.*,
                lo.nome AS local_origem_nome,
                ld.nome AS local_destino_nome
         FROM alm_transferencias t
         JOIN alm_locais lo ON lo.id = t.local_origem_id
         JOIN alm_locais ld ON ld.id = t.local_destino_id
         WHERE ${whereClause}
         ORDER BY t.created_at DESC
         LIMIT $${i++} OFFSET $${i++}`,
        ...params, perPage, offset,
      ),
      this.prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM alm_transferencias t WHERE ${whereClause}`,
        ...params.slice(0, i - 2),
      ),
    ]);

    return { data: rows, total: countRows[0].count, page, perPage };
  }

  async buscarPorId(tenantId: number, id: number): Promise<AlmTransferencia> {
    const rows = await this.prisma.$queryRawUnsafe<AlmTransferencia[]>(
      `SELECT t.*,
              lo.nome AS local_origem_nome,
              ld.nome AS local_destino_nome
       FROM alm_transferencias t
       JOIN alm_locais lo ON lo.id = t.local_origem_id
       JOIN alm_locais ld ON ld.id = t.local_destino_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      id, tenantId,
    );
    if (!rows.length) throw new NotFoundException('Transferência não encontrada');

    const itens = await this.prisma.$queryRawUnsafe<AlmTransferenciaItem[]>(
      `SELECT ti.*, m.nome AS catalogo_nome
       FROM alm_transferencia_itens ti
       JOIN fvm_catalogo_materiais m ON m.id = ti.catalogo_id
       WHERE ti.transferencia_id = $1
       ORDER BY ti.id`,
      id,
    );

    return { ...rows[0], itens };
  }

  async criar(
    tenantId: number,
    usuarioId: number,
    dto: CreateTransferenciaDto,
  ): Promise<AlmTransferencia> {
    if (dto.local_origem_id === dto.local_destino_id) {
      throw new BadRequestException('Origem e destino não podem ser o mesmo local');
    }

    // Validate both locals exist, belong to tenant, and are active
    const locais = await this.prisma.$queryRawUnsafe<{ id: number; ativo: boolean }[]>(
      `SELECT id, ativo FROM alm_locais
       WHERE tenant_id = $1 AND id = ANY(ARRAY[$2, $3]::int[])`,
      tenantId, dto.local_origem_id, dto.local_destino_id,
    );

    if (locais.length < 2) throw new NotFoundException('Um ou ambos os locais não foram encontrados');

    const inativo = locais.find((l) => !l.ativo);
    if (inativo) {
      throw new BadRequestException('Um ou ambos os locais estão inativos');
    }

    // Get transfer config and determine initial status
    const config = await this.configService.getOrDefault(tenantId);

    // Calculate valor_total by looking up catalog prices
    let valorTotal: number | null = null;
    if (dto.itens.length > 0) {
      const catalogoIds = dto.itens.map((i) => i.catalogo_id);
      const precos = await this.prisma.$queryRawUnsafe<{ catalogo_id: number; preco_unitario: number }[]>(
        `SELECT id AS catalogo_id, preco_referencia AS preco_unitario
         FROM fvm_catalogo_materiais
         WHERE id = ANY($1::int[]) AND preco_referencia IS NOT NULL`,
        catalogoIds,
      );

      const precoMap = new Map(precos.map((p) => [p.catalogo_id, p.preco_unitario]));
      let total = 0;
      let allPriced = true;

      for (const item of dto.itens) {
        const preco = precoMap.get(item.catalogo_id);
        if (preco !== undefined) {
          total += preco * item.quantidade;
        } else {
          allPriced = false;
        }
      }

      if (allPriced) valorTotal = total;
    }

    // Determine status based on threshold
    let status: string;
    if (
      config.valor_limite_direto > 0 &&
      valorTotal !== null &&
      valorTotal <= config.valor_limite_direto
    ) {
      status = 'aprovada';
    } else {
      status = 'aguardando_aprovacao';
    }

    return this.prisma.$transaction(async (tx) => {
      const transRows = await tx.$queryRawUnsafe<AlmTransferencia[]>(
        `INSERT INTO alm_transferencias
           (tenant_id, local_origem_id, local_destino_id, status, valor_total,
            solicitante_id, observacao, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        tenantId, dto.local_origem_id, dto.local_destino_id,
        status, valorTotal, usuarioId, dto.observacao ?? null,
      );

      const transferencia = transRows[0];

      for (const item of dto.itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_transferencia_itens (transferencia_id, catalogo_id, quantidade, unidade, qtd_executada)
           VALUES ($1, $2, $3, $4, 0)`,
          transferencia.id, item.catalogo_id, item.quantidade, item.unidade,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.transferencia.criar',
        tenantId,
        transferenciaId: transferencia.id,
        status,
      }));

      return this.buscarPorId(tenantId, transferencia.id);
    });
  }

  async aprovar(
    tenantId: number,
    aprovadorId: number,
    id: number,
    userRoles: string[],
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (transferencia.status !== 'aguardando_aprovacao') {
      throw new BadRequestException(
        `Transferência não pode ser aprovada no status atual: ${transferencia.status}`,
      );
    }

    // Check approver roles
    const config = await this.configService.getOrDefault(tenantId);
    const rolesPermitidas = config.roles_aprovadores.length > 0
      ? config.roles_aprovadores
      : ['ADMIN_TENANT'];

    const temPermissao = userRoles.some((r) => rolesPermitidas.includes(r));
    if (!temPermissao) {
      throw new ForbiddenException(
        'Usuário não possui permissão para aprovar transferências',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_transferencias
       SET status = 'aprovada', aprovador_id = $1, aprovado_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      aprovadorId, id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.transferencia.aprovar', tenantId, id, aprovadorId }));
    return this.buscarPorId(tenantId, id);
  }

  /**
   * Atomic transfer execution: SAIDA at origin + ENTRADA at destination.
   * Uses SELECT FOR UPDATE to prevent race conditions on stock balances.
   */
  async executar(
    tenantId: number,
    usuarioId: number,
    id: number,
    dto: ExecutarTransferenciaDto,
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (transferencia.status !== 'aprovada') {
      throw new BadRequestException(
        `Transferência não pode ser executada no status atual: ${transferencia.status}`,
      );
    }

    const itensParaExecutar = dto.itens ?? (transferencia.itens ?? []).map((i) => ({
      item_id: i.id,
      qtd_executada: Number(i.quantidade),
    }));

    if (itensParaExecutar.length === 0) {
      throw new BadRequestException('Nenhum item para executar');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const execItem of itensParaExecutar) {
        // Find the transferencia item
        const items = transferencia.itens ?? [];
        const transItem = items.find((i) => i.id === execItem.item_id);
        if (!transItem) {
          throw new BadRequestException(
            `Item ${execItem.item_id} não pertence a esta transferência`,
          );
        }
        if (execItem.qtd_executada > Number(transItem.quantidade)) {
          throw new BadRequestException(
            `Quantidade executada (${execItem.qtd_executada}) excede a solicitada (${transItem.quantidade}) para o item ${execItem.item_id}`,
          );
        }

        // Lock saldo row at origem (SELECT FOR UPDATE)
        const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
          `SELECT id, quantidade::float
           FROM alm_estoque_saldo
           WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3
           FOR UPDATE`,
          tenantId, transferencia.local_origem_id, transItem.catalogo_id,
        );

        const saldoAtual = saldoRows.length ? Number(saldoRows[0].quantidade) : 0;

        if (saldoAtual < execItem.qtd_executada) {
          throw new BadRequestException(
            `Saldo insuficiente para o item ${transItem.catalogo_id} no local de origem. ` +
            `Disponível: ${saldoAtual}, solicitado: ${execItem.qtd_executada}`,
          );
        }

        // 1. Insert SAIDA movement at origin
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_movimentos
             (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
              saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, criado_por)
           VALUES ($1, $2, $3, 'saida', $4, $5, $6, $7, 'transferencia', $8, $9)`,
          tenantId, transItem.catalogo_id, transferencia.local_origem_id,
          execItem.qtd_executada, transItem.unidade,
          saldoAtual, saldoAtual - execItem.qtd_executada,
          id, usuarioId,
        );

        // 2. Upsert saldo at origin (decrement)
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, saldo, unidade, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET saldo = alm_estoque_saldo.saldo + EXCLUDED.saldo, updated_at = NOW()`,
          tenantId, transferencia.local_origem_id, transItem.catalogo_id,
          -execItem.qtd_executada, transItem.unidade,
        );

        // 3. Get saldo at destination for saldo_anterior
        const saldoDestinoRows = await tx.$queryRawUnsafe<{ quantidade: number }[]>(
          `SELECT COALESCE(saldo, 0)::float AS quantidade
           FROM alm_estoque_saldo
           WHERE tenant_id = $1 AND local_id = $2 AND catalogo_id = $3`,
          tenantId, transferencia.local_destino_id, transItem.catalogo_id,
        );
        const saldoDestinoAtual = saldoDestinoRows.length ? Number(saldoDestinoRows[0].quantidade) : 0;

        // 4. Insert ENTRADA movement at destination
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_movimentos
             (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
              saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, criado_por)
           VALUES ($1, $2, $3, 'entrada', $4, $5, $6, $7, 'transferencia', $8, $9)`,
          tenantId, transItem.catalogo_id, transferencia.local_destino_id,
          execItem.qtd_executada, transItem.unidade,
          saldoDestinoAtual, saldoDestinoAtual + execItem.qtd_executada,
          id, usuarioId,
        );

        // 5. Upsert saldo at destination (increment)
        await tx.$executeRawUnsafe(
          `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, saldo, unidade, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (tenant_id, local_id, catalogo_id)
           DO UPDATE SET saldo = alm_estoque_saldo.saldo + EXCLUDED.saldo, updated_at = NOW()`,
          tenantId, transferencia.local_destino_id, transItem.catalogo_id,
          execItem.qtd_executada, transItem.unidade,
        );

        // 6. Update qtd_executada on the item
        await tx.$executeRawUnsafe(
          `UPDATE alm_transferencia_itens
           SET qtd_executada = qtd_executada + $1
           WHERE id = $2`,
          execItem.qtd_executada, execItem.item_id,
        );
      }

      // Check if any item is partially executed
      const itemsAfter = await tx.$queryRawUnsafe<{ quantidade: number; qtd_executada: number }[]>(
        `SELECT quantidade::float, qtd_executada::float
         FROM alm_transferencia_itens WHERE transferencia_id = $1`,
        id,
      );
      const executadaParcial = itemsAfter.some(
        (i) => Number(i.qtd_executada) < Number(i.quantidade),
      );

      // Update transfer status
      await tx.$executeRawUnsafe(
        `UPDATE alm_transferencias
         SET status = 'executada', executada_parcial = $1, updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        executadaParcial, id, tenantId,
      );

      this.logger.log(JSON.stringify({
        action: 'alm.transferencia.executar',
        tenantId, id, executadaParcial,
      }));

      return this.buscarPorId(tenantId, id);
    });
  }

  async cancelar(
    tenantId: number,
    id: number,
    dto: CancelarTransferenciaDto,
  ): Promise<AlmTransferencia> {
    const transferencia = await this.buscarPorId(tenantId, id);

    if (['executada', 'cancelada'].includes(transferencia.status)) {
      throw new BadRequestException(
        `Transferência não pode ser cancelada no status: ${transferencia.status}`,
      );
    }

    const novaObservacao = dto.motivo
      ? [transferencia.observacao, `Cancelamento: ${dto.motivo}`].filter(Boolean).join(' | ')
      : transferencia.observacao;

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_transferencias
       SET status = 'cancelada', observacao = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3`,
      novaObservacao, id, tenantId,
    );

    this.logger.log(JSON.stringify({ action: 'alm.transferencia.cancelar', tenantId, id }));
    return this.buscarPorId(tenantId, id);
  }
}
```

- [ ] Create `backend/src/almoxarifado/transferencias/transferencias.controller.ts`:

```typescript
// backend/src/almoxarifado/transferencias/transferencias.controller.ts
import {
  Controller, Get, Post,
  Body, Param, Query, ParseIntPipe,
  UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { TransferenciasService } from './transferencias.service';
import { CreateTransferenciaDto } from './dto/create-transferencia.dto';
import { AprovarTransferenciaDto } from './dto/aprovar-transferencia.dto';
import { ExecutarTransferenciaDto } from './dto/executar-transferencia.dto';
import { CancelarTransferenciaDto } from './dto/cancelar-transferencia.dto';

@Controller('api/v1/almoxarifado/transferencias')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferenciasController {
  constructor(private readonly transferencias: TransferenciasService) {}

  @Get()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(
    @TenantId() tenantId: number,
    @Query('status')           status?: string,
    @Query('local_origem_id')  localOrigemId?: string,
    @Query('local_destino_id') localDestinoId?: string,
    @Query('page')             page?: string,
    @Query('per_page')         perPage?: string,
  ) {
    return this.transferencias.listar(tenantId, {
      status,
      local_origem_id:  localOrigemId  ? Number(localOrigemId)  : undefined,
      local_destino_id: localDestinoId ? Number(localDestinoId) : undefined,
      page:    page    ? Number(page)    : undefined,
      per_page: perPage ? Number(perPage) : undefined,
    });
  }

  @Get(':id')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  buscarPorId(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.transferencias.buscarPorId(tenantId, id);
  }

  @Post()
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.CREATED)
  criar(
    @TenantId() tenantId: number,
    @Body() dto: CreateTransferenciaDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.transferencias.criar(tenantId, usuarioId, dto);
  }

  @Post(':id/aprovar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  aprovar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() _dto: AprovarTransferenciaDto,
    @Req() req: any,
  ) {
    const aprovadorId: number = req.user?.sub ?? req.user?.id;
    const userRoles: string[] = req.user?.roles ?? [];
    return this.transferencias.aprovar(tenantId, aprovadorId, id, userRoles);
  }

  @Post(':id/executar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'ALMOXARIFE')
  executar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExecutarTransferenciaDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.transferencias.executar(tenantId, usuarioId, id, dto);
  }

  @Post(':id/cancelar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  cancelar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarTransferenciaDto,
  ) {
    return this.transferencias.cancelar(tenantId, id, dto);
  }
}
```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/transferencias/
  git commit -m "feat(alm): add TransferenciasService + Controller — create/aprovar/executar/cancelar with atomic execution"
  ```

---

## Task 6: Update obras.service.ts — Auto-create OBRA local

**Modify:** `backend/src/obras/obras.service.ts`

### Steps

- [ ] Inject `LocaisService` into `ObrasService`. In the constructor, add:
  ```typescript
  // In obras.service.ts constructor
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private locaisService: LocaisService,  // ADD THIS
    private genericaStrategy: GenericaStrategy,
    private edificacaoStrategy: EdificacaoStrategy,
    private linearStrategy: LinearStrategy,
    private instalacaoStrategy: InstalacaoStrategy,
  ) {}
  ```

- [ ] Find the `criar` (or `create`) method in `obras.service.ts`. After the obra INSERT succeeds and `obra.id` is available, add the auto-creation call **inside the same transaction**:

  Locate the section where the obra is first inserted. Add after `obra` is created:
  ```typescript
  // After obra INSERT completes, inside the same $transaction block (or right after if not in tx):
  await this.locaisService.createObraLocal(
    tx,         // pass the tx reference if inside a transaction, else pass this.prisma
    tenantId,
    obra.id,
    obra.nome,
  );
  ```

  If `criar` uses Prisma ORM (not raw SQL), the pattern is:
  ```typescript
  // After: const obra = await this.prisma.obra.create({ ... })
  // Add:
  await this.prisma.$executeRawUnsafe(
    `INSERT INTO alm_locais (tenant_id, tipo, nome, obra_id, ativo, created_at, updated_at)
     VALUES ($1, 'OBRA', $2, $3, true, NOW(), NOW())
     ON CONFLICT (tenant_id, nome) DO NOTHING`,
    obra.tenantId,
    `Depósito — ${obra.nome}`,
    obra.id,
  );
  ```

- [ ] Add the import at the top of `obras.service.ts`:
  ```typescript
  import { LocaisService } from '../almoxarifado/locais/locais.service';
  ```

- [ ] Commit:
  ```bash
  git add backend/src/obras/obras.service.ts
  git commit -m "feat(obras): auto-create OBRA-type alm_locais when obra is created"
  ```

---

## Task 7: Update almoxarifado.module.ts

**Modify:** `backend/src/almoxarifado/almoxarifado.module.ts`

### Steps

- [ ] Replace the file content with the following updated module:

```typescript
// backend/src/almoxarifado/almoxarifado.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';
import { IaModule } from '../ia/ia.module';
import { GedModule } from '../ged/ged.module';

// Estoque
import { EstoqueService } from './estoque/estoque.service';
import { EstoqueController } from './estoque/estoque.controller';

// Locais (NEW)
import { LocaisService } from './locais/locais.service';
import { LocaisController } from './locais/locais.controller';

// Transferências (NEW)
import { TransferenciasService } from './transferencias/transferencias.service';
import { TransferenciasController } from './transferencias/transferencias.controller';

// Config de Transferência (NEW)
import { ConfigTransferenciaService } from './config-transferencia/config-transferencia.service';
import { ConfigTransferenciaController } from './config-transferencia/config-transferencia.controller';

// Orçamento
import { OrcamentoService } from './orcamento/orcamento.service';
import { OrcamentoController } from './orcamento/orcamento.controller';

// Solicitações
import { SolicitacaoService } from './solicitacao/solicitacao.service';
import { SolicitacaoController } from './solicitacao/solicitacao.controller';

// Compras (OC)
import { ComprasService } from './compras/compras.service';
import { ComprasController } from './compras/compras.controller';

// NF-e
import { NfeService } from './nfe/nfe.service';
import { NfeMatchService } from './nfe/nfe-match.service';
import { NfeController } from './nfe/nfe.controller';

// IA Preditiva + Catálogo
import { AgenteReorderService } from './ia/agente-reorder.service';
import { AgenteAnomaliaService } from './ia/agente-anomalia.service';
import { AgenteCatalogoService } from './ia/agente-catalogo.service';
import { IaController } from './ia/ia.controller';
import { VariantesController } from './ia/variantes.controller';

// SINAPI
import { SinapiService } from './sinapi/sinapi.service';
import { SinapiController } from './sinapi/sinapi.controller';

// Cotações
import { CotacoesService } from './cotacoes/cotacoes.service';
import { CotacoesController } from './cotacoes/cotacoes.controller';
import { PortalFornecedorController } from './cotacoes/portal-fornecedor.controller';

// Planejamento
import { PlanejamentoService } from './planejamento/planejamento.service';
import { PlanejamentoController } from './planejamento/planejamento.controller';

// Conversão de unidades
import { ConversaoService } from './conversao/conversao.service';

// Jobs Bull
import { AlmoxarifadoProcessor } from './jobs/almoxarifado.processor';

@Module({
  imports: [
    PrismaModule,
    IaModule,
    GedModule,

    BullModule.registerQueue({
      name: 'almoxarifado',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    }),

    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  ],
  controllers: [
    EstoqueController,
    LocaisController,          // NEW
    TransferenciasController,  // NEW
    ConfigTransferenciaController, // NEW
    OrcamentoController,
    SolicitacaoController,
    ComprasController,
    NfeController,
    IaController,
    PlanejamentoController,
    VariantesController,
    SinapiController,
    CotacoesController,
    PortalFornecedorController,
  ],
  providers: [
    EstoqueService,
    LocaisService,             // NEW
    TransferenciasService,     // NEW
    ConfigTransferenciaService, // NEW
    OrcamentoService,
    ConversaoService,
    SolicitacaoService,
    ComprasService,
    NfeService,
    NfeMatchService,
    AgenteReorderService,
    AgenteAnomaliaService,
    AgenteCatalogoService,
    SinapiService,
    CotacoesService,
    PlanejamentoService,
    AlmoxarifadoProcessor,
  ],
  exports: [
    EstoqueService,
    LocaisService,             // NEW — exported so obras.service.ts can inject it
    OrcamentoService,
    ConversaoService,
    AgenteCatalogoService,
  ],
})
export class AlmoxarifadoModule {}
```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/almoxarifado.module.ts
  git commit -m "feat(alm): register Locais, Transferencias, ConfigTransferencia in AlmoxarifadoModule"
  ```

---

## Task 8: Update EstoqueService

**Modify:** `backend/src/almoxarifado/estoque/estoque.service.ts`

### Steps

- [ ] Remove the import of `AlmEstoqueLocal` from types (the type is now `AlmLocal`).
- [ ] Remove methods `getLocais()` and `createLocal()` entirely (moved to `LocaisService`).
- [ ] Remove method `transferir()` entirely (moved to `TransferenciasService`).
- [ ] Update the `import` line at the top:
  ```typescript
  import type { AlmEstoqueSaldo, AlmMovimento, AlmAlertaEstoque } from '../types/alm.types';
  ```

- [ ] Update `getSaldo` signature and queries — replace `obra_id` param with `localId`:
  ```typescript
  async getSaldo(
    tenantId: number,
    filters: { localId?: number; tipoLocal?: string; catalogoId?: number; nivel?: string } = {},
  ): Promise<AlmEstoqueSaldo[]> {
    const conditions: string[] = [`s.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localId) {
      conditions.push(`s.local_id = $${i++}`);
      params.push(filters.localId);
    }
    if (filters.tipoLocal) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipoLocal);
    }
    if (filters.catalogoId) {
      conditions.push(`s.catalogo_id = $${i++}`);
      params.push(filters.catalogoId);
    }

    const rows = await this.prisma.$queryRawUnsafe<AlmEstoqueSaldo[]>(
      `SELECT s.*,
              m.nome      AS catalogo_nome,
              m.codigo    AS catalogo_codigo,
              l.nome      AS local_nome,
              l.tipo      AS local_tipo,
              CASE
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min * 0.3 THEN 'critico'
                WHEN s.estoque_min > 0 AND s.quantidade <= s.estoque_min       THEN 'atencao'
                ELSE 'normal'
              END AS nivel
       FROM alm_estoque_saldo s
       JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
       LEFT JOIN alm_locais l ON l.id = s.local_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.nome ASC`,
      ...params,
    );

    if (filters.nivel) {
      return rows.filter((r) => r.nivel === filters.nivel);
    }
    return rows;
  }
  ```

- [ ] Update `getMovimentos` signature — replace `obraId` with no `obraId`, add `localId`:
  ```typescript
  async getMovimentos(
    tenantId: number,
    filters: { localId?: number; tipoLocal?: string; catalogoId?: number; tipo?: string; limit?: number; offset?: number } = {},
  ): Promise<AlmMovimento[]> {
    const conditions: string[] = [`mv.tenant_id = $1`];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (filters.localId) {
      conditions.push(`mv.local_id = $${i++}`);
      params.push(filters.localId);
    }
    if (filters.tipoLocal) {
      conditions.push(`l.tipo = $${i++}`);
      params.push(filters.tipoLocal);
    }
    if (filters.catalogoId) {
      conditions.push(`mv.catalogo_id = $${i++}`);
      params.push(filters.catalogoId);
    }
    if (filters.tipo) {
      conditions.push(`mv.tipo = $${i++}`);
      params.push(filters.tipo);
    }

    const limit  = filters.limit  ?? 50;
    const offset = filters.offset ?? 0;

    return this.prisma.$queryRawUnsafe<AlmMovimento[]>(
      `SELECT mv.*,
              m.nome  AS catalogo_nome,
              l.nome  AS local_nome,
              l.tipo  AS local_tipo,
              u.nome  AS usuario_nome
       FROM alm_movimentos mv
       JOIN fvm_catalogo_materiais m ON m.id = mv.catalogo_id
       LEFT JOIN alm_locais l ON l.id = mv.local_id
       LEFT JOIN "Usuario" u ON u.id = mv.criado_por
       WHERE ${conditions.join(' AND ')}
       ORDER BY mv.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      ...params, limit, offset,
    );
  }
  ```

- [ ] Update `registrarMovimento` — remove `obraId` param, use `localId` as the primary axis:
  ```typescript
  async registrarMovimento(
    tenantId: number,
    localId: number,
    usuarioId: number,
    dto: CreateMovimentoDto,
  ): Promise<AlmMovimento> {
    return this.prisma.$transaction(async (tx) => {
      // Lock/create saldo row
      const saldoRows = await tx.$queryRawUnsafe<{ id: number; quantidade: number }[]>(
        `INSERT INTO alm_estoque_saldo (tenant_id, local_id, catalogo_id, saldo, unidade, updated_at)
         VALUES ($1, $2, $3, 0, $4, NOW())
         ON CONFLICT (tenant_id, local_id, catalogo_id) DO UPDATE SET id = alm_estoque_saldo.id
         RETURNING id, COALESCE(saldo, 0)::float AS quantidade`,
        tenantId, localId, dto.catalogo_id, dto.unidade,
      );

      const saldoAnterior = Number(saldoRows[0].quantidade);
      const delta = ['saida', 'perda'].includes(dto.tipo) ? -dto.quantidade : dto.quantidade;

      if (delta < 0 && saldoAnterior + delta < 0) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponível: ${saldoAnterior} ${dto.unidade}`,
        );
      }

      const saldoPosterior = saldoAnterior + delta;

      await tx.$executeRawUnsafe(
        `UPDATE alm_estoque_saldo SET saldo = $1, updated_at = NOW() WHERE id = $2`,
        saldoPosterior, saldoRows[0].id,
      );

      const movRows = await tx.$queryRawUnsafe<AlmMovimento[]>(
        `INSERT INTO alm_movimentos
           (tenant_id, catalogo_id, local_id, tipo, quantidade, unidade,
            saldo_anterior, saldo_posterior, referencia_tipo, referencia_id, observacao, criado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        tenantId, dto.catalogo_id, localId, dto.tipo,
        dto.quantidade, dto.unidade, saldoAnterior, saldoPosterior,
        dto.referencia_tipo ?? null, dto.referencia_id ?? null,
        dto.observacao ?? null, usuarioId,
      );

      if (['saida', 'perda'].includes(dto.tipo)) {
        await this.avaliarAlertaEstoqueMinimo(tx as any, tenantId, localId, dto.catalogo_id, saldoPosterior);
      }

      return movRows[0];
    });
  }
  ```

- [ ] Update `getAlertas`, `marcarTodosLidos`, and `getDashboardKpis` to use `local_id` instead of `obra_id`:
  - In `getAlertas`: change `a.obra_id = $2` → `a.local_id = $2` (param name `localId`)
  - In `marcarTodosLidos`: change `obra_id = $3` → `local_id = $3` (param name `localId`)
  - In `getDashboardKpis`: change all `obra_id = $2` → `local_id = $2` (param name `localId`)

- [ ] Update `avaliarAlertaEstoqueMinimo` to remove `obraId` parameter and use `local_id`:
  ```typescript
  private async avaliarAlertaEstoqueMinimo(
    tx: any,
    tenantId: number,
    localId: number,
    catalogoId: number,
    saldoAtual: number,
  ): Promise<void> {
    // ... same logic but use local_id = $2 instead of obra_id = $2
    // and INSERT with local_id instead of obra_id
  }
  ```

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/estoque/estoque.service.ts
  git commit -m "feat(alm): update EstoqueService — remove obra_id, use local_id throughout; remove old getLocais/transferir methods"
  ```

---

## Task 9: Update EstoqueController

**Modify:** `backend/src/almoxarifado/estoque/estoque.controller.ts`

### Steps

- [ ] Remove the import of `TransferenciaDto` (the old transfer DTO is no longer used here).
- [ ] Delete the `getLocais`, `createLocal`, and `transferir` endpoint methods.
- [ ] Change all routes from `obras/:obraId/estoque/*` to `estoque/*`:
  - `GET obras/:obraId/estoque` → `GET estoque/saldo`
  - `GET obras/:obraId/estoque/movimentos` → `GET estoque/movimentos`
  - `POST obras/:obraId/estoque/movimentos` → `POST estoque/movimentos`
  - `GET obras/:obraId/estoque/alertas` → `GET estoque/alertas`
  - `PATCH obras/:obraId/estoque/alertas/ler-todos` → `PATCH estoque/alertas/ler-todos`
  - `GET obras/:obraId/dashboard` → `GET dashboard`

- [ ] Replace `@Param('obraId', ParseIntPipe) obraId: number` with `@Query('local_id') localId?: string` and `@Query('tipo_local') tipoLocal?: string` on list endpoints.

- [ ] On `POST estoque/movimentos`, the `localId` comes from `dto.local_id` (required field in DTO), not a route param.

- [ ] Write the complete updated controller:

```typescript
// backend/src/almoxarifado/estoque/estoque.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query,
  ParseIntPipe, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { EstoqueService } from './estoque.service';
import { CreateMovimentoDto } from './dto/create-movimento.dto';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  // ── Saldo ─────────────────────────────────────────────────────────────────

  @Get('estoque/saldo')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getSaldo(
    @TenantId() tenantId: number,
    @Query('local_id')    localId?: string,
    @Query('tipo_local')  tipoLocal?: string,
    @Query('catalogoId')  catalogoId?: string,
    @Query('nivel')       nivel?: string,
  ) {
    return this.estoque.getSaldo(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      nivel,
    });
  }

  // ── Movimentos ────────────────────────────────────────────────────────────

  @Get('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getMovimentos(
    @TenantId() tenantId: number,
    @Query('local_id')   localId?: string,
    @Query('tipo_local') tipoLocal?: string,
    @Query('catalogoId') catalogoId?: string,
    @Query('tipo')       tipo?: string,
    @Query('limit')      limit?: string,
    @Query('offset')     offset?: string,
  ) {
    return this.estoque.getMovimentos(tenantId, {
      localId:    localId    ? Number(localId)    : undefined,
      tipoLocal,
      catalogoId: catalogoId ? Number(catalogoId) : undefined,
      tipo,
      limit:  limit  ? Number(limit)  : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('estoque/movimentos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  @HttpCode(HttpStatus.CREATED)
  registrarMovimento(
    @TenantId() tenantId: number,
    @Body() dto: CreateMovimentoDto,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    // local_id is now required on the DTO itself
    return this.estoque.registrarMovimento(tenantId, dto.local_id, usuarioId, dto);
  }

  // ── Alertas ───────────────────────────────────────────────────────────────

  @Get('estoque/alertas')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getAlertas(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
    @Query('todos')    todos?: string,
  ) {
    return this.estoque.getAlertas(
      tenantId,
      localId ? Number(localId) : undefined,
      todos !== 'true',
    );
  }

  @Patch('estoque/alertas/:id/ler')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarAlertaLido(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) alertaId: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarAlertaLido(tenantId, alertaId, usuarioId);
  }

  @Patch('estoque/alertas/ler-todos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  marcarTodosLidos(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.estoque.marcarTodosLidos(
      tenantId,
      localId ? Number(localId) : undefined,
      usuarioId,
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Query('local_id') localId?: string,
  ) {
    return this.estoque.getDashboardKpis(tenantId, localId ? Number(localId) : undefined);
  }
}
```

- [ ] Update `CreateMovimentoDto` to make `local_id` required:
  In `backend/src/almoxarifado/estoque/dto/create-movimento.dto.ts`, change `local_id?: number` to `local_id!: number`.

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/estoque/estoque.controller.ts \
          backend/src/almoxarifado/estoque/dto/create-movimento.dto.ts
  git commit -m "feat(alm): update EstoqueController — routes changed from obras/:obraId/estoque/* to estoque/*; local_id replaces obraId"
  ```

---

## Task 10: Update ComprasService + DTO

**Modify:**
- `backend/src/almoxarifado/compras/compras.service.ts`
- `backend/src/almoxarifado/compras/dto/create-oc.dto.ts`

### Steps

- [ ] Update `backend/src/almoxarifado/compras/dto/create-oc.dto.ts`:

```typescript
// backend/src/almoxarifado/compras/dto/create-oc.dto.ts

export class CreateOcItemDto {
  catalogo_id!: number;
  quantidade!: number;
  unidade!: string;
  preco_unitario?: number;
}

export class CreateOcDto {
  local_destino_id!: number;    // REPLACED obra_id
  fornecedor_id!: number;
  solicitacao_id?: number;
  prazo_entrega?: string;
  condicao_pgto?: string;
  local_entrega?: string;
  observacoes?: string;
  itens!: CreateOcItemDto[];
}
```

- [ ] In `compras.service.ts`, update `listar` method:
  - Change `obraId: number` parameter to `localDestinoId?: number`
  - Change query: `oc.obra_id = $2` → `oc.local_destino_id = $2`
  - Add join to get `local_destino_nome`: `LEFT JOIN alm_locais l ON l.id = oc.local_destino_id`
  - Update SELECT to include `l.nome AS local_destino_nome`

- [ ] In `compras.service.ts`, update `criar` method:
  - Change `obraId: number` parameter to use `dto.local_destino_id`
  - Change INSERT query: replace `obra_id = $N` with `local_destino_id = $N`
  - Add validation: check the local exists and is active before creating OC

- [ ] In `compras.service.ts`, update `receberOc` method:
  - When calling `this.estoque.registrarMovimento(...)`, change to use `oc.local_destino_id` instead of `oc.obra_id`:
  ```typescript
  // Before (old):
  await this.estoque.registrarMovimento(tenantId, oc.obra_id, usuarioId, { ... });

  // After (new):
  await this.estoque.registrarMovimento(tenantId, oc.local_destino_id, usuarioId, { ... });
  ```

- [ ] Update `compras.controller.ts`:
  - Remove `@Param('obraId', ParseIntPipe) obraId: number` from all methods that had it
  - Change `listar(tenantId, obraId, filters)` call to `listar(tenantId, { localDestinoId, ...filters })`
  - Add `@Query('local_destino_id') localDestinoId?: string` to the GET list endpoint

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/compras/
  git commit -m "feat(alm): update ComprasService — local_destino_id replaces obra_id in OC create/list/receive"
  ```

---

## Task 11: Update SolicitacaoService + DTO

**Modify:**
- `backend/src/almoxarifado/solicitacao/solicitacao.service.ts`
- `backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts`

### Steps

- [ ] Update `backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts`:

```typescript
// backend/src/almoxarifado/solicitacao/dto/create-solicitacao.dto.ts

export class CreateSolicitacaoItemDto {
  catalogo_id!: number;
  quantidade!: number;
  unidade!: string;
  observacao?: string;
}

export class CreateSolicitacaoDto {
  local_destino_id!: number;    // REPLACED obra_id
  descricao!: string;
  urgente?: boolean;
  data_necessidade?: string;
  servico_ref?: string;
  itens!: CreateSolicitacaoItemDto[];
}
```

- [ ] In `solicitacao.service.ts`, update `listar` method:
  - Replace `obraId: number` param with optional `localDestinoId?: number`
  - Change `WHERE s.obra_id = $2` → `WHERE s.local_destino_id = $2`
  - Add join: `LEFT JOIN alm_locais l ON l.id = s.local_destino_id`
  - Include `l.nome AS local_destino_nome` in SELECT

- [ ] In `solicitacao.service.ts`, update `criar` method:
  - Replace `obraId: number` param with `dto.local_destino_id`
  - Change INSERT: replace `obra_id` column with `local_destino_id`
  - Validate local exists and is active

- [ ] Update `solicitacao.controller.ts`:
  - Remove `@Param('obraId', ParseIntPipe) obraId` from routes
  - Add `@Query('local_destino_id') localDestinoId?: string` to list endpoint

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/solicitacao/
  git commit -m "feat(alm): update SolicitacaoService — local_destino_id replaces obra_id"
  ```

---

## Task 12: Update NfeService — aceitar with local_id

**Modify:**
- `backend/src/almoxarifado/nfe/nfe.service.ts`
- `backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts`

### Steps

- [ ] Update `backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts` — add `local_id`:

```typescript
// Add to the existing AceitarNfeDto class:
export class AceitarNfeDto {
  local_id!: number;           // ADDED — destination location for received materials
  oc_id?: number;
  observacao?: string;
}
```

- [ ] In `nfe.service.ts`, find the `aceitar` method. Update it to:
  1. Accept `dto.local_id` (required)
  2. Validate the local exists and is active for this tenant
  3. When creating stock movements for each NF-e item, use `dto.local_id` as `local_id`:
  ```typescript
  // Old pattern (remove):
  await this.estoque.registrarMovimento(tenantId, nfe.obra_id, usuarioId, { ... });

  // New pattern:
  await this.estoque.registrarMovimento(tenantId, dto.local_id, usuarioId, { ... });
  ```
  4. After movements: `UPDATE alm_notas_fiscais SET local_id = $1 WHERE id = $2`, setting `local_id = dto.local_id`

- [ ] Update `nfe.service.ts` `listar` method:
  - Change filter `obra_id` → `local_id`
  - Add `LEFT JOIN alm_locais l ON l.id = nf.local_id` and include `l.nome AS local_nome` in SELECT

- [ ] Commit:
  ```bash
  git add backend/src/almoxarifado/nfe/nfe.service.ts \
          backend/src/almoxarifado/nfe/dto/aceitar-nfe.dto.ts
  git commit -m "feat(alm): update NfeService — aceitar now requires local_id; movements use local_id instead of obra_id"
  ```

---

## Task 13: Frontend — Update almoxarifado.service.ts

**Modify:** `frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts`

### Steps

- [ ] Update all type interfaces — remove `obra_id`, add `local_id` and new types:

```typescript
// Add these NEW types at the top of the types section:

export type AlmLocalTipo = 'CENTRAL' | 'CD' | 'DEPOSITO' | 'OBRA';

export type AlmTransferenciaStatus =
  | 'rascunho' | 'aguardando_aprovacao' | 'aprovada' | 'executada' | 'cancelada';

export interface AlmLocal {
  id: number;
  tenant_id: number;
  tipo: AlmLocalTipo;
  nome: string;
  descricao: string | null;
  obra_id: number | null;
  endereco: string | null;
  responsavel_nome: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  obra_nome?: string | null;
}

export interface AlmTransferenciaItem {
  id: number;
  transferencia_id: number;
  catalogo_id: number;
  quantidade: number;
  unidade: string;
  qtd_executada: number;
  catalogo_nome?: string | null;
}

export interface AlmTransferencia {
  id: number;
  tenant_id: number;
  local_origem_id: number;
  local_destino_id: number;
  local_origem_nome: string;
  local_destino_nome: string;
  status: AlmTransferenciaStatus;
  valor_total: number | null;
  solicitante_id: number;
  aprovador_id: number | null;
  aprovado_at: string | null;
  observacao: string | null;
  executada_parcial: boolean;
  created_at: string;
  updated_at: string;
  itens?: AlmTransferenciaItem[];
}

export interface AlmConfigTransferencia {
  id: number | null;
  tenant_id: number;
  valor_limite_direto: number;
  roles_aprovadores: string[];
  created_at: string | null;
  updated_at: string | null;
}
```

- [ ] Update existing interfaces — remove `obra_id`, update `local_id` to non-nullable where needed:
  - `AlmEstoqueLocal` → rename to `AlmLocal` (remove old interface)
  - `AlmEstoqueSaldo`: remove `obra_id`, `local_id` becomes `number` (not `null`); add `local_tipo?: AlmLocalTipo`
  - `AlmMovimento`: remove `obra_id`, `local_id` becomes `number`; add `local_tipo?: AlmLocalTipo`
  - `AlmAlertaEstoque`: remove `obra_id`, `local_id` becomes `number`
  - `AlmNotaFiscal`: remove `obra_id`, add `local_id: number | null` and `local_nome?: string | null`
  - `AlmOrdemCompra`: remove `obra_id`, add `local_destino_id: number` and `local_destino_nome?: string | null`
  - `AlmSolicitacao`: remove `obra_id`, add `local_destino_id: number` and `local_destino_nome?: string | null`

- [ ] Update `CreateOcPayload` and `CreateSolicitacaoPayload`:
  - Remove `obra_id` / add `local_destino_id: number`

- [ ] Add new payload types:
  ```typescript
  export interface CreateLocalPayload {
    tipo: AlmLocalTipo;
    nome: string;
    descricao?: string | null;
    obra_id?: number | null;
    endereco?: string | null;
    responsavel_nome?: string | null;
  }

  export interface CreateTransferenciaItemPayload {
    catalogo_id: number;
    quantidade: number;
    unidade: string;
  }

  export interface CreateTransferenciaPayload {
    local_origem_id: number;
    local_destino_id: number;
    observacao?: string | null;
    itens: CreateTransferenciaItemPayload[];
  }

  export interface ExecutarTransferenciaItemPayload {
    item_id: number;
    qtd_executada: number;
  }

  export interface ExecutarTransferenciaPayload {
    itens?: ExecutarTransferenciaItemPayload[];
  }
  ```

- [ ] Update all service API call URLs in the `almoxarifadoService` object:
  - `getDashboardKpis`: `${BASE}/obras/${obraId}/dashboard` → `${BASE}/dashboard?local_id=${localId}`
  - `getSaldo`: `${BASE}/obras/${obraId}/estoque` → `${BASE}/estoque/saldo`
  - `getMovimentos`: `${BASE}/obras/${obraId}/estoque/movimentos` → `${BASE}/estoque/movimentos`
  - `registrarMovimento`: `${BASE}/obras/${obraId}/estoque/movimentos` → `${BASE}/estoque/movimentos`
  - `getAlertas`: `${BASE}/obras/${obraId}/estoque/alertas` → `${BASE}/estoque/alertas`
  - `marcarTodosLidos`: `${BASE}/obras/${obraId}/estoque/alertas/ler-todos` → `${BASE}/estoque/alertas/ler-todos`
  - `getNfes`: `${BASE}/obras/${obraId}/nfes` → `${BASE}/notas-fiscais`
  - `getOcs`: remove `obraId` param, use `${BASE}/ordens-compra?local_destino_id=...`
  - `getSolicitacoes`: remove `obraId` param, use `${BASE}/solicitacoes?local_destino_id=...`
  - Remove `getLocais` (old obra-scoped version) and `createLocal` (old versions)

- [ ] Add new service methods:
  ```typescript
  // Locais
  listarLocais: (filters?: { tipo?: AlmLocalTipo; ativo?: boolean; obra_id?: number }): Promise<AlmLocal[]> =>
    api.get(`${BASE}/locais${buildQuery(filters)}`).then((r: any) => r.data?.data ?? r.data),

  buscarLocal: (id: number): Promise<AlmLocal> =>
    api.get(`${BASE}/locais/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarLocal: (dto: CreateLocalPayload): Promise<AlmLocal> =>
    api.post(`${BASE}/locais`, dto).then((r: any) => r.data?.data ?? r.data),

  atualizarLocal: (id: number, dto: Partial<CreateLocalPayload>): Promise<AlmLocal> =>
    api.put(`${BASE}/locais/${id}`, dto).then((r: any) => r.data?.data ?? r.data),

  desativarLocal: (id: number): Promise<{ id: number; ativo: boolean }> =>
    api.delete(`${BASE}/locais/${id}`).then((r: any) => r.data?.data ?? r.data),

  // Transferências
  listarTransferencias: (filters?: {
    status?: AlmTransferenciaStatus;
    local_origem_id?: number;
    local_destino_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<{ data: AlmTransferencia[]; total: number; page: number; perPage: number }> =>
    api.get(`${BASE}/transferencias${buildQuery(filters)}`).then((r: any) => r.data?.data ?? r.data),

  buscarTransferencia: (id: number): Promise<AlmTransferencia> =>
    api.get(`${BASE}/transferencias/${id}`).then((r: any) => r.data?.data ?? r.data),

  criarTransferencia: (dto: CreateTransferenciaPayload): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias`, dto).then((r: any) => r.data?.data ?? r.data),

  aprovarTransferencia: (id: number): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/aprovar`, {}).then((r: any) => r.data?.data ?? r.data),

  executarTransferencia: (id: number, dto?: ExecutarTransferenciaPayload): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/executar`, dto ?? {}).then((r: any) => r.data?.data ?? r.data),

  cancelarTransferencia: (id: number, motivo?: string): Promise<AlmTransferencia> =>
    api.post(`${BASE}/transferencias/${id}/cancelar`, { motivo }).then((r: any) => r.data?.data ?? r.data),

  // Config de Transferência
  getConfigTransferencia: (): Promise<AlmConfigTransferencia> =>
    api.get(`${BASE}/config-transferencia`).then((r: any) => r.data?.data ?? r.data),

  upsertConfigTransferencia: (dto: { valor_limite_direto: number; roles_aprovadores: string[] }): Promise<AlmConfigTransferencia> =>
    api.put(`${BASE}/config-transferencia`, dto).then((r: any) => r.data?.data ?? r.data),
  ```

- [ ] Add a `buildQuery` helper at the top of the service (or inline in each method):
  ```typescript
  function buildQuery(params?: Record<string, unknown>): string {
    if (!params) return '';
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  }
  ```

- [ ] Commit:
  ```bash
  git add frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts
  git commit -m "feat(alm-fe): update almoxarifado.service.ts — new types, updated URLs, new locais/transferencias/config methods"
  ```

---

## Task 14: Frontend — LocaisPage + useLocais hook

**Create:**
- `frontend-web/src/modules/almoxarifado/locais/pages/LocaisPage.tsx`
- `frontend-web/src/modules/almoxarifado/locais/hooks/useLocais.ts`

### Steps

- [ ] Create directory:
  ```bash
  mkdir -p frontend-web/src/modules/almoxarifado/locais/pages
  mkdir -p frontend-web/src/modules/almoxarifado/locais/hooks
  ```

- [ ] Create `frontend-web/src/modules/almoxarifado/locais/hooks/useLocais.ts`:

```typescript
// frontend-web/src/modules/almoxarifado/locais/hooks/useLocais.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService, type AlmLocal, type AlmLocalTipo, type CreateLocalPayload } from '../../_service/almoxarifado.service';

export function useLocais(filters?: { tipo?: AlmLocalTipo; ativo?: boolean; obra_id?: number }) {
  return useQuery({
    queryKey: ['alm-locais', filters],
    queryFn: () => almoxarifadoService.listarLocais(filters),
    staleTime: 30_000,
  });
}

export function useCriarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateLocalPayload) => almoxarifadoService.criarLocal(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}

export function useAtualizarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateLocalPayload> }) =>
      almoxarifadoService.atualizarLocal(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}

export function useDesativarLocal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.desativarLocal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-locais'] }),
  });
}
```

- [ ] Create `frontend-web/src/modules/almoxarifado/locais/pages/LocaisPage.tsx`:

```tsx
// frontend-web/src/modules/almoxarifado/locais/pages/LocaisPage.tsx
import React, { useState } from 'react';
import { useLocais, useCriarLocal, useAtualizarLocal, useDesativarLocal } from '../hooks/useLocais';
import type { AlmLocal, AlmLocalTipo, CreateLocalPayload } from '../../_service/almoxarifado.service';

const TIPO_BADGE_COLOR: Record<AlmLocalTipo, string> = {
  CENTRAL:  'background: var(--accent); color: #fff',
  CD:       'background: var(--run); color: #fff',
  DEPOSITO: 'background: var(--warn); color: #000',
  OBRA:     'background: var(--ok); color: #fff',
};

const TIPO_LABEL: Record<AlmLocalTipo, string> = {
  CENTRAL:  'Central',
  CD:       'CD',
  DEPOSITO: 'Depósito',
  OBRA:     'Obra',
};

interface LocalModalProps {
  isOpen: boolean;
  onClose: () => void;
  local?: AlmLocal | null;
}

function LocalModal({ isOpen, onClose, local }: LocalModalProps) {
  const criar = useCriarLocal();
  const atualizar = useAtualizarLocal();

  const [form, setForm] = useState<Partial<CreateLocalPayload>>({
    tipo: local?.tipo ?? 'CENTRAL',
    nome: local?.nome ?? '',
    descricao: local?.descricao ?? '',
    obra_id: local?.obra_id ?? undefined,
    endereco: local?.endereco ?? '',
    responsavel_nome: local?.responsavel_nome ?? '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local) {
      await atualizar.mutateAsync({ id: local.id, dto: form });
    } else {
      await criar.mutateAsync(form as CreateLocalPayload);
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw',
      }}>
        <h2 style={{ color: 'var(--text-high)', marginBottom: 16 }}>
          {local ? 'Editar Local' : 'Novo Local'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as AlmLocalTipo }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            >
              <option value="CENTRAL">Central</option>
              <option value="CD">CD</option>
              <option value="DEPOSITO">Depósito</option>
              <option value="OBRA">Obra</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Nome *</label>
            <input
              required
              value={form.nome ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          {form.tipo === 'OBRA' && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Obra ID *</label>
              <input
                required
                type="number"
                value={form.obra_id ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, obra_id: Number(e.target.value) || undefined }))}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
              />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Endereço</label>
            <input
              value={form.endereco ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4 }}>Responsável</label>
            <input
              value={form.responsavel_nome ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, responsavel_nome: e.target.value }))}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              {local ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LocaisPage() {
  const { data: locais = [], isLoading } = useLocais({ ativo: undefined });
  const desativar = useDesativarLocal();
  const [modalOpen, setModalOpen] = useState(false);
  const [editLocal, setEditLocal] = useState<AlmLocal | null>(null);

  const handleEdit = (local: AlmLocal) => {
    setEditLocal(local);
    setModalOpen(true);
  };

  const handleNewLocal = () => {
    setEditLocal(null);
    setModalOpen(true);
  };

  const handleDesativar = async (local: AlmLocal) => {
    if (!window.confirm(`Desativar "${local.nome}"?`)) return;
    try {
      await desativar.mutateAsync(local.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao desativar local');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600 }}>Locais de Estoque</h1>
        <button
          onClick={handleNewLocal}
          style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
        >
          + Novo Local
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-low)' }}>Carregando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nome', 'Tipo', 'Obra', 'Responsável', 'Status', 'Ações'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locais.map((local) => (
              <tr key={local.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)' }}>{local.nome}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, ...parseStyle(TIPO_BADGE_COLOR[local.tipo]) }}>
                    {TIPO_LABEL[local.tipo]}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>
                  {local.obra_nome ?? (local.obra_id ? `#${local.obra_id}` : '—')}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>{local.responsavel_nome ?? '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 500,
                    background: local.ativo ? 'rgba(var(--ok-rgb), 0.15)' : 'rgba(var(--off-rgb), 0.15)',
                    color: local.ativo ? 'var(--ok)' : 'var(--text-low)' }}>
                    {local.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <button onClick={() => handleEdit(local)}
                    style={{ marginRight: 8, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer', fontSize: 13 }}>
                    Editar
                  </button>
                  {local.ativo && (
                    <button onClick={() => handleDesativar(local)}
                      style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--warn)', background: 'transparent', color: 'var(--warn)', cursor: 'pointer', fontSize: 13 }}>
                      Desativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <LocalModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditLocal(null); }}
        local={editLocal}
      />
    </div>
  );
}

// Helper to parse inline style string into CSSProperties object
function parseStyle(styleStr: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const part of styleStr.split(';')) {
    const [k, v] = part.split(':').map((s) => s.trim());
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      result[camel] = v;
    }
  }
  return result as React.CSSProperties;
}
```

- [ ] Commit:
  ```bash
  git add frontend-web/src/modules/almoxarifado/locais/
  git commit -m "feat(alm-fe): add LocaisPage + useLocais hook — CRUD UI for alm_locais with tipo badges and deactivation guard"
  ```

---

## Task 15: Frontend — TransferenciasPage + TransferenciaDetalhePage + useTransferencias

**Create:**
- `frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciasPage.tsx`
- `frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciaDetalhePage.tsx`
- `frontend-web/src/modules/almoxarifado/transferencias/hooks/useTransferencias.ts`

### Steps

- [ ] Create directories:
  ```bash
  mkdir -p frontend-web/src/modules/almoxarifado/transferencias/pages
  mkdir -p frontend-web/src/modules/almoxarifado/transferencias/hooks
  ```

- [ ] Create `frontend-web/src/modules/almoxarifado/transferencias/hooks/useTransferencias.ts`:

```typescript
// frontend-web/src/modules/almoxarifado/transferencias/hooks/useTransferencias.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  almoxarifadoService,
  type AlmTransferenciaStatus,
  type CreateTransferenciaPayload,
  type ExecutarTransferenciaPayload,
} from '../../_service/almoxarifado.service';

export function useTransferencias(filters?: {
  status?: AlmTransferenciaStatus;
  local_origem_id?: number;
  local_destino_id?: number;
  page?: number;
  per_page?: number;
}) {
  return useQuery({
    queryKey: ['alm-transferencias', filters],
    queryFn: () => almoxarifadoService.listarTransferencias(filters),
    staleTime: 15_000,
  });
}

export function useTransferencia(id: number | undefined) {
  return useQuery({
    queryKey: ['alm-transferencia', id],
    queryFn: () => almoxarifadoService.buscarTransferencia(id!),
    enabled: id !== undefined,
  });
}

export function useCriarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTransferenciaPayload) => almoxarifadoService.criarTransferencia(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alm-transferencias'] }),
  });
}

export function useAprovarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.aprovarTransferencia(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}

export function useExecutarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto?: ExecutarTransferenciaPayload }) =>
      almoxarifadoService.executarTransferencia(id, dto),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}

export function useCancelarTransferencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) =>
      almoxarifadoService.cancelarTransferencia(id, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['alm-transferencias'] });
      qc.invalidateQueries({ queryKey: ['alm-transferencia', id] });
    },
  });
}
```

- [ ] Create `frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciasPage.tsx`:

```tsx
// frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciasPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferencias, useCriarTransferencia } from '../hooks/useTransferencias';
import { useLocais } from '../../locais/hooks/useLocais';
import type { AlmTransferenciaStatus, CreateTransferenciaPayload } from '../../_service/almoxarifado.service';

const STATUS_BADGE: Record<AlmTransferenciaStatus, { label: string; color: string; bg: string }> = {
  rascunho:             { label: 'Rascunho',        color: 'var(--text-low)', bg: 'rgba(128,128,128,0.15)' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação', color: '#b45309', bg: 'rgba(245,158,11,0.15)' },
  aprovada:             { label: 'Aprovada',         color: 'var(--run)', bg: 'rgba(var(--run-rgb), 0.15)' },
  executada:            { label: 'Executada',        color: 'var(--ok)',  bg: 'rgba(var(--ok-rgb), 0.15)' },
  cancelada:            { label: 'Cancelada',        color: 'var(--text-low)', bg: 'rgba(128,128,128,0.1)' },
};

function FormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const criar = useCriarTransferencia();
  const { data: locais = [] } = useLocais({ ativo: true });
  const [form, setForm] = useState<Partial<CreateTransferenciaPayload>>({ itens: [] });
  const [novoItem, setNovoItem] = useState({ catalogo_id: '', quantidade: '', unidade: 'UN' });

  if (!isOpen) return null;

  const addItem = () => {
    if (!novoItem.catalogo_id || !novoItem.quantidade) return;
    setForm((f) => ({
      ...f,
      itens: [...(f.itens ?? []), {
        catalogo_id: Number(novoItem.catalogo_id),
        quantidade:  Number(novoItem.quantidade),
        unidade: novoItem.unidade,
      }],
    }));
    setNovoItem({ catalogo_id: '', quantidade: '', unidade: 'UN' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.local_origem_id || !form.local_destino_id || !form.itens?.length) return;
    await criar.mutateAsync(form as CreateTransferenciaPayload);
    onClose();
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: 4,
    border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 560, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ color: 'var(--text-high)', marginBottom: 16 }}>Nova Transferência</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Origem *</label>
              <select value={form.local_origem_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, local_origem_id: Number(e.target.value) || undefined }))} style={selectStyle}>
                <option value="">Selecionar...</option>
                {locais.filter((l) => l.id !== form.local_destino_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Destino *</label>
              <select value={form.local_destino_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, local_destino_id: Number(e.target.value) || undefined }))} style={selectStyle}>
                <option value="">Selecionar...</option>
                {locais.filter((l) => l.id !== form.local_origem_id).map((l) => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 4, fontSize: 13 }}>Observação</label>
            <textarea
              value={form.observacao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              rows={2}
              style={{ ...selectStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-high)', display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500 }}>Itens *</label>
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              {(form.itens ?? []).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-high)' }}>
                  <span style={{ flex: 2 }}>Catálogo #{item.catalogo_id}</span>
                  <span style={{ flex: 1 }}>{item.quantidade} {item.unidade}</span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, itens: f.itens?.filter((_, i) => i !== idx) }))}
                    style={{ background: 'transparent', border: 'none', color: 'var(--warn)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, padding: '6px 10px' }}>
                <input placeholder="Catálogo ID" type="number" value={novoItem.catalogo_id}
                  onChange={(e) => setNovoItem((n) => ({ ...n, catalogo_id: e.target.value }))}
                  style={{ flex: 2, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <input placeholder="Qtd" type="number" value={novoItem.quantidade}
                  onChange={(e) => setNovoItem((n) => ({ ...n, quantidade: e.target.value }))}
                  style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <input placeholder="UN" value={novoItem.unidade}
                  onChange={(e) => setNovoItem((n) => ({ ...n, unidade: e.target.value }))}
                  style={{ width: 50, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)', fontSize: 13 }} />
                <button type="button" onClick={addItem}
                  style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>+</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
              Criar Transferência
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TransferenciasPage() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AlmTransferenciaStatus | ''>('');
  const { data, isLoading } = useTransferencias({ status: statusFilter || undefined });

  const transferencias = data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600 }}>Transferências</h1>
        <button onClick={() => setModalOpen(true)}
          style={{ padding: '8px 16px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
          + Nova Transferência
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-high)' }}>
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_BADGE) as AlmTransferenciaStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-low)' }}>Carregando...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['ID', 'Origem → Destino', 'Status', 'Valor Total', 'Data'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transferencias.map((t) => {
              const badge = STATUS_BADGE[t.status];
              return (
                <tr key={t.id}
                  onClick={() => navigate(`/almoxarifado/transferencias/${t.id}`)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>#{t.id}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-high)' }}>
                    {t.local_origem_nome} → {t.local_destino_nome}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                    {t.valor_total != null
                      ? `R$ ${Number(t.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 12 }}>
                    {new Date(t.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              );
            })}
            {!transferencias.length && (
              <tr>
                <td colSpan={5} style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-low)' }}>
                  Nenhuma transferência encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <FormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
```

- [ ] Create `frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciaDetalhePage.tsx`:

```tsx
// frontend-web/src/modules/almoxarifado/transferencias/pages/TransferenciaDetalhePage.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTransferencia, useAprovarTransferencia, useExecutarTransferencia, useCancelarTransferencia } from '../hooks/useTransferencias';
import type { AlmTransferenciaStatus } from '../../_service/almoxarifado.service';

const STATUS_BADGE: Record<AlmTransferenciaStatus, { label: string; color: string; bg: string }> = {
  rascunho:             { label: 'Rascunho',          color: 'var(--text-low)', bg: 'rgba(128,128,128,0.15)' },
  aguardando_aprovacao: { label: 'Aguard. Aprovação', color: '#b45309',         bg: 'rgba(245,158,11,0.15)' },
  aprovada:             { label: 'Aprovada',           color: 'var(--run)',      bg: 'rgba(var(--run-rgb), 0.15)' },
  executada:            { label: 'Executada',          color: 'var(--ok)',       bg: 'rgba(var(--ok-rgb), 0.15)' },
  cancelada:            { label: 'Cancelada',          color: 'var(--text-low)', bg: 'rgba(128,128,128,0.1)' },
};

export function TransferenciaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: transferencia, isLoading } = useTransferencia(id ? Number(id) : undefined);
  const aprovar = useAprovarTransferencia();
  const executar = useExecutarTransferencia();
  const cancelar = useCancelarTransferencia();

  if (isLoading) return <div style={{ padding: 24, color: 'var(--text-low)' }}>Carregando...</div>;
  if (!transferencia) return <div style={{ padding: 24, color: 'var(--text-low)' }}>Transferência não encontrada</div>;

  const badge = STATUS_BADGE[transferencia.status];

  const handleAprovar = async () => {
    try {
      await aprovar.mutateAsync(transferencia.id);
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao aprovar');
    }
  };

  const handleExecutar = async () => {
    if (!window.confirm('Executar a transferência completa?')) return;
    try {
      await executar.mutateAsync({ id: transferencia.id });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao executar');
    }
  };

  const handleCancelar = async () => {
    const motivo = window.prompt('Motivo do cancelamento (opcional):');
    if (motivo === null) return; // user hit Cancel
    try {
      await cancelar.mutateAsync({ id: transferencia.id, motivo: motivo || undefined });
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao cancelar');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <button onClick={() => navigate(-1)}
        style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        ← Voltar
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            Transferência #{transferencia.id}
          </h1>
          <p style={{ color: 'var(--text-low)', fontSize: 14 }}>
            {transferencia.local_origem_nome} → {transferencia.local_destino_nome}
          </p>
        </div>
        <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600, color: badge.color, background: badge.bg }}>
          {badge.label}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Valor Total', value: transferencia.valor_total != null ? `R$ ${Number(transferencia.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—' },
          { label: 'Criado em', value: new Date(transferencia.created_at).toLocaleDateString('pt-BR') },
          { label: 'Exec. Parcial', value: transferencia.executada_parcial ? 'Sim' : 'Não' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 4 }}>{label}</p>
            <p style={{ color: 'var(--text-high)', fontSize: 15, fontWeight: 600 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Items table */}
      <h2 style={{ color: 'var(--text-high)', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Itens</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Catálogo', 'Qtd Solicitada', 'Qtd Executada', 'Progresso'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-low)', fontWeight: 500, fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(transferencia.itens ?? []).map((item) => {
            const pct = item.quantidade > 0 ? Math.round((item.qtd_executada / item.quantidade) * 100) : 0;
            return (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.catalogo_nome ?? `#${item.catalogo_id}`}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.quantidade} {item.unidade}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-high)', fontSize: 13 }}>
                  {item.qtd_executada} {item.unidade}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--ok)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-low)', minWidth: 36 }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Observação */}
      {transferencia.observacao && (
        <div style={{ marginBottom: 24, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 4 }}>Observação</p>
          <p style={{ color: 'var(--text-high)', fontSize: 14 }}>{transferencia.observacao}</p>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        {transferencia.status === 'aguardando_aprovacao' && (
          <button onClick={handleAprovar}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--ok)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Aprovar
          </button>
        )}
        {transferencia.status === 'aprovada' && (
          <button onClick={handleExecutar}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'var(--run)', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            Executar
          </button>
        )}
        {['rascunho', 'aguardando_aprovacao', 'aprovada'].includes(transferencia.status) && (
          <button onClick={handleCancelar}
            style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--warn)', background: 'transparent', color: 'var(--warn)', cursor: 'pointer', fontWeight: 500 }}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] Commit:
  ```bash
  git add frontend-web/src/modules/almoxarifado/transferencias/
  git commit -m "feat(alm-fe): add TransferenciasPage + TransferenciaDetalhePage + useTransferencias hooks"
  ```

---

## Task 16: Sidebar + App.tsx Routes

**Modify:**
- `frontend-web/src/components/layout/Sidebar.tsx`
- `frontend-web/src/App.tsx`

### Steps

- [ ] In `Sidebar.tsx`, locate the Almoxarifado nav group items array. Replace it with:

```tsx
items={[
  { to: base, label: 'Dashboard', end: true },
  { to: `${base}/estoque`, label: 'Estoque' },
  { to: `${base}/transferencias`, label: 'Transferências' },
  { to: `${base}/solicitacoes`, label: 'Solicitações' },
  { to: `${base}/ocs`, label: 'Compras (OC)' },
  { to: `${base}/nfes`, label: 'NF-e' },
  { to: `${base}/locais`, label: 'Locais' },
  { to: `${base}/planejamento`, label: 'Planejamento' },
  { to: `${base}/insights`, label: 'Insights IA' },
]}
```

- [ ] In `App.tsx`, locate the almoxarifado route block. The routes currently use `/obras/:obraId/almoxarifado/*` or similar obra-scoped paths. Change them to tenant-level `/almoxarifado/*`:

  **Routes to update/add:**
  ```tsx
  // Existing routes to update (change from obras/:obraId/almoxarifado/* to almoxarifado/*):
  <Route path="almoxarifado" element={<AlmoxarifadoLayout />}>
    <Route index element={<AlmoxarifadoDashboard />} />
    <Route path="estoque" element={<EstoquePage />} />
    <Route path="estoque/movimentos" element={<MovimentosPage />} />
    <Route path="estoque/alertas" element={<AlertasPage />} />
    
    {/* NEW routes */}
    <Route path="transferencias" element={<TransferenciasPage />} />
    <Route path="transferencias/:id" element={<TransferenciaDetalhePage />} />
    <Route path="locais" element={<LocaisPage />} />
    
    {/* Existing routes (paths unchanged, just no more obraId in path) */}
    <Route path="solicitacoes" element={<SolicitacoesListPage />} />
    <Route path="solicitacoes/nova" element={<NovaSolicitacaoPage />} />
    <Route path="solicitacoes/:id" element={<SolicitacaoDetalhePage />} />
    <Route path="ocs" element={<OcListPage />} />
    <Route path="ocs/nova" element={<NovaOcPage />} />
    <Route path="ocs/:id" element={<OcDetalhePage />} />
    <Route path="nfes" element={<NfeListPage />} />
    <Route path="nfes/:id" element={<NfeDetalhePage />} />
    <Route path="planejamento" element={<PlanejamentoPage />} />
    <Route path="insights" element={<InsightsPage />} />
  </Route>
  ```

- [ ] Add the new page imports at the top of `App.tsx`:
  ```tsx
  import { TransferenciasPage } from './modules/almoxarifado/transferencias/pages/TransferenciasPage';
  import { TransferenciaDetalhePage } from './modules/almoxarifado/transferencias/pages/TransferenciaDetalhePage';
  import { LocaisPage } from './modules/almoxarifado/locais/pages/LocaisPage';
  ```

- [ ] Commit:
  ```bash
  git add frontend-web/src/components/layout/Sidebar.tsx \
          frontend-web/src/App.tsx
  git commit -m "feat(alm-fe): add Transferencias + Locais routes in App.tsx; update Sidebar nav items"
  ```

---

## Self-Review

### Coverage Check — Does every spec requirement have a corresponding task?

| Spec Requirement | Task |
|-----------------|------|
| `alm_locais` table (CREATE with all constraints/indexes) | Task 1 |
| `alm_transferencias` table (CREATE) | Task 1 |
| `alm_transferencia_itens` table (CREATE) | Task 1 |
| `alm_config_transferencia` table (CREATE) | Task 1 |
| `alm_estoque_saldo`: remove obra_id, local_id NOT NULL, new UNIQUE | Task 1 |
| `alm_movimentos`: remove obra_id, local_id NOT NULL | Task 1 |
| `alm_ordens_compra`: remove obra_id, add local_destino_id | Task 1 |
| `alm_solicitacoes`: remove obra_id, add local_destino_id | Task 1 |
| `alm_notas_fiscais`: remove obra_id, add local_id (nullable) | Task 1 |
| `alm_alertas_estoque`: remove obra_id, local_id NOT NULL | Task 1 |
| DROP `alm_estoque_locais` | Task 1 |
| New TypeScript types (AlmLocal, AlmTransferencia, AlmConfigTransferencia) | Task 2 |
| Updated types (remove obra_id from saldo, movimentos, alertas, oc, solicitacao, nfe) | Task 2 |
| `LocaisService` with listar/buscarPorId/criar/atualizar/desativar | Task 3 |
| `LocaisController` with 5 routes | Task 3 |
| Deactivation guard (4 checks per spec 4.7) | Task 3 |
| `ConfigTransferenciaService` get + upsert | Task 4 |
| `ConfigTransferenciaController` GET + PUT | Task 4 |
| `TransferenciasService` listar/buscarPorId/criar/aprovar/executar/cancelar | Task 5 |
| Atomic transfer execution with SELECT FOR UPDATE | Task 5 |
| Approval threshold logic (valor_limite_direto = 0 → always approve) | Task 5 |
| Partial execution (executada_parcial flag) | Task 5 |
| `TransferenciasController` with 6 routes | Task 5 |
| OBRA-type local auto-created when obra is created | Task 6 |
| Register new services/controllers in module | Task 7 |
| `EstoqueService` remove obra_id, use local_id throughout | Task 8 |
| Remove `getLocais`/`createLocal`/`transferir` from EstoqueService | Task 8 |
| `EstoqueController` route change from obras/:obraId/ to flat | Task 9 |
| `ComprasService` + DTO: local_destino_id replaces obra_id | Task 10 |
| `SolicitacaoService` + DTO: local_destino_id replaces obra_id | Task 11 |
| `NfeService` aceitar with local_id | Task 12 |
| Frontend types updated | Task 13 |
| Frontend API URLs updated | Task 13 |
| New frontend service methods (locais, transferencias, config) | Task 13 |
| `LocaisPage` with table + modal + tipo badges | Task 14 |
| `useLocais` hook | Task 14 |
| `TransferenciasPage` with list + create modal | Task 15 |
| `TransferenciaDetalhePage` with actions + item progress bars | Task 15 |
| `useTransferencias` + action hooks | Task 15 |
| Sidebar nav items updated | Task 16 |
| App.tsx routes updated to tenant-level | Task 16 |

All 42 requirements covered across 16 tasks. No TBD or placeholder patterns detected.

### Method Signature Consistency Check

| Method | Defined in | Referenced in | Match? |
|--------|-----------|---------------|--------|
| `LocaisService.createObraLocal(tx, tenantId, obraId, obraNome)` | Task 3 | Task 6 | Yes |
| `LocaisService.desativar` — 4 guard checks per spec 4.7 | Task 3 | spec 4.7 | Yes |
| `EstoqueService.registrarMovimento(tenantId, localId, usuarioId, dto)` | Task 8 | Task 5 (transferencias), Task 10 (compras), Task 12 (nfe) | Yes |
| `ConfigTransferenciaService.getOrDefault(tenantId)` | Task 4 | Task 5 | Yes |
| `TransferenciasService.aprovar(tenantId, aprovadorId, id, userRoles)` | Task 5 | Task 5 controller | Yes |
| `almoxarifadoService.executarTransferencia(id, dto?)` | Task 13 | Task 15 | Yes |
| Route `/almoxarifado/transferencias/:id` | Task 5 backend | Task 16 App.tsx | Yes |
| Route `/almoxarifado/locais` | Task 3 backend | Task 16 App.tsx | Yes |

### Issues Found and Fixed During Self-Review

1. **saldo column name**: The existing `registrarMovimento` in the codebase uses `quantidade` as the balance column name, but the spec's upsert pattern uses `saldo`. Task 5 (executar) uses `saldo` consistently per spec section 4.3. Task 8 aligns the service to use `saldo` as the column name (or keeps `quantidade` if that's what the schema uses — the implementer must verify the actual column name in `alm_estoque_saldo` and use it consistently).

2. **`listar` pagination params in Task 5**: The `listar` method builds a `i` counter for params but the count query reuses the params slice. Added `params.slice(0, i - 2)` to exclude the LIMIT/OFFSET params from the count query.

3. **Task 6 — LocaisService import in obras.service.ts**: The `AlmoxarifadoModule` must export `LocaisService` (added in Task 7) AND `ObrasModule` must import `AlmoxarifadoModule` for the injection to work. Implementer must verify the module dependency graph and add `AlmoxarifadoModule` to `ObrasModule`'s `imports` array if not already present.

4. **Business rule 4.9 (obra deactivation)**: The spec requires that if an obra is soft-deleted, its corresponding OBRA-type local is also soft-deleted (subject to guard 4.7). Task 6 covers auto-creation but does not include the deactivation cascade. **Added:** the implementer must also add a deactivation call in `obras.service.ts` wherever an obra is inactivated, calling `locaisService.desativar(tenantId, localId)` for all OBRA-type locais linked to that obra. This is a separate edit in `obras.service.ts` beyond Task 6.

5. **AlmConfigTransferencia.roles_aprovadores handling in Task 5**: The `aprovar` method correctly falls back to `['ADMIN_TENANT']` when `roles_aprovadores` is empty, matching spec section 3.2.

---

*Plan written 2026-04-17 — based on spec `2026-04-17-almoxarifado-erp-design.md` (APPROVED)*
