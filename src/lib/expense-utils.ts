import type { TravelEvent, Expense, Advance, Allowance, Flight, Hotel, Train, Bus } from "@/lib/dashboard-api";
import { canonicalizePersonName, isAssignedToMe, isPersonMatch, splitPassengerList, FULL_ACCESS_ROLES } from "@/lib/role-filter";

export const GENERAL_TRAVEL = "General Travel";
export const VISA_CHARGES = "Visa Charges";
export const CATEGORIES = ["Food", "Transport (Auto/Taxi)", "Petrol/Diesel", "Toll", "Misc. Expenses"];
export const ALL_CATEGORIES = [...CATEGORIES, VISA_CHARGES];

export function normalizeTripName(trip?: string | null): string {
  if (!trip) return "";
  return String(trip)
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-") // normalize unicode dashes/hyphens
    .replace(/\s+/g, " ")                                     // collapse multiple whitespace
    .trim()
    .toLowerCase();
}

export function isTripMatch(tripA?: string | null, tripB?: string | null): boolean {
  const normA = normalizeTripName(tripA);
  const normB = normalizeTripName(tripB);
  if (!normA && !normB) return true;
  if (!normA || !normB) return false;
  return normA === normB;
}

export function getAvailableCategories(userRole?: string | null): string[] {
  const role = (userRole || "").trim().toLowerCase();
  if (FULL_ACCESS_ROLES.includes(role)) {
    return [...CATEGORIES, VISA_CHARGES];
  }
  return CATEGORIES;
}

export const OWNER_USERNAME = "rajesh k";

export function isOwnerEntry(
  username: string,
  name?: string | undefined,
  users?: { name?: string; username?: string; role?: string }[],
): boolean {
  if (username.trim().toLowerCase() === OWNER_USERNAME) return true;
  const n = (name || "").trim().toLowerCase();
  if (n === "rajesh kulkarni" || n === "rajesh k") return true;
  if (users && users.length > 0) {
    const matched = users.find(
      (u) =>
        (u.username || "").trim().toLowerCase() === username.trim().toLowerCase() ||
        ((u.name || "").trim().toLowerCase() === n && n.length > 0)
    );
    if (matched && (matched.role || "").trim().toLowerCase() === "owner") return true;
  }
  return false;
}

export const PAYMENT_METHODS = ["Cash", "Card", "GPay"];
// Shown only when Payment method === "Card" — lets the person pick which of
// the company's cards the charge went on. Kept as a flat list here (rather
// than a Config-sheet lookup) since there are only ever a handful of these
// and they change rarely; bump this list if a card is added/retired.
export const CARDS = [
  "XXXX XXXX XXXX 6002",
  "XXXX XXXX XXXX 0948",
  "XXXX XXXX XXXX 2001",
  "XXXX XXXX XXXX 7019",
  "XXXX XXXX XXXX 1688"
];
export const BANKS = [
  "Cosmos",
  "Bank of Maharashtra",
  "ICICI"
];
const TRIP_GRACE_DAYS = 1;

