-- Adiciona tolerância e método de verificação aos itens do catálogo FVS
ALTER TABLE fvs_catalogo_itens
  ADD COLUMN IF NOT EXISTS tolerancia         VARCHAR(200),
  ADD COLUMN IF NOT EXISTS metodo_verificacao VARCHAR(200);
