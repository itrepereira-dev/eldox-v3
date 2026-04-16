# FVM — Ficha de Verificação de Materiais
## Especificação Eldox v3 (alinhada com padrão FVS)

**Versão:** 1.0 — Abril 2026  
**Fontes:** Eldox_FVM_Especificacao_v1.0.docx + 2026-04-13-fvm-modulo-completo.md  
**Padrão:** segue exatamente o modelo FVS (NestJS + Prisma raw SQL + React 19 + TanStack Query)

---

## 1. Posicionamento no Eldox

| Aspecto | FVS | FVM |
|---------|-----|-----|
| O que controla | Execução de serviços | Recebimento de materiais |
| Quando ocorre | Durante/após execução | No ato da entrega (NF + físico) |
| Ator principal | Inspetor / Estagiário | Almoxarife / Técnico de Qualidade |
| Grid | Serviço × Local | Material × Lote (entrega) |
| NC | Serviço fora de spec | Lote reprovado / em quarentena |
| Rastreabilidade | Onde o serviço foi feito | Onde o material foi aplicado |

**Integrações obrigatórias:**
- **GED** — laudos, NFs e fotos anexados via GED (mesmo padrão das evidências do FVS)
- **FVS** — `fvm_lote_usos.servico_id` referencia `fvs_catalogo_servicos` (rastreabilidade)
- **NC/CAPA** — FVM reprovada gera `fvm_nao_conformidades` automaticamente

---

## 2. Cadastros Base

### 2.1 Categorias de Materiais — `fvm_categorias_materiais`

Mesmo padrão de `fvs_categorias_servico`. `tenant_id = 0` = sistema (PBQP-H seed).

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT | 0 = sistema |
| nome | VARCHAR(100) NOT NULL | Ex: "Aglomerantes", "Aço e Ferragens" |
| descricao | TEXT | |
| icone | VARCHAR(50) | slug para UI |
| ordem | SMALLINT DEFAULT 0 | |
| ativo | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |

**is_sistema:** computed — `tenant_id = 0`

**Seed PBQP-H (tenant_id = 0):** 15 categorias — Aglomerantes e Argamassas, Agregados, Aço e Ferragens, Blocos e Tijolos, Concreto Usinado, Tubulações Hidráulicas, Tubulações de Esgoto, Cabos e Fios Elétricos, Eletrodutos, Revestimentos Cerâmicos, Impermeabilizantes, Tintas e Vernizes, Esquadrias, Louças e Metais Sanitários, Gesso e Drywall.

---

### 2.2 Catálogo de Materiais — `fvm_catalogo_materiais`

Equivale a `fvs_catalogo_servicos`. Define o material e seus requisitos de recebimento.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT | 0 = sistema |
| categoria_id | INT FK | `fvm_categorias_materiais` |
| nome | VARCHAR(200) NOT NULL | Ex: "Cimento Portland CP-II-E-32" |
| codigo | VARCHAR(50) | Ex: "NBR 11578" |
| norma_referencia | VARCHAR(200) | NBR principal |
| unidade | VARCHAR(20) DEFAULT 'un' | kg, m³, sc, m², un... |
| descricao | TEXT | Especificação técnica |
| foto_modo | VARCHAR(20) DEFAULT 'opcional' | nenhuma \| opcional \| obrigatoria |
| exige_certificado | BOOLEAN DEFAULT false | CQ do fabricante obrigatório |
| exige_nota_fiscal | BOOLEAN DEFAULT true | |
| exige_laudo_ensaio | BOOLEAN DEFAULT false | Laudo laboratorial |
| prazo_quarentena_dias | INT DEFAULT 0 | 0 = sem quarentena automática |
| ordem | SMALLINT DEFAULT 0 | |
| ativo | BOOLEAN DEFAULT true | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |
| deleted_at | TIMESTAMP | soft delete |

**Seed crítico (tenant_id = 0):** Cimento CP-II-E-32, Concreto Usinado fck 25 MPa, Barra de Aço CA-50 (10mm), Bloco Cerâmico 14cm, Argamassa Industrializada AC-III, Areia Natural Média, Brita nº 1.

---

### 2.3 Itens de Verificação — `fvm_catalogo_itens`

Equivale a `fvs_catalogo_itens`. Checklist de recebimento por material.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT | 0 = sistema |
| material_id | INT NOT NULL FK | ON DELETE CASCADE |
| tipo | VARCHAR(20) NOT NULL | visual \| documental \| dimensional \| ensaio |
| descricao | VARCHAR(300) NOT NULL | Ex: "CERTIFICADO ABNT PRESENTE NA NF?" |
| criterio_aceite | TEXT | |
| criticidade | VARCHAR(20) DEFAULT 'menor' | critico \| maior \| menor |
| foto_modo | VARCHAR(20) DEFAULT 'opcional' | nenhuma \| opcional \| obrigatoria |
| ordem | SMALLINT DEFAULT 0 | |
| ativo | BOOLEAN DEFAULT true | |

