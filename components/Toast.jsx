"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, Loader2, X } from "lucide-react";

/**
 * A small toast system with no dependency to install.
 *
 * The API deliberately mirrors react-hot-toast — `toast.success(msg)`,
 * `toast.error(msg)`, `toast.loading(msg)`, `toast.dismiss(id)` and a `<Toaster />`
 * you mount once — so switching to that library later means changing an import
 * and nothing else.
 *
 * `toast()` is callable outside React (event handlers, promise chains) because
 * the queue lives in module scope and <Toaster /> just subscribes to it.
 */

const listeners = new Set();
let counter = 0;

const DEFAULT_DURATION = { success: 4000, error: 7000, loading: Infinity, blank: 4500 };

function push(item) {
  const id = item.id ?? `t${++counter}`;
  const toastItem = {
    id,
    type: item.type ?? "blank",
    message: item.message ?? "",
    detail: item.detail ?? null,
    duration: item.duration ?? DEFAULT_DURATION[item.type ?? "blank"],
  };
  listeners.forEach((notify) => notify({ kind: "add", toast: toastItem }));
  return id;
}

function dismiss(id) {
  listeners.forEach((notify) => notify({ kind: "dismiss", id: id ?? null }));
}

export const toast = Object.assign(
  (message, options) => push({ ...options, message }),
  {
    success: (message, options) => push({ ...options, type: "success", message }),
    error: (message, options) => push({ ...options, type: "error", message }),
    loading: (message, options) => push({ ...options, type: "loading", message }),
    dismiss,
  }
);

/* ------------------------------------------------------------------ */

const ICONS = {
  success: { Icon: CheckCircle2, className: "text-emerald-400" },
  error: { Icon: AlertCircle, className: "text-red-400" },
  loading: { Icon: Loader2, className: "text-violet-300 animate-spin" },
  blank: { Icon: Info, className: "text-cyan-300" },
};

const ACCENT = {
  success: "border-emerald-500/30 bg-emerald-950/40",
  error: "border-red-500/30 bg-red-950/40",
  loading: "border-violet-500/30 bg-violet-950/30",
  blank: "border-white/12 bg-zinc-900/70",
};

function ToastRow({ item, onClose }) {
  const [shown, setShown] = useState(false);
  const { Icon, className } = ICONS[item.type] ?? ICONS.blank;

  // Animate in on the frame after mount so the browser has a "from" state to
  // transition out of. Plain CSS transitions — no motion library needed here.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(item.duration)) return undefined;
    const timer = setTimeout(onClose, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onClose]);

  return (
    <div
      // Errors interrupt; successes wait their turn.
      role={item.type === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border ${
        ACCENT[item.type] ?? ACCENT.blank
      } p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${className}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-white">{item.message}</p>
        {item.detail && (
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.detail}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="-m-1 rounded p-1 text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function notify(event) {
      if (event.kind === "dismiss") {
        setItems((prev) => (event.id === null ? [] : prev.filter((i) => i.id !== event.id)));
        return;
      }
      // Same id replaces in place — that's how "Sending…" becomes "Sent".
      setItems((prev) => [...prev.filter((i) => i.id !== event.toast.id), event.toast].slice(-3));
    }

    listeners.add(notify);
    return () => listeners.delete(notify);
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2.5 p-4 sm:inset-x-auto sm:left-0 sm:items-start sm:p-6"
    >
      {items.map((item) => (
        <ToastRow
          key={item.id}
          item={item}
          onClose={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
        />
      ))}
    </div>
  );
}
