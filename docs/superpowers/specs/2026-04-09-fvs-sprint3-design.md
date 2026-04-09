# FVS Sprint 3 — Registro de Ocorrência, Reinspeção e Parecer do Engenheiro

> **Status:** Aprovado pelo PO | Data: 2026-04-09
> **Sprint:** FVS-3 de 4
> **Depende de:** FVS Sprint 2 (Abertura e Execução de Inspeção) ✅

---

## Objetivo

Fechar o ciclo de qualidade da FVS: NCs detectadas na inspeção geram um **Registro de Ocorrência (RO)** rastreável, o responsável define ação corretiva por serviço, itens NC são reabertos individualmente para reinspeção, e o ciclo termina com o **Parecer formal do Engenheiro** elevando a ficha ao estado `aprovada`.

---

## Contexto de Negócio

Uma FVS concluída com itens não conformes não pode ser simplesmente arquivada — exige rastreamento do tratamento de cada NC. O RO é o documento que registra o que aconteceu, quem é responsável, qual a causa e qual a ação tomada. A reinspeção confirma que a correção foi efetiva. O Parecer é a assinatura do engenheiro encerrando o ciclo.

### Regime PBQP-H vs. demais

| Regra | PBQP-H | Livre / Norma Técnica |
|---|---|---|
| Criar RO quando há NCs | Obrigatório | Obrigatório (processo padrão Sprint 3) |
| Campos `tipo`, `responsavel_id`, `causa_6m` no RO | Obrigatórios antes de desbloquear | Opcionais |
| Foto da ação corretiva em item crítico NC | Obrigatória na conclusão do ciclo | Opcional |
| Observação no parecer de rejeição | Obrigatória | Opcional |
| Audit log de cada ação | Obrigatório | Não gravado |
| Parecer do Engenheiro | Obrigatório | Configurável via `exige_parecer` |

> **Configurabilidade futura (Sprint 4):** O processo será configurável por obra e por modelo de FVS (`fvs_modelos`). No Sprint 3 o processo completo é o padrão. Ver decisão arquitetural documentada em memória: `project_fvs_sprint4_templates.md`.

---

## Fluxo Completo

```
FVS concluída com NCs
  → ro_ocorrencias criado automaticamente (status: aberto)
    → ro_servicos_nc (1 por serviço NC)
      → ro_servico_itens_nc (1 por item NC do serviço)

Gestor preenche RO: tipo, responsável, o_que_aconteceu, causa_6m, acao_imediata

Por serviço NC:
  → Gestor define acao_corretiva
  → (opcional) anexa fotos da correção via ro_servico_evidencias
  → Desbloqueia serviço para reinspeção
    → fvs_registros ciclo=2 criados apenas para os itens NC do serviço
    → Inspetor reavalia → conforme ou ainda NC
    → Todos conforme: ro_servicos_nc.status = 'verificado'

Todos os serviços verificados → ro_ocorrencias.status = 'concluido' (automático)

Responsável aciona "Solicitar Parecer"
  → valida RO concluído (ou sem RO se FVS sem NCs)
  → FVS: concluida → aguardando_parecer

Engenheiro emite Parecer:
  → Aprovado: FVS → aprovada ✓ (estado final)
  → Rejeitado: FVS → em_inspecao (novo ciclo, itens NC ganham ciclo=N+1)
```

---

## Máquina de Estados — fvs_fichas.status

```
rascunho → em_inspecao → concluida → aguardando_parecer → aprovada
                                              ↓ (rejeição)
                                         em_inspecao (ciclo N+1)
```

| Transição | Quem aciona | Pré-condição |
|---|---|---|
| concluida → aguardando_parecer | Responsável ("Solicitar Parecer") | RO inexistente OU `ro_ocorrencias.status = 'concluido'` |
| aguardando_parecer → aprovada | Engenheiro (parecer aprovado) | — |
| aguardando_parecer → em_inspecao | Engenheiro (parecer rejeitado) | — |

> **Durante `concluida`:** FVS permanece neste estado enquanto o RO está em andamento e itens são reinspecionados. O estado não muda até "Solicitar Parecer".

---

## Modelo de Dados

### Tabelas modificadas

