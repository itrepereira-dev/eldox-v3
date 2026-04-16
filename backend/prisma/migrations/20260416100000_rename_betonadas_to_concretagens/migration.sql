-- Migration: 20260416100000_rename_betonadas_to_concretagens

-- 1. Renomear enum
ALTER TYPE "StatusBetonada" RENAME TO "StatusConcretagem";

-- 2. Adicionar novo valor ao enum
ALTER TYPE "StatusConcretagem" ADD VALUE IF NOT EXISTS 'EM_RASTREABILIDADE';

-- 3. Renomear tabela principal
ALTER TABLE "betonadas" RENAME TO "concretagens";

-- 4. Renomear constraint de PK
ALTER TABLE "concretagens" RENAME CONSTRAINT "betonadas_pkey" TO "concretagens_pkey";

-- 5. Renomear coluna FK em caminhoes_concreto
ALTER TABLE "caminhoes_concreto" RENAME COLUMN "betonada_id" TO "concretagem_id";
ALTER TABLE "caminhoes_concreto" RENAME CONSTRAINT "fk_caminhao_betonada" TO "fk_caminhao_concretagem";

-- 6. Renomear coluna FK em corpos_de_prova
ALTER TABLE "corpos_de_prova" RENAME COLUMN "betonada_id" TO "concretagem_id";
ALTER TABLE "corpos_de_prova" RENAME CONSTRAINT "fk_cp_betonada" TO "fk_cp_concretagem";

-- 7. Renomear coluna FK em fornecedor_portal_tokens
-- (FK constraint name is fornecedor_portal_tokens_betonada_id_fkey - skip rename, just rename column)
ALTER TABLE "fornecedor_portal_tokens" RENAME COLUMN "betonada_id" TO "concretagem_id";

-- 8. Renomear coluna FK em laudos_laboratorio
ALTER TABLE "laudos_laboratorio" RENAME COLUMN "betonada_id" TO "concretagem_id";

-- 9. Recriar índices com novos nomes
DROP INDEX IF EXISTS "uq_betonada_numero";
CREATE UNIQUE INDEX "uq_concretagem_numero" ON "concretagens" ("tenant_id", "numero") WHERE "deleted_at" IS NULL;

DROP INDEX IF EXISTS "idx_betonada_tenant";
CREATE INDEX "idx_concretagem_tenant"           ON "concretagens" ("tenant_id");

DROP INDEX IF EXISTS "idx_betonada_tenant_obra";
CREATE INDEX "idx_concretagem_tenant_obra"      ON "concretagens" ("tenant_id", "obra_id");

DROP INDEX IF EXISTS "idx_betonada_status";
CREATE INDEX "idx_concretagem_status"           ON "concretagens" ("tenant_id", "obra_id", "status");

DROP INDEX IF EXISTS "idx_betonada_data_programada";
CREATE INDEX "idx_concretagem_data_programada"  ON "concretagens" ("tenant_id", "obra_id", "data_programada");

DROP INDEX IF EXISTS "idx_caminhao_betonada";
CREATE INDEX "idx_caminhao_concretagem" ON "caminhoes_concreto" ("tenant_id", "concretagem_id");

DROP INDEX IF EXISTS "idx_cp_betonada";
CREATE INDEX "idx_cp_concretagem" ON "corpos_de_prova" ("tenant_id", "concretagem_id");

DROP INDEX IF EXISTS "idx_portal_tokens_betonada";
CREATE INDEX "idx_portal_tokens_concretagem" ON "fornecedor_portal_tokens" ("tenant_id", "concretagem_id");

DROP INDEX IF EXISTS "idx_laudo_betonada";
CREATE INDEX "idx_laudo_concretagem" ON "laudos_laboratorio" ("tenant_id", "concretagem_id");
