-- =============================================================================
-- Eldox v3 — Migration: FVS Catálogo de Serviços
-- Sprint: FVS-1 | Data: 2026-04-08
-- Spec: docs/superpowers/specs/2026-04-08-fvs-sprint1-catalogo-servicos-design.md
-- Aplicar com: psql $DATABASE_URL -f migration.sql
-- =============================================================================

-- ── Tabelas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvs_categorias_servico (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ordem      SMALLINT DEFAULT 0,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvs_cat_tenant_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_fvs_cat_tenant ON fvs_categorias_servico(tenant_id);

CREATE TABLE IF NOT EXISTS fvs_catalogo_servicos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  categoria_id     INT REFERENCES fvs_categorias_servico(id) ON DELETE RESTRICT,
  codigo           VARCHAR(30),
  nome             VARCHAR(200) NOT NULL,
  norma_referencia VARCHAR(200),
  ordem            SMALLINT DEFAULT 0,
  ativo            BOOLEAN DEFAULT true,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS idx_fvs_srv_tenant ON fvs_catalogo_servicos(tenant_id, ativo);

CREATE TABLE IF NOT EXISTS fvs_catalogo_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  servico_id      INT NOT NULL REFERENCES fvs_catalogo_servicos(id) ON DELETE CASCADE,
  descricao       VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade     VARCHAR(10) NOT NULL DEFAULT 'menor',
  foto_modo       VARCHAR(15) NOT NULL DEFAULT 'opcional',
  foto_minimo     SMALLINT DEFAULT 0,
  foto_maximo     SMALLINT DEFAULT 2,
  ordem           SMALLINT DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fvs_item_criticidade CHECK (criticidade IN ('critico','maior','menor')),
  CONSTRAINT chk_fvs_item_foto_modo   CHECK (foto_modo IN ('nenhuma','opcional','obrigatoria'))
);
CREATE INDEX IF NOT EXISTS idx_fvs_item_servico ON fvs_catalogo_itens(servico_id, ativo);

-- ── Seed: 12 categorias PBQP-H (tenant_id = 0 = sistema) ─────────────────────

INSERT INTO fvs_categorias_servico (tenant_id, nome, ordem) VALUES
(0, 'Estrutura', 1),
(0, 'Alvenaria', 2),
(0, 'Revestimento', 3),
(0, 'Acabamento', 4),
(0, 'Instalações Elétricas', 5),
(0, 'Instalações Hidráulicas', 6),
(0, 'Impermeabilização', 7),
(0, 'Cobertura', 8),
(0, 'Esquadrias', 9),
(0, 'Pintura', 10),
(0, 'Combate a Incêndio', 11),
(0, 'Infraestrutura', 12)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- ── Seed: 8 serviços PO com itens ────────────────────────────────────────────

DO $$
DECLARE
  cat_acabamento      INT;
  cat_instalacoes_ele INT;
  cat_instalacoes_hid INT;
  cat_incendio        INT;
  cat_pintura         INT;
  s_portas            INT;
  s_pintura_int       INT;
  s_pintura_ext       INT;
  s_eletrica          INT;
  s_hidro             INT;
  s_bancadas          INT;
  s_incendio          INT;
  s_spda              INT;
