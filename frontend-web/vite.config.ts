import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendors React
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react'
          }
          // TanStack Query
          if (id.includes('@tanstack')) {
            return 'vendor-query'
          }
          // UI pesado
          if (id.includes('react-grid-layout') || id.includes('lucide-react')) {
            return 'vendor-ui'
          }
          // Módulos por domínio
          if (id.includes('/modules/fvs/')) return 'mod-fvs'
          if (id.includes('/modules/fvm/')) return 'mod-fvm'
          if (id.includes('/modules/almoxarifado/')) return 'mod-almox'
          if (id.includes('/modules/diario/')) return 'mod-diario'
          if (id.includes('/modules/concretagem/')) return 'mod-concretagem'
          if (id.includes('/modules/ensaios/')) return 'mod-ensaios'
          if (id.includes('/modules/ncs/') || id.includes('/modules/semaforo/') || id.includes('/modules/aprovacoes/') || id.includes('/modules/efetivo/')) return 'mod-outros'
          if (id.includes('/modules/dashboard/')) return 'mod-dashboard'
        },
      },
    },
  },
})
