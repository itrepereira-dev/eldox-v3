// frontend-web/src/modules/fvs/inspecao/components/ParecerModal.tsx
import { useState } from 'react';
import { useSubmitParecer } from '../hooks/useRo';
import type { FvsGrade, DecisaoParecer } from '../../../../services/fvs.service';

interface ParecerModalProps {
  fichaId: number;
  regime: string;
  grade?: FvsGrade;
  onClose: () => void;
  onSuccess: () => void;
}

export function ParecerModal({ fichaId, regime, grade, onClose, onSuccess }: ParecerModalProps) {
  const [decisao, setDecisao] = useState<DecisaoParecer | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);

  const submitParecer = useSubmitParecer(fichaId);

  // Contar NCs da grade para o resumo
  const ncCount = grade
    ? Object.values(grade.celulas).reduce((total, localMap) => {
        return total + Object.values(localMap).filter(s => s === 'nc').length;
      }, 0)
    : null;

  async function handleSubmit() {
    setErroValidacao(null);
    setErroApi(null);

    if (!decisao) {
      setErroValidacao('Selecione uma decisão (Aprovar ou Rejeitar).');
      return;
    }

    // PBQP-H + rejeitado + sem observação → erro
    if (regime === 'pbqph' && decisao === 'rejeitado' && !observacao.trim()) {
      setErroValidacao('Para fichas PBQP-H com rejeição, a observação é obrigatória.');
      return;
    }

    try {
      await submitParecer.mutateAsync({
        decisao,
        observacao: observacao.trim() || undefined,
      });
      onSuccess();
    } catch (e: any) {
      setErroApi(e?.response?.data?.message ?? 'Erro ao emitir parecer. Tente novamente.');
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(2,13,26,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, fontFamily: 'DM Sans, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#071524', border: '1px solid #0e2233', borderRadius: 12,
        padding: 28, maxWidth: 500, width: '92%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#FFFFFF' }}>
            Emitir Parecer
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7A96B2', fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Resumo de NCs */}
        {ncCount !== null && ncCount > 0 && (
          <div style={{
            background: '#0d1e2e', border: '1px solid #1e3a4f', borderRadius: 8,
            padding: '10px 14px', marginBottom: 18,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#7A96B2' }}>
              Resumo da grade:{' '}
              <span style={{ color: '#ef4444', fontWeight: 700 }}>
                {ncCount} célula{ncCount !== 1 ? 's' : ''} não conforme{ncCount !== 1 ? 's' : ''}
              </span>
            </p>
          </div>
        )}

        {/* Decisão */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#7A96B2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Decisão
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setDecisao('aprovado')}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                border: decisao === 'aprovado' ? '2px solid #22c55e' : '2px solid #1e3a4f',
                background: decisao === 'aprovado' ? '#14532d' : '#0d1e2e',
                color: decisao === 'aprovado' ? '#22c55e' : '#7A96B2',
                transition: 'all 0.15s',
              }}
            >
              Aprovar
            </button>
            <button
              onClick={() => setDecisao('rejeitado')}
              style={{
                flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                border: decisao === 'rejeitado' ? '2px solid #ef4444' : '2px solid #1e3a4f',
                background: decisao === 'rejeitado' ? '#450a0a' : '#0d1e2e',
                color: decisao === 'rejeitado' ? '#ef4444' : '#7A96B2',
                transition: 'all 0.15s',
              }}
            >
              Rejeitar
            </button>
          </div>
        </div>

        {/* Observação */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#7A96B2', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Observação{regime === 'pbqph' && decisao === 'rejeitado' ? ' *' : ''}
          </label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={4}
            placeholder={
              regime === 'pbqph' && decisao === 'rejeitado'
                ? 'Obrigatório para rejeição PBQP-H — descreva o motivo da rejeição...'
                : 'Observação opcional...'
            }
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #1e3a4f', borderRadius: 8,
              padding: '10px 12px', fontSize: 13, resize: 'vertical',
              fontFamily: 'DM Sans, sans-serif',
              color: '#FFFFFF', background: '#040F1E',
            }}
          />
        </div>

        {/* Erros */}
        {erroValidacao && (
          <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#fca5a5' }}>
            {erroValidacao}
          </div>
        )}
        {erroApi && (
          <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#fca5a5' }}>
            {erroApi}
          </div>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', border: '1px solid #1e3a4f', borderRadius: 8,
              cursor: 'pointer', fontSize: 14, background: 'transparent', color: '#7A96B2',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitParecer.isPending || !decisao}
            style={{
              padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
              background: !decisao ? '#1e3a4f' : decisao === 'aprovado' ? '#15803d' : '#7f1d1d',
              color: '#FFFFFF', opacity: submitParecer.isPending ? 0.7 : 1,
              transition: 'background 0.15s',
            }}
          >
            {submitParecer.isPending ? 'Processando...' : 'Confirmar Parecer'}
          </button>
        </div>
      </div>
    </div>
  );
}
