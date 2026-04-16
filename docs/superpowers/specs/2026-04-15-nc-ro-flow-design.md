# NC + Registro de Ocorrência (RO) — Design Spec

**Data:** 2026-04-15
**Status:** Aprovado

---

## Objetivo

Implementar o fluxo completo de tratamento de Não-Conformidades (NCs) no Eldox v3, incluindo:

- NC gerada por serviço (não por item), com lista de itens NC individuais
- Registro de Ocorrência (RO) como unidade de tratamento — pode agrupar 1 ou N NCs
- Análise de Causa (6M / Ishikawa)
- SLA configurável por obra (dias úteis, modo avisar/bloquear)
- Aprovação configurável (Livre / Obrigatório / PBQP-H)
- Revistorias item a item com histórico individualizado
- Exportação do RO como PDF (preview no browser, download opcional)
- Lista global de NCs unificada com filtros por módulo, status, criticidade e RO

---

## Arquitetura

### Relação entre entidades

```
fvs_fichas / betonadas / fvm_lotes / ensaios
        ↓ (geram NCs por serviço)
nao_conformidades  (1 NC por serviço)   ──── ro_id ────►  registros_ocorrencia
        │                                                        │
        └── nc_itens_nao_conformes  (itens NC individuais)       └── nc_tratamentos
                    │                                                 (ciclos histórico)
                    └── nc_revistorias  (revistoria por item)
```

### Regra de geração

- Um serviço com N itens NC → **1 NC** vinculada ao serviço
- Os itens que geraram a NC ficam em `nc_itens_nao_conformes`
- NCs de módulos diferentes podem ser agrupadas no mesmo RO
- Cada NC pertence a **no máximo 1 RO**

---

## Banco de Dados

### 1. Tabela `registros_ocorrencia` (nova)

```sql
CREATE TABLE registros_ocorrencia (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL,
  obra_id             INTEGER NOT NULL,
  numero_ro           VARCHAR(30) NOT NULL,        -- RO-2026-0001
  titulo              VARCHAR(200) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ABERTA',
    -- ABERTA | TRATAMENTO | VERIFICACAO | FECHADA | CANCELADA
  -- Tratamento
  acao_corretiva      TEXT,
  responsavel_id      INTEGER,
  prazo_execucao      DATE,
  -- Análise 6M
  causa_mao_de_obra   TEXT,
  causa_metodo        TEXT,
  causa_maquina       TEXT,
  causa_material      TEXT,
  causa_meio_ambiente TEXT,
  causa_medicao       TEXT,
  -- Aprovação
  aprovacao_modo      TEXT NOT NULL DEFAULT 'livre',
    -- livre | obrigatorio | pbqph
  verificado_por      INTEGER,
  verificado_em       TIMESTAMPTZ,
  -- SLA
  sla_dias_uteis      INTEGER,
  sla_prazo           DATE,
  sla_status          TEXT DEFAULT 'desativado',
    -- no_prazo | alerta | vencido | desativado
  -- Evidências
  fotos_urls          TEXT[] DEFAULT '{}',
  -- Histórico
  ciclo_atual         INTEGER NOT NULL DEFAULT 1,
  data_fechamento     TIMESTAMPTZ,
  created_by          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_ro_numero ON registros_ocorrencia (tenant_id, numero_ro);
CREATE INDEX idx_ro_tenant_obra ON registros_ocorrencia (tenant_id, obra_id);
CREATE INDEX idx_ro_status ON registros_ocorrencia (tenant_id, status);
```

### 2. Tabela `nc_itens_nao_conformes` (nova)

```sql
CREATE TABLE nc_itens_nao_conformes (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL,
  nc_id               INTEGER NOT NULL REFERENCES nao_conformidades(id) ON DELETE CASCADE,
  item_descricao      TEXT NOT NULL,   -- snapshot do item inspecionado
  local_descricao     TEXT,            -- snapshot do local
  foto_antes_url      VARCHAR(500),
  status              TEXT NOT NULL DEFAULT 'ABERTO',
    -- ABERTO | APROVADO | REPROVADO | CANCELADO
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nc_itens_nc ON nc_itens_nao_conformes (nc_id);
CREATE INDEX idx_nc_itens_tenant ON nc_itens_nao_conformes (tenant_id);
```

### 3. Tabela `nc_revistorias` (nova)

```sql
CREATE TABLE nc_revistorias (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL,
  nc_item_id          INTEGER NOT NULL REFERENCES nc_itens_nao_conformes(id) ON DELETE CASCADE,
  ciclo               INTEGER NOT NULL DEFAULT 1,
  resultado           TEXT NOT NULL,   -- APROVADO | REPROVADO
  observacao          TEXT,
  foto_depois_url     VARCHAR(500),
  realizado_por       INTEGER NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_revistorias_item ON nc_revistorias (nc_item_id);
```

