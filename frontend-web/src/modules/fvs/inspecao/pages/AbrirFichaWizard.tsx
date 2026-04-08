// frontend-web/src/modules/fvs/inspecao/pages/AbrirFichaWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateFicha } from '../hooks/useFichas';
import { useServicos } from '../../catalogo/hooks/useCatalogo';
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
  const [servicosSelecionados, setServicosSelecionados] = useState<ServicoComLocais[]>([]);
  const [error, setError] = useState('');

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

  async function handleConfirmar() {
    setError('');
    const servicosComLocais = servicosSelecionados.filter(s => s.localIds.length > 0);
    if (!servicosComLocais.length) {
      setError('Selecione ao menos um serviço com um local para inspecionar.');
      return;
    }
    try {
      const ficha = await createFicha.mutateAsync({
        obraId: stepOne.obraId!,
        nome: stepOne.nome,
        regime: stepOne.regime,
        servicos: servicosComLocais,
      });
      navigate(`/fvs/fichas/${ficha.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao criar ficha');
    }
  }

  if (step === 1) {
    return (
      <div style={{ padding: 24, maxWidth: 560 }}>
        <h2 style={{ marginBottom: 20 }}>Nova Ficha FVS — Passo 1 de 2</h2>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Nome da Ficha *</span>
          <input
            type="text"
            value={stepOne.nome}
            onChange={e => setStepOne(p => ({ ...p, nome: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
            placeholder="Ex: FVS Alvenaria Torre 1"
          />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Obra *</span>
          <select
            value={stepOne.obraId ?? ''}
            onChange={e => setStepOne(p => ({ ...p, obraId: Number(e.target.value) || null }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            <option value="">Selecionar obra...</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Regime</span>
          <select
            value={stepOne.regime}
            onChange={e => setStepOne(p => ({ ...p, regime: e.target.value as RegimeFicha }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6 }}
          >
            <option value="livre">Livre (procedimento interno)</option>
            <option value="norma_tecnica">Norma Técnica (NBR)</option>
            <option value="pbqph">PBQP-H (SiAC / ISO 9001)</option>
          </select>
        </label>

        <button
          onClick={() => {
            if (!stepOne.nome.trim() || !stepOne.obraId) {
              setError('Nome e obra são obrigatórios.');
              return;
            }
            setError('');
            setStep(2);
          }}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}
        >
          Próximo →
        </button>
        {error && <p style={{ color: '#ef4444', marginTop: 8, fontSize: 13 }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h2 style={{ marginBottom: 8 }}>Nova Ficha FVS — Passo 2 de 2</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Selecione os serviços e os locais a inspecionar por serviço.
        {stepOne.regime === 'pbqph' && (
          <strong style={{ color: '#f59e0b' }}> Modo PBQP-H: use serviços do catálogo do sistema.</strong>
        )}
      </p>

      {servicos.map(srv => {
        const sel = servicosSelecionados.find(s => s.servicoId === srv.id);
        return (
          <div key={srv.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12, background: sel ? '#f0f9ff' : '#fff' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: sel ? 600 : 400 }}>
              <input type="checkbox" checked={!!sel} onChange={() => toggleServico(srv.id)} />
              {srv.nome}
              {srv.is_sistema && (
                <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>PBQP-H</span>
              )}
            </label>
            {sel && locais.length > 0 && (
              <div style={{ padding: '0 16px 12px 40px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {locais.map(loc => (
                  <label key={loc.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                    background: sel.localIds.includes(loc.id) ? '#dbeafe' : '#f9fafb',
                    border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                  }}>
                    <input type="checkbox" checked={sel.localIds.includes(loc.id)} onChange={() => toggleLocal(srv.id, loc.id)} />
                    {loc.nome}
                  </label>
                ))}
              </div>
            )}
            {sel && locais.length === 0 && (
              <p style={{ padding: '0 16px 12px 40px', color: '#f59e0b', fontSize: 13 }}>Nenhum local cadastrado para esta obra.</p>
            )}
          </div>
        );
      })}

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button onClick={() => setStep(1)} style={{ padding: '10px 20px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: 6 }}>
          ← Voltar
        </button>
        <button
          onClick={handleConfirmar}
          disabled={createFicha.isPending}
          style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 24px', cursor: 'pointer', fontSize: 14 }}
        >
          {createFicha.isPending ? 'Criando...' : 'Confirmar e Criar Ficha'}
        </button>
      </div>
    </div>
  );
}
