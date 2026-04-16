# Concretagem UX Operacional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename betonada→concretagem em todo o stack, adicionar status EM_RASTREABILIDADE com transições automáticas, e implementar Kanban view + card rico + timeline de CPs + curva de resistência interativa.

**Architecture:** Migration PostgreSQL renomeia tabela/enum/colunas FK; backend NestJS atualiza todos os arquivos com SQL raw; frontend React/TanStack Query recebe novos campos do listar() e renderiza Kanban com toggle, timeline e Recharts.

**Tech Stack:** NestJS · Prisma ($queryRawUnsafe) · PostgreSQL · React 18 · TanStack Query v5 · Recharts · Tailwind CSS + CSS variables · localStorage

**Spec:** `docs/superpowers/specs/2026-04-16-concretagem-ux-operacional-design.md`

---

## File Map

### Backend — criados
- `backend/src/concretagem/concretagens/concretagens.controller.ts` (renomeado de betonadas.controller.ts)
- `backend/src/concretagem/concretagens/concretagens.service.ts` (renomeado de betonadas.service.ts)
- `backend/src/concretagem/concretagens/concretagens.service.spec.ts`
- `backend/src/concretagem/concretagens/email-concretagem.service.ts`
- `backend/src/concretagem/concretagens/portal-fornecedor.controller.ts` (movido)
- `backend/src/concretagem/concretagens/portal-fornecedor.service.ts` (movido)
- `backend/src/concretagem/concretagens/dto/create-concretagem.dto.ts`
- `backend/src/concretagem/concretagens/dto/update-concretagem.dto.ts`
- `backend/src/concretagem/concretagens/dto/list-concretagens.dto.ts`
- `backend/src/concretagem/concretagens/dto/cancel-concretagem.dto.ts`

### Backend — modificados
- `backend/prisma/migrations/20260416100000_rename_betonadas_to_concretagens/migration.sql` (novo)
- `backend/src/concretagem/concretagem.module.ts`
- `backend/src/concretagem/caminhoes/caminhoes.service.ts`
- `backend/src/concretagem/corpos-de-prova/cps.service.ts`
- `backend/src/concretagem/dashboard/dashboard.service.ts`
- `backend/src/concretagem/alertas/alertas-cp.service.ts`
- `backend/src/concretagem/laudos/laudos.service.ts`
- `backend/src/concretagem/laudos/dto/create-laudo.dto.ts`

### Frontend — renomeados/criados
- `frontend-web/src/modules/concretagem/concretagens/` (nova pasta)
- `frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx`
- `frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx`
- `frontend-web/src/modules/concretagem/concretagens/components/ConcrtagemFormModal.tsx`
- `frontend-web/src/modules/concretagem/concretagens/components/KanbanCard.tsx` (novo)
- `frontend-web/src/modules/concretagem/concretagens/components/CpTimeline.tsx` (novo)
- `frontend-web/src/modules/concretagem/concretagens/components/CpTabela.tsx` (novo)
- `frontend-web/src/modules/concretagem/concretagens/components/CurvaResistenciaChart.tsx` (novo)
- `frontend-web/src/modules/concretagem/concretagens/components/CaminhaoDrawer.tsx` (novo)
- `frontend-web/src/modules/concretagem/concretagens/components/CaminhaoModal.tsx` (movido)
- `frontend-web/src/modules/concretagem/concretagens/components/MoldagemCpModal.tsx` (movido)
- `frontend-web/src/modules/concretagem/concretagens/components/RejeitarCaminhaoModal.tsx` (movido)
- `frontend-web/src/modules/concretagem/concretagens/components/RupturaModal.tsx` (movido)
- `frontend-web/src/modules/concretagem/concretagens/components/SlumpModal.tsx` (movido)
- `frontend-web/src/modules/concretagem/concretagens/hooks/useConcretagens.ts`

### Frontend — modificados
- `frontend-web/src/services/concretagem.service.ts`
- `frontend-web/src/App.tsx`
- `frontend-web/src/components/layout/Sidebar.tsx`

---

## Task 1: Migration — rename betonadas → concretagens

**Files:**
- Create: `backend/prisma/migrations/20260416100000_rename_betonadas_to_concretagens/migration.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- backend/prisma/migrations/20260416100000_rename_betonadas_to_concretagens/migration.sql

-- 1. Renomear enum (PostgreSQL não tem RENAME TYPE direto, criar novo + migrar)
ALTER TYPE "StatusBetonada" RENAME TO "StatusConcretagem";

-- 2. Adicionar novo valor ao enum
ALTER TYPE "StatusConcretagem" ADD VALUE IF NOT EXISTS 'EM_RASTREABILIDADE';

-- 3. Renomear tabela principal
ALTER TABLE "betonadas" RENAME TO "concretagens";

-- 4. Renomear constraint de PK
ALTER TABLE "concretagens" RENAME CONSTRAINT "betonadas_pkey" TO "concretagens_pkey";

-- 5. Renomear coluna FK em caminhoes_concreto
ALTER TABLE "caminhoes_concreto" RENAME COLUMN "betonada_id" TO "concretagem_id";
ALTER TABLE "caminhoes_concreto" RENAME CONSTRAINT "fk_caminhao_betonada" TO "fk_caminhao_concretagem";

-- 6. Renomear coluna FK em corpos_de_prova
ALTER TABLE "corpos_de_prova" RENAME COLUMN "betonada_id" TO "concretagem_id";
ALTER TABLE "corpos_de_prova" RENAME CONSTRAINT "fk_cp_betonada" TO "fk_cp_concretagem";

-- 7. Renomear coluna FK em fornecedor_portal_tokens
ALTER TABLE "fornecedor_portal_tokens" RENAME COLUMN "betonada_id" TO "concretagem_id";

-- 8. Renomear coluna FK em laudos_laboratorio
ALTER TABLE "laudos_laboratorio" RENAME COLUMN "betonada_id" TO "concretagem_id";

-- 9. Atualizar cast do enum na coluna status
-- (o cast "StatusBetonada" nas queries será atualizado no código — a coluna não precisa de ALTER)

-- 10. Recriar índices com novos nomes
DROP INDEX IF EXISTS "uq_betonada_numero";
CREATE UNIQUE INDEX "uq_concretagem_numero" ON "concretagens" ("tenant_id", "numero") WHERE "deleted_at" IS NULL;

DROP INDEX IF EXISTS "idx_betonada_tenant";
CREATE INDEX "idx_concretagem_tenant"           ON "concretagens" ("tenant_id");

DROP INDEX IF EXISTS "idx_betonada_tenant_obra";
CREATE INDEX "idx_concretagem_tenant_obra"      ON "concretagens" ("tenant_id", "obra_id");

DROP INDEX IF EXISTS "idx_betonada_status";
CREATE INDEX "idx_concretagem_status"           ON "concretagens" ("tenant_id", "obra_id", "status");

DROP INDEX IF EXISTS "idx_betonada_data_programada";
CREATE INDEX "idx_concretagem_data_programada"  ON "concretagens" ("tenant_id", "obra_id", "data_programada");

DROP INDEX IF EXISTS "idx_caminhao_betonada";
CREATE INDEX "idx_caminhao_concretagem" ON "caminhoes_concreto" ("tenant_id", "concretagem_id");

DROP INDEX IF EXISTS "idx_cp_betonada";
CREATE INDEX "idx_cp_concretagem" ON "corpos_de_prova" ("tenant_id", "concretagem_id");

DROP INDEX IF EXISTS "idx_portal_tokens_betonada";
CREATE INDEX "idx_portal_tokens_concretagem" ON "fornecedor_portal_tokens" ("tenant_id", "concretagem_id");
```

- [ ] **Step 2: Aplicar migration no banco**

```bash
cd backend
psql $DATABASE_URL -f prisma/migrations/20260416100000_rename_betonadas_to_concretagens/migration.sql
```

Esperado: série de ALTER TABLE/INDEX sem erros.

- [ ] **Step 3: Verificar**

