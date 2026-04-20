// frontend-web/src/modules/almoxarifado/conversoes/pages/ConversoesPage.tsx
import React, { useState, useMemo } from 'react';
import {
  useConversoes,
  useUpsertConversao,
  useCalcularCompra,
} from '../hooks/useConversoes';
import type {
  AlmConversao,
  UpsertConversaoPayload,
} from '../../_service/almoxarifado.service';

// ── Cadastro de conversão (modal) ─────────────────────────────────────────────

interface ConversaoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ConversaoModal({ isOpen, onClose }: ConversaoModalProps) {
  const upsert = useUpsertConversao();
  const [form, setForm] = useState<UpsertConversaoPayload>({
    unidadeOrigem: '',
    unidadeDestino: '',
    fator: 1,
    descricao: '',
    catalogoId: null,
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await upsert.mutateAsync({
      ...form,
      unidadeOrigem: form.unidadeOrigem.toUpperCase().trim(),
      unidadeDestino: form.unidadeDestino.toUpperCase().trim(),
      fator: Number(form.fator),
      catalogoId: form.catalogoId || null,
      descricao: form.descricao?.trim() || null,
    });
    setForm({ unidadeOrigem: '', unidadeDestino: '', fator: 1, descricao: '', catalogoId: null });
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg-raised)',
    color: 'var(--text-high)',
    fontSize: 13,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: 480, maxWidth: '90vw',
      }}>
        <h2 style={{ color: 'var(--text-high)', marginBottom: 8, fontSize: 16 }}>
          Nova Conversão
        </h2>
        <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 16 }}>
          Fator convencionado: <strong>1 unidade_origem = fator × unidade_destino</strong>.
          Ex: 1 CX = 2,5 M² → fator 2,5.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: 'var(--text-low)', display: 'block', marginBottom: 4, fontSize: 11 }}>
                UM Origem *
              </label>
              <input
                required
                placeholder="CX"
                value={form.unidadeOrigem}
                onChange={(e) => setForm((f) => ({ ...f, unidadeOrigem: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-low)', display: 'block', marginBottom: 4, fontSize: 11 }}>
                UM Destino *
              </label>
              <input
                required
                placeholder="M2"
                value={form.unidadeDestino}
                onChange={(e) => setForm((f) => ({ ...f, unidadeDestino: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-low)', display: 'block', marginBottom: 4, fontSize: 11 }}>
                Fator *
              </label>
              <input
                required
                type="number"
                step="any"
                min={0}
                value={form.fator || ''}
                onChange={(e) => setForm((f) => ({ ...f, fator: Number(e.target.value) }))}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ color: 'var(--text-low)', display: 'block', marginBottom: 4, fontSize: 11 }}>
              ID do Catálogo (opcional — deixar vazio para regra geral do tenant)
            </label>
            <input
              type="number"
              placeholder="Ex: 42"
              value={form.catalogoId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, catalogoId: e.target.value ? Number(e.target.value) : null }))}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ color: 'var(--text-low)', display: 'block', marginBottom: 4, fontSize: 11 }}>
              Descrição
            </label>
            <input
              placeholder="Ex: Porcelanato 60×60 — caixa com 2,5 m²"
              value={form.descricao ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-high)', cursor: 'pointer', fontSize: 13 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={upsert.isPending}
              style={{
                padding: '8px 16px', borderRadius: 4, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                opacity: upsert.isPending ? 0.5 : 1,
              }}
            >
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Calculadora de compra reverso ─────────────────────────────────────────────

