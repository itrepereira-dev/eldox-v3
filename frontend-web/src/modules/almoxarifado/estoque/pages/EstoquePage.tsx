// frontend-web/src/modules/almoxarifado/estoque/pages/EstoquePage.tsx
import { useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AlertOctagon, AlertTriangle, CheckCircle, Plus, X, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { api } from '@/services/api'
import { useToast } from '@/components/ui'
import { useSaldoEstoque, useLocaisEstoque, useRegistrarMovimento } from '../hooks/useEstoque'
import type { AlmEstoqueSaldo, AlmMovimentoTipo } from '../../_service/almoxarifado.service'

// ── Movimento Manual Modal ────────────────────────────────────────────────────

interface CatalogoItem { id: number; nome: string; codigo: string | null; unidade_padrao: string | null }

function MovimentoManualModal({
  onClose,
  saldoPreselecionado,
}: {
  onClose: () => void
  saldoPreselecionado?: AlmEstoqueSaldo
}) {
  const toast = useToast()
  const registrar = useRegistrarMovimento()
  const { data: locais = [] } = useLocaisEstoque()

  const [localId, setLocalId] = useState<number | ''>(saldoPreselecionado?.local_id ?? '')
  const [catalogo, setCatalogo] = useState<{ id: number; nome: string; unidade: string } | null>(
    saldoPreselecionado
      ? { id: saldoPreselecionado.catalogo_id, nome: saldoPreselecionado.catalogo_nome, unidade: saldoPreselecionado.unidade }
      : null,
  )
  const [tipo, setTipo] = useState<AlmMovimentoTipo>('entrada')
  const [quantidade, setQuantidade] = useState<string>('1')
  const [observacao, setObservacao] = useState('')

  // Busca catálogo
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<CatalogoItem[]>([])
  const [buscando, setBuscando] = useState(false)
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleQuery(v: string) {
    setQuery(v)
    if (debRef.current) clearTimeout(debRef.current)
    if (v.trim().length < 2) { setResultados([]); return }
    debRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await api.get<CatalogoItem[]>(`/fvm/catalogo?busca=${encodeURIComponent(v)}&limit=10`)
        setResultados(Array.isArray(data) ? data : [])
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
  }

  function selecionarCatalogo(c: CatalogoItem) {
    setCatalogo({ id: c.id, nome: c.nome, unidade: c.unidade_padrao ?? 'un' })
    setQuery('')
    setResultados([])
  }

  async function handleSalvar() {
    if (!localId || !catalogo || !quantidade) return
    try {
      await registrar.mutateAsync({
        local_id: Number(localId),
        catalogo_id: catalogo.id,
        tipo,
        quantidade: Number(quantidade),
        unidade: catalogo.unidade,
        observacao: observacao.trim() || undefined,
      })
      toast.success(`Movimento de ${tipo} registrado`)
      onClose()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao registrar movimento')
    }
  }

  const canSubmit = !!localId && !!catalogo && Number(quantidade) > 0

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.4)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h2 className="text-[16px] font-bold text-[var(--text-high)] m-0">Novo Movimento Manual</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-[var(--text-low)] hover:text-[var(--text-high)]"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Tipo */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(['entrada', 'saida', 'ajuste', 'perda'] as AlmMovimentoTipo[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-sm border text-[12px] font-medium capitalize transition-colors',
                    tipo === t
                      ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                      : 'border-[var(--border-dim)] text-[var(--text-low)] hover:text-[var(--text-high)]',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Local */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider mb-1.5">Local</label>
            <select
              value={localId}
              onChange={(e) => setLocalId(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Selecionar local…</option>
              {locais.map((l: { id: number; nome: string }) => (
                <option key={l.id} value={l.id}>{l.nome}</option>
              ))}
            </select>
          </div>

          {/* Catálogo */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider mb-1.5">Material</label>
            {catalogo ? (
              <div className="flex items-center justify-between gap-2 h-9 px-3 bg-[var(--ok-dim,rgba(63,185,80,.08))] border border-[var(--ok)]/30 rounded-sm">
                <span className="text-[13px] text-[var(--text-high)] truncate">{catalogo.nome} · <span className="text-[var(--text-faint)] font-mono">{catalogo.unidade}</span></span>
                <button type="button" onClick={() => setCatalogo(null)} className="text-[var(--text-low)] hover:text-[var(--nc)]" aria-label="Trocar"><X size={14} /></button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm focus-within:border-[var(--accent)]">
                  <Search size={13} className="text-[var(--text-faint)]" />
                  <input
                    className="flex-1 bg-transparent text-[13px] text-[var(--text-high)] outline-none placeholder:text-[var(--text-faint)]"
                    placeholder="Buscar material no catálogo…"
                    value={query}
                    onChange={(e) => handleQuery(e.target.value)}
                  />
                  {buscando && <span className="text-[11px] text-[var(--text-faint)]">…</span>}
                </div>
                {resultados.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-sm shadow-lg max-h-[180px] overflow-y-auto z-10">
                    {resultados.map(r => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => selecionarCatalogo(r)}
                        className="w-full text-left px-3 py-2 text-[13px] text-[var(--text-high)] hover:bg-[var(--bg-hover)] border-b border-[var(--border-dim)] last:border-0"
                      >
                        {r.nome}
                        {r.codigo && <span className="text-[var(--text-faint)] ml-2 font-mono text-[11px]">{r.codigo}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider mb-1.5">Quantidade</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="flex-1 h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
              />
              <span className="text-[13px] text-[var(--text-faint)] font-mono min-w-[32px]">{catalogo?.unidade ?? '—'}</span>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider mb-1.5">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex: Recebimento da NF 12345"
              className="w-full px-3 py-2 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            disabled={registrar.isPending}
            className="px-4 py-2 text-[13px] border border-[var(--border)] rounded-sm text-[var(--text-high)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!canSubmit || registrar.isPending}
            className="px-5 py-2 text-[13px] font-semibold bg-[var(--accent)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {registrar.isPending ? 'Salvando…' : (<><Plus size={14} /> Registrar</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Nível Badge ───────────────────────────────────────────────────────────────

function NivelBadge({ nivel, quantidade, estoqueMin }: {
  nivel: string; quantidade: number; estoqueMin: number
}) {
  if (nivel === 'critico') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--nc-bg)] text-[var(--nc)]">
      <AlertOctagon size={9} /> Crítico
    </span>
  )
  if (nivel === 'atencao') return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--warn-bg)] text-[var(--warn)]">
        <AlertTriangle size={9} /> Atenção
      </span>
      {estoqueMin > 0 && (
        <div className="w-16 h-1 bg-[var(--border-dim)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--warn)] rounded-full"
            style={{ width: `${Math.min(100, (quantidade / estoqueMin) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ok-bg)] text-[var(--ok)]">
        <CheckCircle size={9} /> Normal
      </span>
      <div className="w-16 h-1 bg-[var(--border-dim)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--ok)] rounded-full" style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function SaldoRow({ saldo, onMovimentar }: { saldo: AlmEstoqueSaldo; onMovimentar: (s: AlmEstoqueSaldo) => void }) {
  return (
    <tr className="hover:bg-[var(--bg-raised)] transition-colors">
      <td className="px-3 py-2.5 text-[13px] font-medium text-[var(--text-high)]">
        {saldo.catalogo_nome}
      </td>
      <td className="px-3 py-2.5 text-[11px] text-[var(--text-faint)] font-mono">
        {saldo.catalogo_codigo ?? '—'}
      </td>
      <td className="px-3 py-2.5 text-[13px] font-mono
        text-[var(--text-low)]">
        {saldo.unidade}
      </td>
      <td className={cn(
        'px-3 py-2.5 text-[13px] font-bold font-mono',
        saldo.nivel === 'critico' ? 'text-[var(--nc)]' :
        saldo.nivel === 'atencao' ? 'text-[var(--warn)]' : 'text-[var(--text-high)]',
      )}>
        {Number(saldo.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2.5 text-[12px] font-mono text-[var(--text-faint)]">
        {saldo.estoque_min > 0
          ? Number(saldo.estoque_min).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
          : '—'}
      </td>
      <td className="px-3 py-2.5">
        <NivelBadge
          nivel={saldo.nivel}
          quantidade={saldo.quantidade}
          estoqueMin={saldo.estoque_min}
        />
      </td>
      <td className="px-3 py-2.5 text-[12px] text-[var(--text-faint)]">
        {saldo.local_nome ?? 'Geral'}
      </td>
      <td className="px-3 py-2.5">
        <button
          onClick={() => onMovimentar(saldo)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-medium rounded-sm',
            'border border-[var(--border-dim)] text-[var(--text-low)]',
            'hover:text-[var(--text-high)] hover:border-[var(--border)]',
            'transition-colors',
          )}
        >
          Movimentar
        </button>
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function EstoquePage() {
  const { obraId } = useParams<{ obraId: string }>()
  const navigate = useNavigate()
  const id = Number(obraId)

  const [nivelFiltro, setNivelFiltro]   = useState('')
  const [busca, setBusca]               = useState('')
  const [movimentoOpen, setMovimentoOpen] = useState(false)
  const [saldoParaMovimentar, setSaldoParaMovimentar] = useState<AlmEstoqueSaldo | undefined>(undefined)

  const { data: saldos = [], isLoading } = useSaldoEstoque(id, {
    nivel: nivelFiltro || undefined,
  })
  const { data: locais = [] } = useLocaisEstoque(id)

  const filtered = busca
    ? saldos.filter((s) =>
        s.catalogo_nome.toLowerCase().includes(busca.toLowerCase()) ||
        (s.catalogo_codigo ?? '').toLowerCase().includes(busca.toLowerCase()),
      )
    : saldos

  const criticos = saldos.filter((s) => s.nivel === 'critico').length
  const atencao  = saldos.filter((s) => s.nivel === 'atencao').length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[18px] font-bold text-[var(--text-high)]">Estoque</h1>
          <p className="text-[13px] text-[var(--text-low)] mt-0.5">
            {saldos.length} itens cadastrados
            {criticos > 0 && (
              <span className="ml-2 text-[var(--nc)]">· {criticos} crítico{criticos > 1 ? 's' : ''}</span>
            )}
            {atencao > 0 && (
              <span className="ml-2 text-[var(--warn)]">· {atencao} atenção</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/almoxarifado/transferencias')}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-sm text-[13px] font-medium',
              'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
              'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
            )}
          >
            Transferência
          </button>
          <button
            onClick={() => { setSaldoParaMovimentar(undefined); setMovimentoOpen(true); }}
            className={cn(
              'flex items-center gap-1.5 px-3 h-9 rounded-sm',
              'bg-[var(--accent)] text-white text-[13px] font-semibold',
              'hover:opacity-90 transition-opacity',
            )}
          >
            <Plus size={13} /> Movimento Manual
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-dim)] mb-5">
        {[
          { label: 'Saldo Atual', to: '' },
          { label: 'Movimentos', to: `/obras/${obraId}/almoxarifado/estoque/movimentos` },
          { label: `Alertas${criticos + atencao > 0 ? ` (${criticos + atencao})` : ''}`,
            to: `/obras/${obraId}/almoxarifado/estoque/alertas` },
        ].map((tab) => (
          tab.to ? (
            <Link
              key={tab.label}
              to={tab.to}
              className="px-4 py-2 text-[13px] font-medium text-[var(--text-low)] border-b-2 border-transparent hover:text-[var(--text-high)] transition-colors"
            >
              {tab.label}
            </Link>
          ) : (
            <span
              key={tab.label}
              className="px-4 py-2 text-[13px] font-semibold text-[var(--accent)] border-b-2 border-[var(--accent)]"
            >
              {tab.label}
            </span>
          )
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          className={cn(
            'flex-1 min-w-[200px] max-w-[280px] h-8 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[13px] text-[var(--text-high)] placeholder:text-[var(--text-faint)]',
            'outline-none focus:border-[var(--accent)]',
          )}
          placeholder="Buscar material..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className={cn(
            'h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[12px] text-[var(--text-low)] outline-none',
          )}
          value={nivelFiltro}
          onChange={(e) => setNivelFiltro(e.target.value)}
        >
          <option value="">Todos os níveis</option>
          <option value="critico">Crítico</option>
          <option value="atencao">Atenção</option>
          <option value="normal">Normal</option>
        </select>
        <select
          className={cn(
            'h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'text-[12px] text-[var(--text-low)] outline-none',
          )}
        >
          <option>Todos os locais</option>
          {locais.map((l: { id: number; nome: string }) => <option key={l.id}>{l.nome}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Código', 'Un.', 'Saldo', 'Est. Mínimo', 'Nível', 'Local', ''].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="skeleton h-4 rounded" style={{ width: j === 0 ? '140px' : '60px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[13px] text-[var(--text-faint)]">
                    {busca ? 'Nenhum material encontrado para esta busca.' : 'Nenhum item em estoque ainda.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <SaldoRow
                    key={s.id}
                    saldo={s}
                    onMovimentar={(saldo) => { setSaldoParaMovimentar(saldo); setMovimentoOpen(true); }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {movimentoOpen && (
        <MovimentoManualModal
          saldoPreselecionado={saldoParaMovimentar}
          onClose={() => { setMovimentoOpen(false); setSaldoParaMovimentar(undefined); }}
        />
      )}
    </div>
  )
}
