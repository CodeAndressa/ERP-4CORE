import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const api = axios.create({
  baseURL,
  timeout: 30000,
  timeoutErrorMessage: 'A conexão demorou mais que o esperado. Tente atualizar novamente em instantes.',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('4core.access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function signIn(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password });
  const { data } = await api.post('/auth/login', body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  localStorage.setItem('4core.access_token', data.access_token);
  return data;
}
