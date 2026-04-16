-- Migration: 20260414000005_ensaio_alertas
-- Adiciona whatsapp ao Usuario e cria tabela de log de alertas de ensaio

-- Adicionar whatsapp ao Usuario (pode não existir)
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);

-- Tabela de log de alertas enviados
CREATE TABLE IF NOT EXISTS ensaio_alerta_log (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  tipo          VARCHAR(50)  NOT NULL,   -- 'PROXIMO_CUPOM' | 'LAUDO_APROVADO' | 'LAUDO_REPROVADO' | 'QUARENTENA_VENCIDA'
  referencia_id INTEGER      NOT NULL,   -- ensaio_id ou revisao_id
  destinatario  VARCHAR(20)  NOT NULL,   -- número WhatsApp E.164
  status        VARCHAR(20)  NOT NULL,   -- 'ENVIADO' | 'FALHOU' | 'SEM_WHATSAPP'
  tentativas    INTEGER      NOT NULL DEFAULT 1,
  erro          TEXT,                    -- mensagem de erro se FALHOU
  criado_em     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerta_log_tenant ON ensaio_alerta_log(tenant_id, tipo, criado_em);
