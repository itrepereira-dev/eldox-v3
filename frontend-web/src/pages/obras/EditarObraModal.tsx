import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { obrasService, type ObraDetalhe } from '../../services/obras.service';

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC',
  'SP','SE','TO',
];

const STATUS_OPTIONS = [
  { value: 'PLANEJAMENTO', label: 'Planejamento' },
  { value: 'EM_EXECUCAO', label: 'Em Execução' },
  { value: 'PARALISADA', label: 'Paralisada' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'ENTREGUE', label: 'Entregue' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-surface)',
  border: '1px solid var(--bg-border)',
  borderRadius: 'var(--radius-md)',
  padding: '9px 12px',
  color: 'var(--text-100)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-60)',
  marginBottom: '6px',
};

// Extrai pares chave-valor de dadosExtras para edição
function extrasToPairs(extras?: Record<string, unknown>): { key: string; value: string }[] {
  if (!extras || Object.keys(extras).length === 0) return [];
  return Object.entries(extras).map(([k, v]) => ({ key: k, value: String(v ?? '') }));
}

function pairsToExtras(pairs: { key: string; value: string }[]): Record<string, unknown> | undefined {
  const valid = pairs.filter((p) => p.key.trim());
  if (valid.length === 0) return undefined;
  return Object.fromEntries(valid.map((p) => [p.key.trim(), p.value]));
}

