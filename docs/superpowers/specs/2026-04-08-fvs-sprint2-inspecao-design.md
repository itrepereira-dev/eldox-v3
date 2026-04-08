# FVS Sprint 2 — Abertura e Execução de Inspeção

> **Status:** Aprovado pelo PO | Data: 2026-04-08
> **Sprint:** FVS-2 de 4
> **Depende de:** FVS Sprint 1 (Catálogo de Serviços) ✅

---

## Objetivo

Permitir que engenheiros abram uma **Ficha de Verificação de Serviço (FVS)** para uma obra, configurem os serviços e locais a inspecionar, e executem a inspeção via grade visual (serviços × locais) com drill-down por local.

---

## Contexto de Negócio

O módulo FVS opera em três regimes configurados na criação da ficha:

| Regime | Descrição |
|---|---|
| `pbqph` | Segue estritamente o PBQP-H (SiAC) e ISO 9001 — regras rígidas de auditoria |
| `norma_tecnica` | Segue normas técnicas (NBR) sem os requisitos formais do SiAC |
| `livre` | Procedimento interno da empresa — regras flexíveis |

**Regras quando `regime = 'pbqph'`:**
- `observacao` obrigatória em `nao_conforme`
- Foto obrigatória em item com `criticidade = 'critico'` e `status = 'nao_conforme'`
- Toda ação registrada em `fvs_audit_log` (imutável)
- Catálogo usa serviços do sistema PBQP-H (`tenant_id = 0`)

No regime `livre`, todas essas regras são opcionais e seguem o procedimento interno de cada empresa.

---

## Arquitetura — Abordagem Adotada

**Ficha FVS da Obra (modelo-based):** o documento central é `fvs_fichas`, que agrega múltiplos serviços para uma obra. O engenheiro navega por uma grade **serviços × locais**. Clicar numa célula abre a ficha detalhada do local (lista de itens com status individual).

Escolhida por ser aderente ao conceito do PBQP-H (a "Ficha" é o documento auditado), suportar relatórios consolidados e ser flexível para o modo livre.

---

## Modelo de Dados

### Convenção de nomenclatura

As tabelas existentes no projeto usam PascalCase com aspas duplas no SQL raw:
- `"Obra"`, `"ObraLocal"`, `"Usuario"`, `"GedVersao"`

As tabelas FVS usam snake_case (padrão estabelecido no Sprint 1):
- `fvs_catalogo_servicos`, `fvs_catalogo_itens`, etc.

Nas FKs abaixo, usar sempre o nome real da tabela referenciada.

### 6 tabelas novas

