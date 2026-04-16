// URL base da API — configurável por variável de ambiente
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'
export const API_ROOT = API_BASE.replace(/\/api\/v1$/, '')
