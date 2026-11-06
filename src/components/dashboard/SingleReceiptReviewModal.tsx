import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Sparkles,
  Receipt,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  FileText,
  ExternalLink,
  Edit3,
  Loader2,
  ZoomIn,
  CreditCard,
  Banknote,
  Smartphone,
} from "lucide-react";
import { PAYMENT_METHODS, CARDS, BANKS } from "@/lib/expense-utils";

export interface SingleReceiptReviewModalProps {
  open: boolean;
  file: File | null;
  amount: string;
  setAmount: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
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
  category: string;
  setCategory: (v: string) => void;
  availableCategories: string[];
  description: string;
  setDescription: (v: string) => void;
  expenseDate: string;
  setExpenseDate: (v: string) => void;
  inrEquivalent?: string;
  saving?: boolean;
  onConfirmAdd: () => void;
  onEditInForm: () => void;
  onClose: () => void;
}

export function SingleReceiptReviewModal({
  open,
  file,
  amount,
  setAmount,
  currency,
  setCurrency,
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
  category,
  setCategory,
  availableCategories,
  description,
  setDescription,
  expenseDate,
  setExpenseDate,
  inrEquivalent,
  saving = false,
  onConfirmAdd,
  onEditInForm,
  onClose,
}: SingleReceiptReviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const isForeign = currency.trim().toUpperCase() !== "INR" && currency.trim() !== "";
  const isImage = file?.type.startsWith("image/");
  const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
  const isCard = paymentMethod === "Card";
  const isCash = paymentMethod === "Cash";
  const activeCards = cardsList && cardsList.length > 0 ? cardsList : CARDS;

  return (
    <>
      <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
        <DialogContent className="max-w-lg p-0 flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card">
          {/* Header with gradient badge */}
          <div className="shrink-0 relative border-b border-border/60 bg-muted/30 px-5 pt-4 pb-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" />
                Receipt Scanned
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                • Ready to Add
              </span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              Check Scanned Expense
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              Verify the extracted amount and trip, then click Add Expense to upload.
            </DialogDescription>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Top row: Receipt visual preview + Primary Amount Callout */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
              {/* Receipt thumbnail */}
              <div className="sm:col-span-5 flex flex-col justify-center items-center rounded-xl border border-border/80 bg-muted/20 p-2 relative group overflow-hidden">
                {previewUrl ? (
                  <div className="relative w-full h-32 flex items-center justify-center overflow-hidden rounded-lg">
                    <img
                      src={previewUrl}
                      alt="Scanned Receipt Preview"
                      className="max-h-full max-w-full object-contain rounded transition duration-200 group-hover:scale-105"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFullImage(true)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded text-white text-xs font-medium gap-1 cursor-pointer"
                    >
                      <ZoomIn className="h-4 w-4" />
                      View
                    </button>
                  </div>
                ) : isPdf ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center p-2">
                    <FileText className="h-10 w-10 text-destructive mb-1" />
                    <span className="text-[11px] font-semibold text-foreground truncate max-w-[140px]">
                      {file?.name || "Receipt.pdf"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">PDF Document</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center p-2">
                    <Receipt className="h-10 w-10 text-muted-foreground mb-1" />
                    <span className="text-[11px] font-medium text-muted-foreground">
                      No Image Preview
                    </span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-full">
                  <Receipt className="h-3 w-3 shrink-0" />
                  <span className="truncate">{file?.name || "Scanned receipt"}</span>
                </div>
              </div>

              {/* Amount & Currency Card */}
              <div className="sm:col-span-7 flex flex-col justify-between rounded-xl border border-accent/25 bg-accent-soft/30 p-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      Total Amount
                    </label>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Auto-detected
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border-2 border-accent/40 bg-background px-3 py-2 text-xl font-extrabold text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                        autoFocus
                      />
                    </div>
                    <div className="w-20 shrink-0">
                      <input
                        type="text"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-center text-sm font-bold uppercase text-foreground shadow-sm focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  {isForeign && inrEquivalent && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <span>In INR:</span>
                      <span>≈ ₹{inrEquivalent}</span>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  Tap to edit if the detected number differs from your paper receipt.
                </p>
              </div>
            </div>

            {/* Trip Selector (Prominent requirement) */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-sm">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
                <MapPin className="h-3.5 w-3.5 text-accent" />
                Assign to Trip
                <span className="text-destructive">*</span>
              </label>
              <select
                value={trip}
                onChange={(e) => setTrip(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              >
                {tripOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Expense will be logged and counted under this travel itinerary.
              </p>
            </div>

            {/* Payment Method Selector (Card | Cash | GPay) */}
            <div className="rounded-xl border border-border/80 bg-background p-3.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-accent" />
                  Payment Method
                  <span className="text-destructive">*</span>
                </label>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {isCard ? "Corporate Card" : isCash ? "Cash Source" : "UPI / GPay"}
                </span>
              </div>

              {/* 3 Choice Buttons: Cash | Card | GPay */}
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const isActive = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 px-3 text-xs font-semibold transition-all cursor-pointer min-h-[42px] ${
                        isActive
                          ? "bg-accent text-accent-foreground shadow-md ring-1 ring-accent font-bold scale-[1.01]"
                          : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                      }`}
                    >
                      {method === "Card" && <CreditCard className="h-3.5 w-3.5 shrink-0" />}
                      {method === "Cash" && <Banknote className="h-3.5 w-3.5 shrink-0" />}
                      {method === "GPay" && <Smartphone className="h-3.5 w-3.5 shrink-0" />}
                      <span>{method}</span>
                    </button>
                  );
                })}
              </div>

              {/* Sub-selector when Card is chosen */}
              {isCard && (
                <div className="pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3 text-accent" />
                      Which Corporate Card?
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Assigned Cards
                    </span>
                  </div>
                  <select
                    value={cardUsed}
                    onChange={(e) => setCardUsed(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    {activeCards.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sub-selector when Cash is chosen */}
              {isCash && (
                <div className="pt-2.5 border-t border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-accent" />
                      Cash Source / Bank
                    </label>
                    <span className="text-[10px] text-muted-foreground">
                      Source Account
                    </span>
                  </div>
                  <select
                    value={bankUsed}
                    onChange={(e) => setBankUsed(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
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

            {/* Category & Vendor / Description Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm focus:border-accent focus:outline-none"
                >
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  Expense Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Edit3 className="h-3.5 w-3.5" />
                Description / Vendor
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Starbucks, Uber, Client dinner"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {/* Action Footer - Pinned at bottom */}
          <div className="shrink-0 border-t border-border/60 bg-background/95 backdrop-blur-sm px-4 sm:px-5 py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onEditInForm}
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground transition hover:bg-muted focus:outline-none disabled:opacity-50"
            >
              <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
              Edit More in Form
            </button>

            <button
              type="button"
              onClick={onConfirmAdd}
              disabled={saving || !amount.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/25 transition hover:from-emerald-500 hover:to-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 stroke-[2.2]" />
                  Add Expense • {currency === "INR" || !currency ? "₹" : `${currency} `}
                  {amount || "0"}
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Image Preview Zoom Modal */}
      {showFullImage && previewUrl && (
        <Dialog open={showFullImage} onOpenChange={setShowFullImage}>
          <DialogContent className="max-w-2xl p-2 bg-black/90 border-0">
            <div className="relative flex items-center justify-center p-2">
              <img
                src={previewUrl}
                alt="Full receipt view"
                className="max-h-[80vh] w-auto object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
