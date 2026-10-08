import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { updateBookingFields, fetchFxRate } from "@/lib/dashboard-api";
import type { TravelEvent } from "@/lib/dashboard-api";
import { parseAmount, GENERAL_TRAVEL, formatInr, isActiveTrip, sortTripOptions } from "@/lib/expense-utils";
import { Loader2 } from "lucide-react";

const TRIP_GRACE_DAYS = 1;

function toIsoDate(dateStr?: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function suggestTrip(dateDdMmYyyy: string, events: TravelEvent[]): string {
  const iso = toIsoDate(dateDdMmYyyy);
  if (!iso) return GENERAL_TRAVEL;
  const match = events.find((ev) => {
    if (!isActiveTrip(ev)) return false;
    const start = toIsoDate(ev.startdate);
    if (!start) return false;
    const end = toIsoDate(ev.enddate) || start;
    const graceStart = shiftIsoDate(start, -TRIP_GRACE_DAYS);
    const graceEnd = shiftIsoDate(end, TRIP_GRACE_DAYS);
    return iso >= graceStart && iso <= graceEnd;
  });
  return (match?.eventname || "").trim() || GENERAL_TRAVEL;
}


export function SpendEditDialog({
  open,
  onClose,
  onSaved,
  kind,
  sourceRow,
  verifyValue,
  amountFieldSlug,
  amountLabel = "Amount",
  fallbackDateDdMmYyyy,
  assignedTo,
  canEditAssignedTo = false,
  events,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  kind: "flight" | "hotel" | "train" | "bus";
  sourceRow: number;
  verifyValue: string;
  amountFieldSlug: "amount" | "bookedprice";
  amountLabel?: string;
  fallbackDateDdMmYyyy?: string;
  // Raw comma-separated assigned_to string off the booking — used only to
  // decide whether the total-vs-per-traveler toggle is worth showing at all
  // (no point asking when there's just one traveler on the booking).
  assignedTo?: string;
  events: TravelEvent[];
  initial: {
    amount: string;
    currency: string;
    bookingDate: string;
    trip: string;
    fxRate: string;
    inrEquivalent: string;
    paymentMethod?: string;
    amountType?: string; // "total" | "perperson"
  };
  canEditAssignedTo?: boolean;
}) {
  const cleanedInitialAmount = (() => {
    const n = parseAmount(initial.amount);
    return Number.isNaN(n) ? initial.amount : String(n);
  })();
  const [amount, setAmount] = useState(cleanedInitialAmount);
  const [currency, setCurrency] = useState(initial.currency);
  const [bookingDate, setBookingDate] = useState(initial.bookingDate);
  const savedTrip = (initial.trip || "").trim();
  const [trip, setTrip] = useState(
    savedTrip || suggestTrip(fallbackDateDdMmYyyy || bookingDate, events),
  );
  const [fxRate, setFxRate] = useState(initial.fxRate);
  const [inrEquivalent, setInrEquivalent] = useState(initial.inrEquivalent);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod || "Cash");
  const [amountType, setAmountType] = useState<"total" | "perperson">(
    initial.amountType === "perperson" ? "perperson" : "total",
  );
  const [localAssignedTo, setLocalAssignedTo] = useState(assignedTo || "");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const travelerCount = (assignedTo || "").split(",").map((s) => s.trim()).filter(Boolean).length;
  const showAmountTypeToggle = travelerCount > 1;

  const tripOptions = sortTripOptions(
    Array.from(new Set([GENERAL_TRAVEL, ...events.filter(e => isActiveTrip(e)).map((e) => (e.eventname || "").trim()).filter(Boolean), trip])),
    events
  );

  const isForeign = currency.trim() !== "" && currency.trim().toUpperCase() !== "INR";

  const handleResolveFx = async () => {
    const cur = currency.trim().toUpperCase();
    if (!cur || cur === "INR") return;
    const iso = toIsoDate(bookingDate || fallbackDateDdMmYyyy || "");
    if (!iso) {
      setError("Enter a booking date (or travel date) first, so we know which day's rate to use.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      const fx = await fetchFxRate(iso, cur);
      if (!fx) {
        setError("Couldn't resolve a rate for that date/currency — enter it manually below.");
        return;
      }
      setFxRate(fx.rate.toFixed(4));
      const amountNum = parseAmount(amount);
      if (!Number.isNaN(amountNum)) {
        setInrEquivalent((amountNum * fx.rate).toFixed(2));
      }
    } finally {
      setResolving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await updateBookingFields({
        kind,
        sourceRow,
        verifyValue,
        fields: {
          [amountFieldSlug]: amount,
          currency,
          bookingdate: bookingDate,
          trip,
          fxrate: fxRate,
          inrequivalent: inrEquivalent,
          paymentmethod: paymentMethod,
          amounttype: showAmountTypeToggle ? amountType : "total",
          assignedto: localAssignedTo,
        },
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(openState: boolean) => !openState && onClose()}>
      <DialogContent className="max-w-sm p-5">
        <div className="text-base font-bold">Edit Details</div>

        <div className="mt-3 space-y-2.5 text-xs">
          {canEditAssignedTo && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Assigned To (comma-separated)</label>
              <input
                value={localAssignedTo}
                onChange={(e) => setLocalAssignedTo(e.target.value)}
                placeholder="e.g. John Doe, Jane Smith"
                className="w-full rounded border bg-background px-2 py-1.5"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">{amountLabel}</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 4500"
              className="w-full rounded border bg-background px-2 py-1.5"
            />
          </div>

          {showAmountTypeToggle && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                This amount is…
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountType("total")}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                    amountType === "total"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent-soft"
                  }`}
                >
                  Total for all {travelerCount} travelers
                </button>
                <button
                  type="button"
                  onClick={() => setAmountType("perperson")}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                    amountType === "perperson"
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent-soft"
                  }`}
                >
                  Per traveler
                </button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {amountType === "perperson"
                  ? `Each of the ${travelerCount} travelers cost this much — the dashboard will use ${(parseAmount(amount) || 0) * travelerCount || "…"} as the real total.`
                  : "The dashboard will split this evenly across everyone assigned to this booking."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Currency</label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="INR"
                maxLength={3}
                className="w-full rounded border bg-background px-2 py-1.5 uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Booking date</label>
              <input
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-full rounded border bg-background px-2 py-1.5"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded border bg-background px-2 py-1.5"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="GPay">GPay</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Trip</label>
            <select
              value={trip}
              onChange={(e) => setTrip(e.target.value)}
              className="w-full rounded border bg-background px-2 py-1.5"
            >
              {tripOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {isForeign && (
            <div className="rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">Exchange rate (locked to booking date)</span>
                <button
                  onClick={handleResolveFx}
                  disabled={resolving}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {resolving ? "Resolving…" : "Resolve rate"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">FX rate (1 {currency || "___"} = ? INR)</label>
                  <input
                    value={fxRate}
                    onChange={(e) => setFxRate(e.target.value)}
                    placeholder="e.g. 83.12"
                    className="w-full rounded border bg-background px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">INR equivalent</label>
                  <input
                    value={inrEquivalent}
                    onChange={(e) => setInrEquivalent(e.target.value)}
                    placeholder="e.g. 373950.00"
                    className="w-full rounded border bg-background px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}