# Auditoria — Camada 4 (Frontend Web)

**Repositório:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web`
**Stack confirmada:** React 19.2 + Vite 8 + Tailwind 3.4 + React Query 5.96 + Zustand 5 + RHF 7.72 + Zod 4 + Axios 1.14 + TypeScript 5.9
**Auditor:** auditor-camada-04-frontend-web
**Data:** 2026-04-17
**Referência prévia (NÃO duplicada):** `docs/ui-audit-fase1.html` (foco: animações, hover lift, gradientes, stagger, focus ring, radius — **já tratado / em execução pelo `ui-upgrade-engine`**).

---

## 0. Escopo efetivamente auditado

| Item | Métrica |
|------|---------|
| Arquivos `.tsx` totais | 195 |
| Páginas (`pages/**`) | 75 |
| Módulos frontend | 12 |
| Rotas em `App.tsx` | ~65 (incl. públicas) |
| `useQuery` / `useMutation` observados | 413 |
| `invalidateQueries` / `queryKey` | 371 |
| Cores **hardcoded** `#xxxxxx` em `.tsx` | 460 ocorrências em 52 arquivos |
| `style={{ ... }}` inline em `.tsx` | 1396 ocorrências em 100 arquivos |
| `htmlFor` em labels | **3** (em toda a árvore) |
| `lazy()` em `App.tsx` | 67 rotas (praticamente todas) |
| `staleTime` customizado | 37 hooks |

---

## 1. Achados por severidade

> ℹ️ **Convenção:** 🔴 crítico, 🟠 alto, 🟡 médio, 🔵 baixo.
> Sempre que o bug já estiver coberto por `ui-audit-fase1.html`, marco
> como **"já tratado em ui-audit-fase1"** e não reconto.

---

### 🔴 CRÍTICO

---

#### 🔴 1. Duplo prefixo `/api/v1` em chamadas de catálogo/fornecedor — 404 garantido

**Evidência:**
- `src/modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage.tsx:52-54`
- `src/modules/almoxarifado/compras/pages/NovaOcPage.tsx:53-55`
- `src/modules/almoxarifado/compras/pages/NovaOcPage.tsx:77-79`

```ts
const data = await api.get<CatalogoItem[]>(
  `api/v1/fvm/catalogo?busca=${encodeURIComponent(v)}&limit=10`,
)
```

**Sintoma:** a instância `api` (em `services/api.ts:5`) já tem `baseURL =
http://localhost:3000/api/v1`. Adicionar `api/v1/fvm/...` como path resulta
em `GET /api/v1/api/v1/fvm/catalogo` → **404**. Busca de materiais/
fornecedores nas telas Nova Solicitação e Nova OC não retorna nada.

**Causa:** copiar template de outro service sem ajustar para a baseURL.

**Correção sugerida:** trocar para `'/fvm/catalogo?busca=...'` (com barra
inicial e sem duplicar `api/v1`).

**Esforço:** baixo (3 linhas).
**Risco de regressão:** nenhum — está quebrado hoje.
**Cross-ref:** [Camada 2 Backend] confirmar que `GET /fvm/catalogo` e
`/fvm/fornecedores` existem e aceitam `?busca`.

---

#### 🔴 2. Links de download absolutos para `/api/v1/...` no RDO ignoram backend separado

**Evidência:** `src/modules/diario/pages/RdoFormPage.tsx:1867` e `1886`

```tsx
<a href={`/api/v1/diario/rdos/${rdoId}/exportar-xls`} target="_blank" ...>
<a href={`/api/v1/diario/rdos/${rdoId}/pdf?fotos=true`} target="_blank" ...>
```

**Sintoma:** em dev (Vite em `:5173`, NestJS em `:3000`), esses `href`
batem em `http://localhost:5173/api/v1/...` e retornam 404. Só funciona
se o nginx `frontend-web/nginx.conf` reverse-proxy `/api/v1` para o
backend (o que é o caso em prod, via Coolify), mas **quebra em
desenvolvimento e em qualquer ambiente sem proxy**.

**Causa:** href hardcoded sem usar `VITE_API_URL`.

**Correção sugerida:** `href={\`${import.meta.env.VITE_API_URL}/diario/rdos/${rdoId}/...\`}`
ou extrair helper em `lib/apiBase.ts` (já existe).

**Esforço:** baixo.
**Risco de regressão:** baixo (melhora dev sem quebrar prod).

---

#### 🔴 3. Interceptor de refresh de auth não trata corpo de resposta padronizado e pode entrar em loop

**Evidência:** `src/services/api.ts:21-75`

Problemas encontrados:
1. **L47:** `const newToken = data.token` — o backend v3 responde com
   `{ data: { token: ... } }` em muitos endpoints (ver `obras.service.ts:98`
   que faz `data.data ?? data`). Se o `/auth/refresh` retornar envelopado,
   `newToken` será `undefined` e o retry tenta com `Authorization: Bearer
   undefined` → backend responde 401 de novo → entra loop até o catch final
   limpar o token.
2. **L26:** `if (err.response?.status === 401 && !original._retry)` — não
   exclui o próprio endpoint `/auth/refresh` da fila. Se `/auth/refresh`
   responde 401, o interceptor **tenta refresh do refresh**, cai no
   `isRefreshing=true`, empilha, e as novas respostas da fila nunca
   resolvem (porque o finally limpa `isRefreshing`, mas a segunda
   invocação nunca ocorre).
3. **L29-34:** a queue é disparada dentro de `new Promise` mas o callback
   nunca é invocado caso `logout` ocorra (queue é esvaziada mas as
   promises ficam penduradas sem resolve/reject).

**Sintoma:** Em cenário de token expirado + refresh também expirado
(cookie limpo), o usuário vê loading infinito em várias páginas porque
as queries ficam em "pending" enquanto a queue espera um token que nunca
chega. Em outros casos, requests subsequentes falham silenciosamente.

**Correção sugerida:** (a) excluir `/auth/refresh` do interceptor; (b)
ler `data.data?.token ?? data.token`; (c) no catch final, fazer
`queue.forEach(cb => cb(''))` ou rejeitar as promises pendentes.

**Esforço:** médio.
**Risco de regressão:** alto — função crítica.

---

### 🟠 ALTO

---

#### 🟠 4. 1396 ocorrências de `style={{ ... }}` inline — design system parcialmente "vazado"

**Evidência (amostra):**
- `pages/obras/CadastroObraWizard.tsx:254-398` — wizard inteiro em
  inline styles (`minHeight`, `background`, `padding`, `color`,
  `fontFamily` hardcoded).
- `modules/diario/pages/RdoFormPage.tsx:82-102` — Toast usa `position:
  fixed`, `boxShadow`, `background` inline.
- `modules/diario/pages/DiarioHomePage.tsx:50-172` — **página inteira** em
  inline styles.
- `modules/diario/pages/RdoWorkflowPage.tsx` — 73 ocorrências.
- `pages/obras/ObrasListPage.tsx` — 24 ocorrências.

**Sintoma:** fica impossível redesenhar via tokens sem caçar arquivo por
arquivo. O design system `Precision Ops Dark` existe em `styles/tokens.css`
mas ~⅓ das páginas bypassa os tokens usando inline style.

**Correção sugerida:** migrar progressivamente para Tailwind ou classes
compostas. Começar pelos offenders com >20 inline styles (RdoFormPage,
RdoWorkflowPage, DiarioHomePage, CadastroObraWizard, ObrasListPage).

**Esforço:** alto (backlog de refactor).
**Risco:** baixo — mudança puramente visual.
**Obs:** ui-audit-fase1 já propõe modernizar alguns componentes; este
achado **é complementar** (foco em páginas, não em componentes UI).

---

#### 🟠 5. Quase nenhum `<label htmlFor>` — acessibilidade severamente limitada

**Evidência:** apenas **3 arquivos** com `htmlFor`:
- `components/ui/Modal.tsx:60` (é para `aria-labelledby`, não label)
- `pages/ged/components/GedUploadModal.tsx`
- `modules/concretagem/concretagens/components/ConcrtagemFormModal.tsx`

**Sintoma:** em 195 `.tsx`, labels visuais existem mas **não associados
a inputs**. Leitor de tela não lê o label ao focar o input; usuário com
mouse não consegue clicar no label para focar. Afeta praticamente todos
os formulários (LoginPage, NcsListPage.NovaNCModal, FornecedorModal,
NovaSolicitacaoPage, NovaOcPage, CadastroObraWizard, etc.).

**Exemplo — `components/ui/Input.tsx:76-92`:** o wrapper `Field` não gera
`id` nem passa `htmlFor`, ou seja, não resolve o problema mesmo para
componentes que usam o primitive.

**Correção sugerida:** gerar `useId()` no `Field`, propagar via cloneElement
ou context, setar `htmlFor` e `id`. Em paralelo, sweep com codemod em
páginas com `<label>...</label><input>...`.

**Esforço:** médio.
**Risco:** zero (puramente aditivo).

---

#### 🟠 6. Cores hardcoded (#xxxxxx / Tailwind colors puros) em 52 arquivos

**Evidência (amostra crítica):**
- `pages/obras/ObrasListPage.tsx:22-56` — `STATUS_COLOR` e `BADGE_CLS`
  usam `#22c55e`, `#f59e0b`, `bg-green-500/20`, `bg-red-500/20`, etc.
- `modules/concretagem/croqui/components/CroquiEditorModal.tsx` — 50 cores
  hardcoded.
- `modules/concretagem/croqui/components/CroquiSvg.tsx` — 24.
- `modules/ncs/pages/NcsListPage.tsx:12-25` — badges de status usam
  `bg-red-50 text-red-700 border-red-200` (fundos claros em tema dark —
  contraste ruim).

**Sintoma:** light/dark toggle (existe `ThemeProvider`) não afeta essas
regiões. Badges de status de NC ficam com fundo pastel claro mesmo no
tema dark.

**Correção sugerida:** mapear para `var(--ok)`, `var(--warn)`, `var(--nc)`
dos tokens. **Relacionado (mas diferente) ao ui-audit-fase1 item #6** que
foca em focus ring — aqui o foco é cor de status.

**Esforço:** médio.
**Risco:** visual (benefícios óbvios).

---

#### 🟠 7. Formulário principal usa `useEffect` com dep object-path (regra exaustiva violada)

**Evidência:**
- `modules/fvs/inspecao/components/InspecaoModal.tsx:67-69`
- `modules/fvs/inspecao/pages/FichaLocalPage.tsx:55-57`

```tsx
useEffect(() => {
  setEquipe(registros[0]?.equipe_responsavel ?? '');
}, [registros[0]?.equipe_responsavel]);
```

**Sintoma:** deps contêm uma **expressão** de membro de array. ESLint
`react-hooks/exhaustive-deps` aceita (não detecta como missing), mas
toda re-renderização com um novo array `registros` (mesmo conteúdo) causa
identidade diferente no acesso, reexecutando o effect em cascata. Pode
gerar loop se o set sobrescreve um valor que o usuário acabou de digitar.

**Outro offender:** `FichaGradePage.tsx:132-136` tem
`// eslint-disable-next-line react-hooks/exhaustive-deps` escondendo o
problema (deps reais: `locaisFiltrados, filtroStatus, servicosFiltrados, grade`).

**Correção sugerida:** armazenar valor em variável derivada + `useMemo`
ou comparar manualmente antes de `setEquipe`.

**Esforço:** baixo.
**Risco:** baixo.

---

#### 🟠 8. Uso de `key={i}` (index) em listas rerenderizáveis

**Evidência (32 ocorrências; destaques):**
- `pages/obras/CadastroObraWizard.tsx:509, 695` — chave do step indicator.
- `pages/obras/EditarObraModal.tsx:354` — chave em niveis editáveis.
- `modules/diario/pages/RdosListPage.tsx:55` — chave em linhas da tabela
  (renderizando skeleton).
- `modules/diario/pages/RdoWorkflowPage.tsx:464` — `key={idx}` em lista
  de decisões do workflow.
- `modules/almoxarifado/*/pages/*.tsx` — 8 tabelas usam `key={i}`.

**Sintoma:** para skeletons tudo bem (são estáticos). Mas `RdoWorkflowPage`
renderiza **decisões reais** com `key={idx}` — ao apagar uma decisão do
meio, o React vai fazer diff incorreto e pode preservar estado interno no
item errado (ex: textarea digitada) ou piscar animações.

**Correção sugerida:** usar `key={decisao.id}` quando possível; para
skeletons, manter índice está ok.

**Esforço:** baixo.
**Risco:** baixo-médio.

---

#### 🟠 9. Tela de NCs global e por obra silencia erros

**Evidência:** `modules/ncs/pages/NcsListPage.tsx:184-190`

```tsx
if (isLoading) {
  return <div>Carregando...</div>;
}
// ...
{ncs.length === 0 ? <div>Nenhuma NC encontrada. Crie a primeira!</div> : ...}
```

**Sintoma:** se a API retorna 500 ou `isError`, a página renderiza o
empty state como se não houvesse NCs. Usuário acredita que não há
registros e cadastra duplicata. **Padrão replicado em várias páginas**
(checagem: apenas 8 arquivos de páginas usam `isError` — GED faz certo).

**Correção sugerida:** adicionar branch de `isError` com retry.
Padrão a seguir já existe em `pages/ged/GedListaMestraPage.tsx:39`.

**Esforço:** baixo.
**Risco:** baixo.

---

#### 🟠 10. `window.confirm` / `window.alert` em 19 locais — UX inconsistente com tema dark

**Evidência (amostra):**
- `modules/fvs/inspecao/pages/FichasListPage.tsx:121` (`confirm`)
- `modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx:43,90,230,366`
- `modules/ensaios/laboratoriais/components/EnsaioModal.tsx:274`
  (`window.alert('Ensaio registrado...')`)
- `modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx:52` (`alert`)
- `modules/concretagem/croqui/pages/CroquiRastreabilidadePage.tsx:214`
- `modules/ncs/pages/NcsListPage.tsx:327`
- `modules/diario/pages/RdoFormPage.tsx:1836`
- 11 outros.

**Sintoma:** diálogos nativos não respeitam dark/light theme, não são
traduzíveis, bloqueiam main thread e quebram a estética `Precision Ops`.

**Correção sugerida:** usar o `Modal.tsx` (já existe) para confirm e o
`ToastProvider` (já existe) para alert de sucesso.

**Esforço:** médio (19 pontos).
**Risco:** baixo.

---

### 🟡 MÉDIO

---

#### 🟡 11. Máscaras pt-BR implementadas parcialmente e inconsistentes

**Evidência:**
- `modules/fvm/fornecedores/components/FornecedorModal.tsx:11-22` — tem
  `formatCnpj` **local** (não compartilhado).
- `pages/obras/CadastroObraWizard.tsx:384-391` — CEP usa `maxLength={9}`
  mas **sem máscara de hífen**.
- `modules/fvm/fornecedores/components/FornecedorModal.tsx:222-228` —
  telefone aceita texto livre (placeholder `(11) 99999-9999` mas sem
  máscara).
- Nenhuma implementação de CPF, nem de telefone formatado em todo o app.

**Sintoma:** usuário digita `00000000` e sistema salva sem hífen; outro
usuário digita `00000-000`, e a busca por CEP não bate. Mesmo problema
para CNPJ salvo com/sem pontuação.

**Correção sugerida:** centralizar em `lib/masks.ts` (`formatCpf`,
`formatCnpj`, `formatCep`, `formatTelefone`) e criar primitive
`<MaskedInput>` em `components/ui`. Strip masks antes de submit.

**Esforço:** médio.
**Risco:** baixo.

---

#### 🟡 12. setTimeout em debounce sem cleanup no unmount

**Evidência:**
- `modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage.tsx:38,49`
- `modules/almoxarifado/compras/pages/NovaOcPage.tsx:38-39, 50, 74`

```tsx
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
// ...
function handleQueryChange(v: string) {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  // ...
  debounceRef.current = setTimeout(async () => { ... }, 300)
}
// ❌ nenhum useEffect(() => () => clearTimeout(debounceRef.current), [])
```

**Sintoma:** se o usuário navegar enquanto o timeout está pendente, a
callback dispara em componente desmontado → `setState` em unmounted →
warning `Can't perform a React state update on an unmounted component`.

**Correção sugerida:** adicionar `useEffect(() => () => { if
(debounceRef.current) clearTimeout(debounceRef.current) }, [])`.

**Esforço:** baixo.
**Risco:** nenhum.

---

#### 🟡 13. AgenteFloat — setTimeout sem cleanup para foco

**Evidência:** `components/agente/AgenteFloat.tsx:54`

```tsx
useEffect(() => {
  if (aberto) setTimeout(() => inputRef.current?.focus(), 150)
}, [aberto])
```

**Sintoma:** se usuário fecha o agente antes dos 150ms, tenta focar um
input já desmontado/escondido — ok (optional chain protege), mas timer
continua vivo. Múltiplas aberturas rápidas criam timers concorrentes.

**Correção sugerida:** guardar o timeout e limpar no cleanup da effect.

**Esforço:** baixo.

---

#### 🟡 14. Notificações do Topbar, iniciais "IP" hardcoded

**Evidência:**
- `components/layout/Topbar.tsx:127` — `const count = 3` (mock).
- `components/layout/Topbar.tsx:253-254` — `>IP<` (iniciais hardcoded
  do usuário atual, copiando padrão de desenvolvimento do auditor).

**Sintoma:** badge mostra "3 notificações" mesmo sem nenhuma fila real.
Iniciais "IP" aparecem para todos os usuários.

**Correção sugerida:** conectar ao `useAuthStore` e a um endpoint de
notificações (existe `/api/v1/notificacoes` no backend? [Cross-ref Camada
2]).

**Esforço:** médio.
**Risco:** baixo.

---

#### 🟡 15. `useResolvedObraId` dispara fetch "obras-sidebar-fallback" no primeiro load de cada usuário

**Evidência:** `components/layout/Sidebar.tsx:39-65`

**Sintoma:** se o usuário acabou de fazer login e nenhum `obraAtivaId`
está salvo no `localStorage`, a sidebar busca `GET /obras?limit=1`,
escolhe a primeira e persiste. Em tenant com **zero obras**, o fetch
sempre retorna vazio e **os links contextuais do sidebar** (FVM, Efetivo,
Almoxarifado, Concretagem, Ensaios, Planos de Ação) **apontam todos para
`/obras`** — ou seja, 6 dos 12 itens principais do sidebar viram "link
morto". Isso bate 1:1 com o sintoma do usuário: **"sidebar quebrado"**.
Cross-ref com o `_context.md §4` que já registra este risco.

**Correção sugerida:** quando não houver obra, esses links precisam:
(a) desabilitar visualmente (opacity + pointer-events-none) e
(b) mostrar tooltip "Cadastre uma obra primeiro" em vez de fingir que
funcionam.

**Esforço:** médio.
**Risco:** baixo.
**Cross-ref:** [Camada 1 Arquitetura/UX], [Camada 2 Backend].

---

#### 🟡 16. `light` theme existe mas contém fundos pastel que quebram contraste AA

**Evidência:**
- `styles/tokens.css:122-193` — light theme definido corretamente.
- **Porém** `modules/ncs/pages/NcsListPage.tsx:13-25` usa
  `bg-red-50 text-red-700` (válido no light) e `bg-[var(--ok-bg)]` no
  dark, portando um tenta usar tokens e outro não → resultado
  inconsistente entre temas.
- `components/ui/Modal.tsx` não tem `animate-in` explícito (usa regra
  genérica em `App.css:119` que seleciona `.fixed.inset-0.z-50`).

**Sintoma:** tema light acessível no tokens.css, mas 50+ ocorrências de
cor Tailwind pura (`bg-red-500/20 text-red-400`, `bg-green-500/20
text-green-400`) que **ignoram `[data-theme]`** e produzem contraste AA
inadequado em pelo menos um dos temas.

**Correção sugerida:** sweep para substituir por tokens semânticos.

**Esforço:** médio-alto.
**Risco:** visual.

---

#### 🟡 17. Modals sem focus-trap nem retorno de foco ao fechar

**Evidência:** `components/ui/Modal.tsx` e todos os modais inline
(FornecedorModal, InspecaoModal, EvidenciaPreviewModal, NovaNCModal,
ParecerModal, RegistroNcModal, TipoEnsaioModal, RevisaoModal, etc.).

**Sintoma:** usuário com teclado consegue "escapar" do modal via Tab (o
foco vai para elementos por baixo do overlay). Quando fecha via Esc, o
foco **não volta** para o botão que abriu o modal.

**Correção sugerida:** criar hook `useFocusTrap(dialogRef)` com
`focus-trap-react` (ou implementação própria). Padrão já em uso em
`Modal.tsx` via `role="dialog" aria-modal="true"`, falta só a lógica de
trap.

**Esforço:** médio.
**Risco:** baixo.

---

#### 🟡 18. React Query — inconsistência de `staleTime` e falta de `gcTime` por query

**Evidência:**
- `App.tsx:84-89` — defaults `staleTime: 60_000`, `gcTime: 300_000`.
- `modules/almoxarifado/estoque/hooks/useEstoque.ts:104` — `staleTime:
  5 * 60_000` (5 min para estoque!)
- `modules/fvm/grade/hooks/useGradeFvm.ts:116` — `staleTime: 300_000` em
  "templates".
- `modules/fvm/grade/hooks/useGradeFvm.ts:125,134` — `staleTime: 10_000`
  (10s) para grade e lote — agressivo demais, faz refetch constante.

**Sintoma:** estoque com staleTime de 5min em módulo operacional onde
números mudam a cada solicitação aprovada → usuário vê saldo desatualizado.
Grade com 10s → spinner aparece toda hora. Não há política definida.

**Correção sugerida:** documentar política em `AGENTS.md` (ex: "30s para
listagens ativas, 2min para dashboards, 5min+ só para catálogos
estáticos"). Revisar hooks e alinhar.

**Esforço:** médio.
**Risco:** baixo.

---

#### 🟡 19. `AgenteFloat` não é "lazy" e é instanciado em todo AppShell

**Evidência:** `components/layout/AppShell.tsx:18` + `:127`

**Sintoma:** importação estática. O chat IA + ícone + CSS estão no
bundle inicial do AppLayout (tudo depois do login). Não é crítico mas
some ~15KB no main chunk.

**Correção sugerida:** envolver em `lazy()` + `Suspense fallback={null}`;
só carrega ao clicar no botão flutuante pela 1ª vez.

**Esforço:** baixo.
**Risco:** nenhum.

---

#### 🟡 20. `DashboardPage` — Suspense genérico fallback "Carregando…" para 75 páginas

**Evidência:** `App.tsx:93-99`

**Sintoma:** fallback único de texto centralizado para **toda** rota
lazy. Usuário não vê skeleton — percebe como "tela branca/loading"
entre navegações. `ui-audit-fase1` trata da transição de página
(fadeSlideIn), mas o problema aqui é o conteúdo do fallback (texto vs
skeleton).

**Correção sugerida:** trocar `<PageSkeleton />` por `<SkeletonKpiGrid />`
ou skeleton contextual por rota (Route-level Suspense).

**Esforço:** médio.
**Risco:** baixo.
**Obs:** parcialmente relacionado, mas **não duplicado**, com ui-audit-
fase1 item #8 (stagger).

---

#### 🟡 21. `Field` wrapper não gera id automático — label/input não associados mesmo via primitive

**Evidência:** `components/ui/Input.tsx:76-92`

**Sintoma:** mesmo quem usa o `Field` correto escapa do problema de
a11y do item #5. A solução dele resolve os novos formulários.

**Correção sugerida:** (ver item #5).

---

#### 🟡 22. Avatar da topbar não navega para "Menu do usuário" nem tem menu

**Evidência:** `components/layout/Topbar.tsx:242-255`

**Sintoma:** botão com `aria-label="Menu do usuário"` mas `onClick` nunca
foi setado. Clicar no avatar não faz nada. Não há como sair da sessão
pela topbar (só pelo footer da sidebar — que não foi achado).

**Correção sugerida:** implementar dropdown com "Meu perfil", "Sair",
"Alternar tema".

**Esforço:** médio.
**Risco:** zero (nova feature).

---

#### 🟡 23. `NavItemGroup` no modo collapsed abre flyout só via CSS hover, sem toggle por clique

**Evidência:** `components/layout/NavItem.tsx:114-160` — botão sem
`onClick`; apenas `hover` CSS revela o flyout.

**Sintoma:** em touch devices ou via teclado (Tab + Enter), o flyout
**não abre**, deixando os submenus inacessíveis quando sidebar está
collapsed.

**Correção sugerida:** transformar em Popover controlado por state
(click-to-toggle) ou pelo menos `onFocus`/`onBlur`.

**Esforço:** médio.
**Risco:** nenhum.

---

### 🔵 BAIXO

---

#### 🔵 24. `src/App.css` é template leftover do Vite — não referenciado

**Evidência:** `src/App.css` (149 linhas de CSS para `.counter`, `.hero`,
`#center`, `#next-steps` — estruturas do template). Nenhum `import
'./App.css'` em nenhum `.tsx`. Dead file.

**Correção sugerida:** remover.

**Esforço:** 1 min.

---

#### 🔵 25. `pages/TestShellPage.tsx` não registrado em `App.tsx`

**Evidência:** `pages/TestShellPage.tsx` (226 linhas) — importa AppShell
diretamente e monta um "showcase" do design system. Não há rota para
ele. Dead code.

**Correção sugerida:** (a) registrar como `/_design-system` atrás de
`AuthGuard`, ou (b) remover do bundle.

**Esforço:** 2 min.

---

#### 🔵 26. Persist do Zustand duplica `token` com `localStorage`

**Evidência:** `store/auth.store.ts:44-52` — o store persiste em
`eldox_auth`, mas `login()` também grava `eldox_token` via
`localStorage.setItem`. Dois sources of truth do mesmo token.

**Sintoma:** se o usuário limpa uma chave mas não a outra (DevTools), o
interceptor lê de `eldox_token` enquanto a store acha que está logada.
Inconsistência.

**Correção sugerida:** escolher uma (preferência: persist único via
zustand). Se manter os dois, sincronizar via `onRehydrateStorage`.

**Esforço:** baixo.

---

#### 🔵 27. `Toast` usa `Math.random` para id — colisão possível em burst

**Evidência:** `components/ui/Toast.tsx:94`

```ts
const id = Math.random().toString(36).slice(2)
```

**Sintoma:** em burst de 10+ toasts simultâneos, pode haver colisão. Key
duplicada no map → warning React.

**Correção sugerida:** `crypto.randomUUID()` (já disponível) ou counter
monotônico.

**Esforço:** 1 min.

---

#### 🔵 28. `DashboardPage.addWidgetToLayout` — `useCallback` ineficiente

**Evidência:** `pages/DashboardPage.tsx:76-89`

**Sintoma:** o `useCallback` depende de `activeLayout` que é recomputado
em toda renderização (fallback `localLayout ?? savedLayout ?? DEFAULT…`).
O callback nunca se estabiliza e reseta mesmo sem mudança real.

**Correção sugerida:** passar `activeLayout` como `prev` no setter ou
usar funcional form.

**Esforço:** baixo.

---

#### 🔵 29. Font-loading via `@import url('https://fonts.googleapis.com/...')` dentro de CSS

**Evidência:** `styles/tokens.css:7`

**Sintoma:** `@import` dentro de CSS carregado por Vite bloqueia a
renderização do primeiro frame (CSS only é fetch serial). Google Fonts
pode falhar em ambiente restrito/offline.

**Correção sugerida:** usar `<link rel="preload">` no `index.html` ou
self-host as fontes em `public/fonts/`.

**Esforço:** médio.
**Risco:** baixo.

---

#### 🔵 30. `Button.tsx` usa classes Tailwind inexistentes/customizadas sem config confirmada

**Evidência:** `components/ui/Button.tsx:30-43` — usa classes como
`text-text-mid`, `border-border-dim`, `bg-bg-raised`, `ease-spring`,
`ease-out-expo`. Elas só funcionam se o `tailwind.config.ts` expor esses
tokens. ⚠️ Verificação pendente — pode estar OK ou pode ser silent
failure.

**Correção sugerida:** rodar `pnpm build` e conferir se aparecem warnings
"unknown class" (ou inspecionar DOM em dev).

**Esforço:** 10 min (auditoria).
**Risco:** potencialmente alto se houver silent fail.

---

## 2. Tópicos conferidos sem achados adicionais

- ✅ **Lazy loading**: praticamente 100% das rotas usam `lazy()` em
  `App.tsx`. Boa prática mantida.
- ✅ **Axios base URL e interceptor de 401**: arquitetura correta no geral
  (fila + retry), apenas os bugs listados no #3.
- ✅ **React Query setup inicial**: config em `App.tsx` está coerente
  (staleTime 60s, gcTime 5min, retry 1).
- ✅ **Tailwind config**: existe `tailwind.config.ts`. Tokens do dark
  estão propagados.
- ✅ **DM Sans + Geist Mono**: carregadas via `tokens.css:7`.
- ✅ **ThemeProvider** existe e respeita system-level quando aplicável.
- ✅ **prefers-reduced-motion** tratado em `index.css:44-50`.
- ✅ **Scrollbar customizada** em `index.css:22-25`.
- ✅ **Skeleton primitive** (`components/ui/Skeleton.tsx`) bem estruturado.
- ✅ **RHF + Zod** em pelo menos `LoginPage` e módulos críticos (corretos).
- ✅ **StrictMode** ativo em `main.tsx:7`.

---

## 3. Cross-refs para outras camadas

- **Camada 1 (Arquitetura/UX):** sintoma "sidebar quebrado" — confirmado
  reprodutível quando tenant não tem obras cadastradas (item #15).
- **Camada 2 (Backend):** validar se `/fvm/catalogo`, `/fvm/fornecedores`,
  `/auth/refresh` retornam shape esperado (itens #1 e #3).
- **Camada 3 (Banco/Prisma):** N/A direto.
- **Camada 5 (Mobile):** **N/A — mobile não desenvolvido nesta fase**.
- **Camada 6 (IA):** `AgenteFloat` chama `POST /ia/chat` — validar
  resposta shape `{ resposta, acao?, sugestoes? }` no backend.
- **Camada 7 (Segurança):** localStorage de token é XSS-exploit (comum em
  SPAs); considerar httpOnly cookie, especialmente para refresh (já usa
  `withCredentials: true`).

---

## 4. Resumo para orquestrador

**Totais:**
- 🔴 **3** críticos
- 🟠 **7** altos
- 🟡 **13** médios
- 🔵 **7** baixos
- **Total: 30 achados novos** (não duplicam `ui-audit-fase1.html`, que
  foca em polimento visual — 10 sugestões em aprovação).

**Top 3 achados:**
1. 🔴 `api/v1/fvm/...` duplicado em NovaSolicitacao + NovaOc → busca de
   catálogo/fornecedor **quebrada em produção hoje** (404 silencioso).
2. 🔴 Interceptor de refresh de auth (`services/api.ts:21-75`) lê token
   sem unwrap de envelope `{data: {...}}` e não exclui `/auth/refresh`
   da fila — potencial loop de refresh + requests penduradas em promise.
3. 🟠 Sidebar fica "quebrada" (6 links apontando para `/obras`) quando o
   tenant não tem obra cadastrada (`useResolvedObraId`) — confirma o
   sintoma reportado pelo usuário.

**Ação urgente:** consertar os três itens acima (total estimado: ~4h de
dev) **antes** de executar o `ui-upgrade-engine` que aguarda aprovação
do PO — os upgrades visuais não devem mascarar bugs funcionais.

**Cross-refs:** Camada 1 (sidebar + rotas), Camada 2 (contrato /fvm/* e
/auth/refresh), Camada 7 (localStorage de token).

**Não duplicado:** tudo em `ui-audit-fase1.html` (animações premium,
hover lift, stagger KpiGrid, focus ring, scrollbar, page transition,
radius upgrade) segue pelo `ui-upgrade-engine` sem sobreposição com este
relatório.