```sql
-- 1. Ficha FVS — documento principal auditável
CREATE TABLE fvs_fichas (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  obra_id       INT NOT NULL REFERENCES "Obra"(id),
  nome          VARCHAR(200) NOT NULL,
  regime        VARCHAR(20) NOT NULL DEFAULT 'livre',
                -- 'pbqph' | 'norma_tecnica' | 'livre'
  status        VARCHAR(20) NOT NULL DEFAULT 'rascunho',
                -- 'rascunho' | 'em_inspecao' | 'concluida'
  criado_por    INT NOT NULL REFERENCES "Usuario"(id),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMP NULL
);
CREATE INDEX idx_fvs_fichas_tenant_obra ON fvs_fichas(tenant_id, obra_id);
CREATE INDEX idx_fvs_fichas_tenant_status ON fvs_fichas(tenant_id, status);

-- 2. Serviços vinculados à ficha
CREATE TABLE fvs_ficha_servicos (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  ficha_id        INT NOT NULL REFERENCES fvs_fichas(id) ON DELETE CASCADE,
  servico_id      INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  itens_excluidos INT[] NULL,      -- IDs de fvs_catalogo_itens desativados nesta ficha
  ordem           INT NOT NULL DEFAULT 0,
  UNIQUE(ficha_id, servico_id)
);
CREATE INDEX idx_fvs_ficha_servicos_tenant ON fvs_ficha_servicos(tenant_id);

-- 3. Locais vinculados a cada serviço na ficha
--    (quais ObraLocais serão inspecionados por serviço)
CREATE TABLE fvs_ficha_servico_locais (
  id            SERIAL PRIMARY KEY,
  tenant_id     INT NOT NULL,
  ficha_servico_id INT NOT NULL REFERENCES fvs_ficha_servicos(id) ON DELETE CASCADE,
  obra_local_id INT NOT NULL REFERENCES "ObraLocal"(id),
  UNIQUE(ficha_servico_id, obra_local_id)
);
CREATE INDEX idx_fvs_ficha_servico_locais_tenant ON fvs_ficha_servico_locais(tenant_id);

-- 4. Registros de inspeção — cada célula (item × local)
CREATE TABLE fvs_registros (
  id                SERIAL PRIMARY KEY,
  tenant_id         INT NOT NULL,
  ficha_id          INT NOT NULL REFERENCES fvs_fichas(id),
  servico_id        INT NOT NULL REFERENCES fvs_catalogo_servicos(id),
  item_id           INT NOT NULL REFERENCES fvs_catalogo_itens(id),
  obra_local_id     INT NOT NULL REFERENCES "ObraLocal"(id),
  status            VARCHAR(20) NOT NULL DEFAULT 'nao_avaliado',
                    -- 'nao_avaliado' | 'conforme' | 'nao_conforme' | 'excecao'
  observacao        TEXT NULL,
  inspecionado_por  INT NULL REFERENCES "Usuario"(id),
  inspecionado_em   TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(ficha_id, item_id, obra_local_id)
);
CREATE INDEX idx_fvs_registros_tenant_ficha_servico ON fvs_registros(tenant_id, ficha_id, servico_id);
CREATE INDEX idx_fvs_registros_tenant_ficha_local ON fvs_registros(tenant_id, ficha_id, obra_local_id);

-- 5. Evidências fotográficas (fotos via GED)
CREATE TABLE fvs_evidencias (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  registro_id     INT NOT NULL REFERENCES fvs_registros(id) ON DELETE CASCADE,
  ged_versao_id   INT NOT NULL REFERENCES "GedVersao"(id),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_fvs_evidencias_tenant ON fvs_evidencias(tenant_id);
CREATE INDEX idx_fvs_evidencias_registro ON fvs_evidencias(registro_id);

-- 6. Audit log imutável (INSERT ONLY — sem FK para evitar CASCADE acidental)
--    Sem REFERENCES intencionalmente: log deve sobreviver a deleções de fichas/registros.
CREATE TABLE fvs_audit_log (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT NOT NULL,
  ficha_id    INT NOT NULL,    -- denormalizado, sem FK intencional
  registro_id INT NULL,        -- denormalizado, sem FK intencional
  acao        VARCHAR(30) NOT NULL,
              -- 'abertura_ficha' | 'inspecao' | 'alteracao_status' | 'conclusao_ficha'
              -- 'adicionar_servico' | 'remover_servico' | 'upload_evidencia' | 'remover_evidencia'
  status_de   VARCHAR(20) NULL,
  status_para VARCHAR(20) NULL,
  usuario_id  INT NOT NULL,
  ip_origem   INET NULL,
  detalhes    JSONB NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()   -- sem updated_at — nunca atualizado
);
CREATE INDEX idx_fvs_audit_log_tenant_ficha ON fvs_audit_log(tenant_id, ficha_id);
CREATE INDEX idx_fvs_audit_log_tenant_criado ON fvs_audit_log(tenant_id, criado_em DESC);
```

### Regras de integridade

- `fvs_audit_log` recebe apenas INSERT. Sem UPDATE, sem DELETE, sem soft-delete. Sem FK (intencional — log imutável não deve ser cascadeado).
- `fvs_registros.UNIQUE(ficha_id, item_id, obra_local_id)` garante uma célula por par item+local.
- `fvs_ficha_servico_locais` define o universo de locais de cada serviço — é o denominador do progresso.
- Quando `regime = 'pbqph'`: toda escrita em `fvs_registros`, toda mudança de status em `fvs_fichas`, todo upload/remoção de evidência dispara INSERT em `fvs_audit_log`.

