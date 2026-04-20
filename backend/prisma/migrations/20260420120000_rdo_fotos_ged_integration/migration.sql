-- Agent A — Trabalho 1: Migração de fotos do RDO para o GED
--
-- Contexto: `rdo_fotos` atualmente guarda `url` direto do MinIO sem passar
-- pelo GedService. A skill ged-enterprise exige que módulos de diário
-- referenciem ged_versoes. Esta migration:
--   1) Garante categoria de sistema "FOTO_RDO" (tenant_id = 0).
--   2) Adiciona coluna `ged_versao_id` nullable em `rdo_fotos` com FK
--      para `ged_versoes(id)`.
--   3) Mantém `url` e `thumbnail_url` durante transição (deprecados).

-- 1) Categoria de sistema "FOTO_RDO" ---------------------------------------
--    Fotos de RDO NÃO precisam de workflow (requer_aprovacao = false).
--    Se já existir "FTO" / "RDO" de fotos, ainda assim criamos a FOTO_RDO
--    específica pois o pedido do Agent A é essa chave determinística.
INSERT INTO ged_categorias
  (tenant_id, nome, codigo, escopo_padrao, requer_aprovacao, prazo_revisao_dias, workflow_default_id)
VALUES
  (0, 'Foto de RDO', 'FOTO_RDO', 'OBRA', false, NULL, NULL)
ON CONFLICT (tenant_id, codigo) DO NOTHING;

-- 2) Coluna ged_versao_id em rdo_fotos --------------------------------------
ALTER TABLE rdo_fotos
  ADD COLUMN IF NOT EXISTS ged_versao_id INT NULL
  REFERENCES ged_versoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rdo_fotos_ged_versao
  ON rdo_fotos(ged_versao_id)
  WHERE ged_versao_id IS NOT NULL;

-- 3) Comentários (documentam transição) -------------------------------------
COMMENT ON COLUMN rdo_fotos.ged_versao_id IS
  'FK para ged_versoes — populated by RdoFotosService a partir de 2026-04-20. Fotos anteriores permanecem com url/thumbnail_url e ged_versao_id NULL (legado).';
COMMENT ON COLUMN rdo_fotos.url IS
  'DEPRECATED 2026-04-20: URL direta MinIO. Use JOIN com ged_versoes via ged_versao_id para URL fresh. Mantido para compatibilidade de fotos antigas.';
