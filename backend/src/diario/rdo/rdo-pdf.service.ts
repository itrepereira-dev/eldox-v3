// backend/src/diario/rdo/rdo-pdf.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// ─── Cores ───────────────────────────────────────────────────────────────────
const COR_HEADER_BG = '#0d1117';
const COR_HEADER_TEXT = '#ffffff';
const COR_SECTION_BG = '#f6f8fa';
const COR_TEXT = '#1f2328';
const COR_SEPARATOR = '#d0d7de';

// ─── Interfaces internas ──────────────────────────────────────────────────────
interface RdoRow {
  id: number;
  tenant_id: number;
  obra_id: number;
  data: string;
  status: string;
  numero_sequencial?: number;
  resumo_ia?: string;
  pdf_path?: string;
  obra_nome?: string;
}

interface ClimaRow {
  periodo: string;
  condicao: string;
  praticavel: boolean;
  chuva_mm?: number;
}

interface MaoObraRow {
  funcao: string;
  quantidade: number;
  tipo: string;
}

interface EquipamentoRow {
  descricao: string;
  quantidade: number;
  unidade?: string;
}

interface AtividadeRow {
  descricao: string;
  percentual_executado?: number;
  pavimento?: string;
  servico?: string;
}

interface OcorrenciaRow {
  tipo: string;
  descricao: string;
  grau_impacto?: string;
  acao_tomada?: string;
}

interface ChecklistRow {
  item: string;
  resposta: boolean;
  observacao?: string;
}

interface AssinaturaRow {
  tipo: string;
  criado_em: Date;
}

