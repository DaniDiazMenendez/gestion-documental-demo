import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { DemoStoreProvider } from './store/DemoStore';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ToastProvider>
        <DemoStoreProvider>
          <App />
        </DemoStoreProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