**Tipos de item:**
- `visual` — inspeção a olho nu (embalagem, aspecto, quantidade)
- `documental` — verificação de documentos (NF, certificado, laudo, validade)
- `dimensional` — medição (bitola, dimensões, tolerância)
- `ensaio` — item que requer laudo laboratorial posterior

**Seed cimento (tenant_id = 0):**
1. documental/critico — CERTIFICADO DE QUALIDADE DO FABRICANTE PRESENTE?
2. documental/critico — DATA DE FABRICAÇÃO VÁLIDA (máx. 90 dias)?
3. documental/maior — NOTA FISCAL COM ESPECIFICAÇÃO CORRETA (tipo, classe)?
4. visual/maior — SACOS ÍNTEGROS SEM UMIDADE OU GRUMOS?
5. visual/menor — QUANTIDADE CONFERIDA COM NF?

**Seed aço CA-50 (tenant_id = 0):**
1. documental/critico — CERTIFICADO DE QUALIDADE DA USINA (por corrida)?
2. documental/critico — LAUDO DE ENSAIO MECÂNICO (tração, dobramento)?
3. documental/maior — NF COM BITOLA E CORRIDA ESPECIFICADAS?
4. visual/maior — MARCAÇÃO DE LAMINAÇÃO LEGÍVEL?
5. dimensional/maior — BITOLA AFERIDA COM PAQUÍMETRO CONFORME?

**Seed concreto usinado (tenant_id = 0):**
1. documental/critico — NF COM fck, RELAÇÃO A/C E SLUMP ESPECIFICADOS?
2. visual/critico — SLUMP MEDIDO NA CHEGADA DENTRO DO ESPECIFICADO?
3. ensaio/critico — CORPOS DE PROVA COLETADOS (mín. 2/betonada)?
4. documental/maior — PRAZO DESDE SAÍDA DA CENTRAL (máx. 2h)?
5. visual/maior — ASPECTO SEM SEGREGAÇÃO?

---

### 2.4 Documentos Exigidos — `fvm_documentos_exigidos`

Lista de documentos que devem ser anexados no recebimento. Complementa os itens de verificação.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT | |
| material_id | INT NOT NULL FK | ON DELETE CASCADE |
| nome | VARCHAR(150) NOT NULL | Ex: "Certificado de qualidade" |
| sigla | VARCHAR(20) | CQ, LE, NF, FT, INMETRO |
| obrigatorio | BOOLEAN DEFAULT true | |
| descricao | TEXT | Como obter/verificar |
| ordem | SMALLINT DEFAULT 0 | |

---

### 2.5 Fornecedores — `fvm_fornecedores`

Cadastro com ciclo de avaliação e homologação (requisito PBQP-H).

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| razao_social | VARCHAR(200) NOT NULL | |
| nome_fantasia | VARCHAR(200) | |
| cnpj | VARCHAR(18) | UNIQUE por tenant |
| tipo | VARCHAR(20) DEFAULT 'fabricante' | fabricante \| distribuidor \| locadora \| prestador |
| situacao | VARCHAR(20) DEFAULT 'em_avaliacao' | ver §2.5.1 |
| email | VARCHAR(200) | |
| telefone | VARCHAR(20) | |
| responsavel_comercial | VARCHAR(100) | |
| endereco | TEXT | |
| cidade | VARCHAR(100) | |
| uf | CHAR(2) | |
| observacoes | TEXT | |
| avaliacao_score | DECIMAL(4,2) | 0.00–10.00, calculado |
| ultima_avaliacao_em | DATE | |
| proxima_avaliacao_em | DATE | |
| criado_por | INT NOT NULL | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |
| deleted_at | TIMESTAMP | soft delete |

#### 2.5.1 Situações do fornecedor

| Situação | Pode fornecer? | Regra |
|----------|----------------|-------|
| `em_avaliacao` | Sim, com ressalva | Nova no sistema, aprovação manual por entrega |
| `homologado` | Sim | Aprovado pelo processo periódico |
| `suspenso` | Não | Bloqueado — 409 ao tentar criar lote |
| `desqualificado` | Não | Bloqueado permanentemente — 409 |

---

### 2.6 Vínculo Fornecedor-Material — `fvm_fornecedor_materiais`

N:N entre fornecedor e material. Controla dropdown na criação de entregas.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| fornecedor_id | INT NOT NULL FK | ON DELETE CASCADE |
| material_id | INT NOT NULL FK | ON DELETE CASCADE |
| preco_referencia | DECIMAL(12,4) | Opcional |
| prazo_entrega_dias | INT | Opcional |
| ativo | BOOLEAN DEFAULT true | |
| UNIQUE (tenant_id, fornecedor_id, material_id) | | |

