-- Migration: 20260414000003_ensaio_tipos
-- Sprint 5 — Módulo de Tipos de Ensaio

CREATE TABLE ensaio_tipo (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL,
  nome             VARCHAR(100) NOT NULL,
  unidade          VARCHAR(20) NOT NULL,
  valor_ref_min    DECIMAL(10,3),
  valor_ref_max    DECIMAL(10,3),
  norma_tecnica    VARCHAR(50),
  material_tipo    VARCHAR(50),
  fvm_material_id  INTEGER REFERENCES fvm_catalogo_materiais(id),
  aprovacao_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por       INTEGER NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ensaio_tipo_nome UNIQUE(tenant_id, nome),
  CONSTRAINT chk_ensaio_tipo_material_tipo CHECK (
    material_tipo IS NULL OR material_tipo IN
    ('bloco_concreto','concreto','argamassa','aco','ceramica','outro')
  )
);

CREATE TABLE ensaio_frequencia (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL,
  ensaio_tipo_id      INTEGER NOT NULL REFERENCES ensaio_tipo(id) ON DELETE CASCADE,
  unidade_frequencia  VARCHAR(20) NOT NULL CHECK (unidade_frequencia IN ('dias','m3','lotes')),
  valor               INTEGER NOT NULL CHECK (valor > 0),
  CONSTRAINT uq_ensaio_freq UNIQUE(tenant_id, ensaio_tipo_id)
);

CREATE INDEX idx_ensaio_tipo_tenant ON ensaio_tipo(tenant_id, ativo);
CREATE INDEX idx_ensaio_freq_tipo   ON ensaio_frequencia(ensaio_tipo_id);
