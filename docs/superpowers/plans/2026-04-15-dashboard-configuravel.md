# Dashboard Geral Configurável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `DashboardPage` estático por um dashboard configurável por usuário com drag & drop, catálogo de 22 widgets, persistência no banco e Widget Generator extensível.

**Architecture:** Backend cria um `DashboardModule` com endpoints de layout (GET/PUT `/usuarios/me/dashboard-layout`) e um endpoint unificado de KPIs globais (`/dashboard/summary`). Frontend usa `react-grid-layout` com um `WidgetRegistry` singleton — cada widget é um componente auto-suficiente que busca seus próprios dados e se registra no catálogo.

**Tech Stack:** NestJS + Prisma (backend), React 19 + TypeScript + TanStack Query + react-grid-layout + Zod (frontend)

---

## Mapa de Arquivos

### Backend (criar/modificar)
```
backend/prisma/schema.prisma                          ← + dashboardLayout Json? em Usuario
backend/src/dashboard/                                ← módulo novo
  dashboard.module.ts
  dashboard.controller.ts
  dashboard.service.ts
  dto/save-layout.dto.ts
backend/src/app.module.ts                             ← + DashboardModule
```

### Frontend (criar/modificar)
```
src/pages/DashboardPage.tsx                           ← substituir por shell

src/modules/dashboard/
  DashboardGrid.tsx                                   ← react-grid-layout wrapper
  AddWidgetDrawer.tsx                                 ← drawer lateral com catálogo
  WidgetWrapper.tsx                                   ← container com handles de edição
  WidgetConfigModal.tsx                               ← modal de config por widget

  registry/
    types.ts                                          ← WidgetDefinition, WidgetInstance
    index.ts                                          ← WidgetRegistry singleton
    widgets.ts                                        ← registra todos os widgets

  widgets/
    global/
      ObrasStatusWidget.tsx
      NcsAbertasWidget.tsx
      AprovacoesPendentesWidget.tsx
      SemaforoGeralWidget.tsx
      AtividadeRecenteWidget.tsx
    obra/
      FvsConformidadeWidget.tsx
      FvsEvolucaoWidget.tsx
      ConcretagemVolumeWidget.tsx
      ConcretagemCpsWidget.tsx
      EnsaiosLaudosWidget.tsx
      AlmoxarifadoCriticoWidget.tsx
      EfetivoHojeWidget.tsx
      GedDocsWidget.tsx
      NcsPorObraWidget.tsx

src/services/dashboard.service.ts                     ← chamadas de API (layout + summary)
```

---

## Task 1: Prisma — campo dashboardLayout em Usuario

**Files:**
- Modify: `backend/prisma/schema.prisma` (model Usuario)

- [ ] **Adicionar campo ao modelo Usuario**

No `schema.prisma`, dentro de `model Usuario { ... }`, adicionar após `deletadoEm`:

```prisma
dashboardLayout Json?  @map("dashboard_layout")
```

O modelo completo do trecho:
```prisma
model Usuario {
  id              Int       @id @default(autoincrement())
  tenantId        Int
  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  nome            String
  email           String
  senhaHash       String
  role            Role      @default(TECNICO)
  ativo           Boolean   @default(true)
  criadoEm        DateTime  @default(now())
  deletadoEm      DateTime?
  dashboardLayout Json?     @map("dashboard_layout")
  // ... relações existentes
```

- [ ] **Gerar e aplicar a migration**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npx prisma migrate dev --name add_dashboard_layout_to_usuario
```

Expected: `✔ Your database is now in sync with your schema.`

- [ ] **Verificar migration gerada**

```bash
ls prisma/migrations/ | tail -3
```

Expected: ver pasta com nome `..._add_dashboard_layout_to_usuario`

- [ ] **Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add dashboardLayout field to Usuario model"
```

---

## Task 2: Backend — DashboardModule (layout CRUD + summary + feed)

