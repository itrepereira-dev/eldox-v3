import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  nome: string;
  email: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenantSlug: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser, tenantSlug: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenantSlug: null,
      isAuthenticated: false,

      login: (token, user, tenantSlug) => {
        localStorage.setItem('eldox_token', token);
        set({ token, user, tenantSlug, isAuthenticated: true });
      },

      setToken: (token) => {
        localStorage.setItem('eldox_token', token);
        set({ token });
      },

      logout: () => {
        localStorage.removeItem('eldox_token');
        set({ token: null, user: null, tenantSlug: null, isAuthenticated: false });
      },
    }),
    {
      name: 'eldox_auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        tenantSlug: state.tenantSlug,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
