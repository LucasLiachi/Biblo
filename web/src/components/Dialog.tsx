import { useEffect, useRef, useState, type ReactNode } from "react";

interface DialogFrameProps {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}

export function DialogFrame({ title, onClose, wide, children }: DialogFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, button.btn-primary, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export interface PromptRequest {
  title: string;
  label: string;
  initial?: string;
  confirmLabel?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => Promise<void> | void;
}

export function PromptDialog({ request, onClose }: { request: PromptRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = request.validate?.(value) ?? null;
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await request.onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogFrame title={request.title} onClose={onClose}>
      <label>
        <span className="visually-hidden">{request.label}</span>
        <input
          type="text"
          value={value}
          aria-label={request.label}
          placeholder={request.label}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onFocus={(e) => {
            const dot = e.target.value.lastIndexOf(".");
            e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
          }}
        />
      </label>
      {error && <div className="field-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
          {request.confirmLabel ?? "Confirmar"}
        </button>
      </div>
    </DialogFrame>
  );
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    try {
      await request.onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  };
  return (
    <DialogFrame title={request.title} onClose={onClose}>
      <p>{request.message}</p>
      {error && <div className="field-error" role="alert">{error}</div>}
      <div className="dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className={`btn ${request.danger ? "btn-danger" : "btn-primary"}`} onClick={confirm}>
          {request.confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
