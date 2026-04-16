import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { obrasService, type Obra } from '../../../services/obras.service';
import { Search, BookOpenCheck, MapPin, ChevronRight } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_EXECUCAO:  'Em Execução',
  PARALISADA:   'Paralisada',
  CONCLUIDA:    'Concluída',
  ENTREGUE:     'Entregue',
};

const STATUS_COLOR: Record<string, string> = {
  PLANEJAMENTO: 'var(--text-low)',
  EM_EXECUCAO:  'var(--ok)',
  PARALISADA:   'var(--warn)',
  CONCLUIDA:    '#a78bfa',
  ENTREGUE:     'var(--run)',
};

const STATUS_BG: Record<string, string> = {
  PLANEJAMENTO: 'rgba(107,114,128,0.1)',
  EM_EXECUCAO:  'rgba(63,185,80,0.1)',
  PARALISADA:   'rgba(210,153,34,0.1)',
  CONCLUIDA:    'rgba(167,139,250,0.1)',
  ENTREGUE:     'rgba(88,166,255,0.1)',
};

export function DiarioHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['obras-diario', statusFiltro],
    queryFn: () => obrasService.getAll({ status: statusFiltro || undefined, page: 1, limit: 100 }),
  });

  const obras: Obra[] = (data?.items ?? []).filter((o: Obra) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.nome.toLowerCase().includes(q) || o.codigo?.toLowerCase().includes(q) || o.cidade?.toLowerCase().includes(q);
  });

  const statusOpcoes = ['', 'EM_EXECUCAO', 'PLANEJAMENTO', 'PARALISADA', 'CONCLUIDA', 'ENTREGUE'];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <BookOpenCheck size={22} color="var(--accent)" />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-high)', margin: 0 }}>
            Diário de Obras
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-low)', margin: 0 }}>
          Selecione uma obra para acessar o diário de campo.
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={14} color="var(--text-faint)"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar obra..."
            style={{
              width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
              fontSize: 13, fontFamily: 'var(--font-ui)', color: 'var(--text-mid)',
              background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
              borderRadius: 'var(--r-sm)', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusOpcoes.map(s => (
            <button
              key={s || 'todos'}
              onClick={() => setStatusFiltro(s)}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600,
                fontFamily: 'var(--font-ui)', borderRadius: 20, cursor: 'pointer',
                border: '1px solid',
                borderColor: statusFiltro === s ? 'var(--accent)' : 'var(--border-dim)',
                background: statusFiltro === s ? 'var(--accent-dim)' : 'var(--bg-raised)',
                color: statusFiltro === s ? 'var(--accent)' : 'var(--text-low)',
                transition: 'all .15s',
              }}
            >
              {s ? STATUS_LABEL[s] : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de obras */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: 110, background: 'var(--bg-surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-dim)', opacity: 0.5 }} />
          ))}
        </div>
      ) : obras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-faint)' }}>
          <BookOpenCheck size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>Nenhuma obra encontrada.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {obras.map(obra => (
            <button
              key={obra.id}
              onClick={() => navigate(`/obras/${obra.id}/diario`)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r-md)', padding: '18px 20px',
                cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, background .15s',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-dim)';
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface)';
              }}
            >
              {/* Linha 1: nome + seta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-high)', lineHeight: 1.3 }}>
                  {obra.nome}
                </span>
                <ChevronRight size={16} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 1 }} />
              </div>

              {/* Linha 2: código + localização */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                  {obra.codigo}
                </span>
                {obra.cidade && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-faint)' }}>
                    <MapPin size={11} />
                    {obra.cidade}{obra.estado ? `/${obra.estado}` : ''}
                  </span>
                )}
              </div>

              {/* Linha 3: status badge */}
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: STATUS_BG[obra.status] ?? 'var(--bg-hover)',
                  color: STATUS_COLOR[obra.status] ?? 'var(--text-low)',
                }}>
                  {STATUS_LABEL[obra.status] ?? obra.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
