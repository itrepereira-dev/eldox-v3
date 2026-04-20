import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterTenantDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AceitarConviteDto } from './dto/aceitar-convite.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { ResetSenhaDto } from './dto/reset-senha.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const RESET_EXPIRACAO_MS = 60 * 60 * 1000; // 1h

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function gerarTokenRaw(): string {
  return crypto.randomBytes(32).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
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
    const plano = await this.prisma.plano.findUnique({
      where: { nome: 'starter' },
    });
    if (!plano)
      throw new Error('Plano starter não encontrado — execute o seed');

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
    const token = this.gerarToken(
      usuario.id,
      tenant.id,
      usuario.role,
      plano.nome,
    );
    const refreshToken = this.gerarRefreshToken(usuario.id, tenant.id);

    return {
      token,
      refreshToken,
      tenantSlug: tenant.slug,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
      include: { plano: true },
    });
    if (!tenant || !tenant.ativo)
      throw new UnauthorizedException('Tenant não encontrado ou inativo');

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email,
        ativo: true,
        deletadoEm: null,
      },
    });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');
    if (usuario.status === 'PENDENTE') {
      throw new UnauthorizedException(
        'Cadastro pendente — verifique o e-mail de convite',
      );
    }
    if (usuario.status === 'INATIVO') {
      throw new UnauthorizedException('Usuário inativo');
    }

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    const token = this.gerarToken(
      usuario.id,
      tenant.id,
      usuario.role,
      tenant.plano.nome,
    );
    const refreshToken = this.gerarRefreshToken(usuario.id, tenant.id);

    return {
      token,
      refreshToken,
      tenantSlug: tenant.slug,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get('JWT_SECRET'),
      });

      if (payload.type !== 'refresh') throw new UnauthorizedException();

      const usuario = await this.prisma.usuario.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
          ativo: true,
          deletadoEm: null,
        },
        include: { tenant: { include: { plano: true } } },
      });
      if (!usuario) throw new UnauthorizedException('Usuário não encontrado');

      const token = this.gerarToken(
        usuario.id,
        usuario.tenantId,
        usuario.role,
        usuario.tenant.plano.nome,
      );
      const novoRefreshToken = this.gerarRefreshToken(
        usuario.id,
        usuario.tenantId,
      );

      return { token, refreshToken: novoRefreshToken };
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  // ───────────────────────────────────────── CONVITE / RESET

  async aceitarConvite(dto: AceitarConviteDto) {
    const tokenHash = hashToken(dto.token);
    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenHash, deletadoEm: null },
    });
    if (!usuario || !usuario.tokenExp || usuario.tokenExp < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }
    if (usuario.status !== 'PENDENTE') {
      throw new BadRequestException('Convite já utilizado');
    }
    const senhaHash = await bcrypt.hash(dto.senha, 12);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        nome: dto.nome,
        senhaHash,
        status: 'ATIVO',
        ativo: true,
        tokenHash: null,
        tokenExp: null,
      },
    });
    return { ok: true };
  }

  async esqueciSenha(dto: EsqueciSenhaDto) {
    // Sempre responde 200 — não revela se email existe
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (!tenant || !tenant.ativo) return { ok: true };
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        tenantId: tenant.id,
        email: dto.email,
        ativo: true,
        deletadoEm: null,
        status: 'ATIVO',
      },
    });
    if (!usuario) return { ok: true };

    const raw = gerarTokenRaw();
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        tokenHash: hashToken(raw),
        tokenExp: new Date(Date.now() + RESET_EXPIRACAO_MS),
      },
    });
    await this.mail.enviarResetSenha(usuario.email, raw);
    return { ok: true };
  }

  async resetSenha(dto: ResetSenhaDto) {
    const tokenHash = hashToken(dto.token);
    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenHash, deletadoEm: null },
    });
    if (!usuario || !usuario.tokenExp || usuario.tokenExp < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }
    const senhaHash = await bcrypt.hash(dto.novaSenha, 12);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        tokenHash: null,
        tokenExp: null,
        // Se estava PENDENTE (convite), ativa mesmo em reset
        status: 'ATIVO',
        ativo: true,
      },
    });
    return { ok: true };
  }

  private gerarToken(
    userId: number,
    tenantId: number,
    role: string,
    plano: string,
  ) {
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
