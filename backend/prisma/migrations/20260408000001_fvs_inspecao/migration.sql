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
  ged_versao_id   INT NOT NULL REFERENCES ged_versoes(id),
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
