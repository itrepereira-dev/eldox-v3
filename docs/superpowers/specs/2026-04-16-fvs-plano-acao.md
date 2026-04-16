# Spec: FVS — Plano de Ação (PA) Configurável
Versão: 1.0
Status: Aprovada
Data: 2026-04-16

---

## Contexto

O Plano de Ação é a entidade que fecha o ciclo de qualidade do FVS: quando uma inspeção
reprova ou sinaliza desvio, um PA é aberto, atribuído, acompanhado e fechado com evidência.

No AutoDoc (referência), o PA é totalmente configurável: o tenant define os estágios do ciclo,
os campos obrigatórios por estágio, os papéis que podem transicionar, e os limiares que
disparam abertura automática. O Eldox deve replicar essa configurabilidade.

---

## Escopo desta spec

- Entidades de configuração: `pa_config_ciclo`, `pa_config_etapa`, `pa_config_campo`
- Entidade principal: `pa_plano_acao` + `pa_historico`
- Backend: CRUD + transições de estado + regra de abertura automática
- Frontend: página de PA dentro do módulo FVS + tela de configuração no Admin
- **Fora do escopo**: integração com FVM (PA de FVM é spec separada)

---

## Modelo de Dados

### Tabela `pa_config_ciclo`
```sql
CREATE TABLE pa_config_ciclo (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  modulo           VARCHAR(20) NOT NULL DEFAULT 'FVS', -- 'FVS' | 'FVM' | 'NC'
  nome             VARCHAR(100) NOT NULL,
  descricao        TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, modulo, nome)
);
```

