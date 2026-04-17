// frontend-web/src/modules/almoxarifado/dashboard/pages/AlmoxarifadoDashboard.tsx
import { Link } from 'react-router-dom'
import {
  AlertOctagon, Clock, FileText, ShoppingCart, CheckCircle,
  BarChart2, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard'
import { useAlmDashboardKpis, useAlertas } from '../../estoque/hooks/useEstoque'
import type { AlmAlertaEstoque } from '../../_service/almoxarifado.service'

// ── Alerta Row ────────────────────────────────────────────────────────────────

function AlertaRow({ alerta }: { alerta: AlmAlertaEstoque }) {
  const isCritico = alerta.nivel === 'critico'

  const Icon =
    alerta.tipo === 'anomalia' ? TrendingUp :
    alerta.tipo === 'reposicao_prevista' ? Clock :
    AlertOctagon

  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--border-dim)] last:border-0">
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-sm flex items-center justify-center',
          isCritico
            ? 'bg-[var(--nc-bg)] text-[var(--nc)]'
            : 'bg-[var(--warn-bg)] text-[var(--warn)]',
        )}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[var(--text-high)]">{alerta.catalogo_nome}</p>
        <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{alerta.mensagem}</p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AlmoxarifadoDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useAlmDashboardKpis()
  const { data: alertas = [] } = useAlertas()

  const alertasCriticos = alertas.filter((a) => a.nivel === 'critico')
  const alertasAtencao  = alertas.filter((a) => a.nivel === 'atencao')

  function fmtCurrency(v: number) {
    if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`
    return `R$${v.toFixed(0)}`
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Almoxarifado</h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">Visão geral · materiais e estoque</p>
        </div>
        <Link
          to="/almoxarifado/solicitacoes/nova"
          className={cn(
            'flex items-center gap-1.5 px-3 h-9 rounded-sm',
            'bg-[var(--accent)] text-white text-[13px] font-semibold',
            'hover:bg-[var(--accent-hover)] transition-colors',
          )}
        >
          + Nova Solicitação
        </Link>
      </div>

      {/* KPIs */}
      {kpisLoading ? (
        <KpiGrid cols={4} className="mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-md skeleton" />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid cols={4} className="mb-6">
          <KpiCard
            label="Estoque Mínimo"
            value={kpis?.itens_estoque_minimo ?? 0}
            sub="itens críticos"
            variant={(kpis?.itens_estoque_minimo ?? 0) > 0 ? 'nc' : 'ok'}
          />
          <KpiCard
            label="Solicitações Pendentes"
            value={kpis?.solicitacoes_pendentes ?? 0}
            sub="aguardando aprovação"
            variant={(kpis?.solicitacoes_pendentes ?? 0) > 0 ? 'warn' : 'ok'}
          />
          <KpiCard
            label="NF-e p/ Aceite"
            value={kpis?.nfe_aguardando_match ?? 0}
            sub="revisão necessária"
            variant={(kpis?.nfe_aguardando_match ?? 0) > 0 ? 'nc' : 'ok'}
          />
          <KpiCard
            label="OCs em Aberto"
            value={fmtCurrency(kpis?.valor_oc_aberto ?? 0)}
            sub="valor total emitido"
            variant="run"
          />
        </KpiGrid>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Alertas Críticos */}
        <div className="col-span-1 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)]">
            <span className="text-[13px] font-semibold text-[var(--text-high)] flex items-center gap-2">
              <AlertTriangle size={14} className="text-[var(--warn)]" />
              Alertas Ativos
            </span>
            <Link
              to="/almoxarifado/estoque/alertas"
              className="text-[12px] text-[var(--accent)] hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <div className="px-4">
            {alertas.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-[var(--text-faint)]">
                Nenhum alerta ativo ✓
              </p>
            ) : (
              [...alertasCriticos, ...alertasAtencao].slice(0, 4).map((a) => (
                <AlertaRow key={a.id} alerta={a} />
              ))
            )}
          </div>
        </div>

        {/* Links Rápidos */}
        <div className="col-span-2 grid grid-cols-2 gap-3 content-start">
          {[
            {
              to: '/almoxarifado/estoque',
              icon: <BarChart2 size={20} />,
              label: 'Estoque',
              sub: 'Saldo e movimentos',
            },
            {
              to: '/almoxarifado/solicitacoes',
              icon: <FileText size={20} />,
              label: 'Solicitações',
              sub: `${kpis?.solicitacoes_pendentes ?? 0} pendentes`,
            },
            {
              to: '/almoxarifado/ocs',
              icon: <ShoppingCart size={20} />,
              label: 'Ordens de Compra',
              sub: fmtCurrency(kpis?.valor_oc_aberto ?? 0) + ' em aberto',
            },
            {
              to: '/almoxarifado/nfes',
              icon: <CheckCircle size={20} />,
              label: 'Notas Fiscais',
              sub: `${kpis?.nfe_aguardando_match ?? 0} aguardando aceite`,
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-4 p-4',
                'bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md',
                'hover:bg-[var(--bg-raised)] hover:border-[var(--border)] transition-all',
                'group',
              )}
            >
              <span className="text-[var(--text-faint)] group-hover:text-[var(--accent)] transition-colors">
                {item.icon}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text-high)]">{item.label}</p>
                <p className="text-[11px] text-[var(--text-faint)]">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
