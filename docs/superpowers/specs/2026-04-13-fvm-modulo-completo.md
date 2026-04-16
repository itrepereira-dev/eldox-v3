# FVM — Módulo Completo: Ficha de Verificação de Materiais

**Data:** 13/04/2026
**Spec:** `docs/superpowers/specs/2026-04-13-fvm-modulo-completo.md`
**Módulo relacionado:** FVS (padrão de grade, ciclo de NC e parecer)
**Referências normativas:** PBQP-H/SiAC, NBR 7212, NBR 6118, NBR 12655, NBR 5735, NBR 5736, NBR 6136, NBR 10908, NBR 15270, NBR 15894

---

## 1. Objetivo e Contexto do Módulo

### O que é a FVM

A **Ficha de Verificação de Materiais** é o instrumento obrigatório de controle de recebimento de materiais no canteiro de obras. Para obras com certificação **PBQP-H/SiAC**, o registro de recebimento e a rastreabilidade de materiais são requisitos de auditoria — a ausência de registros gera não conformidade sistêmica no processo de certificação.

### Diferença em relação ao FVS

| Aspecto | FVS | FVM |
|---------|-----|-----|
| O que verifica | Execução de serviços na obra | Recebimento de materiais no canteiro |
| Quando ocorre | Durante ou após a execução | No momento do recebimento (NF + entrega física) |
| Ator principal | Inspetor / Estagiário | Almoxarife / Técnico de Qualidade |
| Grid | Serviço × Local | Material × Entrega (Lote) |
| NC | Serviço executado fora de spec | Lote reprovado / em quarentena |
| Rastreabilidade | Onde o serviço foi feito | Onde o material foi aplicado |

### Proposta de valor central

> Um lote de cimento chega sem certificado ABNT. O almoxarife registra a entrega, o sistema gera a NC automaticamente, o lote fica em **quarentena** (não pode ser usado), o engenheiro é notificado, e o rastreamento mostra em qual betonada esse lote eventualmente foi usado — ou que foi devolvido.

---

## 2. Mapa de Módulos e Telas

```
FVM
├─ Cadastros Base
│   ├─ Categorias de Materiais
│   ├─ Catálogo de Materiais (com itens de verificação e documentos exigidos)
│   └─ Fornecedores (com avaliação e homologação)
│
├─ Recebimento
│   ├─ Grade de Status (Material × Entrega — tela principal)
│   ├─ Registro de Entrega (Lote)
│   └─ Ficha de Verificação do Lote (drill-down)
│
├─ Rastreabilidade
│   └─ Lote → Uso na Obra (onde o material foi aplicado)
│
├─ Avaliação de Fornecedores
│   └─ Ciclo de avaliação periódica
│
└─ Relatórios
    ├─ Relatório de Recebimentos por Obra
    ├─ Relatório de NCs de Material
    ├─ Índice de Conformidade por Material
    └─ Dossiê PBQP-H de Materiais
```

---

## 3. Cadastros Base

### 3.1 Categorias de Materiais

Agrupam materiais por afinidade para filtragem e relatórios.

**Campos:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | Multi-tenant |
| `nome` | VARCHAR(100) | Ex: "Cimento", "Aço", "Blocos e Tijolos" |
| `descricao` | TEXT | Opcional |
| `icone` | VARCHAR(50) | Slug de ícone para UI |
| `ordem` | SMALLINT | Ordem de exibição |
| `ativo` | BOOLEAN | Soft delete |
| `is_sistema` | BOOLEAN computed | `tenant_id = 0` |

**Seed padrão PBQP-H (tenant_id = 0 — disponível a todos):**

| Ordem | Categoria | Materiais típicos |
|-------|-----------|------------------|
| 1 | Aglomerantes e Argamassas | Cimento CP-II/CP-IV/CP-V, Cal, Argamassa industrializada |
| 2 | Agregados | Areia natural/artificial, Brita, Pó de pedra |
| 3 | Aço e Ferragens | Barras CA-50/CA-60, Telas soldadas, Perfis metálicos |
| 4 | Blocos e Tijolos | Bloco cerâmico, Bloco de concreto, Tijolo maciço |
| 5 | Concreto Usinado | Concreto fck 20/25/30/35/40 MPa |
| 6 | Tubulações Hidráulicas | Tubo PVC, Tubo CPVC, Conexões |
| 7 | Tubulações de Esgoto | Tubo PVC série N/R, Conexões esgoto |
| 8 | Cabos e Fios Elétricos | Cabo flexível 1.5/2.5/4/6mm², Cabo rígido |
| 9 | Eletrodutos | Eletroduto rígido PVC, Eletroduto flexível |
| 10 | Revestimentos Cerâmicos | Piso cerâmico, Azulejo, Porcelanato |
| 11 | Impermeabilizantes | Manta asfáltica, Argamassa polimérica, Cristalizante |
| 12 | Tintas e Vernizes | Tinta acrílica, Tinta epóxi, Selador |
| 13 | Esquadrias | Porta de madeira, Janela de alumínio, Vidros |
| 14 | Louças e Metais Sanitários | Vaso sanitário, Pia, Torneira, Registro |
| 15 | Gesso e Drywall | Placa de gesso, Perfil drywall |

---

### 3.2 Catálogo de Materiais

Cada material tem: critérios de aceitação por norma, lista de documentos exigidos e checklist de inspeção de recebimento.

**Campos da tabela `fvm_catalogo_materiais`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | 0 = sistema |
| `categoria_id` | INT FK | `fvm_categorias_materiais` |
| `nome` | VARCHAR(200) | Ex: "Cimento Portland CP-II-E-32" |
| `codigo` | VARCHAR(50) | Código interno ou NBR. Ex: "NBR 11578" |
| `norma_referencia` | VARCHAR(200) | NBR principal |
| `unidade` | VARCHAR(20) | kg, m³, m², m, un, sc, etc. |
| `descricao` | TEXT | Especificação técnica |
| `foto_modo` | ENUM | `nenhuma \| opcional \| obrigatoria` |
| `exige_certificado` | BOOLEAN | Certificado de qualidade obrigatório |
| `exige_nota_fiscal` | BOOLEAN | Default true |
| `exige_laudo_ensaio` | BOOLEAN | Laudo de laboratório obrigatório |
| `prazo_quarentena_dias` | INT | Dias em quarentena aguardando laudo (0 = sem quarentena) |
| `ordem` | SMALLINT | |
| `ativo` | BOOLEAN | |
| `deleted_at` | TIMESTAMP | |

**Endpoints:** `getCatalogoMateriais`, `saveMaterial`, `deleteMaterial`

