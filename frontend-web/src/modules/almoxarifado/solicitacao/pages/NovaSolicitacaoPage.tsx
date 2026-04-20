// frontend-web/src/modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage.tsx
import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCriarSolicitacao } from '../hooks/useSolicitacao'
import { useSubmeterSolicitacao } from '../hooks/useSolicitacao'
import { useLocais } from '../../locais/hooks/useLocais'
import { api } from '@/services/api'
import type { CreateSolicitacaoItemPayload } from '../../_service/almoxarifado.service'

interface CatalogoItem {
  id: number
  nome: string
  codigo: string | null
  unidade_padrao: string | null
}

interface ItemForm extends CreateSolicitacaoItemPayload {
  catalogo_nome: string
}

export function NovaSolicitacaoPage() {
  const navigate = useNavigate()

  const { data: locais = [] } = useLocais({ ativo: true })
  const [localDestinoId, setLocalDestinoId] = useState<number | ''>('')

  // Form state
  const [descricao,        setDescricao]        = useState('')
  const [urgente,          setUrgente]          = useState(false)
  const [dataNecessidade,  setDataNecessidade]  = useState('')
  const [servicoRef,       setServicoRef]       = useState('')
  const [itens,            setItens]            = useState<ItemForm[]>([])

  // Catalog search
  const [query,       setQuery]       = useState('')
  const [resultados,  setResultados]  = useState<CatalogoItem[]>([])
  const [buscando,    setBuscando]    = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const criar    = useCriarSolicitacao()
  const submeter = useSubmeterSolicitacao()

  // ── Busca catálogo ──────────────────────────────────────────────────────

  function handleQueryChange(v: string) {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.trim().length < 2) { setResultados([]); return }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await api.get<CatalogoItem[]>(
          `/fvm/catalogo?busca=${encodeURIComponent(v)}&limit=10`,
        )
        setResultados(Array.isArray(data) ? data : [])
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 300)
  }

  function adicionarItem(cat: CatalogoItem) {
    if (itens.some((i) => i.catalogo_id === cat.id)) return
    setItens((prev) => [
      ...prev,
      {
        catalogo_id:   cat.id,
        catalogo_nome: cat.nome,
        quantidade:    1,
        unidade:       cat.unidade_padrao ?? 'un',
      },
    ])
    setQuery('')
    setResultados([])
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemForm, value: string | number) {
    setItens((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    )
  }

  // ── Salvar / Submeter ───────────────────────────────────────────────────

  async function handleSalvar() {
    if (!descricao.trim() || !itens.length) return
    const sol = await criar.mutateAsync({
      descricao:        descricao.trim(),
      local_destino_id: Number(localDestinoId) || 0,
      urgente,
      data_necessidade: dataNecessidade || undefined,
      servico_ref:      servicoRef.trim() || undefined,
      itens:            itens.map(({ catalogo_id, quantidade, unidade, observacao }) => ({
        catalogo_id, quantidade, unidade, observacao,
      })),
    })
    navigate(`/almoxarifado/solicitacoes/${sol.id}`)
  }

  async function handleSubmeter() {
    if (!descricao.trim() || !itens.length) return
    const sol = await criar.mutateAsync({
      descricao:        descricao.trim(),
      local_destino_id: Number(localDestinoId) || 0,
      urgente,
      data_necessidade: dataNecessidade || undefined,
      servico_ref:      servicoRef.trim() || undefined,
      itens:            itens.map(({ catalogo_id, quantidade, unidade, observacao }) => ({
        catalogo_id, quantidade, unidade, observacao,
      })),
    })
    await submeter.mutateAsync(sol.id)
    navigate(`/almoxarifado/solicitacoes/${sol.id}`)
  }

  const isLoading = criar.isPending || submeter.isPending
  const canSubmit = descricao.trim().length > 0 && itens.length > 0

  return (
    <div className="p-6 max-w-[820px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-[12px]">
        <Link to={`/almoxarifado/solicitacoes`} className="text-[var(--text-faint)] hover:text-[var(--text-high)]">
          Solicitações
        </Link>
        <span className="text-[var(--text-faint)]">/</span>
        <span className="text-[var(--text-high)] font-medium">Nova Solicitação</span>
      </div>

      <h1 className="text-[18px] font-bold text-[var(--text-high)] mb-6">Nova Solicitação de Compra</h1>

      {/* Dados gerais */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-5 space-y-4">
        <h2 className="text-[13px] font-semibold text-[var(--text-high)]">Dados Gerais</h2>

        <div>
          <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
            Local de destino <span className="text-[var(--nc)]">*</span>
          </label>
          <select
            value={localDestinoId}
            onChange={(e) => setLocalDestinoId(e.target.value === '' ? '' : Number(e.target.value))}
            className={cn(
              'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
              'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
            )}
          >
            <option value="">Selecionar local...</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.nome} ({l.tipo})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
            Descrição <span className="text-[var(--nc)]">*</span>
          </label>
          <input
            className={cn(
              'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
              'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
            )}
            placeholder="Ex: Materiais para fundação — Bloco C"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
              Data de Necessidade
            </label>
            <input
              type="date"
              className={cn(
                'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
              )}
              value={dataNecessidade}
              onChange={(e) => setDataNecessidade(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-low)] mb-1">
              Serviço / Referência
            </label>
            <input
              className={cn(
                'w-full h-9 px-3 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                'text-[13px] text-[var(--text-high)] outline-none focus:border-[var(--accent)]',
              )}
              placeholder="Ex: Alvenaria — 3º pavimento"
              value={servicoRef}
              onChange={(e) => setServicoRef(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={urgente}
            onChange={(e) => setUrgente(e.target.checked)}
            className="accent-[var(--warn)] w-4 h-4"
          />
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-low)]">
            <AlertTriangle size={13} className="text-[var(--warn)]" />
            Marcar como urgente
          </span>
        </label>
      </div>

      {/* Itens */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md p-5 mb-6">
        <h2 className="text-[13px] font-semibold text-[var(--text-high)] mb-4">
          Materiais <span className="text-[var(--nc)]">*</span>
        </h2>

        {/* Busca */}
        <div className="relative mb-4">
          <div className={cn(
            'flex items-center gap-2 h-9 px-3',
            'bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
            'focus-within:border-[var(--accent)]',
          )}>
            <Search size={13} className="text-[var(--text-faint)] flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-[13px] text-[var(--text-high)] outline-none placeholder:text-[var(--text-faint)]"
              placeholder="Buscar material no catálogo..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
            {buscando && (
              <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {resultados.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-md shadow-lg overflow-hidden">
              {resultados.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => adicionarItem(cat)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-raised)] transition-colors"
                >
                  <Plus size={12} className="text-[var(--accent)] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-high)] truncate">{cat.nome}</p>
                    {cat.codigo && (
                      <p className="text-[11px] text-[var(--text-faint)] font-mono">{cat.codigo}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-faint)] font-mono flex-shrink-0">
                    {cat.unidade_padrao ?? 'un'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabela de itens */}
        {itens.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[var(--text-faint)] border border-dashed border-[var(--border-dim)] rounded-sm">
            Nenhum material adicionado ainda
          </div>
        ) : (
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-dim)]">
                {['Material', 'Qtd.', 'Un.', 'Obs.', ''].map((h) => (
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
                  <td className="py-2 pr-2 w-24">
                    <input
                      type="number"
                      min={0.001}
                      step="any"
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[13px] text-[var(--text-high)] font-mono outline-none focus:border-[var(--accent)]',
                      )}
                      value={item.quantidade}
                      onChange={(e) => updateItem(idx, 'quantidade', Number(e.target.value))}
                    />
                  </td>
                  <td className="py-2 pr-2 w-20">
                    <input
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[12px] text-[var(--text-high)] font-mono outline-none focus:border-[var(--accent)]',
                      )}
                      value={item.unidade}
                      onChange={(e) => updateItem(idx, 'unidade', e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      className={cn(
                        'w-full h-7 px-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm',
                        'text-[12px] text-[var(--text-low)] outline-none focus:border-[var(--accent)]',
                      )}
                      placeholder="Observação opcional"
                      value={item.observacao ?? ''}
                      onChange={(e) => updateItem(idx, 'observacao', e.target.value)}
                    />
                  </td>
                  <td className="py-2 w-8">
                    <button
                      onClick={() => removerItem(idx)}
                      className="text-[var(--text-faint)] hover:text-[var(--nc)] transition-colors"
                    >
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
          to={`/almoxarifado/solicitacoes`}
          className={cn(
            'px-4 h-9 flex items-center text-[13px] font-medium rounded-sm',
            'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
            'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
          )}
        >
          Cancelar
        </Link>
        <button
          onClick={handleSalvar}
          disabled={!canSubmit || isLoading}
          className={cn(
            'px-4 h-9 text-[13px] font-medium rounded-sm',
            'border border-[var(--border-dim)] text-[var(--text-low)] bg-[var(--bg-raised)]',
            'hover:text-[var(--text-high)] hover:border-[var(--border)] transition-colors',
            'disabled:opacity-50',
          )}
        >
          Salvar rascunho
        </button>
        <button
          onClick={handleSubmeter}
          disabled={!canSubmit || isLoading}
          className={cn(
            'px-4 h-9 text-[13px] font-semibold rounded-sm',
            'bg-[var(--accent)] text-white',
            'hover:bg-[var(--accent-hover)] transition-colors',
            'disabled:opacity-50',
          )}
        >
          {isLoading ? 'Enviando...' : 'Submeter para aprovação'}
        </button>
      </div>
    </div>
  )
}