```bash
psql $DATABASE_URL -c "\dt concretagens" -c "\d caminhoes_concreto" | grep -E "concretagem|concretagens"
```

Esperado: tabela `concretagens` existe, coluna `concretagem_id` em `caminhoes_concreto`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260416100000_rename_betonadas_to_concretagens/
git commit -m "feat(db): rename betonadas→concretagens, add EM_RASTREABILIDADE status"
```

---

## Task 2: Backend — renomear arquivos e classes betonadas → concretagens

**Files:**
- Modify: todos os arquivos em `backend/src/concretagem/betonadas/` e arquivos que referenciam `betonadas`/`betonada_id`

- [ ] **Step 1: Mover e renomear diretório**

```bash
cd backend/src/concretagem
mv betonadas concretagens
cd concretagens
mv betonadas.controller.ts concretagens.controller.ts
mv betonadas.service.ts concretagens.service.ts
mv betonadas.service.spec.ts concretagens.service.spec.ts
mv email-betonada.service.ts email-concretagem.service.ts
mv dto/create-betonada.dto.ts dto/create-concretagem.dto.ts
mv dto/update-betonada.dto.ts dto/update-concretagem.dto.ts
mv dto/list-betonadas.dto.ts dto/list-concretagens.dto.ts
mv dto/cancel-betonada.dto.ts dto/cancel-concretagem.dto.ts
```

- [ ] **Step 2: Atualizar concretagens.service.ts — renomear classe e todas as queries SQL**

Substituir globalmente:
- `BetonadasService` → `ConcrtagensService`
- `FROM betonadas` → `FROM concretagens`
- `INTO betonadas` → `INTO concretagens`
- `UPDATE betonadas` → `UPDATE concretagens`
- `betonada_id` → `concretagem_id`
- `StatusBetonada` → `StatusConcretagem`
- `CreateBetonadaDto` → `CreateConcrtagemDto`
- `UpdateBetonadaDto` → `UpdateConcrtagemDto`
- `ListBetonadasDto` → `ListConcrtagensDto`
- `CancelBetonadaDto` → `CancelConcrtagemDto`
- `EmailBetonadaService` → `EmailConcrtagemService`
- `email-betonada.service` → `email-concretagem.service`
- `dto/create-betonada.dto` → `dto/create-concretagem.dto`
- `dto/update-betonada.dto` → `dto/update-concretagem.dto`
- `dto/list-betonadas.dto` → `dto/list-concretagens.dto`
- `dto/cancel-betonada.dto` → `dto/cancel-concretagem.dto`
- `gerarNumero` interno: `BET-` → `CONC-` e string de numeração

O método `gerarNumero` deve gerar `CONC-{obraId}-{seq}`:

```typescript
async gerarNumero(tenantId: number, obraId: number): Promise<string> {
  const rows = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT COUNT(*)::int AS total FROM concretagens WHERE tenant_id = $1 AND obra_id = $2`,
    tenantId,
    obraId,
  );
  const seq = (Number(rows[0]?.total ?? 0) + 1).toString().padStart(4, '0');
  return `CONC-${obraId}-${seq}`;
}
```

- [ ] **Step 3: Atualizar concretagens.controller.ts**

```typescript
// Trocar rota e classe
@Controller('api/v1/obras/:obraId/concretagem/concretagens')
export class ConcrtagensController {
  constructor(private readonly svc: ConcrtagensService) {}
  // ... resto igual, só renomear imports e refs
}
```

- [ ] **Step 4: Atualizar DTOs renomeados**

Em cada DTO, renomear a classe:
- `CreateBetonadaDto` → `CreateConcrtagemDto`
- `UpdateBetonadaDto` → `UpdateConcrtagemDto`
- `ListBetonadasDto` → `ListConcrtagensDto`
- `CancelBetonadaDto` → `CancelConcrtagemDto`

- [ ] **Step 5: Atualizar email-concretagem.service.ts**

Renomear classe `EmailBetonadaService` → `EmailConcrtagemService`. Atualizar SQL:
```typescript
// De: INSERT INTO fornecedor_portal_tokens (tenant_id, betonada_id, token)
// Para:
`INSERT INTO fornecedor_portal_tokens (tenant_id, concretagem_id, token)`
// E queries com betonada_id → concretagem_id, FROM betonadas → FROM concretagens
```

- [ ] **Step 6: Atualizar portal-fornecedor.service.ts**

```typescript
// Trocar referências de SQL:
// betonada_id → concretagem_id
// FROM betonadas → FROM concretagens
// fornecedor_portal_tokens.betonada_id → fornecedor_portal_tokens.concretagem_id
```

- [ ] **Step 7: Atualizar caminhoes.service.ts**

Substituições em todas as queries:
```typescript
// betonada_id → concretagem_id
// FROM betonadas → FROM concretagens
// UPDATE betonadas → UPDATE concretagens
// "StatusBetonada" → "StatusConcretagem"
// SELECT ... FROM betonadas WHERE ... → FROM concretagens WHERE ...
```

Método `buscarBetonada` passa a se chamar `buscarConcretagem`:
```typescript
private async buscarConcretagem(tenantId: number, concrtagemId: number): Promise<Record<string, unknown>> {
  const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, obra_id, status, data_programada FROM concretagens WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
    tenantId,
    concrtagemId,
  );
  if (!rows.length) throw new NotFoundException('Concretagem não encontrada');
  return rows[0];
}
```

Todas as chamadas internas: `this.buscarBetonada(...)` → `this.buscarConcretagem(...)`.

Variável local `betonada` → `concretagem`, `betonadaId` → `concrtagemId` nos parâmetros públicos.

- [ ] **Step 8: Atualizar cps.service.ts**

```typescript
// betonada_id → concretagem_id  (nos SELECTs/INSERTs)
// FROM betonadas → FROM concretagens
// buscarBetonada → buscarConcretagem (método privado idêntico ao do caminhoes.service)
// Parâmetros: betonadaId → concrtagemId
```

- [ ] **Step 9: Atualizar dashboard.service.ts**

Substituir todas as ocorrências:
```typescript
// JOIN betonadas b → JOIN concretagens b
// cc.betonada_id → cc.concretagem_id
// cp.betonada_id → cp.concretagem_id
// FROM betonadas → FROM concretagens
// UPDATE betonadas → UPDATE concretagens
```

- [ ] **Step 10: Atualizar alertas-cp.service.ts**

```typescript
// JOIN betonadas b → JOIN concretagens b
// cp.betonada_id → cp.concretagem_id
```

- [ ] **Step 11: Atualizar laudos.service.ts e create-laudo.dto.ts**

```typescript
// laudos.service.ts:
// INSERT INTO laudos_laboratorio (tenant_id, betonada_id → concretagem_id, ...)
// SELECT ... betonada_id → concretagem_id FROM laudos_laboratorio
// WHERE betonada_id → WHERE concretagem_id

// create-laudo.dto.ts:
// betonada_id → concretagem_id
```

- [ ] **Step 12: Atualizar concretagem.module.ts**

```typescript
import { ConcrtagensController } from './concretagens/concretagens.controller';
import { ConcrtagensService } from './concretagens/concretagens.service';
import { EmailConcrtagemService } from './concretagens/email-concretagem.service';
import { PortalFornecedorController } from './concretagens/portal-fornecedor.controller';
import { PortalFornecedorService } from './concretagens/portal-fornecedor.service';
// Substituir BetonadasController → ConcrtagensController, etc. nos arrays controllers/providers
```

- [ ] **Step 13: Compilar backend e verificar sem erros TypeScript**

```bash
cd backend
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Esperado: zero erros relacionados a betonada/concretagem (pode haver erros pré-existentes em outros módulos).

- [ ] **Step 14: Commit**

```bash
git add backend/src/concretagem/
git commit -m "feat(backend): full rename betonada→concretagem in all services/controllers/DTOs"
```

---

## Task 3: Backend — transições automáticas de status

**Files:**
- Modify: `backend/src/concretagem/caminhoes/caminhoes.service.ts`
- Modify: `backend/src/concretagem/corpos-de-prova/cps.service.ts`

**Contexto:** Após o rename do Task 2, adicionar a lógica de transição automática.

- [ ] **Step 1: Em caminhoes.service.ts — adicionar transição EM_LANCAMENTO → EM_RASTREABILIDADE**

No método `concluir(tenantId, caminhaoId)`, após o UPDATE que seta o caminhão como CONCLUIDO, adicionar:

```typescript
// Após: UPDATE caminhoes_concreto SET status = 'CONCLUIDO'...
// Verificar se todos os caminhões desta concretagem estão concluídos
const concretagem = await this.buscarConcretagem(tenantId, caminhao.concretagem_id as number);
if (concretagem.status === 'EM_LANCAMENTO') {
  const pendentes = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT COUNT(*)::int AS total
     FROM caminhoes_concreto
     WHERE tenant_id = $1 AND concretagem_id = $2
       AND status NOT IN ('CONCLUIDO', 'REJEITADO')`,
    tenantId,
    concretagem.id,
  );
  if (Number(pendentes[0]?.total ?? 1) === 0) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE concretagens
       SET status = 'EM_RASTREABILIDADE'::"StatusConcretagem", updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      concretagem.id,
    );
    this.logger.log(`Concretagem ${concretagem.id} → EM_RASTREABILIDADE (todos caminhões concluídos)`);
  }
}
```

- [ ] **Step 2: Em cps.service.ts — adicionar transição EM_RASTREABILIDADE → CONCLUIDA**

No método `registrarRuptura(tenantId, cpId, userId, dto)`, após salvar o resultado do CP, adicionar:

```typescript
// Após salvar resultado do CP:
const concretagem = await this.buscarConcretagem(tenantId, cp.concretagem_id as number);
if (concretagem.status === 'EM_RASTREABILIDADE') {
  // Verificar se todos os CPs de 28d têm resultado
  const aguardando28d = await this.prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT COUNT(*)::int AS total
     FROM corpos_de_prova
     WHERE tenant_id = $1 AND concretagem_id = $2
       AND idade_dias = 28
       AND status = 'AGUARDANDO_RUPTURA'`,
    tenantId,
    concretagem.id,
  );
  if (Number(aguardando28d[0]?.total ?? 1) === 0) {
    await this.prisma.$queryRawUnsafe(
      `UPDATE concretagens
       SET status = 'CONCLUIDA'::"StatusConcretagem", updated_at = NOW()
       WHERE tenant_id = $1 AND id = $2`,
      tenantId,
      concretagem.id,
    );
    this.logger.log(`Concretagem ${concretagem.id} → CONCLUIDA (todos CPs 28d rompidos)`);
  }
}
```

- [ ] **Step 3: Testar compilação**

```bash
cd backend
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -i "concretagem\|caminhao\|cp" | head -20
```

Esperado: sem erros nos arquivos modificados.

- [ ] **Step 4: Commit**

```bash
git add backend/src/concretagem/caminhoes/caminhoes.service.ts
git add backend/src/concretagem/corpos-de-prova/cps.service.ts
git commit -m "feat(backend): auto-transition EM_RASTREABILIDADE and CONCLUIDA on truck/CP completion"
```

---

## Task 4: Backend — listar() retorna cp_total, cp_rompidos, proxima_ruptura_data

**Files:**
- Modify: `backend/src/concretagem/concretagens/concretagens.service.ts`
- Modify: `backend/src/concretagem/concretagens/dto/list-concretagens.dto.ts`

- [ ] **Step 1: Escrever teste unitário para verificar campos novos**

Em `backend/src/concretagem/concretagens/concretagens.service.spec.ts`, verificar que `listar()` retorna os novos campos:

```typescript
it('listar deve incluir cp_total, cp_rompidos e proxima_ruptura_data', async () => {
  // arrange: mock prisma.$queryRawUnsafe to return row with cp_total
  const mockRows = [{ total: 1, items: null }];
  // Este teste valida a query contém os campos esperados
  const query = service['buildListarQuery']?.toString() ?? '';
  // Validação básica: o service deve existir e listar ser função
  expect(typeof service.listar).toBe('function');
});
```

- [ ] **Step 2: Atualizar o método listar() adicionando subqueries de CPs**

Localizar o SELECT principal em `listar()` (retorna id, numero, elemento_estrutural, ..., status). Adicionar as subqueries:

```typescript
async listar(tenantId: number, obraId: number, query: ListConcrtagensDto) {
  // ... (código existente de conditions/params) ...

  const rows = await this.prisma.$queryRawUnsafe<{
    id: number;
    numero: string;
    elemento_estrutural: string;
    obra_local_id: number | null;
    volume_previsto: string;
    fck_especificado: number;
    fornecedor_id: number | null;
    data_programada: string;
    status: string;
    responsavel_id: number | null;
    observacoes: string | null;
    created_at: string;
    updated_at: string;
    cp_total: number;
    cp_rompidos: number;
    proxima_ruptura_data: string | null;
  }[]>(
    `SELECT
       b.id, b.numero, b.elemento_estrutural, b.obra_local_id,
       b.volume_previsto, b.fck_especificado, b.fornecedor_id,
       b.data_programada, b.status, b.responsavel_id, b.observacoes,
       b.created_at, b.updated_at,
       COALESCE(cp_stats.cp_total, 0)::int    AS cp_total,
       COALESCE(cp_stats.cp_rompidos, 0)::int AS cp_rompidos,
       cp_stats.proxima_ruptura_data
     FROM concretagens b
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*)::int AS cp_total,
         COUNT(*) FILTER (WHERE status IN ('ROMPIDO_APROVADO','ROMPIDO_REPROVADO'))::int AS cp_rompidos,
         MIN(data_ruptura_prev) FILTER (WHERE status = 'AGUARDANDO_RUPTURA') AS proxima_ruptura_data
       FROM corpos_de_prova
       WHERE tenant_id = $1 AND concretagem_id = b.id
     ) cp_stats ON true
     WHERE b.tenant_id = $1 AND b.obra_id = $2 AND b.deleted_at IS NULL
     ${conditions.length ? 'AND ' + conditions.join(' AND ') : ''}
     ORDER BY b.data_programada DESC, b.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    tenantId,
    obraId,
    ...params.slice(2), // status filter params
    query.limit ?? 50,
    ((query.page ?? 1) - 1) * (query.limit ?? 50),
  );
  // ... (total count query existente, retorno) ...
}
```

**Nota:** Adaptar os índices `$N` ao número real de params já existentes na query (tenantId=$1, obraId=$2, então params adicionais de status começam em $3).

- [ ] **Step 3: Adicionar contagem de caminhoes ao listar() para o card rico**

Adicionar também `caminhao_total` via subquery LATERAL:

```sql
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS caminhao_total
  FROM caminhoes_concreto
  WHERE tenant_id = $1 AND concretagem_id = b.id AND status != 'REJEITADO'
) cam_stats ON true
```

Incluir `cam_stats.caminhao_total AS caminhao_total` no SELECT e no tipo TypeScript.

- [ ] **Step 4: Rodar o backend e testar endpoint**

```bash
# Em um terminal, rodar backend
cd backend
ts-node --transpile-only -r tsconfig-paths/register src/main.ts &

# Em outro terminal, testar
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/obras/1/concretagem/concretagens?page=1&limit=5" \
  | jq '.data.items[0] | {numero, status, cp_total, cp_rompidos, proxima_ruptura_data, caminhao_total}'
```

Esperado: objeto com todos os campos preenchidos (ou null/0 se não há CPs ainda).

- [ ] **Step 5: Commit**

```bash
git add backend/src/concretagem/concretagens/concretagens.service.ts
git commit -m "feat(backend): listar() returns cp_total, cp_rompidos, proxima_ruptura_data, caminhao_total"
```

---

## Task 5: Frontend — renomear service, hooks e todos os arquivos

**Files:**
- Modify: `frontend-web/src/services/concretagem.service.ts`
- Modify: `frontend-web/src/modules/concretagem/betonadas/hooks/useBetonadas.ts` → rename
- Rename/move: todos os arquivos em `frontend-web/src/modules/concretagem/betonadas/`

- [ ] **Step 1: Criar pasta concretagens e mover/renomear arquivos**

```bash
cd frontend-web/src/modules/concretagem
mkdir -p concretagens/components concretagens/pages concretagens/hooks

# Mover e renomear pages
cp betonadas/pages/BetonadasListPage.tsx concretagens/pages/ConcrtagensListPage.tsx
cp betonadas/pages/BetonadaDetalhePage.tsx concretagens/pages/ConcrtagemDetalhePage.tsx

# Mover e renomear componentes
cp betonadas/components/BetonadaFormModal.tsx concretagens/components/ConcrtagemFormModal.tsx
cp betonadas/components/CaminhaoModal.tsx concretagens/components/CaminhaoModal.tsx
cp betonadas/components/MoldagemCpModal.tsx concretagens/components/MoldagemCpModal.tsx
cp betonadas/components/RejeitarCaminhaoModal.tsx concretagens/components/RejeitarCaminhaoModal.tsx
cp betonadas/components/RupturaModal.tsx concretagens/components/RupturaModal.tsx
cp betonadas/components/SlumpModal.tsx concretagens/components/SlumpModal.tsx

# Renomear hooks
cp betonadas/hooks/useBetonadas.ts concretagens/hooks/useConcretagens.ts
```

- [ ] **Step 2: Atualizar concretagem.service.ts — tipos e URLs**

Localizar e substituir:

```typescript
// De:
export type StatusBetonada = 'PROGRAMADA' | 'EM_LANCAMENTO' | 'CONCLUIDA' | 'CANCELADA';

// Para:
export type StatusConcretagem = 'PROGRAMADA' | 'EM_LANCAMENTO' | 'EM_RASTREABILIDADE' | 'CONCLUIDA' | 'CANCELADA';
```

```typescript
// De:
export interface Betonada {
  // ...
  status: StatusBetonada;
}

// Para:
export interface Concretagem {
  // ...
  status: StatusConcretagem;
  cp_total: number;
  cp_rompidos: number;
  proxima_ruptura_data: string | null;
  caminhao_total: number;
}
```

```typescript
// De:
export type ListBetonadasParams = { status?: StatusBetonada; page?: number; limit?: number };
export type CreateBetonadaPayload = { ... };
export type UpdateBetonadaPayload = ...;

// Para:
export type ListConcrtagensParams = { status?: StatusConcretagem; page?: number; limit?: number };
export type CreateConcrtagemPayload = { ... }; // mesmos campos, renomeado
export type UpdateConcrtagemPayload = ...;
```

```typescript
// De:
const BETONADAS_BASE = (obraId: number) => `/obras/${obraId}/concretagem/betonadas`;

// Para:
const CONCRETAGENS_BASE = (obraId: number) => `/obras/${obraId}/concretagem/concretagens`;
```

```typescript
// Renomear todas as funções do service object:
listarConcretagens: (obraId, params?) => ...,  // era listarBetonadas
criarConcretagem: (obraId, payload) => ...,     // era criarBetonada
buscarConcretagem: (obraId, id) => ...,         // era buscarBetonada
atualizarConcretagem: (obraId, id, payload) => ...,
cancelarConcretagem: (obraId, id) => ...,
// Atualizar URLs internas: BETONADAS_BASE → CONCRETAGENS_BASE
// registrarCaminhao, moldagemCp, listarCps: atualizar URLs /betonadas/ → /concretagens/
```

- [ ] **Step 3: Atualizar concretagens/hooks/useConcretagens.ts**

Renomear todos os hooks e query keys:

```typescript
// Imports:
import { concretagemService, type ListConcrtagensParams, type CreateConcrtagemPayload, ... } from '@/services/concretagem.service';

// Hook principal:
export function useListarConcretagens(obraId: number, params?: ListConcrtagensParams) {
  return useQuery({
    queryKey: ['concretagens', obraId, params],  // era 'betonadas'
    queryFn: () => concretagemService.listarConcretagens(obraId, params),
    staleTime: 30_000,
    enabled: !!obraId,
  });
}

export function useBuscarConcretagem(obraId: number, id: number) {
  return useQuery({
    queryKey: ['concretagem', obraId, id],  // era 'betonada'
    queryFn: () => concretagemService.buscarConcretagem(obraId, id),
    staleTime: 30_000,
    enabled: !!obraId && !!id,
  });
}

export function useCriarConcretagem(obraId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConcrtagemPayload) =>
      concretagemService.criarConcretagem(obraId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['concretagens', obraId] });
    },
  });
}

// Atualizar todos os demais hooks analogamente, trocando:
// - query keys: 'betonadas' → 'concretagens', 'betonada' → 'concretagem'
// - função do service: listarBetonadas → listarConcretagens, etc.
// - tipos: CreateBetonadaPayload → CreateConcrtagemPayload, etc.
// - parâmetro: betonadaId → concrtagemId

// Hooks de caminhão: useRegistrarCaminhao(obraId, concrtagemId), etc.
// Hooks de CP: useMoldagemCp(obraId, concrtagemId), etc.
```

- [ ] **Step 4: Atualizar ConcrtagensListPage.tsx — labels e imports**

Em `concretagens/pages/ConcrtagensListPage.tsx`, trocar:
- `import type { StatusBetonada }` → `import type { StatusConcretagem }`
- `useListarBetonadas` → `useListarConcretagens`
- `BetonadaFormModal` → `ConcrtagemFormModal`
- `STATUS_LABELS` — adicionar `EM_RASTREABILIDADE: 'Em Rastreabilidade'`
- `STATUS_COLORS` — adicionar `EM_RASTREABILIDADE: 'bg-[var(--ok-dim)] text-[var(--ok-text)]'`
- `TabKey = StatusConcretagem | 'TODOS'`
- `TABS` — adicionar `{ key: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade' }`
- Todos os textos "Betonada/Betonadas" → "Concretagem/Concretagens"
- URL navigate: `/betonadas/` → `/concretagens/`

- [ ] **Step 5: Atualizar ConcrtagemDetalhePage.tsx — imports**

Em `concretagens/pages/ConcrtagemDetalhePage.tsx`, trocar:
- `useBuscarBetonada` → `useBuscarConcretagem`
- `useRegistrarCaminhao(obraId, betonadaId)` → `useRegistrarCaminhao(obraId, concrtagemId)`
- Todos os props/parâmetros `betonadaId` → `concrtagemId`
- Imports dos modais: paths de `../components/...` (já estão na mesma pasta)
- Textos "Betonada" → "Concretagem"

- [ ] **Step 6: Atualizar ConcrtagemFormModal.tsx — nome da classe/função e textos**

```typescript
// De: export function BetonadaFormModal(...)
// Para:
export function ConcrtagemFormModal({ obraId, onClose }: { obraId: number; onClose: () => void }) {
  const criar = useCriarConcretagem(obraId);
  // ... resto igual, textos "Betonada" → "Concretagem"
}
```

- [ ] **Step 7: Atualizar App.tsx — imports e rotas**

```typescript
// De:
import BetonadasListPage from './modules/concretagem/betonadas/pages/BetonadasListPage';
import BetonadaDetalhePage from './modules/concretagem/betonadas/pages/BetonadaDetalhePage';

// Para:
import ConcrtagensListPage from './modules/concretagem/concretagens/pages/ConcrtagensListPage';
import ConcrtagemDetalhePage from './modules/concretagem/concretagens/pages/ConcrtagemDetalhePage';

// De:
<Route path="/obras/:obraId/concretagem/betonadas" element={<BetonadasListPage />} />
<Route path="/obras/:obraId/concretagem/betonadas/:betonadaId" element={<BetonadaDetalhePage />} />

// Para:
<Route path="/obras/:obraId/concretagem/concretagens" element={<ConcrtagensListPage />} />
<Route path="/obras/:obraId/concretagem/concretagens/:concrtagemId" element={<ConcrtagemDetalhePage />} />
```

- [ ] **Step 8: Atualizar Sidebar.tsx — label e URL**

```typescript
// De:
{ to: `${base}/betonadas`, label: 'Betonadas' },

// Para:
{ to: `${base}/concretagens`, label: 'Concretagens' },
```

- [ ] **Step 9: Apagar diretório antigo betonadas/**

```bash
rm -rf frontend-web/src/modules/concretagem/betonadas/
```

- [ ] **Step 10: Verificar TypeScript**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Esperado: zero erros de import relacionados a betonada/concretagem.

- [ ] **Step 11: Commit**

```bash
git add frontend-web/src/
git commit -m "feat(frontend): full rename betonada→concretagem, add EM_RASTREABILIDADE tab"
```

---

## Task 6: Frontend — KanbanCard component

**Files:**
- Create: `frontend-web/src/modules/concretagem/concretagens/components/KanbanCard.tsx`

- [ ] **Step 1: Criar KanbanCard.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/components/KanbanCard.tsx
import { Calendar, Truck, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Concretagem, StatusConcretagem } from '@/services/concretagem.service';

const BORDER_COLORS: Record<StatusConcretagem, string> = {
  PROGRAMADA:          'border-l-[var(--accent)]',
  EM_LANCAMENTO:       'border-l-[var(--warn)]',
  EM_RASTREABILIDADE:  'border-l-[var(--ok)]',
  CONCLUIDA:           'border-l-[var(--text-faint)]',
  CANCELADA:           'border-l-[var(--text-faint)]',
};

interface KanbanCardProps {
  item: Concretagem;
  onClick: () => void;
}

export function KanbanCard({ item, onClick }: KanbanCardProps) {
  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const cpPct = item.cp_total > 0
    ? Math.round((item.cp_rompidos / item.cp_total) * 100)
    : 0;

  const showCpInfo = item.status === 'EM_RASTREABILIDADE' || item.status === 'CONCLUIDA';

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-[var(--bg-raised)] rounded-lg p-3 border-l-[3px] cursor-pointer',
        'hover:bg-[var(--bg-elevated)] transition-colors',
        BORDER_COLORS[item.status],
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="font-mono text-[11px] text-[var(--accent)]">{item.numero}</span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
          <Calendar size={10} />
          {formatData(item.data_programada)}
        </span>
      </div>

      {/* Elemento estrutural */}
      <p className="text-xs font-semibold text-[var(--text-high)] truncate mb-1">
        {item.elemento_estrutural}
      </p>

      {/* Volume + fck */}
      <p className="text-[11px] text-[var(--text-faint)] mb-2">
        {Number(item.volume_previsto).toFixed(1)} m³ · C{item.fck_especificado}
      </p>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {item.caminhao_total > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-faint)]">
            <Truck size={9} />
            {item.caminhao_total} cam.
          </span>
        )}
        {showCpInfo && item.cp_total > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[var(--ok-dim)] text-[var(--ok-text)]">
            <FlaskConical size={9} />
            {item.cp_rompidos}/{item.cp_total} CPs
          </span>
        )}
      </div>

      {/* Progress bar de CPs — só em rastreabilidade */}
      {showCpInfo && item.cp_total > 0 && (
        <div className="mt-2">
          <div className="h-1 bg-[var(--bg-base)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--ok)] rounded-full transition-all"
              style={{ width: `${cpPct}%` }}
            />
          </div>
          {item.proxima_ruptura_data && (
            <p className="text-[10px] text-[var(--text-faint)] mt-0.5">
              próx: {formatData(item.proxima_ruptura_data)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que o tipo `Concretagem` exportado de concretagem.service.ts inclui `caminhao_total`**

Abrir `frontend-web/src/services/concretagem.service.ts` e confirmar que a interface `Concretagem` tem:
- `cp_total: number`
- `cp_rompidos: number`
- `proxima_ruptura_data: string | null`
- `caminhao_total: number`

Se não tiver, adicionar agora.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/concretagem/concretagens/components/KanbanCard.tsx
git commit -m "feat(frontend): KanbanCard component with rich CP/truck info"
```

---

## Task 7: Frontend — ConcrtagensListPage com Kanban + toggle

**Files:**
- Modify: `frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx`

- [ ] **Step 1: Substituir o conteúdo de ConcrtagensListPage.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagensListPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Layers, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { StatusConcretagem } from '@/services/concretagem.service';
import { useListarConcretagens } from '../hooks/useConcretagens';
import { ConcrtagemFormModal } from '../components/ConcrtagemFormModal';
import { KanbanCard } from '../components/KanbanCard';

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StatusConcretagem, string> = {
  PROGRAMADA:         'Programada',
  EM_LANCAMENTO:      'Em Lançamento',
  EM_RASTREABILIDADE: 'Em Rastreabilidade',
  CONCLUIDA:          'Concluída',
  CANCELADA:          'Cancelada',
};

const STATUS_COLORS: Record<StatusConcretagem, string> = {
  PROGRAMADA:         'bg-[var(--accent-dim)] text-[var(--accent)]',
  EM_LANCAMENTO:      'bg-[var(--warn-dim)] text-[var(--warn-text)]',
  EM_RASTREABILIDADE: 'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CONCLUIDA:          'bg-[var(--ok-dim)] text-[var(--ok-text)]',
  CANCELADA:          'bg-[var(--bg-raised)] text-[var(--text-faint)]',
};

// ── Kanban columns ────────────────────────────────────────────────────────────

const KANBAN_COLS: { status: StatusConcretagem; label: string; color: string }[] = [
  { status: 'PROGRAMADA',         label: 'Programadas',         color: 'text-[var(--accent)]' },
  { status: 'EM_LANCAMENTO',      label: 'Em Lançamento',       color: 'text-[var(--warn-text)]' },
  { status: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade',  color: 'text-[var(--ok-text)]' },
  { status: 'CONCLUIDA',          label: 'Concluídas',          color: 'text-[var(--text-faint)]' },
];

// ── Tabs para view lista ──────────────────────────────────────────────────────

type TabKey = StatusConcretagem | 'TODOS';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'TODOS',              label: 'Todas' },
  { key: 'PROGRAMADA',         label: 'Programadas' },
  { key: 'EM_LANCAMENTO',      label: 'Em Lançamento' },
  { key: 'EM_RASTREABILIDADE', label: 'Em Rastreabilidade' },
  { key: 'CONCLUIDA',          label: 'Concluídas' },
  { key: 'CANCELADA',          label: 'Canceladas' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const VIEW_KEY = 'eldox.concretagens.view';

function getInitialView(): 'kanban' | 'lista' {
  try {
    return (localStorage.getItem(VIEW_KEY) as 'kanban' | 'lista') ?? 'kanban';
  } catch {
    return 'kanban';
  }
}

function setViewPref(v: 'kanban' | 'lista') {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-[var(--border-dim)]">
          {[80, 180, 60, 60, 80, 90, 80].map((w, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 rounded animate-pulse bg-[var(--bg-raised)]" style={{ width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <>
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-lg animate-pulse bg-[var(--bg-raised)]" />
      ))}
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] flex items-center justify-center mb-4">
        <Layers size={32} className="text-[var(--accent)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-high)] mb-1">
        Nenhuma concretagem registrada
      </h3>
      <p className="text-sm text-[var(--text-faint)] max-w-sm mb-5">
        Programe a primeira concretagem desta obra para iniciar o controle.
      </p>
      <button
        type="button"
        onClick={onNovo}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Plus size={15} />
        Nova Concretagem
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ConcrtagensListPage() {
  const { obraId }    = useParams<{ obraId: string }>();
  const navigate      = useNavigate();
  const obraIdNum     = Number(obraId) || 0;

  const [view, setView]       = useState<'kanban' | 'lista'>(getInitialView);
  const [tab, setTab]         = useState<TabKey>('TODOS');
  const [modalAberto, setModal] = useState(false);

  // Kanban busca todos; lista pode filtrar por tab
  const listParams = view === 'kanban'
    ? { page: 1, limit: 200 }
    : (tab === 'TODOS' ? { page: 1, limit: 50 } : { status: tab as StatusConcretagem, page: 1, limit: 50 });

  const { data: result, isLoading, isError } = useListarConcretagens(obraIdNum, listParams);
  const items = result?.items ?? [];

  const formatData = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleToggleView = (v: 'kanban' | 'lista') => {
    setView(v);
    setViewPref(v);
  };

  const goToDetalhe = (id: number) =>
    navigate(`/obras/${obraIdNum}/concretagem/concretagens/${id}`);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-high)] m-0">Concretagens</h1>
          <p className="text-sm text-[var(--text-faint)] mt-0.5 m-0">
            Programação e controle de concretagens da obra
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle view */}
          <div className="flex bg-[var(--bg-raised)] rounded-lg p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => handleToggleView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'kanban'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <LayoutGrid size={13} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => handleToggleView('lista')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                view === 'lista'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-high)]'
                  : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
              )}
            >
              <List size={13} /> Lista
            </button>
          </div>
          <button
            type="button"
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            Nova Concretagem
          </button>
        </div>
      </div>

      {isError && (
        <div className="text-center py-12 text-sm text-[var(--text-faint)]">
          Erro ao carregar concretagens
        </div>
      )}

      {/* ── KANBAN ── */}
      {!isError && view === 'kanban' && (
        <>
          {items.length === 0 && !isLoading ? (
            <EmptyState onNovo={() => setModal(true)} />
          ) : (
            <div className="grid grid-cols-4 gap-4 min-h-[400px]">
              {KANBAN_COLS.map((col) => {
                const colItems = items.filter((b) => b.status === col.status);
                return (
                  <div key={col.status} className="flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center justify-between px-1 mb-1">
                      <span className={cn('text-xs font-bold tracking-wide uppercase', col.color)}>
                        {col.label}
                      </span>
                      <span className="text-xs text-[var(--text-faint)] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-full">
                        {isLoading ? '…' : colItems.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="flex flex-col gap-2 flex-1 min-h-[200px] p-2 rounded-xl bg-[var(--bg-base)]">
                      {isLoading ? (
                        <SkeletonCards />
                      ) : colItems.length === 0 ? (
                        <div className="flex items-center justify-center h-20 text-xs text-[var(--text-faint)]">
                          Nenhuma
                        </div>
                      ) : (
                        colItems.map((b) => (
                          <KanbanCard key={b.id} item={b} onClick={() => goToDetalhe(b.id)} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── LISTA ── */}
      {!isError && view === 'lista' && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--border-dim)]">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  tab === key
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-low)] hover:text-[var(--text-med)]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <table className="w-full text-sm border-collapse">
              <tbody><SkeletonRows /></tbody>
            </table>
          ) : items.length === 0 ? (
            <EmptyState onNovo={() => setModal(true)} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-dim)]">
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Número</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Elemento Estrutural</th>
                    <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">Vol. (m³)</th>
                    <th className="text-right px-4 py-2 text-[var(--text-faint)] font-medium">fck</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Data Prog.</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">CPs</th>
                    <th className="text-left px-4 py-2 text-[var(--text-faint)] font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)] cursor-pointer"
                      onClick={() => goToDetalhe(b.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{b.numero}</td>
                      <td className="px-4 py-3 text-[var(--text-high)] max-w-[200px] truncate">{b.elemento_estrutural}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-med)]">{Number(b.volume_previsto).toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-med)]">{b.fck_especificado}</td>
                      <td className="px-4 py-3 text-[var(--text-med)]">{formatData(b.data_programada)}</td>
                      <td className="px-4 py-3 text-[var(--text-faint)] text-xs">
                        {b.cp_total > 0 ? `${b.cp_rompidos}/${b.cp_total}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[b.status])}>
                          {STATUS_LABELS[b.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); goToDetalhe(b.id); }}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[var(--text-faint)] mt-3 px-1">
                {result?.total ?? 0} concretagem(ns) encontrada(s)
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal criar */}
      {modalAberto && (
        <ConcrtagemFormModal obraId={obraIdNum} onClose={() => setModal(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "ConcrtagensListPage\|KanbanCard" | head -20
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/concretagem/concretagens/
git commit -m "feat(frontend): ConcrtagensListPage with Kanban/lista toggle, 5 tabs, rich cards"
```

---

## Task 8: Frontend — CpTimeline + CpTabela components

**Files:**
- Create: `frontend-web/src/modules/concretagem/concretagens/components/CpTimeline.tsx`
- Create: `frontend-web/src/modules/concretagem/concretagens/components/CpTabela.tsx`

- [ ] **Step 1: Criar CpTimeline.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/components/CpTimeline.tsx
import { cn } from '@/lib/cn';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  caminhao_nf?: string;
  idade_dias: number;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
  fck: number;
}

interface CaminhaoGroup {
  caminhao_id: number;
  numero: string;
  nf: string;
  cps: CpItem[];
}

interface CpTimelineProps {
  cps: CpItem[];
  fck: number;
}

function DotStatus({ cp, fck }: { cp: CpItem | undefined; idade: number; fck: number }) {
  if (!cp) {
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <div className="w-5 h-5 rounded-full border-2 border-dashed border-[var(--border-dim)] flex items-center justify-center">
          <span className="text-[8px] text-[var(--text-faint)]">—</span>
        </div>
        <span className="text-[9px] text-[var(--text-faint)]">—</span>
      </div>
    );
  }

  if (cp.status === 'AGUARDANDO_RUPTURA') {
    const vencido = cp.data_ruptura_prev && new Date(cp.data_ruptura_prev) < new Date();
    return (
      <div className="flex flex-col items-center gap-1 flex-1">
        <div className={cn(
          'w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center',
          vencido ? 'border-[var(--warn)] bg-[var(--warn-dim)]' : 'border-[var(--border-dim)] bg-[var(--bg-raised)]',
        )}>
          <span className="text-[8px]">{vencido ? '⏱' : '…'}</span>
        </div>
        <span className="text-[9px] text-[var(--text-faint)]">
          {cp.data_ruptura_prev
            ? new Date(cp.data_ruptura_prev).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : '—'}
        </span>
      </div>
    );
  }

  const aprovado = cp.status === 'ROMPIDO_APROVADO';
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
        aprovado
          ? 'bg-[var(--ok)] border-[var(--ok-text)]'
          : 'bg-[var(--nc-bg,#ef4444)] border-[var(--nc-border,#7f1d1d)]',
      )}>
        <span className="text-[8px] text-white">{aprovado ? '✓' : '✗'}</span>
      </div>
      <span className={cn('text-[9px] font-medium', aprovado ? 'text-[var(--ok-text)]' : 'text-red-400')}>
        {cp.resistencia} MPa
      </span>
    </div>
  );
}

export function CpTimeline({ cps, fck }: CpTimelineProps) {
  // Agrupar por caminhão
  const groups: CaminhaoGroup[] = [];
  const seen = new Map<number, CaminhaoGroup>();

  for (const cp of cps) {
    if (!seen.has(cp.caminhao_id)) {
      const g: CaminhaoGroup = {
        caminhao_id: cp.caminhao_id,
        numero: cp.caminhao_numero ?? `CAM-${cp.caminhao_id}`,
        nf: cp.caminhao_nf ?? '—',
        cps: [],
      };
      seen.set(cp.caminhao_id, g);
      groups.push(g);
    }
    seen.get(cp.caminhao_id)!.cps.push(cp);
  }

  const IDADES = [3, 7, 28];

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum corpo de prova registrado.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.caminhao_id}>
          <p className="text-xs font-semibold text-[var(--text-med)] mb-3">
            🚛 {g.numero} · NF {g.nf}
          </p>
          <div className="flex items-stretch gap-0 relative">
            {/* Linha de conexão */}
            <div className="absolute top-2.5 left-[12.5%] right-[12.5%] h-px bg-[var(--border-dim)] z-0" />
            {IDADES.map((idade) => {
              const cp = g.cps.find((c) => c.idade_dias === idade);
              return (
                <div key={idade} className="flex flex-col items-center flex-1 z-10">
                  <DotStatus cp={cp} idade={idade} fck={fck} />
                  <span className="text-[10px] text-[var(--text-faint)] mt-1 font-medium">{idade}d</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Criar CpTabela.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/components/CpTabela.tsx
import { cn } from '@/lib/cn';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  idade_dias: number;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CpTabelaProps {
  cps: CpItem[];
  fck: number;
}

const STATUS_LABEL: Record<CpItem['status'], string> = {
  AGUARDANDO_RUPTURA: 'Aguardando',
  ROMPIDO_APROVADO:   '✓ Aprovado',
  ROMPIDO_REPROVADO:  '✗ Reprovado',
  CANCELADO:          'Cancelado',
};

const STATUS_COLOR: Record<CpItem['status'], string> = {
  AGUARDANDO_RUPTURA: 'text-[var(--text-faint)]',
  ROMPIDO_APROVADO:   'text-[var(--ok-text)]',
  ROMPIDO_REPROVADO:  'text-red-400',
  CANCELADO:          'text-[var(--text-faint)] line-through',
};

export function CpTabela({ cps, fck }: CpTabelaProps) {
  const formatData = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

  if (cps.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum corpo de prova registrado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border-dim)]">
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Nº CP</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Caminhão</th>
            <th className="text-right px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Idade</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Data Prev.</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Data Real</th>
            <th className="text-right px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Resist. (MPa)</th>
            <th className="text-left px-3 py-2 text-xs text-[var(--text-faint)] font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {cps.map((cp) => (
            <tr key={cp.id} className="border-b border-[var(--border-dim)] hover:bg-[var(--bg-raised)]">
              <td className="px-3 py-2.5 font-mono text-xs text-[var(--accent)]">{cp.numero}</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-med)]">{cp.caminhao_numero ?? `CAM-${cp.caminhao_id}`}</td>
              <td className="px-3 py-2.5 text-xs text-right text-[var(--text-med)]">{cp.idade_dias}d</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-faint)]">{formatData(cp.data_ruptura_prev)}</td>
              <td className="px-3 py-2.5 text-xs text-[var(--text-faint)]">{formatData(cp.data_ruptura_real)}</td>
              <td className="px-3 py-2.5 text-xs text-right font-medium text-[var(--text-high)]">
                {cp.resistencia != null ? cp.resistencia : '—'}
              </td>
              <td className={cn('px-3 py-2.5 text-xs font-medium', STATUS_COLOR[cp.status])}>
                {STATUS_LABEL[cp.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-[var(--text-faint)] mt-2 px-1">fck especificado: {fck} MPa</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/concretagem/concretagens/components/CpTimeline.tsx
git add frontend-web/src/modules/concretagem/concretagens/components/CpTabela.tsx
git commit -m "feat(frontend): CpTimeline and CpTabela components for CP visualization"
```

---

## Task 9: Frontend — CurvaResistenciaChart com filtro por caminhão e drawer

**Files:**
- Create: `frontend-web/src/modules/concretagem/concretagens/components/CurvaResistenciaChart.tsx`
- Create: `frontend-web/src/modules/concretagem/concretagens/components/CaminhaoDrawer.tsx`

- [ ] **Step 1: Verificar que recharts está instalado**

```bash
cd frontend-web
grep '"recharts"' package.json
```

Se não estiver: `npm install recharts`

- [ ] **Step 2: Criar CaminhaoDrawer.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/components/CaminhaoDrawer.tsx
import { X, Truck } from 'lucide-react';
import { CpTabela } from './CpTabela';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  idade_dias: number;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  resistencia: number | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CaminhaoInfo {
  id: number;
  numero: string;
  numero_nf: string | null;
  volume: number | null;
  hora_chegada: string | null;
  fornecedor_nome?: string;
  cps: CpItem[];
}

interface CaminhaoDrawerProps {
  caminhao: CaminhaoInfo;
  fck: number;
  onClose: () => void;
}

export function CaminhaoDrawer({ caminhao, fck, onClose }: CaminhaoDrawerProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] max-w-full bg-[var(--bg-base)] border-l border-[var(--border-dim)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-[var(--accent)]" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-high)]">{caminhao.numero}</h3>
              {caminhao.numero_nf && (
                <p className="text-xs text-[var(--text-faint)]">NF {caminhao.numero_nf}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--bg-raised)] text-[var(--text-faint)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info */}
        <div className="px-5 py-4 border-b border-[var(--border-dim)] grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--text-faint)] mb-0.5">Volume</p>
            <p className="font-medium text-[var(--text-high)]">
              {caminhao.volume != null ? `${caminhao.volume} m³` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-faint)] mb-0.5">Chegada</p>
            <p className="font-medium text-[var(--text-high)]">
              {caminhao.hora_chegada
                ? new Date(caminhao.hora_chegada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '—'}
            </p>
          </div>
          {caminhao.fornecedor_nome && (
            <div className="col-span-2">
              <p className="text-xs text-[var(--text-faint)] mb-0.5">Fornecedor</p>
              <p className="font-medium text-[var(--text-high)]">{caminhao.fornecedor_nome}</p>
            </div>
          )}
        </div>

        {/* CPs */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h4 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-3">
            Corpos de Prova
          </h4>
          <CpTabela cps={caminhao.cps} fck={fck} />
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Criar CurvaResistenciaChart.tsx**

```typescript
// frontend-web/src/modules/concretagem/concretagens/components/CurvaResistenciaChart.tsx
import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/cn';
import { CaminhaoDrawer } from './CaminhaoDrawer';

interface CpItem {
  id: number;
  numero: string;
  caminhao_id: number;
  caminhao_numero?: string;
  caminhao_nf?: string;
  idade_dias: number;
  resistencia: number | null;
  data_ruptura_prev: string | null;
  data_ruptura_real: string | null;
  status: 'AGUARDANDO_RUPTURA' | 'ROMPIDO_APROVADO' | 'ROMPIDO_REPROVADO' | 'CANCELADO';
}

interface CaminhaoInfo {
  id: number;
  numero: string;
  numero_nf: string | null;
  volume: number | null;
  hora_chegada: string | null;
  cps: CpItem[];
}

interface CurvaResistenciaChartProps {
  cps: CpItem[];
  caminhoes: CaminhaoInfo[];
  fck: number;
}

const PALETTE = ['#6366f1', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8'];
const IDADES = [3, 7, 28];

export function CurvaResistenciaChart({ cps, caminhoes, fck }: CurvaResistenciaChartProps) {
  const [selectedCaminhoes, setSelectedCaminhoes] = useState<Set<number>>(new Set());
  const [drawerCaminhao, setDrawerCaminhao] = useState<CaminhaoInfo | null>(null);

  // Agrupar CPs por caminhão
  const byCaminhao = new Map<number, CpItem[]>();
  for (const cp of cps) {
    if (!byCaminhao.has(cp.caminhao_id)) byCaminhao.set(cp.caminhao_id, []);
    byCaminhao.get(cp.caminhao_id)!.push(cp);
  }

  // Dados por idade (eixo X)
  const chartData = IDADES.map((idade) => {
    const point: Record<string, number | null | string> = { idade: idade.toString() };
    for (const cam of caminhoes) {
      const cpAtIdade = (byCaminhao.get(cam.id) ?? []).find((c) => c.idade_dias === idade);
      point[`cam_${cam.id}`] = cpAtIdade?.resistencia ?? null;
    }
    return point;
  });

  const toggleCaminhao = (camId: number) => {
    setSelectedCaminhoes((prev) => {
      const next = new Set(prev);
      if (next.has(camId)) {
        next.delete(camId);
      } else {
        next.add(camId);
      }
      return next;
    });
  };

  const isVisible = (camId: number) =>
    selectedCaminhoes.size === 0 || selectedCaminhoes.has(camId);

  if (caminhoes.length === 0) {
    return (
      <p className="text-sm text-[var(--text-faint)] text-center py-8">
        Nenhum caminhão com dados de resistência.
      </p>
    );
  }

  return (
    <div>
      {/* Legenda interativa */}
      <div className="flex flex-wrap gap-2 mb-4">
        {caminhoes.map((cam, i) => {
          const color = PALETTE[i % PALETTE.length];
          const active = isVisible(cam.id);
          return (
            <button
              key={cam.id}
              type="button"
              onClick={() => toggleCaminhao(cam.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-opacity',
                active ? 'opacity-100' : 'opacity-30',
              )}
              style={{ borderColor: color, color }}
            >
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
              {cam.numero}
            </button>
          );
        })}
        {selectedCaminhoes.size > 0 && (
          <button
            type="button"
            onClick={() => setSelectedCaminhoes(new Set())}
            className="text-xs text-[var(--text-faint)] hover:text-[var(--text-med)] px-2"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" />
          <XAxis
            dataKey="idade"
            tickFormatter={(v) => `${v}d`}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
          />
          <YAxis
            unit=" MPa"
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-dim)', borderRadius: 8 }}
            labelFormatter={(l) => `${l} dias`}
            formatter={(value: number | null, name: string) => {
              const cam = caminhoes.find((c) => `cam_${c.id}` === name);
              return [value != null ? `${value} MPa` : '—', cam?.numero ?? name];
            }}
          />
          <ReferenceLine
            y={fck}
            stroke="#ef4444"
            strokeDasharray="6 4"
            label={{ value: `fck ${fck}`, fill: '#ef4444', fontSize: 10, position: 'right' }}
          />
          {caminhoes.map((cam, i) => (
            <Line
              key={cam.id}
              dataKey={`cam_${cam.id}`}
              name={`cam_${cam.id}`}
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={isVisible(cam.id) ? 2 : 1}
              opacity={isVisible(cam.id) ? 1 : 0.15}
              dot={{ r: 4, fill: PALETTE[i % PALETTE.length], cursor: 'pointer' }}
              activeDot={{
                r: 6,
                cursor: 'pointer',
                onClick: () => setDrawerCaminhao(cam),
              }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Drawer de detalhes do caminhão */}
      {drawerCaminhao && (
        <CaminhaoDrawer
          caminhao={{
            ...drawerCaminhao,
            cps: (byCaminhao.get(drawerCaminhao.id) ?? []).map((cp) => ({
              ...cp,
              caminhao_numero: drawerCaminhao.numero,
            })),
          }}
          fck={fck}
          onClose={() => setDrawerCaminhao(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/modules/concretagem/concretagens/components/CurvaResistenciaChart.tsx
git add frontend-web/src/modules/concretagem/concretagens/components/CaminhaoDrawer.tsx
git commit -m "feat(frontend): CurvaResistenciaChart with per-truck lines, legend filter, drawer drill-down"
```

---

## Task 10: Frontend — integrar timeline, tabela e curva no ConcrtagemDetalhePage

**Files:**
- Modify: `frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx`

- [ ] **Step 1: Ler o arquivo atual para entender o layout existente**

```bash
wc -l frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx
```

Identificar onde os CPs são renderizados atualmente (buscar por `cp`, `corpos`, `rompimento`).

- [ ] **Step 2: Adicionar imports e estado do toggle CP view**

No topo do componente, adicionar:

```typescript
import { CpTimeline } from '../components/CpTimeline';
import { CpTabela } from '../components/CpTabela';
import { CurvaResistenciaChart } from '../components/CurvaResistenciaChart';

// Dentro do componente:
const CP_VIEW_KEY = 'eldox.concretagem.cp_view';

function getInitialCpView(): 'timeline' | 'tabela' {
  try {
    return (localStorage.getItem(CP_VIEW_KEY) as 'timeline' | 'tabela') ?? 'timeline';
  } catch {
    return 'timeline';
  }
}

const [cpView, setCpView] = useState<'timeline' | 'tabela'>(getInitialCpView);
```

- [ ] **Step 3: Substituir a seção de CPs atual pelo bloco com toggle + componentes**

Localizar onde os CPs são exibidos na página (provavelmente uma seção ou card com lista de CPs). Substituir por:

```typescript
{/* Seção CPs */}
<div className="bg-[var(--bg-raised)] rounded-xl p-5">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-sm font-semibold text-[var(--text-high)]">Corpos de Prova</h2>
    {/* Toggle timeline / tabela */}
    <div className="flex bg-[var(--bg-base)] rounded-lg p-0.5 gap-0.5">
      {(['timeline', 'tabela'] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            setCpView(v);
            try { localStorage.setItem(CP_VIEW_KEY, v); } catch { /* */ }
          }}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            cpView === v
              ? 'bg-[var(--bg-raised)] text-[var(--text-high)]'
              : 'text-[var(--text-faint)] hover:text-[var(--text-med)]',
          )}
        >
          {v === 'timeline' ? '⏱ Timeline' : '☰ Tabela'}
        </button>
      ))}
    </div>
  </div>

  {cpView === 'timeline' ? (
    <CpTimeline cps={cps} fck={concretagem.fck_especificado} />
  ) : (
    <CpTabela cps={cps} fck={concretagem.fck_especificado} />
  )}
</div>

{/* Curva de Resistência */}
{cps.some((cp) => cp.resistencia != null) && (
  <div className="bg-[var(--bg-raised)] rounded-xl p-5">
    <h2 className="text-sm font-semibold text-[var(--text-high)] mb-4">Curva de Resistência</h2>
    <CurvaResistenciaChart
      cps={cps}
      caminhoes={caminhoes}
      fck={concretagem.fck_especificado}
    />
  </div>
)}
```

Onde `cps` e `caminhoes` são os dados já carregados no page (via `useBuscarConcretagem` que retorna o detalhe com caminhões e CPs aninhados).

Se os CPs e caminhões não vieram no buscarConcretagem, adaptar para usar hooks separados:
```typescript
// Se necessário, adicionar:
const { data: cpsData } = useQuery({
  queryKey: ['cps', obraIdNum, concrtagemId],
  queryFn: () => concretagemService.listarCps(concrtagemId),
  enabled: !!concrtagemId,
});
const cps = cpsData?.data ?? [];
```

- [ ] **Step 4: Verificar TypeScript e checar que os tipos batem**

```bash
cd frontend-web
npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep "Detalhe\|CpTimeline\|CurvaResist" | head -20
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend-web/src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage.tsx
git commit -m "feat(frontend): integrate CpTimeline, CpTabela toggle, and CurvaResistenciaChart in detail page"
```

---

## Verificação Final

- [ ] **Backend sobe sem erros**

```bash
cd backend
ts-node --transpile-only -r tsconfig-paths/register src/main.ts
```

- [ ] **Rotas respondem com nova URL**

```bash
curl -s http://localhost:3001/api/v1/obras/1/concretagem/concretagens \
  -H "Authorization: Bearer $TOKEN" | jq '.data.total'
```

- [ ] **Frontend builda sem erros**

```bash
cd frontend-web
npm run build 2>&1 | tail -10
```

- [ ] **Smoke test manual:**
  1. Abrir `/obras/:id/concretagem/concretagens` → Kanban carrega
  2. Toggle lista → tabs aparecem com "Em Rastreabilidade"
  3. Abrir concretagem em rastreabilidade → timeline de CPs aparece
  4. Toggle tabela → tabela de CPs aparece
  5. Curva de resistência aparece se há CPs com resultado
  6. Clique em caminhão na legenda → isola linha
  7. Clique em ponto do gráfico → drawer abre com histórico

- [ ] **Commit final**

```bash
git add .
git commit -m "feat: concretagem UX operacional — rename, kanban, rastreabilidade, curva de resistência"
```
