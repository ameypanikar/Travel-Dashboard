import { useMemo, useState, useEffect } from "react";
import { ChevronDown, Loader2, Receipt as ReceiptIcon, FileDown, CheckCircle2, Trash2, Pencil } from "lucide-react";
import type { Flight, Hotel, Train, Bus, TravelEvent, Expense, Advance, Allowance, StandingTourBatch } from "@/lib/dashboard-api";
import { addAdvance, addAllowance, removeAllowance, removeExpense, updateEventStatus } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { formatInr, parseAmount, GENERAL_TRAVEL, getTripParticipants, sumBookingInrMulti, sumExpensesByCategoryMulti, sumExpensesByPaymentMethodMulti, sumAdvancesMulti, sortTripOptions, isActiveTrip, isOwnerEntry, isTripMatch, normalizeTripName, formatIsoToDisplay, shiftIsoDate, toIsoDate } from "@/lib/expense-utils";
import { ReceiptViewerDialog } from "./ReceiptViewerDialog";
import { ConsolidatedReceiptsView } from "./ConsolidatedReceiptsView";
import { TravelVoucherView } from "./TravelVoucherView";
import { StandingTourBatchesPanel } from "./StandingTourBatchesPanel";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { toast } from "sonner";
import { isPersonMatch } from "@/lib/role-filter";