---

### 3.3 Itens de Verificação por Material

Checklist de recebimento — idêntico em estrutura aos `fvs_catalogo_itens`.

**Campos da tabela `fvm_catalogo_itens`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `material_id` | INT FK | `fvm_catalogo_materiais` |
| `tipo` | ENUM | `visual \| documental \| dimensional \| ensaio` |
| `descricao` | VARCHAR(300) | Ex: "CERTIFICADO ABNT PRESENTE NA NOTA FISCAL?" |
| `criterio_aceite` | TEXT | Ex: "Lacre íntegro, sem data vencida, ABNT impresso" |
| `criticidade` | ENUM | `critico \| maior \| menor` |
| `foto_modo` | ENUM | `nenhuma \| opcional \| obrigatoria` |
| `ordem` | SMALLINT | |
| `ativo` | BOOLEAN | |

**Tipos de item — explicação:**

| Tipo | Descrição | Exemplos |
|------|-----------|---------|
| `visual` | Inspeção a olho nu no canteiro | Embalagem íntegra? Cor/aspecto conforme? Presença de grumos? |
| `documental` | Verificação de documentos que acompanham o material | NF presente? Certificado ABNT? Laudo de controle? Data de fabricação válida? INMETRO? |
| `dimensional` | Medição no recebimento | Dimensões do bloco dentro da tolerância NBR? Bitola do aço conforme pedido? |
| `ensaio` | Item que requer ensaio laboratorial posterior | Coletar CPs para rompimento? Ensaio de granulometria? |

**Seed padrão por material — exemplos críticos:**

**Cimento Portland (qualquer tipo):**
1. `documental/critico` — CERTIFICADO DE QUALIDADE DO FABRICANTE PRESENTE?
2. `documental/critico` — DATA DE FABRICAÇÃO VÁLIDA (máx. 90 dias)?
3. `documental/maior` — NOTA FISCAL COM ESPECIFICAÇÃO CORRETA?
4. `visual/maior` — SACOS ÍNTEGROS SEM UMIDADE OU GRUMOS?
5. `visual/menor` — QUANTIDADE CONFORME NF?

**Concreto Usinado:**
1. `documental/critico` — NOTA FISCAL COM fck, RELAÇÃO A/C, SLUMP?
2. `visual/critico` — SLUMP MEDIDO NA CHEGADA DENTRO DO ESPECIFICADO?
3. `ensaio/critico` — CORPOS DE PROVA COLETADOS (mín. 2/betonada)?
4. `documental/maior` — PRAZO DESDE SAÍDA DA CENTRAL (máx. 2h)?
5. `visual/maior` — ASPECTO DO CONCRETO SEM SEGREGAÇÃO?

**Barra de Aço CA-50/CA-60:**
1. `documental/critico` — CERTIFICADO DE QUALIDADE DA USINA (por corrida)?
2. `documental/critico` — LAUDO DE ENSAIO MECÂNICO (tração, dobramento)?
3. `documental/maior` — NOTA FISCAL COM BITOLA E CORRIDA ESPECIFICADAS?
4. `visual/maior` — MARCAÇÃO DE LAMINAÇÃO LEGÍVEL?
5. `dimensional/maior` — BITOLA AFERIDA COM PAQUÍMETRO CONFORME?
6. `visual/menor` — AUSÊNCIA DE CORROSÃO AVANÇADA (óxido aderente)?

**Bloco Cerâmico:**
1. `documental/critico` — NOTA FISCAL COM DIMENSÕES NOMINAIS?
2. `visual/maior` — DIMENSÕES DENTRO DA TOLERÂNCIA NBR 15270 (±3mm)?
3. `visual/maior` — AUSÊNCIA DE TRINCAS, FRATURAS OU DEFORMAÇÕES?
4. `visual/menor` — ASPECTO UNIFORME (cor e textura)?
5. `dimensional/menor` — RESISTÊNCIA À COMPRESSÃO (laudo por lote)?

---

### 3.4 Documentos Exigidos por Material

Lista dinâmica de tipos de documentos que devem ser anexados ao recebimento.

**Campos da tabela `fvm_documentos_exigidos`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `material_id` | INT FK | |
| `nome` | VARCHAR(150) | Ex: "Certificado de qualidade", "Laudo de ensaio" |
| `sigla` | VARCHAR(20) | Ex: "CQ", "LE", "NF", "FT", "INMETRO" |
| `obrigatorio` | BOOLEAN | |
| `descricao` | TEXT | Orientação de como obter/verificar |
| `ordem` | SMALLINT | |

---

### 3.5 Fornecedores

Cadastro de fornecedores com ciclo de avaliação e homologação (requisito PBQP-H).

**Campos da tabela `fvm_fornecedores`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `razao_social` | VARCHAR(200) | Obrigatório |
| `nome_fantasia` | VARCHAR(200) | |
| `cnpj` | VARCHAR(18) | Único por tenant — formato 00.000.000/0000-00 |
| `tipo` | ENUM | `fabricante \| distribuidor \| locadora \| prestador` |
| `situacao` | ENUM | `em_avaliacao \| homologado \| suspenso \| desqualificado` |
| `email` | VARCHAR(200) | |
| `telefone` | VARCHAR(20) | |
| `responsavel_comercial` | VARCHAR(100) | |
| `endereco` | TEXT | |
| `cidade` | VARCHAR(100) | |
| `uf` | CHAR(2) | |
| `observacoes` | TEXT | |
| `avaliacao_score` | DECIMAL(4,2) | 0.00 – 10.00 — calculado automaticamente |
| `ultima_avaliacao_em` | DATE | |
| `proxima_avaliacao_em` | DATE | |
| `criado_por` | INT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | |

**Situações do fornecedor:**

| Situação | Descrição | Pode fornecer? |
|----------|-----------|----------------|
| `em_avaliacao` | Novo fornecedor sendo avaliado | Sim, com aprovação manual por entrega |
| `homologado` | Aprovado pelo processo de avaliação | Sim, sem restrição |
| `suspenso` | Problemas identificados, aguardando correção | Não — bloqueado no sistema |
| `desqualificado` | Descredenciado permanentemente | Não — bloqueado |

**Endpoints:** `getFornecedores`, `saveFornecedor`, `deleteFornecedor`, `getFornecedorById`

---

### 3.6 Materiais por Fornecedor (vínculo N:N)

Qual fornecedor pode fornecer qual material. Controla o dropdown na criação de entregas.

