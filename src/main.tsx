import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { registerPWA } from './lib/pwa/pwa';
import './styles/base.css';
import './styles/layout.css';
import './styles/pages.css';

registerPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
