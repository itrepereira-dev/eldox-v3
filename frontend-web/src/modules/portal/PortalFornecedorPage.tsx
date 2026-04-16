// frontend-web/src/modules/portal/PortalFornecedorPage.tsx
// Página pública para concreteiras visualizarem programações — acesso via link com token
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Building2, Truck, Clock, FlaskConical, AlertTriangle, CheckCircle } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface CaminhaoPortal {
  sequencia: number;
  numero_nf: string;
  volume: number;
  status: string;
  hora_chegada: string | null;
  hora_inicio_lancamento: string | null;
  hora_fim_lancamento: string | null;
  elemento_lancado: string | null;
}

interface BetonadaPortal {
  numero: string;
  obra_nome: string;
  elemento_estrutural: string;
  data_programada: string;
  hora_programada: string | null;
  volume_previsto: number;
  fck_especificado: number;
  traco_especificado: string | null;
  bombeado: boolean;
  intervalo_min_caminhoes: number | null;
  status: string;
  fornecedor_nome: string | null;
  caminhoes: CaminhaoPortal[];
}

// ── Status map ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PROGRAMADA:      'Programada',
  EM_LANCAMENTO:   'Em Lançamento',
  CONCLUIDA:       'Concluída',
  CANCELADA:       'Cancelada',
  LIBERADO:        'Liberada para Carregamento',
};

