// frontend-web/src/modules/fvs/modelos/pages/ModeloDetailPage.tsx
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  useModelo, useConcluirModelo, useReabrirModelo, useDuplicarModelo,
  useAddServicoModelo, useDeleteServicoModelo, useUpdateModelo,
  useObrasModelo, useDesvincularObraModelo,
} from '../hooks/useModelos';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
import { fvsService } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { Pencil, Copy, CheckCircle, RotateCcw, Trash2, Building2, Plus, X } from 'lucide-react';
import { VincularObraModal } from '../components/VincularObraModal';

const CRITICIDADE_CLS: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

export function ModeloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const modeloId = parseInt(id!);
  const navigate = useNavigate();

  const { data: modelo, isLoading } = useModelo(modeloId);
  const { data: catalogo = [] }     = useServicos();
  const { data: obrasVinculadas = [], isLoading: loadingObras } = useObrasModelo(modeloId);
  const concluir        = useConcluirModelo();
  const reabrir         = useReabrirModelo();
  const duplicar        = useDuplicarModelo();
  const addServico      = useAddServicoModelo(modeloId);
  const deleteServico   = useDeleteServicoModelo(modeloId);
  const updateModelo    = useUpdateModelo();
  const desvincularObra = useDesvincularObraModelo(modeloId);

  const [novoServicoId,    setNovoServicoId]    = useState<number | null>(null);
  const [itensDesmarcados, setItensDesmarcados] = useState<Set<number>>(new Set());
  const [itemFotosMap,     setItemFotosMap]     = useState<Record<number, number>>({});
  const [fotosItensSel,    setFotosItensSel]    = useState<Set<number> | null>(null);
  const [erro,             setErro]             = useState('');
  const [obraModalOpen,    setObraModalOpen]    = useState(false);

  const { data: servicoDetalhes, isFetching: carregandoItens } = useQuery({
    queryKey: ['fvs-servico-detalhe', novoServicoId],
    queryFn:  () => fvsService.getServico(novoServicoId!),
    enabled:  !!novoServicoId,
  });

  // Carrega itens de todos os serviços do template (para seleção de fotos obrigatórias)
  const servicosIdsList = useMemo(() => modelo?.servicos?.map(s => s.servico_id) ?? [], [modelo?.servicos]);
  const servicosItensQueries = useQueries({
    queries: servicosIdsList.map(svcId => ({
      queryKey: ['fvs-servico-detalhe', svcId],
      queryFn:  () => fvsService.getServico(svcId),
    })),
  });
  const todosItensServicos = useMemo(() => {
    return servicosItensQueries
      .filter(q => q.data)
      .flatMap(q => (q.data!.itens ?? []).map(item => ({
        ...item,
        servico_nome: q.data!.nome,
      })));
  }, [servicosItensQueries]);

  function handleSelecionarServico(id: number | null) {
    setNovoServicoId(id);
    setItensDesmarcados(new Set());
    setItemFotosMap({});
  }

  function toggleItem(itemId: number) {
    setItensDesmarcados(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }

  async function handleAddServico() {
    if (!novoServicoId) return;
    setErro('');
    const itensExcluidos = itensDesmarcados.size > 0 ? [...itensDesmarcados] : undefined;
    const itemFotos = Object.keys(itemFotosMap).length > 0
      ? Object.fromEntries(Object.entries(itemFotosMap).map(([k, v]) => [k, v]))
      : undefined;
    try {
      await addServico.mutateAsync({ servicoId: novoServicoId, itensExcluidos, itemFotos });
      setNovoServicoId(null);
      setItensDesmarcados(new Set());
      setItemFotosMap({});
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao adicionar serviço');
    }
  }

  async function handleRemoveServico(servicoId: number) {
    if (!confirm('Remover serviço do template?')) return;
    setErro('');
    try { await deleteServico.mutateAsync(servicoId); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao remover'); }
  }

  async function handleCiclo(acao: 'concluir' | 'reabrir' | 'duplicar') {
    setErro('');
    try {
      if (acao === 'concluir')     await concluir.mutateAsync(modeloId);
      else if (acao === 'reabrir') await reabrir.mutateAsync(modeloId);
      else { const n = await duplicar.mutateAsync(modeloId); navigate(`/fvs/modelos/${n.id}`); }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? `Erro ao ${acao}`);
    }
  }

  function abrirSelecaoFotos() {
    const inicial = new Set<number>(modelo?.fotos_itens_ids ?? []);
    setFotosItensSel(inicial);
  }

  async function salvarFotosItens() {
    if (!fotosItensSel) return;
    setErro('');
    try {
      await updateModelo.mutateAsync({
        id: modeloId,
        fotosItensIds: [...fotosItensSel],
      });
      setFotosItensSel(null);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar itens');
    }
  }

  async function handleDesvincularObra(obraId: number, obraNome: string) {
    if (!confirm(`Desvincular "${obraNome}" deste template?`)) return;
    try { await desvincularObra.mutateAsync(obraId); }
    catch (e: any) { setErro(e?.response?.data?.message ?? 'Erro ao desvincular'); }
  }

  if (isLoading || !modelo) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  const editavel    = modelo.status === 'rascunho' && !modelo.bloqueado;
  const servicosIds = new Set(modelo.servicos?.map(s => s.servico_id) ?? []);
  const itensDoServico = servicoDetalhes?.itens ?? [];
  const totalItens     = itensDoServico.length;
  const selecionados   = totalItens - itensDesmarcados.size;

  return (
    <div className="p-6 max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-high)] m-0 mb-1">{modelo.nome}</h1>
          <p className="text-xs text-[var(--text-faint)] m-0">
            v{modelo.versao} · {modelo.regime === 'pbqph' ? 'PBQP-H' : 'Inspeção Interna'} · {modelo.escopo}
            {modelo.bloqueado ? ' · Bloqueado' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {editavel && (
            <button
              onClick={() => navigate(`/fvs/modelos/${modeloId}/editar`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
            >
              <Pencil size={12} /> Editar
            </button>
          )}
          <button
            onClick={() => setObraModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Building2 size={12} /> Obras
            {obrasVinculadas.length > 0 && (
              <span className="ml-0.5 bg-[var(--accent)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {obrasVinculadas.length}
              </span>
            )}
          </button>
          {modelo.status === 'rascunho' && !modelo.bloqueado && (
            <button
              onClick={() => handleCiclo('concluir')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--ok-border)] text-[var(--ok-text)] hover:bg-[var(--ok-bg)] transition-colors"
            >
              <CheckCircle size={12} /> Concluir
            </button>
          )}
          {modelo.status === 'concluido' && !modelo.bloqueado && (
            <button
              onClick={() => handleCiclo('reabrir')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--warn-border)] text-[var(--warn-text)] hover:bg-[var(--warn-bg)] transition-colors"
            >
              <RotateCcw size={12} /> Reabrir
            </button>
          )}
          <button
            onClick={() => handleCiclo('duplicar')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Copy size={12} /> Duplicar
          </button>
        </div>
      </div>

      {/* Erro global */}
      {erro && (
        <p className="text-sm text-[var(--nc-text)] px-3 py-2 rounded-md bg-[var(--nc-bg)] border border-[var(--nc-border)] mb-4">
          {erro}
        </p>
      )}

      {/* Flags de workflow */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {[
          { label: 'Exige RO',         val: modelo.exige_ro },
          { label: 'Exige Reinspeção', val: modelo.exige_reinspecao },
          { label: 'Exige Parecer',    val: modelo.exige_parecer },
        ].map(({ label, val }) => (
          <span
            key={label}
            className={cn(
              'text-xs font-semibold px-3 py-1 rounded-full',
              val
                ? 'bg-[var(--ok-bg)] text-[var(--ok-text)] border border-[var(--ok-border)]'
                : 'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
            )}
          >
            {val ? '✓' : '✗'} {label}
          </span>
        ))}
        <span
          onClick={() => modelo.fotos_obrigatorias === 'itens_selecionados' && editavel ? abrirSelecaoFotos() : undefined}
          className={cn(
            'text-xs font-semibold px-3 py-1 rounded-full bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
            modelo.fotos_obrigatorias === 'itens_selecionados' && editavel ? 'cursor-pointer hover:bg-[var(--bg-hover)]' : '',
          )}
        >
          📷 Fotos: {{
            todas:              'Todos os itens',
            apenas_nc:          'Apenas NCs',
            nenhuma:            'Não obrigatório',
            itens_selecionados: `Itens selecionados (${(modelo.fotos_itens_ids ?? []).length})`,
          }[modelo.fotos_obrigatorias ?? 'apenas_nc']}
          {modelo.fotos_obrigatorias === 'itens_selecionados' && editavel && ' ✎'}
        </span>
      </div>

      {/* ── Serviços ───────────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-[var(--text-high)] uppercase tracking-wide mb-3">
        Serviços do Template
      </h2>

      {editavel && (
        <div className="mb-5 border border-[var(--border-dim)] rounded-lg overflow-hidden">
          <div className={cn('flex gap-2 p-3 bg-[var(--bg-raised)]', novoServicoId ? 'border-b border-[var(--border-dim)]' : '')}>
            <select
              value={novoServicoId ?? ''}
              onChange={e => handleSelecionarServico(parseInt(e.target.value) || null)}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-[var(--border-dim)] bg-[var(--bg-base)] text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">Selecionar serviço do catálogo...</option>
              {catalogo.filter(s => !servicosIds.has(s.id)).map(s => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
            <button
              onClick={handleAddServico}
              disabled={!novoServicoId || addServico.isPending}
              className="px-4 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {addServico.isPending ? 'Adicionando...' : '+ Adicionar'}
            </button>
          </div>

          {novoServicoId && (
            <div className="p-3">
              {carregandoItens ? (
                <p className="text-sm text-[var(--text-faint)] m-0">Carregando itens...</p>
              ) : totalItens === 0 ? (
                <p className="text-sm text-[var(--text-faint)] m-0">Nenhum item cadastrado neste serviço.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide m-0">
                      Itens de Inspeção — {selecionados} de {totalItens} selecionados
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setItensDesmarcados(new Set())} className="text-xs text-[var(--accent)] underline bg-transparent border-none cursor-pointer p-0">Marcar todos</button>
                      <button onClick={() => setItensDesmarcados(new Set(itensDoServico.map(i => i.id)))} className="text-xs text-[var(--accent)] underline bg-transparent border-none cursor-pointer p-0">Desmarcar todos</button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {itensDoServico.map(item => {
                      const checked = !itensDesmarcados.has(item.id);
                      const fotoQtd = itemFotosMap[item.id] ?? 1;
                      return (
                        <div key={item.id} className={cn('flex items-center gap-2.5 p-2 rounded-md border transition-colors', checked ? 'bg-[var(--accent-subtle,#eff6ff)] border-[var(--accent-border,#bfdbfe)]' : 'bg-[var(--bg-raised)] border-[var(--border-dim)]')}>
                          <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="mt-0.5 accent-[var(--accent)] w-4 h-4 flex-shrink-0 cursor-pointer" />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleItem(item.id)}>
                            <p className={cn('text-sm font-medium m-0', checked ? 'text-[var(--accent)]' : 'text-[var(--text-faint)]')}>{item.descricao}</p>
                            {item.criterio_aceite && <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5 truncate">{item.criterio_aceite}</p>}
                          </div>
                          {item.criticidade && (
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', CRITICIDADE_CLS[item.criticidade] ?? CRITICIDADE_CLS.menor)}>
                              {item.criticidade}
                            </span>
                          )}
                          <div className="flex items-center gap-1 flex-shrink-0" title="Quantidade mínima de fotos">
                            <span className="text-[10px] text-[var(--text-faint)]">📷</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={fotoQtd}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setItemFotosMap(prev => ({ ...prev, [item.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                              className="w-12 h-6 px-1.5 text-[11px] text-center bg-[var(--bg-base)] border border-[var(--border-dim)] rounded text-[var(--text-high)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(modelo.servicos?.length ?? 0) === 0 ? (
        <p className="text-sm text-[var(--text-faint)] mb-8">Nenhum serviço adicionado ainda.</p>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden mb-8">
          {modelo.servicos!.map((svc, i) => (
            <div key={svc.id} className={cn('flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors', i < modelo.servicos!.length - 1 ? 'border-b border-[var(--border-dim)]' : '')}>
              <div>
                <p className="text-sm font-medium text-[var(--text-high)] m-0">{svc.servico_nome}</p>
                {svc.itens_excluidos?.length ? (
                  <p className="text-xs text-[var(--warn-text)] m-0 mt-0.5">{svc.itens_excluidos.length} item(s) excluído(s)</p>
                ) : (
                  <p className="text-xs text-[var(--ok-text)] m-0 mt-0.5">Todos os itens incluídos</p>
                )}
              </div>
              {editavel && (
                <button onClick={() => handleRemoveServico(svc.servico_id)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--nc-border)] text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors">
                  <Trash2 size={11} /> Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Obras Vinculadas ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[var(--text-high)] uppercase tracking-wide m-0">
          Obras Vinculadas
        </h2>
        <button
          onClick={() => setObraModalOpen(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"
        >
          <Plus size={12} /> Vincular Obra
        </button>
      </div>

      {loadingObras ? (
        <p className="text-sm text-[var(--text-faint)]">Carregando obras...</p>
      ) : obrasVinculadas.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">Nenhuma obra vinculada. Clique em "Vincular Obra" para associar.</p>
      ) : (
        <div className="border border-[var(--border-dim)] rounded-lg overflow-hidden">
          {obrasVinculadas.map((ov, i) => (
            <div key={ov.id} className={cn('flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors', i < obrasVinculadas.length - 1 ? 'border-b border-[var(--border-dim)]' : '')}>
              <div className="flex items-center gap-2.5">
                <Building2 size={14} className="text-[var(--text-faint)] flex-shrink-0" />
                <p className="text-sm font-medium text-[var(--text-high)] m-0">{ov.obra_nome}</p>
              </div>
              <button
                onClick={() => handleDesvincularObra(ov.obra_id, ov.obra_nome ?? '')}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border border-[var(--nc-border)] text-[var(--nc-text)] hover:bg-[var(--nc-bg)] transition-colors"
              >
                <X size={11} /> Desvincular
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal de seleção de itens para fotos obrigatórias */}
      {fotosItensSel !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-high)] m-0">Fotos obrigatórias por item</h3>
                <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                  {fotosItensSel.size} item{fotosItensSel.size !== 1 ? 'ns' : ''} selecionado{fotosItensSel.size !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setFotosItensSel(() => new Set(todosItensServicos.map(i => i.id))); }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >Marcar todos</button>
                <button
                  onClick={() => setFotosItensSel(new Set())}
                  className="text-xs text-[var(--accent)] hover:underline"
                >Limpar</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
              {todosItensServicos.length === 0 && (
                <p className="text-sm text-[var(--text-faint)] py-4 text-center">Nenhum item encontrado. Adicione serviços ao template primeiro.</p>
              )}
              {todosItensServicos.map(item => {
                const checked = fotosItensSel.has(item.id);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-md border cursor-pointer transition-colors',
                      checked
                        ? 'bg-[var(--accent-subtle,#eff6ff)] border-[var(--accent-border,#bfdbfe)]'
                        : 'bg-[var(--bg-raised)] border-[var(--border-dim)] hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setFotosItensSel(prev => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          return next;
                        });
                      }}
                      className="w-4 h-4 accent-[var(--accent)] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm m-0', checked ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-high)]')}>
                        {item.descricao}
                      </p>
                      <p className="text-xs text-[var(--text-faint)] m-0">{item.servico_nome}</p>
                    </div>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', CRITICIDADE_CLS[item.criticidade] ?? CRITICIDADE_CLS.menor)}>
                      {item.criticidade}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border-dim)]">
              <button
                onClick={() => setFotosItensSel(null)}
                className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarFotosItens}
                disabled={updateModelo.isPending}
                className="px-4 py-2 text-sm rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updateModelo.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {obraModalOpen && (
        <VincularObraModal
          modeloId={modeloId}
          modeloNome={modelo.nome}
          onClose={() => setObraModalOpen(false)}
        />
      )}
    </div>
  );
}
