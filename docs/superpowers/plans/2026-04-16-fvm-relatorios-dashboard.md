# FVM — Dashboard + Relatórios Exportáveis: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a KPI Dashboard tab to GradeMateriaisPage with 4 KPI cards and 2 charts, plus 3 exportable reports: Ficha de Recebimento (PDF), NCs FVM (PDF+Excel), and Performance de Fornecedores (PDF+Excel with score calculation).

**Architecture:** One new backend aggregation endpoint for dashboard data. Supplier performance score calculated client-side and saved back via PATCH. Reports generated 100% client-side using @react-pdf/renderer and exceljs. Dashboard integrated as tab in existing GradeMateriaisPage.

**Tech Stack:** recharts, @react-pdf/renderer, exceljs, NestJS, Prisma, TanStack Query

**Spec:** `docs/superpowers/specs/2026-04-16-fvm-relatorios-dashboard.md`

---

## File Map

### Backend — criados
- `backend/src/fvm/recebimento/dto/dashboard-query.dto.ts`
- `backend/src/fvm/fornecedores/dto/patch-score.dto.ts`

### Backend — modificados
- `backend/src/fvm/recebimento/recebimento.controller.ts` — add `getDashboard` endpoint
- `backend/src/fvm/recebimento/recebimento.service.ts` — add `getDashboard` method
- `backend/src/fvm/fornecedores/fornecedores.controller.ts` — add `patchScore` endpoint
- `backend/src/fvm/fornecedores/fornecedores.service.ts` — add `patchScore` method

### Frontend — criados
- `frontend-web/src/modules/fvm/dashboard/hooks/useFvmDashboard.ts`
- `frontend-web/src/modules/fvm/dashboard/components/FvmKpiCards.tsx`
- `frontend-web/src/modules/fvm/dashboard/components/AprovacaoCategoriaChart.tsx`
- `frontend-web/src/modules/fvm/dashboard/components/EvolucaoLotesChart.tsx`
- `frontend-web/src/modules/fvm/dashboard/DashboardFvmTab.tsx`
- `frontend-web/src/modules/fvm/relatorios/pdf/FichaRecebimentoPdf.tsx`
- `frontend-web/src/modules/fvm/relatorios/pdf/NcsFvmPdf.tsx`
- `frontend-web/src/modules/fvm/relatorios/pdf/PerformanceFornecedoresPdf.tsx`
- `frontend-web/src/modules/fvm/relatorios/excel/NcsFvmXlsx.ts`
- `frontend-web/src/modules/fvm/relatorios/excel/PerformanceFornecedoresXlsx.ts`

### Frontend — modificados
- `frontend-web/src/services/fvm.service.ts` — add dashboard types + API calls + patchScore
- `frontend-web/src/modules/fvm/grade/pages/GradeMateriaisPage.tsx` — add grade/dashboard tabs
- `frontend-web/src/modules/fvm/grade/pages/FichaLotePage.tsx` — add "Exportar Ficha PDF" button
- `frontend-web/src/modules/fvm/fornecedores/pages/FornecedoresPage.tsx` — add performance report button

---

## Task 1 — Backend: `GET /api/v1/fvm/obras/:obraId/dashboard` endpoint

- [ ] **1.1** Create `backend/src/fvm/recebimento/dto/dashboard-query.dto.ts`:

```typescript
// backend/src/fvm/recebimento/dto/dashboard-query.dto.ts
import { IsOptional, IsDateString } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
```

- [ ] **1.2** Add `getDashboard` method to `backend/src/fvm/recebimento/recebimento.service.ts`.

  Add after the existing imports at the top (no changes to imports needed — PrismaService already injected):

  Add the following method inside the `RecebimentoService` class (after `liberarQuarentena`):

```typescript
  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboard(
    tenantId: number,
    obraId: number,
    opts?: { data_inicio?: string; data_fim?: string },
  ) {
    // Default window: last 90 days
    const dataFim   = opts?.data_fim    ? new Date(opts.data_fim)   : new Date();
    const dataInicio = opts?.data_inicio
      ? new Date(opts.data_inicio)
      : new Date(dataFim.getTime() - 90 * 24 * 60 * 60 * 1000);

    const params: unknown[] = [tenantId, obraId, dataInicio, dataFim];

    // ── KPIs ──────────────────────────────────────────────────────────────
    const kpiRows = await this.prisma.$queryRawUnsafe<{
      lotes_recebidos_total: number;
      lotes_aprovados: number;
      lotes_em_quarentena: number;
      lotes_reprovados: number;
      taxa_aprovacao: number | null;
    }[]>(
      `SELECT
         COUNT(*)::int AS lotes_recebidos_total,
         COUNT(*) FILTER (WHERE status IN ('aprovado','aprovado_com_ressalva'))::int AS lotes_aprovados,
         COUNT(*) FILTER (WHERE status = 'quarentena')::int AS lotes_em_quarentena,
         COUNT(*) FILTER (WHERE status = 'reprovado')::int AS lotes_reprovados,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE status IN ('aprovado','aprovado_com_ressalva')) /
           NULLIF(COUNT(*) FILTER (WHERE status NOT IN ('aguardando_inspecao','cancelado')), 0),
           1
         ) AS taxa_aprovacao
       FROM fvm_lotes
       WHERE tenant_id = $1 AND obra_id = $2
         AND deleted_at IS NULL
         AND data_entrega BETWEEN $3 AND $4`,
      ...params,
    );

    const kpiBase = kpiRows[0] ?? {
      lotes_recebidos_total: 0,
      lotes_aprovados: 0,
      lotes_em_quarentena: 0,
      lotes_reprovados: 0,
      taxa_aprovacao: null,
    };

    // ── NCs abertas ────────────────────────────────────────────────────────
    const ncRows = await this.prisma.$queryRawUnsafe<{
      ncs_abertas: number;
      ncs_criticas_abertas: number;
    }[]>(
      `SELECT
         COUNT(*)::int AS ncs_abertas,
         COUNT(*) FILTER (WHERE criticidade = 'critico')::int AS ncs_criticas_abertas
       FROM fvm_nao_conformidades
       WHERE tenant_id = $1 AND obra_id = $2
         AND status NOT IN ('encerrada','cancelada')`,
      tenantId,
      obraId,
    );

    const ncBase = ncRows[0] ?? { ncs_abertas: 0, ncs_criticas_abertas: 0 };

    // ── Ensaios reprovados ─────────────────────────────────────────────────
    const ensaioRows = await this.prisma.$queryRawUnsafe<{
      ensaios_reprovados: number;
    }[]>(
      `SELECT COUNT(*)::int AS ensaios_reprovados
       FROM fvm_ensaios e
       JOIN fvm_lotes l ON l.id = e.lote_id
       WHERE l.tenant_id = $1 AND l.obra_id = $2
         AND l.deleted_at IS NULL
         AND e.resultado = 'REPROVADO'
         AND l.data_entrega BETWEEN $3 AND $4`,
      ...params,
    );

    const kpis = {
      ...kpiBase,
      ...ncBase,
      ensaios_reprovados: ensaioRows[0]?.ensaios_reprovados ?? 0,
      taxa_aprovacao: kpiBase.taxa_aprovacao ?? 0,
    };

    // ── Por categoria ──────────────────────────────────────────────────────
    const porCategoria = await this.prisma.$queryRawUnsafe<{
      categoria_id: number;
      categoria_nome: string;
      total_lotes: number;
      taxa_aprovacao: number;
    }[]>(
      `SELECT
         m.categoria_id,
         COALESCE(c.nome, 'Sem categoria') AS categoria_nome,
         COUNT(l.id)::int AS total_lotes,
         ROUND(
           100.0 * COUNT(l.id) FILTER (WHERE l.status IN ('aprovado','aprovado_com_ressalva')) /
           NULLIF(COUNT(l.id) FILTER (WHERE l.status NOT IN ('aguardando_inspecao','cancelado')), 0),
           1
         ) AS taxa_aprovacao
       FROM fvm_lotes l
       JOIN fvm_catalogo_materiais m ON m.id = l.material_id
       LEFT JOIN fvm_categorias_materiais c ON c.id = m.categoria_id
       WHERE l.tenant_id = $1 AND l.obra_id = $2
         AND l.deleted_at IS NULL
         AND l.data_entrega BETWEEN $3 AND $4
       GROUP BY m.categoria_id, c.nome
       ORDER BY taxa_aprovacao ASC NULLS LAST`,
      ...params,
    );

    // ── Evolução semanal ───────────────────────────────────────────────────
    const evolucaoSemanal = await this.prisma.$queryRawUnsafe<{
      semana: string;
      aprovados: number;
      quarentena: number;
      reprovados: number;
      aguardando: number;
    }[]>(
      `SELECT
         TO_CHAR(DATE_TRUNC('week', data_entrega), 'IYYY-"W"IW') AS semana,
         COUNT(*) FILTER (WHERE status IN ('aprovado','aprovado_com_ressalva'))::int AS aprovados,
         COUNT(*) FILTER (WHERE status = 'quarentena')::int AS quarentena,
         COUNT(*) FILTER (WHERE status = 'reprovado')::int AS reprovados,
         COUNT(*) FILTER (WHERE status IN ('aguardando_inspecao','em_inspecao'))::int AS aguardando
       FROM fvm_lotes
       WHERE tenant_id = $1 AND obra_id = $2
         AND deleted_at IS NULL
         AND data_entrega BETWEEN $3 AND $4
       GROUP BY DATE_TRUNC('week', data_entrega)
       ORDER BY DATE_TRUNC('week', data_entrega) ASC`,
      ...params,
    );

    return { kpis, por_categoria: porCategoria, evolucao_semanal: evolucaoSemanal };
  }
```

