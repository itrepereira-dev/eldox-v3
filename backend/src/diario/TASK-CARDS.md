# TASK CARDS — DEV-BACKEND S01
## Módulo RDO — Baseline sem Agentes IA (CRUD + Workflow + PDF)

> Sprint: S01 | Criado em: 2026-04-14 | Módulo: `diario`
> Scope: Tudo que roda SEM dependência de LLM/agentes externos.
> Agentes IA (AGENTE-CLIMA, AGENTE-EQUIPE, AGENTE-ATIVIDADES, AGENTE-RESUMO) ficam nos stubs e entram no S02.

---

## EPIC-RDO-001 — Infraestrutura e Schema

### CARD-RDO-001 · Migration SQL — Tabelas do módulo RDO
**Prioridade:** P0 — Bloqueante para todos os outros cards
**Estimativa:** 3h

**Escopo:**
Criar migration Prisma ou SQL puro para as tabelas:
- `rdos` — tabela principal (tenant_id, obra_id, data, status, numero_sequencial, criado_por, aprovado_por, aprovado_em, resumo_ia, pdf_url, deleted_at)
- `rdo_clima` — (rdo_id, tenant_id, periodo ENUM, condicao ENUM, praticavel BOOL, chuva_mm, aplicado_pelo_usuario) + UNIQUE(rdo_id, periodo)
- `rdo_mao_obra` — (rdo_id, tenant_id, funcao, quantidade, tipo ENUM, nome_personalizado, hora_entrada, hora_saida)
- `rdo_equipamentos` — (rdo_id, tenant_id, descricao, quantidade, unidade, observacao)
- `rdo_atividades` — (rdo_id, tenant_id, descricao, pavimento, servico, percentual_executado, observacao)
- `rdo_ocorrencias` — (rdo_id, tenant_id, tipo ENUM, descricao, grau_impacto ENUM, acao_tomada)
- `rdo_checklist` — (rdo_id, tenant_id, item, resposta BOOL, observacao)
- `rdo_fotos` — (rdo_id, tenant_id, ged_versao_id, url, descricao, legenda, criado_por)
- `rdo_assinaturas` — (rdo_id, tenant_id, usuario_id, assinatura_base64, tipo ENUM)
- `rdo_log_edicoes` — (rdo_id, tenant_id, usuario_id, campo, valor_anterior JSONB, valor_novo JSONB, acao)
- `rdo_sugestoes_ia` — (rdo_id, tenant_id, agente, campo, valor_sugerido JSONB, valor_aplicado JSONB, acao ENUM, aplicado_em, usuario_id)

**Índices obrigatórios:**
- `rdos(obra_id, data)` — para lookup de duplicidade
- `rdos(tenant_id, obra_id, status)` — para listagens
- `rdo_log_edicoes(rdo_id, criado_em DESC)`

**Acceptance criteria:**
- Migration roda em < 2s em base vazia
- Todos os FKs com ON DELETE RESTRICT
- Todos os campos tenant_id NOT NULL com verificação de tenant nos índices

---

### CARD-RDO-002 · Registrar DiarioModule em AppModule
**Prioridade:** P0 — Bloqueante para testes de integração
**Estimativa:** 30min

**Escopo:**
- Adicionar `DiarioModule` no array `imports` de `app.module.ts`
- Verificar que `BullModule.forRootAsync` já está configurado globalmente (Redis)
- Se não estiver, adicionar configuração de Redis via `ConfigService`

**Acceptance criteria:**
- `npm run start:dev` sobe sem erros de módulo
- Rota `GET /api/v1/diario/rdos` retorna 401 (não 404)

---

## EPIC-RDO-002 — CRUD Principal

### CARD-RDO-003 · POST /rdos — Criar RDO
**Prioridade:** P0
**Estimativa:** 4h
**Depende de:** CARD-RDO-001, CARD-RDO-002

**Escopo:**
Substituir os `// TODO:` no método `RdoService.create` pelo SQL real após migration:
- Validar obra via `obras` (confirmar nome da tabela no schema)
- INSERT em `rdos` com todos os campos
- Grava `rdo_log_edicoes` ('RDO criado')
- Retornar `{ rdo_id, status: 'preenchendo', sugestoes_ia: null }`
- Job BullMQ `acionar-agentes-ia` já está sendo despachado — apenas confirmar que Redis está UP

**Testes a escrever:**
- Cria RDO com sucesso → 201 com rdo_id
- Tenta criar 2 RDOs mesmo dia/obra → 409 com code RDO_001
- Obra inexistente → 404
- Token inválido → 401
- Tenant errado (obra de outro tenant) → 404

---

