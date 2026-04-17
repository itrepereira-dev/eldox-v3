-- =============================================================================
-- Migration: audit_log core
-- =============================================================================
-- 16 services fazem INSERT na tabela `audit_log` (ncs, cps, laudos, racs,
-- caminhoes, croqui, fvm/recebimento, evidencias, laboratorios, tipos,
-- ensaios, revisoes, email-concretagem). Antes desta migration a tabela NÃO
-- existia — todos os inserts caíam em `.catch(...)` silenciosamente e os
-- registros de auditoria eram perdidos. Essa migration cria a tabela
-- com schema compatível com os INSERTs existentes.
--
-- Requisitos de compliance atendidos:
--   * PBQP-H SiAC: registro auditável de todas as operações sensíveis.
--   * ISO 9001:2015 §7.5: informação documentada preservada.
--   * LGPD Art. 37: registro das operações sobre dados pessoais.
--
-- Colunas: união de todos os INSERTs existentes. `detalhes` e
-- `dados_antes`/`dados_depois` são NULLable — cada service grava o subset
-- aplicável ao seu caso de uso.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      INTEGER       NOT NULL,
  usuario_id     INTEGER,                   -- NULL quando gerado por sistema/job
  acao           VARCHAR(100)  NOT NULL,    -- ex: 'CREATE', 'UPDATE', 'APROVAR', 'EMAIL_USINA_CONFIRMACAO'
  entidade       VARCHAR(100)  NOT NULL,    -- ex: 'nao_conformidade', 'rac', 'caminhao_concreto'
  entidade_id    INTEGER,                   -- id da entidade afetada (NULLable para ações sem id)
  dados_antes    JSONB,                     -- estado antes (UPDATE/DELETE)
  dados_depois   JSONB,                     -- estado depois (CREATE/UPDATE)
  detalhes       JSONB,                     -- payload livre (transições, metadados)
  ip             VARCHAR(45),               -- opcional — preenchido se disponível
  user_agent     TEXT,                      -- opcional
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Indexes de consulta frequente
CREATE INDEX IF NOT EXISTS audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_tenant_entidade_created
  ON audit_log (tenant_id, entidade, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_tenant_entidade_id
  ON audit_log (tenant_id, entidade, entidade_id)
  WHERE entidade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_usuario_created
  ON audit_log (usuario_id, created_at DESC)
  WHERE usuario_id IS NOT NULL;

-- Append-only: nega UPDATE e DELETE em qualquer linha.
-- A role de aplicação (`eldox_app`) não pode alterar registros — apenas o
-- SUPERUSER pode (para correções administrativas excepcionais).
CREATE OR REPLACE FUNCTION audit_log_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é append-only — UPDATE/DELETE bloqueado';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_append_only();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_append_only();

-- Nota: a trigger roda para TODOS os roles, inclusive SUPERUSER. Para
-- manutenção excepcional, desabilitar temporariamente com:
--   ALTER TABLE audit_log DISABLE TRIGGER USER;
--   -- operação administrativa
--   ALTER TABLE audit_log ENABLE TRIGGER USER;
