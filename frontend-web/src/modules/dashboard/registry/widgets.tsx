// src/modules/dashboard/registry/widgets.tsx
import React from 'react'
import {
  Layers, AlertTriangle, Clock, Activity, BarChart2,
  FlaskConical, TestTubes, Warehouse, Users, FolderOpen,
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
  icone: React.createElement(Layers, { size: 15 }), modulo: 'global',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: false,
  component: ObrasStatusWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'ncs-abertas', titulo: 'NCs Abertas', tier: 1,
  descricao: 'Não conformidades abertas no tenant, com destaque para críticas e vencidas.',
  icone: React.createElement(AlertTriangle, { size: 15 }), modulo: 'ncs',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false,
  component: NcsAbertasWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'aprovacoes-pendentes', titulo: 'Aprovações Pendentes', tier: 1,
  descricao: 'Itens aguardando sua aprovação no momento.',
  icone: React.createElement(Clock, { size: 15 }), modulo: 'aprovacoes',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false,
  component: AprovacoesPendentesWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'semaforo-geral', titulo: 'Semáforo de Obras', tier: 1,
  descricao: 'Indicador verde/amarelo/vermelho por módulo para cada obra ativa.',
  icone: React.createElement(Activity, { size: 15 }), modulo: 'semaforo',
  defaultW: 4, defaultH: 2, minW: 3, minH: 2, maxW: 12, maxH: 4,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: false,
  component: SemaforoGeralWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'atividade-recente', titulo: 'Atividade Recente', tier: 1,
  descricao: 'Timeline unificada com os últimos eventos de todos os módulos.',
  icone: React.createElement(Activity, { size: 15 }), modulo: 'global',
  defaultW: 4, defaultH: 2, minW: 3, minH: 2, maxW: 12, maxH: 5,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: false,
  component: AtividadeRecenteWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

// ── Tier 2 ──────────────────────────────────────────────────────────────────

widgetRegistry.register({
  id: 'fvs-conformidade', titulo: 'FVS — Conformidade', tier: 2,
  descricao: 'Taxa de conformidade das fichas de inspeção de uma obra.',
  icone: React.createElement(BarChart2, { size: 15 }), modulo: 'fvs',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 3,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: FvsConformidadeWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'concretagem-volume', titulo: 'Concretagem — Volume', tier: 2,
  descricao: 'Volume concretado vs previsto em m³.',
  icone: React.createElement(FlaskConical, { size: 15 }), modulo: 'concretagem',
  defaultW: 3, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: ConcretagemVolumeWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'ensaios-laudos', titulo: 'Ensaios — Laudos Pendentes', tier: 2,
  descricao: 'Laudos laboratoriais aguardando revisão técnica.',
  icone: React.createElement(TestTubes, { size: 15 }), modulo: 'ensaios',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: EnsaiosLaudosWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'alm-critico', titulo: 'Estoque Crítico', tier: 2,
  descricao: 'Materiais abaixo do ponto de reposição.',
  icone: React.createElement(Warehouse, { size: 15 }), modulo: 'almoxarifado',
  defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: AlmoxarifadoCriticoWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'efetivo-hoje', titulo: 'Efetivo Hoje', tier: 2,
  descricao: 'Total de trabalhadores registrados no dia.',
  icone: React.createElement(Users, { size: 15 }), modulo: 'efetivo',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: EfetivoHojeWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'ged-docs', titulo: 'GED — Documentos', tier: 2,
  descricao: 'Vigentes, pendentes de aprovação, vencendo e rejeitados.',
  icone: React.createElement(FolderOpen, { size: 15 }), modulo: 'ged',
  defaultW: 3, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 3,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO','VISITANTE'],
  needsObraId: true,
  component: GedDocsWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})

widgetRegistry.register({
  id: 'ncs-por-obra', titulo: 'NCs desta Obra', tier: 2,
  descricao: 'Não conformidades abertas de uma obra específica.',
  icone: React.createElement(AlertTriangle, { size: 15 }), modulo: 'ncs',
  defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,
  roles: ['ADMIN_TENANT','ENGENHEIRO','TECNICO'],
  needsObraId: true,
  component: NcsPorObraWidget as React.FC<{ config: Record<string, unknown>; instanceId: string }>,
})
