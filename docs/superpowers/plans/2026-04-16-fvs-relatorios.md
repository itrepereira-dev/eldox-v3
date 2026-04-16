# FVS — Relatórios Exportáveis (5 Tipos): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side PDF and Excel export for 5 FVS report types: Ficha de Inspeção, Conformidade por Serviço, Pendências, Não Conformidades, and Planos de Ação.

**Architecture:** All generation happens in the browser using @react-pdf/renderer (PDF) and exceljs (Excel). A single shared RelatorioBotao component handles loading/download. One new backend aggregation endpoint for R2 (conformidade por serviço).

**Tech Stack:** @react-pdf/renderer, exceljs, TanStack Query, NestJS (1 new endpoint)

---

## File Map

### New files — Frontend

| File | Responsibility |
|------|---------------|
| `frontend-web/src/modules/fvs/relatorios/types.ts` | ReportTipo union, RelatorioBotaoProps, all report data shapes |
| `frontend-web/src/modules/fvs/relatorios/hooks/useRelatorioFvs.ts` | Fetch report data + trigger download |
| `frontend-web/src/modules/fvs/relatorios/components/RelatorioBotao.tsx` | Button + modal + spinner + download orchestration |
| `frontend-web/src/modules/fvs/relatorios/components/FiltrosModal.tsx` | Modal de filtros obrigatórios quando incompletos |
| `frontend-web/src/modules/fvs/relatorios/pdf/PdfRenderer.ts` | pdf() → Blob → URL.createObjectURL helper |
| `frontend-web/src/modules/fvs/relatorios/pdf/templates/FichaInspecaoPdf.tsx` | R1 react-pdf Document template |
| `frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx` | R2 react-pdf Document template |
| `frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx` | R3 react-pdf Document template |
| `frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx` | R4 react-pdf Document template |
| `frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx` | R5 react-pdf Document template |
| `frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts` | R2 exceljs workbook generator |
| `frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts` | R3 exceljs workbook generator |
| `frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts` | R4 exceljs workbook generator |
| `frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts` | R5 exceljs workbook generator |

### Modified files — Frontend

| File | Change |
|------|--------|
| `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx` | Add `<RelatorioBotao tipo="R1_FICHA" />` in header |
| `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx` | Add R3 shortcut card |
| `frontend-web/src/modules/ncs/pages/NcsListPage.tsx` | Add R4 export button |
| `frontend-web/src/services/fvs.service.ts` | Add `getRelatorioConformidade` + R3/R4/R5 data methods |

### New files — Backend

| File | Responsibility |
|------|---------------|
| `backend/src/fvs/dashboard/relatorio-conformidade.dto.ts` | Query DTO for R2 endpoint |
| `backend/src/fvs/dashboard/relatorio.service.ts` | R2 aggregation SQL logic |

### Modified files — Backend

| File | Change |
|------|--------|
| `backend/src/fvs/dashboard/fvs-dashboard.controller.ts` | Add `GET obras/:obraId/relatorio-conformidade` |
| `backend/src/fvs/fvs.module.ts` | Register RelatorioService |

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend-web/package.json` (via npm install)

- [ ] **Step 1: Check if libraries are already installed**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
cat package.json | grep -E "@react-pdf|exceljs"
```

Expected: no output (neither library is present — `xlsx` is installed but that is a different library).

- [ ] **Step 2: Install the two new libraries**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npm install @react-pdf/renderer exceljs
```

Expected: both added to `dependencies` in `package.json`. The install may take 30–60 seconds.

- [ ] **Step 3: Install types for @react-pdf/renderer**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npm install --save-dev @types/react-pdf
```

Note: `@react-pdf/renderer` ships its own types. If the above fails with "not found", skip — it is not needed.

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors (or only pre-existing errors unrelated to the new packages).

- [ ] **Step 5: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/package.json frontend-web/package-lock.json
git commit -m "chore: install @react-pdf/renderer and exceljs for client-side report generation"
```

---

## Task 2: Backend — R2 aggregation endpoint

**Files:**
- Create: `backend/src/fvs/dashboard/relatorio-conformidade.dto.ts`
- Create: `backend/src/fvs/dashboard/relatorio.service.ts`
- Modify: `backend/src/fvs/dashboard/fvs-dashboard.controller.ts`
- Modify: `backend/src/fvs/fvs.module.ts`

- [ ] **Step 1: Create the query DTO**

Create `backend/src/fvs/dashboard/relatorio-conformidade.dto.ts`:

```typescript
// backend/src/fvs/dashboard/relatorio-conformidade.dto.ts
import { IsOptional, IsNumberString, IsDateString } from 'class-validator';

export class RelatorioConformidadeQueryDto {
  @IsOptional()
  @IsNumberString()
  servico_id?: string;

  @IsOptional()
  @IsDateString()
  data_inicio?: string;

  @IsOptional()
  @IsDateString()
  data_fim?: string;
}
```

- [ ] **Step 2: Create the aggregation service**

Create `backend/src/fvs/dashboard/relatorio.service.ts`:

```typescript
// backend/src/fvs/dashboard/relatorio.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SemanaConformidade {
  semana: string;      // "2026-W10"
  total: number;
  aprovadas: number;
  taxa: number;        // 0–100
}

export interface LocalConformidade {
  local_id: number;
  local_nome: string;
  ultima_inspecao: string | null;  // ISO date
  itens_total: number;
  itens_ok: number;
  itens_nc: number;
  taxa: number;
}

export interface RelatorioConformidadeResponse {
  obra_nome: string;
  servico_nome: string | null;
  data_inicio: string;
  data_fim: string;
  por_semana: SemanaConformidade[];
  por_local: LocalConformidade[];
  ncs_por_criticidade: { critico: number; maior: number; menor: number };
  fichas: {
    ficha_numero: string;
    data: string;
    inspetor: string;
    local: string;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }[];
}

@Injectable()
export class RelatorioService {
  constructor(private readonly prisma: PrismaService) {}

