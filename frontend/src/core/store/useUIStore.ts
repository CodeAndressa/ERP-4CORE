import { create } from 'zustand';

// O modo escuro existia como andaime em cinco pontos e nunca funcionou: o
// seletor html.dark recebia os mesmos valores do claro, o toggleTheme gravava
// 'light' em qualquer caso e nao era chamado por arquivo nenhum, e o boot
// forcava a classe antes do primeiro paint. Removido por inteiro; quando houver
// tema escuro de verdade, ele volta com uma segunda paleta de tokens.
interface UIState {
  sidebarCollapsed: boolean;
  aiDrawerOpen: boolean;
  aiDrawerContext: string;
  aiDrawerModule: string;
  commandOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openAIDrawer: (module?: string, context?: string) => void;
  closeAIDrawer: () => void;
  openCommand: () => void;
  closeCommand: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  aiDrawerOpen: false,
  aiDrawerContext: '',
  aiDrawerModule: '',
  commandOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  openAIDrawer: (module = '', context = '') =>
    set({ aiDrawerOpen: true, aiDrawerModule: module, aiDrawerContext: context }),
  closeAIDrawer: () => set({ aiDrawerOpen: false }),
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
}));
