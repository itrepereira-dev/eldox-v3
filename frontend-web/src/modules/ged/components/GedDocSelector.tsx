// frontend-web/src/modules/ged/components/GedDocSelector.tsx
// Seletor de documento do GED reutilizável — usado por RDO, NC, FVS, Transmittals etc
// para apontar evidências/referências para versões de documento existentes.
//
// Contrato:
//   value: versaoId atualmente selecionada (null = nenhum)
//   onChange(versaoId, info?): dispara com a nova versão + metadados do documento
//   filtroStatus: quais status aceitar no dropdown (default: só VIGENTES — IFC/IFP/AS_BUILT)
//
// Busca: gedService.listar(obraId, { status, q, limit: 20 }) com debounce de 300 ms.
// A API aceita apenas UM `status` por chamada — então quando há múltiplos filtros,
// fazemos queries em paralelo e concatenamos os resultados (deduplicando por id).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Search, X, Loader2 } from 'lucide-react';
import {
  gedService,
  type GedDocumento,
  type GedStatus,
} from '../../../services/ged.service';

// Status considerados "vigentes" (PBQP-H) — documento válido para ser referenciado
const STATUS_VIGENTES: GedStatus[] = ['IFC', 'IFP', 'AS_BUILT'];

export interface GedDocSelectorInfo {
  titulo: string;
  codigo: string;
  numeroRevisao: string;
}

export interface GedDocSelectorProps {
  obraId: number;
  /** versaoId selecionada. null/undefined = nenhum */
  value?: number | null;
  /** Callback ao selecionar ou limpar */
  onChange: (versaoId: number | null, info?: GedDocSelectorInfo) => void;
  /** Filtros de status. Default: só vigentes (IFC/IFP/AS_BUILT) */
  filtroStatus?: GedStatus[];
  /** Placeholder do input de busca */
  placeholder?: string;
  /** Desabilita o controle */
  disabled?: boolean;
  /** Largura do componente (px ou %). Default: 100% */
  width?: number | string;
}

