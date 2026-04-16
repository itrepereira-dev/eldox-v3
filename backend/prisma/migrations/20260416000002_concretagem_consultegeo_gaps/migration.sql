-- Migration: 20260416000002_concretagem_consultegeo_gaps
-- Concretagem — Gap analysis vs. ConsulteGEO competitor
-- Adds operational, quality, and corrective-action fields identified as missing
-- when benchmarking Eldox against ConsulteGEO's concrete management feature set.
--
-- Changes:
--   1. betonadas          — pump flag, load-release flag, truck interval, cancellation fields
--   2. caminhoes_concreto — non-discharge flags, seal approval, A/C ratio, flow/J-ring tests,
--                           structured leftover tracking, NF photo URL
--   3. laudos_laboratorio — new table for lab reports linked to betonadas
--   4. racs               — new table for Corrective Action Reports (RAC / ISO 9001)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ALTER TABLE betonadas
-- ─────────────────────────────────────────────────────────────────────────────

-- Whether the concrete was pumped to the placement point
ALTER TABLE "betonadas"
  ADD COLUMN "bombeado" BOOLEAN NOT NULL DEFAULT FALSE;

-- "Liberado Para Carregamento" — explicit release flag before trucks are loaded
ALTER TABLE "betonadas"
  ADD COLUMN "liberado_carregamento" BOOLEAN NOT NULL DEFAULT FALSE;

-- Minimum required interval between consecutive truck arrivals (minutes)
ALTER TABLE "betonadas"
  ADD COLUMN "intervalo_min_caminhoes" INTEGER;

-- Who requested the cancellation: 'OBRA' | 'CONCRETEIRA'
ALTER TABLE "betonadas"
  ADD COLUMN "cancelamento_solicitante" VARCHAR(30);

-- Whether a financial penalty applies to the cancellation
ALTER TABLE "betonadas"
  ADD COLUMN "cancelamento_multa" BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ALTER TABLE caminhoes_concreto
-- ─────────────────────────────────────────────────────────────────────────────

-- Truck arrived on site but did not discharge concrete
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "nao_descarregou" BOOLEAN NOT NULL DEFAULT FALSE;

-- Non-discharge was the concreteira's fault (drives financial responsibility)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "responsabilidade_concreteira" BOOLEAN NOT NULL DEFAULT FALSE;

-- Tamper-seal inspection result: NULL = not checked, TRUE = approved, FALSE = rejected
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "lacre_aprovado" BOOLEAN;

-- Water/cement ratio measured at delivery (Fator A/C)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "fator_ac" DECIMAL(4,3);

-- Flow table test result in mm (EN 12350-5 / ABNT NBR 15823)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "flow" DECIMAL(6,2);

-- J-ring test result in mm (EN 12350-12 / ABNT NBR 15823)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "ensaio_j" DECIMAL(6,2);

-- Structured leftover classification: 'APROVEITADO' | 'DESCARTADO' | 'NAO_PAGAR'
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "sobra_tipo" VARCHAR(30);

-- Volume of concrete left over (m³)
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "sobra_volume" DECIMAL(6,2);

-- URL of the uploaded Nota Fiscal photo
ALTER TABLE "caminhoes_concreto"
  ADD COLUMN "foto_nf_url" TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CREATE TABLE laudos_laboratorio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "laudos_laboratorio" (
  "id"               SERIAL          NOT NULL,
  "tenant_id"        INTEGER         NOT NULL,
  "betonada_id"      INTEGER         NOT NULL,
  "numero"           VARCHAR(50)     NOT NULL,
  -- CONCRETO, ACO, SOLO, etc.
  "tipo"             VARCHAR(50)     NOT NULL DEFAULT 'CONCRETO',
  "data_emissao"     DATE            NOT NULL,
  "laboratorio_nome" VARCHAR(200),
  "laboratorio_id"   INTEGER,
  "arquivo_url"      TEXT,
  "ged_documento_id" INTEGER,
  -- PENDENTE, APROVADO, REPROVADO
  "resultado"        VARCHAR(20)     NOT NULL DEFAULT 'PENDENTE',
  "observacoes"      TEXT,
  "aprovado_por"     INTEGER,
  "aprovado_em"      TIMESTAMP(3),
  "criado_por"       INTEGER         NOT NULL,
  "created_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "laudos_laboratorio_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_laudo_betonada" FOREIGN KEY ("betonada_id") REFERENCES "betonadas"("id")
);

CREATE INDEX "idx_laudo_tenant"    ON "laudos_laboratorio" ("tenant_id");
CREATE INDEX "idx_laudo_betonada"  ON "laudos_laboratorio" ("tenant_id", "betonada_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CREATE TABLE racs  (Relatório de Ação Corretiva — ISO 9001)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "racs" (
  "id"                      SERIAL          NOT NULL,
  "tenant_id"               INTEGER         NOT NULL,
  "obra_id"                 INTEGER         NOT NULL,
  -- linked non-conformance (may be null when RAC is opened independently)
  "nc_id"                   INTEGER,
  "numero"                  VARCHAR(30)     NOT NULL,
  "titulo"                  VARCHAR(300)    NOT NULL,
  "descricao_problema"      TEXT            NOT NULL,
  "causa_raiz"              TEXT,
  "acao_corretiva"          TEXT,
  "acao_preventiva"         TEXT,
  "responsavel_id"          INTEGER,
  "prazo"                   DATE,
  -- ABERTA, EM_ANDAMENTO, CONCLUIDA, CANCELADA
  "status"                  VARCHAR(30)     NOT NULL DEFAULT 'ABERTA',
  "eficacia_verificada"     BOOLEAN         NOT NULL DEFAULT FALSE,
  "eficacia_verificada_por" INTEGER,
  "eficacia_verificada_em"  TIMESTAMP(3),
  "criado_por"              INTEGER         NOT NULL,
  "created_at"              TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"              TIMESTAMP(3),

  CONSTRAINT "racs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX        "idx_rac_tenant"  ON "racs" ("tenant_id");
CREATE INDEX        "idx_rac_obra"    ON "racs" ("tenant_id", "obra_id");
-- Unique RAC number per tenant, excluding soft-deleted rows
CREATE UNIQUE INDEX "uq_rac_numero"   ON "racs" ("tenant_id", "numero") WHERE "deleted_at" IS NULL;
