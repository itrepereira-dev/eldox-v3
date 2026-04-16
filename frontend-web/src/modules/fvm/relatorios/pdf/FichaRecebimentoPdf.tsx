// frontend-web/src/modules/fvm/relatorios/pdf/FichaRecebimentoPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmLotePreview } from '@/services/fvm.service';

// ── Styles (NO Tailwind — StyleSheet.create only) ─────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    color: '#111827',
  },
  header: {
    marginBottom: 16,
    borderBottom: '2px solid #1D4ED8',
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
  },
  headerSub: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1D4ED8',
    backgroundColor: '#EFF6FF',
    padding: '4 6',
    marginBottom: 6,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 16,
  },
  fieldGroup: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 8,
    color: '#9CA3AF',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  fieldValue: {
    fontSize: 10,
    color: '#111827',
  },
  table: {
    borderTop: '1px solid #E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottom: '1px solid #E5E7EB',
    padding: '3 6',
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #F3F4F6',
    padding: '4 6',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  statusBadge: {
    padding: '2 6',
    borderRadius: 4,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    alignSelf: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: '#9CA3AF',
  },
});

// ── Badge color helper ────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
  const map: Record<string, { backgroundColor: string; color: string }> = {
    aprovado:              { backgroundColor: '#D1FAE5', color: '#065F46' },
    aprovado_com_ressalva: { backgroundColor: '#FEF3C7', color: '#92400E' },
    quarentena:            { backgroundColor: '#FFEDD5', color: '#9A3412' },
    reprovado:             { backgroundColor: '#FEE2E2', color: '#991B1B' },
  };
  return map[status] ?? { backgroundColor: '#F3F4F6', color: '#374151' };
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    aprovado:              'APROVADO',
    aprovado_com_ressalva: 'APROVADO C/ RESSALVA',
    quarentena:            'QUARENTENA',
    reprovado:             'REPROVADO',
    aguardando_inspecao:   'AGUARDANDO INSPEÇÃO',
    em_inspecao:           'EM INSPEÇÃO',
  };
  return map[status] ?? status.toUpperCase().replace(/_/g, ' ');
}

// ── Document component ────────────────────────────────────────────────────────

interface Props {
  lote: FvmLotePreview;
  tenantNome?: string;
  obraNome?: string;
}