const CAM_STATUS_LABEL: Record<string, string> = {
  CONCLUIDO:     'Concluído',
  EM_LANCAMENTO: 'Em Lançamento',
  AGUARDANDO:    'Aguardando',
  REJEITADO:     'Rejeitado',
};

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchPortal(token: string): Promise<BetonadaPortal> {
  const r = await api.get<{ status: string; data: BetonadaPortal }>(
    `/portal/betonada?token=${encodeURIComponent(token)}`,
  );
  return r.data.data;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PortalFornecedorPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['portal-fornecedor', token],
    queryFn: () => fetchPortal(token),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="mx-auto mb-3 text-[var(--warn-text)]" />
          <h1 className="text-lg font-semibold text-[var(--text-high)] m-0">Link Inválido</h1>
          <p className="text-sm text-[var(--text-faint)] mt-2 m-0">
            Este link não contém um token de acesso. Verifique o e-mail recebido.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-faint)]">Carregando programação…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    const msg = (error as any)?.response?.data?.message ?? 'Link inválido ou expirado.';
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={32} className="mx-auto mb-3 text-[var(--nc-text)]" />
          <h1 className="text-lg font-semibold text-[var(--text-high)] m-0">Acesso Expirado</h1>
          <p className="text-sm text-[var(--text-faint)] mt-2 m-0">{msg}</p>
        </div>
      </div>
    );
  }

  const volumeRealizado = data.caminhoes.reduce((s, c) => s + c.volume, 0);
  const pctRealizado = data.volume_previsto > 0
    ? Math.round((volumeRealizado / data.volume_previsto) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Header banner */}
      <div className="bg-[var(--accent)] text-white px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Building2 size={22} />
          <div>
            <p className="text-sm font-bold m-0">Portal Eldox — Concreteira</p>
            <p className="text-xs opacity-80 m-0">{data.fornecedor_nome ?? 'Fornecedor'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">

        {/* Status badge */}
        <div className="flex items-center gap-2">
          {data.status === 'CONCLUIDA' && <CheckCircle size={16} className="text-[var(--ok-text)]" />}
          {data.status === 'CANCELADA' && <AlertTriangle size={16} className="text-[var(--nc-text)]" />}
          <span className="text-sm font-semibold" style={{
            color: data.status === 'CONCLUIDA' ? 'var(--ok-text)'
              : data.status === 'CANCELADA' ? 'var(--nc-text)'
              : 'var(--accent)',
          }}>
            {STATUS_LABEL[data.status] ?? data.status}
          </span>
        </div>

        {/* Programação card */}
        <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-high)] m-0">{data.numero}</h1>
              <p className="text-sm text-[var(--text-faint)] m-0 mt-0.5">{data.obra_nome}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <p className="text-xs text-[var(--text-faint)] m-0">Elemento</p>
              <p className="font-medium text-[var(--text-high)] m-0">{data.elemento_estrutural}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)] m-0">Data Programada</p>
              <p className="font-medium text-[var(--text-high)] m-0">
                {new Date(data.data_programada).toLocaleDateString('pt-BR')}
                {data.hora_programada ? ` às ${data.hora_programada}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)] m-0">Volume Previsto</p>
              <p className="font-medium text-[var(--text-high)] m-0">{data.volume_previsto} m³</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-faint)] m-0">FCK / Traço</p>
              <p className="font-medium text-[var(--text-high)] m-0">
                {data.fck_especificado} MPa{data.traco_especificado ? ` · ${data.traco_especificado}` : ''}
              </p>
            </div>
            {data.bombeado && (
              <div>
                <p className="text-xs text-[var(--text-faint)] m-0">Método</p>
                <p className="font-medium text-[var(--text-high)] m-0">Bombeado</p>
              </div>
            )}
            {data.intervalo_min_caminhoes && (
              <div>
                <p className="text-xs text-[var(--text-faint)] m-0">Intervalo mín. caminhões</p>
                <p className="font-medium text-[var(--text-high)] m-0">{data.intervalo_min_caminhoes} min</p>
              </div>
            )}
          </div>
        </div>

        {/* Progresso */}
        {data.caminhoes.length > 0 && (
          <div className="rounded-xl border border-[var(--border-dim)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2 m-0">
              <FlaskConical size={14} className="text-[var(--accent)]" />
              Progresso do Lançamento
            </h2>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-raised)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.min(pctRealizado, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-[var(--text-high)] tabular-nums">
                {pctRealizado}%
              </span>
            </div>
            <p className="text-xs text-[var(--text-faint)] m-0">
              {volumeRealizado.toFixed(1)} m³ de {data.volume_previsto} m³ lançados · {data.caminhoes.length} caminhão(ões)
            </p>
          </div>
        )}

        {/* Caminhões */}
        {data.caminhoes.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-high)] mb-3 flex items-center gap-2">
              <Truck size={14} className="text-[var(--accent)]" />
              Caminhões Lançados
            </h2>
            <div className="flex flex-col gap-2">
              {data.caminhoes.map((cam) => (
                <div key={cam.sequencia} className="rounded-lg border border-[var(--border-dim)] bg-[var(--bg-surface)] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--bg-raised)] text-[var(--text-faint)]">
                        #{cam.sequencia}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-high)]">NF {cam.numero_nf}</span>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{
                      background: cam.status === 'CONCLUIDO' ? 'var(--ok-bg)' : 'var(--bg-raised)',
                      color: cam.status === 'CONCLUIDO' ? 'var(--ok-text)' : 'var(--text-faint)',
                      borderColor: cam.status === 'CONCLUIDO' ? 'var(--ok-border)' : 'var(--border-dim)',
                    }}>
                      {CAM_STATUS_LABEL[cam.status] ?? cam.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
                    <span>{cam.volume} m³</span>
                    {cam.elemento_lancado && <span>Peça: {cam.elemento_lancado}</span>}
                    {cam.hora_chegada && (
                      <span className="flex items-center gap-0.5">
                        <Clock size={10} /> Chegada: {cam.hora_chegada}
                      </span>
                    )}
                    {cam.hora_inicio_lancamento && <span>Início: {cam.hora_inicio_lancamento}</span>}
                    {cam.hora_fim_lancamento && <span>Fim: {cam.hora_fim_lancamento}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-[var(--text-faint)] m-0">
            Portal de acesso exclusivo para a concreteira · Sistema Eldox
          </p>
          <p className="text-xs text-[var(--text-faint)] m-0 mt-1">
            Este link é válido por 30 dias a partir do envio
          </p>
        </div>

      </div>
    </div>
  );
}
