import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { FvsCategoria, FvsServico } from '@/services/fvs.service'
import { X, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'

interface ItemDraft {
  descricao: string
  criterioAceite: string
  tolerancia: string
  metodoVerificacao: string
  criticidade: 'critico' | 'maior' | 'menor'
  fotoModo: 'nenhuma' | 'opcional' | 'obrigatoria'
  fotoMinimo: number
  fotoMaximo: number
  ativo: boolean
}

interface Props {
  open: boolean
  categorias: FvsCategoria[]
  servico?: FvsServico | null
  onSave: (payload: {
    categoriaId?: number
    codigo?: string
    nome: string
    normaReferencia?: string
    itens?: (Omit<ItemDraft, 'criterioAceite' | 'tolerancia' | 'metodoVerificacao'> & { criterioAceite?: string; tolerancia?: string; metodoVerificacao?: string })[]
  }) => void
  onClose: () => void
}

const defaultItem = (): ItemDraft => ({
  descricao: '',
  criterioAceite: '',
  tolerancia: '',
  metodoVerificacao: '',
  criticidade: 'menor',
  fotoModo: 'opcional',
  fotoMinimo: 0,
  fotoMaximo: 2,
  ativo: true,
})

export function ServicoModal({ open, categorias, servico, onSave, onClose }: Props) {
  const [nome, setNome]               = useState('')
  const [codigo, setCodigo]           = useState('')
  const [norma, setNorma]             = useState('')
  const [categoriaId, setCategoriaId] = useState<number | ''>('')
  const [itens, setItens]             = useState<ItemDraft[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (servico) {
      setNome(servico.nome)
      setCodigo(servico.codigo ?? '')
      setNorma(servico.norma_referencia ?? '')
      setCategoriaId(servico.categoria_id ?? '')
      setItens(
        (servico.itens ?? []).map(i => ({
          descricao:         i.descricao,
          criterioAceite:    i.criterio_aceite    ?? '',
          tolerancia:        i.tolerancia         ?? '',
          metodoVerificacao: i.metodo_verificacao ?? '',
          criticidade:       i.criticidade,
          fotoModo:          i.foto_modo,
          fotoMinimo:        i.foto_minimo,
          fotoMaximo:        i.foto_maximo,
          ativo:             i.ativo,
        })),
      )
    } else {
      setNome(''); setCodigo(''); setNorma(''); setCategoriaId(''); setItens([])
    }
    setExpandedItems(new Set())
  }, [servico, open])

  if (!open) return null

  const addItem = () => {
    const newIdx = itens.length
    setItens(v => [...v, defaultItem()])
    setExpandedItems(s => new Set([...s, newIdx]))
  }

  const removeItem = (i: number) => {
    setItens(v => v.filter((_, idx) => idx !== i))
    setExpandedItems(s => {
      const next = new Set<number>()
      s.forEach(n => { if (n < i) next.add(n); else if (n > i) next.add(n - 1) })
      return next
    })
  }

  const toggleExpand = (i: number) =>
    setExpandedItems(s => {
      const next = new Set(s)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  const updateItem = <K extends keyof ItemDraft>(i: number, field: K, value: ItemDraft[K]) =>
    setItens(v => v.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const moveItem = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= itens.length) return
    setItens(v => {
      const next = [...v]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setExpandedItems(s => {
      const next = new Set<number>()
      s.forEach(n => {
        if (n === i) next.add(j)
        else if (n === j) next.add(i)
        else next.add(n)
      })
      return next
    })
  }

  const handleSave = () => {
    if (!nome.trim()) return
    onSave({
      nome: nome.trim(),
      codigo: codigo.trim() || undefined,
      normaReferencia: norma.trim() || undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      itens: itens
        .filter(i => i.descricao.trim())
        .map(i => ({
          descricao:         i.descricao.trim(),
          criterioAceite:    i.criterioAceite.trim()    || undefined,
          tolerancia:        i.tolerancia.trim()        || undefined,
          metodoVerificacao: i.metodoVerificacao.trim() || undefined,
          criticidade:       i.criticidade,
          fotoModo:          i.fotoModo,
          fotoMinimo:        i.fotoMinimo,
          fotoMaximo:        i.fotoMaximo,
          ativo:             i.ativo,
        })),
    })
  }

  const inputCls = 'w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">
            {servico ? 'Editar Serviço' : 'Novo Serviço'}
          </h3>
          <button onClick={onClose} aria-label="Fechar modal" className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Dados do serviço */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Nome *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: EXECUÇÃO DE ALVENARIA DE VEDAÇÃO"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Código PO</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: PO 19.20"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Norma de Referência</label>
              <input
                value={norma}
                onChange={e => setNorma(e.target.value)}
                placeholder="Ex: NBR 15696"
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Categoria</label>
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
                className={inputCls}
              >
                <option value="">Sem categoria</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Itens de verificação */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[var(--text-high)]">
                Itens de Verificação
                <span className="ml-2 text-[11px] font-normal text-[var(--text-faint)]">
                  {itens.filter(i => i.descricao.trim()).length} definido{itens.filter(i => i.descricao.trim()).length !== 1 ? 's' : ''}
                </span>
              </p>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
              >
                <Plus size={11} /> Adicionar Item
              </button>
            </div>

            <div className="space-y-1.5">
              {itens.map((item, i) => {
                const exp = expandedItems.has(i)
                return (
                  <div key={i} className="border border-[var(--border-dim)] rounded bg-[var(--bg-raised)]">
                    {/* Linha principal do item */}
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      {/* Reordenar */}
                      <div className="flex flex-col gap-0 flex-shrink-0">
                        <button
                          onClick={() => moveItem(i, -1)}
                          disabled={i === 0}
                          className="p-0.5 text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-none"
                          title="Mover para cima"
                        >▲</button>
                        <button
                          onClick={() => moveItem(i, 1)}
                          disabled={i === itens.length - 1}
                          className="p-0.5 text-[var(--text-faint)] disabled:opacity-20 hover:text-[var(--text-high)] leading-none"
                          title="Mover para baixo"
                        >▼</button>
                      </div>

                      <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 flex-shrink-0">{i + 1}.</span>

                      <input
                        value={item.descricao}
                        onChange={e => updateItem(i, 'descricao', e.target.value)}
                        placeholder="Descrição do item de verificação..."
                        className="flex-1 h-8 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                      />

                      <select
                        value={item.criticidade}
                        onChange={e => updateItem(i, 'criticidade', e.target.value as any)}
                        className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                      >
                        <option value="menor">Menor</option>
                        <option value="maior">Maior</option>
                        <option value="critico">Crítico</option>
                      </select>

                      <select
                        value={item.fotoModo}
                        onChange={e => updateItem(i, 'fotoModo', e.target.value as any)}
                        className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                      >
                        <option value="nenhuma">Sem foto</option>
                        <option value="opcional">Foto opcional</option>
                        <option value="obrigatoria">Foto obrigatória</option>
                      </select>

                      {/* Toggle detalhes */}
                      <button
                        onClick={() => toggleExpand(i)}
                        title={exp ? 'Recolher detalhes' : 'Ver critério e foto min/max'}
                        className={cn(
                          'p-1 rounded text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors',
                          exp && 'text-[var(--accent)]',
                        )}
                      >
                        {exp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>

                      <button
                        onClick={() => removeItem(i)}
                        aria-label="Remover item"
                        className="p-1.5 text-[var(--text-faint)] hover:text-[var(--nc)]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Painel expandido */}
                    {exp && (
                      <div className="px-10 pb-2.5 pt-1 border-t border-[var(--border-dim)] space-y-2">
                        {/* Critério de aceite */}
                        <div>
                          <label className="block text-[11px] text-[var(--text-faint)] mb-1">Critério de Aceite</label>
                          <textarea
                            value={item.criterioAceite}
                            onChange={e => updateItem(i, 'criterioAceite', e.target.value)}
                            placeholder="O que define conformidade para este item..."
                            rows={2}
                            className="w-full px-2 py-1.5 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)] resize-none"
                          />
                        </div>

                        {/* Tolerância + Método (linha) */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-[var(--text-faint)] mb-1">Tolerância</label>
                            <input
                              value={item.tolerancia}
                              onChange={e => updateItem(i, 'tolerancia', e.target.value)}
                              placeholder="Ex: Desvio máx. 3mm/m"
                              className="w-full h-7 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-[var(--text-faint)] mb-1">Método de Verificação</label>
                            <input
                              value={item.metodoVerificacao}
                              onChange={e => updateItem(i, 'metodoVerificacao', e.target.value)}
                              placeholder="Ex: Régua de 2m + inspeção visual"
                              className="w-full h-7 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>

                        {/* Foto min/max + ativo */}
                        <div className="flex items-center gap-4 flex-wrap">
                          {item.fotoModo !== 'nenhuma' && (
                            <>
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] text-[var(--text-faint)] whitespace-nowrap">Fotos mín.</label>
                                <input
                                  type="number"
                                  min={0}
                                  max={item.fotoMaximo}
                                  value={item.fotoMinimo}
                                  onChange={e => updateItem(i, 'fotoMinimo', Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-16 h-7 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-[11px] text-[var(--text-faint)] whitespace-nowrap">Fotos máx.</label>
                                <input
                                  type="number"
                                  min={item.fotoMinimo}
                                  max={20}
                                  value={item.fotoMaximo}
                                  onChange={e => updateItem(i, 'fotoMaximo', Math.max(item.fotoMinimo, parseInt(e.target.value) || 0))}
                                  className="w-16 h-7 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                            </>
                          )}
                          <label className="flex items-center gap-1.5 ml-auto cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={item.ativo}
                              onChange={e => updateItem(i, 'ativo', e.target.checked)}
                              className="w-3.5 h-3.5 accent-[var(--accent)]"
                            />
                            <span className="text-[11px] text-[var(--text-faint)]">Item ativo</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {itens.length === 0 && (
                <p className="text-[12px] text-[var(--text-faint)] py-2">Nenhum item adicionado ainda.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--border-dim)]">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-sm text-[13px] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!nome.trim()}
            className="px-4 h-9 rounded-sm text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
