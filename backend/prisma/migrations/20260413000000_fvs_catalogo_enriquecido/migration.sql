-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: Enriquecimento do Catálogo FVS
-- Origem dos dados: auditoria Eldox v1 + v2 (migration_007_dados_simulados)
-- Ações:
--   1. Adiciona norma_referencia aos 8 serviços originais PO
--   2. Adiciona criterio_aceite nos itens dos serviços originais
--   3. Insere 10 novos serviços de sistema (tenant_id=0) com normas + critérios
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Enriquece normas dos serviços existentes ───────────────────────────────

UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 7200'  WHERE tenant_id=0 AND codigo='PO 19.20' AND nome='EXECUÇÃO DE INSTALAÇÃO DE PORTAS';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 13245' WHERE tenant_id=0 AND codigo='PO 21.22' AND nome='EXECUÇÃO DE PINTURA INTERNA';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 13245' WHERE tenant_id=0 AND codigo='PO 21.22' AND nome='EXECUÇÃO DE PINTURA EXTERNA';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 5410'  WHERE tenant_id=0 AND codigo='PO 23';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 5626'  WHERE tenant_id=0 AND codigo='PO 24';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 15575' WHERE tenant_id=0 AND codigo='PO 25';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 9077'  WHERE tenant_id=0 AND codigo='PO 43';
UPDATE fvs_catalogo_servicos SET norma_referencia = 'NBR 5419'  WHERE tenant_id=0 AND codigo='PO 44';

-- ── 2. Enriquece criterio_aceite nos itens existentes ────────────────────────

DO $$
DECLARE
  s_portas       INT;
  s_pintura_int  INT;
  s_pintura_ext  INT;
  s_eletrica     INT;
  s_hidro        INT;
  s_bancadas     INT;
  s_incendio     INT;
  s_spda         INT;
BEGIN
  SELECT id INTO s_portas      FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 19.20' AND nome='EXECUÇÃO DE INSTALAÇÃO DE PORTAS';
  SELECT id INTO s_pintura_int FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 21.22' AND nome='EXECUÇÃO DE PINTURA INTERNA';
  SELECT id INTO s_pintura_ext FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 21.22' AND nome='EXECUÇÃO DE PINTURA EXTERNA';
  SELECT id INTO s_eletrica    FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 23';
  SELECT id INTO s_hidro       FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 24';
  SELECT id INTO s_bancadas    FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 25';
  SELECT id INTO s_incendio    FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 43';
  SELECT id INTO s_spda        FROM fvs_catalogo_servicos WHERE tenant_id=0 AND codigo='PO 44';

  -- PO 19.20 — Portas
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Porta deve abrir e fechar sem travamento, folga lateral ≤ 3mm' WHERE servico_id=s_portas AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Alisar fixado com pregos ou cola sem folgas visíveis' WHERE servico_id=s_portas AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Alisar deve estar nivelado e alinhado com a face da parede (tolerância ±2mm)' WHERE servico_id=s_portas AND ordem=3;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Guarnições fixadas em todo o perímetro sem frestas' WHERE servico_id=s_portas AND ordem=4;

  -- PO 21.22 — Pintura Interna
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Ausência de emendas visíveis, manchas ou variação de tom sob iluminação rasante' WHERE servico_id=s_pintura_int AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Cantos e arestas com cobertura total, sem descamação ou gotejamento' WHERE servico_id=s_pintura_int AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Superfície livre de salpicos, fixações, fios ou outros elementos estranhos' WHERE servico_id=s_pintura_int AND ordem=3;

  -- PO 21.22 — Pintura Externa
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Ausência de manchas, eflorescências, bolhas ou destacamentos. Cor uniforme conforme projeto.' WHERE servico_id=s_pintura_ext AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Superfície contínua sem fissuras, bolhas, descamação ou elementos aderidos' WHERE servico_id=s_pintura_ext AND ordem=2;

  -- PO 23 — Elétrica
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Todos os eletrodutos devem conter a fiação especificada em projeto. Verificar com multímetro.' WHERE servico_id=s_eletrica AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Cada caixa de instalação deve ter sua placa instalada, nivelada e fixada' WHERE servico_id=s_eletrica AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'QD completo com disjuntores identificados, barramento protegido e tampa instalada' WHERE servico_id=s_eletrica AND ordem=3;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Placa nivelada (±2mm), caixa limpa de resíduos, sem pontas expostas' WHERE servico_id=s_eletrica AND ordem=4;

  -- PO 24 — Hidro
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Tubulações aparafusadas ou chumbadas conforme projeto, sem trincas no reboco' WHERE servico_id=s_hidro AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Todos os registros de gaveta e esfera instalados e operacionais' WHERE servico_id=s_hidro AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Hidrômetro instalado, lacrado e aferido pela concessionária' WHERE servico_id=s_hidro AND ordem=3;

  -- PO 25 — Bancadas e louças
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Nível verificado com régua. Tolerância ±3mm em 1m.' WHERE servico_id=s_bancadas AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Altura do tampo medida do piso acabado. Tolerância ±5mm.' WHERE servico_id=s_bancadas AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Cordão de silicone contínuo, sem falhas, entre a peça e a parede' WHERE servico_id=s_bancadas AND ordem=3;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Vaso instalado com parafusos, tampa e assento fixados. Sem folga no piso.' WHERE servico_id=s_bancadas AND ordem=4;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Torneira, engate flexível e sifão instalados, sem vazamentos com água aberta' WHERE servico_id=s_bancadas AND ordem=5;

  -- PO 43 — Incêndio
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Extintor carga válida, suporte preso à parede, placa de identificação visível a 1m' WHERE servico_id=s_incendio AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Central energizada, painel identificado, bateria backup funcional' WHERE servico_id=s_incendio AND ordem=2;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Acionador manual e sirene fixados, sinalizados, desobstruídos em cada pavimento' WHERE servico_id=s_incendio AND ordem=3;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Placa fotoluminescente instalada, visível a 10m, sinalização conforme ABNT NBR 13434' WHERE servico_id=s_incendio AND ordem=4;

  -- PO 44 — SPDA
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Captores instalados conforme projeto (Franklin ou gaiola), resistência à tração ≥ 500N' WHERE servico_id=s_spda AND ordem=1;
  UPDATE fvs_catalogo_itens SET criterio_aceite = 'Descidas em cobre nu 50mm², braçadeiras a cada 1m, continuidade elétrica verificada' WHERE servico_id=s_spda AND ordem=2;

