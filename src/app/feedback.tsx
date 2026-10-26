import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

/* ---------------- Toasts ---------------- */
export type ToastTone = 'ok' | 'erro' | 'info' | 'aviso';
interface Toast { id: number; tone: ToastTone; title: string; body?: string }

const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
const ICON = { ok: Check, erro: X, info: Info, aviso: AlertTriangle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.tone === 'erro' ? 9000 : 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICON[t.tone];
            return (
              <motion.div
                key={t.id}
                className={`toast toast-${t.tone}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="toast-icon"><Icon aria-hidden /></span>
                <div>
                  <strong>{t.title}</strong>
                  {t.body && <p>{t.body}</p>}
                </div>
                <button className="toast-x" aria-label="Fechar aviso" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
                  <X aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* ---------------- Confirmação ---------------- */
export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirm: string;
  cancel?: string;
  danger?: boolean;
  /** Exige digitar esta palavra antes de confirmar (ações irreversíveis). */
  typeToConfirm?: string;
}

type Resolver = (ok: boolean) => void;
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: Resolver }) | null>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && <ConfirmDialog {...state} onClose={close} />}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

function ConfirmDialog(p: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const blocked = !!p.typeToConfirm && typed.trim().toUpperCase() !== p.typeToConfirm.toUpperCase();
  return (
    <Modal title={p.title} onClose={() => p.onClose(false)} tone={p.danger ? 'danger' : undefined}>
      <div className="modal-body">{p.body}</div>
      {p.typeToConfirm && (
        <label className="field" style={{ marginTop: 16 }}>
          <span>Digite {p.typeToConfirm} para confirmar</span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
      )}
      <div className="btn-row modal-actions">
        <button className="btn btn-ghost" onClick={() => p.onClose(false)}>{p.cancel ?? 'Cancelar'}</button>
        <button className={`btn ${p.danger ? 'btn-danger' : 'btn-primary'}`} disabled={blocked} onClick={() => p.onClose(true)}>
          {p.confirm}
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Modal acessível ---------------- */
export function Modal({ title, children, onClose, tone, wide }: { title: string; children: ReactNode; onClose: () => void; tone?: 'danger'; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const focusables = () => [...el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
    (focusables()[1] ?? focusables()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${tone === 'danger' ? 'modal-danger' : ''} ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" data-tone="grafite">
        <div className="modal-head">
          <h2 id="modal-title" className="h3">{title}</h2>
          <button className="btn btn-ghost btn-icon" aria-label="Fechar" onClick={onClose}><X aria-hidden /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
