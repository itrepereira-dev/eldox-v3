// frontend-web/src/modules/fvs/inspecao/pages/FichaGradePage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFicha, usePatchFicha } from '../hooks/useFichas';
import { useGrade } from '../hooks/useGrade';
import { useSolicitarParecer } from '../hooks/useRo';
import { RoPanel } from '../components/RoPanel';
import { ParecerModal } from '../components/ParecerModal';
import type { StatusGrade } from '../../../../services/fvs.service';

const CELL_COLOR: Record<StatusGrade, string> = {
  nc: '#ef4444',
  aprovado: '#22c55e',
  pendente: '#f59e0b',
  nao_avaliado: '#d1d5db',
};

const CELL_ICON: Record<StatusGrade, string> = {
  nc: '✗',
  aprovado: '✓',
  pendente: '!',
  nao_avaliado: '—',
};

export function FichaGradePage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const id = Number(fichaId);
  const navigate = useNavigate();

  const { data: ficha } = useFicha(id);
  const { data: grade, isLoading } = useGrade(id);
  const patchFicha = usePatchFicha(id);

  const [confirmando, setConfirmando] = useState<'iniciar' | 'concluir' | null>(null);
  const [erroConcluso, setErroConcluso] = useState<{ message: string; itensPendentes?: any[] } | null>(null);
  const [showParecer, setShowParecer] = useState(false);
  const [erroSolicitacao, setErroSolicitacao] = useState<string | null>(null);

  const solicitarParecer = useSolicitarParecer(id);

  async function handleStatusChange(novoStatus: 'em_inspecao' | 'concluida') {
    setErroConcluso(null);
    try {
      await patchFicha.mutateAsync({ status: novoStatus });
      setConfirmando(null);
    } catch (e: any) {
      const data = e?.response?.data;
      setErroConcluso({ message: data?.message ?? 'Erro ao alterar status', itensPendentes: data?.itensPendentes });
    }
  }

  async function handleSolicitarParecer() {
    setErroSolicitacao(null);
    try {
      await solicitarParecer.mutateAsync();
    } catch (e: any) {
      setErroSolicitacao(e?.response?.data?.message ?? 'Erro ao solicitar parecer.');
    }
  }

  if (isLoading || !grade || !ficha) return <div style={{ padding: 24 }}>Carregando...</div>;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/fvs/fichas')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{ficha.nome}</h2>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {ficha.regime.toUpperCase()} · {ficha.status.replace('_', ' ')} · {ficha.progresso ?? 0}% concluído
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {ficha.status === 'rascunho' && (
          <button onClick={() => setConfirmando('iniciar')} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
            Iniciar Inspeção
          </button>
        )}
        {ficha.status === 'em_inspecao' && (
          <button onClick={() => setConfirmando('concluir')} style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>
            Concluir Ficha
          </button>
        )}
        {ficha.status === 'concluida' && (
          <button
            onClick={handleSolicitarParecer}
            disabled={solicitarParecer.isPending}
            style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', opacity: solicitarParecer.isPending ? 0.7 : 1 }}
          >
            {solicitarParecer.isPending ? 'Solicitando...' : 'Solicitar Parecer'}
          </button>
        )}
        {ficha.status === 'aguardando_parecer' && (
          <button
            onClick={() => setShowParecer(true)}
            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}
          >
            Emitir Parecer
          </button>
        )}
        {ficha.status === 'aprovada' && (
          <span style={{
            background: '#14532d', color: '#22c55e', border: '1px solid #15803d',
            borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600,
          }}>
            ✓ Ficha Aprovada
          </span>
        )}
      </div>

      {erroSolicitacao && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444' }}>
          {erroSolicitacao}
        </div>
      )}

      {confirmando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px' }}>{confirmando === 'iniciar' ? 'Iniciar Inspeção?' : 'Concluir Ficha?'}</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              {confirmando === 'iniciar'
                ? 'A ficha passará para o status "Em Inspeção" e os registros poderão ser gravados.'
                : ficha.regime === 'pbqph'
                  ? 'Itens críticos NC sem evidência fotográfica serão verificados antes de concluir.'
                  : 'A ficha será marcada como concluída.'}
            </p>
            {erroConcluso && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <p style={{ color: '#ef4444', margin: 0, fontSize: 13, fontWeight: 600 }}>{erroConcluso.message}</p>
                {erroConcluso.itensPendentes?.map((ip: any) => (
                  <p key={ip.item_id} style={{ color: '#7f1d1d', fontSize: 12, margin: '4px 0 0' }}>• {ip.descricao}</p>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setConfirmando(null); setErroConcluso(null); }} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={() => handleStatusChange(confirmando === 'iniciar' ? 'em_inspecao' : 'concluida')}
                disabled={patchFicha.isPending}
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                {patchFicha.isPending ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 16px', minWidth: 220, borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>Serviço</th>
              {grade.locais.map(loc => (
                <th key={loc.id} style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', color: '#6b7280', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
                  {loc.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.servicos.map((srv, i) => (
              <tr key={srv.id} style={{ background: i % 2 === 0 ? '#f9fafb' : '#fff' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500, color: '#111827' }}>{srv.nome}</td>
                {grade.locais.map(loc => {
                  const status: StatusGrade = grade.celulas[srv.id]?.[loc.id] ?? 'nao_avaliado';
                  const canClick = ficha.status === 'em_inspecao';
                  return (
                    <td key={loc.id} style={{ textAlign: 'center', padding: '6px' }}>
                      <span
                        onClick={() => { if (canClick) navigate(`/fvs/fichas/${id}/inspecao?servicoId=${srv.id}&localId=${loc.id}`); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 32, height: 32, borderRadius: 6,
                          background: CELL_COLOR[status], color: '#fff', fontSize: 14, fontWeight: 700,
                          cursor: canClick ? 'pointer' : 'default',
                          opacity: ficha.status === 'rascunho' ? 0.5 : 1,
                        }}
                        title={`${srv.nome} — ${loc.nome}: ${status}`}
                      >
                        {CELL_ICON[status]}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12, color: '#6b7280' }}>
        {(Object.entries(CELL_COLOR) as [StatusGrade, string][]).map(([status, color]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            {status === 'nc' ? 'Não Conforme' : status === 'aprovado' ? 'Aprovado' : status === 'pendente' ? 'Pendente' : 'Não Avaliado'}
          </span>
        ))}
      </div>

      {(ficha.status === 'concluida' || ficha.status === 'aguardando_parecer') && (
        <RoPanel fichaId={id} regime={ficha.regime} />
      )}

      {showParecer && (
        <ParecerModal
          fichaId={id}
          regime={ficha.regime}
          grade={grade}
          onClose={() => setShowParecer(false)}
          onSuccess={() => setShowParecer(false)}
        />
      )}
    </div>
  );
}
