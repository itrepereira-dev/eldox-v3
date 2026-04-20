-- =============================================================================
-- Eldox v3 — Row Level Security: Planos de Ação, RO e Cache Semáforo PBQP-H
-- =============================================================================
-- Cobertura:
--   • pa_*: Planos de Ação corretivos configuráveis (config + instâncias)
--   • ro_*: Relatórios de Ocorrência (ciclo FVS Sprint 3)
--   • semaforo_pbqph_cache: cache de scores PBQP-H por obra/módulo
-- Aplicar após:
--   20260409000000_fvs_sprint3_ro_parecer
--   20260416200000_add_planos_acao
--   20260420400000_semaforo_pbqph_cache
--
-- Notas:
--   • pa_config_etapa, pa_config_campo, pa_config_gatilho e pa_historico têm
--     tenant_id direto (coluna populada pelo service).
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Planos de Ação (configuração do ciclo) ──────────────────────────────

ALTER TABLE pa_config_ciclo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_config_ciclo_tenant_isolation ON pa_config_ciclo;
CREATE POLICY pa_config_ciclo_tenant_isolation ON pa_config_ciclo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE pa_config_etapa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_config_etapa_tenant_isolation ON pa_config_etapa;
CREATE POLICY pa_config_etapa_tenant_isolation ON pa_config_etapa
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE pa_config_campo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_config_campo_tenant_isolation ON pa_config_campo;
CREATE POLICY pa_config_campo_tenant_isolation ON pa_config_campo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE pa_config_gatilho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_config_gatilho_tenant_isolation ON pa_config_gatilho;
CREATE POLICY pa_config_gatilho_tenant_isolation ON pa_config_gatilho
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Planos de Ação (instâncias + histórico) ─────────────────────────────

ALTER TABLE pa_plano_acao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_plano_acao_tenant_isolation ON pa_plano_acao;
CREATE POLICY pa_plano_acao_tenant_isolation ON pa_plano_acao
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE pa_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pa_historico_tenant_isolation ON pa_historico;
CREATE POLICY pa_historico_tenant_isolation ON pa_historico
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Relatórios de Ocorrência (RO — FVS Sprint 3) ────────────────────────

ALTER TABLE ro_ocorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ro_ocorrencias_tenant_isolation ON ro_ocorrencias;
CREATE POLICY ro_ocorrencias_tenant_isolation ON ro_ocorrencias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ro_servicos_nc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ro_servicos_nc_tenant_isolation ON ro_servicos_nc;
CREATE POLICY ro_servicos_nc_tenant_isolation ON ro_servicos_nc
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ro_servico_itens_nc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ro_servico_itens_nc_tenant_isolation ON ro_servico_itens_nc;
CREATE POLICY ro_servico_itens_nc_tenant_isolation ON ro_servico_itens_nc
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE ro_servico_evidencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ro_servico_evidencias_tenant_isolation ON ro_servico_evidencias;
CREATE POLICY ro_servico_evidencias_tenant_isolation ON ro_servico_evidencias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Semáforo PBQP-H (cache de scores por módulo) ────────────────────────

ALTER TABLE semaforo_pbqph_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS semaforo_pbqph_cache_tenant_isolation ON semaforo_pbqph_cache;
CREATE POLICY semaforo_pbqph_cache_tenant_isolation ON semaforo_pbqph_cache
  USING (current_setting('app.tenant_id', true)::int = tenant_id);
