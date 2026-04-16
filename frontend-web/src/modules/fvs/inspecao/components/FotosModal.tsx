// frontend-web/src/modules/fvs/inspecao/components/FotosModal.tsx
import { useRef, useState } from 'react';
import { useEvidencias, useCreateEvidencia, useDeleteEvidencia } from '../hooks/useRegistros';
import type { FvsRegistro, FvsEvidencia } from '../../../../services/fvs.service';
import { fvsService } from '../../../../services/fvs.service';
import { X, Camera, Plus, PenLine, Sparkles } from 'lucide-react';
import { MarkupCanvas } from './MarkupCanvas';

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
  const [markupEv, setMarkupEv] = useState<{ id: number; url: string } | null>(null);

  const [analisando, setAnalisando] = useState<number | null>(null); // evidenciaId sendo analisado
  const [analiseResultado, setAnaliseResultado] = useState<{
    evidenciaId: number;
    status_sugerido: string;
    confianca: number;
    observacoes: string;
    pontos_atencao: string[];
  } | null>(null);

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

  async function handleAnalisarIA(ev: FvsEvidencia) {
    if (analisando) return;
    setAnalisando(ev.id);
    try {
      // busca a imagem como base64
      const resp = await fetch(ev.url!);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((res) => {
        const reader = new FileReader();
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const resultado = await fvsService.analisarFotoIA(ev.id, base64, blob.type);
      setAnaliseResultado({ evidenciaId: ev.id, ...resultado });
    } catch {
      // silencioso — pode falhar se imagem não acessível
    } finally {
      setAnalisando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-[var(--bg-base)] border border-[var(--border-dim)] rounded-xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)]">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-[var(--text-faint)]" />
            <h3 className="text-base font-semibold text-[var(--text-high)] m-0 truncate max-w-[320px]">
              {registro.item_descricao}
            </h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Aviso PBQP-H */}
        {isCriticoNcSemFoto && (
          <div className="mx-5 mt-4 px-3 py-2.5 rounded-md bg-[var(--warn-bg)] border border-[var(--warn-border)] text-sm text-[var(--warn-text)]">
            ⚠ Foto obrigatória para item crítico NC em PBQP-H — será validada na conclusão da ficha.
          </div>
        )}

        {/* Grid de fotos */}
        <div className="flex-1 overflow-y-auto p-5">
          {evidencias.length === 0 ? (
            <p className="text-sm text-[var(--text-faint)] text-center py-8">Nenhuma foto adicionada.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {evidencias.map(ev => {
                const isImage = ev.mime_type?.startsWith('image/') ?? ev.nome_original?.match(/\.(jpe?g|png|gif|webp)$/i) != null;
                return (
                  <div key={ev.id} className="relative group">
                    {isImage && ev.url ? (
                      <div className="relative">
                        <a href={ev.url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={ev.url}
                            alt={ev.nome_original ?? 'foto'}
                            className="w-24 h-24 object-cover rounded-lg border border-[var(--border-dim)] cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                        {/* Botão de anotação */}
                        <button
                          onClick={() => setMarkupEv({ id: ev.id, url: ev.url! })}
                          title="Anotar foto"
                          className="absolute bottom-1 right-1 bg-[var(--bg-base)]/80 rounded-md p-0.5 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <PenLine size={12} />
                        </button>
                        {/* Botão de análise IA */}
                        <button
                          onClick={() => handleAnalisarIA(ev)}
                          title="Analisar com IA"
                          disabled={!!analisando}
                          className="absolute bottom-1 left-1 bg-[var(--bg-base)]/80 rounded-md p-0.5 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40"
                        >
                          {analisando === ev.id ? (
                            <svg
                              className="animate-spin"
                              width={12}
                              height={12}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <Sparkles size={12} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <a
                        href={ev.url ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-24 h-24 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-lg flex flex-col items-center justify-center gap-1 text-[10px] text-[var(--text-faint)] text-center p-2 overflow-hidden hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      >
                        <span className="text-lg">📄</span>
                        <span className="truncate w-full text-center">{ev.nome_original ?? 'arquivo'}</span>
                      </a>
                    )}
                    <button
                      onClick={() => deleteEv.mutate({ id: ev.id, registroId: registro.id! })}
                      className="absolute -top-1.5 -right-1.5 bg-[var(--nc-text)] text-white rounded-full w-[18px] h-[18px] text-[10px] flex items-center justify-center hover:opacity-80 transition-opacity opacity-0 group-hover:opacity-100"
                    >
                      ×
                    </button>
                    {/* Mini-painel de resultado IA */}
                    {analiseResultado?.evidenciaId === ev.id && (
                      <div className="mt-1 p-2 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-dim)] text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--text-high)]">IA: {analiseResultado.status_sugerido}</span>
                          <span className="text-[var(--text-faint)]">{analiseResultado.confianca}% conf.</span>
                        </div>
                        {analiseResultado.observacoes && (
                          <p className="text-[var(--text-faint)]">{analiseResultado.observacoes}</p>
                        )}
                        {analiseResultado.pontos_atencao?.length > 0 && (
                          <ul className="list-disc list-inside text-[var(--warn-text)] space-y-0.5">
                            {analiseResultado.pontos_atencao.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        )}
                        <button onClick={() => setAnaliseResultado(null)} className="text-[var(--text-faint)] hover:text-[var(--text-high)] text-[10px]">fechar</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-dim)]">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={createEv.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus size={14} />
            {createEv.isPending ? 'Enviando...' : 'Adicionar Foto'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {/* Markup Canvas overlay */}
      {markupEv && (
        <MarkupCanvas
          evidenciaId={markupEv.id}
          imageUrl={markupEv.url}
          onClose={() => setMarkupEv(null)}
        />
      )}
    </div>
  );
}
