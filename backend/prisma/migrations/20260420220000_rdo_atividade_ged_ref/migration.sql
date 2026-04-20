-- Migration: rdo_atividades — referência opcional a documento no GED
-- Agent F (2026-04-20). Permite que uma atividade de RDO aponte a versão de
-- documento (projeto, especificação, procedimento executivo) que embasa a
-- execução daquele dia. Campo é OPCIONAL.

ALTER TABLE rdo_atividades
  ADD COLUMN IF NOT EXISTS ged_versao_id INT NULL;

CREATE INDEX IF NOT EXISTS idx_rdo_atividades_ged
  ON rdo_atividades (ged_versao_id);