  async getConformidade(
    tenantId: number,
    obraId: number,
    servicoId: number | null,
    dataInicio: string,
    dataFim: string,
  ): Promise<RelatorioConformidadeResponse> {
    // Resolve obra nome
    const obraRows = await this.prisma.$queryRawUnsafe<{ nome: string }[]>(
      `SELECT nome FROM obras WHERE id = $1 AND tenant_id = $2`,
      obraId, tenantId,
    );
    const obra_nome = obraRows[0]?.nome ?? '';

    // Resolve servico nome
    let servico_nome: string | null = null;
    if (servicoId) {
      const sRows = await this.prisma.$queryRawUnsafe<{ nome: string }[]>(
        `SELECT nome FROM fvs_servicos WHERE id = $1 AND tenant_id = $2`,
        servicoId, tenantId,
      );
      servico_nome = sRows[0]?.nome ?? null;
    }

    // Base filter clause
    const servicoClause = servicoId
      ? `AND fs.servico_id = ${servicoId}`
      : '';

    // Fichas summary per local
    const fichasRows = await this.prisma.$queryRawUnsafe<{
      ficha_id: number;
      ficha_nome: string;
      created_at: string;
      inspetor_nome: string;
      local_nome: string;
      itens_ok: number;
      itens_nc: number;
    }[]>(
      `
      SELECT
        f.id AS ficha_id,
        f.nome AS ficha_nome,
        f.created_at,
        COALESCE(u.nome, 'Desconhecido') AS inspetor_nome,
        COALESCE(ol.nome, 'Sem local') AS local_nome,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS itens_ok,
        COUNT(*) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')) AS itens_nc
      FROM fvs_fichas f
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id
      JOIN fvs_registros r ON r.ficha_id = f.id AND r.servico_id = fs.servico_id
      LEFT JOIN fvs_fichas_servicos_locais fsl ON fsl.ficha_servico_id = fs.id
      LEFT JOIN obra_locais ol ON ol.id = fsl.obra_local_id
      LEFT JOIN users u ON u.id = f.criado_por
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND f.created_at >= $3
        AND f.created_at <= $4
        ${servicoClause}
      GROUP BY f.id, f.nome, f.created_at, u.nome, ol.nome
      ORDER BY f.created_at DESC
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const fichas = fichasRows.map((row) => {
      const total = Number(row.itens_ok) + Number(row.itens_nc);
      const taxa = total > 0 ? Math.round((Number(row.itens_ok) / total) * 100) : 0;
      return {
        ficha_numero: row.ficha_nome,
        data: row.created_at,
        inspetor: row.inspetor_nome,
        local: row.local_nome,
        itens_ok: Number(row.itens_ok),
        itens_nc: Number(row.itens_nc),
        taxa,
      };
    });

    // Por semana
    const semanaRows = await this.prisma.$queryRawUnsafe<{
      semana: string;
      total: number;
      aprovadas: number;
    }[]>(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('week', r.created_at), 'IYYY-"W"IW') AS semana,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS aprovadas
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        ${servicoClause}
      GROUP BY semana
      ORDER BY semana
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const por_semana: SemanaConformidade[] = semanaRows.map((row) => ({
      semana: row.semana,
      total: Number(row.total),
      aprovadas: Number(row.aprovadas),
      taxa: Number(row.total) > 0
        ? Math.round((Number(row.aprovadas) / Number(row.total)) * 100)
        : 0,
    }));

    // Por local
    const localRows = await this.prisma.$queryRawUnsafe<{
      local_id: number;
      local_nome: string;
      ultima_inspecao: string | null;
      itens_total: number;
      itens_ok: number;
      itens_nc: number;
    }[]>(
      `
      SELECT
        ol.id AS local_id,
        COALESCE(ol.nome, 'Sem local') AS local_nome,
        MAX(r.created_at) AS ultima_inspecao,
        COUNT(*) AS itens_total,
        COUNT(*) FILTER (WHERE r.status IN ('conforme','conforme_apos_reinspecao','liberado_com_concessao')) AS itens_ok,
        COUNT(*) FILTER (WHERE r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')) AS itens_nc
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      LEFT JOIN fvs_fichas_servicos_locais fsl ON fsl.ficha_servico_id = fs.id
      LEFT JOIN obra_locais ol ON ol.id = r.obra_local_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        ${servicoClause}
      GROUP BY ol.id, ol.nome
      ORDER BY local_nome
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const por_local: LocalConformidade[] = localRows.map((row) => ({
      local_id: Number(row.local_id),
      local_nome: row.local_nome,
      ultima_inspecao: row.ultima_inspecao ?? null,
      itens_total: Number(row.itens_total),
      itens_ok: Number(row.itens_ok),
      itens_nc: Number(row.itens_nc),
      taxa: Number(row.itens_total) > 0
        ? Math.round((Number(row.itens_ok) / Number(row.itens_total)) * 100)
        : 0,
    }));

    // NCs por criticidade
    const ncRows = await this.prisma.$queryRawUnsafe<{ criticidade: string; total: number }[]>(
      `
      SELECT
        i.criticidade,
        COUNT(*) AS total
      FROM fvs_registros r
      JOIN fvs_fichas f ON f.id = r.ficha_id
      JOIN fvs_fichas_servicos fs ON fs.ficha_id = f.id AND fs.servico_id = r.servico_id
      JOIN fvs_itens i ON i.id = r.item_id
      WHERE f.obra_id = $1
        AND f.tenant_id = $2
        AND f.deleted_at IS NULL
        AND r.created_at >= $3
        AND r.created_at <= $4
        AND r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')
        ${servicoClause}
      GROUP BY i.criticidade
      `,
      obraId, tenantId, dataInicio, dataFim,
    );

    const ncs_por_criticidade = { critico: 0, maior: 0, menor: 0 };
    for (const row of ncRows) {
      if (row.criticidade === 'critico') ncs_por_criticidade.critico = Number(row.total);
      else if (row.criticidade === 'maior') ncs_por_criticidade.maior = Number(row.total);
      else if (row.criticidade === 'menor') ncs_por_criticidade.menor = Number(row.total);
    }

    return {
      obra_nome,
      servico_nome,
      data_inicio: dataInicio,
      data_fim: dataFim,
      por_semana,
      por_local,
      ncs_por_criticidade,
      fichas,
    };
  }
}
```

- [ ] **Step 3: Add endpoint to FvsDashboardController**

Open `backend/src/fvs/dashboard/fvs-dashboard.controller.ts`. Add at the top of imports:

```typescript
import { RelatorioService } from './relatorio.service';
import { RelatorioConformidadeQueryDto } from './relatorio-conformidade.dto.ts';
```

Add to the constructor:

```typescript
// existing constructor args remain; add:
private readonly relatorioService: RelatorioService,
```

Add the new route method after the last existing `@Get` method in the class:

```typescript
  // GET /api/v1/fvs/obras/:obraId/relatorio-conformidade
  @Get('obras/:obraId/relatorio-conformidade')
  @Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
  getRelatorioConformidade(
    @TenantId() tenantId: number,
    @Param('obraId', ParseIntPipe) obraId: number,
    @Query() query: RelatorioConformidadeQueryDto,
  ) {
    const servicoId = query.servico_id ? parseInt(query.servico_id, 10) : null;
    const dataInicio = query.data_inicio ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const dataFim = query.data_fim ?? new Date().toISOString();
    return this.relatorioService.getConformidade(tenantId, obraId, servicoId, dataInicio, dataFim);
  }
```

Also add `Query` to the existing `@nestjs/common` import if not already present.

- [ ] **Step 4: Register RelatorioService in FvsModule**

Open `backend/src/fvs/fvs.module.ts`. Add the import at top:

```typescript
import { RelatorioService } from './dashboard/relatorio.service';
```

Add `RelatorioService` to the `providers` array and to `exports`.

- [ ] **Step 5: Build backend to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/backend"
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add backend/src/fvs/dashboard/relatorio-conformidade.dto.ts \
        backend/src/fvs/dashboard/relatorio.service.ts \
        backend/src/fvs/dashboard/fvs-dashboard.controller.ts \
        backend/src/fvs/fvs.module.ts
git commit -m "feat(fvs): add GET relatorio-conformidade aggregation endpoint (R2)"
```

---

## Task 3: Shared infrastructure — types, service calls, RelatorioBotao

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/types.ts`
- Create: `frontend-web/src/modules/fvs/relatorios/hooks/useRelatorioFvs.ts`
- Create: `frontend-web/src/modules/fvs/relatorios/components/FiltrosModal.tsx`
- Create: `frontend-web/src/modules/fvs/relatorios/components/RelatorioBotao.tsx`
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 1: Create types.ts**

Create `frontend-web/src/modules/fvs/relatorios/types.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/types.ts

export type ReportTipo =
  | 'R1_FICHA'
  | 'R2_CONFORMIDADE'
  | 'R3_PENDENCIAS'
  | 'R4_NCS'
  | 'R5_PA';

export type ReportFormato = 'pdf' | 'excel';

export interface RelatorioBotaoProps {
  tipo: ReportTipo;
  filtros: ReportFiltros;
  formatos?: ReportFormato[];
  label?: string;
}

export interface ReportFiltros {
  obraId?: number;
  fichaId?: number;
  servicoId?: number;
  dataInicio?: string;   // ISO date "YYYY-MM-DD"
  dataFim?: string;      // ISO date "YYYY-MM-DD"
  status?: string;
  criticidade?: string;
  inspetorId?: number;
}

// ─── R1: Ficha de Inspeção Individual ───────────────────────────────────────

export interface R1FichaData {
  ficha: {
    id: number;
    nome: string;
    status: string;
    regime: string;
    created_at: string;
    obra_nome: string;
    inspetor_nome: string;
    exige_ro: boolean;
  };
  servicos: Array<{
    servico_nome: string;
    locais: Array<{
      local_nome: string;
      itens: Array<{
        descricao: string;
        criticidade: string;
        status: string;
        observacao: string | null;
      }>;
    }>;
  }>;
  evidencias: Array<{
    registro_id: number;
    nome_original: string;
    url: string;
    mime_type: string;
  }>;
  ncs: Array<{
    numero: string;
    item_descricao: string;
    criticidade: string;
    status: string;
    responsavel: string | null;
    prazo: string | null;
  }>;
}

// ─── R2: Conformidade por Serviço ────────────────────────────────────────────

export interface R2ConformidadeData {
  obra_nome: string;
  servico_nome: string | null;
  data_inicio: string;
  data_fim: string;
  por_semana: Array<{
    semana: string;
    total: number;
    aprovadas: number;
    taxa: number;
  }>;
  por_local: Array<{
    local_id: number;
    local_nome: string;
    ultima_inspecao: string | null;
    itens_total: number;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }>;
  ncs_por_criticidade: { critico: number; maior: number; menor: number };
  fichas: Array<{
    ficha_numero: string;
    data: string;
    inspetor: string;
    local: string;
    itens_ok: number;
    itens_nc: number;
    taxa: number;
  }>;
}

// ─── R3: Pendências ──────────────────────────────────────────────────────────

export interface R3PendenciasData {
  obra_nome: string;
  data_geracao: string;
  fichas_abertas: Array<{
    id: number;
    nome: string;
    status: string;
    created_at: string;
    inspetor_nome: string;
    dias_aberta: number;
  }>;
  ncs_sem_plano: Array<{
    numero: string;
    titulo: string;
    criticidade: string;
    status: string;
    created_at: string;
    dias_aberta: number;
  }>;
  planos_vencidos: Array<{
    id: number;
    titulo: string;
    prazo: string;
    dias_vencido: number;
    responsavel: string | null;
    prioridade: string;
  }>;
}

// ─── R4: Não Conformidades ───────────────────────────────────────────────────

export interface R4NcsData {
  obra_nome: string;
  data_geracao: string;
  filtros: { status?: string; criticidade?: string; servico?: string; data_inicio?: string; data_fim?: string };
  ncs: Array<{
    numero: string;
    ficha_nome: string;
    servico: string;
    item_descricao: string;
    criticidade: string;
    status: string;
    responsavel: string | null;
    prazo: string | null;
    created_at: string;
  }>;
  sla: { no_prazo: number; vencidas: number; sem_prazo: number };
  por_criticidade: { alta: number; media: number; baixa: number };
}

// ─── R5: Planos de Ação ──────────────────────────────────────────────────────

export interface R5PlanoAcaoData {
  obra_nome: string;
  data_geracao: string;
  planos: Array<{
    id: number;
    numero: string;
    titulo: string;
    origem: string;
    etapa_atual: string;
    prioridade: string;
    responsavel: string | null;
    prazo: string | null;
    dias_aberto: number;
    vencido: boolean;
    created_at: string;
  }>;
  resumo: { abertos: number; em_andamento: number; fechados_este_mes: number };
}
```

- [ ] **Step 2: Add service methods to fvs.service.ts**

Open `frontend-web/src/services/fvs.service.ts`. Add after the last existing method in the `fvsService` object (before the closing `};`):

```typescript
  // ─── Relatórios ──────────────────────────────────────────────────────────────

  async getRelatorioConformidade(
    obraId: number,
    params: { servico_id?: number; data_inicio?: string; data_fim?: string },
  ) {
    const { data } = await api.get(`/fvs/dashboard/obras/${obraId}/relatorio-conformidade`, { params });
    return data;
  },

  async getFichaParaRelatorio(fichaId: number) {
    // Returns FichaDetalhada — already exists as getFicha(), aliased for clarity
    const { data } = await api.get(`/fvs/fichas/${fichaId}`);
    return data;
  },