### Eventos que disparam audit_log (regime pbqph)

| Evento | `acao` |
|---|---|
| Criação da ficha | `abertura_ficha` |
| Mudança de status da ficha | `alteracao_status` |
| Adição de serviço à ficha | `adicionar_servico` |
| Remoção de serviço da ficha | `remover_servico` |
| Gravação de registro (PUT /registros) | `inspecao` (novo) ou `alteracao_status` (mudança) |
| Upload de evidência | `upload_evidencia` |
| Remoção de evidência | `remover_evidencia` |
| Conclusão da ficha | `conclusao_ficha` |

---

## Fluxo de Navegação

```
Menu FVS
  └── Tela 1: Lista de Fichas
        Filtro: obra (dropdown) | paginação (20 por página)
        └── [+ Nova Ficha] → Tela 2: Wizard de Abertura
              Passo 1: nome + obra + regime
              Passo 2: selecionar serviços + locais por serviço
              Confirmar → POST /fvs/fichas (cria ficha + serviços + locais em 1 request)
        └── [Abrir] → Tela 3: Grade Principal
              Linhas = serviços da ficha
              Colunas = locais vinculados (da fvs_ficha_servico_locais)
              Filtros: pavimento / serviço
              Célula = status agregado do serviço no local
                └── [Clique na célula] → Tela 4: Ficha de Verificação do Local
                      Lista de itens do serviço com status individual
                      NC → RegistroNcModal (observação + fotos)
```

### Transições de status da ficha

```
rascunho ──[ENGENHEIRO iniciar]──→ em_inspecao
em_inspecao ──[ENGENHEIRO concluir]──→ concluida
concluida ──[ENGENHEIRO reabrir]──→ em_inspecao  (grava audit_log se pbqph)
```

**Regras:**
- `rascunho → em_inspecao`: permitido sempre por ENGENHEIRO+. Nenhum pré-requisito.
- `em_inspecao → concluida`: permitido por ENGENHEIRO+. Não exige 100% avaliado (empresa decide quando concluir).
- `concluida → em_inspecao`: permitido por ENGENHEIRO+. Gera `acao = 'alteracao_status'` em audit_log se pbqph.
- Serviços só podem ser adicionados/removidos quando status = `rascunho`.
- Registros de inspeção podem ser gravados apenas quando status = `em_inspecao`.

### Algoritmo do status agregado por célula (Tela 3)

Para cada par (servico_id, obra_local_id), avaliado na ordem de precedência:

```
1. Se qualquer item = 'nao_conforme'         → NC        (vermelho ✗)
2. Senão se todos os itens = 'conforme'
   ou 'excecao' (nenhum 'nao_avaliado')      → Aprovado  (verde ✓)
3. Senão se nenhum item avaliado
   (todos = 'nao_avaliado')                  → Não aval. (cinza —)
4. Senão (mix de avaliados e não avaliados,
   sem NC)                                   → Pendente  (amarelo !)
```

**Nota:** A combinação "azul / Parcial" foi removida — quatro estados são suficientes e não ambíguos.

---

## API REST

### Fichas

```
POST   /fvs/fichas
       Body: {
         obraId: number,
         nome: string,
         regime: 'pbqph' | 'norma_tecnica' | 'livre',
         servicos: Array<{
           servicoId: number,
           localIds: number[],        -- IDs de ObraLocal
           itensExcluidos?: number[]  -- IDs de fvs_catalogo_itens
         }>
       }
       Ação: cria fvs_fichas + fvs_ficha_servicos + fvs_ficha_servico_locais em transaction
       Grava audit_log 'abertura_ficha' se regime=pbqph
       Resposta 201: { id, nome, regime, status: 'rascunho' }
       Permissão: ENGENHEIRO+

GET    /fvs/fichas?obraId=:id&page=1&limit=20
       Resposta 200: { data: [{ id, nome, regime, status, progresso }], total, page }
       Permissão: VISITANTE+

GET    /fvs/fichas/:id
       Resposta 200: ficha completa com serviços, locais e progresso por serviço
       Permissão: VISITANTE+

PATCH  /fvs/fichas/:id
       Body: { nome?, status? }
       Transições válidas: rascunho→em_inspecao, em_inspecao→rascunho,
                          em_inspecao→concluida, concluida→em_inspecao
       Grava audit_log se regime=pbqph e status muda
       Permissão: ENGENHEIRO+

DELETE /fvs/fichas/:id
       Regra: retorna 409 se status ≠ 'rascunho'
       Permissão: ADMIN_TENANT
```

