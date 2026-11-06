import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Layers,
  MapPin,
  CreditCard,
  Trash2,
  Upload,
  Plus,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { PAYMENT_METHODS, CARDS, BANKS } from "@/lib/expense-utils";

export interface BatchUploadModalProps {
  open: boolean;
  files: File[];
  onRemoveFile: (index: number) => void;
  onAddMoreFiles?: (newFiles: FileList | null) => void;
  trip: string;
  setTrip: (v: string) => void;
  tripOptions: string[];
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  cardUsed: string;
  setCardUsed: (v: string) => void;
  cardsList?: string[];
  bankUsed: string;
  setBankUsed: (v: string) => void;
  processing?: boolean;
  onConfirmUpload: (chosenTrip: string) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function BatchUploadModal({
  open,
  files,
  onRemoveFile,
  onAddMoreFiles,
  trip,
  setTrip,
  tripOptions,
  paymentMethod,
  setPaymentMethod,
  cardUsed,
  setCardUsed,
  cardsList,
  bankUsed,
  setBankUsed,
  processing = false,
  onConfirmUpload,
  onClose,
}: BatchUploadModalProps) {
  const [selectedTrip, setSelectedTrip] = useState(trip || tripOptions[0] || "General Travel");
  const fileAddInputRef = React.useRef<HTMLInputElement>(null);
  const activeCards = cardsList && cardsList.length > 0 ? cardsList : CARDS;

  // Sync selected trip when opened
  React.useEffect(() => {
    if (open) {
      setSelectedTrip(trip || tripOptions[0] || "General Travel");
    }
  }, [open, trip, tripOptions]);

  const isCard = paymentMethod === "Card";
  const isCash = paymentMethod === "Cash";

  const handleUploadClick = () => {
    setTrip(selectedTrip);
    onConfirmUpload(selectedTrip);
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent className="max-w-lg p-0 flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card">
        {/* Header */}
        <div className="shrink-0 relative border-b border-border/60 bg-muted/30 px-5 pt-4 pb-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent border border-accent/20">
              <Layers className="h-3 w-3" />
              Batch Upload
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              • {files.length} receipt{files.length === 1 ? "" : "s"} selected
            </span>
          </div>
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
            Choose Trip & Upload Receipts
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
            Choose which trip to assign these receipts to, then click Upload to process them all with AI.
          </DialogDescription>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Trip Selector (Primary requirement) */}
          <div className="rounded-xl border-2 border-accent/30 bg-accent-soft/20 p-4 shadow-sm">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <MapPin className="h-4 w-4 text-accent" />
              Upload receipts under this trip:
              <span className="text-destructive">*</span>
            </label>
            <select
              value={selectedTrip}
              onChange={(e) => setSelectedTrip(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              {tripOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              All {files.length} receipt{files.length === 1 ? "" : "s"} will be automatically scanned, cropped, and logged to this trip.
            </p>
          </div>

          {/* Payment Method Selector */}
          <div className="rounded-xl border border-border/80 bg-background p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                Payment Method
              </label>
              <div className="flex gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  const isActive = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        isActive
                          ? "bg-accent text-accent-foreground shadow-sm font-bold"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-selectors for Card / Cash */}
            {isCard && (
              <div className="pt-2 border-t border-border/50">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Which Corporate Card?
                </label>
                <select
                  value={cardUsed}
                  onChange={(e) => setCardUsed(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                >
                  {activeCards.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isCash && (
              <div className="pt-2 border-t border-border/50">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  Cash Source / Bank
                </label>
                <select
                  value={bankUsed}
                  onChange={(e) => setBankUsed(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                >
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Staged Files List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Selected Receipts ({files.length})
              </span>
              {onAddMoreFiles && (
                <>
                  <input
                    ref={fileAddInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    className="hidden"
                    onChange={(e) => onAddMoreFiles(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => fileAddInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Add more
                  </button>
                </>
              )}
            </div>

            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-2">
              {files.map((file, idx) => {
                const isImg = file.type.startsWith("image/");
                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-card px-2.5 py-2 text-xs border border-border/40 shadow-2xl-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isImg ? (
                        <ImageIcon className="h-3.5 w-3.5 text-accent shrink-0" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <span className="truncate font-medium text-foreground">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(idx)}
                      title="Remove file"
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions - Pinned at bottom */}
        <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 sm:px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted focus:outline-none disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleUploadClick}
            disabled={processing || files.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload {files.length} Receipt{files.length === 1 ? "" : "s"} under Trip
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
