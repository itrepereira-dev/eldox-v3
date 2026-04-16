// frontend-web/src/modules/fvs/inspecao/components/InspecaoModal.tsx
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFicha } from '../hooks/useFichas';
import { useRegistros, usePutRegistro, usePatchLocal } from '../hooks/useRegistros';
import { FotosModal } from './FotosModal';
import { RegistroNcModal } from './RegistroNcModal';
import type { FvsRegistro, StatusRegistro } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { X, Camera, Brain } from 'lucide-react';
import { api } from '../../../../services/api';

const STATUS_OPTIONS: { value: StatusRegistro; label: string }[] = [
  { value: 'conforme',       label: 'Conforme' },
  { value: 'nao_conforme',   label: 'Não Conforme' },
  { value: 'excecao',        label: 'Exceção' },
  { value: 'nao_avaliado',   label: 'Não Avaliado' },
  { value: 'nao_aplicavel',  label: 'Não Aplicável' },
];

const STATUS_CLS: Record<string, string> = {
  conforme:                 'text-[var(--ok-text)]',
  nao_conforme:             'text-[var(--nc-text)]',
  excecao:                  'text-[var(--warn-text)]',
  nao_avaliado:             'text-[var(--text-faint)]',
  nao_aplicavel:            'text-[var(--text-faint)] line-through',
  conforme_apos_reinspecao: 'text-[var(--ok-text)]',
  nc_apos_reinspecao:       'text-[var(--nc-text)]',
  liberado_com_concessao:   'text-yellow-600',
  retrabalho:               'text-[var(--warn-text)]',
};

const CRIT_CLS: Record<string, string> = {
  critico: 'bg-[var(--nc-bg)] text-[var(--nc-text)] border border-[var(--nc-border)]',
  maior:   'bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]',
  menor:   'bg-[var(--bg-raised)] text-[var(--text-faint)] border border-[var(--border-dim)]',
};

export interface InspecaoModalProps {
  fichaId: number;
  servicoId: number;
  localId: number;
  servicoNome?: string;
  localNome?: string;
  onClose: () => void;
}

