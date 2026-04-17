# Gestão de Usuários com Permissões — Design Spec

**Data:** 2026-04-16  
**Status:** Aprovado

---

## Visão Geral

Sistema completo de gestão de usuários com controle de acesso granular por módulo, acesso por obra e onboarding via convite por e-mail. O enforcement de permissões acontece no backend (NestJS guards), não apenas no frontend.

---

## Decisões de Design

| Decisão | Escolha |
|---|---|
| Escopo | CRUD + Role + Obras + Permissões granulares |
| Modelo de permissões | Perfil de acesso (template) + override individual por usuário |
| Módulos cobertos | Todos: concretagem, nc, ro, laudos, obras, usuarios, relatorios |
| Granularidade de ações | 4 níveis hierárquicos: VISUALIZAR, OPERAR, APROVAR, ADMINISTRAR |
| UX de configuração de perfil | Cards por módulo |
| Padrão de acesso a obras | Nenhuma por padrão — admin libera explicitamente |
| Enforcement | Backend: PermissaoGuard + ObraGuard |
| Onboarding | Convite por e-mail — admin informa só o e-mail, usuário define nome e senha |

---

## Modelo de Dados

### Tabelas novas

```sql
-- Perfis de acesso (templates reutilizáveis)
CREATE TABLE perfil_acesso (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Permissões por módulo de cada perfil
CREATE TABLE perfil_permissao (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_acesso_id UUID NOT NULL REFERENCES perfil_acesso(id) ON DELETE CASCADE,
  modulo           VARCHAR(50) NOT NULL,  -- concretagem|nc|ro|laudos|obras|usuarios|relatorios
  nivel            VARCHAR(20) NOT NULL,  -- VISUALIZAR|OPERAR|APROVAR|ADMINISTRAR
  UNIQUE (perfil_acesso_id, modulo)
);

-- Obras liberadas por usuário (sem registro = sem acesso)
CREATE TABLE usuario_obra (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  obra_id     UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, obra_id)
);

-- Overrides individuais de permissão (sobrepõem o perfil)
CREATE TABLE usuario_permissao_override (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  usuario_id        UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo            VARCHAR(50) NOT NULL,
  nivel             VARCHAR(20) NOT NULL,
  concedido         BOOLEAN NOT NULL,  -- true=grant, false=deny
  concedido_por_id  UUID NOT NULL REFERENCES usuarios(id),
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, modulo)
);
```

### Alterações na tabela `usuarios` (existente)

```sql
-- Novo campo: perfil de acesso (nullable — admins não precisam)
ALTER TABLE usuarios ADD COLUMN perfil_acesso_id UUID REFERENCES perfil_acesso(id);

-- Novo campo: status do usuário
ALTER TABLE usuarios ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ATIVO';
-- Valores: PENDENTE (convite enviado, cadastro não finalizado) | ATIVO | INATIVO

-- Novo campo: token de convite/reset (hash SHA-256, nullable)
ALTER TABLE usuarios ADD COLUMN token_hash VARCHAR(64);
ALTER TABLE usuarios ADD COLUMN token_exp  TIMESTAMP;
```

### Enums

```typescript
// Módulos com permissões granulares
enum Modulo {
  CONCRETAGEM = 'concretagem',
  NC          = 'nc',
  RO          = 'ro',
  LAUDOS      = 'laudos',
  OBRAS       = 'obras',
  USUARIOS    = 'usuarios',
  RELATORIOS  = 'relatorios',
}

// Níveis hierárquicos (valor numérico para comparação ≥)
enum NivelPermissao {
  VISUALIZAR   = 1,
  OPERAR       = 2,
  APROVAR      = 3,
  ADMINISTRAR  = 4,
}

// Status do usuário
enum StatusUsuario {
  PENDENTE = 'PENDENTE',  // convite enviado, aguardando finalização
  ATIVO    = 'ATIVO',
  INATIVO  = 'INATIVO',
}
```

### Resolução de permissões (ordem de prioridade)

1. **ADMIN_TENANT / SUPER_ADMIN** → passa sempre, sem verificação granular
2. **Override individual** (`usuario_permissao_override` para o módulo) → usa `concedido` (true/false)
3. **Perfil de acesso** (`perfil_permissao` para o módulo) → verifica se `nivel` ≥ `nivel_requerido`
4. **Sem nenhum** → NEGADO (403)

