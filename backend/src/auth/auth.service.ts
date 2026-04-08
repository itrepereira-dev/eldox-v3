import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTenantDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterTenantDto) {
    const slugExiste = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (slugExiste) throw new ConflictException('Slug já está em uso');

    const emailExiste = await this.prisma.usuario.findFirst({
      where: { email: dto.adminEmail },
    });
    if (emailExiste) throw new ConflictException('E-mail já está em uso');

    // Busca plano starter (padrão)
    const plano = await this.prisma.plano.findUnique({ where: { nome: 'starter' } });
    if (!plano) throw new Error('Plano starter não encontrado — execute o seed');

    const senhaHash = await bcrypt.hash(dto.adminSenha, 12);

    const tenant = await this.prisma.tenant.create({
      data: {
        nome: dto.tenantNome,
        slug: dto.tenantSlug,
        planoId: plano.id,
        usuarios: {
          create: {
            nome: dto.adminNome,
            email: dto.adminEmail,
            senhaHash,
            role: 'ADMIN_TENANT',
          },
        },
      },
      include: { usuarios: true },
    });

    const usuario = tenant.usuarios[0];
    const token = this.gerarToken(usuario.id, tenant.id, usuario.role, plano.nome);
    const refreshToken = this.gerarRefreshToken(usuario.id, tenant.id);

    return { token, refreshToken, tenantSlug: tenant.slug, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role } };
  }

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
      include: { plano: true },
    });
    if (!tenant || !tenant.ativo) throw new UnauthorizedException('Tenant não encontrado ou inativo');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tenantId: tenant.id, email: dto.email, ativo: true, deletadoEm: null },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    const token = this.gerarToken(usuario.id, tenant.id, usuario.role, tenant.plano.nome);
    const refreshToken = this.gerarRefreshToken(usuario.id, tenant.id);

    return {
      token,
      refreshToken,
      tenantSlug: tenant.slug,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      }) as { sub: number; tenantId: number; type: string };

      if (payload.type !== 'refresh') throw new UnauthorizedException();

      const usuario = await this.prisma.usuario.findFirst({
        where: { id: payload.sub, tenantId: payload.tenantId, ativo: true, deletadoEm: null },
        include: { tenant: { include: { plano: true } } },
      });
      if (!usuario) throw new UnauthorizedException('Usuário não encontrado');

      const token = this.gerarToken(usuario.id, usuario.tenantId, usuario.role, usuario.tenant.plano.nome);
      const novoRefreshToken = this.gerarRefreshToken(usuario.id, usuario.tenantId);

      return { token, refreshToken: novoRefreshToken };
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  private gerarToken(userId: number, tenantId: number, role: string, plano: string) {
    return this.jwt.sign(
      { sub: userId, tenantId, role, plano },
      { expiresIn: this.config.get('JWT_EXPIRES_IN', '8h') },
    );
  }

  private gerarRefreshToken(userId: number, tenantId: number) {
    return this.jwt.sign(
      { sub: userId, tenantId, type: 'refresh' },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      },
    );
  }
}