  async getRegistrosParaRelatorio(fichaId: number) {
    // All registros for a ficha across all servicos/locais
    const { data } = await api.get(`/fvs/fichas/${fichaId}/registros`, {
      params: { todos: true },
    });
    return data;
  },
```

- [ ] **Step 3: Create useRelatorioFvs.ts hook**

Create `frontend-web/src/modules/fvs/relatorios/hooks/useRelatorioFvs.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/hooks/useRelatorioFvs.ts
import { useState } from 'react';
import { api } from '../../../../services/api';
import type {
  ReportTipo, ReportFiltros, ReportFormato,
  R1FichaData, R2ConformidadeData, R3PendenciasData, R4NcsData, R5PlanoAcaoData,
} from '../types';

export type RelatorioDadosResult =
  | R1FichaData
  | R2ConformidadeData
  | R3PendenciasData
  | R4NcsData
  | R5PlanoAcaoData;

interface UseRelatorioFvsReturn {
  loading: boolean;
  error: string | null;
  triggerDownload: (tipo: ReportTipo, filtros: ReportFiltros, formato: ReportFormato) => Promise<void>;
}

// Re-exported for use by RelatorioBotao
export type { RelatorioDadosResult };

async function fetchDados(tipo: ReportTipo, filtros: ReportFiltros): Promise<RelatorioDadosResult> {
  switch (tipo) {
    case 'R1_FICHA': {
      if (!filtros.fichaId) throw new Error('fichaId é obrigatório para R1');
      const { data } = await api.get(`/fvs/fichas/${filtros.fichaId}`);
      return data as R1FichaData;
    }
    case 'R2_CONFORMIDADE': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R2');
      const params: Record<string, string | number> = {};
      if (filtros.servicoId) params.servico_id = filtros.servicoId;
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const { data } = await api.get(`/fvs/dashboard/obras/${filtros.obraId}/relatorio-conformidade`, { params });
      return data as R2ConformidadeData;
    }
    case 'R3_PENDENCIAS': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R3');
      const params: Record<string, string | number> = {};
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      if (filtros.inspetorId) params.inspetor_id = filtros.inspetorId;
      if (filtros.criticidade) params.criticidade = filtros.criticidade;
      const [fichas, ncs, planos] = await Promise.all([
        api.get(`/fvs/fichas`, { params: { obraId: filtros.obraId, status: 'em_inspecao,rascunho', ...params } }),
        api.get(`/obras/${filtros.obraId}/ncs`, { params: { status: 'ABERTA,EM_ANALISE,TRATAMENTO', ...params } }),
        api.get(`/obras/${filtros.obraId}/planos-acao`, { params: { vencidos: true, ...params } }),
      ]);
      const obraRes = await api.get(`/obras/${filtros.obraId}`);
      const obra_nome = obraRes.data?.nome ?? '';
      const agora = new Date();
      return {
        obra_nome,
        data_geracao: agora.toISOString(),
        fichas_abertas: (fichas.data?.data ?? []).map((f: { id: number; nome: string; status: string; created_at: string; criado_por_nome?: string }) => ({
          id: f.id,
          nome: f.nome,
          status: f.status,
          created_at: f.created_at,
          inspetor_nome: f.criado_por_nome ?? 'Desconhecido',
          dias_aberta: Math.floor((agora.getTime() - new Date(f.created_at).getTime()) / 86400000),
        })),
        ncs_sem_plano: (ncs.data?.data ?? []).map((nc: { numero: string; titulo: string; criticidade: string; status: string; created_at: string }) => ({
          numero: nc.numero,
          titulo: nc.titulo,
          criticidade: nc.criticidade,
          status: nc.status,
          created_at: nc.created_at,
          dias_aberta: Math.floor((agora.getTime() - new Date(nc.created_at).getTime()) / 86400000),
        })),
        planos_vencidos: (planos.data?.data ?? []).map((pa: { id: number; titulo: string; prazo: string | null; responsavel_nome?: string | null; prioridade?: string }) => ({
          id: pa.id,
          titulo: pa.titulo,
          prazo: pa.prazo ?? '',
          dias_vencido: pa.prazo ? Math.floor((agora.getTime() - new Date(pa.prazo).getTime()) / 86400000) : 0,
          responsavel: pa.responsavel_nome ?? null,
          prioridade: pa.prioridade ?? 'NORMAL',
        })),
      } as R3PendenciasData;
    }
    case 'R4_NCS': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R4');
      const params: Record<string, string | number> = {};
      if (filtros.status) params.status = filtros.status;
      if (filtros.criticidade) params.criticidade = filtros.criticidade;
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const [ncsRes, obraRes] = await Promise.all([
        api.get(`/obras/${filtros.obraId}/ncs`, { params }),
        api.get(`/obras/${filtros.obraId}`),
      ]);
      const ncs = ncsRes.data?.data ?? [];
      const agora = new Date();
      const vencidas = ncs.filter((nc: { prazo: string | null; status: string }) => nc.prazo && new Date(nc.prazo) < agora && nc.status !== 'FECHADA').length;
      const no_prazo = ncs.filter((nc: { prazo: string | null; status: string }) => nc.prazo && new Date(nc.prazo) >= agora).length;
      const sem_prazo = ncs.filter((nc: { prazo: string | null }) => !nc.prazo).length;
      const por_criticidade = {
        alta: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'ALTA').length,
        media: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'MEDIA').length,
        baixa: ncs.filter((nc: { criticidade: string }) => nc.criticidade === 'BAIXA').length,
      };
      return {
        obra_nome: obraRes.data?.nome ?? '',
        data_geracao: agora.toISOString(),
        filtros: {
          status: filtros.status,
          criticidade: filtros.criticidade,
          data_inicio: filtros.dataInicio,
          data_fim: filtros.dataFim,
        },
        ncs: ncs.map((nc: { numero: string; titulo: string; criticidade: string; status: string; responsavel_nome?: string | null; prazo: string | null; created_at: string; fvs_ficha_id?: number | null; categoria?: string }) => ({
          numero: nc.numero,
          ficha_nome: nc.fvs_ficha_id ? `Ficha #${nc.fvs_ficha_id}` : '—',
          servico: nc.categoria ?? '—',
          item_descricao: nc.titulo,
          criticidade: nc.criticidade,
          status: nc.status,
          responsavel: nc.responsavel_nome ?? null,
          prazo: nc.prazo,
          created_at: nc.created_at,
        })),
        sla: { no_prazo, vencidas, sem_prazo },
        por_criticidade,
      } as R4NcsData;
    }
    case 'R5_PA': {
      if (!filtros.obraId) throw new Error('obraId é obrigatório para R5');
      const params: Record<string, string | number> = {};
      if (filtros.dataInicio) params.data_inicio = filtros.dataInicio;
      if (filtros.dataFim) params.data_fim = filtros.dataFim;
      const [planosRes, obraRes] = await Promise.all([
        api.get(`/obras/${filtros.obraId}/planos-acao`, { params }),
        api.get(`/obras/${filtros.obraId}`),
      ]);
      const planos = planosRes.data?.data ?? [];
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const abertos = planos.filter((p: { etapa_atual?: string }) => p.etapa_atual === 'ABERTO').length;
      const em_andamento = planos.filter((p: { etapa_atual?: string }) => p.etapa_atual === 'EM_ANDAMENTO').length;
      const fechados_este_mes = planos.filter((p: { etapa_atual?: string; updated_at?: string }) =>
        p.etapa_atual === 'FECHADO' && p.updated_at && new Date(p.updated_at) >= inicioMes
      ).length;
      return {
        obra_nome: obraRes.data?.nome ?? '',
        data_geracao: agora.toISOString(),
        planos: planos.map((p: { id: number; titulo: string; origem?: string; etapa_atual?: string; prioridade?: string; responsavel_nome?: string | null; prazo?: string | null; created_at: string; numero?: string }) => {
          const vencido = !!p.prazo && new Date(p.prazo) < agora && p.etapa_atual !== 'FECHADO';
          return {
            id: p.id,
            numero: p.numero ?? `PA-${p.id}`,
            titulo: p.titulo,
            origem: p.origem ?? '—',
            etapa_atual: p.etapa_atual ?? 'ABERTO',
            prioridade: p.prioridade ?? 'NORMAL',
            responsavel: p.responsavel_nome ?? null,
            prazo: p.prazo ?? null,
            dias_aberto: Math.floor((agora.getTime() - new Date(p.created_at).getTime()) / 86400000),
            vencido,
            created_at: p.created_at,
          };
        }),
        resumo: { abertos, em_andamento, fechados_este_mes },
      } as R5PlanoAcaoData;
    }
  }
}

export function useRelatorioFvs(): UseRelatorioFvsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerDownload = async (
    tipo: ReportTipo,
    filtros: ReportFiltros,
    formato: ReportFormato,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const dados = await fetchDados(tipo, filtros);

      if (formato === 'pdf') {
        const { renderToPdf } = await import('../pdf/PdfRenderer');
        await renderToPdf(tipo, dados, filtros);
      } else {
        const { renderToXlsx } = await import('../excel/XlsxRenderer');
        await renderToXlsx(tipo, dados, filtros);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, triggerDownload };
}
```

- [ ] **Step 4: Create FiltrosModal.tsx**

Create `frontend-web/src/modules/fvs/relatorios/components/FiltrosModal.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/components/FiltrosModal.tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import type { ReportFiltros, ReportTipo } from '../types';

interface FiltrosModalProps {
  tipo: ReportTipo;
  filtrosIniciais: ReportFiltros;
  onConfirm: (filtros: ReportFiltros) => void;
  onCancel: () => void;
}

// Which fields are required per report type
const REQUIRED: Record<ReportTipo, (keyof ReportFiltros)[]> = {
  R1_FICHA: ['fichaId'],
  R2_CONFORMIDADE: ['obraId', 'dataInicio', 'dataFim'],
  R3_PENDENCIAS: ['obraId', 'dataInicio'],
  R4_NCS: ['obraId'],
  R5_PA: ['obraId'],
};

export function FiltrosModal({ tipo, filtrosIniciais, onConfirm, onCancel }: FiltrosModalProps) {
  const [filtros, setFiltros] = useState<ReportFiltros>(filtrosIniciais);
  const [touched, setTouched] = useState<Partial<Record<keyof ReportFiltros, boolean>>>({});

  const required = REQUIRED[tipo];
  const missingFields = required.filter((field) => !filtros[field]);

  function handleSubmit() {
    const newTouched: Partial<Record<keyof ReportFiltros, boolean>> = {};
    required.forEach((f) => { newTouched[f] = true; });
    setTouched(newTouched);
    if (missingFields.length > 0) return;
    onConfirm(filtros);
  }

  function field(name: keyof ReportFiltros, label: string, type: string = 'text') {
    const isRequired = required.includes(name);
    const hasError = touched[name] && !filtros[name];
    return (
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-mid)]">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          value={(filtros[name] as string | number | undefined) ?? ''}
          onChange={(e) =>
            setFiltros((prev) => ({ ...prev, [name]: e.target.value || undefined }))
          }
          onBlur={() => setTouched((prev) => ({ ...prev, [name]: true }))}
          className={`px-3 py-2 rounded border text-sm bg-[var(--bg-base)] text-[var(--text-main)] outline-none transition-colors focus:ring-2 focus:ring-[var(--accent)] ${
            hasError
              ? 'border-red-500 bg-red-50'
              : 'border-[var(--border-dim)]'
          }`}
        />
        {hasError && (
          <span className="text-xs text-red-500">Campo obrigatório</span>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--bg-base)] rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text-main)]">Parâmetros do Relatório</h2>
          <button onClick={onCancel} className="text-[var(--text-faint)] hover:text-[var(--text-main)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {required.includes('dataInicio') && field('dataInicio', 'Data início', 'date')}
          {required.includes('dataFim') && field('dataFim', 'Data fim', 'date')}
          {required.includes('servicoId') && field('servicoId', 'ID do Serviço', 'number')}
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-medium"
          >
            Gerar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create RelatorioBotao.tsx**

