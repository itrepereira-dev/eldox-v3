// frontend-web/src/modules/semaforo/pages/SemaforoPage.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { semaforoService, type CorSemaforo, type ModuloDetalhes, type NcsDetalhes } from '../../../services/semaforo.service';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

// ─── Helpers visuais ─────────────────────────────────────────────────────────

const COR_CONFIG: Record<CorSemaforo, { label: string; hex: string; bg: string; border: string; Icon: typeof CheckCircle2 }> = {
  verde:     { label: 'Conforme',       hex: '#22c55e', bg: 'rgba(34,197,94,.10)',  border: 'rgba(34,197,94,.35)',  Icon: CheckCircle2  },
  amarelo:   { label: 'Atenção',        hex: '#f59e0b', bg: 'rgba(245,158,11,.10)', border: 'rgba(245,158,11,.35)', Icon: AlertTriangle },
  vermelho:  { label: 'Não Conforme',   hex: '#ef4444', bg: 'rgba(239,68,68,.10)',  border: 'rgba(239,68,68,.35)',  Icon: XCircle       },
};

const PESOS: Record<string, number> = { fvs: 30, fvm: 25, ensaios: 25, ncs: 20 };

const MODULO_LABEL: Record<string, string> = {
  fvs:     'FVS — Fichas de Verificação de Serviço',
  fvm:     'FVM — Fichas de Verificação de Materiais',
  ensaios: 'Ensaios Laboratoriais',
  ncs:     'Não Conformidades (NCs)',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function SemaforoPage() {
  const { id } = useParams<{ id: string }>();
  const obraId = parseInt(id!);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['semaforo', obraId],
    queryFn:  () => semaforoService.getObra(obraId),
    staleTime: 30_000,
    enabled:   !!obraId,
  });

  const recalcularMutation = useMutation({
    mutationFn: () => semaforoService.recalcular(obraId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['semaforo', obraId] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-sm text-[var(--text-faint)]">Calculando semáforo...</div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-sm text-red-400">Erro ao carregar semáforo. Tente novamente.</div>
      </div>
    );
  }

  const semaforo = data.data;
  const cfg      = COR_CONFIG[semaforo.cor];
  const { Icon } = cfg;

  const scorePct = Math.round(semaforo.score * 10000) / 100; // 0.00–100.00

  return (
    <div className="p-6" style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-high)] m-0">
            Semáforo PBQP-H
          </h1>
          <p className="text-xs text-[var(--text-faint)] mt-0.5">
            Indicador de conformidade composto — atualizado automaticamente a cada hora
          </p>
        </div>
        <button
          onClick={() => recalcularMutation.mutate()}
          disabled={recalcularMutation.isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--border-dim)] text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={13} className={recalcularMutation.isPending ? 'animate-spin' : ''} />
          {recalcularMutation.isPending ? 'Recalculando...' : 'Recalcular agora'}
        </button>
      </div>

      {/* ── Card principal — indicador global ────────────────────────── */}
      <div
        className="rounded-2xl border p-8 mb-6 flex items-center gap-8"
        style={{ background: cfg.bg, borderColor: cfg.border }}
      >
        {/* Círculo colorido */}
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{
            width: 96,
            height: 96,
            background: cfg.hex,
            boxShadow: `0 0 32px ${cfg.hex}66`,
          }}
        >
          <Icon size={44} color="#fff" strokeWidth={1.8} />
        </div>

        {/* Score e rótulo */}
        <div className="flex-1 min-w-0">
          <div className="text-4xl font-extrabold leading-none" style={{ color: cfg.hex }}>
            {scorePct.toFixed(1)}<span className="text-2xl font-semibold">%</span>
          </div>
          <div className="text-lg font-semibold mt-1" style={{ color: cfg.hex }}>
            {cfg.label}
          </div>
          <div className="text-xs text-[var(--text-faint)] mt-2">
            Calculado em {new Date(semaforo.calculadoEm).toLocaleString('pt-BR')} ·{' '}
            expira em {new Date(semaforo.expiradoEm).toLocaleString('pt-BR')}
          </div>
        </div>

        {/* Barra de score */}
        <div className="flex-shrink-0 w-40 hidden sm:block">
          <div className="text-[10px] font-semibold text-[var(--text-faint)] mb-1.5 text-right">
            Score global
          </div>
          <div className="h-3 rounded-full bg-[var(--bg-hover)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${scorePct}%`, background: cfg.hex }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-[var(--text-faint)]">
            <span>0%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* ── Breakdown por módulo ───────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(['fvs', 'fvm', 'ensaios'] as const).map(modulo => (
          <ModuloCard
            key={modulo}
            modulo={modulo}
            label={MODULO_LABEL[modulo]}
            peso={PESOS[modulo]}
            detalhes={semaforo.breakdown[modulo] as ModuloDetalhes}
          />
        ))}

        {/* Card especial para NCS */}
        <NcsCard
          label={MODULO_LABEL['ncs']}
          peso={PESOS['ncs']}
          detalhes={semaforo.breakdown.ncs}
        />
      </div>

      {/* ── Legenda de pesos ──────────────────────────────────────────── */}
      <div className="mt-5 p-4 rounded-xl border border-[var(--border-dim)] bg-[var(--bg-raised)]">
        <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-2">
          Composição do indicador
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(PESOS).map(([mod, peso]) => (
            <div key={mod} className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
              <span className="font-semibold text-[var(--text-high)]">{MODULO_LABEL[mod].split(' — ')[0]}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-mid)' }}>
                {peso}%
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-faint)] mt-2">
          Score &ge; 85% = Verde &nbsp;|&nbsp; 60–84% = Amarelo &nbsp;|&nbsp; &lt; 60% = Vermelho
        </p>
      </div>
    </div>
  );
}