---

## 3. Recebimento — Lotes e Inspeção

### 3.1 Lote — `fvm_lotes`

Unidade atômica de rastreabilidade. Um lote = uma entrega de material.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| obra_id | INT NOT NULL FK | Obra que recebeu |
| material_id | INT NOT NULL FK | `fvm_catalogo_materiais` |
| fornecedor_id | INT NOT NULL FK | `fvm_fornecedores` |
| numero_lote | VARCHAR(60) NOT NULL UNIQUE | Gerado: `LOTE-{obraId}-{seq:04d}` |
| numero_nf | VARCHAR(60) NOT NULL | Número da Nota Fiscal |
| data_entrega | DATE NOT NULL | ≤ hoje |
| quantidade | DECIMAL(12,3) NOT NULL | |
| unidade | VARCHAR(20) NOT NULL | |
| numero_pedido | VARCHAR(60) | |
| lote_fabricante | VARCHAR(60) | Lote/corrida do fabricante |
| data_fabricacao | DATE | |
| validade | DATE | |
| status | VARCHAR(40) DEFAULT 'aguardando_inspecao' | ver §3.2 |
| inspecionado_por | INT FK | |
| inspecionado_em | TIMESTAMP | |
| observacao_geral | TEXT | |
| quarentena_motivo | TEXT | Preenchido se status = quarentena |
| quarentena_prazo_dias | INT | |
| quarentena_liberada_por | INT FK | |
| quarentena_liberada_em | TIMESTAMP | |
| criado_por | INT NOT NULL | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |
| deleted_at | TIMESTAMP | |

#### 3.2 Ciclo de Status do Lote

```
aguardando_inspecao
  │
  ├──→ em_inspecao            (inspeção iniciada)
  │      │
  │      ├──→ aprovado              ✅  todos os itens conformes
  │      ├──→ aprovado_com_ressalva ⚡  NC menor, liberado pelo engenheiro
  │      ├──→ quarentena            🔒  aguardando laudo / documento
  │      │       └──→ aprovado | reprovado  (após resolução)
  │      └──→ reprovado             ❌  NC crítica — devolução obrigatória
  │
  └──→ cancelado              ✖  erro de cadastro
```

**Regras de transição:**
- `aprovado` apenas se nenhum item `critico` ou `maior` está NC
- `aprovado_com_ressalva` requer permissão `fvm.aprovacao_ressalva`
- `quarentena` quando há NC mas material pode aguardar laudo
- `reprovado` gera NC automática + notifica responsável
- Lote `quarentena` ou `reprovado` bloqueia `fvm_lote_usos` (409)

---

### 3.3 Registros de Verificação — `fvm_registros`

Um registro por item de verificação por lote.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| lote_id | INT NOT NULL FK | ON DELETE RESTRICT |
| item_id | INT NOT NULL FK | `fvm_catalogo_itens` |
| status | VARCHAR(20) DEFAULT 'nao_avaliado' | nao_avaliado \| conforme \| nao_conforme \| nao_aplicavel |
| observacao | TEXT | Obrigatório se nao_conforme |
| inspecionado_por | INT FK | |
| inspecionado_em | TIMESTAMP | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |
| UNIQUE (tenant_id, lote_id, item_id) | | |

---

### 3.4 Evidências — `fvm_evidencias`

Fotos e documentos via GED (mesmo padrão de `fvs_evidencias`).

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| lote_id | INT NOT NULL FK | |
| registro_id | INT FK nullable | Vinculada a item específico ou ao lote geral |
| tipo | VARCHAR(20) DEFAULT 'foto' | foto \| nf \| certificado \| laudo \| ficha_tecnica \| outro |
| ged_versao_id | INT NOT NULL FK | Arquivo no GED |
| descricao | VARCHAR(200) | |
| created_at | TIMESTAMP DEFAULT NOW() | |

---

### 3.5 Não Conformidades — `fvm_nao_conformidades`

