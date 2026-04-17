-- ============================================================
-- Migration: 20260417000002_obra_relatorio_config
-- Adiciona configuração de personalização do relatório PDF
-- por obra (G8 do DC-01).
-- ============================================================
-- Shape esperado em "Obra".relatorio_config (JSONB):
--   {
--     "logo_cliente_url": "https://.../logo.png" | null,
--     "titulo":           "Diário de Obra" | null,
--     "secoes": {
--       "clima":        true,
--       "mao_obra":     true,
--       "equipamentos": true,
--       "atividades":   true,
--       "ocorrencias":  true,
--       "checklist":    true,
--       "fotos":        true,
--       "assinaturas":  true
--     }
--   }
-- Quando NULL → default (todas as seções habilitadas, sem logo cliente).
-- ============================================================

ALTER TABLE "Obra"
  ADD COLUMN IF NOT EXISTS "relatorio_config" JSONB;

COMMENT ON COLUMN "Obra"."relatorio_config" IS
  'Configuração de personalização do PDF do RDO por obra — logo cliente, título, seções habilitadas. NULL = defaults.';