- [ ] **1.3** Add `getDashboard` route to `backend/src/fvm/recebimento/recebimento.controller.ts`.

  Add after the existing imports, add `DashboardQueryDto` import:
  ```typescript
  import { DashboardQueryDto } from './dto/dashboard-query.dto';
  ```

  Add the following endpoint inside the `RecebimentoController` class (after `getGrade`):

```typescript
  /** GET /api/v1/fvm/obras/:obraId/dashboard */
  @Get('obras/:obraId/dashboard')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboard(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: DashboardQueryDto,
  ) {
    return this.service.getDashboard(tenantId, obraId, {
      data_inicio: query.data_inicio,
      data_fim:    query.data_fim,
    });
  }
```

- [ ] **1.4** Verify with `cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend && npm run type-check` — expect zero errors.

---

## Task 2 — Frontend service: add dashboard types + `getDashboard` call + `patchScore`

- [ ] **2.1** Add the following types and service methods to `frontend-web/src/services/fvm.service.ts`.

  Append these types after the existing `FvmFornecedor` interface:

```typescript
// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface FvmDashboardKpis {
  lotes_recebidos_total: number;
  lotes_aprovados: number;
  lotes_em_quarentena: number;
  lotes_reprovados: number;
  taxa_aprovacao: number;
  ncs_abertas: number;
  ncs_criticas_abertas: number;
  ensaios_reprovados: number;
}

export interface FvmDashboardCategoria {
  categoria_id: number;
  categoria_nome: string;
  total_lotes: number;
  taxa_aprovacao: number;
}

export interface FvmDashboardSemana {
  semana: string;       // "2026-W15"
  aprovados: number;
  quarentena: number;
  reprovados: number;
  aguardando: number;
}

export interface FvmDashboard {
  kpis: FvmDashboardKpis;
  por_categoria: FvmDashboardCategoria[];
  evolucao_semanal: FvmDashboardSemana[];
}

export interface FvmDashboardQuery {
  data_inicio?: string;
  data_fim?: string;
}

// ─── Relatório de Performance — tipos ────────────────────────────────────────

export interface FvmPerformanceFornecedor {
  id: number;
  razao_social: string;
  cnpj: string | null;
  total_lotes: number;
  taxa_aprovacao: number;
  total_ncs: number;
  ncs_criticas: number;
  ensaios_reprovados: number;
  total_ensaios: number;
  score: number;
}

// ─── Relatório de NCs ─────────────────────────────────────────────────────────

export interface FvmNcRelatorio {
  id: number;
  numero: string;
  lote_numero: string;
  material_nome: string;
  fornecedor_nome: string;
  criticidade: Criticidade;
  tipo: string;
  status: string;
  prazo: string | null;
  acao_imediata: string | null;
  sla_ok: boolean;
}
```

  Append these service calls inside the `fvmService` object (after `getResultadoEnsaiosLote`):

```typescript
  // ── Dashboard ───────────────────────────────────────────────────────────────

  getDashboard: (obraId: number, params?: FvmDashboardQuery): Promise<FvmDashboard> =>
    api.get(`/fvm/obras/${obraId}/dashboard`, { params }).then(r => r.data),

  // ── Fornecedor score (R-FVM3) ────────────────────────────────────────────────

  patchFornecedorScore: (fornecedorId: number, score: number): Promise<{ id: number; avaliacao_score: number }> =>
    api.patch(`/fvm/fornecedores/${fornecedorId}/score`, { score }).then(r => r.data),

  // ── NCs da obra (R-FVM2) ──────────────────────────────────────────────────────

  getNcsRelatorio: (
    obraId: number,
    params?: { data_inicio?: string; data_fim?: string; status?: string; criticidade?: string; fornecedor_id?: number },
  ): Promise<FvmNcRelatorio[]> =>
    api.get(`/fvm/obras/${obraId}/ncs`, { params }).then(r => r.data),

  // ── Performance de fornecedores (R-FVM3) — dados calculados client-side ────────

  getPerformanceFornecedores: (
    params?: { obra_id?: number; data_inicio?: string; data_fim?: string },
  ): Promise<FvmPerformanceFornecedor[]> =>
    api.get('/fvm/fornecedores/performance', { params }).then(r => r.data),
```

- [ ] **2.2** Verify with `cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/frontend-web && npm run type-check` — expect zero errors.

---

## Task 3 — Backend: `PATCH /api/v1/fvm/fornecedores/:id/score` + NCs + Performance endpoints

- [ ] **3.1** Create `backend/src/fvm/fornecedores/dto/patch-score.dto.ts`:

```typescript
// backend/src/fvm/fornecedores/dto/patch-score.dto.ts
import { IsNumber, Min, Max } from 'class-validator';

export class PatchScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  score: number;
}
```

- [ ] **3.2** Add `patchScore` method to `backend/src/fvm/fornecedores/fornecedores.service.ts`.

  Add after the existing `deleteFornecedor` method:

```typescript
  async patchScore(tenantId: number, id: number, score: number): Promise<{ id: number; avaliacao_score: number }> {
    const clamped = Math.min(100, Math.max(0, score));
    const rows = await this.prisma.$queryRawUnsafe<{ id: number; avaliacao_score: number }[]>(
      `UPDATE fvm_fornecedores
       SET avaliacao_score = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, avaliacao_score`,
      clamped,
      id,
      tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Fornecedor ${id} não encontrado`);
    return rows[0];
  }

  async getPerformance(
    tenantId: number,
    opts?: { obraId?: number; dataInicio?: string; dataFim?: string },
  ): Promise<{
    id: number; razao_social: string; cnpj: string | null;
    total_lotes: number; taxa_aprovacao: number;
    total_ncs: number; ncs_criticas: number;
    ensaios_reprovados: number; total_ensaios: number;
  }[]> {
    const conditions: string[] = ['l.tenant_id = $1', 'l.deleted_at IS NULL'];
    const params: unknown[] = [tenantId];
    let i = 2;

    if (opts?.obraId)     { conditions.push(`l.obra_id = $${i++}`);                     params.push(opts.obraId); }
    if (opts?.dataInicio) { conditions.push(`l.data_entrega >= $${i++}`);               params.push(new Date(opts.dataInicio)); }
    if (opts?.dataFim)    { conditions.push(`l.data_entrega <= $${i++}`);               params.push(new Date(opts.dataFim)); }

    const loteCond = conditions.join(' AND ');

    return this.prisma.$queryRawUnsafe(
      `SELECT
         f.id,
         f.razao_social,
         f.cnpj,
         COUNT(DISTINCT l.id)::int AS total_lotes,
         ROUND(
           100.0 * COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('aprovado','aprovado_com_ressalva')) /
           NULLIF(COUNT(DISTINCT l.id) FILTER (WHERE l.status NOT IN ('aguardando_inspecao','cancelado')), 0),
           1
         ) AS taxa_aprovacao,
         COUNT(DISTINCT nc.id)::int AS total_ncs,
         COUNT(DISTINCT nc.id) FILTER (WHERE nc.criticidade = 'critico')::int AS ncs_criticas,
         COUNT(DISTINCT e.id) FILTER (WHERE e.resultado = 'REPROVADO')::int AS ensaios_reprovados,
         COUNT(DISTINCT e.id)::int AS total_ensaios
       FROM fvm_fornecedores f
       JOIN fvm_lotes l ON l.fornecedor_id = f.id
       LEFT JOIN fvm_nao_conformidades nc ON nc.lote_id = l.id
       LEFT JOIN fvm_ensaios e ON e.lote_id = l.id
       WHERE ${loteCond}
       GROUP BY f.id, f.razao_social, f.cnpj
       HAVING COUNT(DISTINCT l.id) > 0
       ORDER BY f.razao_social ASC`,
      ...params,
    );
  }
