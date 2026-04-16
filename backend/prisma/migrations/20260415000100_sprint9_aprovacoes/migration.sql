-- Sprint 9 — Workflow de Aprovações
-- Criado manualmente em 2026-04-15

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AprovacaoStatus" AS ENUM ('PENDENTE', 'EM_APROVACAO', 'APROVADO', 'REPROVADO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AprovacaoModulo" AS ENUM ('FVS', 'FVM', 'RDO', 'NC', 'GED', 'ENSAIO', 'CONCRETAGEM', 'ALMOXARIFADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoAprovador" AS ENUM ('RESPONSAVEL_OBRA', 'ROLE', 'USUARIO_FIXO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AcaoVencimento" AS ENUM ('ESCALAR', 'AVANCAR', 'BLOQUEAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AcaoRejeicao" AS ENUM ('RETORNAR_SOLICITANTE', 'RETORNAR_ETAPA_1', 'RETORNAR_ETAPA_ANTERIOR', 'BLOQUEAR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AddColumn responsavel_id to Obra (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Obra' AND column_name = 'responsavel_id'
  ) THEN
    ALTER TABLE "Obra" ADD COLUMN "responsavel_id" INTEGER;
  END IF;
END $$;

-- CreateTable workflow_templates
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id"           SERIAL PRIMARY KEY,
  "tenant_id"    INTEGER NOT NULL,
  "nome"         VARCHAR(200) NOT NULL,
  "modulo"       "AprovacaoModulo" NOT NULL,
  "descricao"    TEXT,
  "ativo"        BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"   TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "idx_workflow_templates_tenant_modulo_ativo"
  ON "workflow_templates" ("tenant_id", "modulo", "ativo");

-- CreateTable workflow_template_etapas
CREATE TABLE IF NOT EXISTS "workflow_template_etapas" (
  "id"               SERIAL PRIMARY KEY,
  "template_id"      INTEGER NOT NULL REFERENCES "workflow_templates"("id"),
  "ordem"            INTEGER NOT NULL,
  "nome"             VARCHAR(200) NOT NULL,
  "tipo_aprovador"   "TipoAprovador" NOT NULL,
  "role"             VARCHAR(50),
  "usuario_fixo_id"  INTEGER,
  "condicao"         JSONB,
  "prazo_horas"      INTEGER NOT NULL DEFAULT 48,
  "acao_vencimento"  "AcaoVencimento" NOT NULL DEFAULT 'ESCALAR',
  "acao_rejeicao"    "AcaoRejeicao" NOT NULL DEFAULT 'RETORNAR_SOLICITANTE',
  UNIQUE ("template_id", "ordem")
);

-- CreateTable aprovacao_instancias
CREATE TABLE IF NOT EXISTS "aprovacao_instancias" (
  "id"                       SERIAL PRIMARY KEY,
  "tenant_id"                INTEGER NOT NULL,
  "template_id"              INTEGER NOT NULL REFERENCES "workflow_templates"("id"),
  "modulo"                   "AprovacaoModulo" NOT NULL,
  "entidade_id"              INTEGER NOT NULL,
  "entidade_tipo"            VARCHAR(50) NOT NULL,
  "obra_id"                  INTEGER,
  "snapshot_json"            JSONB NOT NULL,
  "etapa_atual"              INTEGER NOT NULL,
  "status"                   "AprovacaoStatus" NOT NULL DEFAULT 'PENDENTE',
  "titulo"                   VARCHAR(300) NOT NULL,
  "solicitante_id"           INTEGER NOT NULL,
  "alerta_escalacao_enviado" BOOLEAN NOT NULL DEFAULT false,
  "created_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"               TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "idx_aprovacao_instancias_tenant_status"
  ON "aprovacao_instancias" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "idx_aprovacao_instancias_tenant_modulo_status"
  ON "aprovacao_instancias" ("tenant_id", "modulo", "status");

CREATE INDEX IF NOT EXISTS "idx_aprovacao_instancias_tenant_obra_status"
  ON "aprovacao_instancias" ("tenant_id", "obra_id", "status");

CREATE INDEX IF NOT EXISTS "idx_aprovacao_instancias_tenant_solicitante"
  ON "aprovacao_instancias" ("tenant_id", "solicitante_id");

-- CreateTable aprovacao_decisoes
CREATE TABLE IF NOT EXISTS "aprovacao_decisoes" (
  "id"           SERIAL PRIMARY KEY,
  "tenant_id"    INTEGER NOT NULL,
  "instancia_id" INTEGER NOT NULL REFERENCES "aprovacao_instancias"("id"),
  "etapa_ordem"  INTEGER NOT NULL,
  "usuario_id"   INTEGER NOT NULL,
  "decisao"      VARCHAR(30) NOT NULL,
  "observacao"   TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_aprovacao_decisoes_tenant_instancia"
  ON "aprovacao_decisoes" ("tenant_id", "instancia_id");
