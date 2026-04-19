-- Migration: adiciona item_fotos em fvs_modelo_servicos
-- Campo referenciado no ModeloService (addServicoModelo / updateServicoModelo)
-- mas ausente na migration original da tabela, causando erro 500 ao vincular
-- serviços a templates de inspeção (POST /fvs/modelos/:id/servicos).

ALTER TABLE fvs_modelo_servicos
  ADD COLUMN IF NOT EXISTS item_fotos JSONB NOT NULL DEFAULT '{}';
