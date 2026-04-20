import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/services/api';
import type {
  NivelPermissao,
  PermissaoModulo,
} from '@/services/usuarios.service';
import { useAuthStore } from '@/store/auth.store';

const NIVEL_ORDER: readonly NivelPermissao[] = [
  'VISUALIZAR',
  'OPERAR',
  'APROVAR',
  'ADMINISTRAR',
];

function peso(n: NivelPermissao): number {
  return NIVEL_ORDER.indexOf(n);
}

/**
 * usePermissao — busca (e cacheia por 5min) o mapa de permissões resolvido do
 * usuário logado em /auth/me/permissoes e expõe helper `pode(modulo, nivel)`.
 *
 * Uso:
 *   const { pode, isAdmin } = usePermissao();
 *   if (pode('CONCRETAGEM', 'OPERAR')) { ... }
 */
export function usePermissao() {
  const user = useAuthStore((s) => s.user);

  const { data: mapa } = useQuery({
    queryKey: ['me-permissoes', user?.id],
    queryFn: () =>
      authApi.mePermissoes() as Promise<
        Record<PermissaoModulo, NivelPermissao | null>
      >,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isAdmin =
    user?.role === 'ADMIN_TENANT' || user?.role === 'SUPER_ADMIN';

  function pode(modulo: PermissaoModulo, nivel: NivelPermissao): boolean {
    if (isAdmin) return true;
    const nivelAtual = mapa?.[modulo];
    if (!nivelAtual) return false;
    return peso(nivelAtual) >= peso(nivel);
  }

  return { pode, isAdmin, mapa: mapa ?? null };
}
