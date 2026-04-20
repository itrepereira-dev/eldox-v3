import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { Campo, LayoutAuth } from './AceitarConvitePage';

const schema = z.object({
  slug: z.string().min(1, 'Informe o identificador da empresa'),
  email: z.string().email('E-mail inválido'),
});
type FormData = z.infer<typeof schema>;

export function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: authApi.esqueciSenha,
    onSuccess: () => setEnviado(true),
  });

  if (enviado) {
    return (
      <LayoutAuth titulo="Verifique seu e-mail">
        <p className="text-sm text-[var(--text-low)] text-center mb-4">
          Se o e-mail estiver cadastrado, enviaremos instruções para redefinir
          sua senha. Verifique sua caixa de entrada.
        </p>
        <Link
          to="/login"
          className="block text-center text-sm text-[var(--accent)] hover:underline"
        >
          Voltar para login
        </Link>
      </LayoutAuth>
    );
  }

  return (
    <LayoutAuth titulo="Esqueci a senha">
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4"
      >
        <Campo
          label="Empresa"
          placeholder="identificador-da-empresa"
          autoComplete="organization"
          error={errors.slug?.message}
          {...register('slug')}
        />
        <Campo
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm disabled:opacity-60 hover:opacity-90"
        >
          {mutation.isPending ? 'Enviando…' : 'Enviar link de reset'}
        </button>
        <Link
          to="/login"
          className="text-center text-xs text-[var(--text-low)] hover:text-[var(--accent)]"
        >
          Voltar para login
        </Link>
      </form>
    </LayoutAuth>
  );
}