### Serviços da ficha

```
POST   /fvs/fichas/:id/servicos
       Body: { servicoId, localIds: number[], itensExcluidos?: number[] }
       Regra: retorna 409 se ficha.status ≠ 'rascunho'
       Permissão: ENGENHEIRO+

DELETE /fvs/fichas/:fichaId/servicos/:servicoId
       Regra: retorna 409 se ficha.status ≠ 'rascunho'
       Permissão: ENGENHEIRO+
```

### Grade

```
GET    /fvs/fichas/:id/grade?pavimentoId=&servicoId=
       Resposta: {
         servicos: [{ id, nome }],
         locais:   [{ id, nome, pavimentoId }],
         celulas:  { [servicoId]: { [obraLocalId]: 'nao_avaliado'|'nc'|'aprovado'|'pendente' } }
       }
       Algoritmo de agregação aplicado server-side (ver seção anterior)
       Permissão: VISITANTE+
```

### Registros (execução da inspeção)

```
GET    /fvs/fichas/:fichaId/registros?servicoId=:id&localId=:id
       Resposta: lista de itens do serviço com registro existente para o local
               (itens sem registro retornam com status='nao_avaliado')
       Permissão: VISITANTE+

PUT    /fvs/fichas/:fichaId/registros
       Body: { servicoId, itemId, localId, status, observacao? }
       Regra: retorna 409 se ficha.status ≠ 'em_inspecao'
       Validações modo-aware (regime=pbqph):
         - status=nao_conforme: observacao obrigatória → 422 se ausente
         - status=nao_conforme + criticidade=critico:
             NÃO bloqueia o PUT — permite salvar NC sem foto
             Frontend exibe aviso "foto obrigatória para este item"
             Validação de foto é feita na conclusão da ficha (PATCH status=concluida)
       Upsert via INSERT ... ON CONFLICT DO UPDATE
       Retorna 200 em atualização, 201 em criação
       Grava audit_log se regime=pbqph
       Permissão: ENGENHEIRO+
```

### Evidências

```
POST   /fvs/registros/:id/evidencias
       Body: multipart/form-data { arquivo: File }
       Ação: cria GedVersao (categoria 'FTO', status 'VIGENTE') e vincula ao registro
       Grava audit_log 'upload_evidencia' se regime=pbqph
       Permissão: ENGENHEIRO+

DELETE /fvs/evidencias/:id
       Regra: qualquer ENGENHEIRO+ pode remover (não apenas o criador)
       Regra: se for a última evidência de um registro NC crítico e regime=pbqph,
              grava audit_log 'remover_evidencia' mas NÃO bloqueia a remoção
              (validação de foto obrigatória é feita na conclusão da ficha)
       Grava audit_log 'remover_evidencia' se regime=pbqph
       Permissão: ENGENHEIRO+
```

---

## UI Web — Componentes

### Tela 1 — Lista de Fichas (`FichasListPage`)
- Filtro por obra (dropdown)
- Paginação: 20 registros por página
- Tabela: nome · regime (badge) · obra · progresso (barra) · status · ações
- Botão `+ Nova Ficha`

### Tela 2 — Wizard de Abertura (`AbrirFichaWizard`)
- Passo 1: nome, obra (select), regime
- Passo 2: lista de serviços do catálogo com checkbox; ao marcar um serviço, expande seleção de locais da obra (agrupados por pavimento) com multi-select
- Confirmar → `POST /fvs/fichas` com objeto aninhado → redireciona para Tela 3

