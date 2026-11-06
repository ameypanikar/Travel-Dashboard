import { useState, useMemo } from "react";
import type { TravelEvent, Flight, Hotel, Train, Bus, Expense, Advance, Allowance, StandingTourBatch } from "@/lib/dashboard-api";
import { appendEvent, removeBooking, updateEventWithCascade, updateEventStatus } from "@/lib/dashboard-api";
import { getRelativeDateLabel } from "@/lib/date-utils";
import { CalendarCheck, MapPin, Plus, Trash2, Pencil, CheckCircle2, RotateCcw, FileDown, Receipt as ReceiptIcon, ExternalLink, RefreshCw, CalendarDays } from "lucide-react";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { FULL_ACCESS_ROLES } from "@/lib/role-filter";
import { getTripParticipants, isOwnerEntry, filterTripFinancialsByDateRange, formatIsoToDisplay, isIsoInRange, toIsoDate, isTripMatch, GENERAL_TRAVEL, shiftIsoDate, normalizeTripName } from "@/lib/expense-utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { TravelVoucherView } from "./TravelVoucherView";
import { ConsolidatedReceiptsView } from "./ConsolidatedReceiptsView";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, string> = {
  "Stall Holder": "bg-green-100 text-green-700 dark:bg-green-950/70 dark:text-green-300 dark:border dark:border-green-800/50",
  "Visitor": "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 dark:border dark:border-blue-800/50",
  "Organiser": "bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300 dark:border dark:border-orange-800/50",
  "Sponsor": "bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 dark:border dark:border-purple-800/50",
};

const EVENT_TYPES = ["Exhibition", "Conference", "Trade Show", "Meeting", "Standing Tour", "Other"];
const OUR_ROLES = ["Stall Holder", "Visitor", "Organiser", "Sponsor"];

type Props = {
  events: TravelEvent[];
  onRefresh: () => void;
  user?: SessionUser;
  flights?: Flight[];
  hotels?: Hotel[];
  trains?: Train[];
  buses?: Bus[];
  expenses?: Expense[];
  advances?: Advance[];
  allowances?: Allowance[];
  users?: { name: string; username: string; role: string }[];
  batches?: StandingTourBatch[];
  onNavigateToSpend?: (trip: string) => void;
};

const EMPTY_FORM = {
  eventname: "", startdate: "", enddate: "",
  location: "", type: "Exhibition", ourrole: "Visitor", notes: "",
};

