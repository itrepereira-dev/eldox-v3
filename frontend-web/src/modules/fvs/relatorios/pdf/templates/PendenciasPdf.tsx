// frontend-web/src/modules/fvs/relatorios/pdf/templates/PendenciasPdf.tsx
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { R3PendenciasData } from '../../types';

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
    borderBottomColor: '#DC2626',
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#DC2626' },
  subtitle: { fontSize: 9, color: '#6B7280', marginTop: 3 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#7F1D1D',
    backgroundColor: '#FEF2F2',
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
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
  tableRowAlt: { backgroundColor: '#FFF5F5' },
  tableCell: { fontSize: 8, color: '#374151' },
  urgenteBadge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  normalBadge: {
    fontSize: 7,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
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
  emptyText: { fontSize: 9, color: '#6B7280', fontStyle: 'italic', paddingVertical: 6, paddingHorizontal: 4 },
});

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('pt-BR'); }
  catch { return iso; }
}

interface Props { dados: R3PendenciasData }

export function PendenciasPdf({ dados }: Props) {
  const { obra_nome, data_geracao, fichas_abertas, ncs_sem_plano, planos_vencidos } = dados;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.title}>Relatório de Pendências</Text>
            <Text style={styles.subtitle}>{obra_nome} | Gerado em {formatDate(data_geracao)}</Text>
          </View>
          <Text style={[styles.subtitle, { color: '#DC2626' }]}>eldox</Text>
        </View>

        {/* Fichas abertas */}
        <Text style={styles.sectionTitle}>
          Seção 1 — Inspeções em Aberto ({fichas_abertas.length})
        </Text>
        {fichas_abertas.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma inspeção em aberto.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Ficha</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Inspetor</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Abertura</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Prioridade</Text>
            </View>
            {fichas_abertas.map((f, i) => (
              <View key={f.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '30%' }]}>{f.nome}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{f.status}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>{f.inspetor_nome}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{formatDate(f.created_at)}</Text>
                <Text style={[styles.tableCell, { width: '10%', fontFamily: 'Helvetica-Bold', color: f.dias_aberta >= 7 ? '#DC2626' : '#374151' }]}>
                  {f.dias_aberta}d
                </Text>
                <Text style={f.dias_aberta >= 7 ? styles.urgenteBadge : styles.normalBadge}>
                  {f.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* NCs sem plano */}
        <Text style={styles.sectionTitle}>
          Seção 2 — NCs sem Plano de Ação ({ncs_sem_plano.length})
        </Text>
        {ncs_sem_plano.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma NC sem plano de ação.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Título</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Abertura</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Prioridade</Text>
            </View>
            {ncs_sem_plano.map((nc, i) => (
              <View key={nc.numero} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '15%' }]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, { width: '35%' }]}>{nc.titulo}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{nc.criticidade}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{formatDate(nc.created_at)}</Text>
                <Text style={[styles.tableCell, { width: '10%', fontFamily: 'Helvetica-Bold', color: nc.dias_aberta >= 7 ? '#DC2626' : '#374151' }]}>
                  {nc.dias_aberta}d
                </Text>
                <Text style={nc.criticidade === 'ALTA' || nc.dias_aberta >= 7 ? styles.urgenteBadge : styles.normalBadge}>
                  {nc.criticidade === 'ALTA' || nc.dias_aberta >= 7 ? 'URGENTE' : 'NORMAL'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Planos vencidos */}
        <Text style={styles.sectionTitle}>
          Seção 3 — Planos de Ação Vencidos ({planos_vencidos.length})
        </Text>
        {planos_vencidos.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum plano de ação vencido.</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Título</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Responsável</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Prazo</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Dias Vencido</Text>
              <Text style={[styles.tableHeaderCell, { width: '15%' }]}>Prioridade</Text>
            </View>
            {planos_vencidos.map((pa, i) => (
              <View key={pa.id} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: '35%' }]}>{pa.titulo}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>{pa.responsavel ?? '—'}</Text>
                <Text style={[styles.tableCell, { width: '15%' }]}>{pa.prazo ? formatDate(pa.prazo) : '—'}</Text>
                <Text style={[styles.tableCell, { width: '15%', fontFamily: 'Helvetica-Bold', color: '#DC2626' }]}>
                  {pa.dias_vencido}d
                </Text>
                <Text style={pa.prioridade === 'URGENTE' ? styles.urgenteBadge : styles.normalBadge}>
                  {pa.prioridade}
                </Text>
              </View>
            ))}
          </>
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
