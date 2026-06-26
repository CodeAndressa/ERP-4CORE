import { Routes, Route, Navigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MarketingPage from './pages/MarketingPage';
import FinancialPage from './pages/FinancialPage';
import ClientsPage from './pages/ClientsPage';
import LeadsPage from './pages/LeadsPage';
import LeadsPageNew from './pages/LeadsPageNew';
import ProposalsPage from './pages/ProposalsPage';
import KnowledgePage from './pages/KnowledgePage';
import AiPage from './pages/AiPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import SiteMetricsPage from './pages/SiteMetricsPage';
import ContractsPage from './pages/ContractsPage';
import PipelinePage from './pages/PipelinePage';
import FinanceiroLayout from './pages/financeiro/FinanceiroPage';
import ContasReceberPage from './pages/financeiro/ContasReceberPage';
import MensalidadesPage from './pages/financeiro/MensalidadesPage';
import ProjecoesPage from './pages/financeiro/ProjecoesPage';

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
          <Route path="agenda"    element={<ComingSoon title="Agenda Comercial" phase={2} />} />
          <Route path="followup"  element={<ComingSoon title="Follow-up" phase={2} />} />
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

        {/* Marketing */}
        <Route path="marketing">
          <Route index element={<MarketingPage />} />
          <Route path="calendario"   element={<ComingSoon title="Calendário Editorial" phase={4} />} />
          <Route path="posts"        element={<ComingSoon title="Posts" phase={4} />} />
          <Route path="campanhas"    element={<ComingSoon title="Campanhas" phase={4} />} />
          <Route path="ideias"       element={<ComingSoon title="Banco de Ideias" phase={4} />} />
          <Route path="metricas"     element={<ComingSoon title="Métricas de Marketing" phase={4} />} />
          <Route path="performance"  element={<ComingSoon title="Performance" phase={4} />} />
          <Route path="planejamento" element={<ComingSoon title="Planejamento Mensal" phase={4} />} />
        </Route>

        {/* IA */}
        <Route path="ia">
          <Route index element={<Navigate to="/ia/chat" replace />} />
          <Route path="chat"      element={<AiPage />} />
          <Route path="sugestoes" element={<ComingSoon title="Sugestões IA" phase={5} />} />
          <Route path="analises"  element={<ComingSoon title="Análises IA" phase={5} />} />
          <Route path="resumos"   element={<ComingSoon title="Resumos Automáticos" phase={5} />} />
        </Route>

        {/* Relatórios */}
        <Route path="relatorios">
          <Route index element={<ReportsPage />} />
          <Route path="financeiros" element={<ComingSoon title="Relatórios Financeiros" phase={6} />} />
          <Route path="comerciais"  element={<ComingSoon title="Relatórios Comerciais" phase={6} />} />
        </Route>

        {/* Rotas legadas — mantidas para compatibilidade */}
        <Route path="financial"  element={<FinancialPage />} />
        <Route path="clients"    element={<ClientsPage />} />
        <Route path="leads"      element={<LeadsPage />} />
        <Route path="proposals"  element={<ProposalsPage />} />
        <Route path="contracts"  element={<ContractsPage />} />
        <Route path="knowledge"  element={<KnowledgePage />} />
        <Route path="ai"         element={<AiPage />} />
        <Route path="reports"    element={<ReportsPage />} />
        <Route path="settings"   element={<SettingsPage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
