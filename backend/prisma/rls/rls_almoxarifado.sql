-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo Almoxarifado (ALM)
-- =============================================================================
-- Cobertura: locais, estoque, movimentos, orçamento, planejamento, fluxo de
-- aprovação, solicitações, cotações, ordens de compra, notas fiscais,
-- transferências, conversões, alertas e sugestões IA.
-- Aplicar após:
--   20260415000201_sinapi_variantes
--   20260415000202_cotacoes_completo
--   20260416000001_almoxarifado_init
--   20260417000001_almoxarifado_erp
--   20260417000004_alm_sugestoes_ia
--   20260420000100_alm_orcamento_itens_sinapi_codigo_fix
--   20260420000101_alm_cotacoes_oc_fix
--   20260420110000_alm_conversoes_seed
--
-- Notas:
--   • alm_unidades_conversao: tenant_id = 0 permitido (seeds de conversão SI +
--     embalagens de construção).
--   • Tabelas de itens (alm_solicitacao_itens, alm_cotacao_itens, alm_oc_itens,
--     alm_nfe_itens, alm_transferencia_itens) NÃO têm tenant_id direto — o
--     isolamento é garantido via JOIN com a tabela-pai (que tem tenant_id).
--   • sinapi_insumos: tabela global de referência (sem tenant_id) — NÃO tem
--     RLS (leitura pública intencional).
--   • SUPERUSER bypassa RLS. Policies ficam inertes até task #31.
-- =============================================================================


-- ─── 1. Locais (ERP multi-location) ──────────────────────────────────────────

ALTER TABLE alm_locais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_locais_tenant_isolation ON alm_locais;
CREATE POLICY alm_locais_tenant_isolation ON alm_locais
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 2. Estoque e Movimentos ─────────────────────────────────────────────────

ALTER TABLE alm_estoque_saldo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_estoque_saldo_tenant_isolation ON alm_estoque_saldo;
CREATE POLICY alm_estoque_saldo_tenant_isolation ON alm_estoque_saldo
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_movimentos_tenant_isolation ON alm_movimentos;
CREATE POLICY alm_movimentos_tenant_isolation ON alm_movimentos
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 3. Orçamento e Planejamento ─────────────────────────────────────────────

ALTER TABLE alm_orcamento_versoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_orcamento_versoes_tenant_isolation ON alm_orcamento_versoes;
CREATE POLICY alm_orcamento_versoes_tenant_isolation ON alm_orcamento_versoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_orcamento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_orcamento_itens_tenant_isolation ON alm_orcamento_itens;
CREATE POLICY alm_orcamento_itens_tenant_isolation ON alm_orcamento_itens
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_planejamento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_planejamento_itens_tenant_isolation ON alm_planejamento_itens;
CREATE POLICY alm_planejamento_itens_tenant_isolation ON alm_planejamento_itens
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 4. Fluxo de Aprovação ──────────────────────────────────────────────────

ALTER TABLE alm_fluxo_aprovacao_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_fluxo_aprovacao_config_tenant_isolation ON alm_fluxo_aprovacao_config;
CREATE POLICY alm_fluxo_aprovacao_config_tenant_isolation ON alm_fluxo_aprovacao_config
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 5. Solicitações de Compra ───────────────────────────────────────────────

ALTER TABLE alm_solicitacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_solicitacoes_tenant_isolation ON alm_solicitacoes;
CREATE POLICY alm_solicitacoes_tenant_isolation ON alm_solicitacoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- alm_solicitacao_itens: sem tenant_id próprio — JOIN com alm_solicitacoes
ALTER TABLE alm_solicitacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_solicitacao_itens_tenant_isolation ON alm_solicitacao_itens;
CREATE POLICY alm_solicitacao_itens_tenant_isolation ON alm_solicitacao_itens
  USING (EXISTS (
    SELECT 1 FROM alm_solicitacoes s
    WHERE s.id = alm_solicitacao_itens.solicitacao_id
      AND current_setting('app.tenant_id', true)::int = s.tenant_id
  ));

ALTER TABLE alm_aprovacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_aprovacoes_tenant_isolation ON alm_aprovacoes;
CREATE POLICY alm_aprovacoes_tenant_isolation ON alm_aprovacoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 6. Cotações ─────────────────────────────────────────────────────────────

ALTER TABLE alm_cotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_cotacoes_tenant_isolation ON alm_cotacoes;
CREATE POLICY alm_cotacoes_tenant_isolation ON alm_cotacoes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- alm_cotacao_itens: sem tenant_id próprio — JOIN com alm_cotacoes
ALTER TABLE alm_cotacao_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_cotacao_itens_tenant_isolation ON alm_cotacao_itens;
CREATE POLICY alm_cotacao_itens_tenant_isolation ON alm_cotacao_itens
  USING (EXISTS (
    SELECT 1 FROM alm_cotacoes c
    WHERE c.id = alm_cotacao_itens.cotacao_id
      AND current_setting('app.tenant_id', true)::int = c.tenant_id
  ));


-- ─── 7. Ordens de Compra ─────────────────────────────────────────────────────