```

- [ ] **3.3** Add endpoints to `backend/src/fvm/fornecedores/fornecedores.controller.ts`.

  Add import at top:
  ```typescript
  import { PatchScoreDto } from './dto/patch-score.dto';
  ```

  Add after the existing `deleteFornecedor` endpoint:

```typescript
  /** PATCH /fvm/fornecedores/:id/score — save computed performance score */
  @Patch(':id/score')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO')
  patchScore(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PatchScoreDto,
  ) {
    return this.service.patchScore(tenantId, id, dto.score);
  }

  /** GET /fvm/fornecedores/performance — aggregated performance data for R-FVM3 */
  @Get('performance')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getPerformance(
    @TenantId() tenantId: number,
    @Query('obra_id') obraId?: string,
    @Query('data_inicio') dataInicio?: string,
    @Query('data_fim') dataFim?: string,
  ) {
    return this.service.getPerformance(tenantId, {
      obraId:     obraId     ? Number(obraId) : undefined,
      dataInicio,
      dataFim,
    });
  }
```

- [ ] **3.4** Add NCs endpoint to `backend/src/fvm/recebimento/recebimento.controller.ts`.

  Add after `getDashboard`:

```typescript
  /** GET /api/v1/fvm/obras/:obraId/ncs — for R-FVM2 report */
  @Get('obras/:obraId/ncs')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getNcsRelatorio(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query('data_inicio') dataInicio?: string,
    @Query('data_fim') dataFim?: string,
    @Query('status') status?: string,
    @Query('criticidade') criticidade?: string,
    @Query('fornecedor_id') fornecedorId?: string,
  ) {
    return this.service.getNcsRelatorio(tenantId, obraId, {
      dataInicio,
      dataFim,
      status,
      criticidade,
      fornecedorId: fornecedorId ? Number(fornecedorId) : undefined,
    });
  }
```

- [ ] **3.5** Add `getNcsRelatorio` method to `backend/src/fvm/recebimento/recebimento.service.ts` (after `getDashboard`):

```typescript
  async getNcsRelatorio(
    tenantId: number,
    obraId: number,
    opts?: {
      dataInicio?: string; dataFim?: string;
      status?: string; criticidade?: string; fornecedorId?: number;
    },
  ) {
    const conditions: string[] = [
      'nc.tenant_id = $1',
      'nc.obra_id = $2',
    ];
    const params: unknown[] = [tenantId, obraId];
    let i = 3;

    if (opts?.dataInicio) { conditions.push(`nc.created_at >= $${i++}`); params.push(new Date(opts.dataInicio)); }
    if (opts?.dataFim)    { conditions.push(`nc.created_at <= $${i++}`); params.push(new Date(opts.dataFim)); }
    if (opts?.status)     { conditions.push(`nc.status = $${i++}`);      params.push(opts.status); }
    if (opts?.criticidade){ conditions.push(`nc.criticidade = $${i++}`); params.push(opts.criticidade); }
    if (opts?.fornecedorId){ conditions.push(`l.fornecedor_id = $${i++}`); params.push(opts.fornecedorId); }

    return this.prisma.$queryRawUnsafe(
      `SELECT
         nc.id,
         nc.numero,
         l.numero_lote AS lote_numero,
         m.nome AS material_nome,
         f.razao_social AS fornecedor_nome,
         nc.criticidade,
         nc.tipo,
         nc.status,
         nc.prazo_resolucao::text AS prazo,
         nc.acao_imediata,
         CASE WHEN nc.prazo_resolucao IS NULL OR nc.prazo_resolucao >= NOW() THEN true ELSE false END AS sla_ok
       FROM fvm_nao_conformidades nc
       JOIN fvm_lotes l ON l.id = nc.lote_id
       JOIN fvm_catalogo_materiais m ON m.id = l.material_id
       JOIN fvm_fornecedores f ON f.id = l.fornecedor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.razao_social ASC, nc.criticidade DESC, nc.created_at DESC`,
      ...params,
    );
  }
```

- [ ] **3.6** Verify with `cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend && npm run type-check` — expect zero errors.

---

## Task 4 — Frontend hook: `useFvmDashboard`

- [ ] **4.1** Create `frontend-web/src/modules/fvm/dashboard/hooks/useFvmDashboard.ts`:

```typescript
// frontend-web/src/modules/fvm/dashboard/hooks/useFvmDashboard.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvmService } from '@/services/fvm.service';
import type { FvmDashboardQuery, FvmPerformanceFornecedor } from '@/services/fvm.service';

export function useFvmDashboard(obraId: number, query?: FvmDashboardQuery) {
  return useQuery({
    queryKey: ['fvm-dashboard', obraId, query],
    queryFn:  () => fvmService.getDashboard(obraId, query),
    enabled:  !!obraId,
    staleTime: 60_000,
  });
}

export function useFvmPerformance(params?: { obra_id?: number; data_inicio?: string; data_fim?: string }) {
  return useQuery({
    queryKey: ['fvm-performance', params],
    queryFn:  () => fvmService.getPerformanceFornecedores(params),
    staleTime: 60_000,
  });
}

export function usePatchFornecedorScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, score }: { id: number; score: number }) =>
      fvmService.patchFornecedorScore(id, score),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-performance'] });
      qc.invalidateQueries({ queryKey: ['fvm-fornecedores'] });
    },
  });
}

export function useFvmNcsRelatorio(
  obraId: number,
  params?: { data_inicio?: string; data_fim?: string; status?: string; criticidade?: string; fornecedor_id?: number },
) {
  return useQuery({
    queryKey: ['fvm-ncs-relatorio', obraId, params],
    queryFn:  () => fvmService.getNcsRelatorio(obraId, params),
    enabled:  !!obraId,
    staleTime: 30_000,
  });
}
```

- [ ] **4.2** Verify with `npm run type-check` — expect zero errors.

---

## Task 5 — Dashboard components

- [ ] **5.1** Create `frontend-web/src/modules/fvm/dashboard/components/FvmKpiCards.tsx`:

```typescript
// frontend-web/src/modules/fvm/dashboard/components/FvmKpiCards.tsx
import { cn } from '@/lib/cn';
import type { FvmDashboardKpis } from '@/services/fvm.service';
import { Package, CheckCircle, AlertTriangle, Lock } from 'lucide-react';

interface Props {
  kpis: FvmDashboardKpis;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  colorClass: string;
}

function KpiCard({ label, value, sub, icon, colorClass }: KpiCardProps) {
  return (
    <div className="border border-[var(--border-dim)] rounded-lg px-4 py-3 bg-[var(--bg-raised)] flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-faint)]">{label}</p>
        <span className={cn('opacity-60', colorClass)}>{icon}</span>
      </div>
      <p className={cn('text-2xl font-bold', colorClass)}>{value}</p>
      {sub && <p className="text-xs text-[var(--text-faint)]">{sub}</p>}
    </div>
  );
}

