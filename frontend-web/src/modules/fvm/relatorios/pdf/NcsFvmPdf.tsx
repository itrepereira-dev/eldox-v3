// frontend-web/src/modules/fvm/relatorios/pdf/NcsFvmPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmNcRelatorio } from '@/services/fvm.service';

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 36,
    color: '#111827',
  },
  header: {
    marginBottom: 14,
    borderBottom: '2px solid #1D4ED8',
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  sub:   { fontSize: 8, color: '#6B7280', marginTop: 2 },
  groupHeader: {
    backgroundColor: '#F3F4F6',
    padding: '4 6',
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 2,
  },
  groupTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#374151' },
  table: { borderTop: '1px solid #E5E7EB' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottom: '1px solid #DBEAFE',
    padding: '3 4',
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1D4ED8', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '3 4' },
  td: { fontSize: 8, color: '#374151' },
  critCritico: { color: '#991B1B', fontFamily: 'Helvetica-Bold' },
  critMaior:   { color: '#92400E' },
  slaOk:   { color: '#065F46' },
  slaFail: { color: '#991B1B' },
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB', paddingTop: 4,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

interface Props {
  ncs: FvmNcRelatorio[];
  obraNome?: string;
  periodo?: string;
}

export function NcsFvmPdf({ ncs, obraNome, periodo }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');

  // Group by fornecedor
  const grouped = ncs.reduce<Record<string, FvmNcRelatorio[]>>((acc, nc) => {
    const key = nc.fornecedor_nome;
    if (!acc[key]) acc[key] = [];
    acc[key].push(nc);
    return acc;
  }, {});

  const totalCriticas = ncs.filter(n => n.criticidade === 'critico').length;
  const totalMaiores  = ncs.filter(n => n.criticidade === 'maior').length;
  const totalMenores  = ncs.filter(n => n.criticidade === 'menor').length;
  const slaOk         = ncs.filter(n => n.sla_ok).length;

  return (
    <Document title={`NCs FVM — ${obraNome ?? 'Obra'}`} author="Eldox">
      <Page size="A4" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>Relatório de Não Conformidades — FVM</Text>
            <Text style={S.sub}>{obraNome ?? 'Obra'}{periodo ? ` · ${periodo}` : ''}</Text>
          </View>
          <View>
            <Text style={S.sub}>Total: {ncs.length} NCs</Text>
            <Text style={S.sub}>Críticas: {totalCriticas} · Maiores: {totalMaiores} · Menores: {totalMenores}</Text>
            <Text style={S.sub}>SLA no prazo: {slaOk}/{ncs.length}</Text>
          </View>
        </View>

        {/* Groups */}
        {Object.entries(grouped).map(([fornecedor, items]) => (
          <View key={fornecedor}>
            <View style={S.groupHeader}>
              <Text style={S.groupTitle}>{fornecedor} — {items.length} NC(s)</Text>
            </View>
            <View style={S.table}>
              <View style={S.tableHead}>
                <Text style={[S.th, { flex: 0.6 }]}>NC #</Text>
                <Text style={[S.th, { flex: 1 }]}>Lote</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Material</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Criticidade</Text>
                <Text style={[S.th, { flex: 0.8 }]}>Tipo</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Status</Text>
                <Text style={[S.th, { flex: 0.7 }]}>Prazo</Text>
                <Text style={[S.th, { flex: 0.5 }]}>SLA</Text>
              </View>
              {items.map(nc => (
                <View key={nc.id} style={S.tableRow}>
                  <Text style={[S.td, { flex: 0.6 }]}>{nc.numero}</Text>
                  <Text style={[S.td, { flex: 1 }]}>{nc.lote_numero}</Text>
                  <Text style={[S.td, { flex: 1.5 }]}>{nc.material_nome}</Text>
                  <Text style={[
                    S.td,
                    { flex: 0.7 },
                    nc.criticidade === 'critico' ? S.critCritico : nc.criticidade === 'maior' ? S.critMaior : {},
                  ]}>
                    {nc.criticidade}
                  </Text>
                  <Text style={[S.td, { flex: 0.8 }]}>{nc.tipo}</Text>
                  <Text style={[S.td, { flex: 0.7 }]}>{nc.status}</Text>
                  <Text style={[S.td, { flex: 0.7 }]}>{nc.prazo ?? '—'}</Text>
                  <Text style={[S.td, { flex: 0.5 }, nc.sla_ok ? S.slaOk : S.slaFail]}>
                    {nc.sla_ok ? 'OK' : 'VENCIDA'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>Gerado pelo Eldox em {geradoEm}</Text>
          <Text style={S.footerText}>{ncs.length} não conformidades</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadNcsFvmPdf(
  ncs: FvmNcRelatorio[],
  obraNome?: string,
  periodo?: string,
): Promise<void> {
  const blob = await pdf(<NcsFvmPdf ncs={ncs} obraNome={obraNome} periodo={periodo} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ncs-fvm-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