ALTER TABLE alm_ordens_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_ordens_compra_tenant_isolation ON alm_ordens_compra;
CREATE POLICY alm_ordens_compra_tenant_isolation ON alm_ordens_compra
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- alm_oc_itens: sem tenant_id próprio — JOIN com alm_ordens_compra
ALTER TABLE alm_oc_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_oc_itens_tenant_isolation ON alm_oc_itens;
CREATE POLICY alm_oc_itens_tenant_isolation ON alm_oc_itens
  USING (EXISTS (
    SELECT 1 FROM alm_ordens_compra oc
    WHERE oc.id = alm_oc_itens.oc_id
      AND current_setting('app.tenant_id', true)::int = oc.tenant_id
  ));


-- ─── 8. Notas Fiscais e Webhooks ─────────────────────────────────────────────

-- alm_nfe_webhooks: tenant_id é NULLable (pode chegar webhook antes de match)
-- Aceita NULL (webhook sem tenant ainda) ou do tenant atual
ALTER TABLE alm_nfe_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_nfe_webhooks_tenant_isolation ON alm_nfe_webhooks;
CREATE POLICY alm_nfe_webhooks_tenant_isolation ON alm_nfe_webhooks
  USING (
    tenant_id IS NULL
    OR current_setting('app.tenant_id', true)::int = tenant_id
  );

ALTER TABLE alm_notas_fiscais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_notas_fiscais_tenant_isolation ON alm_notas_fiscais;
CREATE POLICY alm_notas_fiscais_tenant_isolation ON alm_notas_fiscais
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- alm_nfe_itens: sem tenant_id próprio — JOIN com alm_notas_fiscais
ALTER TABLE alm_nfe_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_nfe_itens_tenant_isolation ON alm_nfe_itens;
CREATE POLICY alm_nfe_itens_tenant_isolation ON alm_nfe_itens
  USING (EXISTS (
    SELECT 1 FROM alm_notas_fiscais nf
    WHERE nf.id = alm_nfe_itens.nfe_id
      AND current_setting('app.tenant_id', true)::int = nf.tenant_id
  ));


-- ─── 9. Conversões de Unidade (tenant_id = 0 = sistema) ──────────────────────

ALTER TABLE alm_unidades_conversao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_unidades_conversao_tenant_isolation ON alm_unidades_conversao;
CREATE POLICY alm_unidades_conversao_tenant_isolation ON alm_unidades_conversao
  USING (tenant_id = 0 OR current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 10. Alertas e Análises IA ───────────────────────────────────────────────

ALTER TABLE alm_alertas_estoque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_alertas_estoque_tenant_isolation ON alm_alertas_estoque;
CREATE POLICY alm_alertas_estoque_tenant_isolation ON alm_alertas_estoque
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_ai_analises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_ai_analises_tenant_isolation ON alm_ai_analises;
CREATE POLICY alm_ai_analises_tenant_isolation ON alm_ai_analises
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_sugestoes_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_sugestoes_ia_tenant_isolation ON alm_sugestoes_ia;
CREATE POLICY alm_sugestoes_ia_tenant_isolation ON alm_sugestoes_ia
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 11. Transferências ──────────────────────────────────────────────────────

ALTER TABLE alm_transferencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_transferencias_tenant_isolation ON alm_transferencias;
CREATE POLICY alm_transferencias_tenant_isolation ON alm_transferencias
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- alm_transferencia_itens: sem tenant_id próprio — JOIN com alm_transferencias
ALTER TABLE alm_transferencia_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_transferencia_itens_tenant_isolation ON alm_transferencia_itens;
CREATE POLICY alm_transferencia_itens_tenant_isolation ON alm_transferencia_itens
  USING (EXISTS (
    SELECT 1 FROM alm_transferencias t
    WHERE t.id = alm_transferencia_itens.transferencia_id
      AND current_setting('app.tenant_id', true)::int = t.tenant_id
  ));

ALTER TABLE alm_config_transferencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_config_transferencia_tenant_isolation ON alm_config_transferencia;
CREATE POLICY alm_config_transferencia_tenant_isolation ON alm_config_transferencia
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── 12. Catálogo de Variantes (matching NF-e ↔ catálogo) ───────────────────

ALTER TABLE alm_catalogo_variantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_catalogo_variantes_tenant_isolation ON alm_catalogo_variantes;
CREATE POLICY alm_catalogo_variantes_tenant_isolation ON alm_catalogo_variantes
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

ALTER TABLE alm_catalogo_sugestoes_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alm_catalogo_sugestoes_ia_tenant_isolation ON alm_catalogo_sugestoes_ia;
CREATE POLICY alm_catalogo_sugestoes_ia_tenant_isolation ON alm_catalogo_sugestoes_ia
  USING (current_setting('app.tenant_id', true)::int = tenant_id);


-- ─── Nota: sinapi_insumos ────────────────────────────────────────────────────
-- Tabela global (sem tenant_id) — dados públicos da CAIXA/SINAPI.
-- NÃO tem RLS habilitado intencionalmente (leitura cross-tenant esperada).
