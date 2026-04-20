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
    role: string;
    plano: string;
    v?: number;
  }) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        ativo: true,
        deletadoEm: null,
      },
      select: { id: true, tokenVersion: true },
    });

    if (!usuario)
      throw new UnauthorizedException('Usuário não encontrado ou inativo');

    // payload.v ausente = token assinado antes da feature — aceitar (grace).
    // Quando v presente, exige match com DB.
    if (payload.v !== undefined && payload.v !== usuario.tokenVersion) {
      throw new UnauthorizedException('Token revogado — faça login novamente');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      plano: payload.plano,
    };
  }
}