**Campos da tabela `fvm_fornecedor_materiais`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `fornecedor_id` | INT FK | |
| `material_id` | INT FK | |
| `preco_referencia` | DECIMAL(12,4) | Opcional — para alertas de preço |
| `prazo_entrega_dias` | INT | Opcional |
| `ativo` | BOOLEAN | |

---

## 4. Módulo de Recebimento

### 4.1 Registro de Entrega (Lote)

Cada entrega de material gera um **Lote** — a unidade atômica de rastreabilidade.

**Campos da tabela `fvm_lotes`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `obra_id` | INT FK | Obra que recebeu |
| `material_id` | INT FK | `fvm_catalogo_materiais` |
| `fornecedor_id` | INT FK | `fvm_fornecedores` |
| `numero_lote` | VARCHAR(60) | Gerado: `LOTE-{obraId}-{seq:04d}` |
| `numero_nf` | VARCHAR(60) | Número da Nota Fiscal |
| `data_entrega` | DATE | Data do recebimento físico |
| `quantidade` | DECIMAL(12,3) | Quantidade recebida |
| `unidade` | VARCHAR(20) | Unidade da quantidade (kg, m³, sc, un...) |
| `numero_pedido` | VARCHAR(60) | Número do pedido de compra |
| `lote_fabricante` | VARCHAR(60) | Lote/corrida do fabricante (para rastreabilidade) |
| `data_fabricacao` | DATE | Data de fabricação (quando aplicável) |
| `validade` | DATE | Data de validade (cimento, impermeabilizante...) |
| `status` | ENUM | Ver §4.2 |
| `status_grade` | ENUM | Calculado: para a grade visual |
| `inspecionado_por` | INT FK | Usuário que registrou a inspeção |
| `inspecionado_em` | TIMESTAMP | |
| `observacao_geral` | TEXT | |
| `quarentena_motivo` | TEXT | Preenchido quando status = quarentena |
| `quarentena_liberada_por` | INT FK | |
| `quarentena_liberada_em` | TIMESTAMP | |
| `criado_por` | INT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |
| `deleted_at` | TIMESTAMP | |

---

### 4.2 Ciclo de Status do Lote

```
aguardando_inspecao
  │
  ├─→ em_inspecao        (inspeção iniciada, não concluída)
  │     │
  │     ├─→ aprovado              ✅  (todos os itens conforme)
  │     ├─→ aprovado_com_ressalva ⚡  (itens NC menores, engenheiro liberou)
  │     ├─→ quarentena            🔒  (aguardando laudo — não pode ser usado)
  │     │     └─→ aprovado | reprovado  (após resultado do ensaio)
  │     └─→ reprovado             ❌  (NC crítica — devolução obrigatória)
  │
  └─→ cancelado           ✖  (entrega cancelada / erro de cadastro)
```

**Regras:**
- Apenas **lote `aprovado`** pode ser usado na obra (vinculação ao local/serviço)
- Lote `quarentena` bloqueia uso — o sistema alerta se o usuário tentar vincular um lote em quarentena
- Lote `reprovado` gera NC automática no fornecedor e no histórico da obra
- Lote `aprovado_com_ressalva` requer aprovação de engenheiro (similar ao `liberado_com_concessao` do FVS)

---

### 4.3 Registros de Verificação por Item

Para cada lote, cada item do checklist do material recebe uma resposta.

**Campos da tabela `fvm_registros`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `lote_id` | INT FK | `fvm_lotes` |
| `item_id` | INT FK | `fvm_catalogo_itens` |
| `status` | ENUM | `nao_avaliado \| conforme \| nao_conforme \| nao_aplicavel` |
| `observacao` | TEXT | Obrigatório se `nao_conforme` |
| `inspecionado_por` | INT FK | |
| `inspecionado_em` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### 4.4 Evidências (Documentos e Fotos)

**Campos da tabela `fvm_evidencias`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `lote_id` | INT FK | |
| `registro_id` | INT FK nullable | Vinculada a item específico ou ao lote geral |
| `tipo` | ENUM | `foto \| nf \| certificado \| laudo \| ficha_tecnica \| outro` |
| `ged_versao_id` | INT FK | Arquivo no GED |
| `descricao` | VARCHAR(200) | Ex: "Certificado de qualidade lote 23" |
| `created_at` | TIMESTAMP | |

---

### 4.5 Não Conformidades de Material (NCs)

Mesma estrutura das NCs do FVS, adaptada para materiais.

**Campos da tabela `fvm_nao_conformidades`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `lote_id` | INT FK | |
| `registro_id` | INT FK nullable | Item específico que gerou a NC (ou null = NC geral) |
| `fornecedor_id` | INT FK | |
| `numero` | VARCHAR(60) | Gerado: `NC-MAT-{obraId}-{seq:03d}` |
| `tipo` | ENUM | `documental \| visual \| dimensional \| ensaio \| quantidade` |
| `criticidade` | ENUM | `critico \| maior \| menor` |
| `status` | ENUM | `aberta \| em_tratamento \| aguardando_devolucao \| encerrada \| cancelada` |
| `descricao` | TEXT | Descrição da não conformidade |
| `acao_imediata` | ENUM | `quarentena \| devolucao \| uso_condicional \| aguardar_laudo` |
| `responsavel_id` | INT FK | |
| `prazo_resolucao` | DATE | |
| `acao_corretiva` | TEXT | |
| `resultado_final` | ENUM | `devolvido \| substituido \| aceito_com_desvio \| ensaio_aprovado` |
| `encerrada_em` | TIMESTAMP | |
| `encerrada_por` | INT FK | |
| `sla_status` | ENUM | `no_prazo \| alerta \| vencido` |
| `criado_por` | INT | |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 5. Grade de Status (Tela Principal)

Mesma filosofia da grade do FVS — visão matricial de todos os materiais e suas entregas.

### 5.1 Layout

