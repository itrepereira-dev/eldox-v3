# FVS Sprint 2 — Abertura e Execução de Inspeção

> **Status:** Aprovado pelo PO | Data: 2026-04-08
> **Sprint:** FVS-2 de 4
> **Depende de:** FVS Sprint 1 (Catálogo de Serviços) ✅

---

## Objetivo

Permitir que engenheiros abram uma **Ficha de Verificação de Serviço (FVS)** para uma obra, configurem os serviços e locais a inspecionar, e executem a inspeção via grade visual (serviços × locais) com drill-down por local.

---

## Contexto de Negócio

O módulo FVS opera em dois regimes configurados por obra:

| Regime | Descrição |
|---|---|
| `pbqph` | Segue estritamente o PBQP-H (SiAC) e ISO 9001 — regras rígidas de auditoria |
| `norma_tecnica` | Segue normas técnicas (NBR) sem os requisitos formais do SiAC |
| `livre` | Procedimento interno da empresa — regras flexíveis |

**Regra-chave:** o regime é definido na criação da ficha e determina o comportamento de toda a inspeção. Quando `pbqph`:
- Observação obrigatória em `nao_conforme`
- Foto obrigatória em item com `criticidade = 'critico'` e `status = 'nao_conforme'`
- Toda ação registrada em audit log imutável
- Catálogo de serviços usa os itens do sistema PBQP-H (tenant_id = 0)

---

## Arquitetura — Abordagem Adotada

**Ficha FVS da Obra (modelo-based):** o documento central é a `fvs_ficha`, que agrega múltiplos serviços para uma obra. Dentro da ficha, o engenheiro navega por uma grade **serviços × locais** (locais = unidades da obra: apartamentos, salas, áreas). Clicar em uma célula abre a ficha de verificação detalhada daquele local (lista de itens com status individual).

Esta abordagem foi escolhida por ser a mais aderente ao conceito real do PBQP-H (a "Ficha" é o documento auditado), suportar relatórios consolidados por serviço/obra, e ser flexível o suficiente para o modo livre.

---

## Modelo de Dados

### 5 tabelas novas

```sql
-- 1. Ficha FVS — documento principal auditável
CREATE TABLE fvs_fichas (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES obras(id),
  nome          VARCHAR(200) NOT NULL,
  regime        VARCHAR(20) NOT NULL DEFAULT 'livre',
                -- 'pbqph' | 'norma_tecnica' | 'livre'
  status        VARCHAR(20) NOT NULL DEFAULT 'rascunho',
                -- 'rascunho' | 'em_inspecao' | 'concluida'
  criado_por    INT NOT NULL REFERENCES usuarios(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP NULL,
  INDEX(tenant_id, obra_id),
  INDEX(tenant_id, status)
);

-- 2. Serviços vinculados à ficha
CREATE TABLE fvs_ficha_servicos (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  ficha_id      INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE CASCADE,
  servico_id    INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  itens_excluidos INT[] NULL,  -- IDs de itens desativados nesta ficha
  ordem         INT NOT NULL DEFAULT 0,
  UNIQUE(ficha_id, servico_id)
);

-- 3. Registros de inspeção — cada célula (item × local)
CREATE TABLE fvs_registros (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id),
  servico_id        INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  item_id           INT NOT NULL REFERENCES fvs_catalogo_itens(id),
  obra_local_id     INT NOT NULL REFERENCES obra_locais(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'nao_avaliado',
                    -- 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao'
  observacao        TEXT NULL,
  inspecionado_por  INT NULL REFERENCES usuarios(id),
  inspecionado_em   TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ficha_id, item_id, obra_local_id),
  INDEX(tenant_id, ficha_id, servico_id),
  INDEX(tenant_id, ficha_id, obra_local_id)
);

-- 4. Evidências fotográficas (fotos via GED)
CREATE TABLE fvs_evidencias (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  registro_id     INT NOT NULL REFERENCES fvs_registros(id) ON DELETE CASCADE,
  ged_versao_id   INT NOT NULL REFERENCES ged_versoes(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Audit log imutável (INSERT ONLY — obrigatório no regime pbqph)
CREATE TABLE fvs_audit_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  ficha_id    INT NOT NULL,
  registro_id INT NULL,
  acao        VARCHAR(30) NOT NULL,
              -- 'abertura' | 'inspecao' | 'alteracao' | 'conclusao'
  status_de   VARCHAR(20) NULL,
  status_para VARCHAR(20) NULL,
  usuario_id  INT NOT NULL,
  ip_origem   INET NULL,
  detalhes    JSONB NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX(tenant_id, ficha_id),
  INDEX(tenant_id, criado_em DESC)
);
```

