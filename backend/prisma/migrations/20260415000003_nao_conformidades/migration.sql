-- CreateEnum
CREATE TYPE "NcCategoria" AS ENUM ('CONCRETAGEM', 'FVS', 'FVM', 'ENSAIO', 'GERAL');

-- CreateEnum
CREATE TYPE "NcCriticidade" AS ENUM ('ALTA', 'MEDIA', 'BAIXA');

-- CreateEnum
CREATE TYPE "NcStatus" AS ENUM ('ABERTA', 'EM_ANALISE', 'TRATAMENTO', 'VERIFICACAO', 'FECHADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "nao_conformidades" (
  "id"              SERIAL PRIMARY KEY,
  "tenant_id"       INTEGER NOT NULL,
  "obra_id"         INTEGER NOT NULL,
  "numero"          VARCHAR(30) NOT NULL,
  "categoria"       "NcCategoria" NOT NULL DEFAULT 'GERAL',
  "criticidade"     "NcCriticidade" NOT NULL DEFAULT 'MEDIA',
  "titulo"          VARCHAR(200) NOT NULL,
  "descricao"       TEXT,
  "status"          "NcStatus" NOT NULL DEFAULT 'ABERTA',
  "caminhao_id"     INTEGER,
  "cp_id"           INTEGER,
  "fvs_ficha_id"    INTEGER,
  "fvm_lote_id"     INTEGER,
  "ensaio_id"       INTEGER,
  "aberta_por"      INTEGER NOT NULL DEFAULT 0,
  "responsavel_id"  INTEGER,
  "prazo"           TIMESTAMP(3),
  "data_fechamento" TIMESTAMP(3),
  "evidencia_url"   VARCHAR(500),
  "observacoes"     TEXT,
  "deleted_at"      TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "idx_ncs_tenant" ON "nao_conformidades" ("tenant_id");

-- CreateIndex
CREATE INDEX "idx_ncs_tenant_obra" ON "nao_conformidades" ("tenant_id", "obra_id");

-- CreateIndex
CREATE INDEX "idx_ncs_tenant_status" ON "nao_conformidades" ("tenant_id", "status");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "uq_nao_conformidades_numero" ON "nao_conformidades" ("tenant_id", "numero");
