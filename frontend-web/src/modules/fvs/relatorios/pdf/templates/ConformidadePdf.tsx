// frontend-web/src/modules/fvs/relatorios/pdf/templates/ConformidadePdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R2ConformidadeData } from '../../types';

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
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCell: { fontSize: 8, color: '#374151' },
  col1: { width: '18%' },
  col2: { width: '20%' },
  col3: { width: '15%' },
  col4: { width: '12%' },
  col5: { width: '12%' },
  col6: { width: '12%' },
  col7: { width: '11%' },
  // Bar chart
  barContainer: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10, marginBottom: 10, height: 80 },
  barWrapper: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  bar: { width: '100%', backgroundColor: '#2563EB', borderRadius: 2 },
  barLabel: { fontSize: 6, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  barValue: { fontSize: 7, color: '#2563EB', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  // Summary row
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
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

interface Props { dados: R2ConformidadeData }

export function ConformidadePdf({ dados }: Props) {
  const { obra_nome, servico_nome, data_inicio, data_fim, por_semana, fichas, ncs_por_criticidade } = dados;
  const geradoEm = formatDate(new Date().toISOString());
  const maxTaxa = por_semana.length > 0 ? Math.max(...por_semana.map((s) => s.taxa), 1) : 100;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Conformidade</Text>
            <Text style={styles.subtitle}>
              {obra_nome}{servico_nome ? ` — ${servico_nome}` : ''} | {formatDate(data_inicio)} a {formatDate(data_fim)}
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: '#2563EB' }]}>eldox</Text>
        </View>

        {/* Summary cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{fichas.length}</Text>
            <Text style={styles.summaryLabel}>Fichas Inspecionadas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{ncs_por_criticidade.critico}</Text>
            <Text style={styles.summaryLabel}>NCs Críticas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{ncs_por_criticidade.maior}</Text>
            <Text style={styles.summaryLabel}>NCs Maiores</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{ncs_por_criticidade.menor}</Text>
            <Text style={styles.summaryLabel}>NCs Menores</Text>
          </View>
        </View>

        {/* Bar chart: taxa por semana */}
        {por_semana.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Taxa de Conformidade por Semana</Text>
            <View style={styles.barContainer}>
              {por_semana.map((semana) => {
                const barHeight = Math.max(4, (semana.taxa / maxTaxa) * 70);
                return (
                  <View key={semana.semana} style={styles.barWrapper}>
                    <Text style={styles.barValue}>{semana.taxa}%</Text>
                    <View style={[styles.bar, { height: barHeight }]} />
                    <Text style={styles.barLabel}>{semana.semana.split('-W')[1] ? `S${semana.semana.split('-W')[1]}` : semana.semana}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Fichas table */}
        <Text style={styles.sectionTitle}>Fichas Inspecionadas</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.col1]}>Ficha</Text>
          <Text style={[styles.tableHeaderCell, styles.col2]}>Data</Text>
          <Text style={[styles.tableHeaderCell, styles.col3]}>Inspetor</Text>
          <Text style={[styles.tableHeaderCell, styles.col4]}>Local</Text>
          <Text style={[styles.tableHeaderCell, styles.col5]}>Itens OK</Text>
          <Text style={[styles.tableHeaderCell, styles.col6]}>Itens NC</Text>
          <Text style={[styles.tableHeaderCell, styles.col7]}>Taxa %</Text>
        </View>
        {fichas.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1 }]}>Nenhum registro encontrado</Text>
          </View>
        )}
        {fichas.map((f, i) => (
          <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
            <Text style={[styles.tableCell, styles.col1]}>{f.ficha_numero}</Text>
            <Text style={[styles.tableCell, styles.col2]}>{formatDate(f.data)}</Text>
            <Text style={[styles.tableCell, styles.col3]}>{f.inspetor}</Text>
            <Text style={[styles.tableCell, styles.col4]}>{f.local}</Text>
            <Text style={[styles.tableCell, styles.col5]}>{f.itens_ok}</Text>
            <Text style={[styles.tableCell, styles.col6]}>{f.itens_nc}</Text>
            <Text style={[styles.tableCell, styles.col7, { color: f.taxa >= 80 ? '#16A34A' : f.taxa >= 60 ? '#D97706' : '#DC2626', fontFamily: 'Helvetica-Bold' }]}>
              {f.taxa}%
            </Text>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
