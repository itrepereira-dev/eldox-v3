-- Trabalho H1: adiciona coluna thumbnail_storage_key a ged_versoes.
-- Preenchida pelo worker `ged.thumbnail` apos upload de arquivos de imagem
-- (mime_type comecando com "image/"). Quando null, o frontend fallback exibe
-- o mime-icon padrao.
ALTER TABLE ged_versoes ADD COLUMN IF NOT EXISTS thumbnail_storage_key VARCHAR(500) NULL;
