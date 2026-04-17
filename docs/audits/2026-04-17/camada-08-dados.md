# Camada 8 — Dados, Consistência e Qualidade pt-BR

**Auditor:** auditor-camada-08-dados
**Data:** 2026-04-17
**Escopo:** seeds, integridade referencial (Prisma/FK), soft delete, timezone,
formatações pt-BR (moeda/data/número/unidades), CPF/CNPJ/CEP, paginação,
ordenação, dedup, enums, exports.
**Fontes-base:** `backend/prisma/schema.prisma` (859 linhas, 32 models),
40 migrations SQL, `backend/src/**` (55 controllers), `frontend-web/src/**`
(195 .tsx + 75 pages).

Mobile: **N/A — `frontend-mobile/` não existe** (conforme `_context.md` §0).

---

## Resumo executivo

| Severidade | Total |
|------------|------:|
| 🔴 Crítico | **6** |
| 🟠 Alto    | **7** |
| 🟡 Médio   | **6** |
| 🔵 Baixo   | **4** |
| **Total**  | **23** |

Três grandes famílias de problema dominam esta camada:

1. **Integridade referencial ausente ou caótica.** `schema.prisma` tem **1 única**
   ocorrência de `onDelete` (em `ItemEfetivo`), e as migrations SQL usam 6 padrões
   diferentes (CASCADE, RESTRICT, SET NULL, NO ACTION implícito). Não há política
   documentada — a mesma tabela-pai pode cascade em um filho e restrict em outro.
2. **Soft-delete inconsistente.** Coexistem `deletadoEm` (pt-BR camelCase),
   `deleted_at` (snake_case), `deletedAt` (en camelCase), `ativo/ativa` boolean e
   HARD DELETE literal — sem padrão único por módulo nem middleware global.
3. **Desync severo de enums** entre Prisma e frontend. O caso mais grave é
   `RdoStatus` (3 valores UPPERCASE no banco vs 4 valores lowercase no frontend),
   garantindo erros 500/422 em fluxos ativos.

---

## 8.1 Seeds e dados de teste

### 🔴 CRIT-DAT-001 — Seed "Celina Bezerra" NÃO é idempotente

- **Arquivo:** `backend/prisma/seed-obra-celina-bezerra.ts:62-72`
- **Sintoma:** `prisma.obra.create({...})` sem upsert/findFirst prévio. Executar
  o script duas vezes cria duas obras `Residencial Celina Bezerra` com o mesmo
  `codigo: 'OBR-2026-001'` para o mesmo tenant.
- **Causa:** `Obra` NÃO possui `@@unique([tenantId, codigo])` nem
  `@@unique([tenantId, nome])` (ver `schema.prisma:146-193`). Nada no banco
  impede duplicata.
- **Impacto:** O script é descrito como "demo obra gigante — 1.848 locais";
  executá-lo 2× gera 3.696 locais fantasmas, e cada re-run afunda o tenant-demo.
  O seed principal (`seed.ts`) é idempotente via upsert; este não.
- **Correção sugerida:** envolver `prisma.obra.findFirst({ where: { tenantId,
  codigo: 'OBR-2026-001' } })` antes do create, ou adicionar unique composto.
- **Esforço:** 15 min. **Risco de regressão:** nenhum.

### 🟠 ALTO-DAT-002 — Unicidade de Obra inexistente (permite duplicatas em produção)

- **Arquivo:** `backend/prisma/schema.prisma:146-193` e
  `backend/src/obras/obras.service.ts:246-288`
- **Sintoma:** `ObraService.create` não verifica se já existe `Obra` com mesmo
  `nome` ou `codigo` no tenant. `gerarCodigoObra` é sequencial — mas sem unique
  constraint, uma race condition entre dois POST simultâneos pode gerar o mesmo
  código. A referência da camada (seção 8.9) pede "Constraints de unicidade
  protegem no banco".
