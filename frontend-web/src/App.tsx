import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ui/ThemeContext';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ObrasListPage } from './pages/obras/ObrasListPage';
import { CadastroObraWizard } from './pages/obras/CadastroObraWizard';
import { ObraDetalhePage } from './pages/obras/ObraDetalhePage';
import { GedHubPage } from './pages/ged/GedHubPage';
import { GedDocumentosPage } from './pages/ged/GedDocumentosPage';
import { GedDocumentoDetalhePage } from './pages/ged/GedDocumentoDetalhePage';
import { GedListaMestraPage } from './pages/ged/GedListaMestraPage';
import { GedAdminPage } from './pages/ged/GedAdminPage';
import CatalogoFvsPage from './modules/fvs/catalogo/CatalogoPage';
import { FichasListPage } from './modules/fvs/inspecao/pages/FichasListPage';
import { AbrirFichaWizard } from './modules/fvs/inspecao/pages/AbrirFichaWizard';
import { FichaGradePage } from './modules/fvs/inspecao/pages/FichaGradePage';
import { FichaLocalPage } from './modules/fvs/inspecao/pages/FichaLocalPage';
import { ModelosListPage } from './modules/fvs/modelos/pages/ModelosListPage';
import { ModeloFormPage } from './modules/fvs/modelos/pages/ModeloFormPage';
import { ModeloDetailPage } from './modules/fvs/modelos/pages/ModeloDetailPage';
import { AppLayout } from './layouts/AppLayout';
import { GradeMateriaisPage } from './modules/fvm/grade/pages/GradeMateriaisPage';
import { FichaLotePage } from './modules/fvm/grade/pages/FichaLotePage';
import CatalogoMateriaisPage from './modules/fvm/catalogo/pages/CatalogoMateriaisPage';
import FornecedoresPage from './modules/fvm/fornecedores/pages/FornecedoresPage';
import TiposEnsaioPage from './modules/ensaios/tipos/pages/TiposEnsaioPage';
import EnsaiosPage from './modules/ensaios/laboratoriais/pages/EnsaiosPage';
import RevisoesPage from './modules/ensaios/revisoes/pages/RevisoesPage';
import ConformidadePage from './modules/ensaios/dashboard/pages/ConformidadePage';
import { RdosListPage } from './modules/diario/pages/RdosListPage';
import { DiarioHomePage } from './modules/diario/pages/DiarioHomePage';
import CroquiRastreabilidadePage from './modules/concretagem/croqui/pages/CroquiRastreabilidadePage';
import CroquiDetalhePage from './modules/concretagem/croqui/pages/CroquiDetalhePage';
import ConcretagemDashboardPage from './modules/concretagem/dashboard/pages/ConcretagemDashboardPage';
import ConcrtagensListPage from './modules/concretagem/concretagens/pages/ConcrtagensListPage';
import ConcrtagemDetalhePage from './modules/concretagem/concretagens/pages/ConcrtagemDetalhePage';
import { RdoFormPage } from './modules/diario/pages/RdoFormPage';
import { RdoWorkflowPage } from './modules/diario/pages/RdoWorkflowPage';
import { AlmoxarifadoDashboard } from './modules/almoxarifado/dashboard/pages/AlmoxarifadoDashboard';
import { EstoquePage } from './modules/almoxarifado/estoque/pages/EstoquePage';
import { MovimentosPage } from './modules/almoxarifado/estoque/pages/MovimentosPage';
import { AlertasPage } from './modules/almoxarifado/estoque/pages/AlertasPage';
import { SolicitacoesListPage } from './modules/almoxarifado/solicitacao/pages/SolicitacoesListPage';
import { NovaSolicitacaoPage } from './modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage';
import { SolicitacaoDetalhePage } from './modules/almoxarifado/solicitacao/pages/SolicitacaoDetalhePage';
import { OcListPage } from './modules/almoxarifado/compras/pages/OcListPage';
import { NovaOcPage } from './modules/almoxarifado/compras/pages/NovaOcPage';
import { OcDetalhePage } from './modules/almoxarifado/compras/pages/OcDetalhePage';
import { NfeListPage } from './modules/almoxarifado/nfe/pages/NfeListPage';
import { NfeDetalhePage } from './modules/almoxarifado/nfe/pages/NfeDetalhePage';
import { PlanejamentoPage } from './modules/almoxarifado/planejamento/pages/PlanejamentoPage';
import { InsightsPage } from './modules/almoxarifado/ia/pages/InsightsPage';
import { NcsListPage } from './modules/ncs/pages/NcsListPage';
import { NcDetalhePage } from './modules/ncs/pages/NcDetalhePage';
import { NcsGlobalPage } from './modules/ncs/pages/NcsGlobalPage';
import { SemaforoPage } from './modules/semaforo/pages/SemaforoPage';
import { AprovacoesPage } from './modules/aprovacoes/pages/AprovacoesPage';
import { AprovacaoDetalhePage } from './modules/aprovacoes/pages/AprovacaoDetalhePage';
import { TemplatesPage } from './modules/aprovacoes/pages/TemplatesPage';
import { EfetivoListPage } from './modules/efetivo/pages/EfetivoListPage';
import { CadastrosEfetivoPage } from './modules/efetivo/pages/CadastrosPage';
import CotacoesPage from './modules/almoxarifado/cotacoes/pages/CotacoesPage';
import ComparativoPage from './modules/almoxarifado/cotacoes/pages/ComparativoPage';
import PortalCotacaoPage from './modules/portal/PortalCotacaoPage';
import PortalFornecedorPage from './modules/portal/PortalFornecedorPage';
import RelatorioClientePage from './modules/diario/pages/RelatorioClientePage';
import FvsDashboardPage from './modules/fvs/dashboard/pages/FvsDashboardPage';
import FvsRelatorioClientePage from './modules/fvs/cliente/FvsRelatorioClientePage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Página pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Todas as páginas autenticadas — AppShell (sidebar + topbar) sempre presente */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Obras */}
              <Route path="/obras" element={<ObrasListPage />} />
              <Route path="/obras/nova" element={<CadastroObraWizard />} />
              <Route path="/obras/:id" element={<ObraDetalhePage />} />

              {/* GED — por obra */}
              <Route path="/obras/:id/ged" element={<GedHubPage />} />
              <Route path="/obras/:id/ged/documentos" element={<GedDocumentosPage />} />
              <Route path="/obras/:id/ged/documentos/:documentoId" element={<GedDocumentoDetalhePage />} />
              <Route path="/obras/:id/ged/lista-mestra" element={<GedListaMestraPage />} />

              {/* GED — nível empresa */}
              <Route path="/ged/admin" element={<GedAdminPage />} />

              {/* FVS — Catálogo de Serviços */}
              <Route path="/configuracoes/fvs/catalogo" element={<CatalogoFvsPage />} />

              {/* FVS — Inspeção */}
              <Route path="/fvs/fichas" element={<FichasListPage />} />
              <Route path="/fvs/fichas/nova" element={<AbrirFichaWizard />} />
              <Route path="/fvs/fichas/:fichaId" element={<FichaGradePage />} />
              <Route path="/fvs/fichas/:fichaId/inspecao" element={<FichaLocalPage />} />

              {/* FVM — Ficha de Verificação de Materiais */}
              <Route path="/fvm/obras/:obraId" element={<GradeMateriaisPage />} />
              <Route path="/fvm/lotes/:loteId" element={<FichaLotePage />} />
              <Route path="/fvm/catalogo" element={<CatalogoMateriaisPage />} />
              <Route path="/fvm/fornecedores" element={<FornecedoresPage />} />

              {/* FVS — Dashboard de Qualidade */}
              <Route path="/fvs/dashboard" element={<FvsDashboardPage />} />
              <Route path="/obras/:obraId/fvs/dashboard" element={<FvsDashboardPage />} />

              {/* Diário de Obra (RDO) */}
              <Route path="/diario" element={<DiarioHomePage />} />
              <Route path="/obras/:id/diario" element={<RdosListPage />} />
              <Route path="/obras/:id/diario/:rdoId" element={<RdoFormPage />} />
              <Route path="/obras/:id/diario/:rdoId/workflow" element={<RdoWorkflowPage />} />

              {/* Ensaios — Sprint 5/6 */}
              <Route path="/configuracoes/ensaios/tipos" element={<TiposEnsaioPage />} />
              <Route path="/obras/:obraId/ensaios" element={<ConformidadePage />} />
              <Route path="/obras/:obraId/ensaios/laboratoriais" element={<EnsaiosPage />} />
              <Route path="/obras/:obraId/ensaios/revisoes" element={<RevisoesPage />} />

              {/* FVS — Templates de Inspeção (Sprint 4a) */}
              <Route path="/fvs/modelos" element={<ModelosListPage />} />
              <Route path="/fvs/modelos/novo" element={<ModeloFormPage />} />
              <Route path="/fvs/modelos/:id" element={<ModeloDetailPage />} />
              <Route path="/fvs/modelos/:id/editar" element={<ModeloFormPage />} />

              {/* Concretagem — Sprint 8 */}
              <Route path="/obras/:obraId/concretagem" element={<ConcretagemDashboardPage />} />
              <Route path="/obras/:obraId/concretagem/concretagens" element={<ConcrtagensListPage />} />
              <Route path="/obras/:obraId/concretagem/concretagens/:concrtagemId" element={<ConcrtagemDetalhePage />} />
              <Route path="/obras/:obraId/concretagem/croqui" element={<CroquiRastreabilidadePage />} />
              <Route path="/obras/:obraId/concretagem/croqui/:croquiId" element={<CroquiDetalhePage />} />

              {/* Almoxarifado — Sprint 1 */}
              <Route path="/obras/:obraId/almoxarifado" element={<AlmoxarifadoDashboard />} />
              <Route path="/obras/:obraId/almoxarifado/estoque" element={<EstoquePage />} />
              <Route path="/obras/:obraId/almoxarifado/estoque/movimentos" element={<MovimentosPage />} />
              <Route path="/obras/:obraId/almoxarifado/estoque/alertas" element={<AlertasPage />} />

              {/* Almoxarifado — Sprint 2: Solicitações */}
              <Route path="/obras/:obraId/almoxarifado/solicitacoes" element={<SolicitacoesListPage />} />
              <Route path="/obras/:obraId/almoxarifado/solicitacoes/nova" element={<NovaSolicitacaoPage />} />
              <Route path="/obras/:obraId/almoxarifado/solicitacoes/:solicitacaoId" element={<SolicitacaoDetalhePage />} />

              {/* Almoxarifado — Sprint 3: Ordens de Compra */}
              <Route path="/obras/:obraId/almoxarifado/ocs" element={<OcListPage />} />
              <Route path="/obras/:obraId/almoxarifado/ocs/nova" element={<NovaOcPage />} />
              <Route path="/obras/:obraId/almoxarifado/ocs/:ocId" element={<OcDetalhePage />} />

              {/* Almoxarifado — Sprint 4: NF-e */}
              <Route path="/obras/:obraId/almoxarifado/nfes" element={<NfeListPage />} />
              <Route path="/obras/:obraId/almoxarifado/nfes/:nfeId" element={<NfeDetalhePage />} />

              {/* Almoxarifado — Sprint 5: Planejamento + IA */}
              <Route path="/obras/:obraId/almoxarifado/planejamento" element={<PlanejamentoPage />} />
              <Route path="/obras/:obraId/almoxarifado/insights" element={<InsightsPage />} />
              {/* Cotações */}
              <Route path="/almoxarifado/solicitacoes/:solId/cotacoes" element={<CotacoesPage />} />
              <Route path="/almoxarifado/solicitacoes/:solId/comparativo" element={<ComparativoPage />} />

              {/* Não Conformidades (NCs) */}
              <Route path="/obras/:obraId/ncs" element={<NcsListPage />} />
              <Route path="/obras/:obraId/ncs/:ncId" element={<NcDetalhePage />} />
              <Route path="/ncs" element={<NcsGlobalPage />} />

              {/* Semáforo PBQP-H — Sprint 7 */}
              <Route path="/obras/:id/semaforo" element={<SemaforoPage />} />
              <Route path="/semaforo" element={<SemaforoPage />} />

              {/* Aprovações — Sprint 9 */}
              <Route path="/aprovacoes" element={<AprovacoesPage />} />
              <Route path="/aprovacoes/templates" element={<TemplatesPage />} />
              <Route path="/aprovacoes/:id" element={<AprovacaoDetalhePage />} />

              {/* Controle de Efetivo */}
              <Route path="/obras/:obraId/efetivo" element={<EfetivoListPage />} />
              <Route path="/configuracoes/efetivo/cadastros" element={<CadastrosEfetivoPage />} />
            </Route>

            {/* Módulos em construção (Efetivo, Frota, Aprovações, IA) */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          {/* Portal público do fornecedor — fora do guard de autenticação */}
          <Route path="/portal/cotacao/:token" element={<PortalCotacaoPage />} />
          <Route path="/portal/fornecedor" element={<PortalFornecedorPage />} />

          {/* Relatório público do cliente — fora do guard de autenticação */}
          <Route path="/relatorio-cliente/:token" element={<RelatorioClientePage />} />

          {/* Portal público FVS — fora do guard de autenticação */}
          <Route path="/fvs-cliente/:token" element={<FvsRelatorioClientePage />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
