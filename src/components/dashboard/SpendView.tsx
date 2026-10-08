import { useMemo, useRef, useState } from "react";
import type { Flight, Hotel, Train, TravelEvent, Expense } from "@/lib/dashboard-api";
import {
  parseAmount,
  formatInr,
  formatInrAbbreviated,
  toIsoDate,
  sortTripOptions,
} from "@/lib/expense-utils";
import { canonicalizePersonName, splitPassengerList } from "@/lib/role-filter";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Plane, Hotel as HotelIcon, TrainFront, Bus as BusIcon, Receipt, AlertTriangle, BarChart3, PieChart as PieChartIcon, ChevronDown, Wallet } from "lucide-react";
import { EmptyState } from "./EmptyState";

type SpendRecord = {
  type: "flight" | "hotel" | "train" | "bus" | "expense";
  dateDdMmYyyy: string;
  category?: string;
  paymentMethod: string;
  description: string;
  assignedTo: string[];
  trip: string;
  currency: string;
  originalAmount: string;
  amountInr: number;
  unresolved: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  flight: "#3B82F6",
  hotel: "#F59E0B",
  train: "#10B981",
  bus: "#EC4899",
  expense: "#8B5CF6",
};

const TYPE_LABELS: Record<string, string> = {
  flight: "Flights",
  hotel: "Hotels",
  train: "Trains",
  bus: "Buses",
  expense: "Expenses",
};

const UNSPECIFIED_METHOD = "Unspecified";

const PALETTE = ["#3B82F6", "#F59E0B", "#10B981", "#EC4899", "#8B5CF6", "#06B6D4", "#F97316", "#84CC16"];


function isCancelled(r: Record<string, string>): boolean {
  return (r.bookingstatus || "").trim().toLowerCase() === "cancelled";
}


function toSpendRecord(
  type: "flight" | "hotel" | "train" | "bus",
  r: Record<string, string>,
  dateField: string,
  amountField: string,
  description: string,
  users: { name: string; username: string }[] = [],
): SpendRecord | null {
  const dateDdMmYyyy = r[dateField] || "";
  const currency = (r.currency || "INR").trim().toUpperCase();
  const originalAmount = r[amountField] || "";
  const assignedTo = splitPassengerList(r.assignedto).map((s) => canonicalizePersonName(s, users)).filter(Boolean);
  const trip = (r.trip || "General Travel").trim() || "General Travel";
  const paymentMethod = (r.paymentmethod || "").trim() || UNSPECIFIED_METHOD;

  const isPerPerson = (r.amounttype || "total").trim().toLowerCase() === "perperson";
  const shareMultiplier = isPerPerson ? Math.max(assignedTo.length, 1) : 1;

  if (!originalAmount) {
    return { type, dateDdMmYyyy, paymentMethod, description, assignedTo, trip, currency, originalAmount: "", amountInr: 0, unresolved: false };
  }

  const amountNum = parseAmount(originalAmount);
  if (Number.isNaN(amountNum)) return null;

  if (currency === "INR") {
    return { type, dateDdMmYyyy, paymentMethod, description, assignedTo, trip, currency, originalAmount, amountInr: amountNum * shareMultiplier, unresolved: false };
  }

  const inrEquivalent = parseAmount(r.inrequivalent || "");
  if (!Number.isNaN(inrEquivalent)) {
    return { type, dateDdMmYyyy, paymentMethod, description, assignedTo, trip, currency, originalAmount, amountInr: inrEquivalent * shareMultiplier, unresolved: false };
  }

  return { type, dateDdMmYyyy, paymentMethod, description, assignedTo, trip, currency, originalAmount, amountInr: 0, unresolved: true };
}

