# FVS Sprint 1 — Catálogo de Serviços
**Data:** 2026-04-08  
**Status:** Aprovado pelo PO  
**Módulo:** FVS (Ficha de Verificação de Serviço)  
**Sprint:** FVS-1 de 3  
**Stack:** NestJS + PostgreSQL + React + Vite (Eldox v3)

---

## Contexto e Motivação

O módulo FVS é um pré-requisito para auditorias PBQP-H e ISO 9001. Antes de qualquer inspeção ser possível, o sistema precisa de um catálogo de serviços inspecionáveis com seus respectivos checklists de verificação.

O AutoDoc FVS — líder de mercado por 15 anos, descontinuado em 2025 — usava um catálogo pré-configurado de procedimentos operacionais (PO) PBQP-H. O Eldox v3 replica esse catálogo como seed de sistema (tenant_id=0) e permite que cada construtora expanda ou personalize.

**Dependência:** GED ✅ (concluído). Esta sprint não depende de Obras além das tabelas existentes.

---

## Escopo da Sprint FVS-1

**Inclui:**
- Schema de dados (3 tabelas) + migration com seed PBQP-H completo
- API REST completa (CRUD + clonar + importar CSV)
- UI web: tela de administração do catálogo (split layout)

**Não inclui (próximas sprints):**
- Configuração FVS por obra (modelos/templates) — Sprint FVS-2
- Grid matricial de inspeções — Sprint FVS-2
- Formulário de inspeção + NC — Sprint FVS-3
- App mobile — Sprint FVS-3

---

## Schema de Dados

### Tabela: `fvs_categorias_servico`

```sql
CREATE TABLE fvs_categorias_servico (
  id         SERIAL PRIMARY KEY,
  tenant_id  INT NOT NULL,
  nome       VARCHAR(100) NOT NULL,
  ordem      SMALLINT DEFAULT 0,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, nome)
);
CREATE INDEX idx_fvs_cat_tenant ON fvs_categorias_servico(tenant_id);
```

### Tabela: `fvs_catalogo_servicos`

```sql
CREATE TABLE fvs_catalogo_servicos (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  categoria_id     INT REFERENCES fvs_categorias_servico(id),
  codigo           VARCHAR(30),
  nome             VARCHAR(200) NOT NULL,
  norma_referencia VARCHAR(200),
  ordem            SMALLINT DEFAULT 0,
  ativo            BOOLEAN DEFAULT true,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMP NULL
);
CREATE INDEX idx_fvs_srv_tenant ON fvs_catalogo_servicos(tenant_id, ativo);
```

### Tabela: `fvs_catalogo_itens`

```sql
CREATE TABLE fvs_catalogo_itens (
  id              SERIAL PRIMARY KEY,
  tenant_id       INT NOT NULL,
  servico_id      INT NOT NULL REFERENCES fvs_catalogo_servicos(id) ON DELETE CASCADE,
  descricao       VARCHAR(300) NOT NULL,
  criterio_aceite TEXT,
  criticidade     VARCHAR(10) NOT NULL DEFAULT 'menor',
  foto_modo       VARCHAR(15) NOT NULL DEFAULT 'opcional',
  foto_minimo     SMALLINT DEFAULT 0,
  foto_maximo     SMALLINT DEFAULT 2,
  ordem           SMALLINT DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_criticidade CHECK (criticidade IN ('critico','maior','menor')),
  CONSTRAINT chk_foto_modo   CHECK (foto_modo IN ('nenhuma','opcional','obrigatoria'))
);
CREATE INDEX idx_fvs_item_servico ON fvs_catalogo_itens(servico_id, ativo);
```

### Regra de isolamento multi-tenant

Todas as queries usam `WHERE tenant_id IN (0, :tenantId)`:
- `tenant_id = 0` → catálogo do sistema (PBQP-H, imutável)
- `tenant_id = :tenantId` → catálogo próprio da construtora (editável)

### Seed automático na migration