function CalculadoraCompra() {
  const calcular = useCalcularCompra();
  const [form, setForm] = useState({
    necessidade: 250,
    unidadeNecessidade: 'M2',
    unidadeCompra: 'CX',
    quebraPct: 10,
    catalogoId: null as number | null,
  });
  const [resultado, setResultado] = useState<null | {
    quantidadeCompra: number;
    quantidadeNominal: number;
    fatorAplicado: number;
    quebraAplicada: number;
  }>(null);
  const [erro, setErro] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--bg-raised)',
    color: 'var(--text-high)',
    fontSize: 13,
  };

  async function handleCalcular() {
    setErro(null);
    try {
      const r = await calcular.mutateAsync({
        necessidade: Number(form.necessidade),
        unidadeNecessidade: form.unidadeNecessidade.toUpperCase(),
        unidadeCompra: form.unidadeCompra.toUpperCase(),
        quebraPct: Number(form.quebraPct),
        catalogoId: form.catalogoId,
      });
      setResultado(r);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(msg ?? 'Erro ao calcular. Conversão pode não estar cadastrada.');
      setResultado(null);
    }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-dim)',
      borderRadius: 6,
      padding: 16,
      marginBottom: 24,
    }}>
      <h3 style={{ color: 'var(--text-high)', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
        Calculadora de Compra Reversa
      </h3>
      <p style={{ color: 'var(--text-low)', fontSize: 12, marginBottom: 12 }}>
        "Preciso de X m² de porcelanato — quantas caixas compro?"
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label style={{ color: 'var(--text-low)', fontSize: 11, display: 'block', marginBottom: 4 }}>Necessidade</label>
          <input
            type="number"
            step="any"
            value={form.necessidade}
            onChange={(e) => setForm((f) => ({ ...f, necessidade: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: 'var(--text-low)', fontSize: 11, display: 'block', marginBottom: 4 }}>UM Necessidade</label>
          <input
            value={form.unidadeNecessidade}
            onChange={(e) => setForm((f) => ({ ...f, unidadeNecessidade: e.target.value }))}
            placeholder="M2"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: 'var(--text-low)', fontSize: 11, display: 'block', marginBottom: 4 }}>UM Compra</label>
          <input
            value={form.unidadeCompra}
            onChange={(e) => setForm((f) => ({ ...f, unidadeCompra: e.target.value }))}
            placeholder="CX"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: 'var(--text-low)', fontSize: 11, display: 'block', marginBottom: 4 }}>Quebra %</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.quebraPct}
            onChange={(e) => setForm((f) => ({ ...f, quebraPct: Number(e.target.value) }))}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ color: 'var(--text-low)', fontSize: 11, display: 'block', marginBottom: 4 }}>ID Catálogo</label>
          <input
            type="number"
            placeholder="(geral)"
            value={form.catalogoId ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, catalogoId: e.target.value ? Number(e.target.value) : null }))}
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleCalcular}
          disabled={calcular.isPending}
          style={{
            padding: '7px 14px', borderRadius: 4, border: 'none',
            background: 'var(--accent)', color: '#fff',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, height: 30,
            opacity: calcular.isPending ? 0.5 : 1,
          }}
        >
          {calcular.isPending ? '…' : 'Calcular'}
        </button>
      </div>

      {erro && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 4,
          background: 'rgba(var(--nc-rgb), 0.08)',
          border: '1px solid rgba(var(--nc-rgb), 0.25)',
          color: 'var(--nc)',
          fontSize: 12,
        }}>
          {erro}
        </div>
      )}

      {resultado && !erro && (
        <div style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 4,
          background: 'rgba(var(--ok-rgb), 0.06)',
          border: '1px solid rgba(var(--ok-rgb), 0.25)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}>
          <div>
            <div style={{ color: 'var(--text-faint)', fontSize: 10, textTransform: 'uppercase' }}>Comprar</div>
            <div style={{ color: 'var(--ok)', fontSize: 18, fontWeight: 700 }}>
              {resultado.quantidadeCompra} {form.unidadeCompra.toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-faint)', fontSize: 10, textTransform: 'uppercase' }}>Nominal (sem quebra)</div>
            <div style={{ color: 'var(--text-high)', fontSize: 13, fontFamily: 'monospace' }}>
              {resultado.quantidadeNominal.toFixed(4)}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-faint)', fontSize: 10, textTransform: 'uppercase' }}>Fator</div>
            <div style={{ color: 'var(--text-high)', fontSize: 13, fontFamily: 'monospace' }}>
              1 {form.unidadeCompra.toUpperCase()} = {resultado.fatorAplicado} {form.unidadeNecessidade.toUpperCase()}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-faint)', fontSize: 10, textTransform: 'uppercase' }}>Quebra aplicada</div>
            <div style={{ color: 'var(--text-high)', fontSize: 13, fontFamily: 'monospace' }}>
              +{resultado.quebraAplicada}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ConversoesPage() {
  const { data: conversoes = [], isLoading } = useConversoes();
  const [modalOpen, setModalOpen] = useState(false);
  const [busca, setBusca] = useState('');

  const filtradas = useMemo(() => {
    if (!busca.trim()) return conversoes;
    const q = busca.toLowerCase();
    return conversoes.filter((c: AlmConversao) =>
      c.unidade_origem.toLowerCase().includes(q) ||
      c.unidade_destino.toLowerCase().includes(q) ||
      (c.descricao ?? '').toLowerCase().includes(q) ||
      (c.catalogo_nome ?? '').toLowerCase().includes(q),
    );
  }, [conversoes, busca]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h1 style={{ color: 'var(--text-high)', fontSize: 20, fontWeight: 600 }}>Conversão de Unidades</h1>
          <p style={{ color: 'var(--text-low)', fontSize: 13, marginTop: 2 }}>
            {conversoes.length} regras · {conversoes.filter((c: AlmConversao) => c.tenant_id === 0).length} do sistema
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: '8px 16px', borderRadius: 4, border: 'none',
            background: 'var(--accent)', color: '#fff',
            cursor: 'pointer', fontWeight: 500, fontSize: 13,
          }}
        >
          + Nova Conversão
        </button>
      </div>

      <p style={{ color: 'var(--text-faint)', fontSize: 12, marginBottom: 20 }}>
        Conversões com <strong>escopo do sistema</strong> (padrão do mercado brasileiro de construção) já vêm cadastradas.
        Cadastre conversões do tenant para sobrepor quando o fornecedor trabalhar com embalagem diferente.
      </p>

      <CalculadoraCompra />

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Buscar por UM, descrição ou insumo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{
            width: 320, padding: '6px 10px', borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg-raised)', color: 'var(--text-high)',
            fontSize: 13,
          }}
        />
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-low)' }}>Carregando...</p>
      ) : (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-dim)',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-dim)', background: 'var(--bg-raised)' }}>
                {['Escopo', 'UM Origem', 'UM Destino', 'Fator', 'Descrição', 'Insumo'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 12px',
                    color: 'var(--text-faint)', fontWeight: 600, fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
                    {busca ? 'Nenhuma conversão encontrada.' : 'Nenhuma conversão cadastrada.'}
                  </td>
                </tr>
              ) : (
                filtradas.map((c: AlmConversao) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: c.tenant_id === 0 ? 'rgba(var(--run-rgb), 0.15)' : 'rgba(var(--ok-rgb), 0.15)',
                        color: c.tenant_id === 0 ? 'var(--run)' : 'var(--ok)',
                      }}>
                        {c.tenant_id === 0 ? 'Sistema' : 'Tenant'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-high)', fontSize: 13 }}>
                      {c.unidade_origem}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--text-high)', fontSize: 13 }}>
                      {c.unidade_destino}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>
                      {Number(c.fator).toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>
                      {c.descricao ?? '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-low)', fontSize: 13 }}>
                      {c.catalogo_nome ?? <span style={{ color: 'var(--text-faint)' }}>(geral)</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConversaoModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
