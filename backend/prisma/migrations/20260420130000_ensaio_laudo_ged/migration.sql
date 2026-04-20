-- Agent C — Laudos de ensaio laboratorial integrados ao GED
--
-- Contexto: `ensaio_arquivo` guarda PDFs/imagens direto no MinIO sem passar
-- pelo GedService. Isso impede: OCR automático via fila ged.ocr, workflow
-- de aprovação, QR Code, versionamento, auditoria estruturada e geração de
-- lista mestra. Esta migration:
--   1) Garante categoria de sistema "LAUDO" (tenant_id = 0).
--   2) Permite disciplina = 'LAB' em ged_documentos (estende CHECK).
--   3) Adiciona coluna `ged_documento_id` nullable em `ensaio_arquivo`
--      com FK para `ged_documentos(id)` ON DELETE SET NULL.
--   4) Índice de lookup para joins com o GED.
--
-- Retrocompatível: arquivos legados continuam funcionando com a trilha
-- MinIO direta (storage_key em ensaio_arquivo.nome_storage). O `GedService`
-- passa a ser chamado em paralelo nas novas criações; falha de GED não
-- bloqueia o fluxo, apenas deixa `ged_documento_id` nulo (fallback legado).

-- 1) Categoria "LAUDO" de sistema ------------------------------------------
--    Laudos exigem aprovação (workflow 1 simples) e prazo de revisão de 2
--    anos (730 dias) — conforme PBQP-H para ensaios de controle tecnológico.
INSERT INTO ged_categorias
  (tenant_id, nome, codigo, escopo_padrao, requer_aprovacao, prazo_revisao_dias, workflow_default_id)
SELECT 0, 'Laudo Laboratorial', 'LAUDO', 'OBRA', false, 730, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM ged_categorias WHERE codigo = 'LAUDO' AND tenant_id = 0
);

-- 2) Adicionar 'LAB' à CHECK constraint de disciplina ----------------------
--    A constraint original restringe disciplina a ARQ/EST/HID/ELE/MEC/GEO.
--    Laboratório é disciplina transversal, precisa ser aceita.
ALTER TABLE ged_documentos
  DROP CONSTRAINT IF EXISTS chk_disciplina;

ALTER TABLE ged_documentos
  ADD CONSTRAINT chk_disciplina CHECK (
    disciplina IS NULL OR
    disciplina IN ('ARQ','EST','HID','ELE','MEC','GEO','LAB')
  );

-- 3) Coluna ged_documento_id em ensaio_arquivo -----------------------------
ALTER TABLE ensaio_arquivo
  ADD COLUMN IF NOT EXISTS ged_documento_id INT NULL
  REFERENCES ged_documentos(id) ON DELETE SET NULL;

-- 4) Índice parcial (só linhas integradas ao GED) --------------------------
CREATE INDEX IF NOT EXISTS idx_ensaio_arquivo_ged
  ON ensaio_arquivo(ged_documento_id)
  WHERE ged_documento_id IS NOT NULL;

-- 5) Comentários (documentam transição) ------------------------------------
COMMENT ON COLUMN ensaio_arquivo.ged_documento_id IS
  'FK para ged_documentos — populated por EnsaiosService a partir de 2026-04-20. Laudos anteriores permanecem com nome_storage/bucket direto no MinIO e ged_documento_id NULL (legado).';

COMMENT ON COLUMN ensaio_arquivo.nome_storage IS
  'DEPRECATED 2026-04-20: storage_key direto MinIO. Para novos laudos, JOIN com ged_versoes via ged_documentos.id para obter presigned URL. Mantido para compatibilidade de laudos legados.';
