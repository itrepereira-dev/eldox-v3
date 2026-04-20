-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Ensaios Laboratoriais
-- =============================================================================
-- Cobertura: tipos de ensaio, frequências, laboratórios, ensaios laboratoriais,
-- resultados, arquivos (PDFs de laudo), revisões e log de alertas.
-- Aplicar após:
--   20260414000003_ensaio_tipos
--   20260414000004_ensaio_laboratorial
--   20260414000005_ensaio_alertas
--   20260420130000_ensaio_laudo_ged
--   20260420210000_ensaio_ged_spec_ref
--
-- Notas:
--   • Todas as tabelas têm tenant_id obrigatório (NOT NULL) — isolamento estrito.
--   • ensaio_revisao_historico: policy permissiva; append-only garantido pela
--     lógica do service (não há política DELETE restrita aqui).
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Tipos de Ensaio e Frequência ─────────────────────────────────────────

ALTER TABLE ensaio_tipo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_tipo_tenant_isolation ON ensaio_tipo;
CREATE POLICY ensaio_tipo_tenant_isolation ON ensaio_tipo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ensaio_frequencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_frequencia_tenant_isolation ON ensaio_frequencia;
CREATE POLICY ensaio_frequencia_tenant_isolation ON ensaio_frequencia
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Laboratórios ─────────────────────────────────────────────────────────

ALTER TABLE laboratorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS laboratorios_tenant_isolation ON laboratorios;
CREATE POLICY laboratorios_tenant_isolation ON laboratorios
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Ensaio Laboratorial ──────────────────────────────────────────────────

ALTER TABLE ensaio_laboratorial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_laboratorial_tenant_isolation ON ensaio_laboratorial;
CREATE POLICY ensaio_laboratorial_tenant_isolation ON ensaio_laboratorial
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ensaio_resultado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_resultado_tenant_isolation ON ensaio_resultado;
CREATE POLICY ensaio_resultado_tenant_isolation ON ensaio_resultado
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ensaio_arquivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_arquivo_tenant_isolation ON ensaio_arquivo;
CREATE POLICY ensaio_arquivo_tenant_isolation ON ensaio_arquivo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Revisões (workflow interno) ──────────────────────────────────────────

ALTER TABLE ensaio_revisao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_revisao_tenant_isolation ON ensaio_revisao;
CREATE POLICY ensaio_revisao_tenant_isolation ON ensaio_revisao
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ensaio_revisao_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_revisao_historico_tenant_isolation ON ensaio_revisao_historico;
CREATE POLICY ensaio_revisao_historico_tenant_isolation ON ensaio_revisao_historico
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 5. Alertas (BullMQ + WhatsApp) ──────────────────────────────────────────

ALTER TABLE ensaio_alerta_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ensaio_alerta_log_tenant_isolation ON ensaio_alerta_log;
CREATE POLICY ensaio_alerta_log_tenant_isolation ON ensaio_alerta_log
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