### CARD-RDO-004 · GET /rdos — Listar RDOs
**Prioridade:** P1
**Estimativa:** 3h
**Depende de:** CARD-RDO-003

**Escopo:**
Substituir os `// TODO:` em `RdoService.list`:
- Query com filtros dinâmicos (status, data_inicio, data_fim)
- COUNT(*) real para `total` e `status_counts` via subquery GROUP BY
- JOIN com tabela `obras` para retornar `obra_nome`
- Paginação com page/limit validados (max limit = 100)

**Acceptance criteria:**
- `status_counts` sempre retorna os 4 status (zero para os sem registros)
- Sem obra_id → 400 com field: 'obra_id', code: 'RDO_002'
- Filtro de data funciona corretamente com timezone (usar DATE AT TIME ZONE)

---

### CARD-RDO-005 · GET /rdos/:id — Buscar RDO Completo
**Prioridade:** P1
**Estimativa:** 2h
**Depende de:** CARD-RDO-001

**Escopo:**
O método `RdoService.findById` já está estruturado com 9 queries paralelas.
Substituir os nomes de tabela e colunas pelos reais após migration.
Confirmar que as queries respeitam `tenant_id` em todas as sub-tabelas.

---

### CARD-RDO-006 · PATCH /rdos/:id — Atualizar RDO
**Prioridade:** P1
**Estimativa:** 3h
**Depende de:** CARD-RDO-001

**Escopo:**
Substituir o `// TODO: montar UPDATE dinâmico` por implementação real:
- Listar campos permitidos para atualização (whitelist: observacao_geral, responsavel_id, tags)
- Montar SQL dinâmico apenas com campos presentes no DTO
- Gravar log para cada campo alterado (já implementado em loop)
- Bloquear se status = 'aprovado' (já implementado)

---

### CARD-RDO-007 · DELETE /rdos/:id — Soft Delete
**Prioridade:** P2
**Estimativa:** 1h
**Depende de:** CARD-RDO-001

**Escopo:**
Lógica já implementada. Apenas confirmar que:
- `deleted_at` é respeitado em TODAS as queries (verificar getObraOuFalhar e getRdoOuFalhar)
- Validação de `criado_por === usuarioId` funciona com o campo real da tabela

---

## EPIC-RDO-003 — Workflow de Status

### CARD-RDO-008 · PATCH /rdos/:id/status — Avançar Status
**Prioridade:** P0
**Estimativa:** 4h
**Depende de:** CARD-RDO-001

**Escopo:**
Substituir os `// TODO:` em `RdoService.updateStatus`:
- Confirmar nome das colunas `aprovado_por`, `aprovado_em` na tabela `rdos`
- INSERT em `rdo_assinaturas` com colunas reais
- Validar role via tabela de usuários ou campo no JWT (confirmar estrutura do `user.role`)
- Jobs BullMQ `gerar-resumo-ia` e `gerar-pdf` já estão sendo despachados

**Regras de negócio a testar:**
- preenchendo → revisao: qualquer role com acesso à obra ✓
- revisao → aprovado: apenas ADMIN_TENANT, ENGENHEIRO, APROVADOR ✓
- aprovado → qualquer: deve retornar 400 (RDO_006) ✓
- Transição inválida (ex: preenchendo → aprovado): 400 ✓

---

## EPIC-RDO-004 — Seções do RDO

### CARD-RDO-009 · PUT /rdos/:id/clima — Upsert Climático
**Prioridade:** P1
**Estimativa:** 2h
**Depende de:** CARD-RDO-001

**Escopo:**
Confirmar ON CONFLICT (rdo_id, periodo) conforme UNIQUE index criado na migration.
Validar que os ENUMs de `periodo` e `condicao` batem com os valores da migration.

---

### CARD-RDO-010 · PUT Seções: Mão de Obra, Equipamentos, Atividades, Ocorrências, Checklist
**Prioridade:** P1
**Estimativa:** 4h (todas juntas)
**Depende de:** CARD-RDO-001

**Escopo:**
Os 5 métodos de `substituirXxx` estão estruturados com DELETE + INSERT.
Após migration, confirmar nomes de colunas e ENUMs.
Adicionar validação de tamanho máximo de array (ex: max 200 atividades por RDO).

---

## EPIC-RDO-005 — Inteligência da Obra (Baseline)

### CARD-RDO-011 · GET /obras/:obraId/inteligencia — Painel IA (baseline sem LLM)
**Prioridade:** P2
**Estimativa:** 3h
**Depende de:** CARD-RDO-003

**Escopo:**
Implementar versão baseline (sem LLM) com dados calculados via SQL:
- `dias_sem_relatorio`: já implementado via `MAX(data)` — confirmar funciona
- `top_ocorrencias`: já implementado via GROUP BY — confirmar JOIN correto
- `risco_atraso_pct`: calcular via fórmula simples (dias sem RDO / tolerância configurada)
- `tendencia`: comparar média de atividades últimos 7 dias vs 30 dias

