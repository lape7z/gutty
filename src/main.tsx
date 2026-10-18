import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ensureMeds } from './db';
import { captureInstallPrompt } from './install';
import './styles.css';

// Nella versione anteprima (file unico) non c'è service worker.
if (!import.meta.env.VITE_ARTIFACT) {
  registerSW({ immediate: true });
  captureInstallPrompt();
}

// Lista iniziale di integratori e farmaci per chi aveva già l'app.
void ensureMeds();

// Chiede al browser di non cancellare i dati in caso di poco spazio (importante su iOS/Safari).
void navigator.storage?.persist?.();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