```
┌─ Header ───────────────────────────────────────────────────────────┐
│  FVM: Europarques Torre 1      [Obra: Em execução]  [Exportar ▼]   │
│  Entregas: 48 lotes registrados | 41 aprovados | 4 quarentena | 3 NC│
└────────────────────────────────────────────────────────────────────┘
┌─ Filtros ──────────────────────────────────────────────────────────┐
│  Categoria: [Todos ▼]  Fornecedor: [Todos ▼]  Status: [Todos ▼]   │
│  Período: [Abr/2026 ▼]                        [Limpar filtros]     │
└────────────────────────────────────────────────────────────────────┘
┌─ Grade ────────────────────────────────────────────────────────────┐
│  Material              │ L-001 │ L-002 │ L-003 │ L-004 │ L-005    │
│                        │ 01/04 │ 05/04 │ 08/04 │ 10/04 │ 12/04    │
│────────────────────────┼───────┼───────┼───────┼───────┼──────    │
│  Cimento CP-II-E-32    │  ✅   │  ✅   │  🔒   │  ──   │  ──      │
│  Aço CA-50 (10mm)      │  ✅   │  ❌   │  ──   │  ──   │  ──      │
│  Bloco Cerâmico 14cm   │  ✅   │  ✅   │  ✅   │  ⚡   │  ──      │
│  Concreto fck 25 MPa   │  ──   │  ──   │  ✅   │  ✅   │  ✅      │
└────────────────────────────────────────────────────────────────────┘
┌─ Legenda ──────────────────────────────────────────────────────────┐
│  ✅ Aprovado  ❌ Reprovado  ⚡ Com Ressalva  🔒 Quarentena  ── Registrado (não inspecionado) │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Células da grade

| Status | Cor | Ícone | Tooltip |
|--------|-----|-------|---------|
| `aguardando_inspecao` | Cinza claro | `──` | "Aguardando inspeção — {data_entrega}" |
| `em_inspecao` | Azul claro | `◐` | "Em inspeção por {inspetor}" |
| `aprovado` | Verde | `✅` | "Aprovado — {inspetor} em {data}" |
| `aprovado_com_ressalva` | Amarelo | `⚡` | "Aprovado com ressalva — ver detalhes" |
| `quarentena` | Laranja | `🔒` | "Quarentena — aguardando laudo desde {data}" |
| `reprovado` | Vermelho | `❌` | "Reprovado — NC aberta #{numero}" |
| `cancelado` | Cinza escuro | `✖` | "Cancelado" |

**Diferença em relação ao FVS:** as colunas não são locais fixos (apartamentos), mas **entregas dinâmicas** (lotes com data). O número de colunas cresce ao longo da obra.

### 5.3 Drawer lateral ao clicar na célula

```
┌─ Drawer: Cimento CP-II · Lote L-003 ──────────────────────────────┐
│  Status: 🔒 Quarentena                                              │
│  Fornecedor: Votorantim Cimentos                                   │
│  Data de entrega: 08/04/2026                                       │
│  Quantidade: 120 sacos (3.000 kg)                                  │
│  NF: 123456  |  Lote fabricante: VT-2026-0312                      │
│  Inspecionado por: João Silva — 08/04/2026 14:22                   │
├────────────────────────────────────────────────────────────────────┤
│  # │ Item de Verificação                       │ Status    │ Obs  │
│  1 │ Certificado ABNT presente?                │ N.CONF.   │ ...  │
│  2 │ Data de fabricação válida (máx 90 dias)?  │ CONF.     │ —    │
│  3 │ NF com especificação correta?             │ CONF.     │ —    │
│  4 │ Sacos íntegros?                           │ CONF.     │ —    │
├────────────────────────────────────────────────────────────────────┤
│  NC aberta: NC-MAT-42-003 — Certificado ABNT ausente              │
│  Ação imediata: Quarentena                                         │
│  [Ver detalhes da NC]  [Ir para ficha completa →]                  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Ficha de Verificação do Lote (FichaLotePage)

Tela de inspeção detalhada de um lote — drill-down a partir do drawer ou da grade.

### 6.1 Estrutura

```
┌─ Header ─────────────────────────────────────────────────────────────┐
│  Cimento CP-II-E-32 · Lote L-003 · Votorantim Cimentos · 08/04/2026 │
│  NF: 123456 | 120 sc | Status atual: 🔒 Quarentena                   │
└──────────────────────────────────────────────────────────────────────┘

[Aba: Checklist]  [Aba: Documentos]  [Aba: Rastreabilidade]  [Aba: Histórico]

┌─ Checklist ──────────────────────────────────────────────────────────┐
│  Documentais                                                         │
│  1. [N.CONF.] Certificado ABNT presente na NF?        [obs] [foto]  │
│  2. [CONF.  ] Data de fabricação válida (máx 90 dias)?              │
│  3. [CONF.  ] NF com especificação correta?                         │
│                                                                      │
│  Visuais                                                             │
│  4. [CONF.  ] Sacos íntegros sem umidade ou grumos?                 │
│  5. [CONF.  ] Quantidade conferida com NF?                          │
└──────────────────────────────────────────────────────────────────────┘

[Concluir Inspeção]  →  Abre modal de decisão: Aprovar / Aprovar com Ressalva / Quarentena / Reprovar
```

### 6.2 Modal de Decisão Final

Após checar todos os itens obrigatórios:

```
┌─ Decisão da Inspeção ────────────────────────────────────────────────┐
│  Resumo: 1 item N.CONF. (crítico: documental)                        │
│                                                                      │
│  ○ Aprovar — todos os itens conformes                                │
│  ● Quarentena — aguardar certificado (prazo: ___)                    │
│  ○ Aprovar com Ressalva — NC menor, engenheiro libera                │
│  ○ Reprovar — devolver ao fornecedor                                 │
│                                                                      │
│  Observação geral: [___________________________________]              │
│  [Confirmar e gerar NC]                                              │
└──────────────────────────────────────────────────────────────────────┘
```

**Regras da decisão:**
- `Aprovar` apenas se **nenhum** item `critico` ou `maior` está NC
- `Quarentena` quando há item NC mas o material pode aguardar resolução (ex: laudo em trânsito)
- `Aprovar com Ressalva` requer permissão `fvm.aprovacao_ressalva` (engenheiro)
- `Reprovar` sempre gera NC automática e notificação ao responsável

---

## 7. Endpoints da API

### 7.1 Catálogo

| Método | Action | Descrição |
|--------|--------|-----------|
| GET | `getCategoriasMateriais` | Lista categorias (inclui is_sistema) |
| POST/PUT | `saveCategoriaMaterial` | Cria ou atualiza categoria |
| GET | `getCatalogoMateriais` | Lista materiais com filtros |
| POST/PUT | `saveMaterial` | Cria ou atualiza material |
| GET | `getMaterialById` | Detalhe com itens + documentos exigidos |
| GET | `getFornecedores` | Lista fornecedores com filtros |
| POST/PUT | `saveFornecedor` | Cria ou atualiza fornecedor |
| GET | `getFornecedorById` | Detalhe com histórico de NCs e avaliações |

---

### 7.2 Recebimento

#### `POST /fvm/obras/:obraId/lotes` — `createLote`
**Permissão:** `requireAuth()` + obra pertence ao tenant