### Regras de integridade
- `fvs_audit_log` recebe apenas INSERT. Sem UPDATE, sem DELETE, sem soft-delete.
- `fvs_registros.UNIQUE(ficha_id, item_id, obra_local_id)` garante um único registro por célula.
- Quando `regime = 'pbqph'`: toda escrita em `fvs_registros` dispara INSERT em `fvs_audit_log`.

---

## Fluxo de Navegação

```
Menu FVS
  └── Tela 1: Lista de Fichas (filtro por obra)
        └── [+ Nova Ficha] → Tela 2: Wizard de Abertura
              Passo 1: nome + obra + regime
              Passo 2: selecionar serviços + locais por serviço
        └── [Abrir Ficha] → Tela 3: Grade Principal
              Linhas = serviços da ficha
              Colunas = locais (apartamentos, salas...)
              Filtros: pavimento / serviço
              Célula = status agregado do serviço no local
                └── [Clique na célula] → Tela 4: Ficha de Verificação do Local
                      Cabeçalho: serviço + local + status geral
                      Lista de itens com status individual
                      Clique no item → selecionar status
                      NC → abre modal de observação + fotos
```

### Status agregado por célula (Tela 3)

| Condição | Status | Cor |
|---|---|---|
| Nenhum item avaliado | Não avaliado | Cinza `—` |
| Algum item avaliado, nenhum NC | Parcial | Azul `~` |
| Algum item NC, sem nenhum conforme total | NC | Vermelho `✗` |
| Todos os itens conformes ou exceção | Aprovado | Verde `✓` |
| Algum item pendente (itens sem avaliação + algum avaliado) | Pendente | Amarelo `!` |

---

## API REST

### Fichas

```
POST   /fvs/fichas
       Body: { obraId, nome, regime, servicoIds: number[] }
       Resposta 201: { id, nome, regime, status, obra }
       Permissão: ENGENHEIRO+

GET    /fvs/fichas?obraId=:id
       Resposta 200: [{ id, nome, regime, status, progresso: { total, avaliados, ncs } }]
       Permissão: VISITANTE+

GET    /fvs/fichas/:id
       Resposta 200: ficha completa com serviços e progresso por serviço
       Permissão: VISITANTE+

PATCH  /fvs/fichas/:id
       Body: { nome?, status? }
       Permissão: ENGENHEIRO+

DELETE /fvs/fichas/:id
       Regra: só permite se status = 'rascunho'
       Permissão: ADMIN_TENANT
```

### Serviços da ficha

```
POST   /fvs/fichas/:id/servicos
       Body: { servicoId, itensExcluidos?: number[] }
       Permissão: ENGENHEIRO+

DELETE /fvs/fichas/:fichaId/servicos/:servicoId
       Regra: só permite se ficha.status = 'rascunho'
       Permissão: ENGENHEIRO+
```

### Grade

```
GET    /fvs/fichas/:id/grade?pavimentoId=&servicoId=
       Resposta: matrix[servicoId][obraLocalId] = statusAgregado
       Permissão: VISITANTE+
```

### Registros (execução da inspeção)