### 4. Tabela `nc_tratamentos` (nova — histórico de ciclos)

```sql
CREATE TABLE nc_tratamentos (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER NOT NULL,
  ro_id               INTEGER NOT NULL REFERENCES registros_ocorrencia(id) ON DELETE CASCADE,
  ciclo               INTEGER NOT NULL DEFAULT 1,
  acao_corretiva      TEXT,
  causa_mao_de_obra   TEXT,
  causa_metodo        TEXT,
  causa_maquina       TEXT,
  causa_material      TEXT,
  causa_meio_ambiente TEXT,
  causa_medicao       TEXT,
  responsavel_id      INTEGER,
  prazo_execucao      DATE,
  fotos_urls          TEXT[] DEFAULT '{}',
  resultado           TEXT,            -- APROVADO | REPROVADO
  motivo_reprovacao   TEXT,
  avaliado_por        INTEGER,
  avaliado_em         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nc_tratamentos_ro ON nc_tratamentos (ro_id, ciclo);
```

### 5. Tabela `nc_config_obra` (nova)

```sql
CREATE TABLE nc_config_obra (
  tenant_id             INTEGER NOT NULL,
  obra_id               INTEGER NOT NULL,
  sla_ativo             BOOLEAN NOT NULL DEFAULT FALSE,
  sla_dias_uteis        INTEGER NOT NULL DEFAULT 5,
  sla_modo              TEXT NOT NULL DEFAULT 'avisar',  -- avisar | bloquear
  aprovacao_modo        TEXT NOT NULL DEFAULT 'livre',   -- livre | obrigatorio | pbqph
  exige_6m              BOOLEAN NOT NULL DEFAULT FALSE,
  exige_foto_evidencia  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (tenant_id, obra_id)
);
```

### 6. Alterações em `nao_conformidades` (existente)

```sql
ALTER TABLE nao_conformidades
  ADD COLUMN IF NOT EXISTS ro_id          INTEGER REFERENCES registros_ocorrencia(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS servico_id     INTEGER,         -- id do serviço de origem (FVS/FVM/etc)
  ADD COLUMN IF NOT EXISTS servico_nome   VARCHAR(200);    -- snapshot do nome do serviço
-- Nota: SLA vive no registros_ocorrencia, não na NC individual

CREATE INDEX IF NOT EXISTS idx_ncs_ro ON nao_conformidades (ro_id);
```

---

## Ciclo de Vida

### Status do RO

```
ABERTA → TRATAMENTO → VERIFICACAO → FECHADA
               ↑←←←←← REPROVADO ←←←←←←←←←|
ABERTA | TRATAMENTO → CANCELADA
```

### Transições e validações

| De | Para | Quem | Validação |
|----|------|------|-----------|
| ABERTA | TRATAMENTO | ENGENHEIRO / TECNICO | `acao_corretiva` obrigatório |
| TRATAMENTO | VERIFICACAO | ENGENHEIRO / TECNICO | Se `aprovacao_modo=pbqph`: 6M obrigatório + foto obrigatória. Se `sla_modo=bloquear` e SLA vencido: bloqueado |
| VERIFICACAO | FECHADA | ENGENHEIRO (aprovador) | `aprovacao_modo=livre`: qualquer; `obrigatorio/pbqph`: só ENGENHEIRO com permissão. Fecha todas as NCs e itens vinculados |
| VERIFICACAO | TRATAMENTO | ENGENHEIRO (aprovador) | Reprovação — `motivo_reprovacao` obrigatório (mín. 20 chars). Incrementa `ciclo_atual`. Salva ciclo em `nc_tratamentos` |
| ABERTA\|TRATAMENTO | CANCELADA | ADMIN_TENANT / ENGENHEIRO | Não pode cancelar RO em VERIFICACAO |

### Propagação de status

- **RO fechado** → todas as NCs vinculadas → `status = FECHADA`, todos os itens → `status = APROVADO`
- **Item aprovado na revistoria** → se todos os itens da NC estão APROVADOS → NC pode ser considerada resolvida
- **Item reprovado na revistoria** → RO volta para TRATAMENTO (novo ciclo)

### Aprovação configurável

| Modo | Comportamento |
|------|---------------|
| `livre` | TRATAMENTO → FECHADA diretamente. Sem etapa VERIFICACAO |
| `obrigatorio` | TRATAMENTO → VERIFICACAO → ENGENHEIRO aprova → FECHADA |
| `pbqph` | Igual `obrigatorio` + 6M obrigatório + foto evidência obrigatória |