```typescript
// Request Body
{
  materialId: number,           // obrigatório
  fornecedorId: number,         // obrigatório
  numeroNf: string,             // obrigatório, max 60
  dataEntrega: string,          // obrigatório, ISO date, ≤ hoje
  quantidade: number,           // obrigatório, > 0
  unidade: string,              // obrigatório
  numeroPedido?: string,
  loteFabricante?: string,      // crítico para rastreabilidade PBQP-H
  dataFabricacao?: string,
  validade?: string,
  observacaoGeral?: string,
}

// Response 201
{
  "status": "success",
  "data": {
    "id": 15,
    "numero_lote": "LOTE-42-0015",
    "status": "aguardando_inspecao",
    "itens": [...]  // checklist pré-populado do catálogo
  }
}
```

**Validações:**

| Regra | HTTP | Mensagem |
|-------|------|---------|
| `fornecedorId` com situacao `suspenso` | 409 | `"Fornecedor suspenso. Entrega bloqueada."` |
| `fornecedorId` com situacao `desqualificado` | 409 | `"Fornecedor desqualificado. Entrega bloqueada."` |
| `fornecedorId` com situacao `em_avaliacao` (sem permissão) | 403 | `"Fornecedor em avaliação. Requer aprovação manual."` |
| `dataEntrega` no futuro | 400 | `"Data de entrega não pode ser futura"` |
| Validade vencida no recebimento | 400 | `"Material recebido com validade vencida"` |

---

#### `PUT /fvm/lotes/:loteId/registros/:itemId` — `putRegistroItem`
**Permissão:** `requireAuth()` + lote `em_inspecao`

```typescript
{
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel',
  observacao?: string,  // obrigatório se nao_conforme
}
```

---

#### `POST /fvm/lotes/:loteId/concluir` — `concluirInspecao`
**Permissão:** `requireAuth()`

Lote passa de `em_inspecao` → status final.

```typescript
{
  decisao: 'aprovado' | 'aprovado_com_ressalva' | 'quarentena' | 'reprovado',
  observacaoGeral?: string,
  quarentenaMotivo?: string,      // obrigatório se decisao = 'quarentena'
  quarentenaPrazoDias?: number,   // obrigatório se decisao = 'quarentena'
}
```

**Behavior pós-decisão:**
- `reprovado` ou NC `critico` → cria `fvm_nao_conformidades` automaticamente
- `quarentena` → agenda `sla_status` por `quarentenaPrazoDias`
- Qualquer decisão → grava `fvm_audit_log`

---

#### `POST /fvm/lotes/:loteId/liberar-quarentena` — `liberarQuarentena`
**Permissão:** `requirePermission('fvm', 'liberar_quarentena')`

```typescript
{
  decisaoFinal: 'aprovado' | 'reprovado',
  laudoGedVersaoId?: number,  // obrigatório se aprovado
  observacao: string,          // obrigatório
}
```

---

#### `GET /fvm/obras/:obraId/grade` — `getGradeFvm`

```typescript
// Response 200
{
  "status": "success",
  "data": {
    "materiais": [
      { "id": 1, "nome": "Cimento CP-II-E-32", "categoria": "Aglomerantes" }
    ],
    "lotes": [
      { "id": 15, "numero_lote": "LOTE-42-0015", "data_entrega": "2026-04-08",
        "fornecedor_nome": "Votorantim", "quantidade": 120, "unidade": "sc" }
    ],
    "celulas": {           // celulas[materialId][loteId] = status
      "1": { "15": "quarentena", "12": "aprovado" }
    },
    "resumo": {
      "total_lotes": 48,
      "aprovados": 41,
      "aprovados_com_ressalva": 2,
      "quarentena": 4,
      "reprovados": 1,
      "aguardando": 0
    }
  }
}
```

**Query params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `categoriaId` | number | Filtra por categoria de material |
| `fornecedorId` | number | Filtra por fornecedor |
| `status` | string | Filtra por status do lote |
| `dataInicio` | ISO date | Período de entrega (início) |
| `dataFim` | ISO date | Período de entrega (fim) |

---

#### `GET /fvm/lotes/:loteId/preview` — `getLotePreview`

Dados para o drawer lateral.

```typescript
// Response 200
{
  "data": {
    "numero_lote": "LOTE-42-0015",
    "material_nome": "Cimento CP-II-E-32",
    "fornecedor_nome": "Votorantim Cimentos",
    "data_entrega": "2026-04-08",
    "quantidade": 120,
    "unidade": "sc",
    "status": "quarentena",
    "inspecionado_por": "João Silva",
    "itens": [
      { "id": 1, "descricao": "Certificado ABNT presente?", "tipo": "documental",
        "criticidade": "critico", "status": "nao_conforme", "observacao": "..." }
    ],
    "nc_aberta": {
      "numero": "NC-MAT-42-003",
      "criticidade": "critico",
      "status": "aberta"
    }
  }
}
```

---

## 8. Rastreabilidade de Materiais

Responde à pergunta: **"Este lote de cimento foi usado em qual elemento estrutural?"**

### 8.1 Vínculo Lote → Uso

**Campos da tabela `fvm_lote_usos`:**

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `lote_id` | INT FK | |
| `obra_id` | INT FK | |
| `obra_local_id` | INT FK nullable | Local específico da obra |
| `servico_id` | INT FK nullable | Serviço FVS relacionado |
| `descricao_uso` | TEXT | Ex: "Betonada — Pilar P5, Laje 2° Pav" |
| `quantidade_usada` | DECIMAL(12,3) | Quantidade consumida neste uso |
| `data_uso` | DATE | |
| `registrado_por` | INT FK | |
| `created_at` | TIMESTAMP | |

### 8.2 Endpoint de rastreabilidade

#### `GET /fvm/lotes/:loteId/rastreabilidade`

Retorna: dados do lote, itens verificados, NCs, documentos, e lista de usos na obra.

#### `POST /fvm/lotes/:loteId/usos` — `registrarUso`

```typescript
{
  obraLocalId?: number,
  servicoId?: number,
  descricaoUso: string,     // obrigatório se obraLocalId e servicoId ausentes
  quantidadeUsada?: number,
  dataUso: string,
}
```

**Validações:**
- Lote `reprovado` → 409: `"Lote reprovado. Uso bloqueado."`
- Lote `quarentena` → 409: `"Lote em quarentena. Uso bloqueado até liberação."`
- Lote `aguardando_inspecao` → 409: `"Lote não inspecionado. Realize a inspeção antes de usar."`

---

## 9. Avaliação de Fornecedores

Requisito PBQP-H: avaliar periodicamente cada fornecedor com base em histórico de NCs.

### 9.1 Campos da tabela `fvm_avaliacoes_fornecedor`