export function FichaRecebimentoPdf({ lote, tenantNome, obraNome }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');
  const itens = (lote as any).itens ?? [];
  const ensaios = (lote as any).ensaios ?? [];
  const evidencias = (lote as any).evidencias ?? [];
  const ncs = (lote as any).nao_conformidades ?? [];

  return (
    <Document
      title={`Ficha de Recebimento — Lote ${lote.numero_lote}`}
      author="Eldox"
    >
      <Page size="A4" style={S.page}>
        {/* ── Cabeçalho ────────────────────────────────────────────────── */}
        <View style={S.header}>
          <View>
            <Text style={S.headerTitle}>Ficha de Recebimento de Material</Text>
            <Text style={S.headerSub}>{tenantNome ?? 'Eldox'} · {obraNome ?? `Obra`}</Text>
          </View>
          <View>
            <Text style={S.headerSub}>Gerado em {geradoEm}</Text>
            <Text style={S.headerSub}>Lote #{lote.id}</Text>
          </View>
        </View>

        {/* ── S1 — Identificação do Lote ───────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>1. Identificação do Lote</Text>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Material</Text>
              <Text style={S.fieldValue}>{lote.material_nome}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Fornecedor</Text>
              <Text style={S.fieldValue}>{lote.fornecedor_nome}</Text>
            </View>
          </View>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Número do Lote</Text>
              <Text style={S.fieldValue}>{lote.numero_lote}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Nota Fiscal</Text>
              <Text style={S.fieldValue}>{lote.numero_nf ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Data de Entrega</Text>
              <Text style={S.fieldValue}>{lote.data_entrega}</Text>
            </View>
          </View>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Qtd. NF</Text>
              <Text style={S.fieldValue}>{(lote as any).quantidade_nf ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Qtd. Recebida</Text>
              <Text style={S.fieldValue}>{(lote as any).quantidade_recebida ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Unidade</Text>
              <Text style={S.fieldValue}>{lote.unidade ?? '—'}</Text>
            </View>
          </View>
          {(lote as any).observacao_geral && (
            <View style={S.row}>
              <View style={S.fieldGroup}>
                <Text style={S.fieldLabel}>Observação Geral</Text>
                <Text style={S.fieldValue}>{(lote as any).observacao_geral}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── S2 — Resultado da Inspeção ───────────────────────────────── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>2. Resultado da Inspeção</Text>
          <View style={S.row}>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Status</Text>
              <View style={[S.statusBadge, getStatusStyle(lote.status)]}>
                <Text>{statusLabel(lote.status)}</Text>
              </View>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Inspecionado por</Text>
              <Text style={S.fieldValue}>{(lote as any).inspecionado_por ?? '—'}</Text>
            </View>
            <View style={S.fieldGroup}>
              <Text style={S.fieldLabel}>Data / Hora</Text>
              <Text style={S.fieldValue}>{(lote as any).inspecionado_em ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* ── S3 — Checklist ───────────────────────────────────────────── */}
        {itens.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>3. Checklist de Inspeção</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 0.4 }]}>Tipo</Text>
                <Text style={[S.tableHeaderCell, { flex: 2 }]}>Item</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.8 }]}>Resultado</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Observação</Text>
              </View>
              {itens.map((item: any) => (
                <View key={item.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 0.4 }]}>{item.tipo}</Text>
                  <Text style={[S.tableCell, { flex: 2 }]}>{item.descricao}</Text>
                  <Text style={[S.tableCell, { flex: 0.8 }]}>
                    {item.registro_status
                      ? item.registro_status.replace(/_/g, ' ')
                      : 'Não avaliado'}
                  </Text>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>
                    {item.registro_observacao ?? '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── S4 — Ensaios (if any) ────────────────────────────────────── */}
        {ensaios.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>4. Ensaios Laboratoriais</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Ensaio</Text>
                <Text style={[S.tableHeaderCell, { flex: 1 }]}>Norma</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.7 }]}>Valor</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.7 }]}>Min / Max</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Resultado</Text>
              </View>
              {ensaios.map((e: any) => (
                <View key={e.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>{e.nome_ensaio ?? e.tipo}</Text>
                  <Text style={[S.tableCell, { flex: 1 }]}>{e.norma ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.7 }]}>{e.valor_medido ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.7 }]}>
                    {e.valor_minimo != null ? `${e.valor_minimo}` : '—'} / {e.valor_maximo != null ? `${e.valor_maximo}` : '—'}
                  </Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{e.resultado ?? '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── S5 — Evidências ─────────────────────────────────────────── */}
        {evidencias.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>5. Documentos Vinculados</Text>
            {evidencias.map((ev: any, idx: number) => (
              <Text key={ev.id} style={[S.tableCell, { marginBottom: 3 }]}>
                {idx + 1}. [{ev.tipo ?? 'Documento'}] {ev.nome_arquivo ?? ev.nome ?? 'Arquivo'}
              </Text>
            ))}
          </View>
        )}

        {/* ── S6 — NCs ────────────────────────────────────────────────── */}
        {ncs.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>6. Não Conformidades</Text>
            <View style={S.table}>
              <View style={S.tableHeader}>
                <Text style={[S.tableHeaderCell, { flex: 0.5 }]}>NC #</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.5 }]}>Item</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Criticidade</Text>
                <Text style={[S.tableHeaderCell, { flex: 1.8 }]}>Ação Imediata</Text>
                <Text style={[S.tableHeaderCell, { flex: 0.6 }]}>Status</Text>
              </View>
              {ncs.map((nc: any) => (
                <View key={nc.id} style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 0.5 }]}>{nc.numero ?? nc.id}</Text>
                  <Text style={[S.tableCell, { flex: 1.5 }]}>{nc.item_descricao ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{nc.criticidade}</Text>
                  <Text style={[S.tableCell, { flex: 1.8 }]}>{nc.acao_imediata ?? '—'}</Text>
                  <Text style={[S.tableCell, { flex: 0.6 }]}>{nc.status}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text style={S.footerText}>Lote ID: {lote.id} · {lote.numero_lote}</Text>
        </View>
      </Page>
    </Document>
  );
}

// ── Export helper ─────────────────────────────────────────────────────────────

export async function downloadFichaRecebimento(
  lote: FvmLotePreview,
  tenantNome?: string,
  obraNome?: string,
): Promise<void> {
  const blob = await pdf(
    <FichaRecebimentoPdf lote={lote} tenantNome={tenantNome} obraNome={obraNome} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ficha-recebimento-${lote.numero_lote.replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
