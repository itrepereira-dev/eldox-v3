import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { perfisAcessoService } from '@/services/perfis-acesso.service';
import { Plus, Trash2 } from 'lucide-react';

export function PerfisAcessoListPage() {
  const qc = useQueryClient();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const { data: perfis, isLoading } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: perfisAcessoService.listar,
  });

  const criar = useMutation({
    mutationFn: () =>
      perfisAcessoService.criar({
        nome,
        descricao: descricao || undefined,
      }),
    onSuccess: () => {
      setNome('');
      setDescricao('');
      qc.invalidateQueries({ queryKey: ['perfis-acesso'] });
    },
  });

  const desativar = useMutation({
    mutationFn: (id: number) => perfisAcessoService.desativar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfis-acesso'] }),
  });

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-high)] mb-2">
        Perfis de acesso
      </h1>
      <p className="text-sm text-[var(--text-low)] mb-6">
        Templates de permissões reutilizáveis. Cada usuário pode ser vinculado
        a um perfil, com overrides individuais opcionais.
      </p>

      {/* Criar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-4 mb-6">
        <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
          Criar novo perfil
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome (ex: Engenheiro de Qualidade)"
            className="flex-1 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
          />
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            className="flex-[2] bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
          />
          <button
            onClick={() => nome && criar.mutate()}
            disabled={!nome || criar.isPending}
            className="flex items-center gap-2 bg-[var(--accent)] text-[var(--bg-void)] font-semibold text-sm px-4 py-2 rounded-sm disabled:opacity-60"
          >
            <Plus size={14} /> Criar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm overflow-hidden">
        {isLoading && (
          <div className="p-6 text-center text-[var(--text-low)]">
            Carregando…
          </div>
        )}
        {!isLoading && (!perfis || perfis.length === 0) && (
          <div className="p-6 text-center text-[var(--text-low)]">
            Nenhum perfil criado ainda.
          </div>
        )}
        {!isLoading && perfis && perfis.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-dim)] text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="text-left px-4 py-3 font-semibold">Nome</th>
                <th className="text-left px-4 py-3 font-semibold">Descrição</th>
                <th className="text-right px-4 py-3 font-semibold">Usuários</th>
                <th className="text-right px-4 py-3 font-semibold">Módulos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border-dim)] last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/perfis-acesso/${p.id}`}
                      className="text-[var(--text-high)] font-medium hover:text-[var(--accent)]"
                    >
                      {p.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-low)]">
                    {p.descricao ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-low)]">
                    {p._count.usuarios}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-low)]">
                    {p._count.permissoes}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Desativar o perfil "${p.nome}"? Usuários vinculados não perdem acesso, mas novos vínculos ficam bloqueados.`,
                          )
                        )
                          desativar.mutate(p.id);
                      }}
                      className="text-[var(--nc)] hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
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