export function InspecaoModal({ fichaId, servicoId, localId, servicoNome, localNome, onClose }: InspecaoModalProps) {
  const { data: ficha } = useFicha(fichaId);
  const { data: registros = [], isLoading } = useRegistros(fichaId, servicoId, localId);
  const putRegistro = usePutRegistro(fichaId);
  const patchLocal  = usePatchLocal(fichaId);

  const [fotosRegistro,  setFotosRegistro]  = useState<FvsRegistro | null>(null);
  const [ncRegistro,     setNcRegistro]     = useState<FvsRegistro | null>(null);
  const [equipe,         setEquipe]         = useState('');
  const [editandoEquipe, setEditandoEquipe] = useState(false);
  const [diagnosticoNcId, setDiagnosticoNcId] = useState<number | null>(null);
  const [diagnosticoResult, setDiagnosticoResult] = useState<Record<number, any>>({});

  const diagnosticoNc = useMutation({
    mutationFn: ({ fichaId: fid, ncId }: { fichaId: number; ncId: number }) =>
      api.post(`/fvs/fichas/${fid}/ncs/${ncId}/diagnostico-ia`).then(r => r.data),
    onSuccess: (data, vars) => setDiagnosticoResult(prev => ({ ...prev, [vars.ncId]: data })),
  });

  useEffect(() => {
    setEquipe(registros[0]?.equipe_responsavel ?? '');
  }, [registros[0]?.equipe_responsavel]);

  // Fechar com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const regime    = ficha?.regime ?? 'livre';
  const podeEditar = ficha?.status === 'em_inspecao';

  const maxCiclo       = registros.length > 0 ? Math.max(...registros.map(r => r.ciclo ?? 1), 1) : 1;
  const eReinsspecao   = maxCiclo > 1;
  const totalItens     = registros.length;
  const avaliados      = registros.filter(r => r.status !== 'nao_avaliado').length;
  const progresso      = totalItens > 0 ? Math.round((avaliados / totalItens) * 100) : 0;

  async function handleStatusChange(reg: FvsRegistro, novoStatus: StatusRegistro) {
    if (!podeEditar) return;
    if (eReinsspecao && !reg.desbloqueado) return;
    if (novoStatus === 'nao_conforme') {
      setNcRegistro({ ...reg, status: novoStatus });
      return;
    }
    await putRegistro.mutateAsync({ servicoId, itemId: reg.item_id, localId, status: novoStatus, ciclo: maxCiclo });
  }

  async function handleSalvarNc(obs: string) {
    if (!ncRegistro) return;
    await putRegistro.mutateAsync({ servicoId, itemId: ncRegistro.item_id, localId, status: 'nao_conforme', observacao: obs, ciclo: maxCiclo });
    setNcRegistro(null);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Painel central */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Cabeçalho */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border-dim)] flex-shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-[var(--text-high)] m-0 truncate">
                {servicoNome ?? `Serviço ${servicoId}`}
              </h3>
              <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">
                {localNome ?? `Local ${localId}`}
                {' · '}
                {avaliados}/{totalItens} itens · {progresso}%
              </p>
              {/* Barra de progresso */}
              <div className="mt-2 max-w-xs bg-[var(--border-dim)] rounded-full h-1">
                <div className="bg-[var(--ok-text)] h-full rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              {/* Equipe */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--text-faint)]">Equipe:</span>
                {editandoEquipe ? (
                  <input
                    value={equipe}
                    onChange={e => setEquipe(e.target.value)}
                    onBlur={async () => {
                      setEditandoEquipe(false);
                      await patchLocal.mutateAsync({ localId, equipeResponsavel: equipe || null });
                    }}
                    autoFocus
                    className="text-xs px-2 py-0.5 border border-[var(--accent)] rounded focus:outline-none bg-[var(--bg-base)] text-[var(--text-high)] w-32"
                  />
                ) : (
                  <span
                    onClick={() => podeEditar && setEditandoEquipe(true)}
                    className={cn(
                      'text-xs border-b transition-colors',
                      equipe ? 'text-[var(--text-high)]' : 'text-[var(--text-faint)]',
                      podeEditar ? 'cursor-pointer border-dashed border-[var(--border-dim)]' : 'cursor-default border-transparent',
                    )}
                  >
                    {equipe || (podeEditar ? 'Clique...' : '—')}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--text-high)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Banner reinspeção */}
          {eReinsspecao && (
            <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium flex-shrink-0">
              🔄 Reinspeção — Ciclo {maxCiclo} — Apenas itens desbloqueados
            </div>
          )}

          {/* Corpo scrollável */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading || !ficha ? (
              <div className="flex items-center justify-center h-32 text-[var(--text-faint)] text-sm">
                Carregando...
              </div>
            ) : (
              <div className="border-[var(--border-dim)]">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
                      <th className="text-left px-3 py-2.5 w-8 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Item de Verificação</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap">Crit.</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Status</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Observação</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((reg, i) => {
                      const isCriticoNcSemFoto = regime === 'pbqph' && reg.item_criticidade === 'critico' && reg.status === 'nao_conforme' && reg.evidencias_count === 0;
                      const bloqueadoReinsspecao = eReinsspecao && !reg.desbloqueado;
                      return (
                        <tr
                          key={reg.item_id}
                          className={cn(
                            'border-b border-[var(--border-dim)] last:border-0 transition-colors',
                            i % 2 === 0 ? 'bg-[var(--bg-base)]' : 'bg-[var(--bg-raised)]',
                            bloqueadoReinsspecao ? 'opacity-40 pointer-events-none' : 'hover:bg-[var(--bg-hover)]',
                          )}
                        >
                          <td className="px-3 py-3 text-[var(--text-faint)] text-xs">{i + 1}</td>
                          <td className="px-3 py-3">
                            <p className="text-[var(--text-high)] m-0">{reg.item_descricao}</p>
                            {reg.item_criterio_aceite && (
                              <p className="text-xs text-[var(--text-faint)] m-0 mt-0.5">{reg.item_criterio_aceite}</p>
                            )}
                            {reg.item_tolerancia && (
                              <p className="text-xs text-[var(--warn-text)] m-0 mt-0.5">
                                Tolerância: {reg.item_tolerancia}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', CRIT_CLS[reg.item_criticidade] ?? CRIT_CLS.menor)}>
                              {reg.item_criticidade}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <select
                              value={reg.status}
                              disabled={!podeEditar}
                              onChange={e => handleStatusChange(reg, e.target.value as StatusRegistro)}
                              className={cn(
                                'text-xs px-2 py-1 rounded border border-[var(--border-dim)] bg-[var(--bg-base)] focus:outline-none focus:border-[var(--accent)]',
                                STATUS_CLS[reg.status as StatusRegistro] ?? 'text-[var(--text-mid)]',
                                podeEditar ? 'cursor-pointer' : 'cursor-default opacity-70',
                              )}
                            >
                              {STATUS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 max-w-[180px]">
                            {reg.status === 'nao_conforme' ? (
                              <div className="space-y-1">
                                <span
                                  onClick={() => podeEditar && setNcRegistro(reg)}
                                  className={cn(
                                    'text-xs text-[var(--text-mid)] block truncate',
                                    podeEditar ? 'cursor-pointer border-b border-dashed border-[var(--border-dim)]' : 'cursor-default',
                                  )}
                                >
                                  {reg.observacao ?? <span className="text-[var(--text-faint)]">sem obs.</span>}
                                </span>
                                {/* IA Diagnóstico */}
                                {reg.nc_id && (
                                  <button
                                    onClick={() => {
                                      setDiagnosticoNcId(reg.nc_id!)
                                      if (!diagnosticoResult[reg.nc_id!]) {
                                        diagnosticoNc.mutate({ fichaId, ncId: reg.nc_id! })
                                      }
                                    }}
                                    className="flex items-center gap-1 text-[10px] text-[var(--accent)] hover:opacity-80"
                                  >
                                    <Brain size={10} />
                                    {diagnosticoNc.isPending && diagnosticoNcId === reg.nc_id ? 'Analisando…' : 'Diagnóstico IA'}
                                  </button>
                                )}
                                {/* Resultado do diagnóstico */}
                                {reg.nc_id && diagnosticoResult[reg.nc_id] && (
                                  <div className="text-[10px] text-[var(--text-low)] bg-[var(--off-bg)] rounded p-1.5 space-y-0.5">
                                    <p><strong>Causa:</strong> {diagnosticoResult[reg.nc_id].causa_6m}</p>
                                    <p className="line-clamp-2">{diagnosticoResult[reg.nc_id].descricao_causa}</p>
                                    <p><strong>Ação:</strong> {diagnosticoResult[reg.nc_id].acao_corretiva}</p>
                                    <p><strong>Prazo:</strong> {diagnosticoResult[reg.nc_id].prazo_sugerido_dias}d · {diagnosticoResult[reg.nc_id].responsavel_sugerido}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--text-faint)] text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => setFotosRegistro(reg)}
                              className="relative inline-flex items-center justify-center w-8 h-8 rounded-md border border-[var(--border-dim)] text-[var(--text-faint)] hover:bg-[var(--bg-hover)] transition-colors"
                              title="Ver / adicionar fotos"
                            >
                              <Camera size={13} />
                              {reg.evidencias_count > 0 && !isCriticoNcSemFoto && (
                                <span className="absolute -top-1 -right-1 bg-[var(--accent)] text-white rounded-full w-3.5 h-3.5 text-[9px] font-bold flex items-center justify-center leading-none">
                                  {reg.evidencias_count}
                                </span>
                              )}
                              {isCriticoNcSemFoto && (
                                <span className="absolute -top-1 -right-1 bg-[var(--warn-text)] text-white rounded-full w-3.5 h-3.5 text-[9px] flex items-center justify-center leading-none">
                                  !
                                </span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="px-5 py-3 border-t border-[var(--border-dim)] flex-shrink-0 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-[var(--border-dim)] text-[var(--text-mid)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {fotosRegistro && <FotosModal registro={fotosRegistro} regime={regime} onClose={() => setFotosRegistro(null)} />}
      {ncRegistro && (
        <RegistroNcModal
          registro={ncRegistro}
          regime={regime}
          onSalvar={handleSalvarNc}
          onCancelar={() => setNcRegistro(null)}
          salvando={putRegistro.isPending}
        />
      )}
    </>
  );
}
