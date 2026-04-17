# Camada 9 — Internacionalização, Localização e Pt-BR

**Auditor:** auditor-camada-09-i18n
**Data:** 2026-04-17
**Escopo:** `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src`
**Mobile:** N/A — mobile não desenvolvido nesta fase.

---

## 0. Resumo executivo

O sistema **é mono-idioma pt-BR**, **não possui biblioteca i18n** (nenhum
`react-intl`, `react-i18next`, `date-fns`), nenhum dicionário
centralizado (`i18n/pt-BR.json`, `locales/`), e nenhum utilitário de
formatação compartilhado em `src/lib/`. Todas as strings são inline em
JSX e todas as formatações de data/número/moeda são
**duplicadas ad-hoc** via `toLocaleString('pt-BR')`/`toLocaleDateString('pt-BR')`.

A base pt-BR está **funcional mas desarmônica**: há inconsistências
sistemáticas (verbos "Excluir" vs "Remover", reticências "..." vs "…",
unidades sem espaço "10m³", decimais com `.toFixed()` gerando "75.5%"
em vez de "75,5%", uso extensivo de "(s)/(ns)" em pluralização,
mensagens de erro com vazamento de `response.data.message` bruto do
backend). Não foi encontrado "salvo sucesso", "Invalid date", Lorem
ipsum ou strings em inglês visíveis (exceto `Carregando...` vs
`Carregando…`).

**Totais:** 🔴 2 · 🟠 6 · 🟡 9 · 🔵 3 = **20 achados**.

---

## 1. Padrão de strings e centralização

### BUG-I18N-001 🔴 Ausência total de dicionário/centralização de strings

- **Sintoma:** 195 arquivos `.tsx` com strings inline em português. Não
  existe `i18n/pt-BR.json`, `locales/`, `strings.ts`, nem helper em
  `src/lib/`.
- **Evidência:**
  - `/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/lib/` contém apenas `cn.ts` e `apiBase.ts` — nenhum `format.ts`, `dates.ts`, `strings.ts`.
  - Glob por `i18n*`, `locale*`, `pt-BR*` em `src/` retorna **zero** arquivos da aplicação (apenas `node_modules/d3-*`).
  - Não há import de `date-fns`, `dayjs`, `react-intl`, `react-i18next` em todo o repositório.
- **Causa:** Escolha arquitetural de colocar todas as labels direto nos componentes. OK para MVP mono-idioma, mas inviabiliza qualquer padronização futura, glossário ou auditoria de tom de voz.
- **Correção sugerida:** criar `src/lib/i18n/pt-BR.ts` (ou `strings.ts`) com chaves por módulo (`ged.upload.titulo`, `obras.confirmar_exclusao`) + helper `formatBytes`, `formatMoeda`, `formatData`, `formatUnidade`. Migrar incrementalmente começando por mensagens toast e confirmações.
- **Esforço:** alto (semanas, pode ser gradual por módulo).
- **Regressão:** baixa (refactor de texto).
- **Cross-ref:** [Cross-ref camada 4] — UI depende dessas decisões; [Cross-ref camada 8] — formatação numérica também é dela.

### BUG-I18N-002 🔴 Formatações de data/número duplicadas em ~50 arquivos

- **Sintoma:** `new Date(x).toLocaleDateString('pt-BR')` e
  `n.toLocaleString('pt-BR', { ... })` repetidos em dezenas de arquivos,
  cada um com opções ligeiramente diferentes. Não há helper único.
- **Evidência (amostra):**
  - `modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx:141`
    `new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });`
  - `modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx:103` — idêntico, redeclarado.
  - `modules/concretagem/concretagens/components/KanbanCard.tsx:20` — mesma formatação, sem `year`.
  - `modules/concretagem/concretagens/components/CpTabela.tsx:38` — `year: '2-digit'`.
  - `pages/ged/GedDocumentoDetalhePage.tsx:289,295,650` — `toLocaleDateString('pt-BR')`.
  - 48 arquivos totalizam ocorrências de `toLocaleDateString('pt-BR')` e 30+ arquivos de `toLocaleString('pt-BR'`.
