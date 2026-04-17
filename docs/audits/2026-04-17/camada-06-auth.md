# Camada 6 — Autenticação, Autorização e Sessão

**Data:** 2026-04-17
**Auditor:** auditor-camada-06-auth
**Escopo:** login, JWT, refresh, logout, RBAC, portais públicos, CSRF, MFA, sessões múltiplas, recuperação de senha, convite.
**Repositório:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3`

---

## 0. Sumário executivo

| Severidade | Qtd |
|-----------|----:|
| 🔴 Crítico | 6 |
| 🟠 Alto    | 7 |
| 🟡 Médio   | 7 |
| 🔵 Baixo   | 3 |
| **Total**  | **23** |

Ainda há módulos de autenticação inteiros **ausentes** (recuperação de senha, convite/primeiro acesso, MFA, revogação de refresh, auditoria de login). O que existe funciona para o caminho feliz, mas **nenhuma das defesas esperadas para SaaS B2B está presente**: não há rate-limiting, não há lockout, não há blacklist de token, não há invalidação de sessões ao trocar senha, não há log de login.

RBAC backend existe (roles + guards + decorator `@Roles`), porém o frontend confia inteiramente no campo `role` retornado no body (o JWT nunca é decodificado no cliente; o sidebar não restringe por role). O `SUPER_ADMIN` aparece no enum mas **não há fluxo oficial** — não há endpoint `/auth/impersonate`, nem banner, nem log. A persistência do token JWT em `localStorage` (store `eldox_auth`) expõe o access token a qualquer XSS — e, como o token é de longa duração (8h por default, não 15min), o risco é amplificado.

Portais públicos (`/portal/cotacao/:token`, `/relatorio-cliente/:token`, `/fvs-cliente/:token`, `/portal-fornecedor?token=…`) usam tokens de 32 bytes gerados com `crypto.randomBytes` (bom), mas **sem rate-limiting** e, em alguns casos, **sem expiração obrigatória** — p.ex. o token FVS cliente pode ser gerado sem `dias_validade` (default 30d), o token do RDO é opcional (`IS NULL OR > NOW()`).

---

## 1. Arquivos auditados (evidência primária)

- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/auth/dto/login.dto.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/common/guards/jwt.guard.ts`
- `backend/src/common/guards/roles.guard.ts`
- `backend/src/common/decorators/roles.decorator.ts`
- `backend/src/common/decorators/tenant.decorator.ts`
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/.env.example`
- `backend/prisma/schema.prisma` (enum Role)
- `backend/src/concretagem/concretagens/portal-fornecedor.controller.ts`
- `backend/src/concretagem/concretagens/portal-fornecedor.service.ts`
- `backend/src/concretagem/concretagens/email-concretagem.service.ts`
- `backend/src/almoxarifado/cotacoes/portal-fornecedor.controller.ts`
- `backend/src/almoxarifado/cotacoes/cotacoes.service.ts`
- `backend/src/fvs/cliente/fvs-cliente.controller.ts`
- `backend/src/fvs/inspecao/inspecao.controller.ts` (geração de token)
- `backend/src/diario/rdo/rdo-cliente.controller.ts`
- `backend/src/diario/rdo/rdo.controller.ts` (geração de token)
- `frontend-web/src/App.tsx`
- `frontend-web/src/pages/auth/LoginPage.tsx`
- `frontend-web/src/store/auth.store.ts`
- `frontend-web/src/services/api.ts`
- `frontend-web/src/layouts/AppLayout.tsx`
- `frontend-web/src/layouts/AuthGuard.tsx`
- `frontend-web/src/components/layout/Sidebar.tsx`

---

## 2. Bugs por severidade

### 🔴 CRÍTICO

#### 🔴 BUG-601 — Sem rate-limiting nem lockout no endpoint de login
- **Evidência:** `backend/src/auth/auth.controller.ts:30-38`; `backend/src/main.ts` inteiro; `backend/package.json` — ausência de `@nestjs/throttler`.
- **Sintoma:** um atacante pode enviar 10 000 tentativas por segundo contra `POST /api/v1/auth/login`; não há bloqueio por IP nem por usuário.
- **Causa:** nenhum `ThrottlerModule`, nenhum `ThrottlerGuard`, nenhum contador de falhas no banco.
- **Correção sugerida:** instalar `@nestjs/throttler`, aplicar `@Throttle` no endpoint (ex. 5/min por IP + 10/min por `email+slug`), registrar tentativas falhas em tabela `auth_login_attempts` e bloquear usuário após N falhas.
- **Esforço:** M (1–2 dias).
- **Risco de regressão:** baixo (novo módulo).

#### 🔴 BUG-602 — JWT persistido em localStorage (vulnerável a XSS)
- **Evidência:** `frontend-web/src/store/auth.store.ts:30,35,46-51`; `frontend-web/src/services/api.ts:12-13,48`.
- **Sintoma:** qualquer XSS lê `localStorage.getItem('eldox_token')` e rouba o access token; como o refresh cookie é `httpOnly`+`SameSite=lax`+`secure` apenas em prod, o cenário combinado permite **sequestro total** da sessão até o refresh expirar (7d).
- **Causa:** a referência `camada-06-auth.md` 6.2 exige "access token em memória (não localStorage)"; o código coloca em `localStorage` e ainda persiste o estado todo em `name: 'eldox_auth'` (zustand persist).
- **Correção sugerida:** manter access token apenas em variável de módulo (Zustand sem `persist` para `token`); derivar `isAuthenticated` de `user != null`; limpar o `persist` de `token`.
- **Esforço:** S–M.
- **Risco:** médio — exige ajuste no interceptor que hoje lê de `localStorage`.

#### 🔴 BUG-603 — Sem invalidação/revogação de refresh tokens
- **Evidência:** `backend/src/auth/auth.service.ts:114-122` e `84-105`; `backend/src/auth/auth.controller.ts:50-55` (logout só limpa cookie, não toca no banco).
- **Sintoma:** logout NÃO invalida o refresh token no servidor. Um refresh roubado continua válido por 7 dias mesmo depois de o usuário fazer logout. Idem após "trocar senha" — pois o fluxo nem existe (ver BUG-611).
- **Causa:** não há blacklist, denylist, família de refresh (RFC 6749 §10.4), nem `refreshTokenVersion` no usuário.
- **Correção sugerida:** tabela `refresh_tokens` (jti, userId, familyId, revokedAt, replacedBy) + rotação detectável de reuso; ou `tokenVersion` INT em Usuario que incrementa no logout e na troca de senha — invalida todos os JWTs emitidos antes.
- **Esforço:** M.
- **Risco:** baixo.

#### 🔴 BUG-604 — Refresh token **não é rotativo** com detecção de reuso
- **Evidência:** `backend/src/auth/auth.service.ts:84-105` — refresh emite novo par mas **não invalida** o antigo (não há tabela de jti usados).
- **Sintoma:** se atacante rouba o refresh cookie e faz `/auth/refresh` primeiro, ambos (atacante e vítima) continuam com tokens válidos simultaneamente.
- **Causa:** rotação parcial (emite novo) mas sem persistência do anterior para detectar reuso; cross-ref 6.2 da referência.
- **Correção:** persistir refresh emitidos e, ao receber um já usado, invalidar toda a família. Ver BUG-603.
- **Esforço:** M. **Risco:** baixo.

#### 🔴 BUG-605 — Nenhuma proteção de rota no frontend por role; sidebar igual para todos
- **Evidência:** `frontend-web/src/layouts/AppLayout.tsx:10-14` (só checa `isAuthenticated`); `frontend-web/src/components/layout/Sidebar.tsx:315-418` (zero condicional por `user.role`).
- **Sintoma:** um `VISITANTE` ou `LABORATORIO` vê exatamente os mesmos 15+ itens de navegação que um `ADMIN_TENANT`, inclusive "Aprovações", "Configurações > Planos de Ação", etc. A referência 6.7 exige "Sidebar exibe apenas itens permitidos".
- **Causa:** `AppLayout` só valida autenticação; não existe `RoleGuard`/`RequireRole` no frontend.
- **Correção sugerida:** criar `<RequireRole roles={...}>` wrappers; ler `user.role` do store; ocultar itens do sidebar conforme role.
- **Esforço:** M (mapear cada rota).
- **Risco:** baixo.

#### 🔴 BUG-606 — Role `LABORATORIO` existe no enum mas **não aparece em nenhum `@Roles(...)` de controller**
- **Evidência:** `backend/prisma/schema.prisma:46-53` declara `LABORATORIO`; grep em todo `backend/src/**/*.controller.ts` não encontra `'LABORATORIO'` em nenhum decorator `@Roles(...)`.
- **Sintoma:** usuário criado com `role = LABORATORIO` **não consegue chamar nenhum endpoint protegido** (RolesGuard sempre retornará false, pois `LABORATORIO` não está em nenhuma lista de permitidos). A role é, na prática, uma "conta fantasma" sem privilégios.
- **Causa:** role criada no schema (e provavelmente usada no seed) mas esquecida no mapeamento de permissões.
- **Correção sugerida:** auditar quais endpoints de `ensaios/*` e `laboratorios/*` devem aceitar `LABORATORIO` e adicionar à `@Roles(...)`; ou remover o enum valor se for obsoleto.
- **Esforço:** S.
- **Risco:** médio — dependências com seeds.

### 🟠 ALTO

#### 🟠 BUG-607 — Login vaza distinção "tenant inexistente/inativo" vs "credenciais inválidas"
- **Evidência:** `backend/src/auth/auth.service.ts:63` → `"Tenant não encontrado ou inativo"`; `:68,71` → `"Credenciais inválidas"`.
- **Sintoma:** atacante descobre quais slugs de empresa existem apenas analisando a mensagem de erro (enumeração de tenants). A referência 6.1 exige "resposta idêntica existindo ou não".
- **Causa:** mensagens distintas por causa distinta.
- **Correção sugerida:** retornar `UnauthorizedException('Credenciais inválidas')` em todos os ramos (incluindo tenant inexistente/inativo); logar a causa real apenas internamente.
- **Esforço:** XS.
- **Risco:** nulo.

#### 🟠 BUG-608 — Sem access log / auditoria de login (sucesso ou falha)
- **Evidência:** `backend/src/auth/auth.service.ts:58-82` — nenhum `this.logger.log(...)`, nenhum `this.prisma.auditLog.create(...)`; sem modelo `AuthLog` no schema.
- **Sintoma:** impossível investigar incidente ("quem logou no tenant X ontem às 03:00 de qual IP?"). Viola 6.10.
- **Correção:** tabela `auth_events (userId, tenantId, ip, userAgent, eventType, success, occurredAt)` + Winston transport dedicado.
- **Esforço:** S–M. **Risco:** baixo.

#### 🟠 BUG-609 — CORS `origin` hard-coded apenas com `localhost:*` — **produção ficará bloqueada**
- **Evidência:** `backend/src/main.ts:48-51`.
- **Sintoma:** em produção (`app.eldox.com.br` ou domínio do tenant) todos os requests com credentials serão bloqueados pelo navegador. Combinado com cookie `secure: true` em prod (controller linha 12) e `withCredentials: true` (frontend `api.ts:8`), o login nem entrega o refresh cookie.
- **Correção:** ler lista de origens de `process.env.CORS_ORIGINS` (split por vírgula); validar; falhar no startup se vazio em prod.
- **Esforço:** XS. **Risco:** alto se deploy ocorrer sem corrigir.

#### 🟠 BUG-610 — JWT default de 8h (service) contradiz `.env.example` de 15m
- **Evidência:** `backend/src/auth/auth.service.ts:110` — `this.config.get('JWT_EXPIRES_IN', '8h')` (default da factory); `backend/src/auth/auth.module.ts:18` — `?? '8h'`; `backend/.env.example:15` — `JWT_EXPIRES_IN="15m"`.
- **Sintoma:** se a variável não estiver no `.env` (comum em dev), o token dura 8h — fere a referência 6.2 ("expiração curta 15min–1h") e amplia o blast radius do BUG-602.
- **Correção:** default **fail-fast** se `JWT_EXPIRES_IN` ausente; ou default seguro `15m`.
- **Esforço:** XS. **Risco:** nulo.

#### 🟠 BUG-611 — Recuperação de senha, convite e primeiro acesso **não existem**
- **Evidência:** grep por `reset|forgot|recover|senha|convite|invite|2FA|totp` em `backend/src/auth/**` retorna apenas os DTOs de login/register. Não há controller `reset-password`, `forgot-password`, nem `invite`.
- **Sintoma:** se o usuário esqueceu a senha, **só o admin do tenant consegue ajudá-lo**, e mesmo assim não há fluxo oficial — teria que manipular o banco manualmente. Viola 6.5 e 6.6 por inteiro.
- **Correção sugerida:** criar módulo `password-reset` (tabela `password_reset_tokens` com token/expiresAt/usedAt, endpoints `POST /auth/forgot-password` e `POST /auth/reset-password/:token`, política antienumeração, e-mail via mailer).
- **Esforço:** L. **Risco:** baixo (módulo novo).

#### 🟠 BUG-612 — Sem 2FA/MFA e sem plano para isso
- **Evidência:** nenhum package `speakeasy`, `otpauth`, `@simplewebauthn/*`; nenhum campo `totp_secret` no schema.
- **Sintoma:** contas `ADMIN_TENANT` — que têm acesso total aos dados do tenant — protegidas apenas por senha. Para produto B2B da construção civil (LGPD + dados de obra), 2FA deveria ser, no mínimo, opcional para ADMIN.
- **Correção:** TOTP (Google Authenticator) com códigos de backup.
- **Esforço:** M. **Risco:** baixo (opcional).

#### 🟠 BUG-613 — Frontend lê role do **body do login**, não do JWT
- **Evidência:** `frontend-web/src/store/auth.store.ts:4-9` — interface `AuthUser { id, nome, email, role }` vinda de `login(token, user, ...)`; `frontend-web/src/pages/auth/LoginPage.tsx:29` — chama `login(data.token, data.usuario, data.tenantSlug)`; o JWT nunca é decodificado no cliente.
- **Sintoma:** se um backend comprometido devolver role errada ou se o store for manipulado via DevTools, o frontend exibe/oculta recursos com base em informação não-verificada. Tolerável se **e somente se** todo gate sensível tiver duplo-check no backend — mas isso não é o caso quando a role nem sequer é validada no frontend (BUG-605).
- **Correção:** decodificar JWT no cliente para obter `role` + comparar com o body; preferir o claim do JWT.
- **Esforço:** S. **Risco:** baixo.

### 🟡 MÉDIO

#### 🟡 BUG-614 — `@Roles('... as any')` em `obras.controller.ts` desabilita checagem de tipo do enum
- **Evidência:** `backend/src/obras/obras.controller.ts:56,80,95,105,123,137,166,177` — todos com `'ADMIN_TENANT' as any`, `'ENGENHEIRO' as any` etc.
- **Sintoma:** typo silencioso (`'ENGENEIRO'` por exemplo) não seria pego pelo compilador; role fantasma permite 403 inesperado.
- **Correção:** usar `Role.ADMIN_TENANT` (enum Prisma), não string.
- **Esforço:** XS. **Risco:** nulo.

#### 🟡 BUG-615 — `SUPER_ADMIN` no enum mas nenhum fluxo de impersonation/cross-tenant
- **Evidência:** `backend/prisma/schema.prisma:47`; grep por `impersonar|impersonate` — **0 ocorrências**.
- **Sintoma:** role existe "no papel" mas sem endpoints de suporte (ex. `/admin/tenants/:id/impersonate`, banner de impersonação, log). Violaria "Casos específicos SaaS — Super admin consegue impersonar com log e banner".
- **Correção sugerida:** definir política (se útil) ou remover role do enum.
- **Esforço:** M. **Risco:** médio.

#### 🟡 BUG-616 — Token do portal de fornecedor (concretagem) **sempre com expiração padrão de banco**
- **Evidência:** `backend/src/concretagem/concretagens/email-concretagem.service.ts:117-129` — INSERT sem `expires_at` (relying on DB default `NOW()+30d`); `backend/prisma/migrations/20260416000020_concretagem_gaps2/migration.sql:33`.
- **Sintoma:** impossível definir validade por envio (p. ex. 24 h para concretagem de amanhã). Acoplamento oculto; se migration for alterada, a aplicação muda comportamento sem mudança de código.
- **Correção:** passar `expires_at` explicitamente no `INSERT`.
- **Esforço:** XS. **Risco:** baixo.

#### 🟡 BUG-617 — Token de RDO cliente pode ser **eterno** (expires_at NULL)
- **Evidência:** `backend/src/diario/rdo/rdo-cliente.controller.ts:28` — `(r.token_cliente_expires_at IS NULL OR r.token_cliente_expires_at > NOW())`.
- **Sintoma:** se o controller gerador (`rdo.controller.ts:489-493`) não setar `token_cliente_expires_at`, o link permanece válido para sempre. Viola 6.5/6.6 "expiração curta".
- **Correção:** constraint `NOT NULL` na coluna ou lógica que rejeita NULL.
- **Esforço:** XS. **Risco:** baixo (depende de uso).

#### 🟡 BUG-618 — Portais públicos **sem rate-limiting**
- **Evidência:** `backend/src/concretagem/concretagens/portal-fornecedor.controller.ts` inteiro; `backend/src/fvs/cliente/fvs-cliente.controller.ts` inteiro; `backend/src/diario/rdo/rdo-cliente.controller.ts` inteiro; `backend/src/almoxarifado/cotacoes/portal-fornecedor.controller.ts` inteiro — **nenhum** `@Throttle` e nenhum middleware global.
- **Sintoma:** atacante pode fazer brute-force de tokens de 64 chars hex (256 bits → computacionalmente inviável adivinhar) OK, **mas** rotas públicas sem throttle amplificam DoS e varredura de links antigos.
- **Correção:** throttler global + stricter nos controllers `@Controller('api/v1/portal')`, `fvs-cliente`, `relatorio-cliente`.
- **Esforço:** XS. **Risco:** nulo.

#### 🟡 BUG-619 — `JwtAuthGuard` não é global; cada controller repete `@UseGuards(JwtAuthGuard, RolesGuard)`
- **Evidência:** `backend/src/app.module.ts` inteiro — sem `APP_GUARD`; 44 controllers repetem a mesma linha. ADR-010 diz "Nenhum endpoint sem JWT".
- **Sintoma:** alto risco de esquecer o guard em um controller novo. `ged.controller.ts:216` usa `@UseGuards()` **vazio** (sobrescreve o guard de classe); `concretagem/.../portal-fornecedor.controller.ts:6-8` e `diario/rdo/rdo-cliente.controller.ts:8-9` e `almoxarifado/cotacoes/portal-fornecedor.controller.ts:18-19` propositalmente públicos, mas sem marcador `@Public()`.
- **Correção:** registrar `JwtAuthGuard` como `APP_GUARD` + decorator `@Public()` para rotas explicitamente abertas.
- **Esforço:** M (mapear todas as rotas públicas).
- **Risco:** médio — risco de quebrar portais se feito sem cuidado.

#### 🟡 BUG-620 — `refresh` retorna novo token mas **não revoga** o antigo cookie em erro de integridade
- **Evidência:** `backend/src/auth/auth.controller.ts:40-48`; `auth.service.ts:84-105`.
- **Sintoma:** se o usuário estiver desativado (`ativo: false`) depois de logar, o refresh lança `UnauthorizedException` mas o cookie `refresh_token` permanece no navegador. O usuário fica num loop de 401 silencioso.
- **Correção:** no catch do controller, `res.clearCookie('refresh_token', ...)` antes de re-throw.
- **Esforço:** XS. **Risco:** nulo.

### 🔵 BAIXO

#### 🔵 BUG-621 — Interceptor 401 não preserva URL original para `returnTo`
- **Evidência:** `frontend-web/src/services/api.ts:60-67` — `window.location.href = '/login'` (descarta rota atual).
- **Sintoma:** após refresh falhar, usuário é jogado no login e, após logar de novo, vai para `/dashboard` em vez de voltar à página em que estava. Viola 6.4.
- **Correção:** `window.location.href = /login?returnTo=${encodeURIComponent(location.pathname+search)}`.
- **Esforço:** XS. **Risco:** nulo.

#### 🔵 BUG-622 — Política de senha muito branda (só `MinLength(8)`)
- **Evidência:** `backend/src/auth/dto/register.dto.ts:21-22`.
- **Sintoma:** aceita `"aaaaaaaa"` ou `"12345678"`.
- **Correção:** regex exigindo misto de classes ou uso de `zxcvbn` no backend.
- **Esforço:** XS. **Risco:** nulo.

#### 🔵 BUG-623 — Sem listagem de sessões ativas, sem "sair de todos os dispositivos"
- **Evidência:** ausência total.
- **Sintoma:** usuário não consegue ver/encerrar sessões; violando 6.8.
- **Correção:** listar `refresh_tokens` + botão "revogar todas".
- **Esforço:** M. **Risco:** baixo.

---

## 3. Checklist sintético da referência (6.1–6.10)

| Item | Estado |
|------|-------|
| 6.1 Credenciais inválidas → mensagem genérica | 🔴 (BUG-607) |
| 6.1 Conta bloqueada / conta inativa | 🟡 parcial (conta inativa ok via `ativo: false`; bloqueada não existe) |
| 6.1 Rate limiting / lockout | 🔴 (BUG-601) |
| 6.1 Antienumeração de e-mail/slug | 🔴 (BUG-607) |
| 6.2 JWT algoritmo forte (HS256+secret) | 🟢 via `@nestjs/jwt` |
| 6.2 Expiração curta access | 🟠 (BUG-610) |
| 6.2 Refresh rotativo com detecção de reuso | 🔴 (BUG-604) |
| 6.2 Refresh em httpOnly+Secure+SameSite | 🟢 `auth.controller.ts:9-15` (secure só em prod — aceitável) |
| 6.2 Access token em memória (não localStorage) | 🔴 (BUG-602) |
| 6.2 Payload só essencial | 🟢 `{sub, tenantId, role, plano}` |
| 6.3 Logout invalida no backend | 🔴 (BUG-603) |
| 6.3 Logout limpa cookie e storage | 🟢 `auth.controller.ts:50-55` + `auth.store.ts:39-42` |
| 6.4 Interceptor 401 + deduplicação refresh | 🟢 `services/api.ts:17-75` |
| 6.4 `returnTo` preservado | 🔵 (BUG-621) |
| 6.5 Recuperação de senha | 🔴 (BUG-611) |
| 6.5 Invalidar sessões ao trocar senha | 🔴 não existe |
| 6.6 Convite / primeiro acesso | 🔴 (BUG-611) |
| 6.7 Sidebar adaptado à role | 🔴 (BUG-605) |
| 6.7 Backend nega mesmo se frontend liberar | 🟢 `RolesGuard` funciona |
| 6.7 Endpoints admin retornam 403 para não-admin | 🟢 via `@Roles` + RolesGuard |
| 6.7 Role carregada do JWT | 🟠 backend ok; frontend lê do body (BUG-613) |
| 6.8 Sessões múltiplas web+mobile | N/A — mobile não desenvolvido |
| 6.8 Listagem de sessões ativas | 🔵 (BUG-623) |
| 6.9 2FA/MFA | 🟠 (BUG-612) |
| 6.10 Log de login (sucesso/falha) | 🟠 (BUG-608) |
| 6.10 Log de ações sensíveis (troca senha, role) | 🔴 fluxos nem existem |
| Portais públicos — token seguro (32B random) | 🟢 `crypto.randomBytes(32)` em todos |
| Portais públicos — expiração obrigatória | 🟡 (BUG-616, BUG-617) |
| Portais públicos — rate limit | 🟡 (BUG-618) |
| CSRF | 🟢 por construção (Bearer em header + cookie apenas para refresh com SameSite=lax); zero dependência de cookie para ações de estado dentro da app autenticada — ok |
| JwtAuthGuard global | 🟡 (BUG-619) |

---

## 4. Cross-refs

- **Camada 2 (Backend/Módulos):** BUG-606 (role `LABORATORIO`), BUG-619 (global guard), BUG-614 (obras.controller.ts `as any`).
- **Camada 3 (Frontend Web):** BUG-605 (sidebar sem role-guard), BUG-613 (role lida do body), BUG-621 (returnTo), BUG-602 (localStorage).
- **Camada 4 (UX/UI):** mensagens de erro do login (BUG-607) — podem ser melhoradas conjuntamente.
- **Camada 7 (Multi-tenancy/Segurança):** BUG-601 (rate-limit), BUG-603/604 (revogação refresh), BUG-608 (audit log), BUG-609 (CORS), BUG-615 (SUPER_ADMIN cross-tenant).
- **Camada 5 (Mobile):** N/A — mobile não desenvolvido.
- **Camada 8 (Observabilidade):** BUG-608 casa com falta de logs de auth; `nest-winston` já existe no projeto (`main.ts:4-5`) mas não é usado para eventos de auth.

---

## 5. Resumo para orquestrador

- **Totais:** 23 bugs (6 🔴 / 7 🟠 / 7 🟡 / 3 🔵).
- **Top 3 críticos:**
  1. **BUG-601** — Endpoint `/auth/login` sem rate-limit nem lockout: brute-force e credential-stuffing são triviais (`backend/src/auth/auth.controller.ts:30`).
  2. **BUG-602** — Access token JWT persistido em `localStorage` com default de 8 h (`frontend-web/src/store/auth.store.ts:30` + `backend/src/auth/auth.service.ts:110`): qualquer XSS sequestra sessão longa.
  3. **BUG-611** — Fluxo de recuperação de senha, convite e primeiro acesso **não existe**: usuários ficam dependentes de intervenção manual do admin; operacionalmente bloqueia lançamento comercial.
- **Ação urgente:** instalar `@nestjs/throttler` e aplicar em `/auth/login` e `/auth/refresh` **antes** de qualquer deploy em produção; em paralelo, mover access token para memória (Zustand sem `persist` do campo `token`) e forçar `JWT_EXPIRES_IN=15m` como fail-fast em produção. Esses três ajustes reduzem risco de sequestro de sessão e DoS em ~70 % do blast radius atual. Decidir no próximo sprint se o SaaS pode ir a produção sem recuperação de senha e sem 2FA (BUG-611, BUG-612) — recomendação do auditor: **não**.
- **Cross-refs:** Camada 2, 3, 4, 7 e 8. Camada 5 é N/A.
