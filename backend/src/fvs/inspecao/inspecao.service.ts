// backend/src/fvs/inspecao/inspecao.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';
import type {
  FichaFvs, FichaFvsComProgresso, FichaDetalhada, FvsGrade,
  FvsRegistro, FvsRegistroComCiclo, FvsEvidencia, StatusGrade,
  FvsNaoConformidade,
} from '../types/fvs.types';
import type { CreateFichaDto } from './dto/create-ficha.dto';
import type { UpdateFichaDto } from './dto/update-ficha.dto';
import type { PutRegistroDto } from './dto/put-registro.dto';
import type { UpdateLocalDto } from './dto/update-local.dto';
import { UploadDocumentoDto } from '../../ged/dto/upload-documento.dto';
import { RoService } from './ro.service';
import { ModeloService } from '../modelos/modelo.service';

// Transições de status válidas: de → [destinos permitidos]
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  rascunho: ['em_inspecao'],
  em_inspecao: ['concluida', 'rascunho'],
  concluida: ['em_inspecao', 'aguardando_parecer', 'aprovada'],  // reabrir manualmente ainda permitido
  aguardando_parecer: [],              // transições gerenciadas por ParecerService
  aprovada: [],                        // estado final
};

// Transições válidas para status de registro individual
const TRANSICOES_REGISTRO: Record<string, string[]> = {
  nao_avaliado:             ['conforme', 'nao_conforme', 'excecao'],
  conforme:                 ['nao_conforme'],
  nao_conforme:             ['conforme_apos_reinspecao', 'nc_apos_reinspecao', 'liberado_com_concessao', 'retrabalho'],
  excecao:                  ['nao_conforme'],
  retrabalho:               ['conforme', 'nao_conforme', 'excecao'],
  conforme_apos_reinspecao: [],
  nc_apos_reinspecao:       [],
  liberado_com_concessao:   [],
};

@Injectable()
export class InspecaoService {
  private readonly logger = new Logger(InspecaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
    private readonly roService: RoService,
    private readonly modeloService: ModeloService,
  ) {}

  // ── Helper: buscar ficha com validação de tenant ────────────────────────────

  private async getFichaOuFalhar(tenantId: number, fichaId: number): Promise<FichaFvs> {
    const rows = await this.prisma.$queryRawUnsafe<FichaFvs[]>(
      `SELECT * FROM fvs_fichas WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    return rows[0];
  }

  // ── Helper: audit_log (INSERT ONLY) ────────────────────────────────────────

  private async gravarAuditLog(
    tx: any,
    params: {
      tenantId: number; fichaId: number; usuarioId: number;
      acao: string; statusDe?: string; statusPara?: string;
      registroId?: number; ip?: string; detalhes?: object;
    },
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `INSERT INTO fvs_audit_log
         (tenant_id, ficha_id, registro_id, acao, status_de, status_para, usuario_id, ip_origem, detalhes, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9::jsonb, NOW())`,
      params.tenantId, params.fichaId, params.registroId ?? null,
      params.acao, params.statusDe ?? null, params.statusPara ?? null,
      params.usuarioId, params.ip ?? null,
      params.detalhes ? JSON.stringify(params.detalhes) : null,
    );
  }

  // ── autoCreateRo ────────────────────────────────────────────────────────────

  private async autoCreateRo(
    tx: any,
    tenantId: number,
    fichaId: number,
    userId: number,
    regime: string,
    ip?: string,
  ): Promise<void> {
    // Sprint 4a: verificar se ficha exige RO
    const fichaRows = (await tx.$queryRawUnsafe(
      `SELECT exige_ro FROM fvs_fichas WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    )) as { exige_ro: boolean }[];
    if (!fichaRows.length || !fichaRows[0].exige_ro) return;

    type ItensNcRow = {
      registro_id: number; item_id: number; servico_id: number; obra_local_id: number;
      item_descricao: string; item_criticidade: string; servico_nome: string;
    };

    // Buscar todos os itens NC do ciclo mais recente por item+local
    const itensNc = (await tx.$queryRawUnsafe(
      `SELECT DISTINCT ON (r.item_id, r.obra_local_id)
         r.id AS registro_id, r.item_id, r.servico_id, r.obra_local_id,
         i.descricao AS item_descricao, i.criticidade AS item_criticidade,
         s.nome AS servico_nome
       FROM fvs_registros r
       JOIN fvs_catalogo_itens i ON i.id = r.item_id
       JOIN fvs_catalogo_servicos s ON s.id = r.servico_id
       WHERE r.ficha_id = $1 AND r.tenant_id = $2 AND r.status = 'nao_conforme'
       ORDER BY r.item_id, r.obra_local_id, r.ciclo DESC`,
      fichaId, tenantId,
    )) as ItensNcRow[];

    if (!itensNc.length) return; // sem NCs, não cria RO

    // Buscar MAX(ciclo_numero) dos ROs existentes (mesmo deletados) para calcular próximo
    const maxCicloRows = (await tx.$queryRawUnsafe(
      `SELECT MAX(ciclo_numero) AS max_ciclo FROM ro_ocorrencias WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    )) as { max_ciclo: string | null }[];
    const cicloNumero = (Number(maxCicloRows[0]?.max_ciclo ?? 0)) + 1;
    const numero = `RO-${fichaId}-${cicloNumero}`;

    const roRows = (await tx.$queryRawUnsafe(
      `INSERT INTO ro_ocorrencias (tenant_id, ficha_id, ciclo_numero, numero, responsavel_id, status)
       VALUES ($1, $2, $3, $4, $5, 'aberto') RETURNING id`,
      tenantId, fichaId, cicloNumero, numero, userId,
    )) as { id: number }[];
    const roId = roRows[0].id;

    // Agrupar itens por servico_id
    const porServico = new Map<number, { servicoNome: string; itens: ItensNcRow[] }>();
    for (const item of itensNc) {
      if (!porServico.has(item.servico_id)) {
        porServico.set(item.servico_id, { servicoNome: item.servico_nome, itens: [] });
      }
      porServico.get(item.servico_id)!.itens.push(item);
    }

    for (const [servicoId, { servicoNome, itens }] of porServico) {
      const svcRows = (await tx.$queryRawUnsafe(
        `INSERT INTO ro_servicos_nc (tenant_id, ro_id, servico_id, servico_nome)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        tenantId, roId, servicoId, servicoNome,
      )) as { id: number }[];
      const svcNcId = svcRows[0].id;