@Injectable()
export class RdoPdfService {
  private readonly logger = new Logger(RdoPdfService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Geração do PDF ───────────────────────────────────────────────────────

  async gerarPdf(rdoId: number, tenantId: number, incluirFotos = false): Promise<Buffer> {
    // 1. Carregar dados em paralelo
    const [rdoRows, climaRows, maoObraRows, equipamentosRows, atividadesRows, ocorrenciasRows, checklistRows, assinaturasRows, fotosRows] =
      await Promise.all([
        this.prisma.$queryRawUnsafe<RdoRow[]>(
          `SELECT r.*, o.nome AS obra_nome
           FROM rdos r
           LEFT JOIN "Obra" o ON o.id = r.obra_id
           WHERE r.id = $1 AND r.tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<ClimaRow[]>(
          `SELECT * FROM rdo_clima WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY periodo`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<MaoObraRow[]>(
          `SELECT * FROM rdo_mao_de_obra WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<EquipamentoRow[]>(
          `SELECT * FROM rdo_equipamentos WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<AtividadeRow[]>(
          `SELECT * FROM rdo_atividades WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY ordem`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<OcorrenciaRow[]>(
          `SELECT * FROM rdo_ocorrencias WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<ChecklistRow[]>(
          `SELECT * FROM rdo_checklist_itens WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY ordem`,
          rdoId,
          tenantId,
        ),
        this.prisma.$queryRawUnsafe<AssinaturaRow[]>(
          `SELECT * FROM rdo_assinaturas WHERE rdo_id = $1 AND tenant_id = $2`,
          rdoId,
          tenantId,
        ),
        incluirFotos
          ? this.prisma.$queryRawUnsafe<any[]>(
              `SELECT * FROM rdo_fotos WHERE rdo_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
              rdoId,
              tenantId,
            )
          : Promise.resolve([] as any[]),
      ]);

    if (!rdoRows.length) {
      throw new NotFoundException(`RDO ${rdoId} não encontrado para o tenant ${tenantId}.`);
    }

    const rdo = rdoRows[0];

    // 2. Gerar PDF
    const buffer = await this.buildPdf(rdo, climaRows, maoObraRows, equipamentosRows, atividadesRows, ocorrenciasRows, checklistRows, assinaturasRows, fotosRows as any[]);

    // 3. Upload para MinIO (opcional — não falha o fluxo)
    const storagePath = `rdo-pdfs/tenant-${tenantId}/rdo-${rdoId}-${Date.now()}.pdf`;
    await this.uploadPdf(buffer, storagePath, rdoId, tenantId);

    return buffer;
  }

  // ─── Construção do documento PDF ─────────────────────────────────────────

  // ─── Geração do PDF compartilhável (token público) ───────────────────────

  async gerarCompartilhavel(token: string): Promise<{ buffer: Buffer; nomeArquivo: string }> {
    const rdoRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r.*, o.nome AS obra_nome
       FROM rdos r
       LEFT JOIN "Obra" o ON o.id = r.obra_id
       WHERE r.token_cliente = $1
         AND (r.token_cliente_expires_at IS NULL OR r.token_cliente_expires_at > NOW())
         AND r.deleted_at IS NULL`,
      token,
    );
    if (!rdoRows.length) {
      throw new NotFoundException('Link de compartilhamento inválido ou expirado');
    }
    const rdo = rdoRows[0];
    const buffer = await this.gerarPdf(rdo.id, rdo.tenant_id, true);
    const num = rdo.numero ?? rdo.id;
    const nomeArquivo = `RDO-${String(num).padStart(4, '0')}-${rdo.data ?? 'sem-data'}.pdf`;
    return { buffer, nomeArquivo };
  }

  private buildPdf(
    rdo: RdoRow,
    clima: ClimaRow[],
    maoObra: MaoObraRow[],
    equipamentos: EquipamentoRow[],
    atividades: AtividadeRow[],
    ocorrencias: OcorrenciaRow[],
    checklist: ChecklistRow[],
    assinaturas: AssinaturaRow[],
    fotos: any[] = [],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // ── Header principal ────────────────────────────────────────────────
      doc.rect(margin, margin, contentWidth, 70).fill(COR_HEADER_BG);

      doc.font('Helvetica-Bold').fontSize(18).fillColor(COR_HEADER_TEXT);
      doc.text('ELDOX', margin + 12, margin + 14);

      doc.font('Helvetica-Bold').fontSize(14).fillColor(COR_HEADER_TEXT);
      doc.text('DIÁRIO DE OBRA', margin + contentWidth / 2, margin + 14, { width: contentWidth / 2, align: 'right' });

      doc.font('Helvetica').fontSize(10).fillColor(COR_HEADER_TEXT);
      const obraNome = rdo.obra_nome ?? `Obra #${rdo.obra_id}`;
      doc.text(obraNome, margin + 12, margin + 38, { width: contentWidth / 2 - 12 });

      doc.font('Helvetica').fontSize(10).fillColor(COR_HEADER_TEXT);
      const rdoNumero = rdo.numero_sequencial ? String(rdo.numero_sequencial).padStart(4, '0') : String(rdo.id);
      doc.text(`RDO Nº ${rdoNumero}`, margin + contentWidth / 2, margin + 38, { width: contentWidth / 2, align: 'right' });

      // Data + status abaixo do header
      const dataFormatada = this.formatarData(rdo.data);
      doc.font('Helvetica').fontSize(9).fillColor(COR_HEADER_TEXT);
      doc.text(`Data: ${dataFormatada}`, margin + 12, margin + 54);
      doc.text(`Status: ${(rdo.status ?? '').toUpperCase()}`, margin + contentWidth / 2, margin + 54, { width: contentWidth / 2, align: 'right' });

      let y = margin + 80;

      // ── Seção Clima ─────────────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'CONDIÇÕES CLIMÁTICAS', margin, y, contentWidth);

      if (clima.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        const periodoLabels: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
        for (const c of clima) {
          const label = periodoLabels[c.periodo] ?? c.periodo;
          const praticavelLabel = c.praticavel ? 'Sim' : 'Não';
          const chuvaLabel = c.chuva_mm != null ? ` | Chuva: ${c.chuva_mm} mm` : '';
          const texto = `${label}: ${c.condicao.replace(/_/g, ' ')} | Praticável: ${praticavelLabel}${chuvaLabel}`;
          y = this.renderTextRow(doc, texto, margin, y, contentWidth);
        }
      }

      // ── Seção Mão de Obra ───────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'MÃO DE OBRA', margin, y, contentWidth);

      if (maoObra.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        y = this.renderTableHeader(doc, ['Função', 'Qtd', 'Tipo'], [contentWidth * 0.6, 60, contentWidth * 0.4 - 60], margin, y, contentWidth);
        for (const m of maoObra) {
          y = this.renderTableRow(doc, [m.funcao, String(m.quantidade), m.tipo], [contentWidth * 0.6, 60, contentWidth * 0.4 - 60], margin, y, contentWidth);
        }
      }

      // ── Seção Equipamentos ──────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'EQUIPAMENTOS', margin, y, contentWidth);

      if (equipamentos.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        y = this.renderTableHeader(doc, ['Nome', 'Qtd', 'Unidade'], [contentWidth * 0.6, 60, contentWidth * 0.4 - 60], margin, y, contentWidth);
        for (const e of equipamentos) {
          y = this.renderTableRow(doc, [e.descricao, String(e.quantidade), e.unidade ?? '-'], [contentWidth * 0.6, 60, contentWidth * 0.4 - 60], margin, y, contentWidth);
        }
      }

      // ── Seção Atividades ────────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'ATIVIDADES', margin, y, contentWidth);

      if (atividades.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        for (const a of atividades) {
          const pct = a.percentual_executado != null ? `${a.percentual_executado}%` : '-';
          const extra = [a.pavimento, a.servico].filter(Boolean).join(' / ');
          const desc = extra ? `${a.descricao} (${extra})` : a.descricao;
          y = this.renderProgressRow(doc, desc, pct, margin, y, contentWidth);
        }
      }

      // ── Seção Ocorrências ───────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'OCORRÊNCIAS', margin, y, contentWidth);

      if (ocorrencias.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        for (const o of ocorrencias) {
          const impacto = o.grau_impacto ? ` [${o.grau_impacto.toUpperCase()}]` : '';
          const acao = o.acao_tomada ? ` → ${o.acao_tomada}` : '';
          const texto = `• [${o.tipo.replace(/_/g, ' ')}]${impacto} ${o.descricao}${acao}`;
          y = this.renderTextRow(doc, texto, margin, y, contentWidth);
        }
      }

      // ── Seção Checklist ─────────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'CHECKLIST', margin, y, contentWidth);

      if (checklist.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        for (const c of checklist) {
          const icone = c.resposta ? '✓' : '○';
          const obs = c.observacao ? ` — ${c.observacao}` : '';
          const texto = `${icone} ${c.item}${obs}`;
          y = this.renderTextRow(doc, texto, margin, y, contentWidth);
        }
      }

      // ── Seção Fotos ─────────────────────────────────────────────────────
      if (fotos.length > 0) {
        y = this.renderSectionHeader(doc, `REGISTRO FOTOGRÁFICO (${fotos.length} foto${fotos.length !== 1 ? 's' : ''})`, margin, y, contentWidth);
        for (const foto of fotos) {
          const legenda = foto.legenda ? ` — ${foto.legenda}` : '';
          const dataFoto = foto.created_at ? ` (${this.formatarDataHora(foto.created_at)})` : '';
          y = this.renderTextRow(doc, `• ${foto.nome_arquivo}${legenda}${dataFoto}`, margin, y, contentWidth);
        }
      }

      // ── Seção Resumo IA ─────────────────────────────────────────────────
      if (rdo.resumo_ia) {
        y = this.renderSectionHeader(doc, 'RESUMO IA', margin, y, contentWidth);
        y = this.renderTextBlock(doc, rdo.resumo_ia, margin, y, contentWidth);
      }

      // ── Seção Assinaturas ───────────────────────────────────────────────
      y = this.renderSectionHeader(doc, 'ASSINATURAS', margin, y, contentWidth);

      if (assinaturas.length === 0) {
        y = this.renderEmptyRow(doc, margin, y, contentWidth);
      } else {
        for (const a of assinaturas) {
          const dataAssinatura = this.formatarDataHora(a.criado_em);
          const texto = `${a.tipo.toUpperCase()} — Assinado em: ${dataAssinatura}`;
          y = this.renderTextRow(doc, texto, margin, y, contentWidth);
        }
      }

      // ── Rodapé ──────────────────────────────────────────────────────────
      doc.moveTo(margin, doc.page.height - 30)
        .lineTo(pageWidth - margin, doc.page.height - 30)
        .strokeColor(COR_SEPARATOR)
        .lineWidth(0.5)
        .stroke();

      doc.font('Helvetica').fontSize(8).fillColor('#6e7781');
      doc.text(
        `Gerado pelo sistema Eldox v3 — ${new Date().toLocaleString('pt-BR')}`,
        margin,
        doc.page.height - 22,
        { align: 'center', width: contentWidth },
      );

      doc.end();
    });
  }

  // ─── Helpers de renderização ──────────────────────────────────────────────

  private renderSectionHeader(doc: InstanceType<typeof PDFDocument>, title: string, x: number, y: number, width: number): number {
    // Verifica se precisa de nova página
    if (y + 30 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    doc.rect(x, y, width, 22).fill(COR_SECTION_BG);

    doc.moveTo(x, y).lineTo(x + width, y).strokeColor(COR_SEPARATOR).lineWidth(0.5).stroke();
    doc.moveTo(x, y + 22).lineTo(x + width, y + 22).strokeColor(COR_SEPARATOR).lineWidth(0.5).stroke();

    doc.font('Helvetica-Bold').fontSize(10).fillColor(COR_TEXT);
    doc.text(title, x + 8, y + 6);

    return y + 26;
  }

  private renderTextRow(doc: InstanceType<typeof PDFDocument>, text: string, x: number, y: number, width: number): number {
    if (y + 20 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    doc.text(text, x + 8, y + 4, { width: width - 16 });

    const textHeight = doc.heightOfString(text, { width: width - 16 });
    const rowHeight = Math.max(20, textHeight + 8);

    doc.moveTo(x, y + rowHeight).lineTo(x + width, y + rowHeight).strokeColor(COR_SEPARATOR).lineWidth(0.3).stroke();

    return y + rowHeight;
  }

  private renderTextBlock(doc: InstanceType<typeof PDFDocument>, text: string, x: number, y: number, width: number): number {
    if (y + 30 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    doc.text(text, x + 8, y + 6, { width: width - 16 });

    const textHeight = doc.heightOfString(text, { width: width - 16 });
    const blockHeight = textHeight + 16;

    doc.moveTo(x, y + blockHeight).lineTo(x + width, y + blockHeight).strokeColor(COR_SEPARATOR).lineWidth(0.3).stroke();

    return y + blockHeight;
  }

  private renderEmptyRow(doc: InstanceType<typeof PDFDocument>, x: number, y: number, width: number): number {
    return this.renderTextRow(doc, '(nenhum registro)', x, y, width);
  }

  private renderTableHeader(doc: InstanceType<typeof PDFDocument>, cols: string[], colWidths: number[], x: number, y: number, width: number): number {
    if (y + 22 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    doc.rect(x, y, width, 20).fill('#e1e4e8');

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_TEXT);
    let cx = x + 8;
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i], cx, y + 5, { width: colWidths[i] - 8 });
      cx += colWidths[i];
    }

    doc.moveTo(x, y + 20).lineTo(x + width, y + 20).strokeColor(COR_SEPARATOR).lineWidth(0.3).stroke();

    return y + 20;
  }

  private renderTableRow(doc: InstanceType<typeof PDFDocument>, cols: string[], colWidths: number[], x: number, y: number, width: number): number {
    if (y + 20 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    let cx = x + 8;
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i], cx, y + 4, { width: colWidths[i] - 8 });
      cx += colWidths[i];
    }

    doc.moveTo(x, y + 20).lineTo(x + width, y + 20).strokeColor(COR_SEPARATOR).lineWidth(0.3).stroke();

    return y + 20;
  }

  private renderProgressRow(doc: InstanceType<typeof PDFDocument>, descricao: string, pct: string, x: number, y: number, width: number): number {
    if (y + 20 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    const pctWidth = 50;
    const descWidth = width - pctWidth - 16;

    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    doc.text(descricao, x + 8, y + 4, { width: descWidth });

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COR_TEXT);
    doc.text(pct, x + 8 + descWidth + 8, y + 4, { width: pctWidth, align: 'right' });

    doc.moveTo(x, y + 20).lineTo(x + width, y + 20).strokeColor(COR_SEPARATOR).lineWidth(0.3).stroke();

    return y + 20;
  }

  // ─── Formatação de datas ──────────────────────────────────────────────────

  private formatarData(data: string | Date | undefined): string {
    if (!data) return '-';
    try {
      const d = typeof data === 'string' ? new Date(data + 'T00:00:00') : new Date(data);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return String(data);
    }
  }

  private formatarDataHora(data: Date | string | undefined): string {
    if (!data) return '-';
    try {
      const d = typeof data === 'string' ? new Date(data) : data;
      return d.toLocaleString('pt-BR');
    } catch {
      return String(data);
    }
  }

  // ─── Upload para MinIO ────────────────────────────────────────────────────

  private async uploadPdf(buffer: Buffer, path: string, rdoId: number, tenantId: number): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Minio = require('minio');
      const bucket = process.env.MINIO_BUCKET ?? 'eldox-ged';

      const client = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY ?? '',
        secretKey: process.env.MINIO_SECRET_KEY ?? '',
      });

      await client.putObject(bucket, path, buffer, buffer.length, { 'Content-Type': 'application/pdf' });

      await this.prisma.$executeRawUnsafe(
        `UPDATE rdos SET pdf_path = $1 WHERE id = $2 AND tenant_id = $3`,
        path,
        rdoId,
        tenantId,
      );

      this.logger.log(
        JSON.stringify({
          level: 'info',
          action: 'diario.pdf.upload.ok',
          rdo_id: rdoId,
          tenant_id: tenantId,
          path,
        }),
      );
    } catch (err) {
      // Upload é opcional — não interrompe o fluxo
      this.logger.error(
        JSON.stringify({
          level: 'error',
          action: 'diario.pdf.upload.erro',
          rdo_id: rdoId,
          tenant_id: tenantId,
          path,
          erro: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
