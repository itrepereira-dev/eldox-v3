// frontend-web/src/modules/fvs/relatorios/pdf/templates/NcsPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R4NcsData } from '../../types';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1E3A5F',
    backgroundColor: '#EFF6FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  // Summary cards
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2563EB' },
  summaryLabel: { fontSize: 7, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  // Pie chart simulation (donut-style percentages as text boxes)
  pieRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 10 },
  pieItem: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  pieValue: { fontSize: 22, fontFamily: 'Helvetica-Bold' },
  pieLabel: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableRowGroupTitle: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tableGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1E3A5F' },
  tableCell: { fontSize: 7, color: '#374151' },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R4NcsData }

export function NcsPdf({ dados }: Props) {
  const { obra_nome, data_geracao, ncs, sla, por_criticidade } = dados;
  const totalNcs = ncs.length;

  // Group by servico for sub-total separators
  const byServico: Record<string, typeof ncs> = {};
  ncs.forEach((nc) => {
    if (!byServico[nc.servico]) byServico[nc.servico] = [];
    byServico[nc.servico].push(nc);
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Não Conformidades</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#2563EB' }]}>eldox</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalNcs}</Text>
            <Text style={styles.summaryLabel}>Total NCs</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#DC2626' }]}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{sla.vencidas}</Text>
            <Text style={styles.summaryLabel}>Vencidas</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: '#16A34A' }]}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{sla.no_prazo}</Text>
            <Text style={styles.summaryLabel}>No Prazo</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#9CA3AF' }]}>{sla.sem_prazo}</Text>
            <Text style={styles.summaryLabel}>Sem Prazo</Text>
          </View>
        </View>

        {/* Distribuição por criticidade (pie-equivalent) */}
        <Text style={styles.sectionTitle}>Distribuição por Criticidade</Text>
        <View style={styles.pieRow}>
          <View style={[styles.pieItem, { borderColor: '#DC2626' }]}>
            <Text style={[styles.pieValue, { color: '#DC2626' }]}>{por_criticidade.alta}</Text>
            <Text style={styles.pieLabel}>Alta</Text>
          </View>
          <View style={[styles.pieItem, { borderColor: '#D97706' }]}>
            <Text style={[styles.pieValue, { color: '#D97706' }]}>{por_criticidade.media}</Text>
            <Text style={styles.pieLabel}>Média</Text>
          </View>
          <View style={[styles.pieItem, { borderColor: '#16A34A' }]}>
            <Text style={[styles.pieValue, { color: '#16A34A' }]}>{por_criticidade.baixa}</Text>
            <Text style={styles.pieLabel}>Baixa</Text>
          </View>
        </View>

        {/* NC table grouped by service */}
        <Text style={styles.sectionTitle}>Detalhamento ({totalNcs} NCs)</Text>
        {Object.entries(byServico).map(([servico, ncList]) => (
          <View key={servico}>
            <View style={styles.tableRowGroupTitle}>
              <Text style={styles.tableGroupTitle}>{servico} — {ncList.length} NCs</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, { width: '22%' }]}>Item</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, { width: '14%' }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { width: '18%' }]}>Responsável</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Prazo</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Abertura</Text>
            </View>
            {ncList.map((nc, i) => (
              <View
                key={nc.numero}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, { width: '10%' }]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, { width: '22%' }]}>{nc.item_descricao.slice(0, 80)}</Text>
                <Text style={[styles.tableCell, { width: '12%', color: nc.criticidade === 'ALTA' ? '#DC2626' : nc.criticidade === 'MEDIA' ? '#D97706' : '#16A34A' }]}>
                  {nc.criticidade}
                </Text>
                <Text style={[styles.tableCell, { width: '14%' }]}>{nc.status}</Text>
                <Text style={[styles.tableCell, { width: '18%' }]}>{nc.responsavel ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{nc.prazo ? formatDate(nc.prazo) : '—'}</Text>
                <Text style={[styles.tableCell, { width: '12%' }]}>{formatDate(nc.created_at)}</Text>
              </View>
            ))}
          </View>
        ))}

        {ncs.length === 0 && (
          <Text style={{ fontSize: 9, color: '#6B7280', fontStyle: 'italic', padding: 8 }}>
            Nenhum registro encontrado com os filtros aplicados.
          </Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {formatDate(data_geracao)}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
