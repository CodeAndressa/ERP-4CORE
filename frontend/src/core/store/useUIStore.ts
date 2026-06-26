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

const savedTheme: Theme = 'light';

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
  toggleTheme: () => {
    localStorage.setItem('erp-theme', 'light');
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    set({ theme: 'light' });
  },
}));
