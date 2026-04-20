import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/services/api';
import logoPrincipal from '@/assets/logo-principal.png';

const schema = z.object({
  nome: z.string().min(1, 'Informe seu nome'),
  senha: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar: z.string(),
}).refine((d) => d.senha === d.confirmar, {
  path: ['confirmar'],
  message: 'Senhas não conferem',
});

type FormData = z.infer<typeof schema>;

export function AceitarConvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [sucesso, setSucesso] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (d: FormData) =>
      authApi.aceitarConvite({ token, nome: d.nome, senha: d.senha }),
    onSuccess: () => setSucesso(true),
  });

  if (!token) {
    return (
      <LayoutAuth titulo="Link inválido">
        <p className="text-sm text-[var(--text-low)] text-center">
          O link de convite está incompleto ou foi adulterado. Solicite um novo
          convite ao administrador.
        </p>
      </LayoutAuth>
    );
  }

  if (sucesso) {
    return (
      <LayoutAuth titulo="Cadastro finalizado">
        <p className="text-sm text-[var(--text-low)] text-center mb-4">
          Seu cadastro foi concluído. Faça login para entrar.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm hover:opacity-90"
        >
          Ir para login
        </button>
      </LayoutAuth>
    );
  }

  return (
    <LayoutAuth titulo="Finalizar cadastro">
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4"
      >
        <Campo
          label="Seu nome"
          error={errors.nome?.message}
          {...register('nome')}
        />
        <Campo
          label="Senha"
          type="password"
          autoComplete="new-password"
          error={errors.senha?.message}
          {...register('senha')}
        />
        <Campo
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmar?.message}
          {...register('confirmar')}
        />

        {mutation.isError && (
          <div className="bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-sm text-[var(--nc)] text-[13px] px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ??
              'Token inválido ou expirado'}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm disabled:opacity-60 hover:opacity-90"
        >
          {mutation.isPending ? 'Finalizando…' : 'Finalizar cadastro'}
        </button>
      </form>
    </LayoutAuth>
  );
}

// ─────────────────────────────────────────────────────────────
// helpers inline (reaproveitados pelas outras páginas auth)
// ─────────────────────────────────────────────────────────────

export function LayoutAuth({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-10">
        <div className="flex justify-center mb-4">
          <img
            src={logoPrincipal}
            alt="EldoX"
            className="h-10 object-contain"
            draggable={false}
          />
        </div>
        <h2 className="text-center text-sm font-semibold text-[var(--text-high)] uppercase tracking-widest mb-6">
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

interface CampoProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
export const Campo = ({ label, error, ...rest }: CampoProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider">
      {label}
    </label>
    <input
      {...rest}
      className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] text-sm px-3.5 py-2.5 outline-none focus:border-[var(--accent)]"
    />
    {error && <span className="text-[11px] text-[var(--nc)]">{error}</span>}
  </div>
);