Create `frontend-web/src/modules/fvs/relatorios/components/RelatorioBotao.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/components/RelatorioBotao.tsx
import { useState } from 'react';
import { FileDown, Loader2, ChevronDown } from 'lucide-react';
import { useRelatorioFvs } from '../hooks/useRelatorioFvs';
import { FiltrosModal } from './FiltrosModal';
import type { RelatorioBotaoProps, ReportFiltros, ReportFormato } from '../types';
import { cn } from '@/lib/cn';

// Fields that must be present before generation can proceed without a modal
const REQUIRED_NO_MODAL: Record<string, (keyof ReportFiltros)[]> = {
  R1_FICHA: ['fichaId'],
  R2_CONFORMIDADE: ['obraId', 'dataInicio', 'dataFim'],
  R3_PENDENCIAS: ['obraId', 'dataInicio'],
  R4_NCS: ['obraId'],
  R5_PA: ['obraId'],
};

export function RelatorioBotao({
  tipo,
  filtros,
  formatos = ['pdf'],
  label,
}: RelatorioBotaoProps) {
  const { loading, error, triggerDownload } = useRelatorioFvs();
  const [showModal, setShowModal] = useState(false);
  const [pendingFormato, setPendingFormato] = useState<ReportFormato>('pdf');
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  function filtrosCompletos(f: ReportFiltros): boolean {
    const required = REQUIRED_NO_MODAL[tipo] ?? [];
    return required.every((field) => !!f[field]);
  }

  async function handleClick(formato: ReportFormato) {
    setShowFormatMenu(false);
    if (!filtrosCompletos(filtros)) {
      setPendingFormato(formato);
      setShowModal(true);
      return;
    }
    await triggerDownload(tipo, filtros, formato);
  }

  async function handleModalConfirm(filtrosCompletos: ReportFiltros) {
    setShowModal(false);
    await triggerDownload(tipo, filtrosCompletos, pendingFormato);
  }

  const btnLabel = label ?? (formatos.length > 1 ? 'Exportar' : formatos[0] === 'excel' ? 'Exportar Excel' : 'Exportar PDF');

  return (
    <>
      {showModal && (
        <FiltrosModal
          tipo={tipo}
          filtrosIniciais={filtros}
          onConfirm={handleModalConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}

      <div className="relative inline-flex">
        {formatos.length === 1 ? (
          <button
            onClick={() => handleClick(formatos[0])}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border transition-colors font-medium',
              'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
              loading && 'opacity-60 cursor-not-allowed',
            )}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {btnLabel}
          </button>
        ) : (
          <>
            <button
              onClick={() => handleClick('pdf')}
              disabled={loading}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-l border-y border-l transition-colors font-medium',
                'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              PDF
            </button>
            <button
              onClick={() => setShowFormatMenu((v) => !v)}
              disabled={loading}
              className={cn(
                'inline-flex items-center px-1.5 py-1.5 text-sm rounded-r border transition-colors',
                'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white',
                loading && 'opacity-60 cursor-not-allowed',
              )}
            >
              <ChevronDown size={12} />
            </button>
            {showFormatMenu && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--bg-base)] border border-[var(--border-dim)] rounded shadow-lg z-20 min-w-[120px]">
                <button
                  onClick={() => handleClick('pdf')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={() => handleClick('excel')}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors"
                >
                  Exportar Excel
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </>
  );
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs): add shared relatorios infrastructure (types, hook, RelatorioBotao, FiltrosModal)"
```

---

## Task 4: PdfRenderer + R1 — Ficha de Inspeção PDF

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/PdfRenderer.ts`
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/templates/FichaInspecaoPdf.tsx`

- [ ] **Step 1: Create PdfRenderer.ts**

Create `frontend-web/src/modules/fvs/relatorios/pdf/PdfRenderer.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/pdf/PdfRenderer.ts
import { pdf } from '@react-pdf/renderer';
import type { ReportTipo } from '../types';
import type { RelatorioDadosResult } from '../hooks/useRelatorioFvs';
import type { ReportFiltros } from '../types';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildFilename(tipo: ReportTipo, dados: RelatorioDadosResult): string {
  const date = new Date().toISOString().split('T')[0];
  const tipoSlug = tipo.toLowerCase().replace('_', '-');
  // Try to extract obra name from data
  const obraRaw = (dados as { obra_nome?: string; ficha?: { obra_nome?: string } }).obra_nome
    ?? (dados as { ficha?: { obra_nome?: string } }).ficha?.obra_nome
    ?? 'obra';
  const obraSlug = slugify(obraRaw).slice(0, 20);
  return `eldox-${tipoSlug}-${obraSlug}-${date}.pdf`;
}

export async function renderToPdf(
  tipo: ReportTipo,
  dados: RelatorioDadosResult,
  _filtros: ReportFiltros,
): Promise<void> {
  let DocumentComponent: React.ComponentType<{ dados: RelatorioDadosResult }>;

  switch (tipo) {
    case 'R1_FICHA': {
      const { FichaInspecaoPdf } = await import('./templates/FichaInspecaoPdf');
      DocumentComponent = FichaInspecaoPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R2_CONFORMIDADE': {
      const { ConformidadePdf } = await import('./templates/ConformidadePdf');
      DocumentComponent = ConformidadePdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R3_PENDENCIAS': {
      const { PendenciasPdf } = await import('./templates/PendenciasPdf');
      DocumentComponent = PendenciasPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R4_NCS': {
      const { NcsPdf } = await import('./templates/NcsPdf');
      DocumentComponent = NcsPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R5_PA': {
      const { PlanoAcaoPdf } = await import('./templates/PlanoAcaoPdf');
      DocumentComponent = PlanoAcaoPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
  }

  const { createElement } = await import('react');
  const blob = await pdf(createElement(DocumentComponent, { dados })).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(tipo, dados);
  a.click();
  // Revoke after short delay so browser picks up the download
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

- [ ] **Step 2: Create FichaInspecaoPdf.tsx (R1)**

Create `frontend-web/src/modules/fvs/relatorios/pdf/templates/FichaInspecaoPdf.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/pdf/templates/FichaInspecaoPdf.tsx
import {
  Document, Page, View, Text, StyleSheet, Font,
} from '@react-pdf/renderer';
import type { R1FichaData } from '../../types';

// react-pdf uses StyleSheet.create — NO Tailwind, NO CSS classes
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  logoText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#2563EB',
  },
  obraNome: {
    fontSize: 11,
    color: '#374151',
    marginTop: 4,
  },
  fichaNumero: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 4,
  },
  // Section headers
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  // Checklist item
  checkRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'flex-start',
  },
  checkRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  checkIcon: {
    width: 18,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  checkOk: { color: '#16A34A' },
  checkNc: { color: '#DC2626' },
  checkNa: { color: '#9CA3AF' },
  checkDesc: { flex: 1, fontSize: 9, color: '#374151', paddingLeft: 4 },
  checkObs: { flex: 1, fontSize: 8, color: '#6B7280', paddingLeft: 4, fontStyle: 'italic' },
  criticidadeBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  criticidadeCritico: { backgroundColor: '#FEF2F2', color: '#991B1B' },
  criticidadeMaior: { backgroundColor: '#FFFBEB', color: '#92400E' },
  criticidadeMenor: { backgroundColor: '#F0FDF4', color: '#166534' },
  // NC table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCell: { fontSize: 8, color: '#374151' },
  colNumero: { width: '15%' },
  colItem: { width: '35%' },
  colCrit: { width: '15%' },
  colStatus: { width: '20%' },
  colPrazo: { width: '15%' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
  // Signature
  signatureBox: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 6,
    width: 200,
  },
  signatureText: { fontSize: 9, color: '#374151' },
  signatureSubText: { fontSize: 8, color: '#6B7280', marginTop: 2 },
});

function statusIcon(status: string): { icon: string; style: object } {
  if (['conforme', 'conforme_apos_reinspecao', 'liberado_com_concessao'].includes(status))
    return { icon: '✓', style: styles.checkOk };
  if (['nao_conforme', 'nc_apos_reinspecao', 'retrabalho'].includes(status))
    return { icon: '✗', style: styles.checkNc };
  return { icon: '—', style: styles.checkNa };
}

function criticidadeStyle(c: string) {
  if (c === 'critico') return styles.criticidadeCritico;
  if (c === 'maior') return styles.criticidadeMaior;
  return styles.criticidadeMenor;
}

