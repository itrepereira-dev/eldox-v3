# FVS Sprint 5 — Grade Visual Completa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o `FichaGradePage.tsx` no núcleo da experiência FVS: barra de progresso, filtros client-side, drawer lateral por célula, seleção em massa e agrupamento por pavimento.

**Architecture:** Backend adiciona `resumo` e `celulas_meta` ao endpoint de grade existente, e um novo endpoint de preview para o drawer. Frontend reescreve `FichaGradePage.tsx` em componentes menores (`GradeDrawer`, `GradeFiltros`, `GradeBulkBar`). Filtros são 100% client-side sobre dados já carregados.

**Tech Stack:** NestJS raw SQL (backend), React + TanStack Query + Tailwind CSS vars (frontend). Build backend: `npm run build` em `backend/`. Frontend usa `npm run dev` em `frontend-web/`.

**Dependência:** Requer Sprint 4b concluído (usa os 7 valores de `StatusGrade`).

---

## Arquivo-por-arquivo

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `backend/src/fvs/inspecao/inspecao.service.ts` | Modificar | `getGrade` — adicionar `resumo` e `celulas_meta` |
| `backend/src/fvs/inspecao/inspecao.controller.ts` | Modificar | Novo endpoint preview |
| `backend/src/fvs/types/fvs.types.ts` | Modificar | `FvsGrade` com `resumo` e `celulas_meta` |
| `frontend-web/src/services/fvs.service.ts` | Modificar | Tipos atualizados + método `getGradePreview` |
| `frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts` | Modificar | Passar `include_meta` opcional |
| `frontend-web/src/modules/fvs/inspecao/hooks/useFichas.ts` | Modificar | `useBulkInspecao` hook |
| `frontend-web/src/modules/fvs/inspecao/components/GradeDrawer.tsx` | Criar | Drawer lateral com itens do local |
| `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx` | Modificar | Progress bar, filtros, drawer, bulk, agrupamento |

---

## Task 1: Backend — `getGrade` com `resumo` e `celulas_meta`