A migration semeia automaticamente:
- **12 categorias PBQP-H** (Estrutura, Alvenaria, Revestimento, Acabamento, Instalações Elétricas, Instalações Hidráulicas, Impermeabilização, Cobertura, Esquadrias, Pintura, Combate a Incêndio, Infraestrutura)
- **8 serviços PO** com códigos (PO 19.20, PO 21.22×2, PO 23, PO 24, PO 25, PO 43, PO 44)
- **27 itens de verificação** distribuídos nos 8 serviços

Fonte dos dados: `FVS/knowledge_fvs_cadastro_servicos.md` — camada 2 (catalogo_servicos + catalogo_itens).

---

## API REST

Todos os endpoints exigem JWT (`JwtAuthGuard`). Prefixo `/api/v1/fvs`.

### Categorias

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/fvs/categorias` | VISITANTE+ | Lista todas (sistema + tenant) |
| POST | `/fvs/categorias` | ENGENHEIRO+ | Cria categoria do tenant |
| PATCH | `/fvs/categorias/:id` | ENGENHEIRO+ | Edita (só tenant_id > 0) |
| DELETE | `/fvs/categorias/:id` | ADMIN_TENANT | Soft-delete (só tenant_id > 0) |

### Serviços

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| GET | `/fvs/servicos` | VISITANTE+ | Lista (sistema + tenant, com itens) |
| GET | `/fvs/servicos/:id` | VISITANTE+ | Detalhe + itens do serviço |
| POST | `/fvs/servicos` | ENGENHEIRO+ | Cadastro manual |
| POST | `/fvs/servicos/:id/clonar` | ENGENHEIRO+ | Clona serviço sistema → tenant |
| POST | `/fvs/servicos/importar` | ADMIN_TENANT | Upload CSV/Excel (multipart) |
| PATCH | `/fvs/servicos/:id` | ENGENHEIRO+ | Edita (só tenant_id > 0) |
| DELETE | `/fvs/servicos/:id` | ADMIN_TENANT | Soft-delete (só tenant_id > 0) |

### Itens

| Método | Rota | Permissão | Descrição |
|--------|------|-----------|-----------|
| POST | `/fvs/servicos/:id/itens` | ENGENHEIRO+ | Adiciona item ao serviço |
| PATCH | `/fvs/itens/:id` | ENGENHEIRO+ | Edita item (só tenant_id > 0) |
| DELETE | `/fvs/itens/:id` | ADMIN_TENANT | Soft-delete (só tenant_id > 0) |
| PATCH | `/fvs/servicos/:id/itens/ordem` | ENGENHEIRO+ | Reordena itens (drag & drop) |
| PATCH | `/fvs/categorias/ordem` | ENGENHEIRO+ | Reordena categorias do tenant (drag & drop) |

### Regras de negócio nos endpoints

- `PATCH` / `DELETE` em registros com `tenant_id = 0` retorna `403 Forbidden` — guard valida antes de chegar ao service
- `POST /clonar`: cria cópia completa (serviço + todos os itens ativos) com `tenant_id = :tenantId`; o clone pode ser editado livremente
- `POST /importar`: aceita CSV com colunas `categoria,codigo,nome,norma,item_descricao,criticidade,foto_modo`; com query param `dry_run=true` retorna preview sem persistir; sem o param (ou `dry_run=false`) persiste os registros — o frontend chama o mesmo endpoint duas vezes: primeiro com `dry_run=true` (preview), depois sem para confirmar
- Reordenação: recebe array `[{ id, ordem }]` e faz UPDATE em lote dentro de transação

---

## UI Web — Tela de Administração do Catálogo

### Layout: Split (duas colunas)

```
┌─────────────────────────────────────────────────────────────┐
│ Catálogo de Serviços FVS          [↑ Importar CSV] [+ Novo] │
│ 27 itens · 8 serviços · 12 categorias                       │
│ ─────────────────────────────────────────────────────────── │
│ [🔍 Buscar...]  [Categoria ▾]  [Origem ▾]                   │
├──────────────────────┬──────────────────────────────────────┤
│ CATEGORIAS           │ ACABAMENTO — 3 serviços    [+ Serviço]│
│ ──────────────────── │ ──────────────────────────────────── │
│ ▶ Estrutura          │ PO 19.20 INSTALAÇÃO DE PORTAS        │
│ ▶ Alvenaria          │ [SISTEMA]                   [Clonar] │
│ ● Acabamento ←ativo  │   ① ABERTURA E FECHAMENTO REGULAR?   │
│ ▶ Inst. Elétricas    │   ② ALISAR INSTALADO E BEM FIXADO?   │
│ ▶ Inst. Hidráulicas  │   ③ ALISAR FACIANDO A PAREDE?        │
│ ▶ Impermeabiliz.     │   ④ GUARNIÇÕES INSTALADAS?           │
│ ▶ Cobertura          │ ──────────────────────────────────── │
│ ▶ Esquadrias         │ PO 21.22 PINTURA INTERNA  [SISTEMA]  │
│ ▶ Pintura            │ PO 21.22 PINTURA EXTERNA  [SISTEMA]  │
│ ──────────────────── │                                      │
│ + Nova Categoria     │                                      │
└──────────────────────┴──────────────────────────────────────┘
```

### Comportamentos

- **Coluna esquerda:** categorias ordenáveis por drag & drop; badge de contagem de serviços; botão "Nova Categoria" no rodapé
- **Coluna direita:** ao selecionar uma categoria, carrega serviços com itens inline; serviços SISTEMA têm badge azul `[SISTEMA]` e somente botão `[Clonar]`; serviços do tenant têm `[Editar]` e `[Excluir]`
- **Itens inline:** exibidos abaixo do serviço expandido; cada item mostra badge de criticidade colorido; serviços do tenant permitem adicionar/editar/reordenar itens
- **Busca global:** filtra categorias, serviços e itens em tempo real (debounce 300ms)
- **Filtro Origem:** Sistema / Personalizados / Todos

### Modais

**Modal: Novo Serviço / Editar Serviço**
- Campos: Categoria (select), Código PO (texto, ex: "PO 19.20"), Nome*, Norma de Referência
- Seção de itens: lista inline com + Adicionar Item; cada item tem: Descrição*, Critério de Aceite, Criticidade (select), Foto (select: nenhuma/opcional/obrigatória)
- Ações: Cancelar | Salvar

**Modal: Importar CSV**
- Botão "Baixar template" (CSV com cabeçalho de exemplo)
- Upload (aceita `.csv` e `.xlsx`)
- Preview: tabela com N primeiros registros + contador de erros
- Ações: Cancelar | Confirmar Importação (ativo somente se sem erros críticos)

---

## Estrutura de Arquivos

```
backend/src/fvs/
  fvs.module.ts
  catalogo/
    catalogo.controller.ts     ← endpoints /fvs/categorias, /fvs/servicos, /fvs/itens
    catalogo.service.ts
    dto/
      create-categoria.dto.ts
      create-servico.dto.ts
      create-item.dto.ts
      reorder-itens.dto.ts
      import-csv.dto.ts
  types/
    fvs.types.ts               ← Criticidade, FotoModo enums

