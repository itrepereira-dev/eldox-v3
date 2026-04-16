// frontend-web/src/modules/fvs/relatorios/excel/XlsxRenderer.ts
import type { ReportTipo, ReportFiltros } from '../types';
import type { RelatorioDadosResult } from '../hooks/useRelatorioFvs';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildXlsxFilename(tipo: ReportTipo, dados: RelatorioDadosResult): string {
  const date = new Date().toISOString().split('T')[0];
  const tipoSlug = tipo.toLowerCase().replace('_', '-');
  const obraRaw = (dados as { obra_nome?: string }).obra_nome ?? 'obra';
  const obraSlug = slugify(obraRaw).slice(0, 20);
  return `eldox-${tipoSlug}-${obraSlug}-${date}.xlsx`;
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function renderToXlsx(
  tipo: ReportTipo,
  dados: RelatorioDadosResult,
  _filtros: ReportFiltros,
): Promise<void> {
  const filename = buildXlsxFilename(tipo, dados);

  switch (tipo) {
    case 'R2_CONFORMIDADE': {
      const { gerarConformidadeXlsx } = await import('./ConformidadeXlsx');
      const buffer = await gerarConformidadeXlsx(dados as import('../types').R2ConformidadeData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R3_PENDENCIAS': {
      const { gerarPendenciasXlsx } = await import('./PendenciasXlsx');
      const buffer = await gerarPendenciasXlsx(dados as import('../types').R3PendenciasData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R4_NCS': {
      const { gerarNcsXlsx } = await import('./NcsXlsx');
      const buffer = await gerarNcsXlsx(dados as import('../types').R4NcsData);
      downloadBuffer(buffer, filename);
      break;
    }
    case 'R5_PA': {
      const { gerarPlanoAcaoXlsx } = await import('./PlanoAcaoXlsx');
      const buffer = await gerarPlanoAcaoXlsx(dados as import('../types').R5PlanoAcaoData);
      downloadBuffer(buffer, filename);
      break;
    }
    default:
      throw new Error(`Excel não suportado para tipo ${tipo}`);
  }
}