Geradas automaticamente ao reprovar lote ou ao concluir com item crítico NC.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| lote_id | INT NOT NULL FK | |
| registro_id | INT FK nullable | Item que gerou a NC (null = NC geral) |
| fornecedor_id | INT NOT NULL FK | |
| numero | VARCHAR(60) NOT NULL UNIQUE | NC-MAT-{obraId}-{seq:03d} |
| tipo | VARCHAR(20) NOT NULL | documental \| visual \| dimensional \| ensaio \| quantidade |
| criticidade | VARCHAR(20) DEFAULT 'menor' | critico \| maior \| menor |
| status | VARCHAR(40) DEFAULT 'aberta' | aberta \| em_tratamento \| aguardando_devolucao \| encerrada \| cancelada |
| descricao | TEXT NOT NULL | |
| acao_imediata | VARCHAR(30) | quarentena \| devolucao \| uso_condicional \| aguardar_laudo |
| responsavel_id | INT FK | |
| prazo_resolucao | DATE | |
| acao_corretiva | TEXT | |
| resultado_final | VARCHAR(40) | devolvido \| substituido \| aceito_com_desvio \| ensaio_aprovado |
| encerrada_em | TIMESTAMP | |
| encerrada_por | INT FK | |
| sla_status | VARCHAR(20) DEFAULT 'no_prazo' | no_prazo \| alerta \| vencido |
| criado_por | INT NOT NULL | |
| created_at | TIMESTAMP DEFAULT NOW() | |
| updated_at | TIMESTAMP DEFAULT NOW() | |

---

## 4. Grade Visual

### 4.1 Estrutura — Material × Lote

Mesmo conceito da grade FVS (Serviço × Local), adaptado para FVM.

```
Material                │ L-001   │ L-002   │ L-003   │ L-004
                        │ 01/04   │ 05/04   │ 08/04   │ 10/04
────────────────────────┼─────────┼─────────┼─────────┼────────
Cimento CP-II-E-32      │  ✅     │  ✅     │  🔒     │  ──
Aço CA-50 (10mm)        │  ✅     │  ❌     │  ──     │  ──
Bloco Cerâmico 14cm     │  ✅     │  ✅     │  ⚡     │  ──
Concreto fck 25 MPa     │  ──     │  ✅     │  ✅     │  ✅
```

**Diferença vs FVS:** colunas são entregas dinâmicas (crescem ao longo da obra), não locais fixos.

### 4.2 Cores e ícones por status

| Status | Cor | Ícone | Ação ao clicar |
|--------|-----|-------|----------------|
| `aguardando_inspecao` | Cinza | `──` | Abre ficha para iniciar inspeção |
| `em_inspecao` | Azul | `◐` | Continua inspeção |
| `aprovado` | Verde | `✅` | Abre drawer com resumo |
| `aprovado_com_ressalva` | Amarelo | `⚡` | Abre drawer |
| `quarentena` | Laranja | `🔒` | Abre drawer + botão liberar |
| `reprovado` | Vermelho | `❌` | Abre drawer + link NC |
| `cancelado` | Cinza escuro | `✖` | Abre drawer (somente leitura) |

### 4.3 Endpoint da grade

`GET /api/v1/fvm/obras/:obraId/grade`

```typescript
// Response
{
  materiais: { id, nome, categoria_nome }[],
  lotes: { id, numero_lote, data_entrega, fornecedor_nome, quantidade, unidade }[],
  celulas: Record<materialId, Record<loteId, StatusLote>>,
  resumo: {
    total_lotes, aprovados, aprovados_com_ressalva,
    quarentena, reprovados, aguardando, cancelados
  }
}
// Query params: categoriaId?, fornecedorId?, status?, dataInicio?, dataFim?
```

---

## 5. Endpoints da API

### 5.1 Cadastros

| Método | Path | Handler | Permissão |
|--------|------|---------|-----------|
| GET | `/fvm/categorias` | `getCategorias` | any |
| POST | `/fvm/categorias` | `createCategoria` | ADMIN_TENANT, ENGENHEIRO |
| PATCH | `/fvm/categorias/:id` | `updateCategoria` | ADMIN_TENANT, ENGENHEIRO |
| DELETE | `/fvm/categorias/:id` | `deleteCategoria` | ADMIN_TENANT |
| GET | `/fvm/materiais` | `getMateriais` | any |
| GET | `/fvm/materiais/:id` | `getMaterial` | any |
| POST | `/fvm/materiais` | `createMaterial` | ADMIN_TENANT, ENGENHEIRO |
| PATCH | `/fvm/materiais/:id` | `updateMaterial` | ADMIN_TENANT, ENGENHEIRO |
| DELETE | `/fvm/materiais/:id` | `deleteMaterial` | ADMIN_TENANT |
| POST | `/fvm/materiais/:id/itens` | `createItem` | ADMIN_TENANT, ENGENHEIRO |
| PATCH | `/fvm/itens/:id` | `updateItem` | ADMIN_TENANT, ENGENHEIRO |
| DELETE | `/fvm/itens/:id` | `deleteItem` | ADMIN_TENANT |
| GET | `/fvm/fornecedores` | `getFornecedores` | any |
| GET | `/fvm/fornecedores/:id` | `getFornecedor` | any |
| POST | `/fvm/fornecedores` | `createFornecedor` | ADMIN_TENANT, ENGENHEIRO |
| PATCH | `/fvm/fornecedores/:id` | `updateFornecedor` | ADMIN_TENANT, ENGENHEIRO |
| DELETE | `/fvm/fornecedores/:id` | `deleteFornecedor` | ADMIN_TENANT |
| POST | `/fvm/fornecedores/:id/materiais` | `vincularMaterial` | ADMIN_TENANT, ENGENHEIRO |
| DELETE | `/fvm/fornecedores/:id/materiais/:matId` | `desvincularMaterial` | ADMIN_TENANT |

