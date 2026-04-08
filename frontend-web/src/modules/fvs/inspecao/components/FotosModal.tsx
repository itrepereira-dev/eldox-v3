// frontend-web/src/modules/fvs/inspecao/components/FotosModal.tsx
import { useRef } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro } from '../../../../services/fvs.service';

interface Props {
  registro: FvsRegistro;
  regime: string;
  onClose: () => void;
}

export function FotosModal({ registro, regime, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: evidencias = [] } = useEvidencias(registro.id ?? null);
  const createEv = useCreateEvidencia();
  const deleteEv = useDeleteEvidencia();

  const isCriticoNcSemFoto =
    regime === 'pbqph' &&
    registro.item_criticidade === 'critico' &&
    registro.status === 'nao_conforme' &&
    evidencias.length === 0;

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !registro.id) return;
    createEv.mutate({ registroId: registro.id, file });
    e.target.value = '';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, maxWidth: 520, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Fotos — {registro.item_descricao}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        {isCriticoNcSemFoto && (
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#92400e' }}>
            ⚠ Foto obrigatória para item crítico NC em PBQP-H — será validada na conclusão da ficha.
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, minHeight: 80, marginBottom: 16 }}>
          {evidencias.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>Nenhuma foto adicionada.</p>
          ) : (
            evidencias.map(ev => (
              <div key={ev.id} style={{ position: 'relative' }}>
                <div style={{ width: 80, height: 80, background: '#f3f4f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#6b7280', textAlign: 'center', padding: 4 }}>
                  {ev.nome_original ?? 'foto'}
                </div>
                <button
                  onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })}
                  style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 11, cursor: 'pointer', lineHeight: '18px', padding: 0 }}
                >×</button>
              </div>
            ))
          )}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={createEv.isPending} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}>
          {createEv.isPending ? 'Enviando...' : '+ Adicionar Foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
