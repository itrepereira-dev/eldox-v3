ALTER TABLE "Usuario"
  ADD COLUMN IF NOT EXISTS telefone VARCHAR(20) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_telefone
  ON "Usuario"(telefone) WHERE telefone IS NOT NULL;
