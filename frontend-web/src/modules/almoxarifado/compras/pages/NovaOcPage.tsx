// frontend-web/src/modules/almoxarifado/compras/pages/NovaOcPage.tsx
import { useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCriarOc } from '../hooks/useCompras'
import { useLocais } from '../../locais/hooks/useLocais'
import { api } from '@/services/api'
import type { CreateOcItemPayload } from '../../_service/almoxarifado.service'

interface CatalogoItem { id: number; nome: string; codigo: string | null; unidade_padrao: string | null }
interface FornecedorItem { id: number; nome_fantasia: string; cnpj: string | null }
interface ItemForm extends CreateOcItemPayload { catalogo_nome: string }

export function NovaOcPage() {
  const { obraId } = useParams<{ obraId: string }>()
  const navigate    = useNavigate()
  const id          = Number(obraId)

  const { data: locais = [] } = useLocais({ ativo: true })
  const [localDestinoId, setLocalDestinoId] = useState<number | ''>('')

  // Fornecedor
  const [fornQuery,     setFornQuery]     = useState('')
  const [fornResults,   setFornResults]   = useState<FornecedorItem[]>([])
  const [fornSel,       setFornSel]       = useState<FornecedorItem | null>(null)
  const [fornBuscando,  setFornBuscando]  = useState(false)

  // Form
  const [prazoEntrega,  setPrazoEntrega]  = useState('')
  const [condicaoPgto,  setCondicaoPgto]  = useState('')
  const [localEntrega,  setLocalEntrega]  = useState('')
  const [observacoes,   _setObservacoes]   = useState('')
  const [solicitacaoId, setSolicitacaoId] = useState('')

  // Items
  const [matQuery,   setMatQuery]   = useState('')
  const [matResults, setMatResults] = useState<CatalogoItem[]>([])
  const [matBusca,   setMatBusca]   = useState(false)
  const [itens,      setItens]      = useState<ItemForm[]>([])

  const debForn = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debMat  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const criar = useCriarOc(id)

  // ── Busca fornecedor ──────────────────────────────────────────────────────

  function handleFornQuery(v: string) {
    setFornQuery(v)
    setFornSel(null)
    if (debForn.current) clearTimeout(debForn.current)
    if (v.trim().length < 2) { setFornResults([]); return }
    debForn.current = setTimeout(async () => {
      setFornBuscando(true)
      try {
        const data = await api.get<FornecedorItem[]>(
          `/fvm/fornecedores?busca=${encodeURIComponent(v)}&limit=8`,
        )
        setFornResults(Array.isArray(data) ? data : [])
      } catch { setFornResults([]) }
      finally { setFornBuscando(false) }
    }, 300)
  }

  function selecionarFornecedor(f: FornecedorItem) {
    setFornSel(f)
    setFornQuery(f.nome_fantasia)
    setFornResults([])
  }

  // ── Busca material ────────────────────────────────────────────────────────

  function handleMatQuery(v: string) {
    setMatQuery(v)
    if (debMat.current) clearTimeout(debMat.current)
    if (v.trim().length < 2) { setMatResults([]); return }
    debMat.current = setTimeout(async () => {
      setMatBusca(true)
      try {
        const data = await api.get<CatalogoItem[]>(
          `/fvm/catalogo?busca=${encodeURIComponent(v)}&limit=10`,
        )
        setMatResults(Array.isArray(data) ? data : [])
      } catch { setMatResults([]) }
      finally { setMatBusca(false) }
    }, 300)
  }

  function adicionarItem(cat: CatalogoItem) {
    if (itens.some((i) => i.catalogo_id === cat.id)) return
    setItens((prev) => [
      ...prev,
      { catalogo_id: cat.id, catalogo_nome: cat.nome, quantidade: 1, unidade: cat.unidade_padrao ?? 'un' },
    ])
    setMatQuery('')
    setMatResults([])
  }

  function removerItem(idx: number) { setItens((prev) => prev.filter((_, i) => i !== idx)) }

  function updateItem(idx: number, field: keyof ItemForm, value: string | number) {
    setItens((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleCriar() {
    if (!fornSel || !itens.length) return
    const oc = await criar.mutateAsync({
      fornecedor_id:    fornSel.id,
      local_destino_id: Number(localDestinoId) || 0,
      solicitacao_id:   solicitacaoId ? Number(solicitacaoId) : undefined,
      prazo_entrega:    prazoEntrega || undefined,
      condicao_pgto:    condicaoPgto.trim() || undefined,
      local_entrega:    localEntrega.trim() || undefined,
      observacoes:      observacoes.trim() || undefined,
      itens: itens.map(({ catalogo_id, quantidade, unidade, preco_unitario }) => ({
        catalogo_id, quantidade, unidade, preco_unitario,
      })),
    })
    navigate(`/almoxarifado/ocs/${oc.id}`)
  }

  const canSubmit  = !!fornSel && itens.length > 0
  const valorTotal = itens.reduce((acc, i) => acc + (i.preco_unitario ?? 0) * i.quantidade, 0)

  return (
    <div className="p-6 max-w-[840px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-[12px]">
        <Link to={`/almoxarifado/ocs`} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Ordens de Compra
        </Link>
        <span className="text-[var(--text-faint)]">/</span>
        <span className="text-[var(--text-high)] font-medium">Nova OC</span>
      </div>
      <h1 className="text-[18px] font-bold text-[var(--text-high)] mb-6">Nova Ordem de Compra</h1>

      {/* Fornecedor + Dados */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-high)]">Fornecedor e Condições</h2>

        {/* Local destino */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
            Local de destino <span className="text-[var(--nc)]">*</span>
          </label>
          <select
            value={localDestinoId}
            onChange={(e) => setLocalDestinoId(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[13px] text-[var(--text-high)] outline-none"
          >
            <option value="">Selecionar local...</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>)}
          </select>
        </div>

        {/* Fornecedor search */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
            Fornecedor <span className="text-[var(--nc)]">*</span>
          </label>
          <div className="relative">
            <div className={cn(
              'flex items-center gap-2 h-9 px-3',
              'bg-[var(--bg-raised)] border rounded-sm transition-colors',
              fornSel ? 'border-[var(--ok)]' : 'border-[var(--border-dim)] focus-within:border-[var(--accent)]',
            )}>
              <Search size={13} className="text-[var(--text-faint)] flex-shrink-0" />
              <input
                className="flex-1 bg-transparent text-[13px] text-[var(--text-high)] outline-none placeholder:text-[var(--text-faint)]"
                placeholder="Buscar fornecedor..."
                value={fornQuery}
                onChange={(e) => handleFornQuery(e.target.value)}
              />
              {fornBuscando && <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />}
            </div>
            {fornResults.length > 0 && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md shadow-lg overflow-hidden">
                {fornResults.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => selecionarFornecedor(f)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-raised)] transition-colors"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-high)]">{f.nome_fantasia}</p>
                      {f.cnpj && <p className="text-[11px] text-[var(--text-faint)] font-mono">{f.cnpj}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">Prazo de Entrega</label>
            <input
              type="date"
              className={cn(
                'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
              )}
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">Condição de Pagamento</label>
            <input
              className={cn(
                'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
              )}
              placeholder="Ex: 30/60 dias"
              value={condicaoPgto}
              onChange={(e) => setCondicaoPgto(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">Nº Solicitação</label>
            <input
              type="number"
              className={cn(
                'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
              )}
              placeholder="ID da solicitação (opcional)"
              value={solicitacaoId}
              onChange={(e) => setSolicitacaoId(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">Local de Entrega</label>
          <input
            className={cn(
              'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
              'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
            )}
            placeholder="Ex: Almoxarifado central, Bloco A"
            value={localEntrega}
            onChange={(e) => setLocalEntrega(e.target.value)}
          />
        </div>
      </div>

      {/* Itens */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-high)]">
            Itens <span className="text-[var(--nc)]">*</span>
          </h2>
          {valorTotal > 0 && (
            <span className="text-[13px] font-semibold text-[var(--text-high)]">
              Total: {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        {/* Busca material */}
        <div className="relative mb-4">
          <div className={cn(
            'flex items-center gap-2 h-9 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'focus-within:border-[var(--accent)]',
          )}>
            <Search size={13} className="text-[var(--text-faint)] flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-[13px] text-[var(--text-high)] outline-none placeholder:text-[var(--text-faint)]"
              placeholder="Adicionar material do catálogo..."
              value={matQuery}
              onChange={(e) => handleMatQuery(e.target.value)}
            />
            {matBusca && <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />}
          </div>
          {matResults.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md shadow-lg overflow-hidden">
              {matResults.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => adicionarItem(cat)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-raised)]"
                >
                  <Plus size={12} className="text-[var(--accent)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-high)] truncate">{cat.nome}</p>
                    {cat.codigo && <p className="text-[11px] text-[var(--text-faint)] font-mono">{cat.codigo}</p>}
                  </div>
                  <span className="text-[11px] text-[var(--text-faint)] font-mono">{cat.unidade_padrao ?? 'un'}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {itens.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-sm">
            Nenhum item adicionado ainda
          </div>
        ) : (
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Qtd.', 'Un.', 'Preço Unit. (R$)', 'Total', ''].map((h) => (
                  <th key={h} className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[var(--text-faint)] font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-dim)]">
              {itens.map((item, idx) => (
                <tr key={item.catalogo_id}>
                  <td className="py-2 pr-3 text-[13px] font-medium text-[var(--text-high)]">
                    {item.catalogo_nome}
                  </td>
                  <td className="py-2 pr-2 w-20">
                    <input
                      type="number" min={0.001} step="any"
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[13px] font-mono text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
                      )}
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-2 w-16">
                    <input
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[12px] font-mono text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
                      )}
                      value={item.unidade}
                      onChange={(e) => updateItem(idx, 'unidade', e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2 w-32">
                    <input
                      type="number" min={0} step="0.01"
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[13px] font-mono text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
                      )}
                      placeholder="0,00"
                      value={item.preco_unitario ?? ''}
                      onChange={(e) => updateItem(idx, 'preco_unitario', e.target.value ? Number(e.target.value) : 0)}
                    />
                  </td>
                  <td className="py-2 pr-2 font-mono text-[12px] text-[var(--text-faint)]">
                    {item.preco_unitario
                      ? (item.preco_unitario * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>
                  <td className="py-2 w-8">
                    <button onClick={() => removerItem(idx)} className="text-[var(--text-faint)] hover:text-[var(--nc)] transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ações */}
      <div className="flex gap-3 justify-end">
        <Link
          to={`/almoxarifado/ocs`}
          className={cn(
            'px-4 h-9 flex items-center text-[13px] font-medium rounded-sm',
            'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
            'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
          )}
        >
          Cancelar
        </Link>
        <button
          onClick={handleCriar}
          disabled={!canSubmit || criar.isPending}
          className={cn(
            'px-4 h-9 text-[13px] font-semibold rounded-sm',
            'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors',
            'disabled:opacity-50',
          )}
        >
          {criar.isPending ? 'Criando...' : 'Criar Ordem de Compra'}
        </button>
      </div>
    </div>
  )
}
