import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { backendApi, getSession } from './api/backend'
import { hydrateCatalogue } from './data'
import Login from './pages/Login'
import { startWithBackend } from './store'

const root = createRoot(document.getElementById('root')!)

const showApp = () => root.render(<StrictMode><App /></StrictMode>)

/**
 * With a backend: sign in first, then load the catalogue and the resident before the app renders.
 * Without one (or if it can't be reached) the app runs on its built-in demo data.
 */
async function boot() {
  if (!backendApi.isConfigured()) return showApp()
  if (!getSession()) {
    // after signing in, always start on Home (not whatever page was open before)
    const home = () => window.history.replaceState(null, '', '#/')
    root.render(<Login onSignedIn={() => { home(); void boot() }} onOffline={() => { home(); showApp() }} />)
    return
  }
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
  showApp()
}

void boot()
