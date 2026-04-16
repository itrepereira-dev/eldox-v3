// frontend-web/src/modules/efetivo/pages/EfetivoListPage.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { TurnoEfetivo } from '../../../services/efetivo.service';
import { useRegistros, useFecharRegistro, useReabrirRegistro } from '../hooks/useEfetivo';
import { useAlertasEfetivo } from '../hooks/useAlertasEfetivo';
import { AlertaEfetivoCard } from '../components/AlertaEfetivoCard';
import { RegistroModal } from '../components/RegistroModal';

const TURNOS: { value: TurnoEfetivo | ''; label: string }[] = [
  { value: '', label: 'Todos os turnos' },
  { value: 'INTEGRAL', label: 'Integral' },
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
];

const TURNO_LABELS: Record<TurnoEfetivo, string> = {
  INTEGRAL: 'Integral',
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
};

const PAGE_SIZE = 15;

export function EfetivoListPage() {
  const { obraId: obraIdParam } = useParams<{ obraId: string }>();
  const obraId = parseInt(obraIdParam!, 10);

  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [turno, setTurno] = useState<TurnoEfetivo | ''>('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const params = {
    mes,
    ano,
    ...(turno ? { turno } : {}),
    page,
    limit: PAGE_SIZE,
  };

  const { data, isLoading, error, refetch } = useRegistros(obraId, params);
  const { fechar, isLoading: fechando } = useFecharRegistro(obraId);
  const { reabrir, isLoading: reabrindo } = useReabrirRegistro(obraId);
  const { alertas, marcarLido } = useAlertasEfetivo();

  const registros = data?.data ?? [];
  const meta = data?.meta;
  const resumo = data?.resumo;
  const totalPages = meta?.total_pages ?? 1;

  const registrosAbertos = registros.filter(r => !r.fechado).length;
  const registrosFechados = registros.filter(r => r.fechado).length;

  async function handleFechar(id: number) {
    await fechar(id);
    refetch();
  }

  async function handleReabrir(id: number) {
    await reabrir(id);
    refetch();
  }

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  const anos = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  const inputStyle = {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    color: 'var(--text-high)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    outline: 'none',
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-high)' }}>
            Controle de Efetivo
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-low)' }}>
            Registros de homens·dia por turno
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          + Novo Registro
        </button>
      </div>

      {/* Alertas */}
      <AlertaEfetivoCard alertas={alertas} onMarcarLido={marcarLido} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
            Total H·dia do mês
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--text-high)' }}>
            {resumo?.total_homens_dia ?? '—'}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
            Registros abertos
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--warn)' }}>
            {isLoading ? '—' : registrosAbertos}
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-dim)' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-faint)' }}>
            Registros fechados
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: 'var(--ok)' }}>
            {isLoading ? '—' : registrosFechados}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <select value={mes} onChange={e => { setMes(Number(e.target.value)); setPage(1); }} style={inputStyle}>
          {meses.map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>
        <select value={ano} onChange={e => { setAno(Number(e.target.value)); setPage(1); }} style={inputStyle}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={turno}
          onChange={e => { setTurno(e.target.value as TurnoEfetivo | ''); setPage(1); }}
          style={inputStyle}
        >
          {TURNOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
        {/* Table header */}
        <div
          className="grid text-[11px] font-bold uppercase tracking-wider"
          style={{
            gridTemplateColumns: '110px 100px 1fr 110px 110px 140px',
            background: 'var(--bg-void)',
            borderBottom: '1px solid var(--border-dim)',
            color: 'var(--text-faint)',
          }}
        >
          <span className="px-4 py-3">Data</span>
          <span className="px-4 py-3">Turno</span>
          <span className="px-4 py-3">Empresas / Funções</span>
          <span className="px-4 py-3 text-center">Total H·dia</span>
          <span className="px-4 py-3 text-center">Status</span>
          <span className="px-4 py-3 text-center">Ações</span>
        </div>

        {/* Rows */}
        {isLoading && (
          <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-low)' }}>
            Carregando registros...
          </div>
        )}
        {error && (
          <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--warn)' }}>
            {error}
          </div>
        )}
        {!isLoading && !error && registros.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--text-faint)' }}>
            Nenhum registro encontrado para o período selecionado.
          </div>
        )}
        {registros.map((reg, i) => {
          const empresasSummary = reg.itens
            ? [...new Set(reg.itens.map(it => it.empresa_nome ?? `Emp #${it.empresa_id}`))].join(', ')
            : '—';

          return (
            <div
              key={reg.id}
              className="grid items-center"
              style={{
                gridTemplateColumns: '110px 100px 1fr 110px 110px 140px',
                borderBottom: '1px solid var(--border-dim)',
                background: i % 2 === 0 ? 'var(--bg-raised)' : 'transparent',
              }}
            >
              <span className="px-4 py-3 text-[13px] font-mono" style={{ color: 'var(--text-high)' }}>
                {new Date(reg.data + 'T00:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span className="px-4 py-3 text-[12px]" style={{ color: 'var(--text-mid)' }}>
                {TURNO_LABELS[reg.turno]}
              </span>
              <span
                className="px-4 py-3 text-[12px] truncate"
                style={{ color: 'var(--text-low)', maxWidth: '100%' }}
                title={empresasSummary}
              >
                {empresasSummary}
              </span>
              <span className="px-4 py-3 text-[13px] font-mono text-center" style={{ color: 'var(--text-high)' }}>
                {reg.total_homens_dia ?? (reg.itens?.reduce((s, it) => s + it.quantidade, 0) ?? '—')}
              </span>
              <span className="px-4 py-3 text-center">
                {reg.fechado ? (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}
                  >
                    Fechado
                  </span>
                ) : (
                  <span
                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                    style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}
                  >
                    Aberto
                  </span>
                )}
              </span>
              <span className="px-4 py-3 text-center">
                {reg.fechado ? (
                  <button
                    onClick={() => handleReabrir(reg.id)}
                    disabled={reabrindo}
                    className="text-[12px] font-medium px-3 py-1 rounded transition-all disabled:opacity-50"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-mid)',
                    }}
                  >
                    Reabrir
                  </button>
                ) : (
                  <button
                    onClick={() => handleFechar(reg.id)}
                    disabled={fechando}
                    className="text-[12px] font-medium px-3 py-1 rounded transition-all disabled:opacity-50"
                    style={{
                      background: 'var(--ok-bg)',
                      border: '1px solid var(--ok)',
                      color: 'var(--ok)',
                    }}
                  >
                    Fechar
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[12px]" style={{ color: 'var(--text-faint)' }}>
            Página {page} de {totalPages} — {meta?.total} registros
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded text-[12px] font-medium disabled:opacity-40 transition-all"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-mid)',
              }}
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded text-[12px] font-medium disabled:opacity-40 transition-all"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                color: 'var(--text-mid)',
              }}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <RegistroModal
          obraId={obraId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { refetch(); setModalOpen(false); }}
        />
      )}
    </div>
  );
}