// ─── Card de módulo numérico ─────────────────────────────────────────────────

function ModuloCard({ modulo: _modulo, label, peso, detalhes }: {
  modulo: string;
  label: string;
  peso: number;
  detalhes: ModuloDetalhes;
}) {
  const cor: CorSemaforo = detalhes.score_pct >= 85 ? 'verde' : detalhes.score_pct >= 60 ? 'amarelo' : 'vermelho';
  const cfg = COR_CONFIG[cor];
  const { Icon } = cfg;

  return (
    <div className="rounded-xl border border-[var(--border-dim)] p-4 bg-[var(--bg-raised)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">
            {label.split(' — ')[0]}
          </div>
          <div className="text-xs text-[var(--text-faint)] mt-0.5 truncate">{label.split(' — ')[1]}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Icon size={14} style={{ color: cfg.hex }} />
          <span className="text-[11px] font-bold" style={{ color: cfg.hex }}>
            {detalhes.score_pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${detalhes.score_pct}%`, background: cfg.hex }}
        />
      </div>

      {/* Números */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MetaNum label="Total" value={detalhes.total} />
        <MetaNum label="Conformes" value={detalhes.conformes} color="#22c55e" />
        <MetaNum label="Não conf." value={detalhes.nao_conformes} color={detalhes.nao_conformes > 0 ? '#ef4444' : undefined} />
      </div>

      {detalhes.total === 0 && (
        <p className="text-[10px] text-[var(--text-faint)] mt-2 text-center">
          Sem registros — score neutro (100%)
        </p>
      )}

      <div className="text-[10px] text-[var(--text-faint)] mt-2.5 text-right">
        peso: {peso}%
      </div>
    </div>
  );
}

// ─── Card especial para NCs ──────────────────────────────────────────────────

function NcsCard({ label, peso, detalhes }: {
  label: string;
  peso: number;
  detalhes: NcsDetalhes;
}) {
  const penalidadePct = detalhes.penalidade_pct;
  const ncsScore      = 100 - penalidadePct;
  const cor: CorSemaforo = ncsScore >= 85 ? 'verde' : ncsScore >= 60 ? 'amarelo' : 'vermelho';
  const cfg = COR_CONFIG[cor];
  const { Icon } = cfg;

  return (
    <div className="rounded-xl border border-[var(--border-dim)] p-4 bg-[var(--bg-raised)]">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide">
            {label.split(' — ')[0]}
          </div>
          <div className="text-xs text-[var(--text-faint)] mt-0.5">{label.split(' — ')[1]}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Icon size={14} style={{ color: cfg.hex }} />
          <span className="text-[11px] font-bold" style={{ color: cfg.hex }}>
            {ncsScore.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${ncsScore}%`, background: cfg.hex }}
        />
      </div>

      {/* Números */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <MetaNum label="Abertas" value={detalhes.total_abertas} color={detalhes.total_abertas > 0 ? '#f59e0b' : undefined} />
        <MetaNum label="> 7 dias" value={detalhes.abertas_mais_7_dias} color={detalhes.abertas_mais_7_dias > 0 ? '#ef4444' : undefined} />
        <MetaNum label="Penalidade" value={`-${penalidadePct}%`} color={penalidadePct > 0 ? '#ef4444' : undefined} />
      </div>

      <p className="text-[10px] text-[var(--text-faint)] mt-2">
        Cada NC aberta &gt; 7 dias subtrai 10 pontos (máx. 100)
      </p>

      <div className="text-[10px] text-[var(--text-faint)] mt-1.5 text-right">
        peso: {peso}%
      </div>
    </div>
  );
}

// ─── Bloco de métrica pequena ─────────────────────────────────────────────────

function MetaNum({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--text-faint)] mb-0.5">{label}</div>
      <div className="text-sm font-bold" style={{ color: color ?? 'var(--text-high)' }}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </div>
    </div>
  );
}

export default SemaforoPage;
