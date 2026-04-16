# FVS — Gráficos Avançados (Dashboard): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 advanced charts to the FVS Dashboard: temporal evolution (LineChart), conformance by service (BarChart), service×period heatmap (CSS Grid), and inspection funnel (custom SVG).

**Architecture:** One new backend endpoint returns all chart data in a single request. Four dedicated chart components + a container component added to the existing FvsDashboardPage below the KPI section. Period filters are URL-synced via useSearchParams.

**Tech Stack:** recharts 3.8.1 (already installed), NestJS, Prisma (`$queryRawUnsafe`), TanStack Query v5, useSearchParams (react-router-dom v7)

---

## File Map

### Backend — new files
| File | Responsibility |
|---|---|
| `backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts` | Query params DTO with validation |
| `backend/src/fvs/dashboard/fvs-graficos.service.ts` | SQL queries for all 4 data shapes |

### Backend — modified files
| File | Change |
|---|---|
| `backend/src/fvs/dashboard/fvs-dashboard.controller.ts` | Add `GET obras/:obraId/dashboard-graficos` route |
| `backend/src/fvs/fvs.module.ts` | Register `FvsGraficosService` as provider |

### Frontend — new files
| File | Responsibility |
|---|---|
| `frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts` | TanStack Query hook |
| `frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx` | Period selector, URL-synced |
| `frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx` | Container: fetches data, renders 4 charts + skeletons |
| `frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx` | recharts LineChart, multi-series, 85% target |
| `frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx` | recharts BarChart horizontal, color-coded bars |
| `frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx` | CSS Grid heatmap, sticky headers |
| `frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx` | Custom SVG funnel, 5 stages |

### Frontend — modified files
| File | Change |
|---|---|
| `frontend-web/src/services/fvs.service.ts` | Add `getDashboardGraficos()` method + types |
| `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx` | Add `<GraficosAvancados>` section below KPIs |

---

## Task 1: Backend DTO + Service — `fvs-graficos.service.ts`

**Files:**
- Create: `backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts`
- Create: `backend/src/fvs/dashboard/fvs-graficos.service.ts`

- [ ] **Step 1.1: Create the query DTO**

Create `backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts`:

```typescript
// backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts
import { IsDateString, IsIn, IsOptional, IsArray, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class DashboardGraficosQueryDto {
  @IsDateString()
  data_inicio: string; // ISO date string: "2025-01-01"

  @IsDateString()
  data_fim: string; // ISO date string: "2025-12-31"

  @IsOptional()
  @IsIn(['semana', 'mes'])
  granularidade?: 'semana' | 'mes' = 'semana';

  // Accept repeated query param: ?servico_ids=1&servico_ids=2
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  servico_ids?: number[];
}
```

- [ ] **Step 1.2: Create `FvsGraficosService` with all 4 SQL queries**

Create `backend/src/fvs/dashboard/fvs-graficos.service.ts`:

