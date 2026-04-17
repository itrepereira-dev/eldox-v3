-- Migration: 20260417000004_alm_sugestoes_ia
-- Tabela de sugestões IA com ciclo de vida (pendente → aplicado | ignorado)

CREATE TABLE IF NOT EXISTS alm_sugestoes_ia (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('reorder', 'anomalia')),
  catalogo_id    INT NOT NULL,
  catalogo_nome  VARCHAR(255) NOT NULL,
  local_id       INT NOT NULL,
  unidade        VARCHAR(20) NOT NULL,
  dados_json     JSONB NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'aplicado', 'ignorado')),
  solicitacao_id INT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_alm_sugestoes_ia_key
    UNIQUE (tenant_id, catalogo_id, local_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alm_sugestoes_ia_tenant_status
  ON alm_sugestoes_ia (tenant_id, status);