### 5.2 Recebimento

| Método | Path | Handler | Permissão |
|--------|------|---------|-----------|
| GET | `/fvm/obras/:obraId/grade` | `getGrade` | any |
| POST | `/fvm/obras/:obraId/lotes` | `createLote` | any auth |
| GET | `/fvm/lotes/:id` | `getLote` | any |
| GET | `/fvm/lotes/:id/preview` | `getLotePreview` | any |
| PUT | `/fvm/lotes/:id/registros/:itemId` | `putRegistro` | any auth |
| POST | `/fvm/lotes/:id/concluir` | `concluirInspecao` | any auth |
| POST | `/fvm/lotes/:id/liberar-quarentena` | `liberarQuarentena` | ENGENHEIRO, ADMIN_TENANT |
| POST | `/fvm/lotes/:id/evidencias` | `createEvidencia` | any auth |
| DELETE | `/fvm/evidencias/:id` | `deleteEvidencia` | any auth |
| GET | `/fvm/lotes/:id/ncs` | `getNcs` | any |
| PATCH | `/fvm/ncs/:id` | `patchNc` | ENGENHEIRO, ADMIN_TENANT |

### 5.3 Rastreabilidade

| Método | Path | Handler |
|--------|------|---------|
| GET | `/fvm/lotes/:id/rastreabilidade` | `getRastreabilidade` |
| POST | `/fvm/lotes/:id/usos` | `registrarUso` |

### 5.4 Avaliação de Fornecedores

| Método | Path | Handler | Permissão |
|--------|------|---------|-----------|
| POST | `/fvm/fornecedores/:id/avaliacoes` | `registrarAvaliacao` | ENGENHEIRO, ADMIN_TENANT |
| GET | `/fvm/fornecedores/:id/avaliacoes` | `getAvaliacoes` | any |

---

## 6. Payloads e Validações

### `POST /fvm/obras/:obraId/lotes`

```typescript
{
  materialId: number,        // obrigatório
  fornecedorId: number,      // obrigatório
  numeroNf: string,          // obrigatório, max 60
  dataEntrega: string,       // obrigatório, ISO date, ≤ hoje
  quantidade: number,        // obrigatório, > 0
  unidade: string,           // obrigatório
  numeroPedido?: string,
  loteFabricante?: string,
  dataFabricacao?: string,
  validade?: string,
  observacaoGeral?: string,
}
// Response 201: lote criado com registros pré-populados do catálogo
```

**Validações de negócio:**

| Regra | HTTP | Mensagem |
|-------|------|---------|
| Fornecedor `suspenso` | 409 | "Fornecedor suspenso. Entrega bloqueada." |
| Fornecedor `desqualificado` | 409 | "Fornecedor desqualificado. Entrega bloqueada." |
| `dataEntrega` no futuro | 400 | "Data de entrega não pode ser futura" |
| Validade vencida | 400 | "Material recebido com validade vencida" |
| Obra não pertence ao tenant | 400 | "Obra não encontrada no tenant" |

---

### `PUT /fvm/lotes/:id/registros/:itemId`

```typescript
{
  status: 'conforme' | 'nao_conforme' | 'nao_aplicavel',
  observacao?: string,  // obrigatório se nao_conforme
}
// 400 se nao_conforme sem observacao
```

---

### `POST /fvm/lotes/:id/concluir`

```typescript
{
  decisao: 'aprovado' | 'aprovado_com_ressalva' | 'quarentena' | 'reprovado',
  observacaoGeral?: string,
  quarentenaMotivo?: string,    // obrigatório se quarentena
  quarentenaPrazoDias?: number, // obrigatório se quarentena
}
```

**Regras pós-decisão:**
- `reprovado` → cria `fvm_nao_conformidades` automaticamente
- Item `critico` NC com decisão `aprovado` → 422: "Item crítico NC. Use Quarentena ou Reprovado."
- Itens obrigatórios `nao_avaliado` → 400: "Existem itens obrigatórios não avaliados"
- Qualquer decisão → grava `fvm_audit_log`

---

### `POST /fvm/lotes/:id/liberar-quarentena`

