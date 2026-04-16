// backend/src/fvs/pdf/fvs-pdf.service.ts
// Geração de PDF de inspeção FVS — fiel ao modelo V2 Eldox
// Estrutura: Header → Dados gerais → por Serviço → por Local → Itens + Fotos inline
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as https from 'https';
import * as http from 'http';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// ── Cores ──────────────────────────────────────────────────────────────────────
const COR_BG_HEADER  = '#0d1117';
const COR_HEADER_TXT = '#ffffff';
const COR_SECTION_BG = '#f0f3f6';
const COR_BODY_TXT   = '#1f2328';
const COR_SEP        = '#d0d7de';
const COR_CONFORME   = '#1a7f37';
const COR_NC         = '#cf222e';
const COR_NA         = '#6e7781';
const COR_LABEL      = '#57606a';

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface FichaInfo {
  id: number; tenant_id: number; obra_id: number;
  nome: string; status: string; regime: string;
  inspecionado_em: string | null; created_at: string;
  obra_nome: string; obra_endereco: string | null;
  inspetor_nome: string | null;
  modelo_nome: string | null;
}

interface RegistroItem {
  servico_nome: string; local_nome: string; item_descricao: string;
  item_criticidade: string; item_criterio_aceite: string | null;
  status: string; observacao: string | null;
  inspecionado_em: string | null; equipe_responsavel: string | null;
  evidencias: string[]; // URLs
  inspecionado_por_nome: string | null;
}

// ── Helper: download de imagem para Buffer ─────────────────────────────────────

function fetchImageBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { timeout: 10000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Status label + cor ─────────────────────────────────────────────────────────

function statusLabel(s: string): { text: string; cor: string } {
  switch (s) {
    case 'conforme':                  return { text: 'Conforme',                  cor: COR_CONFORME };
    case 'nao_conforme':              return { text: 'Não Conforme',              cor: COR_NC };
    case 'conforme_apos_reinspecao':  return { text: 'Conforme (Reinspeção)',     cor: COR_CONFORME };
    case 'nc_apos_reinspecao':        return { text: 'NC após Reinspeção',        cor: COR_NC };
    case 'liberado_com_concessao':    return { text: 'Liberado c/ Concessão',     cor: '#9a6700' };
    case 'excecao':                   return { text: 'Exceção',                   cor: '#9a6700' };
    case 'retrabalho':                return { text: 'Retrabalho',                cor: COR_NC };
    case 'nao_aplicavel':             return { text: 'Não Aplicável',             cor: COR_NA };
    default:                          return { text: 'Não Avaliado',              cor: COR_NA };
  }
}

@Injectable()
export class FvsPdfService {
  private readonly logger = new Logger(FvsPdfService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Geração por ficha (autenticado) ───────────────────────────────────────────

  async gerarPdf(
    fichaId: number,
    tenantId: number,
    opcoes: { apenasNc?: boolean; servicoIds?: number[] } = {},
  ): Promise<Buffer> {
    const { ficha, registros } = await this.carregarDados(fichaId, tenantId, opcoes);
    return this.buildPdf(ficha, registros);
  }

  // ── Geração por token (portal cliente) ────────────────────────────────────────

  async gerarPdfPorToken(token: string): Promise<{ buffer: Buffer; nomeArquivo: string }> {
    const fichas = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT f.id, f.tenant_id
       FROM fvs_fichas f
       WHERE f.token_cliente = $1
         AND (f.token_cliente_expires_at IS NULL OR f.token_cliente_expires_at > NOW())
         AND f.deleted_at IS NULL
         AND f.status IN ('concluida', 'aprovada')`,
      token,
    );
    if (!fichas.length) throw new NotFoundException('Link inválido ou expirado');

    const { ficha, registros } = await this.carregarDados(fichas[0].id, fichas[0].tenant_id);
    const buffer = await this.buildPdf(ficha, registros);
    const nomeArquivo = `FVS-${fichas[0].id}-${ficha.obra_nome?.replace(/\s/g, '_') ?? 'relatorio'}.pdf`;
    return { buffer, nomeArquivo };
  }

  // ── Carregamento de dados ──────────────────────────────────────────────────────

  private async carregarDados(
    fichaId: number,
    tenantId: number,
    opcoes: { apenasNc?: boolean; servicoIds?: number[] } = {},
  ): Promise<{ ficha: FichaInfo; registros: RegistroItem[] }> {
    // Ficha + obra + inspetor + modelo
    const fichaRows = await this.prisma.$queryRawUnsafe<FichaInfo[]>(
      `SELECT
         f.id, f.tenant_id, f.obra_id, f.nome, f.status, f.regime,
         f.updated_at AS inspecionado_em, f.created_at,
         o.nome AS obra_nome, o.endereco AS obra_endereco,
         u.nome AS inspetor_nome,
         m.nome AS modelo_nome
       FROM fvs_fichas f
       JOIN "Obra" o ON o.id = f.obra_id
       LEFT JOIN "Usuario" u ON u.id = f.criado_por
       LEFT JOIN fvs_modelos m ON m.id = f.modelo_id
       WHERE f.id = $1 AND f.tenant_id = $2 AND f.deleted_at IS NULL`,
      fichaId, tenantId,
    );
    if (!fichaRows.length) throw new NotFoundException(`Ficha ${fichaId} não encontrada`);
    const ficha = fichaRows[0];

    // Registros: serviço × local × item × contagem de evidências
    let whereFiltro = '';
    const params: unknown[] = [fichaId, tenantId];

    if (opcoes.apenasNc) {
      whereFiltro += ` AND r.status IN ('nao_conforme','nc_apos_reinspecao','retrabalho')`;
    }
    if (opcoes.servicoIds?.length) {
      params.push(opcoes.servicoIds);
      whereFiltro += ` AND r.servico_id = ANY($${params.length})`;
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{
      servico_nome: string; local_nome: string; item_descricao: string;
      item_criticidade: string; item_criterio_aceite: string | null;
      status: string; observacao: string | null; inspecionado_em: string | null;
      equipe_responsavel: string | null; inspecionado_por_nome: string | null;
      evidencias_count: number;
    }>>(
      `SELECT
         cs.nome AS servico_nome,
         ol."nomeCompleto" AS local_nome,
         ci.descricao AS item_descricao,
         ci.criticidade AS item_criticidade,
         ci.criterio_aceite AS item_criterio_aceite,
         r.status,
         r.observacao,
         r.inspecionado_em,
         fsl.equipe_responsavel,
         u.nome AS inspecionado_por_nome,
         (SELECT COUNT(e.id)::int FROM fvs_evidencias e WHERE e.registro_id = r.id)
           AS evidencias_count
       FROM fvs_registros r
       JOIN fvs_catalogo_servicos cs ON cs.id = r.servico_id
       JOIN "ObraLocal" ol ON ol.id = r.obra_local_id
       JOIN fvs_catalogo_itens ci ON ci.id = r.item_id
       LEFT JOIN fvs_ficha_servicos fs ON fs.ficha_id = r.ficha_id AND fs.servico_id = r.servico_id
       LEFT JOIN fvs_ficha_servico_locais fsl ON fsl.ficha_servico_id = fs.id AND fsl.obra_local_id = r.obra_local_id
       LEFT JOIN "Usuario" u ON u.id = r.inspecionado_por
       WHERE r.ficha_id = $1 AND r.tenant_id = $2 ${whereFiltro}
       ORDER BY cs.nome ASC, ol."nomeCompleto" ASC, ci.ordem ASC`,
      ...params,
    );

    const registros: RegistroItem[] = rows.map(row => ({
      servico_nome: row.servico_nome,
      local_nome: row.local_nome,
      item_descricao: row.item_descricao,
      item_criticidade: row.item_criticidade,
      item_criterio_aceite: row.item_criterio_aceite,
      status: row.status,
      observacao: row.observacao,
      inspecionado_em: row.inspecionado_em,
      equipe_responsavel: row.equipe_responsavel,
      inspecionado_por_nome: row.inspecionado_por_nome,
      evidencias: Array(Number(row.evidencias_count ?? 0)).fill(''), // placeholders for count
    }));

    return { ficha, registros };
  }

  // ── Construção do documento ────────────────────────────────────────────────────

  private async buildPdf(ficha: FichaInfo, registros: RegistroItem[]): Promise<Buffer> {
    // Pré-carregar imagens (máx 40 para não estourar memória)
    const urlsUnicas = [...new Set(registros.flatMap(r => r.evidencias))].slice(0, 40);
    const imgCache = new Map<string, Buffer>();
    await Promise.all(
      urlsUnicas.map(url =>
        fetchImageBuffer(url)
          .then(buf => imgCache.set(url, buf))
          .catch(() => { /* imagem não disponível — ignora */ }),
      ),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width;
      const M = 40;
      const CW = W - M * 2;
      let pageNum = 1;

      // ── Helpers de layout ─────────────────────────────────────────────────────

      const newPage = () => {
        doc.addPage();
        pageNum++;
      };

      const footer = () => {
        const y = doc.page.height - 28;
        doc
          .fontSize(8).fillColor(COR_LABEL)
          .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, M, y, { width: CW / 2 })
          .text(`Página ${pageNum}`, M + CW / 2, y, { width: CW / 2, align: 'right' });
      };

      const checkY = (needed: number) => {
        if (doc.y + needed > doc.page.height - 60) newPage();
      };

      const hRule = (y?: number) => {
        const yy = y ?? doc.y;
        doc.moveTo(M, yy).lineTo(M + CW, yy).strokeColor(COR_SEP).lineWidth(0.5).stroke();
      };

      // ── Capa / Header ─────────────────────────────────────────────────────────

      // Faixa escura de topo
      doc.rect(0, 0, W, 70).fill(COR_BG_HEADER);
      doc
        .fillColor(COR_HEADER_TXT)
        .fontSize(16).font('Helvetica-Bold')
        .text('RELATÓRIO DE INSPEÇÃO DE SERVIÇO', M, 18, { width: CW });
      doc
        .fontSize(9).font('Helvetica')
        .text(`Modelo: ${ficha.modelo_nome ?? ficha.nome}`, M, 42, { width: CW });

      // Subtítulo
      doc.moveDown(0.5).fillColor(COR_LABEL).fontSize(9)
        .text(`TIPO DO RELATÓRIO: ${ficha.regime.toUpperCase()}`, M, 76);

      doc.moveDown(0.3);
      hRule(doc.y);
      doc.moveDown(0.5);

      // ── Dados da ficha ────────────────────────────────────────────────────────

      doc
        .rect(M, doc.y, CW, 14).fill(COR_SECTION_BG);

      doc
        .fillColor(COR_BODY_TXT).fontSize(9).font('Helvetica-Bold')
        .text('DADOS DO RELATÓRIO', M + 6, doc.y - 12);

      doc.moveDown(0.8);

      const dadosY = doc.y;
      const col1 = M + 6;
      const col2 = M + 90;

      const dado = (label: string, valor: string, y: number, dy = 14) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor(COR_LABEL)
          .text(label.toUpperCase() + ':', col1, y);
        doc.fontSize(9).font('Helvetica').fillColor(COR_BODY_TXT)
          .text(valor, col2, y, { width: CW - 90 });
        return y + dy;
      };

      // Contar conformes / NCs
      const totalItens = registros.length;
      const totalConformes  = registros.filter(r => ['conforme','conforme_apos_reinspecao','liberado_com_concessao'].includes(r.status)).length;
      const totalNc         = registros.filter(r => ['nao_conforme','nc_apos_reinspecao','retrabalho'].includes(r.status)).length;
      const taxaConformidade = totalItens > 0 ? Math.round((totalConformes / totalItens) * 100) : 0;

      const servicosUnicos = [...new Set(registros.map(r => r.servico_nome))];

      let dy = dadosY;
      dy = dado('OBRA',          ficha.obra_nome, dy);
      if (ficha.obra_endereco) dy = dado('ENDEREÇO', ficha.obra_endereco, dy);
      dy = dado('MÓDULO',        'Serviço', dy);
      dy = dado('SERVIÇOS',      servicosUnicos.join(', '), dy, 24);
      dy = dado('INSPETOR',      ficha.inspetor_nome ?? '—', dy);
      dy = dado('CONFORMIDADES', `${totalConformes} conformes · ${totalNc} não conformes · ${taxaConformidade}% conformidade`, dy);

      doc.y = dy + 8;
      hRule();
      doc.moveDown(1);

      // ── Corpo — agrupado por Serviço ──────────────────────────────────────────

      // Agrupar: servico → local → itens
      type LocalMap = Map<string, RegistroItem[]>;
      type ServicoMap = Map<string, LocalMap>;

      const grupos: ServicoMap = new Map();
      for (const reg of registros) {
        if (!grupos.has(reg.servico_nome)) grupos.set(reg.servico_nome, new Map());
        const locais = grupos.get(reg.servico_nome)!;
        if (!locais.has(reg.local_nome)) locais.set(reg.local_nome, []);
        locais.get(reg.local_nome)!.push(reg);
      }

      for (const [servicoNome, locais] of grupos) {
        // Cabeçalho do serviço
        checkY(30);
        doc.rect(M, doc.y, CW, 18).fill('#1b4f72');
        doc
          .fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
          .text(servicoNome.toUpperCase(), M + 8, doc.y - 14, { width: CW - 16 });
        doc.moveDown(1.2);

        for (const [localNome, itens] of locais) {
          // Linha de localização
          checkY(22);
          const primeiroItem = itens[0];
          const dataInsp = primeiroItem.inspecionado_em
            ? new Date(primeiroItem.inspecionado_em).toLocaleDateString('pt-BR')
            : '—';
          const inspetor = primeiroItem.inspecionado_por_nome ?? '—';

          doc
            .fillColor(COR_LABEL).fontSize(8).font('Helvetica')
            .text(`${localNome}  |  ${dataInsp}  |  ${inspetor}`, M + 4, doc.y, { width: CW - 8 });
          doc.moveDown(0.6);
          hRule();
          doc.moveDown(0.4);

          for (const item of itens) {
            const { text: statusTxt, cor: statusCor } = statusLabel(item.status);
            const isNc = ['nao_conforme','nc_apos_reinspecao','retrabalho'].includes(item.status);

            // Estimativa de altura: item title + status + fotos se NC
            const nFotos = isNc ? Math.min(item.evidencias.length, 4) : 0;
            const estimatedH = 22 + (isNc && item.observacao ? 20 : 0) + (nFotos > 0 ? 90 : 0);
            checkY(estimatedH);

            const itemY = doc.y;

            // Item description (left) + status badge (right)
            doc
              .fillColor(COR_BODY_TXT).fontSize(9).font('Helvetica-Bold')
              .text(item.item_descricao.toUpperCase(), M + 4, itemY, { width: CW - 120, continued: false });

            // Status à direita
            doc
              .fontSize(9).font('Helvetica-Bold').fillColor(statusCor)
              .text(statusTxt, M + CW - 110, itemY, { width: 110, align: 'right' });

            doc.y = itemY + 14;

            // Critério de aceite (em itálico, pequeno)
            if (item.item_criterio_aceite) {
              doc
                .fontSize(7.5).font('Helvetica-Oblique').fillColor(COR_LABEL)
                .text(item.item_criterio_aceite, M + 4, doc.y, { width: CW - 8 });
              doc.moveDown(0.3);
            }

            // Fotos (apenas para itens com evidências)
            if (item.evidencias.length > 0) {
              const fotosToShow = item.evidencias.slice(0, 4);
              const fotoW = 85;
              const fotoH = 64;
              const gap = 8;
              let fx = M + 4;

              checkY(fotoH + 10);

              for (const url of fotosToShow) {
                const buf = url ? imgCache.get(url) : undefined;
                if (buf) {
                  try {
                    doc.image(buf, fx, doc.y, { width: fotoW, height: fotoH, cover: [fotoW, fotoH] });
                  } catch {
                    // imagem inválida — placeholder
                    doc.rect(fx, doc.y, fotoW, fotoH).fillAndStroke('#e0e0e0', COR_SEP);
                    doc.fontSize(7).fillColor(COR_LABEL).text('foto', fx + 30, doc.y + 27);
                  }
                } else {
                  // placeholder cinza
                  doc.rect(fx, doc.y, fotoW, fotoH).fillAndStroke('#e0e0e0', COR_SEP);
                  doc.fontSize(7).fillColor(COR_LABEL).text('foto', fx + 30, doc.y + 27);
                }
                fx += fotoW + gap;
                if (fx + fotoW > M + CW) break;
              }

              // Avança o cursor após as fotos
              doc.y += fotoH + 6;

              // Labels "Foto 1", "Foto 2"...
              let lx = M + 4;
              for (let fi = 0; fi < Math.min(fotosToShow.length, 4); fi++) {
                doc.fontSize(7).fillColor(COR_LABEL).text(`Foto ${fi + 1}`, lx, doc.y, { width: fotoW, align: 'center' });
                lx += fotoW + gap;
              }
              doc.moveDown(0.5);
            }

            // Observação
            if (item.observacao) {
              doc
                .fontSize(8).font('Helvetica').fillColor(COR_LABEL)
                .text(`Obs: ${item.observacao}`, M + 4, doc.y, { width: CW - 8 });
              doc.moveDown(0.3);
            }

            doc.moveDown(0.4);
            hRule();
            doc.moveDown(0.3);
          }

          // Equipe / líder
          const eq = itens[0]?.equipe_responsavel;
          if (eq) {
            doc
              .fontSize(8).font('Helvetica').fillColor(COR_LABEL)
              .text(`Líder: ${eq}`, M + 4, doc.y, { width: CW - 8 });
            doc.moveDown(0.8);
          } else {
            doc.moveDown(0.6);
          }
        }

        doc.moveDown(0.5);
      }

      // ── Rodapé da última página ───────────────────────────────────────────────
      footer();

      doc.end();
    });
  }
}
