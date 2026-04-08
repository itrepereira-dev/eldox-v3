-- =============================================================================
-- Eldox v3 — Migration: GED Module (Gestão Eletrônica de Documentos)
-- Versão SPEC: 1.2.0 | Data: 2026-04-07
-- Agente: DBA | Input: SPEC-GED.md
-- =============================================================================
-- ATENÇÃO: Esta migration usa SQL puro (não gerenciada pelo Prisma) por exigir:
--   • GENERATED ALWAYS AS (colunas calculadas)
--   • Materialized path com TEXT pattern ops index
--   • Audit log INSERT-only (enforced via trigger)
--   • pgvector (habilitado em 20260407000001_eldoxia_mvp)
-- Aplicar com: psql $DATABASE_URL -f <este-arquivo>
-- RLS: ver prisma/migrations/rls/rls.sql (atualizado nesta versão)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DEPENDÊNCIA: habilitar extensão uuid se ainda não estiver ativa
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. ged_pasta_config_tipos
--    Registro extensível de dimensões de compliance (zero-migration para novas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_pasta_config_tipos (
  chave        VARCHAR(50) PRIMARY KEY,
  label        VARCHAR(100) NOT NULL,
  tipo_valor   VARCHAR(20) NOT NULL
    CONSTRAINT chk_tipo_valor CHECK (tipo_valor IN ('int', 'int[]', 'text[]', 'boolean', 'string')),
  descricao    TEXT,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seeds obrigatórias — as 5 dimensões de compliance do MVP
INSERT INTO ged_pasta_config_tipos (chave, label, tipo_valor, descricao) VALUES
  ('workflow',           'Workflow de aprovação',       'int',    'ID do template de workflow aplicado aos documentos desta pasta'),
  ('categorias_aceitas', 'Categorias aceitas',          'int[]',  'IDs de ged_categorias permitidas nesta pasta'),
  ('acesso_roles',       'Perfis com acesso',           'text[]', 'Roles (strings) que podem ver e operar nesta pasta'),
  ('retencao_anos',      'Retenção mínima (anos)',      'int',    'Tempo mínimo de guarda antes de arquivar/expurgar'),
  ('watermark_ativo',   'Marca d''água em downloads',  'boolean','Adiciona marca d''água ao baixar documentos desta pasta')
ON CONFLICT (chave) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. ged_pastas
--    Árvore de pastas com contexto de compliance por pasta
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_pastas (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  escopo            VARCHAR(10) NOT NULL
    CONSTRAINT chk_pasta_escopo CHECK (escopo IN ('EMPRESA', 'OBRA')),
  obra_id           INT REFERENCES "Obra"(id) ON DELETE RESTRICT,
  parent_id         INT REFERENCES ged_pastas(id) ON DELETE RESTRICT,
  nome              VARCHAR(100) NOT NULL,
  descricao         TEXT,
  -- Materialized path para queries eficientes de subárvore
  -- Raiz:    "/0/"
  -- Filha:   "/0/5/"
  -- Neta:    "/0/5/12/"
  -- Todos descendentes de id=5: WHERE path LIKE '/0/5/%'
  path              TEXT NOT NULL,
  nivel             INT NOT NULL DEFAULT 0,
  -- Configurações PRÓPRIAS desta pasta (pode estar vazio → herda tudo do pai)
  -- { "workflow": { "valor": 5, "modo": "SOBRESCREVER" },
  --   "acesso_roles": { "valor": ["ENGENHEIRO","ADMIN_TENANT"], "modo": "BLOQUEAR" } }
  -- modo: HERDAR | SOBRESCREVER | BLOQUEAR
  configuracoes     JSONB NOT NULL DEFAULT '{}',
  -- Cache da herança resolvida — sempre atualizado pelo job ged.pastas
  -- { "workflow": { "valor": 5, "modo": "SOBRESCREVER", "herdado_de": null },
  --   "acesso_roles": { "valor": ["ENGENHEIRO"], "modo": "BLOQUEAR", "herdado_de": 3 } }
  settings_efetivos JSONB NOT NULL DEFAULT '{}',
  deleted_at        TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_pasta_obra_id CHECK (
    (escopo = 'OBRA'    AND obra_id IS NOT NULL) OR
    (escopo = 'EMPRESA' AND obra_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ged_pastas_tenant   ON ged_pastas(tenant_id, escopo, obra_id);
CREATE INDEX IF NOT EXISTS idx_ged_pastas_parent   ON ged_pastas(tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_ged_pastas_path     ON ged_pastas(tenant_id, path text_pattern_ops);

-- ---------------------------------------------------------------------------
-- 3. ged_workflow_templates
--    Templates de workflow configuráveis por tenant
--    tenant_id = 0 → templates padrão do sistema (visíveis para todos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_workflow_templates (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  tipo        VARCHAR(20) NOT NULL
    CONSTRAINT chk_wf_tipo CHECK (tipo IN ('SEQUENCIAL', 'PARALELO', 'AD_HOC', 'LIVRE')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  deleted_at  TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. ged_workflow_steps
--    Passos de cada template de workflow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_workflow_steps (
  id                SERIAL PRIMARY KEY,
  template_id       INT NOT NULL REFERENCES ged_workflow_templates(id) ON DELETE CASCADE,
  ordem             INT NOT NULL,
  nome              VARCHAR(100) NOT NULL,
  role_minima       VARCHAR(30) NOT NULL
    CONSTRAINT chk_step_role CHECK (role_minima IN ('TECNICO', 'ENGENHEIRO', 'ADMIN_TENANT')),
  obrigatorio       BOOLEAN NOT NULL DEFAULT true,
  prazo_horas       INT,          -- NULL = sem prazo
  condicao_avanco   VARCHAR(5) NOT NULL DEFAULT 'AND'
    CONSTRAINT chk_condicao CHECK (condicao_avanco IN ('AND', 'OR')),
  acao_timeout      VARCHAR(20) NOT NULL DEFAULT 'ALERTAR'
    CONSTRAINT chk_timeout CHECK (acao_timeout IN ('ALERTAR', 'AVANCAR_AUTO', 'ESCALAR')),
  UNIQUE (template_id, ordem)
);

-- Seeds: workflow padrão do sistema
INSERT INTO ged_workflow_templates (id, tenant_id, nome, descricao, tipo) VALUES
  (1, 0, 'Simples (1 aprovador)', 'Aprovação única por engenheiro', 'SEQUENCIAL'),
  (2, 0, 'Duplo (2 aprovadores)', 'Aprovação sequencial: revisor → aprovador final', 'SEQUENCIAL')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ged_workflow_steps (template_id, ordem, nome, role_minima, obrigatorio) VALUES
  (1, 1, 'Aprovação Engenheiro', 'ENGENHEIRO', true),
  (2, 1, 'Revisão Técnica',      'TECNICO',    true),
  (2, 2, 'Aprovação Final',      'ENGENHEIRO', true)
ON CONFLICT (template_id, ordem) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. ged_categorias
--    Categorias de documento (tenant_id=0 = sistema, visível para todos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_categorias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  nome                VARCHAR(100) NOT NULL,
  codigo              VARCHAR(20) NOT NULL,
  escopo_padrao       VARCHAR(10) NOT NULL DEFAULT 'OBRA'
    CONSTRAINT chk_cat_escopo CHECK (escopo_padrao IN ('OBRA', 'EMPRESA', 'AMBOS')),
  requer_aprovacao    BOOLEAN NOT NULL DEFAULT true,
  prazo_revisao_dias  INT,
  workflow_default_id INT REFERENCES ged_workflow_templates(id),
  deleted_at          TIMESTAMP NULL,
  UNIQUE (tenant_id, codigo)
);

-- Seeds: categorias de sistema (tenant_id = 0)
INSERT INTO ged_categorias (tenant_id, nome, codigo, escopo_padrao, requer_aprovacao, prazo_revisao_dias, workflow_default_id) VALUES
  -- Escopo OBRA
  (0, 'Plantas Baixas',             'PLT', 'OBRA',    true,  365,  1),
  (0, 'Especificações Técnicas',    'ESP', 'OBRA',    true,  365,  1),
  (0, 'Memorial Descritivo',        'MEM', 'OBRA',    true,  365,  1),
  (0, 'Laudos e Ensaios',           'LAU', 'OBRA',    true,  180,  1),
  (0, 'ARTs / RRTs (obra)',         'ART', 'OBRA',    true,  365,  1),
  (0, 'Manuais de Equipamento',     'MAN', 'OBRA',    false, NULL, NULL),
  (0, 'Fotos de Evidência',         'FTO', 'OBRA',    false, NULL, NULL),
  (0, 'Relatório Diário de Obra',   'RDO', 'OBRA',    false, NULL, NULL),
  -- Escopo EMPRESA
  (0, 'Responsável Técnico',        'RT',  'EMPRESA', true,  365,  1),
  (0, 'Licenças',                   'LIC', 'EMPRESA', true,  365,  1),
  (0, 'Contratos',                  'CTR', 'EMPRESA', true,  NULL, 2),
  (0, 'Certidões',                  'CER', 'EMPRESA', true,  180,  1),
  (0, 'Saúde e Segurança do Trabalho','SST','EMPRESA', true, 365,  1),
  (0, 'Administrativo Geral',       'ADM', 'EMPRESA', false, NULL, NULL)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. ged_documentos
--    Entidade lógica — agrupa todas as versões de um documento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_documentos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  escopo          VARCHAR(10) NOT NULL DEFAULT 'OBRA'
    CONSTRAINT chk_doc_escopo CHECK (escopo IN ('EMPRESA', 'OBRA')),
  obra_id         INT REFERENCES "Obra"(id) ON DELETE RESTRICT,
  obra_local_id   INT REFERENCES "ObraLocal"(id) ON DELETE SET NULL,
  categoria_id    INT NOT NULL REFERENCES ged_categorias(id),
  pasta_id        INT NOT NULL REFERENCES ged_pastas(id) ON DELETE RESTRICT,
  titulo          VARCHAR(255) NOT NULL,
  -- Código gerado automaticamente no upload: OBRA-DISC-SEQ (ex: EDX001-ARQ-003)
  -- Para documentos EMPRESA: TENANT-CAT-SEQ (ex: ELDOX-RT-001)
  codigo          VARCHAR(50) NOT NULL,
  disciplina      VARCHAR(5)
    CONSTRAINT chk_disciplina CHECK (disciplina IN ('ARQ','EST','HID','ELE','MEC','GEO', NULL)),
  tags            TEXT[],
  deleted_at      TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, codigo),
  CONSTRAINT chk_doc_obra_id CHECK (
    (escopo = 'OBRA'    AND obra_id IS NOT NULL) OR
    (escopo = 'EMPRESA' AND obra_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_ged_docs_tenant_obra   ON ged_documentos(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_ged_docs_tenant_local  ON ged_documentos(tenant_id, obra_local_id);
CREATE INDEX IF NOT EXISTS idx_ged_docs_tenant_escopo ON ged_documentos(tenant_id, escopo);
CREATE INDEX IF NOT EXISTS idx_ged_docs_pasta         ON ged_documentos(tenant_id, pasta_id);

-- ---------------------------------------------------------------------------
-- 7. ged_documento_compartilhamentos
--    Compartilhamento de documentos EMPRESA com obras específicas
--    Um documento EMPRESA pode aparecer em N obras (com badge [Admin])
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_documento_compartilhamentos (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  documento_id        INT NOT NULL REFERENCES ged_documentos(id) ON DELETE CASCADE,
  obra_id             INT NOT NULL REFERENCES "Obra"(id) ON DELETE CASCADE,
  compartilhado_por   INT NOT NULL REFERENCES "Usuario"(id),
  compartilhado_em    TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (documento_id, obra_id)
);

CREATE INDEX IF NOT EXISTS idx_ged_compartilhamentos ON ged_documento_compartilhamentos(tenant_id, obra_id);

-- ---------------------------------------------------------------------------
-- 8. ged_versoes
--    Instância física de um documento — arquivo no MinIO + metadados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_versoes (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  documento_id        INT NOT NULL REFERENCES ged_documentos(id) ON DELETE RESTRICT,
  -- numero_revisao: editável pelo usuário (espelha carimbo do documento)
  -- ex: 0, A, B, C ou 00, 01, 02
  numero_revisao      VARCHAR(10) NOT NULL DEFAULT '0',
  -- version: auto-incrementado pelo sistema, nunca editável
  -- garante unicidade mesmo se numero_revisao for reusado
  version             INT NOT NULL DEFAULT 1,
  status              VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO'
    CONSTRAINT chk_versao_status CHECK (
      status IN ('RASCUNHO','IFA','IFC','IFP','AS_BUILT','REJEITADO','OBSOLETO','CANCELADO')
    ),
  -- status_emissao: calculado pelo sistema a partir do status
  -- NULL  → documento ainda não emitido (RASCUNHO, IFA, REJEITADO, CANCELADO)
  -- VIGENTE → aprovado e em uso (IFC, IFP, AS_BUILT)
  -- OBSOLETO → substituído por versão mais nova
  status_emissao      VARCHAR(10) GENERATED ALWAYS AS (
    CASE status
      WHEN 'IFC'      THEN 'VIGENTE'
      WHEN 'IFP'      THEN 'VIGENTE'
      WHEN 'AS_BUILT' THEN 'VIGENTE'
      WHEN 'OBSOLETO' THEN 'OBSOLETO'
      ELSE NULL
    END
  ) STORED,
  -- Armazenamento MinIO
  storage_key         VARCHAR(500) NOT NULL,
  storage_bucket      VARCHAR(100) NOT NULL,
  mime_type           VARCHAR(100) NOT NULL,
  tamanho_bytes       BIGINT NOT NULL,
  checksum_sha256     VARCHAR(64) NOT NULL,
  nome_original       VARCHAR(255) NOT NULL,
  descricao           TEXT,
  formato_plotagem    VARCHAR(5)
    CONSTRAINT chk_plotagem CHECK (formato_plotagem IN ('A0','A1','A2','A3','A4', NULL)),
  data_validade       DATE NULL,
  -- Metadados extraídos pelo pipeline de IA
  ocr_texto           TEXT,                    -- GED-OCR: texto extraído do documento
  ai_categorias       TEXT[],                  -- GED-CLASSIFIER: categorias sugeridas
  ai_confianca        DECIMAL(3,2),            -- 0.00 a 1.00
  ai_metadata         JSONB,                   -- campos extraídos do carimbo ABNT
  -- Aprovação
  criado_por          INT NOT NULL REFERENCES "Usuario"(id),
  aprovado_por        INT REFERENCES "Usuario"(id),
  aprovado_em         TIMESTAMP NULL,
  comentario_rejeicao TEXT,
  -- Workflow
  workflow_template_id INT REFERENCES ged_workflow_templates(id),
  workflow_step_atual  INT DEFAULT 0,
  -- QR Code: token imutável que sempre aponta para a versão VIGENTE do documento
  -- Rota pública: GET /api/v1/ged/qr/:qrToken
  qr_token            UUID NOT NULL DEFAULT gen_random_uuid(),
  deleted_at          TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (documento_id, numero_revisao, version)
);

CREATE INDEX IF NOT EXISTS idx_ged_versoes_tenant_doc ON ged_versoes(tenant_id, documento_id, status);
CREATE INDEX IF NOT EXISTS idx_ged_versoes_validade   ON ged_versoes(tenant_id, data_validade)
  WHERE deleted_at IS NULL AND data_validade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ged_versoes_qr         ON ged_versoes(qr_token);
CREATE INDEX IF NOT EXISTS idx_ged_versoes_vigentes   ON ged_versoes(tenant_id, documento_id)
  WHERE status IN ('IFC', 'IFP', 'AS_BUILT');

-- ---------------------------------------------------------------------------
-- 9. ged_workflow_execucoes
--    Histórico de passos executados em cada workflow
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_workflow_execucoes (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  versao_id   INT NOT NULL REFERENCES ged_versoes(id) ON DELETE RESTRICT,
  template_id INT NOT NULL REFERENCES ged_workflow_templates(id),
  step_id     INT NOT NULL REFERENCES ged_workflow_steps(id),
  usuario_id  INT NOT NULL REFERENCES "Usuario"(id),
  acao        VARCHAR(20) NOT NULL
    CONSTRAINT chk_wf_acao CHECK (acao IN ('APROVADO','REJEITADO','COMENTADO','DELEGADO')),
  comentario  TEXT,
  executado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ged_wf_exec ON ged_workflow_execucoes(tenant_id, versao_id);

-- ---------------------------------------------------------------------------
-- 10. ged_transmittals
--     Distribuição formal rastreada de documentos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_transmittals (
  id                      SERIAL PRIMARY KEY,
  tenant_id               INT NOT NULL,
  obra_id                 INT NOT NULL REFERENCES "Obra"(id) ON DELETE RESTRICT,
  numero                  VARCHAR(20) NOT NULL,
  assunto                 TEXT NOT NULL,
  notas                   TEXT,
  prazo_resposta          DATE,
  status                  VARCHAR(20) NOT NULL DEFAULT 'RASCUNHO'
    CONSTRAINT chk_transmittal_status CHECK (
      status IN ('RASCUNHO','ENVIADO','RESPONDIDO','VENCIDO')
    ),
  criado_por              INT NOT NULL REFERENCES "Usuario"(id),
  enviado_em              TIMESTAMP,
  -- preenchido quando este transmittal é correção/complemento de um anterior
  transmittal_anterior_id INT REFERENCES ged_transmittals(id) NULL,
  deleted_at              TIMESTAMP NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, obra_id, numero)
);

CREATE TABLE IF NOT EXISTS ged_transmittal_itens (
  id              SERIAL PRIMARY KEY,
  transmittal_id  INT NOT NULL REFERENCES ged_transmittals(id) ON DELETE CASCADE,
  versao_id       INT NOT NULL REFERENCES ged_versoes(id) ON DELETE RESTRICT,
  finalidade      VARCHAR(30) NOT NULL
    CONSTRAINT chk_finalidade CHECK (
      finalidade IN ('PARA_APROVACAO','PARA_INFORMACAO','PARA_CONSTRUCAO','PARA_COMPRA')
    )
);

CREATE TABLE IF NOT EXISTS ged_transmittal_destinatarios (
  id              SERIAL PRIMARY KEY,
  transmittal_id  INT NOT NULL REFERENCES ged_transmittals(id) ON DELETE CASCADE,
  usuario_id      INT REFERENCES "Usuario"(id),
  email_externo   VARCHAR(255),
  whatsapp        VARCHAR(20),
  canal           VARCHAR(20) NOT NULL
    CONSTRAINT chk_canal CHECK (canal IN ('SISTEMA','EMAIL','WHATSAPP')),
  -- Token de acesso público (sem login) para destinatários externos
  token_acesso    UUID NOT NULL DEFAULT gen_random_uuid(),
  token_expira_em TIMESTAMP,
  enviado_em      TIMESTAMP,
  lido_em         TIMESTAMP,
  respondido_em   TIMESTAMP,
  resposta        TEXT,
  CONSTRAINT chk_destinatario CHECK (
    usuario_id IS NOT NULL OR email_externo IS NOT NULL OR whatsapp IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_ged_transmittals_tenant ON ged_transmittals(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_ged_transmittal_token   ON ged_transmittal_destinatarios(token_acesso);

-- ---------------------------------------------------------------------------
-- 11. ged_audit_log
--     Append-only — nunca UPDATE, nunca DELETE, nunca soft-delete
--     Trigger protege contra UPDATE/DELETE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_audit_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  versao_id   INT NOT NULL,
  usuario_id  INT,             -- NULL = ação de sistema (CRON, trigger)
  acao        VARCHAR(50) NOT NULL
    CONSTRAINT chk_audit_acao CHECK (acao IN (
      'UPLOAD','SUBMISSAO','APROVACAO','REJEICAO','DOWNLOAD',
      'VIGENCIA','OBSOLESCENCIA','QR_SCAN','CANCELAMENTO',
      'TRANSMITTAL_ENVIO','TRANSMITTAL_LEITURA','TRANSMITTAL_RESPOSTA',
      'WORKFLOW_STEP','PASTA_CRIADA','PASTA_ALTERADA','COMPARTILHAMENTO'
    )),
  status_de   VARCHAR(20),
  status_para VARCHAR(20),
  ip_origem   INET,
  user_agent  TEXT,
  detalhes    JSONB,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ged_audit_tenant ON ged_audit_log(tenant_id, versao_id);
CREATE INDEX IF NOT EXISTS idx_ged_audit_tempo  ON ged_audit_log(tenant_id, criado_em DESC);

-- Trigger: impede UPDATE e DELETE no audit log (imutabilidade absoluta)
CREATE OR REPLACE FUNCTION ged_audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ged_audit_log é append-only: UPDATE e DELETE não são permitidos';
END;
$$;

DROP TRIGGER IF EXISTS trg_ged_audit_log_immutable ON ged_audit_log;
CREATE TRIGGER trg_ged_audit_log_immutable
  BEFORE UPDATE OR DELETE ON ged_audit_log
  FOR EACH ROW EXECUTE FUNCTION ged_audit_log_immutable();

-- ---------------------------------------------------------------------------
-- 12. ged_configuracoes
--     Configurações globais do GED por tenant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ged_configuracoes (
  tenant_id               INT PRIMARY KEY REFERENCES "Tenant"(id),
  modo_auditoria          BOOLEAN NOT NULL DEFAULT false,  -- toggle PBQP-H / ISO 9001
  workflow_obrigatorio    BOOLEAN NOT NULL DEFAULT false,  -- exige workflow completo para IFC
  qr_code_ativo           BOOLEAN NOT NULL DEFAULT true,
  ocr_ativo               BOOLEAN NOT NULL DEFAULT true,
  whatsapp_ativo          BOOLEAN NOT NULL DEFAULT false,
  autodesk_aps_ativo      BOOLEAN NOT NULL DEFAULT false,  -- add-on pago (ADR-023)
  storage_limite_gb       INT NOT NULL DEFAULT 10,
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 13. whatsapp_configuracoes
--     Credenciais Meta Cloud API por tenant (criptografadas em repouso)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_configuracoes (
  tenant_id            INT PRIMARY KEY REFERENCES "Tenant"(id),
  phone_number_id      VARCHAR(50) NOT NULL,
  waba_id              VARCHAR(50) NOT NULL,
  -- access_token DEVE ser criptografado pela aplicação antes de armazenar
  -- (AES-256-GCM com chave do env ENCRYPTION_KEY)
  access_token         TEXT NOT NULL,
  webhook_verify_token VARCHAR(100),
  ativo                BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- GRANT: aplicar permissões para a role da aplicação
-- =============================================================================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'eldox_app') THEN
    GRANT SELECT, INSERT, UPDATE ON
      ged_pasta_config_tipos,
      ged_pastas,
      ged_workflow_templates,
      ged_workflow_steps,
      ged_workflow_execucoes,
      ged_categorias,
      ged_documentos,
      ged_documento_compartilhamentos,
      ged_versoes,
      ged_transmittals,
      ged_transmittal_itens,
      ged_transmittal_destinatarios,
      ged_configuracoes,
      whatsapp_configuracoes
    TO eldox_app;

    -- audit_log: somente INSERT (imutabilidade reforçada pelo grant)
    GRANT INSERT ON ged_audit_log TO eldox_app;

    -- sequences
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eldox_app;
  END IF;
END $$;

-- =============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- =============================================================================
-- Execute após aplicar para confirmar que todas as tabelas foram criadas:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name LIKE 'ged_%' OR table_name LIKE 'whatsapp_%'
--   ORDER BY table_name;
--
-- Esperado: 13 tabelas
--   ged_audit_log, ged_categorias, ged_configuracoes,
--   ged_documento_compartilhamentos, ged_documentos, ged_pasta_config_tipos,
--   ged_pastas, ged_transmittal_destinatarios, ged_transmittal_itens,
--   ged_transmittals, ged_versoes, ged_workflow_execucoes,
--   ged_workflow_steps, ged_workflow_templates,
--   whatsapp_configuracoes
-- =============================================================================
