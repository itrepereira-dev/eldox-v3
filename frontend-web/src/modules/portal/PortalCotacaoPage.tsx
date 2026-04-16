// frontend-web/src/modules/portal/PortalCotacaoPage.tsx
// Página PÚBLICA para fornecedores preencherem preços.
// Acessada via link: /portal/cotacao/:token (sem autenticação)
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/services/api'
import { CheckCircle, Package, AlertTriangle, Send } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PortalItem {
  id: number
  catalogo_nome: string
  quantidade: number
  unidade: string
  preco_unitario: number | null
  marca: string | null
  disponivel: boolean
  prazo_dias: number | null
  observacao: string | null
}

interface PortalData {
  solicitacao_numero: string
  obra_nome: string
  prazo_validade: string | null
  observacao: string | null
  ja_respondida: boolean
  itens: PortalItem[]
}

interface ItemForm {
  preco_unitario: string
  marca: string
  disponivel: boolean
  prazo_dias: string
  observacao: string
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function PortalCotacaoPage() {
  const { token } = useParams<{ token: string }>()
  const [form, setForm] = useState<Record<number, ItemForm>>({})
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [condicaoPgto, setCondicaoPgto] = useState('')
  const [frete, setFrete] = useState('')
  const [enviado, setEnviado] = useState(false)

  const { data, isLoading, isError } = useQuery<{ status: string; data: PortalData }>({
    queryKey: ['portal-cotacao', token],
    queryFn: () => api.get(`portal/cotacao/${token}`),
    enabled: !!token,
    retry: false,
  })

  const portalData = data?.data

  // Inicializa form com valores existentes (caso já tenha sido respondida antes)
  const getItemForm = (item: PortalItem): ItemForm =>
    form[item.id] ?? {
      preco_unitario: item.preco_unitario?.toString() ?? '',
      marca: item.marca ?? '',
      disponivel: item.disponivel,
      prazo_dias: item.prazo_dias?.toString() ?? '',
      observacao: item.observacao ?? '',
    }

  const updateItem = (id: number, field: keyof ItemForm, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [id]: { ...getItemForm({ id } as PortalItem), ...prev[id], [field]: value },
    }))
  }

  const mutEnviar = useMutation({
    mutationFn: () => {
      const itens = portalData!.itens.map((item) => {
        const f = getItemForm(item)
        return {
          cotacao_item_id: item.id,
          preco_unitario: f.disponivel && f.preco_unitario ? parseFloat(f.preco_unitario.replace(',', '.')) : null,
          marca: f.marca || undefined,
          disponivel: f.disponivel,
          prazo_dias: f.prazo_dias ? parseInt(f.prazo_dias) : undefined,
          observacao: f.observacao || undefined,
        }
      })
      return api.post(`portal/cotacao/${token}`, {
        prazo_entrega: prazoEntrega || undefined,
        condicao_pgto: condicaoPgto || undefined,
        frete: frete ? parseFloat(frete.replace(',', '.')) : 0,
        itens,
      })
    },
    onSuccess: () => setEnviado(true),
  })

  // ── Estados de carregamento e erro ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center">
        <div className="text-sm text-[var(--text-low)]">Carregando cotação…</div>
      </div>
    )
  }

  if (isError || !portalData) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto text-[var(--nc)]" size={36} />
          <h1 className="text-lg font-bold text-[var(--text-high)]">Link inválido ou expirado</h1>
          <p className="text-sm text-[var(--text-low)]">
            Este link de cotação não existe ou já expirou. Entre em contato com o comprador para solicitar um novo link.
          </p>
        </div>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle className="mx-auto text-[var(--ok)]" size={48} />
          <h1 className="text-xl font-bold text-[var(--text-high)]">Cotação enviada!</h1>
          <p className="text-sm text-[var(--text-low)]">
            Sua proposta foi recebida com sucesso. O comprador irá analisar e entrar em contato.
          </p>
        </div>
      </div>
    )
  }

  // ── Formulário ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-void)] py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header da empresa / obra */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Package className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-high)]">Solicitação de Cotação</h1>
              <p className="text-sm text-[var(--text-low)]">{portalData.obra_nome}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[var(--text-low)]">Solicitação nº</span>
              <p className="font-semibold text-[var(--text-high)]">{portalData.solicitacao_numero}</p>
            </div>
            {portalData.prazo_validade && (
              <div>
                <span className="text-[var(--text-low)]">Proposta válida até</span>
                <p className="font-semibold text-[var(--text-high)]">
                  {new Date(portalData.prazo_validade).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
          </div>

          {portalData.observacao && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--off-bg)] text-sm text-[var(--text-low)]">
              <strong className="text-[var(--text-high)]">Observação do comprador:</strong> {portalData.observacao}
            </div>
          )}

          {portalData.ja_respondida && (
            <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-[var(--warn-bg)] text-[var(--warn)] text-sm">
              <AlertTriangle size={14} />
              Esta cotação já foi respondida. Você pode atualizar os valores e reenviar.
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-high)]">
            Itens para cotação ({portalData.itens.length})
          </h2>

          {portalData.itens.map((item) => {
            const f = getItemForm(item)
            return (
              <div
                key={item.id}
                className={cn(
                  'rounded-xl border bg-[var(--bg-card)] p-4 space-y-3 transition-opacity',
                  !f.disponivel && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-high)]">{item.catalogo_nome}</p>
                    <p className="text-xs text-[var(--text-low)] mt-0.5">
                      Quantidade solicitada: <strong>{item.quantidade} {item.unidade}</strong>
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={f.disponivel}
                      onChange={(e) => updateItem(item.id, 'disponivel', e.target.checked)}
                      className="accent-[var(--accent)] w-4 h-4"
                    />
                    <span className="text-xs text-[var(--text-low)]">Disponível</span>
                  </label>
                </div>

                {f.disponivel && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--text-low)] mb-1">
                        Preço unitário (R$) *
                      </label>
                      <input
                        type="text"
                        value={f.preco_unitario}
                        onChange={(e) => updateItem(item.id, 'preco_unitario', e.target.value)}
                        placeholder="0,00"
                        className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-low)] mb-1">Marca</label>
                      <input
                        type="text"
                        value={f.marca}
                        onChange={(e) => updateItem(item.id, 'marca', e.target.value)}
                        placeholder="Ex: Suvinil, Votoran…"
                        className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-low)] mb-1">Prazo de entrega (dias)</label>
                      <input
                        type="number"
                        value={f.prazo_dias}
                        onChange={(e) => updateItem(item.id, 'prazo_dias', e.target.value)}
                        placeholder="Ex: 5"
                        className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-low)] mb-1">Observação</label>
                      <input
                        type="text"
                        value={f.observacao}
                        onChange={(e) => updateItem(item.id, 'observacao', e.target.value)}
                        placeholder="Opcional"
                        className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Dados gerais da proposta */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-high)]">Dados da proposta</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[var(--text-low)] mb-1">Prazo de entrega</label>
              <input
                type="date"
                value={prazoEntrega}
                onChange={(e) => setPrazoEntrega(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-low)] mb-1">Condição de pagamento</label>
              <input
                type="text"
                value={condicaoPgto}
                onChange={(e) => setCondicaoPgto(e.target.value)}
                placeholder="Ex: 30/60 dias"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-low)] mb-1">Frete (R$)</label>
              <input
                type="text"
                value={frete}
                onChange={(e) => setFrete(e.target.value)}
                placeholder="0,00"
                className="w-full h-9 px-3 rounded-lg border border-[var(--border)] bg-[var(--off-bg)] text-sm text-[var(--text-high)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* Botão enviar */}
        <button
          onClick={() => mutEnviar.mutate()}
          disabled={mutEnviar.isPending}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
        >
          <Send size={16} />
          {mutEnviar.isPending ? 'Enviando…' : 'Enviar proposta'}
        </button>

        <p className="text-center text-xs text-[var(--text-low)]">
          Powered by Eldox · Sistema de Gestão de Qualidade em Obras
        </p>
      </div>
    </div>
  )
}