**Files:**
- Modify: `backend/src/fvs/types/fvs.types.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Test: `backend/src/fvs/inspecao/inspecao.service.spec.ts`

- [ ] **Step 1: Escrever teste que falha**

Adicionar em `inspecao.service.spec.ts`:

```typescript
describe('getGrade() — Sprint 5 resumo', () => {
  it('inclui resumo com contagem de células por status', async () => {
    mockPrisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ id: 1 }])                  // getFichaOuFalhar
      // locais
      .mockResolvedValueOnce([
        { id: 101, nome: 'Ap 101', pavimento_id: 1, pavimento_nome: '1º Pav', ordem: 1 },
      ])
      // servicos
      .mockResolvedValueOnce([{ id: 1, nome: 'Alvenaria', codigo: 'ALV' }])
      // registros (para calcular grade)
      .mockResolvedValueOnce([
        { servico_id: 1, obra_local_id: 101, status: 'conforme', itens_total: 3, itens_avaliados: 3, itens_nc: 0, ultimo_inspetor: null, ultima_atividade: null },
      ]);

    const result = await svc.getGrade(TENANT_ID, 1, {});

    expect(result.resumo).toBeDefined();
    expect(result.resumo.aprovadas).toBe(1);
    expect(result.resumo.total_celulas).toBe(1);
    expect(result.resumo.progresso_pct).toBe(100);
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "getGrade.*resumo" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `result.resumo` undefined.

- [ ] **Step 3: Atualizar tipo `FvsGrade` em `fvs.types.ts`**

Substituir a interface `FvsGrade` existente por:

```typescript
export interface FvsGrade {
  servicos: { id: number; nome: string; codigo?: string }[];
  locais: {
    id: number;
    nome: string;
    pavimento_id: number | null;
    pavimento_nome: string | null;
    ordem: number;
  }[];
  celulas: Record<number, Record<number, StatusGrade>>;
  celulas_meta?: Record<number, Record<number, {
    itens_total: number;
    itens_avaliados: number;
    itens_nc: number;
    ultimo_inspetor?: string;
    ultima_atividade?: string;
  }>>;
  resumo: {
    total_celulas: number;
    aprovadas: number;
    nc: number;
    nc_final: number;
    liberadas: number;
    parciais: number;
    nao_avaliadas: number;
    pendentes: number;
    progresso_pct: number;
  };
}
```

- [ ] **Step 4: Atualizar `getGrade` no service**

Localizar o método `getGrade` (linha ~508) e substituir o trecho que constrói o retorno. A query de registros já traz `servico_id`, `obra_local_id`, `status`. Precisamos adicionar `itens_total`, `itens_avaliados`, `itens_nc`, `ultimo_inspetor`, `ultima_atividade` para `celulas_meta`.

Substituir o método completo:

```typescript
async getGrade(
  tenantId: number,
  fichaId: number,
  filtros?: { pavimentoId?: number; servicoId?: number; includeMeta?: boolean },
): Promise<FvsGrade> {
  await this.getFichaOuFalhar(tenantId, fichaId);

  // Locais
  const locaisParams: unknown[] = [fichaId, tenantId];
  let locaisWhere = '';
  if (filtros?.pavimentoId) {
    locaisParams.push(filtros.pavimentoId);
    locaisWhere = `AND ol."parentId" = $${locaisParams.length}`;
  }

  const locais = await this.prisma.$queryRawUnsafe<{
    id: number; nome: string; pavimento_id: number | null; pavimento_nome: string | null; ordem: number;
  }[]>(
    `SELECT DISTINCT ol.id, ol.nome,
            ol."parentId" AS pavimento_id,
            pav.nome      AS pavimento_nome,
            COALESCE(ol.ordem, 0) AS ordem
     FROM fvs_ficha_servico_locais fsl
     JOIN fvs_ficha_servicos fs ON fs.id = fsl.ficha_servico_id AND fs.ficha_id = $1 AND fs.tenant_id = $2
     JOIN obra_locais ol ON ol.id = fsl.obra_local_id
     LEFT JOIN obra_locais pav ON pav.id = ol."parentId"
     WHERE 1=1 ${locaisWhere}
     ORDER BY pav.nome NULLS FIRST, ol.nome`,
    ...locaisParams,
  );

  // Serviços
  const servicosParams: unknown[] = [fichaId, tenantId];
  let servicosWhere = '';
  if (filtros?.servicoId) {
    servicosParams.push(filtros.servicoId);
    servicosWhere = `AND s.id = $${servicosParams.length}`;
  }

  const servicos = await this.prisma.$queryRawUnsafe<{ id: number; nome: string; codigo: string | null }[]>(
    `SELECT DISTINCT s.id, s.nome, s.codigo
     FROM fvs_ficha_servicos fs
     JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
     WHERE fs.ficha_id = $1 AND fs.tenant_id = $2 ${servicosWhere}
     ORDER BY s.nome`,
    ...servicosParams,
  );

  if (!servicos.length || !locais.length) {
    return {
      servicos, locais,
      celulas: {},
      resumo: { total_celulas: 0, aprovadas: 0, nc: 0, nc_final: 0, liberadas: 0, parciais: 0, nao_avaliadas: 0, pendentes: 0, progresso_pct: 0 },
    };
  }

  // Registros por célula (status mais recente por item+local)
  type RegRow = {
    servico_id: number; obra_local_id: number; status: string;
    itens_total: number; itens_avaliados: number; itens_nc: number;
    ultimo_inspetor: string | null; ultima_atividade: string | null;
  };

  const servicoIds = servicos.map(s => s.id);
  const localIds = locais.map(l => l.id);

  const registros = await this.prisma.$queryRawUnsafe<RegRow[]>(
    `SELECT
       r.servico_id,
       r.obra_local_id,
       r.status,
       COUNT(*) OVER (PARTITION BY r.servico_id, r.obra_local_id)::int                           AS itens_total,
       COUNT(*) FILTER (WHERE r.status <> 'nao_avaliado') OVER (PARTITION BY r.servico_id, r.obra_local_id)::int AS itens_avaliados,
       COUNT(*) FILTER (WHERE r.status = 'nao_conforme') OVER (PARTITION BY r.servico_id, r.obra_local_id)::int  AS itens_nc,
       u.nome AS ultimo_inspetor,
       r.inspecionado_em::text AS ultima_atividade
     FROM (
       SELECT DISTINCT ON (item_id, obra_local_id, servico_id)
              item_id, obra_local_id, servico_id, status, inspecionado_por, inspecionado_em
       FROM fvs_registros
       WHERE ficha_id = $1 AND tenant_id = $2
         AND servico_id = ANY($3::int[]) AND obra_local_id = ANY($4::int[])
       ORDER BY item_id, obra_local_id, servico_id, ciclo DESC
     ) r
     LEFT JOIN "Usuario" u ON u.id = r.inspecionado_por`,
    fichaId, tenantId, servicoIds, localIds,
  );

  // Construir celulas e celulas_meta
  const gruposCelula: Record<number, Record<number, string[]>> = {};
  const metaMap: Record<number, Record<number, RegRow>> = {};

  for (const srv of servicos) {
    gruposCelula[srv.id] = {};
    if (filtros?.includeMeta) metaMap[srv.id] = {};
    for (const loc of locais) {
      gruposCelula[srv.id][loc.id] = [];
    }
  }

  for (const r of registros) {
    gruposCelula[r.servico_id]?.[r.obra_local_id]?.push(r.status);
    if (filtros?.includeMeta) {
      metaMap[r.servico_id] ??= {};
      metaMap[r.servico_id][r.obra_local_id] = r;
    }
  }

  const celulas: Record<number, Record<number, StatusGrade>> = {};
  for (const srv of servicos) {
    celulas[srv.id] = {};
    for (const loc of locais) {
      celulas[srv.id][loc.id] = this.calcularStatusCelula(gruposCelula[srv.id]?.[loc.id] ?? []);
    }
  }

  // Resumo
  const resumo = { total_celulas: 0, aprovadas: 0, nc: 0, nc_final: 0, liberadas: 0, parciais: 0, nao_avaliadas: 0, pendentes: 0, progresso_pct: 0 };
  for (const srvCelulas of Object.values(celulas)) {
    for (const status of Object.values(srvCelulas)) {
      resumo.total_celulas++;
      if (status === 'aprovado') resumo.aprovadas++;
      else if (status === 'nc') resumo.nc++;
      else if (status === 'nc_final') resumo.nc_final++;
      else if (status === 'liberado') resumo.liberadas++;
      else if (status === 'parcial') resumo.parciais++;
      else if (status === 'nao_avaliado') resumo.nao_avaliadas++;
      else resumo.pendentes++;
    }
  }
  resumo.progresso_pct = resumo.total_celulas
    ? Math.round((resumo.aprovadas / resumo.total_celulas) * 100 * 10) / 10
    : 0;

  const result: FvsGrade = { servicos, locais, celulas, resumo };
  if (filtros?.includeMeta) {
    result.celulas_meta = {};
    for (const srv of servicos) {
      result.celulas_meta[srv.id] = {};
      for (const loc of locais) {
        const meta = metaMap[srv.id]?.[loc.id];
        if (meta) {
          result.celulas_meta[srv.id][loc.id] = {
            itens_total: meta.itens_total,
            itens_avaliados: meta.itens_avaliados,
            itens_nc: meta.itens_nc,
            ultimo_inspetor: meta.ultimo_inspetor ?? undefined,
            ultima_atividade: meta.ultima_atividade ?? undefined,
          };
        }
      }
    }
  }

  return result;
}
```

- [ ] **Step 5: Rodar testes**

```bash
cd backend && npx jest inspecao.service.spec.ts -t "getGrade" --no-coverage 2>&1 | tail -20
```

Expected: PASS.

- [ ] **Step 6: Build**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS"
```

Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add backend/src/fvs/types/fvs.types.ts backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.service.spec.ts
git commit -m "feat(fvs): getGrade — resumo + celulas_meta + pavimento_nome"
```

---

## Task 2: Backend — endpoint de preview (drawer lateral)

**Files:**
- Modify: `backend/src/fvs/inspecao/inspecao.service.ts`
- Modify: `backend/src/fvs/inspecao/inspecao.controller.ts`

- [ ] **Step 1: Implementar `getGradePreview` no service**

Adicionar após `getGrade`:

```typescript
async getGradePreview(
  tenantId: number,
  fichaId: number,
  localId: number,
  servicoId: number,
): Promise<{
  servico_nome: string;
  local_nome: string;
  status_geral: StatusGrade;
  inspetor_nome: string | null;
  ultima_atividade: string | null;
  itens: {
    id: number;
    descricao: string;
    criterio_aceite: string | null;
    criticidade: string;
    status: string;
    observacao: string | null;
  }[];
}> {
  await this.getFichaOuFalhar(tenantId, fichaId);

  const rows = await this.prisma.$queryRawUnsafe<{
    item_id: number;
    descricao: string;
    criterio_aceite: string | null;
    criticidade: string;
    status: string;
    observacao: string | null;
    servico_nome: string;
    local_nome: string;
    inspetor_nome: string | null;
    inspecionado_em: string | null;
  }[]>(
    `SELECT
       i.id          AS item_id,
       i.descricao,
       i.criterio_aceite,
       i.criticidade,
       COALESCE(r.status, 'nao_avaliado') AS status,
       r.observacao,
       s.nome  AS servico_nome,
       ol.nome AS local_nome,
       u.nome  AS inspetor_nome,
       r.inspecionado_em::text AS inspecionado_em
     FROM fvs_catalogo_itens i
     JOIN fvs_ficha_servicos fs
       ON fs.servico_id = $2 AND fs.ficha_id = $1 AND fs.tenant_id = $3
     JOIN fvs_catalogo_servicos s ON s.id = $2
     JOIN obra_locais ol ON ol.id = $4
     LEFT JOIN LATERAL (
       SELECT status, observacao, inspecionado_por, inspecionado_em
       FROM fvs_registros r2
       WHERE r2.item_id = i.id AND r2.ficha_id = $1 AND r2.obra_local_id = $4 AND r2.tenant_id = $3
       ORDER BY r2.ciclo DESC LIMIT 1
     ) r ON true
     LEFT JOIN "Usuario" u ON u.id = r.inspecionado_por
     WHERE i.servico_id = $2 AND i.tenant_id IN (0, $3) AND i.ativo = true
       AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))
     ORDER BY i.ordem ASC`,
    fichaId, servicoId, tenantId, localId,
  );

  if (!rows.length) throw new NotFoundException(`Serviço ${servicoId} não encontrado na ficha`);

  const statusGeral = this.calcularStatusCelula(rows.map(r => r.status));
  const ultima = rows.filter(r => r.inspecionado_em).sort((a, b) => (b.inspecionado_em ?? '') > (a.inspecionado_em ?? '') ? 1 : -1)[0];

  return {
    servico_nome: rows[0].servico_nome,
    local_nome: rows[0].local_nome,
    status_geral: statusGeral,
    inspetor_nome: ultima?.inspetor_nome ?? null,
    ultima_atividade: ultima?.inspecionado_em ?? null,
    itens: rows.map(r => ({
      id: r.item_id,
      descricao: r.descricao,
      criterio_aceite: r.criterio_aceite,
      criticidade: r.criticidade,
      status: r.status,
      observacao: r.observacao,
    })),
  };
}
```

