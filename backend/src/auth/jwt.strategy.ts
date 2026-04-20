import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: number;
    tenantId: number;
    originalTenantId?: number;
    role: string;
    plano: string;
    v?: number;
    impersonating?: boolean;
  }) {
    // Se impersonando, o usuário vive no tenant sentinel (originalTenantId).
    // payload.tenantId é o tenant ALVO — retornado via @TenantId() para queries.
    const lookupTenantId = payload.originalTenantId ?? payload.tenantId;

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        tenantId: lookupTenantId,
        ativo: true,
        deletadoEm: null,
      },
      select: { id: true, tokenVersion: true },
    });

    if (!usuario)
      throw new UnauthorizedException('Usuário não encontrado ou inativo');

    // payload.v ausente = token assinado antes da feature — aceitar (grace).
    if (payload.v !== undefined && payload.v !== usuario.tokenVersion) {
      throw new UnauthorizedException('Token revogado — faça login novamente');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      originalTenantId: payload.originalTenantId,
      role: payload.role,
      plano: payload.plano,
      impersonating: payload.impersonating ?? false,
    };
  }
}