export function EditarObraModal({
  obra,
  onClose,
}: {
  obra: ObraDetalhe;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const [fotoPreview, setFotoPreview] = useState<string | null>(obra.fotoCapaUrl ?? null);
  const [uploadando, setUploadando] = useState(false);

  const [form, setForm] = useState({
    nome: obra.nome,
    status: obra.status,
    modoQualidade: obra.modoQualidade,
    endereco: obra.endereco ?? '',
    cidade: obra.cidade ?? '',
    estado: obra.estado ?? '',
    cep: obra.cep ?? '',
    dataInicioPrevista: obra.dataInicioPrevista ? obra.dataInicioPrevista.slice(0, 10) : '',
    dataFimPrevista: obra.dataFimPrevista ? obra.dataFimPrevista.slice(0, 10) : '',
    latitude: obra.latitude != null ? String(obra.latitude) : '',
    longitude: obra.longitude != null ? String(obra.longitude) : '',
  });

  const [extraPairs, setExtraPairs] = useState<{ key: string; value: string }[]>(
    () => extrasToPairs(obra.dadosExtras),
  );

  const [erro, setErro] = useState('');

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErro('');
  };

  const handleUploadFoto = async (file: File) => {
    if (fotoPreview && fotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(fotoPreview);
    }
    setFotoPreview(URL.createObjectURL(file));
    setUploadando(true);
    try {
      await obrasService.uploadFotoCapa(obra.id, file);
      queryClient.invalidateQueries({ queryKey: ['obras'] });
    } catch {
      // silencioso — o preview local permanece; lista é atualizada na próxima abertura
    } finally {
      setUploadando(false);
    }
  };

  const salvarMutation = useMutation({
    mutationFn: () => {
      const lat = form.latitude !== '' ? parseFloat(form.latitude) : undefined;
      const lng = form.longitude !== '' ? parseFloat(form.longitude) : undefined;
      return obrasService.update(obra.id, {
        nome: form.nome.trim(),
        status: form.status as any,
        modoQualidade: form.modoQualidade,
        endereco: form.endereco.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        estado: form.estado || undefined,
        cep: form.cep.trim() || undefined,
        dataInicioPrevista: form.dataInicioPrevista || undefined,
        dataFimPrevista: form.dataFimPrevista || undefined,
        latitude: lat,
        longitude: lng,
        dadosExtras: pairsToExtras(extraPairs),
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obra', obra.id] });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      onClose();
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message ?? 'Erro ao salvar alterações');
    },
  });

  const podesSalvar = form.nome.trim().length >= 2;

  const addExtraPair = () => setExtraPairs((p) => [...p, { key: '', value: '' }]);
  const removeExtraPair = (i: number) => setExtraPairs((p) => p.filter((_, idx) => idx !== i));
  const setExtraPair = (i: number, field: 'key' | 'value', val: string) =>
    setExtraPairs((p) => p.map((x, idx) => (idx === i ? { ...x, [field]: val } : x)));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-lg)', padding: '28px',
          width: '580px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>
          Editar Obra
        </h2>

        {erro && (
          <div style={{
            background: 'rgba(255,61,87,0.1)', border: '1px solid var(--status-error)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            color: 'var(--status-error)', fontSize: '13px', marginBottom: '16px',
          }}>
            {erro}
          </div>
        )}

        {/* Foto de capa */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Foto de capa</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fotoPreview ? (
              <div style={{ position: 'relative', width: '100%', height: '120px', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={fotoPreview} alt="Capa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {uploadando && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: '13px',
                  }}>
                    Enviando...
                  </div>
                )}
                <label style={{
                  position: 'absolute', bottom: '6px', right: '6px',
                  background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: '6px',
                  padding: '3px 10px', fontSize: '11px', cursor: 'pointer',
                }}>
                  Trocar
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void handleUploadFoto(file);
                    }}
                  />
                </label>
              </div>
            ) : (
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '72px', border: '1px dashed var(--bg-border)',
                borderRadius: '8px', cursor: 'pointer',
                color: 'var(--text-60)', fontSize: '13px', gap: '8px',
                background: 'var(--bg-surface)',
              }}>
                📷 Adicionar foto de capa
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void handleUploadFoto(file);
                  }}
                />
              </label>
            )}
          </div>
        </div>

        {/* Nome */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Nome da Obra *</label>
          <input value={form.nome} onChange={(e) => set('nome', e.target.value)} style={inputStyle} autoFocus />
        </div>

        {/* Status + Modo Qualidade */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value as any)} style={inputStyle}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Modo de Qualidade</label>
            <select value={form.modoQualidade} onChange={(e) => set('modoQualidade', e.target.value as any)} style={inputStyle}>
              <option value="SIMPLES">Simples</option>
              <option value="PBQPH">PBQP-H</option>
            </select>
          </div>
        </div>

        {/* Endereço */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Endereço</label>
          <input
            value={form.endereco}
            onChange={(e) => set('endereco', e.target.value)}
            placeholder="Rua, número, bairro"
            style={inputStyle}
          />
        </div>

        {/* Cidade + Estado + CEP */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 130px', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Cidade</label>
            <input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Estado</label>
            <select value={form.estado} onChange={(e) => set('estado', e.target.value)} style={{ ...inputStyle, width: '72px' }}>
              <option value="">UF</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>CEP</label>
            <input
              value={form.cep}
              onChange={(e) => set('cep', e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Coordenadas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Latitude</label>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
              placeholder="-23.5505"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Longitude</label>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
              placeholder="-46.6333"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Datas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Início Previsto</label>
            <input type="date" value={form.dataInicioPrevista} onChange={(e) => set('dataInicioPrevista', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Término Previsto</label>
            <input type="date" value={form.dataFimPrevista} onChange={(e) => set('dataFimPrevista', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Dados Extras */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-60)' }}>
              Dados Extras
              <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-40)' }}>
                (campos customizados)
              </span>
            </label>
            <button
              type="button"
              onClick={addExtraPair}
              style={{
                background: 'transparent', border: '1px solid var(--bg-border)',
                color: 'var(--text-60)', borderRadius: 'var(--radius-sm)',
                padding: '2px 8px', cursor: 'pointer', fontSize: '12px',
              }}
            >
              + Campo
            </button>
          </div>

          {extraPairs.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-40)', fontStyle: 'italic' }}>
              Nenhum campo extra definido.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {extraPairs.map((pair, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                  <input
                    value={pair.key}
                    onChange={(e) => setExtraPair(i, 'key', e.target.value)}
                    placeholder="Chave"
                    style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }}
                  />
                  <input
                    value={pair.value}
                    onChange={(e) => setExtraPair(i, 'value', e.target.value)}
                    placeholder="Valor"
                    style={{ ...inputStyle, fontSize: '13px', padding: '6px 10px' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraPair(i)}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--status-error)', cursor: 'pointer', fontSize: '16px',
                      padding: '0 4px', lineHeight: 1,
                    }}
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={salvarMutation.isPending}
            style={{
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              color: 'var(--text-60)', borderRadius: 'var(--radius-md)',
              padding: '9px 18px', cursor: 'pointer', fontSize: '14px',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => salvarMutation.mutate()}
            disabled={!podesSalvar || salvarMutation.isPending}
            style={{
              background: podesSalvar ? 'var(--accent)' : 'var(--bg-border)',
              color: podesSalvar ? 'var(--accent-fg)' : 'var(--text-40)',
              border: 'none', borderRadius: 'var(--radius-md)',
              padding: '9px 20px', cursor: podesSalvar ? 'pointer' : 'default',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            {salvarMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
