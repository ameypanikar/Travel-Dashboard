import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Receipt as ReceiptIcon, FileDown, CheckCircle2, Trash2 } from "lucide-react";
import type { Flight, Hotel, Train, Bus, TravelEvent, Expense, Advance, Allowance } from "@/lib/dashboard-api";
import { addAdvance, addAllowance, removeAllowance, updateEventStatus } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { formatInr, parseAmount, GENERAL_TRAVEL, getTripParticipants, sumBookingInrMulti, sumExpensesByCategoryMulti, sumExpensesByPaymentMethodMulti, sumAdvancesMulti, sortTripOptions, isActiveTrip } from "@/lib/expense-utils";
import { ReceiptViewerDialog } from "./ReceiptViewerDialog";
import { ConsolidatedReceiptsView } from "./ConsolidatedReceiptsView";
import { TravelVoucherView } from "./TravelVoucherView";
import { toast } from "sonner";
import { isPersonMatch } from "@/lib/role-filter";

type UserEntry = { name: string; username: string; role: string };

// Name/role match used to split the owner out of the combined trip voucher.
// Prefers role === "Owner" on the user record; falls back to a name match
// in case role tagging is inconsistent for some users.
const OWNER_USERNAME = "rajesh k";
function isOwnerEntry(username: string, name: string | undefined, users: UserEntry[]) {
  if (username.trim().toLowerCase() === OWNER_USERNAME) return true;
  const n = (name || "").trim().toLowerCase();
  return n === "rajesh kulkarni" || n === "rajesh k";
}

