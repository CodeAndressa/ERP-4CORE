import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import LeadsPageNew from './pages/LeadsPageNew';
import ProposalsPage from './pages/ProposalsPage';
import KnowledgePage from './pages/KnowledgePage';
import SettingsPage from './pages/SettingsPage';
import SiteMetricsPage from './pages/SiteMetricsPage';
import ContractsPage from './pages/ContractsPage';
import PipelinePage from './pages/PipelinePage';

import VisaoGeralLayout from './pages/visao/VisaoGeralLayout';
import ComercialLayout from './pages/comercial/ComercialLayout';
import FinanceiroLayout from './pages/financeiro/FinanceiroPage';
import MarketingLayout from './pages/marketing/MarketingLayout';
import IALayout from './pages/ia/IALayout';
import RelatoriosLayout from './pages/relatorios/RelatoriosLayout';
import SistemaLayout from './pages/sistema/SistemaLayout';

import CalendarioPage from './pages/marketing/CalendarioPage';
import PostsPage from './pages/marketing/PostsPage';
import IdeiasBancoPage from './pages/marketing/IdeiasBancoPage';
import MetricasMarketingPage from './pages/marketing/MetricasMarketingPage';
import CampanhasPage from './pages/marketing/CampanhasPage';
import PlanejamentoPage from './pages/marketing/PlanejamentoPage';
import ConexoesMarketingPage from './pages/marketing/ConexoesMarketingPage';

import ChatPage from './pages/ia/ChatPage';
import SugestoesPage from './pages/ia/SugestoesPage';
import AnalisesPage from './pages/ia/AnalisesPage';
import ResumosPage from './pages/ia/ResumosPage';

import RelatoriosOverview from './pages/relatorios/RelatoriosOverview';
import FinanceirosPage from './pages/relatorios/FinanceirosPage';
import ComerciaisPage from './pages/relatorios/ComerciaisPage';

import FollowupPage from './pages/comercial/FollowupPage';
import AgendaPage from './pages/comercial/AgendaPage';
import FunilPage from './pages/comercial/FunilPage';

import ReceitasPage from './pages/financeiro/ReceitasPage';
import CustosFixosPage from './pages/financeiro/CustosFixosPage';
import CustosRecorrentesPage from './pages/financeiro/CustosRecorrentesPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route element={<VisaoGeralLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="site-metrics" element={<SiteMetricsPage />} />
        </Route>

        <Route path="comercial" element={<ComercialLayout />}>
          <Route index element={<Navigate to="/comercial/funil" replace />} />
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
  );
}

export default App;
