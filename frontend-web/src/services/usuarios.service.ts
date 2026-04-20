import { api } from './api';

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN_TENANT'
  | 'ENGENHEIRO'
  | 'TECNICO'
  | 'LABORATORIO'
  | 'VISITANTE';

export type StatusUsuario = 'PENDENTE' | 'ATIVO' | 'INATIVO';

export type PermissaoModulo =
  | 'CONCRETAGEM'
  | 'NC'
  | 'RO'
  | 'LAUDOS'
  | 'OBRAS'
  | 'USUARIOS'
  | 'RELATORIOS';

export type NivelPermissao =
  | 'VISUALIZAR'
  | 'OPERAR'
  | 'APROVAR'
  | 'ADMINISTRAR';

export interface UsuarioLista {
  id: number;
  nome: string;
  email: string;
  role: Role;
  status: StatusUsuario;
  ativo: boolean;
  perfilAcessoId: number | null;
  perfilAcesso: { id: number; nome: string } | null;
  criadoEm: string;
}

export interface Override {
  id: number;
  modulo: PermissaoModulo;
  nivel: NivelPermissao;
  concedido: boolean;
  concedidoPor?: { id: number; nome: string };
  criadoEm: string;
}

export interface UsuarioDetalhe extends UsuarioLista {
  obrasLiberadas: Array<{
    id: number;
    obraId: number;
    obra: { id: number; nome: string; codigo: string | null };
  }>;
  overrides: Override[];
  perfilAcesso:
    | {
        id: number;
        nome: string;
        permissoes: Array<{
          modulo: PermissaoModulo;
          nivel: NivelPermissao;
        }>;
      }
    | null;
}

export const usuariosService = {
  listar: () =>
    api.get<UsuarioLista[]>('/usuarios').then((r) => r.data),

  detalhar: (id: number) =>
    api.get<UsuarioDetalhe>(`/usuarios/${id}`).then((r) => r.data),

  criar: (dto: {
    email: string;
    nome: string;
    role: Role;
    perfilAcessoId?: number;
  }) => api.post('/usuarios', dto).then((r) => r.data),

  atualizar: (
    id: number,
    dto: { nome?: string; email?: string; role?: Role },
  ) => api.patch(`/usuarios/${id}`, dto).then((r) => r.data),

  definirAtivo: (id: number, ativo: boolean) =>
    api.patch(`/usuarios/${id}/ativo`, { ativo }).then((r) => r.data),

  atribuirPerfil: (id: number, perfilAcessoId: number | null) =>
    api
      .patch(`/usuarios/${id}/perfil`, { perfilAcessoId })
      .then((r) => r.data),

  reenviarConvite: (id: number) =>
    api.post(`/usuarios/${id}/reenviar-convite`).then((r) => r.data),

  resetSenha: (id: number) =>
    api.post(`/usuarios/${id}/reset-senha`).then((r) => r.data),

  listarObras: (id: number) =>
    api.get(`/usuarios/${id}/obras`).then((r) => r.data),

  vincularObra: (id: number, obraId: number) =>
    api.post(`/usuarios/${id}/obras`, { obraId }).then((r) => r.data),

  desvincularObra: (id: number, obraId: number) =>
    api.delete(`/usuarios/${id}/obras/${obraId}`).then((r) => r.data),

  listarOverrides: (id: number) =>
    api.get<Override[]>(`/usuarios/${id}/permissoes`).then((r) => r.data),

  salvarOverrides: (
    id: number,
    overrides: Array<{
      modulo: PermissaoModulo;
      nivel: NivelPermissao;
      concedido: boolean;
    }>,
  ) =>
    api
      .patch(`/usuarios/${id}/permissoes`, { overrides })
      .then((r) => r.data),

  removerOverride: (id: number, modulo: PermissaoModulo) =>
    api.delete(`/usuarios/${id}/permissoes/${modulo}`).then((r) => r.data),
};
