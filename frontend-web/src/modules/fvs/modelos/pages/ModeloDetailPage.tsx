// frontend-web/src/modules/fvs/modelos/pages/ModeloDetailPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useModelo, useConcluirModelo, useReabrirModelo, useDuplicarModelo,
  useAddServicoModelo, useDeleteServicoModelo,
} from '../hooks/useModelos';
import { useServicos } from '../../catalogo/hooks/useCatalogo';

export function ModeloDetailPage() {
  const { id } = useParams<{ id: string }>();
  const modeloId = parseInt(id!);
  const navigate = useNavigate();

  const { data: modelo, isLoading } = useModelo(modeloId);
  const { data: catalogo = [] } = useServicos();
  const concluir = useConcluirModelo();
  const reabrir = useReabrirModelo();
  const duplicar = useDuplicarModelo();
  const addServico = useAddServicoModelo(modeloId);
  const deleteServico = useDeleteServicoModelo(modeloId);

  const [novoServico, setNovoServico] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  async function handleAddServico() {
    if (!novoServico) return;
    setErro('');
    try {
      await addServico.mutateAsync({ servicoId: novoServico });
      setNovoServico(null);
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
      if (acao === 'concluir') await concluir.mutateAsync(modeloId);
      else if (acao === 'reabrir') await reabrir.mutateAsync(modeloId);
      else { const n = await duplicar.mutateAsync(modeloId); navigate(`/fvs/modelos/${n.id}`); }
    } catch (e: any) { setErro(e?.response?.data?.message ?? `Erro ao ${acao}`); }
  }

  if (isLoading || !modelo) return <div style={{ padding: 24 }}>Carregando...</div>;

  const editavel = modelo.status === 'rascunho' && !modelo.bloqueado;
  const servicosIds = new Set(modelo.servicos?.map(s => s.servico_id) ?? []);

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>{modelo.nome}</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            v{modelo.versao} · {modelo.regime === 'pbqph' ? 'PBQP-H' : 'Inspeção Interna'} · {modelo.escopo}
            {modelo.bloqueado ? ' · Bloqueado' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editavel && (
            <button onClick={() => navigate(`/fvs/modelos/${modeloId}/editar`)} style={btn('#3b82f6')}>Editar</button>
          )}
          {modelo.status === 'rascunho' && !modelo.bloqueado && (
            <button onClick={() => handleCiclo('concluir')} style={btn('#22c55e')}>Concluir</button>
          )}
          {modelo.status === 'concluido' && !modelo.bloqueado && (
            <button onClick={() => handleCiclo('reabrir')} style={btn('#f59e0b')}>Reabrir</button>
          )}
          <button onClick={() => handleCiclo('duplicar')} style={btn('#6b7280')}>Duplicar</button>
        </div>
      </div>

      {erro && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Exige RO', val: modelo.exige_ro },
          { label: 'Exige Reinspeção', val: modelo.exige_reinspecao },
          { label: 'Exige Parecer', val: modelo.exige_parecer },
        ].map(({ label, val }) => (
          <span key={label} style={{
            background: val ? '#dcfce7' : '#f3f4f6', color: val ? '#15803d' : '#6b7280',
            borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600,
          }}>
            {val ? '✓' : '✗'} {label}
          </span>
        ))}
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Serviços do Template</h2>

      {editavel && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select
            value={novoServico ?? ''}
            onChange={e => setNovoServico(parseInt(e.target.value) || null)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, flex: 1 }}
          >
            <option value="">Selecionar serviço do catálogo...</option>
            {catalogo.filter(s => !servicosIds.has(s.id)).map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <button onClick={handleAddServico} disabled={!novoServico} style={btn('#3b82f6')}>+ Adicionar</button>
        </div>
      )}

      {(modelo.servicos?.length ?? 0) === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 13 }}>Nenhum serviço adicionado ainda.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          {modelo.servicos!.map((svc, i) => (
            <div key={svc.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderBottom: i < modelo.servicos!.length - 1 ? '1px solid #f3f4f6' : undefined,
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{svc.servico_nome}</p>
                {svc.itens_excluidos?.length ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#f59e0b' }}>
                    {svc.itens_excluidos.length} item(s) excluído(s)
                  </p>
                ) : null}
              </div>
              {editavel && (
                <button onClick={() => handleRemoveServico(svc.servico_id)} style={{ ...btn('#dc2626'), fontSize: 12, padding: '3px 10px' }}>
                  Remover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: color, color: '#fff', border: 'none',
    borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: 13,
  };
}