const pad = (n: number) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function ymdToDdMmYyyy(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

export function eventHasFinancialRecords(
  eventName: string | undefined,
  data: {
    expenses: Expense[];
    flights: Flight[];
    hotels: Hotel[];
    trains: Train[];
    buses: Bus[];
    advances: Advance[];
    allowances: Allowance[];
  }
): boolean {
  if (!eventName) return false;
  const match = (trip?: string) => isTripMatch(trip || GENERAL_TRAVEL, eventName);
  return (
    data.expenses.some((e) => match(e.trip)) ||
    data.flights.some((f) => match((f as unknown as Record<string, string>).trip)) ||
    data.hotels.some((h) => match((h as unknown as Record<string, string>).trip)) ||
    data.trains.some((t) => match((t as unknown as Record<string, string>).trip)) ||
    data.buses.some((b) => match((b as unknown as Record<string, string>).trip)) ||
    data.advances.some((a) => match(a.trip)) ||
    data.allowances.some((a) => match(a.trip))
  );
}

function EventCard({
  ev,
  isPast = false,
  onRefresh,
  onEdit,
  user,
  flights = [],
  hotels = [],
  trains = [],
  buses = [],
  expenses = [],
  advances = [],
  allowances = [],
  users = [],
  onOpenVoucher,
  onOpenReceipts,
  onScopeTour,
  onNavigateToSpend,
}: {
  ev: TravelEvent;
  isPast?: boolean;
  onRefresh?: () => void;
  onEdit?: (ev: TravelEvent) => void;
  user?: SessionUser;
  flights?: Flight[];
  hotels?: Hotel[];
  trains?: Train[];
  buses?: Bus[];
  expenses?: Expense[];
  advances?: Advance[];
  allowances?: Allowance[];
  users?: { name: string; username: string; role: string }[];
  onOpenVoucher?: (trip: string, group: "staff" | "owner") => void;
  onOpenReceipts?: (trip: string) => void;
  onScopeTour?: (tourName: string, group?: "staff" | "owner", defaultMode?: "voucher" | "receipts") => void;
  onNavigateToSpend?: (trip: string) => void;
}) {
  const currentUser = user || getSessionUser();
  const canManage = FULL_ACCESS_ROLES.includes((currentUser?.role || "").trim().toLowerCase());
  const isCompleted = ev.status === "Completed";
  const isStandingTour = ev.type === "Standing Tour";
  const tourSettledThrough = isStandingTour && ev.status?.startsWith("Covered: ") ? ev.status.replace("Covered: ", "").trim() : null;

  const pendingAfterSettlementCount = useMemo(() => {
    if (!isStandingTour || !tourSettledThrough) return 0;
    return expenses.filter((e) => {
      if (!isTripMatch(e.trip, ev.eventname)) return false;
      let iso = "";
      if (e.expensedate && e.expensedate.trim()) {
        iso = e.expensedate.trim().slice(0, 10);
      } else if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
      }
      return iso > tourSettledThrough;
    }).length;
  }, [isStandingTour, tourSettledThrough, expenses, ev.eventname]);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);

  const hasFinancialRecords = useMemo(() => {
    return eventHasFinancialRecords(ev.eventname, {
      expenses, flights, hotels, trains, buses, advances, allowances
    });
  }, [ev.eventname, expenses, flights, hotels, trains, buses, advances, allowances]);

  const runRemove = async () => {
    setRemoveLoading(true);
    setRemoveError("");
    try {
      await removeBooking({
        kind: "event",
        sourceRow: Number(ev.sourcerow),
        verifyValue: ev.eventname || "",
      });
      setRemoveOpen(false);
      onRefresh?.();
    } catch (e) {
      setRemoveError((e as Error).message);
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!ev.sourcerow) return;
    const nextStatus = isCompleted ? "Booked" : "Completed";
    const confirmPrompt = isCompleted
      ? `Re-open "${ev.eventname}"? It will be marked as open again.`
      : `Mark "${ev.eventname}" as Covered / Completed?`;
    if (!window.confirm(confirmPrompt)) return;
    setStatusLoading(true);
    try {
      await updateEventStatus({ sourceRow: ev.sourcerow, status: nextStatus });
      toast.success(isCompleted ? "Event re-opened!" : "Event marked as covered!");
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStatusLoading(false);
    }
  };

  const tripReceipts = useMemo(() => {
    return expenses
      .filter((e) => isTripMatch(e.trip, ev.eventname) && e.receipturl)
      .map((e) => ({
        url: e.receipturl,
        mimetype: e.receiptmimetype || "",
        label: `${e.username} · ${e.category}${e.description ? ` · ${e.description}` : ""} · ${e.amount} ${e.currency || "INR"}`,
      }));
  }, [expenses, ev.eventname]);

  const participants = useMemo(() => {
    return getTripParticipants(
      ev.eventname,
      {
        flights: flights as unknown as Record<string, string>[],
        hotels: hotels as unknown as Record<string, string>[],
        trains: trains as unknown as Record<string, string>[],
        buses: buses as unknown as Record<string, string>[],
        expenses,
        advances,
        allowances,
      },
      users,
    );
  }, [ev.eventname, flights, hotels, trains, buses, expenses, advances, allowances, users]);

  const staffParticipants = useMemo(
    () => participants.filter((p) => !isOwnerEntry(p.username, p.name, users)),
    [participants, users]
  );
  const ownerParticipants = useMemo(
    () => participants.filter((p) => isOwnerEntry(p.username, p.name, users)),
    [participants, users]
  );
  const hasStaff = staffParticipants.length > 0;
  const hasOwner = ownerParticipants.length > 0;

  // Visual card container styles
  let containerStyle = "relative rounded-2xl bg-card p-4 shadow-card transition";
  if (!canManage) {
    if (isPast) containerStyle += " opacity-60 grayscale saturate-50";
  } else {
    if (isStandingTour) {
      containerStyle = "relative rounded-2xl bg-card border border-sky-400/40 dark:border-sky-800/60 p-4 shadow-card transition hover:shadow-md";
    } else if (isCompleted) {
      // Light green covered styling
      containerStyle = "relative rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/30 p-4 shadow-card transition hover:shadow-md";
    } else if (isPast && hasFinancialRecords) {
      // Awaiting settlement: distinct amber border, full opacity
      containerStyle = "relative rounded-2xl bg-card border border-amber-500/40 p-4 shadow-card transition hover:shadow-md";
    } else if (isPast && !hasFinancialRecords) {
      // No expense recorded: muted neutral styling, lower visual weight
      containerStyle = "relative rounded-2xl bg-card/75 border border-border/80 p-4 shadow-card transition opacity-75 hover:opacity-100";
    }
  }

  return (
    <div className={containerStyle}>
      {/* Header with Title and Badges cleanly laid out via Flexbox (no absolute overlapping) */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent min-w-0 pr-2">
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span className="font-bold">{ev.eventname}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
          {ev.ourrole && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[ev.ourrole] ?? "bg-muted text-muted-foreground"}`}>
              {ev.ourrole}
            </span>
          )}

          {!canManage && isPast && (
            <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Past
            </span>
          )}

          {isStandingTour && (
            <>
              <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <RefreshCw className="h-3 w-3 text-sky-600 dark:text-sky-400" /> Ongoing Standing Tour
              </span>
              {tourSettledThrough && (
                <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs" title={`Audited and covered through ${formatIsoToDisplay(tourSettledThrough)}`}>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Covered through {formatIsoToDisplay(tourSettledThrough)}
                </span>
              )}
              {pendingAfterSettlementCount > 0 && (
                <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs">
                  {pendingAfterSettlementCount} new pending
                </span>
              )}
            </>
          )}

          {!isStandingTour && canManage && isCompleted && (
            <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Covered
            </span>
          )}

          {!isStandingTour && canManage && isPast && !isCompleted && hasFinancialRecords && (
            <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs">
              Awaiting Settlement
            </span>
          )}

          {!isStandingTour && canManage && isPast && !isCompleted && !hasFinancialRecords && (
            <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-xs">
              No Expense Recorded
            </span>
          )}
        </div>
      </div>

      {ev.location && (
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{ev.location}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-xs">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Start</div>
          <div className="mt-0.5 font-semibold">{ev.startdate || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">End</div>
          <div className="mt-0.5 font-semibold">{ev.enddate || "—"}</div>
        </div>
      </div>

      {(ev.type || ev.notes) && (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {ev.type && <div>📋 {ev.type}</div>}
          {ev.notes && <div>📝 {ev.notes}</div>}
        </div>
      )}

      {/* Management controls — only visible to top roles (System Manager, Owner, HR, Accounts) */}
      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2.5">
          {/* Status completion toggle: ONLY shown for discrete non-standing-tour events that are past or completed */}
          {!isStandingTour && (isPast || isCompleted) && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={statusLoading}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                isCompleted
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
              }`}
            >
              {isCompleted ? (
                <>
                  <RotateCcw className="h-3 w-3" /> Re-open
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Mark Covered
                </>
              )}
            </button>
          )}

          {/* Travel Voucher button */}
          {hasStaff && hasOwner ? (
            <div className="inline-flex rounded-full bg-accent/10 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => {
                  if (isStandingTour) {
                    onScopeTour?.(ev.eventname, "staff", "voucher");
                  } else {
                    onOpenVoucher?.(ev.eventname, "staff");
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-accent hover:bg-accent/20"
                title={isStandingTour ? "Staff Voucher (Scope visit dates)" : "Staff Travel Voucher"}
              >
                <FileDown className="h-3 w-3" /> Staff Voucher
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isStandingTour) {
                    onScopeTour?.(ev.eventname, "owner", "voucher");
                  } else {
                    onOpenVoucher?.(ev.eventname, "owner");
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-accent hover:bg-accent/20"
                title={isStandingTour ? "Owner (Rajesh) Voucher (Scope visit dates)" : "Owner (Rajesh) Travel Voucher"}
              >
                <FileDown className="h-3 w-3" /> Owner Voucher
              </button>
            </div>
          ) : participants.length > 0 || hasFinancialRecords ? (
            <button
              type="button"
              onClick={() => {
                const grp = hasOwner ? "owner" : "staff";
                if (isStandingTour) {
                  onScopeTour?.(ev.eventname, grp, "voucher");
                } else {
                  onOpenVoucher?.(ev.eventname, grp);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20"
              title={isStandingTour ? "Travel Voucher (Scope visit dates)" : "Open Travel Voucher"}
            >
              <FileDown className="h-3 w-3" /> Travel Voucher
            </button>
          ) : null}

          {/* Receipts button */}
          {tripReceipts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (isStandingTour) {
                  onScopeTour?.(ev.eventname, undefined, "receipts");
                } else {
                  onOpenReceipts?.(ev.eventname);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20"
              title={isStandingTour ? `View receipts (Scope visit dates)` : `View ${tripReceipts.length} receipts`}
            >
              <ReceiptIcon className="h-3 w-3" /> Receipts ({tripReceipts.length})
            </button>
          )}

          {/* Open in Spend button for standing tours */}
          {isStandingTour && onNavigateToSpend && (
            <button
              type="button"
              onClick={() => onNavigateToSpend(ev.eventname)}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20"
              title="Open this tour in the Spend tab"
            >
              <ExternalLink className="h-3 w-3" /> Open in Spend
            </button>
          )}

          {/* Edit & Remove buttons */}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit?.(ev)}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent/10 hover:text-accent"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setRemoveOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeOpen}
        title="Remove this event permanently?"
        message={`This deletes "${ev.eventname || "this event"}" from the sheet entirely. This can't be undone.`}
        confirmLabel="Remove permanently"
        destructive
        loading={removeLoading}
        error={removeError}
        onConfirm={runRemove}
        onCancel={() => { setRemoveOpen(false); setRemoveError(""); }}
      />
    </div>
  );
}

export function EventsList({
  events,
  onRefresh,
  user,
  flights = [],
  hotels = [],
  trains = [],
  buses = [],
  expenses = [],
  advances = [],
  allowances = [],
  users = [],
  batches = [],
  onNavigateToSpend,
}: Props) {
  const currentUser = user || getSessionUser();
  const canManage = FULL_ACCESS_ROLES.includes((currentUser?.role || "").trim().toLowerCase());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOldName, setEditingOldName] = useState("");

  // Modal states for voucher & receipts
  const [activeVoucherTrip, setActiveVoucherTrip] = useState<string | null>(null);
  const [activeVoucherGroup, setActiveVoucherGroup] = useState<"staff" | "owner">("staff");
  const [activeVoucherDateRange, setActiveVoucherDateRange] = useState<{ from?: string; to?: string } | null>(null);
  const [activeReceiptsTrip, setActiveReceiptsTrip] = useState<string | null>(null);
  const [activeReceiptsDateRange, setActiveReceiptsDateRange] = useState<{ from?: string; to?: string } | null>(null);
  const [pastFilter, setPastFilter] = useState<"all" | "awaiting" | "covered" | "no_expense">("all");

  // Standing Tour Visit Scope dialog state
  const [scopeTour, setScopeTour] = useState<{
    tourName: string;
    group?: "staff" | "owner";
    mode: "voucher" | "receipts";
  } | null>(null);
  const [scopeFrom, setScopeFrom] = useState("");
  const [scopeTo, setScopeTo] = useState("");

  const financialData = useMemo(() => ({
    expenses, flights, hotels, trains, buses, advances, allowances
  }), [expenses, flights, hotels, trains, buses, advances, allowances]);

  // Split into upcoming (enddate today-or-future) and past (enddate before today)
  const today = todayYMD();
  const upcoming: TravelEvent[] = [];
  const past: TravelEvent[] = [];
  for (const ev of events) {
    const end = ev.enddate || ev.startdate;
    if (end && end < today) past.push(ev);
    else upcoming.push(ev);
  }

  // Upcoming sorted ascending by date
  upcoming.sort((a, b) => {
    if (a.type === "Standing Tour" && b.type !== "Standing Tour") return 1;
    if (a.type !== "Standing Tour" && b.type === "Standing Tour") return -1;
    return (a.startdate || "").localeCompare(b.startdate || "");
  });

  // Past sorted descending by startdate (most recent first)
  past.sort((a, b) => {
    if (a.type === "Standing Tour" && b.type !== "Standing Tour") return 1;
    if (a.type !== "Standing Tour" && b.type === "Standing Tour") return -1;
    return (b.startdate || "").localeCompare(a.startdate || "");
  });

  const coveredCount = events.filter((e) => e.status === "Completed").length;
  const pastCoveredCount = past.filter((e) => e.status === "Completed").length;
  const pastAwaitingCount = past.filter(
    (e) => e.status !== "Completed" && e.type !== "Standing Tour" && eventHasFinancialRecords(e.eventname, financialData)
  ).length;
  const pastNoExpenseCount = past.filter(
    (e) => e.status !== "Completed" && e.type !== "Standing Tour" && !eventHasFinancialRecords(e.eventname, financialData)
  ).length;

  const filteredPast = past.filter((ev) => {
    if (ev.type === "Standing Tour") return pastFilter === "all";
    if (pastFilter === "covered") return ev.status === "Completed";
    if (pastFilter === "awaiting") {
      return ev.status !== "Completed" && eventHasFinancialRecords(ev.eventname, financialData);
    }
    if (pastFilter === "no_expense") {
      return ev.status !== "Completed" && !eventHasFinancialRecords(ev.eventname, financialData);
    }
    return true;
  });

  // Financial data for active voucher, scoped by activeVoucherDateRange if set
  const activeVoucherData = useMemo(() => {
    if (!activeVoucherTrip) return null;
    return filterTripFinancialsByDateRange(activeVoucherDateRange, {
      flights,
      hotels,
      trains,
      buses,
      expenses,
      advances,
      allowances,
    });
  }, [activeVoucherTrip, activeVoucherDateRange, flights, hotels, trains, buses, expenses, advances, allowances]);

  const voucherParticipants = useMemo(() => {
    if (!activeVoucherTrip || !activeVoucherData) return [];
    return getTripParticipants(
      activeVoucherTrip,
      {
        flights: activeVoucherData.flights as unknown as Record<string, string>[],
        hotels: activeVoucherData.hotels as unknown as Record<string, string>[],
        trains: activeVoucherData.trains as unknown as Record<string, string>[],
        buses: activeVoucherData.buses as unknown as Record<string, string>[],
        expenses: activeVoucherData.expenses,
        advances: activeVoucherData.advances,
        allowances: activeVoucherData.allowances,
      },
      users,
    );
  }, [activeVoucherTrip, activeVoucherData, users]);

  // Receipts for active receipts viewer, scoped by activeReceiptsDateRange if set
  const activeTripReceipts = useMemo(() => {
    if (!activeReceiptsTrip) return [];
    const inRange = (iso: string) => isIsoInRange(iso, activeReceiptsDateRange?.from, activeReceiptsDateRange?.to);
    return expenses
      .filter((e) => {
        if (!isTripMatch(e.trip, activeReceiptsTrip)) return false;
        if (!e.receipturl) return false;
        let iso = "";
        if (e.expensedate && e.expensedate.trim()) {
          iso = e.expensedate.trim().slice(0, 10);
        } else if (e.timestamp) {
          const d = new Date(e.timestamp);
          if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
        }
        return inRange(iso);
      })
      .map((e) => ({
        url: e.receipturl,
        mimetype: e.receiptmimetype || "",
        label: `${e.username} · ${e.category}${e.description ? ` · ${e.description}` : ""} · ${e.amount} ${e.currency || "INR"}`,
      }));
  }, [activeReceiptsTrip, activeReceiptsDateRange, expenses]);

  // Participants for currently opened scope dialog
  const scopeTourParticipants = useMemo(() => {
    if (!scopeTour) return [];
    return getTripParticipants(
      scopeTour.tourName,
      {
        flights: flights as unknown as Record<string, string>[],
        hotels: hotels as unknown as Record<string, string>[],
        trains: trains as unknown as Record<string, string>[],
        buses: buses as unknown as Record<string, string>[],
        expenses,
        advances,
        allowances,
      },
      users,
    );
  }, [scopeTour, flights, hotels, trains, buses, expenses, advances, allowances, users]);

  const scopeTourHasStaff = useMemo(
    () => scopeTourParticipants.some((p) => !isOwnerEntry(p.username, p.name, users)),
    [scopeTourParticipants, users]
  );
  const scopeTourHasOwner = useMemo(
    () => scopeTourParticipants.some((p) => isOwnerEntry(p.username, p.name, users)),
    [scopeTourParticipants, users]
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      if (editingId) {
        await updateEventWithCascade(editingId, editingOldName, form);
      } else {
        await appendEvent(form);
      }
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setEditingId(null);
      setEditingOldName("");
      onRefresh();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditClick(ev: TravelEvent) {
    if (ev.sourcerow) {
      setEditingId(ev.sourcerow);
      setEditingOldName(ev.eventname);
      setForm({
        eventname: ev.eventname || "",
        startdate: ev.startdate || "",
        enddate: ev.enddate || "",
        location: ev.location || "",
        type: ev.type || "Exhibition",
        ourrole: ev.ourrole || "Visitor",
        notes: ev.notes || "",
      });
      setShowForm(true);
    }
  }

  return (
    <div>
      {/* Summary banner */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card text-xs font-semibold">
        <span className="text-muted-foreground">{upcoming.length} upcoming</span>
        {upcoming.filter((e) => e.ourrole === "Stall Holder").length > 0 && (
          <span className="text-green-700 dark:text-green-400">
            · {upcoming.filter((e) => e.ourrole === "Stall Holder").length} Stall Holder
          </span>
        )}
        {upcoming.filter((e) => e.ourrole === "Visitor").length > 0 && (
          <span className="text-blue-700 dark:text-blue-400">
            · {upcoming.filter((e) => e.ourrole === "Visitor").length} Visitor
          </span>
        )}
        {upcoming.filter((e) => e.ourrole === "Organiser").length > 0 && (
          <span className="text-orange-700 dark:text-orange-400">
            · {upcoming.filter((e) => e.ourrole === "Organiser").length} Organiser
          </span>
        )}
        {canManage && (
          <>
            {pastAwaitingCount > 0 && (
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                · {pastAwaitingCount} awaiting settlement
              </span>
            )}
            <span className="text-emerald-700 dark:text-emerald-400">
              · {pastCoveredCount} covered
            </span>
            {pastNoExpenseCount > 0 && (
              <span className="text-muted-foreground">
                · {pastNoExpenseCount} no expense
              </span>
            )}
          </>
        )}
      </div>

      {/* Add event button */}
      <button
        onClick={() => {
          setEditingId(null);
          setEditingOldName("");
          setForm({ ...EMPTY_FORM });
          setShowForm(true);
        }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Add Event
      </button>

      {/* Events list */}
      {events.length === 0 && !showForm && (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
          No events yet. Add one above.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming ({upcoming.length})
          </div>
          <div className="flex flex-col gap-3">
            {upcoming.map((ev, i) => (
              <div key={`upcoming-${ev.eventname}-${ev.startdate}-${i}`}>
                <div className="mb-1 px-1 text-xs font-semibold text-accent">
                  {getRelativeDateLabel(ymdToDdMmYyyy(ev.startdate))}
                </div>
                <EventCard
                  ev={ev}
                  onRefresh={onRefresh}
                  onEdit={handleEditClick}
                  user={currentUser || undefined}
                  flights={flights}
                  hotels={hotels}
                  trains={trains}
                  buses={buses}
                  expenses={expenses}
                  advances={advances}
                  allowances={allowances}
                  users={users}
                  onOpenVoucher={(trip, group) => {
                    setActiveVoucherTrip(trip);
                    setActiveVoucherGroup(group);
                    setActiveVoucherDateRange(null);
                  }}
                  onOpenReceipts={(trip) => {
                    setActiveReceiptsTrip(trip);
                    setActiveReceiptsDateRange(null);
                  }}
                  onScopeTour={(tourName, group, mode) => {
                    const tourEvent = events.find((e) => isTripMatch(e.eventname, tourName));
                    const settledThrough = tourEvent?.status?.startsWith("Covered: ")
                      ? tourEvent.status.replace("Covered: ", "").trim()
                      : null;
                    setScopeTour({ tourName, group, mode: mode || "voucher" });
                    setScopeFrom(settledThrough ? shiftIsoDate(settledThrough, 1) : "");
                    setScopeTo("");
                  }}
                  onNavigateToSpend={onNavigateToSpend}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Past Events ({past.length})
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPastFilter("all")}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    pastFilter === "all"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({past.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPastFilter("awaiting")}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    pastFilter === "awaiting"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Awaiting Settlement ({pastAwaitingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPastFilter("covered")}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    pastFilter === "covered"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Covered ({pastCoveredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPastFilter("no_expense")}
                  className={`rounded-full px-2.5 py-0.5 font-semibold transition ${
                    pastFilter === "no_expense"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  No Expenses ({pastNoExpenseCount})
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {filteredPast.map((ev, i) => (
              <EventCard
                key={`past-${ev.eventname}-${ev.startdate}-${i}`}
                ev={ev}
                isPast
                onRefresh={onRefresh}
                onEdit={handleEditClick}
                user={currentUser || undefined}
                flights={flights}
                hotels={hotels}
                trains={trains}
                buses={buses}
                expenses={expenses}
                advances={advances}
                allowances={allowances}
                users={users}
                onOpenVoucher={(trip, group) => {
                  setActiveVoucherTrip(trip);
                  setActiveVoucherGroup(group);
                  setActiveVoucherDateRange(null);
                }}
                onOpenReceipts={(trip) => {
                  setActiveReceiptsTrip(trip);
                  setActiveReceiptsDateRange(null);
                }}
                onScopeTour={(tourName, group, mode) => {
                  const tourEvent = events.find((e) => isTripMatch(e.eventname, tourName));
                  const settledThrough = tourEvent?.status?.startsWith("Covered: ")
                    ? tourEvent.status.replace("Covered: ", "").trim()
                    : null;
                  setScopeTour({ tourName, group, mode: mode || "voucher" });
                  setScopeFrom(settledThrough ? shiftIsoDate(settledThrough, 1) : "");
                  setScopeTo("");
                }}
                onNavigateToSpend={onNavigateToSpend}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit event modal with Radix Dialog (portals to body, perfectly centered in viewport) */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingId(null);
            setEditingOldName("");
          }
        }}
      >
        <DialogContent className="max-w-md p-6">
          <div className="mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                {editingId ? <Pencil className="h-4 w-4" /> : <CalendarCheck className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {editingId ? "Edit Event" : "Add Event"}
                </h2>
                {editingId && editingOldName ? (
                  <p className="text-xs text-muted-foreground">
                    Modifying details for <span className="font-semibold text-accent">{editingOldName}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Create a new exhibition, conference, or tour
                  </p>
                )}
              </div>
            </div>
          </div>
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              required
              type="text"
              placeholder="Event Name *"
              value={form.eventname}
              onChange={(e) => setForm({ ...form, eventname: e.target.value })}
              className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Start Date *</label>
                <input
                  required
                  type="date"
                  value={form.startdate}
                  onChange={(e) => setForm({ ...form, startdate: e.target.value })}
                  className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={form.enddate}
                  onChange={(e) => setForm({ ...form, enddate: e.target.value })}
                  className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">Our Role</label>
                <select
                  value={form.ourrole}
                  onChange={(e) => setForm({ ...form, ourrole: e.target.value })}
                  className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                >
                  {OUR_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <textarea
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setEditingOldName("");
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
              >
                {saving ? "Saving…" : (editingId ? "Save Changes" : "Add Event")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Standing Tour Visit Scope Dialog */}
      <Dialog
        open={Boolean(scopeTour)}
        onOpenChange={(open) => {
          if (!open) {
            setScopeTour(null);
            setScopeFrom("");
            setScopeTo("");
          }
        }}
      >
        <DialogContent className="max-w-md p-6">
          {scopeTour && (() => {
            const inWindow = (iso: string) => isIsoInRange(iso, scopeFrom, scopeTo);
            const tourExpenses = expenses.filter(
              (e) => isTripMatch(e.trip, scopeTour.tourName)
            );
            const matchingExpenses = tourExpenses.filter((e) => {
              let iso = "";
              if (e.expensedate && e.expensedate.trim()) {
                iso = e.expensedate.trim().slice(0, 10);
              } else if (e.timestamp) {
                const d = new Date(e.timestamp);
                if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
              }
              return inWindow(iso);
            });
            const matchingReceiptsCount = matchingExpenses.filter((e) => Boolean(e.receipturl)).length;

            return (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      <RefreshCw className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-foreground">{scopeTour.tourName}</h2>
                      <p className="text-xs text-sky-600 dark:text-sky-400 font-medium">Ongoing Standing Tour</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Standing tours run throughout the year. Pick a specific visit date range to generate a focused voucher or receipts for Accounts settlement, or generate for the entire year.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-slate-50 dark:bg-muted/40 p-3 space-y-2.5">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Visit Date Range</span>
                    {(scopeFrom || scopeTo) && (
                      <button
                        type="button"
                        onClick={() => { setScopeFrom(""); setScopeTo(""); }}
                        className="text-[11px] text-accent hover:underline"
                      >
                        Clear (Full Year)
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">From Date</label>
                      <input
                        type="date"
                        value={scopeFrom}
                        onChange={(e) => setScopeFrom(e.target.value)}
                        className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-muted-foreground">To Date</label>
                      <input
                        type="date"
                        value={scopeTo}
                        onChange={(e) => setScopeTo(e.target.value)}
                        className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    </div>
                  </div>

                  {/* Saved Batches for this tour */}
                  {(() => {
                    const tourBatches = batches.filter((b) => isTripMatch(b.trip, scopeTour.tourName));
                    if (tourBatches.length === 0) return null;
                    return (
                      <div className="rounded-lg bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 p-2 space-y-1.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                          <span>Saved Visit Batches ({tourBatches.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tourBatches.map((b) => {
                            const isSelected = scopeFrom === b.fromDate && scopeTo === b.toDate;
                            const isCompleted = b.status === "completed";
                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => {
                                  setScopeFrom(b.fromDate);
                                  setScopeTo(b.toDate);
                                }}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition ${
                                  isSelected
                                    ? "bg-accent text-accent-foreground font-bold shadow-xs"
                                    : "bg-card border border-border text-foreground hover:bg-accent-soft"
                                }`}
                                title={`Click to select ${b.title} (${formatIsoToDisplay(b.fromDate)} - ${formatIsoToDisplay(b.toDate)})`}
                              >
                                <span>{b.title}</span>
                                <span className="text-[9px] text-muted-foreground">({formatIsoToDisplay(b.fromDate)}–{formatIsoToDisplay(b.toDate)})</span>
                                {isCompleted && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick shortcuts */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground font-medium mr-1">Quick:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, "0");
                        setScopeFrom(`${y}-${m}-01`);
                        setScopeTo(now.toISOString().slice(0, 10));
                      }}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground hover:bg-accent-soft"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const past30 = new Date();
                        past30.setDate(past30.getDate() - 30);
                        setScopeFrom(past30.toISOString().slice(0, 10));
                        setScopeTo(now.toISOString().slice(0, 10));
                      }}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground hover:bg-accent-soft"
                    >
                      Past 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => { setScopeFrom(""); setScopeTo(""); }}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                        !scopeFrom && !scopeTo
                          ? "border-accent bg-accent text-accent-foreground font-semibold"
                          : "border-border bg-card text-foreground hover:bg-accent-soft"
                      }`}
                    >
                      Full Year (All)
                    </button>
                  </div>

                  <div className="rounded-lg bg-card border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>Matching Records:</span>
                    <span className="font-semibold text-foreground">
                      {matchingExpenses.length} expense(s) · {matchingReceiptsCount} receipt(s)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Generate Documents
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {scopeTourHasStaff && scopeTourHasOwner ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVoucherTrip(scopeTour.tourName);
                            setActiveVoucherGroup("staff");
                            setActiveVoucherDateRange(scopeFrom || scopeTo ? { from: scopeFrom, to: scopeTo } : null);
                            setScopeTour(null);
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90"
                        >
                          <FileDown className="h-3.5 w-3.5" /> Staff Voucher
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveVoucherTrip(scopeTour.tourName);
                            setActiveVoucherGroup("owner");
                            setActiveVoucherDateRange(scopeFrom || scopeTo ? { from: scopeFrom, to: scopeTo } : null);
                            setScopeTour(null);
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90"
                        >
                          <FileDown className="h-3.5 w-3.5" /> Owner Voucher
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveVoucherTrip(scopeTour.tourName);
                          setActiveVoucherGroup(scopeTourHasOwner ? "owner" : "staff");
                          setActiveVoucherDateRange(scopeFrom || scopeTo ? { from: scopeFrom, to: scopeTo } : null);
                          setScopeTour(null);
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:opacity-90"
                      >
                        <FileDown className="h-3.5 w-3.5" /> Open Travel Voucher
                      </button>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReceiptsTrip(scopeTour.tourName);
                          setActiveReceiptsDateRange(scopeFrom || scopeTo ? { from: scopeFrom, to: scopeTo } : null);
                          setScopeTour(null);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent-soft"
                      >
                        <ReceiptIcon className="h-3.5 w-3.5" /> View Receipts ({matchingReceiptsCount})
                      </button>

                      {onNavigateToSpend && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToSpend(scopeTour.tourName);
                            setScopeTour(null);
                          }}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-sky-400/50 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                          title="Open this tour in the Spend tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open in Spend
                        </button>
                      )}
                    </div>

                    {canManage && (() => {
                      const tourEvent = events.find((e) => isTripMatch(e.eventname, scopeTour.tourName));
                      const currentSettledThrough = tourEvent?.status?.startsWith("Covered: ")
                        ? tourEvent.status.replace("Covered: ", "").trim()
                        : null;

                      const handleMarkCoveredThrough = async () => {
                        if (!tourEvent?.sourcerow || !scopeTo) return;
                        if (!window.confirm(`Mark "${scopeTour.tourName}" as covered through ${formatIsoToDisplay(scopeTo)}?`)) return;
                        try {
                          await updateEventStatus({ sourceRow: tourEvent.sourcerow, status: `Covered: ${scopeTo}` });
                          toast.success(`Marked covered through ${formatIsoToDisplay(scopeTo)}!`);
                          onRefresh?.();
                          setScopeTour(null);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      };

                      const handleClearSettlement = async () => {
                        if (!tourEvent?.sourcerow) return;
                        if (!window.confirm(`Reset settlement milestone for "${scopeTour.tourName}"?`)) return;
                        try {
                          await updateEventStatus({ sourceRow: tourEvent.sourcerow, status: "Booked" });
                          toast.success("Settlement milestone reset.");
                          onRefresh?.();
                          setScopeTour(null);
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      };

                      return (
                        <div className="mt-3 pt-3 border-t border-border/70 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            <span>Audit & Settlement</span>
                            {currentSettledThrough && (
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold normal-case">
                                Settled through {formatIsoToDisplay(currentSettledThrough)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {scopeTo && (
                              <button
                                type="button"
                                onClick={handleMarkCoveredThrough}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-semibold hover:bg-emerald-700 transition"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Mark Covered Through {formatIsoToDisplay(scopeTo)}
                              </button>
                            )}

                            {currentSettledThrough && (
                              <button
                                type="button"
                                onClick={handleClearSettlement}
                                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition"
                                title="Reset settlement milestone"
                              >
                                Reset Milestone
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Travel Voucher Modal */}
      {activeVoucherTrip && activeVoucherData && (() => {
        const ownerList = voucherParticipants.filter((p) => isOwnerEntry(p.username, p.name, users));
        const staffList = voucherParticipants.filter((p) => !isOwnerEntry(p.username, p.name, users));
        let selectedParticipants = activeVoucherGroup === "owner" ? ownerList : staffList;
        if (selectedParticipants.length === 0) {
          selectedParticipants = ownerList.length > 0 ? ownerList : staffList;
        }
        if (selectedParticipants.length === 0) {
          const names = new Set<string>();
          activeVoucherData.expenses
            .filter((e) => isTripMatch(e.trip, activeVoucherTrip))
            .forEach((e) => {
              const u = (e.username || e.name || "").trim();
              if (u) names.add(u);
            });
          selectedParticipants = Array.from(names).map((u) => ({ username: u, name: u }));
        }

        const matchingEvent =
          events.find((e) => isTripMatch(e.eventname, activeVoucherTrip)) ||
          events.find((e) => normalizeTripName(e.eventname) === normalizeTripName(activeVoucherTrip)) ||
          null;

        let depDate = activeVoucherDateRange?.from ? formatIsoToDisplay(activeVoucherDateRange.from) : "";
        let arrDate = activeVoucherDateRange?.to ? formatIsoToDisplay(activeVoucherDateRange.to) : "";

        if (!depDate && matchingEvent?.startdate) {
          depDate = formatIsoToDisplay(toIsoDate(matchingEvent.startdate)) || matchingEvent.startdate;
        }
        if (!arrDate && (matchingEvent?.enddate || matchingEvent?.startdate)) {
          const eDate = matchingEvent.enddate || matchingEvent.startdate;
          arrDate = formatIsoToDisplay(toIsoDate(eDate)) || eDate;
        }

        if ((!depDate || !arrDate) && activeVoucherData) {
          const dates: string[] = [];
          activeVoucherData.flights.forEach((f) => {
            const d = toIsoDate((f as any).departuredate || (f as any).departureDate);
            if (d) dates.push(d);
          });
          activeVoucherData.trains.forEach((t) => {
            const d = toIsoDate((t as any).departuredate || (t as any).date);
            if (d) dates.push(d);
          });
          activeVoucherData.buses.forEach((b) => {
            const d = toIsoDate((b as any).departuredate || (b as any).date);
            if (d) dates.push(d);
          });
          activeVoucherData.hotels.forEach((h) => {
            const ci = toIsoDate((h as any).checkindate || (h as any).checkInDate);
            const co = toIsoDate((h as any).checkoutdate || (h as any).checkOutDate);
            if (ci) dates.push(ci);
            if (co) dates.push(co);
          });
          activeVoucherData.expenses.forEach((e) => {
            let iso = "";
            if (e.expensedate && e.expensedate.trim()) {
              iso = toIsoDate(e.expensedate.trim()) || e.expensedate.trim().slice(0, 10);
            } else if (e.timestamp) {
              const d = new Date(e.timestamp);
              if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
            }
            if (iso) dates.push(iso);
          });
          if (dates.length > 0) {
            dates.sort();
            if (!depDate) depDate = formatIsoToDisplay(dates[0]);
            if (!arrDate) arrDate = formatIsoToDisplay(dates[dates.length - 1]);
          }
        }

        return (
          <TravelVoucherView
            trip={activeVoucherTrip}
            participants={selectedParticipants}
            flights={activeVoucherData.flights}
            hotels={activeVoucherData.hotels}
            trains={activeVoucherData.trains}
            buses={activeVoucherData.buses}
            expenses={activeVoucherData.expenses}
            advances={activeVoucherData.advances}
            allowances={activeVoucherData.allowances}
            defaultDepartureDate={depDate}
            defaultArrivalDate={arrDate || depDate}
            onClose={() => {
              setActiveVoucherTrip(null);
              setActiveVoucherDateRange(null);
            }}
          />
        );
      })()}

      {/* Consolidated Receipts Modal */}
      {activeReceiptsTrip && (
        <ConsolidatedReceiptsView
          trip={activeReceiptsTrip}
          receipts={activeTripReceipts}
          dateRangeSubtitle={
            activeReceiptsDateRange
              ? `${activeReceiptsDateRange.from ? formatIsoToDisplay(activeReceiptsDateRange.from) : "Start"} – ${activeReceiptsDateRange.to ? formatIsoToDisplay(activeReceiptsDateRange.to) : "Present"}`
              : undefined
          }
          onClose={() => {
            setActiveReceiptsTrip(null);
            setActiveReceiptsDateRange(null);
          }}
        />
      )}
    </div>
  );
}