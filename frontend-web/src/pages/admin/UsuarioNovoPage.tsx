import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usuariosService, type Role } from '@/services/usuarios.service';
import { perfisAcessoService } from '@/services/perfis-acesso.service';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().min(1, 'Informe o nome'),
  role: z.enum([
    'TECNICO',
    'ENGENHEIRO',
    'ADMIN_TENANT',
    'LABORATORIO',
    'VISITANTE',
  ]),
  perfilAcessoId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function UsuarioNovoPage() {
  const navigate = useNavigate();

  const { data: perfis } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: perfisAcessoService.listar,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      usuariosService.criar({
        email: data.email,
        nome: data.nome,
        role: data.role as Role,
        perfilAcessoId: data.perfilAcessoId
          ? parseInt(data.perfilAcessoId, 10)
          : undefined,
      }),
    onSuccess: () => navigate('/admin/usuarios'),
  });

  return (
    <div className="p-6 max-w-[600px] mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-high)] mb-2">
        Novo usuário
      </h1>
      <p className="text-sm text-[var(--text-low)] mb-6">
        Um convite será enviado por e-mail. O usuário define nome final e senha
        ao aceitar.
      </p>

      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="flex flex-col gap-4 bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-low)]">
            E-mail
          </label>
          <input
            {...register('email')}
            type="email"
            placeholder="pessoa@empresa.com"
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 outline-none focus:border-[var(--accent)] text-[var(--text-high)]"
          />
          {errors.email && (
            <span className="text-[11px] text-[var(--nc)]">
              {errors.email.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-low)]">
            Nome completo (provisório)
          </label>
          <input
            {...register('nome')}
            placeholder="Nome temporário — a pessoa pode ajustar ao aceitar"
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 outline-none focus:border-[var(--accent)] text-[var(--text-high)]"
          />
          {errors.nome && (
            <span className="text-[11px] text-[var(--nc)]">
              {errors.nome.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-low)]">
            Papel
          </label>
          <select
            {...register('role')}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 outline-none focus:border-[var(--accent)] text-[var(--text-high)]"
          >
            <option value="">Selecione…</option>
            <option value="ADMIN_TENANT">Administrador</option>
            <option value="ENGENHEIRO">Engenheiro</option>
            <option value="TECNICO">Técnico</option>
            <option value="LABORATORIO">Laboratório</option>
            <option value="VISITANTE">Visitante</option>
          </select>
          {errors.role && (
            <span className="text-[11px] text-[var(--nc)]">
              {errors.role.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-low)]">
            Perfil de acesso (opcional)
          </label>
          <select
            {...register('perfilAcessoId')}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 outline-none focus:border-[var(--accent)] text-[var(--text-high)]"
          >
            <option value="">— Sem perfil —</option>
            {perfis?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        {mutation.isError && (
          <div className="bg-[var(--nc-bg)] border border-[var(--nc-border)] rounded-sm text-[var(--nc)] text-[13px] px-3 py-2">
            {(mutation.error as any)?.response?.data?.message ??
              'Falha ao criar convite'}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={() => navigate('/admin/usuarios')}
            className="flex-1 bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-high)] text-sm font-semibold py-2.5 rounded-sm hover:bg-[var(--bg-hover)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm py-2.5 rounded-sm disabled:opacity-60 hover:opacity-90"
          >
            {mutation.isPending ? 'Enviando…' : 'Enviar convite'}
          </button>
        </div>
      </form>
    </div>
  );
}