export function FvmKpiCards({ kpis }: Props) {
  const taxaColor =
    kpis.taxa_aprovacao >= 80
      ? 'text-[var(--ok-text)]'
      : kpis.taxa_aprovacao >= 60
      ? 'text-yellow-600'
      : 'text-[var(--nc-text)]';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <KpiCard
        label="Lotes Recebidos"
        value={kpis.lotes_recebidos_total}
        sub={`${kpis.lotes_aprovados} aprovados`}
        icon={<Package size={18} />}
        colorClass="text-[var(--text-high)]"
      />
      <KpiCard
        label="Taxa de Aprovação"
        value={`${kpis.taxa_aprovacao}%`}
        sub={kpis.lotes_reprovados > 0 ? `${kpis.lotes_reprovados} reprovados` : 'sem reprovações'}
        icon={<CheckCircle size={18} />}
        colorClass={taxaColor}
      />
      <KpiCard
        label="NCs Abertas"
        value={kpis.ncs_abertas}
        sub={kpis.ncs_criticas_abertas > 0 ? `${kpis.ncs_criticas_abertas} críticas` : 'nenhuma crítica'}
        icon={<AlertTriangle size={18} />}
        colorClass={kpis.ncs_abertas > 0 ? 'text-[var(--warn-text)]' : 'text-[var(--text-high)]'}
      />
      <KpiCard
        label="Em Quarentena"
        value={kpis.lotes_em_quarentena}
        sub={`${kpis.ensaios_reprovados} ensaios reprovados`}
        icon={<Lock size={18} />}
        colorClass={kpis.lotes_em_quarentena > 0 ? 'text-orange-500' : 'text-[var(--text-high)]'}
      />
    </div>
  );
}
```

- [ ] **5.2** Create `frontend-web/src/modules/fvm/dashboard/components/AprovacaoCategoriaChart.tsx`:

```typescript
// frontend-web/src/modules/fvm/dashboard/components/AprovacaoCategoriaChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import type { FvmDashboardCategoria } from '@/services/fvm.service';

interface Props {
  data: FvmDashboardCategoria[];
}

function getBarColor(taxa: number): string {
  if (taxa >= 80) return 'var(--ok-text)';
  if (taxa >= 60) return '#EAB308'; // yellow-500
  return 'var(--nc-text)';
}

export function AprovacaoCategoriaChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--text-faint)]">
        Sem dados de categorias no período.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
        Aprovação por Categoria de Material
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="categoria_nome"
            width={110}
            tick={{ fontSize: 12, fill: 'var(--text-high)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Taxa de aprovação']}
            contentStyle={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Bar dataKey="taxa_aprovacao" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.taxa_aprovacao)} />
            ))}
            <LabelList
              dataKey="total_lotes"
              position="right"
              formatter={(v: number) => `${v} lotes`}
              style={{ fontSize: 11, fill: 'var(--text-faint)' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **5.3** Create `frontend-web/src/modules/fvm/dashboard/components/EvolucaoLotesChart.tsx`:

```typescript
// frontend-web/src/modules/fvm/dashboard/components/EvolucaoLotesChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import type { FvmDashboardSemana } from '@/services/fvm.service';

interface Props {
  data: FvmDashboardSemana[];
}

export function EvolucaoLotesChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--text-faint)]">
        Sem lotes recebidos no período.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
        Evolução de Lotes por Semana
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="semana"
            tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--border-dim)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          <Legend
            iconSize={10}
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="aprovados"  name="Aprovados"   stackId="a" fill="var(--ok-text)"  />
          <Bar dataKey="quarentena" name="Quarentena"  stackId="a" fill="#F97316"         />
          <Bar dataKey="reprovados" name="Reprovados"  stackId="a" fill="var(--nc-text)"  />
          <Bar dataKey="aguardando" name="Aguardando"  stackId="a" fill="var(--border-dim)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **5.4** Verify with `npm run type-check` — expect zero errors.

---

## Task 6 — Dashboard container `DashboardFvmTab.tsx`

- [ ] **6.1** Create `frontend-web/src/modules/fvm/dashboard/DashboardFvmTab.tsx`:

```typescript
// frontend-web/src/modules/fvm/dashboard/DashboardFvmTab.tsx
import { useState } from 'react';
import { useFvmDashboard } from './hooks/useFvmDashboard';
import { FvmKpiCards } from './components/FvmKpiCards';
import { AprovacaoCategoriaChart } from './components/AprovacaoCategoriaChart';
import { EvolucaoLotesChart } from './components/EvolucaoLotesChart';

interface Props {
  obraId: number;
}

export function DashboardFvmTab({ obraId }: Props) {
  const [periodo, setPeriodo] = useState<'30' | '90' | '180'>('90');

  const dataFim    = new Date().toISOString().slice(0, 10);
  const dataInicio = new Date(Date.now() - Number(periodo) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, isLoading, isError } = useFvmDashboard(obraId, { data_inicio: dataInicio, data_fim: dataFim });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando dashboard...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--nc-text)] text-sm">
        Erro ao carregar dados do dashboard.
      </div>
    );
  }

  // Empty state: no inspections completed yet
  const semInspecoes =
    data.kpis.lotes_aprovados === 0 &&
    data.kpis.lotes_reprovados === 0 &&
    data.kpis.lotes_em_quarentena === 0;

  return (
    <div className="pt-4">
      {/* ── Filtro de período ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-[var(--text-faint)]">Período:</span>
        {(['30', '90', '180'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={[
              'text-xs px-3 py-1 rounded-full border transition-colors',
              periodo === p
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'border-[var(--border-dim)] text-[var(--text-faint)] hover:text-[var(--text-high)]',
            ].join(' ')}
          >
            {p === '30' ? 'Últimos 30 dias' : p === '90' ? 'Últimos 90 dias' : 'Últimos 6 meses'}
          </button>
        ))}
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <FvmKpiCards kpis={data.kpis} />

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {semInspecoes && (
        <div className="text-center py-10 text-sm text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-lg mb-6">
          Nenhuma inspeção concluída ainda — comece pela Grade de Materiais
        </div>
      )}

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      {!semInspecoes && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[var(--border-dim)] rounded-lg p-4 bg-[var(--bg-raised)]">
            <AprovacaoCategoriaChart data={data.por_categoria} />
          </div>
          <div className="border border-[var(--border-dim)] rounded-lg p-4 bg-[var(--bg-raised)]">
            <EvolucaoLotesChart data={data.evolucao_semanal} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **6.2** Verify with `npm run type-check` — expect zero errors.

---

## Task 7 — Modify `GradeMateriaisPage.tsx` to add grade/dashboard tabs

- [ ] **7.1** Edit `frontend-web/src/modules/fvm/grade/pages/GradeMateriaisPage.tsx`.

  Add import at the top (after the existing imports):
  ```typescript
  import { DashboardFvmTab } from '../../dashboard/DashboardFvmTab';
  import { BarChart2 } from 'lucide-react';
  ```

  Add `aba` state to the component (after the `novoLoteOpen` state):
  ```typescript
  const [aba, setAba] = useState<'grade' | 'dashboard'>('grade');
  ```

  Replace the block starting `{/* ── Filtros ... */}` and everything below it (but BEFORE the Drawer/Modal closing blocks) with the tab bar + conditional rendering:

  After the KPI bar section (`</div>` closing the KPI bar), insert the tab bar:
  ```tsx
  {/* ── Tab bar ────────────────────────────────────────────────────────── */}
  <div className="flex border-b border-[var(--border-dim)] mb-4 -mx-6 px-6">
    <button
      type="button"
      onClick={() => setAba('grade')}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
        aba === 'grade'
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
      )}
    >
      Grade de Materiais
    </button>
    <button
      type="button"
      onClick={() => setAba('dashboard')}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
        aba === 'dashboard'
          ? 'border-[var(--accent)] text-[var(--accent)]'
          : 'border-transparent text-[var(--text-faint)] hover:text-[var(--text-high)]',
      )}
    >
      <BarChart2 size={14} />
      Dashboard
    </button>
  </div>
  ```

  Wrap the existing Filtros + Grade + Legenda sections inside `{aba === 'grade' && ( ... )}`:
  ```tsx
  {aba === 'grade' && (
    <>
      {/* ── Filtros ──────────────────────────────────────────────────────── */}
      {/* ... existing filter JSX unchanged ... */}

      {/* ── Grade Material × Lote ────────────────────────────────────────── */}
      {/* ... existing grade table JSX unchanged ... */}

      {/* ── Legenda ──────────────────────────────────────────────────────── */}
      {/* ... existing legend JSX unchanged ... */}
    </>
  )}

  {aba === 'dashboard' && <DashboardFvmTab obraId={id} />}
  ```

- [ ] **7.2** Verify with `npm run type-check` — expect zero errors. Confirm the grade tab still renders normally.

---

## Task 8 — R-FVM1: `FichaRecebimentoPdf.tsx` + wire into `FichaLotePage.tsx`

- [ ] **8.1** Create `frontend-web/src/modules/fvm/relatorios/pdf/FichaRecebimentoPdf.tsx`:

```typescript
// frontend-web/src/modules/fvm/relatorios/pdf/FichaRecebimentoPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmLotePreview } from '@/services/fvm.service';

