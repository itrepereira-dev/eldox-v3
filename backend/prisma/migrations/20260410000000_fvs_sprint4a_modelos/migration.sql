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