BEGIN
  -- Guard: only run if services haven't been seeded yet
  IF (SELECT COUNT(*) FROM fvs_catalogo_servicos WHERE tenant_id = 0) > 0 THEN
    RETURN;
  END IF;

  SELECT id INTO cat_acabamento      FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Acabamento';
  SELECT id INTO cat_instalacoes_ele FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Elétricas';
  SELECT id INTO cat_instalacoes_hid FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Hidráulicas';
  SELECT id INTO cat_incendio        FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Combate a Incêndio';
  SELECT id INTO cat_pintura         FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Pintura';

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_acabamento, 'PO 19.20', 'EXECUÇÃO DE INSTALAÇÃO DE PORTAS', 1)
  RETURNING id INTO s_portas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_portas, 'ABERTURA E FECHAMENTO REGULAR?', 'maior', 1),
  (0, s_portas, 'ALISAR INSTALADO E BEM FIXADO?', 'menor', 2),
  (0, s_portas, 'ALISAR INSTALADO FACIANDO A PAREDE?', 'menor', 3),
  (0, s_portas, 'GUARNIÇÕES INSTALADAS?', 'menor', 4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_pintura, 'PO 21.22', 'EXECUÇÃO DE PINTURA INTERNA', 2)
  RETURNING id INTO s_pintura_int;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_pintura_int, 'PINTURA UNIFORME (COR / TEXTURA)?', 'maior', 1),
  (0, s_pintura_int, 'CANTOS E ARESTAS BEM PINTADAS?', 'menor', 2),
  (0, s_pintura_int, 'PRESENÇA DE ALGUM ELEMENTO QUE NÃO SEJA DA PAREDE?', 'menor', 3);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_pintura, 'PO 21.22', 'EXECUÇÃO DE PINTURA EXTERNA', 3)
  RETURNING id INTO s_pintura_ext;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_pintura_ext, 'PINTURA UNIFORME, SEM NENHUM TIPO DE MANCHAS?', 'maior', 1),
  (0, s_pintura_ext, 'PRESENÇA DE ALGUM ELEMENTO QUE NÃO SEJA DA PAREDE?', 'menor', 2);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_instalacoes_ele, 'PO 23', 'EXECUÇÃO DE INSTALAÇÕES ELÉTRICAS E TELEFÔNICAS', 4)
  RETURNING id INTO s_eletrica;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, foto_modo, ordem) VALUES
  (0, s_eletrica, 'PRESENÇA DE ENFIAÇÃO EM TODOS OS PONTOS ELÉTRICOS?', 'critico', 'obrigatoria', 1),
  (0, s_eletrica, 'PRESENÇA DE TOMADAS / INTERRUPTORES EM TODOS AS CAIXAS ELÉTRICAS?', 'maior', 'opcional', 2),
  (0, s_eletrica, 'QUADRO DE DISTRIBUIÇÃO COMPLETO COM DISJUNTORES?', 'critico', 'obrigatoria', 3),
  (0, s_eletrica, 'PONTOS ELÉTRICOS NIVELADOS E LIVRE DE RESÍDUOS?', 'menor', 'opcional', 4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_instalacoes_hid, 'PO 24', 'EXECUÇÃO DE INSTALAÇÕES HIDRO SANITÁRIAS', 5)
  RETURNING id INTO s_hidro;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_hidro, 'TUBULAÇÕES FIXADAS E CHUMBADAS?', 'maior', 1),
  (0, s_hidro, 'REGISTROS INSTALADOS?', 'maior', 2),
  (0, s_hidro, 'HIDRÔMETROS INSTALADOS?', 'critico', 3);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_acabamento, 'PO 25', 'COLOCAÇÃO DE BANCADAS, LOUÇAS E METAIS SANITÁRIOS', 6)
  RETURNING id INTO s_bancadas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS EM NÍVEL?', 'maior', 1),
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS ENTRE 85 A 95CM DE ALTURA?', 'menor', 2),
  (0, s_bancadas, 'PIA, TANQUE E LAVATÓRIO INSTALADOS COM SELANTE PRÓXIMO À PAREDE?', 'menor', 3),
  (0, s_bancadas, 'VASO SANITÁRIO INSTALADO COM TODOS OS ACESSÓRIOS?', 'maior', 4),
  (0, s_bancadas, 'TORNEIRAS, ENGATE E SIFÃO INSTALADOS?', 'maior', 5);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_incendio, 'PO 43', 'EXECUÇÃO DE SISTEMA DE COMBATE A INCÊNDIO', 7)
  RETURNING id INTO s_incendio;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, foto_modo, ordem) VALUES
  (0, s_incendio, 'EXTINTORES INSTALADOS E FIXADOS EM TODOS OS PAVIMENTOS COM PLACA DE IDENTIFICAÇÃO?', 'critico', 'obrigatoria', 1),
  (0, s_incendio, 'CENTRAL DE ALARME DE INCÊNDIO INSTALADO COM PLACA DE IDENTIFICAÇÃO?', 'critico', 'obrigatoria', 2),
  (0, s_incendio, 'QUEBRA-VIDRO E SIRENE INSTALADOS EM TODOS OS PAVIMENTOS COM PLACA DE IDENTIFICAÇÃO?', 'maior', 'opcional', 3),
  (0, s_incendio, 'PLACA DE SAÍDA DE EMERGÊNCIA INSTALADA?', 'maior', 'opcional', 4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, codigo, nome, ordem)
  VALUES (0, cat_incendio, 'PO 44', 'EXECUÇÃO DE SPDA', 8)
  RETURNING id INTO s_spda;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criticidade, ordem) VALUES
  (0, s_spda, 'TORRE COM ANTENA FRANKLIN INSTALADA?', 'critico', 1),
  (0, s_spda, 'FIOS DE COBRE FIXADOS?', 'maior', 2);

END $$;