export function TripExpensesPanel({
  flights,
  hotels,
  trains,
  buses,
  events,
  expenses,
  advances,
  allowances,
  users,
  user,
  onRefresh,
}: {
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  events: TravelEvent[];
  expenses: Expense[];
  advances: Advance[];
  allowances: Allowance[];
  users: UserEntry[];
  user: SessionUser;
  onRefresh: () => void;
}) {
  const [selectedTrip, setSelectedTrip] = useState("");

  const tripOptions = useMemo(
    () =>
      sortTripOptions(
        Array.from(
          new Set([
            ...events.filter(e => isActiveTrip(e)).map((e) => (e.eventname || "").trim()).filter(Boolean),
            ...expenses.map((e) => (e.trip || GENERAL_TRAVEL).trim()),
            ...advances.map((a) => (a.trip || GENERAL_TRAVEL).trim()),
            GENERAL_TRAVEL,
            ...(selectedTrip ? [selectedTrip] : []),
          ]),
        ),
        events
      ),
    [events, expenses, advances, selectedTrip],
  );
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [showConsolidated, setShowConsolidated] = useState(false);
  // Which voucher is currently open: the combined staff voucher, the
  // separate owner (Rajesh) voucher, or none.
  const [voucherGroup, setVoucherGroup] = useState<"staff" | "owner" | null>(null);
  // Voucher-only date filter — scopes which bookings/expenses go into the
  // Travel Voucher for a specific visit (e.g. the second BEL trip in a year).
  // Has zero effect on the participant list, expense totals, or auto-trip-suggester.
  const [voucherDateFrom, setVoucherDateFrom] = useState("");
  const [voucherDateTo, setVoucherDateTo] = useState("");

  // Standalone advance logger — independent of whether the target person has
  // any expense on record yet; can pick anyone from the full user list.
  const [advancePerson, setAdvancePerson] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("Cash");
  const [savingAdvance, setSavingAdvance] = useState(false);

  const [allowancePerson, setAllowancePerson] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("");
  const [allowanceDate, setAllowanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingAllowance, setSavingAllowance] = useState(false);
  const [allowanceMethod, setAllowanceMethod] = useState("Cash");

  const isStandingTour = useMemo(() => {
    return events.some(
      (e) => (e.eventname || "").trim().toLowerCase() === selectedTrip.trim().toLowerCase() && e.type === "Standing Tour",
    );
  }, [events, selectedTrip]);

  const formatAllotmentDate = (ts: string) => {
    if (!ts) return "";
    try {
      const iso = ts.includes("T") ? ts.split("T")[0] : ts.slice(0, 10);
      const parts = iso.split("-");
      if (parts.length !== 3) return ts;
      const [y, m, d] = parts;
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      if (Number.isNaN(dt.getTime())) return iso;
      return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return ts;
    }
  };

  const participants = useMemo(() => {
    if (!selectedTrip) return [];
    return getTripParticipants(
      selectedTrip,
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
  }, [selectedTrip, flights, hotels, trains, buses, expenses, advances, allowances, users]);

  // Pre-filtered data for the Travel Voucher scoped to the optional date window.
  // Filters flights, hotels, trains, buses, expenses, advances, and allowances by date.
  const voucherData = useMemo(() => {
    if (!selectedTrip) return null;
    const toIso = (ddmmyyyy: string): string => {
      const p = ddmmyyyy.trim().split("/");
      if (p.length !== 3) return "";
      const [dd, mm, yyyy] = p;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    };
    const inRange = (iso: string): boolean => {
      if (!iso) return true;
      if (voucherDateFrom && iso < voucherDateFrom) return false;
      if (voucherDateTo && iso > voucherDateTo) return false;
      return true;
    };
    const filteredFlights = flights.filter((f) =>
      inRange(toIso((f as unknown as Record<string, string>).departuredate || "")),
    );
    const filteredHotels = hotels.filter((h) =>
      inRange(toIso((h as unknown as Record<string, string>).checkindate || "")),
    );
    const filteredTrains = trains.filter((t) =>
      inRange(toIso((t as unknown as Record<string, string>).departuredate || "")),
    );
    const filteredBuses = buses.filter((b) =>
      inRange(toIso((b as unknown as Record<string, string>).departuredate || "")),
    );
    const filteredExpenses = expenses.filter((e) => {
      let iso = "";
      if (e.expensedate && e.expensedate.trim()) {
        iso = e.expensedate.trim().slice(0, 10);
      } else if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!Number.isNaN(d.getTime())) {
          iso = d.toISOString().slice(0, 10);
        }
      }
      return inRange(iso);
    });
    const filteredAdvances = advances.filter((a) => {
      if (!voucherDateFrom && !voucherDateTo) return true;
      if (!a.timestamp) return true;
      const d = new Date(a.timestamp);
      return Number.isNaN(d.getTime()) ? true : inRange(d.toISOString().slice(0, 10));
    });
    const filteredAllowances = allowances.filter((a) => {
      if (!voucherDateFrom && !voucherDateTo) return true;
      if (!a.timestamp) return true;
      const d = new Date(a.timestamp);
      return Number.isNaN(d.getTime()) ? true : inRange(d.toISOString().slice(0, 10));
    });
    const voucherParticipants = getTripParticipants(
      selectedTrip,
      {
        flights: filteredFlights as unknown as Record<string, string>[],
        hotels: filteredHotels as unknown as Record<string, string>[],
        trains: filteredTrains as unknown as Record<string, string>[],
        buses: filteredBuses as unknown as Record<string, string>[],
        expenses: filteredExpenses,
        advances: filteredAdvances,
        allowances: filteredAllowances,
      },
      users,
    );
    return {
      filteredFlights,
      filteredHotels,
      filteredTrains,
      filteredBuses,
      filteredExpenses,
      filteredAdvances,
      filteredAllowances,
      voucherParticipants,
    };
  }, [selectedTrip, voucherDateFrom, voucherDateTo, flights, hotels, trains, buses, expenses, advances, allowances, users]);

  const displayedParticipants = useMemo(() => {
    if ((voucherDateFrom || voucherDateTo) && voucherData) {
      return voucherData.voucherParticipants;
    }
    return participants;
  }, [voucherDateFrom, voucherDateTo, voucherData, participants]);

  // Split the voucher-scoped participant list into "everyone but the owner"
  // (combined voucher, unchanged behaviour) and "just the owner" (separate
  // voucher for Rajesh Kulkarni).
  const staffParticipants = useMemo(
    () => (voucherData?.voucherParticipants ?? []).filter((p) => !isOwnerEntry(p.username, p.name, users)),
    [voucherData, users],
  );
  const ownerParticipants = useMemo(
    () => (voucherData?.voucherParticipants ?? []).filter((p) => isOwnerEntry(p.username, p.name, users)),
    [voucherData, users],
  );

  const tripReceipts = useMemo(() => {
    if (!selectedTrip) return [];
    return (voucherData?.filteredExpenses ?? [])
      .filter((e) => (e.trip || GENERAL_TRAVEL).trim() === selectedTrip && e.receipturl)
      .map((e) => ({
        url: e.receipturl,
        mimetype: e.receiptmimetype || "",
        label: `${e.username} · ${e.category}${e.description ? ` · ${e.description}` : ""} · ${e.amount} ${e.currency || "INR"}`,
      }));
  }, [voucherData?.filteredExpenses, selectedTrip]);

  const expensesForPerson = (username: string, name: string) =>
    (voucherData?.filteredExpenses ?? [])
      .filter((e) => {
        if ((e.trip || GENERAL_TRAVEL).trim() !== selectedTrip) return false;
        const eu = (e.username || e.name || "").trim().toLowerCase();
        return (
          eu === username.trim().toLowerCase() ||
          eu === name.trim().toLowerCase() ||
          isPersonMatch(eu, username, users) ||
          isPersonMatch(eu, name, users)
        );
      })
      .sort((a, b) => {
        const da = a.expensedate || a.timestamp || "";
        const db = b.expensedate || b.timestamp || "";
        return db.localeCompare(da);
      });

  const advancesForPerson = (username: string, name: string) =>
    (voucherData?.filteredAdvances ?? advances).filter((a) => {
      if ((a.trip || GENERAL_TRAVEL).trim() !== selectedTrip) return false;
      const au = (a.username || a.name || "").trim().toLowerCase();
      return (
        au === username.trim().toLowerCase() ||
        au === name.trim().toLowerCase() ||
        isPersonMatch(au, username, users) ||
        isPersonMatch(au, name, users)
      );
    });

  const allowancesForPerson = (username: string, name: string) =>
    (voucherData?.filteredAllowances ?? allowances).filter((a) => {
      if ((a.trip || GENERAL_TRAVEL).trim() !== selectedTrip) return false;
      const au = (a.username || a.name || "").trim().toLowerCase();
      return (
        au === username.trim().toLowerCase() ||
        au === name.trim().toLowerCase() ||
        isPersonMatch(au, username, users) ||
        isPersonMatch(au, name, users)
      );
    });
  const handleSetAllowance = async () => {
    if (!allowancePerson) { toast.error("Pick a person first."); return; }
    if (!allowanceAmount.trim()) { toast.error("Enter an amount first."); return; }
    const target = users.find((u) => u.username === allowancePerson);
    setSavingAllowance(true);
    try {
      await addAllowance({
        username: allowancePerson,
        name: target?.name || allowancePerson,
        trip: selectedTrip,
        amount: allowanceAmount,
        method: allowanceMethod,
        setBy: user.username,
        date: allowanceDate,
      });
      toast.success("Allowance set");
      setAllowanceAmount("");
      setAllowancePerson("");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAllowance(false);
    }
  };
  const handleLogAdvance = async () => {
    if (!advancePerson) {
      toast.error("Pick a person first.");
      return;
    }
    if (!advanceAmount.trim()) {
      toast.error("Enter an amount first.");
      return;
    }
    const target = users.find((u) => u.username === advancePerson);
    setSavingAdvance(true);
    try {
      await addAdvance({
        username: advancePerson,
        name: target?.name || advancePerson,
        trip: selectedTrip,
        amount: advanceAmount,
        method: advanceMethod,
        givenBy: user.username,
      });
      toast.success("Advance logged");
      setAdvanceAmount("");
      setAdvancePerson("");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleCompleteTrip = async () => {
    const ev = events.find((e) => (e.eventname || "").trim() === selectedTrip);
    if (!ev || !ev.sourcerow) {
      toast.error("Could not find event details.");
      return;
    }
    if (!window.confirm("Are you sure you want to complete this trip? It will no longer be visible in the trip selection lists.")) return;
    
    try {
      await updateEventStatus({ sourceRow: ev.sourcerow, status: "Completed" });
      toast.success("Trip marked as completed!");
      setSelectedTrip("");
      onRefresh();
    } catch (e) {
      toast.error("Failed to complete trip: " + (e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="mb-3 text-sm font-bold">Trip expenses</div>

      <div className="flex gap-2 mb-3">
        <select
          value={selectedTrip}
          onChange={(e) => { setSelectedTrip(e.target.value); setExpandedPerson(null); setVoucherDateFrom(""); setVoucherDateTo(""); }}
          className="flex-1 rounded border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">Select a trip…</option>
          {tripOptions.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        
        {selectedTrip && selectedTrip !== GENERAL_TRAVEL && (
          <button
            onClick={handleCompleteTrip}
            className="flex shrink-0 items-center gap-1 rounded bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            Mark Complete
          </button>
        )}
      </div>

      {selectedTrip && (
        <>
          {/* Trip-wide actions — one consolidated receipts view, and two
              vouchers: the combined voucher for everyone except the owner,
              and a separate voucher for the owner (Rajesh Kulkarni). */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setShowConsolidated(true)}
              disabled={tripReceipts.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              <ReceiptIcon className="h-3.5 w-3.5" /> Consolidated receipts ({tripReceipts.length})
            </button>
            <button
              onClick={() => setVoucherGroup("staff")}
              disabled={staffParticipants.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5" /> Create Travel Voucher ({staffParticipants.length})
            </button>
            <button
              onClick={() => setVoucherGroup("owner")}
              disabled={ownerParticipants.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40"
            >
              <FileDown className="h-3.5 w-3.5" /> Owner Voucher — Rajesh ({ownerParticipants.length})
            </button>
          </div>
          {/* Date range to narrow the voucher, expenses, and allowances to one specific visit of a recurring
              event (e.g. Standing Tour like BEL Customer Visit). */}
          <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-dashed border-border px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {isStandingTour ? "Standing Tour Visit Filter" : "Date filter (optional)"}
                </span>
                {isStandingTour && (
                  <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                    Standing Tour
                  </span>
                )}
              </div>
              {(voucherDateFrom || voucherDateTo) && voucherData && (
                <span className="text-[11px] font-semibold text-accent">
                  {voucherData.voucherParticipants.length} participant{voucherData.voucherParticipants.length !== 1 ? "s" : ""} in range
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                value={voucherDateFrom}
                onChange={(e) => {
                  setVoucherDateFrom(e.target.value);
                  if (e.target.value) setAllowanceDate(e.target.value);
                }}
                className="rounded border bg-background px-2 py-1 text-[11px]"
                title="From date"
              />
              <span className="text-[11px] text-muted-foreground">→</span>
              <input
                type="date"
                value={voucherDateTo}
                onChange={(e) => setVoucherDateTo(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-[11px]"
                title="To date"
              />
              {(voucherDateFrom || voucherDateTo) && (
                <button
                  onClick={() => { setVoucherDateFrom(""); setVoucherDateTo(""); }}
                  className="rounded px-1.5 py-1 text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            {isStandingTour && !voucherDateFrom && !voucherDateTo && (
              <div className="text-[10px] text-muted-foreground">
                Tip: This is a standing tour spanning multiple visits. Enter visit dates above to filter expenses, allowances, and travel vouchers for a specific visit.
              </div>
            )}
          </div>

          {/* Standalone advance logger — works for anyone, expense or not. */}
          <div className="mt-4 rounded-lg border p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Log an advance</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={advancePerson}
                onChange={(e) => setAdvancePerson(e.target.value)}
                className="min-w-[140px] flex-1 rounded border bg-background px-2 py-1.5 text-[11px]"
              >
                <option value="">Select person…</option>
                {users
                  .slice()
                  .sort((a, b) => a.username.localeCompare(b.username))
                  .map((u) => <option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
              <input
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="Amount"
                className="w-20 rounded border bg-background px-2 py-1.5 text-[11px]"
              />
              <select
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-[11px]"
              >
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="Card">Card</option>
              </select>
              <button
                onClick={handleLogAdvance}
                disabled={savingAdvance}
                className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-60"
              >
                {savingAdvance ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Log
              </button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Set allowance</div>
              {voucherDateFrom && allowanceDate !== voucherDateFrom && (
                <button
                  type="button"
                  onClick={() => setAllowanceDate(voucherDateFrom)}
                  className="text-[10px] text-accent hover:underline"
                >
                  Use visit date ({voucherDateFrom})
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={allowancePerson} onChange={(e) => setAllowancePerson(e.target.value)} className="min-w-[130px] flex-1 rounded border bg-background px-2 py-1.5 text-[11px]">
                <option value="">Select person…</option>
                {users.slice().sort((a, b) => a.username.localeCompare(b.username)).map((u) => (
                  <option key={u.username} value={u.username}>{u.username}</option>
                ))}
              </select>
              <input
                type="date"
                value={allowanceDate}
                onChange={(e) => setAllowanceDate(e.target.value)}
                className="rounded border bg-background px-2 py-1.5 text-[11px]"
                title="Allowance allotment date"
              />
              <input value={allowanceAmount} onChange={(e) => setAllowanceAmount(e.target.value)} placeholder="Amount" className="w-24 rounded border bg-background px-2 py-1.5 text-[11px]" />
              <select value={allowanceMethod} onChange={(e) => setAllowanceMethod(e.target.value)} className="rounded border bg-background px-2 py-1.5 text-[11px]">
                <option value="Cash">Cash</option>
                <option value="GPay">GPay</option>
                <option value="Card">Card</option>
              </select>
              <button onClick={handleSetAllowance} disabled={savingAllowance} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-accent-foreground disabled:opacity-60">
                {savingAllowance ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Set
              </button>
            </div>
          </div>
          {displayedParticipants.length === 0 ? (
            <div className="mt-4 py-4 text-center text-xs text-muted-foreground">
              {(voucherDateFrom || voucherDateTo)
                ? "No activity for this trip in the selected date range."
                : "No activity for this trip yet."}
            </div>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {displayedParticipants.map((p) => {
                const isOpen = expandedPerson === p.username;
                const personExpenses = expensesForPerson(p.username, p.name);
                const personAdvances = advancesForPerson(p.username, p.name);
                const personAllowances = allowancesForPerson(p.username, p.name);

                const total = personExpenses.reduce((sum, e) => {
                  const cur = (e.currency || "INR").trim().toUpperCase();
                  const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
                  return sum + (Number.isNaN(n) ? 0 : n);
                }, 0);

                return (
                  <div key={p.username} className="py-2">
                    <button
                      onClick={() => setExpandedPerson(isOpen ? null : p.username)}
                      className="flex w-full items-center justify-between text-left text-xs"
                    >
                      <span className="font-semibold">{p.username}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-muted-foreground">{formatInr(total)}</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>

                    {isOpen && (
                      <div className="mt-2 space-y-3 rounded-lg bg-muted/20 p-3">
                        {personExpenses.length === 0 ? (
                          <div className="text-[11px] italic text-muted-foreground">No expenses logged</div>
                        ) : (
                          <div className="space-y-1.5">
                            {personExpenses.map((e) => (
                              <div key={e.sourcerow} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="text-muted-foreground">
                                  {e.category}{e.description ? ` · ${e.description}` : ""} · {e.paymentmethod || "Cash"}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  {e.receipturl && (
                                    <button onClick={() => setViewingReceipt(e.receipturl)} className="text-accent">
                                      <ReceiptIcon className="h-3 w-3" />
                                    </button>
                                  )}
                                  <span className="font-semibold">
                                    {(e.currency || "INR").toUpperCase() === "INR" ? formatInr(parseAmount(e.amount) || 0) : `${e.amount} ${e.currency}`}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="border-t border-border pt-2">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Advances given</div>
                          {personAdvances.length === 0 ? (
                            <div className="text-[11px] italic text-muted-foreground">None logged yet</div>
                          ) : (
                            <div className="space-y-1">
                              {personAdvances.map((a) => (
                                <div key={a.sourcerow} className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground">{a.method} · by {a.givenby}</span>
                                  <span className="font-semibold">{formatInr(parseAmount(a.amount) || 0)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="border-t border-border pt-2">
                          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Allowance</div>
                          {personAllowances.length === 0 ? (
                            <div className="text-[11px] italic text-muted-foreground">
                              {(voucherDateFrom || voucherDateTo) ? "None in selected date range" : "Not set yet"}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {personAllowances.map((a) => {
                                const formattedDate = formatAllotmentDate(a.timestamp);
                                return (
                                  <div key={a.sourcerow} className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground">
                                      {formattedDate && <span className="font-medium text-foreground mr-1">{formattedDate} ·</span>}
                                      {a.method} · set by {a.setby}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold">{formatInr(parseAmount(a.amount) || 0)}</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!window.confirm(`Delete allowance of ₹${a.amount} for ${p.username}?`)) return;
                                          try {
                                            await removeAllowance(a.sourcerow);
                                            toast.success("Allowance removed");
                                            onRefresh();
                                          } catch (err) {
                                            toast.error((err as Error).message);
                                          }
                                        }}
                                        title="Delete allowance"
                                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {viewingReceipt && (
        <ReceiptViewerDialog url={viewingReceipt} open={!!viewingReceipt} onClose={() => setViewingReceipt(null)} />
      )}

      {showConsolidated && selectedTrip && (
        <ConsolidatedReceiptsView trip={selectedTrip} receipts={tripReceipts} onClose={() => setShowConsolidated(false)} />
      )}

      {voucherGroup && selectedTrip && voucherData && (
        <TravelVoucherView
          trip={selectedTrip}
          participants={voucherGroup === "owner" ? ownerParticipants : staffParticipants}
          flights={voucherData.filteredFlights}
          hotels={voucherData.filteredHotels}
          trains={voucherData.filteredTrains}
          buses={voucherData.filteredBuses}
          expenses={voucherData.filteredExpenses}
          advances={voucherData.filteredAdvances}
          allowances={voucherData.filteredAllowances}
          onClose={() => setVoucherGroup(null)}
        />
      )}
    </div>
  );
}