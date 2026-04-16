-- ════════════════════════════════════════════════════════════════════════════
-- ELDOX — Módulo Almoxarifado
-- Migration: 20260416000001_almoxarifado_init
-- Cria as 20 tabelas do módulo (alm_ prefix)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Locais de estoque dentro de uma obra ───────────────────────────────────
CREATE TABLE alm_estoque_locais (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  obra_id     INT NOT NULL REFERENCES "Obra"(id) ON DELETE CASCADE,
  nome        VARCHAR(100) NOT NULL,
  descricao   VARCHAR(255),
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_locais_obra ON alm_estoque_locais(tenant_id, obra_id);

-- ── 2. Saldo atual de estoque (um registro por catálogo × local × obra) ────────
CREATE TABLE alm_estoque_saldo (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id) ON DELETE CASCADE,
  catalogo_id   INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  local_id      INT REFERENCES alm_estoque_locais(id),
  quantidade    NUMERIC(15, 4) NOT NULL DEFAULT 0,
  estoque_min   NUMERIC(15, 4) NOT NULL DEFAULT 0,
  unidade       VARCHAR(20)   NOT NULL,
  updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_saldo_unique
  ON alm_estoque_saldo(tenant_id, obra_id, catalogo_id, COALESCE(local_id, 0));
CREATE INDEX idx_alm_saldo_tenant_obra ON alm_estoque_saldo(tenant_id, obra_id);

-- ── 3. Ledger de movimentos de estoque ────────────────────────────────────────
CREATE TABLE alm_movimentos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  obra_id          INT NOT NULL REFERENCES "Obra"(id),
  catalogo_id      INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  local_id         INT REFERENCES alm_estoque_locais(id),
  tipo             VARCHAR(20) NOT NULL,
  -- entrada | saida | transferencia | perda | ajuste
  quantidade       NUMERIC(15, 4) NOT NULL,
  unidade          VARCHAR(20)   NOT NULL,
  saldo_anterior   NUMERIC(15, 4) NOT NULL,
  saldo_posterior  NUMERIC(15, 4) NOT NULL,
  referencia_tipo  VARCHAR(30),   -- nfe | oc | rdo | manual
  referencia_id    INT,
  observacao       TEXT,
  criado_por       INT REFERENCES "Usuario"(id),
  created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_mov_tenant_obra ON alm_movimentos(tenant_id, obra_id);
CREATE INDEX idx_alm_mov_catalogo    ON alm_movimentos(catalogo_id);
CREATE INDEX idx_alm_mov_created     ON alm_movimentos(created_at);

-- ── 4. Versões de orçamento importadas ─────────────────────────────────────────
CREATE TABLE alm_orcamento_versoes (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  obra_id     INT NOT NULL REFERENCES "Obra"(id) ON DELETE CASCADE,
  versao      INT NOT NULL DEFAULT 1,
  nome        VARCHAR(100),
  ativo       BOOLEAN DEFAULT false,
  importado_por INT REFERENCES "Usuario"(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  deleted_at  TIMESTAMP
);
CREATE INDEX idx_alm_orc_obra ON alm_orcamento_versoes(tenant_id, obra_id);

-- ── 5. Itens do orçamento ──────────────────────────────────────────────────────
CREATE TABLE alm_orcamento_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  versao_id       INT NOT NULL REFERENCES alm_orcamento_versoes(id) ON DELETE CASCADE,
  catalogo_id     INT REFERENCES fvm_catalogo_materiais(id),
  descricao_orig  VARCHAR(255) NOT NULL,  -- texto original da planilha
  unidade         VARCHAR(20),
  quantidade      NUMERIC(15, 4),
  preco_unitario  NUMERIC(15, 4),
  mes_previsto    INT,           -- 1-12
  etapa           VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_orc_itens_versao ON alm_orcamento_itens(versao_id);

-- ── 6. Planejamento de demanda mensal ─────────────────────────────────────────
CREATE TABLE alm_planejamento_itens (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id) ON DELETE CASCADE,
  catalogo_id   INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  mes           INT NOT NULL,   -- 1-12
  ano           INT NOT NULL,
  quantidade    NUMERIC(15, 4) NOT NULL,
  unidade       VARCHAR(20)   NOT NULL,
  observacao    TEXT,
  criado_por    INT REFERENCES "Usuario"(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_plan_unique
  ON alm_planejamento_itens(tenant_id, obra_id, catalogo_id, mes, ano);

-- ── 7. Configuração do fluxo de aprovação por tenant ──────────────────────────
CREATE TABLE alm_fluxo_aprovacao_config (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  etapa       INT NOT NULL,      -- 1, 2, 3...
  nome        VARCHAR(100) NOT NULL,
  roles       TEXT[] NOT NULL,   -- roles que podem aprovar esta etapa
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_fluxo_etapa ON alm_fluxo_aprovacao_config(tenant_id, etapa)
  WHERE ativo = true;

-- ── 8. Solicitações de compra ──────────────────────────────────────────────────
CREATE TABLE alm_solicitacoes (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  obra_id          INT NOT NULL REFERENCES "Obra"(id),
  numero           SERIAL,
  descricao        VARCHAR(255) NOT NULL,
  status           VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  -- rascunho | aguardando_aprovacao | em_aprovacao | aprovada | reprovada | cancelada
  urgente          BOOLEAN DEFAULT false,
  data_necessidade DATE,
  servico_ref      VARCHAR(100),
  etapa_atual      INT DEFAULT 1,
  solicitante_id   INT REFERENCES "Usuario"(id),
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_sol_obra   ON alm_solicitacoes(tenant_id, obra_id);
CREATE INDEX idx_alm_sol_status ON alm_solicitacoes(tenant_id, status);

-- ── 9. Itens da solicitação ────────────────────────────────────────────────────
CREATE TABLE alm_solicitacao_itens (
  id              SERIAL PRIMARY KEY,
  solicitacao_id  INT NOT NULL REFERENCES alm_solicitacoes(id) ON DELETE CASCADE,
  catalogo_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  quantidade      NUMERIC(15, 4) NOT NULL,
  unidade         VARCHAR(20)   NOT NULL,
  observacao      TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_sol_itens ON alm_solicitacao_itens(solicitacao_id);

-- ── 10. Histórico de aprovações ───────────────────────────────────────────────
CREATE TABLE alm_aprovacoes (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  solicitacao_id  INT NOT NULL REFERENCES alm_solicitacoes(id) ON DELETE CASCADE,
  etapa           INT NOT NULL,
  acao            VARCHAR(20) NOT NULL,  -- aprovado | reprovado | cancelado
  aprovador_id    INT REFERENCES "Usuario"(id),
  observacao      TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_aprov ON alm_aprovacoes(solicitacao_id);

-- ── 11. Cotações por fornecedor ────────────────────────────────────────────────
CREATE TABLE alm_cotacoes (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  solicitacao_id  INT NOT NULL REFERENCES alm_solicitacoes(id),
  fornecedor_id   INT NOT NULL REFERENCES fvm_fornecedores(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'em_preenchimento',
  -- em_preenchimento | enviada | selecionada | rejeitada
  prazo_entrega   DATE,
  condicao_pgto   VARCHAR(100),
  observacao      TEXT,
  selecionada_por INT REFERENCES "Usuario"(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_cotacao ON alm_cotacoes(tenant_id, solicitacao_id);

-- ── 12. Itens de cotação ───────────────────────────────────────────────────────
CREATE TABLE alm_cotacao_itens (
  id              SERIAL PRIMARY KEY,
  cotacao_id      INT NOT NULL REFERENCES alm_cotacoes(id) ON DELETE CASCADE,
  catalogo_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  quantidade      NUMERIC(15, 4),
  unidade         VARCHAR(20),
  preco_unitario  NUMERIC(15, 4),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── 13. Ordens de Compra ──────────────────────────────────────────────────────
CREATE TABLE alm_ordens_compra (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  obra_id         INT NOT NULL REFERENCES "Obra"(id),
  solicitacao_id  INT REFERENCES alm_solicitacoes(id),
  fornecedor_id   INT NOT NULL REFERENCES fvm_fornecedores(id),
  numero          VARCHAR(20) GENERATED ALWAYS AS ('OC-' || LPAD(id::text, 3, '0')) STORED,
  status          VARCHAR(30) NOT NULL DEFAULT 'rascunho',
  -- rascunho | confirmada | emitida | parcialmente_recebida | recebida | cancelada
  valor_total     NUMERIC(15, 2),
  prazo_entrega   DATE,
  condicao_pgto   VARCHAR(100),
  local_entrega   VARCHAR(255),
  observacoes     TEXT,
  pdf_url         TEXT,
  version         INT NOT NULL DEFAULT 1,  -- optimistic locking
  criado_por      INT REFERENCES "Usuario"(id),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_oc_obra   ON alm_ordens_compra(tenant_id, obra_id);
CREATE INDEX idx_alm_oc_status ON alm_ordens_compra(tenant_id, status);

-- ── 14. Itens da OC ───────────────────────────────────────────────────────────
CREATE TABLE alm_oc_itens (
  id              SERIAL PRIMARY KEY,
  oc_id           INT NOT NULL REFERENCES alm_ordens_compra(id) ON DELETE CASCADE,
  catalogo_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  quantidade      NUMERIC(15, 4) NOT NULL,
  unidade         VARCHAR(20)   NOT NULL,
  preco_unitario  NUMERIC(15, 4),
  qtd_recebida    NUMERIC(15, 4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── 15. Fila de webhooks Qive (idempotente pela chave_nfe) ────────────────────
CREATE TABLE alm_nfe_webhooks (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT,
  chave_nfe   VARCHAR(44) NOT NULL,
  payload_raw JSONB NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- pendente | processando | processado | erro | dlq
  tentativas  INT NOT NULL DEFAULT 0,
  erro_msg    TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_webhook_chave ON alm_nfe_webhooks(chave_nfe);
CREATE INDEX idx_alm_webhook_status ON alm_nfe_webhooks(status);

-- ── 16. Notas Fiscais recebidas ───────────────────────────────────────────────
CREATE TABLE alm_notas_fiscais (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  obra_id         INT REFERENCES "Obra"(id),
  oc_id           INT REFERENCES alm_ordens_compra(id),
  webhook_id      INT REFERENCES alm_nfe_webhooks(id),
  chave_nfe       VARCHAR(44) NOT NULL,
  numero          VARCHAR(20),
  serie           VARCHAR(5),
  emitente_cnpj   VARCHAR(18),
  emitente_nome   VARCHAR(255),
  data_emissao    DATE,
  valor_total     NUMERIC(15, 2),
  xml_url         TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pendente_match',
  -- pendente_match | match_parcial | match_ok | aceita | rejeitada | sem_oc
  aceito_por      INT REFERENCES "Usuario"(id),
  aceito_at       TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_nfe_chave    ON alm_notas_fiscais(tenant_id, chave_nfe);
CREATE INDEX idx_alm_nfe_obra            ON alm_notas_fiscais(tenant_id, obra_id);
CREATE INDEX idx_alm_nfe_status          ON alm_notas_fiscais(tenant_id, status);

-- ── 17. Itens da NF-e com match IA ───────────────────────────────────────────
CREATE TABLE alm_nfe_itens (
  id               SERIAL PRIMARY KEY,
  nfe_id           INT NOT NULL REFERENCES alm_notas_fiscais(id) ON DELETE CASCADE,
  xprod            VARCHAR(255) NOT NULL,    -- descrição original na NF-e
  ncm              VARCHAR(10),
  cfop             VARCHAR(5),
  unidade_nfe      VARCHAR(20),
  quantidade       NUMERIC(15, 4),
  valor_unitario   NUMERIC(15, 4),
  valor_total      NUMERIC(15, 4),
  catalogo_id      INT REFERENCES fvm_catalogo_materiais(id),
  match_status     VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- auto | pendente | sem_match | confirmado_manual
  ai_score         NUMERIC(5, 4),
  ai_sugestoes     JSONB,   -- [{catalogo_id, score, motivo}]
  confirmado_por   INT REFERENCES "Usuario"(id),
  confirmado_at    TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_nfe_itens_nfe ON alm_nfe_itens(nfe_id);

-- ── 18. Regras de conversão de unidades ───────────────────────────────────────
CREATE TABLE alm_unidades_conversao (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  catalogo_id     INT REFERENCES fvm_catalogo_materiais(id),
  unidade_origem  VARCHAR(20) NOT NULL,
  unidade_destino VARCHAR(20) NOT NULL,
  fator           NUMERIC(15, 6) NOT NULL,
  descricao       VARCHAR(100),
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_alm_conv_unique ON alm_unidades_conversao
  (tenant_id, COALESCE(catalogo_id, 0), unidade_origem, unidade_destino);

-- ── 19. Alertas de estoque mínimo / reposição ─────────────────────────────────
CREATE TABLE alm_alertas_estoque (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  obra_id     INT NOT NULL REFERENCES "Obra"(id),
  catalogo_id INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  local_id    INT REFERENCES alm_estoque_locais(id),
  tipo        VARCHAR(30) NOT NULL,   -- estoque_minimo | reposicao_prevista | anomalia
  nivel       VARCHAR(20) NOT NULL,   -- critico | atencao
  mensagem    TEXT NOT NULL,
  lido        BOOLEAN DEFAULT false,
  lido_por    INT REFERENCES "Usuario"(id),
  lido_at     TIMESTAMP,
  criado_at   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_alertas_tenant ON alm_alertas_estoque(tenant_id, lido);
CREATE INDEX idx_alm_alertas_obra   ON alm_alertas_estoque(tenant_id, obra_id);

-- ── 20. Audit trail de análises de IA ────────────────────────────────────────
CREATE TABLE alm_ai_analises (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  tipo          VARCHAR(30) NOT NULL,
  -- nfe_match | reorder_prediction | anomaly_detection
  referencia_id INT,
  resultado     JSONB NOT NULL,
  modelo        VARCHAR(60),
  tokens_in     INT,
  tokens_out    INT,
  duracao_ms    INT,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_alm_ai_tenant ON alm_ai_analises(tenant_id, tipo);