type UserEntry = { name: string; username: string; role: string };

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
  batches = [],
  onRefresh,
  initialTrip,
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
  batches?: StandingTourBatch[];
  onRefresh: () => void;
  initialTrip?: string | null;
}) {
  const [selectedTrip, setSelectedTrip] = useState(initialTrip || "");
  const [showAllTrips, setShowAllTrips] = useState(false);

  useEffect(() => {
    if (initialTrip) setSelectedTrip(initialTrip);
  }, [initialTrip]);

  const completedTripSet = useMemo(() => {
    return new Set(
      events
        .filter((e) => e.status === "Completed")
        .map((e) => (e.eventname || "").trim().toLowerCase())
    );
  }, [events]);

  const tripOptions = useMemo(() => {
    const rawSet = new Set<string>();
    rawSet.add(GENERAL_TRAVEL);

    events
      .filter((e) => (showAllTrips ? true : isActiveTrip(e)))
      .map((e) => (e.eventname || "").trim())
      .filter(Boolean)
      .forEach((t) => rawSet.add(t));

    expenses.forEach((e) => {
      const t = (e.trip || GENERAL_TRAVEL).trim();
      if (t) rawSet.add(t);
    });

    advances.forEach((a) => {
      const t = (a.trip || GENERAL_TRAVEL).trim();
      if (t) rawSet.add(t);
    });

    if (selectedTrip) rawSet.add(selectedTrip);

    // Filter out completed/covered trips unless showAllTrips is checked or it is currently selected
    const filtered = Array.from(rawSet).filter((t) => {
      if (showAllTrips) return true;
      if (selectedTrip && isTripMatch(t, selectedTrip)) return true;
      return !completedTripSet.has(t.toLowerCase());
    });

    return sortTripOptions(filtered, events, expenses);
  }, [events, expenses, advances, selectedTrip, showAllTrips, completedTripSet]);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
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
    return selectedTrip === GENERAL_TRAVEL || events.some(
      (e) => isTripMatch(e.eventname, selectedTrip) && (e.type?.includes("Standing") || e.type === "Standing Tour"),
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
      const p = (ddmmyyyy.trim().includes('-') ? ddmmyyyy.trim().split('-').reverse() : ddmmyyyy.trim().split('/'));
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
      .filter((e) => isTripMatch(e.trip || GENERAL_TRAVEL, selectedTrip) && e.receipturl)
      .map((e) => ({
        url: e.receipturl,
        mimetype: e.receiptmimetype || "",
        label: `${e.username} · ${e.category}${e.description ? ` · ${e.description}` : ""} · ${e.amount} ${e.currency || "INR"}`,
      }));
  }, [voucherData?.filteredExpenses, selectedTrip]);

  const expensesForPerson = (username: string, name: string) =>
    (voucherData?.filteredExpenses ?? [])
      .filter((e) => {
        if (!isTripMatch(e.trip || GENERAL_TRAVEL, selectedTrip)) return false;
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
      if (!isTripMatch(a.trip || GENERAL_TRAVEL, selectedTrip)) return false;
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
      if (!isTripMatch(a.trip || GENERAL_TRAVEL, selectedTrip)) return false;
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

  const selectedEvent = useMemo(() => {
    if (!selectedTrip) return null;
    return (
      events.find((e) => isTripMatch(e.eventname, selectedTrip)) ||
      events.find((e) => normalizeTripName(e.eventname) === normalizeTripName(selectedTrip)) ||
      events.find((e) => {
        const ne = normalizeTripName(e.eventname);
        const nt = normalizeTripName(selectedTrip);
        return ne && nt && (ne.includes(nt) || nt.includes(ne));
      }) ||
      null
    );
  }, [events, selectedTrip]);

  // Pre-populates voucher departure and arrival dates from active date filter, event dates, or item bounds
  const voucherDates = useMemo(() => {
    let dep = voucherDateFrom ? formatIsoToDisplay(voucherDateFrom) : "";
    let arr = voucherDateTo ? formatIsoToDisplay(voucherDateTo) : "";

    // If no date range filter was set, fetch from the trip event
    if (!dep && selectedEvent?.startdate) {
      dep = formatIsoToDisplay(toIsoDate(selectedEvent.startdate)) || selectedEvent.startdate;
    }
    if (!arr && (selectedEvent?.enddate || selectedEvent?.startdate)) {
      const eDate = selectedEvent.enddate || selectedEvent.startdate;
      arr = formatIsoToDisplay(toIsoDate(eDate)) || eDate;
    }

    // Fallback to min/max dates across bookings & expenses if still missing
    if ((!dep || !arr) && voucherData) {
      const dates: string[] = [];
      voucherData.filteredFlights.forEach((f) => {
        const d = toIsoDate((f as any).departuredate || (f as any).departureDate);
        if (d) dates.push(d);
      });
      voucherData.filteredTrains.forEach((t) => {
        const d = toIsoDate((t as any).departuredate || (t as any).date);
        if (d) dates.push(d);
      });
      voucherData.filteredBuses.forEach((b) => {
        const d = toIsoDate((b as any).departuredate || (b as any).date);
        if (d) dates.push(d);
      });
      voucherData.filteredHotels.forEach((h) => {
        const ci = toIsoDate((h as any).checkindate || (h as any).checkInDate);
        const co = toIsoDate((h as any).checkoutdate || (h as any).checkOutDate);
        if (ci) dates.push(ci);
        if (co) dates.push(co);
      });
      voucherData.filteredExpenses.forEach((e) => {
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
        if (!dep) dep = formatIsoToDisplay(dates[0]);
        if (!arr) arr = formatIsoToDisplay(dates[dates.length - 1]);
      }
    }

    return {
      departureDate: dep || "",
      arrivalDate: arr || dep || "",
    };
  }, [voucherDateFrom, voucherDateTo, selectedEvent, voucherData]);

  const eventRow = Number(selectedEvent?.sourcerow || (selectedEvent as any)?.id || (selectedEvent as any)?.sourceRow || 0);
  const isSelectedTripCompleted = selectedEvent?.status === "Completed";
  const tourSettledThrough = isStandingTour && selectedEvent?.status?.startsWith("Covered: ")
    ? selectedEvent.status.replace("Covered: ", "").trim()
    : null;

  const pendingAfterSettlementCount = useMemo(() => {
    if (!isStandingTour || !tourSettledThrough) return 0;
    return expenses.filter((e) => {
      if (!isTripMatch(e.trip, selectedTrip)) return false;
      let iso = "";
      if (e.expensedate && e.expensedate.trim()) {
        iso = e.expensedate.trim().slice(0, 10);
      } else if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
      }
      return iso > tourSettledThrough;
    }).length;
  }, [isStandingTour, tourSettledThrough, expenses, selectedTrip]);

  const handleMarkTourSettledThrough = async () => {
    if (!eventRow || !voucherDateTo) {
      if (!voucherDateTo) toast.error("Please pick a 'To date' for the settlement cutoff.");
      else toast.error("Could not find event record in database to update.");
      return;
    }
    if (!window.confirm(`Mark "${selectedTrip}" as covered through ${formatIsoToDisplay(voucherDateTo)}?`)) return;
    try {
      await updateEventStatus({ sourceRow: eventRow, status: `Covered: ${voucherDateTo}` });
      toast.success(`Marked covered through ${formatIsoToDisplay(voucherDateTo)}!`);
      onRefresh();
    } catch (e) {
      toast.error("Failed to update status: " + (e as Error).message);
    }
  };

  const handleResetTourSettlement = async () => {
    if (!eventRow) {
      toast.error("Could not find event record in database to reset.");
      return;
    }
    if (!window.confirm(`Reset settlement milestone for "${selectedTrip}"?`)) return;
    try {
      await updateEventStatus({ sourceRow: eventRow, status: "Booked" });
      toast.success("Settlement milestone reset.");
      onRefresh();
    } catch (e) {
      toast.error("Failed to reset status: " + (e as Error).message);
    }
  };

  const handleToggleTripComplete = async () => {
    if (!eventRow) {
      toast.error("Could not find event details.");
      return;
    }
    const nextStatus = isSelectedTripCompleted ? "Booked" : "Completed";
    const promptMsg = isSelectedTripCompleted
      ? "Re-open this trip? It will appear in active trip dropdowns again."
      : "Mark this trip as completed / covered?";
    if (!window.confirm(promptMsg)) return;

    try {
      await updateEventStatus({ sourceRow: eventRow, status: nextStatus });
      toast.success(isSelectedTripCompleted ? "Trip re-opened!" : "Trip marked as covered!");
      onRefresh();
    } catch (e) {
      toast.error("Failed to update trip status: " + (e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-4 shadow-card">
      <div className="mb-3 text-sm font-bold">Trip expenses</div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex flex-1 gap-2">
          <select
            value={selectedTrip}
            onChange={(e) => {
              const nextTrip = e.target.value;
              setSelectedTrip(nextTrip);
              setExpandedPerson(null);
              const ev = events.find((x) => isTripMatch(x.eventname, nextTrip));
              const settled = ev?.status?.startsWith("Covered: ") ? ev.status.replace("Covered: ", "").trim() : null;
              setVoucherDateFrom(settled ? shiftIsoDate(settled, 1) : "");
              setVoucherDateTo("");
            }}
            className="flex-1 rounded border bg-background px-2 py-1.5 text-xs"
          >
            <option value="">Select a trip…</option>
            {tripOptions.map((t) => {
              const ev = events.find((e) => isTripMatch(e.eventname, t));
              const isComp = ev?.status === "Completed";
              return (
                <option key={t} value={t}>
                  {t}{showAllTrips && isComp ? " (Covered)" : ""}
                </option>
              );
            })}
          </select>
          
          {selectedTrip && selectedTrip !== GENERAL_TRAVEL && !events.find((e) => isTripMatch(e.eventname, selectedTrip))?.type?.includes("Standing") && (
            <button
              onClick={handleToggleTripComplete}
              className={`flex shrink-0 items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition ${
                isSelectedTripCompleted
                  ? "bg-muted text-muted-foreground hover:bg-muted/80"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
              }`}
            >
              <CheckCircle2 className={`h-3.5 w-3.5 ${isSelectedTripCompleted ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`} />
              {isSelectedTripCompleted ? "Re-open Trip" : "Mark Covered"}
            </button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAllTrips}
            onChange={(e) => setShowAllTrips(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent h-3.5 w-3.5"
          />
          <span>Show all / archived (&gt; 3 mos)</span>
        </label>
      </div>

      {selectedTrip && (
        <>
          {/* Trip-wide actions — available for all trips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowConsolidated(true)}
              disabled={tripReceipts.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40 cursor-pointer"
            >
              <ReceiptIcon className="h-3.5 w-3.5" /> Consolidated receipts ({tripReceipts.length})
            </button>
            <button
              type="button"
              onClick={() => setVoucherGroup("staff")}
              disabled={staffParticipants.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" /> Create Travel Voucher ({staffParticipants.length})
            </button>
            <button
              type="button"
              onClick={() => setVoucherGroup("owner")}
              disabled={ownerParticipants.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-40 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" /> Owner Voucher — Rajesh ({ownerParticipants.length})
            </button>
          </div>

          {/* Date Filter — available for all trips, essential for inspecting visit date ranges on standing tours */}
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-border bg-slate-50/60 dark:bg-muted/30 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Date filter {isStandingTour ? "— check visit dates & employee uploads" : "(optional)"}
                </span>
                {isStandingTour && (
                  <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[9px] font-semibold text-accent">
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

            <div className="flex flex-wrap items-center justify-between gap-2">
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
                    type="button"
                    onClick={() => {
                      setVoucherDateFrom("");
                      setVoucherDateTo("");
                    }}
                    className="rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              {isStandingTour && !voucherDateFrom && !voucherDateTo && (
                <div className="text-[10px] text-muted-foreground">
                  Enter visit dates above to check expenses, verify employee uploads, and filter vouchers.
                </div>
              )}
              {isStandingTour && (voucherDateFrom || voucherDateTo) && (
                <div className="text-[10px] font-medium text-muted-foreground">
                  Viewing: {voucherDateFrom ? formatIsoToDisplay(voucherDateFrom) : "Start"} → {voucherDateTo ? formatIsoToDisplay(voucherDateTo) : "Present"}
                </div>
              )}
            </div>
          </div>

          {/* Standing Tour Visit Settlement Batches */}
          {isStandingTour && (
            <StandingTourBatchesPanel
              trip={selectedTrip}
              batches={batches}
              expenses={expenses}
              advances={advances}
              allowances={allowances}
              flights={flights}
              hotels={hotels}
              trains={trains}
              buses={buses}
              users={users}
              user={user}
              onRefresh={onRefresh}
              activeDateFrom={voucherDateFrom}
              activeDateTo={voucherDateTo}
              onClearDateRange={() => {
                setVoucherDateFrom("");
                setVoucherDateTo("");
                toast.info("Cleared filter; viewing full tour");
              }}
              onSelectBatchDateRange={(from, to) => {
                if (voucherDateFrom === from && voucherDateTo === to) {
                  setVoucherDateFrom("");
                  setVoucherDateTo("");
                  toast.info("Reset filter to full tour");
                } else {
                  setVoucherDateFrom(from);
                  setVoucherDateTo(to);
                  toast.info(`Filtered panel to ${formatIsoToDisplay(from)} – ${formatIsoToDisplay(to)}`);
                }
              }}
              onOpenVoucher={(t, grp, dateRange) => {
                if (dateRange) {
                  setVoucherDateFrom(dateRange.from);
                  setVoucherDateTo(dateRange.to);
                } else {
                  setVoucherDateFrom("");
                  setVoucherDateTo("");
                }
                setVoucherGroup(grp);
              }}
              onOpenReceipts={(t, dateRange) => {
                if (dateRange) {
                  setVoucherDateFrom(dateRange.from);
                  setVoucherDateTo(dateRange.to);
                } else {
                  setVoucherDateFrom("");
                  setVoucherDateTo("");
                }
                setShowConsolidated(true);
              }}
            />
          )}

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
                              <div
                                key={e.sourcerow}
                                className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-muted/40"
                              >
                                <span
                                  className="truncate text-muted-foreground"
                                  title={`${e.category}${e.description ? ` · ${e.description}` : ""} · ${e.paymentmethod || "Cash"}`}
                                >
                                  {e.category}{e.description ? ` · ${e.description}` : ""} · {e.paymentmethod || "Cash"}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {e.receipturl && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingReceipt(e.receipturl)}
                                      className="rounded p-0.5 text-accent transition hover:text-accent/80 cursor-pointer"
                                      title="View Receipt"
                                    >
                                      <ReceiptIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEditingExpense(e)}
                                    className="rounded p-0.5 text-muted-foreground transition hover:text-accent hover:bg-accent-soft cursor-pointer"
                                    title="Edit Expense / Bill"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Delete expense "${e.category}${e.description ? ` (${e.description})` : ""} - ${e.amount} ${e.currency || "INR"}"?`)) return;
                                      try {
                                        await removeExpense({ sourceRow: e.sourcerow, username: user.username });
                                        toast.success("Expense deleted");
                                        onRefresh();
                                      } catch (err) {
                                        toast.error((err as Error).message);
                                      }
                                    }}
                                    className="rounded p-0.5 text-muted-foreground transition hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                    title="Delete Expense"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="min-w-[55px] text-right font-semibold">
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
        <ConsolidatedReceiptsView
          trip={selectedTrip}
          receipts={tripReceipts}
          dateRangeSubtitle={
            voucherDateFrom || voucherDateTo
              ? `${voucherDateFrom ? formatIsoToDisplay(voucherDateFrom) : "Start"} – ${voucherDateTo ? formatIsoToDisplay(voucherDateTo) : "Present"}`
              : undefined
          }
          onClose={() => setShowConsolidated(false)}
        />
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
          defaultDepartureDate={voucherDates.departureDate}
          defaultArrivalDate={voucherDates.arrivalDate}
          onClose={() => setVoucherGroup(null)}
        />
      )}

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          user={user}
          events={events}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            onRefresh();
          }}
          restricted={false}
        />
      )}
    </div>
  );
}