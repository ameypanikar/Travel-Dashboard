import { useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Paperclip, Lock, ShieldCheck } from "lucide-react";
import { updateExpense, fetchFxRate } from "@/lib/dashboard-api";
import type { Expense, TravelEvent } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { CATEGORIES, PAYMENT_METHODS, CARDS, BANKS, GENERAL_TRAVEL, parseAmount, toIsoDate, formatInr, sortTripOptions, isActiveTrip } from "@/lib/expense-utils";
import { autoCropReceipt } from "@/lib/receipt-crop";

export function EditExpenseDialog({
  expense,
  user,
  events,
  onClose,
  onSaved,
  restricted = false,
}: {
  expense: Expense;
  user: SessionUser;
  events: TravelEvent[];
  onClose: () => void;
  onSaved: () => void;
  // True when a non-management user is editing someone else's expense.
  // System Manager, Accounts, and Owner always have full unrestricted access
  // to edit amounts, currencies, FX rates, and receipts.
  restricted?: boolean;
}) {
  const userRole = (user?.role || "").trim().toLowerCase();
  const isManagerOrAccounts = ["system manager", "accounts", "owner"].includes(userRole);
  const isOwnExpense = (expense.username || "").trim().toLowerCase() === (user?.username || "").trim().toLowerCase();
  
  const isRestricted = restricted && !isOwnExpense && !isManagerOrAccounts;

  const [expenseDate, setExpenseDate] = useState(() => {
    if (expense.expensedate) return expense.expensedate;
    if (expense.timestamp) {
      const d = new Date(expense.timestamp);
      if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  });
  const [amount, setAmount] = useState(expense.amount || "");
  const [currency, setCurrency] = useState(expense.currency || "INR");
  const [category, setCategory] = useState(expense.category || CATEGORIES[0]);
  const [trip, setTrip] = useState(expense.trip || GENERAL_TRAVEL);
  const [description, setDescription] = useState(expense.description || "");
  const [paymentMethod, setPaymentMethod] = useState(expense.paymentmethod || PAYMENT_METHODS[0]);
  const [cardUsed, setCardUsed] = useState(expense.cardused || CARDS[0]);
  const [bankUsed, setBankUsed] = useState(expense.cardused || BANKS[0]);
  const [fxRate, setFxRate] = useState(expense.fxrate || "");
  const [inrEquivalent, setInrEquivalent] = useState(expense.inrequivalent || "");
  const [resolving, setResolving] = useState(false);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tripOptions = sortTripOptions(
    Array.from(new Set([GENERAL_TRAVEL, ...events.filter(e => isActiveTrip(e)).map((e) => (e.eventname || "").trim()).filter(Boolean), expense.trip])),
    events
  );
  const isForeign = currency.trim().toUpperCase() !== "INR";

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const amtNum = parseAmount(val);
    if (!Number.isNaN(amtNum)) {
      if (currency.trim().toUpperCase() === "INR") {
        setInrEquivalent(String(amtNum));
      } else if (fxRate) {
        const fxNum = parseFloat(fxRate);
        if (!Number.isNaN(fxNum)) {
          setInrEquivalent((amtNum * fxNum).toFixed(2));
        }
      }
    }
  };

  const handleCurrencyChange = (newCurrency: string) => {
    const upper = newCurrency.toUpperCase();
    setCurrency(upper);
    if (upper === "INR") {
      setFxRate("");
      const amtNum = parseAmount(amount);
      if (!Number.isNaN(amtNum)) setInrEquivalent(String(amtNum));
    }
  };

  const handleResolveFx = async () => {
    const cur = currency.trim().toUpperCase();
    if (!cur || cur === "INR") return;
    setResolving(true);
    setError("");
    try {
      const iso = expenseDate || new Date().toISOString().split("T")[0];
      const fx = await fetchFxRate(iso, cur);
      if (!fx) {
        setError("Couldn't resolve a rate — enter it manually below.");
        return;
      }
      setFxRate(fx.rate.toFixed(4));
      const amountNum = parseAmount(amount);
      if (!Number.isNaN(amountNum)) setInrEquivalent((amountNum * fx.rate).toFixed(2));
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    const cur = currency.trim().toUpperCase();
    if (cur && cur !== "INR" && amount) {
      const timer = setTimeout(() => {
        handleResolveFx();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currency, amount, expenseDate]);

  const handleFileSelected = async (file: File | null) => {
    if (!file) {
      setReplaceFile(null);
      return;
    }
    setCropping(true);
    const cropped = await autoCropReceipt(file);
    setCropping(false);
    setReplaceFile(cropped);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Send lowercase field keys that exactly match Supabase expenses table columns
      const fields: Record<string, string> = {
        category,
        trip,
        description,
        paymentmethod: paymentMethod,
        cardused: paymentMethod === "Card" ? cardUsed : (paymentMethod === "Cash" ? bankUsed : ""),
        expensedate: expenseDate,
      };

      if (!isRestricted) {
        fields.amount = amount;
        fields.currency = currency;
        fields.fxrate = fxRate;
        fields.inrequivalent = inrEquivalent;
      }

      await updateExpense({
        sourceRow: expense.sourcerow || (expense as any).id,
        username: expense.username,
        fields,
        file: isRestricted ? null : replaceFile,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message || "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-5">
        <div className="text-base font-bold">Edit expense</div>

        {/* Manager/Accounts full editing banner when editing someone else's expense */}
        {!isOwnExpense && isManagerOrAccounts && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-accent/10 border border-accent/20 p-2.5 text-[11px] text-accent font-medium">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Editing {expense.name || expense.username}'s expense with full Accounts & Management editing permissions (Amount, Currency & Details).</span>
          </div>
        )}

        {/* Restricted warning only for regular non-accounts users */}
        {isRestricted && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            <Lock className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Amount and receipt are locked here — you're editing {expense.name || expense.username}'s expense. Only category, trip, payment method, and description can be changed.</span>
          </div>
        )}

        <div className="mt-3 space-y-2.5 text-xs">
          {isRestricted ? (
            <div className="rounded-lg border border-border bg-muted/20 px-2.5 py-2">
              <span className="font-semibold text-muted-foreground">Amount: </span>
              <span className="font-semibold">
                {currency.trim().toUpperCase() === "INR" ? formatInr(parseAmount(amount) || 0) : `${amount} ${currency}`}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block font-semibold text-muted-foreground">Amount</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded border bg-background px-2 py-1.5 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Currency</label>
                  <input
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    maxLength={3}
                    disabled={isRestricted || resolving}
                    className="w-full rounded border bg-background px-2 py-1.5 uppercase disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-muted-foreground">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    disabled={isRestricted || resolving}
                    className="w-full rounded border bg-background px-2 py-1.5 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Payment method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {paymentMethod === "Card" && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Card used</label>
              <select value={cardUsed} onChange={(e) => setCardUsed(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                {CARDS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {paymentMethod === "Cash" && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Which bank?</label>
              <select value={bankUsed} onChange={(e) => setBankUsed(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
                {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Trip</label>
            <select value={trip} onChange={(e) => setTrip(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5">
              {tripOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5" />
          </div>

          {!isRestricted && isForeign && (
            <div className="rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Exchange rate</span>
                <button onClick={handleResolveFx} disabled={resolving} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-60">
                  {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {resolving ? "Resolving…" : "Resolve rate"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">FX rate</label>
                  <input value={fxRate} onChange={(e) => setFxRate(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">INR equivalent</label>
                  <input value={inrEquivalent} onChange={(e) => setInrEquivalent(e.target.value)} className="w-full rounded border bg-background px-2 py-1.5" />
                </div>
              </div>
            </div>
          )}

          {!isRestricted && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {expense.receipturl ? "Replace receipt (optional)" : "Add receipt (optional)"}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />
              {!replaceFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={cropping}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-2.5 text-[11px] font-semibold text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {cropping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  {cropping ? "Cropping…" : expense.receipturl ? "Attach replacement" : "Attach receipt"}
                </button>
              ) : (
                <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg bg-accent-soft px-3 py-2 text-[11px]">
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-accent">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{replaceFile.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setReplaceFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="shrink-0 ml-2 font-medium text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft disabled:opacity-60">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}