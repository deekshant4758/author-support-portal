import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: string; className: string }> = {
  success: { icon: 'check_circle', className: 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]' },
  error: { icon: 'error', className: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]' },
  info: { icon: 'info', className: 'border-[#C7D2FE] bg-[#EEF2FF] text-[#3730A3]' },
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => {
          const style = TONE_STYLES[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lift animate-fade-up ${style.className}`}
            >
              <span className="material-symbols-outlined mt-0.5 text-[18px]">{style.icon}</span>
              <p className="text-body-sm font-medium leading-snug">{toast.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
};
