// backend/src/ged/ged-export.service.ts
// Exportação da Lista Mestra do GED em PDF e XLSX — exigência PBQP-H SiAC 4.2.
// Reaproveita GedService.listaMestra() (apenas versões VIGENTES: IFC/IFP/AS_BUILT).
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GedService } from './ged.service';
import type { GedListaMestraItem } from './types/ged.types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xlsx = require('xlsx');

// ─── Cores (idem RdoPdfService) ───────────────────────────────────────────────
const COR_HEADER_BG = '#0d1117';
const COR_HEADER_TEXT = '#ffffff';
const COR_SECTION_BG = '#f6f8fa';
const COR_TEXT = '#1f2328';
const COR_SEPARATOR = '#d0d7de';

interface ObraRow {
  id: number;
  nome: string;
  codigo: string | null;
}

interface UsuarioRow {
  id: number;
  nome: string | null;
  email: string | null;
}

@Injectable()
export class GedExportService {
  private readonly logger = new Logger(GedExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gedService: GedService,
  ) {}

  // ─── PDF ──────────────────────────────────────────────────────────────────

  async gerarPdfListaMestra(tenantId: number, obraId: number): Promise<Buffer> {
    const [itens, obra, aprovadores] = await this.carregarDados(tenantId, obraId);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

      // ── Header ─────────────────────────────────────────────────────────
      doc.rect(margin, margin, contentWidth, 70).fill(COR_HEADER_BG);

      doc.font('Helvetica-Bold').fontSize(18).fillColor(COR_HEADER_TEXT);
      doc.text('ELDOX', margin + 12, margin + 14);

      doc.font('Helvetica-Bold').fontSize(14).fillColor(COR_HEADER_TEXT);
      doc.text('LISTA MESTRA DE DOCUMENTOS', margin + contentWidth / 2, margin + 14, {
        width: contentWidth / 2,
        align: 'right',
      });

      const obraNome = obra?.nome ?? `Obra #${obraId}`;
      const obraCodigo = obra?.codigo ? `${obra.codigo} · ` : '';
      doc.font('Helvetica').fontSize(10).fillColor(COR_HEADER_TEXT);
      doc.text(`${obraCodigo}${obraNome}`, margin + 12, margin + 38, {
        width: contentWidth / 2 - 12,
      });

      const geradoEm = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${geradoEm}`, margin + contentWidth / 2, margin + 38, {
        width: contentWidth / 2,
        align: 'right',
      });

      doc.font('Helvetica').fontSize(9).fillColor(COR_HEADER_TEXT);
      doc.text(
        `Total de documentos vigentes: ${itens.length}`,
        margin + 12,
        margin + 54,
      );
      doc.text('PBQP-H SiAC 4.2 · ISO 9001:2015', margin + contentWidth / 2, margin + 54, {
        width: contentWidth / 2,
        align: 'right',
      });

      let y = margin + 80;

      // ── Agrupa por disciplina (mesma ordenação que a query já entrega) ─
      const porDisciplina = new Map<string, GedListaMestraItem[]>();
      for (const item of itens) {
        const chave = item.disciplina ?? 'SEM DISCIPLINA';
        const lista = porDisciplina.get(chave) ?? [];
        lista.push(item);
        porDisciplina.set(chave, lista);
      }

      if (porDisciplina.size === 0) {
        y = this.renderSectionHeader(
          doc,
          'NENHUM DOCUMENTO VIGENTE',
          margin,
          y,
          contentWidth,
        );
        this.renderTextRow(
          doc,
          'Nenhum documento nas classificações IFC/IFP/AS_BUILT encontrado para esta obra.',
          margin,
          y,
          contentWidth,
        );
      }

      // ── Colunas da tabela ───────────────────────────────────────────────
      // Código, Título, Rev, Status, Aprovado em, Aprovado por
      const cols = ['Código', 'Título', 'Rev', 'Status', 'Aprovado em', 'Aprovador'];
      const colWidths = [
        contentWidth * 0.17, // Código
        contentWidth * 0.36, // Título
        contentWidth * 0.08, // Rev
        contentWidth * 0.09, // Status
        contentWidth * 0.13, // Aprovado em
        contentWidth * 0.17, // Aprovador
      ];

      for (const [disciplina, docs] of porDisciplina) {
        y = this.renderSectionHeader(
          doc,
          `${disciplina} (${docs.length} doc${docs.length !== 1 ? 's' : ''})`,
          margin,
          y,
          contentWidth,
        );
        y = this.renderTableHeader(doc, cols, colWidths, margin, y, contentWidth);

        for (const d of docs) {
          const aprov = d.aprovado_por
            ? aprovadores.get(d.aprovado_por) ?? `Usuário #${d.aprovado_por}`
            : '—';
          const aprovEm = this.formatarData(d.aprovado_em);
          y = this.renderTableRow(
            doc,
            [
              d.codigo,
              d.titulo,
              d.numero_revisao,
              d.status,
              aprovEm,
              aprov,
            ],
            colWidths,
            margin,
            y,
            contentWidth,
          );
        }
      }

      // ── Rodapé ──────────────────────────────────────────────────────────
      doc
        .moveTo(margin, doc.page.height - 30)
        .lineTo(pageWidth - margin, doc.page.height - 30)
        .strokeColor(COR_SEPARATOR)
        .lineWidth(0.5)
        .stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#6e7781');
      doc.text(
        `Gerado pelo sistema Eldox v3 — ${geradoEm}`,
        margin,
        doc.page.height - 22,
        { align: 'center', width: contentWidth },
      );

      doc.end();
    });
  }

  // ─── XLSX ─────────────────────────────────────────────────────────────────

  async gerarXlsxListaMestra(tenantId: number, obraId: number): Promise<Buffer> {
    const [itens, obra, aprovadores] = await this.carregarDados(tenantId, obraId);

    const wb = xlsx.utils.book_new();

    // ── Sheet 1: Lista Mestra ───────────────────────────────────────────────
    const header = [
      'Código',
      'Título',
      'Disciplina',
      'Pasta',
      'Revisão',
      'Versão',
      'Status',
      'Aprovado em',
      'Aprovador',
      'QR Token',
    ];

    const rows = itens.map((d) => [
      d.codigo,
      d.titulo,
      d.disciplina ?? '',
      d.pasta_path ?? '',
      d.numero_revisao,
      d.version,
      d.status,
      this.formatarData(d.aprovado_em),
      d.aprovado_por
        ? aprovadores.get(d.aprovado_por) ?? `Usuário #${d.aprovado_por}`
        : '',
      d.qr_token ?? '',
    ]);

    const metaRows = [
      [`Lista Mestra — ${obra?.nome ?? `Obra #${obraId}`}`],
      [
        `Obra: ${obra?.codigo ?? '-'} | Gerado em: ${new Date().toLocaleString(
          'pt-BR',
        )} | Total: ${itens.length}`,
      ],
      ['PBQP-H SiAC 4.2 · ISO 9001:2015'],
      [''],
    ];

    const ws = xlsx.utils.aoa_to_sheet([...metaRows, header, ...rows]);
    ws['!cols'] = [
      { wch: 18 }, // Código
      { wch: 40 }, // Título
      { wch: 12 }, // Disciplina
      { wch: 24 }, // Pasta
      { wch: 8 }, // Revisão
      { wch: 6 }, // Versão
      { wch: 10 }, // Status
      { wch: 18 }, // Aprovado em
      { wch: 24 }, // Aprovador
      { wch: 32 }, // QR Token
    ];
    xlsx.utils.book_append_sheet(wb, ws, 'Lista Mestra');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async carregarDados(
    tenantId: number,
    obraId: number,
  ): Promise<[GedListaMestraItem[], ObraRow | null, Map<number, string>]> {
    const [itens, obras] = await Promise.all([
      this.gedService.listaMestra(tenantId, obraId),
      this.prisma.$queryRawUnsafe<ObraRow[]>(
        `SELECT id, nome, codigo FROM "Obra" WHERE id = $1 AND "tenantId" = $2`,
        obraId,
        tenantId,
      ),
    ]);

    const obra = obras[0] ?? null;

    // Resolve nomes de aprovadores em uma query só (evita N+1)
    const aprovadorIds = Array.from(
      new Set(itens.map((i) => i.aprovado_por).filter((v): v is number => v != null)),
    );

    const aprovadores = new Map<number, string>();
    if (aprovadorIds.length > 0) {
      const rows = await this.prisma.$queryRawUnsafe<UsuarioRow[]>(
        `SELECT id, nome, email FROM "Usuario" WHERE id = ANY($1::int[]) AND "tenantId" = $2`,
        aprovadorIds,
        tenantId,
      );
      for (const r of rows) {
        aprovadores.set(r.id, r.nome ?? r.email ?? `Usuário #${r.id}`);
      }
    }

    return [itens, obra, aprovadores];
  }

  private formatarData(data: Date | string | null | undefined): string {
    if (!data) return '—';
    try {
      const d = typeof data === 'string' ? new Date(data) : data;
      return d.toLocaleDateString('pt-BR');
    } catch {
      return String(data);
    }
  }

  private renderSectionHeader(
    doc: InstanceType<typeof PDFDocument>,
    title: string,
    x: number,
    y: number,
    width: number,
  ): number {
    if (y + 30 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }
    doc.rect(x, y, width, 22).fill(COR_SECTION_BG);
    doc.moveTo(x, y).lineTo(x + width, y).strokeColor(COR_SEPARATOR).lineWidth(0.5).stroke();
    doc
      .moveTo(x, y + 22)
      .lineTo(x + width, y + 22)
      .strokeColor(COR_SEPARATOR)
      .lineWidth(0.5)
      .stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COR_TEXT);
    doc.text(title, x + 8, y + 6);
    return y + 26;
  }

  private renderTextRow(
    doc: InstanceType<typeof PDFDocument>,
    text: string,
    x: number,
    y: number,
    width: number,
  ): number {
    if (y + 20 > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }
    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    doc.text(text, x + 8, y + 4, { width: width - 16 });
    const textHeight = doc.heightOfString(text, { width: width - 16 });
    const rowHeight = Math.max(20, textHeight + 8);
    doc
      .moveTo(x, y + rowHeight)
      .lineTo(x + width, y + rowHeight)
      .strokeColor(COR_SEPARATOR)
      .lineWidth(0.3)
      .stroke();
    return y + rowHeight;
  }

  private renderTableHeader(
    doc: InstanceType<typeof PDFDocument>,
    cols: string[],
    colWidths: number[],
    x: number,
    y: number,
    width: number,
  ): number {
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
    doc
      .moveTo(x, y + 20)
      .lineTo(x + width, y + 20)
      .strokeColor(COR_SEPARATOR)
      .lineWidth(0.3)
      .stroke();
    return y + 20;
  }

  private renderTableRow(
    doc: InstanceType<typeof PDFDocument>,
    cols: string[],
    colWidths: number[],
    x: number,
    y: number,
    width: number,
  ): number {
    // Calcula altura necessária considerando quebra de linha do título
    doc.font('Helvetica').fontSize(9).fillColor(COR_TEXT);
    const heights = cols.map((c, i) =>
      doc.heightOfString(c ?? '', { width: colWidths[i] - 8 }),
    );
    const rowHeight = Math.max(20, ...heights.map((h) => h + 8));

    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }

    let cx = x + 8;
    for (let i = 0; i < cols.length; i++) {
      doc.text(cols[i] ?? '', cx, y + 4, {
        width: colWidths[i] - 8,
      });
      cx += colWidths[i];
    }
    doc
      .moveTo(x, y + rowHeight)
      .lineTo(x + width, y + rowHeight)
      .strokeColor(COR_SEPARATOR)
      .lineWidth(0.3)
      .stroke();
    return y + rowHeight;
  }
}
