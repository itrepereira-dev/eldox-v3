import { Injectable } from '@nestjs/common';
import { NivelPermissao, PermissaoModulo } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Ordem hierárquica (índice = peso). VISUALIZAR mais baixo, ADMINISTRAR mais alto.
const NIVEL_ORDER: readonly NivelPermissao[] = [
  'VISUALIZAR',
  'OPERAR',
  'APROVAR',
  'ADMINISTRAR',
] as const;

function peso(n: NivelPermissao): number {
  return NIVEL_ORDER.indexOf(n);
}

/**
 * PermissoesResolverService — centraliza a resolução de permissões de um
 * usuário. Usado pelo PermissaoGuard (checar um módulo/nível específico) e
 * pelo endpoint GET /auth/me/permissoes (mapa completo para o frontend).
 *
 * Regras (cf. spec 2026-04-16):
 *   1. Se role = ADMIN_TENANT ou SUPER_ADMIN → tem acesso total em qualquer
 *      módulo.
 *   2. Senão: verifica override individual. Se existe, decide por `concedido`.
 *   3. Senão: verifica perfil de acesso. Se existe registro de permissão
 *      para o módulo e nivelAtribuido ≥ nivelRequerido → permite.
 *   4. Nada → nega.
 */
@Injectable()
export class PermissoesResolverService {
  constructor(private readonly prisma: PrismaService) {}

  isAdminGlobal(role: string): boolean {
    return role === 'ADMIN_TENANT' || role === 'SUPER_ADMIN';
  }

  async pode(
    usuarioId: number,
    role: string,
    modulo: PermissaoModulo,
    nivelRequerido: NivelPermissao,
  ): Promise<boolean> {
    if (this.isAdminGlobal(role)) return true;

    const override = await this.prisma.usuarioPermissaoOverride.findUnique({
      where: { usuarioId_modulo: { usuarioId, modulo } },
    });
    if (override) {
      if (!override.concedido) return false;
      return peso(override.nivel) >= peso(nivelRequerido);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { perfilAcessoId: true },
    });
    if (!usuario?.perfilAcessoId) return false;

    const perm = await this.prisma.perfilPermissao.findUnique({
      where: {
        perfilAcessoId_modulo: {
          perfilAcessoId: usuario.perfilAcessoId,
          modulo,
        },
      },
    });
    if (!perm) return false;

    return peso(perm.nivel) >= peso(nivelRequerido);
  }

  /**
   * Retorna o mapa completo de nível resolvido por módulo para o usuário.
   * Valor null = sem acesso ao módulo.
   * Para ADMIN_TENANT/SUPER_ADMIN retorna ADMINISTRAR em tudo.
   */
  async mapaPermissoes(
    usuarioId: number,
    role: string,
  ): Promise<Record<PermissaoModulo, NivelPermissao | null>> {
    const modulos: PermissaoModulo[] = [
      'CONCRETAGEM',
      'NC',
      'RO',
      'LAUDOS',
      'OBRAS',
      'USUARIOS',
      'RELATORIOS',
    ];

    if (this.isAdminGlobal(role)) {
      return Object.fromEntries(
        modulos.map((m) => [m, 'ADMINISTRAR' as NivelPermissao]),
      ) as Record<PermissaoModulo, NivelPermissao>;
    }

    const [overrides, usuario] = await Promise.all([
      this.prisma.usuarioPermissaoOverride.findMany({ where: { usuarioId } }),
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { perfilAcessoId: true },
      }),
    ]);

    const perfilPerms = usuario?.perfilAcessoId
      ? await this.prisma.perfilPermissao.findMany({
          where: { perfilAcessoId: usuario.perfilAcessoId },
        })
      : [];

    const mapa = {} as Record<PermissaoModulo, NivelPermissao | null>;
    for (const m of modulos) {
      const ov = overrides.find((o) => o.modulo === m);
      if (ov) {
        mapa[m] = ov.concedido ? ov.nivel : null;
        continue;
      }
      const pp = perfilPerms.find((p) => p.modulo === m);
      mapa[m] = pp ? pp.nivel : null;
    }
    return mapa;
  }
}
