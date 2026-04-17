import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui';

// ── Carregamento imediato (telas críticas do caminho feliz) ───────────────────
import { LoginPage } from './pages/auth/LoginPage';
import { AppLayout } from './layouts/AppLayout';

// ── Lazy: tudo mais carrega só quando o usuário navega ───────────────────────
const DashboardPage            = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ObrasListPage            = lazy(() => import('./pages/obras/ObrasListPage').then(m => ({ default: m.ObrasListPage })));
const CadastroObraWizard       = lazy(() => import('./pages/obras/CadastroObraWizard').then(m => ({ default: m.CadastroObraWizard })));
const ObraDetalhePage          = lazy(() => import('./pages/obras/ObraDetalhePage').then(m => ({ default: m.ObraDetalhePage })));
const GedHubPage               = lazy(() => import('./pages/ged/GedHubPage').then(m => ({ default: m.GedHubPage })));
const GedDocumentosPage        = lazy(() => import('./pages/ged/GedDocumentosPage').then(m => ({ default: m.GedDocumentosPage })));
const GedDocumentoDetalhePage  = lazy(() => import('./pages/ged/GedDocumentoDetalhePage').then(m => ({ default: m.GedDocumentoDetalhePage })));
const GedListaMestraPage       = lazy(() => import('./pages/ged/GedListaMestraPage').then(m => ({ default: m.GedListaMestraPage })));
const GedAdminPage             = lazy(() => import('./pages/ged/GedAdminPage').then(m => ({ default: m.GedAdminPage })));
const CatalogoFvsPage          = lazy(() => import('./modules/fvs/catalogo/CatalogoPage'));
const FichasListPage           = lazy(() => import('./modules/fvs/inspecao/pages/FichasListPage').then(m => ({ default: m.FichasListPage })));
const AbrirFichaWizard         = lazy(() => import('./modules/fvs/inspecao/pages/AbrirFichaWizard').then(m => ({ default: m.AbrirFichaWizard })));
const FichaGradePage           = lazy(() => import('./modules/fvs/inspecao/pages/FichaGradePage').then(m => ({ default: m.FichaGradePage })));
const FichaLocalPage           = lazy(() => import('./modules/fvs/inspecao/pages/FichaLocalPage').then(m => ({ default: m.FichaLocalPage })));
const ModelosListPage          = lazy(() => import('./modules/fvs/modelos/pages/ModelosListPage').then(m => ({ default: m.ModelosListPage })));
const ModeloFormPage           = lazy(() => import('./modules/fvs/modelos/pages/ModeloFormPage').then(m => ({ default: m.ModeloFormPage })));
const ModeloDetailPage         = lazy(() => import('./modules/fvs/modelos/pages/ModeloDetailPage').then(m => ({ default: m.ModeloDetailPage })));
const GradeMateriaisPage       = lazy(() => import('./modules/fvm/grade/pages/GradeMateriaisPage').then(m => ({ default: m.GradeMateriaisPage })));
const FichaLotePage            = lazy(() => import('./modules/fvm/grade/pages/FichaLotePage').then(m => ({ default: m.FichaLotePage })));
const CatalogoMateriaisPage    = lazy(() => import('./modules/fvm/catalogo/pages/CatalogoMateriaisPage'));
const FornecedoresPage         = lazy(() => import('./modules/fvm/fornecedores/pages/FornecedoresPage'));
const TiposEnsaioPage          = lazy(() => import('./modules/ensaios/tipos/pages/TiposEnsaioPage'));
const EnsaiosPage              = lazy(() => import('./modules/ensaios/laboratoriais/pages/EnsaiosPage'));
const RevisoesPage             = lazy(() => import('./modules/ensaios/revisoes/pages/RevisoesPage'));
const ConformidadePage         = lazy(() => import('./modules/ensaios/dashboard/pages/ConformidadePage'));
const RdosListPage             = lazy(() => import('./modules/diario/pages/RdosListPage').then(m => ({ default: m.RdosListPage })));
const DiarioHomePage           = lazy(() => import('./modules/diario/pages/DiarioHomePage').then(m => ({ default: m.DiarioHomePage })));
const CroquiRastreabilidadePage= lazy(() => import('./modules/concretagem/croqui/pages/CroquiRastreabilidadePage'));
const CroquiDetalhePage        = lazy(() => import('./modules/concretagem/croqui/pages/CroquiDetalhePage'));
const ConcretagemDashboardPage = lazy(() => import('./modules/concretagem/dashboard/pages/ConcretagemDashboardPage'));
const ConcrtagensListPage      = lazy(() => import('./modules/concretagem/concretagens/pages/ConcrtagensListPage'));
const ConcrtagemDetalhePage    = lazy(() => import('./modules/concretagem/concretagens/pages/ConcrtagemDetalhePage'));
const RdoFormPage              = lazy(() => import('./modules/diario/pages/RdoFormPage').then(m => ({ default: m.RdoFormPage })));
const RdoWorkflowPage          = lazy(() => import('./modules/diario/pages/RdoWorkflowPage').then(m => ({ default: m.RdoWorkflowPage })));
const AlmoxarifadoDashboard    = lazy(() => import('./modules/almoxarifado/dashboard/pages/AlmoxarifadoDashboard').then(m => ({ default: m.AlmoxarifadoDashboard })));
const EstoquePage              = lazy(() => import('./modules/almoxarifado/estoque/pages/EstoquePage').then(m => ({ default: m.EstoquePage })));
const MovimentosPage           = lazy(() => import('./modules/almoxarifado/estoque/pages/MovimentosPage').then(m => ({ default: m.MovimentosPage })));
const AlertasPage              = lazy(() => import('./modules/almoxarifado/estoque/pages/AlertasPage').then(m => ({ default: m.AlertasPage })));
const SolicitacoesListPage     = lazy(() => import('./modules/almoxarifado/solicitacao/pages/SolicitacoesListPage').then(m => ({ default: m.SolicitacoesListPage })));
const NovaSolicitacaoPage      = lazy(() => import('./modules/almoxarifado/solicitacao/pages/NovaSolicitacaoPage').then(m => ({ default: m.NovaSolicitacaoPage })));
const SolicitacaoDetalhePage   = lazy(() => import('./modules/almoxarifado/solicitacao/pages/SolicitacaoDetalhePage').then(m => ({ default: m.SolicitacaoDetalhePage })));
const OcListPage               = lazy(() => import('./modules/almoxarifado/compras/pages/OcListPage').then(m => ({ default: m.OcListPage })));
const NovaOcPage               = lazy(() => import('./modules/almoxarifado/compras/pages/NovaOcPage').then(m => ({ default: m.NovaOcPage })));
const OcDetalhePage            = lazy(() => import('./modules/almoxarifado/compras/pages/OcDetalhePage').then(m => ({ default: m.OcDetalhePage })));
const NfeListPage              = lazy(() => import('./modules/almoxarifado/nfe/pages/NfeListPage').then(m => ({ default: m.NfeListPage })));
const NfeDetalhePage           = lazy(() => import('./modules/almoxarifado/nfe/pages/NfeDetalhePage').then(m => ({ default: m.NfeDetalhePage })));
const PlanejamentoPage         = lazy(() => import('./modules/almoxarifado/planejamento/pages/PlanejamentoPage').then(m => ({ default: m.PlanejamentoPage })));
const InsightsPage             = lazy(() => import('./modules/almoxarifado/ia/pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const NcsListPage              = lazy(() => import('./modules/ncs/pages/NcsListPage').then(m => ({ default: m.NcsListPage })));
const NcDetalhePage            = lazy(() => import('./modules/ncs/pages/NcDetalhePage').then(m => ({ default: m.NcDetalhePage })));
const NcsGlobalPage            = lazy(() => import('./modules/ncs/pages/NcsGlobalPage').then(m => ({ default: m.NcsGlobalPage })));
const SemaforoPage             = lazy(() => import('./modules/semaforo/pages/SemaforoPage').then(m => ({ default: m.SemaforoPage })));
const AprovacoesPage           = lazy(() => import('./modules/aprovacoes/pages/AprovacoesPage').then(m => ({ default: m.AprovacoesPage })));
const AprovacaoDetalhePage     = lazy(() => import('./modules/aprovacoes/pages/AprovacaoDetalhePage').then(m => ({ default: m.AprovacaoDetalhePage })));
const TemplatesPage            = lazy(() => import('./modules/aprovacoes/pages/TemplatesPage').then(m => ({ default: m.TemplatesPage })));
const EfetivoListPage          = lazy(() => import('./modules/efetivo/pages/EfetivoListPage').then(m => ({ default: m.EfetivoListPage })));
const CadastrosEfetivoPage     = lazy(() => import('./modules/efetivo/pages/CadastrosPage').then(m => ({ default: m.CadastrosEfetivoPage })));
const CotacoesPage             = lazy(() => import('./modules/almoxarifado/cotacoes/pages/CotacoesPage'));
const ComparativoPage          = lazy(() => import('./modules/almoxarifado/cotacoes/pages/ComparativoPage'));
const PortalCotacaoPage        = lazy(() => import('./modules/portal/PortalCotacaoPage'));
const PortalFornecedorPage     = lazy(() => import('./modules/portal/PortalFornecedorPage'));
const RelatorioClientePage     = lazy(() => import('./modules/diario/pages/RelatorioClientePage'));
const FvsDashboardPage         = lazy(() => import('./modules/fvs/dashboard/pages/FvsDashboardPage'));
const FvsRelatorioClientePage  = lazy(() => import('./modules/fvs/cliente/FvsRelatorioClientePage'));
const PlanosAcaoPage           = lazy(() => import('./modules/fvs/planos-acao/pages/PlanosAcaoPage').then(m => ({ default: m.PlanosAcaoPage })));
const PlanoAcaoDetalhe         = lazy(() => import('./modules/fvs/planos-acao/pages/PlanoAcaoDetalhe').then(m => ({ default: m.PlanoAcaoDetalhe })));
const ConfigPlanosAcaoPage     = lazy(() => import('./modules/fvs/planos-acao/pages/ConfigPlanosAcaoPage').then(m => ({ default: m.ConfigPlanosAcaoPage })));

// ── QueryClient com cache agressivo ──────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // 1 min: não refetch se dado ainda é fresco
      gcTime: 300_000,         // 5 min: mantém em cache após unmount
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Skeleton leve para suspense ───────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex items-center justify-center h-48 text-[var(--text-faint)] text-sm animate-pulse">
      Carregando…
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

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

                {/* FVS — Catálogo */}
                <Route path="/configuracoes/fvs/catalogo" element={<CatalogoFvsPage />} />

                {/* FVS — Inspeção */}
                <Route path="/fvs/fichas" element={<FichasListPage />} />
                <Route path="/fvs/fichas/nova" element={<AbrirFichaWizard />} />
                <Route path="/fvs/fichas/:fichaId" element={<FichaGradePage />} />
                <Route path="/fvs/fichas/:fichaId/inspecao" element={<FichaLocalPage />} />

                {/* FVM */}
                <Route path="/fvm/obras/:obraId" element={<GradeMateriaisPage />} />
                <Route path="/fvm/lotes/:loteId" element={<FichaLotePage />} />
                <Route path="/fvm/catalogo" element={<CatalogoMateriaisPage />} />
                <Route path="/fvm/fornecedores" element={<FornecedoresPage />} />

                {/* FVS — Dashboard */}
                <Route path="/fvs/dashboard" element={<FvsDashboardPage />} />
                <Route path="/obras/:obraId/fvs/dashboard" element={<FvsDashboardPage />} />

                {/* Diário de Obra */}
                <Route path="/diario" element={<DiarioHomePage />} />
                <Route path="/obras/:id/diario" element={<RdosListPage />} />
                <Route path="/obras/:id/diario/:rdoId" element={<RdoFormPage />} />
                <Route path="/obras/:id/diario/:rdoId/workflow" element={<RdoWorkflowPage />} />

                {/* Ensaios */}
                <Route path="/configuracoes/ensaios/tipos" element={<TiposEnsaioPage />} />
                <Route path="/obras/:obraId/ensaios" element={<ConformidadePage />} />
                <Route path="/obras/:obraId/ensaios/laboratoriais" element={<EnsaiosPage />} />
                <Route path="/obras/:obraId/ensaios/revisoes" element={<RevisoesPage />} />

                {/* FVS — Modelos */}
                <Route path="/fvs/modelos" element={<ModelosListPage />} />
                <Route path="/fvs/modelos/novo" element={<ModeloFormPage />} />
                <Route path="/fvs/modelos/:id" element={<ModeloDetailPage />} />
                <Route path="/fvs/modelos/:id/editar" element={<ModeloFormPage />} />

                {/* Concretagem — sem obra ativa (sidebar sempre visível) */}
                <Route path="/concretagem" element={<ConcretagemDashboardPage />} />
                <Route path="/concretagem/concretagens" element={<ConcrtagensListPage />} />

                {/* Concretagem — com obra */}
                <Route path="/obras/:obraId/concretagem" element={<ConcretagemDashboardPage />} />
                <Route path="/obras/:obraId/concretagem/concretagens" element={<ConcrtagensListPage />} />
                <Route path="/obras/:obraId/concretagem/concretagens/:concrtagemId" element={<ConcrtagemDetalhePage />} />
                <Route path="/obras/:obraId/concretagem/croqui" element={<CroquiRastreabilidadePage />} />
                <Route path="/obras/:obraId/concretagem/croqui/:croquiId" element={<CroquiDetalhePage />} />

                {/* Almoxarifado */}
                <Route path="/obras/:obraId/almoxarifado" element={<AlmoxarifadoDashboard />} />
                <Route path="/obras/:obraId/almoxarifado/estoque" element={<EstoquePage />} />
                <Route path="/obras/:obraId/almoxarifado/estoque/movimentos" element={<MovimentosPage />} />
                <Route path="/obras/:obraId/almoxarifado/estoque/alertas" element={<AlertasPage />} />
                <Route path="/obras/:obraId/almoxarifado/solicitacoes" element={<SolicitacoesListPage />} />
                <Route path="/obras/:obraId/almoxarifado/solicitacoes/nova" element={<NovaSolicitacaoPage />} />
                <Route path="/obras/:obraId/almoxarifado/solicitacoes/:solicitacaoId" element={<SolicitacaoDetalhePage />} />
                <Route path="/obras/:obraId/almoxarifado/ocs" element={<OcListPage />} />
                <Route path="/obras/:obraId/almoxarifado/ocs/nova" element={<NovaOcPage />} />
                <Route path="/obras/:obraId/almoxarifado/ocs/:ocId" element={<OcDetalhePage />} />
                <Route path="/obras/:obraId/almoxarifado/nfes" element={<NfeListPage />} />
                <Route path="/obras/:obraId/almoxarifado/nfes/:nfeId" element={<NfeDetalhePage />} />
                <Route path="/obras/:obraId/almoxarifado/planejamento" element={<PlanejamentoPage />} />
                <Route path="/obras/:obraId/almoxarifado/insights" element={<InsightsPage />} />
                <Route path="/almoxarifado/solicitacoes/:solId/cotacoes" element={<CotacoesPage />} />
                <Route path="/almoxarifado/solicitacoes/:solId/comparativo" element={<ComparativoPage />} />

                {/* NCs */}
                <Route path="/obras/:obraId/ncs" element={<NcsListPage />} />
                <Route path="/obras/:obraId/ncs/:ncId" element={<NcDetalhePage />} />
                <Route path="/ncs" element={<NcsGlobalPage />} />

                {/* Semáforo */}
                <Route path="/obras/:id/semaforo" element={<SemaforoPage />} />
                <Route path="/semaforo" element={<SemaforoPage />} />

                {/* Aprovações */}
                <Route path="/aprovacoes" element={<AprovacoesPage />} />
                <Route path="/aprovacoes/templates" element={<TemplatesPage />} />
                <Route path="/aprovacoes/:id" element={<AprovacaoDetalhePage />} />

                {/* Efetivo */}
                <Route path="/obras/:obraId/efetivo" element={<EfetivoListPage />} />
                <Route path="/configuracoes/efetivo/cadastros" element={<CadastrosEfetivoPage />} />

                {/* Planos de Ação — por obra */}
                <Route path="/obras/:obraId/fvs/planos-acao" element={<PlanosAcaoPage />} />
                <Route path="/obras/:obraId/fvs/planos-acao/:paId" element={<PlanoAcaoDetalhe />} />

                {/* Planos de Ação — configuração */}
                <Route path="/configuracoes/planos-acao" element={<ConfigPlanosAcaoPage />} />
              </Route>

              {/* Portais públicos */}
              <Route path="/portal/cotacao/:token" element={<PortalCotacaoPage />} />
              <Route path="/portal/fornecedor" element={<PortalFornecedorPage />} />
              <Route path="/relatorio-cliente/:token" element={<RelatorioClientePage />} />
              <Route path="/fvs-cliente/:token" element={<FvsRelatorioClientePage />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
