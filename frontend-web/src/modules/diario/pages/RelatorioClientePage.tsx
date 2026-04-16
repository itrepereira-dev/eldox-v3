// frontend-web/src/modules/diario/pages/RelatorioClientePage.tsx
// Página PÚBLICA para clientes visualizarem o RDO via token de compartilhamento
// Acessada via link: /relatorio-cliente/:token (sem autenticação)
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { AlertTriangle, Download, FileText, Cloud, Settings, Activity, Camera } from 'lucide-react'

// Axios sem autenticação para rotas públicas
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL?.replace('/api/v1','') ?? 'http://localhost:3000' })

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface RelatorioData {
  rdo_numero: number | string
  data: string
  status: string
  resumo_ia: string | null
  obra_nome: string
  obra_endereco: string | null
  validade_link: string | null
  clima: Array<{ periodo: string; condicao: string; praticavel: boolean; chuva_mm: number | null }>
  atividades: Array<{ descricao: string; pavimento: string | null; servico: string | null; percentual_executado: number | null }>
  ocorrencias: Array<{ tipo: string; descricao: string; grau_impacto: string | null; acao_tomada: string | null }>
  fotos: Array<{ url: string; thumbnail_url: string | null; legenda: string | null; nome_arquivo: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined) {
  if (!iso) return '-'
  try {
    return new Date(iso.includes('T') ? iso : iso + 'T00:00:00').toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

const STATUS_LABEL: Record<string, string> = {
  preenchendo: 'Em preenchimento',
  revisao: 'Em revisão',
  aprovado: 'Aprovado',
  cancelado: 'Cancelado',
}
const STATUS_COLOR: Record<string, string> = {
  preenchendo: '#f0ad4e',
  revisao: '#5bc0de',
  aprovado: '#5cb85c',
  cancelado: '#d9534f',
}

const PERIODO_LABEL: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function RelatorioClientePage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery<RelatorioData>({
    queryKey: ['relatorio-cliente', token],
    queryFn: () => publicApi.get(`/relatorio-cliente/${token}`).then(r => r.data?.data ?? r.data),
    enabled: !!token,
    retry: false,
  })

  const relatorio = data

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="text-sm text-[var(--text-low)]">Carregando relatório…</div>
      </div>
    )
  }

  if (isError || !relatorio) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto text-[var(--nc)]" size={36} />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Link inválido ou expirado</h1>
          <p className="text-sm text-[var(--text-low)]">
            Este link de relatório não é mais válido. Solicite um novo link ao responsável pela obra.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-void)] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                <FileText className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[var(--text-high)]">
                  Diário de Obra — RDO Nº {relatorio.rdo_numero}
                </h1>
                <p className="text-sm text-[var(--text-low)]">{relatorio.obra_nome}</p>
                {relatorio.obra_endereco && (
                  <p className="text-xs text-[var(--text-low)] mt-0.5">{relatorio.obra_endereco}</p>
                )}
              </div>
            </div>

            {/* Download PDF */}
            <a
              href={`/relatorio-cliente/${token}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--text-high)] hover:bg-[var(--bg-raised)] transition-colors flex-shrink-0"
            >
              <Download size={14} />
              PDF
            </a>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-[var(--text-low)]">Data: </span>
              <strong className="text-[var(--text-high)]">{formatDate(relatorio.data)}</strong>
            </div>
            <div>
              <span className="text-[var(--text-low)]">Status: </span>
              <span
                className="font-semibold"
                style={{ color: STATUS_COLOR[relatorio.status] ?? 'var(--text-high)' }}
              >
                {STATUS_LABEL[relatorio.status] ?? relatorio.status}
              </span>
            </div>
            {relatorio.validade_link && (
              <div>
                <span className="text-[var(--text-low)]">Link válido até: </span>
                <strong className="text-[var(--text-high)]">{formatDate(relatorio.validade_link)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Resumo IA */}
        {relatorio.resumo_ia && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-[var(--run)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">Resumo do dia</h2>
            </div>
            <p className="text-sm text-[var(--text-high)] leading-relaxed">{relatorio.resumo_ia}</p>
          </div>
        )}

        {/* Clima */}
        {relatorio.clima.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cloud size={14} className="text-[var(--text-low)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">Condições Climáticas</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {relatorio.clima.map((c) => (
                <div key={c.periodo} className="rounded-lg bg-[var(--off-bg)] p-3 text-center">
                  <div className="text-xs text-[var(--text-low)] mb-1">{PERIODO_LABEL[c.periodo] ?? c.periodo}</div>
                  <div className="text-sm font-semibold text-[var(--text-high)] capitalize">
                    {c.condicao.replace(/_/g, ' ')}
                  </div>
                  <div className={`text-xs mt-1 ${c.praticavel ? 'text-[var(--ok)]' : 'text-[var(--nc)]'}`}>
                    {c.praticavel ? 'Praticável' : 'Não praticável'}
                  </div>
                  {c.chuva_mm != null && (
                    <div className="text-xs text-[var(--text-low)] mt-0.5">{c.chuva_mm} mm chuva</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atividades */}
        {relatorio.atividades.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={14} className="text-[var(--text-low)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">
                Atividades ({relatorio.atividades.length})
              </h2>
            </div>
            <div className="space-y-2">
              {relatorio.atividades.map((a, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-[var(--off-bg)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-high)] truncate">{a.descricao}</p>
                    {(a.pavimento || a.servico) && (
                      <p className="text-xs text-[var(--text-low)] mt-0.5">
                        {[a.pavimento, a.servico].filter(Boolean).join(' / ')}
                      </p>
                    )}
                  </div>
                  {a.percentual_executado != null && (
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-bold text-[var(--ok)]">{a.percentual_executado}%</div>
                      <div className="w-16 h-1.5 rounded-full bg-[var(--border)] mt-0.5">
                        <div
                          className="h-full rounded-full bg-[var(--ok)]"
                          style={{ width: `${Math.min(100, a.percentual_executado)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ocorrências */}
        {relatorio.ocorrencias.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={14} className="text-[var(--warn)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">
                Ocorrências ({relatorio.ocorrencias.length})
              </h2>
            </div>
            <div className="space-y-3">
              {relatorio.ocorrencias.map((o, i) => (
                <div key={i} className="p-3 rounded-lg border border-[var(--border)] space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase text-[var(--warn)] bg-[var(--warn-bg)] px-2 py-0.5 rounded-full">
                      {o.tipo.replace(/_/g, ' ')}
                    </span>
                    {o.grau_impacto && (
                      <span className="text-xs text-[var(--text-low)] bg-[var(--off-bg)] px-2 py-0.5 rounded-full">
                        Impacto: {o.grau_impacto}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-high)]">{o.descricao}</p>
                  {o.acao_tomada && (
                    <p className="text-xs text-[var(--text-low)]">→ {o.acao_tomada}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos */}
        {relatorio.fotos.length > 0 && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Camera size={14} className="text-[var(--text-low)]" />
              <h2 className="text-sm font-semibold text-[var(--text-high)]">
                Registro Fotográfico ({relatorio.fotos.length})
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {relatorio.fotos.map((foto, i) => (
                <a key={i} href={foto.url} target="_blank" rel="noreferrer" className="block group">
                  <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-[4/3] bg-[var(--off-bg)]">
                    <img
                      src={foto.thumbnail_url ?? foto.url}
                      alt={foto.legenda ?? foto.nome_arquivo}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                  {foto.legenda && (
                    <p className="text-xs text-[var(--text-low)] mt-1 truncate">{foto.legenda}</p>
                  )}
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
