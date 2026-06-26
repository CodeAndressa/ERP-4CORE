import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface UIState {
  sidebarCollapsed: boolean;
  aiDrawerOpen: boolean;
  aiDrawerContext: string;
  aiDrawerModule: string;
  commandOpen: boolean;
  theme: Theme;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openAIDrawer: (module?: string, context?: string) => void;
  closeAIDrawer: () => void;
  openCommand: () => void;
  closeCommand: () => void;
  toggleTheme: () => void;
}

const savedTheme = (localStorage.getItem('erp-theme') as Theme | null) ?? 'dark';

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  aiDrawerOpen: false,
  aiDrawerContext: '',
  aiDrawerModule: '',
  commandOpen: false,
  theme: savedTheme,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  openAIDrawer: (module = '', context = '') =>
    set({ aiDrawerOpen: true, aiDrawerModule: module, aiDrawerContext: context }),
  closeAIDrawer: () => set({ aiDrawerOpen: false }),
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('erp-theme', next);
      document.documentElement.classList.remove('dark', 'light');
      document.documentElement.classList.add(next);
      return { theme: next };
    }),
}));