- [ ] **Step 2: Adicionar rota no controller**

```typescript
@Get('fichas/:fichaId/locais/:localId/servico/:servicoId/preview')
@Roles('ADMIN_TENANT', 'ENGENHEIRO', 'TECNICO', 'VISITANTE')
getGradePreview(
  @TenantId() tenantId: number,
  @Param('fichaId', ParseIntPipe) fichaId: number,
  @Param('localId', ParseIntPipe) localId: number,
  @Param('servicoId', ParseIntPipe) servicoId: number,
) {
  return this.inspecao.getGradePreview(tenantId, fichaId, localId, servicoId);
}
```

- [ ] **Step 3: Build e commit**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS"
```

Expected: sem erros.

```bash
git add backend/src/fvs/inspecao/inspecao.service.ts backend/src/fvs/inspecao/inspecao.controller.ts
git commit -m "feat(fvs): getGradePreview — GET fichas/:id/locais/:id/servico/:id/preview"
```

---

## Task 3: Frontend — atualizar tipos e service

**Files:**
- Modify: `frontend-web/src/services/fvs.service.ts`

- [ ] **Step 1: Atualizar `StatusGrade` e `FvsGrade` no service frontend**

Localizar e substituir as declarações de tipo em `fvs.service.ts`:

```typescript
// Substituir:
export type StatusGrade = 'nao_avaliado' | 'aprovado' | 'nc' | 'pendente';

