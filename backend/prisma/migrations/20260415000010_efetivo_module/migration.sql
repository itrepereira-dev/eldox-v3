-- migration: 20260415000010_efetivo_module
-- Módulo Controle de Efetivo: registros diários de mão de obra por obra/turno

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "Turno" AS ENUM ('INTEGRAL', 'MANHA', 'TARDE', 'NOITE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TipoEmpresa" AS ENUM ('PROPRIA', 'SUBCONTRATADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. empresas_efetivo ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS empresas_efetivo (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(200) NOT NULL,
  tipo       "TipoEmpresa" NOT NULL DEFAULT 'SUBCONTRATADA',
  cnpj       VARCHAR(18),
  ativa      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, cnpj)
);
CREATE INDEX IF NOT EXISTS idx_empresas_efetivo_tenant ON empresas_efetivo(tenant_id);

-- ── 3. funcoes_efetivo ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS funcoes_efetivo (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ativa      BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_funcoes_efetivo_tenant ON funcoes_efetivo(tenant_id);

-- ── 4. registros_efetivo ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS registros_efetivo (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  obra_id        INT NOT NULL REFERENCES "Obra"(id),
  data           DATE NOT NULL,
  turno          "Turno" NOT NULL DEFAULT 'INTEGRAL',
  fechado        BOOLEAN NOT NULL DEFAULT FALSE,
  fechado_por    INT REFERENCES "Usuario"(id),
  fechado_em     TIMESTAMP,
  criado_por     INT NOT NULL REFERENCES "Usuario"(id),
  criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),
  rdo_id         INT,
  UNIQUE (tenant_id, obra_id, data, turno)
);
CREATE INDEX IF NOT EXISTS idx_registros_efetivo_tenant_obra_data
  ON registros_efetivo(tenant_id, obra_id, data);

-- ── 5. itens_efetivo ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS itens_efetivo (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INT NOT NULL,
  registro_efetivo_id  INT NOT NULL REFERENCES registros_efetivo(id) ON DELETE CASCADE,
  empresa_id           INT NOT NULL REFERENCES empresas_efetivo(id),
  funcao_id            INT NOT NULL REFERENCES funcoes_efetivo(id),
  quantidade           INT NOT NULL CHECK (quantidade >= 1),
  observacao           TEXT
);
CREATE INDEX IF NOT EXISTS idx_itens_efetivo_registro ON itens_efetivo(registro_efetivo_id);
CREATE INDEX IF NOT EXISTS idx_itens_efetivo_tenant    ON itens_efetivo(tenant_id);

-- ── 6. efetivo_audit_log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efetivo_audit_log (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  registro_id   INT NOT NULL,
  acao          VARCHAR(50) NOT NULL,
  usuario_id    INT NOT NULL REFERENCES "Usuario"(id),
  ip_origem     INET,
  detalhes      JSONB,
  criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efetivo_audit_tenant ON efetivo_audit_log(tenant_id, registro_id);

-- ── 7. efetivo_padroes (cache IA) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efetivo_padroes (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id),
  dia_semana    SMALLINT NOT NULL, -- 0=dom, 1=seg... 6=sab
  turno         "Turno" NOT NULL DEFAULT 'INTEGRAL',
  padrao        JSONB NOT NULL DEFAULT '[]', -- [{ empresa_nome, funcao_nome, media_quantidade }]
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, obra_id, dia_semana, turno)
);
CREATE INDEX IF NOT EXISTS idx_efetivo_padroes_tenant_obra ON efetivo_padroes(tenant_id, obra_id);

-- ── 8. efetivo_alertas ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS efetivo_alertas (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  obra_id     INT REFERENCES "Obra"(id),
  tipo        VARCHAR(50) NOT NULL, -- 'queda_efetivo' | 'empresa_ausente' | 'obra_parada'
  severidade  VARCHAR(20) NOT NULL DEFAULT 'warn', -- 'warn' | 'critical'
  mensagem    TEXT NOT NULL,
  detalhes    JSONB,
  lido        BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_efetivo_alertas_tenant_lido ON efetivo_alertas(tenant_id, lido);
