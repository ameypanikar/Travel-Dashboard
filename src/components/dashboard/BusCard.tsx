import { useEffect, useState } from "react";
import { formatTime } from "@/lib/date-utils";
import { updateBookingStatus, removeBooking } from "@/lib/dashboard-api";
import type { TravelEvent } from "@/lib/dashboard-api";
import { getSessionUser } from "@/lib/auth";
import { FULL_ACCESS_ROLES, canonicalizePersonName, splitPassengerList } from "@/lib/role-filter";
import { ConfirmDialog } from "./ConfirmDialog";
import { SpendEditDialog } from "./SpendEditDialog";
import { Ban, RotateCcw, Trash2, PenLine } from "lucide-react";

export type Bus = Record<string, string>;

function parseDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const dp = date.split("/");
  if (dp.length !== 3) return null;
  const [dd, mm, yyyy] = dp;
  const [hh, mn] = time.split(":");
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh || "0"), parseInt(mn || "0"), 0);
}

function getProgress(dep: Date | null, arr: Date | null): number {
  if (!dep || !arr) return 0;
  const total = arr.getTime() - dep.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (Date.now() - dep.getTime()) / total));
}

// Simple side-view coach bus — much plainer than the steam loco on TrainCard,
// but keeps the same "vehicle sliding along a track" visual language.
function SimpleBus({ color }: { color: string }) {
  const dark = color === "#CBD5E1" ? "#A0AEC0" : color === "#94A3B8" ? "#718096" : "#1E40AF";
  return (
    <g>
      <rect x="-16" y="-10" width="32" height="14" rx="3" fill={color} />
      <rect x="-13" y="-8" width="7" height="6" rx="1" fill="white" opacity="0.85" />
      <rect x="-3" y="-8" width="7" height="6" rx="1" fill="white" opacity="0.85" />
      <rect x="7" y="-8" width="6" height="6" rx="1" fill="white" opacity="0.85" />
      <rect x="-18" y="2" width="36" height="3" rx="1" fill={dark} />
      <circle cx="-9" cy="6" r="4" fill={dark} />
      <circle cx="-9" cy="6" r="2" fill={color} />
      <circle cx="9" cy="6" r="4" fill={dark} />
      <circle cx="9" cy="6" r="2" fill={color} />
    </g>
  );
}

function formatAmount(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? raw : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toUpperCase();
  let cls = "bg-muted text-muted-foreground";
  if (s === "BOOKED") cls = "bg-success-soft text-success";
  else if (s === "PENDING") cls = "bg-destructive/10 text-destructive";
  else if (s === "CANCELLED") cls = "bg-destructive/10 text-destructive line-through";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {s || "—"}
    </span>
  );
}

