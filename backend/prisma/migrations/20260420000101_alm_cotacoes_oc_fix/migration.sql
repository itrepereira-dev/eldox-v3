-- Fix: consolida as alterações do `20260415000202_cotacoes_completo` em bancos
-- zerados, onde a migration original foi pulada por preceder o almoxarifado_init.
-- Todas as operações usam IF NOT EXISTS — em bancos existentes as colunas já
-- foram adicionadas pela migration original e este fix é inócuo.

ALTER TABLE alm_cotacoes
  ADD COLUMN IF NOT EXISTS "token"             VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "token_expires_at"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "respondida_at"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frete"             NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "validade_dias"     INT DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "subtotal"          NUMERIC(15,2);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_alm_cotacoes_token"
  ON alm_cotacoes ("token")
  WHERE "token" IS NOT NULL;

ALTER TABLE alm_cotacao_itens
  ADD COLUMN IF NOT EXISTS "marca"       VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "disponivel"  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "prazo_dias"  INT,
  ADD COLUMN IF NOT EXISTS "observacao"  TEXT;

ALTER TABLE alm_ordens_compra
  ADD COLUMN IF NOT EXISTS "cotacao_id"  INT REFERENCES alm_cotacoes(id);

ALTER TABLE alm_oc_itens
  ADD COLUMN IF NOT EXISTS "classificacao_abc" CHAR(1);
