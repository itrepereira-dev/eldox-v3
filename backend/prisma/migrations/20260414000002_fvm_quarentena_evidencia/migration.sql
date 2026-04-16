ALTER TABLE fvm_lotes
  ADD COLUMN IF NOT EXISTS quarentena_evidencia_id INTEGER REFERENCES fvm_evidencias(id);
