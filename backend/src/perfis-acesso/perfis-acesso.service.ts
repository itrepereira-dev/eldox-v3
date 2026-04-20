import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPerfilDto } from './dto/criar-perfil.dto';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { SalvarPermissoesDto } from './dto/salvar-permissoes.dto';

@Injectable()
export class PerfisAcessoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(tenantId: number) {
    return this.prisma.perfilAcesso.findMany({
      where: { tenantId, deletadoEm: null },
      include: {
        _count: { select: { usuarios: true, permissoes: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  async detalhar(tenantId: number, id: number) {
    const p = await this.prisma.perfilAcesso.findFirst({
      where: { id, tenantId, deletadoEm: null },
      include: { permissoes: true },
    });
    if (!p) throw new NotFoundException('Perfil não encontrado');
    return p;
  }

  async criar(tenantId: number, dto: CriarPerfilDto) {
    try {
      return await this.prisma.perfilAcesso.create({
        data: {
          tenantId,
          nome: dto.nome,
          descricao: dto.descricao ?? null,
        },
      });
    } catch {
      throw new ConflictException('Já existe perfil com este nome');
    }
  }

  async atualizar(tenantId: number, id: number, dto: AtualizarPerfilDto) {
    await this.garantirExiste(tenantId, id);
    return this.prisma.perfilAcesso.update({
      where: { id },
      data: dto,
    });
  }

  async desativar(tenantId: number, id: number) {
    await this.garantirExiste(tenantId, id);
    return this.prisma.perfilAcesso.update({
      where: { id },
      data: { deletadoEm: new Date(), ativo: false },
    });
  }

  async salvarPermissoes(
    tenantId: number,
    id: number,
    dto: SalvarPermissoesDto,
  ) {
    await this.garantirExiste(tenantId, id);
    return this.prisma.$transaction([
      this.prisma.perfilPermissao.deleteMany({ where: { perfilAcessoId: id } }),
      ...dto.permissoes.map((p) =>
        this.prisma.perfilPermissao.create({
          data: {
            perfilAcessoId: id,
            modulo: p.modulo,
            nivel: p.nivel,
          },
        }),
      ),
    ]);
  }

  private async garantirExiste(tenantId: number, id: number) {
    const p = await this.prisma.perfilAcesso.findFirst({
      where: { id, tenantId, deletadoEm: null },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Perfil não encontrado');
  }
}
