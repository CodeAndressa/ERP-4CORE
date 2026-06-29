import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FinancialPage from './pages/FinancialPage';
import ClientsPage from './pages/ClientsPage';
import LeadsPage from './pages/LeadsPage';
import LeadsPageNew from './pages/LeadsPageNew';
import ProposalsPage from './pages/ProposalsPage';
import KnowledgePage from './pages/KnowledgePage';
import SettingsPage from './pages/SettingsPage';
import SiteMetricsPage from './pages/SiteMetricsPage';
import ContractsPage from './pages/ContractsPage';
import PipelinePage from './pages/PipelinePage';

// Financeiro (Fase 3)
import FinanceiroLayout from './pages/financeiro/FinanceiroPage';

// Marketing (Fase 4)
import MarketingLayout from './pages/marketing/MarketingLayout';
import CalendarioPage from './pages/marketing/CalendarioPage';
import PostsPage from './pages/marketing/PostsPage';
import IdeiasBancoPage from './pages/marketing/IdeiasBancoPage';
import MetricasMarketingPage from './pages/marketing/MetricasMarketingPage';

// IA (Fase 5)
import IALayout from './pages/ia/IALayout';
import ChatPage from './pages/ia/ChatPage';
import SugestoesPage from './pages/ia/SugestoesPage';
import AnalisesPage from './pages/ia/AnalisesPage';
import ResumosPage from './pages/ia/ResumosPage';

// Relatórios (Fase 6)
import RelatoriosLayout from './pages/relatorios/RelatoriosLayout';
import RelatoriosOverview from './pages/relatorios/RelatoriosOverview';
import FinanceirosPage from './pages/relatorios/FinanceirosPage';
import ComerciaisPage from './pages/relatorios/ComerciaisPage';

// Comercial restante (Fase 2)
import FollowupPage from './pages/comercial/FollowupPage';
import AgendaPage from './pages/comercial/AgendaPage';
import FunilPage from './pages/comercial/FunilPage';

// Financeiro — novas páginas
import ReceitasPage from './pages/financeiro/ReceitasPage';
import CustosFixosPage from './pages/financeiro/CustosFixosPage';
import CustosRecorrentesPage from './pages/financeiro/CustosRecorrentesPage';

// Marketing — novas páginas
import CampanhasPage from './pages/marketing/CampanhasPage';
import PlanejamentoPage from './pages/marketing/PlanejamentoPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>

        {/* Visão Geral */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"    element={<DashboardPage />} />
        <Route path="site-metrics" element={<SiteMetricsPage />} />

        {/* Comercial */}
        <Route path="comercial">
          <Route index element={<Navigate to="/comercial/pipeline" replace />} />
          <Route path="leads"     element={<LeadsPageNew />} />
          <Route path="clientes"  element={<ClientsPage />} />
          <Route path="pipeline"  element={<PipelinePage />} />
          <Route path="funil"     element={<FunilPage />} />
          <Route path="propostas" element={<ProposalsPage />} />
          <Route path="agenda"    element={<AgendaPage />} />
          <Route path="followup"  element={<FollowupPage />} />
        </Route>

        {/* Financeiro - controle premium */}
        <Route path="financeiro" element={<FinanceiroLayout />}>
          <Route path="receita" element={<ReceitasPage />} />
          <Route path="custos-fixos" element={<CustosFixosPage />} />
          <Route path="custos-recorrentes" element={<CustosRecorrentesPage />} />
          <Route path="receitas" element={<Navigate to="/financeiro/receita" replace />} />
          <Route path="despesas" element={<Navigate to="/financeiro/custos-fixos" replace />} />
          <Route path="fluxo-caixa" element={<Navigate to="/financeiro" replace />} />
          <Route path="contas-receber" element={<Navigate to="/financeiro/receita" replace />} />
          <Route path="mensalidades" element={<Navigate to="/financeiro/custos-recorrentes" replace />} />
          <Route path="projecoes" element={<Navigate to="/financeiro" replace />} />
          <Route path="contas-pagar" element={<Navigate to="/financeiro/custos-fixos" replace />} />
          <Route path="orcamento" element={<Navigate to="/financeiro" replace />} />
          <Route path="conciliacao" element={<Navigate to="/financeiro/receita" replace />} />
        </Route>

        {/* Marketing — Fase 4 */}
        <Route path="marketing" element={<MarketingLayout />}>
          <Route index element={<Navigate to="/marketing/calendario" replace />} />
          <Route path="calendario"   element={<CalendarioPage />} />
          <Route path="posts"        element={<PostsPage />} />
          <Route path="ideias"       element={<IdeiasBancoPage />} />
          <Route path="metricas"     element={<MetricasMarketingPage />} />
          <Route path="campanhas"    element={<CampanhasPage />} />
          <Route path="planejamento" element={<PlanejamentoPage />} />
        </Route>

        {/* IA — Fase 5 */}
        <Route path="ia" element={<IALayout />}>
          <Route index element={<Navigate to="/ia/chat" replace />} />
          <Route path="chat"      element={<ChatPage />} />
          <Route path="sugestoes" element={<SugestoesPage />} />
          <Route path="analises"  element={<AnalisesPage />} />
          <Route path="resumos"   element={<ResumosPage />} />
        </Route>

        {/* Relatórios — Fase 6 */}
        <Route path="relatorios" element={<RelatoriosLayout />}>
          <Route index element={<RelatoriosOverview />} />
          <Route path="financeiros" element={<FinanceirosPage />} />
          <Route path="comerciais"  element={<ComerciaisPage />} />
        </Route>

        {/* Rotas legadas */}
        <Route path="financial"  element={<FinancialPage />} />
        <Route path="clients"    element={<ClientsPage />} />
        <Route path="leads"      element={<LeadsPage />} />
        <Route path="proposals"  element={<ProposalsPage />} />
        <Route path="contracts"  element={<ContractsPage />} />
        <Route path="knowledge"  element={<KnowledgePage />} />
        <Route path="ai"         element={<Navigate to="/ia/chat" replace />} />
        <Route path="reports"    element={<Navigate to="/relatorios" replace />} />
        <Route path="settings"   element={<SettingsPage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
