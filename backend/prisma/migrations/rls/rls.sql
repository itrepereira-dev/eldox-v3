-- =============================================================================
-- Eldox v3 — Row Level Security (RLS)
-- =============================================================================
-- Este arquivo é aplicado MANUALMENTE após as migrations Prisma.
-- O Prisma não gerencia RLS, por isso ele vive aqui como script separado.
--
-- Para aplicar:
--   psql $DATABASE_URL -f prisma/migrations/rls/rls.sql
--
-- SUPERUSER (usado pelo Prisma nas migrations e seeds) bypassa RLS
-- automaticamente — nenhuma configuração extra necessária para isso.
--
-- Em produção, cada request da aplicação deve setar o tenant antes de
-- qualquer query:
--   SET LOCAL app.tenant_id = '<id>';
--
-- Changelog:
--   2026-04-07: + GED module (14 tabelas) + EldoxIA MVP (5 tabelas)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Habilitar RLS nas tabelas de negócio
--    (Tenant não precisa: é a tabela-raiz, acessada pelo SUPERUSER/migrations)
-- -----------------------------------------------------------------------------

ALTER TABLE "Usuario"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Obra"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ObraLocal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ObraTipo" ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 2. Criar role de aplicação (se não existir)
--    Esta role é usada pela conexão do app em produção (não pelo Prisma).
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'eldox_app') THEN
    CREATE ROLE eldox_app;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 3. Políticas de isolamento por tenant
-- -----------------------------------------------------------------------------

-- Usuario: acessa apenas registros do próprio tenant
CREATE POLICY tenant_isolation ON "Usuario"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = "tenantId");

-- Obra: acessa apenas obras do próprio tenant
CREATE POLICY tenant_isolation ON "Obra"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = "tenantId");

-- ObraLocal: acessa apenas locais do próprio tenant
CREATE POLICY tenant_isolation ON "ObraLocal"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = "tenantId");

-- ObraTipo: acessa tipos do sistema (tenantId = 0) OU do próprio tenant
--   tenantId = 0 → registros globais compartilhados entre todos os tenants
CREATE POLICY tenant_isolation ON "ObraTipo"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    "tenantId" = 0
    OR current_setting('app.tenant_id', true)::int = "tenantId"
  );


-- -----------------------------------------------------------------------------
-- 4. Notas de operação
-- -----------------------------------------------------------------------------
-- • SUPERUSER (role usada pelo Prisma) bypassa RLS automaticamente.
--   Migrations e seeds rodam sem SET LOCAL — seguro por design.
--
-- • Se quiser restringir também INSERTS além de SELECT, adicione WITH CHECK:
--     CREATE POLICY tenant_isolation ON "Usuario"
--       USING (...)
--       WITH CHECK (current_setting('app.tenant_id', true)::int = "tenantId");
--
-- • Para re-aplicar após DROP das políticas:
--     DROP POLICY IF EXISTS tenant_isolation ON "Usuario";
--     -- (repetir para cada tabela)
--     -- e rodar este script novamente
-- =============================================================================


-- =============================================================================
-- 5. GED Module — Row Level Security
--    Aplicar após: 20260407000000_ged_module/migration.sql
-- =============================================================================

-- ged_pastas: isolamento por tenant
ALTER TABLE ged_pastas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_pastas
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_documentos: isolamento por tenant
ALTER TABLE ged_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_documentos
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_documento_compartilhamentos: isolamento por tenant
ALTER TABLE ged_documento_compartilhamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_documento_compartilhamentos
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_versoes: isolamento por tenant
ALTER TABLE ged_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_versoes
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_workflow_templates: sistema (tenant_id=0) visível para todos + tenant próprio
ALTER TABLE ged_workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_workflow_templates
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id = 0
    OR current_setting('app.tenant_id', true)::int = tenant_id
  );

-- ged_workflow_execucoes: isolamento por tenant
ALTER TABLE ged_workflow_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_workflow_execucoes
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_transmittals: isolamento por tenant
ALTER TABLE ged_transmittals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_transmittals
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_audit_log: isolamento por tenant (append-only enforced por trigger)
ALTER TABLE ged_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_audit_log
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_categorias: sistema (tenant_id=0) + tenant próprio
ALTER TABLE ged_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_categorias
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    tenant_id = 0
    OR current_setting('app.tenant_id', true)::int = tenant_id
  );

-- ged_configuracoes: isolamento por tenant
ALTER TABLE ged_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ged_configuracoes
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- whatsapp_configuracoes: isolamento por tenant (credenciais sensíveis)
ALTER TABLE whatsapp_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON whatsapp_configuracoes
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ged_pasta_config_tipos: tabela global (sem tenant_id) — sem RLS
-- ged_workflow_steps: lookup global via template_id — sem RLS


-- =============================================================================
-- 6. EldoxIA MVP — Row Level Security
--    Aplicar após: 20260407000001_eldoxia_mvp/migration.sql
-- =============================================================================

-- ia_conversas: isolamento por tenant
ALTER TABLE ia_conversas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ia_conversas
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ia_mensagens: isolamento por tenant
ALTER TABLE ia_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ia_mensagens
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ia_acoes_pendentes: isolamento por tenant
ALTER TABLE ia_acoes_pendentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ia_acoes_pendentes
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ia_uso_tokens: isolamento por tenant
ALTER TABLE ia_uso_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ia_uso_tokens
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- ia_memoria: isolamento por tenant
ALTER TABLE ia_memoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ia_memoria
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
