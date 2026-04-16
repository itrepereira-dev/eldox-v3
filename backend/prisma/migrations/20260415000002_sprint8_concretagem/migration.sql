-- Migration: 20260415000002_sprint8_concretagem
-- Sprint 8 — Concretagem: Betonadas, Caminhões, Corpos de Prova, Alertas

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "StatusBetonada" AS ENUM (
  'PROGRAMADA',
  'EM_LANCAMENTO',
  'CONCLUIDA',
  'CANCELADA'
);

CREATE TYPE "StatusCaminhao" AS ENUM (
  'CHEGOU',
  'EM_LANCAMENTO',
  'CONCLUIDO',
  'REJEITADO'
);

CREATE TYPE "StatusCp" AS ENUM (
  'AGUARDANDO_RUPTURA',
  'ROMPIDO_APROVADO',
  'ROMPIDO_REPROVADO',
  'CANCELADO'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- betonadas
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "betonadas" (
  "id"                  SERIAL              NOT NULL,
  "tenant_id"           INTEGER             NOT NULL,
  "obra_id"             INTEGER             NOT NULL,
  "numero"              VARCHAR(30)         NOT NULL,
  "elemento_estrutural" VARCHAR(200)        NOT NULL,
  "obra_local_id"       INTEGER,
  "volume_previsto"     DECIMAL(8,2)        NOT NULL,
  "traco_especificado"  VARCHAR(100),
  "fck_especificado"    INTEGER             NOT NULL,
  "fornecedor_id"       INTEGER             NOT NULL,
  "data_programada"     DATE                NOT NULL,
  "hora_programada"     TIME,
  "status"              "StatusBetonada"    NOT NULL DEFAULT 'PROGRAMADA',
  "responsavel_id"      INTEGER,
  "observacoes"         TEXT,
  "criado_por"          INTEGER             NOT NULL,
  "created_at"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"          TIMESTAMP(3),

  CONSTRAINT "betonadas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_betonada_numero"       ON "betonadas" ("tenant_id", "numero") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_betonada_tenant"             ON "betonadas" ("tenant_id");
CREATE INDEX "idx_betonada_tenant_obra"        ON "betonadas" ("tenant_id", "obra_id");
CREATE INDEX "idx_betonada_status"             ON "betonadas" ("tenant_id", "obra_id", "status");
CREATE INDEX "idx_betonada_data_programada"    ON "betonadas" ("tenant_id", "obra_id", "data_programada");

-- ─────────────────────────────────────────────────────────────────────────────
-- caminhoes_concreto
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "caminhoes_concreto" (
  "id"                     SERIAL              NOT NULL,
  "tenant_id"              INTEGER             NOT NULL,
  "betonada_id"            INTEGER             NOT NULL,
  "sequencia"              INTEGER             NOT NULL,
  "numero_nf"              VARCHAR(50)         NOT NULL,
  "data_emissao_nf"        DATE                NOT NULL,
  "volume"                 DECIMAL(6,2)        NOT NULL,
  "motorista"              VARCHAR(150),
  "placa"                  VARCHAR(10),
  "hora_chegada"           TIME,
  "hora_inicio_lancamento" TIME,
  "hora_fim_lancamento"    TIME,
  "elemento_lancado"       VARCHAR(200),
  "slump_especificado"     DECIMAL(4,1),
  "slump_medido"           DECIMAL(4,1),
  "temperatura"            DECIMAL(4,1),
  "incidentes"             TEXT,
  "status"                 "StatusCaminhao"    NOT NULL DEFAULT 'CHEGOU',
  "nf_vencida"             BOOLEAN             NOT NULL DEFAULT FALSE,
  "registrado_por"         INTEGER             NOT NULL,
  "created_at"             TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "caminhoes_concreto_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_caminhao_betonada" FOREIGN KEY ("betonada_id") REFERENCES "betonadas"("id")
);

CREATE INDEX "idx_caminhao_tenant"          ON "caminhoes_concreto" ("tenant_id");
CREATE INDEX "idx_caminhao_betonada"        ON "caminhoes_concreto" ("tenant_id", "betonada_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- corpos_de_prova
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "corpos_de_prova" (
  "id"               SERIAL          NOT NULL,
  "tenant_id"        INTEGER         NOT NULL,
  "betonada_id"      INTEGER         NOT NULL,
  "caminhao_id"      INTEGER         NOT NULL,
  "numero"           VARCHAR(20)     NOT NULL,
  "idade_dias"       INTEGER         NOT NULL,
  "data_moldagem"    DATE            NOT NULL,
  "data_ruptura_prev" DATE           NOT NULL,
  "data_ruptura_real" DATE,
  "resistencia"      DECIMAL(6,2),
  "status"           "StatusCp"      NOT NULL DEFAULT 'AGUARDANDO_RUPTURA',
  "alerta_enviado"   BOOLEAN         NOT NULL DEFAULT FALSE,
  "laboratorio_id"   INTEGER,
  "rompido_por"      INTEGER,
  "observacoes"      TEXT,
  "created_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "corpos_de_prova_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_cp_betonada"   FOREIGN KEY ("betonada_id") REFERENCES "betonadas"("id"),
  CONSTRAINT "fk_cp_caminhao"   FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes_concreto"("id")
);

CREATE INDEX "idx_cp_tenant"              ON "corpos_de_prova" ("tenant_id");
CREATE INDEX "idx_cp_betonada"            ON "corpos_de_prova" ("tenant_id", "betonada_id");
CREATE INDEX "idx_cp_ruptura_alerta"      ON "corpos_de_prova" ("tenant_id", "data_ruptura_prev", "alerta_enviado");

-- ─────────────────────────────────────────────────────────────────────────────
-- concretagem_fotos
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "concretagem_fotos" (
  "id"               SERIAL          NOT NULL,
  "tenant_id"        INTEGER         NOT NULL,
  "caminhao_id"      INTEGER         NOT NULL,
  "ged_documento_id" INTEGER,
  "legenda"          VARCHAR(300),
  "ordem"            INTEGER         NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concretagem_fotos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fk_foto_caminhao" FOREIGN KEY ("caminhao_id") REFERENCES "caminhoes_concreto"("id")
);

CREATE INDEX "idx_foto_caminhao" ON "concretagem_fotos" ("tenant_id", "caminhao_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- concretagem_alertas_log  (registros BullMQ processor)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "concretagem_alertas_log" (
  "id"            SERIAL          NOT NULL,
  "tenant_id"     INTEGER         NOT NULL,
  "cp_id"         INTEGER         NOT NULL,
  "tipo"          VARCHAR(50)     NOT NULL DEFAULT 'RUPTURA_PROXIMA',
  "destinatario"  VARCHAR(200),
  "status"        VARCHAR(30)     NOT NULL DEFAULT 'ENVIADO',
  "tentativas"    INTEGER         NOT NULL DEFAULT 1,
  "erro"          TEXT,
  "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "concretagem_alertas_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_alertas_log_cp" ON "concretagem_alertas_log" ("tenant_id", "cp_id");
