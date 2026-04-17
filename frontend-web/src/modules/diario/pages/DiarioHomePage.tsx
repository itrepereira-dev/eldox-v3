import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { obrasService, type Obra } from '../../../services/obras.service';
import { rdoService } from '../../../services/rdo.service';
import { Search, BookOpenCheck, MapPin, ChevronRight, Plus, X, FilePlus2 } from 'lucide-react';

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

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ── Modal de criação rápida de RDO ─────────────────────────────────────────
interface NovoRdoRapidoModalProps {
  obras: Obra[];
  obraIdInicial?: number;
  onClose: () => void;
  onCreated: (obraId: number, rdoId: number) => void;
}

function NovoRdoRapidoModal({ obras, obraIdInicial, onClose, onCreated }: NovoRdoRapidoModalProps) {
  const [obraId, setObraId] = useState<number | ''>(obraIdInicial ?? (obras.length === 1 ? obras[0].id : ''));
  const [data, setData] = useState(todayISO());
  const [copiarUltimo, setCopiarUltimo] = useState(true);
  const [err, setErr] = useState('');

  const { mutate: criar, isPending } = useMutation({
    mutationFn: () => rdoService.criar({
      obra_id: Number(obraId),
      data,
      copiar_ultimo: copiarUltimo,
    }),
    onSuccess: (res) => onCreated(Number(obraId), res.rdo_id),
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? 'Erro ao criar RDO. Tente novamente.');
    },
  });

  const obraSelecionada = obras.find(o => o.id === Number(obraId));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          padding: '28px 32px',
          width: 440,
          display: 'flex', flexDirection: 'column', gap: 18,
          boxShadow: '0 20px 60px rgba(0,0,0,.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FilePlus2 size={18} color="var(--accent)" />
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-high)' }}>
              Novo Diário de Obra
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', color: 'var(--text-low)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Obra */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Obra
          </label>
          <select
            value={obraId}
            onChange={e => setObraId(Number(e.target.value) || '')}
            disabled={obras.length === 1}
            style={{
              padding: '10px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              color: 'var(--text-high)',
              fontSize: 14, fontFamily: 'var(--font-ui)',
              outline: 'none',
              cursor: obras.length === 1 ? 'not-allowed' : 'pointer',
              opacity: obras.length === 1 ? .7 : 1,
            }}
          >
            {obras.length !== 1 && <option value="">— selecione uma obra —</option>}
            {obras.map(o => (
              <option key={o.id} value={o.id}>
                {o.codigo ? `${o.codigo} · ` : ''}{o.nome}
              </option>
            ))}
          </select>
          {obraSelecionada?.cidade && (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={11} /> {obraSelecionada.cidade}{obraSelecionada.estado ? `/${obraSelecionada.estado}` : ''}
            </p>
          )}
        </div>

        {/* Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Data
          </label>
          <input
            type="date"
            value={data}
            onChange={e => setData(e.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-raised)',
              color: 'var(--text-high)',
              fontSize: 14, fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
        </div>

        {/* Toggle "copiar último" */}
        <label
          style={{
            display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
            padding: '10px 14px', borderRadius: 'var(--r-sm)',
            background: copiarUltimo ? 'var(--accent-dim)' : 'var(--bg-raised)',
            border: `1px solid ${copiarUltimo ? 'var(--accent)' : 'var(--border-dim)'}`,
            transition: 'all .15s',
          }}
        >
          <input
            type="checkbox"
            checked={copiarUltimo}
            onChange={e => setCopiarUltimo(e.target.checked)}
            style={{ accentColor: 'var(--accent)', width: 16, height: 16 }}
          />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-high)' }}>
              Copiar último RDO
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-low)' }}>
              Reaproveita clima, efetivo e atividades do diário anterior.
            </p>
          </div>
        </label>

        {/* Erro */}
        {err && (
          <p style={{
            margin: 0, fontSize: 13, color: 'var(--nc)',
            background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.25)',
            padding: '8px 12px', borderRadius: 'var(--r-sm)',
          }}>
            {err}
          </p>
        )}

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '9px 18px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-high)', fontSize: 13, cursor: 'pointer',
              opacity: isPending ? .5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { setErr(''); criar(); }}
            disabled={isPending || !obraId || !data}
            style={{
              padding: '9px 24px', borderRadius: 'var(--r-sm)',
              border: '1px solid transparent', background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: isPending || !obraId || !data ? 'not-allowed' : 'pointer',
              opacity: isPending || !obraId || !data ? .7 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isPending ? 'Criando...' : (<><Plus size={14} /> Criar RDO</>)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Home ────────────────────────────────────────────────────────────────────
export function DiarioHomePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [obraIdPreselect, setObraIdPreselect] = useState<number | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['obras-diario', statusFiltro],
    queryFn: () => obrasService.getAll({ status: statusFiltro || undefined, page: 1, limit: 100 }),
  });

  const obras: Obra[] = (() => {
    const lista: Obra[] = Array.isArray(data) ? data : ((data as { items?: Obra[] } | undefined)?.items ?? []);
    return lista.filter((o: Obra) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return o.nome.toLowerCase().includes(q) || o.codigo?.toLowerCase().includes(q) || o.cidade?.toLowerCase().includes(q);
    });
  })();

  const statusOpcoes = ['', 'EM_EXECUCAO', 'PLANEJAMENTO', 'PARALISADA', 'CONCLUIDA', 'ENTREGUE'];

  function abrirNovoRdo(obraId?: number) {
    setObraIdPreselect(obraId);
    setShowNovoModal(true);
  }

  function onRdoCreated(obraId: number, rdoId: number) {
    setShowNovoModal(false);
    navigate(`/obras/${obraId}/diario/${rdoId}`);
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header com CTA "Novo RDO" */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <BookOpenCheck size={22} color="var(--accent)" />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-high)', margin: 0 }}>
              Diário de Obras
            </h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-low)', margin: 0 }}>
            Acesse o diário de uma obra ou crie um novo RDO diretamente.
          </p>
        </div>

        <button
          onClick={() => abrirNovoRdo()}
          disabled={obras.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--r-md)',
            background: 'var(--accent)', border: '1px solid transparent',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: obras.length === 0 ? 'not-allowed' : 'pointer',
            opacity: obras.length === 0 ? .5 : 1,
            boxShadow: '0 2px 8px rgba(88,166,255,.25)',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={e => { if (obras.length > 0) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(88,166,255,.35)'; } }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(88,166,255,.25)'; }}
        >
          <Plus size={15} />
          Novo RDO
        </button>
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
          <p style={{ fontSize: 12, margin: '6px 0 0' }}>Cadastre uma obra primeiro para começar a preencher diários.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {obras.map(obra => (
            <div
              key={obra.id}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-dim)',
                borderRadius: 'var(--r-md)', padding: '18px 20px',
                transition: 'border-color .15s, background .15s',
                display: 'flex', flexDirection: 'column', gap: 10,
                position: 'relative',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-raised)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-dim)';
                (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface)';
              }}
            >
              {/* Linha 1: nome clicável + botão "Novo" à direita */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <button
                  onClick={() => navigate(`/obras/${obra.id}/diario`)}
                  style={{
                    flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', color: 'inherit',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-high)', lineHeight: 1.3 }}>
                    {obra.nome}
                  </span>
                  <ChevronRight size={16} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 1 }} />
                </button>
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

              {/* Linha 3: status badge + ação rápida */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: STATUS_BG[obra.status] ?? 'var(--bg-hover)',
                  color: STATUS_COLOR[obra.status] ?? 'var(--text-low)',
                }}>
                  {STATUS_LABEL[obra.status] ?? obra.status}
                </span>

                <button
                  onClick={() => abrirNovoRdo(obra.id)}
                  title="Criar novo RDO para esta obra"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-raised)', border: '1px solid var(--border-dim)',
                    color: 'var(--accent)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background .15s, border-color .15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-dim)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-dim)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)';
                  }}
                >
                  <Plus size={11} />
                  Novo RDO
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação rápida */}
      {showNovoModal && (
        <NovoRdoRapidoModal
          obras={obras}
          obraIdInicial={obraIdPreselect}
          onClose={() => setShowNovoModal(false)}
          onCreated={onRdoCreated}
        />
      )}
    </div>
  );
}
