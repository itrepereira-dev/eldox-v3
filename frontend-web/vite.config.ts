import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — carregado sempre
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Queries + estado
          'vendor-query': ['@tanstack/react-query'],
          // UI libs pesadas
          'vendor-ui': ['react-grid-layout', 'lucide-react'],
          // Módulos agrupados por domínio (cada chunk ~= 1 módulo)
          'mod-fvs': [
            './src/modules/fvs/catalogo/CatalogoPage',
            './src/modules/fvs/inspecao/pages/FichasListPage',
            './src/modules/fvs/inspecao/pages/AbrirFichaWizard',
            './src/modules/fvs/inspecao/pages/FichaGradePage',
            './src/modules/fvs/inspecao/pages/FichaLocalPage',
            './src/modules/fvs/modelos/pages/ModelosListPage',
            './src/modules/fvs/modelos/pages/ModeloFormPage',
            './src/modules/fvs/modelos/pages/ModeloDetailPage',
            './src/modules/fvs/dashboard/pages/FvsDashboardPage',
            './src/modules/fvs/cliente/FvsRelatorioClientePage',
          ],
          'mod-fvm': [
            './src/modules/fvm/grade/pages/GradeMateriaisPage',
            './src/modules/fvm/grade/pages/FichaLotePage',
            './src/modules/fvm/catalogo/pages/CatalogoMateriaisPage',
            './src/modules/fvm/fornecedores/pages/FornecedoresPage',
          ],
          'mod-almox': [
            './src/modules/almoxarifado/dashboard/pages/AlmoxarifadoDashboard',
            './src/modules/almoxarifado/estoque/pages/EstoquePage',
            './src/modules/almoxarifado/estoque/pages/MovimentosPage',
            './src/modules/almoxarifado/estoque/pages/AlertasPage',
            './src/modules/almoxarifado/solicitacao/pages/SolicitacoesListPage',
            './src/modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage',
            './src/modules/almoxarifado/solicitacao/pages/SolicitacaoDetalhePage',
            './src/modules/almoxarifado/compras/pages/OcListPage',
            './src/modules/almoxarifado/compras/pages/NovaOcPage',
            './src/modules/almoxarifado/compras/pages/OcDetalhePage',
            './src/modules/almoxarifado/nfe/pages/NfeListPage',
            './src/modules/almoxarifado/nfe/pages/NfeDetalhePage',
            './src/modules/almoxarifado/planejamento/pages/PlanejamentoPage',
            './src/modules/almoxarifado/ia/pages/InsightsPage',
            './src/modules/almoxarifado/cotacoes/pages/CotacoesPage',
            './src/modules/almoxarifado/cotacoes/pages/ComparativoPage',
          ],
          'mod-diario': [
            './src/modules/diario/pages/DiarioHomePage',
            './src/modules/diario/pages/RdosListPage',
            './src/modules/diario/pages/RdoFormPage',
            './src/modules/diario/pages/RdoWorkflowPage',
            './src/modules/diario/pages/RelatorioClientePage',
          ],
          'mod-concretagem': [
            './src/modules/concretagem/croqui/pages/CroquiRastreabilidadePage',
            './src/modules/concretagem/croqui/pages/CroquiDetalhePage',
            './src/modules/concretagem/dashboard/pages/ConcretagemDashboardPage',
            './src/modules/concretagem/concretagens/pages/ConcrtagensListPage',
            './src/modules/concretagem/concretagens/pages/ConcrtagemDetalhePage',
          ],
          'mod-outros': [
            './src/modules/ensaios/tipos/pages/TiposEnsaioPage',
            './src/modules/ensaios/laboratoriais/pages/EnsaiosPage',
            './src/modules/ensaios/revisoes/pages/RevisoesPage',
            './src/modules/ensaios/dashboard/pages/ConformidadePage',
            './src/modules/ncs/pages/NcsListPage',
            './src/modules/ncs/pages/NcDetalhePage',
            './src/modules/ncs/pages/NcsGlobalPage',
            './src/modules/semaforo/pages/SemaforoPage',
            './src/modules/aprovacoes/pages/AprovacoesPage',
            './src/modules/aprovacoes/pages/AprovacaoDetalhePage',
            './src/modules/aprovacoes/pages/TemplatesPage',
            './src/modules/efetivo/pages/EfetivoListPage',
            './src/modules/efetivo/pages/CadastrosPage',
            './src/modules/portal/PortalCotacaoPage',
            './src/modules/portal/PortalFornecedorPage',
          ],
        },
      },
    },
  },
})
