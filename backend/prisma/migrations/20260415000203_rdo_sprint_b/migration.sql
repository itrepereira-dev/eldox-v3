-- Sprint B — RDO: Fotos, Relatórios XLS, Compartilhamento, Integração Orçamento/Efetivo
-- Criado manualmente em 2026-04-15

-- ── 1. rdo_fotos — campos para upload direto (sem depender do GED) ─────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='url') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "url" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='thumbnail_url') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "thumbnail_url" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='nome_arquivo') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "nome_arquivo" VARCHAR(255);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='tamanho_bytes') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "tamanho_bytes" INT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='upload_por') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "upload_por" INT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_fotos' AND column_name='created_at') THEN
    ALTER TABLE rdo_fotos ADD COLUMN "created_at" TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ── 2. rdos — token para compartilhamento com cliente ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdos' AND column_name='token_cliente') THEN
    ALTER TABLE rdos ADD COLUMN "token_cliente" VARCHAR(64);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdos' AND column_name='token_cliente_expires_at') THEN
    ALTER TABLE rdos ADD COLUMN "token_cliente_expires_at" TIMESTAMP;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_rdos_token_cliente"
  ON rdos ("token_cliente")
  WHERE "token_cliente" IS NOT NULL;

-- ── 3. rdo_atividades — link com orçamento + quantidade executada ──────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_atividades' AND column_name='orcamento_item_id') THEN
    ALTER TABLE rdo_atividades ADD COLUMN "orcamento_item_id" INT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_atividades' AND column_name='quantidade_executada') THEN
    ALTER TABLE rdo_atividades ADD COLUMN "quantidade_executada" NUMERIC(12,4);
  END IF;
END $$;

-- ── 4. rdo_mao_de_obra — horas calculadas + link com efetivo ──────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_mao_de_obra' AND column_name='horas_trabalhadas') THEN
    ALTER TABLE rdo_mao_de_obra ADD COLUMN "horas_trabalhadas" NUMERIC(5,2);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_mao_de_obra' AND column_name='efetivo_registro_id') THEN
    ALTER TABLE rdo_mao_de_obra ADD COLUMN "efetivo_registro_id" INT;
  END IF;
END $$;

-- hora_entrada e hora_saida podem já existir, adiciona se não existir
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_mao_de_obra' AND column_name='hora_entrada') THEN
    ALTER TABLE rdo_mao_de_obra ADD COLUMN "hora_entrada" VARCHAR(5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rdo_mao_de_obra' AND column_name='hora_saida') THEN
    ALTER TABLE rdo_mao_de_obra ADD COLUMN "hora_saida" VARCHAR(5);
  END IF;
END $$;