- **Causa:** Sem helper compartilhado. Cada dev inventa o próprio.
- **Correção sugerida:** `lib/formatters.ts` com `fmtData(d)`, `fmtDataHora(d)`, `fmtMoeda(n)`, `fmtNumero(n, d)`, `fmtUnidade(n, u)`. Proibir `toLocaleString` inline via lint rule.
- **Esforço:** médio.
- **Regressão:** baixa.

---

## 2. Mensagens de erro vazando do backend

### BUG-I18N-003 🟠 Padrão ubíquo `err?.response?.data?.message ?? 'Erro ao ...'` expõe strings técnicas ao usuário

- **Sintoma:** 48 arquivos usam esse padrão que **imprime diretamente o `message` do backend** na tela/toast. O backend (NestJS + Prisma) pode responder com qualquer coisa (`"P2002: Unique constraint failed..."`, stack traces, mensagens JWT).
- **Evidência (amostra):**
  - `pages/obras/CadastroObraWizard.tsx:125` — `setErro(err?.response?.data?.message ?? 'Erro ao criar obra');`
  - `pages/obras/CadastroObraWizard.tsx:143,160` — idem para hierarquia e locais.
  - `modules/fvs/modelos/pages/ModeloDetailPage.tsx:95,103,113,132,139` — 5 ocorrências só nesse arquivo.
  - `modules/diario/pages/RdoFormPage.tsx:436,599,754,947,1158,1318` — 6 ocorrências (cada seção do RDO).
  - `modules/fvm/fornecedores/components/FornecedorModal.tsx:105` — upload de fornecedor.
  - `modules/fvm/grade/components/NovoLoteModal.tsx:116` — registro de entrega.
- **Causa:** Sem camada de tradução de erros (ex: map de `P2002 → "Este registro já existe"`). Backend pode ou não estar em pt-BR.
- **Correção sugerida:** criar `lib/errorMap.ts` com mapeamento código→mensagem pt-BR; axios interceptor único para normalizar erros.
- **Esforço:** médio.
- **Regressão:** baixa.
- **Cross-ref:** [Cross-ref camada 3] — arquitetura frontend; [Cross-ref camada 7] — segurança (mensagens técnicas podem vazar info sensível).

### BUG-I18N-004 🟠 Mensagens de erro inconsistentes — nem todas convidam a acionar

- **Sintoma:** Algumas dizem "Erro ao carregar X. Tente novamente." (OK). Outras apenas "Erro ao carregar X" (seco, sem próximo passo).
- **Evidência:**
  - **Bom:** `modules/semaforo/pages/SemaforoPage.tsx:56` — `"Erro ao carregar semáforo. Tente novamente."`
  - **Bom:** `pages/ged/GedDocumentoDetalhePage.tsx:590` — `"Erro ao submeter. Tente novamente."`
  - **Seco:** `pages/ged/GedAdminPage.tsx:325` — `"Erro ao carregar documentos."`
  - **Seco:** `pages/ged/GedListaMestraPage.tsx:43` — `"Erro ao carregar a Lista Mestra."`
  - **Seco:** `modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx:293` — `"Erro ao carregar laboratórios"` (sem ponto final inclusive).
  - **Seco:** `modules/fvm/dashboard/DashboardFvmTab.tsx:52` — `"Erro ao carregar dados do dashboard."`
  - **Seco:** `modules/fvs/planos-acao/pages/PlanosAcaoPage.tsx:63` — `"Erro ao carregar planos de ação."`
- **Correção sugerida:** padronizar template `"Não foi possível carregar X. Tente novamente."` + botão "Tentar novamente".
- **Esforço:** baixo.
- **Regressão:** nenhuma.

---

## 3. Pluralização — uso generalizado de "(s)" / "(ns)"