```sql
-- fvs_fichas: novos estados e campo de controle
ALTER TABLE fvs_fichas
  ADD COLUMN exige_parecer BOOLEAN NOT NULL DEFAULT false;
-- status VARCHAR expande para incluir: 'aguardando_parecer', 'aprovada'

-- fvs_registros: suporte a ciclos de reinspeção
ALTER TABLE fvs_registros
  ADD COLUMN ciclo INT NOT NULL DEFAULT 1;
-- UNIQUE constraint muda de (ficha_id, servico_id, item_id, local_id)
-- para (ficha_id, servico_id, item_id, local_id, ciclo)
```

### Tabelas novas

```sql
-- Registro de Ocorrência — 1 por FVS com NCs
CREATE TABLE ro_ocorrencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_id            INT NOT NULL REFERENCES fvs_fichas(id),
  numero              VARCHAR(50) NOT NULL,        -- gerado: RO-{ficha_id}-{seq}
  tipo                VARCHAR(20) NOT NULL DEFAULT 'real',  -- real | potencial
  responsavel_id      INT NOT NULL REFERENCES "Usuario"(id),
  data_ocorrencia     DATE NOT NULL DEFAULT NOW(),
  o_que_aconteceu     TEXT,
  acao_imediata       TEXT,
  causa_6m            VARCHAR(20),
  -- mao_obra | material | metodo | gestao | medida | meio_ambiente | maquina
  justificativa_causa TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'aberto', -- aberto | concluido
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, ficha_id),
  INDEX(tenant_id, status)
);

-- NC por serviço — 1 por serviço que tem itens NC na FVS
CREATE TABLE ro_servicos_nc (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_id               INT NOT NULL REFERENCES ro_ocorrencias(id) ON DELETE CASCADE,
  servico_id          INT NOT NULL,
  servico_nome        VARCHAR(200) NOT NULL,        -- denormalizado para relatórios
  acao_corretiva      TEXT,
  status              VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- pendente | desbloqueado | verificado
  ciclo_reinsspecao   INT NULL,                    -- ciclo dos fvs_registros criados na reinspeção
  desbloqueado_em     TIMESTAMP NULL,
  verificado_em       TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Itens NC dentro de cada serviço — só referencia, sem ação própria
CREATE TABLE ro_servico_itens_nc (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_servico_nc_id    INT NOT NULL REFERENCES ro_servicos_nc(id) ON DELETE CASCADE,
  registro_id         INT NOT NULL REFERENCES fvs_registros(id), -- ciclo=1 (original)
  item_descricao      TEXT NOT NULL,               -- denormalizado
  item_criticidade    VARCHAR(20) NOT NULL         -- denormalizado
);

-- Fotos da ação corretiva (prova da correção executada)
CREATE TABLE ro_servico_evidencias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ro_servico_nc_id    INT NOT NULL REFERENCES ro_servicos_nc(id) ON DELETE CASCADE,
  versao_ged_id       INT NOT NULL REFERENCES ged_versoes(id),
  descricao           TEXT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Parecer formal do Engenheiro
CREATE TABLE fvs_pareceres (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INT NOT NULL,
  ficha_id            INT NOT NULL REFERENCES fvs_fichas(id),
  decisao             VARCHAR(20) NOT NULL,         -- aprovado | rejeitado
  observacao          TEXT,
  itens_referenciados JSONB,
  -- [{ registro_id, item_descricao, servico_nome }] selecionados pelo engenheiro
  criado_por          INT NOT NULL REFERENCES "Usuario"(id),
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX(tenant_id, ficha_id)
);
```

### Trilha de evidências por ciclo (PBQP-H)

| Evidência | Tabela | Ciclo |
|---|---|---|
| Foto da NC (prova que existia) | `fvs_evidencias` → `fvs_registros` ciclo=1 | Ciclo 1 |
| Foto da ação corretiva (prova da correção) | `ro_servico_evidencias` | Fora do ciclo |
| Foto da reinspeção (prova que foi resolvido) | `fvs_evidencias` → `fvs_registros` ciclo=2 | Ciclo 2 |

---

## Contrato de API

### RO — Registro de Ocorrência

