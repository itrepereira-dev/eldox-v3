// frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateFicha } from '../hooks/useFichas';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
import { useModelosByObra } from '../../modelos/hooks/useModelos';
import type { RegimeFicha } from '../../../../services/fvs.service';

interface StepOneData {
  nome: string;
  obraId: number | null;
  regime: RegimeFicha;
}

interface ServicoComLocais {
  servicoId: number;
  localIds: number[];
}

interface Props {
  obras?: { id: number; nome: string }[];
  locaisPorObra?: Record<number, { id: number; nome: string; pavimento_nome?: string }[]>;
}

export function AbrirFichaWizard({ obras = [], locaisPorObra = {} }: Props) {
  const navigate = useNavigate();
  const createFicha = useCreateFicha();
  const { data: servicos = [] } = useServicos();

  const [step, setStep] = useState(1);
  const [stepOne, setStepOne] = useState<StepOneData>({ nome: '', obraId: null, regime: 'livre' });
  const [modeloId, setModeloId] = useState<number | null>(null);
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoComLocais[]>([]);
  const [error, setError] = useState('');

  const { data: modelosDisponiveis = [] } = useModelosByObra(stepOne.obraId ?? 0);
  const locais = stepOne.obraId ? (locaisPorObra[stepOne.obraId] ?? []) : [];

  function toggleServico(servicoId: number) {
    setServicosSelecionados(prev => {
      const exists = prev.find(s => s.servicoId === servicoId);
      return exists ? prev.filter(s => s.servicoId !== servicoId) : [...prev, { servicoId, localIds: [] }];
    });
  }

  function toggleLocal(servicoId: number, localId: number) {
    setServicosSelecionados(prev =>
      prev.map(s => {
        if (s.servicoId !== servicoId) return s;
        const ids = s.localIds.includes(localId)
          ? s.localIds.filter(id => id !== localId)
          : [...s.localIds, localId];
        return { ...s, localIds: ids };
      }),
    );
  }

  function handleSelecionarModelo(mId: number | null) {
    setModeloId(mId);
    if (!mId) setServicosSelecionados([]);
  }

  async function handleConfirmar() {
    setError('');
    if (!stepOne.obraId) { setError('Obra é obrigatória.'); return; }

    if (modeloId) {
      try {
        const ficha = await createFicha.mutateAsync({
          obraId: stepOne.obraId,
          nome: stepOne.nome,
          modeloId,
        });
        navigate(`/fvs/fichas/${ficha.id}`);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
      }
      return;
    }

    const servicosComLocais = servicosSelecionados.filter(s => s.localIds.length > 0);
    if (!servicosComLocais.length) {
      setError('Selecione ao menos um serviço com um local para inspecionar.');
      return;
    }
    try {
      const ficha = await createFicha.mutateAsync({
        obraId: stepOne.obraId,
        nome: stepOne.nome,
        regime: stepOne.regime,
        servicos: servicosComLocais,
      });
      navigate(`/fvs/fichas/${ficha.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6,
    border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box',
  };

  if (step === 1) {
    return (
      <div style={{ maxWidth: 500, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Nova Ficha FVS — Dados Básicos</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Nome da Ficha *</label>
          <input style={inputStyle} value={stepOne.nome} onChange={e => setStepOne(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: FVS Bloco A - Alvenaria" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Obra *</label>
          <select style={inputStyle} value={stepOne.obraId ?? ''} onChange={e => setStepOne(p => ({ ...p, obraId: parseInt(e.target.value) || null }))}>
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <button
          onClick={() => { if (!stepOne.nome || !stepOne.obraId) { setError('Nome e Obra são obrigatórios.'); return; } setError(''); setStep(2); }}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}
        >
          Próximo →
        </button>
      </div>
    );
  }

  if (step === 2) {
    const temModelos = modelosDisponiveis.length > 0;
    return (
      <div style={{ maxWidth: 500, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Usar Template?</h2>
        {temModelos ? (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Há {modelosDisponiveis.length} template(s) vinculado(s) a esta obra. Selecione um ou prossiga sem template.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '2px solid ' + (modeloId === null ? '#3b82f6' : '#e5e7eb'), borderRadius: 8, cursor: 'pointer' }}>
                <input type="radio" checked={modeloId === null} onChange={() => handleSelecionarModelo(null)} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Criar manualmente</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Selecionar serviços e locais individualmente</p>
                </div>
              </label>
              {modelosDisponiveis.map(m => (
                <label key={m.modelo_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '2px solid ' + (modeloId === m.modelo_id ? '#3b82f6' : '#e5e7eb'), borderRadius: 8, cursor: 'pointer' }}>
                  <input type="radio" checked={modeloId === m.modelo_id} onChange={() => handleSelecionarModelo(m.modelo_id)} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{m.modelo_nome}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Criadas nesta obra: {m.fichas_count} fichas</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Nenhum template vinculado a esta obra. A ficha será criada manualmente.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
          <button
            onClick={() => { if (modeloId) { handleConfirmar(); } else setStep(3); }}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}
          >
            {modeloId ? 'Criar Ficha com Template' : 'Próximo →'}
          </button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>
    );
  }

  if (step === 3) {
    return (
      <div style={{ maxWidth: 600, padding: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: 18, fontWeight: 600 }}>Selecionar Serviços e Locais</h2>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Regime</label>
          <select style={inputStyle} value={stepOne.regime} onChange={e => setStepOne(p => ({ ...p, regime: e.target.value as RegimeFicha }))}>
            <option value="livre">Livre</option>
            <option value="pbqph">PBQP-H</option>
            <option value="norma_tecnica">Norma Técnica</option>
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          {servicos.map(svc => {
            const sel = servicosSelecionados.find(s => s.servicoId === svc.id);
            return (
              <div key={svc.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: sel ? '#eff6ff' : '#fff' }}>
                  <input type="checkbox" checked={!!sel} onChange={() => toggleServico(svc.id)} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{svc.nome}</span>
                </label>
                {sel && locais.length > 0 && (
                  <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#6b7280' }}>Locais para este serviço:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {locais.map(local => (
                        <label key={local.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={sel.localIds.includes(local.id)} onChange={() => toggleLocal(svc.id, local.id)} />
                          {local.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>← Voltar</button>
          <button onClick={handleConfirmar} disabled={createFicha.isPending} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}>
            {createFicha.isPending ? 'Criando...' : 'Criar Ficha'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
