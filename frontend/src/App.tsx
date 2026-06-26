import { Routes, Route, Navigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FinancialPage from './pages/FinancialPage';
import ClientsPage from './pages/ClientsPage';
import LeadsPage from './pages/LeadsPage';
import LeadsPageNew from './pages/LeadsPageNew';
import ProposalsPage from './pages/ProposalsPage';
import KnowledgePage from './pages/KnowledgePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import SiteMetricsPage from './pages/SiteMetricsPage';
import ContractsPage from './pages/ContractsPage';
import PipelinePage from './pages/PipelinePage';

// Financeiro (Fase 3)
import FinanceiroLayout from './pages/financeiro/FinanceiroPage';
import ContasReceberPage from './pages/financeiro/ContasReceberPage';
import MensalidadesPage from './pages/financeiro/MensalidadesPage';
import ProjecoesPage from './pages/financeiro/ProjecoesPage';

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

function ComingSoon({ title, phase }: { title: string; phase?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl py-20 text-center"
      style={{ border: '1px dashed var(--erp-border-strong)', background: 'var(--erp-surface)' }}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400">
        <Zap size={22} />
      </div>
      <p className="text-base font-semibold" style={{ color: 'var(--erp-text)' }}>{title}</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--erp-text-muted)' }}>Em desenvolvimento · {phase ? `Fase ${phase}` : 'Em breve'}</p>
    </div>
  );
}

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
          <Route path="funil"     element={<ComingSoon title="Funil de Conversão" phase={2} />} />
          <Route path="propostas" element={<ProposalsPage />} />
          <Route path="agenda"    element={<AgendaPage />} />
          <Route path="followup"  element={<FollowupPage />} />
        </Route>

        {/* Financeiro — Fase 3 */}
        <Route path="financeiro" element={<FinanceiroLayout />}>
          <Route path="contas-receber" element={<ContasReceberPage />} />
          <Route path="mensalidades"   element={<MensalidadesPage />} />
          <Route path="projecoes"      element={<ProjecoesPage />} />
          <Route path="receitas"       element={<ComingSoon title="Receitas" phase={3} />} />
          <Route path="despesas"       element={<ComingSoon title="Despesas" phase={3} />} />
          <Route path="fluxo-caixa"    element={<ComingSoon title="Fluxo de Caixa" phase={3} />} />
          <Route path="contas-pagar"   element={<ComingSoon title="Contas a Pagar" phase={3} />} />
          <Route path="orcamento"      element={<ComingSoon title="Orçamento" phase={3} />} />
          <Route path="conciliacao"    element={<ComingSoon title="Conciliação" phase={3} />} />
        </Route>

        {/* Marketing — Fase 4 */}
        <Route path="marketing" element={<MarketingLayout />}>
          <Route index element={<Navigate to="/marketing/calendario" replace />} />
          <Route path="calendario"   element={<CalendarioPage />} />
          <Route path="posts"        element={<PostsPage />} />
          <Route path="ideias"       element={<IdeiasBancoPage />} />
          <Route path="metricas"     element={<MetricasMarketingPage />} />
          <Route path="campanhas"    element={<ComingSoon title="Campanhas" phase={4} />} />
          <Route path="planejamento" element={<ComingSoon title="Planejamento Mensal" phase={4} />} />
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
