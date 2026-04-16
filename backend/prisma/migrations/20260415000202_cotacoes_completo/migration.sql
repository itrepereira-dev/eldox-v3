-- Sprint A — Cotações completo
-- Criado manualmente em 2026-04-15

-- ── 1. Campos adicionais em alm_cotacoes ─────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='token') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "token" VARCHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='token_expires_at') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "token_expires_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='respondida_at') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "respondida_at" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='frete') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "frete" NUMERIC(15,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='validade_dias') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "validade_dias" INT DEFAULT 7;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacoes' AND column_name='subtotal') THEN
    ALTER TABLE alm_cotacoes ADD COLUMN "subtotal" NUMERIC(15,2);
  END IF;
END $$;

-- Índice para busca por token (portal do fornecedor)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_alm_cotacoes_token"
  ON alm_cotacoes ("token")
  WHERE "token" IS NOT NULL;

-- ── 2. Campos adicionais em alm_cotacao_itens ─────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacao_itens' AND column_name='marca') THEN
    ALTER TABLE alm_cotacao_itens ADD COLUMN "marca" VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacao_itens' AND column_name='disponivel') THEN
    ALTER TABLE alm_cotacao_itens ADD COLUMN "disponivel" BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacao_itens' AND column_name='prazo_dias') THEN
    ALTER TABLE alm_cotacao_itens ADD COLUMN "prazo_dias" INT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_cotacao_itens' AND column_name='observacao') THEN
    ALTER TABLE alm_cotacao_itens ADD COLUMN "observacao" TEXT;
  END IF;
END $$;

-- ── 3. cotacao_id em alm_ordens_compra (rastreabilidade cotação → OC) ──────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_ordens_compra' AND column_name='cotacao_id') THEN
    ALTER TABLE alm_ordens_compra ADD COLUMN "cotacao_id" INT REFERENCES alm_cotacoes(id);
  END IF;
END $$;

-- ── 4. classificacao_abc + historico de preço em alm_oc_itens ────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alm_oc_itens' AND column_name='classificacao_abc') THEN
    ALTER TABLE alm_oc_itens ADD COLUMN "classificacao_abc" CHAR(1);
  END IF;
END $$;
