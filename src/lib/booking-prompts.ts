export type Kind = "flight" | "hotel" | "train" | "bus" | "uber";
export type BookableKind = Exclude<Kind, "uber">;

export const FLIGHT_PROMPT =
  "Extract ALL flight booking details and flight segments from this document. Return ONLY a raw JSON array of objects with no markdown, no backticks, just the JSON.\n\n" +
  "CRITICAL MULTI-LEG & LAYOVER RULES:\n" +
  "1. If the booking contains connecting flights, layovers, or multiple segments (e.g. Mumbai to Hong Kong, then Hong Kong to Taiwan, and return Taiwan to Hong Kong, then Hong Kong to Mumbai), you MUST extract EACH INDIVIDUAL FLIGHT LEG AS ITS OWN SEPARATE OBJECT in exact chronological flight order.\n" +
  "2. NEVER merge connecting flights into a single direct flight! If there are 4 flight legs, return an array of 4 objects.\n" +
  "3. If it is a one-way direct flight, return an array of 1 object.\n" +
  "4. If it is a round-trip direct flight, return an array of 2 objects (outbound, return).\n" +
  "5. For EVERY flight object in the array, include keys:\n" +
  "   - airline (e.g. Cathay Pacific, IndiGo, Emirates, Air India)\n" +
  "   - flight_number (e.g. CX 660, 6E 204, EK 512)\n" +
  "   - from_code (3-letter IATA airport code, e.g. BOM)\n" +
  "   - city_from (e.g. Mumbai)\n" +
  "   - to_code (3-letter IATA airport code, e.g. HKG)\n" +
  "   - city_to (e.g. Hong Kong)\n" +
  "   - departure_date (DD/MM/YYYY)\n" +
  "   - departure_time (HH:MM 24hr)\n" +
  "   - arrival_date (DD/MM/YYYY)\n" +
  "   - arrival_time (HH:MM 24hr)\n" +
  "   - confirmation_code (PNR or booking reference)\n" +
  "   - duration (flight duration HH:MM for this specific leg)\n" +
  "   - manage_link (airline check-in/manage link if present)\n" +
  "   - assigned_to (passenger full name(s) as written on the ticket, comma-separated if multiple, empty string if not found)\n" +
  "   - amount (the total invoice / ticket grand total paid across the ENTIRE booking combined, numeric value only without currency symbols or commas, e.g. 65000)\n" +
  "   - currency (ISO 4217 3-letter code, e.g. INR, USD, EUR)\n" +
  "   - booking_date (the date the ticket was actually booked/purchased, DD/MM/YYYY, empty string if not shown separately from travel date)\n" +
  "Use empty string for missing fields.";

export const HOTEL_PROMPT =
  "Extract hotel booking details and return ONLY a raw JSON object with no markdown, no backticks, just the JSON. Keys: hotel_name, address, city, checkin_date (DD/MM/YYYY), checkout_date (DD/MM/YYYY), confirmation_code, booking_link, cancellation_deadline (DD/MM/YYYY), booked_price, currency (ISO 4217 3-letter code, e.g. INR, USD, EUR — infer from the currency symbol/context if not written explicitly, empty string if genuinely unclear), booking_date (the date the booking was actually made/purchased, DD/MM/YYYY, as distinct from the check-in date — empty string if not shown separately), assigned_to (full name(s) of guest(s) as written on the booking, comma-separated if multiple, empty string if not found). Use empty string for missing fields.";

export const TRAIN_PROMPT =
  "Extract train booking details and return ONLY a raw JSON object with no markdown, no backticks, just the JSON. Keys: train_name, train_number, from_code (station code), city_from, to_code (station code), city_to, departure_date (DD/MM/YYYY), departure_time (HH:MM 24hr), arrival_date (DD/MM/YYYY), arrival_time (HH:MM 24hr), pnr, class, assigned_to (full name(s) of passenger(s) as written on the ticket, comma-separated if multiple, empty string if not found), amount (the total fare paid, numeric value only, no currency symbol or thousands separators, empty string if not found), currency (ISO 4217 3-letter code, e.g. INR, USD, EUR — infer from context if not written explicitly, empty string if genuinely unclear), booking_date (the date the ticket was actually booked/purchased, DD/MM/YYYY, as distinct from the travel date — empty string if not shown separately). Use empty string for missing fields.";

export const BUS_PROMPT =
  "Extract bus booking details and return ONLY a raw JSON object with no markdown, no backticks, just the JSON. Keys: bus_operator (the bus company/operator name), bus_number (service/bus number if shown), from (boarding point name or city), city_from, to (drop point name or city), city_to, departure_date (DD/MM/YYYY), departure_time (HH:MM 24hr), arrival_date (DD/MM/YYYY), arrival_time (HH:MM 24hr), ticket_number (booking/ticket reference number), assigned_to (full name(s) of passenger(s) as written on the ticket, comma-separated if multiple, empty string if not found), amount (the total fare paid, numeric value only, no currency symbol or thousands separators, empty string if not found), currency (ISO 4217 3-letter code, e.g. INR, USD, EUR — infer from context if not written explicitly, empty string if genuinely unclear), booking_date (the date the ticket was actually booked/purchased, DD/MM/YYYY, as distinct from the travel date — empty string if not shown separately). Use empty string for missing fields.";

export const FLIGHT_KEYS = [
  "airline",
  "flight_number",
  "from_code",
  "city_from",
  "to_code",
  "city_to",
  "departure_date",
  "departure_time",
  "arrival_date",
  "arrival_time",
  "confirmation_code",
  "duration",
  "manage_link",
  "assigned_to",
  "amount",
  "currency",
  "booking_date",
  "payment_method",
  "trip",
  "fx_rate",
  "inr_equivalent",
];
export const HOTEL_KEYS = [
  "hotel_name",
  "address",
  "city",
  "checkin_date",
  "checkout_date",
  "confirmation_code",
  "booking_link",
  "cancellation_deadline",
  "booked_price",
  "currency",
  "booking_date",
  "assigned_to",
  "payment_method",
  "trip",
  "fx_rate",
  "inr_equivalent",
];
export const TRAIN_KEYS = [
  "train_name",
  "train_number",
  "from_code",
  "city_from",
  "to_code",
  "city_to",
  "departure_date",
  "departure_time",
  "arrival_date",
  "arrival_time",
  "pnr",
  "class",
  "assigned_to",
  "amount",
  "currency",
  "booking_date",
  "payment_method",
  "trip",
  "fx_rate",
  "inr_equivalent",
];
export const BUS_KEYS = [
  "bus_operator",
  "bus_number",
  "from",
  "city_from",
  "to",
  "city_to",
  "departure_date",
  "departure_time",
  "arrival_date",
  "arrival_time",
  "ticket_number",
  "assigned_to",
  "amount",
  "currency",
  "booking_date",
  "payment_method",
  "trip",
  "fx_rate",
  "inr_equivalent",
];

export const PROMPTS: Record<BookableKind, string> = {
  flight: FLIGHT_PROMPT,
  hotel: HOTEL_PROMPT,
  train: TRAIN_PROMPT,
  bus: BUS_PROMPT,
};
export const KEYS: Record<BookableKind, string[]> = {
  flight: FLIGHT_KEYS,
  hotel: HOTEL_KEYS,
  train: TRAIN_KEYS,
  bus: BUS_KEYS,
};
export const CLIENT_COMPUTED_KEYS = new Set([
  "trip",
  "fx_rate",
  "inr_equivalent",
  "payment_method",
]);
