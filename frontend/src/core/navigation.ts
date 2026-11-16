import {
  BarChart3,
  Bell,
  Brain,
  Building2,
  Calendar,
  CalendarDays,
  DollarSign,
  FileText,
  FolderOpen,
  Kanban,
  LayoutDashboard,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Radar,
  Receipt,
  ScrollText,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** A árvore de navegação do ERP, em um lugar só.
 *
 *  Antes a mesma estrutura estava descrita em seis listas independentes: as
 *  áreas da sidebar, as abas do topo, o transbordo das abas, os destinos do
 *  menu do celular, os comandos da busca e os títulos de página. Nenhuma
 *  derivava da outra e elas já tinham divergido: dez rotas existentes não
 *  apareciam na busca global, e uma rota da busca não existia em aba nenhuma.
 *
 *  Quem precisa de uma visão específica deriva dela daqui. */

export interface NavScreen {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Fora do caminho principal da área: aparece, mas sem disputar atenção. */
  secondary?: boolean;
}

export interface NavArea {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Prefixos de rota que acendem esta área. */
  match: string[];
  screens: NavScreen[];
}

export interface NavGroup {
  label: string;
  areas: NavArea[];
}

export const NAV: NavGroup[] = [
  {
    label: 'Operação',
    areas: [
      {
        label: 'Visão Geral',
        path: '/dashboard',
        icon: LayoutDashboard,
        match: ['/dashboard', '/site-metrics'],
        screens: [
          { label: 'Painel', path: '/dashboard', icon: LayoutDashboard },
          { label: 'Métricas do site', path: '/site-metrics', icon: BarChart3 },
        ],
      },
      {
        label: 'Comercial',
        path: '/comercial',
        icon: Users,
        match: ['/comercial', '/clients', '/leads', '/proposals', '/contracts'],
        screens: [
          { label: 'Leads', path: '/comercial/leads', icon: Users },
          { label: 'Pipeline', path: '/comercial/pipeline', icon: Kanban },
          { label: 'Follow-up', path: '/comercial/followup', icon: Bell },
          { label: 'Agenda', path: '/comercial/agenda', icon: Calendar },
          { label: 'Funil', path: '/comercial/funil', icon: Target },
          { label: 'Prospecção', path: '/comercial/prospeccao', icon: Radar, secondary: true },
          { label: 'Propostas', path: '/comercial/propostas', icon: FileText, secondary: true },
          { label: 'Clientes', path: '/comercial/clientes', icon: Building2, secondary: true },
          { label: 'Contratos', path: '/comercial/contratos', icon: ScrollText, secondary: true },
        ],
      },
      {
        label: 'Financeiro',
        path: '/financeiro',
        icon: DollarSign,
        match: ['/financeiro', '/financial'],
        screens: [
          { label: 'Visão geral', path: '/financeiro', icon: DollarSign },
          { label: 'Cobranças', path: '/financeiro/cobrancas', icon: Receipt },
          { label: 'Receita', path: '/financeiro/receita', icon: TrendingUp },
          { label: 'Custos', path: '/financeiro/custos', icon: Wallet },
        ],
      },
      {
        label: 'Marketing',
        path: '/marketing',
        icon: Megaphone,
        match: ['/marketing'],
        screens: [
          { label: 'Estúdio', path: '/marketing/estudio', icon: Sparkles },
          { label: 'Esteira', path: '/marketing/agente', icon: Brain },
          { label: 'Mensagens', path: '/marketing/mensagens', icon: MessageCircle },
          { label: 'Métricas', path: '/marketing/metricas', icon: BarChart3 },
          { label: 'Calendário', path: '/marketing/calendario', icon: CalendarDays },
          { label: 'Posts', path: '/marketing/posts', icon: FileText },
          { label: 'Ideias', path: '/marketing/ideias', icon: Lightbulb, secondary: true },
          { label: 'Campanhas', path: '/marketing/campanhas', icon: Target, secondary: true },
          { label: 'Planejamento', path: '/marketing/planejamento', icon: Megaphone, secondary: true },
          { label: 'Conexões', path: '/marketing/conexoes', icon: Settings2, secondary: true },
        ],
      },
    ],
  },
  {
    label: 'Leitura',
    areas: [
      {
        label: 'IA',
        path: '/ia',
        icon: Brain,
        match: ['/ia', '/ai'],
        screens: [
          { label: 'Chat e insights', path: '/ia/chat', icon: MessageCircle },
          { label: 'Sugestões', path: '/ia/sugestoes', icon: Lightbulb },
          { label: 'Análises', path: '/ia/analises', icon: BarChart3 },
          { label: 'Resumos', path: '/ia/resumos', icon: FileText },
        ],
      },
      {
        label: 'Relatórios',
        path: '/relatorios',
        icon: FolderOpen,
        match: ['/relatorios', '/reports'],
        screens: [
          { label: 'Visão geral', path: '/relatorios', icon: FolderOpen },
          { label: 'Financeiros', path: '/relatorios/financeiros', icon: DollarSign },
          { label: 'Comerciais', path: '/relatorios/comerciais', icon: Users },
        ],
      },
    ],
  },
  {
    label: 'Ajustes',
    areas: [
      {
        label: 'Sistema',
        path: '/settings',
        icon: Settings2,
        match: ['/settings', '/knowledge', '/ambiente'],
        screens: [
          { label: 'Configurações', path: '/settings', icon: Settings2 },
          { label: 'Conhecimento', path: '/knowledge', icon: Brain },
          { label: 'Ambiente', path: '/ambiente', icon: Radar },
        ],
      },
    ],
  },
];

export const AREAS: NavArea[] = NAV.flatMap((group) => group.areas);

export function areaFor(pathname: string): NavArea | undefined {
  return AREAS.find((area) =>
    area.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

export function screenFor(pathname: string): NavScreen | undefined {
  // A tela mais específica vence: `/financeiro/custos` não deve casar com
  // `/financeiro` só porque este vem antes na lista.
  return AREAS.flatMap((area) => area.screens)
    .filter((screen) => pathname === screen.path || pathname.startsWith(`${screen.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

/** Onde o usuário está, para o cabeçalho dizer sem que ele precise adivinhar. */
export function trailFor(pathname: string): { area?: NavArea; screen?: NavScreen } {
  return { area: areaFor(pathname), screen: screenFor(pathname) };
}
