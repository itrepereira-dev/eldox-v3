// frontend-web/src/modules/fvs/inspecao/components/RegistroNcModal.tsx
import { useState, useRef } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro } from '../../../../services/fvs.service';

interface Props {
  registro: FvsRegistro;
  regime: string;
  onSalvar: (observacao: string) => void;
  onCancelar: () => void;
  salvando?: boolean;
}

export function RegistroNcModal({ registro, regime, onSalvar, onCancelar, salvando }: Props) {
  const [obs, setObs] = useState(registro.observacao ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: evidencias = [] } = useEvidencias(registro.id ?? null);
  const createEv = useCreateEvidencia();
  const deleteEv = useDeleteEvidencia();

  const isPbqph = regime === 'pbqph';
  const isCritico = registro.item_criticidade === 'critico';
  const semFoto = evidencias.length === 0;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registro.id) return;
    createEv.mutate({ registroId: registro.id, file });
    e.target.value = '';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 540, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#ef4444' }}>Não Conforme — {registro.item_descricao}</h3>
          <button onClick={onCancelar} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {isCritico && (
          <span style={{ display: 'inline-block', background: '#fef2f2', color: '#ef4444', fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '2px 8px', marginBottom: 12 }}>CRÍTICO</span>
        )}
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Observação {isPbqph ? '(obrigatória)' : '(opcional)'}</span>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={4}
            style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px', border: `1px solid ${isPbqph && !obs.trim() ? '#ef4444' : '#d1d5db'}`, borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            placeholder="Descreva a não conformidade observada..."
          />
          {isPbqph && !obs.trim() && <span style={{ fontSize: 12, color: '#ef4444' }}>Obrigatório em PBQP-H</span>}
        </label>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Fotos {isPbqph && isCritico ? '(obrigatória na conclusão)' : '(opcional)'}</span>
            <button onClick={() => fileRef.current?.click()} disabled={createEv.isPending} style={{ fontSize: 12, background: 'transparent', border: '1px solid #d1d5db', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}>+ Foto</button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          </div>
          {isPbqph && isCritico && semFoto && <p style={{ color: '#f59e0b', fontSize: 12, margin: '0 0 8px' }}>⚠ Foto obrigatória — será validada ao concluir a ficha.</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {evidencias.map(ev => (
              <div key={ev.id} style={{ position: 'relative' }}>
                <div style={{ width: 64, height: 64, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#6b7280', textAlign: 'center', padding: 2 }}>
                  {ev.nome_original ?? 'foto'}
                </div>
                <button onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })} style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>×</button>
              </div>
            ))}
            {evidencias.length === 0 && <span style={{ fontSize: 12, color: '#9ca3af' }}>Nenhuma foto</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancelar} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSalvar(obs)} disabled={salvando || (isPbqph && !obs.trim())} style={{ padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            {salvando ? 'Salvando...' : 'Salvar NC'}
          </button>
        </div>
      </div>
    </div>
  );
}
