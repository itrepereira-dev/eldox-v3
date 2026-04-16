-- Migration: add_planos_acao
-- Creates 6 tables for the configurable corrective action plan (PA) system.

-- 1. Ciclo de vida configurável
CREATE TABLE pa_config_ciclo (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  modulo      VARCHAR(20) NOT NULL DEFAULT 'FVS',
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ciclo_tenant_modulo_nome UNIQUE (tenant_id, modulo, nome)
);

-- 2. Etapas do ciclo
CREATE TABLE pa_config_etapa (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  ciclo_id         INT NOT NULL REFERENCES pa_config_ciclo(id) ON DELETE CASCADE,
  nome             VARCHAR(100) NOT NULL,
  ordem            INT NOT NULL,
  cor              VARCHAR(7) NOT NULL DEFAULT '#6B7280',
  is_inicial       BOOLEAN NOT NULL DEFAULT FALSE,
  is_final         BOOLEAN NOT NULL DEFAULT FALSE,
  prazo_dias       INT,
  roles_transicao  TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Campos configuráveis por etapa
CREATE TABLE pa_config_campo (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  etapa_id    INT NOT NULL REFERENCES pa_config_etapa(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  chave       VARCHAR(50) NOT NULL,
  tipo        VARCHAR(20) NOT NULL,
  opcoes      JSONB,
  obrigatorio BOOLEAN NOT NULL DEFAULT FALSE,
  ordem       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_campo_tipo CHECK (tipo IN ('texto','numero','data','select','usuario','arquivo'))
);

-- 4. Gatilhos de abertura automática
CREATE TABLE pa_config_gatilho (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  ciclo_id        INT NOT NULL REFERENCES pa_config_ciclo(id) ON DELETE CASCADE,
  modulo          VARCHAR(20) NOT NULL DEFAULT 'FVS',
  condicao        VARCHAR(30) NOT NULL,
  valor_limiar    NUMERIC,
  criticidade_min VARCHAR(10),
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_gatilho_condicao CHECK (condicao IN ('TAXA_CONFORMIDADE_ABAIXO','ITEM_CRITICO_NC','NC_ABERTA'))
);

-- 5. Planos de Ação
CREATE TABLE pa_plano_acao (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  ciclo_id       INT NOT NULL REFERENCES pa_config_ciclo(id),
  etapa_atual_id INT NOT NULL REFERENCES pa_config_etapa(id),
  modulo         VARCHAR(20) NOT NULL DEFAULT 'FVS',
  origem_tipo    VARCHAR(30),
  origem_id      INT,
  obra_id        INT NOT NULL,
  numero         VARCHAR(20) NOT NULL,
  titulo         VARCHAR(200) NOT NULL,
  descricao      TEXT,
  prioridade     VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
  responsavel_id INT,
  prazo          DATE,
  campos_extras  JSONB NOT NULL DEFAULT '{}',
  aberto_por     INT NOT NULL,
  fechado_em     TIMESTAMPTZ,
  fechado_por    INT,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pa_tenant_numero UNIQUE (tenant_id, numero),
  CONSTRAINT chk_pa_prioridade CHECK (prioridade IN ('BAIXA','MEDIA','ALTA','CRITICA')),
  CONSTRAINT chk_pa_origem_tipo CHECK (origem_tipo IN ('INSPECAO_FVS','NC_FVS','MANUAL') OR origem_tipo IS NULL)
);

-- 6. Histórico de transições
CREATE TABLE pa_historico (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  pa_id         INT NOT NULL REFERENCES pa_plano_acao(id) ON DELETE CASCADE,
  etapa_de_id   INT REFERENCES pa_config_etapa(id),
  etapa_para_id INT NOT NULL REFERENCES pa_config_etapa(id),
  comentario    TEXT,
  campos_extras JSONB NOT NULL DEFAULT '{}',
  criado_por    INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_pa_plano_acao_tenant_obra ON pa_plano_acao(tenant_id, obra_id);
CREATE INDEX idx_pa_plano_acao_tenant_etapa ON pa_plano_acao(tenant_id, etapa_atual_id);
CREATE INDEX idx_pa_plano_acao_origem ON pa_plano_acao(tenant_id, origem_tipo, origem_id);
CREATE INDEX idx_pa_historico_pa ON pa_historico(pa_id);
CREATE INDEX idx_pa_config_etapa_ciclo ON pa_config_etapa(ciclo_id);
CREATE INDEX idx_pa_config_campo_etapa ON pa_config_campo(etapa_id);
CREATE INDEX idx_pa_config_gatilho_tenant ON pa_config_gatilho(tenant_id, modulo, ativo);