export function BusCard({
  bus,
  isPast = false,
  events = [],
  onRefresh,
}: {
  bus: Bus;
  isPast?: boolean;
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const b = bus;
  const isCancelled = (b.bookingstatus || "").trim().toUpperCase() === "CANCELLED";
  const depDate = parseDateTime(b.departuredate, b.departuretime);
  const arrDate = parseDateTime(b.arrivaldate, b.arrivaltime);
  const [progress, setProgress] = useState(() => getProgress(depDate, arrDate));

  useEffect(() => {
    if (!depDate || !arrDate) return;
    const now = Date.now();
    if (now < depDate.getTime() || now > arrDate.getTime()) return;
    const interval = setInterval(() => setProgress(getProgress(depDate, arrDate)), 30_000);
    return () => clearInterval(interval);
  }, [b.departuredate, b.departuretime, b.arrivaldate, b.arrivaltime]);

  const isInJourney = !!(depDate && arrDate && Date.now() >= depDate.getTime() && Date.now() <= arrDate.getTime());
  const hasArrived = !!(arrDate && Date.now() > arrDate.getTime());
  const busColor = isInJourney ? "#3B82F6" : hasArrived ? "#94A3B8" : "#CBD5E1";

  const W = 160, H = 52;
  const x0 = 8, xEnd = W - 8, y = H - 14;
  const busX = x0 + progress * (xEnd - x0);

  const user = getSessionUser();
  const isSystemManager = (user?.role || "").trim().toLowerCase() === "system manager";
  const canSeeSpend = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const canEditAssignedTo = ["accounts", "hr", "system manager"].includes((user?.role || "").toLowerCase());
  const [spendEditOpen, setSpendEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [uncancelOpen, setUncancelOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [statusActionError, setStatusActionError] = useState("");

  const runStatusChange = async (nextStatus: "Booked" | "Cancelled") => {
    setStatusActionLoading(true);
    setStatusActionError("");
    try {
      await updateBookingStatus({
        kind: "bus",
        sourceRow: Number(b.sourcerow),
        status: nextStatus,
        verifyValue: b.ticketnumber || "",
      });
      setCancelOpen(false);
      setUncancelOpen(false);
      onRefresh?.();
    } catch (e) {
      setStatusActionError((e as Error).message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const runRemove = async () => {
    setStatusActionLoading(true);
    setStatusActionError("");
    try {
      await removeBooking({
        kind: "bus",
        sourceRow: Number(b.sourcerow),
        verifyValue: b.ticketnumber || "",
      });
      setRemoveOpen(false);
      onRefresh?.();
    } catch (e) {
      setStatusActionError((e as Error).message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  return (
    <div
      className={`relative rounded-2xl bg-card p-4 shadow-card transition ${
        isPast ? "opacity-60 grayscale saturate-50" : ""
      } ${isCancelled ? "bg-destructive/[0.04] ring-1 ring-destructive/25" : ""}`}
    >
      {isPast && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Past
        </span>
      )}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 16c0 .88.39 1.67 1 2.22V19a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1A1.5 1.5 0 116 15.5 1.5 1.5 0 017.5 17zm9 0a1.5 1.5 0 111.5-1.5 1.5 1.5 0 01-1.5 1.5zM18 11H6V6h12v5z"/>
          </svg>
          <span>{b.busoperator || "Bus"}{b.busnumber ? ` · ${b.busnumber}` : ""}</span>
        </div>
        <StatusBadge status={b.bookingstatus} />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-2xl font-bold leading-none tracking-tight">{b.from_station || "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{b.cityfrom}</div>
          <div className="mt-2 text-sm font-medium">{formatTime(b.departuretime)}</div>
          <div className="text-[11px] text-muted-foreground">{b.departuredate}</div>
        </div>

        <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 80, maxWidth: 160 }} aria-hidden="true" overflow="visible">
            <line x1={x0} y1={y} x2={xEnd} y2={y} stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx={x0} cy={y} r="3.5" fill="#94A3B8" />
            <circle cx={xEnd} cy={y} r="3.5" fill="#94A3B8" />
            <g transform={`translate(${busX}, ${y - 2}) scale(0.55, 0.55)`}>
              <SimpleBus color={busColor} />
            </g>
            {isInJourney && (
              <text x={W / 2} y="10" textAnchor="middle" fontSize="9" fill="#3B82F6" fontWeight="600">En Route</text>
            )}
          </svg>
        </div>

        <div className="flex-1 text-right">
          <div className="text-2xl font-bold leading-none tracking-tight">{b.to_station || "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">{b.cityto}</div>
          <div className="mt-2 text-sm font-medium">{formatTime(b.arrivaltime)}</div>
          <div className="text-[11px] text-muted-foreground">{b.arrivaldate}</div>
        </div>
      </div>

      {(b.ticketnumber || b.assignedto) && (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-muted-foreground">{b.ticketnumber ? `Ticket  ${b.ticketnumber}` : "No ticket number"}</span>
            {b.assignedto && (
              <span className="text-[11px] text-muted-foreground">
                👤 {splitPassengerList(b.assignedto).map((p) => canonicalizePersonName(p)).join(", ")}
              </span>
            )}
          </div>
          {canSeeSpend && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {b.amount ? (
                  (b.currency || "INR").toUpperCase() === "INR" ? (
                    <>💰 ₹{formatAmount(b.amount)}{b.trip ? ` · ${b.trip}` : ""}</>
                  ) : b.inrequivalent ? (
                    <>💰 ₹{formatAmount(b.inrequivalent)} ({formatAmount(b.amount)} {b.currency}){b.trip ? ` · ${b.trip}` : ""}</>
                  ) : (
                    <>💰 {formatAmount(b.amount)} {b.currency} (rate not resolved){b.trip ? ` · ${b.trip}` : ""}</>
                  )
                ) : (
                  <span className="italic">No cost recorded{b.trip ? ` · ${b.trip}` : ""}</span>
                )}
              </span>
              <button
                onClick={() => setSpendEditOpen(true)}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-accent hover:bg-accent-soft"
              >
                <PenLine className="h-3 w-3" /> {b.amount ? "Edit" : "Add cost"}
              </button>
            </div>
          )}
        </div>
      )}

      {canSeeSpend && (
        <SpendEditDialog
          open={spendEditOpen}
          onClose={() => setSpendEditOpen(false)}
          onSaved={() => onRefresh?.()}
          kind="bus"
          sourceRow={Number(b.sourcerow)}
          verifyValue={b.ticketnumber || ""}
          amountFieldSlug="amount"
          amountLabel="Fare paid"
          fallbackDateDdMmYyyy={b.departuredate}
          assignedTo={b.assignedto}
          canEditAssignedTo={canEditAssignedTo}
          events={events}
          initial={{
            amount: b.amount || "",
            currency: b.currency || "INR",
            bookingDate: b.bookingdate || "",
            trip: b.trip || "",
            fxRate: b.fxrate || "",
            inrEquivalent: b.inrequivalent || "",
            paymentMethod: b.paymentmethod || "",
            amountType: b.amounttype || "total",
          }}
        />
      )}

      {(!isPast || isSystemManager) && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
          {!isPast && !isCancelled && (
            <button
              onClick={() => setCancelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            >
              <Ban className="h-3 w-3" /> Cancel bus
            </button>
          )}
          {!isPast && isCancelled && (
            <button
              onClick={() => setUncancelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
            >
              <RotateCcw className="h-3 w-3" /> Uncancel
            </button>
          )}
          {isSystemManager && (
            <button
              onClick={() => setRemoveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this bus?"
        message={`${b.from_station || "—"} → ${b.to_station || "—"} on ${b.departuredate || "this date"} will be marked as cancelled. You can uncancel it later if needed.`}
        confirmLabel="Cancel bus"
        destructive
        loading={statusActionLoading}
        error={statusActionError}
        onConfirm={() => runStatusChange("Cancelled")}
        onCancel={() => { setCancelOpen(false); setStatusActionError(""); }}
      />
      <ConfirmDialog
        open={uncancelOpen}
        title="Uncancel this bus?"
        message={`${b.from_station || "—"} → ${b.to_station || "—"} on ${b.departuredate || "this date"} will be marked as booked again.`}
        confirmLabel="Uncancel"
        loading={statusActionLoading}
        error={statusActionError}
        onConfirm={() => runStatusChange("Booked")}
        onCancel={() => { setUncancelOpen(false); setStatusActionError(""); }}
      />
      <ConfirmDialog
        open={removeOpen}
        title="Remove this bus permanently?"
        message={`This deletes ${b.from_station || "—"} → ${b.to_station || "—"} on ${b.departuredate || "this date"} from the sheet entirely. This can't be undone.`}
        confirmLabel="Remove permanently"
        destructive
        loading={statusActionLoading}
        error={statusActionError}
        onConfirm={runRemove}
        onCancel={() => { setRemoveOpen(false); setStatusActionError(""); }}
      />
    </div>
  );
}