```
GET    /fvs/fichas/:fichaId/registros?servicoId=:id&localId=:id
       Resposta: lista de itens do serviço com registro para aquele local
       Permissão: VISITANTE+

PUT    /fvs/fichas/:fichaId/registros
       Body: { servicoId, itemId, localId, status, observacao? }
       Validações modo-aware:
         - regime=pbqph + status=nao_conforme: observacao obrigatória
         - regime=pbqph + criticidade=critico + status=nao_conforme: exige evidência prévia
       Grava audit_log quando regime=pbqph
       Permissão: ENGENHEIRO+
```

### Evidências

```
POST   /fvs/registros/:id/evidencias
       Body: multipart/form-data { arquivo: File }
       Ação: cria versão no GED (categoria FTO) e vincula ao registro
       Permissão: ENGENHEIRO+

DELETE /fvs/evidencias/:id
       Permissão: ENGENHEIRO+
```

---

## UI Web — Componentes

### Tela 1 — Lista de Fichas (`FichasListPage`)
- Filtro por obra (dropdown)
- Tabela: nome · regime (badge) · obra · progresso (barra) · status · ações
- Botão `+ Nova Ficha` → abre wizard

### Tela 2 — Wizard de Abertura (`AbrirFichaWizard`)
- Passo 1: nome, obra (select), regime (PBQP-H / Norma Técnica / Livre)
- Passo 2: lista de serviços do catálogo com checkbox + seleção de locais por serviço
- Confirmação → `POST /fvs/fichas` → redireciona para a grade

### Tela 3 — Grade Principal (`FichaGradePage`)
- Filtros: pavimento (dropdown), serviço (dropdown)
- Tabela com scroll horizontal: linhas=serviços, colunas=locais
- Célula colorida (32×32px, borda-radius 6px) com ícone de status
- Clique na célula → navega para Tela 4
- Legenda fixa no rodapé

### Tela 4 — Ficha do Local (`FichaLocalPage`)
- Cabeçalho: serviço + local + status geral + botão voltar
- Tabela: nº · item · criticidade (badge) · status (select inline) · observação · fotos
- Clicar no status → dropdown (Conforme / Não Conforme / Exceção / Não Avaliado)
- Selecionar NC → abre `RegistroNcModal` (observação + upload de fotos)
- Progress bar do local no cabeçalho

### Modal NC (`RegistroNcModal`)
- Textarea de observação (obrigatória em PBQP-H)
- Upload de fotos (obrigatório para itens críticos em PBQP-H)
- Lista de fotos já anexadas com opção de remover

---

## Critérios de Aceite

1. `POST /fvs/fichas` cria ficha com status `rascunho` e vincula os serviços selecionados
2. `GET /fvs/fichas/:id/grade` retorna a matriz correta com status agregado por célula
3. `PUT /fvs/registros` com `regime=pbqph` e `status=nao_conforme` sem `observacao` retorna 422
4. `PUT /fvs/registros` com `regime=pbqph`, item `critico` e `status=nao_conforme` sem evidência retorna 422
5. Toda ação em regime `pbqph` gera linha em `fvs_audit_log`
6. Grade exibe corretamente as 5 cores de status
7. Drill-down em célula carrega os itens do serviço com registros existentes para aquele local
8. Foto enviada via `POST /evidencias` cria versão GED com categoria `FTO`
9. `DELETE /fvs/fichas/:id` retorna 409 se status ≠ `rascunho`

---

## Fora do Escopo deste Sprint

- Reinspeção e Parecer do Engenheiro → Sprint 3
- Envio para mobile e sincronização → Sprint 4
- Relatórios de auditoria exportáveis → Sprint 5
- Assinatura digital da ficha → Pós-MVP

---

## Dependências Técnicas

- `obra_locais` — tabela já existente no módulo de Obras
- `ged_versoes` — módulo GED já implementado (Sprint GED)
- `fvs_catalogo_servicos` + `fvs_catalogo_itens` — Sprint 1 ✅
- Padrão multi-tenant: `WHERE tenant_id IN (0, :tenantId)` para serviços do catálogo
- Raw SQL via `prisma.$queryRawUnsafe` (padrão estabelecido no Sprint 1)
