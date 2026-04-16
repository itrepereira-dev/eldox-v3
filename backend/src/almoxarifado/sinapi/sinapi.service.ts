// backend/src/almoxarifado/sinapi/sinapi.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// xlsx carregado dinamicamente
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let xlsx: any = null;
try { xlsx = require('xlsx'); } catch { /* ignorado — validado no uso */ }

export interface SinapiInsumo {
  id: number;
  codigo: string;
  descricao: string;
  unidade: string;
  tipo: string;
  grupo: string | null;
  uf: string;
  preco_desonerado: number | null;
  preco_nao_desonerado: number | null;
  referencia_mes: string;
}

@Injectable()
export class SinapiService {
  private readonly logger = new Logger(SinapiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Importar planilha SINAPI da CAIXA ────────────────────────────────────────
  // O arquivo padrão da CAIXA tem:
  //   CÓDIGO | DESCRIÇÃO | UNIDADE | TIPO | (opcionais: GRUPO)
  //   Seguido de colunas por UF: "ACRE (R$)", "ALAGOAS (R$)", etc.
  //
  // Formato alternativo (por UF): CÓDIGO | DESCRIÇÃO | UNIDADE | PREÇO
  // Detectamos automaticamente qual formato está sendo usado.

  async importarXlsx(
    fileBuffer: Buffer,
    uf: string,
    referenciaMes: string, // YYYY-MM
    desonerado: boolean = false,
  ): Promise<{ inseridos: number; atualizados: number; ignorados: number }> {
    if (!xlsx) throw new BadRequestException('Biblioteca xlsx não instalada. Execute: npm install xlsx');

    const ufNorm = uf.toUpperCase().trim();
    if (!/^[A-Z]{2}$/.test(ufNorm)) throw new BadRequestException('UF inválida. Use 2 letras (ex: SP, RJ)');
    if (!/^\d{4}-\d{2}$/.test(referenciaMes)) throw new BadRequestException('Mês de referência inválido. Use YYYY-MM');

    const wb    = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false }) as Record<string, string | null>[];

    if (!rows.length) throw new BadRequestException('Planilha vazia');

    // Detectar formato das colunas
    const primeiraLinha = rows[0];
    const colunas = Object.keys(primeiraLinha).map((k) => k.toUpperCase().trim());

    // Helpers para encontrar colunas por variações de nome
    const findCol = (row: Record<string, string | null>, ...keys: string[]): string | null => {
      for (const key of keys) {
        const found = Object.keys(row).find((k) => k.toUpperCase().trim() === key);
        if (found && row[found]) return String(row[found]).trim();
      }
      return null;
    };

    // Detecta coluna de preço: pode ser específica da UF ou genérica
    const colPrecoUf = colunas.find(
      (c) => c.includes(ufNorm) && c.includes('R$'),
    );
    const campoPreco = desonerado ? 'DESONERADO' : 'NÃO DESONERADO';
    const colPrecoGen = colunas.find(
      (c) => c.includes(campoPreco) || c.includes('PRECO') || c.includes('PREÇO') || c.includes('VALOR'),
    );
    const colPreco = colPrecoUf ?? colPrecoGen ?? null;

    this.logger.log(JSON.stringify({
      action: 'sinapi.import.start',
      uf: ufNorm, referenciaMes, linhas: rows.length, colPreco,
    }));

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;
    const BATCH = 200;