```typescript
{
  decisaoFinal: 'aprovado' | 'reprovado',
  laudoGedVersaoId?: number,  // obrigatório se aprovado
  observacao: string,          // obrigatório
}
// NC relacionada encerrada com resultado_final = 'ensaio_aprovado'
```

---

### `POST /fvm/lotes/:id/usos`

```typescript
{
  obraLocalId?: number,
  servicoId?: number,
  descricaoUso: string,       // obrigatório se obraLocalId e servicoId ausentes
  quantidadeUsada?: number,
  dataUso: string,
}
// 409 se lote reprovado, quarentena ou aguardando_inspecao
```

---

## 7. Rastreabilidade — `fvm_lote_usos`

Responde: "Este lote foi usado em qual local/serviço?"

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| lote_id | INT NOT NULL FK | |
| obra_id | INT NOT NULL | |
| obra_local_id | INT FK nullable | FK → `obra_locais` |
| servico_id | INT FK nullable | FK → `fvs_catalogo_servicos` |
| descricao_uso | TEXT NOT NULL | Ex: "Betonada — Pilar P5, Laje 2° Pav" |
| quantidade_usada | DECIMAL(12,3) | |
| data_uso | DATE NOT NULL | |
| registrado_por | INT NOT NULL | |
| created_at | TIMESTAMP DEFAULT NOW() | |

---

## 8. Avaliação de Fornecedores — `fvm_avaliacoes_fornecedor`

Requisito PBQP-H: avaliação periódica com base em histórico de NCs.

| Campo | Tipo | Obs |
|-------|------|-----|
| id | SERIAL PK | |
| tenant_id | INT NOT NULL | |
| fornecedor_id | INT NOT NULL FK | |
| periodo_referencia | VARCHAR(7) NOT NULL | "2026-04" |
| total_entregas | INT DEFAULT 0 | |
| entregas_aprovadas | INT DEFAULT 0 | |
| entregas_nc | INT DEFAULT 0 | |
| entregas_reprovadas | INT DEFAULT 0 | |
| score_conformidade | DECIMAL(4,2) | aprovadas/total × 10 |
| score_documentacao | DECIMAL(4,2) | % itens documentais conformes |
| score_geral | DECIMAL(4,2) | média ponderada |
| decisao | VARCHAR(30) NOT NULL | manter_homologado \| emitir_alerta \| suspender \| desqualificar |
| observacao | TEXT | |
| avaliado_por | INT NOT NULL | |
| avaliado_em | TIMESTAMP DEFAULT NOW() | |
| UNIQUE (tenant_id, fornecedor_id, periodo_referencia) | | |

**Regras automáticas de score:**

| Score geral | Decisão sugerida |
|-------------|-----------------|
| ≥ 8.0 | `manter_homologado` |
| 5.0 – 7.9 | `emitir_alerta` |
| 3.0 – 4.9 | `suspender` |
| < 3.0 ou 2+ reprovações seguidas | `desqualificar` |

---

## 9. Audit Log — `fvm_audit_log`

INSERT ONLY, mesmo padrão de `fvs_audit_log`.

| Campo | Tipo |
|-------|------|
| id | SERIAL PK |
| tenant_id | INT NOT NULL |
| lote_id | INT |
| registro_id | INT |
| nc_id | INT |
| acao | VARCHAR(60) NOT NULL |
| status_de | VARCHAR(40) |
| status_para | VARCHAR(40) |
| usuario_id | INT NOT NULL |
| ip_origem | INET |
| detalhes | JSONB |
| criado_em | TIMESTAMP DEFAULT NOW() |

---

## 10. Permissões

| Permissão | Papel padrão |
|-----------|-------------|
| `fvm.lote.criar` | ENGENHEIRO, TECNICO, VISITANTE |
| `fvm.lote.inspecionar` | ENGENHEIRO, TECNICO |
| `fvm.lote.aprovar` | ENGENHEIRO, TECNICO |
| `fvm.aprovacao_ressalva` | ENGENHEIRO, ADMIN_TENANT |
| `fvm.quarentena.liberar` | ENGENHEIRO, ADMIN_TENANT |
| `fvm.lote.reprovar` | ENGENHEIRO |
| `fvm.nc.tratar` | ENGENHEIRO, TECNICO |
| `fvm.uso.registrar` | ENGENHEIRO, TECNICO |
| `fvm.fornecedor.avaliar` | ENGENHEIRO, ADMIN_TENANT |
| `fvm.catalogo.editar` | ADMIN_TENANT |

---

## 11. Schema DDL Completo (PostgreSQL)

