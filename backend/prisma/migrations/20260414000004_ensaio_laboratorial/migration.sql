-- Migration: 20260414000004_ensaio_laboratorial
-- Tabelas: laboratorios, ensaio_laboratorial, ensaio_resultado, ensaio_arquivo, ensaio_revisao, ensaio_revisao_historico

CREATE TABLE IF NOT EXISTS laboratorios (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL,
  nome       VARCHAR(200) NOT NULL,
  cnpj       VARCHAR(18),
  contato    VARCHAR(100),
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_tenant_nome ON laboratorios(tenant_id, nome) WHERE ativo = TRUE;

CREATE TABLE IF NOT EXISTS ensaio_laboratorial (
  id                      SERIAL PRIMARY KEY,
  tenant_id               INTEGER NOT NULL,
  obra_id                 INTEGER NOT NULL,
  fvm_lote_id             INTEGER NOT NULL REFERENCES fvm_lotes(id),
  laboratorio_id          INTEGER NOT NULL REFERENCES laboratorios(id),
  data_ensaio             DATE NOT NULL,
  nota_fiscal_ref         VARCHAR(50),
  proximo_ensaio_data     DATE,
  proximo_ensaio_alertado BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes             TEXT,
  ia_extraido_em          TIMESTAMP,
  ia_confianca            DECIMAL(5,2),
  criado_por              INTEGER NOT NULL REFERENCES "Usuario"(id),
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ensaio_lab_tenant  ON ensaio_laboratorial(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_ensaio_lab_lote    ON ensaio_laboratorial(fvm_lote_id);
CREATE INDEX IF NOT EXISTS idx_ensaio_lab_proximo ON ensaio_laboratorial(proximo_ensaio_data) WHERE proximo_ensaio_alertado = FALSE;

CREATE TABLE IF NOT EXISTS ensaio_resultado (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL,
  ensaio_id       INTEGER NOT NULL REFERENCES ensaio_laboratorial(id) ON DELETE CASCADE,
  ensaio_tipo_id  INTEGER NOT NULL REFERENCES ensaio_tipo(id),
  valor_obtido    DECIMAL(10,3) NOT NULL,
  aprovado_auto   BOOLEAN,
  observacao      TEXT
);
CREATE INDEX IF NOT EXISTS idx_ensaio_res_ensaio ON ensaio_resultado(ensaio_id);

CREATE TABLE IF NOT EXISTS ensaio_arquivo (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL,
  ensaio_id       INTEGER NOT NULL REFERENCES ensaio_laboratorial(id) ON DELETE CASCADE,
  nome_original   VARCHAR(255) NOT NULL,
  nome_storage    VARCHAR(255) NOT NULL,
  bucket          VARCHAR(100) NOT NULL,
  content_type    VARCHAR(100) NOT NULL,
  tamanho_bytes   INTEGER NOT NULL,
  hash            VARCHAR(64) NOT NULL,
  upload_por      INTEGER NOT NULL REFERENCES "Usuario"(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ensaio_revisao (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  ensaio_id    INTEGER NOT NULL UNIQUE REFERENCES ensaio_laboratorial(id),
  situacao     VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  prioridade   VARCHAR(10) NOT NULL DEFAULT 'normal',
  revisado_por INTEGER REFERENCES "Usuario"(id),
  observacao   TEXT,
  revisado_em  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ensaio_rev_tenant ON ensaio_revisao(tenant_id, situacao, prioridade);

CREATE TABLE IF NOT EXISTS ensaio_revisao_historico (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  revisao_id    INTEGER NOT NULL REFERENCES ensaio_revisao(id),
  tipo_evento   VARCHAR(30) NOT NULL,
  situacao_de   VARCHAR(20),
  situacao_para VARCHAR(20),
  observacao    TEXT,
  usuario_id    INTEGER REFERENCES "Usuario"(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
