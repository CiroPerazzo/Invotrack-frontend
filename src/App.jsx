import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/context/AuthContext'
import { CompanyProvider } from '@/features/companies/context/CompanyContext'
import { ToastProvider } from '@/components/ui/toast'
import { ThemeProvider } from '@/features/settings/context/ThemeContext'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/app/router'

// Componente raíz de la aplicación. Envuelve toda la app con los providers
// necesarios: tema, caché de datos (QueryClient), autenticación (Auth),
// contexto de empresa (Company) y notificaciones (Toast), y registra el router.
export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CompanyProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </CompanyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
