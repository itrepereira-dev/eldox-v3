-- Migration: Fix RDO enum values to match application domain
-- Tables are empty at this point so safe to alter type + column

-- ─── rdo_condicao_clima ───────────────────────────────────────────────────────
-- Old values: claro, nublado, chuvoso
-- New values: ensolarado, parcialmente_nublado, nublado, chuvoso, tempestade

ALTER TABLE rdo_clima ALTER COLUMN condicao TYPE text;
DROP TYPE IF EXISTS rdo_condicao_clima;
CREATE TYPE rdo_condicao_clima AS ENUM (
  'ensolarado',
  'parcialmente_nublado',
  'nublado',
  'chuvoso',
  'tempestade'
);
ALTER TABLE rdo_clima ALTER COLUMN condicao TYPE rdo_condicao_clima
  USING condicao::rdo_condicao_clima;

-- ─── rdo_tipo_mao_de_obra ─────────────────────────────────────────────────────
-- Old values: catalogo, personalizada
-- New values: proprio, subcontratado, terceirizado

ALTER TABLE rdo_mao_de_obra ALTER COLUMN tipo TYPE text;
DROP TYPE IF EXISTS rdo_tipo_mao_de_obra;
CREATE TYPE rdo_tipo_mao_de_obra AS ENUM (
  'proprio',
  'subcontratado',
  'terceirizado'
);
ALTER TABLE rdo_mao_de_obra ALTER COLUMN tipo TYPE rdo_tipo_mao_de_obra
  USING tipo::rdo_tipo_mao_de_obra;
