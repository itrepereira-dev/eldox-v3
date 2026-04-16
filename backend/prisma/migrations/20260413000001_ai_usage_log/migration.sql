-- IA Usage Log: rastreia chamadas à API Claude por tenant/usuário
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       INTEGER   NOT NULL,
  usuario_id      INTEGER,
  handler_name    VARCHAR(100) NOT NULL,   -- ex: 'fvs.gerarCatalogo'
  modelo          VARCHAR(100) NOT NULL,   -- ex: 'claude-sonnet-4-6'
  tokens_in       INTEGER   NOT NULL DEFAULT 0,
  tokens_out      INTEGER   NOT NULL DEFAULT 0,
  custo_estimado  NUMERIC(10, 6) NOT NULL DEFAULT 0,  -- USD
  duracao_ms      INTEGER   NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_tenant_handler
  ON ai_usage_log (tenant_id, handler_name, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_log_usuario
  ON ai_usage_log (usuario_id, handler_name, created_at DESC);
