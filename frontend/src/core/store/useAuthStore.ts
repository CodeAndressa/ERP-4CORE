import { create } from 'zustand';
import { api, signIn } from '../../services/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('4core.access_token'),
  user: null,
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true });
    try {
      await signIn(email, password);
      const token = localStorage.getItem('4core.access_token');
      set({ token, loading: false });
      await get().fetchMe();
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('4core.access_token');
    set({ token: null, user: null, initialized: true });
  },

  fetchMe: async () => {
    const token = localStorage.getItem('4core.access_token');
    if (!token) {
      set({ token: null, user: null, initialized: true });
      return;
    }

    try {
      const { data } = await api.get<User>('/auth/me');
      set({ token, user: data, initialized: true });
    } catch {
      localStorage.removeItem('4core.access_token');
      set({ token: null, user: null, initialized: true });
    }
  },
}));
