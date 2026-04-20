-- Fix: garante a coluna `sinapi_codigo` em alm_orcamento_itens.
-- Necessária em bancos zerados, onde `20260415000201_sinapi_variantes` (pre-
-- almoxarifado_init) pula o ALTER por falta da tabela. Em bancos existentes
-- (prod) a coluna já foi criada pela migration original — este comando é
-- idempotente (ADD COLUMN IF NOT EXISTS) e por isso inócuo.

ALTER TABLE "alm_orcamento_itens"
  ADD COLUMN IF NOT EXISTS "sinapi_codigo" VARCHAR(20);
