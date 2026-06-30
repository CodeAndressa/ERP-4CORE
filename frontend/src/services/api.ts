import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  timeoutErrorMessage: 'A conexÃ£o demorou mais que o esperado. Tente atualizar novamente em instantes.',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('4core.access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? '');
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('4core.access_token');
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export async function signIn(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password });
  const { data } = await api.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  localStorage.setItem('4core.access_token', data.access_token);
  return data;
}

