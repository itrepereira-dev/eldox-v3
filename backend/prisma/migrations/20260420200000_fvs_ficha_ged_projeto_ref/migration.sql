-- Migration: fvs_fichas — referência de projeto técnico no GED
-- Agent F (2026-04-20). Permite vincular ao criar uma ficha a versão de
-- documento (planta aprovada, memorial) que serviu de referência para a inspeção.
-- Campo é OPCIONAL. FK intencionalmente ausente: a versão pode pertencer a um
-- escopo distinto (tenant/EMPRESA), e a validação é feita no service (tenantId).

ALTER TABLE fvs_fichas
  ADD COLUMN IF NOT EXISTS ged_versao_id_projeto INT NULL;

CREATE INDEX IF NOT EXISTS idx_fvs_fichas_ged_projeto
  ON fvs_fichas (ged_versao_id_projeto);
