// frontend-web/src/modules/fvs/modelos/pages/ModeloFormPage.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateModelo, useUpdateModelo, useModelo } from '../hooks/useModelos';
import type { EscopoModelo, RegimeModelo } from '../../../../services/fvs.service';

export function ModeloFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const modeloId = id ? parseInt(id) : undefined;
  const isEdit = !!modeloId;

  const { data: modeloExistente } = useModelo(modeloId ?? 0);
  const createModelo = useCreateModelo();
  const updateModelo = useUpdateModelo();

  const [nome, setNome] = useState(modeloExistente?.nome ?? '');
  const [descricao, setDescricao] = useState(modeloExistente?.descricao ?? '');
  const [escopo, setEscopo] = useState<EscopoModelo>(modeloExistente?.escopo ?? 'empresa');
  const [regime, setRegime] = useState<RegimeModelo>(modeloExistente?.regime ?? 'livre');
  const [exigeRo, setExigeRo] = useState(modeloExistente?.exige_ro ?? true);
  const [exigeReinspecao, setExigeReinspecao] = useState(modeloExistente?.exige_reinspecao ?? true);
  const [exigeParecer, setExigeParecer] = useState(modeloExistente?.exige_parecer ?? true);
  const [erro, setErro] = useState('');

  const isPbqph = regime === 'pbqph';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const payload = {
      nome, descricao: descricao || undefined, escopo, regime,
      exigeRo: isPbqph ? true : exigeRo,
      exigeReinspecao: isPbqph ? true : exigeReinspecao,
      exigeParecer: isPbqph ? true : exigeParecer,
    };
    try {
      if (isEdit) {
        await updateModelo.mutateAsync({ id: modeloId!, ...payload });
        navigate(`/fvs/modelos/${modeloId}`);
      } else {
        const novo = await createModelo.mutateAsync(payload);
        navigate(`/fvs/modelos/${novo.id}`);
      }
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao salvar template');
    }
  }

  const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 };
  const inputStyle: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14 };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: '#374151' };

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h1 style={{ marginTop: 0, fontSize: 20, fontWeight: 600 }}>
        {isEdit ? 'Editar Template' : 'Novo Template de Inspeção'}
      </h1>
      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Nome *</label>
          <input style={inputStyle} value={nome} onChange={e => setNome(e.target.value)} required maxLength={200} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Descrição</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 60 }} value={descricao} onChange={e => setDescricao(e.target.value)} />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Processo / Regime *</label>
          <select style={inputStyle} value={regime} onChange={e => setRegime(e.target.value as RegimeModelo)}>
            <option value="livre">Inspeção Interna (Livre)</option>
            <option value="pbqph">PBQP-H (todas etapas obrigatórias)</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Escopo *</label>
          <select style={inputStyle} value={escopo} onChange={e => setEscopo(e.target.value as EscopoModelo)}>
            <option value="empresa">Empresa (disponível para qualquer obra)</option>
            <option value="obra">Obra específica</option>
          </select>
        </div>

        {!isPbqph && (
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Etapas do workflow</p>
            {[
              { label: 'Exige Relatório de Ocorrências (RO)', value: exigeRo, set: setExigeRo },
              { label: 'Exige Reinspeção', value: exigeReinspecao, set: setExigeReinspecao },
              { label: 'Exige Parecer de Qualidade', value: exigeParecer, set: setExigeParecer },
            ].map(({ label, value, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        )}

        {isPbqph && (
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            Processo PBQP-H: RO, Reinspeção e Parecer são obrigatórios e não podem ser desativados.
          </p>
        )}

        {erro && <p style={{ color: '#dc2626', fontSize: 13 }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontSize: 14 }}>
            {isEdit ? 'Salvar' : 'Criar Template'}
          </button>
          <button type="button" onClick={() => navigate(-1)} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
