import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '@/services/api';
import { Campo, LayoutAuth } from './AceitarConvitePage';

const schema = z
  .object({
    senha: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    path: ['confirmar'],
    message: 'Senhas não conferem',
  });
type FormData = z.infer<typeof schema>;

export function ResetSenhaPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (d: FormData) =>
      authApi.resetSenha({ token, novaSenha: d.senha }),
    onSuccess: () => setOk(true),
  });

  if (!token) {
    return (
      <LayoutAuth titulo="Link inválido">
        <p className="text-sm text-[var(--text-low)] text-center">
          Link incompleto. Solicite um novo reset em "Esqueci a senha".
        </p>
      </LayoutAuth>
    );
  }

  if (ok) {
    return (
      <LayoutAuth titulo="Senha redefinida">
        <p className="text-sm text-[var(--text-low)] text-center mb-4">
          Sua senha foi redefinida com sucesso.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm"
        >
          Ir para login
        </button>
      </LayoutAuth>
    );
  }

  return (
    <LayoutAuth titulo="Nova senha">
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4"
      >
        <Campo
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          error={errors.senha?.message}
          {...register('senha')}
        />
        <Campo
          label="Confirmar"
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
          className="bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm disabled:opacity-60"
        >
          {mutation.isPending ? 'Salvando…' : 'Redefinir senha'}
        </button>
      </form>
    </LayoutAuth>
  );
}