```sql
-- 1. Categorias de materiais
CREATE TABLE fvm_categorias_materiais (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  descricao  TEXT,
  icone      VARCHAR(50),
  ordem      SMALLINT NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fvm_cat_tenant ON fvm_categorias_materiais (tenant_id);

-- 2. Catálogo de materiais
CREATE TABLE fvm_catalogo_materiais (
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
  deleted_at           TIMESTAMP
);
CREATE INDEX idx_fvm_mat_tenant ON fvm_catalogo_materiais (tenant_id);
CREATE INDEX idx_fvm_mat_cat ON fvm_catalogo_materiais (categoria_id);

-- 3. Itens de verificação
CREATE TABLE fvm_catalogo_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  material_id     INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  tipo            VARCHAR(20) NOT NULL,
  descricao       VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade     VARCHAR(20) NOT NULL DEFAULT 'menor',
  foto_modo       VARCHAR(20) NOT NULL DEFAULT 'opcional',
  ordem           SMALLINT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_fvm_item_material ON fvm_catalogo_itens (material_id, tenant_id);

-- 4. Documentos exigidos
CREATE TABLE fvm_documentos_exigidos (
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
CREATE TABLE fvm_fornecedores (
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
  UNIQUE (tenant_id, cnpj)
);
CREATE INDEX idx_fvm_forn_tenant ON fvm_fornecedores (tenant_id);
CREATE INDEX idx_fvm_forn_situacao ON fvm_fornecedores (situacao, tenant_id);

-- 6. Fornecedor × Material (N:N)
CREATE TABLE fvm_fornecedor_materiais (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  fornecedor_id    INT NOT NULL REFERENCES fvm_fornecedores(id) ON DELETE CASCADE,
  material_id      INT NOT NULL REFERENCES fvm_catalogo_materiais(id) ON DELETE CASCADE,
  preco_referencia DECIMAL(12,4),
  prazo_entrega_dias INT,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, fornecedor_id, material_id)
);

-- 7. Lotes
CREATE TABLE fvm_lotes (
  id                       SERIAL PRIMARY KEY,
  tenant_id                INT NOT NULL,
  obra_id                  INT NOT NULL,
  material_id              INT NOT NULL REFERENCES fvm_catalogo_materiais(id),
  fornecedor_id            INT NOT NULL REFERENCES fvm_fornecedores(id),
  numero_lote              VARCHAR(60) NOT NULL,
  numero_nf                VARCHAR(60) NOT NULL,
  data_entrega             DATE NOT NULL,
  quantidade               DECIMAL(12,3) NOT NULL,
  unidade                  VARCHAR(20) NOT NULL,
  numero_pedido            VARCHAR(60),
  lote_fabricante          VARCHAR(60),
  data_fabricacao          DATE,
  validade                 DATE,
  status                   VARCHAR(40) NOT NULL DEFAULT 'aguardando_inspecao',
  inspecionado_por         INT,
  inspecionado_em          TIMESTAMP,
  observacao_geral         TEXT,
  quarentena_motivo        TEXT,
  quarentena_prazo_dias    INT,
  quarentena_liberada_por  INT,
  quarentena_liberada_em   TIMESTAMP,
  criado_por               INT NOT NULL,
  created_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMP,
  UNIQUE (tenant_id, numero_lote)
);
CREATE INDEX idx_fvm_lote_obra    ON fvm_lotes (obra_id, tenant_id);
CREATE INDEX idx_fvm_lote_status  ON fvm_lotes (status, tenant_id);
CREATE INDEX idx_fvm_lote_mat     ON fvm_lotes (material_id, obra_id);

-- 8. Registros por item
CREATE TABLE fvm_registros (
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
  UNIQUE (tenant_id, lote_id, item_id)
);
CREATE INDEX idx_fvm_reg_lote ON fvm_registros (lote_id, tenant_id);

-- 9. Evidências
CREATE TABLE fvm_evidencias (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  lote_id       INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id   INT REFERENCES fvm_registros(id),
  tipo          VARCHAR(20) NOT NULL DEFAULT 'foto',
  ged_versao_id INT NOT NULL,
  descricao     VARCHAR(200),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fvm_ev_lote ON fvm_evidencias (lote_id, tenant_id);

-- 10. Não conformidades
CREATE TABLE fvm_nao_conformidades (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  lote_id         INT NOT NULL REFERENCES fvm_lotes(id) ON DELETE RESTRICT,
  registro_id     INT REFERENCES fvm_registros(id),
  fornecedor_id   INT NOT NULL REFERENCES fvm_fornecedores(id),
  numero          VARCHAR(60) NOT NULL,
  tipo            VARCHAR(20) NOT NULL,
  criticidade     VARCHAR(20) NOT NULL DEFAULT 'menor',
  status          VARCHAR(40) NOT NULL DEFAULT 'aberta',
  descricao       TEXT NOT NULL,
  acao_imediata   VARCHAR(30),
  responsavel_id  INT,
  prazo_resolucao DATE,
  acao_corretiva  TEXT,
  resultado_final VARCHAR(40),
  encerrada_em    TIMESTAMP,
  encerrada_por   INT,
  sla_status      VARCHAR(20) NOT NULL DEFAULT 'no_prazo',
  criado_por      INT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero)
);
CREATE INDEX idx_fvm_nc_lote   ON fvm_nao_conformidades (lote_id, tenant_id);
CREATE INDEX idx_fvm_nc_forn   ON fvm_nao_conformidades (fornecedor_id, tenant_id);
CREATE INDEX idx_fvm_nc_status ON fvm_nao_conformidades (status, tenant_id);

-- 11. Rastreabilidade: uso do lote na obra
CREATE TABLE fvm_lote_usos (
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
  created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fvm_uso_lote ON fvm_lote_usos (lote_id, tenant_id);
CREATE INDEX idx_fvm_uso_obra ON fvm_lote_usos (obra_id, tenant_id);

-- 12. Avaliações de fornecedor
CREATE TABLE fvm_avaliacoes_fornecedor (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INT NOT NULL,
  fornecedor_id      INT NOT NULL REFERENCES fvm_fornecedores(id),
  periodo_referencia VARCHAR(7) NOT NULL,
  total_entregas     INT NOT NULL DEFAULT 0,
  entregas_aprovadas INT NOT NULL DEFAULT 0,
  entregas_nc        INT NOT NULL DEFAULT 0,
  entregas_reprovadas INT NOT NULL DEFAULT 0,
  score_conformidade DECIMAL(4,2),
  score_documentacao DECIMAL(4,2),
  score_geral        DECIMAL(4,2),
  decisao            VARCHAR(30) NOT NULL,
  observacao         TEXT,
  avaliado_por       INT NOT NULL,
  avaliado_em        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, fornecedor_id, periodo_referencia)
);
CREATE INDEX idx_fvm_aval_forn ON fvm_avaliacoes_fornecedor (fornecedor_id, tenant_id);

-- 13. Audit log
CREATE TABLE fvm_audit_log (
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
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fvm_audit_lote ON fvm_audit_log (lote_id, tenant_id);
```