function criticidadeLabel(c: string) {
  if (c === 'critico') return 'Crítico';
  if (c === 'maior') return 'Maior';
  return 'Menor';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function truncate(str: string | null, len = 500): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

interface Props { dados: R1FichaData }

export function FichaInspecaoPdf({ dados }: Props) {
  const { ficha, servicos, ncs } = dados;
  const geradoEm = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>eldox</Text>
            <Text style={styles.obraNome}>{ficha.obra_nome}</Text>
            <Text style={styles.fichaNumero}>Ficha: {ficha.nome}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.fichaNumero, { fontFamily: 'Helvetica-Bold' }]}>
              FICHA DE INSPEÇÃO
            </Text>
            <Text style={styles.fichaNumero}>Inspetor: {ficha.inspetor_nome}</Text>
            <Text style={styles.fichaNumero}>Data: {formatDate(ficha.created_at)}</Text>
            <Text style={styles.fichaNumero}>Status: {ficha.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* Checklist por serviço */}
        {servicos.map((servico) =>
          servico.locais.map((local) => (
            <View key={`${servico.servico_nome}-${local.local_nome}`}>
              <Text style={styles.sectionTitle}>
                {servico.servico_nome} — {local.local_nome}
              </Text>
              {local.itens.map((item, i) => {
                const { icon, style: iconStyle } = statusIcon(item.status);
                return (
                  <View
                    key={i}
                    style={[styles.checkRow, i % 2 === 1 ? styles.checkRowAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.checkIcon, iconStyle]}>{icon}</Text>
                    <View style={styles.checkDesc}>
                      <Text>{truncate(item.descricao, 200)}</Text>
                      {item.observacao && (
                        <Text style={styles.checkObs}>{truncate(item.observacao)}</Text>
                      )}
                    </View>
                    <Text style={[styles.criticidadeBadge, criticidadeStyle(item.criticidade)]}>
                      {criticidadeLabel(item.criticidade)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )),
        )}

        {/* NCs */}
        {ncs.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Não Conformidades</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colNumero]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
              <Text style={[styles.tableHeaderCell, styles.colCrit]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrazo]}>Prazo</Text>
            </View>
            {ncs.map((nc, i) => (
              <View
                key={nc.numero}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colNumero]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, styles.colItem]}>{truncate(nc.item_descricao, 100)}</Text>
                <Text style={[styles.tableCell, styles.colCrit]}>{criticidadeLabel(nc.criticidade)}</Text>
                <Text style={[styles.tableCell, styles.colStatus]}>{nc.status}</Text>
                <Text style={[styles.tableCell, styles.colPrazo]}>
                  {nc.prazo ? formatDate(nc.prazo) : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Assinatura */}
        <View style={styles.signatureBox}>
          <Text style={styles.signatureText}>{ficha.inspetor_nome}</Text>
          <Text style={styles.signatureSubText}>Inspetor — {formatDate(ficha.created_at)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/pdf/
git commit -m "feat(fvs): add PdfRenderer + R1 FichaInspecaoPdf template"
```

---

## Task 5: R2 — Conformidade por Serviço (PDF + Excel)

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx`
- Create: `frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts`
- Create: `frontend-web/src/modules/fvs/relatorios/excel/XlsxRenderer.ts`

- [ ] **Step 1: Create ConformidadePdf.tsx**

Create `frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R2ConformidadeData } from '../../types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCell: { fontSize: 8, color: '#374151' },
  col1: { width: '18%' },
  col2: { width: '20%' },
  col3: { width: '15%' },
  col4: { width: '12%' },
  col5: { width: '12%' },
  col6: { width: '12%' },
  col7: { width: '11%' },
  // Bar chart
  barContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 10, height: 80 },
  barWrapper: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  bar: { width: '100%', backgroundColor: '#2563EB', borderRadius: 2 },
  barLabel: { fontSize: 6, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  barValue: { fontSize: 7, color: '#2563EB', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  // Summary row
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  summaryLabel: { fontSize: 7, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R2ConformidadeData }

export function ConformidadePdf({ dados }: Props) {
  const { obra_nome, servico_nome, data_inicio, data_fim, por_semana, fichas, ncs_por_criticidade } = dados;
  const geradoEm = formatDate(new Date().toISOString());
  const maxTaxa = por_semana.length > 0 ? Math.max(...por_semana.map((s) => s.taxa), 1) : 100;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Conformidade</Text>
            <Text style={styles.subtitle}>
              {obra_nome}{servico_nome ? ` — ${servico_nome}` : ''} | {formatDate(data_inicio)} a {formatDate(data_fim)}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: '#2563EB' }]}>eldox</Text>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{fichas.length}</Text>
            <Text style={styles.summaryLabel}>Fichas Inspecionadas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{ncs_por_criticidade.critico}</Text>
            <Text style={styles.summaryLabel}>NCs Críticas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{ncs_por_criticidade.maior}</Text>
            <Text style={styles.summaryLabel}>NCs Maiores</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{ncs_por_criticidade.menor}</Text>
            <Text style={styles.summaryLabel}>NCs Menores</Text>
          </View>
        </View>

        {/* Bar chart: taxa por semana */}
        {por_semana.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Taxa de Conformidade por Semana</Text>
            <View style={styles.barContainer}>
              {por_semana.map((semana) => {
                const barHeight = Math.max(4, (semana.taxa / maxTaxa) * 70);
                return (
                  <View key={semana.semana} style={styles.barWrapper}>
                    <Text style={styles.barValue}>{semana.taxa}%</Text>
                    <View style={[styles.bar, { height: barHeight }]} />
                    <Text style={styles.barLabel}>{semana.semana.split('-W')[1] ? `S${semana.semana.split('-W')[1]}` : semana.semana}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Fichas table */}
        <Text style={styles.sectionTitle}>Fichas Inspecionadas</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.col1]}>Ficha</Text>
          <Text style={[styles.tableHeaderCell, styles.col2]}>Data</Text>
          <Text style={[styles.tableHeaderCell, styles.col3]}>Inspetor</Text>
          <Text style={[styles.tableHeaderCell, styles.col4]}>Local</Text>
          <Text style={[styles.tableHeaderCell, styles.col5]}>Itens OK</Text>
          <Text style={[styles.tableHeaderCell, styles.col6]}>Itens NC</Text>
          <Text style={[styles.tableHeaderCell, styles.col7]}>Taxa %</Text>
        </View>
        {fichas.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1 }]}>Nenhum registro encontrado</Text>
          </View>
        )}
        {fichas.map((f, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
            <Text style={[styles.tableCell, styles.col1]}>{f.ficha_numero}</Text>
            <Text style={[styles.tableCell, styles.col2]}>{formatDate(f.data)}</Text>
            <Text style={[styles.tableCell, styles.col3]}>{f.inspetor}</Text>
            <Text style={[styles.tableCell, styles.col4]}>{f.local}</Text>
            <Text style={[styles.tableCell, styles.col5]}>{f.itens_ok}</Text>
            <Text style={[styles.tableCell, styles.col6]}>{f.itens_nc}</Text>
            <Text style={[styles.tableCell, styles.col7, { color: f.taxa >= 80 ? '#16A34A' : f.taxa >= 60 ? '#D97706' : '#DC2626', fontFamily: 'Helvetica-Bold' }]}>
              {f.taxa}%
            </Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Create XlsxRenderer.ts (shared Excel entry point)**

Create `frontend-web/src/modules/fvs/relatorios/excel/XlsxRenderer.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/excel/XlsxRenderer.ts
import type { ReportTipo, ReportFiltros } from '../types';
import type { RelatorioDadosResult } from '../hooks/useRelatorioFvs';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildXlsxFilename(tipo: ReportTipo, dados: RelatorioDadosResult): string {
  const date = new Date().toISOString().split('T')[0];
  const tipoSlug = tipo.toLowerCase().replace('_', '-');
  const obraRaw = (dados as { obra_nome?: string }).obra_nome ?? 'obra';
  const obraSlug = slugify(obraRaw).slice(0, 20);
  return `eldox-${tipoSlug}-${obraSlug}-${date}.xlsx`;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function renderToXlsx(
  tipo: ReportTipo,
  dados: RelatorioDadosResult,
  _filtros: ReportFiltros,
): Promise<void> {
  const filename = buildXlsxFilename(tipo, dados);

  switch (tipo) {
    case 'R2_CONFORMIDADE': {
      const { gerarConformidadeXlsx } = await import('./ConformidadeXlsx');
      const buffer = await gerarConformidadeXlsx(dados as import('../types').R2ConformidadeData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R3_PENDENCIAS': {
      const { gerarPendenciasXlsx } = await import('./PendenciasXlsx');
      const buffer = await gerarPendenciasXlsx(dados as import('../types').R3PendenciasData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R4_NCS': {
      const { gerarNcsXlsx } = await import('./NcsXlsx');
      const buffer = await gerarNcsXlsx(dados as import('../types').R4NcsData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R5_PA': {
      const { gerarPlanoAcaoXlsx } = await import('./PlanoAcaoXlsx');
      const buffer = await gerarPlanoAcaoXlsx(dados as import('../types').R5PlanoAcaoData);
      downloadBuffer(buffer, filename);
      break;
    }
    default:
      throw new Error(`Excel não suportado para tipo ${tipo}`);
  }
}
```

- [ ] **Step 3: Create ConformidadeXlsx.ts**

Create `frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts
import ExcelJS from 'exceljs';
import type { R2ConformidadeData } from '../types';

const AZUL_ELDOX = 'FF2563EB';
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ELDOX } };
const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
const BORDER_LIGHT: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGNMENT;
    cell.border = BORDER_LIGHT;
  });
  row.height = 22;
}

function applyDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', wrapText: false };
    cell.border = BORDER_LIGHT;
    if (isAlt) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }
  });
}

