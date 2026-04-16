-- Migration: 20260416000020_concretagem_gaps2
-- Concretagem — Remaining gaps vs. ConsulteGEO
-- Adds: numero_bt, hora_carregamento, lancamento_parcial, elementos_lancados
--       and fornecedor_portal_tokens for read-only supplier access

-- ─── 1. caminhoes_concreto — missing fields ───────────────────────────────────

-- Boletim de Transporte number (unique truck load document from usina)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN IF NOT EXISTS "numero_bt" VARCHAR(50);

-- Timestamp when the truck was loaded at the usina (4th timestamp: carregamento → chegada → inicio_lancamento → fim_lancamento)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN IF NOT EXISTS "hora_carregamento" TIME;

-- Flag for partial launch — truck arrived, lançamento not yet complete
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN IF NOT EXISTS "lancamento_parcial" BOOLEAN NOT NULL DEFAULT FALSE;

-- Multiple structural elements poured by this truck (replaces single elemento_lancado text field)
-- Kept as TEXT[] for simplicity; elemento_lancado preserved for backward compat
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN IF NOT EXISTS "elementos_lancados" TEXT[];

-- ─── 2. fornecedor_portal_tokens ─────────────────────────────────────────────
-- Read-only token-based access for concreteiras to view programações

CREATE TABLE IF NOT EXISTS "fornecedor_portal_tokens" (
  "id"           SERIAL PRIMARY KEY,
  "tenant_id"    INTEGER NOT NULL,
  "betonada_id"  INTEGER NOT NULL REFERENCES "betonadas"("id") ON DELETE CASCADE,
  "token"        VARCHAR(64) NOT NULL UNIQUE,
  "expires_at"   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_portal_tokens_token" ON "fornecedor_portal_tokens"("token");
CREATE INDEX IF NOT EXISTS "idx_portal_tokens_betonada" ON "fornecedor_portal_tokens"("tenant_id", "betonada_id");