export function GedDocSelector({
  obraId,
  value,
  onChange,
  filtroStatus = STATUS_VIGENTES,
  placeholder = 'Buscar documento por título ou código...',
  disabled = false,
  width = '100%',
}: GedDocSelectorProps) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<GedDocumento[]>([]);
  const [loading, setLoading] = useState(false);
  const [selecionado, setSelecionado] = useState<GedDocSelectorInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoiza o array para ser usado como dependency sem piscar
  const statusKey = useMemo(() => filtroStatus.join(','), [filtroStatus]);

  // Busca info do documento atualmente selecionado (quando `value` vem do parent)
  useEffect(() => {
    let cancelado = false;
    if (!value) {
      setSelecionado(null);
      return;
    }
    // Se já temos o info e bate com o value atual, não refaz
    (async () => {
      try {
        const versao = await gedService.getVersaoDetalhe(value);
        if (cancelado) return;
        setSelecionado({
          titulo: versao.titulo || `Versão #${value}`,
          codigo: versao.codigo ?? '',
          numeroRevisao: versao.numeroRevisao ?? '',
        });
      } catch {
        if (!cancelado) setSelecionado({ titulo: `Versão #${value}`, codigo: '', numeroRevisao: '' });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [value]);

  // Debounce da busca
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // API aceita 1 status por chamada — paraleliza se múltiplos
        const statusList = filtroStatus.length > 0 ? filtroStatus : [undefined];
        const respostas = await Promise.all(
          statusList.map((st) =>
            gedService.listar(obraId, {
              status: st,
              q: busca || undefined,
              limit: 20,
            }),
          ),
        );
        if (cancelado) return;
        const map = new Map<number, GedDocumento>();
        for (const r of respostas) {
          for (const doc of r.items) {
            if (!map.has(doc.id)) map.set(doc.id, doc);
          }
        }
        setResultados(Array.from(map.values()).slice(0, 20));
      } catch (err) {
        if (!cancelado) {
          console.error('Falha ao buscar documentos do GED:', err);
          setResultados([]);
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [busca, aberto, obraId, statusKey, filtroStatus]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener('mousedown', onClickFora);
    return () => document.removeEventListener('mousedown', onClickFora);
  }, [aberto]);

  function handleSelecionar(doc: GedDocumento) {
    const versao = doc.versaoAtual;
    const info: GedDocSelectorInfo = {
      titulo: doc.titulo,
      codigo: doc.codigo,
      numeroRevisao: versao?.numeroRevisao ?? '',
    };
    setSelecionado(info);
    onChange(versao?.id ?? null, info);
    setBusca('');
    setAberto(false);
  }

  function handleLimpar(e: React.MouseEvent) {
    e.stopPropagation();
    setSelecionado(null);
    onChange(null);
    setBusca('');
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width, fontSize: 13 }}
    >
      {/* Trigger */}
      {selecionado && value ? (
        <div
          onClick={() => !disabled && setAberto((v) => !v)}
          role="button"
          aria-label="Documento do GED selecionado. Clique para alterar."
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setAberto((v) => !v);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <FileText size={15} style={{ color: 'var(--ok, #3fb950)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                color: 'var(--text-high)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selecionado.titulo}
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: 'var(--text-faint)',
                display: 'flex',
                gap: 6,
              }}
            >
              <span>{selecionado.codigo}</span>
              {selecionado.numeroRevisao && <span>· Rev. {selecionado.numeroRevisao}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLimpar}
            disabled={disabled}
            aria-label="Limpar seleção"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-faint)',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
          <ChevronDown size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <Search size={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setAberto(true);
            }}
            onFocus={() => !disabled && setAberto(true)}
            placeholder={placeholder}
            disabled={disabled}
            aria-label="Buscar documento do GED"
            aria-autocomplete="list"
            aria-expanded={aberto}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-high)',
              fontSize: 13,
            }}
          />
          {loading && <Loader2 size={14} className="spin" style={{ color: 'var(--text-faint)' }} />}
        </div>
      )}

      {/* Dropdown */}
      {aberto && !disabled && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            zIndex: 1000,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {loading && resultados.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                color: 'var(--text-faint)',
                fontSize: 12,
              }}
            >
              <Loader2 size={16} className="spin" />
              <div style={{ marginTop: 8 }}>Buscando...</div>
            </div>
          ) : resultados.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                color: 'var(--text-faint)',
                fontSize: 12,
              }}
            >
              {busca ? 'Nenhum documento encontrado.' : 'Digite para buscar.'}
            </div>
          ) : (
            resultados.map((doc) => {
              const versao = doc.versaoAtual;
              return (
                <button
                  type="button"
                  key={doc.id}
                  role="option"
                  aria-selected={value === versao?.id}
                  onClick={() => handleSelecionar(doc)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    width: '100%',
                    padding: '10px 14px',
                    background:
                      value === versao?.id ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-dim, #21262d)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-high)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      value === versao?.id ? 'var(--bg-hover)' : 'transparent';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                    }}
                  >
                    <FileText size={13} style={{ color: 'var(--accent, #58a6ff)', flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {doc.titulo}
                    </span>
                    {versao && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 99,
                          background: 'var(--bg-raised)',
                          color: 'var(--text-mid)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {versao.status}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      fontFamily: 'monospace',
                      fontSize: 11,
                      color: 'var(--text-faint)',
                    }}
                  >
                    <span>{doc.codigo}</span>
                    {versao?.numeroRevisao && <span>· Rev. {versao.numeroRevisao}</span>}
                    {doc.disciplina && <span>· {doc.disciplina}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Spinner CSS (inline para não depender de lib externa) */}
      <style>{`
        .spin {
          animation: ged-doc-selector-spin 0.9s linear infinite;
        }
        @keyframes ged-doc-selector-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default GedDocSelector;