// Por:
export type StatusGrade =
  | 'nao_avaliado'
  | 'parcial'
  | 'aprovado'
  | 'nc'
  | 'nc_final'
  | 'liberado'
  | 'pendente';

// Substituir a interface FvsGrade:
export interface FvsGrade {
  servicos: { id: number; nome: string; codigo?: string }[];
  locais: {
    id: number;
    nome: string;
    pavimento_id: number | null;
    pavimento_nome: string | null;
    ordem: number;
  }[];
  celulas: Record<number, Record<number, StatusGrade>>;
  celulas_meta?: Record<number, Record<number, {
    itens_total: number;
    itens_avaliados: number;
    itens_nc: number;
    ultimo_inspetor?: string;
    ultima_atividade?: string;
  }>>;
  resumo: {
    total_celulas: number;
    aprovadas: number;
    nc: number;
    nc_final: number;
    liberadas: number;
    parciais: number;
    nao_avaliadas: number;
    pendentes: number;
    progresso_pct: number;
  };
}
```

- [ ] **Step 2: Adicionar tipos de preview e método `getGradePreview`**

Adicionar após os tipos existentes:

```typescript
export interface GradePreview {
  servico_nome: string;
  local_nome: string;
  status_geral: StatusGrade;
  inspetor_nome: string | null;
  ultima_atividade: string | null;
  itens: {
    id: number;
    descricao: string;
    criterio_aceite: string | null;
    criticidade: string;
    status: string;
    observacao: string | null;
  }[];
}
```

No objeto `fvsService`, adicionar após `getGrade`:

```typescript
async getGradePreview(fichaId: number, localId: number, servicoId: number): Promise<GradePreview> {
  const { data } = await api.get<{ data: GradePreview }>(
    `/fvs/fichas/${fichaId}/locais/${localId}/servico/${servicoId}/preview`,
  );
  return data.data;
},

async bulkInspecaoLocais(
  fichaId: number,
  payload: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string },
): Promise<{ processados: number; ignorados: number; erros: number }> {
  const { data } = await api.post<{ data: { processados: number; ignorados: number; erros: number } }>(
    `/fvs/fichas/${fichaId}/registros/bulk`,
    payload,
  );
  return data.data;
},
```

- [ ] **Step 3: Verificar compilação TypeScript**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | grep -E "error" | head -20
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend-web/src/services/fvs.service.ts
git commit -m "feat(fvs): frontend — atualizar tipos StatusGrade (7 valores), FvsGrade com resumo, GradePreview"
```

---

## Task 4: Frontend — hooks `useGradePreview` e `useBulkInspecao`

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts`

- [ ] **Step 1: Atualizar `useGrade.ts`**

Verificar o conteúdo atual:

```bash
cat "frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts"
```

Garantir que o hook `useGrade` repassa `includeMeta` e adicionar `useGradePreview` e `useBulkInspecao`:

```typescript
// frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fvsService } from '../../../../services/fvs.service';

export function useGrade(fichaId: number, params?: { pavimentoId?: number; servicoId?: number }) {
  return useQuery({
    queryKey: ['fvs-grade', fichaId, params],
    queryFn: () => fvsService.getGrade(fichaId, params),
    enabled: !!fichaId,
  });
}

export function useGradePreview(fichaId: number, localId: number | null, servicoId: number | null) {
  return useQuery({
    queryKey: ['fvs-grade-preview', fichaId, localId, servicoId],
    queryFn: () => fvsService.getGradePreview(fichaId, localId!, servicoId!),
    enabled: !!fichaId && localId !== null && servicoId !== null,
  });
}