END $$;

-- ── 3. Insere 10 novos serviços com normas e critérios de aceite (v2) ─────────

DO $$
DECLARE
  cat_estrutura   INT;
  cat_alvenaria   INT;
  cat_impermeab   INT;
  cat_ele         INT;
  cat_hid         INT;
  s_formas        INT;
  s_armacao       INT;
  s_concretagem   INT;
  s_impermeab     INT;
  s_alvenaria     INT;
  s_chapisco      INT;
  s_contrapiso    INT;
  s_eletrica_nbr  INT;
  s_hidro_nbr     INT;
  s_gas           INT;
BEGIN
  -- Guard: só insere se os novos serviços ainda não existirem
  IF (SELECT COUNT(*) FROM fvs_catalogo_servicos WHERE tenant_id=0 AND nome='Forma e Escoramento') > 0 THEN
    RETURN;
  END IF;

  SELECT id INTO cat_estrutura FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Estrutura';
  SELECT id INTO cat_alvenaria FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Alvenaria';
  SELECT id INTO cat_impermeab FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Impermeabilização';
  SELECT id INTO cat_ele       FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Elétricas';
  SELECT id INTO cat_hid       FROM fvs_categorias_servico WHERE tenant_id=0 AND nome='Instalações Hidráulicas';

  -- ── ESTRUTURA ──────────────────────────────────────────────────────────────

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_estrutura, 'Forma e Escoramento', 'NBR 15696', 10)
  RETURNING id INTO s_formas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_formas, 'Formas alinhadas e aprumadas?',        'Desvio máximo 5mm em qualquer direção verificado com prumo',       'critico',  'obrigatoria', 1),
  (0, s_formas, 'Escoramentos travados corretamente?',   'Travamento conforme projeto de escora aprovado, sem folgas',       'critico',  'obrigatoria', 2),
  (0, s_formas, 'Estanqueidade das juntas garantida?',   'Sem frestas visíveis; selar com fita vedante se necessário',       'maior',    'opcional',    3),
  (0, s_formas, 'Cobrimento das armaduras garantido?',   'Espaçadores posicionados a cada 60cm, com espessura conforme NBR 6118', 'critico', 'obrigatoria', 4),
  (0, s_formas, 'Desmoldante aplicado uniformemente?',   'Camada contínua e uniforme em toda superfície interna das formas', 'menor',    'nenhuma',     5);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_estrutura, 'Armação (Ferragem)', 'NBR 6118', 11)
  RETURNING id INTO s_armacao;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_armacao, 'Bitolas das barras conforme projeto?',    'Verificar diâmetro de cada tipo de barra com paquímetro. Tolerância ±0,5mm.', 'critico',  'obrigatoria', 1),
  (0, s_armacao, 'Espaçamento entre barras correto?',       'Medir com trena. Tolerância ±10mm em relação ao projeto.',                     'maior',    'opcional',    2),
  (0, s_armacao, 'Transpasse de barras adequado?',          'Comprimento mínimo de 40 diâmetros da barra mais espessa',                     'critico',  'obrigatoria', 3),
  (0, s_armacao, 'Estribos posicionados corretamente?',     'Conforme detalhamento de projeto: espaçamento, inclinação e fechamento',       'maior',    'opcional',    4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_estrutura, 'Concretagem', 'NBR 12655', 12)
  RETURNING id INTO s_concretagem;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, foto_minimo, ordem) VALUES
  (0, s_concretagem, 'Slump dentro da faixa especificada?',  '10 ± 2 cm. Realizar ensaio a cada betonada ou por caminhão.',              'critico',  'obrigatoria', 1, 1),
  (0, s_concretagem, 'Vibração adequada do concreto?',       'Sem segregação visível; imergir vibrador a cada 50cm, retirar lentamente', 'critico',  'obrigatoria', 1, 2),
  (0, s_concretagem, 'Corpos de prova moldados?',            'Mínimo 2 CPs por caminhão ou a cada 10m³, identificados e curados',        'critico',  'obrigatoria', 2, 3),
  (0, s_concretagem, 'Cura iniciada no prazo correto?',      'Início máximo 2h após lançamento; manter úmido por mínimo 7 dias',         'maior',    'opcional',    0, 4),
  (0, s_concretagem, 'Temperatura do concreto adequada?',    'Máximo 30°C na saída do caminhão; verificar com termômetro',               'maior',    'opcional',    0, 5);

  -- ── IMPERMEABILIZAÇÃO ─────────────────────────────────────────────────────

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_impermeab, 'Impermeabilização', 'NBR 9574', 10)
  RETURNING id INTO s_impermeab;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, foto_minimo, ordem) VALUES
  (0, s_impermeab, 'Superfície preparada e limpa?',           'Sem trincas, sujeira, óleos ou umidade excessiva. Limpeza com jato d''água.',   'critico',  'obrigatoria', 1, 1),
  (0, s_impermeab, 'Número de demãos conforme fabricante?',   'Mínimo 3 demãos; aguardar secagem completa entre cada demão (≥ 4h)',            'maior',    'opcional',    0, 2),
  (0, s_impermeab, 'Teste de estanqueidade aprovado?',        'Lâmina d''água de 10cm por 72h. Zero vazamentos. Registrar com fotos e laudo.', 'critico',  'obrigatoria', 2, 3);

  -- ── ALVENARIA ─────────────────────────────────────────────────────────────

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_alvenaria, 'Alvenaria de Vedação', 'NBR 8545', 10)
  RETURNING id INTO s_alvenaria;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_alvenaria, 'Blocos alinhados e aprumados?',         'Desvio máximo 3mm/m de comprimento. Verificar com prumo e nível.',            'critico',  'obrigatoria', 1),
  (0, s_alvenaria, 'Juntas com espessura uniforme?',         '10mm ± 3mm. Argamassa preenche toda a extensão horizontal e vertical.',       'maior',    'opcional',    2),
  (0, s_alvenaria, 'Amarração na estrutura executada?',      'Tela metálica ou ferro-cabelo a cada 3 fiadas, fixado na estrutura.',         'critico',  'obrigatoria', 3),
  (0, s_alvenaria, 'Vergas e contravergas instaladas?',      'Conforme projeto; apoio mínimo 20cm de cada lado do vão.',                   'critico',  'obrigatoria', 4),
  (0, s_alvenaria, 'Encunhamento executado corretamente?',   'Argamassa expansiva ou tela metálica; aguardar mínimo 7 dias da última fiada.', 'maior', 'opcional',    5);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_alvenaria, 'Chapisco e Emboço', 'NBR 13749', 11)
  RETURNING id INTO s_chapisco;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_chapisco, 'Superfície preparada e umedecida antes da aplicação?', 'Molhar parede pelo menos 24h antes; chapisco com traço 1:3.',                'maior',  'opcional',    1),
  (0, s_chapisco, 'Espessura do emboço dentro do limite?',                'Máximo 25mm por camada. Camadas adicionais somente após 7 dias.',            'maior',  'opcional',    2),
  (0, s_chapisco, 'Planeza da superfície verificada?',                    'Régua de 2m: desvio máximo 3mm. Verificar em 3 direções diferentes.',        'critico','obrigatoria', 3),
  (0, s_chapisco, 'Taliscas e mestras corretamente posicionadas?',        'Espaçamento máximo 1,5m entre mestras, alinhadas vertical e horizontalmente.','maior',  'nenhuma',     4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_alvenaria, 'Contrapiso', 'NBR 15495', 12)
  RETURNING id INTO s_contrapiso;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_contrapiso, 'Nível e caimento corretos?',      'Caimento mínimo de 1% em direção ao ralo. Tolerância de nível ±3mm.',              'critico',  'obrigatoria', 1),
  (0, s_contrapiso, 'Espessura mínima atendida?',       'Mínimo 3cm de espessura em qualquer ponto. Verificar com sonda.',                  'maior',    'opcional',    2),
  (0, s_contrapiso, 'Aderência ao substrato garantida?','Sem som oco ao percutir com martelo de borracha em malha de 50×50cm.',             'critico',  'obrigatoria', 3);

  -- ── INSTALAÇÕES ───────────────────────────────────────────────────────────

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_ele, 'Instalação Elétrica — Tubulação e Fiação', 'NBR 5410', 10)
  RETURNING id INTO s_eletrica_nbr;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, ordem) VALUES
  (0, s_eletrica_nbr, 'Eletrodutos conforme projeto (bitola, traçado)?',  'Bitolas e materiais conforme memorial descritivo. Traçado sem ângulos bruscos.', 'critico', 'obrigatoria', 1),
  (0, s_eletrica_nbr, 'Fiação identificada por cores conforme NBR 5410?', 'Fase: preta/vermelha/marrom. Neutro: azul-claro. Terra: verde/amarelo.',           'critico', 'obrigatoria', 2),
  (0, s_eletrica_nbr, 'Caixas de passagem acessíveis e tampadas?',        'Tampa removível sem ferramentas especiais, não obstruída.',                        'maior',   'opcional',    3),
  (0, s_eletrica_nbr, 'Aterramento executado e medido?',                   'Resistência ≤ 10 Ω. Laudo de medição com trado ou malha comprovando valor.',       'critico', 'obrigatoria', 4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_hid, 'Instalação Hidrossanitária', 'NBR 5626', 10)
  RETURNING id INTO s_hidro_nbr;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, foto_minimo, ordem) VALUES
  (0, s_hidro_nbr, 'Tubulação de água fria conforme projeto?',     'Diâmetro e traçado corretos, fixações a cada 1m em tubos até 32mm.',                  'critico', 'obrigatoria', 1, 1),
  (0, s_hidro_nbr, 'Teste de pressão hidrostático aprovado?',      '6 bar por 2h sem queda de pressão. Registrar em laudo com fotos do manômetro.',       'critico', 'obrigatoria', 2, 2),
  (0, s_hidro_nbr, 'Caimento das tubulações de esgoto correto?',   'Mínimo 2% para tubos até 75mm; 1% para tubos ≥ 100mm. Verificar com nível digital.',  'critico', 'obrigatoria', 1, 3),
  (0, s_hidro_nbr, 'Fixações e suportes adequados?',               'Tipo e espaçamento conforme tabela do fabricante e NBR 5626.',                        'maior',   'opcional',    0, 4);

  INSERT INTO fvs_catalogo_servicos (tenant_id, categoria_id, nome, norma_referencia, ordem)
  VALUES (0, cat_hid, 'Instalação de Gás (GLP/GN)', 'NBR 15526', 11)
  RETURNING id INTO s_gas;
  INSERT INTO fvs_catalogo_itens (tenant_id, servico_id, descricao, criterio_aceite, criticidade, foto_modo, foto_minimo, ordem) VALUES
  (0, s_gas, 'Tubulação de cobre com solda adequada?',      'Solda tipo foscoper conforme NBR 15526, sem rebarbas ou oxidação excessiva.',           'critico', 'obrigatoria', 1, 1),
  (0, s_gas, 'Teste de estanqueidade aprovado?',             'Pressão de 15 kPa por 15 min sem queda. Registrar com manômetro e laudo assinado.',     'critico', 'obrigatoria', 2, 2),
  (0, s_gas, 'Ventilação permanente nos ambientes de gás?', 'Área mínima de ventilação conforme Tabela 4 da NBR 15526. Aberturas desobstruídas.',     'critico', 'obrigatoria', 1, 3);

END $$;
