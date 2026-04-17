import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // envia cookie refresh_token automaticamente
});

// Injeta Bearer token em todo request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eldox_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Refresh automático em 401 ────────────────────────────────────────────────
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
let isRefreshing = false;
let queue: QueueEntry[] = [];

function flushQueue(err: unknown | null, token: string | null) {
  queue.forEach(({ resolve, reject }) => {
    if (err) reject(err);
    else if (token) resolve(token);
  });
  queue = [];
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return /\/auth\/(login|refresh|logout|register)/.test(url);
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    // Requests de auth não passam pelo ciclo de refresh (evita loop infinito)
    if (isAuthEndpoint(original?.url) || !original) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !original._retry) {
      // Se refresh já está em andamento, enfileira
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({
            resolve: (token) => {
              original.headers = original.headers ?? {};
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<{ token?: string; data?: { token?: string } }>(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        // Aceita ambos os formatos: { token } e { data: { token } }
        const newToken = data?.token ?? data?.data?.token;
        if (!newToken) throw new Error('Refresh não retornou token válido');

        localStorage.setItem('eldox_token', newToken);

        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().setToken(newToken);

        flushQueue(null, newToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshErr) {
        // Rejeita todos os requests enfileirados
        flushQueue(refreshErr, null);
        localStorage.removeItem('eldox_token');

        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().logout();

        // Redireciona só se não estiver já em /login
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  },
);

export const authApi = {
  login: (data: { slug: string; email: string; senha: string }) =>
    api.post('/auth/login', data).then((r) => r.data),

  register: (data: {
    tenantNome: string;
    tenantSlug: string;
    adminNome: string;
    adminEmail: string;
    adminSenha: string;
  }) => api.post('/auth/register', data).then((r) => r.data),

  refresh: () => api.post('/auth/refresh').then((r) => r.data),

  logout: () => api.post('/auth/logout').then((r) => r.data),

  me: () => api.get('/auth/me').then((r) => r.data),
};
