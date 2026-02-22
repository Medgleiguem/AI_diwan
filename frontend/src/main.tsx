import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { Analytics } from "@vercel/analytics/react"
import './index.css'

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter
        future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}>
        <App />
        <Analytics />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              direction: 'rtl',
              fontFamily: '"IBM Plex Sans Arabic", system-ui',
              background: '#292524',
              color: '#e7d5b0',
              border: '1px solid #44403c',
              borderRadius: '12px',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
