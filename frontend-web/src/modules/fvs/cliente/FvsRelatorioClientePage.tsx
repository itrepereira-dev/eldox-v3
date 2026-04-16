// frontend-web/src/modules/fvs/cliente/FvsRelatorioClientePage.tsx
// Portal PÚBLICO para clientes visualizarem relatório de inspeção FVS via token
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { CheckCircle, XCircle, AlertTriangle, Camera, FileText, Activity, Download } from 'lucide-react'

const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL?.replace('/api/v1','') ?? 'http://localhost:3000' })

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface FvsClienteData {
  ficha: {
    id: number; titulo: string; status: string
    obra_nome: string; obra_endereco: string | null
    criado_em: string; concluido_em: string
  }
  resumo: {
    taxa_conformidade_geral: number | null
    total_registros: number; total_ncs: number; ncs_criticas: number
  }
  servicos: Array<{
    servico_nome: string; total_registros: number
    conformes: number; nao_conformes: number; taxa_conformidade: number | null
  }>
  ncs: Array<{
    id: number; criticidade: string; status: string; descricao: string | null
    acao_corretiva: string | null; prazo: string | null
    servico_nome: string; item_nome: string | null; local_nome: string | null
  }>
  evidencias: Array<{
    id: number; url: string; thumbnail_url: string | null
    descricao: string | null; servico_nome: string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function taxa2color(t: number | null) {
  if (t === null) return '#999'
  if (t >= 90) return '#5cb85c'
  if (t >= 70) return '#f0ad4e'
  return '#d9534f'
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

const CRITICIDADE_LABEL: Record<string, string> = {
  critico: 'Crítico', maior: 'Maior', menor: 'Menor',
}
const CRITICIDADE_COLOR: Record<string, string> = {
  critico: '#d9534f', maior: '#f0ad4e', menor: '#5bc0de',
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function FvsRelatorioClientePage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery<FvsClienteData>({
    queryKey: ['fvs-cliente', token],
    queryFn: () => publicApi.get(`/fvs-cliente/${token}`).then(r => r.data),
    enabled: !!token,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <p className="text-sm text-[var(--text-low)]">Carregando relatório…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto text-[var(--nc)]" size={36} />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Link inválido ou expirado</h1>
          <p className="text-sm text-[var(--text-low)]">
            Solicite um novo link ao responsável pela inspeção.
          </p>
        </div>
      </div>
    )
  }

  const { ficha, resumo, servicos, ncs, evidencias } = data

  return (
    <div className="min-h-screen bg-[var(--bg-void)] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
              <FileText className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-high)]">
                Relatório de Inspeção FVS
              </h1>
              <p className="text-sm text-[var(--text-low)]">{ficha.titulo}</p>
              <p className="text-sm font-medium text-[var(--text-high)] mt-0.5">{ficha.obra_nome}</p>
              {ficha.obra_endereco && (
                <p className="text-xs text-[var(--text-low)]">{ficha.obra_endereco}</p>
              )}
            </div>
            </div>

            {/* Botão PDF */}
            <a
              href={`/fvs-cliente/${token}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors flex-shrink-0"
            >
              <Download size={14} />
              PDF
            </a>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-[var(--text-low)]">Criado: </span>
              <strong className="text-[var(--text-high)]">{formatDate(ficha.criado_em)}</strong>
            </div>
            <div>
              <span className="text-[var(--text-low)]">Concluído: </span>
              <strong className="text-[var(--text-high)]">{formatDate(ficha.concluido_em)}</strong>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
            <Activity size={18} className="mx-auto mb-1 text-[var(--accent)]" />
            <p className="text-2xl font-bold" style={{ color: taxa2color(resumo.taxa_conformidade_geral) }}>
              {resumo.taxa_conformidade_geral != null ? `${resumo.taxa_conformidade_geral}%` : '—'}
            </p>
            <p className="text-xs text-[var(--text-low)]">Conformidade</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
            <CheckCircle size={18} className="mx-auto mb-1 text-[var(--ok)]" />
            <p className="text-2xl font-bold text-[var(--ok)]">{resumo.total_registros}</p>
            <p className="text-xs text-[var(--text-low)]">Itens inspecionados</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
            <XCircle size={18} className="mx-auto mb-1 text-[var(--nc)]" />
            <p className="text-2xl font-bold text-[var(--nc)]">{resumo.total_ncs}</p>
            <p className="text-xs text-[var(--text-low)]">Não conformidades</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-center">
            <AlertTriangle size={18} className="mx-auto mb-1" style={{ color: CRITICIDADE_COLOR.critico }} />
            <p className="text-2xl font-bold" style={{ color: CRITICIDADE_COLOR.critico }}>{resumo.ncs_criticas}</p>
            <p className="text-xs text-[var(--text-low)]">NCs críticas</p>
          </div>
        </div>

        {/* Conformidade por serviço */}
        {servicos.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-high)] mb-4">Resultados por Serviço</h2>
            <div className="space-y-3">
              {servicos.map((sv, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--text-high)]">{sv.servico_nome}</span>
                    <span className="font-bold" style={{ color: taxa2color(sv.taxa_conformidade ? Number(sv.taxa_conformidade) : null) }}>
                      {sv.taxa_conformidade != null ? `${Number(sv.taxa_conformidade).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: sv.taxa_conformidade != null ? `${Math.min(100, Number(sv.taxa_conformidade))}%` : '0%',
                        background: taxa2color(sv.taxa_conformidade ? Number(sv.taxa_conformidade) : null),
                      }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-low)]">
                    {sv.conformes} conformes · {sv.nao_conformes} NCs · {sv.total_registros} total
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Não Conformidades */}
        {ncs.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <XCircle size={14} className="text-[var(--nc)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">
                Não Conformidades ({ncs.length})
              </h2>
            </div>
            <div className="space-y-3">
              {ncs.map((nc) => (
                <div key={nc.id} className="p-3 rounded-lg border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-semibold uppercase px-2 py-0.5 rounded-full"
                      style={{
                        color: CRITICIDADE_COLOR[nc.criticidade] ?? '#999',
                        background: `${CRITICIDADE_COLOR[nc.criticidade] ?? '#999'}22`,
                      }}
                    >
                      {CRITICIDADE_LABEL[nc.criticidade] ?? nc.criticidade}
                    </span>
                    <span className="text-xs text-[var(--text-low)]">{nc.servico_nome}</span>
                    {nc.local_nome && (
                      <span className="text-xs text-[var(--text-low)] bg-[var(--off-bg)] px-2 py-0.5 rounded-full">
                        {nc.local_nome}
                      </span>
                    )}
                  </div>
                  {nc.item_nome && <p className="text-xs font-medium text-[var(--text-high)]">{nc.item_nome}</p>}
                  {nc.descricao && <p className="text-sm text-[var(--text-high)]">{nc.descricao}</p>}
                  {nc.acao_corretiva && (
                    <p className="text-xs text-[var(--text-low)]">→ Ação: {nc.acao_corretiva}</p>
                  )}
                  {nc.prazo && (
                    <p className="text-xs text-[var(--text-low)]">Prazo: {formatDate(nc.prazo)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidências fotográficas */}
        {evidencias.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera size={14} className="text-[var(--text-low)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">
                Evidências Fotográficas ({evidencias.length})
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {evidencias.map((ev) => (
                <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer" className="block group">
                  <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-[4/3] bg-[var(--off-bg)]">
                    <img
                      src={ev.thumbnail_url ?? ev.url}
                      alt={ev.descricao ?? ev.servico_nome}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-low)] mt-1 truncate">
                    {ev.descricao ?? ev.servico_nome}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[var(--text-low)] pb-4">
          Gerado pelo sistema Eldox · Sistema de Gestão de Qualidade em Obras
        </p>
      </div>
    </div>
  )
}
