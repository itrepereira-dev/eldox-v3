// frontend-web/src/modules/almoxarifado/dashboard/pages/AlmoxarifadoDashboard.tsx
import { useParams, Link } from 'react-router-dom'
import {
  AlertOctagon, Clock, FileText, ShoppingCart, CheckCircle,
  BarChart2, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAlmDashboardKpis, useAlertas } from '../../estoque/hooks/useEstoque'
import type { AlmAlertaEstoque } from '../../_service/almoxarifado.service'

// ── KPI Card ──────────────────────────────────────────────────────────────────

type KpiVariant = 'ok' | 'warn' | 'nc' | 'run' | 'off'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  variant?: KpiVariant
  icon?: React.ReactNode
}

function KpiCard({ label, value, sub, variant = 'off', icon: _icon }: KpiCardProps) {
  const top: Record<KpiVariant, string> = {
    ok:   'bg-[var(--ok)]',
    warn: 'bg-[var(--warn)]',
    nc:   'bg-[var(--nc)]',
    run:  'bg-[var(--run)]',
    off:  'bg-[var(--off)]',
  }
  return (
    <div className="relative bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
      <div className={cn('absolute top-0 left-0 right-0 h-[2px]', top[variant])} />
      <div className="p-4 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono mb-2">
          {label}
        </p>
        <p className="text-[28px] font-bold text-[var(--text-high)] font-mono leading-none">
          {value}
        </p>
        {sub && <p className="text-[11px] text-[var(--text-low)] mt-1">{sub}</p>}
      </div>
    </div>
  )
}

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
  const { obraId } = useParams<{ obraId: string }>()
  const id = Number(obraId)

  const { data: kpis, isLoading: kpisLoading } = useAlmDashboardKpis(id)
  const { data: alertas = [] } = useAlertas(id)

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
          to={`/obras/${obraId}/almoxarifado/solicitacoes/nova`}
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
      <div className="grid grid-cols-5 gap-3 mb-6">
        {kpisLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-md skeleton" />
          ))
        ) : (
          <>
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
              label="NF-e p/ Match"
              value={kpis?.nfe_aguardando_match ?? 0}
              sub="revisão manual IA"
              variant={(kpis?.nfe_aguardando_match ?? 0) > 0 ? 'nc' : 'ok'}
            />
            <KpiCard
              label="OCs em Aberto"
              value={fmtCurrency(kpis?.valor_oc_aberto ?? 0)}
              sub="valor total emitido"
              variant="run"
            />
            <KpiCard
              label="Conformidade NF-e"
              value={`${kpis?.conformidade_recebimento_pct ?? 100}%`}
              sub="últimos 30 dias"
              variant={(kpis?.conformidade_recebimento_pct ?? 100) >= 90 ? 'ok' : 'warn'}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Alertas Críticos */}
        <div className="col-span-1 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-dim)]">
            <span className="text-[13px] font-semibold text-[var(--text-high)] flex items-center gap-2">
              <AlertTriangle size={14} className="text-[var(--warn)]" />
              Alertas Ativos
            </span>
            <Link
              to={`/obras/${obraId}/almoxarifado/estoque/alertas`}
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
              to: `/obras/${obraId}/almoxarifado/estoque`,
              icon: <BarChart2 size={20} />,
              label: 'Estoque',
              sub: 'Saldo e movimentos',
              variant: 'run',
            },
            {
              to: `/obras/${obraId}/almoxarifado/solicitacoes`,
              icon: <FileText size={20} />,
              label: 'Solicitações',
              sub: `${kpis?.solicitacoes_pendentes ?? 0} pendentes`,
              variant: 'warn',
            },
            {
              to: `/obras/${obraId}/almoxarifado/compras/ocs`,
              icon: <ShoppingCart size={20} />,
              label: 'Ordens de Compra',
              sub: fmtCurrency(kpis?.valor_oc_aberto ?? 0) + ' em aberto',
              variant: 'ok',
            },
            {
              to: `/obras/${obraId}/almoxarifado/notas-fiscais`,
              icon: <CheckCircle size={20} />,
              label: 'Notas Fiscais',
              sub: `${kpis?.nfe_aguardando_match ?? 0} aguardando match`,
              variant: (kpis?.nfe_aguardando_match ?? 0) > 0 ? 'nc' : 'ok',
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
