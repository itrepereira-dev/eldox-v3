// frontend-web/src/modules/fvs/inspecao/pages/FichaLocalPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useFicha } from '../hooks/useFichas';
import { useRegistros, usePutRegistro, usePatchLocal } from '../hooks/useRegistros';
import { FotosModal } from '../components/FotosModal';
import { RegistroNcModal } from '../components/RegistroNcModal';
import type { FvsRegistro, StatusRegistro } from '../../../../services/fvs.service';

const STATUS_OPTIONS: { value: StatusRegistro; label: string; color: string }[] = [
  { value: 'conforme',     label: 'Conforme',     color: '#22c55e' },
  { value: 'nao_conforme', label: 'Não Conforme', color: '#ef4444' },
  { value: 'excecao',      label: 'Exceção',       color: '#f59e0b' },
  { value: 'nao_avaliado', label: 'Não Avaliado', color: '#d1d5db' },
];

const CRIT_COLOR: Record<string, string> = {
  critico: '#ef4444',
  maior: '#f59e0b',
  menor: '#6b7280',
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
    // Em reinspeção, itens bloqueados não podem ser alterados
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

  if (isLoading || !ficha) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(`/fvs/fichas/${id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, marginBottom: 8 }}>
          ← Voltar à Grade
        </button>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Serviço {servicoId} — Local {localId}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Progresso: {progresso}% ({avaliados}/{totalItens} itens)</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Equipe:</span>
            {editandoEquipe ? (
              <input
                value={equipe}
                onChange={e => setEquipe(e.target.value)}
                onBlur={async () => { setEditandoEquipe(false); await patchLocal.mutateAsync({ localId, equipeResponsavel: equipe || null }); }}
                autoFocus
                style={{ fontSize: 12, border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 6px' }}
              />
            ) : (
              <span
                onClick={() => podeEditar && setEditandoEquipe(true)}
                style={{ fontSize: 12, cursor: podeEditar ? 'pointer' : 'default', color: equipe ? '#111827' : '#9ca3af', borderBottom: podeEditar ? '1px dashed #d1d5db' : 'none' }}
              >
                {equipe || (podeEditar ? 'Clique para adicionar equipe...' : '—')}
              </span>
            )}
          </div>
        </div>
        <div style={{ background: '#e5e7eb', borderRadius: 99, height: 4, marginTop: 10, width: '100%', maxWidth: 400 }}>
          <div style={{ background: '#22c55e', height: '100%', borderRadius: 99, width: `${progresso}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {eReinsspecao && (
        <div style={{
          background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, color: '#1d4ed8', fontWeight: 500,
        }}>
          🔄 Reinspeção — Ciclo {maxCiclo} — Apenas itens desbloqueados
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', width: 32, color: '#6b7280' }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280' }}>Item de Verificação</th>
              <th style={{ padding: '8px 8px', color: '#6b7280', whiteSpace: 'nowrap' }}>Criticidade</th>
              <th style={{ padding: '8px 8px', color: '#6b7280' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280' }}>Observação</th>
              <th style={{ padding: '8px 8px', color: '#6b7280' }}>Fotos</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((reg, i) => {
              const isCriticoNcSemFoto = regime === 'pbqph' && reg.item_criticidade === 'critico' && reg.status === 'nao_conforme' && reg.evidencias_count === 0;
              const bloqueadoReinsspecao = eReinsspecao && !reg.desbloqueado;
              return (
                <tr
                  key={reg.item_id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    background: i % 2 === 0 ? '#f9fafb' : '#fff',
                    opacity: bloqueadoReinsspecao ? 0.4 : 1,
                    pointerEvents: bloqueadoReinsspecao ? 'none' : undefined,
                  }}
                >
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', color: '#111827' }}>
                    {reg.item_descricao}
                    {reg.item_criterio_aceite && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{reg.item_criterio_aceite}</div>}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: CRIT_COLOR[reg.item_criticidade] ?? '#6b7280', textTransform: 'uppercase' }}>{reg.item_criticidade}</span>
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <select
                      value={reg.status}
                      disabled={!podeEditar}
                      onChange={e => handleStatusChange(reg, e.target.value as StatusRegistro)}
                      style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 6px', fontSize: 12, cursor: podeEditar ? 'pointer' : 'default', color: STATUS_OPTIONS.find(o => o.value === reg.status)?.color ?? '#111' }}
                    >
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reg.status === 'nao_conforme' ? (
                      <span onClick={() => podeEditar && setNcRegistro(reg)} style={{ cursor: podeEditar ? 'pointer' : 'default', borderBottom: podeEditar ? '1px dashed #d1d5db' : 'none' }}>
                        {reg.observacao ?? <span style={{ color: '#d1d5db' }}>sem observação</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                    <button onClick={() => setFotosRegistro(reg)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', fontSize: 18 }} title="Ver / adicionar fotos">
                      📷
                      {reg.evidencias_count > 0 && !isCriticoNcSemFoto && (
                        <span style={{ position: 'absolute', top: -4, right: -6, background: '#3b82f6', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>{reg.evidencias_count}</span>
                      )}
                      {isCriticoNcSemFoto && (
                        <span style={{ position: 'absolute', top: -4, right: -6, background: '#f59e0b', color: '#fff', borderRadius: '50%', width: 16, height: 16, fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>⚠</span>
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
      {ncRegistro && <RegistroNcModal registro={ncRegistro} regime={regime} onSalvar={handleSalvarNc} onCancelar={() => setNcRegistro(null)} salvando={putRegistro.isPending} />}
    </div>
  );
}