Nível é hierárquico: quem tem APROVAR também pode OPERAR e VISUALIZAR (comparação numérica ≥).

---

## Backend — NestJS

### Novos módulos

#### `UsuariosModule`
```
GET    /usuarios              → listar todos do tenant (admin)
POST   /usuarios              → criar usuário (só e-mail + role + perfil_acesso_id)
GET    /usuarios/:id          → detalhe (dados + obras + overrides)
PATCH  /usuarios/:id          → editar nome / email / role
PATCH  /usuarios/:id/ativo    → ativar ou desativar
PATCH  /usuarios/:id/perfil   → atribuir/trocar perfil de acesso
POST   /usuarios/:id/reenviar-convite  → reenvia e-mail de convite (status PENDENTE)
POST   /usuarios/:id/reset-senha       → admin dispara e-mail de reset para o usuário
```

#### `PerfisAcessoModule`
```
GET    /perfis-acesso          → listar perfis do tenant
POST   /perfis-acesso          → criar perfil
GET    /perfis-acesso/:id      → detalhe com permissões por módulo
PATCH  /perfis-acesso/:id      → editar nome / descricao
PUT    /perfis-acesso/:id/permissoes  → salvar matriz inteira de permissões
DELETE /perfis-acesso/:id      → desativar perfil (soft delete)
```

#### `UsuarioObrasModule`
```
GET    /usuarios/:id/obras          → obras liberadas para o usuário
POST   /usuarios/:id/obras          → { obraId } → liberar obra
DELETE /usuarios/:id/obras/:obraId  → revogar acesso à obra
```

#### `OverridesModule`
```
GET    /usuarios/:id/permissoes          → overrides individuais do usuário
PUT    /usuarios/:id/permissoes          → salvar lista de overrides
DELETE /usuarios/:id/permissoes/:modulo  → remover override de um módulo
```

#### Adições ao `AuthModule`
```
POST /auth/aceitar-convite   → { token, nome, senha } → finaliza cadastro (público)
POST /auth/esqueci-senha     → { email } → envia link de reset (público, rate-limited)
POST /auth/reset-senha       → { token, novaSenha } → redefine senha (público)
GET  /auth/me/permissoes     → mapa { modulo: nivel_resolvido | null } com overrides aplicados (autenticado)
```

### Guards

#### `PermissaoGuard` com decorator `@Requer(modulo, nivel)`
```typescript
// Uso nos controllers:
@Requer('concretagem', NivelPermissao.OPERAR)
@Post()
createConcretagem() { ... }

// Lógica do guard:
// 1. Extrai usuário do JWT
// 2. Se role === ADMIN_TENANT ou SUPER_ADMIN → permite
// 3. Consulta usuario_permissao_override WHERE usuario_id = ? AND modulo = ?
//    → se existe: usa concedido (true/false)
// 4. Consulta perfil_permissao via perfil do usuário WHERE modulo = ?
//    → se existe: compara nivel >= nivel_requerido
// 5. Sem resultado → 403
```

#### `ObraGuard`
```typescript
// Aplicado em rotas que recebem obraId como param
// ADMIN_TENANT → passa para todas as obras do tenant
// Outros → verifica usuario_obra WHERE usuario_id = ? AND obra_id = ?
// Sem registro → 403
```

### Serviço de e-mail

Novo `MailService` (pode usar Nodemailer ou AWS SES):
- `sendConvite(email, token)` — link: `{APP_URL}/aceitar-convite?token={token}` (exp: 72h)
- `sendResetSenha(email, token)` — link: `{APP_URL}/reset-senha?token={token}` (exp: 1h)

Token: gerado com `crypto.randomBytes(32)`, armazenado como `SHA-256(token)` no banco.

---

## Frontend — React

### Rotas públicas novas (sem auth)
```
/aceitar-convite   → página para finalizar cadastro (nome + senha)
/esqueci-senha     → solicitar reset de senha
/reset-senha       → definir nova senha com token da URL
```

### Rotas admin (requer ADMIN_TENANT ou SUPER_ADMIN)
```
/admin/usuarios               → lista de usuários
/admin/usuarios/novo          → formulário de criação (só e-mail + role + perfil)
/admin/usuarios/:id           → detalhe em abas
/admin/perfis-acesso          → lista de perfis
/admin/perfis-acesso/novo     → criar perfil
/admin/perfis-acesso/:id      → editor de permissões em cards
```

