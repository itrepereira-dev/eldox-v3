-- migration: 20260413100000_fvs_sprint4b_nc_ciclo
-- Sprint 4b: ciclo reaberto + fvs_nao_conformidades + fvs_nc_tratamentos

-- 1. fvs_registros: campos de reabertura de ciclo
ALTER TABLE fvs_registros
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_por INT REFERENCES "Usuario"(id),
  ADD COLUMN IF NOT EXISTS ciclo_reaberto_em  TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fvs_reg_status_tenant
  ON fvs_registros (tenant_id, ficha_id, status);

-- 2. fvs_nao_conformidades
CREATE TABLE IF NOT EXISTS fvs_nao_conformidades (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE RESTRICT,
  registro_id       INT NOT NULL REFERENCES fvs_registros(id) ON DELETE RESTRICT,
  numero            VARCHAR(60) NOT NULL,
  servico_id        INT NOT NULL,
  item_id           INT NOT NULL,
  obra_local_id     INT NOT NULL,
  criticidade       VARCHAR(20) NOT NULL DEFAULT 'menor',
  status            VARCHAR(40) NOT NULL DEFAULT 'aberta',
  ciclo_numero      INT NOT NULL DEFAULT 1,
  responsavel_id    INT,
  prazo_resolucao   DATE,
  acao_corretiva    TEXT,
  causa_raiz        TEXT,
  sla_prazo_dias    INT,
  sla_status        VARCHAR(20) DEFAULT 'no_prazo',
  encerrada_em      TIMESTAMP,
  encerrada_por     INT,
  resultado_final   VARCHAR(40),
  criado_em         TIMESTAMP NOT NULL DEFAULT NOW(),
  criado_por        INT NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nc_ficha
  ON fvs_nao_conformidades (ficha_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_status
  ON fvs_nao_conformidades (status, tenant_id);
CREATE INDEX IF NOT EXISTS idx_nc_sla
  ON fvs_nao_conformidades (sla_status, tenant_id);

-- 3. fvs_nc_tratamentos
CREATE TABLE IF NOT EXISTS fvs_nc_tratamentos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  nc_id           INT NOT NULL REFERENCES fvs_nao_conformidades(id) ON DELETE CASCADE,
  ciclo_numero    INT NOT NULL,
  descricao       TEXT NOT NULL,
  acao_corretiva  TEXT,
  responsavel_id  INT NOT NULL,
  prazo           DATE,
  evidencias      JSONB,
  registrado_por  INT NOT NULL,
  criado_em       TIMESTAMP NOT NULL DEFAULT NOW()
);
