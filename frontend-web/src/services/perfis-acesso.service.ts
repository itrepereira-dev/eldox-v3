import { api } from './api';
import type { NivelPermissao, PermissaoModulo } from './usuarios.service';

export interface PerfilAcessoLista {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
  _count: { usuarios: number; permissoes: number };
}

export interface PerfilAcessoDetalhe {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  criadoEm: string;
  permissoes: Array<{
    id: number;
    modulo: PermissaoModulo;
    nivel: NivelPermissao;
  }>;
}

export const perfisAcessoService = {
  listar: () =>
    api.get<PerfilAcessoLista[]>('/perfis-acesso').then((r) => r.data),

  detalhar: (id: number) =>
    api
      .get<PerfilAcessoDetalhe>(`/perfis-acesso/${id}`)
      .then((r) => r.data),

  criar: (dto: { nome: string; descricao?: string }) =>
    api.post('/perfis-acesso', dto).then((r) => r.data),

  atualizar: (id: number, dto: { nome?: string; descricao?: string }) =>
    api.patch(`/perfis-acesso/${id}`, dto).then((r) => r.data),

  desativar: (id: number) =>
    api.delete(`/perfis-acesso/${id}`).then((r) => r.data),

  salvarPermissoes: (
    id: number,
    permissoes: Array<{
      modulo: PermissaoModulo;
      nivel: NivelPermissao;
    }>,
  ) =>
    api
      .put(`/perfis-acesso/${id}/permissoes`, { permissoes })
      .then((r) => r.data),
};
