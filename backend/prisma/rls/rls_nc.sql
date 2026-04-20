-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Não Conformidades (NC)
-- =============================================================================
-- Cobertura: tabela central de Não Conformidades cross-módulo (categoria =
-- CONCRETAGEM | FVS | FVM | ENSAIO | GERAL).
-- Aplicar após:
--   20260415000003_nao_conformidades
--   20260420000200_nc_evidencia_ged_fk
--
-- Notas:
--   • NCs específicas de FVS (fvs_nao_conformidades) estão cobertas em rls_fvs.sql.
--   • NCs específicas de FVM (fvm_nao_conformidades) estão cobertas em rls_fvm.sql.
--   • Esta policy cobre a tabela CENTRAL "nao_conformidades" que agrega NCs de
--     qualquer módulo, ligada via caminhao_id, cp_id, fvs_ficha_id, etc.
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── Não Conformidades (tabela central cross-módulo) ─────────────────────────

ALTER TABLE nao_conformidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nao_conformidades_tenant_isolation ON nao_conformidades;
CREATE POLICY nao_conformidades_tenant_isolation ON nao_conformidades
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
