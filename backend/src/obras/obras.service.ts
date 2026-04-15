import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinioService } from '../ged/storage/minio.service';
import { CreateObraDto } from './dto/create-obra.dto';
import { UpdateObraDto } from './dto/update-obra.dto';
import { CreateObraLocalDto } from './dto/create-obra-local.dto';
import { UpdateObraLocalDto } from './dto/update-obra-local.dto';
import { GerarMassaDto } from './dto/gerar-massa.dto';
import { CreateObraTipoDto } from './dto/create-obra-tipo.dto';
import { Prisma } from '@prisma/client';
import { GenericaStrategy } from './strategies/generica.strategy';
import { EdificacaoStrategy } from './strategies/edificacao.strategy';
import { LinearStrategy } from './strategies/linear.strategy';
import { InstalacaoStrategy } from './strategies/instalacao.strategy';
import { GerarCascataDto } from './dto/gerar-cascata.dto';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

@Injectable()
export class ObrasService {
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private genericaStrategy: GenericaStrategy,
    private edificacaoStrategy: EdificacaoStrategy,
    private linearStrategy: LinearStrategy,
    private instalacaoStrategy: InstalacaoStrategy,
  ) {}

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

  private async contarInspecoesEFotos(
    tenantId: number,
    obraIds: number[],
  ): Promise<Map<number, { totalInspecoes: number; totalFotos: number }>> {
    if (obraIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      { obra_id: number; total_inspecoes: bigint; total_fotos: bigint }[]
    >`
      SELECT
        f.obra_id,
        COUNT(DISTINCT f.id)::bigint AS total_inspecoes,
        COUNT(e.id)::bigint          AS total_fotos
      FROM fvs_fichas f
      LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
      LEFT JOIN fvs_evidencias e ON e.registro_id = r.id AND e.tenant_id = f.tenant_id
      WHERE f.tenant_id = ${tenantId}
        AND f.obra_id = ANY(${obraIds}::int[])
        AND f.deleted_at IS NULL
      GROUP BY f.obra_id
    `;

    return new Map(
      rows.map((r) => [
        Number(r.obra_id),
        {
          totalInspecoes: Number(r.total_inspecoes),
          totalFotos:     Number(r.total_fotos),
        },
      ]),
    );
  }

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

    const obraIds = items.map((o) => o.id);
    const contagens = await this.contarInspecoesEFotos(tenantId, obraIds);

    // Gerar presigned URLs para fotos de capa (falha individual não derruba a lista)
    const presignedUrls = new Map<number, string>();
    await Promise.all(
      items
        .filter((o) => o.fotoCapa)
        .map(async (o) => {
          const url = await this.minio.getPresignedUrl(o.fotoCapa!, 3600).catch(() => null);
          if (url) presignedUrls.set(o.id, url);
        }),
    );

    return {
      items: items.map((o) => {
        const c = contagens.get(o.id) ?? { totalInspecoes: 0, totalFotos: 0 };
        return {
          ...o,
          totalLocais:    o._count.locais,
          totalInspecoes: c.totalInspecoes,
          totalFotos:     c.totalFotos,
          fotoCapaUrl:    presignedUrls.get(o.id) ?? null,
          _count: undefined,
        };
      }),
      total,
      page,
      limit: limitEfetivo,
      totalPages: Math.ceil(total / limitEfetivo),
    };
  }

  async uploadFotoCapa(
    tenantId: number,
    obraId: number,
    file: Express.Multer.File,
  ): Promise<{ fotoCapaUrl: string }> {
    const obra = await this.findOne(tenantId, obraId);

    // Validar formato
    const formatosPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!formatosPermitidos.includes(file.mimetype)) {
      throw new BadRequestException(
        'Formato inválido. Use JPEG, PNG, WebP ou HEIC.',
      );
    }

    // Processar com sharp: redimensionar + converter para WebP
    let buffer: Buffer;
    try {
      buffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Imagem inválida ou corrompida.');
    }

    // Deletar foto antiga do MinIO se existir
    if (obra.fotoCapa) {
      await this.minio.deleteFile(obra.fotoCapa).catch(() => {
        // Ignorar erro — arquivo pode já não existir no MinIO
      });
    }

    // Upload para MinIO
    const key = `${tenantId}/obras/${obraId}/capa/${randomUUID()}.webp`;
    await this.minio.uploadFile(buffer, key, 'image/webp');

    // Salvar key no banco — se falhar, remover o objeto recém-enviado para evitar orfão
    try {
      await this.prisma.obra.update({
        where: { id: obraId },
        data: { fotoCapa: key },
      });
    } catch (err) {
      await this.minio.deleteFile(key).catch(() => {});
      throw err;
    }

    // Gerar presigned URL (1h de validade)
    const url = await this.minio.getPresignedUrl(key, 3600);

    return { fotoCapaUrl: url };
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
        latitude: dto.latitude,
        longitude: dto.longitude,
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
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
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
  // OBRA NÍVEIS CONFIG
  // ─────────────────────────────────────────

  async saveNiveisConfig(
    tenantId: number,
    obraId: number,
    niveis: { nivel: number; labelSingular: string; labelPlural: string }[],
  ) {
    await this.findOne(tenantId, obraId); // garante existência e tenant

    if (niveis.length === 0 || niveis.length > 6) {
      throw new BadRequestException('A obra deve ter entre 1 e 6 níveis');
    }

    // Upsert: apaga os existentes e regrava (garante consistência)
    await this.prisma.$transaction([
      this.prisma.obraNivelConfig.deleteMany({ where: { obraId } }),
      this.prisma.obraNivelConfig.createMany({
        data: niveis.map((n) => ({
          obraId,
          nivel: n.nivel,
          labelSingular: n.labelSingular.trim(),
          labelPlural: n.labelPlural.trim(),
        })),
      }),
    ]);

    return this.prisma.obraNivelConfig.findMany({
      where: { obraId },
      orderBy: { nivel: 'asc' },
    });
  }

  // ─────────────────────────────────────────
  // OBRA LOCAIS — HIERARQUIA
  // ─────────────────────────────────────────

  async findLocais(
    tenantId: number,
    obraId: number,
    params: { parentId?: number | null; nivel?: number; search?: string },
  ) {
    await this.findOne(tenantId, obraId); // garante existência

    const { parentId, nivel, search } = params;

    const where: Prisma.ObraLocalWhereInput = {
      tenantId,
      obraId,
      deletadoEm: null,
      ...(nivel !== undefined && { nivel }),
      ...(parentId !== undefined && { parentId: parentId ?? null }),
      ...(search && {
        OR: [
          { nome: { contains: search, mode: 'insensitive' } },
          { codigo: { contains: search, mode: 'insensitive' } },
          { nomeCompleto: { contains: search, mode: 'insensitive' } },
        ],
      }),
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
      include: { obra: { select: { obraTipoId: true } } },
    });
    if (!local) throw new NotFoundException('Local não encontrado nesta obra');

    if (dto.dadosExtras !== undefined) {
      await this.validarDadosExtras(local.obra.obraTipoId, local.nivel, dto.dadosExtras);
    }

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
        ...(dto.status !== undefined && { status: dto.status }),
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

  async gerarCascata(tenantId: number, obraId: number, dto: GerarCascataDto) {
    // Guard: payload is required but not validated at DTO level (discriminated union limitation)
    if (!dto.payload || typeof dto.payload !== 'object') {
      throw new BadRequestException('payload é obrigatório');
    }

    const obra = await this.findOne(tenantId, obraId);

    const strategyMap = {
      generica:   this.genericaStrategy,
      edificacao: this.edificacaoStrategy,
      linear:     this.linearStrategy,
      instalacao: this.instalacaoStrategy,
    };

    const strategy = strategyMap[dto.estrategia];
    if (!strategy) throw new BadRequestException(`Estratégia desconhecida: ${dto.estrategia}`);

    return this.prisma.$transaction(async (tx) => {
      const ctx = {
        obraId,
        tenantId,
        obraCodigo: obra.codigo ?? 'OBR',
        tx: tx as Prisma.TransactionClient,
      };
      return strategy.gerar(dto.payload as any, ctx);
    });
  }

  // ─────────────────────────────────────────
  // QUALITY CONFIG
  // ─────────────────────────────────────────

  async getQualityConfig(tenantId: number, obraId: number) {
    await this.findOne(tenantId, obraId); // garante existência e tenant
    const config = await this.prisma.obraQualityConfig.findUnique({
      where: { obraId },
    });
    return config ?? { obraId, modoQualidade: null, slaAprovacaoHoras: null, exigeAssinaturaFVS: false, exigeAssinaturaDiario: false };
  }

  async upsertQualityConfig(
    tenantId: number,
    obraId: number,
    dto: { modoQualidade?: string; slaAprovacaoHoras?: number; exigeAssinaturaFVS?: boolean; exigeAssinaturaDiario?: boolean },
  ) {
    await this.findOne(tenantId, obraId); // garante existência e tenant

    return this.prisma.obraQualityConfig.upsert({
      where: { obraId },
      create: {
        obraId,
        ...(dto.modoQualidade && { modoQualidade: dto.modoQualidade as any }),
        ...(dto.slaAprovacaoHoras !== undefined && { slaAprovacaoHoras: dto.slaAprovacaoHoras }),
        ...(dto.exigeAssinaturaFVS !== undefined && { exigeAssinaturaFVS: dto.exigeAssinaturaFVS }),
        ...(dto.exigeAssinaturaDiario !== undefined && { exigeAssinaturaDiario: dto.exigeAssinaturaDiario }),
      },
      update: {
        ...(dto.modoQualidade && { modoQualidade: dto.modoQualidade as any }),
        ...(dto.slaAprovacaoHoras !== undefined && { slaAprovacaoHoras: dto.slaAprovacaoHoras }),
        ...(dto.exigeAssinaturaFVS !== undefined && { exigeAssinaturaFVS: dto.exigeAssinaturaFVS }),
        ...(dto.exigeAssinaturaDiario !== undefined && { exigeAssinaturaDiario: dto.exigeAssinaturaDiario }),
      },
    });
  }

  /**
   * Valida `dadosExtras` contra o schema `ObraTipoCampo` do tipo de obra.
   *
   * - Nível 0 → campos da Obra (chamado em create/update de Obra)
   * - Nível 1-6 → campos do ObraLocal naquele nível (chamado em createLocal)
   *
   * Regras aplicadas:
   * 1. Campos obrigatórios (obrigatorio=true) devem estar presentes e não-nulos.
   * 2. Tipo do valor deve bater com o `tipo` do campo:
   *    - "string"  → typeof value === 'string'
   *    - "number"  → typeof value === 'number' (e não NaN)
   *    - "boolean" → typeof value === 'boolean'
   *    - "date"    → string válida no formato ISO 8601
   *    - "enum"    → valor deve estar na lista `opcoes` (array no JSON do campo)
   * 3. Chaves desconhecidas (não mapeadas em ObraTipoCampo) são ignoradas — não geram erro.
   */
  private async validarDadosExtras(
    obraTipoId: number,
    nivel: number,
    dados: Record<string, unknown> | undefined,
  ): Promise<void> {
    const campos = await this.prisma.obraTipoCampo.findMany({
      where: { obraTipoId, nivel },
    });

    // Sem campos definidos para este tipo/nível: nada a validar
    if (campos.length === 0) return;

    const dadosEfetivos = dados ?? {};

    for (const campo of campos) {
      const valor = dadosEfetivos[campo.chave];
      const presente = valor !== undefined && valor !== null;

      // 1. Obrigatoriedade
      if (campo.obrigatorio && !presente) {
        throw new BadRequestException(
          `Campo obrigatório ausente: "${campo.label}" (chave: "${campo.chave}")`,
        );
      }

      // Se o campo está ausente mas não é obrigatório, pula as demais validações
      if (!presente) continue;

      // 2. Validação de tipo
      switch (campo.tipo) {
        case 'string': {
          if (typeof valor !== 'string') {
            throw new BadRequestException(
              `Campo "${campo.label}" deve ser texto (string). Recebido: ${typeof valor}`,
            );
          }
          break;
        }

        case 'number': {
          if (typeof valor !== 'number' || Number.isNaN(valor)) {
            throw new BadRequestException(
              `Campo "${campo.label}" deve ser numérico (number). Recebido: ${typeof valor}`,
            );
          }
          break;
        }

        case 'boolean': {
          if (typeof valor !== 'boolean') {
            throw new BadRequestException(
              `Campo "${campo.label}" deve ser verdadeiro/falso (boolean). Recebido: ${typeof valor}`,
            );
          }
          break;
        }

        case 'date': {
          if (typeof valor !== 'string' || isNaN(Date.parse(valor as string))) {
            throw new BadRequestException(
              `Campo "${campo.label}" deve ser uma data válida no formato ISO 8601 (ex: "2026-04-15"). Recebido: "${valor}"`,
            );
          }
          break;
        }

        case 'enum': {
          const opcoes = Array.isArray(campo.opcoes) ? (campo.opcoes as unknown[]) : [];
          if (!opcoes.includes(valor)) {
            throw new BadRequestException(
              `Campo "${campo.label}" contém valor inválido: "${valor}". Opções permitidas: ${opcoes.map((o) => `"${o}"`).join(', ')}`,
            );
          }
          break;
        }

        default: {
          // Tipo desconhecido no schema — não bloqueia, mas emite aviso no log
          // (não usar console.warn em produção; aqui deixamos passar silenciosamente)
          break;
        }
      }
    }
  }
}