export function useBulkInspecao(fichaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string }) =>
      fvsService.bulkInspecaoLocais(fichaId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvs-grade', fichaId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/hooks/useGrade.ts
git commit -m "feat(fvs): hooks useGradePreview e useBulkInspecao"
```

---

## Task 5: Frontend — `GradeDrawer` component

**Files:**
- Create: `frontend-web/src/modules/fvs/inspecao/components/GradeDrawer.tsx`

- [ ] **Step 1: Criar `GradeDrawer.tsx`**

```tsx
// frontend-web/src/modules/fvs/inspecao/components/GradeDrawer.tsx
import { useNavigate } from 'react-router-dom';
import { useGradePreview } from '../hooks/useGrade';
import { cn } from '@/lib/cn';
import { X, ArrowRight } from 'lucide-react';

interface GradeDrawerProps {
  fichaId: number;
  localId: number;
  servicoId: number;
  onClose: () => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  conforme:                 { label: 'CONF.', cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  nao_conforme:             { label: 'N.CONF.', cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  excecao:                  { label: 'EXCEP.', cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  nao_avaliado:             { label: 'N.AVAL.', cls: 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]' },
  conforme_apos_reinspecao: { label: 'RE.CONF.', cls: 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]' },
  nc_apos_reinspecao:       { label: 'NC.FINAL', cls: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]' },
  liberado_com_concessao:   { label: 'LIBERAL.', cls: 'bg-yellow-50 text-yellow-800 border border-yellow-200' },
  retrabalho:               { label: 'RETRAB.', cls: 'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]' },
};

const CRIT_CLS: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

export function GradeDrawer({ fichaId, localId, servicoId, onClose }: GradeDrawerProps) {
  const navigate = useNavigate();
  const { data: preview, isLoading } = useGradePreview(fichaId, localId, servicoId);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--bg-base)] border-l border-[var(--border-dim)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div>
            {isLoading ? (
              <div className="h-5 w-40 bg-[var(--bg-raised)] rounded animate-pulse" />
            ) : (
              <>
                <h3 className="text-sm font-semibold text-[var(--text-high)] m-0">
                  {preview?.servico_nome}
                </h3>
                <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                  {preview?.local_nome}
                  {preview?.inspetor_nome && ` · ${preview.inspetor_nome}`}
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors ml-4 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-5 flex flex-col gap-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-10 bg-[var(--bg-raised)] rounded animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && preview && (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-6">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide">Item de Verificação</th>
                  <th className="text-center px-3 py-2 font-semibold text-[var(--text-faint)] uppercase tracking-wide w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.itens.map((item, idx) => {
                  const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.nao_avaliado;
                  const critCls = CRIT_CLS[item.criticidade] ?? CRIT_CLS.menor;
                  return (
                    <tr key={item.id} className={cn(
                      'border-b border-[var(--border-dim)] last:border-0',
                      idx % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                    )}>
                      <td className="px-4 py-2.5 text-[var(--text-faint)] font-mono">{idx + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', critCls)}>
                            {item.criticidade.slice(0, 3).toUpperCase()}
                          </span>
                          <span className="text-[var(--text-high)]">{item.descricao}</span>
                        </div>
                        {item.observacao && (
                          <p className="text-[var(--text-faint)] mt-0.5 italic pl-5">{item.observacao}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', badge.cls)}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-dim)] px-5 py-3">
          <button
            onClick={() => {
              navigate(`/fvs/fichas/${fichaId}/inspecao?servicoId=${servicoId}&localId=${localId}`);
              onClose();
            }}
            className="flex items-center gap-2 w-full justify-center px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Ir para inspeção completa <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/components/GradeDrawer.tsx
git commit -m "feat(fvs): GradeDrawer — drawer lateral de preview com itens do local"
```

---

## Task 6: Frontend — `FichaGradePage` completo

**Files:**
- Modify: `frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx`

- [ ] **Step 1: Substituir `FichaGradePage.tsx` completo**

```tsx
// frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFicha, usePatchFicha } from '../hooks/useFichas';
import { useGrade, useBulkInspecao } from '../hooks/useGrade';
import { useSolicitarParecer } from '../hooks/useRo';
import { RoPanel } from '../components/RoPanel';
import { ParecerModal } from '../components/ParecerModal';
import { GradeDrawer } from '../components/GradeDrawer';
import type { StatusGrade } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { ArrowLeft, X, CheckSquare } from 'lucide-react';

// ── Configurações visuais ─────────────────────────────────────────────────────

const CELL_CLS: Record<StatusGrade, string> = {
  nc:           'bg-[var(--nc-text)] text-white',
  nc_final:     'bg-red-900 text-white',
  aprovado:     'bg-[var(--ok-text)] text-white',
  liberado:     'bg-yellow-400 text-yellow-900',
  pendente:     'bg-[var(--warn-text)] text-white',
  parcial:      'bg-blue-300 text-blue-900',
  nao_avaliado: 'bg-[var(--border-dim)] text-[var(--text-faint)]',
};

const CELL_ICON: Record<StatusGrade, string> = {
  nc:           '✗',
  nc_final:     '🔒',
  aprovado:     '✓',
  liberado:     '⚡',
  pendente:     '!',
  parcial:      '◐',
  nao_avaliado: '—',
};

const LEGEND: { status: StatusGrade; label: string }[] = [
  { status: 'aprovado',     label: 'Aprovado' },
  { status: 'nc',           label: 'NC' },
  { status: 'nc_final',     label: 'NC Final' },
  { status: 'liberado',     label: 'Liberado c/ Concessão' },
  { status: 'pendente',     label: 'Pendente' },
  { status: 'parcial',      label: 'Parcial' },
  { status: 'nao_avaliado', label: 'Não Avaliado' },
];

// ── Componente principal ──────────────────────────────────────────────────────

export function FichaGradePage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: ficha } = useFicha(id);
  const { data: grade, isLoading } = useGrade(id);
  const patchFicha    = usePatchFicha(id);
  const solicitarParecer = useSolicitarParecer(id);
  const bulk = useBulkInspecao(id);

  // ── Estado local ───────────────────────────────────────────────────────────
  const [confirmando, setConfirmando] = useState<'iniciar' | 'concluir' | null>(null);
  const [erroConcluso, setErroConcluso] = useState<{ message: string; itensPendentes?: any[] } | null>(null);
  const [showParecer, setShowParecer] = useState(false);
  const [erroSolicitacao, setErroSolicitacao] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ localId: number; servicoId: number } | null>(null);
  const [selecionados, setSelecionados] = useState<{ servicoId: number; localId: number }[]>([]);
  const [bulkErro, setBulkErro] = useState<string | null>(null);

  // ── Filtros (URL-synced) ───────────────────────────────────────────────────
  const filtroPavimento = searchParams.get('pavimento') ? Number(searchParams.get('pavimento')) : null;
  const filtroServico   = searchParams.get('servico')   ? Number(searchParams.get('servico'))   : null;
  const filtroStatus    = searchParams.get('status') as StatusGrade | null;

  function setFiltro(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
    setSelecionados([]);
  }

  // ── Dados filtrados (client-side) ─────────────────────────────────────────
  const locaisFiltrados = useMemo(() => {
    if (!grade) return [];
    let locs = grade.locais;
    if (filtroPavimento) locs = locs.filter(l => l.pavimento_id === filtroPavimento);
    return locs;
  }, [grade, filtroPavimento]);

  const servicosFiltrados = useMemo(() => {
    if (!grade) return [];
    let srvs = grade.servicos;
    if (filtroServico) srvs = srvs.filter(s => s.id === filtroServico);
    return srvs;
  }, [grade, filtroServico]);

  const pavimentos = useMemo(() => {
    if (!grade) return [];
    const seen = new Map<number, string>();
    grade.locais.forEach(l => { if (l.pavimento_id) seen.set(l.pavimento_id, l.pavimento_nome ?? `Pav. ${l.pavimento_id}`); });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [grade]);

  function isCelulaVisivel(srvId: number, locId: number): boolean {
    if (!filtroStatus) return true;
    const status = grade?.celulas[srvId]?.[locId] ?? 'nao_avaliado';
    return status === filtroStatus;
  }

  function isLocalVisivel(locId: number): boolean {
    if (!filtroStatus || !grade) return true;
    return servicosFiltrados.some(srv => (grade.celulas[srv.id]?.[locId] ?? 'nao_avaliado') === filtroStatus);
  }

  const locaisVisiveis = useMemo(
    () => locaisFiltrados.filter(l => isLocalVisivel(l.id)),
    [locaisFiltrados, filtroStatus, servicosFiltrados, grade],
  );

  // ── Grupos por pavimento (para cabeçalho agrupado) ────────────────────────
  const gruposPavimento = useMemo(() => {
    const grupos: { pavNome: string | null; locais: typeof locaisVisiveis }[] = [];
    for (const loc of locaisVisiveis) {
      const last = grupos[grupos.length - 1];
      if (!last || last.pavNome !== loc.pavimento_nome) {
        grupos.push({ pavNome: loc.pavimento_nome, locais: [loc] });
      } else {
        last.locais.push(loc);
      }
    }
    return grupos;
  }, [locaisVisiveis]);

  const temAgrupamento = gruposPavimento.length > 1 || !!gruposPavimento[0]?.pavNome;

  // ── Seleção ────────────────────────────────────────────────────────────────
  function toggleLocalSelecionado(localId: number) {
    const células = servicosFiltrados.map(s => ({ servicoId: s.id, localId }));
    const todasSelecionadas = células.every(c => selecionados.some(s => s.servicoId === c.servicoId && s.localId === c.localId));
    if (todasSelecionadas) {
      setSelecionados(prev => prev.filter(s => s.localId !== localId));
    } else {
      setSelecionados(prev => {
        const filtered = prev.filter(s => s.localId !== localId);
        return [...filtered, ...células];
      });
    }
  }

  function toggleServicoSelecionado(servicoId: number) {
    const células = locaisVisiveis.map(l => ({ servicoId, localId: l.id }));
    const todasSelecionadas = células.every(c => selecionados.some(s => s.servicoId === c.servicoId && s.localId === c.localId));
    if (todasSelecionadas) {
      setSelecionados(prev => prev.filter(s => s.servicoId !== servicoId));
    } else {
      setSelecionados(prev => {
        const filtered = prev.filter(s => s.servicoId !== servicoId);
        return [...filtered, ...células];
      });
    }
  }

  async function handleBulk(status: 'conforme' | 'excecao') {
    setBulkErro(null);
    const porServico = new Map<number, number[]>();
    selecionados.forEach(({ servicoId, localId }) => {
      if (!porServico.has(servicoId)) porServico.set(servicoId, []);
      porServico.get(servicoId)!.push(localId);
    });
    try {
      for (const [servicoId, localIds] of porServico) {
        await bulk.mutateAsync({ servicoId, localIds, status });
      }
      setSelecionados([]);
    } catch (e: any) {
      setBulkErro(e?.response?.data?.message ?? 'Erro ao inspecionar em massa');
    }
  }

  // ── Status change ──────────────────────────────────────────────────────────
  async function handleStatusChange(novoStatus: 'em_inspecao' | 'concluida') {
    setErroConcluso(null);
    try {
      await patchFicha.mutateAsync({ status: novoStatus });
      setConfirmando(null);
    } catch (e: any) {
      const data = e?.response?.data;
      setErroConcluso({ message: data?.message ?? 'Erro ao alterar status', itensPendentes: data?.itensPendentes });
    }
  }

  async function handleSolicitarParecer() {
    setErroSolicitacao(null);
    try { await solicitarParecer.mutateAsync(); }
    catch (e: any) { setErroSolicitacao(e?.response?.data?.message ?? 'Erro ao solicitar parecer.'); }
  }

  const canClick  = ficha?.status === 'em_inspecao';
  const canSelect = ficha?.status === 'em_inspecao' && !filtroStatus;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading || !grade || !ficha) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  const progresso = grade.resumo.progresso_pct;

  return (
    <div className="p-6">
      {/* Cabeçalho + Progresso */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate('/fvs/fichas')}
          className="mt-0.5 p-1.5 rounded-md text-[var(--text-faint)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-high)] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-[var(--text-high)] m-0 mb-0.5">{ficha.nome}</h2>
          <p className="text-xs text-[var(--text-faint)] m-0">
            {ficha.regime.toUpperCase()} · {ficha.status.replace(/_/g, ' ')}
          </p>
          {/* Barra de progresso */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2 bg-[var(--border-dim)] rounded-full overflow-hidden max-w-xs">
              <div
                className="h-full bg-[var(--ok-text)] rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-faint)] font-mono">
              {progresso}% aprovadas ({grade.resumo.aprovadas}/{grade.resumo.total_celulas})
            </span>
          </div>
        </div>
      </div>

      {/* Ações de ciclo */}
      <div className="flex gap-2 flex-wrap items-center mb-4">
        {ficha.status === 'rascunho' && (
          <button onClick={() => setConfirmando('iniciar')} className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity">
            Iniciar Inspeção
          </button>
        )}
        {ficha.status === 'em_inspecao' && (
          <button onClick={() => setConfirmando('concluir')} className="px-4 py-2 text-sm rounded-md bg-[var(--ok-text)] text-white font-medium hover:opacity-90 transition-opacity">
            Concluir Ficha
          </button>
        )}
        {ficha.status === 'concluida' && (
          <button onClick={handleSolicitarParecer} disabled={solicitarParecer.isPending} className="px-4 py-2 text-sm rounded-md bg-[var(--warn-text)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
            {solicitarParecer.isPending ? 'Solicitando...' : 'Solicitar Parecer'}
          </button>
        )}
        {ficha.status === 'aguardando_parecer' && (
          <button onClick={() => setShowParecer(true)} className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white font-medium hover:opacity-90 transition-opacity">
            Emitir Parecer
          </button>
        )}
        {ficha.status === 'aprovada' && (
          <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]">
            ✓ Ficha Aprovada
          </span>
        )}
      </div>

      {erroSolicitacao && (
        <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">{erroSolicitacao}</p>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)]">
        <select
          value={filtroPavimento ?? ''}
          onChange={e => setFiltro('pavimento', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Pavimentos</option>
          {pavimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>

        <select
          value={filtroServico ?? ''}
          onChange={e => setFiltro('servico', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Serviços</option>
          {grade.servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>

        <select
          value={filtroStatus ?? ''}
          onChange={e => setFiltro('status', e.target.value || null)}
          className="px-2 py-1.5 text-xs rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Todos os Status</option>
          {LEGEND.map(l => <option key={l.status} value={l.status}>{l.label}</option>)}
        </select>

        {(filtroPavimento || filtroServico || filtroStatus) && (
          <button
            onClick={() => { setFiltro('pavimento', null); setFiltro('servico', null); setFiltro('status', null); }}
            className="px-2 py-1.5 text-xs rounded-md text-[var(--text-faint)] hover:text-[var(--text-high)] border border-[var(--border-dim)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Grade */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-auto mb-4">
        <table className="border-collapse text-sm">
          <thead>
            {temAgrupamento && (
              <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                <th />
                {gruposPavimento.map((grupo, gi) => (
                  <th
                    key={gi}
                    colSpan={grupo.locais.length}
                    className="text-center px-3 py-1.5 text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-widest border-l border-[var(--border-dim)] first:border-l-0"
                  >
                    {grupo.pavNome ?? 'Sem Pavimento'}
                  </th>
                ))}
              </tr>
            )}
            <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
              <th className="text-left px-4 py-2.5 min-w-[200px] text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">
                Serviço
              </th>
              {locaisVisiveis.map(loc => (
                <th
                  key={loc.id}
                  onClick={() => canSelect && toggleLocalSelecionado(loc.id)}
                  className={cn(
                    'px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis',
                    canSelect ? 'cursor-pointer hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] transition-colors' : '',
                    selecionados.some(s => s.localId === loc.id) ? 'text-[var(--accent)] bg-[var(--accent-subtle,#eff6ff)]' : '',
                  )}
                >
                  {loc.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {servicosFiltrados.map((srv, i) => (
              <tr
                key={srv.id}
                className={cn('border-b border-[var(--border-dim)] last:border-0', i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]')}
              >
                <td
                  onClick={() => canSelect && toggleServicoSelecionado(srv.id)}
                  className={cn(
                    'px-4 py-2.5 font-medium',
                    canSelect ? 'cursor-pointer hover:text-[var(--accent)] transition-colors' : '',
                    selecionados.some(s => s.servicoId === srv.id) ? 'text-[var(--accent)]' : 'text-[var(--text-high)]',
                  )}
                >
                  {srv.nome}
                </td>
                {locaisVisiveis.map(loc => {
                  const status: StatusGrade = grade.celulas[srv.id]?.[loc.id] ?? 'nao_avaliado';
                  if (!isCelulaVisivel(srv.id, loc.id)) {
                    return <td key={loc.id} className="px-3 py-2 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-md opacity-10 bg-[var(--border-dim)]">—</span></td>;
                  }
                  const isSelected = selecionados.some(s => s.servicoId === srv.id && s.localId === loc.id);
                  return (
                    <td key={loc.id} className="px-3 py-2 text-center">
                      <span
                        onClick={() => {
                          if (canSelect) {
                            setSelecionados(prev => {
                              const idx = prev.findIndex(s => s.servicoId === srv.id && s.localId === loc.id);
                              return idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, { servicoId: srv.id, localId: loc.id }];
                            });
                          } else if (status !== 'nao_avaliado') {
                            setDrawer({ localId: loc.id, servicoId: srv.id });
                          } else if (canClick) {
                            navigate(`/fvs/fichas/${id}/inspecao?servicoId=${srv.id}&localId=${loc.id}`);
                          }
                        }}
                        title={`${srv.nome} — ${loc.nome}: ${status}`}
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold transition-all',
                          CELL_CLS[status],
                          (canClick || status !== 'nao_avaliado') ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                          ficha.status === 'rascunho' ? 'opacity-40' : '',
                          isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-1' : '',
                        )}
                      >
                        {CELL_ICON[status]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 mb-6">
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
            <span className={cn('w-3 h-3 rounded-sm inline-block', CELL_CLS[status])} />
            {label}
          </span>
        ))}
      </div>

      {(ficha.status === 'concluida' || ficha.status === 'aguardando_parecer') && (
        <RoPanel fichaId={id} regime={ficha.regime} />
      )}

      {/* Barra flutuante de seleção em massa */}
      {selecionados.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--border-dim)] shadow-2xl">
          <CheckSquare size={14} className="text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-high)]">{selecionados.length} célula{selecionados.length !== 1 ? 's' : ''} selecionada{selecionados.length !== 1 ? 's' : ''}</span>
          <div className="w-px h-4 bg-[var(--border-dim)] mx-1" />
          <button
            onClick={() => handleBulk('conforme')}
            disabled={bulk.isPending}
            className="px-3 py-1 text-xs rounded-md bg-[var(--ok-text)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            ✓ Marcar Conforme
          </button>
          <button
            onClick={() => handleBulk('excecao')}
            disabled={bulk.isPending}
            className="px-3 py-1 text-xs rounded-md bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-mid)] font-medium hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
          >
            Marcar Exceção
          </button>
          <button onClick={() => setSelecionados([])} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors ml-1">
            <X size={14} />
          </button>
        </div>
      )}

      {bulkErro && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg bg-[var(--nc-bg)] border border-[var(--nc-border)] text-xs text-[var(--nc-text)] shadow-lg">
          {bulkErro}
          <button onClick={() => setBulkErro(null)} className="ml-2 underline">fechar</button>
        </div>
      )}

      {/* Modal confirmar ação de status */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setConfirmando(null); setErroConcluso(null); }} />
          <div className="relative z-10 w-full max-w-sm bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-xl p-6">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-[var(--text-high)] m-0">
                {confirmando === 'iniciar' ? 'Iniciar Inspeção?' : 'Concluir Ficha?'}
              </h3>
              <button onClick={() => { setConfirmando(null); setErroConcluso(null); }} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors ml-4">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[var(--text-faint)] mb-4">
              {confirmando === 'iniciar'
                ? 'A ficha passará para o status "Em Inspeção" e os registros poderão ser gravados.'
                : ficha.regime === 'pbqph'
                  ? 'Itens críticos NC sem evidência fotográfica serão verificados antes de concluir.'
                  : 'A ficha será marcada como concluída.'}
            </p>
            {erroConcluso && (
              <div className="px-3 py-2.5 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">
                <p className="text-sm text-[var(--nc-text)] font-semibold m-0">{erroConcluso.message}</p>
                {erroConcluso.itensPendentes?.map((ip: any) => (
                  <p key={ip.item_id} className="text-xs text-[var(--nc-text)] m-0 mt-1">• {ip.descricao}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirmando(null); setErroConcluso(null); }}
                className="px-4 py-1.5 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleStatusChange(confirmando === 'iniciar' ? 'em_inspecao' : 'concluida')}
                disabled={patchFicha.isPending}
                className="px-4 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {patchFicha.isPending ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showParecer && (
        <ParecerModal
          fichaId={id}
          regime={ficha.regime}
          grade={grade}
          onClose={() => setShowParecer(false)}
          onSuccess={() => setShowParecer(false)}
        />
      )}

      {drawer && (
        <GradeDrawer
          fichaId={id}
          localId={drawer.localId}
          servicoId={drawer.servicoId}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

```bash
cd frontend-web && npx tsc --noEmit 2>&1 | grep -E "error" | head -20
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
git commit -m "feat(fvs): FichaGradePage — progresso, filtros, drawer, bulk, agrupamento por pavimento"
```

---

## Task 7: Build, smoke test visual e validação final

- [ ] **Step 1: Build backend**

```bash
cd backend && npm run build 2>&1 | grep -E "error TS"
kill $(lsof -ti :3000) 2>/dev/null; sleep 1
node dist/src/main.js > /tmp/eldox-backend.log 2>&1 &
sleep 3 && echo "backend ok"
```

- [ ] **Step 2: Iniciar frontend**

```bash
cd frontend-web && npm run dev 2>&1 &
sleep 5 && echo "frontend ok"
```

- [ ] **Step 3: Verificar grade com resumo (endpoint)**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test@123"}' | jq -r '.data.token')

curl -s "http://localhost:3000/api/v1/fvs/fichas/10/grade" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.resumo'
# Expected: { total_celulas: N, aprovadas: N, progresso_pct: N, ... }
```

- [ ] **Step 4: Verificar preview endpoint**

```bash
# Substituir 1 e 2 por ids reais de local/servico existentes na ficha 10
curl -s "http://localhost:3000/api/v1/fvs/fichas/10/locais/1/servico/1/preview" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.status_geral'
# Expected: "nao_avaliado" ou "aprovado" etc.
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(fvs): sprint 5 — grade visual completa

- getGrade com resumo (progresso_pct, contadores por status) e celulas_meta
- endpoint preview GET fichas/:id/locais/:id/servico/:id/preview
- FichaGradePage: barra de progresso, filtros client-side, drawer lateral, seleção em massa, agrupamento por pavimento
- GradeDrawer component
- useBulkInspecao e useGradePreview hooks"
```

---

## Critérios de Aceite

| CA | Verificação |
|----|------------|
| CA-01 | Barra de progresso exibe % correto (aprovadas/total) |
| CA-02 | Filtro de pavimento atualiza colunas sem reload |
| CA-03 | Filtro de serviço atualiza linhas sem reload |
| CA-04 | Filtro de status oculta células de outros status |
| CA-05 | Clicar numa célula avaliada abre GradeDrawer lateral |
| CA-06 | GradeDrawer exibe itens com status individual |
| CA-07 | Clicar no nome da unidade seleciona todos os serviços |
| CA-08 | Barra flutuante aparece com células selecionadas |
| CA-09 | "Marcar Conforme" chama bulk e atualiza grade |
| CA-10 | Novos status (nc_final, liberado, parcial) têm cor/ícone |
| CA-11 | Cabeçalho agrupa locais por pavimento quando múltiplos pavimentos |
| CA-12 | URL atualiza query params ao aplicar filtros |
| CA-13 | `getGrade` retorna `resumo` com todos os contadores |
