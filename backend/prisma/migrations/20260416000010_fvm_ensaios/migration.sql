-- Migration: 20260416000010_fvm_ensaios
-- FVM Ensaios — quantitative material quality tests with reference thresholds
-- Adds: fvm_ensaio_templates (per-material thresholds) and fvm_ensaios (recorded measurements)

-- ─── TABLE: fvm_ensaio_templates ─────────────────────────────────────────────
-- Templates define what tests to run for each material (seeded by system, customizable per tenant)

CREATE TABLE IF NOT EXISTS "fvm_ensaio_templates" (
  "id"               SERIAL PRIMARY KEY,
  "tenant_id"        INTEGER NOT NULL DEFAULT 0,  -- 0 = sistema (global), >0 = custom por tenant
  "material_id"      INTEGER REFERENCES "fvm_catalogo_materiais"("id") ON DELETE CASCADE,
  "nome"             VARCHAR(120) NOT NULL,
  "norma_referencia" VARCHAR(60),
  "unidade"          VARCHAR(30) NOT NULL,
  "valor_min"        DECIMAL(10,3),
  "valor_max"        DECIMAL(10,3),
  "obrigatorio"      BOOLEAN NOT NULL DEFAULT TRUE,
  "ordem"            INTEGER NOT NULL DEFAULT 0,
  "ativo"            BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_fvm_ensaio_templates_material" ON "fvm_ensaio_templates"("tenant_id", "material_id");

-- ─── TABLE: fvm_ensaios ──────────────────────────────────────────────────────
-- Recorded measurements for a specific lote

CREATE TABLE IF NOT EXISTS "fvm_ensaios" (
  "id"               SERIAL PRIMARY KEY,
  "tenant_id"        INTEGER NOT NULL,
  "lote_id"          INTEGER NOT NULL REFERENCES "fvm_lotes"("id") ON DELETE CASCADE,
  "template_id"      INTEGER REFERENCES "fvm_ensaio_templates"("id"),
  "nome"             VARCHAR(120) NOT NULL,  -- copied from template (denormalized for history)
  "norma_referencia" VARCHAR(60),
  "unidade"          VARCHAR(30) NOT NULL,
  "valor_min"        DECIMAL(10,3),
  "valor_max"        DECIMAL(10,3),
  "valor_medido"     DECIMAL(10,3),
  "resultado"        VARCHAR(20) NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | APROVADO | REPROVADO
  "data_ensaio"      DATE,
  "laboratorio_nome" VARCHAR(120),
  "observacoes"      TEXT,
  "registrado_por"   INTEGER NOT NULL,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_fvm_ensaios_lote" ON "fvm_ensaios"("tenant_id", "lote_id");

-- ─── SEED: Templates sistema (tenant_id = 0) ─────────────────────────────────
-- material_id NULL = categoria-wide. We insert with specific material_id = NULL
-- and tie by categoria name at query time. For simplicity, we seed by category prefix
-- using NULL material_id and nome as unique identifier.
-- Actual material_id linkage is done by the service via category lookup.

-- Note: material_id is nullable — when NULL, template applies to all materials
-- in its category (matched by service). Named templates with NULL material_id
-- serve as category defaults.

INSERT INTO "fvm_ensaio_templates" ("tenant_id", "material_id", "nome", "norma_referencia", "unidade", "valor_min", "valor_max", "obrigatorio", "ordem")
VALUES
  -- Bloco Cerâmico (NBR 15270) — material_id NULL, categoria matched by service
  (0, NULL, 'Resistência à Compressão — Bloco Cerâmico', 'NBR 15270', 'MPa', 1.5, NULL, TRUE,  1),
  (0, NULL, 'Absorção de Água — Bloco Cerâmico',         'NBR 15270', '%',   8.0, 22.0, TRUE,  2),
  (0, NULL, 'Desvio em Relação ao Esquadro — Bloco Cerâmico', 'NBR 15270', 'mm', NULL, 3.0, FALSE, 3),

  -- Bloco de Concreto (NBR 6136)
  (0, NULL, 'Resistência à Compressão — Bloco Concreto', 'NBR 6136', 'MPa', 4.0, NULL, TRUE,  1),
  (0, NULL, 'Absorção de Água — Bloco Concreto',         'NBR 6136', '%',   NULL, 10.0, TRUE,  2),

  -- Graut (NBR 6018)
  (0, NULL, 'Consistência (Flow) — Graut',  'NBR 6018', 'mm', 200.0, 300.0, TRUE,  1),
  (0, NULL, 'Resistência à Compressão — Graut', 'NBR 6018', 'MPa', 14.0, NULL, TRUE, 2),

  -- Argamassa (NBR 13276)
  (0, NULL, 'Consistência — Argamassa',      'NBR 13276', 'mm', 210.0, 260.0, TRUE,  1),
  (0, NULL, 'Resistência à Compressão — Argamassa', 'NBR 13276', 'MPa', 2.5, NULL, TRUE, 2),

  -- Cerâmica de Revestimento (NBR 13818)
  (0, NULL, 'Absorção de Água — Cerâmica',   'NBR 13818', '%',   0.0, 10.0, TRUE,  1),
  (0, NULL, 'Resistência ao Manchamento — Cerâmica', 'NBR 13818', 'classe', 3.0, NULL, FALSE, 2);