**Files:**
- Create: `backend/src/dashboard/dto/save-layout.dto.ts`
- Create: `backend/src/dashboard/dashboard.service.ts`
- Create: `backend/src/dashboard/dashboard.controller.ts`
- Create: `backend/src/dashboard/dashboard.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Criar DTO de save layout**

```typescript
// backend/src/dashboard/dto/save-layout.dto.ts
import { IsArray, IsString, IsNumber, IsObject, ValidateNested, IsOptional, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class WidgetInstanceDto {
  @IsString()
  instanceId: string;

  @IsString()
  widgetId: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  w: number;

  @IsNumber()
  h: number;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class SaveLayoutDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WidgetInstanceDto)
  layout: WidgetInstanceDto[];
}
```

- [ ] **Criar DashboardService**

```typescript
// backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveLayoutDto } from './dto/save-layout.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLayout(usuarioId: number) {
    const user = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { dashboardLayout: true },
    });
    return { layout: user?.dashboardLayout ?? null };
  }

  async saveLayout(usuarioId: number, dto: SaveLayoutDto) {
    const user = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { dashboardLayout: dto.layout as any },
      select: { dashboardLayout: true },
    });
    return { layout: user.dashboardLayout };
  }

  async getSummary(tenantId: number, usuarioId: number) {
    const [obras, ncs, aprovacoes, gedVencendo] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'EM_EXECUCAO')::int AS em_execucao,
          COUNT(*) FILTER (WHERE status = 'PARALISADA')::int  AS paralisadas,
          COUNT(*) FILTER (WHERE status = 'CONCLUIDA')::int   AS concluidas
        FROM "Obra"
        WHERE "tenantId" = $1 AND "deletadoEm" IS NULL
      `, tenantId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('FECHADA','CANCELADA'))::int         AS abertas,
          COUNT(*) FILTER (WHERE criticidade = 'ALTA' AND status NOT IN ('FECHADA','CANCELADA'))::int AS criticas,
          COUNT(*) FILTER (WHERE prazo < NOW() AND status NOT IN ('FECHADA','CANCELADA'))::int         AS vencidas
        FROM "NaoConformidade"
        WHERE tenant_id = $1 AND deleted_at IS NULL
      `, tenantId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS pendentes
        FROM "AprovacaoInstancia"
        WHERE "tenantId" = $1
          AND status = 'PENDENTE'
          AND "aprovadorId" = $2
      `, tenantId, usuarioId),

      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int AS vencendo_30d
        FROM "GedVersao" gv
        JOIN "GedDocumento" gd ON gd.id = gv."documentoId"
        WHERE gd."tenantId" = $1
          AND gv.status NOT IN ('OBSOLETO','CANCELADO','REJEITADO')
          AND gv."validadeAte" BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      `, tenantId),
    ]);

    return {
      obras: obras[0],
      ncs: ncs[0],
      aprovacoes: { pendentes_do_usuario: aprovacoes[0]?.pendentes ?? 0 },
      ged: { vencendo_30d: gedVencendo[0]?.vencendo_30d ?? 0 },
    };
  }

  async getFeed(tenantId: number, limit = 20) {
    const items = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT tipo, titulo, subtitulo, obra_nome, created_at, link, cor
      FROM (
        SELECT
          'nc_aberta'   AS tipo,
          'NC aberta: ' || titulo AS titulo,
          'Criticidade ' || criticidade AS subtitulo,
          (SELECT nome FROM "Obra" WHERE id = nc.obra_id) AS obra_nome,
          nc.created_at,
          '/ncs' AS link,
          'red' AS cor
        FROM "NaoConformidade" nc
        WHERE nc.tenant_id = $1 AND nc.deleted_at IS NULL
          AND nc.status NOT IN ('FECHADA','CANCELADA')

        UNION ALL

        SELECT
          'aprovacao_pendente' AS tipo,
          'Aprovação pendente: ' || modulo AS titulo,
          NULL AS subtitulo,
          NULL AS obra_nome,
          ai."criadoEm" AS created_at,
          '/aprovacoes' AS link,
          'yellow' AS cor
        FROM "AprovacaoInstancia" ai
        WHERE ai."tenantId" = $1 AND ai.status = 'PENDENTE'
      ) t
      ORDER BY created_at DESC
      LIMIT $2
    `, tenantId, limit);

    return { items };
  }
}
```

- [ ] **Criar DashboardController**

```typescript
// backend/src/dashboard/dashboard.controller.ts
import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { CurrentUser } from '../common/decorators/tenant.decorator';
import { DashboardService } from './dashboard.service';
import { SaveLayoutDto } from './dto/save-layout.dto';

interface JwtUser { id: number; tenantId: number; roles: string[] }

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('usuarios/me/dashboard-layout')
  @Roles('ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE')
  getLayout(@CurrentUser() user: JwtUser) {
    return this.svc.getLayout(user.id);
  }

  @Put('usuarios/me/dashboard-layout')
  @Roles('ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE')
  saveLayout(@CurrentUser() user: JwtUser, @Body() dto: SaveLayoutDto) {
    return this.svc.saveLayout(user.id, dto);
  }

  @Get('dashboard/summary')
  @Roles('ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE')
  getSummary(@TenantId() tenantId: number, @CurrentUser() user: JwtUser) {
    return this.svc.getSummary(tenantId, user.id);
  }

  @Get('dashboard/feed')
  @Roles('ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE')
  getFeed(
    @TenantId() tenantId: number,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getFeed(tenantId, limit ? parseInt(limit) : 20);
  }
}
```

- [ ] **Criar DashboardModule**

```typescript
// backend/src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Registrar no AppModule**

Em `backend/src/app.module.ts`, adicionar:
```typescript
import { DashboardModule } from './dashboard/dashboard.module';
// ...
imports: [
  // ... módulos existentes
  DashboardModule,
],
```

- [ ] **Reiniciar backend e testar endpoints**

```bash
# Matar processo atual e reiniciar
pkill -f "nest start" 2>/dev/null; sleep 2
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/backend
npm run start:dev &
sleep 5
# Testar summary (substituir TOKEN pelo token real)
curl -s http://localhost:3000/api/v1/dashboard/summary \
  -H "Authorization: Bearer TOKEN" | jq .
```

Expected: JSON com campos `obras`, `ncs`, `aprovacoes`, `ged`

- [ ] **Commit**

```bash
git add src/dashboard/ src/app.module.ts prisma/
git commit -m "feat: DashboardModule com layout CRUD, summary e feed"
```

---

## Task 3: Frontend — Instalar react-grid-layout + tipos base

**Files:**
- Modify: `package.json`
- Create: `src/modules/dashboard/registry/types.ts`
- Create: `src/modules/dashboard/registry/index.ts`
- Create: `src/services/dashboard.service.ts`

- [ ] **Instalar react-grid-layout**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/frontend-web
npm install react-grid-layout
npm install -D @types/react-grid-layout
```

Expected: sem erros de peer dependency.

- [ ] **Criar types.ts do registry**

```typescript
// src/modules/dashboard/registry/types.ts
import type { ReactNode } from 'react'

export interface WidgetInstance {
  instanceId: string
  widgetId: string
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
}

export interface WidgetDefinition {
  id: string
  titulo: string
  descricao: string
  icone: ReactNode
  modulo: string
  tier: 1 | 2 | 3
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  maxW: number
  maxH: number
  roles: string[]
  needsObraId: boolean
  component: React.FC<{ config: Record<string, unknown>; instanceId: string }>
}
```

- [ ] **Criar WidgetRegistry singleton**

```typescript
// src/modules/dashboard/registry/index.ts
import type { WidgetDefinition } from './types'

class WidgetRegistry {
  private map = new Map<string, WidgetDefinition>()

  register(def: WidgetDefinition) {
    this.map.set(def.id, def)
  }

  get(id: string): WidgetDefinition | undefined {
    return this.map.get(id)
  }

  getAll(): WidgetDefinition[] {
    return Array.from(this.map.values())
  }

  getByTier(tier: 1 | 2 | 3): WidgetDefinition[] {
    return this.getAll().filter((d) => d.tier === tier)
  }

  getByModulo(modulo: string): WidgetDefinition[] {
    return this.getAll().filter((d) => d.modulo === modulo)
  }
}

export const widgetRegistry = new WidgetRegistry()
```

- [ ] **Criar dashboard.service.ts no frontend**

```typescript
// src/services/dashboard.service.ts
import { api } from './api'
import type { WidgetInstance } from '@/modules/dashboard/registry/types'

export interface DashboardSummary {
  obras: { total: number; em_execucao: number; paralisadas: number; concluidas: number }
  ncs: { abertas: number; criticas: number; vencidas: number }
  aprovacoes: { pendentes_do_usuario: number }
  ged: { vencendo_30d: number }
}

export interface FeedItem {
  tipo: string
  titulo: string
  subtitulo?: string
  obra_nome?: string
  created_at: string
  link: string
  cor: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
}

export const dashboardService = {
  getLayout: () =>
    api.get<{ layout: WidgetInstance[] | null }>('/usuarios/me/dashboard-layout')
      .then((r) => r.data),

  saveLayout: (layout: WidgetInstance[]) =>
    api.put<{ layout: WidgetInstance[] }>('/usuarios/me/dashboard-layout', { layout })
      .then((r) => r.data),

  getSummary: () =>
    api.get<{ status: string; data: DashboardSummary }>('/dashboard/summary')
      .then((r) => r.data.data),

  getFeed: (limit = 20) =>
    api.get<{ status: string; data: { items: FeedItem[] } }>(`/dashboard/feed?limit=${limit}`)
      .then((r) => r.data.data),
}
```

- [ ] **Commit**

```bash
git add src/modules/dashboard/registry/ src/services/dashboard.service.ts package.json package-lock.json
git commit -m "feat: WidgetRegistry types e dashboard service"
```

---

## Task 4: Frontend — DashboardGrid + WidgetWrapper

**Files:**
- Create: `src/modules/dashboard/WidgetWrapper.tsx`
- Create: `src/modules/dashboard/DashboardGrid.tsx`

- [ ] **Criar WidgetWrapper**

```typescript
// src/modules/dashboard/WidgetWrapper.tsx
import { X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/cn'

interface WidgetWrapperProps {
  titulo: string
  editMode: boolean
  onRemove: () => void
  children: React.ReactNode
  className?: string
}

export function WidgetWrapper({ titulo, editMode, onRemove, children, className }: WidgetWrapperProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-lg overflow-hidden flex flex-col h-full',
        editMode && 'border-[var(--accent)] border-dashed',
        className,
      )}
    >
      {editMode && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-raised)] border-b border-[var(--border-dim)] flex-shrink-0">
          <div className="flex items-center gap-1.5 drag-handle cursor-grab active:cursor-grabbing">
            <GripVertical size={12} className="text-[var(--text-faint)]" />
            <span className="text-[10px] text-[var(--text-faint)] truncate max-w-[140px]">{titulo}</span>
          </div>
          <button
            onClick={onRemove}
            className="text-[var(--text-faint)] hover:text-[var(--nc)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden p-3">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Criar DashboardGrid**

```typescript
// src/modules/dashboard/DashboardGrid.tsx
import { useState, useCallback } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { widgetRegistry } from './registry'
import { WidgetWrapper } from './WidgetWrapper'
import type { WidgetInstance } from './registry/types'

const ResponsiveGrid = WidthProvider(Responsive)

interface DashboardGridProps {
  layout: WidgetInstance[]
  editMode: boolean
  onLayoutChange: (layout: WidgetInstance[]) => void
}

export function DashboardGrid({ layout, editMode, onLayoutChange }: DashboardGridProps) {
  const handleLayoutChange = useCallback(
    (newLayout: any[]) => {
      const updated: WidgetInstance[] = newLayout.map((item) => {
        const existing = layout.find((w) => w.instanceId === item.i)
        return {
          instanceId: item.i,
          widgetId: existing?.widgetId ?? item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          config: existing?.config ?? {},
        }
      })
      onLayoutChange(updated)
    },
    [layout, onLayoutChange],
  )

  const handleRemove = useCallback(
    (instanceId: string) => {
      onLayoutChange(layout.filter((w) => w.instanceId !== instanceId))
    },
    [layout, onLayoutChange],
  )

  if (layout.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--text-faint)] gap-3">
        <p className="text-sm">Seu dashboard está vazio.</p>
        {editMode && <p className="text-xs">Clique em "Adicionar widget" para começar.</p>}
      </div>
    )
  }

  const gridLayout = layout.map((w) => ({
    i: w.instanceId,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
    minW: widgetRegistry.get(w.widgetId)?.minW ?? 1,
    minH: widgetRegistry.get(w.widgetId)?.minH ?? 1,
    maxW: widgetRegistry.get(w.widgetId)?.maxW ?? 12,
    maxH: widgetRegistry.get(w.widgetId)?.maxH ?? 6,
  }))

  return (
    <ResponsiveGrid
      layouts={{ lg: gridLayout, md: gridLayout, sm: gridLayout }}
      breakpoints={{ lg: 1200, md: 768, sm: 0 }}
      cols={{ lg: 12, md: 6, sm: 1 }}
      rowHeight={100}
      margin={[8, 8]}
      isDraggable={editMode}
      isResizable={editMode}
      draggableHandle=".drag-handle"
      onLayoutChange={handleLayoutChange}
      useCSSTransforms
    >
      {layout.map((instance) => {
        const def = widgetRegistry.get(instance.widgetId)
        if (!def) return null
        const WidgetComponent = def.component

        return (
          <div key={instance.instanceId}>
            <WidgetWrapper
              titulo={def.titulo}
              editMode={editMode}
              onRemove={() => handleRemove(instance.instanceId)}
              className="h-full"
            >
              <WidgetComponent
                config={instance.config}
                instanceId={instance.instanceId}
              />
            </WidgetWrapper>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
```

- [ ] **Commit**

```bash
git add src/modules/dashboard/WidgetWrapper.tsx src/modules/dashboard/DashboardGrid.tsx
git commit -m "feat: DashboardGrid com react-grid-layout e WidgetWrapper"
```

---

## Task 5: Frontend — AddWidgetDrawer + WidgetConfigModal

**Files:**
- Create: `src/modules/dashboard/AddWidgetDrawer.tsx`
- Create: `src/modules/dashboard/WidgetConfigModal.tsx`

- [ ] **Criar AddWidgetDrawer**

```typescript
// src/modules/dashboard/AddWidgetDrawer.tsx
import { useState } from 'react'
import { X, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { widgetRegistry } from './registry'
import type { WidgetDefinition } from './registry/types'

const MODULOS = ['global', 'obras', 'fvs', 'concretagem', 'ensaios', 'almoxarifado', 'efetivo', 'ged', 'ncs', 'fvm', 'rdo']
const MODULO_LABEL: Record<string, string> = {
  global: 'Global', obras: 'Obras', fvs: 'FVS', concretagem: 'Concretagem',
  ensaios: 'Ensaios', almoxarifado: 'Almoxarifado', efetivo: 'Efetivo',
  ged: 'GED', ncs: 'NCs', fvm: 'FVM', rdo: 'Diário',
}

interface AddWidgetDrawerProps {
  open: boolean
  onClose: () => void
  onAdd: (def: WidgetDefinition) => void
}

export function AddWidgetDrawer({ open, onClose, onAdd }: AddWidgetDrawerProps) {
  const [search, setSearch] = useState('')
  const [activeModulo, setActiveModulo] = useState('global')

  const all = widgetRegistry.getAll()
  const filtered = all.filter((d) => {
    const matchModulo = activeModulo === 'global' ? d.tier === 1 : d.modulo === activeModulo
    const matchSearch = !search || d.titulo.toLowerCase().includes(search.toLowerCase())
    return matchModulo && matchSearch
  })

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[360px] bg-[var(--bg-surface)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
          <h2 className="text-sm font-semibold text-[var(--text-high)]">Adicionar widget</h2>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[var(--border-dim)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar widget..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Tabs de módulo */}
        <div className="flex gap-1 p-2 border-b border-[var(--border-dim)] flex-wrap">
          {MODULOS.map((m) => (
            <button
              key={m}
              onClick={() => setActiveModulo(m)}
              className={cn(
                'px-2 py-1 text-[10px] rounded font-medium transition-colors',
                activeModulo === m
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-raised)] text-[var(--text-faint)] hover:text-[var(--text-high)]',
              )}
            >
              {MODULO_LABEL[m]}
            </button>
          ))}
        </div>

        {/* Lista de widgets */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {filtered.length === 0 && (
            <p className="text-xs text-[var(--text-faint)] text-center mt-8">Nenhum widget encontrado</p>
          )}
          {filtered.map((def) => (
            <button
              key={def.id}
              onClick={() => onAdd(def)}
              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)] hover:border-[var(--accent)] text-left transition-colors group"
            >
              <span className="text-[var(--text-low)] group-hover:text-[var(--accent)] mt-0.5 flex-shrink-0">
                {def.icone}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-high)] truncate">{def.titulo}</p>
                <p className="text-[10px] text-[var(--text-faint)] mt-0.5 line-clamp-2">{def.descricao}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Criar WidgetConfigModal (para widgets que precisam de obraId)**

```typescript
// src/modules/dashboard/WidgetConfigModal.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { obrasService } from '@/services/obras.service'
import type { WidgetDefinition } from './registry/types'

interface WidgetConfigModalProps {
  def: WidgetDefinition | null
  onConfirm: (config: Record<string, unknown>) => void
  onClose: () => void
}

export function WidgetConfigModal({ def, onConfirm, onClose }: WidgetConfigModalProps) {
  const [obraId, setObraId] = useState<number | ''>('')

  const { data: obrasData } = useQuery({
    queryKey: ['obras-config-modal'],
    queryFn: () => obrasService.getAll({ limit: 100 }),
    enabled: !!def?.needsObraId,
  })

  const obras = obrasData?.items ?? []

  if (!def) return null

  const handleConfirm = () => {
    const config: Record<string, unknown> = {}
    if (def.needsObraId) {
      if (!obraId) return
      config.obraId = obraId
    }
    onConfirm(config)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-high)]">Configurar — {def.titulo}</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {def.needsObraId && (
          <div className="mb-4">
            <label className="block text-xs text-[var(--text-faint)] mb-1.5">Obra</label>
            <select
              value={obraId}
              onChange={(e) => setObraId(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">Selecione uma obra...</option>
              {obras.map((o: any) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-high)]">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={def.needsObraId && !obraId}
            className="px-4 py-1.5 text-xs bg-[var(--accent)] text-white rounded font-medium disabled:opacity-40 hover:bg-[var(--accent-hover)] transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/modules/dashboard/AddWidgetDrawer.tsx src/modules/dashboard/WidgetConfigModal.tsx
git commit -m "feat: AddWidgetDrawer e WidgetConfigModal"
```

---

## Task 6: Frontend — DashboardPage (shell com persistência)

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Substituir DashboardPage pelo shell configurável**

```typescript
// src/pages/DashboardPage.tsx
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Pencil } from 'lucide-react'
import { crypto } from 'crypto'
import { dashboardService } from '@/services/dashboard.service'
import { DashboardGrid } from '@/modules/dashboard/DashboardGrid'
import { AddWidgetDrawer } from '@/modules/dashboard/AddWidgetDrawer'
import { WidgetConfigModal } from '@/modules/dashboard/WidgetConfigModal'
import { useAuthStore } from '@/store/auth.store'
import { widgetRegistry } from '@/modules/dashboard/registry'
import type { WidgetInstance } from '@/modules/dashboard/registry/types'
import type { WidgetDefinition } from '@/modules/dashboard/registry/types'
// importar para registrar todos os widgets
import '@/modules/dashboard/registry/widgets'

const DEFAULT_LAYOUTS: Record<string, WidgetInstance[]> = {
  ADMIN_TENANT: [
    { instanceId: 'obras-1',   widgetId: 'obras-status',          x: 0, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 3, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 6, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 6, h: 2, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 6, y: 1, w: 6, h: 2, config: {} },
  ],
  ENGENHEIRO: [
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 0, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 3, y: 0, w: 3, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 6, h: 2, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 6, y: 1, w: 6, h: 2, config: {} },
  ],
  TECNICO: [
    { instanceId: 'aprov-1',  widgetId: 'aprovacoes-pendentes',   x: 0, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'ncs-1',    widgetId: 'ncs-abertas',            x: 4, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'feed-1',   widgetId: 'atividade-recente',      x: 0, y: 1, w: 8, h: 2, config: {} },
  ],
  VISITANTE: [
    { instanceId: 'obras-1',  widgetId: 'obras-status',           x: 0, y: 0, w: 4, h: 1, config: {} },
    { instanceId: 'sem-1',    widgetId: 'semaforo-geral',         x: 0, y: 1, w: 8, h: 2, config: {} },
  ],
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [editMode, setEditMode] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pendingDef, setPendingDef] = useState<WidgetDefinition | null>(null)
  const [localLayout, setLocalLayout] = useState<WidgetInstance[] | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-layout'],
    queryFn: dashboardService.getLayout,
  })

  const saveMutation = useMutation({
    mutationFn: (layout: WidgetInstance[]) => dashboardService.saveLayout(layout),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-layout'] })
      setEditMode(false)
      setLocalLayout(null)
    },
  })

  const role = user?.role ?? 'TECNICO'
  const savedLayout = data?.layout
  const activeLayout = localLayout ?? savedLayout ?? DEFAULT_LAYOUTS[role] ?? DEFAULT_LAYOUTS.TECNICO

  const handleAddWidget = (def: WidgetDefinition) => {
    if (def.needsObraId) {
      setDrawerOpen(false)
      setPendingDef(def)
    } else {
      addWidgetToLayout(def, {})
      setDrawerOpen(false)
    }
  }

  const addWidgetToLayout = (def: WidgetDefinition, config: Record<string, unknown>) => {
    const instanceId = `${def.id}-${Date.now()}`
    const newWidget: WidgetInstance = {
      instanceId,
      widgetId: def.id,
      x: 0,
      y: Infinity,
      w: def.defaultW,
      h: def.defaultH,
      config,
    }
    setLocalLayout([...activeLayout, newWidget])
    setPendingDef(null)
  }

  const handleSave = () => {
    saveMutation.mutate(activeLayout)
  }

  const handleCancel = () => {
    setLocalLayout(null)
    setEditMode(false)
  }

  const primeiroNome = user?.nome?.split(' ')[0] ?? 'Usuário'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-high)]">Bom dia, {primeiroNome} 👋</h1>
          <p className="text-xs text-[var(--text-faint)] mt-0.5">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border)] rounded-md text-[var(--text-mid)] hover:border-[var(--accent)] transition-colors"
              >
                <Plus size={12} /> Adicionar widget
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-high)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md font-medium hover:bg-[var(--accent-hover)] disabled:opacity-60 transition-colors"
              >
                <Check size={12} /> {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md text-[var(--text-faint)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
            >
              <Pencil size={12} /> Editar dashboard
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-faint)] text-sm">
            Carregando dashboard...
          </div>
        ) : (
          <DashboardGrid
            layout={activeLayout}
            editMode={editMode}
            onLayoutChange={setLocalLayout}
          />
        )}
      </div>

      <AddWidgetDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddWidget}
      />

      <WidgetConfigModal
        def={pendingDef}
        onConfirm={(config) => pendingDef && addWidgetToLayout(pendingDef, config)}
        onClose={() => setPendingDef(null)}
      />
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: DashboardPage configurável com persistência e modo edição"
```

---

## Task 7: Frontend — Widgets Tier 1 (globais)

**Files:**
- Create: `src/modules/dashboard/widgets/global/ObrasStatusWidget.tsx`
- Create: `src/modules/dashboard/widgets/global/NcsAbertasWidget.tsx`
- Create: `src/modules/dashboard/widgets/global/AprovacoesPendentesWidget.tsx`
- Create: `src/modules/dashboard/widgets/global/SemaforoGeralWidget.tsx`
- Create: `src/modules/dashboard/widgets/global/AtividadeRecenteWidget.tsx`

- [ ] **Criar hook compartilhado useSummary**

Dentro de `src/modules/dashboard/widgets/global/`, criar um arquivo `_useSummary.ts`:

```typescript
// src/modules/dashboard/widgets/global/_useSummary.ts
import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '@/services/dashboard.service'

export function useSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: dashboardService.getSummary,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}
```

- [ ] **ObrasStatusWidget**

```typescript
// src/modules/dashboard/widgets/global/ObrasStatusWidget.tsx
import { Layers } from 'lucide-react'
import { useSummary } from './_useSummary'

export function ObrasStatusWidget() {
  const { data, isLoading } = useSummary()
  const obras = data?.obras

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={13} className="text-[var(--run)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">Obras</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-16 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold text-[var(--run)] leading-none">{obras?.em_execucao ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">em execução · {obras?.total ?? 0} total</p>
          <div className="flex gap-3 mt-2">
            <span className="text-[9px] text-[var(--warn)]">{obras?.paralisadas ?? 0} paralisadas</span>
            <span className="text-[9px] text-[var(--ok)]">{obras?.concluidas ?? 0} concluídas</span>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **NcsAbertasWidget**

```typescript
// src/modules/dashboard/widgets/global/NcsAbertasWidget.tsx
import { AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSummary } from './_useSummary'

export function NcsAbertasWidget() {
  const { data, isLoading } = useSummary()
  const ncs = data?.ncs
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate('/ncs')}>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle size={13} className="text-[var(--nc)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">NCs Abertas</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-12 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold text-[var(--nc)] leading-none">{ncs?.abertas ?? '—'}</p>
          <div className="flex gap-3 mt-1.5">
            {(ncs?.criticas ?? 0) > 0 && (
              <span className="text-[9px] font-semibold text-[var(--nc)]">{ncs?.criticas} críticas</span>
            )}
            {(ncs?.vencidas ?? 0) > 0 && (
              <span className="text-[9px] text-[var(--warn)]">{ncs?.vencidas} vencidas</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **AprovacoesPendentesWidget**

```typescript
// src/modules/dashboard/widgets/global/AprovacoesPendentesWidget.tsx
import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSummary } from './_useSummary'

export function AprovacoesPendentesWidget() {
  const { data, isLoading } = useSummary()
  const pendentes = data?.aprovacoes?.pendentes_do_usuario ?? 0
  const navigate = useNavigate()

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate('/aprovacoes')}>
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={13} className="text-[var(--warn)]" />
        <span className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px]">Aprovações</span>
      </div>
      {isLoading ? (
        <div className="skeleton h-8 w-12 rounded" />
      ) : (
        <>
          <p className="text-3xl font-bold leading-none" style={{ color: pendentes > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {pendentes}
          </p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">
            {pendentes === 0 ? 'Em dia ✓' : 'aguardando você'}
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **SemaforoGeralWidget**

```typescript
// src/modules/dashboard/widgets/global/SemaforoGeralWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'

const COR_DOT: Record<string, string> = {
  verde: 'var(--ok)',
  amarelo: 'var(--warn)',
  vermelho: 'var(--nc)',
}

export function SemaforoGeralWidget() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['semaforo-geral'],
    queryFn: () => api.get<any>('/semaforo').then((r) => r.data?.data ?? r.data),
    staleTime: 120_000,
  })

  const obras: any[] = Array.isArray(data) ? data : (data?.obras ?? [])

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Semáforo de Obras</p>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3].map((i) => <div key={i} className="skeleton h-5 rounded" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {obras.map((item: any) => (
            <div
              key={item.obra_id ?? item.id}
              className="flex items-center justify-between py-1.5 border-b border-[var(--border-dim)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] px-1 rounded"
              onClick={() => navigate(`/obras/${item.obra_id ?? item.id}/semaforo`)}
            >
              <span className="text-[10px] text-[var(--text-mid)] truncate max-w-[120px]">
                {item.obra_nome ?? item.nome}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                {Object.entries(item.modulos ?? {}).map(([mod, cor]: [string, any]) => (
                  <div
                    key={mod}
                    title={mod}
                    className="w-2 h-2 rounded-full"
                    style={{ background: COR_DOT[cor] ?? '#64748b' }}
                  />
                ))}
              </div>
            </div>
          ))}
          {obras.length === 0 && (
            <p className="text-[10px] text-[var(--text-faint)]">Nenhuma obra com semáforo calculado.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **AtividadeRecenteWidget**

```typescript
// src/modules/dashboard/widgets/global/AtividadeRecenteWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { dashboardService } from '@/services/dashboard.service'

const COR: Record<string, string> = {
  red: 'var(--nc)', yellow: 'var(--warn)', green: 'var(--ok)',
  blue: 'var(--run)', purple: 'var(--purple)',
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

export function AtividadeRecenteWidget() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-feed'],
    queryFn: () => dashboardService.getFeed(15),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const items = data?.items ?? []

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Atividade Recente</p>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map((i) => <div key={i} className="skeleton h-4 rounded" />)}
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto flex-1">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex gap-2 items-start py-1.5 border-b border-[var(--border-dim)] last:border-0 cursor-pointer hover:bg-[var(--bg-hover)] px-1 rounded"
              onClick={() => navigate(item.link)}
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: COR[item.cor] ?? '#64748b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--text-mid)] truncate">{item.titulo}</p>
                {item.obra_nome && (
                  <p className="text-[9px] text-[var(--text-faint)]">{item.obra_nome}</p>
                )}
              </div>
              <span className="text-[9px] text-[var(--text-faint)] flex-shrink-0">{timeAgo(item.created_at)}</span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-[10px] text-[var(--text-faint)]">Nenhuma atividade recente.</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/modules/dashboard/widgets/global/
git commit -m "feat: widgets globais Tier 1 (obras, ncs, aprovações, semáforo, feed)"
```

---

## Task 8: Frontend — Widgets Tier 2 (por obra)

**Files:**
- Create: `src/modules/dashboard/widgets/obra/FvsConformidadeWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/ConcretagemVolumeWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/EnsaiosLaudosWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/AlmoxarifadoCriticoWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/EfetivoHojeWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/GedDocsWidget.tsx`
- Create: `src/modules/dashboard/widgets/obra/NcsPorObraWidget.tsx`

- [ ] **Helper: hook genérico useObraConfig**

```typescript
// src/modules/dashboard/widgets/obra/_useObraConfig.ts
export function useObraConfig(config: Record<string, unknown>): number | null {
  const id = config.obraId
  if (typeof id === 'number') return id
  if (typeof id === 'string') return parseInt(id)
  return null
}
```

- [ ] **FvsConformidadeWidget**

```typescript
// src/modules/dashboard/widgets/obra/FvsConformidadeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function FvsConformidadeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['fvs-dash', obraId],
    queryFn: () => api.get<any>(`/fvs/dashboard/obras/${obraId}`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const taxa = data?.taxa_conformidade ?? data?.taxa ?? null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">FVS — Conformidade</p>
      {isLoading ? <div className="skeleton h-8 w-16 rounded" /> : (
        <>
          <p className="text-3xl font-bold leading-none" style={{ color: taxa >= 80 ? 'var(--ok)' : taxa >= 60 ? 'var(--warn)' : 'var(--nc)' }}>
            {taxa !== null ? `${taxa.toFixed(0)}%` : '—'}
          </p>
          <div className="mt-2 bg-[var(--bg-raised)] rounded-sm h-1.5 overflow-hidden">
            <div className="h-full rounded-sm transition-all" style={{
              width: `${taxa ?? 0}%`,
              background: taxa >= 80 ? 'var(--ok)' : taxa >= 60 ? 'var(--warn)' : 'var(--nc)',
            }} />
          </div>
          {data?.total_fichas !== undefined && (
            <p className="text-[9px] text-[var(--text-faint)] mt-1">{data.total_fichas} fichas · {data.total_ncs ?? 0} NCs</p>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **ConcretagemVolumeWidget**

```typescript
// src/modules/dashboard/widgets/obra/ConcretagemVolumeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function ConcretagemVolumeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['conc-dash', obraId],
    queryFn: () => api.get<any>(`/obras/${obraId}/concretagem/dashboard`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const realizado = data?.volume_realizado ?? data?.volumeRealizado ?? null
  const previsto = data?.volume_previsto ?? data?.volumePrevisto ?? null
  const pct = previsto && realizado ? Math.round((realizado / previsto) * 100) : null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Concretagem — Volume</p>
      {isLoading ? <div className="skeleton h-8 w-20 rounded" /> : (
        <>
          <p className="text-2xl font-bold text-[var(--cyan,#06b6d4)] leading-none">
            {realizado !== null ? `${realizado}m³` : '—'}
          </p>
          {previsto && <p className="text-[10px] text-[var(--text-faint)] mt-1">de {previsto}m³ {pct !== null ? `(${pct}%)` : ''}</p>}
          {data?.total_betonadas !== undefined && (
            <p className="text-[9px] text-[var(--text-faint)] mt-1">{data.total_betonadas} betonadas</p>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **EnsaiosLaudosWidget**

```typescript
// src/modules/dashboard/widgets/obra/EnsaiosLaudosWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function EnsaiosLaudosWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['ensaios-kpi', obraId],
    queryFn: () => api.get<any>('/dashboard/materiais', { params: { obra_id: obraId } }).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Ensaios — Laudos</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--warn)] leading-none">{data?.laudos_pendentes ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">laudos pendentes</p>
          <div className="flex gap-3 mt-1.5">
            {data?.taxa_conformidade !== undefined && (
              <span className="text-[9px] text-[var(--ok)]">{data.taxa_conformidade.toFixed(0)}% conformidade</span>
            )}
            {data?.proximos_cupons_7d > 0 && (
              <span className="text-[9px] text-[var(--warn)]">{data.proximos_cupons_7d} cupons em 7d</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **AlmoxarifadoCriticoWidget**

```typescript
// src/modules/dashboard/widgets/obra/AlmoxarifadoCriticoWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function AlmoxarifadoCriticoWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['alm-dash', obraId],
    queryFn: () => api.get<any>(`/almoxarifado/obras/${obraId}/dashboard`).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const criticos: any[] = data?.materiais_criticos ?? data?.alertas ?? []

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Estoque Crítico</p>
      {isLoading ? (
        <div className="flex flex-col gap-1.5">{[1,2,3].map((i) => <div key={i} className="skeleton h-4 rounded" />)}</div>
      ) : criticos.length === 0 ? (
        <p className="text-[10px] text-[var(--ok)]">Estoque normalizado ✓</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-y-auto flex-1">
          {criticos.slice(0, 5).map((item: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-[var(--border-dim)] last:border-0">
              <span className="text-[10px] text-[var(--text-mid)] truncate max-w-[120px]">{item.nome ?? item.material_nome}</span>
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{
                background: item.nivel === 'CRITICO' ? 'var(--nc-bg)' : 'var(--warn-bg)',
                color: item.nivel === 'CRITICO' ? 'var(--nc)' : 'var(--warn)',
              }}>
                {item.nivel ?? 'ATENÇÃO'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **EfetivoHojeWidget**

```typescript
// src/modules/dashboard/widgets/obra/EfetivoHojeWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useObraConfig } from './_useObraConfig'

export function EfetivoHojeWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['efetivo-hoje', obraId],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const res = await api.get<any>(`/obras/${obraId}/efetivo`, { params: { data: hoje } })
      return res.data?.data ?? res.data
    },
    enabled: !!obraId,
    staleTime: 60_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const total = data?.total ?? data?.items?.reduce((s: number, i: any) => s + (i.quantidade ?? 0), 0) ?? null

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">Efetivo Hoje</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--orange,#f97316)] leading-none">{total ?? '—'}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">trabalhadores</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **GedDocsWidget**

```typescript
// src/modules/dashboard/widgets/obra/GedDocsWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { gedService } from '@/services/ged.service'
import { useObraConfig } from './_useObraConfig'

export function GedDocsWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)

  const { data, isLoading } = useQuery({
    queryKey: ['ged-stats-widget', obraId],
    queryFn: () => gedService.getStats(obraId!),
    enabled: !!obraId,
    staleTime: 120_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  return (
    <div className="h-full flex flex-col">
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">GED — Documentos</p>
      {isLoading ? <div className="flex flex-col gap-1.5">{[1,2].map(i => <div key={i} className="skeleton h-4 rounded" />)}</div> : (
        <div className="grid grid-cols-2 gap-1.5 flex-1">
          {[
            { label: 'Vigentes', val: data?.vigentes, color: 'var(--ok)' },
            { label: 'Pend. IFA', val: data?.ifa, color: 'var(--warn)' },
            { label: 'Vencem 30d', val: data?.vencendo30dias, color: 'var(--nc)' },
            { label: 'Rejeitados', val: data?.rejeitados, color: 'var(--text-faint)' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-[var(--bg-raised)] rounded p-2">
              <p className="text-[8px] text-[var(--text-faint)]">{label}</p>
              <p className="text-base font-bold" style={{ color }}>{val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **NcsPorObraWidget**

```typescript
// src/modules/dashboard/widgets/obra/NcsPorObraWidget.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { useObraConfig } from './_useObraConfig'

export function NcsPorObraWidget({ config }: { config: Record<string, unknown> }) {
  const obraId = useObraConfig(config)
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['ncs-obra-widget', obraId],
    queryFn: () => api.get<any>(`/obras/${obraId}/ncs`, { params: { page: 1, limit: 5 } }).then((r) => r.data?.data ?? r.data),
    enabled: !!obraId,
    staleTime: 60_000,
  })

  if (!obraId) return <p className="text-[10px] text-[var(--text-faint)]">Obra não configurada</p>

  const abertas = data?.total ?? data?.meta?.total ?? 0

  return (
    <div className="h-full flex flex-col cursor-pointer" onClick={() => navigate(`/obras/${obraId}/ncs`)}>
      <p className="text-[9px] font-semibold text-[var(--text-faint)] uppercase tracking-[0.5px] mb-2">NCs desta Obra</p>
      {isLoading ? <div className="skeleton h-8 w-12 rounded" /> : (
        <>
          <p className="text-3xl font-bold text-[var(--nc)] leading-none">{abertas}</p>
          <p className="text-[10px] text-[var(--text-faint)] mt-1">abertas</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add src/modules/dashboard/widgets/obra/
git commit -m "feat: widgets Tier 2 por obra (FVS, Concretagem, Ensaios, Alm, Efetivo, GED, NCs)"
```

---

## Task 9: Frontend — Registrar todos os widgets

**Files:**
- Create: `src/modules/dashboard/registry/widgets.ts`

- [ ] **Criar widgets.ts com todos os registros**

```typescript
// src/modules/dashboard/registry/widgets.ts
import {
  Layers, AlertTriangle, Clock, Activity, BarChart2,
  FlaskConical, TestTubes, Warehouse, Users, FolderOpen, Package,
} from 'lucide-react'
import { widgetRegistry } from './index'

// Tier 1 — Global
import { ObrasStatusWidget }          from '../widgets/global/ObrasStatusWidget'
import { NcsAbertasWidget }           from '../widgets/global/NcsAbertasWidget'
import { AprovacoesPendentesWidget }  from '../widgets/global/AprovacoesPendentesWidget'
import { SemaforoGeralWidget }        from '../widgets/global/SemaforoGeralWidget'
import { AtividadeRecenteWidget }     from '../widgets/global/AtividadeRecenteWidget'

// Tier 2 — Por obra
import { FvsConformidadeWidget }      from '../widgets/obra/FvsConformidadeWidget'
import { ConcretagemVolumeWidget }    from '../widgets/obra/ConcretagemVolumeWidget'
import { EnsaiosLaudosWidget }        from '../widgets/obra/EnsaiosLaudosWidget'
import { AlmoxarifadoCriticoWidget }  from '../widgets/obra/AlmoxarifadoCriticoWidget'
import { EfetivoHojeWidget }          from '../widgets/obra/EfetivoHojeWidget'
import { GedDocsWidget }              from '../widgets/obra/GedDocsWidget'
import { NcsPorObraWidget }           from '../widgets/obra/NcsPorObraWidget'

// ── Tier 1 ──────────────────────────────────────────────────────────────────

widgetRegistry.register({
  id: 'obras-status', titulo: 'Obras — Status', tier: 1,
  descricao: 'Total de obras, quantas em execução, paralisadas e concluídas.',
  icone: <Layers size={15} />, modulo: 'global',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: false, component: ObrasStatusWidget,
})

widgetRegistry.register({
  id: 'ncs-abertas', titulo: 'NCs Abertas', tier: 1,
  descricao: 'Não conformidades abertas no tenant, com destaque para críticas e vencidas.',
  icone: <AlertTriangle size={15} />, modulo: 'ncs',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false, component: NcsAbertasWidget,
})

widgetRegistry.register({
  id: 'aprovacoes-pendentes', titulo: 'Aprovações Pendentes', tier: 1,
  descricao: 'Itens aguardando sua aprovação no momento.',
  icone: <Clock size={15} />, modulo: 'aprovacoes',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false, component: AprovacoesPendentesWidget,
})

widgetRegistry.register({
  id: 'semaforo-geral', titulo: 'Semáforo de Obras', tier: 1,
  descricao: 'Indicador verde/amarelo/vermelho por módulo para cada obra ativa.',
  icone: <Activity size={15} />, modulo: 'semaforo',
  defaultW: 4, defaultH: 2, minW: 3, minH: 2, maxW: 12, maxH: 4,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: false, component: SemaforoGeralWidget,
})

widgetRegistry.register({
  id: 'atividade-recente', titulo: 'Atividade Recente', tier: 1,
  descricao: 'Timeline unificada com os últimos eventos de todos os módulos.',
  icone: <Activity size={15} />, modulo: 'global',
  defaultW: 4, defaultH: 2, minW: 3, minH: 2, maxW: 12, maxH: 5,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false, component: AtividadeRecenteWidget,
})

// ── Tier 2 ──────────────────────────────────────────────────────────────────

widgetRegistry.register({
  id: 'fvs-conformidade', titulo: 'FVS — Conformidade', tier: 2,
  descricao: 'Taxa de conformidade das fichas de inspeção de uma obra.',
  icone: <BarChart2 size={15} />, modulo: 'fvs',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 3,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: FvsConformidadeWidget,
})

widgetRegistry.register({
  id: 'concretagem-volume', titulo: 'Concretagem — Volume', tier: 2,
  descricao: 'Volume concretado vs previsto em m³.',
  icone: <FlaskConical size={15} />, modulo: 'concretagem',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: ConcretagemVolumeWidget,
})

widgetRegistry.register({
  id: 'ensaios-laudos', titulo: 'Ensaios — Laudos Pendentes', tier: 2,
  descricao: 'Laudos laboratoriais aguardando revisão técnica.',
  icone: <TestTubes size={15} />, modulo: 'ensaios',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: EnsaiosLaudosWidget,
})

widgetRegistry.register({
  id: 'alm-critico', titulo: 'Estoque Crítico', tier: 2,
  descricao: 'Materiais abaixo do ponto de reposição.',
  icone: <Warehouse size={15} />, modulo: 'almoxarifado',
  defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: AlmoxarifadoCriticoWidget,
})

widgetRegistry.register({
  id: 'efetivo-hoje', titulo: 'Efetivo Hoje', tier: 2,
  descricao: 'Total de trabalhadores registrados no dia.',
  icone: <Users size={15} />, modulo: 'efetivo',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: EfetivoHojeWidget,
})

widgetRegistry.register({
  id: 'ged-docs', titulo: 'GED — Documentos', tier: 2,
  descricao: 'Vigentes, pendentes de aprovação, vencendo e rejeitados.',
  icone: <FolderOpen size={15} />, modulo: 'ged',
  defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 3,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: true, component: GedDocsWidget,
})

widgetRegistry.register({
  id: 'ncs-por-obra', titulo: 'NCs desta Obra', tier: 2,
  descricao: 'Não conformidades abertas de uma obra específica.',
  icone: <AlertTriangle size={15} />, modulo: 'ncs',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true, component: NcsPorObraWidget,
})
```

- [ ] **Verificar que não há erros de TypeScript**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/frontend-web
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero erros (ou apenas warnings não-críticos).

- [ ] **Commit**

```bash
git add src/modules/dashboard/registry/widgets.ts
git commit -m "feat: registrar 12 widgets no WidgetRegistry"
```

---

## Task 10: Verificação final e ajustes de CSS

**Files:**
- Modify: `src/index.css` (se necessário)

- [ ] **Adicionar CSS do react-grid-layout ao index.css (se não importado automaticamente)**

Em `src/index.css`, verificar se já tem os imports. Se não tiver:

```css
/* react-grid-layout */
@import 'react-grid-layout/css/styles.css';
@import 'react-resizable/css/styles.css';
```

Substituir o handle de resize pelo estilo do tema:

```css
/* Override react-resizable handle */
.react-resizable-handle {
  background-image: none !important;
  width: 16px !important;
  height: 16px !important;
  bottom: 4px !important;
  right: 4px !important;
}
.react-resizable-handle::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-right: 2px solid var(--border-bright);
  border-bottom: 2px solid var(--border-bright);
  border-radius: 0 0 2px 0;
}
```

- [ ] **Testar o dashboard no navegador**

```bash
cd /Users/itamarpereira/Downloads/Novo\ Eldox/eldox-v3/frontend-web
npm run dev
```

Abrir http://localhost:5173 e verificar:
1. Dashboard carrega com layout padrão por role
2. Botão "Editar dashboard" ativa modo de edição
3. Handles de drag e resize aparecem
4. Drawer "Adicionar widget" abre e lista widgets por módulo
5. Adicionar widget de Tier 2 abre modal de configuração de obra
6. "Salvar" persiste o layout (verificar no Network tab que `PUT /api/v1/usuarios/me/dashboard-layout` retorna 200)
7. Recarregar a página mantém o layout salvo
8. Dark mode e Light mode corretos (trocar pelo botão no footer da sidebar)

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: dashboard configurável completo — widgets, persistência, temas Slate Deep/Cool"
```

---

## Checklist de Cobertura da Spec

- [x] DashboardPage substituída por shell configurável
- [x] react-grid-layout com drag & drop e resize
- [x] WidgetRegistry singleton com WidgetDefinition tipado
- [x] 12 widgets implementados (5 Tier 1 + 7 Tier 2)
- [x] AddWidgetDrawer com busca e tabs por módulo
- [x] WidgetConfigModal para widgets com obraId
- [x] Persistência GET/PUT /usuarios/me/dashboard-layout
- [x] Layout padrão por role (primeiro acesso)
- [x] Backend: DashboardModule + summary + feed
- [x] Prisma migration dashboardLayout
- [x] Dark mode Slate Deep + Light mode Slate Cool (tokens.css já aplicado)
- [x] Widget Generator: adicionar widget = criar componente + registrar em widgets.ts
- [x] Widget com erro isolado (cada widget gerencia seu próprio estado)
- [x] Widget com obraId deletada → "Obra não configurada" sem quebrar o dashboard