| Campo | Tipo | Obs |
|-------|------|-----|
| `id` | SERIAL PK | |
| `tenant_id` | INT | |
| `fornecedor_id` | INT FK | |
| `periodo_referencia` | VARCHAR(7) | Ex: "2026-04" (YYYY-MM) |
| `total_entregas` | INT | Entregas no período |
| `entregas_aprovadas` | INT | |
| `entregas_nc` | INT | |
| `entregas_reprovadas` | INT | |
| `score_conformidade` | DECIMAL(4,2) | `aprovadas / total * 10` |
| `score_documentacao` | DECIMAL(4,2) | % itens documentais conformes |
| `score_geral` | DECIMAL(4,2) | Média ponderada |
| `decisao` | ENUM | `manter_homologado \| emitir_alerta \| suspender \| desqualificar` |
| `observacao` | TEXT | |
| `avaliado_por` | INT FK | |
| `avaliado_em` | TIMESTAMP | |

### 9.2 Regras automáticas de avaliação

| Condição | Decisão sugerida |
|----------|-----------------|
| Score geral ≥ 8.0 | `manter_homologado` |
| Score geral entre 5.0 e 7.9 | `emitir_alerta` |
| Score geral entre 3.0 e 4.9 | `suspender` |
| Score geral < 3.0 ou 2+ reprovações seguidas | `desqualificar` |

O engenheiro pode aceitar a sugestão ou sobrescrever com justificativa.

### 9.3 Endpoint

#### `POST /fvm/fornecedores/:fornecedorId/avaliacao` — `registrarAvaliacao`

```typescript
{
  periodoReferencia: string,  // "2026-04"
  decisao: 'manter_homologado' | 'emitir_alerta' | 'suspender' | 'desqualificar',
  observacao?: string,
}
```

---

## 10. Permissões

| Permissão | Descrição | Papel padrão |
|-----------|-----------|-------------|
| `fvm.lote.criar` | Registrar entrega de material | almoxarife, técnico, inspetor, engenheiro |
| `fvm.lote.inspecionar` | Preencher checklist do lote | almoxarife, técnico, inspetor, engenheiro |
| `fvm.lote.aprovar` | Concluir inspeção como aprovado | inspetor, engenheiro |
| `fvm.aprovacao_ressalva` | Aprovar lote com ressalva | engenheiro, admin |
| `fvm.quarentena.liberar` | Liberar lote em quarentena | engenheiro, admin |
| `fvm.lote.reprovar` | Reprovar lote | inspetor, engenheiro |
| `fvm.nc.tratar` | Registrar tratamento de NC | inspetor, engenheiro |
| `fvm.uso.registrar` | Vincular lote a uso na obra | inspetor, engenheiro, almoxarife |
| `fvm.fornecedor.avaliar` | Registrar avaliação de fornecedor | engenheiro, admin |
| `fvm.fornecedor.suspender` | Suspender ou desqualificar fornecedor | admin |
| `fvm.catalogo.editar` | Editar catálogo de materiais e itens | admin |

---

## 11. Schema Delta Completo

### Tabelas novas (DDL)