// ── Styles (NO Tailwind — StyleSheet.create only) ─────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    color: '#111827',
  },
  header: {
    marginBottom: 16,
    borderBottom: '2px solid #1D4ED8',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
  },
  headerSub: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    padding: '4 6',
    marginBottom: 6,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 16,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 10,
    color: '#111827',
  },
  table: {
    borderTop: '1px solid #E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    padding: '3 6',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #F3F4F6',
    padding: '4 6',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  statusBadge: {
    padding: '2 6',
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
});

// ── Badge color helper ────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
  const map: Record<string, { backgroundColor: string; color: string }> = {
    aprovado:              { backgroundColor: '#D1FAE5', color: '#065F46' },
    aprovado_com_ressalva: { backgroundColor: '#FEF3C7', color: '#92400E' },
    quarentena:            { backgroundColor: '#FFEDD5', color: '#9A3412' },
    reprovado:             { backgroundColor: '#FEE2E2', color: '#991B1B' },
  };
  return map[status] ?? { backgroundColor: '#F3F4F6', color: '#374151' };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aprovado:              'APROVADO',
    aprovado_com_ressalva: 'APROVADO C/ RESSALVA',
    quarentena:            'QUARENTENA',
    reprovado:             'REPROVADO',
    aguardando_inspecao:   'AGUARDANDO INSPEÇÃO',
    em_inspecao:           'EM INSPEÇÃO',
  };
  return map[status] ?? status.toUpperCase().replace(/_/g, ' ');
}

// ── Document component ────────────────────────────────────────────────────────

interface Props {
  lote: FvmLotePreview;
  tenantNome?: string;
  obraNome?: string;
}

