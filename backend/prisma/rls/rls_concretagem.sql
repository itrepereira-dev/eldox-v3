-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Concretagem
-- =============================================================================
-- Cobertura: concretagens (rebatizadas de betonadas), caminhões, corpos de
-- prova, fotos, alertas, croqui de rastreabilidade, portal do fornecedor,
-- laudos de laboratório e Relatórios de Ação Corretiva (RAC/ISO 9001).
-- Aplicar após:
--   20260415000001_concretagem_croqui
--   20260415000002_sprint8_concretagem
--   20260416000002_concretagem_consultegeo_gaps
--   20260416000020_concretagem_gaps2
--   20260416100000_rename_betonadas_to_concretagens
--   20260416100001_rename_fk_constraints
--
-- Notas:
--   • A tabela "concretagens" é o novo nome após rename em 20260416100000.
--   • fornecedor_portal_tokens: acesso por token (portal externo read-only).
--     O isolamento por tenant_id ainda é mantido para proteger o fluxo interno.
--   • laudos_laboratorio e racs são documentos formais (PBQP-H / ISO 9001).
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Concretagens (antes: betonadas) ──────────────────────────────────────

ALTER TABLE concretagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concretagens_tenant_isolation ON concretagens;
CREATE POLICY concretagens_tenant_isolation ON concretagens
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Caminhões de Concreto ────────────────────────────────────────────────

ALTER TABLE caminhoes_concreto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS caminhoes_concreto_tenant_isolation ON caminhoes_concreto;
CREATE POLICY caminhoes_concreto_tenant_isolation ON caminhoes_concreto
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Corpos de Prova ──────────────────────────────────────────────────────

ALTER TABLE corpos_de_prova ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS corpos_de_prova_tenant_isolation ON corpos_de_prova;
CREATE POLICY corpos_de_prova_tenant_isolation ON corpos_de_prova
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Fotos e Alertas de Concretagem ───────────────────────────────────────

ALTER TABLE concretagem_fotos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concretagem_fotos_tenant_isolation ON concretagem_fotos;
CREATE POLICY concretagem_fotos_tenant_isolation ON concretagem_fotos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE concretagem_alertas_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concretagem_alertas_log_tenant_isolation ON concretagem_alertas_log;
CREATE POLICY concretagem_alertas_log_tenant_isolation ON concretagem_alertas_log
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 5. Croqui de Rastreabilidade (EldoX.IA) ─────────────────────────────────

ALTER TABLE concretagem_croquis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concretagem_croquis_tenant_isolation ON concretagem_croquis;
CREATE POLICY concretagem_croquis_tenant_isolation ON concretagem_croquis
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 6. Portal do Fornecedor (read-only externo) ─────────────────────────────

ALTER TABLE fornecedor_portal_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fornecedor_portal_tokens_tenant_isolation ON fornecedor_portal_tokens;
CREATE POLICY fornecedor_portal_tokens_tenant_isolation ON fornecedor_portal_tokens
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 7. Laudos de Laboratório ────────────────────────────────────────────────

ALTER TABLE laudos_laboratorio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS laudos_laboratorio_tenant_isolation ON laudos_laboratorio;
CREATE POLICY laudos_laboratorio_tenant_isolation ON laudos_laboratorio
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 8. Relatórios de Ação Corretiva (RAC / ISO 9001) ────────────────────────

ALTER TABLE racs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS racs_tenant_isolation ON racs;
CREATE POLICY racs_tenant_isolation ON racs
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
