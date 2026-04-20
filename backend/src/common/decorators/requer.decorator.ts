import { SetMetadata } from '@nestjs/common';
import { NivelPermissao, PermissaoModulo } from '@prisma/client';

export const REQUER_KEY = 'requer_permissao';

export interface RequerPermissao {
  modulo: PermissaoModulo;
  nivel: NivelPermissao;
}

/**
 * @Requer — marca endpoint que exige permissão granular por módulo + nível.
 *
 * Resolução (ver PermissaoGuard):
 *   1. ADMIN_TENANT / SUPER_ADMIN → passa sempre
 *   2. usuario_permissao_overrides → grant/deny explícito sobrepõe perfil
 *   3. perfil_permissoes via perfil_acesso_id → verifica nível hierárquico
 *   4. Nenhum match → 403
 *
 * Uso:
 *   @Requer('CONCRETAGEM', 'OPERAR')
 *   @Post()
 *   createConcretagem() { ... }
 */
export const Requer = (modulo: PermissaoModulo, nivel: NivelPermissao) =>
  SetMetadata(REQUER_KEY, { modulo, nivel } satisfies RequerPermissao);