backend/src/migrations/
  XXX_fvs_catalogo.sql         ← CREATE TABLEs + seed PBQP-H completo

frontend-web/src/modules/fvs/
  catalogo/
    CatalogoPage.tsx           ← tela principal (split layout)
    components/
      CategoriasList.tsx       ← coluna esquerda
      ServicosPanel.tsx        ← coluna direita
      ServicoCard.tsx          ← serviço com itens inline
      ServicoModal.tsx         ← modal criar/editar serviço + itens
      ImportarCsvModal.tsx     ← modal de importação
    hooks/
      useCatalogo.ts           ← React Query: categorias + serviços
    api/
      catalogo.api.ts          ← chamadas para /api/v1/fvs/*
```

---

## Critérios de Aceite

1. `GET /fvs/servicos` retorna os 8 serviços PBQP-H para qualquer tenant após seed
2. `PATCH` em serviço com `tenant_id=0` retorna 403
3. `POST /clonar` cria cópia com `tenant_id` do usuário e todos os itens do original
4. Import CSV com template preenchido cria serviços e itens corretamente
5. UI exibe badge `[SISTEMA]` em serviços PBQP-H e desabilita edição/exclusão
6. Busca filtra em tempo real por nome de serviço e descrição de item
7. Reordenação de itens por drag & drop persiste corretamente
