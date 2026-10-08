import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './shared/components/ErrorBoundary'
import './index.css'
import Root from './app/Root'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<div style={{color: 'red', padding: 20}}>CRASHED! Please check the console.</div>}>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
)
