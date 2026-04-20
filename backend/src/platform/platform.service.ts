import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';

export const PLATFORM_TENANT_SLUG = 'platform';
const IMPERSONATE_TTL = '1h';

/**
 * PlatformService — operações privilegiadas cross-tenant para a chave mestra.
 *
 * Modelo:
 *   - Usuários com role=SUPER_ADMIN vivem no tenant sentinel com slug="platform".
 *   - Tenant isolation natural já esconde eles dos outros tenants
 *     (GET /usuarios filtra por tenantId do chamador).
 *   - Para operar dentro de um tenant cliente, chama-se /platform/impersonate
 *     que devolve um JWT novo assinado com o tenantId alvo + claim
 *     `impersonating: true` + `originalTenantId: <platform>`.
 *   - JwtStrategy usa originalTenantId para validar que o usuário existe
 *     (ele está no platform); @TenantId() retorna tenantId para as queries
 *     do tenant alvo.
 */
@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Garante que o chamador pertence ao tenant sentinel `platform`.
   * Role SUPER_ADMIN em outros tenants NÃO é suficiente — estes podem
   * administrar o próprio tenant mas não operar cross-tenant.
   */
  private async exigirTenantPlatform(user: {
    id: number;
    originalTenantId?: number;
    tenantId: number;
  }) {
    // Quando impersonando, tenantId é o alvo e originalTenantId é platform.
    const realTenantId = user.originalTenantId ?? user.tenantId;
    const t = await this.prisma.tenant.findUnique({
      where: { id: realTenantId },
      select: { slug: true },
    });
    if (t?.slug !== PLATFORM_TENANT_SLUG) {
      throw new ForbiddenException(
        'Acesso restrito ao tenant platform',
      );
    }
  }

  async listarTenants(user: {
    id: number;
    originalTenantId?: number;
    tenantId: number;
  }) {
    await this.exigirTenantPlatform(user);
    // Exclui o tenant "platform" da lista — ele é sentinel interno.
    return this.prisma.tenant.findMany({
      where: {
        slug: { not: PLATFORM_TENANT_SLUG },
        deletadoEm: null,
      },
      select: {
        id: true,
        nome: true,
        slug: true,
        ativo: true,
        criadoEm: true,
        plano: { select: { nome: true } },
        _count: { select: { usuarios: true, obras: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async impersonate(
    masterUser: {
      id: number;
      tenantId: number;
      originalTenantId?: number;
      role: string;
    },
    tenantAlvoId: number,
  ) {
    await this.exigirTenantPlatform(masterUser);
    if (masterUser.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas SUPER_ADMIN pode impersonar');
    }
    if (masterUser.originalTenantId !== undefined) {
      throw new ForbiddenException(
        'Não é permitido impersonar durante uma sessão de impersonation ativa',
      );
    }
    const tenantAlvo = await this.prisma.tenant.findFirst({
      where: { id: tenantAlvoId, deletadoEm: null },
      include: { plano: true },
    });
    if (!tenantAlvo) throw new NotFoundException('Tenant não encontrado');

    // Busca tokenVersion atual pra assinar o JWT correto
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: masterUser.id },
      select: { tokenVersion: true },
    });
    if (!usuario) throw new NotFoundException('Usuário master não encontrado');

    const masterTenantId =
      masterUser.originalTenantId ?? masterUser.tenantId;
    const payload = {
      sub: masterUser.id,
      tenantId: tenantAlvo.id, // << @TenantId() vai retornar esse
      originalTenantId: masterTenantId, // << JwtStrategy valida com esse
      role: 'SUPER_ADMIN' as const,
      plano: tenantAlvo.plano.nome,
      v: usuario.tokenVersion,
      impersonating: true,
    };
    const token = this.jwt.sign(payload, {
      expiresIn: IMPERSONATE_TTL,
    });

    await this.audit.log({
      tenantId: tenantAlvo.id,
      usuarioId: masterUser.id,
      acao: 'IMPERSONATE_START',
      entidade: 'platform',
      entidadeId: tenantAlvo.id,
      detalhes: {
        tenantAlvo: { id: tenantAlvo.id, slug: tenantAlvo.slug },
        fromTenantId: masterTenantId,
        ttl: IMPERSONATE_TTL,
      },
    });

    return {
      token,
      expiresIn: IMPERSONATE_TTL,
      tenant: {
        id: tenantAlvo.id,
        nome: tenantAlvo.nome,
        slug: tenantAlvo.slug,
      },
    };
  }
}