### Tela 3 — Grade Principal (`FichaGradePage`)
- Filtros: pavimento (dropdown), serviço (dropdown)
- Tabela com scroll horizontal: linhas=serviços, colunas=locais da `fvs_ficha_servico_locais`
- Célula 32×32px, border-radius 6px, colorida conforme status agregado
- Clique na célula → navega para Tela 4 (`/fvs/fichas/:fichaId/inspecao?servicoId=&localId=`)
- Legenda fixa no rodapé: NC (vermelho) · Aprovado (verde) · Pendente (amarelo) · Não avaliado (cinza)
- Botão "Iniciar Inspeção" (muda status para `em_inspecao`) se status = `rascunho`
- Botão "Concluir Ficha" (muda status para `concluida`) se status = `em_inspecao`
  - Ao concluir com regime=pbqph: valida se há itens críticos NC sem evidência → exibe lista antes de confirmar

### Tela 4 — Ficha do Local (`FichaLocalPage`)
- Cabeçalho: serviço + local + status geral + botão voltar
- Tabela: nº · item · criticidade (badge) · status (select inline) · observação · fotos
- Clicar no status → dropdown (Conforme / Não Conforme / Exceção / Não Avaliado)
- Selecionar NC → abre `RegistroNcModal`
- Progress bar do local no cabeçalho

### Modal NC (`RegistroNcModal`)
- Textarea observação (obrigatória em PBQP-H — bloqueia salvar se vazio)
- Upload de fotos (exibido com aviso "obrigatório" se item crítico em PBQP-H, mas não bloqueia o modal)
- Lista de fotos já anexadas com opção de remover

---

## Critérios de Aceite

1. `POST /fvs/fichas` cria ficha (`rascunho`) + serviços + locais em uma transaction; retorna 201
2. `GET /fvs/fichas/:id/grade` retorna matriz com 4 status agregados corretamente calculados
3. `PATCH /fvs/fichas/:id` com `status='em_inspecao'` retorna 409 se atual ≠ `rascunho`
4. `PUT /registros` com `regime=pbqph`, `status=nao_conforme`, sem `observacao` → 422
5. `PUT /registros` com `regime=pbqph`, item `critico`, `status=nao_conforme`, sem evidência → salva normalmente (200/201); validação ocorre na conclusão
6. `PATCH /fvs/fichas/:id` com `status='concluida'` e `regime=pbqph` com itens críticos NC sem evidência → 422 listando os itens pendentes
7. Toda ação listada na tabela de eventos gera linha em `fvs_audit_log` quando `regime=pbqph`
8. `PUT /registros` com `ficha.status ≠ 'em_inspecao'` → 409
9. Grade exibe as 4 cores corretamente para cada estado
10. Foto enviada via `POST /evidencias` cria `GedVersao` com categoria `FTO`
11. `DELETE /fvs/fichas/:id` retorna 409 se status ≠ `rascunho`
12. `GET /fvs/fichas?obraId=&page=1` retorna paginado com `total` e `page`

---

## Fora do Escopo deste Sprint

- Reinspeção e Parecer do Engenheiro → Sprint 3
- Envio para mobile e sincronização → Sprint 4
- Relatórios de auditoria exportáveis → Sprint 5
- Assinatura digital da ficha → Pós-MVP

---

## Dependências Técnicas

- `"ObraLocal"` — módulo Obras ✅ (PascalCase, usar com aspas duplas no SQL raw)
- `"GedVersao"` — módulo GED ✅ (PascalCase)
- `"Obra"`, `"Usuario"` — tabelas base ✅
- `fvs_catalogo_servicos`, `fvs_catalogo_itens` — Sprint 1 ✅
- Padrão multi-tenant: `WHERE tenant_id IN (0, :tenantId)` para serviços do catálogo
- Raw SQL via `prisma.$queryRawUnsafe` / `prisma.$executeRawUnsafe` (padrão do projeto)
- Nomenclatura: novas tabelas FVS em snake_case; tabelas existentes em PascalCase com aspas duplas