### BUG-I18N-005 🟠 Padrão "(s)/(ns)" feio e unprofessional em 15+ locais críticos

- **Sintoma:** A referência da camada diz explicitamente "Não usar `(s)` em casos profissionais". O sistema usa em abundância.
- **Evidência:**
  - `pages/obras/ObraDetalhePage.tsx:742` — `{mv.fichas_count} ficha(s) criada(s) com este template nesta obra`
  - `pages/obras/estrategias/LinearForm.tsx:76` — `${pvs} {trecho.elementoLabel || 'PV'}(s) a cada {trecho.intervaloKm} km`
  - `pages/obras/estrategias/EdificacaoForm.tsx:147-148` — `área(s) comum(ns) por bloco`, `área(s) global(is)`
  - `modules/fvm/relatorios/pdf/NcsFvmPdf.tsx:103` — `{items.length} NC(s)` (em PDF entregue a cliente).
  - `modules/aprovacoes/components/SnapshotViewer.tsx:20` — `${val.length} item(s)`
  - `modules/fvm/grade/pages/FichaLotePage.tsx:389` — `${naoConformes} item(s) não conforme(s) encontrado(s).`
  - `modules/ensaios/dashboard/pages/ConformidadePage.tsx:92` — `${kpis.ensaios_vencidos} vencido(s)`
  - `modules/fvm/grade/components/EnsaiosTab.tsx:109` — `${resultado.pendentes} ensaio(s) pendente(s)`
  - `modules/fvs/modelos/pages/ModeloDetailPage.tsx:347` — `${svc.itens_excluidos.length} item(s) excluído(s)`
  - `modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx:326` — `${result?.total ?? 0} concretagem(ns) encontrada(s)`
  - `modules/fvs/modelos/components/VincularObraModal.tsx:138` — `${selecionadas.size} obra(s) selecionada(s)`
  - `modules/concretagem/dashboard/pages/ConcretagemDashboardPage.tsx:129` — `${kpis.cps_vencidos_sem_resultado} vencido(s)`
  - `modules/fvs/inspecao/pages/AbrirFichaWizard.tsx:185` — `Há ${modelosDisponiveis.length} template(s) vinculado(s) a esta obra.`
  - `modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx:52,206` — `Ordem(ns) de Compra`, `Gerar OC(s)`
  - `modules/portal/PortalFornecedorPage.tsx:213` — `${data.caminhoes.length} caminhão(ões)`
- **Correção sugerida:** helper `pluralize(n, sing, plur)` → `pluralize(n, 'ficha', 'fichas')`. Ou usar `Intl.PluralRules`.
- **Esforço:** baixo (helper pronto, substituições triviais).
- **Regressão:** nenhuma.

---

## 4. Unidades técnicas — espaçamento inconsistente

### BUG-I18N-006 🟠 Unidade "m³" colada ao número em pelo menos 2 pontos

- **Sintoma:** A referência obriga `"10 m³"` com espaço. Encontrado o oposto.
- **Evidência:**
  - `modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx:257` — `` ` ${Number(c.sobra_volume).toFixed(1)}m³` `` (sem espaço entre valor e `m³`).
  - `modules/dashboard/widgets/obra/ConcretagemVolumeWidget.tsx:28` — `` `${realizado}m³` `` (sem espaço).
  - Nos demais arquivos o espaço existe (ex: `ConcretagemDashboardPage.tsx:112` `${kpis.volume_realizado_total.toFixed(1)} m³`). Inconsistência visível.
- **Correção sugerida:** helper `fmtVolume(n)` que sempre produz `"X,Y m³"`. Mesmo padrão para `MPa`, `kg`, `cm`.
- **Esforço:** baixo.
- **Regressão:** visual apenas.

### BUG-I18N-007 🟡 Uso de `toFixed()` gera decimal com ponto (en-US) em vez de vírgula (pt-BR)

