import type { Bus, Expense, Flight, Hotel, Train, TravelEvent } from "@/lib/dashboard-api";
import type { TabKey } from "@/components/dashboard/Tabs";

export type SearchHit = {
  id: string;
  tab: TabKey;
  trip: string | null;
  heading: string;
  detail: string;
  keywords: string;
};

function field(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = record[key];
    if (direct != null && String(direct).trim()) return String(direct).trim();
    const lower = record[key.toLowerCase()];
    if (lower != null && String(lower).trim()) return String(lower).trim();
  }
  return "";
}

function tripOf(record: Record<string, unknown>): string | null {
  const trip = field(record, "trip");
  return trip || null;
}

export function buildTravelSearchHits(input: {
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  events: TravelEvent[];
  expenses: Expense[];
}): SearchHit[] {
  const hits: SearchHit[] = [];

  input.flights.forEach((flight, index) => {
    const r = flight as unknown as Record<string, unknown>;
    const from = field(r, "fromCode", "fromcode", "fromCity", "cityfrom");
    const to = field(r, "toCode", "tocode", "toCity", "cityto");
    const pnr = field(r, "confirmationCode", "confirmationcode");
    const airline = field(r, "airline");
    const date = field(r, "departureDate", "departuredate");
    hits.push({
      id: `flight-${field(r, "sourceRow", "sourcerow") || index}-${pnr}`,
      tab: "flights",
      trip: tripOf(r),
      heading: [from, to].filter(Boolean).join(" → ") || airline || "Flight",
      detail: [airline, pnr && `PNR ${pnr}`, date].filter(Boolean).join(" · "),
      keywords: [from, to, pnr, airline, date, tripOf(r) ?? ""].join(" "),
    });
  });

  input.hotels.forEach((hotel, index) => {
    const r = hotel as unknown as Record<string, unknown>;
    const name = field(r, "hotelName", "hotelname");
    const city = field(r, "city");
    const code = field(r, "confirmationCode", "confirmationcode");
    const checkIn = field(r, "checkInDate", "checkindate");
    hits.push({
      id: `hotel-${field(r, "sourceRow", "sourcerow") || index}-${code}`,
      tab: "hotels",
      trip: tripOf(r),
      heading: name || city || "Hotel",
      detail: [city, code && `Conf ${code}`, checkIn].filter(Boolean).join(" · "),
      keywords: [name, city, code, checkIn, tripOf(r) ?? ""].join(" "),
    });
  });

  input.trains.forEach((train, index) => {
    const r = train as Record<string, unknown>;
    const name = field(r, "trainname", "trainName");
    const number = field(r, "trainnumber", "trainNumber");
    const pnr = field(r, "pnr");
    const from = field(r, "fromstation", "from");
    const to = field(r, "tostation", "to");
    hits.push({
      id: `train-${field(r, "sourcerow") || index}-${pnr || number}`,
      tab: "trains",
      trip: tripOf(r),
      heading: [from, to].filter(Boolean).join(" → ") || name || "Train",
      detail: [name, number, pnr && `PNR ${pnr}`].filter(Boolean).join(" · "),
      keywords: [name, number, pnr, from, to, tripOf(r) ?? ""].join(" "),
    });
  });

  input.buses.forEach((bus, index) => {
    const r = bus as Record<string, unknown>;
    const operator = field(r, "operatorname", "operator");
    const from = field(r, "fromstation", "from", "boarding");
    const to = field(r, "tostation", "to", "drop");
    const ticket = field(r, "ticketnumber", "ticketno");
    hits.push({
      id: `bus-${field(r, "sourcerow") || index}-${ticket}`,
      tab: "buses",
      trip: tripOf(r),
      heading: [from, to].filter(Boolean).join(" → ") || operator || "Bus",
      detail: [operator, ticket].filter(Boolean).join(" · "),
      keywords: [operator, from, to, ticket, tripOf(r) ?? ""].join(" "),
    });
  });

  input.events.forEach((event, index) => {
    const r = event as unknown as Record<string, unknown>;
    const name = field(r, "eventname");
    const location = field(r, "location");
    const start = field(r, "startdate");
    hits.push({
      id: `event-${field(r, "sourcerow") || index}-${name}`,
      tab: "events",
      trip: tripOf(r),
      heading: name || "Event",
      detail: [location, start].filter(Boolean).join(" · "),
      keywords: [name, location, start, field(r, "type"), tripOf(r) ?? ""].join(" "),
    });
  });

  input.expenses.forEach((expense, index) => {
    const r = expense as unknown as Record<string, unknown>;
    const description = field(r, "description");
    const category = field(r, "category");
    const amount = field(r, "amount");
    const currency = field(r, "currency");
    hits.push({
      id: `expense-${field(r, "sourcerow") || index}`,
      tab: "spend",
      trip: tripOf(r),
      heading: description || category || "Expense",
      detail: [category, amount && `${currency} ${amount}`.trim()].filter(Boolean).join(" · "),
      keywords: [description, category, amount, field(r, "name"), tripOf(r) ?? ""].join(" "),
    });
  });

  return hits;
}

export function filterSearchHits(hits: SearchHit[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];
  return hits
    .filter((hit) => `${hit.heading} ${hit.detail} ${hit.keywords}`.toLowerCase().includes(needle))
    .slice(0, 24);
}
