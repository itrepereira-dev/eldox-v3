// backend/src/almoxarifado/orcamento/orcamento.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AlmOrcamentoVersao, AlmOrcamentoItem } from '../types/alm.types';
import type { UpdateOrcamentoItemDto } from './dto/update-orcamento-item.dto';

// Tipos de linha do orçamento
type TipoLinha = 'COMPOSICAO' | 'INSUMO' | 'SERVICO' | 'EQUIPAMENTO';

// xlsx é carregado dinamicamente — instale com: npm install xlsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let xlsx: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  xlsx = require('xlsx');
} catch {
  // será validado no momento do uso
}

@Injectable()
export class OrcamentoService {
  private readonly logger = new Logger(OrcamentoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Listar versões ────────────────────────────────────────────────────────

  async getVersoes(tenantId: number, obraId: number): Promise<AlmOrcamentoVersao[]> {
    return this.prisma.$queryRawUnsafe<AlmOrcamentoVersao[]>(
      `SELECT v.*,
              COUNT(i.id)::int AS total_itens,
              u.nome AS importado_por_nome
       FROM alm_orcamento_versoes v
       LEFT JOIN alm_orcamento_itens i ON i.versao_id = v.id
       LEFT JOIN "Usuario" u ON u.id = v.importado_por
       WHERE v.tenant_id = $1 AND v.obra_id = $2 AND v.deleted_at IS NULL
       GROUP BY v.id, u.nome
       ORDER BY v.versao DESC`,
      tenantId, obraId,
    );
  }

  async getVersaoOuFalhar(tenantId: number, versaoId: number): Promise<AlmOrcamentoVersao> {
    const rows = await this.prisma.$queryRawUnsafe<AlmOrcamentoVersao[]>(
      `SELECT v.*, COUNT(i.id)::int AS total_itens
       FROM alm_orcamento_versoes v
       LEFT JOIN alm_orcamento_itens i ON i.versao_id = v.id
       WHERE v.id = $1 AND v.tenant_id = $2 AND v.deleted_at IS NULL
       GROUP BY v.id`,
      versaoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Versão de orçamento ${versaoId} não encontrada`);
    return rows[0];
  }

  // ── Importar planilha xlsx ────────────────────────────────────────────────

  async importarXlsx(
    tenantId: number,
    obraId: number,
    usuarioId: number,
    fileBuffer: Buffer,
    nome?: string,
  ): Promise<AlmOrcamentoVersao> {
    if (!xlsx) {
      throw new BadRequestException(
        'Biblioteca xlsx não encontrada. Execute "npm install xlsx" no backend.',
      );
    }

    const workbook  = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet     = workbook.Sheets[sheetName];
    const rows      = xlsx.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

    if (!rows.length) {
      throw new BadRequestException('Planilha vazia ou sem dados reconhecíveis');
    }

    // Determina o próximo número de versão
    const ultimaVersao = await this.prisma.$queryRawUnsafe<{ versao: number }[]>(
      `SELECT COALESCE(MAX(versao), 0)::int AS versao
       FROM alm_orcamento_versoes
       WHERE tenant_id = $1 AND obra_id = $2 AND deleted_at IS NULL`,
      tenantId, obraId,
    );
    const proximaVersao = (ultimaVersao[0]?.versao ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      // Cria versão
      const versaoRows = await tx.$queryRawUnsafe<AlmOrcamentoVersao[]>(
        `INSERT INTO alm_orcamento_versoes (tenant_id, obra_id, versao, nome, importado_por)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        tenantId, obraId, proximaVersao, nome ?? `Versão ${proximaVersao}`, usuarioId,
      );
      const versao = versaoRows[0];

      // Mapeia colunas — tenta variações de nome comuns
      const col = (row: Record<string, unknown>, ...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(row).find(
            (rk) => rk.toLowerCase().trim() === k.toLowerCase(),
          );
          if (found && row[found] !== null && row[found] !== undefined) {
            return row[found];
          }
        }
        return null;
      };

      // Insere itens em batch
      for (const row of rows) {
        const descricao = String(col(row, 'descrição', 'descricao', 'material', 'item', 'serviço', 'servico') ?? '').trim();
        if (!descricao) continue;

        const codigoSinapi = String(col(row, 'código sinapi', 'codigo sinapi', 'sinapi', 'cod. sinapi', 'código_sinapi') ?? '').trim() || null;
        const bdiRaw = col(row, 'bdi', 'bdi%', 'bdi (%)');
        const bdi = bdiRaw ? parseFloat(String(bdiRaw).replace('%','').replace(',','.')) : null;
        const precoUnitRaw = col(row, 'preço', 'preco', 'valor', 'preço unitário', 'p.u.', 'pu');
        const precoUnit = precoUnitRaw ? parseFloat(String(precoUnitRaw).replace(/\./g,'').replace(',','.')) : null;
        const etapa = String(col(row, 'etapa', 'fase', 'item') ?? '').slice(0, 100) || null;
        const tipo = String(col(row, 'tipo', 'natureza') ?? '').toUpperCase().slice(0, 30) || null;

        await tx.$executeRawUnsafe(
          `INSERT INTO alm_orcamento_itens
             (tenant_id, versao_id, descricao_orig, unidade, quantidade, preco_unitario,
              mes_previsto, etapa, sinapi_codigo)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          tenantId,
          versao.id,
          descricao,
          String(col(row, 'unidade', 'un', 'und') ?? '').slice(0, 20) || null,
          col(row, 'quantidade', 'qtd', 'qtde') ? Number(col(row, 'quantidade', 'qtd', 'qtde')) : null,
          precoUnit,
          col(row, 'mês', 'mes', 'month') ? Number(col(row, 'mês', 'mes', 'month')) : null,
          etapa,
          codigoSinapi,
        );
      }

      this.logger.log(JSON.stringify({
        action: 'alm.orcamento.import',
        tenantId, obraId, versaoId: versao.id, totalItens: rows.length,
      }));

      return versao;
    });
  }

  // ── Ativar versão ─────────────────────────────────────────────────────────

  async ativarVersao(tenantId: number, versaoId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Desativa todas
      await tx.$executeRawUnsafe(
        `UPDATE alm_orcamento_versoes SET ativo = false
         WHERE tenant_id = $1 AND obra_id = (
           SELECT obra_id FROM alm_orcamento_versoes WHERE id = $2
         )`,
        tenantId, versaoId,
      );
      // Ativa a selecionada
      await tx.$executeRawUnsafe(
        `UPDATE alm_orcamento_versoes SET ativo = true
         WHERE id = $1 AND tenant_id = $2`,
        versaoId, tenantId,
      );
    });
  }

  // ── Itens ────────────────────────────────────────────────────────────────

  async getItens(
    tenantId: number,
    versaoId: number,
    filters: { limit?: number; offset?: number; semMatch?: boolean } = {},
  ): Promise<AlmOrcamentoItem[]> {
    const limit  = filters.limit  ?? 100;
    const offset = filters.offset ?? 0;
    const where  = filters.semMatch ? 'AND i.catalogo_id IS NULL' : '';

    return this.prisma.$queryRawUnsafe<AlmOrcamentoItem[]>(
      `SELECT i.*, m.nome AS catalogo_nome
       FROM alm_orcamento_itens i
       LEFT JOIN fvm_catalogo_materiais m ON m.id = i.catalogo_id
       WHERE i.versao_id = $1
         AND i.versao_id IN (
           SELECT id FROM alm_orcamento_versoes WHERE tenant_id = $2
         )
         ${where}
       ORDER BY i.id ASC
       LIMIT $3 OFFSET $4`,
      versaoId, tenantId, limit, offset,
    );
  }

  async updateItem(
    tenantId: number,
    itemId: number,
    dto: UpdateOrcamentoItemDto,
  ): Promise<AlmOrcamentoItem> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (dto.catalogo_id    !== undefined) { sets.push(`catalogo_id = $${i++}`);    vals.push(dto.catalogo_id); }
    if (dto.unidade        !== undefined) { sets.push(`unidade = $${i++}`);        vals.push(dto.unidade); }
    if (dto.quantidade     !== undefined) { sets.push(`quantidade = $${i++}`);     vals.push(dto.quantidade); }
    if (dto.preco_unitario !== undefined) { sets.push(`preco_unitario = $${i++}`); vals.push(dto.preco_unitario); }
    if (dto.mes_previsto   !== undefined) { sets.push(`mes_previsto = $${i++}`);   vals.push(dto.mes_previsto); }
    if (dto.etapa          !== undefined) { sets.push(`etapa = $${i++}`);          vals.push(dto.etapa); }

    if (!sets.length) throw new BadRequestException('Nenhum campo para atualizar');
    sets.push(`updated_at = NOW()`);
    vals.push(itemId, tenantId);

    const rows = await this.prisma.$queryRawUnsafe<AlmOrcamentoItem[]>(
      `UPDATE alm_orcamento_itens i
       SET ${sets.join(', ')}
       WHERE i.id = $${i++}
         AND i.versao_id IN (
           SELECT id FROM alm_orcamento_versoes WHERE tenant_id = $${i++}
         )
       RETURNING i.*`,
      ...vals,
    );
    if (!rows.length) throw new NotFoundException(`Item ${itemId} não encontrado`);
    return rows[0];
  }

  // ── Gerar planilha modelo para download ───────────────────────────────────
  // Gera um arquivo XLSX com estrutura padrão SINAPI para ser preenchido pelo usuário.

  gerarTemplate(): Buffer {
    if (!xlsx) throw new BadRequestException('Biblioteca xlsx não instalada');

    const wb = xlsx.utils.book_new();

    // ── Aba 1: ORÇAMENTO ──────────────────────────────────────────────────
    const headerOrc = [
      'Item',
      'Código SINAPI',
      'Tipo',          // COMPOSICAO | INSUMO | SERVICO | EQUIPAMENTO
      'Etapa',
      'Descrição',
      'Unidade',
      'Quantidade',
      'Preço Unitário (R$)',
      'BDI (%)',
      'Preço Total (R$)',
      'Mês Previsto',  // 1-12
      'Observações',
    ];

    const exemploOrc = [
      ['1',     '',           'SERVICO',     'FUNDAÇÃO',     'SERVIÇOS DE FUNDAÇÃO',                 '',    '',    '',   '25', '',       '',  ''],
      ['1.1',   '72148',      'COMPOSICAO',  'FUNDAÇÃO',     'ESCAVAÇÃO MANUAL DE VALA',             'm³',  '10',  '45', '25', '562,50', '1', ''],
      ['1.1.1', '00004816',   'INSUMO',      'FUNDAÇÃO',     'AJUDANTE DE OBRAS',                    'h',   '40',  '11.25', '0', '450,00', '1', ''],
      ['1.1.2', '00004777',   'INSUMO',      'FUNDAÇÃO',     'SERVENTE',                             'h',   '20',  '10.50', '0', '210,00', '1', ''],
      ['2',     '',           'SERVICO',     'ALVENARIA',    'SERVIÇOS DE ALVENARIA',                '',    '',    '',   '25', '',       '',  ''],
      ['2.1',   '87475',      'COMPOSICAO',  'ALVENARIA',    'ALVENARIA C/ BLOCOS CERÂMICOS 14CM',   'm²',  '120', '85', '25', '12750,00','2', ''],
      ['2.1.1', '00001379',   'INSUMO',      'ALVENARIA',    'BLOCO CERÂMICO 14x19x29CM',            'un',  '1320','1.20','0', '1584,00','2', ''],
      ['2.1.2', '00000364',   'INSUMO',      'ALVENARIA',    'CIMENTO PORTLAND CP-II-E-32 50KG',     'kg',  '230', '0.65','0', '149,50', '2', ''],
      ['2.1.3', '00000371',   'INSUMO',      'ALVENARIA',    'AREIA MÉDIA',                          'm³',  '0.8', '95', '0', '76,00',  '2', ''],
      ['3',     '',           'SERVICO',     'COBERTURA',    'SERVIÇOS DE COBERTURA',                '',    '',    '',   '25', '',       '',  ''],
      ['3.1',   '88309',      'COMPOSICAO',  'COBERTURA',    'TELHAMENTO C/ TELHA CERÂMICA FRANCESA','m²',  '80',  '55', '25', '5500,00','3', ''],
      ['3.1.1', '00006114',   'INSUMO',      'COBERTURA',    'TELHA CERÂMICA FRANCESA',              'un',  '960', '1.80','0', '1728,00','3', ''],
      ['4',     '',           'SERVICO',     'REVESTIMENTO', 'SERVIÇOS DE REVESTIMENTO',             '',    '',    '',   '25', '',       '',  ''],
      ['4.1',   '87395',      'COMPOSICAO',  'REVESTIMENTO', 'REBOCO EXTERNO DESEMPENADO',           'm²',  '200', '35', '25', '8750,00','4', ''],
      ['4.2',   '87402',      'COMPOSICAO',  'REVESTIMENTO', 'PINTURA LÁTEX PVA INTERNA',            'm²',  '350', '15', '25', '6562,50','4', ''],
      ['4.2.1', '00006230',   'INSUMO',      'REVESTIMENTO', 'TINTA LÁTEX PVA BRANCA 3,6L',          'lt',  '120', '28', '0', '3360,00','4', ''],
    ];

    const wsOrc = xlsx.utils.aoa_to_sheet([headerOrc, ...exemploOrc]);

    // Larguras das colunas
    wsOrc['!cols'] = [
      { wch: 8 },  // Item
      { wch: 14 }, // Código SINAPI
      { wch: 14 }, // Tipo
      { wch: 16 }, // Etapa
      { wch: 55 }, // Descrição
      { wch: 8 },  // Unidade
      { wch: 10 }, // Quantidade
      { wch: 18 }, // Preço Unit.
      { wch: 8 },  // BDI%
      { wch: 16 }, // Preço Total
      { wch: 12 }, // Mês
      { wch: 30 }, // Obs
    ];

    xlsx.utils.book_append_sheet(wb, wsOrc, 'ORÇAMENTO');

    // ── Aba 2: INSUMOS (só os que vão para estoque) ───────────────────────
    const headerIns = [
      'Código SINAPI',
      'Descrição do Insumo',
      'Unidade',
      'Quantidade Total',
      'Preço Unitário (R$)',
      'Preço Total (R$)',
      'Etapa',
      'Mês Previsto',
    ];
    const exemploIns = [
      ['00004816', 'AJUDANTE DE OBRAS',                 'h',  '40',  '11,25', '450,00',  'FUNDAÇÃO',    '1'],
      ['00000364', 'CIMENTO PORTLAND CP-II-E-32 50KG',  'kg', '230', '0,65',  '149,50',  'ALVENARIA',   '2'],
      ['00001379', 'BLOCO CERÂMICO 14x19x29CM',         'un', '1320','1,20',  '1.584,00','ALVENARIA',   '2'],
      ['00006230', 'TINTA LÁTEX PVA BRANCA 3,6L',       'lt', '120', '28,00', '3.360,00','REVESTIMENTO','4'],
      ['Obs: Esta aba é para referência. Importe apenas a aba ORÇAMENTO no sistema.','','','','','','',''],
    ];
    const wsIns = xlsx.utils.aoa_to_sheet([headerIns, ...exemploIns]);
    wsIns['!cols'] = [
      { wch: 14 }, { wch: 50 }, { wch: 8 }, { wch: 14 },
      { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
    ];
    xlsx.utils.book_append_sheet(wb, wsIns, 'INSUMOS (REF)');

    // ── Aba 3: INSTRUÇÕES ─────────────────────────────────────────────────
    const instrucoes = [
      ['INSTRUÇÕES DE PREENCHIMENTO — ELDOX Orçamento de Obra'],
      [''],
      ['COLUNA', 'OBRIGATÓRIO', 'DESCRIÇÃO'],
      ['Item',           'Sim', 'Numeração hierárquica (1, 1.1, 1.1.1). Itens pai sem preço são agrupadores.'],
      ['Código SINAPI',  'Não', 'Código SINAPI de referência. Se preenchido, o sistema importa o preço automaticamente.'],
      ['Tipo',           'Sim', 'COMPOSICAO | INSUMO | SERVICO | EQUIPAMENTO'],
      ['Etapa',          'Sim', 'Nome da etapa ou fase da obra (ex: FUNDAÇÃO, ALVENARIA).'],
      ['Descrição',      'Sim', 'Nome do serviço ou insumo. Máx. 500 caracteres.'],
      ['Unidade',        'Sim', 'Unidade de medida: un, m², m³, kg, lt, h, sc, cx, etc.'],
      ['Quantidade',     'Sim', 'Quantidade prevista (número decimal com ponto ou vírgula).'],
      ['Preço Unitário', 'Sim', 'Preço por unidade em R$. Decimal com vírgula ou ponto.'],
      ['BDI (%)',        'Não', 'BDI aplicado ao item. Padrão: 25% para composições, 0% para insumos.'],
      ['Preço Total',    'Não', 'Calculado automaticamente = Qtd × P.U. × (1 + BDI%). Pode deixar em branco.'],
      ['Mês Previsto',   'Não', 'Número do mês de utilização: 1 a 12. Usado para previsão de insumos.'],
      ['Observações',    'Não', 'Notas adicionais.'],
      [''],
      ['DICAS IMPORTANTES:'],
      ['• Itens do TIPO = INSUMO são os materiais que entram no estoque.'],
      ['• O sistema faz o match automático com o catálogo de materiais usando IA.'],
      ['• Se o Código SINAPI for preenchido, o preço de referência é importado automaticamente da tabela SINAPI.'],
      ['• Linhas sem descrição são ignoradas na importação.'],
      ['• O arquivo deve ser salvo como .xlsx (Excel 2007 ou superior).'],
      ['• Remova estas abas de INSTRUÇÕES e INSUMOS (REF) antes de importar, ou importe apenas a aba ORÇAMENTO.'],
    ];
    const wsIns2 = xlsx.utils.aoa_to_sheet(instrucoes);
    wsIns2['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 90 }];
    xlsx.utils.book_append_sheet(wb, wsIns2, 'INSTRUÇÕES');

    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  // ── Soft delete ───────────────────────────────────────────────────────────

  async deleteVersao(tenantId: number, versaoId: number): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<{ ativo: boolean }[]>(
      `SELECT ativo FROM alm_orcamento_versoes WHERE id = $1 AND tenant_id = $2`,
      versaoId, tenantId,
    );
    if (!rows.length) throw new NotFoundException(`Versão ${versaoId} não encontrada`);
    if (rows[0].ativo) throw new BadRequestException('Não é possível excluir a versão ativa');

    await this.prisma.$executeRawUnsafe(
      `UPDATE alm_orcamento_versoes SET deleted_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      versaoId, tenantId,
    );
  }
}
