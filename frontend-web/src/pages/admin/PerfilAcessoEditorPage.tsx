import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { perfisAcessoService } from '@/services/perfis-acesso.service';
import type {
  NivelPermissao,
  PermissaoModulo,
} from '@/services/usuarios.service';
import { ArrowLeft, Save } from 'lucide-react';

const MODULOS: Array<{
  chave: PermissaoModulo;
  label: string;
  descricao: string;
}> = [
  {
    chave: 'CONCRETAGEM',
    label: 'Concretagem',
    descricao: 'Concretagens, caminhões, corpos de prova, laudos',
  },
  {
    chave: 'NC',
    label: 'Não Conformidades',
    descricao: 'Registro e ciclo de NCs, RAC, planos de ação',
  },
  {
    chave: 'RO',
    label: 'Registros de Ocorrência',
    descricao: 'RO de inspeção FVS',
  },
  {
    chave: 'LAUDOS',
    label: 'Laudos',
    descricao: 'Laudos técnicos de ensaios e concretagem',
  },
  {
    chave: 'OBRAS',
    label: 'Obras',
    descricao: 'Cadastro e configuração de obras',
  },
  {
    chave: 'USUARIOS',
    label: 'Usuários',
    descricao: 'Gestão de usuários e perfis de acesso',
  },
  {
    chave: 'RELATORIOS',
    label: 'Relatórios',
    descricao: 'Relatórios gerenciais e dashboards',
  },
];

const NIVEIS: Array<{ chave: NivelPermissao; label: string }> = [
  { chave: 'VISUALIZAR', label: 'Visualizar' },
  { chave: 'OPERAR', label: 'Operar' },
  { chave: 'APROVAR', label: 'Aprovar' },
  { chave: 'ADMINISTRAR', label: 'Administrar' },
];

export function PerfilAcessoEditorPage() {
  const { id: idStr } = useParams();
  const id = parseInt(idStr ?? '0', 10);
  const qc = useQueryClient();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-acesso', id],
    queryFn: () => perfisAcessoService.detalhar(id),
    enabled: !!id,
  });

  // Mapa local módulo → nível (null = não selecionado)
  const [mapa, setMapa] = useState<
    Record<PermissaoModulo, NivelPermissao | null>
  >(
    Object.fromEntries(MODULOS.map((m) => [m.chave, null])) as Record<
      PermissaoModulo,
      NivelPermissao | null
    >,
  );

  useEffect(() => {
    if (perfil) {
      const novo = { ...mapa };
      for (const p of perfil.permissoes) novo[p.modulo] = p.nivel;
      setMapa(novo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil]);

  const salvar = useMutation({
    mutationFn: () => {
      const permissoes = Object.entries(mapa)
        .filter(([, v]) => v !== null)
        .map(([modulo, nivel]) => ({
          modulo: modulo as PermissaoModulo,
          nivel: nivel as NivelPermissao,
        }));
      return perfisAcessoService.salvarPermissoes(id, permissoes);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil-acesso', id] });
      qc.invalidateQueries({ queryKey: ['perfis-acesso'] });
      alert('Permissões salvas');
    },
  });

  if (isLoading || !perfil) return <div className="p-6">Carregando…</div>;

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <Link
        to="/admin/perfis-acesso"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-low)] hover:text-[var(--accent)] mb-4"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-high)]">
            {perfil.nome}
          </h1>
          {perfil.descricao && (
            <p className="text-sm text-[var(--text-low)] mt-1">
              {perfil.descricao}
            </p>
          )}
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="flex items-center gap-2 bg-[var(--accent)] text-[var(--bg-void)] font-bold text-sm px-4 py-2 rounded-sm disabled:opacity-60"
        >
          <Save size={14} /> {salvar.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      <p className="text-xs text-[var(--text-faint)] mb-4">
        Níveis são hierárquicos: quem tem <strong>Aprovar</strong> também pode
        Operar e Visualizar.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULOS.map((m) => {
          const selecionado = mapa[m.chave];
          return (
            <div
              key={m.chave}
              className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-4 flex flex-col gap-3"
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-high)]">
                  {m.label}
                </h3>
                <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
                  {m.descricao}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    setMapa((p) => ({ ...p, [m.chave]: null }))
                  }
                  className={`text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
                    selecionado === null
                      ? 'bg-[var(--text-faint)]/15 border-[var(--border-dim)] text-[var(--text-high)]'
                      : 'bg-transparent border-[var(--border-dim)] text-[var(--text-low)] hover:text-[var(--text-high)]'
                  }`}
                >
                  Sem acesso
                </button>
                {NIVEIS.map((n) => (
                  <button
                    key={n.chave}
                    onClick={() =>
                      setMapa((p) => ({ ...p, [m.chave]: n.chave }))
                    }
                    className={`text-[11px] uppercase tracking-wider px-2 py-1 rounded-sm border ${
                      selecionado === n.chave
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--bg-void)] font-bold'
                        : 'bg-transparent border-[var(--border-dim)] text-[var(--text-low)] hover:text-[var(--text-high)]'
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
