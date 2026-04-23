-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo FVS (Verificação de Serviços)
-- =============================================================================
-- Cobertura: catálogo, inspeções, modelos, NCs, pareceres, RO e timeline.
-- Aplicar após:
--   20260408000000_fvs_catalogo
--   20260408000001_fvs_inspecao
--   20260409000000_fvs_sprint3_ro_parecer
--   20260410000000_fvs_sprint4a_modelos
--   20260413100000_fvs_sprint4b_nc_ciclo
--   20260416000003_fvs_sprint_c
--   20260419000001_fvs_modelo_servicos_item_fotos
--
-- Notas:
--   • Tabelas de catálogo (fvs_categorias_servico, fvs_catalogo_servicos,
--     fvs_catalogo_itens) aceitam tenant_id = 0 (dados de sistema PBQP-H),
--     visíveis para todos os tenants.
--   • SUPERUSER (usado pelo Prisma nas migrations/seeds) bypassa RLS.
--   • Até task #31 (role eldox_app + middleware), as policies ficam inertes.
--   • Idempotente: DROP POLICY IF EXISTS antes de CREATE.
-- =============================================================================


-- ─── 1. Catálogo (tenant_id = 0 permitido = sistema PBQP-H) ──────────────────

ALTER TABLE fvs_categorias_servico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_categorias_servico_tenant_isolation ON fvs_categorias_servico;
CREATE POLICY fvs_categorias_servico_tenant_isolation ON fvs_categorias_servico
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_catalogo_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_catalogo_servicos_tenant_isolation ON fvs_catalogo_servicos;
CREATE POLICY fvs_catalogo_servicos_tenant_isolation ON fvs_catalogo_servicos
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_catalogo_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_catalogo_itens_tenant_isolation ON fvs_catalogo_itens;
CREATE POLICY fvs_catalogo_itens_tenant_isolation ON fvs_catalogo_itens
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Fichas e Inspeção ────────────────────────────────────────────────────

ALTER TABLE fvs_fichas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_fichas_tenant_isolation ON fvs_fichas;
CREATE POLICY fvs_fichas_tenant_isolation ON fvs_fichas
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_ficha_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_ficha_servicos_tenant_isolation ON fvs_ficha_servicos;
CREATE POLICY fvs_ficha_servicos_tenant_isolation ON fvs_ficha_servicos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_ficha_servico_locais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_ficha_servico_locais_tenant_isolation ON fvs_ficha_servico_locais;
CREATE POLICY fvs_ficha_servico_locais_tenant_isolation ON fvs_ficha_servico_locais
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_registros_tenant_isolation ON fvs_registros;
CREATE POLICY fvs_registros_tenant_isolation ON fvs_registros
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_evidencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_evidencias_tenant_isolation ON fvs_evidencias;
CREATE POLICY fvs_evidencias_tenant_isolation ON fvs_evidencias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- Audit log FVS — SELECT e INSERT; sem UPDATE/DELETE (append-only implícito)
ALTER TABLE fvs_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_audit_log_select ON fvs_audit_log;
CREATE POLICY fvs_audit_log_select ON fvs_audit_log
  FOR SELECT
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
DROP POLICY IF EXISTS fvs_audit_log_insert ON fvs_audit_log;
CREATE POLICY fvs_audit_log_insert ON fvs_audit_log
  FOR INSERT
  WITH CHECK (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Modelos (templates de inspeção) ──────────────────────────────────────

ALTER TABLE fvs_modelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_modelos_tenant_isolation ON fvs_modelos;
CREATE POLICY fvs_modelos_tenant_isolation ON fvs_modelos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_modelo_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_modelo_servicos_tenant_isolation ON fvs_modelo_servicos;
CREATE POLICY fvs_modelo_servicos_tenant_isolation ON fvs_modelo_servicos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE obra_modelo_fvs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS obra_modelo_fvs_tenant_isolation ON obra_modelo_fvs;
CREATE POLICY obra_modelo_fvs_tenant_isolation ON obra_modelo_fvs
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Não Conformidades (FVS) ──────────────────────────────────────────────

ALTER TABLE fvs_nao_conformidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_nao_conformidades_tenant_isolation ON fvs_nao_conformidades;
CREATE POLICY fvs_nao_conformidades_tenant_isolation ON fvs_nao_conformidades
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_nc_tratamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_nc_tratamentos_tenant_isolation ON fvs_nc_tratamentos;
CREATE POLICY fvs_nc_tratamentos_tenant_isolation ON fvs_nc_tratamentos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 5. Markup, Timeline e Pareceres ─────────────────────────────────────────

ALTER TABLE fvs_markup_anotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_markup_anotacoes_tenant_isolation ON fvs_markup_anotacoes;
CREATE POLICY fvs_markup_anotacoes_tenant_isolation ON fvs_markup_anotacoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_timeline_tenant_isolation ON fvs_timeline;
CREATE POLICY fvs_timeline_tenant_isolation ON fvs_timeline
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE fvs_pareceres ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fvs_pareceres_tenant_isolation ON fvs_pareceres;
CREATE POLICY fvs_pareceres_tenant_isolation ON fvs_pareceres
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