function toExpenseRecord(e: Expense, users: { name: string; username: string }[] = []): SpendRecord | null {
  let dateDdMmYyyy = "";
  if (e.expensedate && e.expensedate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = e.expensedate.split("-");
    dateDdMmYyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;
  } else if (e.timestamp) {
    const d = new Date(e.timestamp);
    if (!Number.isNaN(d.getTime())) {
      dateDdMmYyyy = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }
  const currency = (e.currency || "INR").trim().toUpperCase();
  const originalAmount = e.amount || "";
  const canonicalUser = canonicalizePersonName(e.username || e.name || "", users);
  const assignedTo = [canonicalUser || e.username || e.name || "Unknown"].filter(Boolean);
  const trip = (e.trip || "General Travel").trim() || "General Travel";
  const description = `${e.category || "Expense"}${e.description ? ` · ${e.description}` : ""}`;
  const paymentMethod = (e.paymentmethod || "").trim() || UNSPECIFIED_METHOD;

  if (!originalAmount) return null;
  const amountNum = parseAmount(originalAmount);
  if (Number.isNaN(amountNum)) return null;

  if (currency === "INR") {
    return { type: "expense", category: e.category, paymentMethod, dateDdMmYyyy, description, assignedTo, trip, currency, originalAmount, amountInr: amountNum, unresolved: false };
  }
  const inrEquivalent = parseAmount(e.inrequivalent || "");
  if (!Number.isNaN(inrEquivalent)) {
    return { type: "expense", category: e.category, paymentMethod, dateDdMmYyyy, description, assignedTo, trip, currency, originalAmount, amountInr: inrEquivalent, unresolved: false };
  }
  return { type: "expense", category: e.category, paymentMethod, dateDdMmYyyy, description, assignedTo, trip, currency, originalAmount, amountInr: 0, unresolved: true };
}


export function SpendView({
  flights,
  hotels,
  trains,
  buses = [],
  events = [],
  expenses = [],
  canSeeAll = true,
  users = [],
}: {
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses?: Train[];
  events?: TravelEvent[];
  expenses?: Expense[];
  // Full-access roles (System Manager/Owner/HR/Accounts) get the employee
  // breakdown and employee filter. Regular users are always viewing just
  // their own (already-scoped) data, so that panel/filter is hidden — a
  // single-name chart/dropdown adds nothing.
  canSeeAll?: boolean;
  users?: { name: string; username: string }[];
}) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [dateTo, setDateTo] = useState("");
  const [employee, setEmployee] = useState("all");
  const [trip, setTrip] = useState("all");
  const [typeFocus, setTypeFocus] = useState<"all" | SpendRecord["type"]>("all");
  const [categoryFocus, setCategoryFocus] = useState<string>("all");
  const [paymentMethodFocus, setPaymentMethodFocus] = useState<string>("all");
  const [employeeChartMode, setEmployeeChartMode] = useState<"bar" | "pie">("bar");
  const [tripChartMode, setTripChartMode] = useState<"bar" | "pie">("bar");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);

  const allRecords = useMemo(() => {
    const out: SpendRecord[] = [];
    for (const f of flights as unknown as Record<string, string>[]) {
      if (isCancelled(f)) continue;
      const rec = toSpendRecord("flight", f, "departuredate", "amount", `${f.fromcode || "?"} → ${f.tocode || "?"}`, users);
      if (rec) out.push(rec);
    }
    for (const h of hotels as unknown as Record<string, string>[]) {
      if (isCancelled(h)) continue;
      const rec = toSpendRecord("hotel", h, "checkindate", "bookedprice", h.hotelname || "Hotel", users);
      if (rec) out.push(rec);
    }
    for (const t of trains as unknown as Record<string, string>[]) {
      if (isCancelled(t)) continue;
      const rec = toSpendRecord("train", t, "departuredate", "amount", `${t.fromcode || "?"} → ${t.tocode || "?"}`, users);
      if (rec) out.push(rec);
    }
    for (const b of buses as unknown as Record<string, string>[]) {
      if (isCancelled(b)) continue;
      const rec = toSpendRecord("bus", b, "departuredate", "amount", `${b.from_station || "?"} → ${b.to_station || "?"}`, users);
      if (rec) out.push(rec);
    }
    for (const e of expenses) {
      const rec = toExpenseRecord(e, users);
      if (rec) out.push(rec);
    }
    return out;
  }, [flights, hotels, trains, buses, expenses]);

  const employeeOptions = useMemo(
    () => Array.from(new Set(allRecords.flatMap((r) => r.assignedTo))).sort(),
    [allRecords],
  );
  const tripOptions = useMemo(
    () =>
      sortTripOptions(
        Array.from(
          new Set(["General Travel", ...events.map((e) => (e.eventname || "").trim()).filter(Boolean), ...allRecords.map((r) => r.trip)]),
        ),
        events
      ),
    [allRecords, events],
  );

  const filtered = useMemo(() => {
    return allRecords.filter((r) => {
      const iso = toIsoDate(r.dateDdMmYyyy);
      if (dateFrom && iso && iso < dateFrom) return false;
      if (dateTo && iso && iso > dateTo) return false;
      if (canSeeAll && employee !== "all" && !r.assignedTo.includes(employee)) return false;
      if (trip !== "all" && r.trip !== trip) return false;
      if (typeFocus !== "all" && r.type !== typeFocus) return false;
      if (categoryFocus !== "all" && r.category !== categoryFocus) return false;
      if (paymentMethodFocus !== "all" && r.paymentMethod !== paymentMethodFocus) return false;
      return true;
    });
  }, [allRecords, dateFrom, dateTo, employee, trip, typeFocus, categoryFocus, paymentMethodFocus, canSeeAll]);

  const totals = useMemo(() => {
    const byType = { flight: 0, hotel: 0, train: 0, bus: 0, expense: 0 };
    let grand = 0;
    let unresolvedCount = 0;
    for (const r of filtered) {
      const shareCount = canSeeAll && employee !== "all" ? (r.assignedTo.length || 1) : 1;
      const amount = r.amountInr / shareCount;
      byType[r.type] += amount;
      grand += amount;
      if (r.unresolved) unresolvedCount++;
    }
    return { byType, grand, unresolvedCount };
  }, [filtered, employee, canSeeAll]);

  const byEmployee = useMemo(() => {
    if (!canSeeAll) return [];
    const map = new Map<string, number>();
    for (const r of filtered) {
      const shareCount = r.assignedTo.length || 1;
      const perPersonAmount = r.amountInr / shareCount;
      for (const name of r.assignedTo) {
        if (employee !== "all" && name !== employee) continue;
        map.set(name, (map.get(name) || 0) + perPersonAmount);
      }
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);
  }, [filtered, employee, canSeeAll]);

  const byTrip = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.trip, (map.get(r.trip) || 0) + r.amountInr);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12);
  }, [filtered]);

  const isExpenseOnlyView = typeFocus === "expense";

  const byTypePie = useMemo(() => {
    if (isExpenseOnlyView) {
      const map = new Map<string, number>();
      for (const r of filtered) {
        if (r.type !== "expense" || !r.category) continue;
        map.set(r.category, (map.get(r.category) || 0) + r.amountInr);
      }
      return Array.from(map.entries())
        .map(([name, value], i) => ({ key: name, name, value, color: PALETTE[i % PALETTE.length] }));
    }
    return (Object.keys(TYPE_LABELS) as SpendRecord["type"][])
      .map((t) => ({ key: t, name: TYPE_LABELS[t], value: totals.byType[t], color: TYPE_COLORS[t] }))
      .filter((d) => d.value > 0);
  }, [filtered, totals, isExpenseOnlyView]);

  const pieTitle = isExpenseOnlyView ? "Personal expenses by category" : "Split by type — click a slice to drill in";

  // Payment-method breakdown — always reflects whatever's currently selected
  // (typeFocus/categoryFocus), since `filtered` already applies those. This is
  // the innermost drill level: type → category (expenses only) → payment method.
  const byPaymentMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.paymentMethod, (map.get(r.paymentMethod) || 0) + r.amountInr);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered]);

  const paymentMethodTitle = isExpenseOnlyView
    ? categoryFocus !== "all"
      ? `Payment methods — ${categoryFocus}`
      : "Payment methods — all expenses"
    : typeFocus !== "all"
    ? `Payment methods — ${TYPE_LABELS[typeFocus]}`
    : "Payment methods — everything in view";

  const itemized = useMemo(
    () => [...filtered].sort((a, b) => toIsoDate(b.dateDdMmYyyy).localeCompare(toIsoDate(a.dateDdMmYyyy))),
    [filtered],
  );

  const hasActiveFilters = !!(
    dateFrom || dateTo || (canSeeAll && employee !== "all") || trip !== "all" ||
    typeFocus !== "all" || categoryFocus !== "all" || paymentMethodFocus !== "all"
  );
  const clearAll = () => {
    const d = new Date();
    setDateTo("");
    d.setMonth(d.getMonth() - 3);
    setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setEmployee("all"); setTrip("all");
    setTypeFocus("all"); setCategoryFocus("all"); setPaymentMethodFocus("all");
  };
  const jumpToTable = () => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleCardClick = (type: "all" | SpendRecord["type"]) => {
    setTypeFocus((prev) => (prev === type ? "all" : type));
    setCategoryFocus("all");
    setPaymentMethodFocus("all"); // reset the deepest drill level when the type-level focus changes
    jumpToTable();
  };

  const handleEmployeeBarClick = (data: { name: string }) => {
    if (!canSeeAll) return;
    setEmployee((prev) => (prev === data.name ? "all" : data.name));
  };

  const handleTripBarClick = (data: { name: string }) => {
    setTrip((prev) => (prev === data.name ? "all" : data.name));
  };

  const handleTypeSliceClick = (data: { key: string }) => {
    if (isExpenseOnlyView) {
      setCategoryFocus((prev) => (prev === data.key ? "all" : data.key));
      setPaymentMethodFocus("all"); // reset when the category changes underneath it
      return;
    }
    setTypeFocus((prev) => (prev === data.key ? "all" : (data.key as SpendRecord["type"])));
    setCategoryFocus("all");
    setPaymentMethodFocus("all");
  };

  const handlePaymentMethodClick = (name: string) => {
    setPaymentMethodFocus((prev) => (prev === name ? "all" : name));
  };

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const employeePieData = byEmployee.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));
  const tripPieData = byTrip.map((d, i) => ({ ...d, color: PALETTE[i % PALETTE.length] }));

  const cardTypes: { key: "all" | SpendRecord["type"]; label: string; icon: typeof Plane; value: number }[] = [
    { key: "all", label: "Total spend", icon: Receipt, value: totals.grand },
    { key: "flight", label: "Flights", icon: Plane, value: totals.byType.flight },
    { key: "hotel", label: "Hotels", icon: HotelIcon, value: totals.byType.hotel },
    { key: "train", label: "Trains", icon: TrainFront, value: totals.byType.train },
    { key: "bus", label: "Buses", icon: BusIcon, value: totals.byType.bus },
    { key: "expense", label: "Expenses", icon: Receipt, value: totals.byType.expense },
  ];

  const maxPaymentAmount = Math.max(1, ...byPaymentMethod.map((d) => d.amount));

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-card p-4 shadow-card">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs" />
        </div>
        {canSeeAll && (
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Employee</label>
            <select value={employee} onChange={(e) => setEmployee(e.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs">
              <option value="all">All employees</option>
              {employeeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Trip</label>
          <select value={trip} onChange={(e) => setTrip(e.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs">
            <option value="all">All trips</option>
            {tripOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {hasActiveFilters && (
          <button onClick={clearAll} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent-soft">
            Clear filters
          </button>
        )}
      </div>

      {/* Active drill-down indicator */}
      {(typeFocus !== "all" || categoryFocus !== "all" || paymentMethodFocus !== "all") && (
        <div className="flex items-center justify-between rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent">
          <span className="font-semibold">
            Showing only: {typeFocus !== "all" ? TYPE_LABELS[typeFocus] : ""}
            {typeFocus !== "all" && categoryFocus !== "all" ? " · " : ""}{categoryFocus !== "all" ? categoryFocus : ""}
            {(typeFocus !== "all" || categoryFocus !== "all") && paymentMethodFocus !== "all" ? " · " : ""}
            {paymentMethodFocus !== "all" ? paymentMethodFocus : ""}
          </span>
          <button
            onClick={() => { setTypeFocus("all"); setCategoryFocus("all"); setPaymentMethodFocus("all"); }}
            className="font-semibold underline hover:no-underline"
          >
            Clear
          </button>
        </div>
      )}

      {totals.unresolvedCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {totals.unresolvedCount} item{totals.unresolvedCount === 1 ? "" : "s"} in this view {totals.unresolvedCount === 1 ? "has" : "have"} a foreign-currency amount with no resolved INR rate yet, and {totals.unresolvedCount === 1 ? "is" : "are"} excluded from the totals below.
        </div>
      )}

      {!filtered.length ? (
        <EmptyState title="No spend data yet" message="Add cost info to your bookings, or log an expense, to see it here." />
      ) : (
        <>
          {/* Summary cards — click to drill into that category */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {cardTypes.map((c, idx) => {
              const Icon = c.icon;
              const active = typeFocus === c.key;
              const colors: Record<string, { from: string; to: string; shadow: string }> = {
                all:     { from: "oklch(0.46 0.19 264)", to: "oklch(0.52 0.20 240)", shadow: "oklch(0.46 0.19 264 / 35%)" },
                flight:  { from: "oklch(0.46 0.21 264)", to: "oklch(0.52 0.20 240)", shadow: "oklch(0.46 0.21 264 / 35%)" },
                hotel:   { from: "oklch(0.52 0.18 30)",  to: "oklch(0.62 0.20 50)",  shadow: "oklch(0.52 0.18 30 / 35%)" },
                train:   { from: "oklch(0.48 0.16 155)", to: "oklch(0.54 0.18 170)", shadow: "oklch(0.48 0.16 155 / 35%)" },
                bus:     { from: "oklch(0.58 0.17 65)",  to: "oklch(0.66 0.18 80)",  shadow: "oklch(0.58 0.17 65 / 35%)" },
                expense: { from: "oklch(0.48 0.18 300)", to: "oklch(0.56 0.20 315)", shadow: "oklch(0.48 0.18 300 / 35%)" },
              };
              const col = colors[c.key] ?? colors.all;
              return (
                <button
                  key={c.key}
                  onClick={() => handleCardClick(c.key)}
                  className={`animate-fade-in-up rounded-2xl p-4 text-left shadow-card transition-all duration-200 ${ 
                    active ? "ring-2" : "card-hover"
                  }`}
                  style={{
                    animationDelay: `${idx * 0.05}s`,
                    background: active
                      ? `linear-gradient(135deg, ${col.from} 0%, ${col.to} 100%)`
                      : "var(--color-card)",
                    boxShadow: active
                      ? `0 4px 16px ${col.shadow}`
                      : undefined,
                  }}
                >
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${active ? "text-white/80" : "text-muted-foreground"}`}>
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-md"
                      style={{ background: active ? "oklch(1 0 0 / 20%)" : `linear-gradient(135deg, ${col.from}, ${col.to})` }}
                    >
                      <Icon className="h-2.5 w-2.5" style={{ color: active ? "white" : "white" }} />
                    </span>
                    {c.label}
                  </div>
                  <div className={`mt-1.5 text-xl font-bold truncate ${active ? "text-white" : "text-foreground"}`} title={formatInr(c.value)}>
                    {formatInrAbbreviated(c.value)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {canSeeAll && byEmployee.length > 0 && (
              <div className="rounded-2xl bg-card p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spend by employee</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEmployeeChartMode("bar")}
                      className={`rounded p-1 ${employeeChartMode === "bar" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted"}`}
                      aria-label="Bar chart"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEmployeeChartMode("pie")}
                      className={`rounded p-1 ${employeeChartMode === "pie" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted"}`}
                      aria-label="Pie chart"
                    >
                      <PieChartIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {employeeChartMode === "bar" ? (
                  <ResponsiveContainer width="100%" height={Math.max(180, byEmployee.length * 32)}>
                    <BarChart data={byEmployee} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatInr(v)} fontSize={10} tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis type="category" dataKey="name" width={90} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip 
                        formatter={(v: number) => formatInr(v)} 
                        contentStyle={{ backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", fontSize: 12 }}
                        itemStyle={{ color: "var(--card-foreground)" }}
                        labelStyle={{ color: "var(--card-foreground)", fontWeight: 600, marginBottom: 4 }}
                      />
                      <Bar
                        dataKey="amount"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(data) => handleEmployeeBarClick(data as { name: string })}
                      >
                        {byEmployee.map((d) => (
                          <Cell key={d.name} fill="#3B82F6" opacity={employee === "all" || employee === d.name ? 1 : 0.35} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={employeePieData}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          innerRadius={40}
                          paddingAngle={2}
                          cursor="pointer"
                          onClick={(data) => handleEmployeeBarClick(data as { name: string })}
                        >
                          {employeePieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} opacity={employee === "all" || employee === entry.name ? 1 : 0.35} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [formatInr(v), "Amount"]}
                          contentStyle={{ backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", fontSize: 12 }}
                          itemStyle={{ color: "var(--card-foreground)" }}
                          labelStyle={{ color: "var(--card-foreground)", fontWeight: 600, marginBottom: 4 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                      {employeePieData.map((entry) => (
                        <button
                          key={entry.name}
                          onClick={() => handleEmployeeBarClick(entry)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                          <span className="max-w-[100px] truncate">{entry.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {byTrip.length > 0 && (
              <div className="rounded-2xl bg-card p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Spend by trip</div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTripChartMode("bar")}
                      className={`rounded p-1 ${tripChartMode === "bar" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted"}`}
                      aria-label="Bar chart"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setTripChartMode("pie")}
                      className={`rounded p-1 ${tripChartMode === "pie" ? "bg-accent-soft text-accent" : "text-muted-foreground hover:bg-muted"}`}
                      aria-label="Pie chart"
                    >
                      <PieChartIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {tripChartMode === "bar" ? (
                  <ResponsiveContainer width="100%" height={Math.max(180, byTrip.length * 32)}>
                    <BarChart data={byTrip} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatInr(v)} fontSize={10} tick={{ fill: "var(--muted-foreground)" }} />
                      <YAxis type="category" dataKey="name" width={110} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} />
                      <Tooltip 
                        formatter={(v: number) => formatInr(v)} 
                        contentStyle={{ backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", fontSize: 12 }}
                        itemStyle={{ color: "var(--card-foreground)" }}
                        labelStyle={{ color: "var(--card-foreground)", fontWeight: 600, marginBottom: 4 }}
                      />
                      <Bar
                        dataKey="amount"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(data) => handleTripBarClick(data as { name: string })}
                      >
                        {byTrip.map((d) => (
                          <Cell key={d.name} fill="#F59E0B" opacity={trip === "all" || trip === d.name ? 1 : 0.35} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={tripPieData}
                          dataKey="amount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          innerRadius={40}
                          paddingAngle={2}
                          cursor="pointer"
                          onClick={(data) => handleTripBarClick(data as { name: string })}
                        >
                          {tripPieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} opacity={trip === "all" || trip === entry.name ? 1 : 0.35} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [formatInr(v), "Amount"]}
                          contentStyle={{ backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", fontSize: 12 }}
                          itemStyle={{ color: "var(--card-foreground)" }}
                          labelStyle={{ color: "var(--card-foreground)", fontWeight: 600, marginBottom: 4 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                      {tripPieData.map((entry) => (
                        <button
                          key={entry.name}
                          onClick={() => handleTripBarClick(entry)}
                          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                          <span className="max-w-[100px] truncate">{entry.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

              </div>
            )}

            {byTypePie.length > 0 && (
              <div className={`rounded-2xl bg-card p-4 shadow-card ${isExpenseOnlyView ? "" : "lg:col-span-2"}`}>
                <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{pieTitle}</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={byTypePie}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={40}
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(data) => handleTypeSliceClick(data as { key: SpendRecord["type"] })}
                    >
                      {byTypePie.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                          opacity={
                            isExpenseOnlyView
                              ? (categoryFocus === "all" || categoryFocus === entry.key ? 1 : 0.35)
                              : (typeFocus === "all" || typeFocus === entry.key ? 1 : 0.35)
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [formatInr(v), "Amount"]}
                      contentStyle={{ backgroundColor: "var(--card)", borderRadius: "0.75rem", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)", fontSize: 12 }}
                      itemStyle={{ color: "var(--card-foreground)" }}
                      labelStyle={{ color: "var(--card-foreground)", fontWeight: 600, marginBottom: 4 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
                  {byTypePie.map((entry) => (
                    <button
                      key={entry.key}
                      onClick={() => handleTypeSliceClick(entry as { key: SpendRecord["type"] })}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                      <span className="max-w-[120px] truncate">{entry.name}: {formatInr(entry.value)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment-method breakdown — text/number list, click a row to filter.
                Always reflects whatever type/category is currently selected above:
                this is the innermost drill level. Sits next to the category pie
                when Expenses is selected, or takes the full second slot otherwise. */}
            {byPaymentMethod.length > 0 && (
              <div className={`rounded-2xl bg-card p-4 shadow-card ${isExpenseOnlyView ? "" : "lg:col-span-2"}`}>
                <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" /> {paymentMethodTitle}
                </div>
                <div className="flex flex-col gap-1.5">
                  {byPaymentMethod.map((d) => {
                    const active = paymentMethodFocus === d.name;
                    const widthPct = Math.max(4, (d.amount / maxPaymentAmount) * 100);
                    return (
                      <button
                        key={d.name}
                        onClick={() => handlePaymentMethodClick(d.name)}
                        className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition ${
                          active ? "border-accent bg-accent-soft" : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-accent/10"
                          style={{ width: `${widthPct}%` }}
                          aria-hidden="true"
                        />
                        <div className="relative flex items-center justify-between gap-2">
                          <span className={`font-semibold ${active ? "text-accent" : "text-foreground"}`}>
                            {d.name}
                          </span>
                          <span className="font-bold">{formatInr(d.amount)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Itemized table — expandable rows */}
          <div ref={tableRef} data-no-swipe="true" className="overflow-x-auto rounded-2xl bg-card shadow-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="w-6 px-2 py-2"></th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Assigned to</th>
                  <th className="px-3 py-2">Trip</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {itemized.map((r, i) => {
                  const isExpanded = expandedRows.has(i);
                  return (
                    <>
                      <tr
                        key={i}
                        onClick={() => toggleRow(i)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-accent-soft/40"
                      >
                        <td className="px-2 py-2 text-center">
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{r.dateDdMmYyyy || "—"}</td>
                        <td className="px-3 py-2 capitalize">{r.type}</td>
                        <td className="px-3 py-2">{r.description}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.assignedTo.join(", ") || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.trip}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                          {r.unresolved ? (
                            <span className="text-orange-600">{r.originalAmount} {r.currency} (unresolved)</span>
                          ) : r.originalAmount ? (
                            formatInr(r.amountInr)
                          ) : (
                            <span className="italic text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border bg-muted/20 last:border-0">
                          <td colSpan={7} className="px-6 py-3 text-[11px] text-muted-foreground">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                              <div><span className="font-semibold">Original amount:</span> {r.originalAmount || "—"} {r.currency}</div>
                              <div><span className="font-semibold">INR value:</span> {r.unresolved ? "Not resolved" : formatInr(r.amountInr)}</div>
                              <div><span className="font-semibold">Payment method:</span> {r.paymentMethod}</div>
                              {r.assignedTo.length > 1 && (
                                <div>
                                  <span className="font-semibold">Per-traveler share:</span> {formatInr(r.amountInr / r.assignedTo.length)} × {r.assignedTo.length}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}