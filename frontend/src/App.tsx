import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const AppLayout = lazy(() => import('./components/AppLayout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const LeadsPageNew = lazy(() => import('./pages/LeadsPageNew'));
const ProposalsPage = lazy(() => import('./pages/ProposalsPage'));
const KnowledgePage = lazy(() => import('./pages/KnowledgePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SiteMetricsPage = lazy(() => import('./pages/SiteMetricsPage'));
const ContractsPage = lazy(() => import('./pages/ContractsPage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));

const VisaoGeralLayout = lazy(() => import('./pages/visao/VisaoGeralLayout'));
const ComercialLayout = lazy(() => import('./pages/comercial/ComercialLayout'));
const FinanceiroLayout = lazy(() => import('./pages/financeiro/FinanceiroPage'));
const MarketingLayout = lazy(() => import('./pages/marketing/MarketingLayout'));
const IALayout = lazy(() => import('./pages/ia/IALayout'));
const RelatoriosLayout = lazy(() => import('./pages/relatorios/RelatoriosLayout'));
const SistemaLayout = lazy(() => import('./pages/sistema/SistemaLayout'));

const CalendarioPage = lazy(() => import('./pages/marketing/CalendarioPage'));
const PostsPage = lazy(() => import('./pages/marketing/PostsPage'));
const IdeiasBancoPage = lazy(() => import('./pages/marketing/IdeiasBancoPage'));
const MetricasMarketingPage = lazy(() => import('./pages/marketing/MetricasMarketingPage'));
const CampanhasPage = lazy(() => import('./pages/marketing/CampanhasPage'));
const PlanejamentoPage = lazy(() => import('./pages/marketing/PlanejamentoPage'));
const ConexoesMarketingPage = lazy(() => import('./pages/marketing/ConexoesMarketingPage'));

const ChatPage = lazy(() => import('./pages/ia/ChatPage'));
const SugestoesPage = lazy(() => import('./pages/ia/SugestoesPage'));
const AnalisesPage = lazy(() => import('./pages/ia/AnalisesPage'));
const ResumosPage = lazy(() => import('./pages/ia/ResumosPage'));

const RelatoriosOverview = lazy(() => import('./pages/relatorios/RelatoriosOverview'));
const FinanceirosPage = lazy(() => import('./pages/relatorios/FinanceirosPage'));
const ComerciaisPage = lazy(() => import('./pages/relatorios/ComerciaisPage'));

const FollowupPage = lazy(() => import('./pages/comercial/FollowupPage'));
const AgendaPage = lazy(() => import('./pages/comercial/AgendaPage'));
const FunilPage = lazy(() => import('./pages/comercial/FunilPage'));

const ReceitasPage = lazy(() => import('./pages/financeiro/ReceitasPage'));
const CustosFixosPage = lazy(() => import('./pages/financeiro/CustosFixosPage'));
const CustosRecorrentesPage = lazy(() => import('./pages/financeiro/CustosRecorrentesPage'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7fb] text-sm text-slate-500">
      Carregando...
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<AppLayout />}>
          <Route element={<VisaoGeralLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="site-metrics" element={<SiteMetricsPage />} />
          </Route>

          <Route path="comercial" element={<ComercialLayout />}>
            <Route index element={<Navigate to="/comercial/leads" replace />} />
            <Route path="leads" element={<LeadsPageNew />} />
            <Route path="clientes" element={<ClientsPage />} />
            <Route path="pipeline" element={<PipelinePage />} />
            <Route path="funil" element={<FunilPage />} />
            <Route path="propostas" element={<ProposalsPage />} />
            <Route path="contratos" element={<ContractsPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="followup" element={<FollowupPage />} />
          </Route>

          <Route path="financeiro" element={<FinanceiroLayout />}>
            <Route path="receita" element={<ReceitasPage />} />
            <Route path="custos" element={<CustosFixosPage />} />
            <Route path="custos-fixos" element={<Navigate to="/financeiro/custos" replace />} />
            <Route path="custos-recorrentes" element={<CustosRecorrentesPage />} />
            <Route path="receitas" element={<Navigate to="/financeiro/receita" replace />} />
            <Route path="despesas" element={<Navigate to="/financeiro/custos" replace />} />
            <Route path="fluxo-caixa" element={<Navigate to="/financeiro" replace />} />
            <Route path="contas-receber" element={<Navigate to="/financeiro/receita" replace />} />
            <Route path="mensalidades" element={<Navigate to="/financeiro/custos" replace />} />
            <Route path="projecoes" element={<Navigate to="/financeiro" replace />} />
            <Route path="contas-pagar" element={<Navigate to="/financeiro/custos" replace />} />
            <Route path="orcamento" element={<Navigate to="/financeiro" replace />} />
            <Route path="conciliacao" element={<Navigate to="/financeiro/receita" replace />} />
          </Route>

          <Route path="marketing" element={<MarketingLayout />}>
            <Route index element={<Navigate to="/marketing/calendario" replace />} />
            <Route path="calendario" element={<CalendarioPage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="ideias" element={<IdeiasBancoPage />} />
            <Route path="metricas" element={<MetricasMarketingPage />} />
            <Route path="campanhas" element={<CampanhasPage />} />
            <Route path="planejamento" element={<PlanejamentoPage />} />
            <Route path="conexoes" element={<ConexoesMarketingPage />} />
          </Route>

          <Route path="ia" element={<IALayout />}>
            <Route index element={<Navigate to="/ia/chat" replace />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="sugestoes" element={<SugestoesPage />} />
            <Route path="analises" element={<AnalisesPage />} />
            <Route path="resumos" element={<ResumosPage />} />
          </Route>

          <Route path="relatorios" element={<RelatoriosLayout />}>
            <Route index element={<RelatoriosOverview />} />
            <Route path="financeiros" element={<FinanceirosPage />} />
            <Route path="comerciais" element={<ComerciaisPage />} />
          </Route>

          <Route element={<SistemaLayout />}>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
          </Route>

          <Route path="financial" element={<Navigate to="/financeiro" replace />} />
          <Route path="clients" element={<Navigate to="/comercial/clientes" replace />} />
          <Route path="leads" element={<Navigate to="/comercial/leads" replace />} />
          <Route path="proposals" element={<Navigate to="/comercial/propostas" replace />} />
          <Route path="contracts" element={<Navigate to="/comercial/contratos" replace />} />
          <Route path="ai" element={<Navigate to="/ia/chat" replace />} />
          <Route path="reports" element={<Navigate to="/relatorios" replace />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