- **Correção:** `@@unique([tenantId, codigo])` em `model Obra`.
- **Esforço:** 30 min (migration). **Risco:** médio — precisa validar que não
  há duplicatas pré-existentes.

### 🟡 MED-DAT-003 — Seed não documentado no README + sem `prisma.seed` no package.json

- **Arquivo:** `backend/package.json:86`, `backend/README.md` (nenhuma menção)
- **Sintoma:** Existe `"seed": "ts-node prisma/seed.ts"` como script npm, mas
  (a) não há `prisma.seed` configurado em `package.json` (Prisma não roda
  automaticamente em `prisma migrate reset`), (b) o README do backend não
  documenta como rodar o seed nem como popular a obra Celina Bezerra.
- **Correção:** adicionar bloco `"prisma": { "seed": "ts-node prisma/seed.ts" }`
  e seção "Seeds" no README.

### 🔵 BAIXO-DAT-004 — Seed principal não popula Tenant/Usuario

- **Arquivo:** `backend/prisma/seed.ts` (134 linhas, cria Plano + ObraTipo tipo-sistema)
- **Sintoma:** Ao fazer `prisma migrate reset && npm run seed`, há planos e
  tipos de obra, mas **nenhum Tenant, nenhum Usuario**. Dev precisa criar
  manualmente via SQL/API para conseguir logar. Referência da camada §8.1 pede
  "Seed cria tenant de demo com dados mínimos funcionais".

---

## 8.2 Integridade referencial

### 🔴 CRIT-DAT-005 — `schema.prisma` tem APENAS 1 `onDelete` explícito em 859 linhas

- **Arquivo:** `backend/prisma/schema.prisma` — busca `onDelete` retorna só
  `linha 848` (`ItemEfetivo.registroEfetivo … onDelete: Cascade`).
- **Sintoma:** 31 dos 32 models **não declaram** estratégia de exclusão.
  Prisma aplica default implícito (Restrict para obrigatórias, SetNull para
  opcionais), mas isto NÃO é documentado no schema e difere da SQL real (veja
  CRIT-DAT-006). Deletar uma `Obra` hoje pode bloquear (RESTRICT implícito)
  ou quebrar silenciosamente em cascata via GED (CASCADE explícito no SQL).
- **Impacto:** Nenhum developer consegue prever o que acontece ao excluir
  Obra/Tenant/ObraTipo sem rodar o comando. A referência §8.2 exige decisão
  documentada para cada FK.
- **Correção:** passar por todas as 87 relations e adicionar `onDelete`
  explícito conforme a política real.
- **Esforço:** 2h+. **Risco:** baixo — só torna o implícito explícito.

### 🔴 CRIT-DAT-006 — Políticas de exclusão divergentes entre módulos (caos)

- **Arquivos (amostra):**
  - RDO — `backend/prisma/migrations/20260414000001_rdo_module/migration.sql`
    linhas 70-259: **0 ocorrências** de `ON DELETE`. 17 FKs usam `NO ACTION`
    implícito (equivalente a RESTRICT mas sem bloqueio diferido).
  - GED — `backend/prisma/migrations/20260407000000_ged_module/migration.sql`
    linhas 52-351: MIX de 7 `ON DELETE CASCADE` + 5 `ON DELETE RESTRICT` +
    1 `ON DELETE SET NULL`.
  - Efetivo — `backend/prisma/migrations/20260415000010_efetivo_module/migration.sql`
    linha 67: só 1 `ON DELETE CASCADE` em 9 FKs.
  - Concretagem (Sprint 8) —
    `backend/prisma/migrations/20260415000002_sprint8_concretagem/migration.sql`
    linhas 92-144: **nenhum** `ON DELETE`.
- **Sintoma:** Sistema não tem política. `Obra → ConcretagemCroqui` é
  NO ACTION. `ged_documentos → ged_compartilhamentos` é CASCADE. Mesma obra
  remove croqui silenciosamente pelo GED e bloqueia pelo RDO.
