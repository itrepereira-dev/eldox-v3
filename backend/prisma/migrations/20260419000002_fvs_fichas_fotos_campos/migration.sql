-- Migration: adiciona fotos_obrigatorias e fotos_itens_ids em fvs_fichas
-- O InspecaoService copia esses campos do template para a ficha ao criar
-- uma inspeção, mas a tabela fvs_fichas não tinha essas colunas,
-- causando erro 500 em POST /fvs/fichas.

ALTER TABLE fvs_fichas
  ADD COLUMN IF NOT EXISTS fotos_obrigatorias VARCHAR(30) NOT NULL DEFAULT 'apenas_nc',
  ADD COLUMN IF NOT EXISTS fotos_itens_ids    INT[]       NULL;

ALTER TABLE fvs_fichas
  DROP CONSTRAINT IF EXISTS chk_fvs_fichas_fotos;

ALTER TABLE fvs_fichas
  ADD CONSTRAINT chk_fvs_fichas_fotos
    CHECK (fotos_obrigatorias IN ('todas', 'apenas_nc', 'nenhuma', 'itens_selecionados'));