- **Sintoma:** `n.toFixed(1)` produz `"75.5"` em JS (sempre `.` independentemente do locale). Aparece na UI em percentuais, volumes, MPa, slump.
- **Evidência (14 ocorrências em 5 arquivos principais):**
  - `modules/semaforo/pages/SemaforoPage.tsx:111` — `${scorePct.toFixed(1)}<span>%</span>` → usuário vê `75.5%`.
  - `modules/semaforo/pages/SemaforoPage.tsx:207,265` — mesmo problema.
  - `modules/ensaios/dashboard/pages/ConformidadePage.tsx:70` — `${kpis.taxa_conformidade.toFixed(1)}%`.
  - `modules/concretagem/dashboard/pages/ConcretagemDashboardPage.tsx:112,143` — `${kpis.volume_realizado_total.toFixed(1)} m³`, `${kpis.resistencia_media_28d.toFixed(1)} MPa` → `"123.4 m³"`, `"28.7 MPa"`.
  - `modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx:159` — `${Number(data.volume_previsto).toFixed(1)} m³`.
  - `modules/concretagem/concretagens/components/KanbanCard.tsx:53` — `${Number(item.volume_previsto).toFixed(1)} m³`.
  - `pages/ged/GedDocumentoDetalhePage.tsx:63-64` — `${(bytes / 1024).toFixed(1)} KB`, `${(bytes / (1024*1024)).toFixed(2)} MB`.
  - `pages/obras/ObrasListPage.tsx:587` — `${(score * 100).toFixed(1)}%` — mostra `"75.5%"` em tooltip de Semáforo.
  - `modules/fvm/fornecedores/pages/FornecedoresPage.tsx:40` — `${score.toFixed(1)}` em badge de score.
- **Correção sugerida:** substituir por `n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` — ou helper `fmtNumero(n, 1)`.
- **Esforço:** baixo (find/replace).
- **Regressão:** baixa.

---

## 5. Moeda — formatação dividida em dois padrões

### BUG-I18N-008 🟡 Dois estilos diferentes para moeda convivem no código

- **Sintoma:** Módulo **NF-e/Ordem de Compra** usa `Intl` com `style: 'currency'` (correto, retorna `"R$ 1.234,56"`). Módulo **Cotações** concatena `"R$ "` manualmente com `toLocaleString`.
- **Evidência:**
  - **Correto (Intl currency):**
    - `modules/almoxarifado/nfe/pages/NfeListPage.tsx:46`, `NfeDetalhePage.tsx:76,267`
    - `modules/almoxarifado/compras/pages/OcListPage.tsx:42`, `OcDetalhePage.tsx:164,267`, `NovaOcPage.tsx:240,337`
  - **Incorreto (concatenado manual):**
    - `modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx:93` — `` `Economia potencial: R$ ${economiaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` ``
    - `ComparativoPage.tsx:188,274,305,333,359` — 5 ocorrências.
    - `modules/almoxarifado/cotacoes/pages/CotacoesPage.tsx:229,232` — idem.
