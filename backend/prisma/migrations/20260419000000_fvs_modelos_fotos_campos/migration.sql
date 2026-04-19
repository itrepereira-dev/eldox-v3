-- Migration: adiciona colunas ausentes em fvs_modelos
-- fotos_obrigatorias, fotos_itens_ids e is_sistema foram referenciados no
-- service mas nunca tiveram migration correspondente, causando erro 500 ao
-- criar templates de inspeção.

ALTER TABLE fvs_modelos
  ADD COLUMN IF NOT EXISTS fotos_obrigatorias VARCHAR(30) NOT NULL DEFAULT 'apenas_nc',
  ADD COLUMN IF NOT EXISTS fotos_itens_ids    INT[]       NULL,
  ADD COLUMN IF NOT EXISTS is_sistema         BOOL        NOT NULL DEFAULT false;

ALTER TABLE fvs_modelos
  DROP CONSTRAINT IF EXISTS chk_fvs_modelos_fotos;

ALTER TABLE fvs_modelos
  ADD CONSTRAINT chk_fvs_modelos_fotos
    CHECK (fotos_obrigatorias IN ('todas', 'apenas_nc', 'nenhuma', 'itens_selecionados'));
