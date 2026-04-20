-- Migration: cria a tabela semaforo_pbqph_cache que estava declarada no
-- schema.prisma (model SemaforoPbqphCache, @@map("semaforo_pbqph_cache"))
-- mas nunca havia sido materializada em produção — resultando em 500
-- ("relation does not exist") nos endpoints /obras/:id/semaforo e no
-- global /semaforo quando havia obra no tenant.
--
-- Auditoria E2E de 2026-04-20 identificou CRIT-001.

CREATE TABLE IF NOT EXISTS semaforo_pbqph_cache (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT            NOT NULL,
  obra_id       INT            NOT NULL,
  modulo        VARCHAR(30)    NOT NULL,   -- 'fvs' | 'fvm' | 'ensaios' | 'ncs'
  score         DECIMAL(5, 2)  NOT NULL,   -- 0.00–100.00
  semaforo      VARCHAR(10)    NOT NULL,   -- 'verde' | 'amarelo' | 'vermelho'
  detalhes      JSONB          NOT NULL,
  calculado_em  TIMESTAMP      NOT NULL DEFAULT NOW(),
  expirado_em   TIMESTAMP      NOT NULL,

  CONSTRAINT uq_semaforo_tenant_obra_modulo UNIQUE (tenant_id, obra_id, modulo)
);

CREATE INDEX IF NOT EXISTS idx_semaforo_tenant_obra ON semaforo_pbqph_cache (tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_semaforo_expirado    ON semaforo_pbqph_cache (expirado_em);
