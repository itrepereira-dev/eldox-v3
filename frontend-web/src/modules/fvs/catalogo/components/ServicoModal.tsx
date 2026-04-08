import { useState, useEffect } from 'react'
import { cn } from '@/lib/cn'
import type { FvsCategoria, FvsServico } from '@/services/fvs.service'
import { X, Plus, Trash2 } from 'lucide-react'

interface ItemDraft { descricao: string; criticidade: 'critico' | 'maior' | 'menor'; fotoModo: 'nenhuma' | 'opcional' | 'obrigatoria' }

interface Props {
  open: boolean
  categorias: FvsCategoria[]
  servico?: FvsServico | null
  onSave: (payload: { categoriaId?: number; codigo?: string; nome: string; normaReferencia?: string; itens?: ItemDraft[] }) => void
  onClose: () => void
}

export function ServicoModal({ open, categorias, servico, onSave, onClose }: Props) {
  const [nome, setNome]                 = useState('')
  const [codigo, setCodigo]             = useState('')
  const [norma, setNorma]               = useState('')
  const [categoriaId, setCategoriaId]   = useState<number | ''>('')
  const [itens, setItens]               = useState<ItemDraft[]>([])

  useEffect(() => {
    if (servico) {
      setNome(servico.nome)
      setCodigo(servico.codigo ?? '')
      setNorma(servico.norma_referencia ?? '')
      setCategoriaId(servico.categoria_id ?? '')
      setItens(
        (servico.itens ?? []).map(i => ({
          descricao: i.descricao,
          criticidade: i.criticidade,
          fotoModo: i.foto_modo,
        })),
      )
    } else {
      setNome(''); setCodigo(''); setNorma(''); setCategoriaId(''); setItens([])
    }
  }, [servico, open])

  if (!open) return null

  const addItem = () => setItens(v => [...v, { descricao: '', criticidade: 'menor', fotoModo: 'opcional' }])
  const removeItem = (i: number) => setItens(v => v.filter((_, idx) => idx !== i))
  const updateItem = (i: number, field: keyof ItemDraft, value: string) =>
    setItens(v => v.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const handleSave = () => {
    if (!nome.trim()) return
    onSave({
      nome: nome.trim(),
      codigo: codigo.trim() || undefined,
      normaReferencia: norma.trim() || undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      itens: itens.filter(i => i.descricao.trim()),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-[var(--bg-overlay)]" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col',
        'bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)]',
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <h3 className="text-[15px] font-semibold text-[var(--text-high)]">
            {servico ? 'Editar Serviço' : 'Novo Serviço'}
          </h3>
          <button onClick={onClose} aria-label="Fechar modal" className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Nome *</label>
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: EXECUÇÃO DE ALVENARIA DE VEDAÇÃO"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Código PO</label>
              <input
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ex: PO 19.20"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Norma de Referência</label>
              <input
                value={norma}
                onChange={e => setNorma(e.target.value)}
                placeholder="Ex: NBR 15696"
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[12px] text-[var(--text-faint)] mb-1">Categoria</label>
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-9 px-3 text-[13px] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
              >
                <option value="">Sem categoria</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-semibold text-[var(--text-high)]">Itens de Verificação</p>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
              >
                <Plus size={11} /> Adicionar Item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-[var(--bg-raised)] rounded border border-[var(--border-dim)]">
                  <span className="text-[11px] text-[var(--text-faint)] font-mono w-4 pt-2">{i + 1}.</span>
                  <input
                    value={item.descricao}
                    onChange={e => updateItem(i, 'descricao', e.target.value)}
                    placeholder="Descrição do item de verificação..."
                    className="flex-1 h-8 px-2 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]"
                  />
                  <select
                    value={item.criticidade}
                    onChange={e => updateItem(i, 'criticidade', e.target.value)}
                    className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                  >
                    <option value="menor">Menor</option>
                    <option value="maior">Maior</option>
                    <option value="critico">Crítico</option>
                  </select>
                  <select
                    value={item.fotoModo}
                    onChange={e => updateItem(i, 'fotoModo', e.target.value)}
                    className="h-8 px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none"
                  >
                    <option value="nenhuma">Sem foto</option>
                    <option value="opcional">Foto opcional</option>
                    <option value="obrigatoria">Foto obrigatória</option>
                  </select>
                  <button onClick={() => removeItem(i)} aria-label="Remover item" className="p-1.5 text-[var(--text-faint)] hover:text-[var(--nc)] mt-0.5">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-[12px] text-[var(--text-faint)] py-2">Nenhum item adicionado ainda.</p>
              )}
            </div>
          </div>
        </div>

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
            className="px-4 h-9 rounded-sm text-[13px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
