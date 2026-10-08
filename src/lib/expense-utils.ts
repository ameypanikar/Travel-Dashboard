import type { TravelEvent, Expense, Advance, Allowance } from "@/lib/dashboard-api";
import { canonicalizePersonName, isAssignedToMe, isPersonMatch, splitPassengerList } from "@/lib/role-filter";

export const GENERAL_TRAVEL = "General Travel";
export const CATEGORIES = ["Food", "Transport (Auto/Taxi)", "Petrol/Diesel", "Toll", "Misc. Expenses"];
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
  if (trimmed.length === 10 && trimmed.includes("-")) return trimmed;
  // expects DD-MM-YYYY or DD/MM/YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
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

export function sortTripOptions(options: string[], events: TravelEvent[]): string[] {
  const standingTours = new Set(
    events.filter(e => e.type === "Standing Tour").map(e => (e.eventname || "").trim())
  );

  return [...options].sort((a, b) => {
    if (a === GENERAL_TRAVEL) return -1;
    if (b === GENERAL_TRAVEL) return 1;
    const aIsStanding = standingTours.has(a);
    const bIsStanding = standingTours.has(b);
    if (aIsStanding && !bIsStanding) return 1;
    if (!aIsStanding && bIsStanding) return -1;
    return a.localeCompare(b);
  });
}

export function parseAmount(raw?: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
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
  const found = CATEGORIES.find((c) => c.toLowerCase() === clean);
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
    if ((r.trip || GENERAL_TRAVEL).trim() !== trip) continue;
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
    if ((e.trip || GENERAL_TRAVEL).trim() !== trip) continue;
    const eu = (e.username || e.name || "").trim().toLowerCase();
    if (
      eu !== username.trim().toLowerCase() &&
      eu !== name.trim().toLowerCase() &&
      !isPersonMatch(eu, username) &&
      !isPersonMatch(eu, name)
    ) continue;
    if ((e.category || "").trim() !== category) continue;
    const cur = (e.currency || "INR").trim().toUpperCase();
    const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
    if (!Number.isNaN(n)) total += n;
  }
  return total;
}

export function sumExpensesByPaymentMethod(expenses: Expense[], trip: string, username: string, name: string, methods: string[]): number {
  let total = 0;
  for (const e of expenses) {
    if ((e.trip || GENERAL_TRAVEL).trim() !== trip) continue;
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
      if ((a.trip || GENERAL_TRAVEL).trim() !== trip) return false;
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
    if ((r.trip || GENERAL_TRAVEL).trim() !== trip) continue;
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
    allowances: Allowance[];   // ← NEW
  },
  users: { name: string; username: string }[],
): TripParticipant[] {
  const keys = new Set<string>();
  [data.flights, data.hotels, data.trains, data.buses].forEach((list) => {
    collectAssigned(list, trip).forEach((v) => keys.add(v));
  });
  data.expenses.filter((e) => (e.trip || GENERAL_TRAVEL).trim() === trip).forEach((e) => {
    if (e.username) keys.add(e.username.trim().toLowerCase());
  });
  data.advances.filter((a) => (a.trip || GENERAL_TRAVEL).trim() === trip).forEach((a) => {
    if (a.username) keys.add(a.username.trim().toLowerCase());
  });
  data.allowances.filter((a) => (a.trip || GENERAL_TRAVEL).trim() === trip).forEach((a) => {   // ← NEW
    if (a.username) keys.add(a.username.trim().toLowerCase());
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
      if ((a.trip || GENERAL_TRAVEL).trim() !== trip) return false;
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