// frontend-web/src/modules/fvm/fornecedores/components/FornecedorModal.tsx
// Modal de criação rápida de fornecedor — modo rápido + modo completo (toggle)

import { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useCreateFornecedorRapido } from '../../grade/hooks/useGradeFvm';

// ── Utilitário de máscara CNPJ ────────────────────────────────────────────────

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2)  return digits;
  if (digits.length <= 5)  return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function stripMask(value: string): string {
  return value.replace(/\D/g, '');
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function FornecedorModal({ open, onClose }: Props) {
  // Campos modo rápido
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpjMasked,  setCnpjMasked]  = useState('');
  const [tipo,        setTipo]        = useState('fabricante');

  // Campos modo completo
  const [modoCompleto,  setModoCompleto]  = useState(false);
  const [nomeFantasia,  setNomeFantasia]  = useState('');
  const [email,         setEmail]         = useState('');
  const [telefone,      setTelefone]      = useState('');
  const [cidade,        setCidade]        = useState('');
  const [uf,            setUf]            = useState('');

  // Estado de erro
  const [erroApi, setErroApi] = useState<string | null>(null);

  const mutation    = useCreateFornecedorRapido();
  const inputRef    = useRef<HTMLInputElement>(null);

  // Foca no primeiro campo ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Fecha com Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  function handleClose() {
    // Resetar estado ao fechar
    setRazaoSocial('');
    setCnpjMasked('');
    setTipo('fabricante');
    setModoCompleto(false);
    setNomeFantasia('');
    setEmail('');
    setTelefone('');
    setCidade('');
    setUf('');
    setErroApi(null);
    onClose();
  }

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCnpjMasked(formatCnpj(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroApi(null);

    if (!razaoSocial.trim()) return;

    const cnpjRaw = stripMask(cnpjMasked);

    try {
      await mutation.mutateAsync({
        razao_social: razaoSocial.trim(),
        ...(cnpjRaw     ? { cnpj:     cnpjRaw }             : {}),
        ...(telefone    ? { telefone: telefone.trim() }      : {}),
      });
      handleClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erro ao criar fornecedor. Tente novamente.';
      setErroApi(msg);
    }
  }

  if (!open) return null;

  const inputCls =
    'w-full bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-md px-3 py-2 text-sm text-[var(--text-high)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-faint)]';

  const labelCls = 'block text-xs font-medium text-[var(--text-faint)] mb-1';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[var(--bg-base)] rounded-xl border border-[var(--border-dim)] shadow-2xl p-5 w-full max-w-md">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-[var(--text-high)]">
              Novo Fornecedor
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Razão Social */}
            <div>
              <label className={labelCls}>Razão Social *</label>
              <input
                ref={inputRef}
                value={razaoSocial}
                onChange={e => setRazaoSocial(e.target.value)}
                placeholder="Ex.: Cimentos Brasil S.A."
                required
                className={inputCls}
              />
            </div>

            {/* CNPJ */}
            <div>
              <label className={labelCls}>CNPJ</label>
              <input
                value={cnpjMasked}
                onChange={handleCnpjChange}
                placeholder="XX.XXX.XXX/XXXX-XX"
                inputMode="numeric"
                className={inputCls}
              />
            </div>

            {/* Tipo */}
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className={inputCls}
              >
                <option value="fabricante">Fabricante</option>
                <option value="distribuidor">Distribuidor</option>
                <option value="locadora">Locadora</option>
                <option value="prestador">Prestador de Serviço</option>
              </select>
            </div>

            {/* Toggle modo completo */}
            <button
              type="button"
              onClick={() => setModoCompleto(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity pt-1"
            >
              {modoCompleto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {modoCompleto ? 'Menos campos' : 'Mais campos'}
            </button>

            {/* Campos modo completo */}
            {modoCompleto && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className={labelCls}>Nome Fantasia</label>
                  <input
                    value={nomeFantasia}
                    onChange={e => setNomeFantasia(e.target.value)}
                    placeholder="Nome comercial"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="contato@fornecedor.com.br"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    value={telefone}
                    onChange={e => setTelefone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Cidade</label>
                    <input
                      value={cidade}
                      onChange={e => setCidade(e.target.value)}
                      placeholder="São Paulo"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>UF</label>
                    <input
                      value={uf}
                      onChange={e => setUf(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="SP"
                      maxLength={2}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Erro da API */}
            {erroApi && (
              <p className="text-xs text-[var(--nc-text)] bg-[var(--nc-bg,#fef2f2)] border border-[var(--nc-border,#fecaca)] rounded-md px-3 py-2">
                {erroApi}
              </p>
            )}

            {/* Footer */}
            <div className={cn('flex items-center justify-end gap-2', modoCompleto ? 'pt-2' : 'pt-1')}>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-[var(--text-faint)] hover:text-[var(--text-high)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!razaoSocial.trim() || mutation.isPending}
                className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {mutation.isPending ? 'Criando…' : 'Criar Fornecedor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
