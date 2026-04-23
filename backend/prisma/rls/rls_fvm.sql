-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo FVM (Verificação de Materiais)
-- =============================================================================
-- Cobertura: catálogo de materiais, fornecedores, lotes, registros,
-- evidências, NCs, ensaios quantitativos e normas ABNT.
-- Aplicar após:
--   20260414000000_fvm_module
--   20260414000002_fvm_quarentena_evidencia
--   20260416000010_fvm_ensaios
--
-- Notas:
--   • Catálogo (fvm_categorias_materiais, fvm_catalogo_materiais,
--     fvm_catalogo_itens, fvm_documentos_exigidos) e normas/templates
--     permitem tenant_id = 0 (dados de sistema PBQP-H globais).
--   • fvm_normas_abnt e fvm_ensaio_templates têm DEFAULT 0 — seed de sistema.
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Catálogo (tenant_id = 0 permitido) ───────────────────────────────────

ALTER TABLE fvm_categorias_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_categorias_materiais_tenant_isolation ON fvm_categorias_materiais;
CREATE POLICY fvm_categorias_materiais_tenant_isolation ON fvm_categorias_materiais
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_catalogo_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_catalogo_materiais_tenant_isolation ON fvm_catalogo_materiais;
CREATE POLICY fvm_catalogo_materiais_tenant_isolation ON fvm_catalogo_materiais
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_catalogo_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_catalogo_itens_tenant_isolation ON fvm_catalogo_itens;
CREATE POLICY fvm_catalogo_itens_tenant_isolation ON fvm_catalogo_itens
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_documentos_exigidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_documentos_exigidos_tenant_isolation ON fvm_documentos_exigidos;
CREATE POLICY fvm_documentos_exigidos_tenant_isolation ON fvm_documentos_exigidos
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Fornecedores ─────────────────────────────────────────────────────────

ALTER TABLE fvm_fornecedores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_fornecedores_tenant_isolation ON fvm_fornecedores;
CREATE POLICY fvm_fornecedores_tenant_isolation ON fvm_fornecedores
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_fornecedor_materiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_fornecedor_materiais_tenant_isolation ON fvm_fornecedor_materiais;
CREATE POLICY fvm_fornecedor_materiais_tenant_isolation ON fvm_fornecedor_materiais
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Lotes e Inspeção ─────────────────────────────────────────────────────

ALTER TABLE fvm_lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_lotes_tenant_isolation ON fvm_lotes;
CREATE POLICY fvm_lotes_tenant_isolation ON fvm_lotes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_registros_tenant_isolation ON fvm_registros;
CREATE POLICY fvm_registros_tenant_isolation ON fvm_registros
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_evidencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_evidencias_tenant_isolation ON fvm_evidencias;
CREATE POLICY fvm_evidencias_tenant_isolation ON fvm_evidencias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Não Conformidades e Rastreabilidade ──────────────────────────────────

ALTER TABLE fvm_nao_conformidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_nao_conformidades_tenant_isolation ON fvm_nao_conformidades;
CREATE POLICY fvm_nao_conformidades_tenant_isolation ON fvm_nao_conformidades
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_lote_usos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_lote_usos_tenant_isolation ON fvm_lote_usos;
CREATE POLICY fvm_lote_usos_tenant_isolation ON fvm_lote_usos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 5. Inteligência Artificial ──────────────────────────────────────────────

ALTER TABLE fvm_ai_sugestoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_ai_sugestoes_tenant_isolation ON fvm_ai_sugestoes;
CREATE POLICY fvm_ai_sugestoes_tenant_isolation ON fvm_ai_sugestoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 6. Normas ABNT (tenant_id = 0 sistema) ──────────────────────────────────

ALTER TABLE fvm_normas_abnt ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_normas_abnt_tenant_isolation ON fvm_normas_abnt;
CREATE POLICY fvm_normas_abnt_tenant_isolation ON fvm_normas_abnt
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 7. Ensaios Quantitativos (FVM-1 sprint) ────────────────────────────────

-- Templates: tenant_id = 0 = templates de sistema (seeds NBR)
ALTER TABLE fvm_ensaio_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_ensaio_templates_tenant_isolation ON fvm_ensaio_templates;
CREATE POLICY fvm_ensaio_templates_tenant_isolation ON fvm_ensaio_templates
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvm_ensaios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvm_ensaios_tenant_isolation ON fvm_ensaios;
CREATE POLICY fvm_ensaios_tenant_isolation ON fvm_ensaios
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
