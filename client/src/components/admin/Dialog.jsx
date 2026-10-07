// In-page dialogs that replace the browser's confirm() and alert().
//   const { confirm, notify } = useDialog();
//   if (!(await confirm('حذف هذا السجل؟', { danger: true }))) return;
//   await notify('تعذّر الحفظ');
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({
      kind: 'confirm',
      title: opts.title || 'تأكيد الإجراء',
      message,
      confirmLabel: opts.confirmLabel || 'تأكيد',
      cancelLabel: opts.cancelLabel || 'إلغاء',
      danger: !!opts.danger,
      resolve,
    });
  }), []);

  const notify = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({
      kind: 'notify',
      title: opts.title || 'تنبيه',
      message: String(message || 'حدث خطأ.'),
      confirmLabel: 'حسناً',
      danger: !!opts.danger,
      resolve,
    });
  }), []);

  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {dialog && <DialogModal dialog={dialog} onClose={close} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside DialogProvider');
  return ctx;
}

function DialogModal({ dialog, onClose }) {
  const titleId = useId();
  const primaryRef = useRef(null);
  const isConfirm = dialog.kind === 'confirm';

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const Icon = dialog.danger ? AlertTriangle : Info;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${titleId}-msg`}>
        <span className={`dialog-icon ${dialog.danger ? 'danger' : 'info'}`}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <h2 id={titleId}>{dialog.title}</h2>
        <p id={`${titleId}-msg`}>{dialog.message}</p>
        <div className="dialog-actions">
          {isConfirm && <button type="button" className="btn" onClick={() => onClose(false)}>{dialog.cancelLabel}</button>}
          <button
            ref={primaryRef}
            type="button"
            className={`btn ${dialog.danger ? 'dialog-danger' : 'primary'}`}
            onClick={() => onClose(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