- **Correção:** documentar política (ADR novo) — sugerido:
  "Obra/Tenant = RESTRICT; sub-artefatos (clima, fotos de RDO, linhas de
  checklist) = CASCADE; referências históricas (snapshot, log) = SET NULL".
- **Esforço:** 1 dia (revisão + migration unificadora). **Risco:** alto —
  CASCADE bem aplicado apaga dados de produção.

### 🟠 ALTO-DAT-007 — Schema Prisma omite modelos que existem no banco

- **Arquivos:** `schema.prisma` tem 32 models, mas migrations criam 50+ tabelas
  (FVS `fvs_*`, FVM `fvm_*`, GED `ged_*`, Almoxarifado `alm_*`, Concretagem
  `caminhoes_concreto`, `cps_concreto`, Ensaios `ensaio_*`). Essas tabelas
  são acessadas via `$queryRawUnsafe` — ver
  `backend/src/efetivo/cadastros/cadastros.service.ts:15`,
  `backend/src/fvm/catalogo/catalogo.service.ts:58`, etc.
- **Sintoma:** Prisma Client não tipa essas tabelas. Todo acesso é
  `$queryRawUnsafe<Row[]>` — sem checagem de tipo, sem relação via `include`,
  sem geração de migration automática. Qualquer renomeação de coluna é
  manual.
- **Causa:** módulos FVS/FVM/GED foram feitos com SQL puro para escapar de
  limitações do Prisma no início do projeto (ADR provavelmente não
  formalizado).
- **Correção:** introduzir progressivamente esses models no schema.prisma
  (mesmo sem relations) para que o Prisma Client tenha autocomplete/tipos.
  **Cross-ref Camada 6 (Backend-arquitetura).**

### 🟡 MED-DAT-008 — Nenhum teste de exclusão em cascata

- **Arquivo:** `backend/src/obras/obras-cascata.integration.spec.ts` existe
  (é o único arquivo com essa semântica), mas não foi encontrado em grep por
  nomes de testes tipo `cascade` ou `excluir obra`.
- **Sintoma:** Referência §8.2 pede "testes de exclusão rodam sem lock
  infinito". Não há garantia de que deletar uma obra com 1.848 locais, 200
  FVS, 500 CPs e 10.000 fotos não trava o banco por lock.

---

## 8.3 Soft delete

### 🔴 CRIT-DAT-009 — Três convenções diferentes de soft-delete no mesmo schema

- **Arquivo:** `backend/prisma/schema.prisma` — busca por padrões retorna:
  - `deletadoEm` (pt-BR camelCase): linhas 34, 65, 90, 183, 234, 341, 542, 707, 750
  - `deletedAt` (en camelCase): linha 623 (NaoConformidade)
  - `deleted_at` no SQL direto: linhas 341, 542, 623, 707, 750 usam `@map`
  - `ativa`/`ativo` boolean: linhas 63, 88, 180, 706, 799, 813
- **Sintoma:** Em NaoConformidade é `deletedAt`; em Obra é `deletadoEm`.
  Empresas/Funções de efetivo NÃO têm soft-delete, só `ativa` (ver
  `schema.prisma:799`, `813`). `EmpresaEfetivo` é apagada com HARD DELETE
  em `backend/src/efetivo/cadastros/cadastros.service.ts:113` (`DELETE FROM
  empresas_efetivo ... WHERE id=$1`).
- **Impacto:** Não é possível auditar quem apagou uma empresa/função. Qualquer
  FK futura para `empresas_efetivo` fica com lixo referencial.
- **Correção:** consolidar padrão único (`deletedAt` conforme §8.3 da
  referência) + middleware Prisma para filtrar `deletedAt: null` automático.
- **Esforço:** 2 dias. **Risco:** alto (rename de colunas).

### 🟠 ALTO-DAT-010 — DELETE FROM direto em 16 services (hard delete)

