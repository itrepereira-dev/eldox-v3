-- =============================================================================
-- Eldox v3 — Migration: FVM Módulo Completo
-- Sprint: FVM-1 | Data: 2026-04-14
-- Spec: docs/superpowers/specs/2026-04-14-fvm-spec-eldox.md
-- Tabelas: 13 (categorias, catálogo, itens, docs exigidos, fornecedores,
--           vínculo forn-mat, lotes, registros, evidências, NCs,
--           usos, ai_sugestoes, normas_abnt)
-- Seed: 15 categorias PBQP-H + 7 materiais críticos + ~35 itens de verificação
-- =============================================================================

-- ── 1. Categorias de Materiais ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_categorias_materiais (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  icone       VARCHAR(50),
  ordem       SMALLINT DEFAULT 0,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvm_cat_tenant_nome UNIQUE (tenant_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_fvm_cat_tenant ON fvm_categorias_materiais(tenant_id, ativo);

-- ── 2. Catálogo de Materiais ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_catalogo_materiais (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT NOT NULL,
  categoria_id          INT REFERENCES fvm_categorias_materiais(id) ON DELETE RESTRICT,
  nome                  VARCHAR(200) NOT NULL,
  codigo                VARCHAR(50),
  norma_referencia      VARCHAR(200),
  unidade               VARCHAR(20) NOT NULL DEFAULT 'un',
  descricao             TEXT,
  foto_modo             VARCHAR(20) NOT NULL DEFAULT 'opcional',
  exige_certificado     BOOLEAN DEFAULT false,
  exige_nota_fiscal     BOOLEAN DEFAULT true,
  exige_laudo_ensaio    BOOLEAN DEFAULT false,
  prazo_quarentena_dias INT NOT NULL DEFAULT 0,
  ordem                 SMALLINT DEFAULT 0,
  ativo                 BOOLEAN DEFAULT true,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP NULL,
  CONSTRAINT chk_fvm_mat_foto_modo CHECK (foto_modo IN ('nenhuma','opcional','obrigatoria'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_mat_tenant  ON fvm_catalogo_materiais(tenant_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fvm_mat_cat     ON fvm_catalogo_materiais(categoria_id);

-- ── 3. Itens de Verificação ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_catalogo_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  material_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'visual',
  descricao       VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade     VARCHAR(20) NOT NULL DEFAULT 'menor',
  foto_modo       VARCHAR(20) NOT NULL DEFAULT 'opcional',
  ordem           SMALLINT DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fvm_item_tipo       CHECK (tipo       IN ('visual','documental','dimensional','ensaio')),
  CONSTRAINT chk_fvm_item_criticidade CHECK (criticidade IN ('critico','maior','menor')),
  CONSTRAINT chk_fvm_item_foto_modo  CHECK (foto_modo  IN ('nenhuma','opcional','obrigatoria'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_item_material ON fvm_catalogo_itens(material_id, ativo);

-- ── 4. Documentos Exigidos ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_documentos_exigidos (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  material_id INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  nome        VARCHAR(150) NOT NULL,
  sigla       VARCHAR(20),
  obrigatorio BOOLEAN DEFAULT true,
  descricao   TEXT,
  ordem       SMALLINT DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvm_docsex_material ON fvm_documentos_exigidos(material_id);

-- ── 5. Fornecedores ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_fornecedores (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT NOT NULL,
  razao_social          VARCHAR(200) NOT NULL,
  nome_fantasia         VARCHAR(200),
  cnpj                  VARCHAR(18),
  tipo                  VARCHAR(20) NOT NULL DEFAULT 'fabricante',
  situacao              VARCHAR(20) NOT NULL DEFAULT 'em_avaliacao',
  email                 VARCHAR(200),
  telefone              VARCHAR(20),
  responsavel_comercial VARCHAR(100),
  endereco              TEXT,
  cidade                VARCHAR(100),
  uf                    CHAR(2),
  observacoes           TEXT,
  avaliacao_score       DECIMAL(4,2),
  ultima_avaliacao_em   DATE,
  proxima_avaliacao_em  DATE,
  criado_por            INT NOT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMP NULL,
  CONSTRAINT uq_fvm_forn_tenant_cnpj UNIQUE (tenant_id, cnpj),
  CONSTRAINT chk_fvm_forn_tipo     CHECK (tipo     IN ('fabricante','distribuidor','locadora','prestador')),
  CONSTRAINT chk_fvm_forn_situacao CHECK (situacao IN ('em_avaliacao','homologado','suspenso','desqualificado'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_forn_tenant   ON fvm_fornecedores(tenant_id, situacao);
CREATE INDEX IF NOT EXISTS idx_fvm_forn_deleted  ON fvm_fornecedores(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- ── 6. Vínculo Fornecedor × Material ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_fornecedor_materiais (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  fornecedor_id       INT NOT NULL REFERENCES fvm_fornecedores(id) ON DELETE CASCADE,
  material_id         INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  preco_referencia    DECIMAL(12,4),
  prazo_entrega_dias  INT,
  ativo               BOOLEAN DEFAULT true,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvm_forn_mat UNIQUE (tenant_id, fornecedor_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_fvm_fornmat_forn ON fvm_fornecedor_materiais(fornecedor_id, ativo);
CREATE INDEX IF NOT EXISTS idx_fvm_fornmat_mat  ON fvm_fornecedor_materiais(material_id, ativo);

-- ── 7. Lotes (entregas) ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_lotes (
  id                       SERIAL PRIMARY KEY,
  tenant_id                INT NOT NULL,
  obra_id                  INT NOT NULL,
  material_id              INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE RESTRICT,
  fornecedor_id            INT NOT NULL REFERENCES fvm_fornecedores(id) ON DELETE RESTRICT,
  numero_lote              VARCHAR(60) NOT NULL,
  numero_nf                VARCHAR(60) NOT NULL,
  data_entrega             DATE NOT NULL,
  hora_chegada             TIME,
  quantidade_nf            DECIMAL(12,3),                     -- qtd declarada na NF
  quantidade_recebida      DECIMAL(12,3),                     -- qtd conferida fisicamente
  unidade                  VARCHAR(20) NOT NULL,
  numero_pedido            VARCHAR(60),
  lote_fabricante          VARCHAR(60),
  data_fabricacao          DATE,
  validade                 DATE,
  -- Campos específicos para concreto usinado (nullable para outros materiais)
  hora_saida_usina         TIME,
  slump_especificado       DECIMAL(5,1),                      -- cm
  slump_medido             DECIMAL(5,1),                      -- cm
  -- Status e inspeção
  status                   VARCHAR(40) NOT NULL DEFAULT 'aguardando_inspecao',
  inspecionado_por         INT,
  inspecionado_em          TIMESTAMP,
  observacao_geral         TEXT,
  -- Quarentena
  quarentena_motivo        TEXT,
  quarentena_prazo_dias    INT,
  quarentena_liberada_por  INT,
  quarentena_liberada_em   TIMESTAMP,
  -- Auditoria
  criado_por               INT NOT NULL,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMP NULL,
  CONSTRAINT uq_fvm_lote_numero UNIQUE (tenant_id, numero_lote),
  CONSTRAINT chk_fvm_lote_status CHECK (status IN (
    'aguardando_inspecao','em_inspecao','aprovado',
    'aprovado_com_ressalva','quarentena','reprovado','cancelado'
  )),
  CONSTRAINT chk_fvm_lote_data CHECK (data_entrega <= CURRENT_DATE + INTERVAL '1 day')
);
CREATE INDEX IF NOT EXISTS idx_fvm_lote_tenant   ON fvm_lotes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fvm_lote_obra     ON fvm_lotes(obra_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvm_lote_material ON fvm_lotes(material_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvm_lote_forn     ON fvm_lotes(fornecedor_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvm_lote_deleted  ON fvm_lotes(tenant_id, deleted_at) WHERE deleted_at IS NULL;

-- ── 8. Registros de Verificação ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_registros (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  lote_id           INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  item_id           INT NOT NULL REFERENCES fvm_catalogo_itens(id) ON DELETE RESTRICT,
  status            VARCHAR(20) NOT NULL DEFAULT 'nao_avaliado',
  observacao        TEXT,
  inspecionado_por  INT,
  inspecionado_em   TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvm_reg_lote_item UNIQUE (tenant_id, lote_id, item_id),
  CONSTRAINT chk_fvm_reg_status CHECK (status IN ('nao_avaliado','conforme','nao_conforme','nao_aplicavel'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_reg_lote ON fvm_registros(lote_id, status);

-- ── 9. Evidências ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_evidencias (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  lote_id        INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id    INT REFERENCES fvm_registros(id) ON DELETE SET NULL,
  tipo           VARCHAR(20) NOT NULL DEFAULT 'foto',
  ged_versao_id  INT NOT NULL,
  descricao      VARCHAR(200),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_fvm_evidencia_tipo CHECK (tipo IN ('foto','nf','certificado','laudo','ficha_tecnica','outro'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_evidencia_lote     ON fvm_evidencias(lote_id);
CREATE INDEX IF NOT EXISTS idx_fvm_evidencia_registro ON fvm_evidencias(registro_id);

-- ── 10. Não Conformidades ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_nao_conformidades (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  lote_id          INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id      INT REFERENCES fvm_registros(id) ON DELETE SET NULL,
  fornecedor_id    INT NOT NULL REFERENCES fvm_fornecedores(id) ON DELETE RESTRICT,
  numero           VARCHAR(60) NOT NULL,
  tipo             VARCHAR(20) NOT NULL,
  criticidade      VARCHAR(20) NOT NULL DEFAULT 'menor',
  status           VARCHAR(40) NOT NULL DEFAULT 'aberta',
  descricao        TEXT NOT NULL,
  acao_imediata    VARCHAR(30),
  responsavel_id   INT,
  prazo_resolucao  DATE,
  acao_corretiva   TEXT,
  resultado_final  VARCHAR(40),
  encerrada_em     TIMESTAMP,
  encerrada_por    INT,
  sla_status       VARCHAR(20) NOT NULL DEFAULT 'no_prazo',
  criado_por       INT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvm_nc_numero UNIQUE (tenant_id, numero),
  CONSTRAINT chk_fvm_nc_tipo        CHECK (tipo        IN ('documental','visual','dimensional','ensaio','quantidade')),
  CONSTRAINT chk_fvm_nc_criticidade CHECK (criticidade IN ('critico','maior','menor')),
  CONSTRAINT chk_fvm_nc_status      CHECK (status      IN ('aberta','em_tratamento','aguardando_devolucao','encerrada','cancelada')),
  CONSTRAINT chk_fvm_nc_acao        CHECK (acao_imediata IS NULL OR acao_imediata IN ('quarentena','devolucao','uso_condicional','aguardar_laudo')),
  CONSTRAINT chk_fvm_nc_sla         CHECK (sla_status  IN ('no_prazo','alerta','vencido'))
);
CREATE INDEX IF NOT EXISTS idx_fvm_nc_tenant ON fvm_nao_conformidades(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_fvm_nc_lote   ON fvm_nao_conformidades(lote_id);
CREATE INDEX IF NOT EXISTS idx_fvm_nc_forn   ON fvm_nao_conformidades(fornecedor_id);

-- ── 11. Usos do Lote (rastreabilidade) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_lote_usos (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  lote_id        INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  obra_id        INT NOT NULL,
  local_id       INT,                                -- fks: obra_local (FVS)
  servico_id     INT,                                -- fks: fvs_catalogo_servicos
  descricao_uso  VARCHAR(200),
  quantidade     DECIMAL(12,3),
  unidade        VARCHAR(20),
  data_uso       DATE NOT NULL DEFAULT CURRENT_DATE,
  registrado_por INT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvm_uso_lote  ON fvm_lote_usos(lote_id);
CREATE INDEX IF NOT EXISTS idx_fvm_uso_obra  ON fvm_lote_usos(obra_id, tenant_id);

-- ── 12. Sugestões IA ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_ai_sugestoes (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  lote_id          INT REFERENCES fvm_lotes(id) ON DELETE CASCADE,
  material_id      INT REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  tipo             VARCHAR(40) NOT NULL,
  conteudo         TEXT NOT NULL,
  confianca        DECIMAL(4,3),                     -- 0.000–1.000
  aceita           BOOLEAN,
  aceita_em        TIMESTAMP,
  aceita_por       INT,
  modelo_ia        VARCHAR(100),
  tokens_usados    INT,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fvm_ai_lote     ON fvm_ai_sugestoes(lote_id);
CREATE INDEX IF NOT EXISTS idx_fvm_ai_tenant   ON fvm_ai_sugestoes(tenant_id, tipo);

-- ── 13. Normas ABNT (referência) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fvm_normas_abnt (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL DEFAULT 0,
  numero      VARCHAR(30) NOT NULL,
  titulo      VARCHAR(300) NOT NULL,
  ano         SMALLINT,
  escopo      TEXT,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fvm_norma UNIQUE (tenant_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_fvm_norma_tenant ON fvm_normas_abnt(tenant_id, ativo);

-- =============================================================================
-- SEED — Dados PBQP-H (tenant_id = 0)
-- =============================================================================

-- ── Seed: 15 Categorias PBQP-H ───────────────────────────────────────────────

INSERT INTO fvm_categorias_materiais (tenant_id, nome, icone, ordem) VALUES
(0, 'Aglomerantes e Argamassas', 'package',   1),
(0, 'Agregados',                 'layers',    2),
(0, 'Aço e Ferragens',           'anchor',    3),
(0, 'Blocos e Tijolos',          'grid',      4),
(0, 'Concreto Usinado',          'truck',     5),
(0, 'Tubulações Hidráulicas',    'droplets',  6),
(0, 'Tubulações de Esgoto',      'git-merge', 7),
(0, 'Cabos e Fios Elétricos',    'zap',       8),
(0, 'Eletrodutos',               'minus',     9),
(0, 'Revestimentos Cerâmicos',   'square',    10),
(0, 'Impermeabilizantes',        'shield',    11),
(0, 'Tintas e Vernizes',         'droplet',   12),
(0, 'Esquadrias',                'layout',    13),
(0, 'Louças e Metais Sanitários','wrench',    14),
(0, 'Gesso e Drywall',           'columns',   15)
ON CONFLICT (tenant_id, nome) DO NOTHING;

-- ── Seed: 7 Materiais Críticos + Itens de Verificação ────────────────────────

DO $$
DECLARE
  cat_aglom   INT;
  cat_agr     INT;
  cat_aco     INT;
  cat_bloco   INT;
  cat_conc    INT;
  m_cimento   INT;
  m_aco       INT;
  m_concreto  INT;
  m_bloco     INT;
  m_argamassa INT;
  m_areia     INT;
  m_brita     INT;
BEGIN
  -- Guard: só roda se materiais ainda não foram semeados
  IF (SELECT COUNT(*) FROM fvm_catalogo_materiais WHERE tenant_id = 0) > 0 THEN
    RETURN;
  END IF;

  -- Buscar IDs das categorias
  SELECT id INTO cat_aglom FROM fvm_categorias_materiais WHERE tenant_id = 0 AND nome = 'Aglomerantes e Argamassas';
  SELECT id INTO cat_agr   FROM fvm_categorias_materiais WHERE tenant_id = 0 AND nome = 'Agregados';
  SELECT id INTO cat_aco   FROM fvm_categorias_materiais WHERE tenant_id = 0 AND nome = 'Aço e Ferragens';
  SELECT id INTO cat_bloco FROM fvm_categorias_materiais WHERE tenant_id = 0 AND nome = 'Blocos e Tijolos';
  SELECT id INTO cat_conc  FROM fvm_categorias_materiais WHERE tenant_id = 0 AND nome = 'Concreto Usinado';

  -- ── M1: Cimento Portland CP-II-E-32 ──────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    exige_certificado, exige_nota_fiscal, prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_aglom, 'Cimento Portland CP-II-E-32', 'NBR 11578', 'NBR 11578:1991', 'sc',
    true, true, 0, 1
  ) RETURNING id INTO m_cimento;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_cimento, 'documental', 'CERTIFICADO DE QUALIDADE DO FABRICANTE PRESENTE?',            'critico', 'obrigatoria', 1),
  (0, m_cimento, 'documental', 'DATA DE FABRICAÇÃO VÁLIDA (máx. 90 dias)?',                   'critico', 'opcional',    2),
  (0, m_cimento, 'documental', 'NOTA FISCAL COM ESPECIFICAÇÃO CORRETA (tipo, classe)?',        'maior',   'opcional',    3),
  (0, m_cimento, 'visual',     'SACOS ÍNTEGROS SEM UMIDADE OU GRUMOS?',                        'maior',   'opcional',    4),
  (0, m_cimento, 'visual',     'QUANTIDADE CONFERIDA COM NF?',                                 'menor',   'nenhuma',     5);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_cimento, 'Certificado de Qualidade do Fabricante', 'CQ',   true,  1),
  (0, m_cimento, 'Nota Fiscal',                            'NF',   true,  2);

  -- ── M2: Barra de Aço CA-50 10mm ──────────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    exige_certificado, exige_laudo_ensaio, prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_aco, 'Barra de Aço CA-50 (10mm)', 'NBR 7480', 'NBR 7480:2007', 'kg',
    true, true, 0, 1
  ) RETURNING id INTO m_aco;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_aco, 'documental',  'CERTIFICADO DE QUALIDADE DA USINA (por corrida)?',           'critico', 'obrigatoria', 1),
  (0, m_aco, 'documental',  'LAUDO DE ENSAIO MECÂNICO (tração, dobramento)?',             'critico', 'obrigatoria', 2),
  (0, m_aco, 'documental',  'NF COM BITOLA E CORRIDA ESPECIFICADAS?',                     'maior',   'opcional',    3),
  (0, m_aco, 'visual',      'MARCAÇÃO DE LAMINAÇÃO LEGÍVEL?',                             'maior',   'opcional',    4),
  (0, m_aco, 'dimensional', 'BITOLA AFERIDA COM PAQUÍMETRO CONFORME?',                   'maior',   'opcional',    5),
  (0, m_aco, 'visual',      'BARRAS SEM CORROSÃO EXCESSIVA, DOBRAS OU DEFORMAÇÕES?',      'menor',   'opcional',    6);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_aco, 'Certificado de Qualidade da Usina', 'CQ',     true,  1),
  (0, m_aco, 'Laudo de Ensaio Mecânico',          'LE',     true,  2),
  (0, m_aco, 'Nota Fiscal',                       'NF',     true,  3);

  -- ── M3: Concreto Usinado fck 25 MPa ──────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    exige_certificado, exige_laudo_ensaio, prazo_quarentena_dias, foto_modo, ordem
  ) VALUES (
    0, cat_conc, 'Concreto Usinado fck 25 MPa', 'NBR 7212', 'NBR 7212:2012 / NBR 6118', 'm³',
    true, true, 28, 'obrigatoria', 1
  ) RETURNING id INTO m_concreto;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_concreto, 'documental', 'NF COM fck, RELAÇÃO A/C E SLUMP ESPECIFICADOS?',           'critico', 'obrigatoria', 1),
  (0, m_concreto, 'visual',     'SLUMP MEDIDO NA CHEGADA DENTRO DO ESPECIFICADO?',           'critico', 'obrigatoria', 2),
  (0, m_concreto, 'ensaio',     'CORPOS DE PROVA COLETADOS (mín. 2/betonada)?',              'critico', 'obrigatoria', 3),
  (0, m_concreto, 'documental', 'PRAZO DESDE SAÍDA DA CENTRAL (máx. 2h)?',                  'maior',   'opcional',    4),
  (0, m_concreto, 'visual',     'ASPECTO SEM SEGREGAÇÃO OU EXCESSO DE ÁGUA?',               'maior',   'opcional',    5),
  (0, m_concreto, 'documental', 'ROMANEIO DA CENTRAL COM TRAÇO IDENTIFICADO?',               'menor',   'nenhuma',     6);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_concreto, 'Nota Fiscal / Romaneio da Central', 'NF',     true,  1),
  (0, m_concreto, 'Laudo de Resistência CP (28 dias)', 'LE',     true,  2),
  (0, m_concreto, 'Relatório de Ensaio de Slump',      'RE',     false, 3);

  -- ── M4: Bloco Cerâmico 14cm ──────────────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_bloco, 'Bloco Cerâmico 14cm (vedação)', 'NBR 15270', 'NBR 15270-1:2005', 'un',
    0, 1
  ) RETURNING id INTO m_bloco;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_bloco, 'documental',  'NF COM ESPECIFICAÇÃO DE TIPO E DIMENSÃO?',                'maior',   'nenhuma',     1),
  (0, m_bloco, 'visual',      'BLOCOS SEM FISSURAS, LASCAMENTOS OU DEFORMAÇÕES?',        'maior',   'opcional',    2),
  (0, m_bloco, 'dimensional', 'DIMENSÕES CONFERIDAS (14 × 19 × 29 cm ±3mm)?',           'maior',   'opcional',    3),
  (0, m_bloco, 'visual',      'QUANTIDADE CONFERIDA COM NF?',                            'menor',   'nenhuma',     4),
  (0, m_bloco, 'visual',      'ARMAZENAMENTO FORA DO SOLO E PROTEGIDO?',                 'menor',   'nenhuma',     5);

  -- ── M5: Argamassa Industrializada AC-III ─────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    exige_certificado, prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_aglom, 'Argamassa Industrializada AC-III', 'NBR 14081', 'NBR 14081:2012', 'sc',
    true, 0, 2
  ) RETURNING id INTO m_argamassa;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_argamassa, 'documental', 'CERTIFICADO DO FABRICANTE (ABNT/INMETRO)?',              'critico', 'obrigatoria', 1),
  (0, m_argamassa, 'documental', 'VALIDADE DO PRODUTO DENTRO DO PRAZO?',                   'maior',   'nenhuma',     2),
  (0, m_argamassa, 'visual',     'SACOS SEM UMIDADE, GRUMOS OU EMBALAGEM ROMPIDA?',         'maior',   'opcional',    3),
  (0, m_argamassa, 'visual',     'QUANTIDADE CONFERIDA COM NF?',                            'menor',   'nenhuma',     4);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_argamassa, 'Certificado ABNT/INMETRO do Fabricante', 'CQ', true,  1),
  (0, m_argamassa, 'Nota Fiscal',                            'NF', true,  2);

  -- ── M6: Areia Natural Média ──────────────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_agr, 'Areia Natural Média', 'NBR 7211', 'NBR 7211:2009', 'm³',
    0, 1
  ) RETURNING id INTO m_areia;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_areia, 'documental',  'GUIA DE TRANSPORTE (LICENÇA AMBIENTAL) PRESENTE?',        'critico', 'obrigatoria', 1),
  (0, m_areia, 'visual',      'AREIA SEM ARGILA EXCESSIVA (AMARRONZADA)?',               'maior',   'opcional',    2),
  (0, m_areia, 'visual',      'AREIA SEM MATÉRIA ORGÂNICA (ESCURA)?',                   'maior',   'opcional',    3),
  (0, m_areia, 'visual',      'VOLUME ESTIMADO CONFERE COM NF?',                         'menor',   'nenhuma',     4);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_areia, 'Guia de Transporte / Licença Ambiental', 'GT', true, 1),
  (0, m_areia, 'Nota Fiscal',                            'NF', true, 2);

  -- ── M7: Brita nº 1 ──────────────────────────────────────────────────────

  INSERT INTO fvm_catalogo_materiais (
    tenant_id, categoria_id, nome, codigo, norma_referencia, unidade,
    prazo_quarentena_dias, ordem
  ) VALUES (
    0, cat_agr, 'Brita nº 1 (9,5–25mm)', 'NBR 7211', 'NBR 7211:2009', 'm³',
    0, 2
  ) RETURNING id INTO m_brita;

  INSERT INTO fvm_catalogo_itens (tenant_id, material_id, tipo, descricao, criticidade, foto_modo, ordem) VALUES
  (0, m_brita, 'documental',  'GUIA DE TRANSPORTE (LICENÇA AMBIENTAL) PRESENTE?',        'critico', 'obrigatoria', 1),
  (0, m_brita, 'visual',      'GRANULOMETRIA UNIFORME (sem excesso de pó)?',             'maior',   'opcional',    2),
  (0, m_brita, 'visual',      'AUSÊNCIA DE MATERIAIS ESTRANHOS (terra, madeira)?',       'maior',   'opcional',    3),
  (0, m_brita, 'visual',      'VOLUME ESTIMADO CONFERE COM NF?',                         'menor',   'nenhuma',     4);

  INSERT INTO fvm_documentos_exigidos (tenant_id, material_id, nome, sigla, obrigatorio, ordem) VALUES
  (0, m_brita, 'Guia de Transporte / Licença Ambiental', 'GT', true, 1),
  (0, m_brita, 'Nota Fiscal',                            'NF', true, 2);

END $$;

-- ── Seed: 7 Normas ABNT principais ───────────────────────────────────────────

INSERT INTO fvm_normas_abnt (tenant_id, numero, titulo, ano) VALUES
(0, 'NBR 11578', 'Cimento Portland Composto',                                     1991),
(0, 'NBR 7480',  'Aço destinado a armaduras para estruturas de concreto armado',  2007),
(0, 'NBR 7212',  'Execução de concreto dosado em central',                        2012),
(0, 'NBR 6118',  'Projeto de estruturas de concreto armado e protendido',         2014),
(0, 'NBR 15270', 'Componentes cerâmicos — Blocos e tijolos para alvenaria',       2005),
(0, 'NBR 14081', 'Argamassa colante industrializada',                             2012),
(0, 'NBR 7211',  'Agregados para concreto — Especificação',                       2009)
ON CONFLICT (tenant_id, numero) DO NOTHING;
