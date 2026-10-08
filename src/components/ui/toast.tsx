import { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

let globalAddToast: ((msg: string, variant?: ToastVariant) => void) | null = null;

/** Call this anywhere (outside React) to show a toast */
export function showToast(message: string, variant: ToastVariant = "success") {
  globalAddToast?.(message, variant);
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "linear-gradient(135deg, oklch(0.25 0.06 155) 0%, oklch(0.20 0.04 160) 100%)",
    icon: "oklch(0.65 0.22 155)",
    border: "oklch(0.55 0.22 155 / 30%)",
  },
  error: {
    bg: "linear-gradient(135deg, oklch(0.25 0.06 25) 0%, oklch(0.20 0.04 20) 100%)",
    icon: "oklch(0.65 0.22 25)",
    border: "oklch(0.55 0.22 25 / 30%)",
  },
  info: {
    bg: "linear-gradient(135deg, oklch(0.25 0.06 264) 0%, oklch(0.20 0.04 270) 100%)",
    icon: "oklch(0.65 0.18 264)",
    border: "oklch(0.55 0.18 264 / 30%)",
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const Icon = ICONS[toast.variant];
  const colors = COLORS[toast.variant];

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl ${toast.exiting ? "toast-exit" : "toast-enter"}`}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        minWidth: "240px",
        maxWidth: "320px",
        backdropFilter: "blur(12px)",
      }}
    >
      <Icon className="h-5 w-5 shrink-0" style={{ color: colors.icon }} />
      <span className="flex-1 text-sm font-medium text-white">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded-full p-0.5 opacity-50 transition hover:opacity-100"
        style={{ color: "white" }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    // Mark as exiting first for the exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 220);
  }, []);

  const add = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    // Haptic feedback on mobile
    navigator.vibrate?.(40);
    // Auto-dismiss after 3.5s
    setTimeout(() => remove(id), 3500);
  }, [remove]);

  // Register global accessor
  useEffect(() => {
    globalAddToast = add;
    return () => { globalAddToast = null; };
  }, [add]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
      style={{ pointerEvents: "none" }}
    >
      {toasts.map((t) => (
        <div key={t.id} style={{ pointerEvents: "auto" }}>
          <ToastItem toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
