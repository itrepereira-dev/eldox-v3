import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  usuariosService,
  type PermissaoModulo,
  type NivelPermissao,
} from '@/services/usuarios.service';
import { perfisAcessoService } from '@/services/perfis-acesso.service';
import { obrasService } from '@/services/obras.service';
import { ArrowLeft, Trash2, Plus, Mail, KeyRound } from 'lucide-react';

const MODULOS: PermissaoModulo[] = [
  'CONCRETAGEM',
  'NC',
  'RO',
  'LAUDOS',
  'OBRAS',
  'USUARIOS',
  'RELATORIOS',
];
const NIVEIS: NivelPermissao[] = [
  'VISUALIZAR',
  'OPERAR',
  'APROVAR',
  'ADMINISTRAR',
];

export function UsuarioDetalhePage() {
  const { id: idStr } = useParams();
  const id = parseInt(idStr ?? '0', 10);
  const qc = useQueryClient();
  const [aba, setAba] = useState<'dados' | 'obras' | 'permissoes'>('dados');

  const { data: u, isLoading } = useQuery({
    queryKey: ['admin-usuario', id],
    queryFn: () => usuariosService.detalhar(id),
    enabled: !!id,
  });

  const invalida = () => {
    qc.invalidateQueries({ queryKey: ['admin-usuario', id] });
    qc.invalidateQueries({ queryKey: ['admin-usuarios'] });
  };

  const ativarMut = useMutation({
    mutationFn: (ativo: boolean) => usuariosService.definirAtivo(id, ativo),
    onSuccess: invalida,
  });

  const reenviarConviteMut = useMutation({
    mutationFn: () => usuariosService.reenviarConvite(id),
    onSuccess: () => alert('Convite reenviado'),
  });

  const resetSenhaMut = useMutation({
    mutationFn: () => usuariosService.resetSenha(id),
    onSuccess: () => alert('E-mail de reset enviado'),
  });

  if (isLoading || !u) return <div className="p-6">Carregando…</div>;

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <Link
        to="/admin/usuarios"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-low)] hover:text-[var(--accent)] mb-4"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-high)]">{u.nome}</h1>
          <p className="text-sm text-[var(--text-low)]">{u.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] uppercase tracking-wider bg-[var(--bg-raised)] border border-[var(--border-dim)] px-2 py-0.5 rounded-sm text-[var(--text-low)]">
              {u.role}
            </span>
            <span className="text-[11px] uppercase tracking-wider bg-[var(--bg-raised)] border border-[var(--border-dim)] px-2 py-0.5 rounded-sm text-[var(--text-low)]">
              {u.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-dim)] mb-4">
        {(['dados', 'obras', 'permissoes'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              aba === t
                ? 'border-[var(--accent)] text-[var(--text-high)]'
                : 'border-transparent text-[var(--text-low)] hover:text-[var(--text-high)]'
            }`}
          >
            {t === 'dados' ? 'Dados' : t === 'obras' ? 'Obras' : 'Permissões'}
          </button>
        ))}
      </div>

      {aba === 'dados' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-high)] mb-2">
              Perfil de acesso
            </h3>
            <PerfilSelect
              usuarioId={id}
              atual={u.perfilAcessoId}
              onChange={invalida}
            />
          </div>

          <div className="border-t border-[var(--border-dim)] pt-4 flex flex-wrap gap-2">
            <button
              onClick={() => ativarMut.mutate(!u.ativo)}
              disabled={ativarMut.isPending}
              className="bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-high)] text-sm px-3 py-1.5 rounded-sm hover:bg-[var(--bg-hover)]"
            >
              {u.ativo ? 'Desativar' : 'Ativar'}
            </button>
            {u.status === 'PENDENTE' && (
              <button
                onClick={() => reenviarConviteMut.mutate()}
                disabled={reenviarConviteMut.isPending}
                className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-high)] text-sm px-3 py-1.5 rounded-sm hover:bg-[var(--bg-hover)]"
              >
                <Mail size={14} /> Reenviar convite
              </button>
            )}
            <button
              onClick={() => resetSenhaMut.mutate()}
              disabled={resetSenhaMut.isPending}
              className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border-dim)] text-[var(--text-high)] text-sm px-3 py-1.5 rounded-sm hover:bg-[var(--bg-hover)]"
            >
              <KeyRound size={14} /> Enviar reset de senha
            </button>
          </div>
        </div>
      )}

      {aba === 'obras' && <TabObras usuarioId={id} atuais={u.obrasLiberadas} />}

      {aba === 'permissoes' && (
        <TabPermissoes
          usuarioId={id}
          perfil={u.perfilAcesso}
          overrides={u.overrides}
        />
      )}
    </div>
  );
}

function PerfilSelect({
  usuarioId,
  atual,
  onChange,
}: {
  usuarioId: number;
  atual: number | null;
  onChange: () => void;
}) {
  const { data: perfis } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: perfisAcessoService.listar,
  });
  const mut = useMutation({
    mutationFn: (v: number | null) =>
      usuariosService.atribuirPerfil(usuarioId, v),
    onSuccess: onChange,
  });

  return (
    <select
      value={atual ?? ''}
      onChange={(e) =>
        mut.mutate(e.target.value ? parseInt(e.target.value, 10) : null)
      }
      className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
    >
      <option value="">— Sem perfil —</option>
      {perfis?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </select>
  );
}

function TabObras({
  usuarioId,
  atuais,
}: {
  usuarioId: number;
  atuais: Array<{
    id: number;
    obraId: number;
    obra: { id: number; nome: string; codigo: string | null };
  }>;
}) {
  const qc = useQueryClient();
  const [adicionar, setAdicionar] = useState('');
  const { data: todasObras } = useQuery({
    queryKey: ['obras-all'],
    queryFn: () => obrasService.getAll({ limit: 200 }),
  });
  const listaObras = Array.isArray(todasObras)
    ? todasObras
    : (todasObras as any)?.items ?? [];

  const idsAtuais = new Set(atuais.map((a) => a.obraId));
  const disponiveis = listaObras.filter((o: any) => !idsAtuais.has(o.id));

  const vincularMut = useMutation({
    mutationFn: (obraId: number) =>
      usuariosService.vincularObra(usuarioId, obraId),
    onSuccess: () => {
      setAdicionar('');
      qc.invalidateQueries({ queryKey: ['admin-usuario', usuarioId] });
    },
  });
  const desvincularMut = useMutation({
    mutationFn: (obraId: number) =>
      usuariosService.desvincularObra(usuarioId, obraId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-usuario', usuarioId] }),
  });

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <select
          value={adicionar}
          onChange={(e) => setAdicionar(e.target.value)}
          className="flex-1 bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
        >
          <option value="">Selecione uma obra para liberar…</option>
          {disponiveis.map((o: any) => (
            <option key={o.id} value={o.id}>
              {o.codigo ? `${o.codigo} — ` : ''}
              {o.nome}
            </option>
          ))}
        </select>
        <button
          onClick={() => adicionar && vincularMut.mutate(parseInt(adicionar, 10))}
          disabled={!adicionar || vincularMut.isPending}
          className="flex items-center gap-2 bg-[var(--accent)] text-[var(--bg-void)] font-semibold text-sm px-3 py-2 rounded-sm disabled:opacity-60"
        >
          <Plus size={14} /> Liberar
        </button>
      </div>

      {atuais.length === 0 ? (
        <p className="text-sm text-[var(--text-low)] text-center py-4">
          Nenhuma obra liberada. Admins têm acesso a todas; demais papéis
          precisam ser liberados explicitamente.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border-dim)]">
          {atuais.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-high)]">
                  {a.obra.nome}
                </p>
                {a.obra.codigo && (
                  <p className="text-[11px] text-[var(--text-faint)]">
                    {a.obra.codigo}
                  </p>
                )}
              </div>
              <button
                onClick={() => desvincularMut.mutate(a.obraId)}
                disabled={desvincularMut.isPending}
                className="text-[var(--nc)] hover:text-red-400"
                title="Revogar acesso"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabPermissoes({
  usuarioId,
  perfil,
  overrides,
}: {
  usuarioId: number;
  perfil: {
    id: number;
    nome: string;
    permissoes: Array<{ modulo: PermissaoModulo; nivel: NivelPermissao }>;
  } | null;
  overrides: Array<{
    modulo: PermissaoModulo;
    nivel: NivelPermissao;
    concedido: boolean;
  }>;
}) {
  const qc = useQueryClient();
  const [modulo, setModulo] = useState<PermissaoModulo | ''>('');
  const [nivel, setNivel] = useState<NivelPermissao>('VISUALIZAR');
  const [concedido, setConcedido] = useState(true);

  const adicionarMut = useMutation({
    mutationFn: () =>
      usuariosService.salvarOverrides(usuarioId, [
        ...overrides.map((o) => ({
          modulo: o.modulo,
          nivel: o.nivel,
          concedido: o.concedido,
        })),
        { modulo: modulo as PermissaoModulo, nivel, concedido },
      ]),
    onSuccess: () => {
      setModulo('');
      qc.invalidateQueries({ queryKey: ['admin-usuario', usuarioId] });
    },
  });

  const removerMut = useMutation({
    mutationFn: (m: PermissaoModulo) =>
      usuariosService.removerOverride(usuarioId, m),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['admin-usuario', usuarioId] }),
  });

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-dim)] rounded-sm p-6 flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-high)] mb-2">
          Perfil base
        </h3>
        {perfil ? (
          <p className="text-sm text-[var(--text-low)]">
            <Link
              to={`/admin/perfis-acesso/${perfil.id}`}
              className="text-[var(--accent)] hover:underline"
            >
              {perfil.nome}
            </Link>{' '}
            — {perfil.permissoes.length} módulo(s) configurado(s)
          </p>
        ) : (
          <p className="text-sm text-[var(--text-low)]">Sem perfil atribuído</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-high)] mb-3">
          Overrides individuais
        </h3>

        {overrides.length === 0 ? (
          <p className="text-sm text-[var(--text-low)]">
            Nenhum override. As permissões seguem o perfil base.
          </p>
        ) : (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="text-left pb-2">Módulo</th>
                <th className="text-left pb-2">Nível</th>
                <th className="text-left pb-2">Tipo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overrides.map((o) => (
                <tr
                  key={o.modulo}
                  className="border-t border-[var(--border-dim)]"
                >
                  <td className="py-2 text-[var(--text-high)]">{o.modulo}</td>
                  <td className="py-2 text-[var(--text-low)]">{o.nivel}</td>
                  <td className="py-2">
                    <span
                      className={`text-[11px] uppercase px-2 py-0.5 rounded-sm border ${
                        o.concedido
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-[var(--nc-bg)] text-[var(--nc)] border-[var(--nc-border)]'
                      }`}
                    >
                      {o.concedido ? 'Grant' : 'Deny'}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removerMut.mutate(o.modulo)}
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

        <div className="border-t border-[var(--border-dim)] pt-4 flex flex-wrap gap-2">
          <select
            value={modulo}
            onChange={(e) => setModulo(e.target.value as PermissaoModulo)}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
          >
            <option value="">Módulo…</option>
            {MODULOS.filter(
              (m) => !overrides.some((o) => o.modulo === m),
            ).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={nivel}
            onChange={(e) => setNivel(e.target.value as NivelPermissao)}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
          >
            {NIVEIS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={concedido ? 'grant' : 'deny'}
            onChange={(e) => setConcedido(e.target.value === 'grant')}
            className="bg-[var(--bg-raised)] border border-[var(--border-dim)] rounded-sm text-sm px-3 py-2 text-[var(--text-high)]"
          >
            <option value="grant">Grant</option>
            <option value="deny">Deny</option>
          </select>
          <button
            onClick={() => modulo && adicionarMut.mutate()}
            disabled={!modulo || adicionarMut.isPending}
            className="bg-[var(--accent)] text-[var(--bg-void)] font-semibold text-sm px-3 py-2 rounded-sm disabled:opacity-60"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