export function FichaRecebimentoPdf({ lote, tenantNome, obraNome }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');
  const itens = (lote as any).itens ?? [];
  const ensaios = (lote as any).ensaios ?? [];
  const evidencias = (lote as any).evidencias ?? [];
  const ncs = (lote as any).nao_conformidades ?? [];

  return (
    <Document
      title={`Ficha de Recebimento — Lote ${lote.numero_lote}`}
      author="Eldox"
    >
      <Page size="A4" style={S.page}>
        {/* ── Cabeçalho ────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View>
            <Text style={S.headerTitle}>Ficha de Recebimento de Material</Text>
            <Text style={S.headerSub}>{tenantNome ?? 'Eldox'} · {obraNome ?? `Obra`}</Text>
          </View>
          <View>
            <Text style={S.headerSub}>Gerado em {geradoEm}</Text>
            <Text style={S.headerSub}>Lote #{lote.id}</Text>
          </View>
        </View>

        {/* ── S1 — Identificação do Lote ───────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>1. Identificação do Lote</Text>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Material</Text>
              <Text style={S.fieldValue}>{lote.material_nome}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Fornecedor</Text>
              <Text style={S.fieldValue}>{lote.fornecedor_nome}</Text>
            </View>
          </View>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Número do Lote</Text>
              <Text style={S.fieldValue}>{lote.numero_lote}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Nota Fiscal</Text>
              <Text style={S.fieldValue}>{lote.numero_nf ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Data de Entrega</Text>
              <Text style={S.fieldValue}>{lote.data_entrega}</Text>
            </View>
          </View>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Qtd. NF</Text>
              <Text style={S.fieldValue}>{(lote as any).quantidade_nf ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Qtd. Recebida</Text>
              <Text style={S.fieldValue}>{(lote as any).quantidade_recebida ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Unidade</Text>
              <Text style={S.fieldValue}>{lote.unidade ?? '—'}</Text>
            </View>
          </View>
          {(lote as any).observacao_geral && (
            <View style={S.row}>
              <View style={S.fieldGroup}>
                <Text style={S.fieldLabel}>Observação Geral</Text>
                <Text style={S.fieldValue}>{(lote as any).observacao_geral}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── S2 — Resultado da Inspeção ───────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>2. Resultado da Inspeção</Text>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Status</Text>
              <View style={[S.statusBadge, getStatusStyle(lote.status)]}>
                <Text>{statusLabel(lote.status)}</Text>
              </View>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Inspecionado por</Text>
              <Text style={S.fieldValue}>{(lote as any).inspecionado_por ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Data / Hora</Text>
              <Text style={S.fieldValue}>{(lote as any).inspecionado_em ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── S3 — Checklist ───────────────────────────────────────────── */}
        {itens.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>3. Checklist de Inspeção</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 0.4 }]}>Tipo</Text>
                <Text style={[S.tableHeaderCell, { flex: 2 }]}>Item</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.8 }]}>Resultado</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Observação</Text>
              </View>
              {itens.map((item: any) => (
                <View key={item.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 0.4 }]}>{item.tipo}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{item.descricao}</Text>
                  <Text style={[S.tableCell, { flex: 0.8 }]}>
                    {item.registro_status
                      ? item.registro_status.replace(/_/g, ' ')
                      : 'Não avaliado'}
                  </Text>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>
                    {item.registro_observacao ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── S4 — Ensaios (if any) ────────────────────────────────────── */}
        {ensaios.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>4. Ensaios Laboratoriais</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Ensaio</Text>
                <Text style={[S.tableHeaderCell, { flex: 1 }]}>Norma</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.7 }]}>Valor</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.7 }]}>Min / Max</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Resultado</Text>
              </View>
              {ensaios.map((e: any) => (
                <View key={e.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>{e.nome_ensaio ?? e.tipo}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{e.norma ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.7 }]}>{e.valor_medido ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.7 }]}>
                    {e.valor_minimo != null ? `${e.valor_minimo}` : '—'} / {e.valor_maximo != null ? `${e.valor_maximo}` : '—'}
                  </Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{e.resultado ?? '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── S5 — Evidências ─────────────────────────────────────────── */}
        {evidencias.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>5. Documentos Vinculados</Text>
            {evidencias.map((ev: any, idx: number) => (
              <Text key={ev.id} style={[S.tableCell, { marginBottom: 3 }]}>
                {idx + 1}. [{ev.tipo ?? 'Documento'}] {ev.nome_arquivo ?? ev.nome ?? 'Arquivo'}
              </Text>
            ))}
          </View>
        )}

        {/* ── S6 — NCs ────────────────────────────────────────────────── */}
        {ncs.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>6. Não Conformidades</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 0.5 }]}>NC #</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Item</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Criticidade</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.8 }]}>Ação Imediata</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Status</Text>
              </View>
              {ncs.map((nc: any) => (
                <View key={nc.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 0.5 }]}>{nc.numero ?? nc.id}</Text>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>{nc.item_descricao ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{nc.criticidade}</Text>
                  <Text style={[S.tableCell, { flex: 1.8 }]}>{nc.acao_imediata ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{nc.status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text style={S.footerText}>Lote ID: {lote.id} · {lote.numero_lote}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Export helper ─────────────────────────────────────────────────────────────

export async function downloadFichaRecebimento(
  lote: FvmLotePreview,
  tenantNome?: string,
  obraNome?: string,
): Promise<void> {
  const blob = await pdf(
    <FichaRecebimentoPdf lote={lote} tenantNome={tenantNome} obraNome={obraNome} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ficha-recebimento-${lote.numero_lote.replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **8.2** Edit `frontend-web/src/modules/fvm/grade/pages/FichaLotePage.tsx` to add the export button.

  Add import after existing imports:
  ```typescript
  import { FileDown } from 'lucide-react';
  import { downloadFichaRecebimento } from '../../relatorios/pdf/FichaRecebimentoPdf';
  ```

  Add `exportando` state inside the component:
  ```typescript
  const [exportando, setExportando] = useState(false);
  ```

  Add export button in the header (alongside the back arrow, to the right side after the lote info div):
  ```tsx
  <button
    onClick={async () => {
      if (!lote) return;
      setExportando(true);
      try {
        await downloadFichaRecebimento(lote);
      } finally {
        setExportando(false);
      }
    }}
    disabled={exportando}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
  >
    <FileDown size={13} />
    {exportando ? 'Gerando...' : 'Exportar Ficha PDF'}
  </button>
  ```

- [ ] **8.3** Verify with `npm run type-check` — expect zero errors.

---

## Task 9 — R-FVM2: `NcsFvmPdf.tsx` + `NcsFvmXlsx.ts` + export button in GradeMateriaisPage

- [ ] **9.1** Create `frontend-web/src/modules/fvm/relatorios/pdf/NcsFvmPdf.tsx`:

```typescript
// frontend-web/src/modules/fvm/relatorios/pdf/NcsFvmPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmNcRelatorio } from '@/services/fvm.service';

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    color: '#111827',
  },
  header: {
    marginBottom: 14,
    borderBottom: '2px solid #1D4ED8',
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  sub:   { fontSize: 8, color: '#6B7280', marginTop: 2 },
  groupHeader: {
    backgroundColor: '#F3F4F6',
    padding: '4 6',
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 2,
  },
  groupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  table: { borderTop: '1px solid #E5E7EB' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottom: '1px solid #DBEAFE',
    padding: '3 4',
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1D4ED8', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '3 4' },
  td: { fontSize: 8, color: '#374151' },
  critCritico: { color: '#991B1B', fontFamily: 'Helvetica-Bold' },
  critMaior:   { color: '#92400E' },
  slaOk:   { color: '#065F46' },
  slaFail: { color: '#991B1B' },
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB', paddingTop: 4,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

interface Props {
  ncs: FvmNcRelatorio[];
  obraNome?: string;
  periodo?: string;
}

export function NcsFvmPdf({ ncs, obraNome, periodo }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');

  // Group by fornecedor
  const grouped = ncs.reduce<Record<string, FvmNcRelatorio[]>>((acc, nc) => {
    const key = nc.fornecedor_nome;
    if (!acc[key]) acc[key] = [];
    acc[key].push(nc);
    return acc;
  }, {});

  const totalCriticas = ncs.filter(n => n.criticidade === 'critico').length;
  const totalMaiores  = ncs.filter(n => n.criticidade === 'maior').length;
  const totalMenores  = ncs.filter(n => n.criticidade === 'menor').length;
  const slaOk         = ncs.filter(n => n.sla_ok).length;

  return (
    <Document title={`NCs FVM — ${obraNome ?? 'Obra'}`} author="Eldox">
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>Relatório de Não Conformidades — FVM</Text>
            <Text style={S.sub}>{obraNome ?? 'Obra'}{periodo ? ` · ${periodo}` : ''}</Text>
          </View>
          <View>
            <Text style={S.sub}>Total: {ncs.length} NCs</Text>
            <Text style={S.sub}>Críticas: {totalCriticas} · Maiores: {totalMaiores} · Menores: {totalMenores}</Text>
            <Text style={S.sub}>SLA no prazo: {slaOk}/{ncs.length}</Text>
          </View>
        </View>

        {/* Groups */}
        {Object.entries(grouped).map(([fornecedor, items]) => (
          <View key={fornecedor}>
            <View style={S.groupHeader}>
              <Text style={S.groupTitle}>{fornecedor} — {items.length} NC(s)</Text>
            </View>
            <View style={S.table}>
              <View style={S.tableHead}>
                <Text style={[S.th, { flex: 0.6 }]}>NC #</Text>
                <Text style={[S.th, { flex: 1 }]}>Lote</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Material</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Criticidade</Text>
                <Text style={[S.th, { flex: 0.8 }]}>Tipo</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Status</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Prazo</Text>
                <Text style={[S.th, { flex: 0.5 }]}>SLA</Text>
              </View>
              {items.map(nc => (
                <View key={nc.id} style={S.tableRow}>
                  <Text style={[S.td, { flex: 0.6 }]}>{nc.numero}</Text>
                  <Text style={[S.td, { flex: 1 }]}>{nc.lote_numero}</Text>
                  <Text style={[S.td, { flex: 1.5 }]}>{nc.material_nome}</Text>
                  <Text style={[
                    S.td,
                    { flex: 0.7 },
                    nc.criticidade === 'critico' ? S.critCritico : nc.criticidade === 'maior' ? S.critMaior : {},
                  ]}>
                    {nc.criticidade}
                  </Text>
                  <Text style={[S.td, { flex: 0.8 }]}>{nc.tipo}</Text>
                  <Text style={[S.td, { flex: 0.7 }]}>{nc.status}</Text>
                  <Text style={[S.td, { flex: 0.7 }]}>{nc.prazo ?? '—'}</Text>
                  <Text style={[S.td, { flex: 0.5 }, nc.sla_ok ? S.slaOk : S.slaFail]}>
                    {nc.sla_ok ? 'OK' : 'VENCIDA'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text style={S.footerText}>{ncs.length} não conformidades</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadNcsFvmPdf(
  ncs: FvmNcRelatorio[],
  obraNome?: string,
  periodo?: string,
): Promise<void> {
  const blob = await pdf(<NcsFvmPdf ncs={ncs} obraNome={obraNome} periodo={periodo} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ncs-fvm-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **9.2** Create `frontend-web/src/modules/fvm/relatorios/excel/NcsFvmXlsx.ts`:

```typescript
// frontend-web/src/modules/fvm/relatorios/excel/NcsFvmXlsx.ts
import ExcelJS from 'exceljs';
import type { FvmNcRelatorio } from '@/services/fvm.service';

export async function downloadNcsFvmXlsx(
  ncs: FvmNcRelatorio[],
  obraNome?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  const ws = wb.addWorksheet('NCs FVM', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // ── Column definitions ───────────────────────────────────────────────────
  ws.columns = [
    { header: 'NC #',        key: 'numero',          width: 12 },
    { header: 'Lote',        key: 'lote_numero',     width: 16 },
    { header: 'Material',    key: 'material_nome',   width: 24 },
    { header: 'Fornecedor',  key: 'fornecedor_nome', width: 28 },
    { header: 'Criticidade', key: 'criticidade',     width: 13 },
    { header: 'Tipo',        key: 'tipo',            width: 14 },
    { header: 'Status',      key: 'status',          width: 14 },
    { header: 'Prazo',       key: 'prazo',           width: 14 },
    { header: 'SLA',         key: 'sla',             width: 10 },
    { header: 'Ação Imediata', key: 'acao_imediata', width: 34 },
  ];

  // ── Header row styles ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.font    = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.height  = 22;
  headerRow.alignment = { vertical: 'middle' };

  // ── Data rows ─────────────────────────────────────────────────────────────
  ncs.forEach((nc) => {
    const row = ws.addRow({
      numero:          nc.numero,
      lote_numero:     nc.lote_numero,
      material_nome:   nc.material_nome,
      fornecedor_nome: nc.fornecedor_nome,
      criticidade:     nc.criticidade,
      tipo:            nc.tipo,
      status:          nc.status,
      prazo:           nc.prazo ?? '',
      sla:             nc.sla_ok ? 'No prazo' : 'Vencida',
      acao_imediata:   nc.acao_imediata ?? '',
    });

    // Color criticidade cell
    const critCell = row.getCell('criticidade');
    if (nc.criticidade === 'critico') {
      critCell.font = { bold: true, color: { argb: 'FF991B1B' } };
      critCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else if (nc.criticidade === 'maior') {
      critCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    }

    // Color SLA cell
    const slaCell = row.getCell('sla');
    slaCell.font = { color: { argb: nc.sla_ok ? 'FF065F46' : 'FF991B1B' } };
  });

  // ── Summary sheet ─────────────────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Resumo');
  wsSummary.addRow(['Resumo NCs FVM', obraNome ?? '']).font = { bold: true, size: 12 };
  wsSummary.addRow([]);
  wsSummary.addRow(['Total NCs',         ncs.length]);
  wsSummary.addRow(['Críticas',          ncs.filter(n => n.criticidade === 'critico').length]);
  wsSummary.addRow(['Maiores',           ncs.filter(n => n.criticidade === 'maior').length]);
  wsSummary.addRow(['Menores',           ncs.filter(n => n.criticidade === 'menor').length]);
  wsSummary.addRow(['SLA no prazo',      ncs.filter(n => n.sla_ok).length]);
  wsSummary.addRow(['SLA vencidas',      ncs.filter(n => !n.sla_ok).length]);
  wsSummary.addRow(['Gerado em',         new Date().toLocaleString('pt-BR')]);

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `ncs-fvm-${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **9.3** Add NCs export buttons to `GradeMateriaisPage.tsx` dashboard tab (inside `DashboardFvmTab.tsx` is also acceptable — place them in the dashboard tab header toolbar):

  In `DashboardFvmTab.tsx`, import and add export buttons. Add after the existing imports:
  ```typescript
  import { useFvmNcsRelatorio } from './hooks/useFvmDashboard';
  import { downloadNcsFvmPdf } from '../relatorios/pdf/NcsFvmPdf';
  import { downloadNcsFvmXlsx } from '../relatorios/excel/NcsFvmXlsx';
  import { FileText, FileSpreadsheet } from 'lucide-react';
  ```

  Add these export buttons in the period filter row (right side):
  ```tsx
  <div className="ml-auto flex gap-2">
    <button
      onClick={async () => {
        const ncs = await fvmService.getNcsRelatorio(obraId);
        await downloadNcsFvmPdf(ncs);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors"
    >
      <FileText size={13} />
      NCs PDF
    </button>
    <button
      onClick={async () => {
        const ncs = await fvmService.getNcsRelatorio(obraId);
        await downloadNcsFvmXlsx(ncs);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-dim)] text-xs text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors"
    >
      <FileSpreadsheet size={13} />
      NCs Excel
    </button>
  </div>
  ```

  Also import `fvmService` in `DashboardFvmTab.tsx`:
  ```typescript
  import { fvmService } from '@/services/fvm.service';
  ```

- [ ] **9.4** Verify with `npm run type-check` — expect zero errors.

---

## Task 10 — R-FVM3: `PerformanceFornecedoresPdf.tsx` + `PerformanceFornecedoresXlsx.ts` + score calc + wire into `FornecedoresPage.tsx`

- [ ] **10.1** Create `frontend-web/src/modules/fvm/relatorios/pdf/PerformanceFornecedoresPdf.tsx`:

```typescript
// frontend-web/src/modules/fvm/relatorios/pdf/PerformanceFornecedoresPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    color: '#111827',
  },
  header: {
    marginBottom: 14,
    borderBottom: '2px solid #1D4ED8',
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  sub:    { fontSize: 8,  color: '#6B7280', marginTop: 2 },
  table:  { borderTop: '1px solid #E5E7EB' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottom: '1px solid #DBEAFE',
    padding: '3 4',
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1D4ED8', textTransform: 'uppercase' },
  tableRow:   { flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '4 4' },
  tableRowAlt:{ flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '4 4', backgroundColor: '#F9FAFB' },
  td:       { fontSize: 8, color: '#374151' },
  rankCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  scoreGreen:  { color: '#065F46', fontFamily: 'Helvetica-Bold' },
  scoreYellow: { color: '#92400E', fontFamily: 'Helvetica-Bold' },
  scoreRed:    { color: '#991B1B', fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB', paddingTop: 4,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function scoreStyle(score: number) {
  if (score >= 70) return S.scoreGreen;
  if (score >= 50) return S.scoreYellow;
  return S.scoreRed;
}

interface Props {
  fornecedores: FvmPerformanceFornecedor[];
  periodo?: string;
}

export function PerformanceFornecedoresPdf({ fornecedores, periodo }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');
  const sorted   = [...fornecedores].sort((a, b) => b.score - a.score);

  return (
    <Document title="Performance de Fornecedores — FVM" author="Eldox">
      <Page size="A4" orientation="landscape" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>Relatório de Performance de Fornecedores — FVM</Text>
            {periodo && <Text style={S.sub}>Período: {periodo}</Text>}
          </View>
          <View>
            <Text style={S.sub}>{fornecedores.length} fornecedores avaliados</Text>
            <Text style={S.sub}>Gerado em {geradoEm}</Text>
          </View>
        </View>

        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.th, { flex: 0.3 }]}>#</Text>
            <Text style={[S.th, { flex: 2 }]}>Fornecedor</Text>
            <Text style={[S.th, { flex: 1 }]}>CNPJ</Text>
            <Text style={[S.th, { flex: 0.7 }]}>Lotes</Text>
            <Text style={[S.th, { flex: 0.8 }]}>Taxa Apr.</Text>
            <Text style={[S.th, { flex: 0.6 }]}>NCs</Text>
            <Text style={[S.th, { flex: 0.7 }]}>NCs Crít.</Text>
            <Text style={[S.th, { flex: 0.8 }]}>Ens. Rep.</Text>
            <Text style={[S.th, { flex: 0.7 }]}>Score</Text>
          </View>

          {sorted.map((f, idx) => (
            <View key={f.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.rankCell, { flex: 0.3 }]}>{idx + 1}º</Text>
              <View style={{ flex: 2 }}>
                <Text style={S.td}>{f.razao_social}</Text>
              </View>
              <Text style={[S.td, { flex: 1 }]}>{f.cnpj ?? '—'}</Text>
              <Text style={[S.td, { flex: 0.7 }]}>{f.total_lotes}</Text>
              <Text style={[S.td, { flex: 0.8 }]}>{f.taxa_aprovacao.toFixed(1)}%</Text>
              <Text style={[S.td, { flex: 0.6 }]}>{f.total_ncs}</Text>
              <Text style={[S.td, { flex: 0.7 }, f.ncs_criticas > 0 ? S.scoreRed : {}]}>
                {f.ncs_criticas}
              </Text>
              <Text style={[S.td, { flex: 0.8 }]}>
                {f.ensaios_reprovados}/{f.total_ensaios}
              </Text>
              <Text style={[S.td, { flex: 0.7 }, scoreStyle(f.score)]}>
                {f.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            Score = (taxa_apr × 0.5) + ((1 − ncs_crit/lotes) × 100 × 0.3) + ((1 − ens_rep/ens_total) × 100 × 0.2) · Gerado pelo Eldox
          </Text>
          <Text style={S.footerText}>{geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPerformancePdf(
  fornecedores: FvmPerformanceFornecedor[],
  periodo?: string,
): Promise<void> {
  const blob = await pdf(
    <PerformanceFornecedoresPdf fornecedores={fornecedores} periodo={periodo} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `performance-fornecedores-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **10.2** Create `frontend-web/src/modules/fvm/relatorios/excel/PerformanceFornecedoresXlsx.ts`:

```typescript
// frontend-web/src/modules/fvm/relatorios/excel/PerformanceFornecedoresXlsx.ts
import ExcelJS from 'exceljs';
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

export async function downloadPerformanceXlsx(
  fornecedores: FvmPerformanceFornecedor[],
  periodo?: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  const ws = wb.addWorksheet('Performance Fornecedores', {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // ── Column definitions ───────────────────────────────────────────────────
  ws.columns = [
    { header: 'Ranking',            key: 'ranking',              width: 10 },
    { header: 'Fornecedor',         key: 'razao_social',         width: 32 },
    { header: 'CNPJ',               key: 'cnpj',                 width: 18 },
    { header: 'Total Lotes',        key: 'total_lotes',          width: 13 },
    { header: 'Taxa Aprovação (%)', key: 'taxa_aprovacao',       width: 18 },
    { header: 'Total NCs',          key: 'total_ncs',            width: 12 },
    { header: 'NCs Críticas',       key: 'ncs_criticas',         width: 14 },
    { header: 'Ensaios Reprovados', key: 'ensaios_reprovados',   width: 18 },
    { header: 'Total Ensaios',      key: 'total_ensaios',        width: 14 },
    { header: 'Score (0–100)',      key: 'score',                width: 14 },
  ];

  // ── Header row styles ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.height    = 22;
  headerRow.alignment = { vertical: 'middle' };

  // ── Data rows — sorted by score desc ─────────────────────────────────────
  const sorted = [...fornecedores].sort((a, b) => b.score - a.score);

  sorted.forEach((f, idx) => {
    const row = ws.addRow({
      ranking:            idx + 1,
      razao_social:       f.razao_social,
      cnpj:               f.cnpj ?? '',
      total_lotes:        f.total_lotes,
      taxa_aprovacao:     f.taxa_aprovacao,
      total_ncs:          f.total_ncs,
      ncs_criticas:       f.ncs_criticas,
      ensaios_reprovados: f.ensaios_reprovados,
      total_ensaios:      f.total_ensaios,
      score:              f.score,
    });

    // Score conditional formatting
    const scoreCell = row.getCell('score');
    scoreCell.font = { bold: true };
    if (f.score >= 70) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      scoreCell.font = { bold: true, color: { argb: 'FF065F46' } };
    } else if (f.score >= 50) {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      scoreCell.font = { bold: true, color: { argb: 'FF92400E' } };
    } else {
      scoreCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      scoreCell.font = { bold: true, color: { argb: 'FF991B1B' } };
    }

    // Flag critical NCs
    if (f.ncs_criticas > 0) {
      row.getCell('ncs_criticas').font = { bold: true, color: { argb: 'FF991B1B' } };
    }
  });

  // ── Formula sheet ─────────────────────────────────────────────────────────
  const wsInfo = wb.addWorksheet('Metodologia');
  wsInfo.addRow(['Fórmula do Score de Fornecedores — Eldox FVM']).font = { bold: true, size: 12 };
  wsInfo.addRow([]);
  wsInfo.addRow(['Score = (taxa_aprovacao × 0.5) + ((1 − ncs_criticas/total_lotes) × 100 × 0.3) + ((1 − ensaios_reprovados/total_ensaios) × 100 × 0.2)']);
  wsInfo.addRow([]);
  wsInfo.addRow(['Componente',           'Peso', 'Descrição']);
  wsInfo.addRow(['Taxa de Aprovação',    '50%',  'Percentual de lotes aprovados ou aprovados c/ ressalva']);
  wsInfo.addRow(['NCs Críticas',         '30%',  '(1 - ncs_criticas / total_lotes) × 100']);
  wsInfo.addRow(['Ensaios Reprovados',   '20%',  '(1 - ensaios_reprovados / total_ensaios) × 100']);
  wsInfo.addRow([]);
  wsInfo.addRow(['Score clamped to [0, 100]']);
  wsInfo.addRow(['Período:', periodo ?? 'Todos os tempos']);
  wsInfo.addRow(['Gerado em:', new Date().toLocaleString('pt-BR')]);

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `performance-fornecedores-${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **10.3** Create `frontend-web/src/modules/fvm/relatorios/excel/scoreCalculator.ts` (pure score helper, used by FornecedoresPage and Excel report):

```typescript
// frontend-web/src/modules/fvm/relatorios/excel/scoreCalculator.ts
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

/**
 * Compute performance score for a single supplier.
 * Score = (taxa_aprovacao × 0.5)
 *       + ((1 − ncs_criticas / total_lotes) × 100 × 0.3)
 *       + ((1 − ensaios_reprovados / total_ensaios) × 100 × 0.2)
 * Clamped to [0, 100].
 *
 * Edge cases:
 * - total_lotes === 0: supplier omitted upstream (never called)
 * - total_ensaios === 0: third term treated as 100 (no failed ensaios = perfect)
 */
export function calcularScore(f: Omit<FvmPerformanceFornecedor, 'score'>): number {
  const component1 = f.taxa_aprovacao * 0.5;

  const ratioCriticas = f.total_lotes > 0 ? f.ncs_criticas / f.total_lotes : 0;
  const component2    = (1 - ratioCriticas) * 100 * 0.3;

  const ratioEnsaios = f.total_ensaios > 0 ? f.ensaios_reprovados / f.total_ensaios : 0;
  const component3   = (1 - ratioEnsaios) * 100 * 0.2;

  const raw = component1 + component2 + component3;
  return Math.min(100, Math.max(0, raw));
}
```

- [ ] **10.4** Edit `frontend-web/src/modules/fvm/fornecedores/pages/FornecedoresPage.tsx` to add the performance report button.

  Add imports at the top:
  ```typescript
  import { useFvmPerformance, usePatchFornecedorScore } from '../../dashboard/hooks/useFvmDashboard';
  import { calcularScore } from '../../relatorios/excel/scoreCalculator';
  import { downloadPerformancePdf } from '../../relatorios/pdf/PerformanceFornecedoresPdf';
  import { downloadPerformanceXlsx } from '../../relatorios/excel/PerformanceFornecedoresXlsx';
  import type { FvmPerformanceFornecedor } from '@/services/fvm.service';
  import { BarChart2, FileDown, FileSpreadsheet } from 'lucide-react';
  ```

  Add `gerandoRelatorio` state and `patchScore` mutation inside the component:
  ```typescript
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const patchScore = usePatchFornecedorScore();
  ```

  Add handler to generate, save scores, and download:
  ```typescript
  async function gerarRelatorioPerformance(formato: 'pdf' | 'xlsx') {
    setGerandoRelatorio(true);
    try {
      const rawData = await fvmService.getPerformanceFornecedores();

      // Calculate score client-side and attach it
      const withScore: FvmPerformanceFornecedor[] = rawData.map(f => ({
        ...f,
        score: calcularScore(f),
      }));

      // Persist scores back to server (fire-and-forget, don't block UI)
      withScore.forEach(f => {
        patchScore.mutate({ id: f.id, score: f.score });
      });

      if (formato === 'pdf') {
        await downloadPerformancePdf(withScore);
      } else {
        await downloadPerformanceXlsx(withScore);
      }
    } finally {
      setGerandoRelatorio(false);
    }
  }
  ```

  Add `fvmService` import:
  ```typescript
  import { fvmService } from '@/services/fvm.service';
  ```

  Add the report buttons in the header row (next to "Novo Fornecedor"):
  ```tsx
  <div className="flex items-center gap-2">
    <button
      onClick={() => gerarRelatorioPerformance('pdf')}
      disabled={gerandoRelatorio}
      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
    >
      <FileDown size={14} />
      {gerandoRelatorio ? 'Gerando...' : 'Performance PDF'}
    </button>
    <button
      onClick={() => gerarRelatorioPerformance('xlsx')}
      disabled={gerandoRelatorio}
      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
    >
      <FileSpreadsheet size={14} />
      {gerandoRelatorio ? 'Gerando...' : 'Performance Excel'}
    </button>
    <button
      className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
      onClick={() => setModalOpen(true)}
    >
      <Plus size={15} />
      Novo Fornecedor
    </button>
  </div>
  ```

  Replace the existing single "Novo Fornecedor" button with the above block.

- [ ] **10.5** Verify with `npm run type-check` — expect zero errors.

---

## Self-Review Checklist

> Verify before marking this plan complete.

1. **Backend endpoint shape** — `getDashboard` returns `{ kpis, por_categoria, evolucao_semanal }` with all fields matching `FvmDashboardKpis`, `FvmDashboardCategoria[]`, `FvmDashboardSemana[]` exactly as the spec defines. Confirmed: Task 1.2 SQL covers all 8 KPI fields, por_categoria has `categoria_id/categoria_nome/total_lotes/taxa_aprovacao`, evolucao_semanal has `semana/aprovados/quarentena/reprovados/aguardando`.

2. **Score formula** — `scoreCalculator.ts` (Task 10.3) implements exactly:
   `score = (taxa_aprovacao * 0.5) + ((1 - ncs_criticas/total_lotes) * 100 * 0.3) + ((1 - ensaios_reprovados/total_ensaios) * 100 * 0.2)` and clamps with `Math.min(100, Math.max(0, raw))`. Weights: 0.5, 0.3, 0.2 confirmed.

3. **All 3 PDFs use `@react-pdf/renderer` StyleSheet** — `FichaRecebimentoPdf.tsx`, `NcsFvmPdf.tsx`, `PerformanceFornecedoresPdf.tsx` all use `StyleSheet.create` exclusively. No Tailwind classes inside `<Document>` / `<Page>`.

4. **GradeMateriaisPage tab change** — Task 7 wraps existing grade content in `{aba === 'grade' && (...)}` and mounts `<DashboardFvmTab>` only when `aba === 'dashboard'`. All existing state (drawerCell, novoLoteOpen, filtros, grade data) is unchanged and fully preserved.

5. **Performance report saves score back** — Task 10.4 calls `patchScore.mutate({ id: f.id, score: f.score })` for every supplier after calculating scores client-side, before triggering the file download. The `PATCH /api/v1/fvm/fornecedores/:id/score` endpoint (Task 3) persists to `fvm_fornecedores.avaliacao_score` via raw SQL UPDATE.