---

## 12. Critérios de Aceite

| CA | Descrição |
|----|-----------|
| CA-01 | Categorias com seed PBQP-H visíveis a todos os tenants |
| CA-02 | Catálogo de materiais com itens de verificação por tipo (visual/documental/dimensional/ensaio) |
| CA-03 | Fornecedor `suspenso` ou `desqualificado` bloqueia createLote (409) |
| CA-04 | createLote pré-popula checklist com itens do catálogo do material |
| CA-05 | Item `nao_conforme` sem observação retorna 400 |
| CA-06 | concluirInspecao com item crítico NC e decisão `aprovado` retorna 422 |
| CA-07 | `reprovado` cria fvm_nao_conformidades automaticamente |
| CA-08 | Lote `quarentena` bloqueia registrarUso (409) |
| CA-09 | liberarQuarentena requer permissão `fvm.quarentena.liberar` |
| CA-10 | `aprovado_com_ressalva` requer permissão `fvm.aprovacao_ressalva` |
| CA-11 | Grade FVM exibe Material × Lote com cores por status |
| CA-12 | Clicar na célula abre drawer com resumo do lote e checklist |
| CA-13 | registrarUso valida status do lote antes de persistir |
| CA-14 | fvm_audit_log registra toda transição de status |
| CA-15 | Avaliação de fornecedor calcula score e propõe decisão |
| CA-16 | Suspensão de fornecedor bloqueia imediatamente novas entregas |
| CA-17 | Rastreabilidade retorna todos os usos do lote na obra |

---

## 13. Plano de Sprints

### Sprint 1 — Cadastros Base
Schema DDL (13 tabelas) + seeds PBQP-H + FvmModule + CatalogoService (categorias, materiais, itens, documentos) + FornecedoresService + controllers + testes + frontend páginas de catálogo e fornecedores.

### Sprint 2 — Recebimento e Grade
createLote (com checklist pré-populado) + putRegistro + concluirInspecao + NC automática + quarentena + liberarQuarentena + evidências + grade visual (Material × Lote) + drawer lateral + FichaLotePage.

### Sprint 3 — Rastreabilidade, Avaliação e Relatórios
registrarUso + rastreabilidade + avaliação periódica de fornecedores + relatório PDF + dashboard de conformidade.

---

## 14. Fora do Escopo (Sprints Futuros)

- App mobile offline (SQLite + sync) — Sprint 4
- Assinatura digital do inspetor/cliente — Sprint 4
- Aprovação múltipla (N aprovadores) — Sprint 4
- Alerta WhatsApp em reprovação — Sprint 5
- Sugestão de NC via IA — Sprint 5
