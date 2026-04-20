import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usuariosService, type StatusUsuario } from '@/services/usuarios.service';
import { Plus } from 'lucide-react';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN_TENANT: 'Administrador',
  ENGENHEIRO: 'Engenheiro',
  TECNICO: 'Técnico',
  LABORATORIO: 'Laboratório',
  VISITANTE: 'Visitante',
};

const STATUS_STYLE: Record<StatusUsuario, string> = {
  ATIVO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  PENDENTE: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  INATIVO: 'bg-[var(--text-faint)]/10 text-[var(--text-faint)] border-[var(--border-dim)]',
};

export function UsuariosListPage() {
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: usuariosService.listar,
  });

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-high)]">Usuários</h1>
          <p className="text-sm text-[var(--text-low)] mt-1">
            Gerencie equipe da construtora, papéis e acesso às obras
          </p>
        </div>
        <Link
          to="/admin/usuarios/novo"
          className="flex items-center gap-2 bg-[var(--accent)] text-[var(--bg-void)] font-semibold text-sm px-4 py-2 rounded-sm hover:opacity-90"
        >
          <Plus size={16} /> Novo usuário
        </Link>
      </div>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm overflow-hidden">
        {isLoading && (
          <div className="p-6 text-center text-[var(--text-low)]">Carregando…</div>
        )}
        {!isLoading && (!usuarios || usuarios.length === 0) && (
          <div className="p-6 text-center text-[var(--text-low)]">
            Nenhum usuário cadastrado. Clique em "Novo usuário".
          </div>
        )}
        {!isLoading && usuarios && usuarios.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-dim)] text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="text-left px-4 py-3 font-semibold">Nome</th>
                <th className="text-left px-4 py-3 font-semibold">E-mail</th>
                <th className="text-left px-4 py-3 font-semibold">Papel</th>
                <th className="text-left px-4 py-3 font-semibold">Perfil</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/usuarios/${u.id}`}
                      className="text-[var(--text-high)] font-medium hover:text-[var(--accent)]"
                    >
                      {u.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-low)]">{u.email}</td>
                  <td className="px-4 py-3 text-[var(--text-low)]">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-low)]">
                    {u.perfilAcesso?.nome ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 border rounded-sm text-[11px] font-semibold uppercase tracking-wider ${STATUS_STYLE[u.status]}`}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
