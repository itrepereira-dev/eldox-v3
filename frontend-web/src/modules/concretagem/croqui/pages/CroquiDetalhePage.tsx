// frontend-web/src/modules/concretagem/croqui/pages/CroquiDetalhePage.tsx
// Detalhe do croqui com visualização SVG interativa — SPEC 7

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Grid3x3, Cpu, Info, Layers } from 'lucide-react';
import { useBuscarCroqui } from '../hooks/useCroqui';
import { CroquiSvg, buildCaminhaoColorMap } from '../components/CroquiSvg';
import { concretagemService } from '@/services/concretagem.service';
import type { ElementoCroqui } from '@/services/concretagem.service';

const TIPO_LABELS: Record<ElementoCroqui['tipo'], string> = {
  painel_laje: 'Painel de Laje',
  pilar: 'Pilar',
  viga: 'Viga',
  outro: 'Outro',
};

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CroquiDetalhePage() {
  const { obraId, croquiId } = useParams<{ obraId: string; croquiId: string }>();
  const navigate = useNavigate();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [modoRastreabilidade, setModoRastreabilidade] = useState(false);

  const { data: croqui, isLoading, error } = useBuscarCroqui(Number(obraId), Number(croquiId));

  // Busca betonadas da obra para modo rastreabilidade (coloração por caminhão)
  const { data: betonadasData } = useQuery({
    queryKey: ['betonadas-rastreabilidade', Number(obraId)],
    queryFn: () => concretagemService.listarBetonadas(Number(obraId), { limit: 50 }),
    enabled: modoRastreabilidade && !!obraId,
    staleTime: 60_000,
  });

  // Monta mapa de cores: busca caminhões de todas as betonadas em andamento
  const { data: betonadaDetalhe } = useQuery({
    queryKey: ['betonada-rastreabilidade-detalhe', Number(obraId), betonadasData?.items?.[0]?.id],
    queryFn: () => concretagemService.buscarBetonada(Number(obraId), betonadasData!.items[0].id),
    enabled: modoRastreabilidade && !!betonadasData?.items?.length,
    staleTime: 60_000,
  });

  const elementoColors = modoRastreabilidade && betonadaDetalhe && croqui
    ? buildCaminhaoColorMap(
        betonadaDetalhe.caminhoes.map((c) => ({
          id: c.id,
          sequencia: c.sequencia,
          numero_nf: c.numero_nf,
          elemento_lancado: c.elemento_lancado,
          status: c.status,
        })),
        croqui.elementos,
      )
    : undefined;

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: '#94a3b8', fontSize: 14 }}>
        Carregando croqui…
      </div>
    );
  }

  if (error || !croqui) {
    return (
      <div style={{ padding: 32, color: '#dc2626', fontSize: 14 }}>
        Croqui não encontrado.
      </div>
    );
  }

  const elementoSelecionado = selecionado
    ? croqui.elementos.elementos.find((e) => e.id === selecionado)
    : null;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Breadcrumb / Voltar */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6366f1',
          fontSize: 13,
          fontWeight: 600,
          padding: '0 0 16px',
        }}
      >
        <ArrowLeft size={15} />
        Voltar
      </button>

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#ede9fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Grid3x3 size={22} color="#7c3aed" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-high, #0f172a)' }}>
              {croqui.nome}
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#94a3b8' }}>
              Criado em {fmtData(croqui.created_at)}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Toggle Rastreabilidade por Caminhão */}
          <button
            type="button"
            onClick={() => setModoRastreabilidade((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 8,
              background: modoRastreabilidade ? '#4f46e5' : 'var(--bg-surface, #fff)',
              border: `1px solid ${modoRastreabilidade ? '#4f46e5' : 'var(--border-dim, #e2e8f0)'}`,
              fontSize: 12,
              fontWeight: 600,
              color: modoRastreabilidade ? '#fff' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <Layers size={13} />
            {modoRastreabilidade ? 'Rastreabilidade ON' : 'Ver por Caminhão'}
          </button>

          {croqui.ia_confianca != null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                background: '#fdf4ff',
                border: '1px solid #e9d5ff',
                fontSize: 12,
                fontWeight: 600,
                color: '#7e22ce',
              }}
            >
              <Cpu size={13} />
              EldoX.IA — {Math.round(croqui.ia_confianca * 100)}% confiança
            </div>
          )}
        </div>
      </div>

      {/* Layout em 2 colunas */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Croqui SVG */}
        <div
          style={{
            flex: '1 1 500px',
            background: 'var(--bg-surface, #fff)',
            borderRadius: 16,
            border: '1px solid var(--border-dim, #e2e8f0)',
            padding: 24,
          }}
        >
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
            <Info size={13} />
            Clique em um elemento para ver seus detalhes
          </div>
          {modoRastreabilidade && (
            <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: '#ede9fe', fontSize: 11, color: '#5b21b6' }}>
              Modo Rastreabilidade: elementos coloridos pelo caminhão que os lançou (campo "Elemento Lançado" do caminhão)
            </div>
          )}
          <CroquiSvg
            elementos={croqui.elementos}
            selecionado={selecionado}
            onSelect={setSelecionado}
            elementoColors={elementoColors}
          />
        </div>

        {/* Painel lateral */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Resumo */}
          <div
            style={{
              background: 'var(--bg-surface, #fff)',
              borderRadius: 12,
              border: '1px solid var(--border-dim, #e2e8f0)',
              padding: 18,
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-high, #0f172a)' }}>
              Resumo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <StatRow label="Total de elementos" value={String(croqui.elementos.elementos.length)} />
              <StatRow
                label="Painéis de laje"
                value={String(croqui.elementos.elementos.filter((e) => e.tipo === 'painel_laje').length)}
              />
              <StatRow
                label="Pilares"
                value={String(croqui.elementos.elementos.filter((e) => e.tipo === 'pilar').length)}
              />
              <StatRow
                label="Vigas"
                value={String(croqui.elementos.elementos.filter((e) => e.tipo === 'viga').length)}
              />
              <StatRow
                label="Eixos X"
                value={croqui.elementos.eixos_x.join(', ') || '—'}
              />
              <StatRow
                label="Eixos Y"
                value={croqui.elementos.eixos_y.join(', ') || '—'}
              />
            </div>
          </div>

          {/* Detalhe do elemento selecionado */}
          {elementoSelecionado ? (
            <div
              style={{
                background: 'var(--bg-surface, #fff)',
                borderRadius: 12,
                border: '1.5px solid #6366f1',
                padding: 18,
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#6366f1' }}>
                Elemento: {elementoSelecionado.label}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <StatRow label="Tipo" value={TIPO_LABELS[elementoSelecionado.tipo]} />
                <StatRow label="ID" value={elementoSelecionado.id} />
                <StatRow label="Posição" value={`Col ${elementoSelecionado.col}, Row ${elementoSelecionado.row}`} />
                <StatRow
                  label="Tamanho"
                  value={`${elementoSelecionado.colspan}×${elementoSelecionado.rowspan} célula${elementoSelecionado.colspan * elementoSelecionado.rowspan !== 1 ? 's' : ''}`}
                />
              </div>
              <button
                type="button"
                onClick={() => setSelecionado(null)}
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: '#94a3b8',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Desselecionar
              </button>
            </div>
          ) : (
            <div
              style={{
                borderRadius: 12,
                border: '1px dashed var(--border-dim, #e2e8f0)',
                padding: 18,
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: 12,
              }}
            >
              Selecione um elemento no croqui para ver seus detalhes
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--text-high, #0f172a)' }}>{value}</span>
    </div>
  );
}