    // Processa em lotes para não travar a conexão
    for (let i = 0; i < rows.length; i += BATCH) {
      const lote = rows.slice(i, i + BATCH);

      for (const row of lote) {
        const codigo = findCol(row, 'CÓDIGO', 'CODIGO', 'CÓD', 'COD', 'CÓDIGO SINAPI');
        const descricao = findCol(row, 'DESCRIÇÃO', 'DESCRICAO', 'DESCRIÇÃO DO SERVIÇO', 'SERVIÇO');

        if (!codigo || !descricao) { ignorados++; continue; }

        const unidade = findCol(row, 'UNIDADE', 'UN', 'UND', 'UNID') ?? 'un';
        const tipo = findCol(row, 'TIPO', 'NATUREZA') ?? 'INSUMO';
        const grupo = findCol(row, 'GRUPO', 'CATEGORIA', 'CLASSE');

        let precoRaw: number | null = null;
        if (colPreco) {
          const rawStr = Object.entries(row).find(
            ([k]) => k.toUpperCase().trim() === colPreco,
          )?.[1];
          if (rawStr) {
            const num = parseFloat(
              String(rawStr).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''),
            );
            if (!isNaN(num) && num > 0) precoRaw = num;
          }
        }

        // UPSERT: se já existe para este código/UF/mês, atualiza preço
        const exists = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM sinapi_insumos WHERE codigo = $1 AND uf = $2 AND referencia_mes = $3`,
          codigo, ufNorm, referenciaMes,
        );

        if (exists.length) {
          await this.prisma.$executeRawUnsafe(
            `UPDATE sinapi_insumos
             SET descricao = $1, unidade = $2, tipo = $3, grupo = $4,
                 ${desonerado ? 'preco_desonerado' : 'preco_nao_desonerado'} = $5,
                 updated_at = NOW()
             WHERE id = $6`,
            descricao, unidade, tipo.toUpperCase(), grupo, precoRaw, exists[0].id,
          );
          atualizados++;
        } else {
          await this.prisma.$executeRawUnsafe(
            `INSERT INTO sinapi_insumos
               (codigo, descricao, unidade, tipo, grupo, uf, referencia_mes,
                ${desonerado ? 'preco_desonerado' : 'preco_nao_desonerado'})
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            codigo, descricao, unidade, tipo.toUpperCase(), grupo, ufNorm, referenciaMes, precoRaw,
          );
          inseridos++;
        }
      }
    }

    this.logger.log(JSON.stringify({
      action: 'sinapi.import.done',
      uf: ufNorm, referenciaMes, inseridos, atualizados, ignorados,
    }));

    return { inseridos, atualizados, ignorados };
  }

  // ── Buscar insumos SINAPI ─────────────────────────────────────────────────────

  async buscar(params: {
    uf: string;
    referenciaMes?: string;
    q?: string;
    tipo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SinapiInsumo[]; total: number }> {
    const uf = params.uf.toUpperCase();
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    // Mês mais recente se não informado
    let mes = params.referenciaMes;
    if (!mes) {
      const latest = await this.prisma.$queryRawUnsafe<{ referencia_mes: string }[]>(
        `SELECT referencia_mes FROM sinapi_insumos WHERE uf = $1 AND ativo = true
         ORDER BY referencia_mes DESC LIMIT 1`,
        uf,
      );
      mes = latest[0]?.referencia_mes ?? '';
      if (!mes) return { items: [], total: 0 };
    }

    let where = `WHERE s.uf = $1 AND s.referencia_mes = $2 AND s.ativo = true`;
    const vals: unknown[] = [uf, mes];
    let p = 3;

    if (params.q) {
      where += ` AND to_tsvector('portuguese', s.descricao) @@ plainto_tsquery('portuguese', $${p++})`;
      vals.push(params.q);
    }
    if (params.tipo) {
      where += ` AND s.tipo = $${p++}`;
      vals.push(params.tipo.toUpperCase());
    }

    const [items, counts] = await Promise.all([
      this.prisma.$queryRawUnsafe<SinapiInsumo[]>(
        `SELECT * FROM sinapi_insumos s ${where} ORDER BY s.descricao ASC LIMIT $${p++} OFFSET $${p}`,
        ...vals, limit, offset,
      ),
      this.prisma.$queryRawUnsafe<{ total: number }[]>(
        `SELECT COUNT(*)::int AS total FROM sinapi_insumos s ${where}`,
        ...vals,
      ),
    ]);

    return { items, total: counts[0]?.total ?? 0 };
  }

  // ── Buscar por código exato ───────────────────────────────────────────────────

  async buscarPorCodigo(codigo: string, uf: string): Promise<SinapiInsumo | null> {
    const rows = await this.prisma.$queryRawUnsafe<SinapiInsumo[]>(
      `SELECT * FROM sinapi_insumos
       WHERE codigo = $1 AND uf = $2 AND ativo = true
       ORDER BY referencia_mes DESC LIMIT 1`,
      codigo, uf.toUpperCase(),
    );
    return rows[0] ?? null;
  }

  // ── Listar meses disponíveis por UF ──────────────────────────────────────────

  async listarMeses(uf: string): Promise<{ referencia_mes: string; total: number }[]> {
    return this.prisma.$queryRawUnsafe(
      `SELECT referencia_mes, COUNT(*)::int AS total
       FROM sinapi_insumos WHERE uf = $1 AND ativo = true
       GROUP BY referencia_mes ORDER BY referencia_mes DESC`,
      uf.toUpperCase(),
    );
  }

  // ── Listar UFs disponíveis ────────────────────────────────────────────────────

  async listarUfs(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ uf: string }[]>(
      `SELECT DISTINCT uf FROM sinapi_insumos WHERE ativo = true ORDER BY uf ASC`,
    );
    return rows.map((r) => r.uf);
  }
}