### Tabela `pa_config_etapa`
```sql
CREATE TABLE pa_config_etapa (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  ciclo_id         INT NOT NULL REFERENCES pa_config_ciclo(id),
  nome             VARCHAR(100) NOT NULL,
  ordem            INT NOT NULL,
  cor              VARCHAR(7) NOT NULL DEFAULT '#6B7280',  -- hex
  is_inicial       BOOLEAN NOT NULL DEFAULT FALSE,
  is_final         BOOLEAN NOT NULL DEFAULT FALSE,
  prazo_dias       INT,                         -- SLA desta etapa (null = sem prazo)
  roles_transicao  TEXT[] NOT NULL DEFAULT '{}', -- roles que podem avançar
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabela `pa_config_campo`
Campos extras configuráveis por etapa (além dos campos base do PA):
```sql
CREATE TABLE pa_config_campo (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  etapa_id         INT NOT NULL REFERENCES pa_config_etapa(id),
  nome             VARCHAR(100) NOT NULL,
  chave            VARCHAR(50) NOT NULL,        -- snake_case, usado como key no JSON
  tipo             VARCHAR(20) NOT NULL,         -- 'texto' | 'numero' | 'data' | 'select' | 'usuario' | 'arquivo'
  opcoes           JSONB,                        -- para tipo 'select': ["opção1","opção2"]
  obrigatorio      BOOLEAN NOT NULL DEFAULT FALSE,
  ordem            INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabela `pa_config_gatilho`
Regra de abertura automática:
```sql
CREATE TABLE pa_config_gatilho (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  ciclo_id         INT NOT NULL REFERENCES pa_config_ciclo(id),
  modulo           VARCHAR(20) NOT NULL DEFAULT 'FVS',
  condicao         VARCHAR(30) NOT NULL,   -- 'TAXA_CONFORMIDADE_ABAIXO' | 'ITEM_CRITICO_NC' | 'NC_ABERTA'
  valor_limiar     NUMERIC,               -- para TAXA_CONFORMIDADE_ABAIXO: 0–100
  criticidade_min  VARCHAR(10),           -- para ITEM_CRITICO_NC: 'critico'|'major'|'minor'
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabela `pa_plano_acao`
```sql
CREATE TABLE pa_plano_acao (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  ciclo_id         INT NOT NULL REFERENCES pa_config_ciclo(id),
  etapa_atual_id   INT NOT NULL REFERENCES pa_config_etapa(id),
  modulo           VARCHAR(20) NOT NULL DEFAULT 'FVS',
  -- vínculo com a origem
  origem_tipo      VARCHAR(30),   -- 'INSPECAO_FVS' | 'NC_FVS' | 'MANUAL'
  origem_id        INT,           -- fk para fvs_inspecoes.id ou nao_conformidades.id
  obra_id          INT NOT NULL,
  -- campos base
  numero           VARCHAR(20) NOT NULL,  -- PA-2026-0001
  titulo           VARCHAR(200) NOT NULL,
  descricao        TEXT,
  prioridade       VARCHAR(10) NOT NULL DEFAULT 'MEDIA', -- 'BAIXA'|'MEDIA'|'ALTA'|'CRITICA'
  responsavel_id   INT,           -- fk usuarios
  prazo            DATE,
  -- campos extras (chave/valor configurados pelo ciclo)
  campos_extras    JSONB NOT NULL DEFAULT '{}',
  -- controle
  aberto_por       INT NOT NULL,
  fechado_em       TIMESTAMPTZ,
  fechado_por      INT,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, numero)
);
```

### Tabela `pa_historico`
```sql
CREATE TABLE pa_historico (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT NOT NULL,
  pa_id            INT NOT NULL REFERENCES pa_plano_acao(id),
  etapa_de_id      INT REFERENCES pa_config_etapa(id),
  etapa_para_id    INT NOT NULL REFERENCES pa_config_etapa(id),
  comentario       TEXT,
  campos_extras    JSONB NOT NULL DEFAULT '{}',  -- snapshot dos campos no momento
  criado_por       INT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Backend — Módulo NestJS: `PlanosAcaoModule`

### Estrutura de arquivos
```
backend/src/planos-acao/
├── planos-acao.module.ts
├── config/
│   ├── config.controller.ts    (CRUD ciclos, etapas, campos, gatilhos)
│   └── config.service.ts
├── pa/
│   ├── pa.controller.ts        (CRUD PAs + transições)
│   └── pa.service.ts
└── dto/
    ├── create-ciclo.dto.ts
    ├── create-etapa.dto.ts
    ├── create-pa.dto.ts
    └── transicao.dto.ts
```

### Endpoints de Configuração (`/api/v1/planos-acao/config`)

| Método | Rota | Descrição | Role |
|--------|------|-----------|------|
| GET | `/ciclos` | Listar ciclos (filtro: modulo) | ENGINEER+ |
| POST | `/ciclos` | Criar ciclo | ADMIN_TENANT |
| PATCH | `/ciclos/:id` | Editar ciclo | ADMIN_TENANT |
| DELETE | `/ciclos/:id` | Desativar ciclo | ADMIN_TENANT |
| GET | `/ciclos/:id/etapas` | Listar etapas de um ciclo | ENGINEER+ |
| POST | `/ciclos/:id/etapas` | Adicionar etapa | ADMIN_TENANT |
| PATCH | `/etapas/:id` | Editar etapa | ADMIN_TENANT |
| DELETE | `/etapas/:id` | Remover etapa | ADMIN_TENANT |
| POST | `/etapas/:id/campos` | Adicionar campo configurável | ADMIN_TENANT |
| PATCH | `/campos/:id` | Editar campo | ADMIN_TENANT |
| DELETE | `/campos/:id` | Remover campo | ADMIN_TENANT |
| GET | `/ciclos/:id/gatilhos` | Listar gatilhos | ADMIN_TENANT |
| POST | `/ciclos/:id/gatilhos` | Criar gatilho | ADMIN_TENANT |
| PATCH | `/gatilhos/:id` | Editar gatilho | ADMIN_TENANT |
| DELETE | `/gatilhos/:id` | Remover gatilho | ADMIN_TENANT |

### Endpoints de Planos de Ação (`/api/v1/planos-acao`)

| Método | Rota | Descrição | Role |
|--------|------|-----------|------|
| GET | `/` | Listar PAs (filtros: obra_id, etapa, prioridade, responsavel_id, modulo) | VISITOR+ |
| GET | `/:id` | Detalhes + histórico | VISITOR+ |
| POST | `/` | Criar PA manual | ENGINEER+ |
| PATCH | `/:id` | Editar campos base | ENGINEER+ |
| POST | `/:id/transicao` | Avançar/retroceder etapa | Conforme `roles_transicao` |
| DELETE | `/:id` | Soft delete | ADMIN_TENANT |

### Regra de Abertura Automática

O `pa.service.ts` exporta um método `avaliarGatilhos(tenantId, origemTipo, origemId)` chamado
pelo módulo FVS após concluir uma inspeção:

```typescript
async avaliarGatilhos(
  tenantId: number,
  origemTipo: 'INSPECAO_FVS' | 'NC_FVS',
  origemId: number,
  contexto: { taxaConformidade?: number; temItemCriticoNc?: boolean }
): Promise<void>
```

Lógica:
1. Busca gatilhos ativos para `tenant_id` e `modulo = 'FVS'`
2. Para cada gatilho:
   - `TAXA_CONFORMIDADE_ABAIXO`: abre PA se `contexto.taxaConformidade < gatilho.valor_limiar`
   - `ITEM_CRITICO_NC`: abre PA se `contexto.temItemCriticoNc === true`
3. Só abre PA se ainda não existe PA aberto para o mesmo `origem_tipo + origem_id`
4. Usa o ciclo ativo do gatilho, cria na etapa `is_inicial = true`
5. Gera número sequencial por tenant: `PA-{ANO}-{SEQ:0000}`

---

## Frontend

### Rota
```
/obras/:obraId/fvs/planos-acao          → PlanosAcaoPage (listagem)
/obras/:obraId/fvs/planos-acao/:paId    → PlanoAcaoDetalhe
/configuracoes/planos-acao              → ConfigPlanosAcaoPage (admin)
```

### PlanosAcaoPage
- Filtros: etapa, prioridade, responsável, data (URL-synced)
- Board view (Kanban por etapa) OU lista (toggle)
- Card mostra: número, título, obra, prioridade badge, responsável avatar, prazo (SLA badge)
- Botão "Novo PA" → modal com campos base + seleção de ciclo

### PlanoAcaoDetalhe
- Header: número, título, vínculo de origem (link clicável)
- Status pipeline horizontal (etapas do ciclo, etapa atual destacada)
- Campos extras da etapa atual (renderizados dinamicamente via `pa_config_campo`)
- Botão "Avançar" → modal de transição com campos obrigatórios da próxima etapa
- Timeline de histórico (quem, quando, de → para, comentário)

### ConfigPlanosAcaoPage (Admin)
- Tabs: Ciclos | Gatilhos
- Ciclos: lista + botão criar ciclo
  - Ao abrir ciclo: editor de etapas (drag-and-drop ordem) + campos por etapa
  - Cada etapa: nome, cor (color picker), prazo_dias, roles_transicao (multi-select)
  - Cada campo: nome, tipo, obrigatório
- Gatilhos: lista por ciclo, form de criação

### Sidebar (já existente)
Adicionar ao `ConcretagemNavGroup`... não. Ao NavSection "Qualidade":
```tsx
<NavItem
  to={`/obras/${obraAtivaId}/fvs/planos-acao`}
  icon={<ListChecks size={18} />}
  label="Planos de Ação"
  onClick={onNavClick}
/>
```

---

## Cenários GWT

**Cenário 1: PA aberto automaticamente após inspeção com taxa abaixo do limiar**
- Given: Ciclo FVS ativo com gatilho `TAXA_CONFORMIDADE_ABAIXO` limiar=80%, obra_id=5
- When: Engenheiro conclui inspeção com taxa de conformidade = 65%
- Then: PA criado automaticamente, número gerado, etapa inicial, vínculo `origem_tipo=INSPECAO_FVS`
  Notificação para responsável (se configurado)

**Cenário 2: Engenheiro avança PA para próxima etapa**
- Given: PA na etapa "Em Andamento", próxima etapa "Verificação" tem campo obrigatório "evidencia_acao"
- When: Engenheiro preenche campo + comentário e clica "Avançar"
- Then: PA move para "Verificação", histórico registrado com snapshot dos campos

**Cenário 3: Tentativa de transição por role não autorizado**
- Given: PA na etapa com `roles_transicao = ['ENGENHEIRO', 'ADMIN_TENANT']`, usuário TECNICO
- When: Técnico tenta avançar etapa
- Then: HTTP 403 — "Sem permissão para transicionar nesta etapa"

**Cenário 4: Administrador configura novo ciclo**
- Given: Admin acessa Configurações → Planos de Ação
- When: Cria ciclo "Ciclo Simplificado" com 3 etapas (Aberto → Em Resolução → Fechado)
- Then: Ciclo disponível na criação de PAs, etapas na ordem configurada

**Edge cases:**
- Gatilho dispara mas PA já existe para a mesma origem: não abre duplicado
- Etapa `is_final=true`: botão "Avançar" exibe "Encerrar PA" e seta `fechado_em`
- Campo tipo `usuario` renderiza como user-picker com busca
- Ciclo sem etapa `is_inicial`: API retorna 422 ao tentar criar PA com esse ciclo

---

## Checklist de Validação

- [x] Todos os campos têm tipo definido
- [x] Todos os erros HTTP têm código e mensagem
- [x] `tenant_id` presente em todas as tabelas
- [x] Fluxo de permissão definido por endpoint
- [x] Edge cases cobertos
- [x] Lógica de abertura automática especificada
- [x] Configurabilidade total: ciclo, etapas, campos, gatilhos, roles
- [x] Histórico de transições especificado
