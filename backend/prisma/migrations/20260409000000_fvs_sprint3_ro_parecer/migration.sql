-- migration: 20260409000000_fvs_sprint3_ro_parecer
-- Nota: tenant_id explícito em todas as queries; RLS centralizado em sprint posterior.

-- ── 1. fvs_registros: ciclo + ai_* ──────────────────────────────────────────────

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

-- ── 2. ro_ocorrencias ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_ocorrencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_id            INT NOT NULL REFERENCES fvs_fichas(id),
  ciclo_numero        INT NOT NULL DEFAULT 1,
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
  deleted_at          TIMESTAMP NULL,
  UNIQUE(tenant_id, ficha_id, ciclo_numero)
);
CREATE INDEX IF NOT EXISTS idx_ro_ocorrencias_tenant_status ON ro_ocorrencias(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ro_ocorrencias_tenant_ficha  ON ro_ocorrencias(tenant_id, ficha_id);

-- ── 3. ro_servicos_nc ────────────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_ro_servicos_nc_ro_id ON ro_servicos_nc(ro_id);
CREATE INDEX IF NOT EXISTS idx_ro_servicos_nc_tenant ON ro_servicos_nc(tenant_id);

-- ── 4. ro_servico_itens_nc ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ro_servico_itens_nc (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_servico_nc_id    INT NOT NULL REFERENCES ro_servicos_nc(id) ON DELETE CASCADE,
  registro_id         INT NOT NULL REFERENCES fvs_registros(id),
  item_descricao      TEXT NOT NULL,
  item_criticidade    VARCHAR(20) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ro_servico_itens_nc_servico_nc_id ON ro_servico_itens_nc(ro_servico_nc_id);
CREATE INDEX IF NOT EXISTS idx_ro_servico_itens_nc_tenant ON ro_servico_itens_nc(tenant_id);

-- ── 5. ro_servico_evidencias ─────────────────────────────────────────────────────

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
CREATE INDEX IF NOT EXISTS idx_ro_servico_evidencias_servico_nc_id ON ro_servico_evidencias(ro_servico_nc_id);
CREATE INDEX IF NOT EXISTS idx_ro_servico_evidencias_tenant ON ro_servico_evidencias(tenant_id);

-- ── 6. fvs_pareceres ─────────────────────────────────────────────────────────────

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

-- ROLLBACK documentado:
-- DROP TABLE IF EXISTS fvs_pareceres;
-- DROP TABLE IF EXISTS ro_servico_evidencias;
-- DROP TABLE IF EXISTS ro_servico_itens_nc;
-- DROP TABLE IF EXISTS ro_servicos_nc;
-- DROP TABLE IF EXISTS ro_ocorrencias;
-- ALTER TABLE fvs_registros DROP CONSTRAINT IF EXISTS fvs_registros_ficha_item_local_ciclo_key, DROP COLUMN IF EXISTS ciclo, DROP COLUMN IF EXISTS ai_sugestao, DROP COLUMN IF EXISTS ai_confianca, DROP COLUMN IF EXISTS ai_observacao, DROP COLUMN IF EXISTS ai_processado_em;
-- ALTER TABLE fvs_registros ADD CONSTRAINT fvs_registros_ficha_id_item_id_obra_local_id_key UNIQUE (ficha_id, item_id, obra_local_id);
