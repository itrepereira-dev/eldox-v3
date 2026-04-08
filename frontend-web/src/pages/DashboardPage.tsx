import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, FolderOpen, ArrowRight } from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard';
import { useAuthStore } from '../store/auth.store';
import { obrasService } from '../services/obras.service';
import { gedService } from '../services/ged.service';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: obrasData } = useQuery({
    queryKey: ['obras-dashboard'],
    queryFn: () => obrasService.getAll({ limit: 100 }),
  });

  const obras = obrasData?.items ?? [];
  const obrasAtivas = obras.filter((o) => o.status === 'EM_EXECUCAO').length;
  const obrasTotal = obras.length;

  // Usamos a primeira obra ativa para stats do GED, se existir
  const primeiraObraAtiva = obras.find((o) => o.status === 'EM_EXECUCAO');
  const { data: gedStats } = useQuery({
    queryKey: ['ged-stats-dashboard', primeiraObraAtiva?.id],
    queryFn: () => gedService.getStats(primeiraObraAtiva!.id),
    enabled: !!primeiraObraAtiva,
  });

  const primeiroNome = user?.nome?.split(' ')[0] ?? 'Usuário';

  return (
    <div>
      {/* Boas-vindas */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-100)', marginBottom: '4px' }}>
          Olá, {primeiroNome}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-60)' }}>
          Bem-vindo ao Eldox v3 — Gestão de Obras e Documentos
        </p>
      </div>

      {/* KPIs */}
      <KpiGrid cols={3} className="mb-8">
        <KpiCard
          label="Obras Cadastradas"
          value={obrasTotal}
          sub={`${obrasAtivas} em execução`}
          variant="run"
          icon={<Layers size={16} />}
        />
        <KpiCard
          label="Documentos Vigentes"
          value={gedStats?.vigentes ?? '—'}
          sub={primeiraObraAtiva ? primeiraObraAtiva.nome : 'Nenhuma obra ativa'}
          variant="accent"
          icon={<FolderOpen size={16} />}
        />
        <KpiCard
          label="Vencendo em 30 dias"
          value={gedStats?.vencendo30dias ?? '—'}
          sub="Documentos a revisar"
          variant={gedStats && gedStats.vencendo30dias > 0 ? 'warn' : 'ok'}
          icon={<FolderOpen size={16} />}
        />
      </KpiGrid>

      {/* Acesso rápido */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-40)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
          Acesso rápido
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          <QuickCard
            title="Obras"
            description="Gerencie as obras e locais de trabalho"
            onClick={() => navigate('/obras')}
          />
          <QuickCard
            title="GED Administrativo"
            description="Documentos e categorias em nível de empresa"
            onClick={() => navigate('/ged/admin')}
          />
          {primeiraObraAtiva && (
            <QuickCard
              title={`GED — ${primeiraObraAtiva.nome}`}
              description="Documentos vigentes desta obra"
              onClick={() => navigate(`/obras/${primeiraObraAtiva.id}/ged`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function QuickCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)';
      }}
    >
      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-100)', marginBottom: '4px' }}>{title}</p>
        <p style={{ fontSize: '12px', color: 'var(--text-60)' }}>{description}</p>
      </div>
      <ArrowRight size={16} style={{ color: 'var(--text-40)', flexShrink: 0 }} />
    </button>
  );
}
