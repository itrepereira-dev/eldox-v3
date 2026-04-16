-- Migration: 20260415000001_concretagem_croqui
-- Sprint 8 — Concretagem · SPEC 7: Croqui de Rastreabilidade (EldoX.IA)

CREATE TABLE "concretagem_croquis" (
  "id"            SERIAL          NOT NULL,
  "tenant_id"     INTEGER         NOT NULL,
  "obra_id"       INTEGER         NOT NULL,
  "obra_local_id" INTEGER,
  "nome"          VARCHAR(200)    NOT NULL,
  "elementos"     JSONB           NOT NULL DEFAULT '{}',
  "ia_confianca"  DECIMAL(3,2),
  "criado_por"    INTEGER         NOT NULL,
  "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMP(3),

  CONSTRAINT "concretagem_croquis_pkey" PRIMARY KEY ("id")
);

-- Índice: um croqui por (tenant, obra, local) — NULL em obra_local_id permite múltiplos sem local
CREATE UNIQUE INDEX "uq_croqui_obra_local"
  ON "concretagem_croquis" ("tenant_id", "obra_id", "obra_local_id")
  WHERE "deleted_at" IS NULL AND "obra_local_id" IS NOT NULL;

CREATE INDEX "idx_croqui_tenant"       ON "concretagem_croquis" ("tenant_id");
CREATE INDEX "idx_croqui_tenant_obra"  ON "concretagem_croquis" ("tenant_id", "obra_id");

-- Índice GIN para queries jsonb (buscar por elemento específico no futuro)
CREATE INDEX "idx_croqui_elementos_gin" ON "concretagem_croquis" USING GIN ("elementos");
