import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { AtribuirPerfilDto } from './dto/atribuir-perfil.dto';
import { SalvarOverridesDto } from './dto/salvar-overrides.dto';

const CONVITE_EXPIRACAO_HORAS = 72;
const RESET_EXPIRACAO_HORAS = 1;

function gerarTokenRaw(): string {
  return crypto.randomBytes(32).toString('hex'); // 64 chars
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ───────────────────────────────────────── LISTAR

  async listar(tenantId: number) {
    return this.prisma.usuario.findMany({
      where: { tenantId, deletadoEm: null },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        status: true,
        ativo: true,
        perfilAcessoId: true,
        criadoEm: true,
        perfilAcesso: { select: { id: true, nome: true } },
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async detalhar(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
      include: {
        perfilAcesso: {
          include: { permissoes: true },
        },
        obrasLiberadas: {
          include: { obra: { select: { id: true, nome: true, codigo: true } } },
        },
        overrides: true,
      },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    // não expõe senhaHash/tokenHash
    const { senhaHash: _s, tokenHash: _t, tokenExp: _e, ...safe } = u;
    return safe;
  }

  // ───────────────────────────────────────── CRIAR (convite)

  async criarComConvite(
    tenantId: number,
    convidadoPorRole: string,
    dto: CriarUsuarioDto,
  ) {
    if (dto.role === 'SUPER_ADMIN' && convidadoPorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas SUPER_ADMIN pode criar SUPER_ADMIN');
    }

    const existente = await this.prisma.usuario.findFirst({
      where: { tenantId, email: dto.email },
    });
    if (existente) throw new ConflictException('E-mail já cadastrado');

    if (dto.perfilAcessoId) {
      const perfil = await this.prisma.perfilAcesso.findFirst({
        where: { id: dto.perfilAcessoId, tenantId, deletadoEm: null },
      });
      if (!perfil) throw new BadRequestException('Perfil de acesso inválido');
    }

    const rawToken = gerarTokenRaw();
    const tokenHash = hashToken(rawToken);
    const tokenExp = new Date(
      Date.now() + CONVITE_EXPIRACAO_HORAS * 60 * 60 * 1000,
    );

    const usuario = await this.prisma.usuario.create({
      data: {
        tenantId,
        nome: dto.nome,
        email: dto.email,
        senhaHash: '', // vazia até aceitar convite
        role: dto.role,
        status: 'PENDENTE',
        ativo: false,
        tokenHash,
        tokenExp,
        perfilAcessoId: dto.perfilAcessoId ?? null,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        status: true,
      },
    });

    await this.mail.enviarConvite(dto.email, rawToken);
    return usuario;
  }

  async reenviarConvite(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    if (u.status !== 'PENDENTE') {
      throw new BadRequestException(
        'Só é possível reenviar convite a usuários PENDENTE',
      );
    }
    const rawToken = gerarTokenRaw();
    const tokenHash = hashToken(rawToken);
    const tokenExp = new Date(
      Date.now() + CONVITE_EXPIRACAO_HORAS * 60 * 60 * 1000,
    );
    await this.prisma.usuario.update({
      where: { id },
      data: { tokenHash, tokenExp },
    });
    await this.mail.enviarConvite(u.email, rawToken);
    return { ok: true };
  }

  // ───────────────────────────────────────── EDITAR

  async atualizar(tenantId: number, id: number, dto: AtualizarUsuarioDto) {
    await this.garantirExiste(tenantId, id);

    if (dto.email) {
      const outro = await this.prisma.usuario.findFirst({
        where: { tenantId, email: dto.email, NOT: { id } },
      });
      if (outro) throw new ConflictException('E-mail já cadastrado');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      select: { id: true, nome: true, email: true, role: true, status: true },
    });
  }

  async definirAtivo(tenantId: number, id: number, ativo: boolean) {
    await this.garantirExiste(tenantId, id);
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ativo,
        status: ativo ? 'ATIVO' : 'INATIVO',
      },
      select: { id: true, ativo: true, status: true },
    });
  }

  async atribuirPerfil(tenantId: number, id: number, dto: AtribuirPerfilDto) {
    await this.garantirExiste(tenantId, id);
    if (dto.perfilAcessoId != null) {
      const p = await this.prisma.perfilAcesso.findFirst({
        where: { id: dto.perfilAcessoId, tenantId, deletadoEm: null },
      });
      if (!p) throw new BadRequestException('Perfil de acesso inválido');
    }
    return this.prisma.usuario.update({
      where: { id },
      data: { perfilAcessoId: dto.perfilAcessoId ?? null },
      select: { id: true, perfilAcessoId: true },
    });
  }

  // ───────────────────────────────────────── RESET DE SENHA (admin)

  async gerarResetSenha(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');

    const rawToken = gerarTokenRaw();
    const tokenHash = hashToken(rawToken);
    const tokenExp = new Date(
      Date.now() + RESET_EXPIRACAO_HORAS * 60 * 60 * 1000,
    );
    await this.prisma.usuario.update({
      where: { id },
      data: { tokenHash, tokenExp },
    });
    await this.mail.enviarResetSenha(u.email, rawToken);
    return { ok: true };
  }

  // ───────────────────────────────────────── USUARIO ↔ OBRA

  async listarObras(tenantId: number, usuarioId: number) {
    await this.garantirExiste(tenantId, usuarioId);
    return this.prisma.usuarioObra.findMany({
      where: { tenantId, usuarioId },
      include: { obra: { select: { id: true, nome: true, codigo: true } } },
      orderBy: { criadoEm: 'asc' },
    });
  }

  async vincularObra(tenantId: number, usuarioId: number, obraId: number) {
    await this.garantirExiste(tenantId, usuarioId);
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, tenantId, deletadoEm: null },
    });
    if (!obra) throw new BadRequestException('Obra inválida');
    try {
      return await this.prisma.usuarioObra.create({
        data: { tenantId, usuarioId, obraId },
      });
    } catch {
      throw new ConflictException('Usuário já tem acesso a esta obra');
    }
  }

  async desvincularObra(tenantId: number, usuarioId: number, obraId: number) {
    await this.garantirExiste(tenantId, usuarioId);
    await this.prisma.usuarioObra.deleteMany({
      where: { tenantId, usuarioId, obraId },
    });
    return { ok: true };
  }

  // ───────────────────────────────────────── OVERRIDES

  async listarOverrides(tenantId: number, usuarioId: number) {
    await this.garantirExiste(tenantId, usuarioId);
    return this.prisma.usuarioPermissaoOverride.findMany({
      where: { tenantId, usuarioId },
      include: {
        concedidoPor: { select: { id: true, nome: true } },
      },
      orderBy: { modulo: 'asc' },
    });
  }

  async salvarOverrides(
    tenantId: number,
    usuarioId: number,
    concedidoPorId: number,
    dto: SalvarOverridesDto,
  ) {
    await this.garantirExiste(tenantId, usuarioId);
    // Estratégia: substitui todos os overrides do usuário pelo array enviado.
    return this.prisma.$transaction([
      this.prisma.usuarioPermissaoOverride.deleteMany({
        where: { tenantId, usuarioId },
      }),
      ...dto.overrides.map((o) =>
        this.prisma.usuarioPermissaoOverride.create({
          data: {
            tenantId,
            usuarioId,
            modulo: o.modulo,
            nivel: o.nivel,
            concedido: o.concedido,
            concedidoPorId,
          },
        }),
      ),
    ]);
  }

  async removerOverride(
    tenantId: number,
    usuarioId: number,
    modulo: string,
  ) {
    await this.garantirExiste(tenantId, usuarioId);
    await this.prisma.usuarioPermissaoOverride.deleteMany({
      where: { tenantId, usuarioId, modulo: modulo as never },
    });
    return { ok: true };
  }

  // ───────────────────────────────────────── HELPERS

  private async garantirExiste(tenantId: number, id: number) {
    const u = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
      select: { id: true },
    });
    if (!u) throw new NotFoundException('Usuário não encontrado');
  }
}