```typescript
// backend/src/fvs/dashboard/fvs-graficos.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DashboardGraficosQueryDto } from './dto/dashboard-graficos-query.dto';

// ── Response shape interfaces ────────────────────────────────────────────────

export interface EvolucaoTemporalSerie {
  servico_id: number;
  servico_nome: string;
  cor: string;
  valores: (number | null)[];
}

export interface EvolucaoTemporalResult {
  labels: string[];
  series: EvolucaoTemporalSerie[];
}

export interface ConformidadePorServicoItem {
  servico_id: number;
  servico_nome: string;
  total_inspecoes: number;
  taxa_conformidade: number;
  ncs_abertas: number;
  tendencia: 'subindo' | 'caindo' | 'estavel';
}

export interface HeatmapCelula {
  servico_idx: number;
  periodo_idx: number;
  taxa: number | null;
  total_inspecoes: number;
}

export interface HeatmapResult {
  servicos: string[];
  periodos: string[];
  celulas: HeatmapCelula[];
}

export interface FunilResult {
  total_fichas: number;
  concluidas: number;
  aprovadas: number;
  com_nc: number;
  com_pa: number;
}

export interface DashboardGraficosResult {
  evolucao_temporal: EvolucaoTemporalResult;
  conformidade_por_servico: ConformidadePorServicoItem[];
  heatmap: HeatmapResult;
  funil: FunilResult;
}

// ── Deterministic hex colour from numeric id ─────────────────────────────────

function idToHex(id: number): string {
  const palette = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
  ];
  return palette[id % palette.length];
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FvsGraficosService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardGraficos(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ): Promise<DashboardGraficosResult> {
    const [evolucaoRaw, conformidadeRaw, heatmapRaw, funilRaw] = await Promise.all([
      this._queryEvolucao(tenantId, obraId, dto),
      this._queryConformidade(tenantId, obraId, dto),
      this._queryHeatmap(tenantId, obraId, dto),
      this._queryFunil(tenantId, obraId, dto),
    ]);

    return {
      evolucao_temporal: this._transformEvolucao(evolucaoRaw, dto),
      conformidade_por_servico: this._transformConformidade(conformidadeRaw),
      heatmap: this._transformHeatmap(heatmapRaw, dto),
      funil: funilRaw[0] ?? { total_fichas: 0, concluidas: 0, aprovadas: 0, com_nc: 0, com_pa: 0 },
    };
  }

  // ── Evolução temporal raw query ─────────────────────────────────────────────

  private async _queryEvolucao(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const trunc = dto.granularidade === 'mes' ? 'month' : 'week';
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    return this.prisma.$queryRawUnsafe<
      Array<{
        periodo: Date;
        servico_id: number;
        servico_nome: string;
        taxa_conformidade: number | null;
      }>
    >(
      `SELECT
         DATE_TRUNC('${trunc}', r.inspecionado_em) AS periodo,
         cs.id AS servico_id,
         cs.nome AS servico_nome,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
           NULLIF(COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0),
           1
         ) AS taxa_conformidade
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1
         AND r.tenant_id = $2
         AND r.inspecionado_em BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND r.inspecionado_em IS NOT NULL
         ${servicoFilter}
       GROUP BY DATE_TRUNC('${trunc}', r.inspecionado_em), cs.id, cs.nome
       ORDER BY periodo, cs.nome`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformEvolucao(
    rows: Array<{ periodo: Date; servico_id: number; servico_nome: string; taxa_conformidade: number | null }>,
    dto: DashboardGraficosQueryDto,
  ): EvolucaoTemporalResult {
    if (rows.length === 0) return { labels: [], series: [] };

    // Build sorted unique label list
    const labelSet = new Map<string, string>(); // isoKey -> display label
    for (const row of rows) {
      const d = new Date(row.periodo);
      const isoKey = d.toISOString().slice(0, 10);
      const display =
        dto.granularidade === 'mes'
          ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
          : `Sem ${Math.ceil(d.getDate() / 7)} — ${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
      labelSet.set(isoKey, display);
    }
    const sortedKeys = Array.from(labelSet.keys()).sort();
    const labels = sortedKeys.map((k) => labelSet.get(k)!);

    // Build per-service map
    const serviceMap = new Map<number, { nome: string; values: Map<string, number | null> }>();
    for (const row of rows) {
      const isoKey = new Date(row.periodo).toISOString().slice(0, 10);
      if (!serviceMap.has(row.servico_id)) {
        serviceMap.set(row.servico_id, { nome: row.servico_nome, values: new Map() });
      }
      serviceMap.get(row.servico_id)!.values.set(isoKey, row.taxa_conformidade);
    }

    const series: EvolucaoTemporalSerie[] = Array.from(serviceMap.entries()).map(([id, s]) => ({
      servico_id: id,
      servico_nome: s.nome,
      cor: idToHex(id),
      valores: sortedKeys.map((k) => s.values.get(k) ?? null),
    }));

    return { labels, series };
  }

  // ── Conformidade por serviço ────────────────────────────────────────────────

  private async _queryConformidade(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    // Split time range in half to compute tendency
    return this.prisma.$queryRawUnsafe<
      Array<{
        servico_id: number;
        servico_nome: string;
        total_inspecoes: number;
        taxa_conformidade: number;
        ncs_abertas: number;
        taxa_primeira_metade: number | null;
        taxa_segunda_metade: number | null;
      }>
    >(
      `WITH periodo AS (
         SELECT
           $3::date AS inicio,
           $4::date AS fim,
           ($3::date + ($4::date - $3::date) / 2) AS meio
       ),
       base AS (
         SELECT
           cs.id AS servico_id,
           cs.nome AS servico_nome,
           COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel'))::int AS total_inspecoes,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0), 1
           ) AS taxa_conformidade,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')
               AND r.inspecionado_em < (SELECT meio FROM periodo)) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')
               AND r.inspecionado_em < (SELECT meio FROM periodo)), 0), 1
           ) AS taxa_primeira_metade,
           ROUND(
             100.0 * COUNT(r.id) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')
               AND r.inspecionado_em >= (SELECT meio FROM periodo)) /
             NULLIF(COUNT(r.id) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')
               AND r.inspecionado_em >= (SELECT meio FROM periodo)), 0), 1
           ) AS taxa_segunda_metade
         FROM fvs_registros r
         JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1
           AND r.tenant_id = $2
           AND r.inspecionado_em BETWEEN (SELECT inicio FROM periodo) AND (SELECT fim FROM periodo) + INTERVAL '1 day'
           AND r.inspecionado_em IS NOT NULL
           ${servicoFilter}
         GROUP BY cs.id, cs.nome
       ),
       ncs AS (
         SELECT r.servico_id, COUNT(nc.id)::int AS ncs_abertas
         FROM fvs_nao_conformidades nc
         JOIN fvs_registros r ON r.id = nc.registro_id
         JOIN fvs_fichas f ON f.id = r.ficha_id
         WHERE f.obra_id = $1 AND nc.tenant_id = $2 AND nc.status = 'aberta'
         GROUP BY r.servico_id
       )
       SELECT b.*, COALESCE(n.ncs_abertas, 0) AS ncs_abertas
       FROM base b
       LEFT JOIN ncs n ON n.servico_id = b.servico_id
       WHERE b.total_inspecoes > 0
       ORDER BY b.taxa_conformidade ASC`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformConformidade(
    rows: Array<{
      servico_id: number;
      servico_nome: string;
      total_inspecoes: number;
      taxa_conformidade: number;
      ncs_abertas: number;
      taxa_primeira_metade: number | null;
      taxa_segunda_metade: number | null;
    }>,
  ): ConformidadePorServicoItem[] {
    return rows.map((r) => {
      let tendencia: 'subindo' | 'caindo' | 'estavel' = 'estavel';
      if (r.taxa_primeira_metade !== null && r.taxa_segunda_metade !== null) {
        const delta = r.taxa_segunda_metade - r.taxa_primeira_metade;
        if (delta > 3) tendencia = 'subindo';
        else if (delta < -3) tendencia = 'caindo';
      }
      return {
        servico_id: Number(r.servico_id),
        servico_nome: r.servico_nome,
        total_inspecoes: Number(r.total_inspecoes),
        taxa_conformidade: Number(r.taxa_conformidade),
        ncs_abertas: Number(r.ncs_abertas),
        tendencia,
      };
    });
  }

  // ── Heatmap ─────────────────────────────────────────────────────────────────

  private async _queryHeatmap(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    const trunc = dto.granularidade === 'mes' ? 'month' : 'week';
    const servicoFilter =
      dto.servico_ids && dto.servico_ids.length > 0
        ? `AND r.servico_id = ANY(ARRAY[${dto.servico_ids.join(',')}]::int[])`
        : '';

    return this.prisma.$queryRawUnsafe<
      Array<{
        servico_id: number;
        servico_nome: string;
        periodo: Date;
        taxa: number | null;
        total_inspecoes: number;
      }>
    >(
      `SELECT
         cs.id AS servico_id,
         cs.nome AS servico_nome,
         DATE_TRUNC('${trunc}', r.inspecionado_em) AS periodo,
         ROUND(
           100.0 * COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) /
           NULLIF(COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel')), 0),
           1
         ) AS taxa,
         COUNT(*) FILTER (WHERE r.status NOT IN ('nao_avaliado','nao_aplicavel'))::int AS total_inspecoes
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN fvs_fichas f ON f.id = r.ficha_id
       WHERE f.obra_id = $1
         AND r.tenant_id = $2
         AND r.inspecionado_em BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND r.inspecionado_em IS NOT NULL
         ${servicoFilter}
       GROUP BY cs.id, cs.nome, DATE_TRUNC('${trunc}', r.inspecionado_em)
       ORDER BY cs.nome, periodo`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }

  private _transformHeatmap(
    rows: Array<{ servico_id: number; servico_nome: string; periodo: Date; taxa: number | null; total_inspecoes: number }>,
    dto: DashboardGraficosQueryDto,
  ): HeatmapResult {
    if (rows.length === 0) return { servicos: [], periodos: [], celulas: [] };

    const servicoNames: string[] = [];
    const servicoIdx = new Map<number, number>();
    const periodoKeys: string[] = [];
    const periodoIdx = new Map<string, number>();

    for (const row of rows) {
      if (!servicoIdx.has(row.servico_id)) {
        servicoIdx.set(row.servico_id, servicoNames.length);
        servicoNames.push(row.servico_nome);
      }
      const isoKey = new Date(row.periodo).toISOString().slice(0, 10);
      if (!periodoIdx.has(isoKey)) {
        periodoIdx.set(isoKey, periodoKeys.length);
        periodoKeys.push(isoKey);
      }
    }

    periodoKeys.sort();
    // Re-index after sort
    periodoKeys.forEach((k, i) => periodoIdx.set(k, i));

    const periodoLabels = periodoKeys.map((k) => {
      const d = new Date(k);
      return dto.granularidade === 'mes'
        ? d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        : `Sem ${Math.ceil(d.getDate() / 7)}/${d.toLocaleDateString('pt-BR', { month: 'short' })}`;
    });

    const celulas: HeatmapCelula[] = rows.map((row) => ({
      servico_idx: servicoIdx.get(row.servico_id)!,
      periodo_idx: periodoIdx.get(new Date(row.periodo).toISOString().slice(0, 10))!,
      taxa: row.taxa !== null ? Number(row.taxa) : null,
      total_inspecoes: Number(row.total_inspecoes),
    }));

    return { servicos: servicoNames, periodos: periodoLabels, celulas };
  }

  // ── Funil ───────────────────────────────────────────────────────────────────

  private async _queryFunil(
    tenantId: number,
    obraId: number,
    dto: DashboardGraficosQueryDto,
  ) {
    return this.prisma.$queryRawUnsafe<Array<FunilResult>>(
      `SELECT
         COUNT(DISTINCT f.id)::int                                                AS total_fichas,
         COUNT(DISTINCT f.id) FILTER (WHERE f.concluida_em IS NOT NULL)::int      AS concluidas,
         COUNT(DISTINCT f.id) FILTER (WHERE f.status = 'aprovada')::int           AS aprovadas,
         COUNT(DISTINCT f.id) FILTER (WHERE EXISTS (
           SELECT 1 FROM fvs_nao_conformidades nc
           JOIN fvs_registros r2 ON r2.id = nc.registro_id
           WHERE r2.ficha_id = f.id AND nc.deleted_at IS NULL
         ))::int                                                                   AS com_nc,
         COUNT(DISTINCT f.id) FILTER (WHERE EXISTS (
           SELECT 1 FROM pa_plano_acao pa
           WHERE pa.origem_id = f.id AND pa.origem_tipo = 'INSPECAO_FVS' AND pa.deleted_at IS NULL
         ))::int                                                                   AS com_pa
       FROM fvs_fichas f
       WHERE f.obra_id = $1
         AND f.tenant_id = $2
         AND f.created_at BETWEEN $3::date AND $4::date + INTERVAL '1 day'
         AND f.deleted_at IS NULL`,
      obraId,
      tenantId,
      dto.data_inicio,
      dto.data_fim,
    );
  }
}
```

- [ ] **Step 1.3: Verify TypeScript compiles with no errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx tsc --noEmit
```

Expected: zero errors output.

- [ ] **Step 1.4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/fvs/dashboard/dto/dashboard-graficos-query.dto.ts \
        backend/src/fvs/dashboard/fvs-graficos.service.ts
git commit -m "feat(fvs): add FvsGraficosService with 4 chart SQL queries"
```

---

## Task 2: Backend Controller — wire the endpoint

**Files:**
- Modify: `backend/src/fvs/dashboard/fvs-dashboard.controller.ts`
- Modify: `backend/src/fvs/fvs.module.ts`

- [ ] **Step 2.1: Add the route to the existing controller**

Open `backend/src/fvs/dashboard/fvs-dashboard.controller.ts` and apply these changes:

Add imports at the top (after existing imports):
```typescript
import { FvsGraficosService } from './fvs-graficos.service';
import { DashboardGraficosQueryDto } from './dto/dashboard-graficos-query.dto';
import { Query as QueryParam } from '@nestjs/common';
```

Add `FvsGraficosService` to constructor (right after `private readonly relatorio`):
```typescript
  constructor(
    private readonly dashboard: FvsDashboardService,
    private readonly priorizacao: AgentePriorizacaoInspecao,
    private readonly relatorio: AgenteRelatorioFvs,
    private readonly graficos: FvsGraficosService,
  ) {}
```

Add the new route at the end of the controller class, before the closing `}`:
```typescript
  // GET /api/v1/fvs/dashboard/obras/:obraId/dashboard-graficos
  @Get('obras/:obraId/dashboard-graficos')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getDashboardGraficos(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @QueryParam() query: DashboardGraficosQueryDto,
  ) {
    return this.graficos.getDashboardGraficos(tenantId, obraId, query);
  }
```

- [ ] **Step 2.2: Register `FvsGraficosService` in `fvs.module.ts`**

Open `backend/src/fvs/fvs.module.ts`.

Add the import at the top:
```typescript
import { FvsGraficosService } from './dashboard/fvs-graficos.service';
```

Add `FvsGraficosService` to the `providers` array (after `FvsDashboardService`):
```typescript
providers: [
  CatalogoService, ModeloService, InspecaoService, RoService, ParecerService,
  FvsDashboardService, FvsGraficosService, FvsPdfService,
  AgenteDiagnosticoNc, AgentePreditorNc, AgenteAnaliseFoto,
  AgenteRelatorioFvs, AgentePriorizacaoInspecao,
  FvsProcessor,
],
```

- [ ] **Step 2.3: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2.4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/fvs/dashboard/fvs-dashboard.controller.ts \
        backend/src/fvs/fvs.module.ts
git commit -m "feat(fvs): wire GET dashboard-graficos endpoint to controller"
```

---

## Task 3: Frontend — Add types + service method to `fvs.service.ts`

**Files:**
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 3.1: Add type definitions**

Open `frontend-web/src/services/fvs.service.ts`.

After the last `export interface` block (before the `export const fvsService =` line), add:

```typescript
// ─── Dashboard Gráficos Avançados ─────────────────────────────────────────

export type Granularidade = 'semana' | 'mes';
export type Tendencia = 'subindo' | 'caindo' | 'estavel';

export interface GraficosFiltros {
  data_inicio: string;   // "YYYY-MM-DD"
  data_fim: string;      // "YYYY-MM-DD"
  granularidade: Granularidade;
  servico_ids?: number[];
}

export interface EvolucaoTemporalSerie {
  servico_id: number;
  servico_nome: string;
  cor: string;
  valores: (number | null)[];
}

export interface EvolucaoTemporalData {
  labels: string[];
  series: EvolucaoTemporalSerie[];
}

export interface ConformidadePorServicoItem {
  servico_id: number;
  servico_nome: string;
  total_inspecoes: number;
  taxa_conformidade: number;
  ncs_abertas: number;
  tendencia: Tendencia;
}

export interface HeatmapCelula {
  servico_idx: number;
  periodo_idx: number;
  taxa: number | null;
  total_inspecoes: number;
}

export interface HeatmapData {
  servicos: string[];
  periodos: string[];
  celulas: HeatmapCelula[];
}

export interface FunilData {
  total_fichas: number;
  concluidas: number;
  aprovadas: number;
  com_nc: number;
  com_pa: number;
}

export interface DashboardGraficosData {
  evolucao_temporal: EvolucaoTemporalData;
  conformidade_por_servico: ConformidadePorServicoItem[];
  heatmap: HeatmapData;
  funil: FunilData;
}
```

- [ ] **Step 3.2: Add service method**

Inside `fvsService` object (e.g. after `calcularRisco`), add:

```typescript
  // ─── Dashboard Gráficos Avançados ─────────────────────────────────────────
  async getDashboardGraficos(obraId: number, filtros: GraficosFiltros): Promise<DashboardGraficosData> {
    const params: Record<string, string | string[]> = {
      data_inicio: filtros.data_inicio,
      data_fim: filtros.data_fim,
      granularidade: filtros.granularidade,
    };
    if (filtros.servico_ids && filtros.servico_ids.length > 0) {
      params['servico_ids'] = filtros.servico_ids.map(String);
    }
    const { data } = await api.get(`/fvs/dashboard/obras/${obraId}/dashboard-graficos`, { params });
    return data;
  },
```

- [ ] **Step 3.3: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3.4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs): add getDashboardGraficos types + service method"
```

---

## Task 4: Frontend Hook — `useDashboardGraficos`

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts`

