# Almoxarifado IA Preditivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar os agentes de IA do almoxarifado de `obra_id` para `local_id`, persistir insights em `alm_sugestoes_ia` com ciclo de vida, agendar job cron a cada 6h e adicionar ações "Criar Solicitação" e "Ignorar" na InsightsPage.

**Architecture:** Job BullMQ (`gerar-insights`) roda a cada 6h via `onModuleInit` (mesmo padrão de `AlertasProcessor`), itera por todos os locais do tenant, faz upsert em `alm_sugestoes_ia`. Controller expõe 4 endpoints tenant-level. Frontend usa hooks com mutations para aplicar/ignorar.

**Tech Stack:** NestJS + BullMQ (`@nestjs/bull`) + Prisma raw SQL + PostgreSQL + React + TanStack Query v5

---

## File Structure

**Backend — criar:**
- `backend/src/almoxarifado/ia/insights.service.ts` — orquestração, upsert, aplicar, ignorar
- `backend/src/almoxarifado/ia/insights.controller.ts` — 4 endpoints REST
- `backend/prisma/migrations/20260417000004_alm_sugestoes_ia/migration.sql` — nova tabela

**Backend — modificar:**
- `backend/src/almoxarifado/ia/agente-reorder.service.ts` — `obraId` → `localId` nas queries SQL
- `backend/src/almoxarifado/ia/agente-anomalia.service.ts` — `obraId` → `localId` nas queries SQL
- `backend/src/almoxarifado/ia/ia.controller.ts` — remover endpoint obsoleto `/obras/:obraId/insights`
- `backend/src/almoxarifado/jobs/almoxarifado.processor.ts` — adicionar cron + handler `gerar-insights`
- `backend/src/almoxarifado/almoxarifado.module.ts` — registrar `InsightsService`, `InsightsController`
- `backend/src/almoxarifado/types/alm.types.ts` — adicionar `AlmSugestaoIa`

**Frontend — modificar:**
- `frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts` — novos tipos + métodos
- `frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts` — remover `obraId`, add mutations
- `frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx` — remover `useParams`, add botões

---

## Task 1: Migration — tabela `alm_sugestoes_ia`

**Files:**
- Create: `backend/prisma/migrations/20260417000004_alm_sugestoes_ia/migration.sql`

- [ ] **Step 1: Criar arquivo de migration**

```bash
mkdir -p backend/prisma/migrations/20260417000004_alm_sugestoes_ia
```

Conteúdo de `backend/prisma/migrations/20260417000004_alm_sugestoes_ia/migration.sql`:

```sql
-- Migration: 20260417000004_alm_sugestoes_ia
-- Tabela de sugestões IA com ciclo de vida (pendente → aplicado | ignorado)

CREATE TABLE IF NOT EXISTS alm_sugestoes_ia (
  id             SERIAL PRIMARY KEY,
  tenant_id      INT NOT NULL,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('reorder', 'anomalia')),
  catalogo_id    INT NOT NULL,
  catalogo_nome  VARCHAR(255) NOT NULL,
  local_id       INT NOT NULL,
  unidade        VARCHAR(20) NOT NULL,
  dados_json     JSONB NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'aplicado', 'ignorado')),
  solicitacao_id INT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_alm_sugestoes_ia_key
    UNIQUE (tenant_id, catalogo_id, local_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_alm_sugestoes_ia_tenant_status
  ON alm_sugestoes_ia (tenant_id, status);
```

- [ ] **Step 2: Aplicar migration**

```bash
cd backend
npx prisma migrate deploy
```

Expected: `1 migration applied` (ou `The migration ... has been applied`)

- [ ] **Step 3: Verificar tabela criada**

```bash
cd backend
npx prisma db execute --stdin <<< "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'alm_sugestoes_ia' ORDER BY ordinal_position;"
```

Expected: colunas `id, tenant_id, tipo, catalogo_id, catalogo_nome, local_id, unidade, dados_json, status, solicitacao_id, criado_em, atualizado_em`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260417000004_alm_sugestoes_ia/
git commit -m "feat(alm-ia): add alm_sugestoes_ia migration"
```

---

## Task 2: Backend types — adicionar `AlmSugestaoIa`

**Files:**
- Modify: `backend/src/almoxarifado/types/alm.types.ts`

- [ ] **Step 1: Adicionar interface no final do arquivo**

Adicionar após a última interface do arquivo (`AlmAprovacao`):

```typescript
// ── IA Sugestões ──────────────────────────────────────────────────────────────

export type AlmSugestaoStatus = 'pendente' | 'aplicado' | 'ignorado';
export type AlmSugestaoTipo   = 'reorder' | 'anomalia';