### SLA

- Calculado em **dias úteis** (segunda a sexta)
- Iniciado quando RO passa para TRATAMENTO
- Estados: `no_prazo` (>2 dias úteis) · `alerta` (1–2 dias úteis) · `vencido` · `desativado`
- Modo `bloquear`: impede transição TRATAMENTO→VERIFICACAO se SLA vencido (só ADMIN_TENANT pode liberar)
- Modo `avisar`: badge de alerta, não bloqueia

---

## API — Endpoints

### Configuração

```
GET  /api/v1/obras/:obraId/nc-config
PUT  /api/v1/obras/:obraId/nc-config
```

### NCs (lista unificada)

```
GET  /api/v1/obras/:obraId/ncs
     ?status=ABERTA|TRATAMENTO|VERIFICACAO|FECHADA|CANCELADA
     ?modulo=FVS|FVM|CONCRETAGEM|ENSAIO|MANUAL
     ?criticidade=ALTA|MEDIA|BAIXA
     ?ro=com|sem
     ?search=texto
     ?page=1&limit=20
```

### ROs

```
GET    /api/v1/obras/:obraId/ros                    lista com filtros
POST   /api/v1/obras/:obraId/ros                    cria RO (body: titulo, nc_ids[], config)
GET    /api/v1/obras/:obraId/ros/:roId              detalhe completo (NCs + itens + revistorias + ciclos)
PATCH  /api/v1/obras/:obraId/ros/:roId              atualiza tratamento / status / 6M
POST   /api/v1/obras/:obraId/ros/:roId/ncs          adiciona NCs existentes ao RO
DELETE /api/v1/obras/:obraId/ros/:roId/ncs/:ncId    remove NC do RO (só se ABERTA/TRATAMENTO)
GET    /api/v1/obras/:obraId/ros/:roId/pdf          HTML estilizado para impressão/download
```

### Revistorias

```
POST   /api/v1/obras/:obraId/ros/:roId/revistorias
       body: { nc_item_id, resultado, observacao, foto_depois_url }

PATCH  /api/v1/obras/:obraId/nc-itens/:itemId
       body: { status }
```

### Roles

| Ação | Roles permitidos |
|------|-----------------|
| Ver lista NCs / ROs | ADMIN_TENANT, ENGENHEIRO, TECNICO, VISITANTE |
| Criar RO / agrupar NCs | ADMIN_TENANT, ENGENHEIRO |
| Editar tratamento / 6M | ADMIN_TENANT, ENGENHEIRO, TECNICO |
| Registrar revistoria | ADMIN_TENANT, ENGENHEIRO |
| Aprovar / reprovar RO | ADMIN_TENANT, ENGENHEIRO |
| Cancelar RO | ADMIN_TENANT, ENGENHEIRO |
| Configurar nc_config_obra | ADMIN_TENANT |

---

## Frontend

### Módulo `ncs` (existente — estender)

#### `/obras/:obraId/ncs` — NcsListPage

- **Sem botão "Nova NC"** — NCs são geradas pelos módulos. Subtitle explica isso.
- KPIs: Abertas / Em Tratamento / Verificação / Fechadas / ROs ativos
- Filtros: status · módulo (FVS/FVM/Concretagem/Ensaios) · criticidade · com/sem RO · busca livre
- Tabela: checkbox · NC/Serviço · Módulo · Criticidade · Status · RO · SLA
- **Barra de ações contextual** ao selecionar NCs:
  - Todas no mesmo RO → **"Ver RO-XXXX"**
  - Nenhuma tem RO → **"Criar RO"**
  - Mix (algumas com RO, outras sem, ou ROs diferentes) → **"Agrupar em novo RO"**

#### `/obras/:obraId/ros/:roId` — RoDetalhePage (layout B)

**Header:** número do RO · título · badge de status · botão "Ver RO / PDF" (abre `GET /ros/:id/pdf` em nova aba)

**Layout B — sidebar + seções empilhadas:**

Sidebar esquerda (160px fixo):
- NCs agrupadas (lista com links)
- Responsável
- SLA (badge colorido: no_prazo / alerta / vencido)
- Criticidade máxima das NCs
- Ciclo atual (1º, 2º, 3º tratamento)
- Aprovação modo (Livre / Obrigatório / PBQP-H)

