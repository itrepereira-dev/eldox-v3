// backend/src/almoxarifado/cotacoes/vpl.util.ts
// ─────────────────────────────────────────────────────────────────────────────
// Utilitário puro para cálculo de Valor Presente (VP) de propostas de cotação.
//
// Motivação:
//   Comparar apenas preço nominal entre fornecedores com condições de pagamento
//   diferentes induz ao erro. Exemplo:
//     Fornecedor A: R$ 10.000 à vista
//     Fornecedor B: R$ 10.200 em 60 dias
//   À taxa de 1,5% a.m., o VP de B é ~R$ 9.902 — portanto é MAIS BARATO que A.
//
// Fórmula clássica:
//   VP = VN / (1 + i)^(n/30)
//   onde n = dias até o vencimento, i = taxa mensal (decimal).
//
// Para pagamentos parcelados (ex.: 30/60/90), o VP total é a soma dos VPs de
// cada parcela — assume-se divisão igualitária entre as parcelas.
// ─────────────────────────────────────────────────────────────────────────────

import { Logger } from '@nestjs/common';

const logger = new Logger('VplUtil');

// TODO(sprint-futuro): ler taxa mensal de `tenant_config.vpl_taxa_mensal`.
// Por ora mantemos o MVP em 1,5% a.m., alinhado ao CDI médio histórico.
export const VPL_TAXA_MENSAL_DEFAULT = 0.015;

export interface CalcularVplParams {
  /** Valor nominal total da proposta (R$). */
  valorNominal: number;
  /** Condição de pagamento. Ex.: 'AVISTA' | '30' | '30_60' | '30_60_90' | '60' | '90' | string custom. */
  condicaoPgto: string | null | undefined;
  /** Taxa mensal de desconto em decimal. Ex.: 0.015 = 1,5% a.m. */
  taxaMensal: number;
  /** Frete adicional (R$). Soma ao valor nominal antes do desconto (assumido como pago no mesmo fluxo). */
  frete?: number;
}

/**
 * Converte uma condição de pagamento textual em uma lista de prazos (em dias).
 *
 * Suporta:
 *  - 'AVISTA' ou null/undefined/''  → [0]
 *  - '30'                            → [30]
 *  - '60'                            → [60]
 *  - '90'                            → [90]
 *  - '30_60'                         → [30, 60]
 *  - '30_60_90'                      → [30, 60, 90]
 *  - 'N' (inteiro)                   → [N]
 *  - 'N1_N2_...' (ex.: '15_45_75')   → [N1, N2, ...]
 *
 * Retorna `null` se não conseguir parsear — caller deve aplicar fallback.
 */
export function parsePrazosDias(condicaoPgto: string | null | undefined): number[] | null {
  if (condicaoPgto == null || condicaoPgto === '') return [0];

  const norm = String(condicaoPgto).trim().toUpperCase();
  if (norm === 'AVISTA' || norm === 'A_VISTA' || norm === 'À VISTA') return [0];

  const partes = norm.split('_').map((p) => p.trim());
  const dias: number[] = [];
  for (const p of partes) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) return null;
    dias.push(n);
  }
  return dias.length ? dias : null;
}

/**
 * Calcula o Valor Presente (VP) de uma proposta, descontando cada parcela
 * pela taxa mensal informada.
 *
 * Retorna o valor nominal (fallback) se a condição de pagamento não puder ser
 * interpretada — logando um warning para rastreamento.
 */
export function calcularVpl(params: CalcularVplParams): number {
  const { valorNominal, condicaoPgto, taxaMensal, frete = 0 } = params;

  const totalNominal = Number(valorNominal || 0) + Number(frete || 0);
  if (totalNominal <= 0) return 0;

  const prazos = parsePrazosDias(condicaoPgto);
  if (prazos == null) {
    logger.warn(
      JSON.stringify({
        action: 'vpl.condicao_desconhecida',
        condicaoPgto,
        valorNominal,
        fallback: 'valor_nominal',
      }),
    );
    return round2(totalNominal);
  }

  // Sem desconto (à vista puro)
  if (prazos.length === 1 && prazos[0] === 0) return round2(totalNominal);
  // Taxa zero → sem efeito temporal
  if (!taxaMensal || taxaMensal <= 0) return round2(totalNominal);

  const parcela = totalNominal / prazos.length;
  let vpTotal = 0;
  for (const dias of prazos) {
    vpTotal += parcela / Math.pow(1 + taxaMensal, dias / 30);
  }
  return round2(vpTotal);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
