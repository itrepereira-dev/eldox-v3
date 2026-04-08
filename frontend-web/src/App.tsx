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
import { AppLayout } from './layouts/AppLayout';

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
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