**Nota:** `previsao_conclusao_ia` fica como `null` até S02 (depende de AGENTE-INTELIGENCIA).

---

## EPIC-RDO-006 — WhatsApp / AGENTE-CAMPO

### CARD-RDO-012 · POST /whatsapp/campo — Receber Webhook Meta
**Prioridade:** P2
**Estimativa:** 3h
**Depende de:** Redis UP

**Escopo:**
- Implementar validação HMAC X-Hub-Signature-256 (TODO no controller)
- Implementar lookup de `numero → tenant/usuário` na tabela de usuários
- Adicionar `tenantId` e `usuarioId` no payload do job `agente-campo`
- Adicionar handler `agente-campo` no `RdoProcessor.process` switch

**Acceptance criteria:**
- Meta verify challenge funciona (GET retorna challenge)
- POST com HMAC inválido → 401
- POST com HMAC válido → 200 em < 500ms (não bloqueia)

---

## EPIC-RDO-007 — Geração de PDF (estrutura)

### CARD-RDO-013 · Job gerar-pdf — Template e Geração
**Prioridade:** P2 — Sprint S01 entrega apenas a estrutura do job
**Estimativa:** 8h

**Escopo S01 (estrutura):**
- Definir template HTML/CSS do RDO impresso
- Instalar dependência: `@nestjs/bullmq` já presente; adicionar `puppeteer` ou `@react-pdf/renderer`
- Implementar handler `handleGerarPdf` no RdoProcessor:
  1. Carregar RDO completo
  2. Renderizar template
  3. Upload para GED via GedService
  4. UPDATE rdos.pdf_url

**Nota:** Integração com GedModule já disponível (ver FvsModule como referência de import).

---

## EPIC-RDO-008 — Testes

### CARD-RDO-014 · Testes unitários — RdoService
**Prioridade:** P1
**Estimativa:** 6h
**Depende de:** CARD-RDO-003 a CARD-RDO-010

**Cobertura mínima S01:**
- `create`: sucesso, conflito 409, obra não encontrada
- `updateStatus`: todas as transições válidas e inválidas
- `upsertClima`: upsert correto dos 3 períodos
- `substituirMaoObra`: deleção + reinserção
- `remove`: bloqueio se não é criado_por e role sem permissão

**Stack:** Jest + prisma mock via `jest-mock-extended` (padrão do projeto)

---

### CARD-RDO-015 · Testes de integração — RdoController
**Prioridade:** P2
**Estimativa:** 4h
**Depende de:** CARD-RDO-014

**Escopo:**
- Testes e2e com banco de teste (não mock)
- Verificar isolamento multi-tenant: token tenant A não acessa RDO do tenant B
- Verificar que job BullMQ é enfileirado após create (mock da queue)

---

## Resumo de Prioridades S01

| Card | Título | Prior. | h |
|------|--------|--------|---|
| RDO-001 | Migration SQL | P0 | 3 |
| RDO-002 | Registrar DiarioModule | P0 | 0.5 |
| RDO-003 | POST /rdos | P0 | 4 |
| RDO-008 | PATCH /rdos/:id/status | P0 | 4 |
| RDO-004 | GET /rdos (lista) | P1 | 3 |
| RDO-005 | GET /rdos/:id | P1 | 2 |
| RDO-006 | PATCH /rdos/:id | P1 | 3 |
| RDO-009 | PUT clima | P1 | 2 |
| RDO-010 | PUT seções (5x) | P1 | 4 |
| RDO-014 | Testes unitários | P1 | 6 |
| RDO-007 | DELETE soft | P2 | 1 |
| RDO-011 | Inteligência baseline | P2 | 3 |
| RDO-012 | WhatsApp webhook | P2 | 3 |
| RDO-013 | Job gerar-pdf | P2 | 8 |
| RDO-015 | Testes integração | P2 | 4 |

**Total P0:** 11.5h | **Total P1:** 20h | **Total P2:** 19h | **Total S01:** ~50h

---

## Dependências externas

| Dependência | Status | Responsável |
|-------------|--------|-------------|
| Redis (BullMQ) | Necessário | DevOps / docker-compose |
| `@nestjs/bullmq` no package.json | Verificar | DEV-BACKEND |
| `class-validator` e `class-transformer` | Já presente (FVS usa) | — |
| `WHATSAPP_VERIFY_TOKEN` em .env | Pendente | PO / Meta |
| Schema final de `obras` (nome da tabela) | Confirmar | DEV-BACKEND |
