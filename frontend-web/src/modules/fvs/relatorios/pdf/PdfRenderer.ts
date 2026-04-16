// frontend-web/src/modules/fvs/relatorios/pdf/PdfRenderer.ts
import { pdf } from '@react-pdf/renderer';
import type { ReportTipo } from '../types';
import type { RelatorioDadosResult } from '../hooks/useRelatorioFvs';
import type { ReportFiltros } from '../types';

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildFilename(tipo: ReportTipo, dados: RelatorioDadosResult): string {
  const date = new Date().toISOString().split('T')[0];
  const tipoSlug = tipo.toLowerCase().replace('_', '-');
  // Try to extract obra name from data
  const obraRaw = (dados as { obra_nome?: string; ficha?: { obra_nome?: string } }).obra_nome
    ?? (dados as { ficha?: { obra_nome?: string } }).ficha?.obra_nome
    ?? 'obra';
  const obraSlug = slugify(obraRaw).slice(0, 20);
  return `eldox-${tipoSlug}-${obraSlug}-${date}.pdf`;
}

export async function renderToPdf(
  tipo: ReportTipo,
  dados: RelatorioDadosResult,
  _filtros: ReportFiltros,
): Promise<void> {
  let DocumentComponent: React.ComponentType<{ dados: RelatorioDadosResult }>;

  switch (tipo) {
    case 'R1_FICHA': {
      const { FichaInspecaoPdf } = await import('./templates/FichaInspecaoPdf');
      DocumentComponent = FichaInspecaoPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R2_CONFORMIDADE': {
      const { ConformidadePdf } = await import('./templates/ConformidadePdf');
      DocumentComponent = ConformidadePdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R3_PENDENCIAS': {
      const { PendenciasPdf } = await import('./templates/PendenciasPdf');
      DocumentComponent = PendenciasPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R4_NCS': {
      const { NcsPdf } = await import('./templates/NcsPdf');
      DocumentComponent = NcsPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
    case 'R5_PA': {
      const { PlanoAcaoPdf } = await import('./templates/PlanoAcaoPdf');
      DocumentComponent = PlanoAcaoPdf as React.ComponentType<{ dados: RelatorioDadosResult }>;
      break;
    }
  }

  const { createElement } = await import('react');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(createElement(DocumentComponent, { dados }) as any).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(tipo, dados);
  a.click();
  // Revoke after short delay so browser picks up the download
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
