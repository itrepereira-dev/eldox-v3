// frontend-web/src/modules/fvm/relatorios/pdf/PerformanceFornecedoresPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

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
  title:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  sub:    { fontSize: 8,  color: '#6B7280', marginTop: 2 },
  table:  { borderTop: '1px solid #E5E7EB' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderBottom: '1px solid #DBEAFE',
    padding: '3 4',
  },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#1D4ED8', textTransform: 'uppercase' },
  tableRow:   { flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '4 4' },
  tableRowAlt:{ flexDirection: 'row', borderBottom: '1px solid #F3F4F6', padding: '4 4', backgroundColor: '#F9FAFB' },
  td:       { fontSize: 8, color: '#374151' },
  rankCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#1D4ED8' },
  scoreGreen:  { color: '#065F46', fontFamily: 'Helvetica-Bold' },
  scoreYellow: { color: '#92400E', fontFamily: 'Helvetica-Bold' },
  scoreRed:    { color: '#991B1B', fontFamily: 'Helvetica-Bold' },
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTop: '1px solid #E5E7EB', paddingTop: 4,
  },
  footerText: { fontSize: 7, color: '#9CA3AF' },
});

function scoreStyle(score: number) {
  if (score >= 70) return S.scoreGreen;
  if (score >= 50) return S.scoreYellow;
  return S.scoreRed;
}

interface Props {
  fornecedores: FvmPerformanceFornecedor[];
  periodo?: string;
}

export function PerformanceFornecedoresPdf({ fornecedores, periodo }: Props) {
  const geradoEm = new Date().toLocaleString('pt-BR');
  const sorted   = [...fornecedores].sort((a, b) => b.score - a.score);

  return (
    <Document title="Performance de Fornecedores — FVM" author="Eldox">
      <Page size="A4" orientation="landscape" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.title}>Relatório de Performance de Fornecedores — FVM</Text>
            {periodo && <Text style={S.sub}>Período: {periodo}</Text>}
          </View>
          <View>
            <Text style={S.sub}>{fornecedores.length} fornecedores avaliados</Text>
            <Text style={S.sub}>Gerado em {geradoEm}</Text>
          </View>
        </View>

        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.th, { flex: 0.3 }]}>#</Text>
            <Text style={[S.th, { flex: 2 }]}>Fornecedor</Text>
            <Text style={[S.th, { flex: 1 }]}>CNPJ</Text>
            <Text style={[S.th, { flex: 0.7 }]}>Lotes</Text>
            <Text style={[S.th, { flex: 0.8 }]}>Taxa Apr.</Text>
            <Text style={[S.th, { flex: 0.6 }]}>NCs</Text>
            <Text style={[S.th, { flex: 0.7 }]}>NCs Crít.</Text>
            <Text style={[S.th, { flex: 0.8 }]}>Ens. Rep.</Text>
            <Text style={[S.th, { flex: 0.7 }]}>Score</Text>
          </View>

          {sorted.map((f, idx) => (
            <View key={f.id} style={idx % 2 === 0 ? S.tableRow : S.tableRowAlt}>
              <Text style={[S.rankCell, { flex: 0.3 }]}>{idx + 1}º</Text>
              <View style={{ flex: 2 }}>
                <Text style={S.td}>{f.razao_social}</Text>
              </View>
              <Text style={[S.td, { flex: 1 }]}>{f.cnpj ?? '—'}</Text>
              <Text style={[S.td, { flex: 0.7 }]}>{f.total_lotes}</Text>
              <Text style={[S.td, { flex: 0.8 }]}>{f.taxa_aprovacao.toFixed(1)}%</Text>
              <Text style={[S.td, { flex: 0.6 }]}>{f.total_ncs}</Text>
              <Text style={[S.td, { flex: 0.7 }, f.ncs_criticas > 0 ? S.scoreRed : {}]}>
                {f.ncs_criticas}
              </Text>
              <Text style={[S.td, { flex: 0.8 }]}>
                {f.ensaios_reprovados}/{f.total_ensaios}
              </Text>
              <Text style={[S.td, { flex: 0.7 }, scoreStyle(f.score)]}>
                {f.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>
            Score = (taxa_apr × 0.5) + ((1 − ncs_crit/lotes) × 100 × 0.3) + ((1 − ens_rep/ens_total) × 100 × 0.2) · Gerado pelo Eldox
          </Text>
          <Text style={S.footerText}>{geradoEm}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadPerformancePdf(
  fornecedores: FvmPerformanceFornecedor[],
  periodo?: string,
): Promise<void> {
  const blob = await pdf(
    <PerformanceFornecedoresPdf fornecedores={fornecedores} periodo={periodo} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `performance-fornecedores-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
