// frontend-web/src/modules/almoxarifado/cotacoes/pages/ComparativoPage.tsx
// Comparativo de preços lado a lado + Curva ABC + botão Gerar OC
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, Zap, ShoppingCart, AlertTriangle, TrendingDown, Info } from 'lucide-react'
import { almoxarifadoService } from '../../_service/almoxarifado.service'
import type { AlmComparativoItem, AlmCurvaAbcItem } from '../../_service/almoxarifado.service'
import { cn } from '@/lib/cn'

type Tab = 'comparativo' | 'curva-abc'

const ABC_COLOR: Record<string, string> = {
  A: 'bg-[var(--nc-bg)] text-[var(--nc)]',
  B: 'bg-[var(--warn-bg)] text-[var(--warn)]',
  C: 'bg-[var(--ok-bg)] text-[var(--ok)]',
}

export default function ComparativoPage() {
  const { solId } = useParams<{ solId: string }>()
  const solicitacaoId = Number(solId)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('comparativo')
  const [modo, setModo] = useState<'automatico' | 'manual'>('automatico')

  // Seleções manuais: catalogo_id → cotacao_id
  const [selecoes, setSelecoes] = useState<Record<number, number>>({})

  const { data: comparativo = [], isLoading: loadComp } = useQuery({
    queryKey: ['comparativo', solicitacaoId],
    queryFn: () => almoxarifadoService.getComparativo(solicitacaoId),
  })

  const { data: curvaAbc = [], isLoading: loadAbc } = useQuery({
    queryKey: ['curva-abc', solicitacaoId],
    queryFn: () => almoxarifadoService.getCurvaAbc(solicitacaoId),
    enabled: tab === 'curva-abc',
  })

  const mutGerarOc = useMutation({
    mutationFn: () =>
      almoxarifadoService.gerarOcs(solicitacaoId, {
        modo,
        selecoes: modo === 'manual'
          ? Object.entries(selecoes).map(([catalogoId, cotacaoId]) => ({
              catalogo_id: Number(catalogoId),
              cotacao_id: cotacaoId,
            }))
          : undefined,
      }),
    onSuccess: (data) => {
      alert(`${data.ocs_criadas} Ordem(ns) de Compra gerada(s) com sucesso!`)
      navigate(`/almoxarifado/solicitacoes/${solicitacaoId}`)
    },
  })

  // Fornecedores únicos que apareceram no comparativo
  const fornecedores = Array.from(
    new Map(
      comparativo
        .flatMap((i) => i.propostas)
        .map((p) => [p.fornecedor_id, { id: p.fornecedor_id, nome: p.fornecedor_nome }]),
    ).values(),
  )

  const economiaTotal = comparativo.reduce((acc, item) => {
    if (item.economia_pct !== null && item.menor_preco !== null) {
      const propostas = item.propostas.filter((p) => p.preco_unitario !== null)
      if (propostas.length >= 2) {
        const maior = Math.max(...propostas.map((p) => p.preco_unitario!))
        const menor = item.menor_preco
        acc += (maior - menor) * item.quantidade
      }
    }
    return acc
  }, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-high)]">Comparativo de Cotações</h1>
          <p className="text-sm text-[var(--text-low)] mt-0.5">
            Solicitação #{solicitacaoId} — {comparativo.length} itens comparados
          </p>
        </div>

        {economiaTotal > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--ok-bg)] text-[var(--ok)] text-sm font-medium">
            <Zap size={14} />
            Economia potencial: R$ {economiaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--off-bg)] rounded-lg w-fit">
        {(['comparativo', 'curva-abc'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? 'bg-[var(--bg-card)] text-[var(--text-high)] shadow-sm'
                : 'text-[var(--text-low)] hover:text-[var(--text-high)]',
            )}
          >
            {t === 'comparativo' ? 'Comparativo' : 'Curva ABC'}
          </button>
        ))}
      </div>

      {/* ── Tab: Comparativo ─────────────────────────────────────────────────── */}
      {tab === 'comparativo' && (
        <>
          {loadComp ? (
            <div className="text-sm text-[var(--text-low)]">Carregando…</div>
          ) : comparativo.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-low)] text-sm">
              Nenhuma cotação respondida para comparar.
            </div>
          ) : (
            <>
              {/* Modo de seleção */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[var(--text-low)] font-medium">Modo de seleção:</span>
                {(['automatico', 'manual'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={modo === m}
                      onChange={() => setModo(m)}
                      className="accent-[var(--accent)]"
                    />
                    <span className="text-[var(--text-high)] capitalize">{m === 'automatico' ? 'Automático (menor preço)' : 'Manual'}</span>
                  </label>
                ))}
              </div>

              {/* Tabela comparativa */}
              <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--off-bg)]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-low)] w-64">Material</th>
                      <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-low)] w-16">Qtd</th>
                      {fornecedores.map((f) => (
                        <th
                          key={f.id}
                          className="text-center px-3 py-3 text-xs font-medium text-[var(--text-low)] min-w-36"
                          title="Preço nominal por unidade + Valor Presente (VP) do total do item descontado à taxa de 1,5% a.m. considerando a condição de pagamento"
                        >
                          <div className="flex items-center justify-center gap-1">
                            {f.nome}
                            <Info size={11} className="text-[var(--text-low)] opacity-60" />
                          </div>
                        </th>
                      ))}
                      <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-low)] w-20">Econ.</th>
                      {modo === 'manual' && (
                        <th className="text-center px-3 py-3 text-xs font-medium text-[var(--text-low)] w-32">Selecionar</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {comparativo.map((item) => (
                      <ComparativoRow
                        key={item.catalogo_id}
                        item={item}
                        fornecedores={fornecedores}
                        modo={modo}
                        selecaoAtual={selecoes[item.catalogo_id]}
                        onSelecionar={(cotacaoId) =>
                          setSelecoes((prev) => ({ ...prev, [item.catalogo_id]: cotacaoId }))
                        }
                      />
                    ))}
                  </tbody>
                  {/* Totais */}
                  <tfoot>
                    <tr className="border-t border-[var(--border)] bg-[var(--off-bg)]">
                      <td className="px-4 py-3 text-xs font-semibold text-[var(--text-high)]" colSpan={2}>
                        Total nominal
                      </td>
                      {fornecedores.map((f) => {
                        const total = comparativo.reduce((acc, item) => {
                          const proposta = item.propostas.find((p) => p.fornecedor_id === f.id)
                          return acc + (proposta?.total_item ?? 0)
                        }, 0)
                        return (
                          <td key={f.id} className="text-center px-3 py-3 text-xs font-semibold text-[var(--text-high)]">
                            {total > 0 ? `R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                          </td>
                        )
                      })}
                      <td colSpan={modo === 'manual' ? 2 : 1} />
                    </tr>
                    <tr className="border-t border-[var(--border)] bg-[var(--off-bg)]">
                      <td
                        className="px-4 py-3 text-xs font-semibold text-[var(--text-high)]"
                        colSpan={2}
                        title="Soma dos VPs por item — descontado a 1,5% a.m. conforme a condição de pagamento de cada cotação"
                      >
                        <div className="flex items-center gap-1">
                          Total VP (1,5% a.m.)
                          <Info size={11} className="text-[var(--text-low)] opacity-60" />
                        </div>
                      </td>
                      {fornecedores.map((f) => {
                        const totalVp = comparativo.reduce((acc, item) => {
                          const proposta = item.propostas.find((p) => p.fornecedor_id === f.id)
                          return acc + (proposta?.valor_presente ?? 0)
                        }, 0)
                        // Menor total VP entre fornecedores (para destacar o "melhor por VP" no rodapé)
                        const totaisVp = fornecedores.map((ff) =>
                          comparativo.reduce((acc, item) => {
                            const proposta = item.propostas.find((p) => p.fornecedor_id === ff.id)
                            return acc + (proposta?.valor_presente ?? 0)
                          }, 0),
                        )
                        const menorTotalVp = Math.min(...totaisVp.filter((v) => v > 0))
                        const isBestOverall = totalVp > 0 && totalVp === menorTotalVp
                        return (
                          <td
                            key={f.id}
                            className={cn(
                              'text-center px-3 py-3 text-xs font-semibold',
                              isBestOverall ? 'text-[var(--ok)]' : 'text-[var(--text-high)]',
                            )}
                          >
                            {totalVp > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {isBestOverall && <TrendingDown size={11} className="text-[var(--ok)]" />}
                                R$ {totalVp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        )
                      })}
                      <td colSpan={modo === 'manual' ? 2 : 1} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botão Gerar OC */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => mutGerarOc.mutate()}
                  disabled={mutGerarOc.isPending || (modo === 'manual' && Object.keys(selecoes).length === 0)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
                >
                  <ShoppingCart size={15} />
                  {mutGerarOc.isPending ? 'Gerando OC(s)…' : 'Gerar Ordem de Compra'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Curva ABC ───────────────────────────────────────────────────── */}
      {tab === 'curva-abc' && (
        <>
          {loadAbc ? (
            <div className="text-sm text-[var(--text-low)]">Carregando…</div>
          ) : curvaAbc.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-low)] text-sm">
              Sem dados para Curva ABC. Aguarde respostas dos fornecedores.
            </div>
          ) : (
            <CurvaAbcTable items={curvaAbc} />
          )}
        </>
      )}
    </div>
  )
}

// ── Linha do comparativo ──────────────────────────────────────────────────────

function ComparativoRow({
  item,
  fornecedores,
  modo,
  selecaoAtual,
  onSelecionar,
}: {
  item: AlmComparativoItem
  fornecedores: { id: number; nome: string }[]
  modo: 'automatico' | 'manual'
  selecaoAtual: number | undefined
  onSelecionar: (cotacaoId: number) => void
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--off-bg)] transition-colors">
      <td className="px-4 py-3 text-[var(--text-high)] text-xs font-medium">
        {item.catalogo_nome}
      </td>
      <td className="text-center px-3 py-3 text-xs text-[var(--text-low)]">
        {item.quantidade} {item.unidade}
      </td>
      {fornecedores.map((f) => {
        const proposta = item.propostas.find((p) => p.fornecedor_id === f.id)
        const isBest = proposta?.melhor_preco && modo === 'automatico'
        const isBestVp = !!proposta?.melhor_preco_vp
        // Só mostra o badge "Melhor por VP" quando ele difere do melhor por preço
        // nominal — caso contrário seria redundante.
        const vpBeatsNominal =
          isBestVp && item.melhor_cotacao_id !== null && item.melhor_cotacao_vp_id !== item.melhor_cotacao_id

        return (
          <td key={f.id} className={cn(
            'text-center px-3 py-3 text-xs',
            isBest ? 'font-semibold text-[var(--ok)]' : 'text-[var(--text-high)]',
          )}>
            {proposta == null ? (
              <span className="text-[var(--text-low)]">—</span>
            ) : !proposta.disponivel ? (
              <span className="text-[var(--off)] text-[10px]">Indisponível</span>
            ) : proposta.preco_unitario == null ? (
              <span className="text-[var(--text-low)]">—</span>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  {isBest && <CheckCircle size={11} className="text-[var(--ok)]" />}
                  R$ {proposta.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                {proposta.valor_presente != null && proposta.total_item != null && (
                  <div
                    className={cn(
                      'text-[10px] flex items-center justify-center gap-1',
                      vpBeatsNominal ? 'text-[var(--ok)] font-semibold' : 'text-[var(--text-low)]',
                    )}
                    title={
                      `VP do item (total ${proposta.total_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) ` +
                      `descontado a 1,5% a.m. — condição: ${proposta.condicao_pgto ?? 'à vista'}`
                    }
                  >
                    {vpBeatsNominal && <TrendingDown size={10} />}
                    VP R$ {proposta.valor_presente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                )}
                {vpBeatsNominal && (
                  <span
                    className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-[var(--ok-bg)] text-[var(--ok)] text-[9px] font-bold uppercase tracking-wide"
                    title="Esta cotação é a melhor quando descontada pelo valor presente, apesar de não ter o menor preço nominal"
                  >
                    Melhor por VP
                  </span>
                )}
                {proposta.prazo_dias != null && (
                  <div className="text-[10px] text-[var(--text-low)]">Entrega: {proposta.prazo_dias}d</div>
                )}
                {proposta.condicao_pgto && (
                  <div className="text-[9px] text-[var(--text-low)] opacity-70">
                    Pgto: {proposta.condicao_pgto}
                  </div>
                )}
              </div>
            )}
          </td>
        )
      })}
      {/* Economia */}
      <td className="text-center px-3 py-3 text-xs">
        {item.economia_pct != null && item.economia_pct > 0 ? (
          <span className="text-[var(--ok)] font-medium">-{item.economia_pct}%</span>
        ) : (
          <span className="text-[var(--text-low)]">—</span>
        )}
      </td>
      {/* Seleção manual */}
      {modo === 'manual' && (
        <td className="text-center px-3 py-3">
          <select
            value={selecaoAtual ?? ''}
            onChange={(e) => onSelecionar(Number(e.target.value))}
            className="text-xs border border-[var(--border)] rounded px-2 py-1 bg-[var(--bg-card)] text-[var(--text-high)]"
          >
            <option value="">Selecionar</option>
            {item.propostas
              .filter((p) => p.preco_unitario != null && p.disponivel)
              .map((p) => (
                <option key={p.cotacao_id} value={p.cotacao_id}>
                  {p.fornecedor_nome} — R$ {p.preco_unitario!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </option>
              ))}
          </select>
        </td>
      )}
    </tr>
  )
}

// ── Tabela Curva ABC ──────────────────────────────────────────────────────────

function CurvaAbcTable({ items }: { items: AlmCurvaAbcItem[] }) {
  const totalGeral = items.reduce((acc, i) => acc + i.valor_total, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(['A', 'B', 'C'] as const).map((cls) => {
          const grupo = items.filter((i) => i.classificacao === cls)
          const valor = grupo.reduce((acc, i) => acc + i.valor_total, 0)
          return (
            <div key={cls} className={cn('rounded-xl p-4 border', ABC_COLOR[cls])}>
              <div className="text-2xl font-black">{cls}</div>
              <div className="text-sm font-semibold mt-1">
                {grupo.length} {grupo.length === 1 ? 'item' : 'itens'}
              </div>
              <div className="text-xs mt-0.5">
                R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {' '}({Math.round((valor / totalGeral) * 100)}% do total)
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--off-bg)] border-b border-[var(--border)]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-low)]">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[var(--text-low)]">Material</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-low)]">Valor Total</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-low)]">% Item</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[var(--text-low)]">% Acum.</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[var(--text-low)]">Classe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.catalogo_id} className="border-b border-[var(--border)] hover:bg-[var(--off-bg)]">
                <td className="px-4 py-2 text-xs text-[var(--text-low)]">{idx + 1}</td>
                <td className="px-4 py-2 text-xs text-[var(--text-high)] font-medium">{item.catalogo_nome}</td>
                <td className="px-4 py-2 text-xs text-right text-[var(--text-high)]">
                  R$ {item.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2 text-xs text-right text-[var(--text-low)]">
                  {item.percentual.toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-xs text-right text-[var(--text-low)]">
                  {item.percentual_acumulado.toFixed(1)}%
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={cn(
                    'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold',
                    ABC_COLOR[item.classificacao],
                  )}>
                    {item.classificacao}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--off-bg)] text-xs text-[var(--text-low)]">
        <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
        <span>
          <strong className="text-[var(--text-high)]">Classe A</strong> = 80% do valor total (poucos itens, alto impacto — negociar com prioridade).
          {' '}<strong className="text-[var(--text-high)]">Classe B</strong> = 15% (importância média).
          {' '}<strong className="text-[var(--text-high)]">Classe C</strong> = 5% (muitos itens, baixo valor — comprar de forma simples).
        </span>
      </div>
    </div>
  )
}
