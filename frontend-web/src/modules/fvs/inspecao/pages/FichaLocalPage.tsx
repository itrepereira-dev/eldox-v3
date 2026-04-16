// frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFicha } from '../hooks/useFichas';
import { useRegistros, usePutRegistro, usePatchLocal } from '../hooks/useRegistros';
import { FotosModal } from '../components/FotosModal';
import { RegistroNcModal } from '../components/RegistroNcModal';
import type { FvsRegistro, StatusRegistro } from '../../../../services/fvs.service';
import { cn } from '@/lib/cn';
import { ArrowLeft, Camera } from 'lucide-react';

const STATUS_OPTIONS: { value: StatusRegistro; label: string }[] = [
  { value: 'conforme',     label: 'Conforme' },
  { value: 'nao_conforme', label: 'Não Conforme' },
  { value: 'excecao',      label: 'Exceção' },
  { value: 'nao_avaliado', label: 'Não Avaliado' },
];

const STATUS_CLS: Record<StatusRegistro, string> = {
  conforme:                 'text-[var(--ok-text)]',
  nao_conforme:             'text-[var(--nc-text)]',
  excecao:                  'text-[var(--warn-text)]',
  nao_avaliado:             'text-[var(--text-faint)]',
  nao_aplicavel:            'text-[var(--text-faint)]',
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

export function FichaLocalPage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const [searchParams] = useSearchParams();
  const servicoId = Number(searchParams.get('servicoId'));
  const localId = Number(searchParams.get('localId'));
  const navigate = useNavigate();

  const { data: ficha } = useFicha(id);
  const { data: registros = [], isLoading } = useRegistros(id, servicoId, localId);
  const putRegistro = usePutRegistro(id);
  const patchLocal = usePatchLocal(id);

  const [fotosRegistro, setFotosRegistro] = useState<FvsRegistro | null>(null);
  const [ncRegistro, setNcRegistro] = useState<FvsRegistro | null>(null);
  const [equipe, setEquipe] = useState('');
  const [editandoEquipe, setEditandoEquipe] = useState(false);

  useEffect(() => {
    setEquipe(registros[0]?.equipe_responsavel ?? '');
  }, [registros[0]?.equipe_responsavel]);

  const regime = ficha?.regime ?? 'livre';
  const podeEditar = ficha?.status === 'em_inspecao';

  const maxCiclo = registros.length > 0
    ? Math.max(...registros.map(r => r.ciclo ?? 1), 1)
    : 1;
  const eReinsspecao = maxCiclo > 1;

  const totalItens = registros.length;
  const avaliados = registros.filter(r => r.status !== 'nao_avaliado').length;
  const progresso = totalItens > 0 ? Math.round((avaliados / totalItens) * 100) : 0;

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

  if (isLoading || !ficha) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="mb-5">
        <button
          onClick={() => navigate(`/fvs/fichas/${id}`)}
          className="flex items-center gap-1.5 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] mb-3 transition-colors"
        >
          <ArrowLeft size={14} /> Voltar à Grade
        </button>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-high)] m-0 mb-0.5">
              Serviço {servicoId} — Local {localId}
            </h2>
            <p className="text-xs text-[var(--text-faint)] m-0">
              {avaliados}/{totalItens} itens avaliados · {progresso}% concluído
            </p>
          </div>
          {/* Equipe */}
          <div className="flex items-center gap-2">
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
                className="text-xs px-2 py-0.5 border border-[var(--accent)] rounded focus:outline-none bg-[var(--bg-base)] text-[var(--text-high)]"
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
                {equipe || (podeEditar ? 'Clique para adicionar...' : '—')}
              </span>
            )}
          </div>
        </div>
        {/* Barra de progresso */}
        <div className="mt-3 max-w-sm bg-[var(--border-dim)] rounded-full h-1.5">
          <div className="bg-[var(--ok-text)] h-full rounded-full transition-all" style={{ width: `${progresso}%` }} />
        </div>
      </div>

      {/* Banner reinspeção */}
      {eReinsspecao && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium mb-4">
          🔄 Reinspeção — Ciclo {maxCiclo} — Apenas itens desbloqueados
        </div>
      )}

      {/* Tabela de registros */}
      <div className="border border-[var(--border-dim)] rounded-lg overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[var(--bg-raised)] border-b border-[var(--border-dim)]">
              <th className="text-left px-3 py-2.5 w-8 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">#</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide">Item de Verificação</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wide whitespace-nowrap">Criticidade</th>
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
                  <td className="px-3 py-3 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                    {reg.status === 'nao_conforme' ? (
                      <span
                        onClick={() => podeEditar && setNcRegistro(reg)}
                        className={cn(
                          'text-xs text-[var(--text-mid)]',
                          podeEditar ? 'cursor-pointer border-b border-dashed border-[var(--border-dim)]' : 'cursor-default',
                        )}
                      >
                        {reg.observacao ?? <span className="text-[var(--text-faint)]">sem observação</span>}
                      </span>
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
    </div>
  );
}
