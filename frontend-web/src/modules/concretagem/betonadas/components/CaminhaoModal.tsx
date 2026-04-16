// frontend-web/src/modules/concretagem/betonadas/components/CaminhaoModal.tsx
import { useState, useRef } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { useRegistrarCaminhao, useOcrNf } from '../hooks/useBetonadas';
import type { CreateCaminhaoPayload } from '@/services/concretagem.service';

interface Props {
  betonadaId: number;
  obraId: number;
  onClose: () => void;
  /** Optional: list of element labels from the croqui for multi-select */
  elementosDisponiveis?: string[];
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-[var(--border-dim)] bg-[var(--bg-raised)] text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)]';
const labelCls = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

type SobraTipo = 'NENHUMA' | 'APROVEITADO' | 'DESCARTADO' | 'NAO_PAGAR';

export default function CaminhaoModal({ betonadaId, obraId, onClose, elementosDisponiveis = [] }: Props) {
  // Core NF fields
  const [numeroNf, setNumeroNf] = useState('');
  const [dataEmissaoNf, setDataEmissaoNf] = useState('');
  const [volume, setVolume] = useState('');
  const [motorista, setMotorista] = useState('');
  const [placa, setPlaca] = useState('');
  const [numeroBt, setNumeroBt] = useState('');

  // Horários — 4 timestamps
  const [horaCarregamento, setHoraCarregamento] = useState('');
  const [horaChegada, setHoraChegada] = useState('');
  const [horaInicioLancamento, setHoraInicioLancamento] = useState('');
  const [horaFimLancamento, setHoraFimLancamento] = useState('');

  // Slump / temperatura
  const [slumpEspecificado, setSlumpEspecificado] = useState('');
  const [slumpMedido, setSlumpMedido] = useState('');
  const [temperatura, setTemperatura] = useState('');

  // Technical fields
  const [fatorAc, setFatorAc] = useState('');
  const [flow, setFlow] = useState('');
  const [ensaioJ, setEnsaioJ] = useState('');

  // Elementos lançados (multi-select)
  const [elementosSelecionados, setElementosSelecionados] = useState<string[]>([]);
  const [elementoCustom, setElementoCustom] = useState('');

  // Sobra
  const [sobraTipo, setSobraTipo] = useState<SobraTipo>('NENHUMA');
  const [sobraVolume, setSobraVolume] = useState('');

  // Lacre
  const [verificarLacre, setVerificarLacre] = useState(false);
  const [lacreAprovado, setLacreAprovado] = useState<boolean | null>(null);

  // Não descarregou
  const [naoDescarregou, setNaoDescarregou] = useState(false);
  const [respConcreteira, setRespConcreteira] = useState(false);

  // Lançamento parcial
  const [lancamentoParcial, setLancamentoParcial] = useState(false);

  // OCR state
  const [ocrConfianca, setOcrConfianca] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrMutation = useOcrNf();

  const mutation = useRegistrarCaminhao(obraId, betonadaId);

  async function handleOcrSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
      try {
        const result = await ocrMutation.mutateAsync({ image_base64: base64, media_type: mediaType });
        if (result.numero_nf) setNumeroNf(result.numero_nf);
        if (result.data_emissao_nf) setDataEmissaoNf(result.data_emissao_nf);
        if (result.volume != null) setVolume(String(result.volume));
        if (result.motorista) setMotorista(result.motorista);
        if (result.placa) setPlaca(result.placa);
        setOcrConfianca(result.confianca);
      } catch {
        // OCR falhou — não bloqueia o formulário
      }
    };
    reader.readAsDataURL(file);
  }

  function toggleElemento(label: string) {
    setElementosSelecionados((prev) =>
      prev.includes(label) ? prev.filter((e) => e !== label) : [...prev, label],
    );
  }

  function adicionarCustom() {
    const val = elementoCustom.trim();
    if (!val || elementosSelecionados.includes(val)) return;
    setElementosSelecionados((prev) => [...prev, val]);
    setElementoCustom('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const allElementos = elementosSelecionados;

    const payload: CreateCaminhaoPayload = {
      numero_nf: numeroNf.trim(),
      data_emissao_nf: dataEmissaoNf,
      volume: parseFloat(volume),
      ...(motorista.trim() && { motorista: motorista.trim() }),
      ...(placa.trim() && { placa: placa.trim() }),
      ...(numeroBt.trim() && { numero_bt: numeroBt.trim() }),
      ...(horaCarregamento && { hora_carregamento: horaCarregamento }),
      ...(horaChegada && { hora_chegada: horaChegada }),
      ...(horaInicioLancamento && { hora_inicio_lancamento: horaInicioLancamento }),
      ...(horaFimLancamento && { hora_fim_lancamento: horaFimLancamento }),
      ...(allElementos.length > 0 && { elementos_lancados: allElementos }),
      ...(allElementos.length > 0 && { elemento_lancado: allElementos[0] }),
      ...(slumpEspecificado && { slump_especificado: parseFloat(slumpEspecificado) }),
      ...(slumpMedido && { slump_medido: parseFloat(slumpMedido) }),
      ...(temperatura && { temperatura: parseFloat(temperatura) }),
      ...(fatorAc && { fator_ac: parseFloat(fatorAc) }),
      ...(flow && { flow: parseFloat(flow) }),
      ...(ensaioJ && { ensaio_j: parseFloat(ensaioJ) }),
      ...(sobraTipo !== 'NENHUMA' && { sobra_tipo: sobraTipo }),
      ...(sobraTipo !== 'NENHUMA' && sobraVolume && { sobra_volume: parseFloat(sobraVolume) }),
      ...(verificarLacre && lacreAprovado !== null && { lacre_aprovado: lacreAprovado }),
      ...(naoDescarregou && { nao_descarregou: true }),
      ...(naoDescarregou && respConcreteira && { responsabilidade_concreteira: true }),
      ...(lancamentoParcial && { lancamento_parcial: true }),
    };
    await mutation.mutateAsync(payload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b z-10" style={{ borderColor: 'var(--border-dim)', background: 'var(--bg-surface)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-high)' }}>
            Registrar Chegada de Caminhão
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:opacity-70" style={{ color: 'var(--text-faint)' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-5">

          {/* OCR NF */}
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)' }}>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleOcrSelect(e)} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {ocrMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {ocrMutation.isPending ? 'Lendo NF…' : 'Ler NF via IA'}
            </button>
            {ocrConfianca !== null && (
              <span className="text-xs" style={{ color: ocrConfianca >= 70 ? 'var(--ok-text)' : 'var(--warn-text)' }}>
                Confiança: {ocrConfianca}%
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Foto da NF para preencher automaticamente
            </span>
          </div>

          {/* NF + Data + BT */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Número NF *</label>
              <input className={inputCls} value={numeroNf} onChange={(e) => setNumeroNf(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Data Emissão NF *</label>
              <input type="date" className={inputCls} value={dataEmissaoNf} onChange={(e) => setDataEmissaoNf(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Nº BT (Boletim)</label>
              <input className={inputCls} value={numeroBt} onChange={(e) => setNumeroBt(e.target.value)} maxLength={50} />
            </div>
          </div>

          {/* Volume + Motorista + Placa */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Volume (m³) *</label>
              <input type="number" step="0.1" min="0.1" className={inputCls} value={volume} onChange={(e) => setVolume(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Motorista</label>
              <input className={inputCls} value={motorista} onChange={(e) => setMotorista(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Placa</label>
              <input className={inputCls} value={placa} onChange={(e) => setPlaca(e.target.value)} maxLength={10} />
            </div>
          </div>

          {/* 4 Horários */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Horários</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Carregamento</label>
                <input type="time" className={inputCls} value={horaCarregamento} onChange={(e) => setHoraCarregamento(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Chegada</label>
                <input type="time" className={inputCls} value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Início Descarga</label>
                <input type="time" className={inputCls} value={horaInicioLancamento} onChange={(e) => setHoraInicioLancamento(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Fim Descarga</label>
                <input type="time" className={inputCls} value={horaFimLancamento} onChange={(e) => setHoraFimLancamento(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Slump + Temperatura */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Slump Esp. (cm)</label>
              <input type="number" step="0.5" min="0" className={inputCls} value={slumpEspecificado} onChange={(e) => setSlumpEspecificado(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Slump Med. (cm)</label>
              <input type="number" step="0.5" min="0" className={inputCls} value={slumpMedido} onChange={(e) => setSlumpMedido(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Temperatura (°C)</label>
              <input type="number" step="0.1" className={inputCls} value={temperatura} onChange={(e) => setTemperatura(e.target.value)} />
            </div>
          </div>

          {/* Technical fields */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Ensaios</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fator A/C</label>
                <input type="number" step="0.001" min="0" max="2" className={inputCls} placeholder="Ex: 0.550" value={fatorAc} onChange={(e) => setFatorAc(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Flow (mm)</label>
                <input type="number" step="1" min="0" className={inputCls} placeholder="Ex: 550" value={flow} onChange={(e) => setFlow(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Ensaio J (mm)</label>
                <input type="number" step="1" min="0" className={inputCls} placeholder="Ex: 480" value={ensaioJ} onChange={(e) => setEnsaioJ(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Elementos lançados — multi-select */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Peças Lançadas</p>
            {elementosDisponiveis.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {elementosDisponiveis.map((label) => {
                  const sel = elementosSelecionados.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleElemento(label)}
                      className="text-xs px-2.5 py-1 rounded-md border font-medium transition-colors"
                      style={{
                        background: sel ? 'var(--accent)' : 'var(--bg-raised)',
                        color: sel ? 'white' : 'var(--text-faint)',
                        borderColor: sel ? 'var(--accent)' : 'var(--border-dim)',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {/* Custom element input */}
            <div className="flex gap-2 mt-1">
              <input
                className={`${inputCls} flex-1`}
                placeholder="Adicionar peça manualmente (ex: L1-A2)"
                value={elementoCustom}
                onChange={(e) => setElementoCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCustom(); } }}
              />
              <button
                type="button"
                onClick={adicionarCustom}
                className="text-xs px-3 py-2 rounded-lg font-medium"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-faint)', border: '1px solid var(--border-dim)' }}
              >
                +
              </button>
            </div>
            {elementosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {elementosSelecionados.map((el) => (
                  <span
                    key={el}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {el}
                    <button type="button" onClick={() => toggleElemento(el)} className="opacity-70 hover:opacity-100 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sobra */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-faint)' }}>Sobra de Concreto</p>
            <div className="flex gap-3 flex-wrap">
              {(['NENHUMA', 'APROVEITADO', 'DESCARTADO', 'NAO_PAGAR'] as SobraTipo[]).map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: 'var(--text-med)' }}>
                  <input
                    type="radio"
                    name="sobra_tipo"
                    value={opt}
                    checked={sobraTipo === opt}
                    onChange={() => setSobraTipo(opt)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  {opt === 'NENHUMA' ? 'Nenhuma' : opt === 'APROVEITADO' ? 'Aproveitado' : opt === 'DESCARTADO' ? 'Descartado' : 'Não Pagar'}
                </label>
              ))}
            </div>
            {sobraTipo !== 'NENHUMA' && (
              <div className="mt-2 max-w-[180px]">
                <label className={labelCls}>Volume da Sobra (m³)</label>
                <input type="number" step="0.1" min="0" className={inputCls} value={sobraVolume} onChange={(e) => setSobraVolume(e.target.value)} />
              </div>
            )}
          </div>

          {/* Lacre */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm mb-2" style={{ color: 'var(--text-high)' }}>
              <input
                type="checkbox"
                checked={verificarLacre}
                onChange={(e) => { setVerificarLacre(e.target.checked); if (!e.target.checked) setLacreAprovado(null); }}
                style={{ accentColor: 'var(--accent)' }}
                className="w-4 h-4"
              />
              Verificar Lacre
            </label>
            {verificarLacre && (
              <div className="flex gap-4 pl-6">
                {[{ label: 'Aprovado', value: true }, { label: 'Reprovado', value: false }].map(({ label, value }) => (
                  <label key={label} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: value ? 'var(--ok-text)' : 'var(--nc-text)' }}>
                    <input
                      type="radio"
                      name="lacre"
                      checked={lacreAprovado === value}
                      onChange={() => setLacreAprovado(value)}
                      style={{ accentColor: value ? 'var(--ok-text)' : 'var(--nc-text)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Não descarregou */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm mb-2" style={{ color: 'var(--text-high)' }}>
              <input
                type="checkbox"
                checked={naoDescarregou}
                onChange={(e) => { setNaoDescarregou(e.target.checked); if (!e.target.checked) setRespConcreteira(false); }}
                style={{ accentColor: 'var(--nc-text)' }}
                className="w-4 h-4"
              />
              <span style={{ color: naoDescarregou ? 'var(--nc-text)' : undefined }}>
                Caminhão não descarregou
              </span>
            </label>
            {naoDescarregou && (
              <label className="flex items-center gap-2 cursor-pointer text-sm pl-6" style={{ color: 'var(--text-med)' }}>
                <input
                  type="checkbox"
                  checked={respConcreteira}
                  onChange={(e) => setRespConcreteira(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                  className="w-4 h-4"
                />
                Responsabilidade da Concreteira
              </label>
            )}
          </div>

          {/* Lançamento parcial */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-high)' }}>
              <input
                type="checkbox"
                checked={lancamentoParcial}
                onChange={(e) => setLancamentoParcial(e.target.checked)}
                style={{ accentColor: 'var(--warn-text)' }}
                className="w-4 h-4"
              />
              <span style={{ color: lancamentoParcial ? 'var(--warn-text)' : undefined }}>
                Lançamento Parcial (será completado depois)
              </span>
            </label>
          </div>

          {mutation.isError && (
            <p className="text-xs" style={{ color: 'var(--nc-text)' }}>
              Erro ao registrar caminhão. Verifique os dados e tente novamente.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--border-dim)', color: 'var(--text-faint)' }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !numeroNf.trim() || !dataEmissaoNf || !volume}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {mutation.isPending ? 'Registrando…' : lancamentoParcial ? 'Salvar Parcial' : 'Registrar Chegada'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
