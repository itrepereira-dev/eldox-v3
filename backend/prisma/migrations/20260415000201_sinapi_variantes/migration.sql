-- Sprint 9 — SINAPI + Catálogo de Variantes (Produtos Similares)
-- Criado manualmente em 2026-04-15

-- ── 1. SINAPI — tabela de insumos de referência ───────────────────────────────
-- Importada mensalmente a partir do xlsx da CAIXA Econômica Federal
-- Sem tenant_id: é uma tabela global de referência

CREATE TABLE IF NOT EXISTS sinapi_insumos (
  "id"                      SERIAL PRIMARY KEY,
  "codigo"                  VARCHAR(20)  NOT NULL,
  "descricao"               VARCHAR(500) NOT NULL,
  "unidade"                 VARCHAR(20)  NOT NULL,
  "tipo"                    VARCHAR(30)  NOT NULL DEFAULT 'INSUMO',  -- INSUMO | COMPOSICAO
  "grupo"                   VARCHAR(150),
  "uf"                      CHAR(2)      NOT NULL,
  "preco_desonerado"        NUMERIC(14,4),
  "preco_nao_desonerado"    NUMERIC(14,4),
  "referencia_mes"          CHAR(7)      NOT NULL,  -- YYYY-MM
  "ativo"                   BOOLEAN      NOT NULL DEFAULT true,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice único: mesmo código, UF e mês não pode repetir
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sinapi_codigo_uf_mes"
  ON "sinapi_insumos" ("codigo", "uf", "referencia_mes");

CREATE INDEX IF NOT EXISTS "idx_sinapi_uf_mes_ativo"
  ON "sinapi_insumos" ("uf", "referencia_mes", "ativo");

-- Full-text search na descrição (busca por "tinta", "cimento", etc.)
CREATE INDEX IF NOT EXISTS "idx_sinapi_descricao_fts"
  ON "sinapi_insumos" USING gin(to_tsvector('portuguese', "descricao"));

-- ── 2. Variantes do catálogo ──────────────────────────────────────────────────
-- Permite que vários nomes/marcas/descrições de NF apontem para um mesmo
-- item canônico do catálogo (fvm_catalogo_materiais), mantendo rastreabilidade

CREATE TABLE IF NOT EXISTS "alm_catalogo_variantes" (
  "id"                SERIAL PRIMARY KEY,
  "tenant_id"         INT          NOT NULL,
  "catalogo_id"       INT          NOT NULL,   -- fvm_catalogo_materiais.id
  "descricao_orig"    VARCHAR(500) NOT NULL,   -- texto exato como vem na NF / orçamento
  "marca"             VARCHAR(100),
  "codigo_fornecedor" VARCHAR(100),            -- código do produto no fornecedor
  "unidade_orig"      VARCHAR(20),             -- unidade como vem na NF (ex: CX)
  "fator_conversao"   NUMERIC(10,4) NOT NULL DEFAULT 1.0,
                                               -- 1 CX = 12 UN → fator = 12
  "sinapi_codigo"     VARCHAR(20),             -- referência SINAPI quando aplicável
  "origem"            VARCHAR(20)  NOT NULL DEFAULT 'manual',
                                               -- 'ia' | 'manual' | 'sinapi' | 'importacao'
  "ia_confianca"      NUMERIC(5,2),            -- 0-100 quando origem = 'ia'
  "confirmado_por"    INT,                     -- usuario_id que aprovou
  "confirmado_at"     TIMESTAMP(3),
  "ativo"             BOOLEAN      NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_alm_variantes_tenant_catalogo"
  ON "alm_catalogo_variantes" ("tenant_id", "catalogo_id", "ativo");

-- Full-text search para o matching de NF
CREATE INDEX IF NOT EXISTS "idx_alm_variantes_fts"
  ON "alm_catalogo_variantes" USING gin(to_tsvector('portuguese', "descricao_orig"));

-- ── 3. Sugestões pendentes do agente IA ───────────────────────────────────────
-- Fila de sugestões que o almoxarife precisa confirmar ou rejeitar

CREATE TABLE IF NOT EXISTS "alm_catalogo_sugestoes_ia" (
  "id"                SERIAL PRIMARY KEY,
  "tenant_id"         INT          NOT NULL,
  "descricao_orig"    VARCHAR(500) NOT NULL,   -- descrição da NF que gerou a sugestão
  "unidade_orig"      VARCHAR(20),
  "catalogo_id_sug"   INT          NOT NULL,   -- catálogo sugerido pela IA
  "fator_sug"         NUMERIC(10,4) NOT NULL DEFAULT 1.0,
  "confianca"         NUMERIC(5,2) NOT NULL,   -- 0-100
  "motivo_ia"         TEXT,                    -- explicação da IA
  "alternativas"      JSONB,                   -- outras sugestões com scores
  "nfe_item_id"       INT,                     -- item de NF que originou
  "status"            VARCHAR(20)  NOT NULL DEFAULT 'pendente',
                                               -- 'pendente' | 'aprovado' | 'rejeitado'
  "revisado_por"      INT,
  "revisado_at"       TIMESTAMP(3),
  "variante_criada_id" INT,                    -- alm_catalogo_variantes.id após aprovação
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_alm_sugestoes_tenant_status"
  ON "alm_catalogo_sugestoes_ia" ("tenant_id", "status");

-- ── 4. Adicionar sinapi_codigo em alm_orcamento_itens ────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alm_orcamento_itens' AND column_name = 'sinapi_codigo'
  ) THEN
    ALTER TABLE "alm_orcamento_itens" ADD COLUMN "sinapi_codigo" VARCHAR(20);
  END IF;
END $$;

-- ── 5. Adicionar sinapi_codigo em fvm_catalogo_materiais ─────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fvm_catalogo_materiais' AND column_name = 'sinapi_codigo'
  ) THEN
    ALTER TABLE "fvm_catalogo_materiais" ADD COLUMN "sinapi_codigo" VARCHAR(20);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_fvm_mat_sinapi"
  ON "fvm_catalogo_materiais" ("sinapi_codigo")
  WHERE "sinapi_codigo" IS NOT NULL;
