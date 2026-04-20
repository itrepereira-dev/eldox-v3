-- Migration: ensaio_laboratorial — referência de especificação técnica no GED
-- Agent F (2026-04-20). Ao criar um ensaio laboratorial o técnico pode apontar
-- a versão de documento (planta, memorial, especificação) que define os
-- parâmetros esperados do ensaio. Diferente de `ged_documento_id` (já existente
-- via migration 20260420130000_ensaio_laudo_ged, que aponta para o LAUDO).
-- Campo é OPCIONAL.

ALTER TABLE ensaio_laboratorial
  ADD COLUMN IF NOT EXISTS ged_versao_id_spec INT NULL;

CREATE INDEX IF NOT EXISTS idx_ensaio_laboratorial_ged_spec
  ON ensaio_laboratorial (ged_versao_id_spec);
