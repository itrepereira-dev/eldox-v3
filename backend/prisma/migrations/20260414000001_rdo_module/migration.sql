-- =============================================================================
-- Eldox v3 — Migration: RDO Módulo Diário de Obra
-- Data: 2026-04-14
-- Spec: SPEC-RDO-001
-- Tabelas: 10 (rdos, rdo_clima, rdo_mao_de_obra, rdo_equipamentos,
--              rdo_atividades, rdo_ocorrencias, rdo_checklist_itens,
--              rdo_fotos, rdo_assinaturas, rdo_sugestoes_ia, rdo_log_edicoes)
-- Aplicar com: psql $DATABASE_URL -f migration.sql
-- =============================================================================

-- ── 1. ENUMs ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE rdo_status AS ENUM ('preenchendo', 'revisao', 'aprovado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rdo_periodo AS ENUM ('manha', 'tarde', 'noite');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rdo_condicao_clima AS ENUM ('claro', 'nublado', 'chuvoso');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rdo_tipo_mao_de_obra AS ENUM ('catalogo', 'personalizada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rdo_papel_assinatura AS ENUM ('tecnico', 'fiscal', 'gestor', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. RDOs — Cabeçalho do Diário ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdos (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT         NOT NULL,
  obra_id               INT         NOT NULL,
  data                  DATE        NOT NULL,
  numero                INT         NOT NULL,       -- sequencial por obra
  status                rdo_status  NOT NULL DEFAULT 'preenchendo',

  -- Autoria e aprovação
  criado_por            INT         NOT NULL,
  aprovado_por          INT         NULL,
  aprovado_em           TIMESTAMP   NULL,

  -- Cópia inteligente (rastreia o RDO-origem)
  copiado_de_id         INT         NULL,

  -- IA
  resumo_ia             TEXT        NULL,
  resumo_ia_editado     BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Canal de entrada (TRUE = gerado via AGENTE-CAMPO WhatsApp)
  gerado_via_campo      BOOLEAN     NOT NULL DEFAULT FALSE,

  -- PDF gerado
  pdf_path              VARCHAR(500) NULL,

  created_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP   NULL,

  CONSTRAINT fk_rdos_obra         FOREIGN KEY (obra_id)       REFERENCES "Obra"(id),
  CONSTRAINT fk_rdos_criado_por   FOREIGN KEY (criado_por)    REFERENCES "Usuario"(id),
  CONSTRAINT fk_rdos_aprovado_por FOREIGN KEY (aprovado_por)  REFERENCES "Usuario"(id),
  CONSTRAINT fk_rdos_copiado_de   FOREIGN KEY (copiado_de_id) REFERENCES rdos(id),
  CONSTRAINT uq_rdos_tenant_obra_data UNIQUE (tenant_id, obra_id, data)
);

CREATE INDEX IF NOT EXISTS idx_rdos_tenant              ON rdos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdos_tenant_obra         ON rdos(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_rdos_tenant_obra_status  ON rdos(tenant_id, obra_id, status);
CREATE INDEX IF NOT EXISTS idx_rdos_tenant_data         ON rdos(tenant_id, data DESC);

-- ── 3. RDO Clima — Condição por Período ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_clima (
  id                    SERIAL            PRIMARY KEY,
  tenant_id             INT               NOT NULL,
  rdo_id                INT               NOT NULL,
  periodo               rdo_periodo       NOT NULL,
  condicao              rdo_condicao_clima NOT NULL,
  praticavel            BOOLEAN           NOT NULL,
  chuva_mm              NUMERIC(4, 1)     NULL,

  -- IA
  sugerido_por_ia       BOOLEAN           NOT NULL DEFAULT FALSE,
  confianca_ia          NUMERIC(3, 2)     NULL,   -- 0.00 a 1.00
  fonte_ia              VARCHAR(100)      NULL,
  aplicado_pelo_usuario BOOLEAN           NOT NULL DEFAULT FALSE,

  CONSTRAINT fk_rdo_clima_rdo     FOREIGN KEY (rdo_id) REFERENCES rdos(id),
  CONSTRAINT uq_rdo_clima_periodo UNIQUE (tenant_id, rdo_id, periodo)
);

CREATE INDEX IF NOT EXISTS idx_rdo_clima_tenant     ON rdo_clima(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_clima_tenant_rdo ON rdo_clima(tenant_id, rdo_id);

-- ── 4. RDO Mão de Obra ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_mao_de_obra (
  id                    SERIAL              PRIMARY KEY,
  tenant_id             INT                 NOT NULL,
  rdo_id                INT                 NOT NULL,
  tipo                  rdo_tipo_mao_de_obra NOT NULL,
  funcao                VARCHAR(150)        NOT NULL,
  quantidade            INT                 NOT NULL,
  nome_personalizado    VARCHAR(150)        NULL,
  hora_entrada          TIME                NULL,
  hora_saida            TIME                NULL,

  -- IA
  sugerido_por_ia       BOOLEAN             NOT NULL DEFAULT FALSE,
  confianca_ia          NUMERIC(3, 2)       NULL,
  aplicado_pelo_usuario BOOLEAN             NOT NULL DEFAULT FALSE,

  CONSTRAINT fk_rdo_mao_de_obra_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_mao_de_obra_tenant     ON rdo_mao_de_obra(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_mao_de_obra_tenant_rdo ON rdo_mao_de_obra(tenant_id, rdo_id);

-- ── 5. RDO Equipamentos ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_equipamentos (
  id             SERIAL       PRIMARY KEY,
  tenant_id      INT          NOT NULL,
  rdo_id         INT          NOT NULL,
  nome           VARCHAR(150) NOT NULL,
  quantidade     INT          NOT NULL,
  do_catalogo_id INT          NULL,   -- FK futura para catálogo de equipamentos do tenant

  CONSTRAINT fk_rdo_equipamentos_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_equipamentos_tenant     ON rdo_equipamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_equipamentos_tenant_rdo ON rdo_equipamentos(tenant_id, rdo_id);

-- ── 6. RDO Atividades ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_atividades (
  id                      SERIAL   PRIMARY KEY,
  tenant_id               INT      NOT NULL,
  rdo_id                  INT      NOT NULL,
  descricao               TEXT     NOT NULL,
  etapa_tarefa_id         INT      NULL,   -- FK futura para tabela de tarefas
  hora_inicio             TIME     NULL,
  hora_fim                TIME     NULL,
  progresso_pct           INT      NOT NULL DEFAULT 0
                            CONSTRAINT chk_rdo_ativ_progresso CHECK (progresso_pct BETWEEN 0 AND 100),
  progresso_pct_anterior  INT      NULL,
  ordem                   INT      NOT NULL DEFAULT 0,
  fotos_ids               INT[]    NULL,   -- array de IDs do GED

  -- IA
  sugerido_por_ia         BOOLEAN  NOT NULL DEFAULT FALSE,
  prioridade_ia           INT      NULL,   -- ranking do AGENTE-ATIVIDADE
  aplicado_pelo_usuario   BOOLEAN  NOT NULL DEFAULT FALSE,

  CONSTRAINT fk_rdo_atividades_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_atividades_tenant     ON rdo_atividades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_tenant_rdo ON rdo_atividades(tenant_id, rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_atividades_rdo_ordem  ON rdo_atividades(rdo_id, ordem);

-- ── 7. RDO Ocorrências ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_ocorrencias (
  id                 SERIAL   PRIMARY KEY,
  tenant_id          INT      NOT NULL,
  rdo_id             INT      NOT NULL,
  descricao          TEXT     NOT NULL,
  tags               TEXT[]   NULL,
  tipo_ocorrencia_id INT      NULL,   -- FK futura para catálogo de tipos do tenant

  CONSTRAINT fk_rdo_ocorrencias_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_tenant     ON rdo_ocorrencias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_ocorrencias_tenant_rdo ON rdo_ocorrencias(tenant_id, rdo_id);

-- ── 8. RDO Checklist Itens ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_checklist_itens (
  id               SERIAL   PRIMARY KEY,
  tenant_id        INT      NOT NULL,
  rdo_id           INT      NOT NULL,
  descricao        TEXT     NOT NULL,
  marcado          BOOLEAN  NOT NULL DEFAULT FALSE,
  template_item_id INT      NULL,   -- FK futura para templates de checklist
  ordem            INT      NOT NULL DEFAULT 0,

  CONSTRAINT fk_rdo_checklist_itens_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_checklist_itens_tenant     ON rdo_checklist_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_checklist_itens_tenant_rdo ON rdo_checklist_itens(tenant_id, rdo_id);

-- ── 9. RDO Fotos ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_fotos (
  id                SERIAL        PRIMARY KEY,
  tenant_id         INT           NOT NULL,
  rdo_id            INT           NOT NULL,
  atividade_id      INT           NULL,
  ged_documento_id  INT           NULL,   -- FK GED (ged_documentos.id)
  legenda           VARCHAR(300)  NOT NULL DEFAULT '',
  classificacao_ia  VARCHAR(150)  NULL,   -- resultado de visão computacional
  ordem             INT           NOT NULL DEFAULT 0,

  CONSTRAINT fk_rdo_fotos_rdo        FOREIGN KEY (rdo_id)       REFERENCES rdos(id),
  CONSTRAINT fk_rdo_fotos_atividade  FOREIGN KEY (atividade_id) REFERENCES rdo_atividades(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_fotos_tenant      ON rdo_fotos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_fotos_tenant_rdo  ON rdo_fotos(tenant_id, rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_fotos_atividade   ON rdo_fotos(atividade_id);

-- ── 10. RDO Assinaturas ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_assinaturas (
  id                SERIAL               PRIMARY KEY,
  tenant_id         INT                  NOT NULL,
  rdo_id            INT                  NOT NULL,
  papel             rdo_papel_assinatura NOT NULL,
  usuario_id        INT                  NOT NULL,
  assinatura_base64 TEXT                 NOT NULL,
  assinado_em       TIMESTAMP            NOT NULL,

  CONSTRAINT fk_rdo_assinaturas_rdo     FOREIGN KEY (rdo_id)     REFERENCES rdos(id),
  CONSTRAINT fk_rdo_assinaturas_usuario FOREIGN KEY (usuario_id) REFERENCES "Usuario"(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_assinaturas_tenant     ON rdo_assinaturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_assinaturas_tenant_rdo ON rdo_assinaturas(tenant_id, rdo_id);

-- ── 11. RDO Sugestões IA ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rdo_sugestoes_ia (
  id              SERIAL        PRIMARY KEY,
  tenant_id       INT           NOT NULL,
  rdo_id          INT           NOT NULL,
  agente          VARCHAR(50)   NOT NULL,   -- 'clima'|'equipe'|'atividade'|'validador'
  campo_afetado   VARCHAR(100)  NOT NULL,
  valor_sugerido  JSONB         NOT NULL,
  valor_aplicado  JSONB         NULL,
  acao            VARCHAR(20)   NULL,       -- 'aplicou'|'ignorou'|'editou'

  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_rdo_sugestoes_ia_rdo FOREIGN KEY (rdo_id) REFERENCES rdos(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_sugestoes_ia_tenant          ON rdo_sugestoes_ia(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_sugestoes_ia_tenant_rdo      ON rdo_sugestoes_ia(tenant_id, rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_sugestoes_ia_tenant_rdo_agente ON rdo_sugestoes_ia(tenant_id, rdo_id, agente);

-- ── 12. RDO Log de Edições — IMUTÁVEL (sem updated_at, sem deleted_at) ────────

CREATE TABLE IF NOT EXISTS rdo_log_edicoes (
  id              SERIAL       PRIMARY KEY,
  tenant_id       INT          NOT NULL,
  rdo_id          INT          NOT NULL,
  usuario_id      INT          NULL,   -- nullable: pode ser ação de agente IA
  campo           VARCHAR(100) NOT NULL,
  valor_anterior  JSONB        NULL,
  valor_novo      JSONB        NULL,
  via             VARCHAR(20)  NOT NULL,  -- 'web'|'whatsapp'|'ia'|'api'
  ip_origem       VARCHAR(45)  NULL,

  -- APENAS created_at — tabela é append-only e imutável
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_rdo_log_edicoes_rdo     FOREIGN KEY (rdo_id)     REFERENCES rdos(id),
  CONSTRAINT fk_rdo_log_edicoes_usuario FOREIGN KEY (usuario_id) REFERENCES "Usuario"(id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_log_edicoes_tenant          ON rdo_log_edicoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rdo_log_edicoes_tenant_rdo      ON rdo_log_edicoes(tenant_id, rdo_id);
CREATE INDEX IF NOT EXISTS idx_rdo_log_edicoes_tenant_rdo_campo ON rdo_log_edicoes(tenant_id, rdo_id, campo);
CREATE INDEX IF NOT EXISTS idx_rdo_log_edicoes_tenant_created  ON rdo_log_edicoes(tenant_id, created_at DESC);

-- ── 13. Trigger: updated_at automático ───────────────────────────────────────
-- (Reutiliza função set_updated_at se já existir de migrations anteriores)

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rdos_updated_at
  BEFORE UPDATE ON rdos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 14. RLS — habilitação (políticas no rls/rls_rdo.sql) ─────────────────────

ALTER TABLE rdos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_clima          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_mao_de_obra    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_equipamentos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_atividades     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_ocorrencias    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_checklist_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_fotos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_assinaturas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_sugestoes_ia   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rdo_log_edicoes    ENABLE ROW LEVEL SECURITY;