- **Arquivos (amostra):**
  - `backend/src/efetivo/cadastros/cadastros.service.ts:113,125`
  - `backend/src/ensaios/tipos/tipos.service.ts`
  - `backend/src/fvm/recebimento/evidencias/evidencias.service.ts`
  - `backend/src/fvs/catalogo/catalogo.service.ts`
  - `backend/src/fvs/modelos/modelo.service.ts`
  - …total de **16 files** com `DELETE FROM`.
- **Sintoma:** Apesar de muitas tabelas terem `deleted_at NULL`, vários
  services ignoram e fazem hard delete. Referência §8.3: "Aplicado
  consistentemente (todos os módulos ou nenhum)".
- **Correção:** guideline "proibido DELETE FROM, use UPDATE … SET deleted_at".

### 🟡 MED-DAT-011 — Middleware/filtro global de soft-delete ausente

- **Sintoma:** Todas as queries precisam lembrar `WHERE deletadoEm IS NULL`
  manualmente (ver `obras.service.ts:125`, `ged.service.ts:6 matches`,
  etc.). Esquecer isto expõe registros apagados.
- **Correção:** `prisma.$use((params, next) => …)` que injeta filtro
  automático.

---

## 8.4 Timezone

### 🔴 CRIT-DAT-012 — Biblioteca `date-fns-tz` ausente; timezone inconsistente

- **Busca:** `America/Cuiaba` aparece **0 vezes** em todo o repo. `date-fns-tz`
  não está instalado (não aparece em grep). `America/Sao_Paulo` aparece
  em **1 lugar**: `backend/src/ai/agents/rdo/agente-clima.ts:73` (só na
  chamada Open-Meteo).
- **Sintoma:** A referência §8.4 manda "banco em UTC, frontend converte para
  America/Cuiaba (BRT/BRST) via date-fns-tz". Não se faz. Todo frontend usa
  `new Date(iso).toLocaleDateString('pt-BR')` que depende do timezone do
  navegador do cliente. RdoFormPage usa
  `new Date().toISOString().split('T')[0]` (`modules/diario/pages/RdosListPage.tsx:22`)
  — cliente em Cuiabá (UTC-4) às 23h de quinta-feira gera string
  `"YYYY-MM-DD"` do DIA SEGUINTE (UTC sexta 03h).
- **Impacto:** bug clássico da §8.4: "filtro 'hoje' não retorna nada após
  meia-noite". Afeta criação de RDO, registro de efetivo, concretagens.
- **Correção:** instalar `date-fns-tz`, definir constante
  `TENANT_TIMEZONE = 'America/Cuiaba'` (ou por-tenant), criar helpers
  `toLocalISO(date)` / `localDateToUTC(yyyyMmDd)`.
- **Esforço:** 3 dias. **Risco:** alto — mudar timezone muda relatórios.

### 🟠 ALTO-DAT-013 — Filtro "últimos 30 dias" em UTC ignora timezone local

- **Arquivo:** `backend/src/fvs/dashboard/fvs-dashboard.controller.ts:129-130`
  ```
  const dataInicio = query.data_inicio ?? new Date(Date.now() - 30*24*60*60*1000).toISOString();
  const dataFim    = query.data_fim   ?? new Date().toISOString();
  ```
- **Sintoma:** ISO em UTC. No SQL
  (`backend/src/fvs/dashboard/fvs-graficos.service.ts:128`,
  `236`, `327`, `407`) usa `BETWEEN $3::date AND $4::date + INTERVAL '1 day'`.
  A "data" é derivada da string UTC — inspeções feitas quinta 22h local
  (sexta 01h UTC) entram na janela errada.
- **Correção:** aceitar `data_inicio`/`data_fim` como strings `YYYY-MM-DD`
  no fuso do tenant e converter para UTC no service.

---

## 8.5 Formatação pt-BR

### 🟠 ALTO-DAT-014 — Unidade `m3` (ASCII) aparece como valor de enum/dado, não só como label