```
GET    /api/v1/fvs/fichas/:fichaId/ro
  → RO completo: header + servicos_nc[] + itens_nc[] por serviço + evidencias por serviço
  → 404 se FVS não tem RO

PATCH  /api/v1/fvs/fichas/:fichaId/ro
  Body: { tipo?, responsavel_id?, o_que_aconteceu?, acao_imediata?, causa_6m?, justificativa_causa? }
  → Atualiza campos do cabeçalho do RO

PATCH  /api/v1/fvs/fichas/:fichaId/ro/servicos/:servicoNcId
  Body: { acao_corretiva?, desbloquear?: boolean }
  → Atualiza ação corretiva do serviço
  → Se desbloquear=true:
      - Valida campos obrigatórios do RO (PBQP-H)
      - Cria fvs_registros ciclo=N para cada item NC do serviço
      - ro_servicos_nc.status = 'desbloqueado', ciclo_reinsspecao = N

POST   /api/v1/fvs/fichas/:fichaId/ro/servicos/:servicoNcId/evidencias
  Body: multipart/form-data — arquivo + descricao?
  → Upload via GED categoria FTO, cria ro_servico_evidencias

DELETE /api/v1/fvs/fichas/:fichaId/ro/servicos/:servicoNcId/evidencias/:evidenciaId
  → Remove ro_servico_evidencias + marca versão GED como obsoleta
```

### Parecer do Engenheiro

```
POST   /api/v1/fvs/fichas/:fichaId/solicitar-parecer
  → Valida: RO inexistente OU ro_ocorrencias.status = 'concluido'
  → Transição: concluida → aguardando_parecer
  → Grava audit_log se regime = 'pbqph'
  → 409 se RO aberto

POST   /api/v1/fvs/fichas/:fichaId/parecer
  Body: { decisao: 'aprovado'|'rejeitado', observacao?: string, itens_referenciados?: [] }
  → Valida: observacao obrigatória se rejeitado + regime = 'pbqph'
  → Cria fvs_pareceres
  → Aprovado: FVS → aprovada
  → Rejeitado: FVS → em_inspecao + cria fvs_registros ciclo=N+1 para itens NC
  → 422 se PBQP-H + rejeitado + sem observacao
```

### InspecaoService — modificações

```
GET  /api/v1/fvs/fichas/:fichaId/grade
  → Retorna dados do MAX(ciclo) por célula (sem quebra na API)

GET  /api/v1/fvs/fichas/:fichaId/:servicoId/:localId/registros
  → Adiciona campo desbloqueado: boolean por item
  → Retorna apenas ciclo mais recente por item
```

---

## Frontend — Componentes e Telas

### Telas modificadas

| Tela | O que muda |
|---|---|
| `FichasListPage` | Status `aguardando_parecer` (laranja) e `aprovada` (verde escuro); badge "RO aberto" |
| `FichaGradePage` | Painel RO lateral quando `concluida` com NCs; botão "Solicitar Parecer"; modal `ParecerModal` quando `aguardando_parecer` |
| `FichaLocalPage` | Quando ciclo=2 (reinspeção): mostra só itens NC do ciclo anterior, header "Reinspeção — Ciclo N", itens conformes bloqueados/cinza |

### Componentes novos

**`RoPanel`** — embutido em `FichaGradePage`
- Campos header do RO (editáveis pelo responsável)
- Lista de `ro_servicos_nc` com seus `ro_servico_itens_nc`
- Por serviço: campo ação corretiva + galeria de fotos + botão "Desbloquear para Reinspeção"
- Progresso: X/Y serviços verificados

**`ParecerModal`** — aberto quando `status === 'aguardando_parecer'`
- Resumo da grade (células coloridas)
- Seleção de itens para referência no parecer
- Decisão: Aprovar / Rejeitar
- Observação (obrigatória em rejeição PBQP-H)

### Hooks novos

```ts
// src/modules/fvs/inspecao/hooks/useRo.ts
useRo(fichaId)
usePatchRo(fichaId)
usePatchServicoNc(fichaId)
useRoEvidencias(servicoNcId)
useCreateRoEvidencia(fichaId)
useDeleteRoEvidencia(fichaId)
useSolicitarParecer(fichaId)
useSubmitParecer(fichaId)
```

---

## Regras de Negócio Críticas