```sql
-- 1. Categorias de materiais
CREATE TABLE IF NOT EXISTS fvm_categorias_materiais (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  icone       VARCHAR(50),
  ordem       SMALLINT NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_fvm_cat_tenant (tenant_id)
);

-- 2. Catálogo de materiais
CREATE TABLE IF NOT EXISTS fvm_catalogo_materiais (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INT NOT NULL,
  categoria_id         INT REFERENCES fvm_categorias_materiais(id),
  nome                 VARCHAR(200) NOT NULL,
  codigo               VARCHAR(50),
  norma_referencia     VARCHAR(200),
  unidade              VARCHAR(20) NOT NULL DEFAULT 'un',
  descricao            TEXT,
  foto_modo            VARCHAR(20) NOT NULL DEFAULT 'opcional',
  exige_certificado    BOOLEAN NOT NULL DEFAULT FALSE,
  exige_nota_fiscal    BOOLEAN NOT NULL DEFAULT TRUE,
  exige_laudo_ensaio   BOOLEAN NOT NULL DEFAULT FALSE,
  prazo_quarentena_dias INT NOT NULL DEFAULT 0,
  ordem                SMALLINT NOT NULL DEFAULT 0,
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMP,
  INDEX idx_fvm_mat_tenant (tenant_id),
  INDEX idx_fvm_mat_cat (categoria_id)
);

-- 3. Itens de verificação do catálogo
CREATE TABLE IF NOT EXISTS fvm_catalogo_itens (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  material_id   INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  tipo          VARCHAR(20) NOT NULL,  -- visual|documental|dimensional|ensaio
  descricao     VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade   VARCHAR(20) NOT NULL DEFAULT 'menor',
  foto_modo     VARCHAR(20) NOT NULL DEFAULT 'opcional',
  ordem         SMALLINT NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  INDEX idx_fvm_item_material (material_id, tenant_id)
);

-- 4. Documentos exigidos por material
CREATE TABLE IF NOT EXISTS fvm_documentos_exigidos (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  material_id INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  nome        VARCHAR(150) NOT NULL,
  sigla       VARCHAR(20),
  obrigatorio BOOLEAN NOT NULL DEFAULT TRUE,
  descricao   TEXT,
  ordem       SMALLINT NOT NULL DEFAULT 0
);

-- 5. Fornecedores
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
  deleted_at            TIMESTAMP,
  UNIQUE (tenant_id, cnpj),
  INDEX idx_fvm_forn_tenant (tenant_id),
  INDEX idx_fvm_forn_situacao (situacao, tenant_id)
);

-- 6. Materiais fornecidos por fornecedor (N:N)
CREATE TABLE IF NOT EXISTS fvm_fornecedor_materiais (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  fornecedor_id   INT NOT NULL REFERENCES fvm_fornecedores(id) ON DELETE CASCADE,
  material_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  preco_referencia DECIMAL(12,4),
  prazo_entrega_dias INT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, fornecedor_id, material_id)
);

-- 7. Lotes (entregas)
CREATE TABLE IF NOT EXISTS fvm_lotes (
  id                        SERIAL PRIMARY KEY,
  tenant_id                 INT NOT NULL,
  obra_id                   INT NOT NULL,
  material_id               INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  fornecedor_id             INT NOT NULL REFERENCES fvm_fornecedores(id),
  numero_lote               VARCHAR(60) NOT NULL,
  numero_nf                 VARCHAR(60) NOT NULL,
  data_entrega              DATE NOT NULL,
  quantidade                DECIMAL(12,3) NOT NULL,
  unidade                   VARCHAR(20) NOT NULL,
  numero_pedido             VARCHAR(60),
  lote_fabricante           VARCHAR(60),
  data_fabricacao           DATE,
  validade                  DATE,
  status                    VARCHAR(40) NOT NULL DEFAULT 'aguardando_inspecao',
  inspecionado_por          INT,
  inspecionado_em           TIMESTAMP,
  observacao_geral          TEXT,
  quarentena_motivo         TEXT,
  quarentena_prazo_dias     INT,
  quarentena_liberada_por   INT,
  quarentena_liberada_em    TIMESTAMP,
  criado_por                INT NOT NULL,
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMP,
  UNIQUE (tenant_id, numero_lote),
  INDEX idx_fvm_lote_obra (obra_id, tenant_id),
  INDEX idx_fvm_lote_status (status, tenant_id),
  INDEX idx_fvm_lote_material (material_id, obra_id)
);

-- 8. Registros por item de verificação
CREATE TABLE IF NOT EXISTS fvm_registros (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  lote_id          INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  item_id          INT NOT NULL REFERENCES fvm_catalogo_itens(id),
  status           VARCHAR(20) NOT NULL DEFAULT 'nao_avaliado',
  observacao       TEXT,
  inspecionado_por INT,
  inspecionado_em  TIMESTAMP,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, lote_id, item_id),
  INDEX idx_fvm_reg_lote (lote_id, tenant_id)
);

-- 9. Evidências (fotos e documentos)
CREATE TABLE IF NOT EXISTS fvm_evidencias (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  lote_id       INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id   INT REFERENCES fvm_registros(id),
  tipo          VARCHAR(20) NOT NULL DEFAULT 'foto',
  ged_versao_id INT NOT NULL,
  descricao     VARCHAR(200),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_fvm_ev_lote (lote_id, tenant_id)
);

-- 10. Não conformidades de material
CREATE TABLE IF NOT EXISTS fvm_nao_conformidades (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  lote_id           INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id       INT REFERENCES fvm_registros(id),
  fornecedor_id     INT NOT NULL REFERENCES fvm_fornecedores(id),
  numero            VARCHAR(60) NOT NULL,
  tipo              VARCHAR(20) NOT NULL,
  criticidade       VARCHAR(20) NOT NULL DEFAULT 'menor',
  status            VARCHAR(40) NOT NULL DEFAULT 'aberta',
  descricao         TEXT NOT NULL,
  acao_imediata     VARCHAR(30),
  responsavel_id    INT,
  prazo_resolucao   DATE,
  acao_corretiva    TEXT,
  resultado_final   VARCHAR(40),
  encerrada_em      TIMESTAMP,
  encerrada_por     INT,
  sla_status        VARCHAR(20) NOT NULL DEFAULT 'no_prazo',
  criado_por        INT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero),
  INDEX idx_fvm_nc_lote (lote_id, tenant_id),
  INDEX idx_fvm_nc_fornec (fornecedor_id, tenant_id),
  INDEX idx_fvm_nc_status (status, tenant_id)
);

-- 11. Rastreabilidade: uso do lote na obra
CREATE TABLE IF NOT EXISTS fvm_lote_usos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  lote_id          INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  obra_id          INT NOT NULL,
  obra_local_id    INT,
  servico_id       INT,
  descricao_uso    TEXT NOT NULL,
  quantidade_usada DECIMAL(12,3),
  data_uso         DATE NOT NULL,
  registrado_por   INT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_fvm_uso_lote (lote_id, tenant_id),
  INDEX idx_fvm_uso_obra (obra_id, tenant_id)
);

-- 12. Avaliações periódicas de fornecedor
CREATE TABLE IF NOT EXISTS fvm_avaliacoes_fornecedor (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INT NOT NULL,
  fornecedor_id         INT NOT NULL REFERENCES fvm_fornecedores(id),
  periodo_referencia    VARCHAR(7) NOT NULL,
  total_entregas        INT NOT NULL DEFAULT 0,
  entregas_aprovadas    INT NOT NULL DEFAULT 0,
  entregas_nc           INT NOT NULL DEFAULT 0,
  entregas_reprovadas   INT NOT NULL DEFAULT 0,
  score_conformidade    DECIMAL(4,2),
  score_documentacao    DECIMAL(4,2),
  score_geral           DECIMAL(4,2),
  decisao               VARCHAR(30) NOT NULL,
  observacao            TEXT,
  avaliado_por          INT NOT NULL,
  avaliado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, fornecedor_id, periodo_referencia),
  INDEX idx_fvm_aval_forn (fornecedor_id, tenant_id)
);

-- 13. Audit log (INSERT ONLY)
CREATE TABLE IF NOT EXISTS fvm_audit_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  lote_id     INT,
  registro_id INT,
  nc_id       INT,
  acao        VARCHAR(60) NOT NULL,
  status_de   VARCHAR(40),
  status_para VARCHAR(40),
  usuario_id  INT NOT NULL,
  ip_origem   INET,
  detalhes    JSONB,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_fvm_audit_lote (lote_id, tenant_id)
);
```

---

## 12. Cenários GWT

### Feature: Recebimento de Material com NC Crítica

---

**Cenário 1 (caminho feliz) — Material aprovado sem ressalvas**

```
Given: Lote L-015, Cimento CP-II, Votorantim, 120 sacos, todos os 5 itens preenchidos conforme
When:  POST /fvm/lotes/15/concluir { decisao: 'aprovado' }
Then:  HTTP 200
       fvm_lotes.status = 'aprovado'
       Nenhuma NC criada
       fvm_audit_log: acao = 'aprovado', status_para = 'aprovado'
```

---

**Cenário 2 — NC crítica: certificado ausente → quarentena automática**

```
Given: Lote L-015, item "Certificado ABNT" marcado como nao_conforme (crítico)
When:  POST /fvm/lotes/15/concluir { decisao: 'quarentena', quarentenaMotivo: 'Aguardando certificado', quarentenaPrazoDias: 5 }
Then:  HTTP 200
       fvm_lotes.status = 'quarentena'
       fvm_nao_conformidades criada: numero = 'NC-MAT-42-003', criticidade = 'critico'
       fvm_audit_log: acao = 'quarentena'
```

---

**Cenário 3 — Tentativa de usar lote em quarentena**

```
Given: Lote L-015 com status = 'quarentena'
When:  POST /fvm/lotes/15/usos { descricaoUso: 'Betonada P5', dataUso: '2026-04-13' }
Then:  HTTP 409
       { "status": "error", "message": "Lote em quarentena. Uso bloqueado até liberação." }
```

