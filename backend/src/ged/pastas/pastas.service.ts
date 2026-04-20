// src/ged/pastas/pastas.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePastaDto } from '../dto/create-pasta.dto';
import { GedPasta } from '../types/ged.types';

@Injectable()
export class GedPastasService {
  private readonly logger = new Logger(GedPastasService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista pastas de uma obra, montando a hierarquia com path materializado.
   */
  async listarPastas(tenantId: number, obraId: number): Promise<GedPasta[]> {
    const pastas = await this.prisma.$queryRawUnsafe<GedPasta[]>(
      `SELECT
         id, tenant_id, escopo, obra_id, parent_id, nome,
         path, nivel, configuracoes, settings_efetivos
       FROM ged_pastas
       WHERE tenant_id = $1
         AND (obra_id = $2 OR (escopo = 'EMPRESA' AND obra_id IS NULL))
         AND deleted_at IS NULL
       ORDER BY path`,
      tenantId,
      obraId,
    );
    return pastas;
  }

  /**
   * Lista apenas pastas de escopo EMPRESA (obra_id IS NULL). Usado pela tela
   * GedAdminPage para upload de documentos corporativos — o pasta_id informado
   * no DTO de upload precisa vir deste conjunto.
   */
  async listarPastasEmpresa(tenantId: number): Promise<GedPasta[]> {
    return this.prisma.$queryRawUnsafe<GedPasta[]>(
      `SELECT
         id, tenant_id, escopo, obra_id, parent_id, nome,
         path, nivel, configuracoes, settings_efetivos
       FROM ged_pastas
       WHERE tenant_id = $1
         AND escopo = 'EMPRESA'
         AND obra_id IS NULL
         AND deleted_at IS NULL
       ORDER BY path`,
      tenantId,
    );
  }

  /**
   * Busca uma pasta por ID, validando tenant.
   */
  async findById(tenantId: number, pastaId: number): Promise<GedPasta> {
    const rows = await this.prisma.$queryRawUnsafe<GedPasta[]>(
      `SELECT
         id, tenant_id, escopo, obra_id, parent_id, nome,
         path, nivel, configuracoes, settings_efetivos
       FROM ged_pastas
       WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      pastaId,
      tenantId,
    );

    if (!rows.length) {
      throw new NotFoundException(`Pasta ${pastaId} não encontrada.`);
    }
    return rows[0];
  }

  /**
   * Cria uma nova pasta, calculando path e nivel com base no parent.
   * settings_efetivos = merge(parent.settings_efetivos, configuracoes_proprias)
   */
  async criarPasta(
    tenantId: number,
    obraId: number,
    _userId: number,
    dto: CreatePastaDto,
  ): Promise<GedPasta> {
    let parentPath = '';
    let nivel = 1;
    let parentSettingsEfetivos: Record<string, unknown> = {};

    if (dto.parentId) {
      const parent = await this.findById(tenantId, dto.parentId);

      // Valida que o parent pertence à mesma obra (ou é pasta de empresa)
      if (parent.obra_id !== null && parent.obra_id !== obraId) {
        throw new BadRequestException(
          'A pasta pai pertence a outra obra.',
        );
      }

      parentPath = parent.path;
      nivel = parent.nivel + 1;
      parentSettingsEfetivos = (parent.settings_efetivos as Record<string, unknown>) ?? {};
    }

    if (nivel > 10) {
      throw new BadRequestException('Profundidade máxima de pastas é 10 níveis.');
    }

    // settings_efetivos = herança: parent sobreposto pelas configurações próprias
    const settingsEfetivos = {
      ...parentSettingsEfetivos,
      ...(dto.configuracoes ?? {}),
    };

    // Insere e retorna a pasta criada (sem criado_por — coluna não existe na tabela)
    const rows = await this.prisma.$queryRawUnsafe<GedPasta[]>(
      `INSERT INTO ged_pastas
         (tenant_id, escopo, obra_id, parent_id, nome, path, nivel, configuracoes, settings_efetivos)
       VALUES ($1, $2, $3, $4, $5, '', $6, $7::jsonb, $8::jsonb)
       RETURNING id, tenant_id, escopo, obra_id, parent_id, nome, path, nivel, configuracoes, settings_efetivos`,
      tenantId,
      dto.escopo ?? 'OBRA',
      obraId,
      dto.parentId ?? null,
      dto.nome,
      nivel,
      JSON.stringify(dto.configuracoes ?? {}),
      JSON.stringify(settingsEfetivos),
    );

    const pasta = rows[0];

    // Atualiza o path materializado: {parentPath}/{id}
    const novoPath = parentPath ? `${parentPath}/${pasta.id}` : `/${pasta.id}`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_pastas SET path = $1 WHERE id = $2`,
      novoPath,
      pasta.id,
    );

    pasta.path = novoPath;
    this.logger.log(`Pasta criada: id=${pasta.id} path=${novoPath} tenant=${tenantId}`);
    return pasta;
  }

  /**
   * Remove pasta (soft delete). Impede remoção se houver documentos ou subpastas vinculados.
   */
  async removerPasta(tenantId: number, pastaId: number): Promise<void> {
    await this.findById(tenantId, pastaId);

    // Verifica documentos vinculados
    const docs = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM ged_documentos WHERE pasta_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      pastaId,
      tenantId,
    );
    if (parseInt(docs[0].count, 10) > 0) {
      throw new BadRequestException(
        'Não é possível remover pasta com documentos vinculados.',
      );
    }

    // Verifica subpastas
    const subpastas = await this.prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM ged_pastas WHERE parent_id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      pastaId,
      tenantId,
    );
    if (parseInt(subpastas[0].count, 10) > 0) {
      throw new BadRequestException(
        'Não é possível remover pasta com subpastas vinculadas.',
      );
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE ged_pastas SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      pastaId,
      tenantId,
    );
  }

  /**
   * Propaga settings_efetivos em cascata quando as configurações de uma pasta pai mudam.
   */
  async propagarSettingsEfetivos(tenantId: number, pastaId: number): Promise<void> {
    const pasta = await this.findById(tenantId, pastaId);

    const descendentes = await this.prisma.$queryRawUnsafe<GedPasta[]>(
      `SELECT id, parent_id, configuracoes, settings_efetivos
       FROM ged_pastas
       WHERE tenant_id = $1
         AND path LIKE $2
         AND deleted_at IS NULL
       ORDER BY nivel ASC`,
      tenantId,
      `${pasta.path}/%`,
    );

    const settingsCache: Map<number, Record<string, unknown>> = new Map();
    settingsCache.set(pastaId, (pasta.settings_efetivos as Record<string, unknown>) ?? {});

    for (const descendente of descendentes) {
      const parentSettings = descendente.parent_id
        ? (settingsCache.get(descendente.parent_id) ?? {})
        : {};

      const novosSettings = {
        ...parentSettings,
        ...(descendente.configuracoes as Record<string, unknown> ?? {}),
      };

      await this.prisma.$executeRawUnsafe(
        `UPDATE ged_pastas SET settings_efetivos = $1::jsonb WHERE id = $2 AND tenant_id = $3`,
        JSON.stringify(novosSettings),
        descendente.id,
        tenantId,
      );

      settingsCache.set(descendente.id, novosSettings);
    }
  }
}
