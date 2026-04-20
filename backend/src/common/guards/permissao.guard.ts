import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUER_KEY, RequerPermissao } from '../decorators/requer.decorator';
import { PermissoesResolverService } from '../services/permissoes-resolver.service';

/**
 * PermissaoGuard — usa com `@Requer(modulo, nivel)` nos endpoints.
 *
 * Se o endpoint não declarar `@Requer`, o guard passa (deixa para outros
 * guards decidirem). Combinar com `@UseGuards(JwtAuthGuard, PermissaoGuard)`
 * ou aplicar via `@UseGuards(JwtAuthGuard, RolesGuard, PermissaoGuard)`.
 */
@Injectable()
export class PermissaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: PermissoesResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requer = this.reflector.getAllAndOverride<RequerPermissao>(
      REQUER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requer) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    return this.resolver.pode(user.id, user.role, requer.modulo, requer.nivel);
  }
}
