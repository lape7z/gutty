import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

registerSW({ immediate: true });

// Chiede al browser di non cancellare i dati in caso di poco spazio (importante su iOS/Safari).
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