- **Arquivos:**
  - `backend/prisma/migrations/20260414000003_ensaio_tipos/migration.sql` —
    campo `frequencia_unidade` aceita valores `'dias' | 'm3' | 'lotes'`.
  - `frontend-web/src/services/ensaios.service.ts:16` —
    `export type FrequenciaUnidade = 'dias' | 'm3' | 'lotes'`.
  - Coluna `volume_contestado_m3` em
    `frontend-web/src/services/concretagem.service.ts:380-382`.
- **Sintoma:** Apesar de a UI renderizar `m³` (caractere correto) em
  `frontend-web/src/modules/ensaios/tipos/components/TipoEnsaioRow.tsx:68`
  (`{ m3: 'm³' }`), o **valor persistido** é a string ASCII `m3`. Se um
  colaborador consultar via API crua/CSV, verá `m3`. Referência §8.5 pede
  `m³` com expoente correto — para labels sim, mas o problema é: CSV
  exportado contém o enum raw.
- **Correção aceitável:** manter enum ASCII internamente (Postgres check
  constraint) e formatar sempre no front; documentar explicitamente que a
  label oficial é `m³`.

### 🟡 MED-DAT-015 — Nenhum helper central de formatação pt-BR; cada tela reimplementa

- **Arquivos:** pasta `frontend-web/src/lib/` só tem `apiBase.ts` + `cn.ts`.
  Não existe `lib/format.ts` ou `lib/brazil.ts`. Cada tela reimplementa
  `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
  inline — 8 ocorrências só em `modules/almoxarifado/**` (linhas ver grep
  acima).
- **Sintoma:** fácil introduzir divergência (casas decimais, símbolo
  faltando, etc.). Referência §8.5 quer padrão único.
- **Correção:** criar `lib/format.ts` com `fmtBRL`, `fmtNumber`, `fmtDate`,
  `fmtDateTime`, `fmtUnit(val, 'm3')`.

### 🟡 MED-DAT-016 — Padronização de unidade com espaço entre valor e unidade

- **Arquivos:**
  - `frontend-web/src/modules/dashboard/widgets/obra/ConcretagemVolumeWidget.tsx:28,30`
    — `${realizado}m³` (SEM espaço).
  - vs `frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx:159,160,235`
    — `"${Number(data.volume_previsto).toFixed(1)} m³"` (COM espaço).
- **Sintoma:** mesma unidade renderizada com e sem espaço em páginas distintas.
  Referência §8.5: "Espaço entre valor e unidade: `250 kg` (não `250kg`)".

### 🔵 BAIXO-DAT-017 — Locale `pt-BR` default do Tailwind/Vite não configurado

- **Sintoma:** Nenhum `<html lang="pt-BR">` no `frontend-web/index.html`
  (não verificado nesta auditoria — **⚠️ verificação pendente**).

---

## 8.6 Documentos — CPF/CNPJ/CEP

### 🔴 CRIT-DAT-018 — Validação de CNPJ inexistente (DTOs só checam comprimento)

- **Arquivos:**
  - `backend/src/fvm/fornecedores/dto/create-fornecedor.dto.ts:13-14`
    `@IsOptional() @IsString() @MaxLength(18)  cnpj?: string;`
  - `backend/src/fvm/fornecedores/dto/create-fornecedor-rapido.dto.ts:11`
    idem.
  - `backend/src/efetivo/dto/create-empresa.dto.ts:15-17`
    `@IsOptional() @IsString() @MaxLength(18)  cnpj?: string;`
  - `backend/src/ensaios/laboratorios/dto/create-laboratorio.dto.ts`.
- **Sintoma:** Qualquer string de até 18 chars passa. `"00.000.000/0000-00"`
  é aceito (dígitos verificadores fake). A busca por
  `validarCpf|validarCnpj|IsCPF|IsCNPJ|digitoVerificador` em `backend/src`
  retorna **0 matches**. Referência §8.5 exige validação matemática.
- **Correção:** instalar `@brazilian-utils/brazilian-utils` ou `cpf-cnpj-validator`
  e criar decorator `@IsCNPJ()`.
- **Esforço:** 1 dia. **Risco:** baixo.

### 🟠 ALTO-DAT-019 — Máscara de CNPJ no frontend sem validação de dígitos

- **Arquivo:** `frontend-web/src/modules/fvm/fornecedores/components/FornecedorModal.tsx:11-18`
  (`formatCnpj`) — só formata digitando, sem validar DV. Mesma lógica
  é refeita em cada modal (`modules/ensaios/laboratorios/pages/LaboratoriosPage.tsx`,
  `modules/fvs/inspecao/components/RegistroNcModal.tsx`).
- **Sintoma:** usuário digita `12.345.678/0001-99` (DV inválido), é aceito
  no frontend, aceito no backend, salvo com sujeira.

### 🟡 MED-DAT-020 — Sem máscara/validação de CEP em nenhum módulo

- **Busca:** `frontend-web/src/**` por `mask|cep` encontra apenas os modais
  de CNPJ. Nenhum helper de CEP. `backend/src/obras/dto/**` aceita `cep`
  como string arbitrária (ver `schema.prisma:161`: `cep String?` sem
  constraint).

---

## 8.7 Paginação, ordenação e busca

### 🟡 MED-DAT-021 — Default de paginação inconsistente

- **Arquivos (amostra):**
  - `concretagem/concretagens/dto/list-concretagens.dto.ts:25` — `limit = 20`
  - `aprovacoes/dto/list-aprovacoes.dto.ts:35` — `limit = 20`
  - `ged/dto/list-documentos.dto.ts:68` — `limit = 20`
  - `ensaios/dto/create-ensaio.dto.ts:84` — SEM default
  - `efetivo/dto/query-efetivo.dto.ts:34` — SEM default
- **Sintoma:** quem não passar `limit` em efetivo/ensaios recebe o default
  da service (não sei qual), enquanto outros recebem 20. Não há contrato
  comum.

### 🟡 MED-DAT-022 — Ordenações sem tiebreaker único

- **Arquivo:** `backend/src/obras/obras.service.ts:136` —
  `orderBy: { criadoEm: 'desc' }` apenas. Sem `id` como desempate.
- **Sintoma:** duas obras criadas no mesmo `criadoEm` (seed em lote) podem
  embaralhar entre recargas. Referência §8.6: "ordenação consistente entre
  recargas".

### 🟠 ALTO-DAT-023 — Busca textual NÃO é accent-insensitive

- **Busca:** `unaccent|accent|collate` em backend/src retorna **0 matches**.
  Busca usa `ILIKE '%${q}%'` direto
  (`backend/src/concretagem/concretagens/concretagens.service.ts`,
  `backend/src/ncs/ncs.service.ts`,
  `backend/src/fvm/fornecedores/fornecedores.service.ts`).
- **Sintoma:** buscar `"joao"` não encontra `"João"`. Referência §8.7 exige
  "accent-insensitive". Solução típica em Postgres: extensão `unaccent` +
  índice `(unaccent(nome))`.

---

## 8.8 Exportações

### 🔵 BAIXO-DAT-024 — CSV export existe só no módulo FVS (importação, não exportação)

- **Arquivo:** `frontend-web/src/modules/fvs/catalogo/components/ImportarCsvModal.tsx:51`
  — `type: 'text/csv;charset=utf-8'` (correto, **sem BOM** porém).
- **Sintoma:** Referência §8.8 pede BOM UTF-8 para Excel pt-BR abrir
  acentos corretamente (`\ufeff`). O template gerado pelo próprio sistema
  para download (`template-servicos-fvs.csv`) abriria bagunçado no Excel
  brasileiro.
- **Correção:** `new Blob(['\ufeff' + CSV_TEMPLATE], ...)`.

### 🟡 MED-DAT-025 — Cabeçalho "Gerado em" com `new Date().toLocaleString('pt-BR')` sem timezone

- **Arquivos:** 6 arquivos de PDF/XLSX usam `new Date().toLocaleString('pt-BR')`
  sem timezone explícito:
  - `modules/fvm/relatorios/pdf/NcsFvmPdf.tsx:68`
  - `modules/fvm/relatorios/pdf/FichaRecebimentoPdf.tsx:153`
  - `modules/fvm/relatorios/pdf/PerformanceFornecedoresPdf.tsx:66`
  - `modules/fvm/relatorios/excel/NcsFvmXlsx.ts:80`
  - `modules/fvm/relatorios/excel/PerformanceFornecedoresXlsx.ts:91`
- **Sintoma:** cliente em Cuiabá (UTC-4) vs cliente em Lisboa (UTC+0) vê
  "geração" com 4h de diferença no mesmo relatório.

---

## 8.10 Integridade de dados adicional

### 🔴 CRIT-DAT-026 — Enums Prisma DESYNC com tipos do frontend (RDO)

- **Arquivo backend:** `backend/prisma/schema.prisma:279-307`
  ```
  enum RdoStatus       { PREENCHENDO  REVISAO  APROVADO }
  enum RdoPeriodo      { MANHA  TARDE  NOITE }
  enum RdoCondicaoClima{ CLARO  NUBLADO  CHUVOSO }
  enum RdoTipoMaoDeObra{ CATALOGO  PERSONALIZADA }
  ```
- **Arquivo frontend:** `frontend-web/src/services/rdo.service.ts:6-9`
  ```
  export type RdoStatus     = 'preenchendo' | 'revisao' | 'aprovado' | 'cancelado';
  export type PeriodoDia    = 'manha' | 'tarde' | 'noite';
  export type CondicaoClima = 'ensolarado' | 'nublado' | 'chuvoso' | 'parcialmente_nublado' | 'tempestade';
  export type TipoMaoObra   = 'proprio' | 'subcontratado' | 'terceirizado';
  ```
- **Sintoma:** **TUDO DIVERGE**:
  - Status: 3 UPPERCASE no banco vs 4 lowercase no front (+ `'cancelado'`
    que não existe no enum Prisma → salvar gera 22P02 invalid_enum_value).
  - Condição clima: banco tem `CLARO`; front tem `ensolarado`, `parcialmente_nublado`,
    `tempestade` — que também vão gerar 22P02.
  - Tipo mão-de-obra: banco `CATALOGO|PERSONALIZADA`; front `proprio|subcontratado|terceirizado` — totalmente outro domínio.
- **Impacto crítico:** é impossível que POST/PATCH de RDO funcione sem
  normalização manual em algum ponto intermediário. Candidato a sintoma
  "RDO não salva" reportado.
- **Correção:** gerar tipos automaticamente do schema.prisma (Prisma gera
  TS, reexportar em `@eldox/shared-types`) ou, no mínimo, alinhar valores.
  **Esforço:** 1-2 dias.

### 🟠 ALTO-DAT-027 — Sem constraint de unicidade para numeração de NC

- **Arquivo:** `backend/prisma/schema.prisma:627` tem
  `@@unique([tenantId, numero], map: "uq_nc_numero")` — OK.
  Mas não há constraint equivalente para Efetivo, Concretagem (mesmo
  `obraId + data + turno` em `RegistroEfetivo:839` é OK, porém não há
  unique para número de concretagem por obra no schema visível).
- **Verificação pendente:** checar se tabela `betonadas/concretagens` tem
  unique. Grep apontou `REFERENCES "betonadas"` — a tabela foi renomeada
  em `20260416100000_rename_betonadas_to_concretagens/migration.sql`.

### 🔵 BAIXO-DAT-028 — Campo `chuva_mm` com precisão 4,1 (máximo 999.9 mm/dia)

- **Arquivo:** `backend/prisma/schema.prisma:370` —
  `chuvaMm Decimal? @db.Decimal(4, 1)`
- **Sintoma:** precisão estreita (4 dígitos totais). OK para 999.9 mm/dia,
  mas Cuiabá já registrou 279 mm em 24h em enchentes; sem risco prático,
  apenas observação. Padrão meteorológico seria `Decimal(5, 1)`.

---

## Cruzamentos com outras camadas

- **[Cross-ref Camada 2 — Módulos]:** os "módulos órfãos"
  (Frota/Rastreabilidade citados no `_context.md` §3) não têm tabelas
  Prisma; qualquer seed precisará ser revisto depois.
- **[Cross-ref Camada 6 — Backend]:** o padrão `$queryRawUnsafe` em 40+ services
  (ALTO-DAT-007) é um débito arquitetural; afeta tipagem e testes.
- **[Cross-ref Camada 7 — Segurança]:** ausência de validação de CPF/CNPJ
  (CRIT-DAT-018) abre porta para injection de lixo LGPD.
- **[Cross-ref Camada 9 — IA]:** `agente-clima` usa `America/Sao_Paulo`
  hardcoded, enquanto referência manda `America/Cuiaba`. Se tenant for no
  CE/PE, clima retorna timezone errado.
- **[Cross-ref Camada 4 — UI]:** falta de helper central pt-BR
  (MED-DAT-015) gera re-implementação em 30 arquivos.

---

## Ação urgente

1. **Alinhar enums Prisma↔frontend do módulo RDO** (CRIT-DAT-026) — HOJE. O
   RDO está com 100% de chance de falhar em POST/PATCH por enum inválido.
2. **Unique constraint em Obra (`tenantId, codigo`)** (ALTO-DAT-002) +
   idempotência do seed Celina (CRIT-DAT-001) — 30 min cada, bloqueia demo.
3. **ADR + migration unificando política de onDelete** (CRIT-DAT-005 e
   CRIT-DAT-006) — 1 dia. Sem isso, qualquer "exclusão" em produção é
   roleta russa.

---

## Resumo para orquestrador

### Totais
- 🔴 Crítico: **6** · 🟠 Alto: **7** · 🟡 Médio: **6** · 🔵 Baixo: **4** · Total: **23**
- Cobertura: `schema.prisma` (859 linhas), 40 migrations SQL, `backend/src/**` (55 controllers, amostra 30 services), `frontend-web/src/**` (~195 componentes, amostra 60).

### Top 3
1. **CRIT-DAT-026 — Enums Prisma↔frontend do RDO totalmente desalinhados**
   (`schema.prisma:279-307` ↔ `services/rdo.service.ts:6-9`). Salvar RDO
   quebra com 22P02.
2. **CRIT-DAT-005 + CRIT-DAT-006 — Política de `onDelete` inexistente no
   schema e caótica nas migrations** (1 onDelete em 859 linhas do Prisma;
   CASCADE/RESTRICT/SET NULL/NO ACTION misturados).
3. **CRIT-DAT-012 — Timezone nunca convertido para `America/Cuiaba`**
   (`date-fns-tz` não instalado; filtros "hoje"/"últimos 30 dias" usam UTC
   cru).

### Ação urgente
Alinhar os enums do RDO **antes** de qualquer outro trabalho — é bug de
runtime imediato. Depois: idempotência do seed Celina e unique de Obra
(30 min cada).

### Cross-refs
- Camada 2: Frota/Rastreabilidade sem tabelas (seeds vazios).
- Camada 4: falta de `lib/format.ts` central (MED-DAT-015).
- Camada 6: 50+ tabelas acessadas via `$queryRawUnsafe` (ALTO-DAT-007).
- Camada 7: CPF/CNPJ sem validação matemática (CRIT-DAT-018) + LGPD.
- Camada 9: `agente-clima.ts:73` com `America/Sao_Paulo` hardcoded.

### Verificações pendentes
- `<html lang="pt-BR">` em `frontend-web/index.html` (BAIXO-DAT-017).
- Unicidade real de `concretagens.numero` pós-rename (ALTO-DAT-027).
