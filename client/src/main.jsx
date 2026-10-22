import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import App from './App'
import { COOKIE_NAME } from './const'
import { trpc } from './lib/trpc'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: '/api/trpc',
    transformer: superjson,
    headers() {
      // The managed runtime can mirror an already-authenticated preview session
      // here when an embedded browser blocks the HttpOnly cookie. This is sent
      // only to the same-origin tRPC endpoint; the normal cookie flow remains
      // the primary production transport.
      try {
        const mirroredCookies = sessionStorage.getItem('manus-cookie')
        const prefix = `${COOKIE_NAME}=`
        const match = mirroredCookies?.split(';').find((entry) => entry.trim().startsWith(prefix))
        const token = match?.trim().slice(prefix.length)
        if (token) return { Authorization: `Bearer ${token}` }
      } catch {
        // Access to session storage may be unavailable in privacy-restricted contexts.
      }
      return {}
    },
  })],
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
)
