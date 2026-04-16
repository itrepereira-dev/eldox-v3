// backend/src/fvm/recebimento/ensaios/ensaios.service.ts
import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { RegistrarEnsaioDto } from '../dto/ensaio.dto';

export interface EnsaioTemplate {
  id: number;
  tenant_id: number;
  material_id: number | null;
  nome: string;
  norma_referencia: string | null;
  unidade: string;
  valor_min: number | null;
  valor_max: number | null;
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
}

export interface FvmEnsaio {
  id: number;
  lote_id: number;
  template_id: number | null;
  nome: string;
  norma_referencia: string | null;
  unidade: string;
  valor_min: number | null;
  valor_max: number | null;
  valor_medido: number | null;
  resultado: 'PENDENTE' | 'APROVADO' | 'REPROVADO';
  data_ensaio: string | null;
  laboratorio_nome: string | null;
  observacoes: string | null;
  registrado_por: number;
  created_at: Date;
  updated_at: Date;
  // computed
  obrigatorio?: boolean;
}

export interface ResultadoLote {
  aprovado: boolean; // all mandatory ensaios APROVADO
  reprovado: boolean; // any mandatory ensaio REPROVADO
  pendentes: number;
  falhas: string[]; // names of failed mandatory ensaios
}

@Injectable()
export class EnsaiosService {
  private readonly logger = new Logger(EnsaiosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Templates por material ──────────────────────────────────────────────────

  async listarTemplatesPorMaterial(tenantId: number, materialId: number): Promise<EnsaioTemplate[]> {
    // Returns system templates (tenant_id=0) for this material + tenant customizations
    const rows = await this.prisma.$queryRawUnsafe<EnsaioTemplate[]>(
      `SELECT id, tenant_id, material_id, nome, norma_referencia, unidade,
              CAST(valor_min AS FLOAT) AS valor_min,
              CAST(valor_max AS FLOAT) AS valor_max,
              obrigatorio, ordem, ativo
       FROM fvm_ensaio_templates
       WHERE (tenant_id = 0 OR tenant_id = $1)
         AND (material_id = $2 OR material_id IS NULL)
         AND ativo = TRUE
       ORDER BY (CASE WHEN tenant_id = $1 THEN 0 ELSE 1 END), ordem ASC`,
      tenantId, materialId,
    );
    return rows;
  }

  // ── Ensaios por lote ────────────────────────────────────────────────────────

  async listarPorLote(tenantId: number, loteId: number): Promise<FvmEnsaio[]> {
    await this.assertLoteAccess(tenantId, loteId);
    const rows = await this.prisma.$queryRawUnsafe<FvmEnsaio[]>(
      `SELECT e.id, e.lote_id, e.template_id, e.nome, e.norma_referencia, e.unidade,
              CAST(e.valor_min AS FLOAT) AS valor_min,
              CAST(e.valor_max AS FLOAT) AS valor_max,
              CAST(e.valor_medido AS FLOAT) AS valor_medido,
              e.resultado, e.data_ensaio::text, e.laboratorio_nome, e.observacoes,
              e.registrado_por, e.created_at, e.updated_at,
              t.obrigatorio
       FROM fvm_ensaios e
       LEFT JOIN fvm_ensaio_templates t ON t.id = e.template_id
       WHERE e.tenant_id = $1 AND e.lote_id = $2
       ORDER BY e.created_at ASC`,
      tenantId, loteId,
    );
    return rows;
  }

  // ── Registrar ensaio ────────────────────────────────────────────────────────

  async registrar(
    tenantId: number,
    loteId: number,
    usuarioId: number,
    dto: RegistrarEnsaioDto,
  ): Promise<FvmEnsaio> {
    await this.assertLoteAccess(tenantId, loteId);

    // Compute resultado from valor_medido vs thresholds
    const resultado = this.calcularResultado(dto.valor_medido, dto.valor_min, dto.valor_max);

    const rows = await this.prisma.$queryRawUnsafe<FvmEnsaio[]>(
      `INSERT INTO fvm_ensaios
         (tenant_id, lote_id, template_id, nome, norma_referencia, unidade,
          valor_min, valor_max, valor_medido, resultado, data_ensaio,
          laboratorio_nome, observacoes, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id, lote_id, template_id, nome, norma_referencia, unidade,
                 CAST(valor_min AS FLOAT) AS valor_min,
                 CAST(valor_max AS FLOAT) AS valor_max,
                 CAST(valor_medido AS FLOAT) AS valor_medido,
                 resultado, data_ensaio::text, laboratorio_nome, observacoes,
                 registrado_por, created_at, updated_at`,
      tenantId, loteId,
      dto.template_id ?? null, dto.nome, dto.norma_referencia ?? null, dto.unidade,
      dto.valor_min ?? null, dto.valor_max ?? null, dto.valor_medido ?? null,
      resultado,
      dto.data_ensaio ?? null, dto.laboratorio_nome ?? null, dto.observacoes ?? null,
      usuarioId,
    );
    return rows[0];
  }

  // ── Atualizar ensaio ────────────────────────────────────────────────────────

  async atualizar(
    tenantId: number,
    ensaioId: number,
    usuarioId: number,
    dto: Partial<RegistrarEnsaioDto>,
  ): Promise<FvmEnsaio> {
    const existing = await this.prisma.$queryRawUnsafe<{ id: number; valor_min: number | null; valor_max: number | null; valor_medido: number | null }[]>(
      `SELECT id, CAST(valor_min AS FLOAT) AS valor_min, CAST(valor_max AS FLOAT) AS valor_max,
              CAST(valor_medido AS FLOAT) AS valor_medido
       FROM fvm_ensaios WHERE tenant_id = $1 AND id = $2`,
      tenantId, ensaioId,
    );
    if (!existing[0]) throw new NotFoundException('Ensaio não encontrado');

    const valorMin    = dto.valor_min    !== undefined ? dto.valor_min    : existing[0].valor_min;
    const valorMax    = dto.valor_max    !== undefined ? dto.valor_max    : existing[0].valor_max;
    const valorMedido = dto.valor_medido !== undefined ? dto.valor_medido : existing[0].valor_medido;
    const resultado   = this.calcularResultado(valorMedido, valorMin, valorMax);

    const rows = await this.prisma.$queryRawUnsafe<FvmEnsaio[]>(
      `UPDATE fvm_ensaios
       SET nome=$3, norma_referencia=$4, unidade=$5, valor_min=$6, valor_max=$7,
           valor_medido=$8, resultado=$9, data_ensaio=$10, laboratorio_nome=$11,
           observacoes=$12, updated_at=NOW()
       WHERE tenant_id=$1 AND id=$2
       RETURNING id, lote_id, template_id, nome, norma_referencia, unidade,
                 CAST(valor_min AS FLOAT) AS valor_min,
                 CAST(valor_max AS FLOAT) AS valor_max,
                 CAST(valor_medido AS FLOAT) AS valor_medido,
                 resultado, data_ensaio::text, laboratorio_nome, observacoes,
                 registrado_por, created_at, updated_at`,
      tenantId, ensaioId,
      dto.nome ?? null, dto.norma_referencia ?? null, dto.unidade ?? 'un',
      valorMin, valorMax, valorMedido, resultado,
      dto.data_ensaio ?? null, dto.laboratorio_nome ?? null, dto.observacoes ?? null,
    );
    return rows[0];
  }

  // ── Remover ensaio ──────────────────────────────────────────────────────────

  async remover(tenantId: number, ensaioId: number): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM fvm_ensaios WHERE tenant_id = $1 AND id = $2`,
      tenantId, ensaioId,
    );
  }

  // ── Resultado agregado do lote ──────────────────────────────────────────────

  async calcularResultadoLote(tenantId: number, loteId: number): Promise<ResultadoLote> {
    const ensaios = await this.listarPorLote(tenantId, loteId);
    const obrigatorios = ensaios.filter((e) => e.obrigatorio !== false);
    const pendentes = obrigatorios.filter((e) => e.resultado === 'PENDENTE' || e.valor_medido == null).length;
    const falhas = obrigatorios.filter((e) => e.resultado === 'REPROVADO').map((e) => e.nome);
    const reprovado = falhas.length > 0;
    const aprovado = pendentes === 0 && !reprovado && obrigatorios.length > 0;
    return { aprovado, reprovado, pendentes, falhas };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private calcularResultado(
    valorMedido: number | null | undefined,
    valorMin: number | null | undefined,
    valorMax: number | null | undefined,
  ): 'PENDENTE' | 'APROVADO' | 'REPROVADO' {
    if (valorMedido == null) return 'PENDENTE';
    if (valorMin != null && valorMedido < valorMin) return 'REPROVADO';
    if (valorMax != null && valorMedido > valorMax) return 'REPROVADO';
    return 'APROVADO';
  }

  private async assertLoteAccess(tenantId: number, loteId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM fvm_lotes WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL`,
      tenantId, loteId,
    );
    if (!rows[0]) throw new NotFoundException('Lote não encontrado');
  }
}