---

**Cenário 4 — Fornecedor suspenso tenta nova entrega**

```
Given: Fornecedor id=7 com situacao = 'suspenso'
When:  POST /fvm/obras/42/lotes { fornecedorId: 7, ... }
Then:  HTTP 409
       { "status": "error", "message": "Fornecedor suspenso. Entrega bloqueada." }
```

---

**Cenário 5 — Liberação de quarentena após laudo**

```
Given: Lote L-015 em quarentena, laudo uploadado no GED (ged_versao_id=99)
When:  POST /fvm/lotes/15/liberar-quarentena
       { decisaoFinal: 'aprovado', laudoGedVersaoId: 99, observacao: 'Laudo aprovado pelo lab XYZ' }
Then:  HTTP 200
       fvm_lotes.status = 'aprovado', quarentena_liberada_em = NOW()
       NC relacionada encerrada: resultado_final = 'ensaio_aprovado'
       fvm_audit_log: acao = 'quarentena_liberada'
```

---

**Edge cases:**

| Situação | Comportamento |
|----------|--------------|
| Concluir inspeção com itens `nao_avaliado` restantes obrigatórios | 400: "Existem itens obrigatórios não avaliados" |
| Aprovar lote com item crítico NC | 422: "Aprovação bloqueada: item crítico não conforme. Use Quarentena ou Reprovado." |
| Registrar validade vencida | 400: "Material recebido com validade vencida. Confirme para continuar." (permitir com flag `forcarValidade: true` + justificativa, apenas para admin) |
| CNPJ duplicado na criação de fornecedor | 409: "Fornecedor com este CNPJ já cadastrado" |
| Uso de lote reprovado | 409: "Lote reprovado. Uso bloqueado." |

---

## 13. Critérios de Aceite

| CA | Descrição |
|----|-----------|
| CA-01 | Categorias de materiais exibem seed padrão PBQP-H para todos os tenants |
| CA-02 | Catálogo de materiais permite criar material com itens de verificação por tipo |
| CA-03 | Fornecedor com situação `suspenso` ou `desqualificado` bloqueia nova entrega (409) |
| CA-04 | Criação de lote pré-popula checklist com itens do catálogo do material |
| CA-05 | Item `nao_conforme` exige observação (400 sem ela) |
| CA-06 | Concluir com decisão `reprovado` ou item crítico NC cria NC automática |
| CA-07 | Lote `quarentena` bloqueia registrar uso (409) |
| CA-08 | Liberar quarentena exige permissão `fvm.quarentena.liberar` |
| CA-09 | Aprovação com ressalva exige permissão `fvm.aprovacao_ressalva` |
| CA-10 | Grade FVM exibe Material × Lote com cores por status |
| CA-11 | Clicar na célula da grade abre drawer com resumo do lote e itens |
| CA-12 | Registrar uso valida status do lote antes de persistir |
| CA-13 | `fvm_audit_log` registra toda transição de status de lote e NC |
| CA-14 | Avaliação de fornecedor calcula score e propõe decisão automaticamente |
| CA-15 | Suspensão de fornecedor bloqueia imediatamente novas entregas |
| CA-16 | Rastreabilidade retorna lista completa de onde o lote foi usado |

---

## 14. Relatórios

| Relatório | Filtros | Formatos |
|-----------|---------|---------|
| Recebimentos por obra/período | Obra, material, fornecedor, status, data | Web, Excel, PDF |
| NCs de material | Obra, criticidade, status, tipo, SLA | Web, Excel |
| Índice de conformidade por material | Obra, período | Web, gráfico pizza |
| Histórico do fornecedor | Fornecedor, período, obra | Web, PDF |
| Lotes em quarentena (SLA vencido) | Obra, material, dias em quarentena | Web, alerta push |
| Rastreabilidade por lote | Lote específico | PDF (dossiê PBQP-H) |
| Avaliação de fornecedores | Período, score mínimo | Web, Excel, PDF |

---

## 15. ADRs

### ADR-003: Grade FVM usa Material × Lote (não Material × Local como FVS)

**Status:** Aceito  
**Data:** 2026-04-13

**Contexto:**
O FVS usa `Serviço × Local` porque locais (apartamentos) são fixos e conhecidos desde o início da obra. Na FVM, os "locais" equivalentes são as entregas (lotes), que crescem dinamicamente ao longo da obra.

**Decisão:**
Grade FVM = **Material × Lote (coluna por data de entrega)**.

**Consequências:**
- Número de colunas cresce com o tempo (ao contrário do FVS, que é fixo)
- Implementar paginação/scroll horizontal para obras com muitos lotes
- Filtro por período é especialmente importante na FVM (não era crítico no FVS)

---

### ADR-004: Quarentena como status intermediário antes do reprovado

**Status:** Aceito  
**Data:** 2026-04-13

**Contexto:**
No PBQP-H, há situações onde o material chega sem documento mas o material em si é aceitável (ex: cimento sem certificado do lote, mas o fornecedor é homologado e envia o certificado em 2 dias). Recusar imediatamente gera retrabalho logístico grave e pode atrasar a obra.

**Decisão:**
Introduzir status `quarentena`: material não pode ser usado, aguarda resolução da pendência documental ou laudo de ensaio. Prazo definido pelo inspetor. Após resolução, engenheiro libera como `aprovado` ou `reprovado`.

**Consequências positivas:**
- Menos desperdício e atrasos por material devolvido precipitadamente
- Fluxo realista para o canteiro de obra

**Trade-offs:**
- Risco de material em quarentena ser usado sem autorização → mitigado pelo bloqueio de `fvm_lote_usos`

---

## 16. Checklist de Validação da Spec

- [x] Cadastros base completos (categorias, materiais, itens, documentos, fornecedores)
- [x] Seed padrão PBQP-H mapeado para categorias e itens críticos
- [x] Ciclo de status do lote com 7 estados + regras de transição
- [x] NC automática ao reprovar ou item crítico NC
- [x] Bloqueio de uso para lotes reprovados e em quarentena
- [x] Rastreabilidade Lote → Uso na obra
- [x] Avaliação periódica de fornecedores (requisito PBQP-H)
- [x] Grade visual seguindo padrão FVS (Material × Lote)
- [x] Drawer lateral com preview do lote
- [x] 13 tabelas DDL com `tenant_id` em todas
- [x] `fvm_audit_log` INSERT ONLY
- [x] 11 permissões granulares
- [x] 16 CAs verificáveis
- [x] 7 tipos de relatório mapeados
- [x] 2 ADRs para decisões técnicas não-óbvias