Área principal (seções empilhadas):
1. **NCs e itens** — por NC: lista de itens com status individual (ABERTO/APROVADO/REPROVADO) e botão "Revistar" por item
2. **Tratamento** — textarea ação corretiva, responsável, prazo de execução, upload fotos
3. **Análise de Causa (6M)** — 6 campos: Mão de Obra / Método / Máquina / Material / Meio Ambiente / Medição (obrigatório em modo PBQP-H)
4. **Revistorias** — histórico por item: data · engenheiro · resultado · observação · foto depois
5. **Histórico de ciclos** — ciclos anteriores de tratamento com resultado

**Ações no rodapé** (contextual por status e role):
- ABERTA → "Iniciar Tratamento"
- TRATAMENTO → "Submeter para Verificação"
- VERIFICACAO (aprovador) → "Aprovar" / "Reprovar"

### PDF do RO

`GET /api/v1/obras/:obraId/ros/:roId/pdf` retorna **HTML estilizado** (não força download).

Conteúdo do RO impresso:
- Cabeçalho: logo tenant · obra · número RO · data
- NCs agrupadas: número · serviço · módulo · criticidade
- Itens NC por NC: descrição · local · foto antes
- Tratamento: ação corretiva · responsável · prazo
- Análise 6M (se preenchida)
- Revistorias: por item · resultado · foto depois · data · engenheiro
- Histórico de ciclos (se houver reprovações)
- Assinatura: aprovado por · data de fechamento

O browser abre a página → usuário decide imprimir ou salvar como PDF (Ctrl+P).

---

## Integração com módulos de origem

### FVS
- `fvs_fichas` com itens NC → ao finalizar inspeção, sistema gera 1 NC por serviço com itens NC
- `nc_itens_nao_conformes.item_descricao` = snapshot do item do checklist
- `nao_conformidades.fvs_ficha_id` mantido para rastreabilidade
- Serviço FVS considera-se **conforme** quando todas as NCs do serviço estão com status FECHADA

### Concretagem
- NC gerada manualmente ou por gatilho (CP reprovado, slump fora, etc.)
- `nao_conformidades.caminhao_id` ou `cp_id` como referência de origem
- 1 item NC por problema identificado

### FVM
- NC gerada quando lote é reprovado nos ensaios
- `nao_conformidades.fvm_lote_id` como referência
- Items NC = ensaios reprovados

### Ensaios
- NC gerada quando ensaio laboratorial reprova
- `nao_conformidades.ensaio_id` como referência

---

## Arquivos a criar / modificar

### Backend

```
backend/prisma/migrations/20260415000010_nc_ro_flow/migration.sql
backend/src/ncs/ncs.service.ts                    (estender)
backend/src/ncs/ncs.controller.ts                 (estender)
backend/src/ncs/dto/create-nc.dto.ts              (estender)
backend/src/ncs/dto/update-nc.dto.ts              (estender)
backend/src/ncs/ros/ros.service.ts                (novo)
backend/src/ncs/ros/ros.controller.ts             (novo)
backend/src/ncs/ros/dto/create-ro.dto.ts          (novo)
backend/src/ncs/ros/dto/update-ro.dto.ts          (novo)
backend/src/ncs/ros/dto/add-ncs.dto.ts            (novo)
backend/src/ncs/revistorias/revistorias.service.ts (novo)
backend/src/ncs/revistorias/revistorias.controller.ts (novo)
backend/src/ncs/revistorias/dto/create-revistoria.dto.ts (novo)
backend/src/ncs/config/nc-config.service.ts       (novo)
backend/src/ncs/config/nc-config.controller.ts    (novo)
backend/src/ncs/pdf/ro-pdf.service.ts             (novo)
backend/src/ncs/ncs.module.ts                     (estender)
```

### Frontend

```
frontend-web/src/services/ncs.service.ts          (estender — RO, revistorias, config, PDF)
frontend-web/src/modules/ncs/hooks/useNcs.ts      (estender)
frontend-web/src/modules/ncs/hooks/useRos.ts      (novo)
frontend-web/src/modules/ncs/pages/NcsListPage.tsx (reescrever)
frontend-web/src/modules/ncs/pages/RoDetalhePage.tsx (novo)
frontend-web/src/modules/ncs/components/NcActionBar.tsx   (novo — barra contextual)
frontend-web/src/modules/ncs/components/RoFormModal.tsx   (novo — criar/agrupar RO)
frontend-web/src/modules/ncs/components/RevisitoriaModal.tsx (novo)
frontend-web/src/modules/ncs/components/SlaIndicator.tsx  (novo)
frontend-web/src/modules/ncs/components/Causa6mForm.tsx   (novo)
frontend-web/src/App.tsx                          (nova rota /ros/:roId)
```
