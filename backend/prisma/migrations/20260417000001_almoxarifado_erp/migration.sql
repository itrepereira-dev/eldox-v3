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