- **Impacto:** o estilo manual não garante dois dígitos em inteiros (`R$ 100` vs `R$ 100,00`), e não respeita convenções de símbolo.
- **Correção sugerida:** helper `fmtMoeda(n)` usando `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Esforço:** baixo.
- **Regressão:** nenhuma.

---

## 6. Vocabulário e consistência de verbos

### BUG-I18N-009 🟠 "Excluir" vs "Remover" usados para a mesma ação em módulos diferentes

- **Sintoma:** Verbos de destruição inconsistentes entre módulos, criando confusão cognitiva.
- **Evidência:**
  - **"Excluir"** (FVS, NCs, Ensaios, RDO, Croqui):
    - `modules/fvs/modelos/pages/ModelosListPage.tsx:41,191`
    - `modules/fvs/catalogo/CatalogoPage.tsx:155,190`
    - `modules/fvs/inspecao/pages/FichasListPage.tsx:121,124`
    - `modules/ensaios/tipos/components/TipoEnsaioRow.tsx:116,198`
    - `modules/ncs/pages/NcsListPage.tsx:327,330`
    - `modules/diario/pages/RdosListPage.tsx:110,140,622`
    - `modules/concretagem/croqui/pages/CroquiRastreabilidadePage.tsx:214`
  - **"Remover"** (Obras, Estratégias, Efetivo):
    - `pages/obras/ObraDetalhePage.tsx:1029-1032`
    - `pages/obras/EditarObraModal.tsx:375`
    - `pages/obras/ObrasListPage.tsx:348,361,513`
    - `pages/obras/estrategias/GenericaForm.tsx:97` (`"Remover nível"`)
    - `modules/diario/pages/RdoFormPage.tsx:1836` (`confirm('Remover esta foto?')`)
- **Correção sugerida:** padronizar em **"Excluir"** (conforme a referência: `"Excluir esta FVS?"`). "Remover" só para desvinculação não-destrutiva (ex: `"Remover serviço do template"`).
- **Esforço:** baixo.
- **Regressão:** nenhuma.

### BUG-I18N-010 🟡 Reticências inconsistentes: `...` (ASCII) vs `…` (Unicode)

- **Sintoma:** 125 ocorrências de `...` e 47 de `…` em `.tsx`. Mesmo componente vizinho usa ambos.
- **Evidência:**
  - `pages/auth/LoginPage.tsx:106` — `'Entrando...'`
  - `App.tsx:96` — `Carregando…` (Unicode).
  - `pages/ged/GedHubPage.tsx:44,266` — `Carregando...` (ASCII).
  - `pages/ged/GedDocumentosPage.tsx:128,337` — `Carregando...`.
  - `pages/ged/GedDocumentoDetalhePage.tsx:153,621` — `Carregando documento...`, `Carregando...`.
  - `modules/efetivo/pages/CadastrosPage.tsx:227,252,357,384` — mistura `Salvando...`, `Carregando...`.
  - `pages/obras/EditarObraModal.tsx:409` — `'Salvando...'`.
  - Ao mesmo tempo, `modules/ensaios/revisoes/components/RevisaoModal.tsx`, `modules/almoxarifado/cotacoes/pages/CotacoesPage.tsx`, `modules/concretagem/croqui/components/CroquiSvg.tsx` usam `…`.
- **Correção sugerida:** padronizar em `…` (caractere Unicode U+2026) que tipograficamente é o correto em pt-BR formal.
- **Esforço:** baixo.
- **Regressão:** nenhuma.

### BUG-I18N-011 🟡 `confirm()`/`alert()` nativos do navegador em vez do componente de Modal/Toast do sistema

- **Sintoma:** O design system tem `ToastProvider` (`components/ui/Toast.tsx`) e `Modal` (`components/ui/Modal.tsx`) — mas várias telas usam `window.confirm`/`window.alert`, que ficam em inglês no navegador do usuário (botões "OK/Cancel") e quebram o tom profissional.
- **Evidência:**
  - `modules/ncs/pages/NcsListPage.tsx:327` — `confirm(\`Excluir NC "${nc.numero}"?\`)`
  - `modules/aprovacoes/pages/TemplatesPage.tsx:160` — `confirm(\`Desativar o template "${t.nome}"?\`)`
  - `modules/aprovacoes/pages/AprovacaoDetalhePage.tsx:304` — `confirm('Confirmar cancelamento desta aprovação?')`
  - `modules/fvs/modelos/pages/ModeloDetailPage.tsx:100,137` — 2 `confirm()`.
  - `modules/fvs/modelos/pages/ModelosListPage.tsx:41` — `confirm()`.
  - `modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage.tsx:43,90,230,366` — 4 `confirm()`.
  - `modules/ensaios/tipos/components/TipoEnsaioRow.tsx:116` — `window.confirm(...)`.
  - `modules/fvs/catalogo/CatalogoPage.tsx:155,172,190` — `window.confirm()` + `window.prompt('Nome da nova categoria:')` (!).
  - `modules/fvs/inspecao/pages/FichasListPage.tsx:121` — `confirm()`.
  - `modules/concretagem/croqui/pages/CroquiRastreabilidadePage.tsx:214` — `window.confirm()`.
  - `modules/diario/pages/RdoFormPage.tsx:1836` — `confirm()`.
  - `modules/ensaios/laboratoriais/components/EnsaioModal.tsx:274` — `window.alert('Ensaio registrado. Revisão criada automaticamente.')`.
  - `modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx:52` — `alert('${data.ocs_criadas} Ordem(ns) de Compra gerada(s) com sucesso!')`.
  - `modules/almoxarifado/cotacoes/pages/CotacoesPage.tsx:159` — `confirm('Cancelar esta cotação?')`.
- **Correção sugerida:** banir `window.confirm/alert/prompt` via ESLint; criar `useConfirm()` hook com Modal customizado.
- **Esforço:** médio.
- **Regressão:** baixa (uso homogêneo).
- **Cross-ref:** [Cross-ref camada 4] UX.

### BUG-I18N-012 🟡 Dois `useToast` diferentes convivem no código

- **Sintoma:** Existe `components/ui/Toast.tsx` (ToastProvider oficial, 4 variantes `ok/warn/nc/info`) mas `modules/diario/pages/RdoFormPage.tsx:106-111` redefine localmente `function useToast()` com API própria (`show(msg, type: 'ok' | 'err')`).
- **Evidência:**
  - `components/ui/Toast.tsx:28` — `export function useToast()` (oficial).
  - `modules/diario/pages/RdoFormPage.tsx:106-111` — reimplementação local.
  - `RdoFormPage.tsx:1934` — `const { toast, show: showToast, dismiss } = useToast();` (usa o local, não o importado).
- **Correção sugerida:** remover o `useToast` local, importar de `@/components/ui`.
- **Esforço:** baixo.
- **Regressão:** média (precisa checar visual do RDO).

### BUG-I18N-013 🟡 Mensagens de sucesso não padronizadas entre módulos

- **Sintoma:** Apenas o módulo RDO usa "Salvo com sucesso" rigorosamente. Demais módulos não têm toast de sucesso — só redirecionam silenciosamente (ex: Obras, NCs, FVS novos). Não há padrão.
- **Evidência:**
  - `modules/diario/pages/RdoFormPage.tsx:434,597,752,945,1156,1316` — `"Clima salvo com sucesso"`, `"Mão de obra salva com sucesso"`, etc. **6 ocorrências** apenas no RDO.
  - `modules/fvm/grade/pages/FichaLotePage.tsx:349` — `onSucesso` callback mas sem toast específico.
  - `modules/portal/PortalCotacaoPage.tsx:132` — `"Sua proposta foi recebida com sucesso."` (frase completa, OK).
  - `modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx:52` — usa `alert()` para sucesso (ver BUG-I18N-011).
  - Dashboard/Obras/NCs/GED não emitem toast de sucesso explícito em criação/edição.
- **Correção sugerida:** padronizar catálogo `mensagens.sucesso.*` e sempre chamar `toast.success(...)`.
- **Esforço:** médio.
- **Regressão:** nenhuma.

### BUG-I18N-014 🟡 Verbos do formulário RDO em voz ativa inconsistente ("Foto enviada" vs "Clima salvo")

- **Sintoma:** No mesmo módulo RDO, uso alterna "Clima salvo com sucesso" (passivo) e "Foto enviada com sucesso" (passivo) — ok — mas na mesma tela, erros dizem `"Erro ao salvar clima"` (ativo infinitivo) vs `"Erro ao enviar foto"` (ativo infinitivo) — ok. **Mas** `modules/diario/pages/RdoFormPage.tsx:1703` diz `"Erro ao enviar foto"` e `:1712` diz `"Erro ao remover foto"`, enquanto o confirm em `:1836` diz `"Remover esta foto?"` e a mutation é chamada `mutExcluir`. Mistura conceitual.
- **Correção sugerida:** para fotos, padronizar **"Excluir foto"**. Para erros de remoção, `"Não foi possível excluir a foto."`.
- **Esforço:** baixo.
- **Regressão:** nenhuma.

---

## 7. Datas, horas e tom

### BUG-I18N-015 🔵 Formatação de data/hora com opções literais em 30+ arquivos, sem helper

- **Sintoma:** Opções `{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }` copiadas em múltiplos lugares.
- **Evidência:**
  - `modules/aprovacoes/pages/AprovacaoDetalhePage.tsx:26,33,162` — mesma opção literal 3x.
  - `modules/diario/pages/RdoWorkflowPage.tsx:41` — repete.
  - `modules/almoxarifado/estoque/pages/MovimentosPage.tsx:48` — concatena data + hora manualmente.
  - `modules/almoxarifado/estoque/pages/AlertasPage.tsx:17` — outra variação.
- **Correção sugerida:** três helpers: `fmtData`, `fmtDataHora`, `fmtDataCurta`. Ver BUG-I18N-002.
- **Esforço:** baixo (consolidação).
- **Regressão:** nenhuma.

### BUG-I18N-016 🔵 Data por extenso usa `weekday: 'long', month: 'long'` — boa prática, mas uso isolado

- **Sintoma:** A referência recomenda "quinta, 15 de novembro" — o dashboard faz isso.
- **Evidência:** `pages/DashboardPage.tsx:116` — `new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })` (✅).
- **Observação:** é o único lugar. Em documentos formais (PDFs de FVS, RDO cliente, NFE) a data é só numérica. Sugestão de ampliar.

---

## 8. Acessibilidade textual

### BUG-I18N-017 🟡 Poucos `aria-label` — apenas 29 ocorrências em 195 arquivos

- **Sintoma:** Referência exige `aria-label` em ícones sem texto.
- **Evidência:**
  - Grep por `aria-label` retorna 29 matches em 16 arquivos apenas.
  - Módulos inteiros (Dashboard, Concretagem, Semáforo, Efetivo, Almoxarifado/cotacoes) não têm nenhum `aria-label`.
  - Exemplos que usam: `components/ui/Toast.tsx:75`, `components/ui/Modal.tsx` (2), `components/layout/Topbar.tsx` (6), `components/layout/Sidebar.tsx` (3) — concentrado em shell.
  - Módulos com ícones de ação (editar, excluir, duplicar, expandir) usam `title="..."` mas raramente `aria-label`.
- **Correção sugerida:** auditoria por leitor de tela em cada módulo; padronizar `IconButton` com `aria-label` obrigatório.
- **Esforço:** médio.
- **Regressão:** nenhuma.
- **Cross-ref:** [Cross-ref camada 4] — acessibilidade UX é dela.

---

## 9. Outros achados menores

### BUG-I18N-018 🔵 `"Credenciais inválidas"` na tela de login não diferencia usuário não-existente vs senha errada

- **Evidência:** `pages/auth/LoginPage.tsx:97` — `"Credenciais inválidas. Verifique os dados e tente novamente."`
- **Comentário:** decisão correta do ponto de vista de segurança (não revelar se o e-mail existe). Apenas registro.

### BUG-I18N-019 🟡 Labels em CAIXA ALTA via CSS (`uppercase tracking-wider`) abundantes

- **Sintoma:** Referência diz "Títulos curtos, em frase (não em TÍTULO CAIXA ALTA)". O sistema aplica `text-transform: uppercase` / `className="uppercase"` em 23 pontos (23 matches em 12 arquivos, majoritariamente labels de formulário — ok para "tracking-wider" microcopy — mas também em subtítulos).
- **Evidência:**
  - `pages/auth/LoginPage.tsx:42,49,64,80` — `"EMPRESA"`, `"E-MAIL"`, `"SENHA"` (labels curtos — ok em design system minimalista).
  - `pages/ged/GedHubPage.tsx` (1 local) e `pages/ged/GedDocumentoDetalhePage.tsx` (2) — em títulos de seção.
  - `modules/diario/pages/RdosListPage.tsx` — 7 usos em cabeçalhos de seção. Risco estilístico.
- **Comentário:** aceitável se for design system (Precision Ops Dark) — apenas flag.
- **Cross-ref:** [Cross-ref camada 4].

### BUG-I18N-020 🔵 Glossário de domínio respeitado, mas sem documento central

- **Achado positivo:** Nenhuma ocorrência de "projeto" confundido com "obra"; nenhum uso de "equipe" no lugar de "efetivo"; GED/FVS/NC/RDO/CAPA usados corretamente.
- **Falta:** não existe arquivo `GLOSSARIO.md` ou `TERMOS.md` no repo — o alinhamento é puramente cultural. Futuros devs podem quebrar.

---

## 10. Não-achados (validações que passaram)

- ✅ Nenhum **Lorem ipsum** em produção (grep zero).
- ✅ Nenhum **"Invalid date"**, **"NaN"**, **"undefined"** vazando em UI (os matches são em código, não em strings visíveis).
- ✅ Nenhum **"salvo sucesso"** ou **"erro ao deletando"**.
- ✅ Nenhuma string em inglês visível (`"Loading"`, `"Save"`, `"Submit"`, `"Error"` não aparecem como UI — só como nomes de prop/função).
- ✅ Uso de `'pt-BR'` como locale é consistente em 100% dos `toLocaleString`/`toLocaleDateString`.
- ✅ **CPF** não é coletado no frontend atualmente (módulo de usuários não tem form de cadastro visível — [cross-ref camada 2]).
- ✅ **CNPJ** tem máscara em `fvm/fornecedores/components/FornecedorModal.tsx` e placeholder `"00.000.000/0000-00"` em `modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx:156` e `modules/efetivo/pages/CadastrosPage.tsx:211`.
- ✅ `"E-mail"` usado com hífen corretamente em todos os labels visíveis (`LoginPage.tsx:65`, `FornecedorModal.tsx:210`). `"e-mail"` minúsculo em mensagem corrida (`PortalFornecedorPage.tsx:84`) — ortografia correta.
- ✅ `aria-live="polite"` no container de toast (`components/ui/Toast.tsx:110`). `role="alert"` no item individual (linha 69). Correto.

---

## Resumo para orquestrador

**Totais:** 🔴 2 · 🟠 6 · 🟡 9 · 🔵 3 = **20 achados**.

**Top 3 prioridades:**
1. **BUG-I18N-001 🔴** — criar dicionário centralizado (`lib/i18n/pt-BR.ts`) e helpers de formatação (`lib/formatters.ts`). Sem isso, qualquer padronização é efêmera.
2. **BUG-I18N-003 🟠** — sanitizar mensagens vindas de `response.data.message` (48 arquivos) via `errorMap` + interceptor axios. Risco de vazar códigos Prisma/JWT ao usuário.
3. **BUG-I18N-007 🟡** + **BUG-I18N-008 🟡** — eliminar `toFixed()` na UI (14 ocorrências com `.` em vez de `,`) e unificar moeda via `Intl.NumberFormat currency`.

**Ação urgente (antes de release):**
Corrigir BUG-I18N-003 (vazamento de mensagens técnicas do backend) —
impacto direto em UX + potencial info-leak para a camada de segurança.

**Cross-refs:**
- [Camada 3 — Arquitetura frontend] — ausência de camada de serviços/formatação compartilhada (BUG-I18N-001, 002, 015).
- [Camada 4 — UI/UX] — `confirm/alert` nativos (BUG-I18N-011), CAIXA ALTA (BUG-I18N-019), aria-label (BUG-I18N-017).
- [Camada 7 — Segurança] — vazamento de mensagens do backend (BUG-I18N-003).
- [Camada 8 — Dados/Formatação] — toFixed com ponto (BUG-I18N-007), moeda (BUG-I18N-008), unidades (BUG-I18N-006).
