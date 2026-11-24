import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { uid } from '../lib/utils';

export type ToastKind = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

type ShowToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

const TOAST_ICONS: Record<ToastKind, IconName> = {
  success: 'check-circle',
  info: 'info',
  warning: 'alert',
  error: 'x-circle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, kind = 'success') => {
      const id = uid('toast');
      setToasts((t) => [...t.slice(-3), { id, message, kind }]);
      window.setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <Icon name={TOAST_ICONS[t.kind]} />
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Cerrar notificación">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
