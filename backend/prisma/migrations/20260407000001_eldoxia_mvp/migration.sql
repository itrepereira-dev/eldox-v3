-- =============================================================================
-- Eldox v3 — Migration: EldoxIA MVP
-- Versão ARCH: 1.0.0 | Data: 2026-04-07
-- Agente: DBA | Input: ARCH-ELDOX-IA.md
-- =============================================================================
-- Tabelas do assistente conversacional EldoxIA — Sprint 3 (junto com GED)
-- Tabelas pós-MVP (pgvector / ia_embeddings) ficam em migration futura
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DEPENDÊNCIA: pgcrypto para gen_random_uuid()
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. ia_conversas
--    Sessão de conversa por usuário (contexto: tenant + usuário + obra opcional)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_conversas (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  usuario_id      INT NOT NULL REFERENCES "Usuario"(id) ON DELETE CASCADE,
  obra_id         INT REFERENCES "Obra"(id) ON DELETE SET NULL,
  titulo          VARCHAR(255),          -- gerado automaticamente no 1º turno
  -- resumo: comprimido quando o histórico fica longo (job ia.comprimir)
  -- substitui os turnos antigos (> 10 turnos) no envio ao modelo
  resumo          TEXT,
  total_tokens    INT NOT NULL DEFAULT 0, -- acumulado para billing e throttle
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_conversas_tenant   ON ia_conversas(tenant_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_obra     ON ia_conversas(tenant_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_recentes ON ia_conversas(tenant_id, usuario_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- 2. ia_mensagens
--    Turnos individuais da conversa (user | assistant | tool)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_mensagens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  conversa_id     INT NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
  role            VARCHAR(10) NOT NULL
    CONSTRAINT chk_ia_role CHECK (role IN ('user', 'assistant', 'tool')),
  conteudo        TEXT NOT NULL,
  -- tool_calls: presente quando role='assistant' aciona ferramentas
  -- [{ "id": "call_abc", "name": "ged_buscar_documento", "args": {...} }]
  tool_calls      JSONB,
  -- tool_results: presente quando role='tool' retorna resultado
  -- [{ "call_id": "call_abc", "resultado": {...}, "erro": null }]
  tool_results    JSONB,
  modelo_usado    VARCHAR(60),           -- ex: 'claude-haiku-4-5', 'claude-sonnet-4-6'
  tokens_entrada  INT,
  tokens_saida    INT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_mensagens_conversa ON ia_mensagens(conversa_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. ia_acoes_pendentes
--    Ações de escrita aguardando confirmação explícita do usuário
--    TTL: 5 minutos — expiradas são ignoradas, não executadas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_acoes_pendentes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         INT NOT NULL,
  conversa_id       INT NOT NULL REFERENCES ia_conversas(id) ON DELETE CASCADE,
  usuario_id        INT NOT NULL REFERENCES "Usuario"(id) ON DELETE CASCADE,
  -- nome da tool que será executada após confirmação
  tool_name         VARCHAR(100) NOT NULL,
  -- argumentos serializados para executar a tool
  tool_args         JSONB NOT NULL,
  -- texto legível apresentado ao usuário para confirmar
  descricao_human   TEXT NOT NULL,
  expires_at        TIMESTAMP NOT NULL,    -- NOW() + 5 minutos
  confirmada_em     TIMESTAMP NULL,
  cancelada_em      TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_ia_acoes_usuario  ON ia_acoes_pendentes(tenant_id, usuario_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ia_acoes_expirar  ON ia_acoes_pendentes(expires_at)
  WHERE confirmada_em IS NULL AND cancelada_em IS NULL;

-- ---------------------------------------------------------------------------
-- 4. ia_uso_tokens
--    Rastreamento de consumo mensal por tenant (billing + throttle)
--    Atualizado atomicamente via UPDATE ... SET tokens_usados = tokens_usados + $n
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_uso_tokens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  -- Sempre o 1º dia do mês: DATE_TRUNC('month', NOW())::DATE
  mes_referencia  DATE NOT NULL,
  tokens_usados   BIGINT NOT NULL DEFAULT 0,
  custo_usd       DECIMAL(10, 4) NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_ia_uso_tokens_tenant ON ia_uso_tokens(tenant_id, mes_referencia DESC);

-- ---------------------------------------------------------------------------
-- 5. ia_memoria
--    Memória persistida cross-session
--    Preferências e fatos que o usuário ensinou à IA
--    NULL em usuario_id = memória de tenant (compartilhada entre usuários)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ia_memoria (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  usuario_id  INT REFERENCES "Usuario"(id) ON DELETE CASCADE,
  chave       VARCHAR(100) NOT NULL,
  valor       TEXT NOT NULL,
  fonte       VARCHAR(10) NOT NULL DEFAULT 'USER'
    CONSTRAINT chk_ia_memoria_fonte CHECK (fonte IN ('USER', 'SISTEMA')),
  -- NULL = permanente | data = expira automaticamente
  expires_at  TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, usuario_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_ia_memoria_tenant ON ia_memoria(tenant_id, usuario_id);

-- =============================================================================
-- GRANT
-- =============================================================================
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'eldox_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      ia_conversas,
      ia_mensagens,
      ia_acoes_pendentes,
      ia_uso_tokens,
      ia_memoria
    TO eldox_app;

    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO eldox_app;
  END IF;
END $$;

-- =============================================================================
-- NOTA: ia_embeddings (pgvector RAG) fica em migration separada (Sprint 5+)
-- Requer: CREATE EXTENSION vector; antes de criar a tabela.
-- Schema previsto em ARCH-ELDOX-IA.md seção 4.
-- =============================================================================