- [ ] **Step 4.1: Create the hooks directory and file**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/modules/fvs/dashboard/hooks"
```

Create `frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts`:

```typescript
// frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts
import { useQuery } from '@tanstack/react-query';
import { fvsService, type DashboardGraficosData, type GraficosFiltros } from '../../../../services/fvs.service';

export function useDashboardGraficos(obraId: number, filtros: GraficosFiltros) {
  return useQuery<DashboardGraficosData>({
    queryKey: ['fvs-graficos', obraId, filtros],
    queryFn: () => fvsService.getDashboardGraficos(obraId, filtros),
    staleTime: 5 * 60_000,
    enabled: obraId > 0,
  });
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/hooks/useDashboardGraficos.ts
git commit -m "feat(fvs): add useDashboardGraficos hook"
```

---

## Task 5: Frontend — `FiltrosPeriodo` component (URL-synced)

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx`

- [ ] **Step 5.1: Create the components directory**

```bash
mkdir -p "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web/src/modules/fvs/dashboard/components"
```

- [ ] **Step 5.2: Create `FiltrosPeriodo.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx
import { useSearchParams } from 'react-router-dom';
import { type GraficosFiltros, type Granularidade } from '../../../../services/fvs.service';

// ── Preset helpers ────────────────────────────────────────────────────────────

type Preset = '4s' | '3m' | '6m' | 'custom';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetToRange(preset: Preset): { data_inicio: string; data_fim: string } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fim = isoDate(hoje);

  if (preset === '4s') {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 28);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  if (preset === '3m') {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 3);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  if (preset === '6m') {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 6);
    return { data_inicio: isoDate(inicio), data_fim: fim };
  }
  // 'custom' falls through — caller keeps existing values
  return { data_inicio: fim, data_fim: fim };
}

// ── Default filtros (4 semanas, granularidade semana) ─────────────────────────

export function defaultFiltros(): GraficosFiltros {
  const { data_inicio, data_fim } = presetToRange('4s');
  return { data_inicio, data_fim, granularidade: 'semana' };
}

// ── Hook: read / write filtros from URL params ────────────────────────────────

export function useFiltrosPeriodo(): [GraficosFiltros, (f: GraficosFiltros) => void] {
  const [params, setParams] = useSearchParams();

  const defaults = defaultFiltros();
  const filtros: GraficosFiltros = {
    data_inicio: params.get('gi') ?? defaults.data_inicio,
    data_fim: params.get('gf') ?? defaults.data_fim,
    granularidade: (params.get('gg') as Granularidade) ?? defaults.granularidade,
    servico_ids: params.getAll('gs').map(Number).filter((n) => !isNaN(n) && n > 0),
  };

  function setFiltros(f: GraficosFiltros) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('gi', f.data_inicio);
        next.set('gf', f.data_fim);
        next.set('gg', f.granularidade);
        next.delete('gs');
        (f.servico_ids ?? []).forEach((id) => next.append('gs', String(id)));
        return next;
      },
      { replace: true },
    );
  }

  return [filtros, setFiltros];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  value: GraficosFiltros;
  onChange: (f: GraficosFiltros) => void;
}

const PRESETS: { label: string; value: Preset }[] = [
  { label: 'Últ. 4 semanas', value: '4s' },
  { label: 'Últ. 3 meses', value: '3m' },
  { label: 'Últ. 6 meses', value: '6m' },
  { label: 'Personalizado', value: 'custom' },
];

export function FiltrosPeriodo({ value, onChange }: Props) {
  function detectPreset(): Preset {
    const hoje = isoDate(new Date());
    const r4s = presetToRange('4s');
    const r3m = presetToRange('3m');
    const r6m = presetToRange('6m');
    if (value.data_inicio === r4s.data_inicio && value.data_fim === hoje) return '4s';
    if (value.data_inicio === r3m.data_inicio && value.data_fim === hoje) return '3m';
    if (value.data_inicio === r6m.data_inicio && value.data_fim === hoje) return '6m';
    return 'custom';
  }

  const activePreset = detectPreset();

  function handlePreset(p: Preset) {
    if (p === 'custom') return; // stay in custom mode, allow date inputs
    const range = presetToRange(p);
    onChange({ ...value, ...range });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset buttons */}
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePreset(p.value)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              activePreset === p.value
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--off-bg)] text-[var(--text-low)] hover:bg-[var(--border)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date inputs — always visible in custom mode */}
      {activePreset === 'custom' && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={value.data_inicio}
            onChange={(e) => onChange({ ...value, data_inicio: e.target.value })}
            className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--bg-card)] text-[var(--text-high)]"
          />
          <span className="text-xs text-[var(--text-low)]">→</span>
          <input
            type="date"
            value={value.data_fim}
            onChange={(e) => onChange({ ...value, data_fim: e.target.value })}
            className="border border-[var(--border)] rounded px-2 py-0.5 text-xs bg-[var(--bg-card)] text-[var(--text-high)]"
          />
        </div>
      )}

      {/* Granularity toggle */}
      <div className="flex gap-1 border border-[var(--border)] rounded overflow-hidden">
        {(['semana', 'mes'] as Granularidade[]).map((g) => (
          <button
            key={g}
            onClick={() => onChange({ ...value, granularidade: g })}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              value.granularidade === g
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-low)] hover:bg-[var(--off-bg)]'
            }`}
          >
            {g === 'semana' ? 'Semana' : 'Mês'}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.3: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5.4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/FiltrosPeriodo.tsx