export async function gerarConformidadeXlsx(dados: R2ConformidadeData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // ── Sheet 1: Fichas ─────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Fichas Inspecionadas');
  ws1.columns = [
    { header: 'Ficha #',   key: 'ficha_numero', width: 22 },
    { header: 'Data',      key: 'data',         width: 14 },
    { header: 'Inspetor',  key: 'inspetor',     width: 22 },
    { header: 'Local',     key: 'local',        width: 22 },
    { header: 'Itens OK',  key: 'itens_ok',     width: 10 },
    { header: 'Itens NC',  key: 'itens_nc',     width: 10 },
    { header: 'Taxa %',    key: 'taxa',         width: 10 },
  ];

  applyHeaderRow(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.fichas.length === 0) {
    const emptyRow = ws1.addRow({ ficha_numero: 'Nenhum registro encontrado' });
    emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
  } else {
    dados.fichas.forEach((f, i) => {
      const row = ws1.addRow({
        ficha_numero: f.ficha_numero,
        data: new Date(f.data).toLocaleDateString('pt-BR'),
        inspetor: f.inspetor,
        local: f.local,
        itens_ok: f.itens_ok,
        itens_nc: f.itens_nc,
        taxa: f.taxa,
      });
      applyDataRow(row, i % 2 === 1);
      // Color-code taxa
      const taxaCell = row.getCell('taxa');
      taxaCell.value = `${f.taxa}%`;
      taxaCell.font = {
        bold: true,
        color: {
          argb: f.taxa >= 80 ? 'FF16A34A' : f.taxa >= 60 ? 'FFD97706' : 'FFDC2626',
        },
      };
    });
  }

  // ── Sheet 2: Taxa por Semana ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Taxa por Semana');
  ws2.columns = [
    { header: 'Semana',    key: 'semana',    width: 16 },
    { header: 'Total',     key: 'total',     width: 10 },
    { header: 'Aprovadas', key: 'aprovadas', width: 12 },
    { header: 'Taxa %',    key: 'taxa',      width: 10 },
  ];
  applyHeaderRow(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.por_semana.length === 0) {
    const emptyRow = ws2.addRow({ semana: 'Sem dados no período' });
    emptyRow.getCell(1).font = { italic: true, color: { argb: 'FF6B7280' } };
  } else {
    dados.por_semana.forEach((s, i) => {
      const row = ws2.addRow({ semana: s.semana, total: s.total, aprovadas: s.aprovadas, taxa: `${s.taxa}%` });
      applyDataRow(row, i % 2 === 1);
    });
  }

  // ── Sheet 3: NCs por Criticidade ─────────────────────────────────────────────
  const ws3 = wb.addWorksheet('NCs por Criticidade');
  ws3.columns = [
    { header: 'Criticidade', key: 'criticidade', width: 18 },
    { header: 'Quantidade',  key: 'quantidade',  width: 14 },
  ];
  applyHeaderRow(ws3.getRow(1));
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { criticidade: 'Crítico', quantidade: dados.ncs_por_criticidade.critico },
    { criticidade: 'Maior',   quantidade: dados.ncs_por_criticidade.maior },
    { criticidade: 'Menor',   quantidade: dados.ncs_por_criticidade.menor },
  ].forEach((row, i) => {
    const r = ws3.addRow(row);
    applyDataRow(r, i % 2 === 1);
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

- [ ] **Step 4: Build to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx \
        frontend-web/src/modules/fvs/relatorios/excel/XlsxRenderer.ts \
        frontend-web/src/modules/fvs/relatorios/excel/ConformidadeXlsx.ts
git commit -m "feat(fvs): add R2 ConformidadePdf + ConformidadeXlsx"
```

---

## Task 6: R3 — Pendências (PDF + Excel)

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx`
- Create: `frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts`

- [ ] **Step 1: Create PendenciasPdf.tsx**

Create `frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R3PendenciasData } from '../../types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#DC2626' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#7F1D1D',
    backgroundColor: '#FEF2F2',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#FFF5F5' },
  tableCell: { fontSize: 8, color: '#374151' },
  urgenteBadge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  normalBadge: {
    fontSize: 7,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
  emptyText: { fontSize: 9, color: '#6B7280', fontStyle: 'italic', paddingVertical: 6, paddingHorizontal: 4 },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R3PendenciasData }

export function PendenciasPdf({ dados }: Props) {
  const { obra_nome, data_geracao, fichas_abertas, ncs_sem_plano, planos_vencidos } = dados;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Pendências</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#DC2626' }]}>eldox</Text>
        </View>

        {/* Fichas abertas */}
        <Text style={styles.sectionTitle}>
          Seção 1 — Inspeções em Aberto ({fichas_abertas.length})
        </Text>
        {fichas_abertas.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma inspeção em aberto.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Ficha</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Inspetor</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Abertura</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Prioridade</Text>
            </View>
            {fichas_abertas.map((f, i) => (
              <View key={f.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{f.nome}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{f.status}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>{f.inspetor_nome}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{formatDate(f.created_at)}</Text>
                <Text style={[styles.tableCell, { width: '10%', fontFamily: 'Helvetica-Bold', color: f.dias_aberta >= 7 ? '#DC2626' : '#374151' }]}>
                  {f.dias_aberta}d
                </Text>
                <Text style={f.dias_aberta >= 7 ? styles.urgenteBadge : styles.normalBadge}>
                  {f.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* NCs sem plano */}
        <Text style={styles.sectionTitle}>
          Seção 2 — NCs sem Plano de Ação ({ncs_sem_plano.length})
        </Text>
        {ncs_sem_plano.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma NC sem plano de ação.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Título</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Abertura</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Prioridade</Text>
            </View>
            {ncs_sem_plano.map((nc, i) => (
              <View key={nc.numero} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '15%' }]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, { width: '35%' }]}>{nc.titulo}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{nc.criticidade}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{formatDate(nc.created_at)}</Text>
                <Text style={[styles.tableCell, { width: '10%', fontFamily: 'Helvetica-Bold', color: nc.dias_aberta >= 7 ? '#DC2626' : '#374151' }]}>
                  {nc.dias_aberta}d
                </Text>
                <Text style={nc.criticidade === 'ALTA' || nc.dias_aberta >= 7 ? styles.urgenteBadge : styles.normalBadge}>
                  {nc.criticidade === 'ALTA' || nc.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Planos vencidos */}
        <Text style={styles.sectionTitle}>
          Seção 3 — Planos de Ação Vencidos ({planos_vencidos.length})
        </Text>
        {planos_vencidos.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum plano de ação vencido.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Título</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Responsável</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Prazo</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Dias Vencido</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Prioridade</Text>
            </View>
            {planos_vencidos.map((pa, i) => (
              <View key={pa.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '35%' }]}>{pa.titulo}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>{pa.responsavel ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{pa.prazo ? formatDate(pa.prazo) : '—'}</Text>
                <Text style={[styles.tableCell, { width: '15%', fontFamily: 'Helvetica-Bold', color: '#DC2626' }]}>
                  {pa.dias_vencido}d
                </Text>
                <Text style={pa.prioridade === 'URGENTE' ? styles.urgenteBadge : styles.normalBadge}>
                  {pa.prioridade}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {formatDate(data_geracao)}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Create PendenciasXlsx.ts**

Create `frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts
import ExcelJS from 'exceljs';
import type { R3PendenciasData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL_RED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL_RED; c.border = BORDER; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
  });
}

