import {
  Children,
  cloneElement,
  isValidElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactElement } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { errorMessage } from "../lib/utils";
export function Badge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">∅</span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Laster inn" role="status">
      {[1, 2, 3].map((n) => (
        <div className="skeleton" key={n} />
      ))}
      <span className="sr-only">Laster inn …</span>
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Vi fikk ikke hentet innholdet.</strong>
        <p>{errorMessage(error)}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Prøv igjen <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  type Control = {
    "aria-labelledby"?: string;
    "aria-label"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
  };
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {Children.map(children, (child) => {
        if (
          !isValidElement(child) ||
          !["input", "select", "textarea"].includes(String(child.type))
        )
          return child;
        const control = child as ReactElement<Control>;
        return cloneElement(control, {
          "aria-labelledby":
            control.props["aria-labelledby"] ??
            (control.props["aria-label"] ? undefined : labelId),
          "aria-describedby":
            [
              control.props["aria-describedby"],
              hint && hintId,
              error && errorId,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : control.props["aria-invalid"],
        });
      })}
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className="field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
export function Submit({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="spin" size={18} />
          Lagrer …
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  children,
  to,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  to?: string;
  action?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      {to && (
        <Link className="text-button" to={to}>
          {action ?? "Se alle"} <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
const ToastContext = createContext<(message: string, error?: boolean) => void>(
  () => {},
);
type Toast = { message: string; error: boolean; sequence: number };
const ToastPresentation = createContext<{
  toast: Toast | null;
  dismiss: () => void;
  registerDialog: () => () => void;
} | null>(null);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const sequence = useRef(0);
  const [dialogs, setDialogs] = useState(0);
  const registerDialog = useCallback(() => {
    setDialogs((count) => count + 1);
    return () => setDialogs((count) => Math.max(0, count - 1));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastContext.Provider
      value={(message, error = false) =>
        setToast({ message, error, sequence: ++sequence.current })
      }
    >
      <ToastPresentation.Provider
        value={{ toast, dismiss: () => setToast(null), registerDialog }}
      >
        {children}
        {toast && dialogs === 0 && (
          <div
            className={`toast ${toast.error ? "toast-error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {toast.error ? (
              <AlertCircle size={20} />
            ) : (
              <CheckCircle2 size={20} />
            )}
            <span>{toast.message}</span>
            <button aria-label="Lukk varsel" onClick={() => setToast(null)}>
              <X size={18} />
            </button>
          </div>
        )}
      </ToastPresentation.Provider>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPointerDown = useRef(false);
  const presentation = useContext(ToastPresentation);
  const registerDialog = presentation?.registerDialog;
  const [openedAt] = useState(() => presentation?.toast?.sequence ?? 0);
  const feedback =
    presentation?.toast && presentation.toast.sequence > openedAt
      ? presentation.toast
      : null;
  useEffect(() => registerDialog?.(), [registerDialog]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-labelledby="dialog-title"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const controls = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            "button, a[href], input, select, textarea, [tabindex]",
          ),
        ).filter(
          (control) =>
            !control.matches(':disabled, [tabindex="-1"]') &&
            control.getClientRects().length > 0,
        );
        const first = controls[0];
        const last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        // Native dialogs also target the dialog for clicks in its padding and
        // for text-selection drags ending there. Only a gesture starting on
        // the actual backdrop may dismiss it.
        backdropPointerDown.current =
          e.target === e.currentTarget &&
          (e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom);
      }}
      onPointerCancel={() => {
        backdropPointerDown.current = false;
      }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const endedOnBackdrop =
          e.target === e.currentTarget &&
          (e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom);
        const dismiss = backdropPointerDown.current && endedOnBackdrop;
        backdropPointerDown.current = false;
        if (dismiss) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Lukk dialog"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {feedback && (
        <div
          className={feedback.error ? "error" : "notice"}
          role={feedback.error ? "alert" : "status"}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Lukk varsel"
            onClick={presentation!.dismiss}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  onClose,
  pending = false,
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{children}</p>
      <div className="button-row">
        <button className="button" onClick={onClose}>
          Behold
        </button>
        <button
          className="button danger"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Behandler …" : "Bekreft"}
        </button>
      </div>
    </Modal>
  );
}
