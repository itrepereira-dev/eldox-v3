import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * ObraGuard — valida que o usuário tem acesso à obra cujo id vem como param
 * `:id`, `:obraId` ou `:obra_id`. Aplicar em endpoints que recebem obraId
 * na URL.
 *
 * Regras:
 *   - ADMIN_TENANT e SUPER_ADMIN → acesso a todas as obras do tenant
 *   - Demais roles → precisa haver registro em usuario_obras (usuarioId, obraId)
 *
 * NÃO verifica que a obra pertence ao tenant — isso é responsabilidade dos
 * services (todos filtram por `tenantId`). O guard só adiciona a camada de
 * acesso por obra.
 */
@Injectable()
export class ObraGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    if (user.role === 'ADMIN_TENANT' || user.role === 'SUPER_ADMIN') {
      return true;
    }

    const params = req.params ?? {};
    const raw = params.obraId ?? params.obra_id ?? params.id;
    if (raw === undefined) return true; // rota sem param de obra → não aplica

    const obraId = parseInt(raw, 10);
    if (Number.isNaN(obraId)) {
      throw new ForbiddenException('obraId inválido');
    }

    const vinculado = await this.prisma.usuarioObra.findUnique({
      where: { usuarioId_obraId: { usuarioId: user.id, obraId } },
    });
    if (!vinculado) {
      throw new ForbiddenException('Sem acesso a esta obra');
    }
    return true;
  }
}