git commit -m "feat(fvs): add FiltrosPeriodo component with URL-synced state"
```

---

## Task 6: `EvolucaoTemporalChart` — recharts LineChart

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx`

- [ ] **Step 6.1: Create `EvolucaoTemporalChart.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx
import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import type { EvolucaoTemporalData } from '../../../../services/fvs.service';

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg text-xs">
      <p className="font-semibold text-[var(--text-high)] mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-[var(--text-low)]">{entry.name}:</span>
          <span className="font-bold text-[var(--text-high)]">
            {entry.value !== null && entry.value !== undefined ? `${entry.value}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: EvolucaoTemporalData;
  targetPct?: number; // default 85
}

export function EvolucaoTemporalChart({ data, targetPct = 85 }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (data.labels.length === 0 || data.series.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma inspeção no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Build recharts data: [{ label: "Sem 1", "Alvenaria": 88.2, "Concreto": null, ... }]
  const chartData = data.labels.map((label, i) => {
    const point: Record<string, string | number | null> = { label };
    for (const s of data.series) {
      point[s.servico_nome] = s.valores[i] ?? null;
    }
    return point;
  });

  function toggleSeries(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            onClick={(e) => toggleSeries(e.value as string)}
            formatter={(value) => (
              <span
                style={{
                  color: hidden.has(value) ? 'var(--text-low)' : 'var(--text-high)',
                  textDecoration: hidden.has(value) ? 'line-through' : 'none',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {value}
              </span>
            )}
          />
          {/* Target reference line */}
          <ReferenceLine
            y={targetPct}
            stroke="var(--warn)"
            strokeDasharray="6 3"
            label={{
              value: `Meta ${targetPct}%`,
              position: 'insideTopRight',
              fontSize: 10,
              fill: 'var(--warn)',
            }}
          />
          {data.series.map((s) => (
            <Line
              key={s.servico_id}
              type="monotone"
              dataKey={s.servico_nome}
              stroke={s.cor}
              strokeWidth={2}
              dot={{ r: 3, fill: s.cor }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              hide={hidden.has(s.servico_nome)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/EvolucaoTemporalChart.tsx
git commit -m "feat(fvs): add EvolucaoTemporalChart LineChart component"
```

---

## Task 7: `ConformidadeBarChart` — recharts horizontal BarChart

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx`

- [ ] **Step 7.1: Create `ConformidadeBarChart.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts';
import type { ConformidadePorServicoItem, Tendencia } from '../../../../services/fvs.service';

// ── Colour helpers ────────────────────────────────────────────────────────────

function taxaColor(t: number): string {
  if (t >= 85) return 'var(--ok)';
  if (t >= 70) return '#f0ad4e';
  return 'var(--nc)';
}

function tendenciaIcon(t: Tendencia): string {
  if (t === 'subindo') return '↑';
  if (t === 'caindo') return '↓';
  return '→';
}

function tendenciaColor(t: Tendencia): string {
  if (t === 'subindo') return 'var(--ok)';
  if (t === 'caindo') return 'var(--nc)';
  return 'var(--text-low)';
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload as ConformidadePorServicoItem;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-[var(--text-high)]">{d.servico_nome}</p>
      <p>
        <span className="text-[var(--text-low)]">Conformidade: </span>
        <span className="font-bold" style={{ color: taxaColor(d.taxa_conformidade) }}>
          {d.taxa_conformidade}%
        </span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">Inspeções: </span>
        <span className="text-[var(--text-high)]">{d.total_inspecoes}</span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">NCs abertas: </span>
        <span style={{ color: d.ncs_abertas > 0 ? 'var(--nc)' : 'var(--ok)' }}>{d.ncs_abertas}</span>
      </p>
      <p>
        <span className="text-[var(--text-low)]">Tendência: </span>
        <span style={{ color: tendenciaColor(d.tendencia) }}>
          {tendenciaIcon(d.tendencia)} {d.tendencia}
        </span>
      </p>
    </div>
  );
}

// ── Custom label inside bar ───────────────────────────────────────────────────

function BarLabel(props: { x?: number; y?: number; width?: number; height?: number; value?: number }) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  if (width < 40) return null; // not enough room
  return (
    <text
      x={x + width - 6}
      y={y + height / 2 + 1}
      textAnchor="end"
      dominantBaseline="middle"
      fontSize={11}
      fill="white"
      fontWeight="bold"
    >
      {value}%
    </text>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: ConformidadePorServicoItem[];
}

export function ConformidadeBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhum serviço com inspeções no período</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Already sorted by taxa ASC from backend (worst first)
  const chartData = data.map((d) => ({
    ...d,
    taxa_conformidade: Number(d.taxa_conformidade),
  }));

  const barHeight = 36;
  const chartHeight = Math.max(160, chartData.length * barHeight + 24);

  return (
    <div style={{ position: 'relative' }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--text-low)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            type="category"
            dataKey="servico_nome"
            width={140}
            tick={{ fontSize: 11, fill: 'var(--text-high)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--off-bg)' }} />
          <Bar dataKey="taxa_conformidade" radius={[0, 4, 4, 0]} label={<BarLabel />}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={taxaColor(entry.taxa_conformidade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tendency badges overlaid to the right */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: barHeight - 14,
          paddingTop: 4,
          pointerEvents: 'none',
        }}
      >
        {chartData.map((d) => (
          <span
            key={d.servico_id}
            style={{ color: tendenciaColor(d.tendencia), fontSize: 14, fontWeight: 700, lineHeight: 1 }}
            title={d.tendencia}
          >
            {tendenciaIcon(d.tendencia)}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/ConformidadeBarChart.tsx
git commit -m "feat(fvs): add ConformidadeBarChart horizontal BarChart component"
```

---

## Task 8: `HeatmapServicos` — CSS Grid heatmap

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx`

- [ ] **Step 8.1: Create `HeatmapServicos.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx
import { useState } from 'react';
import type { HeatmapData } from '../../../../services/fvs.service';

// ── Colour by taxa ────────────────────────────────────────────────────────────

function cellStyle(taxa: number | null): React.CSSProperties {
  if (taxa === null) {
    return {
      background: 'var(--bg-raised, #f3f4f6)',
      color: 'var(--text-low)',
    };
  }
  if (taxa < 60) {
    return {
      background: 'var(--nc-bg, #fee2e2)',
      color: 'var(--nc-text, #b91c1c)',
    };
  }
  if (taxa < 80) {
    return {
      background: 'var(--warn-bg, #fef9c3)',
      color: 'var(--warn-text, #854d0e)',
    };
  }
  if (taxa < 90) {
    return {
      background: '#dcfce7',
      color: '#166534',
    };
  }
  return {
    background: 'var(--ok-bg, #bbf7d0)',
    color: 'var(--ok-text, #14532d)',
  };
}

// ── Tooltip state ─────────────────────────────────────────────────────────────

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: HeatmapData;
}

export function HeatmapServicos({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (data.servicos.length === 0 || data.periodos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma inspeção no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // Build lookup: [servico_idx][periodo_idx] → celula
  const lookup = new Map<string, { taxa: number | null; total_inspecoes: number }>();
  for (const c of data.celulas) {
    lookup.set(`${c.servico_idx}-${c.periodo_idx}`, { taxa: c.taxa, total_inspecoes: c.total_inspecoes });
  }

  const cellSize = data.periodos.length > 12 ? 32 : 40;
  const leftColWidth = 148;

  // grid-template-columns: [left col] + [N period cols]
  const gridTemplateColumns = `${leftColWidth}px repeat(${data.periodos.length}, ${cellSize}px)`;

  function handleMouseEnter(e: React.MouseEvent, sNome: string, pLabel: string, taxa: number | null, total: number) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const text =
      taxa !== null
        ? `${sNome} — ${pLabel}: ${taxa}% (${total} inspeções)`
        : `${sNome} — ${pLabel}: sem inspeção`;
    setTooltip({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 32, text });
  }

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div className="overflow-x-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns,
            width: 'max-content',
          }}
        >
          {/* Header row */}
          {/* Top-left corner cell */}
          <div
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 20,
              background: 'var(--bg-card)',
              width: leftColWidth,
              height: cellSize,
              borderBottom: '1px solid var(--border)',
            }}
          />
          {data.periodos.map((periodo, pi) => (
            <div
              key={pi}
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-card)',
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: 'var(--text-low)',
                fontWeight: 600,
                borderBottom: '1px solid var(--border)',
                borderLeft: '1px solid var(--border)',
                padding: '0 2px',
                textAlign: 'center',
              }}
            >
              {periodo}
            </div>
          ))}

          {/* Data rows */}
          {data.servicos.map((servico, si) => (
            <>
              {/* Sticky left: service name */}
              <div
                key={`s-${si}`}
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                  background: 'var(--bg-card)',
                  width: leftColWidth,
                  height: cellSize,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                  fontSize: 11,
                  color: 'var(--text-high)',
                  fontWeight: 500,
                  borderTop: si > 0 ? '1px solid var(--border)' : undefined,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
                title={servico}
              >
                {servico}
              </div>

              {/* Data cells */}
              {data.periodos.map((periodo, pi) => {
                const cell = lookup.get(`${si}-${pi}`);
                const taxa = cell?.taxa ?? null;
                const total = cell?.total_inspecoes ?? 0;
                return (
                  <div
                    key={`c-${si}-${pi}`}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'default',
                      borderTop: si > 0 ? '1px solid var(--border)' : undefined,
                      borderLeft: '1px solid var(--border)',
                      transition: 'filter 0.1s',
                      ...cellStyle(taxa),
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, servico, periodo, taxa, total)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {taxa !== null ? `${taxa}` : '–'}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 50,
            pointerEvents: 'none',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--text-high)',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/HeatmapServicos.tsx
git commit -m "feat(fvs): add HeatmapServicos CSS Grid heatmap component"
```

---

## Task 9: `FunilInspecoes` — custom SVG funnel

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx`

- [ ] **Step 9.1: Create `FunilInspecoes.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx
import { useState } from 'react';
import type { FunilData } from '../../../../services/fvs.service';

// ── Stage definitions ─────────────────────────────────────────────────────────

interface Stage {
  key: keyof FunilData;
  label: string;
  fill: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    key: 'total_fichas',
    label: 'Total de Fichas',
    fill: '#6366f1',
    description: 'Todas as fichas de inspeção criadas no período',
  },
  {
    key: 'concluidas',
    label: 'Concluídas',
    fill: '#3b82f6',
    description: 'Fichas onde todos os itens foram avaliados',
  },
  {
    key: 'aprovadas',
    label: 'Aprovadas',
    fill: '#10b981',
    description: 'Fichas com status final "aprovada"',
  },
  {
    key: 'com_nc',
    label: 'Com NC',
    fill: '#f59e0b',
    description: 'Fichas que geraram pelo menos uma Não Conformidade',
  },
  {
    key: 'com_pa',
    label: 'Com PA',
    fill: '#ef4444',
    description: 'Fichas que geraram Plano de Ação (PA)',
  },
];

// ── SVG trapezoid path ────────────────────────────────────────────────────────
// Draws a trapezoid: wider at top (topW), narrower at bottom (botW), height h
// centered at cx
function trapezoidPath(cx: number, y: number, topW: number, botW: number, h: number): string {
  const topLeft = cx - topW / 2;
  const topRight = cx + topW / 2;
  const botLeft = cx - botW / 2;
  const botRight = cx + botW / 2;
  return `M ${topLeft} ${y} L ${topRight} ${y} L ${botRight} ${y + h} L ${botLeft} ${y + h} Z`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  data: FunilData;
}

export function FunilInspecoes({ data }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.total_fichas;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-[var(--text-low)] text-sm gap-2">
        <span>Nenhuma ficha no período selecionado</span>
        <span className="text-xs">Tente ampliar o filtro de datas</span>
      </div>
    );
  }

  // SVG dimensions
  const svgWidth = 340;
  const svgHeight = 260;
  const cx = svgWidth / 2;
  const stageH = 42; // height of each trapezoid
  const gap = 3;     // gap between stages
  const maxW = 220;  // width at 100%
  const minW = 28;   // minimum width for any stage (avoids invisible shapes)

  function stageValue(key: keyof FunilData): number {
    return data[key] as number;
  }

  function widthForStage(idx: number): number {
    const val = stageValue(STAGES[idx].key);
    // First stage is always maxW; subsequent are proportional but at least minW
    if (total === 0) return minW;
    const ratio = val / total;
    return Math.max(minW, maxW * ratio);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {STAGES.map((stage, idx) => {
          const topW = widthForStage(idx);
          // Next stage width (for bottom edge) or same as top for last
          const botW = idx < STAGES.length - 1 ? widthForStage(idx + 1) : topW;
          const y = idx * (stageH + gap);
          const val = stageValue(stage.key);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const isHovered = hoveredIdx === idx;

          return (
            <g
              key={stage.key}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'default' }}
            >
              <path
                d={trapezoidPath(cx, y, topW, botW, stageH)}
                fill={stage.fill}
                opacity={isHovered ? 1 : 0.82}
              />
              {/* Value label — left side */}
              <text
                x={cx - maxW / 2 - 8}
                y={y + stageH / 2 + 1}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight="600"
                fill="var(--text-high)"
              >
                {val.toLocaleString('pt-BR')}
              </text>
              {/* Percentage label — right side */}
              <text
                x={cx + maxW / 2 + 8}
                y={y + stageH / 2 + 1}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--text-low)"
              >
                {pct}%
              </text>
              {/* Stage name inside the bar if wide enough */}
              {topW > 70 && (
                <text
                  x={cx}
                  y={y + stageH / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight="600"
                  fill="white"
                >
                  {stage.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip / description for hovered stage */}
      <div
        className="text-xs text-[var(--text-low)] text-center px-4 transition-opacity"
        style={{ minHeight: 18, opacity: hoveredIdx !== null ? 1 : 0 }}
      >
        {hoveredIdx !== null ? STAGES[hoveredIdx].description : ''}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {STAGES.map((stage) => {
          const val = stageValue(stage.key);
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={stage.key} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: stage.fill }} />
              <span className="text-[var(--text-low)]">{stage.label}:</span>
              <span className="font-semibold text-[var(--text-high)]">{val}</span>
              <span className="text-[var(--text-low)]">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 9.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/FunilInspecoes.tsx
git commit -m "feat(fvs): add FunilInspecoes custom SVG funnel component"
```

---

## Task 10: `GraficosAvancados` — container component

**Files:**
- Create: `frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx`

- [ ] **Step 10.1: Create `GraficosAvancados.tsx`**

Create `frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx`:

```tsx
// frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx
import { useDashboardGraficos } from '../hooks/useDashboardGraficos';
import { EvolucaoTemporalChart } from './EvolucaoTemporalChart';
import { ConformidadeBarChart } from './ConformidadeBarChart';
import { HeatmapServicos } from './HeatmapServicos';
import { FunilInspecoes } from './FunilInspecoes';
import type { GraficosFiltros } from '../../../../services/fvs.service';

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkeletonCard({ height }: { height: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] ${height} animate-pulse`}
    />
  );
}

// ── Chart card wrapper ────────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[var(--text-high)]">{title}</p>
      {children}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  obraId: number;
  filtros: GraficosFiltros;
}

export function GraficosAvancados({ obraId, filtros }: Props) {
  const { data, isLoading, isError, refetch } = useDashboardGraficos(obraId, filtros);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-48" />
        <SkeletonCard height="h-64" />
        <SkeletonCard height="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <p className="text-sm text-[var(--nc)]">Erro ao carregar os gráficos</p>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Evolução Temporal da Conformidade">
        <EvolucaoTemporalChart data={data.evolucao_temporal} />
      </ChartCard>

      <ChartCard title="Conformidade por Serviço">
        <ConformidadeBarChart data={data.conformidade_por_servico} />
      </ChartCard>

      <ChartCard title="Heatmap Serviços × Período">
        <HeatmapServicos data={data.heatmap} />
      </ChartCard>

      <ChartCard title="Funil de Inspeções">
        <FunilInspecoes data={data.funil} />
      </ChartCard>
    </div>
  );
}
```

- [ ] **Step 10.2: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10.3: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/components/GraficosAvancados.tsx
git commit -m "feat(fvs): add GraficosAvancados container component"
```

---

## Task 11: Integrate into `FvsDashboardPage`

**Files:**
- Modify: `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx`

- [ ] **Step 11.1: Add imports to `FvsDashboardPage.tsx`**

Open `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx`.

Add these imports at the top, after the existing import block:

```typescript
import { GraficosAvancados } from '../components/GraficosAvancados';
import { FiltrosPeriodo, useFiltrosPeriodo } from '../components/FiltrosPeriodo';
```

- [ ] **Step 11.2: Add URL-synced filtros state**

Inside `FvsDashboardPage` function body, after the existing `useState` calls, add:

```typescript
  const [filtrosGraficos, setFiltrosGraficos] = useFiltrosPeriodo();
```

- [ ] **Step 11.3: Add the Análise Visual section**

In the JSX return for the por-obra view (the `return` at the bottom of the component, inside `<div className="p-6 space-y-6 max-w-5xl mx-auto">`), add the following block **after** the Top NCs section (i.e., after the closing `)}` of the `topNcs.data && topNcs.data.length > 0` block):

```tsx
      {/* ── Análise Visual: Gráficos Avançados ──────────────────────────────────── */}
      {numObraId && (
        <section className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-[var(--text-high)]">Análise Visual</h2>
            <FiltrosPeriodo value={filtrosGraficos} onChange={setFiltrosGraficos} />
          </div>
          <GraficosAvancados obraId={numObraId} filtros={filtrosGraficos} />
        </section>
      )}
```

- [ ] **Step 11.4: Verify TypeScript compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 11.5: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx
git commit -m "feat(fvs): integrate GraficosAvancados into FvsDashboardPage"
```

---

## Self-Review Checklist

### 1. Spec coverage

| Requirement | Task |
|---|---|
| `GET /api/v1/fvs/obras/:obraId/dashboard-graficos` endpoint | Tasks 1–2 |
| Response shape: `evolucao_temporal`, `conformidade_por_servico`, `heatmap`, `funil` | Task 1 ✓ |
| G1 LineChart multi-series, 85% target, granularity selector | Task 6 ✓ |
| G2 BarChart horizontal, colored bars, trend badge, sorted worst-first | Task 7 ✓ |
| G3 CSS Grid heatmap, color-coded, sticky headers, scroll, tooltip | Task 8 ✓ |
| G4 SVG funnel, 5 stages, labels with percentages, hover tooltip | Task 9 ✓ |
| Container with loading skeletons and error state with retry | Task 10 ✓ |
| Period filter: 4 presets + custom, URL-synced via useSearchParams | Task 5 ✓ |
| Integration in FvsDashboardPage below KPIs, no new route | Task 11 ✓ |

### 2. Spec edge-case coverage

| Edge case | Where handled |
|---|---|
| Zero data for a series period → `null` not `0` | `_transformEvolucao`: uses `?? null`, recharts `connectNulls={false}` |
| No data at all → empty state message | All 4 chart components return early with message |
| `total_fichas === 0` in funil → no division by zero | `FunilInspecoes`: checks `total === 0` first; `pct` uses ternary |
| Heatmap cell with no inspection → `null` taxa → different visual `–` + `var(--bg-raised)` | `cellStyle(null)` in `HeatmapServicos` |
| API timeout / error → skeleton replaced by error + retry button | `GraficosAvancados` `isError` branch |
| Servico with 0 inspecoes not shown in BarChart | SQL `WHERE b.total_inspecoes > 0` in `_queryConformidade` |
| Many periods in heatmap (>12) → cells shrink to 32px | `cellSize = data.periodos.length > 12 ? 32 : 40` |
| `servico_ids` filter passed to all 4 queries | `servicoFilter` applied in `_queryEvolucao`, `_queryConformidade`, `_queryHeatmap` |

### 3. Type consistency check

| Symbol | Defined | Used |
|---|---|---|
| `GraficosFiltros` | `fvs.service.ts` | hook, FiltrosPeriodo, GraficosAvancados |
| `DashboardGraficosData` | `fvs.service.ts` | hook return type |
| `EvolucaoTemporalData` | `fvs.service.ts` | `EvolucaoTemporalChart` props |
| `ConformidadePorServicoItem` | `fvs.service.ts` | `ConformidadeBarChart` props |
| `HeatmapData` | `fvs.service.ts` | `HeatmapServicos` props |
| `FunilData` | `fvs.service.ts` | `FunilInspecoes` props |
| `useDashboardGraficos` | `hooks/useDashboardGraficos.ts` | `GraficosAvancados` |
| `useFiltrosPeriodo` | `FiltrosPeriodo.tsx` | `FvsDashboardPage` |
| `defaultFiltros` | `FiltrosPeriodo.tsx` | used internally in `useFiltrosPeriodo` |
| `FvsGraficosService` | `fvs-graficos.service.ts` | `FvsDashboardController`, `FvsModule` |
| `DashboardGraficosQueryDto` | `dto/dashboard-graficos-query.dto.ts` | controller route, service method |

All types are consistent — no renames or mismatches found.