export interface AlmSugestaoIa {
  id:            number;
  tenant_id:     number;
  tipo:          AlmSugestaoTipo;
  catalogo_id:   number;
  catalogo_nome: string;
  local_id:      number;
  unidade:       string;
  dados_json:    AlmReorderPrediction | AlmAnomaliaDetectada;
  status:        AlmSugestaoStatus;
  solicitacao_id?: number;
  criado_em:     Date;
  atualizado_em: Date;
}
```

- [ ] **Step 2: Verificar que `AlmReorderPrediction` e `AlmAnomaliaDetectada` já existem no arquivo**

```bash
grep -n "AlmReorderPrediction\|AlmAnomaliaDetectada" backend/src/almoxarifado/types/alm.types.ts
```

Expected: linhas com as duas interfaces

- [ ] **Step 3: Commit**

```bash
git add backend/src/almoxarifado/types/alm.types.ts
git commit -m "feat(alm-ia): add AlmSugestaoIa type"
```

---

## Task 3: Migrar `AgenteReorderService` de `obraId` para `localId`

**Files:**
- Modify: `backend/src/almoxarifado/ia/agente-reorder.service.ts`

- [ ] **Step 1: Substituir assinatura do método `executar`**

Localizar:
```typescript
async executar(
  tenantId: number,
  obraId: number,
): Promise<AlmReorderPrediction[]> {
```

Substituir por:
```typescript
async executar(
  tenantId: number,
  localId: number,
): Promise<AlmReorderPrediction[]> {
```

- [ ] **Step 2: Atualizar query principal**

Localizar o `$queryRawUnsafe` com `s.obra_id` e `mv.obra_id` e substituir pela versão com `local_id`:

```typescript
const saldos = await this.prisma.$queryRawUnsafe<SaldoComConsumo[]>(
  `SELECT
     s.catalogo_id,
     m.nome          AS catalogo_nome,
     s.unidade,
     s.quantidade    AS quantidade_atual,
     COALESCE(SUM(mv.quantidade), 0) AS consumo_total_30d
   FROM alm_estoque_saldo s
   JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
   LEFT JOIN alm_movimentos mv
     ON mv.catalogo_id = s.catalogo_id
    AND mv.local_id    = s.local_id
    AND mv.tenant_id   = s.tenant_id
    AND mv.tipo IN ('saida', 'perda')
    AND mv.created_at >= $3
   WHERE s.tenant_id = $1
     AND s.local_id  = $2
     AND s.quantidade > 0
   GROUP BY s.catalogo_id, m.nome, s.unidade, s.quantidade`,
  tenantId,
  localId,
  dataCorte,
);
```

- [ ] **Step 3: Atualizar mensagem no logger e chamada IA**

Localizar `obra ${obraId}` dentro de `_analisarComIA`:

```typescript
const userMessage = `Analise estes materiais em baixo estoque no local ${localId}:
```

Localizar `obraId` no audit trail:
```typescript
tenantId,
localId,
```

- [ ] **Step 4: Atualizar `_criarAlertas` — trocar `obra_id` por `local_id`**

```typescript
private async _criarAlertas(
  predictions: AlmReorderPrediction[],
  tenantId: number,
  localId: number,
): Promise<void> {
  for (const p of predictions) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO alm_alertas_estoque
         (tenant_id, local_id, catalogo_id, tipo, nivel, mensagem, lido)
       VALUES ($1, $2, $3, 'reposicao_prevista', $4, $5, false)
       ON CONFLICT DO NOTHING`,
      tenantId,
      localId,
      p.catalogo_id,
      p.nivel,
      `${p.catalogo_nome}: ~${p.dias_restantes} dias restantes. ${p.analise_ia}`,
    );
  }

  this.logger.log(
    JSON.stringify({
      action: 'alm.reorder.alertas_criados',
      localId,
      tenantId,
      total: predictions.length,
      critico: predictions.filter((p) => p.nivel === 'critico').length,
    }),
  );
}
```

- [ ] **Step 5: Atualizar todas as chamadas `obraId` restantes no arquivo**

```bash
grep -n "obraId\|obra_id" backend/src/almoxarifado/ia/agente-reorder.service.ts
```

Expected: zero ocorrências (qualquer resultado é um bug)

- [ ] **Step 6: Atualizar `local_id` no objeto de retorno do fallback**

No fallback do `catch`:
```typescript
return candidatos.map((c) => ({
  ...c,
  local_id: localId,
  nivel: ...
```

- [ ] **Step 7: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "agente-reorder"
```

Expected: sem output (sem erros)

- [ ] **Step 8: Commit**

```bash
git add backend/src/almoxarifado/ia/agente-reorder.service.ts
git commit -m "feat(alm-ia): migrate AgenteReorderService from obraId to localId"
```

---

## Task 4: Migrar `AgenteAnomaliaService` de `obraId` para `localId`

**Files:**
- Modify: `backend/src/almoxarifado/ia/agente-anomalia.service.ts`

- [ ] **Step 1: Substituir assinatura de `executar`**

```typescript
async executar(
  tenantId: number,
  localId: number,
): Promise<AlmAnomaliaDetectada[]> {
```

- [ ] **Step 2: Atualizar query principal**

```typescript
const consumos = await this.prisma.$queryRawUnsafe<ConsumoItem[]>(
  `SELECT
     m.id   AS catalogo_id,
     m.nome AS catalogo_nome,
     s.unidade,
     COALESCE(SUM(CASE WHEN mv.created_at >= $3 THEN mv.quantidade ELSE 0 END), 0) AS consumo_7d,
     COALESCE(SUM(CASE WHEN mv.created_at >= $4 THEN mv.quantidade ELSE 0 END), 0) AS consumo_30d
   FROM alm_estoque_saldo s
   JOIN fvm_catalogo_materiais m ON m.id = s.catalogo_id
   LEFT JOIN alm_movimentos mv
     ON mv.catalogo_id = s.catalogo_id
    AND mv.local_id    = s.local_id
    AND mv.tenant_id   = s.tenant_id
    AND mv.tipo IN ('saida', 'perda')
    AND mv.created_at >= $4
   WHERE s.tenant_id = $1
     AND s.local_id  = $2
   GROUP BY m.id, m.nome, s.unidade
   HAVING COALESCE(SUM(CASE WHEN mv.created_at >= $4 THEN mv.quantidade ELSE 0 END), 0) > 0`,
  tenantId,
  localId,
  data7d,
  data30d,
);
```

- [ ] **Step 3: Atualizar chamadas `obraId` em `_analisarComIA` e alertas**

Localizar todas as ocorrências de `obraId` e substituir por `localId`. Alerta:

```typescript
await this.prisma.$executeRawUnsafe(
  `INSERT INTO alm_alertas_estoque
     (tenant_id, local_id, catalogo_id, tipo, nivel, mensagem, lido)
   VALUES ($1, $2, $3, 'anomalia', $4, $5, false)
   ON CONFLICT DO NOTHING`,
  tenantId,
  localId,
  a.catalogo_id,
  a.nivel,
  `${a.catalogo_nome}: consumo ${a.fator_desvio.toFixed(1)}x acima da média. ${a.explicacao_ia}`,
);
```

Fallback e `local_id` no retorno:
```typescript
local_id: localId,
```

- [ ] **Step 4: Verificar sem `obraId`**

```bash
grep -n "obraId\|obra_id" backend/src/almoxarifado/ia/agente-anomalia.service.ts
```

Expected: zero ocorrências

- [ ] **Step 5: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "agente-anomalia"
```

Expected: sem output

- [ ] **Step 6: Commit**

```bash
git add backend/src/almoxarifado/ia/agente-anomalia.service.ts
git commit -m "feat(alm-ia): migrate AgenteAnomaliaService from obraId to localId"
```

---

## Task 5: Criar `InsightsService`

**Files:**
- Create: `backend/src/almoxarifado/ia/insights.service.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// backend/src/almoxarifado/ia/insights.service.ts
import {
  Injectable, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService }         from '../../prisma/prisma.service';
import { AgenteReorderService }  from './agente-reorder.service';
import { AgenteAnomaliaService } from './agente-anomalia.service';
import { SolicitacaoService }    from '../solicitacao/solicitacao.service';
import type { AlmSugestaoIa }    from '../types/alm.types';

const SISTEMA_USUARIO_ID = 1;

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly reorder:    AgenteReorderService,
    private readonly anomalia:   AgenteAnomaliaService,
    private readonly solicitacao: SolicitacaoService,
  ) {}

  // ── Leitura ───────────────────────────────────────────────────────────────

  async listar(tenantId: number): Promise<AlmSugestaoIa[]> {
    return this.prisma.$queryRawUnsafe<AlmSugestaoIa[]>(
      `SELECT * FROM alm_sugestoes_ia
       WHERE tenant_id = $1 AND status = 'pendente'
       ORDER BY
         (dados_json->>'nivel' = 'critico') DESC,
         criado_em DESC`,
      tenantId,
    );
  }

  // ── Ações ─────────────────────────────────────────────────────────────────

  async aplicar(
    tenantId: number,
    id: number,
    usuarioId: number,
  ): Promise<{ solicitacao_id: number }> {
    const rows = await this.prisma.$queryRawUnsafe<AlmSugestaoIa[]>(
      `SELECT * FROM alm_sugestoes_ia WHERE id = $1 AND tenant_id = $2`,
      id, tenantId,
    );
    const sugestao = rows[0];
    if (!sugestao) throw new NotFoundException('Sugestão não encontrada');
    if (sugestao.status !== 'pendente') {
      throw new BadRequestException('Sugestão já foi processada');
    }

    const dados = sugestao.dados_json as any;
    const sol = await this.solicitacao.criar(tenantId, usuarioId, {
      local_destino_id: sugestao.local_id,
      descricao: `Reposição sugerida por IA — ${sugestao.catalogo_nome}`,
      itens: [{
        catalogo_id: sugestao.catalogo_id,
        quantidade:  dados.recomendacao_qty ?? 1,
        unidade:     sugestao.unidade,
        observacao:  dados.analise_ia ?? undefined,
      }],
    });

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_sugestoes_ia
       SET status = 'aplicado', solicitacao_id = $1, atualizado_em = NOW()
       WHERE id = $2`,
      sol.id, id,
    );

    this.logger.log(JSON.stringify({
      action: 'alm.insights.aplicar',
      tenantId, sugestaoId: id, solicitacaoId: sol.id,
    }));

    return { solicitacao_id: sol.id };
  }

  async ignorar(tenantId: number, id: number): Promise<void> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE alm_sugestoes_ia
       SET status = 'ignorado', atualizado_em = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'pendente'`,
      id, tenantId,
    );
    if ((result as number) === 0) {
      throw new NotFoundException('Sugestão não encontrada ou já processada');
    }
  }

  // ── Job ───────────────────────────────────────────────────────────────────

  async executarParaTodos(): Promise<void> {
    const tenants = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM "Tenant" WHERE ativo = true`,
    );
    for (const t of tenants) {
      try {
        await this.executarParaTenant(t.id);
      } catch (err: any) {
        this.logger.error(`Erro ao executar insights para tenant ${t.id}: ${err.message}`);
      }
    }
  }

  async executarParaTenant(tenantId: number): Promise<void> {
    const locais = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM alm_locais WHERE tenant_id = $1 AND ativo = true`,
      tenantId,
    );

    for (const local of locais) {
      const [reorderPreds, anomalias] = await Promise.all([
        this.reorder.executar(tenantId, local.id).catch(() => []),
        this.anomalia.executar(tenantId, local.id).catch(() => []),
      ]);

      for (const p of reorderPreds) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_sugestoes_ia
             (tenant_id, tipo, catalogo_id, catalogo_nome, local_id, unidade, dados_json)
           VALUES ($1, 'reorder', $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT ON CONSTRAINT uq_alm_sugestoes_ia_key
           DO UPDATE SET
             dados_json    = EXCLUDED.dados_json,
             catalogo_nome = EXCLUDED.catalogo_nome,
             atualizado_em = NOW()
           WHERE alm_sugestoes_ia.status = 'pendente'`,
          tenantId, p.catalogo_id, p.catalogo_nome, local.id, p.unidade,
          JSON.stringify(p),
        );
      }

      for (const a of anomalias) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO alm_sugestoes_ia
             (tenant_id, tipo, catalogo_id, catalogo_nome, local_id, unidade, dados_json)
           VALUES ($1, 'anomalia', $2, $3, $4, $5, $6::jsonb)
           ON CONFLICT ON CONSTRAINT uq_alm_sugestoes_ia_key
           DO UPDATE SET
             dados_json    = EXCLUDED.dados_json,
             catalogo_nome = EXCLUDED.catalogo_nome,
             atualizado_em = NOW()
           WHERE alm_sugestoes_ia.status = 'pendente'`,
          tenantId, a.catalogo_id, a.catalogo_nome, local.id, a.unidade,
          JSON.stringify(a),
        );
      }
    }

    this.logger.log(JSON.stringify({
      action: 'alm.insights.executar',
      tenantId,
      locais: locais.length,
    }));
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "insights.service"
```

Expected: sem output

- [ ] **Step 3: Commit**

```bash
git add backend/src/almoxarifado/ia/insights.service.ts
git commit -m "feat(alm-ia): add InsightsService — listar, aplicar, ignorar, executarParaTodos"
```

---

## Task 6: Criar `InsightsController`

**Files:**
- Create: `backend/src/almoxarifado/ia/insights.controller.ts`

- [ ] **Step 1: Criar o arquivo**

```typescript
// backend/src/almoxarifado/ia/insights.controller.ts
import {
  Controller, Get, Post, Patch, Param, Req,
  UseGuards, HttpCode, HttpStatus, ParseIntPipe,
} from '@nestjs/common';
import { InjectQueue }   from '@nestjs/bull';
import type { Queue }    from 'bull';
import { JwtAuthGuard }  from '../../common/guards/jwt.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';
import { TenantId }      from '../../common/decorators/tenant.decorator';
import { InsightsService } from './insights.service';

