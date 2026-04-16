// frontend-web/src/modules/concretagem/croqui/components/PlantaIaResultPreview.tsx
// Pré-visualização do resultado da análise IA antes de salvar — SPEC 7

import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import type { AnalisarPlantaResult, ElementosPayload } from '@/services/concretagem.service';
import { CroquiSvg } from './CroquiSvg';

interface PlantaIaResultPreviewProps {
  resultado: AnalisarPlantaResult;
}

function ConfiancaBadge({ confianca }: { confianca: number }) {
  const pct = Math.round(confianca * 100);
  const color =
    pct >= 80 ? '#16a34a' :
    pct >= 60 ? '#ca8a04' :
                '#dc2626';

  const Icon =
    pct >= 60 ? CheckCircle : AlertCircle;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        color,
        padding: '2px 8px',
        borderRadius: 9999,
        border: `1.5px solid ${color}`,
      }}
    >
      <Icon size={13} />
      {pct}% confiança
    </span>
  );
}

export function PlantaIaResultPreview({ resultado }: PlantaIaResultPreviewProps) {
  const elementosPayload: ElementosPayload = {
    eixos_x: resultado.eixos_x,
    eixos_y: resultado.eixos_y,
    elementos: resultado.elementos,
  };

  const baixaConfianca = resultado.confianca < 0.6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header: confiança e tokens */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ConfiancaBadge confianca={resultado.confianca} />
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {resultado.elementos.length} elemento{resultado.elementos.length !== 1 ? 's' : ''} identificado{resultado.elementos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#cbd5e1' }}>
          {resultado.tokens_in + resultado.tokens_out} tokens
        </span>
      </div>

      {/* Aviso de baixa confiança */}
      {baixaConfianca && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fefce8',
            border: '1px solid #fde047',
            fontSize: 13,
            color: '#854d0e',
          }}
        >
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0, color: '#ca8a04' }} />
          <div>
            <strong>Confiança baixa</strong> — Revise e corrija os elementos antes de salvar.{' '}
            {resultado.observacoes}
          </div>
        </div>
      )}

      {/* Observações da IA (quando há elementos e observação não-trivial) */}
      {!baixaConfianca && resultado.observacoes && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            fontSize: 12,
            color: '#0c4a6e',
          }}
        >
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          {resultado.observacoes}
        </div>
      )}

      {/* Croqui SVG gerado pela IA */}
      {resultado.elementos.length > 0 ? (
        <CroquiSvg elementos={elementosPayload} readonly />
      ) : (
        <div
          style={{
            padding: '24px',
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 13,
          }}
        >
          Nenhum elemento foi identificado na planta.
          <br />
          Crie o croqui manualmente.
        </div>
      )}

      {/* Eixos identificados */}
      {(resultado.eixos_x.length > 0 || resultado.eixos_y.length > 0) && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
          <span>
            <strong>Eixos X:</strong>{' '}
            {resultado.eixos_x.join(', ') || '—'}
          </span>
          <span>
            <strong>Eixos Y:</strong>{' '}
            {resultado.eixos_y.join(', ') || '—'}
          </span>
        </div>
      )}
    </div>
  );
}
