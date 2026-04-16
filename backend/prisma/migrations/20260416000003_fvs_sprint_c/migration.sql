-- FVS Sprint C: N/A status, client portal, markup annotations, AI fields
-- Date: 2026-04-16

-- 1. status in fvs_registros is VARCHAR(20) — no enum alter needed, 'nao_aplicavel' works as-is

-- 2. Add fornecedor linkage + client portal token to fichas_fvs
ALTER TABLE fvs_fichas
  ADD COLUMN IF NOT EXISTS fornecedor_id       INT          NULL,
  ADD COLUMN IF NOT EXISTS token_cliente        VARCHAR(64)  NULL UNIQUE,
  ADD COLUMN IF NOT EXISTS token_cliente_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS risco_score          SMALLINT     NULL CHECK (risco_score BETWEEN 0 AND 100);

-- 3. Markup annotations table
CREATE TABLE IF NOT EXISTS fvs_markup_anotacoes (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT          NOT NULL,
  evidencia_id  INT          NOT NULL REFERENCES fvs_evidencias(id) ON DELETE CASCADE,
  tipo          VARCHAR(20)  NOT NULL CHECK (tipo IN ('seta','circulo','texto','retangulo')),
  dados_json    JSONB        NOT NULL DEFAULT '{}',
  criado_por    INT          NOT NULL,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_markup_evidencia ON fvs_markup_anotacoes(evidencia_id);
CREATE INDEX IF NOT EXISTS idx_markup_tenant ON fvs_markup_anotacoes(tenant_id);

-- 4. NC AI suggestions column (populated by agente-diagnostico-nc)
ALTER TABLE fvs_nao_conformidades
  ADD COLUMN IF NOT EXISTS ia_sugestao_json  JSONB NULL,
  ADD COLUMN IF NOT EXISTS ia_processado_em  TIMESTAMPTZ NULL;

-- 5. Timeline table for inspection history per cell
CREATE TABLE IF NOT EXISTS fvs_timeline (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT          NOT NULL,
  ficha_id      INT          NOT NULL REFERENCES fvs_fichas(id) ON DELETE CASCADE,
  registro_id   INT          NULL REFERENCES fvs_registros(id) ON DELETE SET NULL,
  evento        VARCHAR(80)  NOT NULL,
  detalhes_json JSONB        NOT NULL DEFAULT '{}',
  usuario_id    INT          NOT NULL,
  criado_em     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_ficha ON fvs_timeline(ficha_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_tenant ON fvs_timeline(tenant_id);
