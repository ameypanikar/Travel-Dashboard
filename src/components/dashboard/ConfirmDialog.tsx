import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  loading = false,
  error = "",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(openState: boolean) => !openState && onCancel()}>
      <DialogContent className="max-w-sm p-5">
        <div className="text-base font-bold">{title}</div>
        <p className="mt-1.5 text-sm text-muted-foreground">{message}</p>
        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft disabled:opacity-60"
          >
            Never mind
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
              destructive ? "bg-destructive" : "bg-accent text-accent-foreground"
            }`}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}