// frontend-web/src/modules/fvs/relatorios/pdf/templates/PlanoAcaoPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R5PlanoAcaoData } from '../../types';

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
    borderBottomColor: '#7C3AED',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#7C3AED' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#4C1D95',
    backgroundColor: '#F5F3FF',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  summaryGrid: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#7C3AED' },
  summaryLabel: { fontSize: 7, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
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
  tableRowVencido: { backgroundColor: '#FEE2E2' },
  tableRowGroupTitle: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  tableGroupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4C1D95' },
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

interface Props { dados: R5PlanoAcaoData }

export function PlanoAcaoPdf({ dados }: Props) {
  const { obra_nome, data_geracao, planos, resumo } = dados;

  // Group by etapa
  const byEtapa: Record<string, typeof planos> = {};
  planos.forEach((p) => {
    const key = p.etapa_atual;
    if (!byEtapa[key]) byEtapa[key] = [];
    byEtapa[key].push(p);
  });

  const etapaOrder = ['ABERTO', 'EM_ANDAMENTO', 'VERIFICACAO', 'FECHADO'];
  const sortedEtapas = [
    ...etapaOrder.filter((e) => byEtapa[e]),
    ...Object.keys(byEtapa).filter((e) => !etapaOrder.includes(e)),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Planos de Ação</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#7C3AED' }]}>eldox</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>{resumo.abertos}</Text>
            <Text style={styles.summaryLabel}>Abertos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#D97706' }]}>{resumo.em_andamento}</Text>
            <Text style={styles.summaryLabel}>Em Andamento</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#16A34A' }]}>{resumo.fechados_este_mes}</Text>
            <Text style={styles.summaryLabel}>Fechados este Mês</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{planos.length}</Text>
            <Text style={styles.summaryLabel}>Total PAs</Text>
          </View>
        </View>

        {/* Kanban em texto: agrupado por etapa */}
        {sortedEtapas.map((etapa) => {
          const etapaPlanos = byEtapa[etapa] ?? [];
          return (
            <View key={etapa}>
              <View style={styles.tableRowGroupTitle}>
                <Text style={styles.tableGroupTitle}>
                  {etapa.replace('_', ' ')} — {etapaPlanos.length} plano(s)
                </Text>
              </View>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { width: '8%' }]}>PA #</Text>
                <Text style={[styles.tableHeaderCell, { width: '28%' }]}>Título</Text>
                <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Origem</Text>
                <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Prioridade</Text>
                <Text style={[styles.tableHeaderCell, { width: '16%' }]}>Responsável</Text>
                <Text style={[styles.tableHeaderCell, { width: '11%' }]}>Prazo</Text>
                <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias Aberto</Text>
              </View>
              {etapaPlanos.map((pa, i) => (
                <View
                  key={pa.id}
                  style={[
                    styles.tableRow,
                    pa.vencido ? styles.tableRowVencido : i % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, { width: '8%' }]}>{pa.numero}</Text>
                  <Text style={[styles.tableCell, { width: '28%' }]}>{pa.titulo.slice(0, 80)}</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>{pa.origem}</Text>
                  <Text style={[styles.tableCell, { width: '12%', color: pa.prioridade === 'URGENTE' ? '#DC2626' : '#374151' }]}>
                    {pa.prioridade}
                  </Text>
                  <Text style={[styles.tableCell, { width: '16%' }]}>{pa.responsavel ?? '—'}</Text>
                  <Text style={[styles.tableCell, { width: '11%', color: pa.vencido ? '#DC2626' : '#374151' }]}>
                    {pa.prazo ? formatDate(pa.prazo) : '—'}
                  </Text>
                  <Text style={[styles.tableCell, { width: '10%', fontFamily: pa.vencido ? 'Helvetica-Bold' : 'Helvetica', color: pa.vencido ? '#DC2626' : '#374151' }]}>
                    {pa.dias_aberto}d
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {planos.length === 0 && (
          <Text style={{ fontSize: 9, color: '#6B7280', fontStyle: 'italic', padding: 8 }}>
            Nenhum plano de ação encontrado com os filtros aplicados.
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
