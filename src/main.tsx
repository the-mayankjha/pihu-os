import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<div style={{color: 'red', padding: 20}}>CRASHED! Please check the console.</div>}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
