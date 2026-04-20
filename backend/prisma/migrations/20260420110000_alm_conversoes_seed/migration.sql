-- Seed inicial de conversões de unidades de medida (tenant_id = 0 = sistema)
-- catalogo_id = NULL → regra genérica aplicada quando não há regra específica do item.
-- Tenants ainda podem cadastrar conversões próprias (tenant_id real) com precedência maior.
--
-- Idempotente: ON CONFLICT DO NOTHING. Re-execução não altera dados existentes.
--
-- Fator convencionado: 1 unidade_origem = fator × unidade_destino
-- Exemplo: 1 M → 100 CM (fator = 100), logo converter(5, 'M', 'CM') = 500

INSERT INTO alm_unidades_conversao
  (tenant_id, catalogo_id, unidade_origem, unidade_destino, fator, descricao, ativo)
VALUES
  -- ── Comprimento (SI) ────────────────────────────────────────────────────
  (0, NULL, 'M',   'CM',  100,      'Metro para centímetro',             true),
  (0, NULL, 'CM',  'M',   0.01,     'Centímetro para metro',             true),
  (0, NULL, 'KM',  'M',   1000,     'Quilômetro para metro',             true),
  (0, NULL, 'M',   'KM',  0.001,    'Metro para quilômetro',             true),
  (0, NULL, 'MM',  'CM',  0.1,      'Milímetro para centímetro',         true),

  -- ── Área (SI) ──────────────────────────────────────────────────────────
  (0, NULL, 'M2',  'CM2', 10000,    'Metro quadrado para centímetro²',   true),
  (0, NULL, 'CM2', 'M2',  0.0001,   'Centímetro² para metro²',            true),
  (0, NULL, 'HA',  'M2',  10000,    'Hectare para metro²',                true),

  -- ── Volume (SI) ────────────────────────────────────────────────────────
  (0, NULL, 'M3',  'L',   1000,     'Metro cúbico para litro',            true),
  (0, NULL, 'L',   'M3',  0.001,    'Litro para metro cúbico',            true),
  (0, NULL, 'L',   'ML',  1000,     'Litro para mililitro',               true),
  (0, NULL, 'ML',  'L',   0.001,    'Mililitro para litro',               true),

  -- ── Massa (SI) ─────────────────────────────────────────────────────────
  (0, NULL, 'KG',  'G',   1000,     'Quilograma para grama',              true),
  (0, NULL, 'G',   'KG',  0.001,    'Grama para quilograma',              true),
  (0, NULL, 'T',   'KG',  1000,     'Tonelada para quilograma',           true),
  (0, NULL, 'KG',  'T',   0.001,    'Quilograma para tonelada',           true),

  -- ── Embalagens genéricas de construção ─────────────────────────────────
  -- Atenção: essas são padrões do mercado brasileiro. Se o fornecedor
  -- trabalha com embalagem diferente (ex: cimento ensacado de 40kg),
  -- cadastrar conversão específica por catalogo_id no tenant.
  (0, NULL, 'MLH', 'PC',  1000,     'Milheiro para peça (tijolos, telhas)',     true),
  (0, NULL, 'PC',  'MLH', 0.001,    'Peça para milheiro',                       true),
  (0, NULL, 'DZ',  'PC',  12,       'Dúzia para peça',                           true),
  (0, NULL, 'BR',  'M',   12,       'Barra padrão (aço CA-50/60) para metros',  true),
  (0, NULL, 'TB',  'M',   6,        'Tubo padrão (PVC) para metros',             true),
  (0, NULL, 'ROL', 'M',   100,      'Rolo padrão (cabo elétrico) para metros',   true),
  (0, NULL, 'PAL', 'PC',  96,       'Pallet padrão (blocos cerâmicos) para peças', true),
  (0, NULL, 'SC',  'KG',  50,       'Saco padrão (cimento) para kg',             true),
  (0, NULL, 'SC20','KG',  20,       'Saco 20kg (argamassa/cal) para kg',         true),
  (0, NULL, 'SC40','KG',  40,       'Saco 40kg (gesso) para kg',                 true),
  (0, NULL, 'GL',  'L',   3.6,      'Galão (tinta padrão) para litros',          true),
  (0, NULL, 'BD',  'L',   18,       'Balde (tinta padrão) para litros',          true),
  (0, NULL, 'LT',  'L',   0.9,      'Lata (tinta padrão) para litros',           true),
  (0, NULL, 'FD',  'PC',  100,      'Fardo padrão (parafuso/prego) para peças',  true),
  (0, NULL, 'CX',  'PC',  100,      'Caixa padrão (parafuso/bucha) para peças',  true)

ON CONFLICT (tenant_id, COALESCE(catalogo_id, 0), unidade_origem, unidade_destino)
DO NOTHING;