      for (const item of itens) {
        await tx.$executeRawUnsafe(
          `INSERT INTO ro_servico_itens_nc (tenant_id, ro_servico_nc_id, registro_id, item_descricao, item_criticidade)
           VALUES ($1, $2, $3, $4, $5)`,
          tenantId, svcNcId, item.registro_id, item.item_descricao, item.item_criticidade,
        );
      }
    }

    // Audit log (PBQP-H)
    if (regime === 'pbqph') {
      await tx.$executeRawUnsafe(
        `INSERT INTO fvs_audit_log
           (tenant_id, ficha_id, acao, status_para, usuario_id, ip_origem, detalhes, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6::inet, $7::jsonb, NOW())`,
        tenantId, fichaId, 'criacao_ro', 'concluida', userId, ip ?? null,
        JSON.stringify({ roId, totalServicos: porServico.size, totalItens: itensNc.length }),
      );
    }
  }

  // ── createFicha ─────────────────────────────────────────────────────────────

  async createFicha(
    tenantId: number,
    userId: number,
    dto: CreateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    return this.prisma.$transaction(async (tx) => {
      // Segurança: validar que a obra pertence ao tenant (GAP-01)
      const obraRows = await tx.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
        dto.obraId, tenantId,
      );
      if (!obraRows.length) {
        throw new BadRequestException(`Obra ${dto.obraId} não encontrada no tenant`);
      }

      let regime: string = dto.regime ?? 'livre';
      let exigeRo = true;
      let exigeReinspecao = true;
      let exigeParecer = true;
      const modeloId: number | null = dto.modeloId ?? null;
      let servicosDoTemplate: { servico_id: number; ordem: number; itens_excluidos: number[] | null }[] = [];

      // Se tem template, buscar e bloquear dentro da mesma transaction
      if (dto.modeloId) {
        const { modelo, servicos } = await this.modeloService.getModeloParaFicha(tx, tenantId, dto.modeloId);
        regime = modelo.regime;
        exigeRo = modelo.exige_ro;
        exigeReinspecao = modelo.exige_reinspecao;
        exigeParecer = modelo.exige_parecer;
        servicosDoTemplate = servicos;
      }

      const fichas = await tx.$queryRawUnsafe<FichaFvs[]>(
        `INSERT INTO fvs_fichas (tenant_id, obra_id, nome, regime, status, criado_por, modelo_id, exige_ro, exige_reinspecao, exige_parecer)
         VALUES ($1, $2, $3, $4, 'rascunho', $5, $6, $7, $8, $9)
         RETURNING *`,
        tenantId, dto.obraId, dto.nome, regime, userId, modeloId, exigeRo, exigeReinspecao, exigeParecer,
      );
      const ficha = fichas[0];

      // Serviços do template
      for (const svc of servicosDoTemplate) {
        await tx.$queryRawUnsafe<{ id: number }[]>(
          `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          tenantId, ficha.id, svc.servico_id,
          svc.itens_excluidos?.length ? svc.itens_excluidos : null,
        );
        // Nota: locais não são copiados do template — usuário adiciona manualmente
      }

      // Serviços manuais (sem template)
      if (!dto.modeloId && dto.servicos) {
        for (const svc of dto.servicos) {
          const fichaServicos = await tx.$queryRawUnsafe<{ id: number }[]>(
            `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            tenantId, ficha.id, svc.servicoId,
            svc.itensExcluidos?.length ? svc.itensExcluidos : null,
          );
          const fichaServicoId = fichaServicos[0].id;

          for (const localId of svc.localIds) {
            await tx.$executeRawUnsafe(
              `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id)
               VALUES ($1, $2, $3)`,
              tenantId, fichaServicoId, localId,
            );
          }
        }
      }

      // Incrementar fichas_count na vinculação obra-template
      if (dto.modeloId) {
        await this.modeloService.incrementFichasCount(tx, tenantId, dto.modeloId, dto.obraId);
      }

      if (regime === 'pbqph') {
        await this.gravarAuditLog(tx, {
          tenantId, fichaId: ficha.id, usuarioId: userId,
          acao: 'abertura_ficha', ip,
        });
      }

      return ficha;
    });
  }

  // ── getFichas ───────────────────────────────────────────────────────────────

  async getFichas(
    tenantId: number,
    obraId?: number,
    page = 1,
    limit = 20,
  ): Promise<{ data: FichaFvsComProgresso[]; total: number; page: number }> {
    const offset = (page - 1) * limit;

    let rows: (FichaFvsComProgresso & { total_count: string })[];

    if (obraId !== undefined) {
      rows = await this.prisma.$queryRawUnsafe<(FichaFvsComProgresso & { total_count: string })[]>(
        `SELECT f.*,
                COUNT(*) OVER() AS total_count,
                COALESCE(
                  ROUND(
                    100.0 * COUNT(r.id) FILTER (WHERE r.status <> 'nao_avaliado') /
                    NULLIF(COUNT(r.id), 0)
                  )::int, 0
                ) AS progresso
         FROM fvs_fichas f
         LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
         WHERE f.tenant_id = $1 AND f.obra_id = $2 AND f.deleted_at IS NULL
         GROUP BY f.id
         ORDER BY f.created_at DESC
         LIMIT $3 OFFSET $4`,
        tenantId, obraId, limit, offset,
      );
    } else {
      rows = await this.prisma.$queryRawUnsafe<(FichaFvsComProgresso & { total_count: string })[]>(
        `SELECT f.*,
                COUNT(*) OVER() AS total_count,
                COALESCE(
                  ROUND(
                    100.0 * COUNT(r.id) FILTER (WHERE r.status <> 'nao_avaliado') /
                    NULLIF(COUNT(r.id), 0)
                  )::int, 0
                ) AS progresso
         FROM fvs_fichas f
         LEFT JOIN fvs_registros r ON r.ficha_id = f.id AND r.tenant_id = f.tenant_id
         WHERE f.tenant_id = $1 AND f.deleted_at IS NULL
         GROUP BY f.id
         ORDER BY f.created_at DESC
         LIMIT $2 OFFSET $3`,
        tenantId, limit, offset,
      );
    }

    const total = rows.length ? Number(rows[0].total_count) : 0;
    return {
      data: rows.map(({ total_count, ...r }) => ({ ...r, progresso: Number(r.progresso) })),
      total,
      page,
    };
  }

  // ── getFicha (detalhada) ────────────────────────────────────────────────────

  async getFicha(tenantId: number, fichaId: number): Promise<FichaDetalhada> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    const servicos = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT fs.*, s.nome AS servico_nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2
       ORDER BY fs.ordem ASC`,
      fichaId, tenantId,
    );

    for (const srv of servicos) {
      srv.locais = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT fsl.*, ol.nome AS local_nome
         FROM fvs_ficha_servico_locais fsl
         JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
         WHERE fsl.ficha_servico_id = $1 AND fsl.tenant_id = $2`,
        srv.id, tenantId,
      );
    }

    const prog = await this.prisma.$queryRawUnsafe<{ progresso: number }[]>(
      `SELECT COALESCE(
         ROUND(100.0 * COUNT(*) FILTER (WHERE status <> 'nao_avaliado') / NULLIF(COUNT(*), 0))::int, 0
       ) AS progresso
       FROM fvs_registros WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );

    return { ...ficha, servicos, progresso: Number(prog[0].progresso) };
  }

  // ── patchFicha ──────────────────────────────────────────────────────────────

  async patchFicha(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: UpdateFichaDto,
    ip?: string,
  ): Promise<FichaFvs> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    if (dto.status && dto.status !== ficha.status) {
      const permitidos = TRANSICOES_VALIDAS[ficha.status] ?? [];
      if (!permitidos.includes(dto.status)) {
        throw new ConflictException(
          `Transição de status inválida: ${ficha.status} → ${dto.status}`,
        );
      }

      if (dto.status === 'concluida' && ficha.regime === 'pbqph') {
        await this.validarConclusaoPbqph(tenantId, fichaId);
      }

      // Regras de exige_parecer:
      if (dto.status === 'aguardando_parecer' && !ficha.exige_parecer) {
        throw new UnprocessableEntityException(
          'Esta ficha não exige parecer — use transição direta concluida → aprovada',
        );
      }
      if (dto.status === 'aprovada' && ficha.status === 'concluida' && ficha.exige_parecer) {
        throw new UnprocessableEntityException(
          'Esta ficha exige parecer — solicite parecer antes de aprovar',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (dto.nome   !== undefined) { sets.push(`nome = $${i++}`);   vals.push(dto.nome); }
      if (dto.status !== undefined) { sets.push(`status = $${i++}`); vals.push(dto.status); }
      sets.push(`updated_at = NOW()`);
      const idIdx = i++;
      const tenantIdx = i++;
      vals.push(fichaId, tenantId);

      const rows = await tx.$queryRawUnsafe<FichaFvs[]>(
        `UPDATE fvs_fichas SET ${sets.join(', ')} WHERE id = $${idIdx} AND tenant_id = $${tenantIdx} RETURNING *`,
        ...vals,
      );

      if (!rows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada após update`);

      const fichaAtualizada = rows[0];

      // Sprint 3: ao concluir, criar RO automático se há NCs
      if (dto.status === 'concluida' && ficha.status === 'em_inspecao') {
        await this.autoCreateRo(tx, tenantId, fichaId, userId, ficha.regime, ip);
      }

      if (dto.status && dto.status !== ficha.status && ficha.regime === 'pbqph') {
        await this.gravarAuditLog(tx, {
          tenantId, fichaId, usuarioId: userId,
          acao: 'alteracao_status', statusDe: ficha.status, statusPara: dto.status, ip,
        });
      }

      return fichaAtualizada;
    });
  }

  // ── deleteFicha ─────────────────────────────────────────────────────────────

  async deleteFicha(tenantId: number, fichaId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Só é possível excluir fichas com status rascunho');
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_fichas SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
  }

  // ── validarConclusaoPbqph ──────────────────────────────────────────────────

  private async validarConclusaoPbqph(tenantId: number, fichaId: number): Promise<void> {
    const pendentes = await this.prisma.$queryRawUnsafe<{ item_id: number; descricao: string }[]>(
      `SELECT r.item_id, i.descricao
       FROM fvs_registros r
       JOIN fvs_catalogo_itens i ON i.id = r.item_id
       WHERE r.ficha_id = $1 AND r.tenant_id = $2
         AND r.status = 'nao_conforme'
         AND i.criticidade = 'critico'
         AND NOT EXISTS (
           SELECT 1 FROM fvs_evidencias e WHERE e.registro_id = r.id AND e.tenant_id = r.tenant_id
         )`,
      fichaId, tenantId,
    );

    if (pendentes.length) {
      throw new UnprocessableEntityException({
        message: 'Itens críticos NC sem evidência fotográfica',
        itensPendentes: pendentes,
      });
    }
  }

  // ── addServico ────────────────────────────────────────────────────────────────

  async addServico(
    tenantId: number,
    fichaId: number,
    dto: { servicoId: number; localIds: number[]; itensExcluidos?: number[] },
  ): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser adicionados com ficha em rascunho');
    }

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO fvs_ficha_servicos (tenant_id, ficha_id, servico_id, itens_excluidos)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        tenantId, fichaId, dto.servicoId,
        dto.itensExcluidos?.length ? dto.itensExcluidos : null,
      );
      const fichaServicoId = rows[0].id;

      for (const localId of dto.localIds) {
        await tx.$queryRawUnsafe(
          `INSERT INTO fvs_ficha_servico_locais (tenant_id, ficha_servico_id, obra_local_id) VALUES ($1, $2, $3)`,
          tenantId, fichaServicoId, localId,
        );
      }
    });
  }

  // ── removeServico ─────────────────────────────────────────────────────────────

  async removeServico(tenantId: number, fichaId: number, servicoId: number): Promise<void> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'rascunho') {
      throw new ConflictException('Serviços só podem ser removidos com ficha em rascunho');
    }
    // fvs_ficha_servico_locais é apagado por CASCADE (ver migration fvs_inspecao)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_ficha_servicos WHERE ficha_id = $1 AND servico_id = $2 AND tenant_id = $3`,
      fichaId, servicoId, tenantId,
    );
  }

  // ── getGrade ─────────────────────────────────────────────────────────────────

  async getGrade(
    tenantId: number,
    fichaId: number,
    filtros?: { pavimentoId?: number; servicoId?: number },
  ): Promise<FvsGrade> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    // Parameterized filter for servico (optional)
    const servicoParams: unknown[] = [fichaId, tenantId];
    let servicoExtra = '';
    if (filtros?.servicoId) {
      servicoParams.push(filtros.servicoId);
      servicoExtra = `AND fs.servico_id = $${servicoParams.length}`;
    }

    const servicos = await this.prisma.$queryRawUnsafe<{ id: number; nome: string }[]>(
      `SELECT s.id, s.nome
       FROM fvs_ficha_servicos fs
       JOIN fvs_catalogo_servicos s ON s.id = fs.servico_id
       WHERE fs.ficha_id = $1 AND fs.tenant_id = $2 ${servicoExtra}
       ORDER BY fs.ordem ASC`,
      ...servicoParams,
    );

    // Parameterized filter for pavimento (optional)
    const localParams: unknown[] = [fichaId, tenantId];
    let pavimentoExtra = '';
    if (filtros?.pavimentoId) {
      localParams.push(filtros.pavimentoId);
      pavimentoExtra = `AND ol."parentId" = $${localParams.length}`;
    }

    const locais = await this.prisma.$queryRawUnsafe<{ id: number; nome: string; pavimento_id: number | null }[]>(
      `SELECT DISTINCT ol.id, ol.nome, ol."parentId" AS pavimento_id
       FROM fvs_ficha_servico_locais fsl
       JOIN "ObraLocal" ol ON ol.id = fsl.obra_local_id
       JOIN fvs_ficha_servicos fs ON fs.id = fsl.ficha_servico_id
       WHERE fs.ficha_id = $1 AND fsl.tenant_id = $2 ${pavimentoExtra}
       ORDER BY ol.nome ASC`,
      ...localParams,
    );

    const registros = await this.prisma.$queryRawUnsafe<{ servico_id: number; obra_local_id: number; status: string }[]>(
      `SELECT DISTINCT ON (item_id, obra_local_id)
         servico_id, obra_local_id, status
       FROM fvs_registros
       WHERE ficha_id = $1 AND tenant_id = $2
       ORDER BY item_id, obra_local_id, ciclo DESC`,
      fichaId, tenantId,
    );

    // Algoritmo de agregação: NC > Aprovado > Não avaliado > Pendente
    const celulas: Record<number, Record<number, StatusGrade>> = {};
    for (const srv of servicos) {
      celulas[srv.id] = {};
      for (const loc of locais) {
        const celReg = registros.filter(r => r.servico_id === srv.id && r.obra_local_id === loc.id);
        celulas[srv.id][loc.id] = this.calcularStatusCelula(celReg.map(r => r.status));
      }
    }

    return { servicos, locais, celulas };
  }

  // ── getGradePreview ───────────────────────────────────────────────────────────

  async getGradePreview(
    tenantId: number,
    fichaId: number,
    localId: number,
    servicoId: number,
  ): Promise<{
    servico_nome: string;
    local_nome: string;
    status_geral: StatusGrade;
    inspetor_nome: string | null;
    ultima_atividade: string | null;
    itens: {
      id: number;
      descricao: string;
      criterio_aceite: string | null;
      criticidade: string;
      status: string;
      observacao: string | null;
    }[];
  }> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    const rows = await this.prisma.$queryRawUnsafe<{
      item_id: number;
      descricao: string;
      criterio_aceite: string | null;
      criticidade: string;
      status: string;
      observacao: string | null;
      servico_nome: string;
      local_nome: string;
      inspetor_nome: string | null;
      inspecionado_em: string | null;
    }[]>(
      `SELECT
         i.id          AS item_id,
         i.descricao,
         i.criterio_aceite,
         i.criticidade,
         COALESCE(r.status, 'nao_avaliado') AS status,
         r.observacao,
         s.nome  AS servico_nome,
         ol.nome AS local_nome,
         u.nome  AS inspetor_nome,
         r.inspecionado_em::text AS inspecionado_em
       FROM fvs_catalogo_itens i
       JOIN fvs_ficha_servicos fs
         ON fs.servico_id = $2 AND fs.ficha_id = $1 AND fs.tenant_id = $3
       JOIN fvs_catalogo_servicos s ON s.id = $2
       JOIN "ObraLocal" ol ON ol.id = $4
       LEFT JOIN LATERAL (
         SELECT status, observacao, inspecionado_por, inspecionado_em
         FROM fvs_registros r2
         WHERE r2.item_id = i.id AND r2.ficha_id = $1 AND r2.obra_local_id = $4 AND r2.tenant_id = $3
         ORDER BY r2.ciclo DESC LIMIT 1
       ) r ON true
       LEFT JOIN "Usuario" u ON u.id = r.inspecionado_por
       WHERE i.servico_id = $2 AND i.tenant_id IN (0, $3) AND i.ativo = true
         AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))
       ORDER BY i.ordem ASC`,
      fichaId, servicoId, tenantId, localId,
    );

    if (!rows.length) throw new NotFoundException(`Serviço ${servicoId} não encontrado na ficha`);

    const statusGeral = this.calcularStatusCelula(rows.map(r => r.status));
    const ultima = rows
      .filter(r => r.inspecionado_em)
      .sort((a, b) => (b.inspecionado_em ?? '') > (a.inspecionado_em ?? '') ? 1 : -1)[0];

    return {
      servico_nome: rows[0].servico_nome,
      local_nome: rows[0].local_nome,
      status_geral: statusGeral,
      inspetor_nome: ultima?.inspetor_nome ?? null,
      ultima_atividade: ultima?.inspecionado_em ?? null,
      itens: rows.map(r => ({
        id: r.item_id,
        descricao: r.descricao,
        criterio_aceite: r.criterio_aceite,
        criticidade: r.criticidade,
        status: r.status,
        observacao: r.observacao,
      })),
    };
  }

  private calcularStatusCelula(statuses: string[]): StatusGrade {
    if (!statuses.length) return 'nao_avaliado';

    // Prioridade 1: NC ativa (nao_conforme ou retrabalho em curso)
    if (statuses.some(s => s === 'nao_conforme' || s === 'retrabalho')) return 'nc';

    // Prioridade 2: NC permanente após reinspeção
    if (statuses.some(s => s === 'nc_apos_reinspecao')) return 'nc_final';

    // Prioridade 3: todos não avaliados
    if (statuses.every(s => s === 'nao_avaliado')) return 'nao_avaliado';

    // Prioridade 4: mix com não avaliados
    if (statuses.some(s => s === 'nao_avaliado')) return 'parcial';

    // Prioridade 5: todos aprovados (conforme + pós-reinspeção + exceção + liberado)
    const APROVADOS = new Set(['conforme', 'conforme_apos_reinspecao', 'excecao', 'liberado_com_concessao']);
    if (statuses.every(s => APROVADOS.has(s))) {
      if (statuses.every(s => s === 'liberado_com_concessao')) return 'liberado';
      return 'aprovado';
    }

    return 'pendente';
  }

  // ── getRegistros ──────────────────────────────────────────────────────────────

  async getRegistros(
    tenantId: number,
    fichaId: number,
    servicoId: number,
    localId: number,
  ): Promise<FvsRegistroComCiclo[]> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    return this.prisma.$queryRawUnsafe<FvsRegistroComCiclo[]>(
      `SELECT
         i.id           AS item_id,
         i.descricao    AS item_descricao,
         i.criticidade  AS item_criticidade,
         i.criterio_aceite AS item_criterio_aceite,
         COALESCE(latest_r.status, 'nao_avaliado') AS status,
         latest_r.id,
         latest_r.ficha_id,
         latest_r.servico_id,
         latest_r.obra_local_id,
         COALESCE(latest_r.ciclo, 1) AS ciclo,
         latest_r.observacao,
         latest_r.inspecionado_por,
         latest_r.inspecionado_em,
         latest_r.created_at,
         latest_r.updated_at,
         COUNT(e.id)::int AS evidencias_count,
         fsl.equipe_responsavel,
         CASE WHEN ro_nc.item_id IS NOT NULL THEN true ELSE false END AS desbloqueado
       FROM fvs_catalogo_itens i
       JOIN fvs_ficha_servicos fs
         ON fs.servico_id = $2 AND fs.ficha_id = $3 AND fs.tenant_id = $4
       LEFT JOIN LATERAL (
         SELECT * FROM fvs_registros r
         WHERE r.item_id = i.id AND r.ficha_id = $3 AND r.obra_local_id = $5 AND r.tenant_id = $4
         ORDER BY r.ciclo DESC
         LIMIT 1
       ) latest_r ON true
       LEFT JOIN fvs_evidencias e ON e.registro_id = latest_r.id AND e.tenant_id = $4
       LEFT JOIN fvs_ficha_servico_locais fsl
         ON fsl.ficha_servico_id = fs.id AND fsl.obra_local_id = $5
       LEFT JOIN (
         SELECT DISTINCT r_orig.item_id, r_orig.obra_local_id
         FROM ro_servico_itens_nc rsni
         JOIN ro_servicos_nc rsn ON rsn.id = rsni.ro_servico_nc_id
         JOIN ro_ocorrencias ro ON ro.id = rsn.ro_id
         JOIN fvs_registros r_orig ON r_orig.id = rsni.registro_id
         WHERE ro.ficha_id = $3 AND ro.tenant_id = $4
       ) ro_nc ON ro_nc.item_id = i.id AND ro_nc.obra_local_id = $5
       WHERE i.servico_id = $2 AND i.tenant_id IN (0, $4) AND i.ativo = true
         AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))
       GROUP BY i.id, i.descricao, i.criticidade, i.criterio_aceite,
                latest_r.id, latest_r.ficha_id, latest_r.servico_id, latest_r.obra_local_id,
                latest_r.status, latest_r.ciclo, latest_r.observacao,
                latest_r.inspecionado_por, latest_r.inspecionado_em,
                latest_r.created_at, latest_r.updated_at,
                fsl.equipe_responsavel, ro_nc.item_id
       ORDER BY i.ordem ASC`,
      tenantId, servicoId, fichaId, tenantId, localId,
    );
  }

  // ── putRegistro ────────────────────────────────────────────────────────────────

  async putRegistro(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: PutRegistroDto,
    ip?: string,
  ): Promise<FvsRegistroComCiclo> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);

    // Parecer lock: ficha aprovada bloqueia qualquer alteração
    if (ficha.status === 'aprovada') {
      throw new ConflictException('Ficha aprovada. Nenhuma alteração permitida.');
    }

    if (ficha.status !== 'em_inspecao') {
      throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
    }

    // Buscar status atual do registro para validar transição
    const ciclo = dto.ciclo ?? 1;
    const registroAtualRows = await this.prisma.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM fvs_registros
       WHERE ficha_id = $1 AND item_id = $2 AND obra_local_id = $3 AND ciclo = $4 AND tenant_id = $5
       LIMIT 1`,
      fichaId, dto.itemId, dto.localId, ciclo, tenantId,
    );
    const statusAtual = registroAtualRows[0]?.status ?? 'nao_avaliado';

    // Validar transição
    const transicoesPermitidas = TRANSICOES_REGISTRO[statusAtual] ?? [];
    if (dto.status !== statusAtual && !transicoesPermitidas.includes(dto.status)) {
      throw new UnprocessableEntityException(
        `Transição inválida: ${statusAtual} → ${dto.status}`,
      );
    }

    // Observação obrigatória (todos os regimes)
    if (dto.status === 'nao_conforme' && !dto.observacao?.trim()) {
      throw new BadRequestException('Observação é obrigatória para não conformidade');
    }
    if (dto.status === 'nc_apos_reinspecao' && !dto.observacao?.trim()) {
      throw new BadRequestException('Observação é obrigatória para NC após reinspeção');
    }

    // Buscar criticidade do item (para audit_log)
    const itemRows = await this.prisma.$queryRawUnsafe<{ criticidade: string }[]>(
      `SELECT criticidade FROM fvs_catalogo_itens WHERE id = $1 AND tenant_id IN (0, $2)`,
      dto.itemId, tenantId,
    );
    const criticidade = itemRows[0]?.criticidade ?? 'menor';

    // Upsert registro
    const rows = await this.prisma.$queryRawUnsafe<FvsRegistroComCiclo[]>(
      `INSERT INTO fvs_registros
         (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, observacao, inspecionado_por, inspecionado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO UPDATE SET
         status           = EXCLUDED.status,
         observacao       = EXCLUDED.observacao,
         inspecionado_por = EXCLUDED.inspecionado_por,
         inspecionado_em  = EXCLUDED.inspecionado_em,
         updated_at       = NOW()
       RETURNING *`,
      tenantId, fichaId, dto.servicoId, dto.itemId, dto.localId, ciclo,
      dto.status, dto.observacao ?? null, userId,
    );

    const registro = rows[0];

    // Auto-criar NC ao transicionar PARA nao_conforme
    if (dto.status === 'nao_conforme' && statusAtual !== 'nao_conforme') {
      await this.autoCreateNc(tenantId, fichaId, registro.id, dto, criticidade, userId, ciclo);
    }

    // Encerrar NC ao transicionar DE nao_conforme
    if (
      statusAtual === 'nao_conforme' &&
      ['conforme_apos_reinspecao', 'liberado_com_concessao', 'nc_apos_reinspecao'].includes(dto.status)
    ) {
      await this.encerrarNc(tenantId, registro.id, dto.status, userId);
    }

    // Audit log — todos os regimes para status críticos
    if (ficha.regime === 'pbqph' || ['nao_conforme', 'conforme_apos_reinspecao', 'nc_apos_reinspecao', 'liberado_com_concessao'].includes(dto.status)) {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId, usuarioId: userId,
        acao: 'inspecao', registroId: registro.id, ip,
        statusDe: statusAtual !== dto.status ? statusAtual : undefined,
        statusPara: dto.status,
        detalhes: { itemId: dto.itemId, localId: dto.localId, criticidade, ciclo },
      });
    }

    // Sprint 3: se ciclo > 1 (reinspeção), verificar avanço do RO
    if (ciclo > 1) {
      await this.roService.checkAndAdvanceRoStatus(tenantId, fichaId);
    }

    return registro;
  }

  private async autoCreateNc(
    tenantId: number,
    fichaId: number,
    registroId: number,
    dto: { servicoId: number; itemId: number; localId: number; observacao?: string },
    criticidade: string,
    userId: number,
    ciclo: number,
  ): Promise<void> {
    // Verificar se já existe NC para este registro + ciclo (idempotente)
    const existentes = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvs_nao_conformidades
       WHERE registro_id = $1 AND ciclo_numero = $2 AND tenant_id = $3 AND deleted_at IS NULL`,
      registroId, ciclo, tenantId,
    );
    if (existentes.length > 0) return;

    // Próximo seq para esta ficha
    const seqRows = await this.prisma.$queryRawUnsafe<{ seq: number }[]>(
      `SELECT COUNT(*)::int + 1 AS seq FROM fvs_nao_conformidades WHERE ficha_id = $1 AND tenant_id = $2`,
      fichaId, tenantId,
    );
    const seq = seqRows[0]?.seq ?? 1;

    // Código do serviço para formar o número da NC
    const svcRows = await this.prisma.$queryRawUnsafe<{ codigo: string | null }[]>(
      `SELECT codigo FROM fvs_catalogo_servicos WHERE id = $1 AND tenant_id IN (0, $2)`,
      dto.servicoId, tenantId,
    );
    const codigoServico = svcRows[0]?.codigo ?? String(dto.servicoId);
    const numero = `NC-${fichaId}-${codigoServico}-${String(seq).padStart(3, '0')}`;

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO fvs_nao_conformidades
         (tenant_id, ficha_id, registro_id, numero, servico_id, item_id, obra_local_id,
          criticidade, status, ciclo_numero, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'aberta', $9, $10)`,
      tenantId, fichaId, registroId, numero,
      dto.servicoId, dto.itemId, dto.localId,
      criticidade, ciclo, userId,
    );
  }

  private async encerrarNc(
    tenantId: number,
    registroId: number,
    resultadoFinal: string,
    userId: number,
  ): Promise<void> {
    await this.prisma.$queryRawUnsafe(
      `UPDATE fvs_nao_conformidades
       SET status = $1, resultado_final = $2, encerrada_em = NOW(), encerrada_por = $3, updated_at = NOW()
       WHERE registro_id = $4 AND tenant_id = $5 AND status NOT IN ('encerrada', 'cancelada')`,
      'encerrada', resultadoFinal, userId, registroId, tenantId,
    );
  }

  // ── bulkInspecaoLocais ───────────────────────────────────────────────────────

  async bulkInspecaoLocais(
    tenantId: number,
    fichaId: number,
    userId: number,
    dto: { servicoId: number; localIds: number[]; status: 'conforme' | 'excecao'; observacao?: string },
    ip?: string,
  ): Promise<{ processados: number; ignorados: number; erros: number }> {
    if ((dto.status as string) === 'nao_conforme') {
      throw new BadRequestException('Inspeção em massa não permite não conformidade');
    }

    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status !== 'em_inspecao') {
      throw new ConflictException('Registros só podem ser gravados com ficha em_inspecao');
    }

    // Buscar todos os itens do serviço para esta ficha
    const itensRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT i.id
       FROM fvs_catalogo_itens i
       JOIN fvs_ficha_servicos fs ON fs.servico_id = $1 AND fs.ficha_id = $2 AND fs.tenant_id = $3
       WHERE i.servico_id = $1 AND i.tenant_id IN (0, $3) AND i.ativo = true
         AND (fs.itens_excluidos IS NULL OR NOT (i.id = ANY(fs.itens_excluidos)))`,
      dto.servicoId, fichaId, tenantId,
    );
    const itemIds = itensRows.map(r => r.id);
    if (itemIds.length === 0) return { processados: 0, ignorados: 0, erros: 0 };

    let processados = 0;
    let ignorados = 0;

    for (const localId of dto.localIds) {
      // Buscar registros atuais para este local
      const regsAtuais = await this.prisma.$queryRawUnsafe<{ item_id: number; status: string }[]>(
        `SELECT DISTINCT ON (item_id) item_id, status
         FROM fvs_registros
         WHERE ficha_id = $1 AND servico_id = $2 AND obra_local_id = $3 AND tenant_id = $4
         ORDER BY item_id, ciclo DESC`,
        fichaId, dto.servicoId, localId, tenantId,
      );

      const statusPorItem: Record<number, string> = {};
      regsAtuais.forEach(r => { statusPorItem[r.item_id] = r.status; });

      // Verificar se todos os itens estão nao_avaliado
      const todosNaoAvaliados = itemIds.every(id => !statusPorItem[id] || statusPorItem[id] === 'nao_avaliado');
      if (!todosNaoAvaliados) {
        ignorados++;
        continue;
      }

      // Inserir todos os itens como conforme/excecao
      for (const itemId of itemIds) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO fvs_registros
             (tenant_id, ficha_id, servico_id, item_id, obra_local_id, ciclo, status, observacao, inspecionado_por, inspecionado_em)
           VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, NOW())
           ON CONFLICT (ficha_id, item_id, obra_local_id, ciclo) DO NOTHING`,
          tenantId, fichaId, dto.servicoId, itemId, localId,
          dto.status, dto.observacao ?? null, userId,
        );
      }
      processados++;
    }

    return { processados, ignorados, erros: 0 };
  }

  // ── createEvidencia ──────────────────────────────────────────────────────────

  async createEvidencia(
    tenantId: number,
    registroId: number,
    userId: number,
    file: Express.Multer.File,
    ip?: string,
  ): Promise<FvsEvidencia> {
    const regRows = await this.prisma.$queryRawUnsafe<{ ficha_id: number }[]>(
      `SELECT ficha_id FROM fvs_registros WHERE id = $1 AND tenant_id = $2`,
      registroId, tenantId,
    );
    if (!regRows.length) throw new NotFoundException(`Registro ${registroId} não encontrado`);

    const ficha = await this.getFichaOuFalhar(tenantId, regRows[0].ficha_id);

    const catRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_categorias WHERE codigo = 'FTO' AND tenant_id IN (0, $1) LIMIT 1`,
      tenantId,
    );
    if (!catRows.length) throw new NotFoundException('Categoria GED FTO não configurada');

    // Find or create "Evidências FVS" pasta for this obra
    const pastaRows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM ged_pastas
       WHERE tenant_id = $1 AND obra_id = $2 AND nome = 'Evidências FVS' AND escopo = 'OBRA'
       LIMIT 1`,
      tenantId, ficha.obra_id,
    );
    let pastaId: number;
    if (pastaRows.length) {
      pastaId = pastaRows[0].id;
    } else {
      const newPasta = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `INSERT INTO ged_pastas (tenant_id, escopo, obra_id, nome, caminho)
         VALUES ($1, 'OBRA', $2, 'Evidências FVS', '/0/')
         RETURNING id`,
        tenantId, ficha.obra_id,
      );
      pastaId = newPasta[0].id;
    }

    const gedResult = await this.ged.upload(
      tenantId, userId, ficha.obra_id, file,
      {
        titulo: `FVS Evidência — registro ${registroId}`,
        categoriaId: catRows[0].id,
        pastaId,
        escopo: 'OBRA',
      } as UploadDocumentoDto,
      ip,
    );

    const evRows = await this.prisma.$queryRawUnsafe<FvsEvidencia[]>(
      `INSERT INTO fvs_evidencias (tenant_id, registro_id, ged_versao_id)
       VALUES ($1, $2, $3) RETURNING *`,
      tenantId, registroId, gedResult.versaoId,
    );

    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId: ficha.id, usuarioId: userId,
        acao: 'upload_evidencia', registroId, ip,
      });
    }

    return evRows[0];
  }

  // ── deleteEvidencia ──────────────────────────────────────────────────────────

  async deleteEvidencia(
    tenantId: number,
    evidenciaId: number,
    userId: number,
    ip?: string,
  ): Promise<void> {
    const evRows = await this.prisma.$queryRawUnsafe<(FvsEvidencia & { ficha_id: number })[]>(
      `SELECT e.*, r.ficha_id FROM fvs_evidencias e
       JOIN fvs_registros r ON r.id = e.registro_id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      evidenciaId, tenantId,
    );
    if (!evRows.length) throw new NotFoundException(`Evidência ${evidenciaId} não encontrada`);

    const ev = evRows[0];
    const ficha = await this.getFichaOuFalhar(tenantId, ev.ficha_id);

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvs_evidencias WHERE id = $1 AND tenant_id = $2`,
      evidenciaId, tenantId,
    );

    if (ficha.regime === 'pbqph') {
      await this.gravarAuditLog(this.prisma, {
        tenantId, fichaId: ficha.id, usuarioId: userId,
        acao: 'remover_evidencia', registroId: ev.registro_id, ip,
      });
    }
  }

  // ── getEvidencias ────────────────────────────────────────────────────────────

  async getEvidencias(tenantId: number, registroId: number): Promise<FvsEvidencia[]> {
    return this.prisma.$queryRawUnsafe<FvsEvidencia[]>(
      `SELECT e.*, gv.nome_original, gv.storage_key
       FROM fvs_evidencias e
       JOIN ged_versoes gv ON gv.id = e.ged_versao_id
       WHERE e.registro_id = $1 AND e.tenant_id = $2
       ORDER BY e.created_at ASC`,
      registroId, tenantId,
    );
  }

  // ── patchLocal ────────────────────────────────────────────────────────────────

  async patchLocal(
    tenantId: number,
    fichaId: number,
    localId: number,
    dto: { equipeResponsavel?: string | null },
  ): Promise<{ id: number; equipe_responsavel: string | null }> {
    const ficha = await this.getFichaOuFalhar(tenantId, fichaId);
    if (ficha.status === 'concluida') {
      throw new ConflictException('Não é possível editar local de ficha concluída');
    }

    const rows = await this.prisma.$queryRawUnsafe<{ id: number; equipe_responsavel: string | null }[]>(
      `UPDATE fvs_ficha_servico_locais SET equipe_responsavel = $1
       WHERE obra_local_id = $2 AND tenant_id = $3
         AND ficha_servico_id IN (
           SELECT id FROM fvs_ficha_servicos WHERE ficha_id = $4 AND tenant_id = $3
         )
       RETURNING id, equipe_responsavel`,
      dto.equipeResponsavel ?? null, localId, tenantId, fichaId,
    );
    if (!rows.length) throw new NotFoundException(`Local ${localId} não vinculado à ficha ${fichaId}`);
    return rows[0];
  }

  // ── getNcs ────────────────────────────────────────────────────────────────────

  async getNcs(
    tenantId: number,
    fichaId: number,
    filtros: {
      status?: string;
      criticidade?: string;
      servicoId?: number;
      slaStatus?: string;
    },
  ): Promise<{ total: number; ncs: FvsNaoConformidade[] }> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    const params: unknown[] = [tenantId, fichaId];
    const conditions: string[] = ['nc.tenant_id = $1', 'nc.ficha_id = $2', 'nc.deleted_at IS NULL'];

    if (filtros.status) { params.push(filtros.status); conditions.push(`nc.status = $${params.length}`); }
    if (filtros.criticidade) { params.push(filtros.criticidade); conditions.push(`nc.criticidade = $${params.length}`); }
    if (filtros.servicoId) { params.push(filtros.servicoId); conditions.push(`nc.servico_id = $${params.length}`); }
    if (filtros.slaStatus) { params.push(filtros.slaStatus); conditions.push(`nc.sla_status = $${params.length}`); }

    const where = conditions.join(' AND ');

    const ncs = await this.prisma.$queryRawUnsafe<FvsNaoConformidade[]>(
      `SELECT nc.*,
              s.nome      AS servico_nome,
              i.descricao AS item_descricao,
              ol.nome     AS local_nome
       FROM fvs_nao_conformidades nc
       LEFT JOIN fvs_catalogo_servicos s  ON s.id = nc.servico_id
       LEFT JOIN fvs_catalogo_itens    i  ON i.id = nc.item_id
       LEFT JOIN obra_locais           ol ON ol.id = nc.obra_local_id
       WHERE ${where}
       ORDER BY nc.criado_em DESC`,
      ...params,
    );

    const countRows = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `SELECT COUNT(*)::int AS count FROM fvs_nao_conformidades nc WHERE ${where}`,
      ...params,
    );

    return { total: countRows[0]?.count ?? 0, ncs };
  }

  // ── registrarTratamento ───────────────────────────────────────────────────────

  async registrarTratamento(
    tenantId: number,
    fichaId: number,
    ncId: number,
    userId: number,
    dto: {
      descricao: string;
      acaoCorretiva: string;
      responsavelId: number;
      prazo: string;
      evidencias?: { gedVersaoId: number; descricao?: string }[];
    },
  ): Promise<void> {
    await this.getFichaOuFalhar(tenantId, fichaId);

    const ncRows = await this.prisma.$queryRawUnsafe<{ id: number; status: string; ficha_id: number }[]>(
      `SELECT id, status, ficha_id FROM fvs_nao_conformidades WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      ncId, tenantId,
    );
    if (!ncRows.length) throw new NotFoundException(`NC ${ncId} não encontrada`);
    const nc = ncRows[0];
    if (nc.status === 'encerrada' || nc.status === 'cancelada') {
      throw new ConflictException('NC já encerrada');
    }

    // Validar prazo
    const hoje = new Date().toISOString().slice(0, 10);
    if (dto.prazo < hoje) {
      throw new BadRequestException('Prazo deve ser igual ou posterior à data atual');
    }

    // Próximo ciclo_numero
    const cicloRows = await this.prisma.$queryRawUnsafe<{ max_ciclo: number | null }[]>(
      `SELECT MAX(ciclo_numero) AS max_ciclo FROM fvs_nc_tratamentos WHERE nc_id = $1`,
      ncId,
    );
    const cicloNumero = (cicloRows[0]?.max_ciclo ?? 0) + 1;

    await this.prisma.$queryRawUnsafe(
      `INSERT INTO fvs_nc_tratamentos
         (tenant_id, nc_id, ciclo_numero, descricao, acao_corretiva, responsavel_id, prazo, evidencias, registrado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      tenantId, ncId, cicloNumero, dto.descricao, dto.acaoCorretiva,
      dto.responsavelId, dto.prazo,
      dto.evidencias ? JSON.stringify(dto.evidencias) : null,
      userId,
    );

    await this.prisma.$executeRawUnsafe(
      `UPDATE fvs_nao_conformidades
       SET status = $1, responsavel_id = $2, prazo_resolucao = $3, acao_corretiva = $4, updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6`,
      'em_tratamento', dto.responsavelId, dto.prazo, dto.acaoCorretiva, ncId, tenantId,
    );
  }
}