### Página `/admin/usuarios/:id` — abas

**Aba Dados:**
- Nome, e-mail, role, status (badge: PENDENTE / ATIVO / INATIVO)
- Perfil de acesso atribuído (com link para o perfil)
- Botões: Ativar/Desativar | Reenviar convite (se PENDENTE) | Enviar reset de senha

**Aba Obras:**
- Lista de obras liberadas com botão "Revogar"
- Botão "+ Adicionar obra" → modal com select de obras do tenant não atribuídas

**Aba Permissões:**
- Header: "Perfil base: [Nome do Perfil]" com link
- Tabela de overrides ativos (módulo, nível, grant/deny, quem concedeu, data)
- Botão "+ Adicionar override" → select módulo + nível + grant/deny
- Botão "Remover" por override

### Página `/admin/perfis-acesso/:id` — editor de cards

- Grid de 7 cards (um por módulo)
- Cada card: nome do módulo + 4 botões de nível (Visualizar / Operar / Aprovar / Administrar)
- Click no botão ativa/desativa o nível
- Comportamento hierárquico: ativar APROVAR ativa automaticamente OPERAR e VISUALIZAR
- Desativar OPERAR desativa automaticamente APROVAR e ADMINISTRAR
- Botão "Salvar" envia `PUT /perfis-acesso/:id/permissoes` com a matriz completa

### `AuthGuard` atualizado

Atualizar o guard existente para redirecionar `/admin/*` se role não for ADMIN_TENANT nem SUPER_ADMIN.

### Sidebar — item novo

Menu "Administração" visível apenas para ADMIN_TENANT e SUPER_ADMIN:
- Usuários → `/admin/usuarios`
- Perfis de Acesso → `/admin/perfis-acesso`

### Hook `usePermissao`

```typescript
// Consulta GET /me/permissoes no login e armazena no Zustand
// Uso nos componentes para mostrar/ocultar ações
const { pode } = usePermissao()
if (pode('concretagem', 'OPERAR')) { ... }
```

Novo endpoint `GET /auth/me/permissoes` → retorna mapa `{ modulo: nivel_resolvido | null }` com overrides já aplicados.

---

## Fluxos de Onboarding e Senha

### Convite (admin cria usuário)
1. Admin preenche e-mail + role + perfil → `POST /usuarios`
2. Backend cria usuário com `status: PENDENTE`, gera token (32 bytes), armazena `SHA-256(token)` + `token_exp = now + 72h`
3. Backend envia e-mail com link `/aceitar-convite?token={raw_token}`
4. Usuário abre link → `/aceitar-convite` → preenche nome + senha
5. Backend valida token (hash + exp), define nome + senha hash + `status: ATIVO`, invalida token

### Esqueci a senha (usuário)
1. Usuário acessa `/esqueci-senha` → informa e-mail
2. Backend: se e-mail existe e status ATIVO → gera token (exp: 1h), envia e-mail
3. Sempre retorna 200 (não revela se e-mail existe)
4. Usuário abre `/reset-senha?token=...` → informa nova senha
5. Backend valida token → atualiza senha hash → invalida token

### Reset pelo admin
1. Admin clica "Enviar reset de senha" na página do usuário
2. `POST /usuarios/:id/reset-senha` → gera token (exp: 1h), envia e-mail de reset
3. Fluxo igual ao "esqueci a senha" a partir do passo 4

---

## Segurança

- Tokens de convite e reset: `crypto.randomBytes(32)`, armazenados como `SHA-256` (nunca o raw token)
- Expiração: convite 72h, reset 1h
- Rate limit em `/auth/esqueci-senha`: máx 3 requisições por e-mail por hora
- ADMIN_TENANT só gerencia usuários do próprio `tenant_id`
- SUPER_ADMIN gerencia qualquer tenant (via parâmetro de rota)
- Usuários INATIVO não conseguem autenticar (verificar no login)
- Usuários PENDENTE não conseguem autenticar (verificar no login)

---

## O que NÃO está no escopo

- Autenticação por SSO / OAuth (Google, Microsoft)
- 2FA / MFA
- Permissões por obra + módulo combinadas (o acesso à obra é binário)
- Histórico de alterações de permissões (audit log de permissões — pode vir depois)
- Self-service de troca de e-mail pelo usuário
