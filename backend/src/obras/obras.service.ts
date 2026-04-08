import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { CreateObraLocalDto } from './dto/create-obra-local.dto';
import { UpdateObraLocalDto } from './dto/update-obra-local.dto';
import { GerarMassaDto } from './dto/gerar-massa.dto';
import { CreateObraTipoDto } from './dto/create-obra-tipo.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ObrasService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────
  // OBRA TIPOS
  // ─────────────────────────────────────────

  async findAllTipos(tenantId: number) {
    return this.prisma.obraTipo.findMany({
      where: {
        OR: [{ tenantId: 0 }, { tenantId }],
        deletadoEm: null,
        ativo: true,
      },
      include: { niveis: { orderBy: { numero: 'asc' } } },
      orderBy: [{ tenantId: 'asc' }, { nome: 'asc' }],
    });
  }

  async createTipo(tenantId: number, dto: CreateObraTipoDto) {
    const existente = await this.prisma.obraTipo.findUnique({
      where: { tenantId_slug: { tenantId, slug: dto.slug } },
    });
    if (existente) throw new BadRequestException('Slug já em uso neste tenant');

    return this.prisma.obraTipo.create({
      data: {
        tenantId,
        nome: dto.nome,
        slug: dto.slug,
        descricao: dto.descricao,
        totalNiveis: dto.totalNiveis,
        niveis: {
          create: dto.niveis.map((n) => ({
            numero: n.numero,
            labelSingular: n.labelSingular,
            labelPlural: n.labelPlural,
            geracaoEmMassa: n.geracaoEmMassa ?? false,
            prefixoPadrao: n.prefixoPadrao,
          })),
        },
      },
      include: { niveis: { orderBy: { numero: 'asc' } } },
    });
  }

  // ─────────────────────────────────────────
  // OBRAS — CRUD
  // ─────────────────────────────────────────

  async findAll(
    tenantId: number,
    params: { status?: string; page?: number; limit?: number },
  ) {
    const { status, page = 1, limit = 20 } = params;
    const limitEfetivo = Math.min(limit, 100);
    const skip = (page - 1) * limitEfetivo;

    const where: Prisma.ObraWhereInput = {
      tenantId,
      deletadoEm: null,
      ...(status && { status: status as any }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.obra.findMany({
        where,
        include: {
          obraTipo: { select: { id: true, nome: true, slug: true } },
          _count: { select: { locais: { where: { deletadoEm: null } } } },
        },
        orderBy: { criadoEm: 'desc' },
        skip,
        take: limitEfetivo,
      }),
      this.prisma.obra.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        ...o,
        totalLocais: o._count.locais,
        _count: undefined,
      })),
      total,
      page,
      limit: limitEfetivo,
      totalPages: Math.ceil(total / limitEfetivo),
    };
  }

  async findOne(tenantId: number, id: number) {
    const obra = await this.prisma.obra.findFirst({
      where: { id, tenantId, deletadoEm: null },
      include: {
        obraTipo: { include: { niveis: { orderBy: { numero: 'asc' } }, campos: true } },
        niveisConfig: { orderBy: { nivel: 'asc' } },
        qualityConfig: true,
        _count: { select: { locais: { where: { deletadoEm: null } } } },
      },
    });

    if (!obra) throw new NotFoundException('Obra não encontrada');

    return { ...obra, totalLocais: obra._count.locais, _count: undefined };
  }

  async create(tenantId: number, dto: CreateObraDto) {
    // Validar que o tipo pertence ao sistema (tenantId=0) ou ao tenant
    const tipo = await this.prisma.obraTipo.findFirst({
      where: {
        id: dto.obraTipoId,
        OR: [{ tenantId: 0 }, { tenantId }],
        deletadoEm: null,
      },
    });
    if (!tipo) throw new NotFoundException('Tipo de obra não encontrado');

    const codigo = await this.gerarCodigoObra(tenantId);

    await this.validarDadosExtras(dto.obraTipoId, 0, dto.dadosExtras);

    const obra = await this.prisma.obra.create({
      data: {
        tenantId,
        obraTipoId: dto.obraTipoId,
        nome: dto.nome,
        codigo,
        modoQualidade: dto.modoQualidade ?? 'SIMPLES',
        endereco: dto.endereco,
        cidade: dto.cidade,
        estado: dto.estado,
        cep: dto.cep,
        dataInicioPrevista: dto.dataInicioPrevista
          ? new Date(dto.dataInicioPrevista)
          : undefined,
        dataFimPrevista: dto.dataFimPrevista
          ? new Date(dto.dataFimPrevista)
          : undefined,
        dadosExtras: dto.dadosExtras as Prisma.InputJsonValue,
      },
      include: {
        obraTipo: { select: { id: true, nome: true, slug: true, totalNiveis: true } },
      },
    });

    return { obra, proximaEtapa: 'hierarquia' };
  }

  async update(tenantId: number, id: number, dto: UpdateObraDto) {
    const obra = await this.findOne(tenantId, id); // garante existência e tenant

    if (dto.dadosExtras !== undefined) {
      await this.validarDadosExtras(obra.obraTipoId, 0, dto.dadosExtras);
    }

    const updated = await this.prisma.obra.update({
      where: { id },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.modoQualidade && { modoQualidade: dto.modoQualidade }),
        ...(dto.status && { status: dto.status }),
        ...(dto.endereco !== undefined && { endereco: dto.endereco }),
        ...(dto.cidade !== undefined && { cidade: dto.cidade }),
        ...(dto.estado !== undefined && { estado: dto.estado }),
        ...(dto.cep !== undefined && { cep: dto.cep }),
        ...(dto.dataInicioPrevista !== undefined && {
          dataInicioPrevista: dto.dataInicioPrevista
            ? new Date(dto.dataInicioPrevista)
            : null,
        }),
        ...(dto.dataFimPrevista !== undefined && {
          dataFimPrevista: dto.dataFimPrevista
            ? new Date(dto.dataFimPrevista)
            : null,
        }),
        ...(dto.dadosExtras !== undefined && {
          dadosExtras: dto.dadosExtras as Prisma.InputJsonValue,
        }),
      },
      include: {
        obraTipo: { select: { id: true, nome: true, slug: true } },
      },
    });

    return updated;
  }

  async remove(tenantId: number, id: number) {
    await this.findOne(tenantId, id);

    await this.prisma.obra.update({
      where: { id },
      data: { deletadoEm: new Date() },
    });

    // GAP-07: Cascatear soft delete para todos os locais da obra
    await this.prisma.obraLocal.updateMany({
      where: { obraId: id, tenantId, deletadoEm: null },
      data: { deletadoEm: new Date() },
    });

    return { message: 'Obra removida com sucesso' };
  }

  // ─────────────────────────────────────────
  // OBRA LOCAIS — HIERARQUIA
  // ─────────────────────────────────────────

  async findLocais(
    tenantId: number,
    obraId: number,
    params: { parentId?: number | null; nivel?: number },
  ) {
    await this.findOne(tenantId, obraId); // garante existência

    const { parentId, nivel } = params;

    const where: Prisma.ObraLocalWhereInput = {
      tenantId,
      obraId,
      deletadoEm: null,
      ...(nivel !== undefined && { nivel }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
    };

    const locais = await this.prisma.obraLocal.findMany({
      where,
      include: {
        _count: { select: { filhos: { where: { deletadoEm: null } } } },
      },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });

    return locais.map((l) => ({
      ...l,
      totalFilhos: l._count.filhos,
      _count: undefined,
    }));
  }

  async createLocal(tenantId: number, obraId: number, dto: CreateObraLocalDto) {
    const obra = await this.findOne(tenantId, obraId);

    // Validar parent pertence à mesma obra
    let parent: { id: number; nomeCompleto: string; codigo: string; nivel: number } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.obraLocal.findFirst({
        where: { id: dto.parentId, obraId, tenantId, deletadoEm: null },
        select: { id: true, nomeCompleto: true, codigo: true, nivel: true },
      });
      if (!parent)
        throw new NotFoundException('Local pai não encontrado nesta obra');

      if (dto.nivel !== parent.nivel + 1) {
        throw new BadRequestException(
          `Nível inválido: filho de nível ${parent.nivel} deve ser nível ${parent.nivel + 1}`,
        );
      }
    } else if (dto.nivel !== 1) {
      throw new BadRequestException('Local raiz deve ser nível 1');
    }

    // Calcular ordem
    const ordem =
      dto.ordem ??
      (await this.prisma.obraLocal.count({
        where: {
          obraId,
          parentId: dto.parentId ?? null,
          deletadoEm: null,
        },
      }));

    const codigo = this.gerarCodigoLocal(
      parent?.codigo ?? obra.codigo ?? 'OBR',
      dto.nivel,
      ordem + 1,
    );

    const nomeCompleto = parent
      ? `${parent.nomeCompleto} > ${dto.nome}`
      : dto.nome;

    await this.validarDadosExtras(obra.obraTipoId, dto.nivel, dto.dadosExtras);

    const local = await this.prisma.obraLocal.create({
      data: {
        tenantId,
        obraId,
        parentId: dto.parentId ?? null,
        nivel: dto.nivel,
        nome: dto.nome,
        codigo,
        nomeCompleto,
        ordem,
        dataInicioPrevista: dto.dataInicioPrevista
          ? new Date(dto.dataInicioPrevista)
          : undefined,
        dataFimPrevista: dto.dataFimPrevista
          ? new Date(dto.dataFimPrevista)
          : undefined,
        dadosExtras: dto.dadosExtras as Prisma.InputJsonValue,
      },
    });

    return local;
  }

  // GAP-06: Atualizar local existente (nome, ordem, datas, dadosExtras, plantaBaixaId)
  async updateLocal(
    tenantId: number,
    obraId: number,
    localId: number,
    dto: UpdateObraLocalDto,
  ) {
    const local = await this.prisma.obraLocal.findFirst({
      where: { id: localId, obraId, tenantId, deletadoEm: null },
    });
    if (!local) throw new NotFoundException('Local não encontrado nesta obra');

    const nomeAtualizado = dto.nome !== undefined && dto.nome !== local.nome;

    const updated = await this.prisma.obraLocal.update({
      where: { id: localId },
      data: {
        ...(dto.nome && { nome: dto.nome }),
        ...(dto.ordem !== undefined && { ordem: dto.ordem }),
        ...(dto.dadosExtras !== undefined && { dadosExtras: dto.dadosExtras as any }),
        ...(dto.dataInicioPrevista !== undefined && {
          dataInicioPrevista: dto.dataInicioPrevista
            ? new Date(dto.dataInicioPrevista)
            : null,
        }),
        ...(dto.dataFimPrevista !== undefined && {
          dataFimPrevista: dto.dataFimPrevista
            ? new Date(dto.dataFimPrevista)
            : null,
        }),
        ...(dto.plantaBaixaId !== undefined && { plantaBaixaId: dto.plantaBaixaId }),
      },
    });

    // GAP-04: propagar nomeCompleto para descendentes se nome mudou
    if (nomeAtualizado) {
      await this.propagarNomeCompleto(localId, tenantId);
    }

    return updated;
  }

  async gerarMassa(tenantId: number, obraId: number, dto: GerarMassaDto) {
    const obra = await this.findOne(tenantId, obraId);

    let parentNomeCompleto = '';
    let parentCodigo = obra.codigo ?? 'OBR';
    let parentNivel = 0;

    if (dto.parentId) {
      const parent = await this.prisma.obraLocal.findFirst({
        where: { id: dto.parentId, obraId, tenantId, deletadoEm: null },
        select: { id: true, nomeCompleto: true, codigo: true, nivel: true },
      });
      if (!parent)
        throw new NotFoundException('Local pai não encontrado nesta obra');
      parentNomeCompleto = parent.nomeCompleto;
      parentCodigo = parent.codigo;
      parentNivel = parent.nivel;
    }

    if (dto.nivel !== parentNivel + 1) {
      throw new BadRequestException(
        `Nível inválido para geração em massa: esperado ${parentNivel + 1}`,
      );
    }

    const inicioEm = dto.inicioEm ?? 1;

    // SELECT FOR UPDATE — evitar concorrência (raw query)
    const ordemBase = await this.prisma.obraLocal.count({
      where: { obraId, parentId: dto.parentId ?? null, deletadoEm: null },
    });

    const locaisParaCriar = Array.from({ length: dto.quantidade }, (_, i) => {
      const seq = inicioEm + i;
      const nome = `${dto.prefixo} ${String(seq).padStart(2, '0')}`;
      const ordem = ordemBase + i;
      const codigo = this.gerarCodigoLocal(parentCodigo, dto.nivel, seq);
      const nomeCompleto = parentNomeCompleto
        ? `${parentNomeCompleto} > ${nome}`
        : nome;

      return {
        tenantId,
        obraId,
        parentId: dto.parentId ?? null,
        nivel: dto.nivel,
        nome,
        codigo,
        nomeCompleto,
        ordem,
      };
    });

    await this.prisma.obraLocal.createMany({ data: locaisParaCriar });

    const criados = await this.prisma.obraLocal.findMany({
      where: {
        obraId,
        parentId: dto.parentId ?? null,
        tenantId,
        deletadoEm: null,
        nome: { in: locaisParaCriar.map((l) => l.nome) },
      },
      orderBy: { ordem: 'asc' },
    });

    return { criados: criados.length, locais: criados };
  }

  async removeLocal(tenantId: number, obraId: number, localId: number) {
    const local = await this.prisma.obraLocal.findFirst({
      where: { id: localId, obraId, tenantId, deletadoEm: null },
    });
    if (!local) throw new NotFoundException('Local não encontrado nesta obra');

    // CTE recursiva PostgreSQL: soft delete em cascata
    const result = await this.prisma.$executeRaw`
      WITH RECURSIVE descendentes AS (
        SELECT id FROM "ObraLocal"
        WHERE id = ${localId} AND "tenantId" = ${tenantId} AND "deletadoEm" IS NULL
        UNION ALL
        SELECT ol.id FROM "ObraLocal" ol
        INNER JOIN descendentes d ON ol."parentId" = d.id
        WHERE ol."tenantId" = ${tenantId} AND ol."deletadoEm" IS NULL
      )
      UPDATE "ObraLocal"
      SET "deletadoEm" = NOW(), "atualizadoEm" = NOW()
      WHERE id IN (SELECT id FROM descendentes)
    `;

    return { removidos: result };
  }

  // ─────────────────────────────────────────
  // HELPERS PRIVADOS
  // ─────────────────────────────────────────

  private async gerarCodigoObra(tenantId: number): Promise<string> {
    const ano = new Date().getFullYear();
    const total = await this.prisma.obra.count({ where: { tenantId } });
    return `OBR-${ano}-${String(total + 1).padStart(3, '0')}`;
  }

  private gerarCodigoLocal(
    parentCodigo: string,
    nivel: number,
    seq: number,
  ): string {
    const prefixos: Record<number, string> = {
      1: 'BL',
      2: 'PV',
      3: 'UN',
      4: 'CM',
      5: 'SB',
      6: 'IT',
    };
    const prefix = prefixos[nivel] ?? `N${nivel}`;
    return `${parentCodigo}-${prefix}${String(seq).padStart(2, '0')}`;
  }

  // GAP-04: Propagar nomeCompleto para todos os descendentes de um local renomeado
  private async propagarNomeCompleto(localId: number, tenantId: number): Promise<void> {
    await this.prisma.$executeRaw`
      WITH RECURSIVE arvore AS (
        SELECT id, "parentId", nome, nome AS "nomeCompleto"
        FROM "ObraLocal"
        WHERE id = ${localId} AND "tenantId" = ${tenantId} AND "deletadoEm" IS NULL

        UNION ALL

        SELECT ol.id, ol."parentId", ol.nome,
               arvore."nomeCompleto" || ' > ' || ol.nome
        FROM "ObraLocal" ol
        INNER JOIN arvore ON ol."parentId" = arvore.id
        WHERE ol."tenantId" = ${tenantId} AND ol."deletadoEm" IS NULL
      )
      UPDATE "ObraLocal" ol
      SET "nomeCompleto" = arvore."nomeCompleto", "atualizadoEm" = NOW()
      FROM arvore
      WHERE ol.id = arvore.id AND ol.id != ${localId}
    `;
  }

  // Stub: valida dadosExtras contra ObraTipoCampo (implementação futura)
  private async validarDadosExtras(
    _obraTipoId: number,
    _nivel: number,
    _dados: Record<string, unknown> | undefined,
  ): Promise<void> {
    // TODO: implementar validação de campos obrigatórios por nível
  }
}