| Código | Regra |
|---|---|
| RO1 | RO criado automaticamente ao concluir FVS com NCs. Em PBQP-H, campos `tipo`, `responsavel_id` e `causa_6m` obrigatórios antes de desbloquear qualquer serviço. |
| RO2 | `ro_servicos_nc` imutável — status só avança: `pendente → desbloqueado → verificado`. Nunca deletado. |
| RO3 | Desbloqueio cria `fvs_registros` com `ciclo=N` APENAS para os itens em `ro_servico_itens_nc` do serviço. Itens conformes do ciclo anterior permanecem intocados. |
| RO4 | `ro_ocorrencias.status = 'concluido'` automático quando todos os `ro_servicos_nc` ficam `verificado`. |
| RO5 | `ro_servicos_nc.status = 'verificado'` automático quando todos os seus itens NC do novo ciclo ficam `conforme`. |
| PA1 | "Solicitar Parecer" exige: sem RO OU `ro_ocorrencias.status = 'concluido'`. Retorna 409 caso contrário. |
| PA2 | Parecer rejeitado cria `fvs_registros` ciclo=N+1 para todos os itens NC da ficha (do ciclo mais recente) e transita FVS para `em_inspecao`. |
| PA3 | `fvs_pareceres` append-only — cada ciclo pode ter seu próprio parecer. Nunca UPDATE/DELETE. |
| PA4 | Em PBQP-H, `observacao` obrigatória no parecer de rejeição (422 sem ela). |
| AU1 | Todo evento grava em `fvs_audit_log` quando `regime = 'pbqph'`: criação do RO, desbloqueio de serviço, cada reinspeção de item, solicitação de parecer, emissão do parecer. |

---

## Fora do Escopo deste Sprint

- Geração de PDF do RO (exportação do documento como o modelo físico) → Sprint 4/5
- Configuração de workflow por obra e por modelo de FVS (`fvs_modelos`) → Sprint 4
- Notificações (email/push) ao responsável e ao engenheiro → Sprint 4
- Envio para mobile e sincronização → Sprint 4

---

## Critérios de Aceite

- [ ] **CA1** — FVS concluída com NCs → `ro_ocorrencias` criado automaticamente com `ro_servicos_nc` e `ro_servico_itens_nc` populados corretamente
- [ ] **CA2** — Serviço com 3 itens NC desbloqueado → exatamente 3 novos `fvs_registros` ciclo=2 criados; outros itens do serviço intocados
- [ ] **CA3** — Todos os itens ciclo=2 de um serviço marcados conforme → `ro_servicos_nc.status = 'verificado'` automático
- [ ] **CA4** — Último serviço verificado → `ro_ocorrencias.status = 'concluido'` automático
- [ ] **CA5** — "Solicitar Parecer" com RO ainda aberto → 409
- [ ] **CA6** — Parecer aprovado → FVS `aprovada`, nenhum novo registro criado
- [ ] **CA7** — Parecer rejeitado → FVS volta `em_inspecao`, itens NC do ciclo atual ganham `ciclo=N+1`
- [ ] **CA8** — Grade retorna dados do ciclo mais recente por célula
- [ ] **CA9** — FichaLocalPage em serviço desbloqueado (ciclo=2): exibe só itens NC do ciclo 1, conformes bloqueados
- [ ] **CA10** — PBQP-H: desbloquear serviço sem campos obrigatórios do RO → 422
- [ ] **CA11** — PBQP-H: parecer rejeitado sem observação → 422
- [ ] **CA12** — Upload de foto em `ro_servico_evidencias` → cria versão GED categoria FTO, linkada ao serviço NC
- [ ] **CA13** — FichasListPage exibe `aguardando_parecer` (laranja) e `aprovada` (verde) corretamente
- [ ] **CA14** — PBQP-H: todo evento (criação RO, desbloqueio, reinspeção, parecer) gravado em `fvs_audit_log`

---

## Dependências Técnicas

- `fvs_fichas`, `fvs_registros`, `fvs_evidencias` — Sprint 2 ✅
- `fvs_ficha_servicos`, `fvs_catalogo_itens` — Sprint 1 + 2 ✅
- `ged_versoes` — GED Module ✅ (snake_case, sem aspas)
- `"Usuario"` — tabela base ✅ (PascalCase com aspas duplas no SQL raw)
- Padrão raw SQL: `prisma.$queryRawUnsafe` / `prisma.$executeRawUnsafe`
- Padrão multi-tenant: `WHERE tenant_id = $N` em todas as queries
