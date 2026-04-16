-- =============================================================================
-- Eldox v3 — Row Level Security: Módulo RDO (Diário de Obra)
-- Data: 2026-04-14
-- Spec: SPEC-RDO-001
-- =============================================================================
-- Aplicar com:
--   psql $DATABASE_URL -f prisma/rls/rls_rdo.sql
--
-- Pré-requisito: migration 20260414000001_rdo_module já aplicada.
--
-- Cada request da aplicação deve setar o tenant antes de qualquer query:
--   SET LOCAL app.tenant_id = '<id>';
--
-- Notas:
--   • rdo_log_edicoes é IMUTÁVEL — sem política UPDATE nem DELETE.
--     Cada tenant só vê seus próprios logs (SELECT), e só pode inserir
--     registros no próprio tenant (INSERT WITH CHECK).
--   • SUPERUSER (usado pelo Prisma) bypassa RLS automaticamente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. rdos
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdos
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 2. rdo_clima
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_clima
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 3. rdo_mao_de_obra
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_mao_de_obra
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 4. rdo_equipamentos
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_equipamentos
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 5. rdo_atividades
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_atividades
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 6. rdo_ocorrencias
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_ocorrencias
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 7. rdo_checklist_itens
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_checklist_itens
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 8. rdo_fotos
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_fotos
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 9. rdo_assinaturas
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_assinaturas
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 10. rdo_sugestoes_ia
-- -----------------------------------------------------------------------------

CREATE POLICY tenant_isolation ON rdo_sugestoes_ia
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING     (current_setting('app.tenant_id', true)::int = tenant_id)
  WITH CHECK(current_setting('app.tenant_id', true)::int = tenant_id);


-- -----------------------------------------------------------------------------
-- 11. rdo_log_edicoes — IMUTÁVEL (apenas SELECT e INSERT — sem UPDATE/DELETE)
-- -----------------------------------------------------------------------------

-- Leitura: cada tenant enxerga apenas seus próprios registros
CREATE POLICY rdo_log_select ON rdo_log_edicoes
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (current_setting('app.tenant_id', true)::int = tenant_id);

-- Escrita: cada tenant só pode inserir no próprio tenant
CREATE POLICY rdo_log_insert ON rdo_log_edicoes
  AS PERMISSIVE
  FOR INSERT
  TO PUBLIC
  WITH CHECK (current_setting('app.tenant_id', true)::int = tenant_id);

-- Nenhuma política UPDATE — proibido implicitamente pelo RLS
-- Nenhuma política DELETE  — proibido implicitamente pelo RLS