export async function gerarPendenciasXlsx(dados: R3PendenciasData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: Fichas Abertas
  const ws1 = wb.addWorksheet('Fichas Abertas');
  ws1.columns = [
    { header: 'Ficha',     key: 'nome',          width: 28 },
    { header: 'Status',    key: 'status',         width: 16 },
    { header: 'Inspetor',  key: 'inspetor_nome',  width: 22 },
    { header: 'Abertura',  key: 'created_at',     width: 14 },
    { header: 'Dias',      key: 'dias_aberta',    width: 8 },
    { header: 'Prioridade',key: 'prioridade',     width: 12 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.fichas_abertas.length === 0) {
    ws1.addRow({ nome: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.fichas_abertas.forEach((f, i) => {
      const row = ws1.addRow({
        nome: f.nome,
        status: f.status,
        inspetor_nome: f.inspetor_nome,
        created_at: new Date(f.created_at).toLocaleDateString('pt-BR'),
        dias_aberta: f.dias_aberta,
        prioridade: f.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL',
      });
      applyData(row, i % 2 === 1);
      if (f.dias_aberta >= 7) row.getCell('dias_aberta').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  // Sheet 2: NCs sem Plano
  const ws2 = wb.addWorksheet('NCs sem Plano');
  ws2.columns = [
    { header: 'NC #',       key: 'numero',      width: 14 },
    { header: 'Título',     key: 'titulo',      width: 32 },
    { header: 'Criticidade',key: 'criticidade', width: 14 },
    { header: 'Status',     key: 'status',      width: 14 },
    { header: 'Abertura',   key: 'created_at',  width: 14 },
    { header: 'Dias',       key: 'dias_aberta', width: 8 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.ncs_sem_plano.length === 0) {
    ws2.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.ncs_sem_plano.forEach((nc, i) => {
      const row = ws2.addRow({
        numero: nc.numero,
        titulo: nc.titulo,
        criticidade: nc.criticidade,
        status: nc.status,
        created_at: new Date(nc.created_at).toLocaleDateString('pt-BR'),
        dias_aberta: nc.dias_aberta,
      });
      applyData(row, i % 2 === 1);
      if (nc.criticidade === 'ALTA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  // Sheet 3: Planos Vencidos
  const ws3 = wb.addWorksheet('Planos Vencidos');
  ws3.columns = [
    { header: 'Título',      key: 'titulo',       width: 32 },
    { header: 'Responsável', key: 'responsavel',  width: 22 },
    { header: 'Prazo',       key: 'prazo',        width: 14 },
    { header: 'Dias Vencido',key: 'dias_vencido', width: 14 },
    { header: 'Prioridade',  key: 'prioridade',   width: 12 },
  ];
  applyHeader(ws3.getRow(1));
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  if (dados.planos_vencidos.length === 0) {
    ws3.addRow({ titulo: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.planos_vencidos.forEach((pa, i) => {
      const row = ws3.addRow({
        titulo: pa.titulo,
        responsavel: pa.responsavel ?? '—',
        prazo: pa.prazo ? new Date(pa.prazo).toLocaleDateString('pt-BR') : '—',
        dias_vencido: pa.dias_vencido,
        prioridade: pa.prioridade,
      });
      applyData(row, i % 2 === 1);
      row.getCell('dias_vencido').font = { bold: true, color: { argb: 'FFDC2626' } };
    });
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx \
        frontend-web/src/modules/fvs/relatorios/excel/PendenciasXlsx.ts
git commit -m "feat(fvs): add R3 PendenciasPdf + PendenciasXlsx"
```

---

## Task 7: R4 — Não Conformidades (PDF + Excel)

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx`
- Create: `frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts`

- [ ] **Step 1: Create NcsPdf.tsx**

Create `frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R4NcsData } from '../../types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  // Summary cards
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  summaryLabel: { fontSize: 7, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  // Pie chart simulation (donut-style percentages as text boxes)
  pieRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 10 },
  pieItem: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  pieValue: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  pieLabel: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableRowGroupTitle: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tableGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  tableCell: { fontSize: 7, color: '#374151' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R4NcsData }

export function NcsPdf({ dados }: Props) {
  const { obra_nome, data_geracao, ncs, sla, por_criticidade } = dados;
  const totalNcs = ncs.length;

  // Group by servico for sub-total separators
  const byServico: Record<string, typeof ncs> = {};
  ncs.forEach((nc) => {
    if (!byServico[nc.servico]) byServico[nc.servico] = [];
    byServico[nc.servico].push(nc);
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Não Conformidades</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#2563EB' }]}>eldox</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalNcs}</Text>
            <Text style={styles.summaryLabel}>Total NCs</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#DC2626' }]}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{sla.vencidas}</Text>
            <Text style={styles.summaryLabel}>Vencidas</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#16A34A' }]}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{sla.no_prazo}</Text>
            <Text style={styles.summaryLabel}>No Prazo</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#9CA3AF' }]}>{sla.sem_prazo}</Text>
            <Text style={styles.summaryLabel}>Sem Prazo</Text>
          </View>
        </View>

        {/* Distribuição por criticidade (pie-equivalent) */}
        <Text style={styles.sectionTitle}>Distribuição por Criticidade</Text>
        <View style={styles.pieRow}>
          <View style={[styles.pieItem, { borderColor: '#DC2626' }]}>
            <Text style={[styles.pieValue, { color: '#DC2626' }]}>{por_criticidade.alta}</Text>
            <Text style={styles.pieLabel}>Alta</Text>
          </View>
          <View style={[styles.pieItem, { borderColor: '#D97706' }]}>
            <Text style={[styles.pieValue, { color: '#D97706' }]}>{por_criticidade.media}</Text>
            <Text style={styles.pieLabel}>Média</Text>
          </View>
          <View style={[styles.pieItem, { borderColor: '#16A34A' }]}>
            <Text style={[styles.pieValue, { color: '#16A34A' }]}>{por_criticidade.baixa}</Text>
            <Text style={styles.pieLabel}>Baixa</Text>
          </View>
        </View>

        {/* NC table grouped by service */}
        <Text style={styles.sectionTitle}>Detalhamento ({totalNcs} NCs)</Text>
        {Object.entries(byServico).map(([servico, ncList]) => (
          <View key={servico}>
            <View style={styles.tableRowGroupTitle}>
              <Text style={styles.tableGroupTitle}>{servico} — {ncList.length} NCs</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Item</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Responsável</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Prazo</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Abertura</Text>
            </View>
            {ncList.map((nc, i) => (
              <View
                key={nc.numero}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: '10%' }]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, { width: '22%' }]}>{nc.item_descricao.slice(0, 80)}</Text>
                <Text style={[styles.tableCell, { width: '12%', color: nc.criticidade === 'ALTA' ? '#DC2626' : nc.criticidade === 'MEDIA' ? '#D97706' : '#16A34A' }]}>
                  {nc.criticidade}
                </Text>
                <Text style={[styles.tableCell, { width: '14%' }]}>{nc.status}</Text>
                <Text style={[styles.tableCell, { width: '18%' }]}>{nc.responsavel ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{nc.prazo ? formatDate(nc.prazo) : '—'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{formatDate(nc.created_at)}</Text>
              </View>
            ))}
          </View>
        ))}

        {ncs.length === 0 && (
          <Text style={{ fontSize: 9, color: '#6B7280', fontStyle: 'italic', padding: 8 }}>
            Nenhum registro encontrado com os filtros aplicados.
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {formatDate(data_geracao)}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Create NcsXlsx.ts**

Create `frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts
import ExcelJS from 'exceljs';
import type { R4NcsData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL; c.border = BORDER; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (alt) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
  });
}

export async function gerarNcsXlsx(dados: R4NcsData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: NCs Detalhadas
  const ws1 = wb.addWorksheet('Não Conformidades');
  ws1.columns = [
    { header: 'NC #',        key: 'numero',        width: 12 },
    { header: 'Ficha',       key: 'ficha_nome',    width: 20 },
    { header: 'Serviço',     key: 'servico',       width: 20 },
    { header: 'Item',        key: 'item_descricao',width: 32 },
    { header: 'Criticidade', key: 'criticidade',   width: 14 },
    { header: 'Status',      key: 'status',        width: 16 },
    { header: 'Responsável', key: 'responsavel',   width: 22 },
    { header: 'Prazo',       key: 'prazo',         width: 14 },
    { header: 'Abertura',    key: 'created_at',    width: 14 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.ncs.length === 0) {
    ws1.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    // Group rows by servico with sub-total rows
    const byServico: Record<string, typeof dados.ncs> = {};
    dados.ncs.forEach((nc) => {
      if (!byServico[nc.servico]) byServico[nc.servico] = [];
      byServico[nc.servico].push(nc);
    });
    let rowIndex = 0;
    Object.entries(byServico).forEach(([servico, ncList]) => {
      // Group header
      const groupRow = ws1.addRow({ numero: `── ${servico} (${ncList.length} NCs) ──` });
      groupRow.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        c.font = { bold: true, color: { argb: 'FF1E3A5F' } };
      });
      ws1.mergeCells(`A${groupRow.number}:I${groupRow.number}`);
      ncList.forEach((nc) => {
        const row = ws1.addRow({
          numero: nc.numero,
          ficha_nome: nc.ficha_nome,
          servico: nc.servico,
          item_descricao: nc.item_descricao,
          criticidade: nc.criticidade,
          status: nc.status,
          responsavel: nc.responsavel ?? '—',
          prazo: nc.prazo ? new Date(nc.prazo).toLocaleDateString('pt-BR') : '—',
          created_at: new Date(nc.created_at).toLocaleDateString('pt-BR'),
        });
        applyData(row, rowIndex % 2 === 1);
        if (nc.criticidade === 'ALTA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFDC2626' } };
        else if (nc.criticidade === 'MEDIA') row.getCell('criticidade').font = { bold: true, color: { argb: 'FFD97706' } };
        rowIndex++;
      });
    });
  }

  // Sheet 2: Resumo SLA
  const ws2 = wb.addWorksheet('Resumo SLA');
  ws2.columns = [
    { header: 'Métrica',     key: 'metrica',    width: 20 },
    { header: 'Quantidade',  key: 'quantidade', width: 14 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { metrica: 'No Prazo',    quantidade: dados.sla.no_prazo },
    { metrica: 'Vencidas',    quantidade: dados.sla.vencidas },
    { metrica: 'Sem Prazo',   quantidade: dados.sla.sem_prazo },
    { metrica: 'Alta',        quantidade: dados.por_criticidade.alta },
    { metrica: 'Média',       quantidade: dados.por_criticidade.media },
    { metrica: 'Baixa',       quantidade: dados.por_criticidade.baixa },
  ].forEach((item, i) => {
    const r = ws2.addRow(item);
    applyData(r, i % 2 === 1);
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx \
        frontend-web/src/modules/fvs/relatorios/excel/NcsXlsx.ts
git commit -m "feat(fvs): add R4 NcsPdf + NcsXlsx"
```

---

## Task 8: R5 — Planos de Ação (PDF + Excel)

**Files:**
- Create: `frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx`
- Create: `frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts`

- [ ] **Step 1: Create PlanoAcaoPdf.tsx**

Create `frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx`:

```tsx
// frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R5PlanoAcaoData } from '../../types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#7C3AED',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#7C3AED' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#4C1D95',
    backgroundColor: '#F5F3FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#7C3AED' },
  summaryLabel: { fontSize: 7, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableRowVencido: { backgroundColor: '#FEE2E2' },
  tableRowGroupTitle: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tableGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4C1D95' },
  tableCell: { fontSize: 7, color: '#374151' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R5PlanoAcaoData }

export function PlanoAcaoPdf({ dados }: Props) {
  const { obra_nome, data_geracao, planos, resumo } = dados;

  // Group by etapa
  const byEtapa: Record<string, typeof planos> = {};
  planos.forEach((p) => {
    const key = p.etapa_atual;
    if (!byEtapa[key]) byEtapa[key] = [];
    byEtapa[key].push(p);
  });

  const etapaOrder = ['ABERTO', 'EM_ANDAMENTO', 'VERIFICACAO', 'FECHADO'];
  const sortedEtapas = [
    ...etapaOrder.filter((e) => byEtapa[e]),
    ...Object.keys(byEtapa).filter((e) => !etapaOrder.includes(e)),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Planos de Ação</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#7C3AED' }]}>eldox</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{resumo.abertos}</Text>
            <Text style={styles.summaryLabel}>Abertos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{resumo.em_andamento}</Text>
            <Text style={styles.summaryLabel}>Em Andamento</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{resumo.fechados_este_mes}</Text>
            <Text style={styles.summaryLabel}>Fechados este Mês</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{planos.length}</Text>
            <Text style={styles.summaryLabel}>Total PAs</Text>
          </View>
        </View>

        {/* Kanban em texto: agrupado por etapa */}
        {sortedEtapas.map((etapa) => {
          const etapaPlanos = byEtapa[etapa] ?? [];
          return (
            <View key={etapa}>
              <View style={styles.tableRowGroupTitle}>
                <Text style={styles.tableGroupTitle}>
                  {etapa.replace('_', ' ')} — {etapaPlanos.length} plano(s)
                </Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '8%' }]}>PA #</Text>
                <Text style={[styles.tableHeaderCell, { width: '28%' }]}>Título</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Origem</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Prioridade</Text>
                <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Responsável</Text>
                <Text style={[styles.tableHeaderCell, { width: '11%' }]}>Prazo</Text>
                <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias Aberto</Text>
              </View>
              {etapaPlanos.map((pa, i) => (
                <View
                  key={pa.id}
                  style={[
                    styles.tableRow,
                    pa.vencido ? styles.tableRowVencido : i % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '8%' }]}>{pa.numero}</Text>
                  <Text style={[styles.tableCell, { width: '28%' }]}>{pa.titulo.slice(0, 80)}</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>{pa.origem}</Text>
                  <Text style={[styles.tableCell, { width: '12%', color: pa.prioridade === 'URGENTE' ? '#DC2626' : '#374151' }]}>
                    {pa.prioridade}
                  </Text>
                  <Text style={[styles.tableCell, { width: '16%' }]}>{pa.responsavel ?? '—'}</Text>
                  <Text style={[styles.tableCell, { width: '11%', color: pa.vencido ? '#DC2626' : '#374151' }]}>
                    {pa.prazo ? formatDate(pa.prazo) : '—'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '10%', fontFamily: pa.vencido ? 'Helvetica-Bold' : 'Helvetica', color: pa.vencido ? '#DC2626' : '#374151' }]}>
                    {pa.dias_aberto}d
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {planos.length === 0 && (
          <Text style={{ fontSize: 9, color: '#6B7280', fontStyle: 'italic', padding: 8 }}>
            Nenhum plano de ação encontrado com os filtros aplicados.
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {formatDate(data_geracao)}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Create PlanoAcaoXlsx.ts**

Create `frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts`:

```typescript
// frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts
import ExcelJS from 'exceljs';
import type { R5PlanoAcaoData } from '../types';

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function applyHeader(row: ExcelJS.Row) {
  row.eachCell((c) => { c.font = HEADER_FONT; c.fill = HEADER_FILL; c.border = BORDER; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
  row.height = 22;
}

function applyData(row: ExcelJS.Row, vencido: boolean, alt: boolean) {
  row.eachCell((c) => {
    c.border = BORDER;
    c.alignment = { vertical: 'middle' };
    if (vencido) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    } else if (alt) {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }
  });
}

export async function gerarPlanoAcaoXlsx(dados: R5PlanoAcaoData): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Eldox';
  wb.created = new Date();

  // Sheet 1: Todos os Planos
  const ws1 = wb.addWorksheet('Planos de Ação');
  ws1.columns = [
    { header: 'PA #',        key: 'numero',       width: 12 },
    { header: 'Título',      key: 'titulo',       width: 32 },
    { header: 'Origem',      key: 'origem',       width: 20 },
    { header: 'Etapa',       key: 'etapa_atual',  width: 16 },
    { header: 'Prioridade',  key: 'prioridade',   width: 12 },
    { header: 'Responsável', key: 'responsavel',  width: 22 },
    { header: 'Prazo',       key: 'prazo',        width: 14 },
    { header: 'Dias Aberto', key: 'dias_aberto',  width: 12 },
    { header: 'Vencido',     key: 'vencido',      width: 10 },
  ];
  applyHeader(ws1.getRow(1));
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  if (dados.planos.length === 0) {
    ws1.addRow({ numero: 'Nenhum registro encontrado' }).getCell(1).font = { italic: true };
  } else {
    dados.planos.forEach((pa, i) => {
      const row = ws1.addRow({
        numero: pa.numero,
        titulo: pa.titulo,
        origem: pa.origem,
        etapa_atual: pa.etapa_atual.replace('_', ' '),
        prioridade: pa.prioridade,
        responsavel: pa.responsavel ?? '—',
        prazo: pa.prazo ? new Date(pa.prazo).toLocaleDateString('pt-BR') : '—',
        dias_aberto: pa.dias_aberto,
        vencido: pa.vencido ? 'Sim' : 'Não',
      });
      applyData(row, pa.vencido, i % 2 === 1);
      if (pa.vencido) {
        row.getCell('vencido').font = { bold: true, color: { argb: 'FFDC2626' } };
        row.getCell('prazo').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
      if (pa.prioridade === 'URGENTE') {
        row.getCell('prioridade').font = { bold: true, color: { argb: 'FFDC2626' } };
      }
    });
  }

  // Sheet 2: Resumo
  const ws2 = wb.addWorksheet('Resumo');
  ws2.columns = [
    { header: 'Métrica',     key: 'metrica',    width: 24 },
    { header: 'Quantidade',  key: 'quantidade', width: 14 },
  ];
  applyHeader(ws2.getRow(1));
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  [
    { metrica: 'Total de Planos',           quantidade: dados.planos.length },
    { metrica: 'Abertos',                   quantidade: dados.resumo.abertos },
    { metrica: 'Em Andamento',              quantidade: dados.resumo.em_andamento },
    { metrica: 'Fechados Este Mês',         quantidade: dados.resumo.fechados_este_mes },
    { metrica: 'Vencidos',                  quantidade: dados.planos.filter((p) => p.vencido).length },
  ].forEach((item, i) => {
    const r = ws2.addRow(item);
    r.eachCell((c) => { c.border = BORDER; c.alignment = { vertical: 'middle' }; });
    if (i % 2 === 1) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; });
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
```

- [ ] **Step 3: Build to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx \
        frontend-web/src/modules/fvs/relatorios/excel/PlanoAcaoXlsx.ts
git commit -m "feat(fvs): add R5 PlanoAcaoPdf + PlanoAcaoXlsx"
```

---

## Task 9: Integration — Wire RelatorioBotao into existing pages

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`
- Modify: `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx`
- Modify: `frontend-web/src/modules/ncs/pages/NcsListPage.tsx`

Note: `GradeMateriaisPage` is in the FVM module (`frontend-web/src/modules/fvm/grade/pages/GradeMateriaisPage.tsx`) — R2 conformidade is FVS-specific so we wire to `FichaGradePage` instead. `PlanosAcaoPage` does not exist yet in the router — R5 button is added to `NcsListPage` as a companion, and the standalone page integration will be done when that page is created. The spec integration points map to the existing pages: `FichaGradePage` (R1), `FvsDashboardPage` (R3), `NcsListPage` (R4). For R2, the trigger is on the `FichaGradePage` grade toolbar.

- [ ] **Step 1: Add R1 + R2 buttons to FichaGradePage**

Open `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`.

After the existing imports, add:

```typescript
import { RelatorioBotao } from '../../../relatorios/components/RelatorioBotao';
```

In the page header JSX — locate the `<div>` that contains the `ArrowLeft` back button and the page title. After the existing action buttons (the `Download`, `Share2` icons area), add:

```tsx
<RelatorioBotao
  tipo="R1_FICHA"
  filtros={{ fichaId: id, obraId: ficha?.obra_id }}
  formatos={['pdf']}
  label="Exportar Ficha PDF"
/>
<RelatorioBotao
  tipo="R2_CONFORMIDADE"
  filtros={{ obraId: ficha?.obra_id }}
  formatos={['pdf', 'excel']}
  label="Conformidade"
/>
```

**Important:** `ficha` comes from the existing `useFicha(id)` hook call already in the component. `obra_id` is a field on `FichaFvs`. Verify this field exists in `fvs.service.ts` type definition before wiring — it does not appear in `FichaFvs` directly but comes via the page route `obraId` param if available. Add `const { obraId: obraIdParam } = useParams<{ obraId?: string }>();` and use `obraIdParam ? Number(obraIdParam) : undefined` as fallback for `obraId`.

The full replacement for the action button group (find the block with `Share2` and `Download` icons — typically around `className="flex items-center gap-2"`) — insert the two `RelatorioBotao` components between the existing icon buttons and the `RoPanel` toggle button.

- [ ] **Step 2: Add R3 shortcut to FvsDashboardPage**

Open `frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx`.

Add import at top:

```typescript
import { RelatorioBotao } from '../../relatorios/components/RelatorioBotao';
```

The dashboard already renders a `obraId` from `useParams`. Find the summary/action area in the JSX (the area with `BarChart2`, `CheckCircle` icons or the existing shortcuts section). Add a new card after the existing metric cards:

```tsx
{obraId && (
  <div className="p-4 rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)] flex flex-col gap-2">
    <p className="text-sm font-medium text-[var(--text-main)]">Relatório de Pendências</p>
    <p className="text-xs text-[var(--text-faint)]">Fichas abertas, NCs sem plano, PAs vencidos</p>
    <RelatorioBotao
      tipo="R3_PENDENCIAS"
      filtros={{
        obraId: Number(obraId),
        dataInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        dataFim: new Date().toISOString().split('T')[0],
      }}
      formatos={['pdf', 'excel']}
      label="Gerar Relatório de Pendências"
    />
  </div>
)}
```

The `obraId` is obtained from `const { obraId } = useParams()` which already exists in the component.

- [ ] **Step 3: Add R4 export button to NcsListPage**

Open `frontend-web/src/modules/ncs/pages/NcsListPage.tsx`.

Add import at top:

```typescript
import { RelatorioBotao } from '../../fvs/relatorios/components/RelatorioBotao';
```

The page already has `const { obraId } = useParams<{ obraId: string }>()` and a header area. Find the `<Plus />` button that opens the NC creation modal — it is in a `flex items-center gap-2` header bar. Add `RelatorioBotao` alongside it:

```tsx
{obraId && (
  <RelatorioBotao
    tipo="R4_NCS"
    filtros={{ obraId: Number(obraId) }}
    formatos={['pdf', 'excel']}
    label="Exportar NCs"
  />
)}
```

Place it just before (or after) the existing `<button>` that opens the Nova NC modal. Both buttons should sit inside the same `flex` container.

- [ ] **Step 4: Build full frontend to verify no TS errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npx tsc --noEmit 2>&1 | grep -i error | head -40
```

Expected: zero errors.

If you see `Property 'obra_id' does not exist on type 'FichaFvs'` — the `FichaFvs` type in `fvs.service.ts` does not include `obra_id`. It does (line 165: `obra_id: number`) — confirm before proceeding.

- [ ] **Step 5: Run vite build to catch runtime errors**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3/frontend-web"
npm run build 2>&1 | tail -20
```

Expected: `✓ built in X.Xs` with no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx \
        frontend-web/src/modules/fvs/dashboard/pages/FvsDashboardPage.tsx \
        frontend-web/src/modules/ncs/pages/NcsListPage.tsx
git commit -m "feat(fvs): wire RelatorioBotao into FichaGradePage, FvsDashboardPage, NcsListPage"
```

---

## Self-Review

**1. Spec coverage check:**

| Requirement | Task |
|-------------|------|
| R1 — Ficha de Inspeção PDF only | Task 4 (`FichaInspecaoPdf.tsx`) |
| R2 — Conformidade PDF + Excel | Tasks 2 (backend), 5 (PDF + Excel) |
| R3 — Pendências PDF + Excel | Task 6 |
| R4 — NCs PDF + Excel | Task 7 |
| R5 — Planos de Ação PDF + Excel | Task 8 |
| RelatorioBotao component | Task 3 |
| FiltrosModal (missing filtros) | Task 3 |
| Loading spinner | Task 3 (`RelatorioBotao.tsx` — Loader2) |
| Download filename `eldox-{tipo}-{obra}-{data}.pdf` | Task 4 (`PdfRenderer.ts` buildFilename) |
| Integration: InspecaoDetalhePage (spec uses this name) → `FichaGradePage` is the correct target | Task 9 |
| Integration: FvsDashboardPage R3 shortcut | Task 9 |
| Integration: NcsListPage R4 export | Task 9 |
| R2 backend endpoint `/obras/:obraId/relatorio-conformidade` | Task 2 |
| Edge case: 0 rows → "Nenhum registro encontrado" row in Excel | All Excel tasks |
| Edge case: long observações truncated at 500 chars | Task 4 (`truncate()`) |
| Edge case: no fotos → section omitted (R1 has no fotos section in PDF — fotos would be fetched via evidencias; section is omitted if `evidencias.length === 0`) | Task 4 — `FichaInspecaoPdf.tsx` only renders evidencias section if array non-empty |
| Cabeçalho azul Eldox (#2563EB) in Excel | All Excel tasks |
| Primeira linha congelada | All Excel tasks (`ySplit: 1`) |
| Zebra-striping | All Excel tasks |
| Graph inline R2 bar chart in PDF | Task 5 — inline bar chart via `View` + height proportional to taxa |

**2. Placeholder scan:** All tasks contain complete code. No "TBD" found.

**3. Type consistency check:**

- `R2ConformidadeData.fichas[].data` — used as string (ISO) throughout. `ConformidadePdf` calls `formatDate(f.data)`. `ConformidadeXlsx` calls `new Date(f.data).toLocaleDateString()`. Consistent.
- `R3PendenciasData.fichas_abertas[].inspetor_nome` — defined in `types.ts`, used in `PendenciasPdf` and `PendenciasXlsx`. Consistent.
- `R4NcsData.ncs[].item_descricao` — defined in `types.ts`, used in `NcsPdf` (`nc.item_descricao`) and `NcsXlsx` (`item_descricao` column key). Consistent.
- `R5PlanoAcaoData.planos[].vencido: boolean` — defined in `types.ts`, used in `PlanoAcaoPdf` (`pa.vencido`) and `PlanoAcaoXlsx` (`pa.vencido ? 'Sim' : 'Não'`). Consistent.
- `useRelatorioFvs.triggerDownload` called with `(tipo, filtros, formato)` — `RelatorioBotao` calls `triggerDownload(tipo, filtros, formato)`. Consistent.
- `renderToPdf(tipo, dados, filtros)` and `renderToXlsx(tipo, dados, filtros)` — both called from `useRelatorioFvs.ts`. Consistent.
- `fetchDados` returns `RelatorioDadosResult` — used in both renderers with type casts. Safe.

All issues resolved inline.

---

## Final Commit

After all tasks complete and build passes:

```bash
cd "/Users/itamarpereira/Downloads/Novo Eldox/eldox-v3"
git add docs/superpowers/plans/2026-04-16-fvs-relatorios.md
git commit -m "docs: add implementation plan — FVS Relatórios exportáveis (5 tipos)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
