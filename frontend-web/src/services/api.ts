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

// Refresh automático em 401
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        // Enfileira requests que chegaram durante o refresh
        return new Promise((resolve) => {
          queue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken = data.token;
        localStorage.setItem('eldox_token', newToken);

        // Atualiza store sem importar diretamente (evita circular)
        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().setToken(newToken);

        // Esvazia a fila com o novo token
        queue.forEach((cb) => cb(newToken));
        queue = [];

        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh falhou — logout e redireciona
        queue = [];
        localStorage.removeItem('eldox_token');
        const { useAuthStore } = await import('../store/auth.store');
        useAuthStore.getState().logout();
        window.location.href = '/login';
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
