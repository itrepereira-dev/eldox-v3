import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import logoPrincipal from '@/assets/logo-principal.png';

const schema = z.object({
  slug: z.string().min(1, 'Informe o identificador da empresa'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login(data.token, data.usuario, data.tenantSlug);
      navigate('/dashboard');
    },
  });

  return (
    <div className="min-h-screen bg-[var(--bg-void)] flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-10">

        {/* Logo */}
        <div className="flex justify-center mb-2">
          <img src={logoPrincipal} alt="EldoX" className="h-10 object-contain" draggable={false} />
        </div>
        <p className="text-center text-[11px] text-[var(--text-faint)] uppercase tracking-widest mb-8">
          Sistema Operacional da Obra
        </p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="flex flex-col gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider">
              Empresa
            </label>
            <input
              {...register('slug')}
              placeholder="identificador-da-empresa"
              autoComplete="organization"
              className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] text-sm px-3.5 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
            />
            {errors.slug && (
              <span className="text-[11px] text-[var(--nc)]">{errors.slug.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider">
              E-mail
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] text-sm px-3.5 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
            />
            {errors.email && (
              <span className="text-[11px] text-[var(--nc)]">{errors.email.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-low)] uppercase tracking-wider">
              Senha
            </label>
            <input
              {...register('senha')}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-[var(--text-high)] text-sm px-3.5 py-2.5 outline-none focus:border-[var(--accent)] transition-colors"
            />
            {errors.senha && (
              <span className="text-[11px] text-[var(--nc)]">{errors.senha.message}</span>
            )}
          </div>

          {mutation.isError && (
            <div className="bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-sm text-[var(--nc)] text-[13px] px-3.5 py-2.5">
              Credenciais inválidas. Verifique os dados e tente novamente.
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-2 bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm rounded-sm py-3 cursor-pointer disabled:opacity-60 transition-opacity hover:opacity-90"
          >
            {mutation.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
