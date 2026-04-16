// frontend-web/src/modules/fvs/relatorios/pdf/templates/FichaInspecaoPdf.tsx
import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer';
import type { R1FichaData } from '../../types';

// react-pdf uses StyleSheet.create — NO Tailwind, NO CSS classes
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: 'flex-end' },
  logoText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#2563EB',
  },
  obraNome: {
    fontSize: 11,
    color: '#374151',
    marginTop: 4,
  },
  fichaNumero: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 4,
  },
  // Section headers
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
  // Checklist item
  checkRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'flex-start',
  },
  checkRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  checkIcon: {
    width: 18,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  checkOk: { color: '#16A34A' },
  checkNc: { color: '#DC2626' },
  checkNa: { color: '#9CA3AF' },
  checkDesc: { flex: 1, fontSize: 9, color: '#374151', paddingLeft: 4 },
  checkObs: { flex: 1, fontSize: 8, color: '#6B7280', paddingLeft: 4, fontStyle: 'italic' },
  criticidadeBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  criticidadeCritico: { backgroundColor: '#FEF2F2', color: '#991B1B' },
  criticidadeMaior: { backgroundColor: '#FFFBEB', color: '#92400E' },
  criticidadeMenor: { backgroundColor: '#F0FDF4', color: '#166534' },
  // NC table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableRowAlt: { backgroundColor: '#F9FAFB' },
  tableCell: { fontSize: 8, color: '#374151' },
  colNumero: { width: '15%' },
  colItem: { width: '35%' },
  colCrit: { width: '15%' },
  colStatus: { width: '20%' },
  colPrazo: { width: '15%' },
  // Footer
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
  // Signature
  signatureBox: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 6,
    width: 200,
  },
  signatureText: { fontSize: 9, color: '#374151' },
  signatureSubText: { fontSize: 8, color: '#6B7280', marginTop: 2 },
});

function statusIcon(status: string): { icon: string; style: object } {
  if (['conforme', 'conforme_apos_reinspecao', 'liberado_com_concessao'].includes(status))
    return { icon: '✓', style: styles.checkOk };
  if (['nao_conforme', 'nc_apos_reinspecao', 'retrabalho'].includes(status))
    return { icon: '✗', style: styles.checkNc };
  return { icon: '—', style: styles.checkNa };
}

function criticidadeStyle(c: string) {
  if (c === 'critico') return styles.criticidadeCritico;
  if (c === 'maior') return styles.criticidadeMaior;
  return styles.criticidadeMenor;
}

function criticidadeLabel(c: string) {
  if (c === 'critico') return 'Crítico';
  if (c === 'maior') return 'Maior';
  return 'Menor';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function truncate(str: string | null, len = 500): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

interface Props { dados: R1FichaData }

export function FichaInspecaoPdf({ dados }: Props) {
  const { ficha, servicos, ncs } = dados;
  const geradoEm = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View style={styles.headerLeft}>
            <Text style={styles.logoText}>eldox</Text>
            <Text style={styles.obraNome}>{ficha.obra_nome}</Text>
            <Text style={styles.fichaNumero}>Ficha: {ficha.nome}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.fichaNumero, { fontFamily: 'Helvetica-Bold' }]}>
              FICHA DE INSPEÇÃO
            </Text>
            <Text style={styles.fichaNumero}>Inspetor: {ficha.inspetor_nome}</Text>
            <Text style={styles.fichaNumero}>Data: {formatDate(ficha.created_at)}</Text>
            <Text style={styles.fichaNumero}>Status: {ficha.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>

        {/* Checklist por serviço */}
        {servicos.map((servico) =>
          servico.locais.map((local) => (
            <View key={`${servico.servico_nome}-${local.local_nome}`}>
              <Text style={styles.sectionTitle}>
                {servico.servico_nome} — {local.local_nome}
              </Text>
              {local.itens.map((item, i) => {
                const { icon, style: iconStyle } = statusIcon(item.status);
                return (
                  <View
                    key={i}
                    style={[styles.checkRow, i % 2 === 1 ? styles.checkRowAlt : {}]}
                    wrap={false}
                  >
                    <Text style={[styles.checkIcon, iconStyle]}>{icon}</Text>
                    <View style={styles.checkDesc}>
                      <Text>{truncate(item.descricao, 200)}</Text>
                      {item.observacao && (
                        <Text style={styles.checkObs}>{truncate(item.observacao)}</Text>
                      )}
                    </View>
                    <Text style={[styles.criticidadeBadge, criticidadeStyle(item.criticidade)]}>
                      {criticidadeLabel(item.criticidade)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )),
        )}

        {/* NCs */}
        {ncs.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Não Conformidades</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colNumero]}>NC #</Text>
              <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
              <Text style={[styles.tableHeaderCell, styles.colCrit]}>Criticidade</Text>
              <Text style={[styles.tableHeaderCell, styles.colStatus]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrazo]}>Prazo</Text>
            </View>
            {ncs.map((nc, i) => (
              <View
                key={nc.numero}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colNumero]}>{nc.numero}</Text>
                <Text style={[styles.tableCell, styles.colItem]}>{truncate(nc.item_descricao, 100)}</Text>
                <Text style={[styles.tableCell, styles.colCrit]}>{criticidadeLabel(nc.criticidade)}</Text>
                <Text style={[styles.tableCell, styles.colStatus]}>{nc.status}</Text>
                <Text style={[styles.tableCell, styles.colPrazo]}>
                  {nc.prazo ? formatDate(nc.prazo) : '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Assinatura */}
        <View style={styles.signatureBox}>
          <Text style={styles.signatureText}>{ficha.inspetor_nome}</Text>
          <Text style={styles.signatureSubText}>Inspetor — {formatDate(ficha.created_at)}</Text>
        </View>

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
