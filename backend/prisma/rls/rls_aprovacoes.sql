-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Workflow de Aprovações
-- =============================================================================
-- Cobertura: templates de workflow, etapas, instâncias e decisões.
-- Aplicar após:
--   20260415000100_sprint9_aprovacoes
--
-- Notas:
--   • workflow_template_etapas não tem tenant_id direto — isolamento via JOIN
--     com workflow_templates.
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Templates de Workflow ────────────────────────────────────────────────

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_templates_tenant_isolation ON workflow_templates;
CREATE POLICY workflow_templates_tenant_isolation ON workflow_templates
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- workflow_template_etapas: sem tenant_id próprio — JOIN com workflow_templates
ALTER TABLE workflow_template_etapas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workflow_template_etapas_tenant_isolation ON workflow_template_etapas;
CREATE POLICY workflow_template_etapas_tenant_isolation ON workflow_template_etapas
  USING (EXISTS (
    SELECT 1 FROM workflow_templates t
    WHERE t.id = workflow_template_etapas.template_id
      AND current_setting('app.tenant_id', true)::int = t.tenant_id
  ));


-- ─── 2. Instâncias e Decisões ────────────────────────────────────────────────

ALTER TABLE aprovacao_instancias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aprovacao_instancias_tenant_isolation ON aprovacao_instancias;
CREATE POLICY aprovacao_instancias_tenant_isolation ON aprovacao_instancias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE aprovacao_decisoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aprovacao_decisoes_tenant_isolation ON aprovacao_decisoes;
CREATE POLICY aprovacao_decisoes_tenant_isolation ON aprovacao_decisoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