export function toIsoDate(dateStr?: string | number | null): string {
  if (!dateStr) return "";
  const trimmed = String(dateStr).trim();
  if (trimmed.length === 10 && trimmed.includes("-") && trimmed.indexOf("-") === 4) return trimmed;
  // expects DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
  const p = trimmed.includes("-") ? trimmed.split("-") : trimmed.split("/");
  if (p.length === 3) {
    const [dd, mm, yyyy] = p;
    if (yyyy && yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (dd && dd.length === 4) return `${dd}-${mm.padStart(2, "0")}-${yyyy.padStart(2, "0")}`;
  }
  return "";
}

export function isIsoInRange(iso: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!iso) return true;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

export function formatIsoToDisplay(iso?: string | null): string {
  if (!iso) return "";
  const parts = iso.trim().split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return iso;
}

export function filterTripFinancialsByDateRange(
  range: { from?: string; to?: string } | null | undefined,
  data: {
    flights: Flight[];
    hotels: Hotel[];
    trains: Train[];
    buses: Bus[];
    expenses: Expense[];
    advances: Advance[];
    allowances: Allowance[];
  }
) {
  const from = range?.from?.trim() || "";
  const to = range?.to?.trim() || "";
  if (!from && !to) {
    return {
      flights: data.flights,
      hotels: data.hotels,
      trains: data.trains,
      buses: data.buses,
      expenses: data.expenses,
      advances: data.advances,
      allowances: data.allowances,
    };
  }

  const inRange = (iso: string) => isIsoInRange(iso, from, to);

  const filteredFlights = data.flights.filter((f) =>
    inRange(toIsoDate((f as unknown as Record<string, string>).departuredate || (f as any).departureDate || ""))
  );
  const filteredHotels = data.hotels.filter((h) =>
    inRange(toIsoDate((h as unknown as Record<string, string>).checkindate || (h as any).checkInDate || ""))
  );
  const filteredTrains = data.trains.filter((t) =>
    inRange(toIsoDate(t.departuredate || t.date || ""))
  );
  const filteredBuses = data.buses.filter((b) =>
    inRange(toIsoDate(b.departuredate || b.date || ""))
  );
  const filteredExpenses = data.expenses.filter((e) => {
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
  const filteredAdvances = data.advances.filter((a) => {
    if (!a.timestamp) return true;
    const d = new Date(a.timestamp);
    return Number.isNaN(d.getTime()) ? true : inRange(d.toISOString().slice(0, 10));
  });
  const filteredAllowances = data.allowances.filter((a) => {
    if (a.date) {
      return inRange(toIsoDate(a.date));
    }
    if (a.timestamp) {
      const d = new Date(a.timestamp);
      return Number.isNaN(d.getTime()) ? true : inRange(d.toISOString().slice(0, 10));
    }
    return true;
  });

  return {
    flights: filteredFlights,
    hotels: filteredHotels,
    trains: filteredTrains,
    buses: filteredBuses,
    expenses: filteredExpenses,
    advances: filteredAdvances,
    allowances: filteredAllowances,
  };
}

export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isActiveTrip(ev: TravelEvent | null | undefined): boolean {
  if (!ev) return false;
  if (ev.status === "Completed") return false;

  let start = ev.startdate;
  let end = ev.enddate;

  if (typeof start !== "string") start = "";
  if (typeof end !== "string") end = "";

  const endIso = toIsoDate(end) || toIsoDate(start);
  if (!endIso) return true;

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const threeMonthsAgoIso = threeMonthsAgo.toISOString().slice(0, 10);

  return endIso >= threeMonthsAgoIso;
}

export function suggestTrip(events: TravelEvent[]): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  const match = events.find((ev) => {
    if (!isActiveTrip(ev)) return false;
    if (ev.type === "Standing Tour") return false; // Never auto-suggest standing tours
    const start = toIsoDate(ev.startdate);
    if (!start) return false;
    const end = toIsoDate(ev.enddate) || start;
    const graceStart = shiftIsoDate(start, -TRIP_GRACE_DAYS);
    const graceEnd = shiftIsoDate(end, TRIP_GRACE_DAYS);
    return todayIso >= graceStart && todayIso <= graceEnd;
  });
  return (match?.eventname || "").trim() || GENERAL_TRAVEL;
}

export function sortTripOptions(options: string[], events: TravelEvent[], expenses?: Expense[]): string[] {
  const standingTours = new Set(
    events.filter((e) => e.type === "Standing Tour").map((e) => normalizeTripName(e.eventname)),
  );

  // Precompute latest activity date per trip
  const latestActivityMap = new Map<string, string>();
  if (expenses && expenses.length > 0) {
    for (const e of expenses) {
      const tripKey = normalizeTripName(e.trip || GENERAL_TRAVEL);
      let iso = "";
      if (e.expensedate && e.expensedate.trim()) {
        iso = e.expensedate.trim().slice(0, 10);
      } else if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
      }
      if (iso) {
        const existing = latestActivityMap.get(tripKey) || "";
        if (iso > existing) latestActivityMap.set(tripKey, iso);
      }
    }
  }

  // Precompute event start dates
  const eventDateMap = new Map<string, string>();
  for (const ev of events) {
    const key = normalizeTripName(ev.eventname);
    const startIso = toIsoDate(ev.startdate) || "";
    if (startIso) eventDateMap.set(key, startIso);
  }

  return [...options].sort((a, b) => {
    if (isTripMatch(a, GENERAL_TRAVEL)) return -1;
    if (isTripMatch(b, GENERAL_TRAVEL)) return 1;

    const aNorm = normalizeTripName(a);
    const bNorm = normalizeTripName(b);
    const aIsStanding = standingTours.has(aNorm);
    const bIsStanding = standingTours.has(bNorm);

    // If expenses are provided, sort trips with newest expense activity to the top
    if (expenses && expenses.length > 0) {
      const dateA = latestActivityMap.get(aNorm) || "";
      const dateB = latestActivityMap.get(bNorm) || "";
      if (dateA && dateB && dateA !== dateB) {
        return dateB.localeCompare(dateA); // newest activity first
      }
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
    }

    // Group standing tours after discrete events
    if (aIsStanding && !bIsStanding) return 1;
    if (!aIsStanding && bIsStanding) return -1;

    // Sort by event start date descending if available
    const evDateA = eventDateMap.get(aNorm) || "";
    const evDateB = eventDateMap.get(bNorm) || "";
    if (evDateA && evDateB && evDateA !== evDateB) {
      return evDateB.localeCompare(evDateA);
    }
    if (evDateA && !evDateB) return -1;
    if (!evDateA && evDateB) return 1;

    return a.localeCompare(b);
  });
}

export function parseAmount(raw?: string | number | null): number {
  if (typeof raw === "number") return raw;
  if (!raw) return NaN;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
}

export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function formatInrAbbreviated(n: number): string {
  if (n >= 10000000) {
    return `₹${(n / 10000000).toFixed(2)} Cr`;
  }
  if (n >= 100000) {
    return `₹${(n / 100000).toFixed(2)} L`;
  }
  return formatInr(n);
}

export function matchCategory(raw?: string): string {
  const clean = (raw || "").trim().toLowerCase();
  const found = ALL_CATEGORIES.find((c) => c.toLowerCase() === clean);
  return found || "Misc. Expenses";
}

function isAssignedToTrip(r: Record<string, string>, username: string, name: string): boolean {
  return (
    isPersonMatch(r.assignedto, username) ||
    isPersonMatch(r.assignedto, name) ||
    isAssignedToMe(r.assignedto, username) ||
    isAssignedToMe(r.assignedto, name)
  );
}

export function sumBookingInr(
  records: Record<string, string>[],
  amountField: string,
  trip: string,
  username: string,
  name: string,
): number {
  let total = 0;
  for (const r of records) {
    if (!isTripMatch(r.trip || GENERAL_TRAVEL, trip)) continue;
    if (!isAssignedToTrip(r, username, name)) continue;
    if ((r.bookingstatus || "").trim().toLowerCase() === "cancelled") continue;
    const raw = r[amountField] || "";
    if (!raw) continue;

    // Determine how many people share this booking, and whether the stored
    // amount is a per-person figure or the grand total for all travelers.
    const assignees = splitPassengerList(r.assignedto);
    const assigneeCount = Math.max(assignees.length, 1);
    const isPerPerson = (r.amounttype || "total").trim().toLowerCase() === "perperson";
    // If "total": each person's share = amount / assigneeCount.
    // If "perperson": the stored amount is already per-person — use it directly.
    const shareDivisor = isPerPerson ? 1 : assigneeCount;

    const cur = (r.currency || "INR").trim().toUpperCase();
    if (cur === "INR") {
      const n = parseAmount(raw);
      if (!Number.isNaN(n)) total += n / shareDivisor;
    } else {
      const n = parseAmount(r.inrequivalent || "");
      if (!Number.isNaN(n)) total += n / shareDivisor;
    }
  }
  return total;
}

export function sumExpensesByCategory(expenses: Expense[], trip: string, username: string, name: string, category: string): number {
  let total = 0;
  for (const e of expenses) {
    if (!isTripMatch(e.trip || GENERAL_TRAVEL, trip)) continue;
    const eu = (e.username || e.name || "").trim().toLowerCase();
    if (
      eu !== username.trim().toLowerCase() &&
      eu !== name.trim().toLowerCase() &&
      !isPersonMatch(eu, username) &&
      !isPersonMatch(eu, name)
    ) continue;
    if ((e.category || "").trim().toLowerCase() !== category.trim().toLowerCase()) continue;
    const cur = (e.currency || "INR").trim().toUpperCase();
    const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

export function sumExpensesByPaymentMethod(expenses: Expense[], trip: string, username: string, name: string, methods: string[]): number {
  let total = 0;
  for (const e of expenses) {
    if (!isTripMatch(e.trip || GENERAL_TRAVEL, trip)) continue;
    const eu = (e.username || e.name || "").trim().toLowerCase();
    if (
      eu !== username.trim().toLowerCase() &&
      eu !== name.trim().toLowerCase() &&
      !isPersonMatch(eu, username) &&
      !isPersonMatch(eu, name)
    ) continue;
    if (!methods.map((m) => m.toLowerCase()).includes((e.paymentmethod || "Cash").trim().toLowerCase())) continue;
    const cur = (e.currency || "INR").trim().toUpperCase();
    const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

export function sumAdvances(advances: Advance[], trip: string, username: string, name: string): number {
  return advances
    .filter((a) => {
      if (!isTripMatch(a.trip || GENERAL_TRAVEL, trip)) return false;
      const au = (a.username || a.name || "").trim().toLowerCase();
      return (
        au === username.trim().toLowerCase() ||
        au === name.trim().toLowerCase() ||
        isPersonMatch(au, username) ||
        isPersonMatch(au, name)
      );
    })
    .reduce((sum, a) => {
      const n = parseAmount(a.amount);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
}

// ── Trip participants — everyone with ANY footprint on a trip: a booking
// they're assigned to, an expense they logged, or an advance given to them.
// This is what lets an advance be logged before any expense exists, and
// what the combined voucher iterates over. ─────────────────────────────────
export type TripParticipant = { username: string; name: string };

function collectAssigned(records: Record<string, string>[], trip: string): Set<string> {
  const set = new Set<string>();
  for (const r of records) {
    if (!isTripMatch(r.trip || GENERAL_TRAVEL, trip)) continue;
    (r.assignedto || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => set.add(n.toLowerCase()));
  }
  return set;
}

export function getTripParticipants(
  trip: string,
  data: {
    flights: Record<string, string>[];
    hotels: Record<string, string>[];
    trains: Record<string, string>[];
    buses: Record<string, string>[];
    expenses: Expense[];
    advances: Advance[];
    allowances: Allowance[];
  },
  users: { name: string; username: string }[],
): TripParticipant[] {
  const keys = new Set<string>();
  [data.flights, data.hotels, data.trains, data.buses].forEach((list) => {
    collectAssigned(list, trip).forEach((v) => keys.add(v));
  });
  data.expenses.filter((e) => isTripMatch(e.trip || GENERAL_TRAVEL, trip)).forEach((e) => {
    const u = (e.username || e.name || "").trim().toLowerCase();
    if (u) keys.add(u);
  });
  data.advances.filter((a) => isTripMatch(a.trip || GENERAL_TRAVEL, trip)).forEach((a) => {
    const u = (a.username || a.name || "").trim().toLowerCase();
    if (u) keys.add(u);
  });
  data.allowances.filter((a) => isTripMatch(a.trip || GENERAL_TRAVEL, trip)).forEach((a) => {
    const u = (a.username || a.name || "").trim().toLowerCase();
    if (u) keys.add(u);
  });

  const seen = new Set<string>();
  const result: TripParticipant[] = [];
  keys.forEach((key) => {
    const canonical = canonicalizePersonName(key, users);
    const match = users.find(
      (u) =>
        u.username.trim().toLowerCase() === canonical.toLowerCase() ||
        u.name.trim().toLowerCase() === canonical.toLowerCase() ||
        isAssignedToMe(key, u.name) ||
        isAssignedToMe(key, u.username)
    );
    const username = match?.username || canonical || key;
    const name = match?.name || username;
    const dedupeKey = username.trim().toLowerCase();
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push({ username, name });
  });

  // Defensive fallback: if no named participants were resolved, but expenses exist for this trip
  if (result.length === 0) {
    const fallbackNames = new Set<string>();
    data.expenses
      .filter((e) => isTripMatch(e.trip || GENERAL_TRAVEL, trip))
      .forEach((e) => {
        const u = (e.username || e.name || "").trim();
        if (u) fallbackNames.add(u);
      });
    fallbackNames.forEach((u) => {
      result.push({ username: u, name: u });
    });
  }

  return result.sort((a, b) => a.username.localeCompare(b.username));
}

// ── Multi-participant aggregation — sums a category/booking-type across
// EVERY participant on a trip combined, for the single combined voucher.
export function sumBookingInrMulti(
  records: Record<string, string>[],
  amountField: string,
  trip: string,
  participants: TripParticipant[],
): number {
  return participants.reduce((sum, p) => sum + sumBookingInr(records, amountField, trip, p.username, p.name), 0);
}

export function sumExpensesByCategoryMulti(
  expenses: Expense[],
  trip: string,
  participants: TripParticipant[],
  category: string,
): number {
  return participants.reduce((sum, p) => sum + sumExpensesByCategory(expenses, trip, p.username, p.name, category), 0);
}

export function sumExpensesByPaymentMethodMulti(
  expenses: Expense[],
  trip: string,
  participants: TripParticipant[],
  methods: string[],
): number {
  return participants.reduce((sum, p) => sum + sumExpensesByPaymentMethod(expenses, trip, p.username, p.name, methods), 0);
}

export function sumAdvancesMulti(advances: Advance[], trip: string, participants: TripParticipant[]): number {
  return participants.reduce((sum, p) => sum + sumAdvances(advances, trip, p.username, p.name), 0);
}

export function sumAllowances(allowances: Allowance[], trip: string, username: string, name: string): number {
  return allowances
    .filter((a) => {
      if (!isTripMatch(a.trip || GENERAL_TRAVEL, trip)) return false;
      const au = (a.username || a.name || "").trim().toLowerCase();
      return (
        au === username.trim().toLowerCase() ||
        au === name.trim().toLowerCase() ||
        isPersonMatch(au, username) ||
        isPersonMatch(au, name)
      );
    })
    .reduce((sum, a) => {
      const n = parseAmount(a.amount);
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);
}

export function sumAllowancesMulti(allowances: Allowance[], trip: string, participants: TripParticipant[]): number {
  return participants.reduce((sum, p) => sum + sumAllowances(allowances, trip, p.username, p.name), 0);
}

export type CardSpendSummary = {
  card: string;
  last4: string;
  label: string;
  amount: number;
};

export function getCardExpensesBreakdownMulti(
  expenses: Expense[],
  trip: string,
  participants: TripParticipant[],
): CardSpendSummary[] {
  const map = new Map<string, { last4: string; amount: number }>();

  const tripExpenses = expenses.filter((e) => {
    if (!isTripMatch(e.trip || GENERAL_TRAVEL, trip)) return false;
    if ((e.paymentmethod || "").trim().toLowerCase() !== "card") return false;
    const eu = (e.username || e.name || "").trim().toLowerCase();
    return participants.some(
      (p) =>
        eu === p.username.trim().toLowerCase() ||
        eu === p.name.trim().toLowerCase() ||
        isPersonMatch(eu, p.username) ||
        isPersonMatch(eu, p.name),
    );
  });

  for (const e of tripExpenses) {
    const cur = (e.currency || "INR").trim().toUpperCase();
    const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
    if (Number.isNaN(n) || n <= 0) continue;

    const rawCard = (e.cardused || "").trim();
    const digits = rawCard.replace(/\D/g, "");
    const last4 = digits.length >= 4 ? digits.slice(-4) : (rawCard || "Other");
    const key = last4.toUpperCase();

    const existing = map.get(key) || { last4, amount: 0 };
    existing.amount += n;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      card: item.last4,
      last4: item.last4,
      label: item.last4.toLowerCase() === "other" ? "Other Card" : `Card ending in ${item.last4}`,
      amount: item.amount,
    }));
}