@Controller('api/v1/almoxarifado')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsightsController {
  constructor(
    private readonly insights: InsightsService,
    @InjectQueue('almoxarifado') private readonly queue: Queue,
  ) {}

  @Get('insights')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  listar(@TenantId() tenantId: number) {
    return this.insights.listar(tenantId);
  }

  @Post('insights/reanalisar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  @HttpCode(HttpStatus.ACCEPTED)
  async reanalisar(@TenantId() tenantId: number) {
    await this.queue.add('gerar-insights', { tenantId }, { priority: 1 });
    return { enqueued: true };
  }

  @Patch('insights/:id/aplicar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  aplicar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const usuarioId: number = req.user?.sub ?? req.user?.id;
    return this.insights.aplicar(tenantId, id, usuarioId);
  }

  @Patch('insights/:id/ignorar')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO')
  ignorar(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.insights.ignorar(tenantId, id);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "insights.controller"
```

Expected: sem output

- [ ] **Step 3: Commit**

```bash
git add backend/src/almoxarifado/ia/insights.controller.ts
git commit -m "feat(alm-ia): add InsightsController — GET/POST/PATCH endpoints"
```

---

## Task 7: Atualizar `AlmoxarifadoProcessor` — cron + handler `gerar-insights`

**Files:**
- Modify: `backend/src/almoxarifado/jobs/almoxarifado.processor.ts`

- [ ] **Step 1: Adicionar imports**

Adicionar no topo, após os imports existentes:

```typescript
import { InjectQueue, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bull';
import { InsightsService } from '../ia/insights.service';
```

Remover `OnModuleInit` de `@nestjs/common` se não estiver importado lá (verificar).

- [ ] **Step 2: Adicionar `implements OnModuleInit` na classe e injetar dependências**

Substituir a declaração da classe e o constructor:

```typescript
@Processor('almoxarifado')
export class AlmoxarifadoProcessor implements OnModuleInit {
  private readonly logger = new Logger(AlmoxarifadoProcessor.name);

  constructor(
    private readonly nfeService:      NfeService,
    private readonly nfeMatchService: NfeMatchService,
    private readonly reorderService:  AgenteReorderService,
    private readonly anomaliaService: AgenteAnomaliaService,
    private readonly estoqueService:  EstoqueService,
    private readonly insightsService: InsightsService,
    @InjectQueue('almoxarifado') private readonly queue: Queue,
  ) {}
```

- [ ] **Step 3: Implementar `onModuleInit` para registrar cron**

Adicionar método após o constructor (antes do `@Process`):

```typescript
async onModuleInit(): Promise<void> {
  // Remove jobs repetíveis antigos para evitar duplicatas
  const repeatableJobs = await this.queue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.name === 'gerar-insights') {
      await this.queue.removeRepeatableByKey(job.key);
    }
  }

  // Registra cron: a cada 6 horas (0 */6 * * *)
  await this.queue.add(
    'gerar-insights',
    {},
    {
      repeat: { cron: '0 */6 * * *' },
      timeout: 300_000,  // 5 min max
      attempts: 2,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  this.logger.log('Job cron "gerar-insights" registrado (0 */6 * * *)');
}
```

- [ ] **Step 4: Adicionar case no switch**

Dentro do `switch (job.name)`, após o case `'detectar-anomalias'`:

```typescript
case 'gerar-insights':
  result = await this.handleGerarInsights(job.data);
  break;
```

- [ ] **Step 5: Adicionar handler `handleGerarInsights`**

Adicionar método privado ao final da classe:

```typescript
private async handleGerarInsights(data: { tenantId?: number }) {
  if (data.tenantId) {
    // Acionado via reanalisar (tenant específico)
    await this.insightsService.executarParaTenant(data.tenantId);
  } else {
    // Acionado via cron (todos os tenants)
    await this.insightsService.executarParaTodos();
  }
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "almoxarifado.processor"
```

Expected: sem output

- [ ] **Step 7: Commit**

```bash
git add backend/src/almoxarifado/jobs/almoxarifado.processor.ts
git commit -m "feat(alm-ia): add gerar-insights cron job (every 6h) to AlmoxarifadoProcessor"
```

---

## Task 8: Atualizar `almoxarifado.module.ts` + remover endpoint obsoleto

**Files:**
- Modify: `backend/src/almoxarifado/almoxarifado.module.ts`
- Modify: `backend/src/almoxarifado/ia/ia.controller.ts`

- [ ] **Step 1: Adicionar imports em `almoxarifado.module.ts`**

Adicionar após os imports existentes de IA:

```typescript
import { InsightsService }    from './ia/insights.service';
import { InsightsController } from './ia/insights.controller';
```

- [ ] **Step 2: Registrar `InsightsController` em `controllers`**

Na array `controllers`, adicionar:

```typescript
InsightsController,
```

- [ ] **Step 3: Registrar `InsightsService` em `providers`**

Na array `providers`, adicionar:

```typescript
InsightsService,
```

- [ ] **Step 4: Remover endpoint obsoleto de `ia.controller.ts`**

Remover o método `getInsights` inteiro de `IaController` (era `GET obras/:obraId/insights`).

O arquivo `ia.controller.ts` fica apenas com os imports e a classe vazia (ou pode-se remover o controller inteiro se não tiver outros métodos). Verificar se há outros métodos — se não houver, remover o controller e seu registro no módulo.

```bash
cat backend/src/almoxarifado/ia/ia.controller.ts
```

Se o único método era `getInsights`, deletar o arquivo e remover `IaController` de `almoxarifado.module.ts`.

- [ ] **Step 5: TypeScript check geral**

```bash
cd backend && npx tsc --noEmit 2>&1 | head -20
```

Expected: sem output (zero erros)

- [ ] **Step 6: Commit**

```bash
git add backend/src/almoxarifado/almoxarifado.module.ts backend/src/almoxarifado/ia/ia.controller.ts
git commit -m "feat(alm-ia): wire InsightsService + InsightsController; remove obsolete IaController endpoint"
```

---

## Task 9: Frontend — atualizar `almoxarifado.service.ts`

**Files:**
- Modify: `frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts`

- [ ] **Step 1: Adicionar tipo `AlmSugestaoIa` após `AlmInsightsResult`**

Localizar `export interface AlmInsightsResult` e adicionar após ele:

```typescript
export type AlmSugestaoStatus = 'pendente' | 'aplicado' | 'ignorado';
export type AlmSugestaoTipo   = 'reorder' | 'anomalia';

export interface AlmSugestaoIa {
  id:            number;
  tipo:          AlmSugestaoTipo;
  catalogo_id:   number;
  catalogo_nome: string;
  local_id:      number;
  unidade:       string;
  dados_json:    AlmReorderPrediction | AlmAnomaliaDetectada;
  status:        AlmSugestaoStatus;
  solicitacao_id?: number;
  criado_em:     string;
  atualizado_em: string;
}
```

- [ ] **Step 2: Substituir `getInsights` e adicionar novos métodos**

Localizar:

```typescript
  getInsights: (obraId: number): Promise<AlmInsightsResult> =>
    api.get(`${BASE}/obras/${obraId}/insights`).then((r: any) => r.data?.data ?? r.data),
```

Substituir por:

```typescript
  getInsights: (): Promise<AlmSugestaoIa[]> =>
    api.get(`${BASE}/insights`).then((r: any) => r.data?.data ?? r.data),

  aplicarSugestao: (id: number): Promise<{ solicitacao_id: number }> =>
    api.patch(`${BASE}/insights/${id}/aplicar`).then((r: any) => r.data?.data ?? r.data),

  ignorarSugestao: (id: number): Promise<void> =>
    api.patch(`${BASE}/insights/${id}/ignorar`).then((r: any) => r.data?.data ?? r.data),

  reanalisarInsights: (): Promise<{ enqueued: boolean }> =>
    api.post(`${BASE}/insights/reanalisar`).then((r: any) => r.data?.data ?? r.data),
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend-web && npx tsc -b --noEmit 2>&1 | grep -i "almoxarifado.service"
```

Expected: sem output

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/modules/almoxarifado/_service/almoxarifado.service.ts
git commit -m "feat(alm-ia): update almoxarifado.service — AlmSugestaoIa type + new insight methods"
```

---

## Task 10: Frontend — atualizar `useInsights` hook

**Files:**
- Modify: `frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts`

- [ ] **Step 1: Reescrever o arquivo**

```typescript
// frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { almoxarifadoService } from '../../_service/almoxarifado.service';

export function useInsights() {
  return useQuery({
    queryKey:  ['alm-insights'],
    queryFn:   () => almoxarifadoService.getInsights(),
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  });
}

export function useAplicarSugestao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.aplicarSugestao(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['alm-insights'] });
      qc.invalidateQueries({ queryKey: ['alm-solicitacoes'] });
    },
  });
}

export function useIgnorarSugestao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => almoxarifadoService.ignorarSugestao(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  });
}

export function useReanalisarInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => almoxarifadoService.reanalisarInsights(),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['alm-insights'] }),
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend-web && npx tsc -b --noEmit 2>&1 | grep -i "useInsights"
```

Expected: sem output

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/almoxarifado/ia/hooks/useInsights.ts
git commit -m "feat(alm-ia): update useInsights — remove obraId, add aplicar/ignorar/reanalisar mutations"
```

---

## Task 11: Frontend — atualizar `InsightsPage`

**Files:**
- Modify: `frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx`

- [ ] **Step 1: Atualizar imports no topo**

Substituir:

```typescript
import { useParams } from 'react-router-dom'
```

por:

```typescript
import { useNavigate } from 'react-router-dom'
```

Substituir o import do hook:

```typescript
import { useInsights } from '../hooks/useInsights'
import type { AlmReorderPrediction, AlmAnomaliaDetectada } from '../../_service/almoxarifado.service'
```

por:

```typescript
import {
  useInsights,
  useAplicarSugestao,
  useIgnorarSugestao,
  useReanalisarInsights,
} from '../hooks/useInsights'
import type { AlmSugestaoIa, AlmReorderPrediction, AlmAnomaliaDetectada } from '../../_service/almoxarifado.service'
```

- [ ] **Step 2: Atualizar `ReorderCard` para receber `sugestao` e ter botão de ação**

Substituir a interface e componente `ReorderCard`:

```typescript
function ReorderCard({
  sugestao,
  onAplicar,
  isLoading,
}: {
  sugestao: AlmSugestaoIa
  onAplicar: (id: number) => void
  isLoading: boolean
}) {
  const p = sugestao.dados_json as AlmReorderPrediction
  const isCritico = p.nivel === 'critico'

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{sugestao.catalogo_nome}</p>
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
          isCritico ? 'bg-[var(--nc)] text-white' : 'bg-[var(--warn)] text-white',
        )}>
          {isCritico ? 'Crítico' : 'Atenção'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
        <div>
          <span className="text-[var(--text-faint)]">Estoque atual</span>
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(p.quantidade_atual, sugestao.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo/dia</span>
          <p className="font-semibold text-[var(--text-high)]">
            {p.consumo_medio_diario.toFixed(2)} {sugestao.unidade}
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Dias restantes</span>
          <p className={cn('font-bold', isCritico ? 'text-[var(--nc)]' : 'text-[var(--warn)]')}>
            ~{p.dias_restantes} dias
          </p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Repor</span>
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(p.recomendacao_qty, sugestao.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2 mb-3">
        {p.analise_ia}
      </p>

      <button
        onClick={() => onAplicar(sugestao.id)}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded',
          'bg-[var(--accent)] text-white text-[12px] font-semibold',
          'hover:bg-[var(--accent-hover)] transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isLoading ? 'Criando…' : '+ Criar Solicitação'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `AnomaliaCard` para ter botão "Ignorar"**

Substituir a interface e componente `AnomaliaCard`:

```typescript
function AnomaliaCard({
  sugestao,
  onIgnorar,
  isLoading,
}: {
  sugestao: AlmSugestaoIa
  onIgnorar: (id: number) => void
  isLoading: boolean
}) {
  const a = sugestao.dados_json as AlmAnomaliaDetectada
  const isCritico = a.nivel === 'critico'

  return (
    <div className={cn(
      'p-4 rounded-lg border',
      isCritico
        ? 'border-[var(--nc)] bg-[var(--nc-bg)]'
        : 'border-[var(--warn)] bg-[var(--warn-bg)]',
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[14px] font-semibold text-[var(--text-high)] leading-tight">{sugestao.catalogo_nome}</p>
        <span className={cn(
          'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide',
          isCritico ? 'bg-[var(--nc)] text-white' : 'bg-[var(--warn)] text-white',
        )}>
          {a.fator_desvio.toFixed(1)}x desvio
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] mb-3">
        <div>
          <span className="text-[var(--text-faint)]">Consumo últimos 7d</span>
          <p className="font-semibold text-[var(--text-high)]">{fmtQty(a.consumo_recente_7d, sugestao.unidade)}</p>
        </div>
        <div>
          <span className="text-[var(--text-faint)]">Consumo últimos 30d</span>
          <p className="text-[var(--text-low)]">{fmtQty(a.consumo_medio_30d, sugestao.unidade)}</p>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-low)] italic border-t border-[var(--border-dim)] pt-2 mb-3">
        {a.explicacao_ia}
      </p>

      <button
        onClick={() => onIgnorar(sugestao.id)}
        disabled={isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded',
          'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
          'text-[12px] text-[var(--text-low)] hover:text-[var(--text-high)]',
          'disabled:opacity-50 transition-colors',
        )}
      >
        {isLoading ? 'Ignorando…' : 'Ignorar'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Reescrever o componente `InsightsPage`**

Substituir o corpo da função `InsightsPage`:

```typescript
export function InsightsPage() {
  const navigate = useNavigate()

  const { data = [], isLoading, isFetching } = useInsights()
  const aplicar    = useAplicarSugestao()
  const ignorar    = useIgnorarSugestao()
  const reanalisar = useReanalisarInsights()

  const reorders  = data.filter((s) => s.tipo === 'reorder')
  const anomalias = data.filter((s) => s.tipo === 'anomalia')
  const totalCritico = data.filter((s) => {
    const d = s.dados_json as any
    return d?.nivel === 'critico'
  }).length

  function handleAplicar(id: number) {
    aplicar.mutate(id, {
      onSuccess: ({ solicitacao_id }) => {
        navigate(`/almoxarifado/solicitacoes/${solicitacao_id}`)
      },
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)] flex items-center gap-2">
            <Brain size={18} className="text-[var(--accent)]" />
            IA Preditiva
          </h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">
            Previsão de reposição e detecção de anomalias · análise automática a cada 6h
          </p>
        </div>

        <button
          onClick={() => reanalisar.mutate()}
          disabled={isFetching || reanalisar.isPending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)]',
            'text-[12px] text-[var(--text-low)] hover:text-[var(--text-high)]',
            'disabled:opacity-50 transition-colors',
          )}
        >
          <RefreshCw size={12} className={cn((isFetching || reanalisar.isPending) && 'animate-spin')} />
          {reanalisar.isPending ? 'Enfileirando…' : 'Reanalisar agora'}
        </button>
      </div>

      {/* Alerta geral */}
      {totalCritico > 0 && (
        <div className="mb-5 flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc)] text-[var(--nc)]">
          <Zap size={14} />
          <span className="text-[13px] font-semibold">
            {totalCritico} situaç{totalCritico > 1 ? 'ões' : 'ão'} crítica{totalCritico > 1 ? 's' : ''} detectada{totalCritico > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)]">
              <div className="skeleton h-4 rounded w-3/4 mb-3" />
              <div className="skeleton h-3 rounded w-1/2 mb-2" />
              <div className="skeleton h-3 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="py-16 text-center bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg">
          <Brain size={32} className="mx-auto mb-3 text-[var(--text-faint)]" />
          <p className="text-[14px] font-semibold text-[var(--text-high)] mb-1">Estoque saudável</p>
          <p className="text-[13px] text-[var(--text-faint)]">
            Nenhuma sugestão pendente · análise automática a cada 6h
          </p>
        </div>
      ) : (
        <>
          {/* Seção Reposição */}
          {reorders.length > 0 && (
            <section className="mb-8">
              <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-[var(--warn)]" />
                Reposição Prevista
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--warn-bg)] text-[var(--warn)] text-[10px] font-bold rounded-full">
                  {reorders.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {reorders
                  .sort((a, b) => (a.dados_json as AlmReorderPrediction).dias_restantes - (b.dados_json as AlmReorderPrediction).dias_restantes)
                  .map((s) => (
                    <ReorderCard
                      key={s.id}
                      sugestao={s}
                      onAplicar={handleAplicar}
                      isLoading={aplicar.isPending && aplicar.variables === s.id}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Seção Anomalias */}
          {anomalias.length > 0 && (
            <section>
              <h2 className="text-[14px] font-semibold text-[var(--text-high)] flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-[var(--nc)]" />
                Anomalias de Consumo
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--nc-bg)] text-[var(--nc)] text-[10px] font-bold rounded-full">
                  {anomalias.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {anomalias
                  .sort((a, b) => (b.dados_json as AlmAnomaliaDetectada).fator_desvio - (a.dados_json as AlmAnomaliaDetectada).fator_desvio)
                  .map((s) => (
                    <AnomaliaCard
                      key={s.id}
                      sugestao={s}
                      onIgnorar={(id) => ignorar.mutate(id)}
                      isLoading={ignorar.isPending && ignorar.variables === s.id}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: TypeScript check completo**

```bash
cd frontend-web && npx tsc -b --noEmit 2>&1 | head -20
```

Expected: sem output (zero erros)

- [ ] **Step 6: Commit**

```bash
git add frontend-web/src/modules/almoxarifado/ia/pages/InsightsPage.tsx
git commit -m "feat(alm-ia): update InsightsPage — remove obraId, add Criar Solicitação + Ignorar actions"
```

---

## Task 12: Push + deploy

- [ ] **Step 1: Verificar TypeScript em ambos os projetos**

```bash
cd backend && npx tsc --noEmit && echo "Backend OK"
cd ../frontend-web && npx tsc -b --noEmit && echo "Frontend OK"
```

Expected:
```
Backend OK
Frontend OK
```

- [ ] **Step 2: Push para deploy**

```bash
cd ..
git log --oneline -8
git push origin main
```

Expected: push aceito, GitHub Actions inicia pipeline
