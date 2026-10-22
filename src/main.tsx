import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { backendApi } from './api/backend'
import { hydrateCatalogue } from './data'
import { startWithBackend } from './store'

const root = createRoot(document.getElementById('root')!)

/** load the catalogue and the resident from the backend; fall back to the built-in demo data */
async function connect() {
  if (!backendApi.isConfigured()) return
  root.render(
    <div style={{ height: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'Montserrat, system-ui, sans-serif', color: '#8a919b', fontSize: 13, fontWeight: 600 }}>
      Connecting to Solar Kita…
    </div>,
  )
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timed out')), 10_000))
    const [catalogue, me] = await Promise.race([Promise.all([backendApi.getCatalogue(), backendApi.getMe()]), timeout])
    hydrateCatalogue(catalogue)
    startWithBackend(me)
  } catch (err) {
    console.warn('Solar Kita backend unavailable, using local demo data.', err)
  }
}

connect().finally(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
