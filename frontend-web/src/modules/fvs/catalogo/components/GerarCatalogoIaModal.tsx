// frontend-web/src/modules/fvs/catalogo/components/GerarCatalogoIaModal.tsx
import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import {
  fvsService,
  type GerarCatalogoIAResult,
  type GerarCatalogoIAServico,
} from '@/services/fvs.service'
import { X, Sparkles, Loader2, ChevronDown, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react'

type NivelDetalhe = 'basico' | 'intermediario' | 'avancado'

interface Props {
  open: boolean
  onImportar: (servicos: GerarCatalogoIAServico[]) => void
  onClose: () => void
}

export function GerarCatalogoIaModal({ open, onImportar, onClose }: Props) {
  const [tipoObra,      setTipoObra]      = useState('')
  const [servicos,      setServicos]      = useState('')
  const [normas,        setNormas]        = useState('')
  const [nivel,         setNivel]         = useState<NivelDetalhe>('intermediario')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [result,        setResult]        = useState<GerarCatalogoIAResult | null>(null)
  const [expandidos,    setExpandidos]    = useState<Set<number>>(new Set())
  const [selecionados,  setSelecionados]  = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!open) {
      setTipoObra(''); setServicos(''); setNormas(''); setNivel('intermediario')
      setLoading(false); setError(null); setResult(null)
      setExpandidos(new Set()); setSelecionados(new Set())
    }
  }, [open])

  if (!open) return null

  const handleGerar = async () => {
    if (!tipoObra.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fvsService.gerarCatalogoIA({
        tipo_obra: tipoObra.trim(),
        servicos: servicos.trim() || undefined,
        normas:   normas.trim()   || undefined,
        nivel_detalhe: nivel,
      })
      setResult(res)
      // Selecionar todos por padrão
      setSelecionados(new Set(res.servicos.map((_, i) => i)))
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Erro ao gerar catálogo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpandido = (i: number) => {
    setExpandidos(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const toggleSelecionado = (i: number) => {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const handleImportar = () => {
    if (!result) return
    const escolhidos = result.servicos.filter((_, i) => selecionados.has(i))
    onImportar(escolhidos)
    onClose()
  }

  const totalItens = result?.servicos
    .filter((_, i) => selecionados.has(i))
    .reduce((acc, s) => acc + s.itens.length, 0) ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h3 className="text-[15px] font-semibold text-[var(--text-high)]">Gerar Catálogo com IA</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result && (
            <>
              {/* Tipo de obra */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-mid)] mb-1">
                  Tipo de obra <span className="text-[var(--nc)]">*</span>
                </label>
                <input
                  value={tipoObra}
                  onChange={e => setTipoObra(e.target.value)}
                  placeholder="Ex: Residencial Vertical, Galpão Industrial, Escola Pública"
                  className={cn(
                    'w-full h-9 px-3 rounded-sm text-[13px] outline-none border',
                    'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-high)]',
                    'placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]',
                  )}
                />
              </div>

              {/* Serviços */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-mid)] mb-1">
                  Serviços a incluir <span className="text-[var(--text-faint)]">(opcional)</span>
                </label>
                <input
                  value={servicos}
                  onChange={e => setServicos(e.target.value)}
                  placeholder="Ex: alvenaria, revestimento, pintura, instalações"
                  className={cn(
                    'w-full h-9 px-3 rounded-sm text-[13px] outline-none border',
                    'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-high)]',
                    'placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]',
                  )}
                />
              </div>

              {/* Normas */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-mid)] mb-1">
                  Normas a referenciar <span className="text-[var(--text-faint)]">(opcional)</span>
                </label>
                <input
                  value={normas}
                  onChange={e => setNormas(e.target.value)}
                  placeholder="Ex: NBR 15575, PBQP-H, NBR 6118"
                  className={cn(
                    'w-full h-9 px-3 rounded-sm text-[13px] outline-none border',
                    'bg-[var(--bg-input)] border-[var(--border)] text-[var(--text-high)]',
                    'placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]',
                  )}
                />
              </div>

              {/* Nível de detalhe */}
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-mid)] mb-1">
                  Nível de detalhe
                </label>
                <div className="flex gap-2">
                  {(['basico', 'intermediario', 'avancado'] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setNivel(n)}
                      className={cn(
                        'flex-1 h-9 rounded-sm text-[12px] border capitalize transition-colors',
                        nivel === n
                          ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]'
                          : 'border-[var(--border)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)]',
                      )}
                    >
                      {n === 'basico' ? 'Básico' : n === 'intermediario' ? 'Intermediário' : 'Avançado'}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-faint)]">
                  {nivel === 'basico'       && 'Itens essenciais e objetivos — ideal para uso rápido'}
                  {nivel === 'intermediario' && 'Itens completos com critérios de aceitação — uso padrão'}
                  {nivel === 'avancado'     && 'Itens exaustivos com tolerâncias e referências técnicas'}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded">
                  <AlertCircle size={14} className="text-[var(--nc)] mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-[var(--nc-text)]">{error}</p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-[var(--ok)]" />
                  <p className="text-[12px] text-[var(--ok-text)]">
                    {result.servicos.length} serviço{result.servicos.length !== 1 ? 's' : ''} gerados pela IA
                  </p>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text-mid)] underline"
                >
                  Gerar novamente
                </button>
              </div>

              <div className="border border-[var(--border-dim)] rounded overflow-hidden">
                {result.servicos.map((servico, i) => (
                  <div key={i} className="border-b border-[var(--border-dim)] last:border-0">
                    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--bg-hover)]">
                      <input
                        type="checkbox"
                        checked={selecionados.has(i)}
                        onChange={() => toggleSelecionado(i)}
                        className="w-3.5 h-3.5 accent-[var(--accent)] flex-shrink-0"
                      />
                      <button
                        onClick={() => toggleExpandido(i)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        {expandidos.has(i)
                          ? <ChevronDown size={12} className="text-[var(--text-faint)] flex-shrink-0" />
                          : <ChevronRight size={12} className="text-[var(--text-faint)] flex-shrink-0" />
                        }
                        <span className="text-[13px] font-medium text-[var(--text-high)]">{servico.nome}</span>
                        {servico.codigo && (
                          <span className="text-[11px] text-[var(--text-faint)]">{servico.codigo}</span>
                        )}
                        <span className="ml-auto text-[11px] text-[var(--text-faint)]">
                          {servico.itens.length} iten{servico.itens.length !== 1 ? 's' : ''}
                        </span>
                      </button>
                    </div>

                    {expandidos.has(i) && (
                      <div className="bg-[var(--bg-raised)] px-4 pb-2 space-y-1">
                        {servico.categoria && (
                          <p className="text-[11px] text-[var(--text-faint)] pt-2">
                            Categoria: {servico.categoria} · Norma: {servico.norma_referencia || '—'}
                          </p>
                        )}
                        {servico.itens.map((item, j) => (
                          <div key={j} className="flex items-start gap-2 py-1 border-t border-[var(--border-dim)] first:border-0">
                            <span className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold mt-0.5 flex-shrink-0',
                              item.criticidade === 'critico' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              item.criticidade === 'maior'   ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                               'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                            )}>
                              {item.criticidade.toUpperCase()}
                            </span>
                            <div>
                              <p className="text-[12px] text-[var(--text-high)]">{item.descricao}</p>
                              {item.criterio_aceite && (
                                <p className="text-[11px] text-[var(--text-faint)] mt-0.5">{item.criterio_aceite}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[var(--border-dim)] flex-shrink-0">
          <div className="text-[11px] text-[var(--text-faint)]">
            {result
              ? `${selecionados.size} serviço${selecionados.size !== 1 ? 's' : ''} · ${totalItens} iten${totalItens !== 1 ? 's' : ''} selecionados`
              : 'O catálogo gerado pode ser revisado antes de importar'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 h-9 rounded-sm text-[13px] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Cancelar
            </button>
            {!result ? (
              <button
                onClick={handleGerar}
                disabled={!tipoObra.trim() || loading}
                className={cn(
                  'flex items-center gap-1.5 px-4 h-9 rounded-sm text-[13px] font-semibold transition-colors',
                  'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)]',
                  'disabled:opacity-50',
                )}
              >
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Gerando...</>
                  : <><Sparkles size={14} /> Gerar Catálogo</>
                }
              </button>
            ) : (
              <button
                onClick={handleImportar}
                disabled={selecionados.size === 0}
                className={cn(
                  'px-4 h-9 rounded-sm text-[13px] font-semibold transition-colors',
                  'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)]',
                  'disabled:opacity-50',
                )}
              >
                Importar Selecionados
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
