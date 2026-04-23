-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Controle de Efetivo
-- =============================================================================
-- Cobertura: empresas, funções, registros diários de mão de obra, itens,
-- audit log, padrões (cache IA) e alertas.
-- Aplicar após:
--   20260415000010_efetivo_module
--
-- Notas:
--   • efetivo_audit_log: policy permissiva; append-only não forçado em DB
--     (controlado pelo service).
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Empresas e Funções ───────────────────────────────────────────────────

ALTER TABLE empresas_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresas_efetivo_tenant_isolation ON empresas_efetivo;
CREATE POLICY empresas_efetivo_tenant_isolation ON empresas_efetivo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE funcoes_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funcoes_efetivo_tenant_isolation ON funcoes_efetivo;
CREATE POLICY funcoes_efetivo_tenant_isolation ON funcoes_efetivo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Registros e Itens ────────────────────────────────────────────────────

ALTER TABLE registros_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registros_efetivo_tenant_isolation ON registros_efetivo;
CREATE POLICY registros_efetivo_tenant_isolation ON registros_efetivo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE itens_efetivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS itens_efetivo_tenant_isolation ON itens_efetivo;
CREATE POLICY itens_efetivo_tenant_isolation ON itens_efetivo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Audit Log ────────────────────────────────────────────────────────────

ALTER TABLE efetivo_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS efetivo_audit_log_select ON efetivo_audit_log;
CREATE POLICY efetivo_audit_log_select ON efetivo_audit_log
  FOR SELECT
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
DROP POLICY IF EXISTS efetivo_audit_log_insert ON efetivo_audit_log;
CREATE POLICY efetivo_audit_log_insert ON efetivo_audit_log
  FOR INSERT
  WITH CHECK (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Padrões (cache IA) e Alertas ─────────────────────────────────────────

ALTER TABLE efetivo_padroes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS efetivo_padroes_tenant_isolation ON efetivo_padroes;
CREATE POLICY efetivo_padroes_tenant_isolation ON efetivo_padroes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE efetivo_alertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS efetivo_alertas_tenant_isolation ON efetivo_alertas;
CREATE POLICY efetivo_alertas_tenant_isolation ON efetivo_alertas
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
