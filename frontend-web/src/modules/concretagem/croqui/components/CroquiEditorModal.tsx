// frontend-web/src/modules/concretagem/croqui/components/CroquiEditorModal.tsx
// Modal: Upload → Análise IA → Revisão → Salvar — SPEC 7

import { useState, useRef } from 'react';
import { X, Upload, Cpu, ChevronRight, Save, AlertCircle } from 'lucide-react';
import type {
  AnalisarPlantaResult,
  ElementosPayload,
} from '@/services/concretagem.service';
import { useAnalisarPlanta, fileToBase64 } from '../hooks/useAnalisarPlanta';
import { useCriarCroqui } from '../hooks/useCroqui';
import { PlantaIaResultPreview } from './PlantaIaResultPreview';

// ─── Tipos de step ────────────────────────────────────────────────────────────

type Step = 'upload' | 'analisando' | 'revisao' | 'salvando';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CroquiEditorModalProps {
  obraId: number;
  onClose: () => void;
  onSaved: (croquiId: number) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CroquiEditorModal({ obraId, onClose, onSaved }: CroquiEditorModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [contexto, setContexto] = useState('');
  const [nome, setNome] = useState('');
  const [resultado, setResultado] = useState<AnalisarPlantaResult | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const analisarMutation = useAnalisarPlanta(obraId);
  const criarMutation = useCriarCroqui(obraId);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleArquivoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    setErroMsg(null);
    // Sugestão de nome a partir do arquivo
    if (!nome) {
      setNome(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    }
  }

  async function handleAnalisar() {
    if (!arquivo) return;

    const MIME_MAP: Record<string, 'image/jpeg' | 'image/png' | 'application/pdf'> = {
      'image/jpeg': 'image/jpeg',
      'image/jpg': 'image/jpeg',
      'image/png': 'image/png',
      'application/pdf': 'application/pdf',
    };

    const mimeType = MIME_MAP[arquivo.type];
    if (!mimeType) {
      setErroMsg('Formato não suportado. Use JPEG, PNG ou PDF.');
      return;
    }

    try {
      setErroMsg(null);
      setStep('analisando');
      const base64 = await fileToBase64(arquivo);
      const res = await analisarMutation.mutateAsync({
        arquivo_base64: base64,
        mime_type: mimeType,
        contexto: contexto.trim() || undefined,
      });
      setResultado(res);
      setStep('revisao');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao analisar planta. Tente novamente.';
      setErroMsg(msg);
      setStep('upload');
    }
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      setErroMsg('Informe um nome para o croqui.');
      return;
    }

    const elementos: ElementosPayload = resultado
      ? {
          eixos_x: resultado.eixos_x,
          eixos_y: resultado.eixos_y,
          elementos: resultado.elementos,
        }
      : { eixos_x: [], eixos_y: [], elementos: [] };

    try {
      setErroMsg(null);
      setStep('salvando');
      const croqui = await criarMutation.mutateAsync({
        nome: nome.trim(),
        elementos,
        ia_confianca: resultado?.confianca,
      });
      onSaved(croqui.id);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao salvar. Tente novamente.';
      setErroMsg(msg);
      setStep('revisao');
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  const isBusy = step === 'analisando' || step === 'salvando';

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={(e) => e.target === e.currentTarget && !isBusy && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-surface, #fff)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-dim, #e2e8f0)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-high, #0f172a)' }}>
              Novo Croqui de Rastreabilidade
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-faint, #94a3b8)' }}>
              Envie a planta estrutural — a EldoX.IA identifica os elementos automaticamente
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            style={{
              background: 'none',
              border: 'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              color: 'var(--text-faint, #94a3b8)',
              padding: 4,
              borderRadius: 6,
              opacity: isBusy ? 0.4 : 1,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <StepIndicator step={step} />

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* ── Step: Upload ── */}
          {(step === 'upload') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-dim, #e2e8f0)',
                  borderRadius: 12,
                  padding: '32px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: arquivo ? '#f0fdf4' : 'var(--bg-raised, #f8fafc)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <Upload
                  size={32}
                  style={{ color: arquivo ? '#16a34a' : '#94a3b8', marginBottom: 8 }}
                />
                {arquivo ? (
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#15803d' }}>
                      {arquivo.name}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                      {(arquivo.size / 1024).toFixed(0)} KB — clique para trocar
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: '#475569' }}>
                      Clique para selecionar a planta
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
                      JPEG, PNG ou PDF — máximo 25 MB
                    </p>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleArquivoChange}
                />
              </div>

              {/* Nome */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-high, #0f172a)' }}>
                  Nome do croqui *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Pavimento Tipo — Bloco A"
                  maxLength={200}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border-dim, #e2e8f0)',
                    fontSize: 14,
                    background: 'var(--bg-surface, #fff)',
                    color: 'var(--text-high, #0f172a)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Contexto opcional */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-high, #0f172a)' }}>
                  Contexto para a IA{' '}
                  <span style={{ fontWeight: 400, color: '#94a3b8' }}>(opcional)</span>
                </label>
                <input
                  type="text"
                  value={contexto}
                  onChange={(e) => setContexto(e.target.value)}
                  placeholder="Ex: Laje nervurada, térreo, eixos A–E / 1–8"
                  maxLength={200}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border-dim, #e2e8f0)',
                    fontSize: 14,
                    background: 'var(--bg-surface, #fff)',
                    color: 'var(--text-high, #0f172a)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
                  Ajuda a IA a identificar melhor os elementos
                </p>
              </div>
            </div>
          )}

          {/* ── Step: Analisando ── */}
          {step === 'analisando' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: 'spin 1.2s linear infinite',
                }}
              >
                <Cpu size={24} color="#fff" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--text-high, #0f172a)' }}>
                  EldoX.IA analisando a planta…
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Identificando eixos e elementos estruturais
                </p>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── Step: Revisão ── */}
          {step === 'revisao' && resultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#fdf4ff',
                  border: '1px solid #e9d5ff',
                  fontSize: 12,
                  color: '#7e22ce',
                }}
              >
                Revise os elementos identificados pela IA antes de salvar. Você pode editar o croqui após criá-lo.
              </div>
              <PlantaIaResultPreview resultado={resultado} />
              {/* Editar nome antes de salvar */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-high, #0f172a)' }}>
                  Nome do croqui *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Pavimento Tipo — Bloco A"
                  maxLength={200}
                  style={{
                    width: '100%',
                    marginTop: 6,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid var(--border-dim, #e2e8f0)',
                    fontSize: 14,
                    background: 'var(--bg-surface, #fff)',
                    color: 'var(--text-high, #0f172a)',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Step: Salvando ── */}
          {step === 'salvando' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
                gap: 12,
                color: '#6366f1',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: '2.5px solid currentColor',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Salvando croqui…</span>
            </div>
          )}

          {/* Erro */}
          {erroMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                fontSize: 13,
                color: '#991b1b',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              {erroMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-dim, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={step === 'revisao' ? () => setStep('upload') : onClose}
            disabled={isBusy}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1.5px solid var(--border-dim, #e2e8f0)',
              background: 'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--text-med, #475569)',
              opacity: isBusy ? 0.4 : 1,
            }}
          >
            {step === 'revisao' ? '← Voltar' : 'Cancelar'}
          </button>

          {step === 'upload' && (
            <button
              type="button"
              onClick={handleAnalisar}
              disabled={!arquivo || !nome.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: arquivo && nome.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                cursor: arquivo && nome.trim() ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 600,
                color: arquivo && nome.trim() ? '#fff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Cpu size={15} />
              Analisar com IA
              <ChevronRight size={15} />
            </button>
          )}

          {step === 'revisao' && (
            <button
              type="button"
              onClick={handleSalvar}
              disabled={!nome.trim()}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: nome.trim() ? '#16a34a' : '#e2e8f0',
                cursor: nome.trim() ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 600,
                color: nome.trim() ? '#fff' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Save size={15} />
              Salvar Croqui
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: 'Envio' },
    { key: 'analisando', label: 'Análise IA' },
    { key: 'revisao', label: 'Revisão' },
    { key: 'salvando', label: 'Salvo' },
  ];

  const activeIdx = steps.findIndex((s) => s.key === step);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 24px',
        gap: 0,
        background: 'var(--bg-raised, #f8fafc)',
        borderBottom: '1px solid var(--border-dim, #e2e8f0)',
      }}
    >
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={s.key}
            style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: done ? '#16a34a' : active ? '#6366f1' : '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: done || active ? '#fff' : '#94a3b8',
                  transition: 'background 0.2s',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  color: done ? '#16a34a' : active ? '#6366f1' : '#94a3b8',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: done ? '#16a34a' : '#e2e8f0',
                  margin: '0 4px',
                  marginBottom: 14,
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
