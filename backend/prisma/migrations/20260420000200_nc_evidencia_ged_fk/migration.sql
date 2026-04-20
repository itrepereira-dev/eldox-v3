-- =============================================================================
-- Migration: nc_evidencia_ged_fk
-- Data:      2026-04-20
-- Objetivo:  Vincular não-conformidades a versões do GED (ged_versoes).
--            Regra PBQP-H: toda evidência de NC deve apontar para um documento
--            rastreável, não uma URL solta.
-- =============================================================================
-- Estratégia:
--   - Adiciona coluna nullable `ged_versao_id` em `nao_conformidades`.
--   - NÃO cria constraint FK dura — evita bloquear soft-delete/OBSOLETO de
--     versões GED já referenciadas por NCs históricas.
--   - Mantém `evidencia_url` (VARCHAR) existente por compatibilidade: NCs
--     antigas seguem com URL livre, frontend faz fallback.
--   - Cria índice simples para queries de listagem e LEFT JOIN.
-- =============================================================================

ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS ged_versao_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_nc_ged_versao
  ON nao_conformidades(ged_versao_id);

-- =============================================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- =============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'nao_conformidades'
--    AND column_name = 'ged_versao_id';
-- Esperado: integer, YES (nullable)
--
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'nao_conformidades'
--    AND indexname = 'idx_nc_ged_versao';
-- Esperado: 1 linha
-- =============================================================================
