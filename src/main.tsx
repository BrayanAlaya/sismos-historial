import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AdminApp from './admin/AdminApp'
import App from './App'
import './index.css'
import 'leaflet/dist/leaflet.css'

const isTestPage = window.location.pathname.replace(/\/+$/, '') === '/prueba'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTestPage ? <AdminApp /> : <App />}
  </StrictMode>,
)
