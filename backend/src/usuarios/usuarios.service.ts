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
import { AuditLogService } from '../common/services/audit-log.service';
import { normalizarEmail } from '../common/decorators/senha-forte.decorator';
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
    private readonly audit: AuditLogService,
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
    convidadoPorId: number,
    convidadoPorRole: string,
    dto: CriarUsuarioDto,
  ) {
    if (dto.role === 'SUPER_ADMIN' && convidadoPorRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas SUPER_ADMIN pode criar SUPER_ADMIN');
    }

    const email = normalizarEmail(dto.email);
    const existente = await this.prisma.usuario.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
      },
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
        email,
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

    await this.mail.enviarConvite(email, rawToken);
    await this.audit.log({
      tenantId,
      usuarioId: convidadoPorId,
      acao: 'CONVITE_CRIADO',
      entidade: 'usuario',
      entidadeId: usuario.id,
      dadosDepois: {
        email: usuario.email,
        role: usuario.role,
        perfilAcessoId: dto.perfilAcessoId ?? null,
      },
    });
    return usuario;
  }

  async reenviarConvite(tenantId: number, id: number, porUsuarioId: number) {
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
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'CONVITE_REENVIADO',
      entidade: 'usuario',
      entidadeId: id,
    });
    return { ok: true };
  }

  // ───────────────────────────────────────── EDITAR

  async atualizar(
    tenantId: number,
    id: number,
    porUsuarioId: number,
    dto: AtualizarUsuarioDto,
  ) {
    const antes = await this.prisma.usuario.findFirst({
      where: { id, tenantId, deletadoEm: null },
      select: { id: true, nome: true, email: true, role: true },
    });
    if (!antes) throw new NotFoundException('Usuário não encontrado');

    const dtoNormalizado = dto.email
      ? { ...dto, email: normalizarEmail(dto.email) }
      : dto;
    if (dtoNormalizado.email) {
      const outro = await this.prisma.usuario.findFirst({
        where: {
          tenantId,
          email: { equals: dtoNormalizado.email, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (outro) throw new ConflictException('E-mail já cadastrado');
    }

    const atualizado = await this.prisma.usuario.update({
      where: { id },
      data: dtoNormalizado,
      select: { id: true, nome: true, email: true, role: true, status: true },
    });
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'USUARIO_ATUALIZADO',
      entidade: 'usuario',
      entidadeId: id,
      dadosAntes: antes,
      dadosDepois: atualizado,
    });
    return atualizado;
  }

  async definirAtivo(
    tenantId: number,
    id: number,
    porUsuarioId: number,
    ativo: boolean,
  ) {
    await this.garantirExiste(tenantId, id);
    const atualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ativo,
        status: ativo ? 'ATIVO' : 'INATIVO',
        // Desativação revoga tokens em voo; reativação não precisa.
        ...(ativo ? {} : { tokenVersion: { increment: 1 } }),
      },
      select: { id: true, ativo: true, status: true },
    });
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO',
      entidade: 'usuario',
      entidadeId: id,
    });
    return atualizado;
  }

  async atribuirPerfil(
    tenantId: number,
    id: number,
    porUsuarioId: number,
    dto: AtribuirPerfilDto,
  ) {
    await this.garantirExiste(tenantId, id);
    if (dto.perfilAcessoId != null) {
      const p = await this.prisma.perfilAcesso.findFirst({
        where: { id: dto.perfilAcessoId, tenantId, deletadoEm: null },
      });
      if (!p) throw new BadRequestException('Perfil de acesso inválido');
    }
    const atualizado = await this.prisma.usuario.update({
      where: { id },
      data: { perfilAcessoId: dto.perfilAcessoId ?? null },
      select: { id: true, perfilAcessoId: true },
    });
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'PERFIL_ATRIBUIDO',
      entidade: 'usuario',
      entidadeId: id,
      detalhes: { perfilAcessoId: dto.perfilAcessoId ?? null },
    });
    return atualizado;
  }

  // ───────────────────────────────────────── RESET DE SENHA (admin)

  async gerarResetSenha(
    tenantId: number,
    id: number,
    porUsuarioId: number,
  ) {
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
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'RESET_SENHA_SOLICITADO',
      entidade: 'usuario',
      entidadeId: id,
      detalhes: { origem: 'admin' },
    });
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

  async vincularObra(
    tenantId: number,
    usuarioId: number,
    porUsuarioId: number,
    obraId: number,
  ) {
    await this.garantirExiste(tenantId, usuarioId);
    const obra = await this.prisma.obra.findFirst({
      where: { id: obraId, tenantId, deletadoEm: null },
    });
    if (!obra) throw new BadRequestException('Obra inválida');
    let row: unknown;
    try {
      row = await this.prisma.usuarioObra.create({
        data: { tenantId, usuarioId, obraId },
      });
    } catch {
      throw new ConflictException('Usuário já tem acesso a esta obra');
    }
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'OBRA_LIBERADA',
      entidade: 'usuario_obra',
      entidadeId: usuarioId,
      detalhes: { obraId },
    });
    return row;
  }

  async desvincularObra(
    tenantId: number,
    usuarioId: number,
    porUsuarioId: number,
    obraId: number,
  ) {
    await this.garantirExiste(tenantId, usuarioId);
    await this.prisma.usuarioObra.deleteMany({
      where: { tenantId, usuarioId, obraId },
    });
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'OBRA_REVOGADA',
      entidade: 'usuario_obra',
      entidadeId: usuarioId,
      detalhes: { obraId },
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
    const result = await this.prisma.$transaction([
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
    await this.audit.log({
      tenantId,
      usuarioId: concedidoPorId,
      acao: 'OVERRIDES_SALVOS',
      entidade: 'usuario',
      entidadeId: usuarioId,
      dadosDepois: { overrides: dto.overrides },
    });
    return result;
  }

  async removerOverride(
    tenantId: number,
    usuarioId: number,
    porUsuarioId: number,
    modulo: string,
  ) {
    await this.garantirExiste(tenantId, usuarioId);
    await this.prisma.usuarioPermissaoOverride.deleteMany({
      where: { tenantId, usuarioId, modulo: modulo as never },
    });
    await this.audit.log({
      tenantId,
      usuarioId: porUsuarioId,
      acao: 'OVERRIDE_REMOVIDO',
      entidade: 'usuario',
      entidadeId: usuarioId,
      detalhes: { modulo },
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
