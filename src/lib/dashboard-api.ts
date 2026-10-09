import { encryptField } from "./note-crypto";
import { getSessionToken } from "./auth";
import { getSupabase } from "./supabase";
import { saveDashboardOfflineSnapshot, getDashboardOfflineSnapshot, cacheDocument } from "./offline-storage";

export type Flight = {
  type: "flight";
  sourceSheet: string;
  sourceRow: number;
  airline: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  confirmationCode: string;
  bookingStatus: string;
  duration: string;
  manageLink: string;
  departureIso?: string;
  arrivalIso?: string;
  isPending: boolean;
  trip?: string;
  fields?: Record<string, string>;
  sourcerow?: number;
};

export type Hotel = {
  type: "hotel";
  sourceSheet: string;
  sourceRow: number;
  hotelName: string;
  address: string;
  city: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  bookingStatus: string;
  bookingLink?: string;
  mapsLink?: string;
  latitude?: string;
  longitude?: string;
  phone?: string;
  checkInIso?: string;
  checkOutIso?: string;
  isPending: boolean;
  trip?: string;
  numberofrooms?: string;
  roomassignments?: string;
  fields?: Record<string, string>;
  sourcerow?: number;
};

export type Train = Record<string, string>;
export type Bus = Record<string, string>;

export type TravelEvent = {
  eventname: string;
  startdate: string;
  enddate: string;
  location: string;
  type: string;
  ourrole: string;
  notes: string;
  status?: string;
  sourcerow?: number;
};

export type Expense = {
  sourcerow: number;
  timestamp: string;
  username: string;
  name: string;
  trip: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
  receipturl: string;
  fxrate?: string;
  inrequivalent?: string;
  paymentmethod?: string;
  receiptmimetype?: string;
  cardused?: string;
  expensedate?: string;
};

export type NoteReminder = {
  sourcerow: number;
  timestamp: string;
  username: string;
  name: string;
  type: "note" | "reminder";
  text: string;
  duedate: string;
  duetime: string;
  category: string;
  status: string;
};
export type Advance = {
  sourcerow: number;
  timestamp: string;
  username: string;
  name: string;
  trip: string;
  amount: string;
  method: string;
  givenby: string;
};

export type Allowance = {
  sourcerow: number;
  timestamp: string;
  username: string;
  name: string;
  trip: string;
  amount: string;
  method: string;
  setby: string;
  date?: string;
};
export type PendingItem = (Flight | Hotel) & { isPending: true };

export type DashboardData = {
  ok: boolean;
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  events: TravelEvent[];
  pending: PendingItem[];
  expenses: Expense[];
  advances: Advance[];
  documents: Document[];
  updatedAt: string;
  allowances: Allowance[];
  notesReminders: NoteReminder[];
  users: any[];
  error?: string;
};

export async function fetchDashboard(): Promise<DashboardData> {
  try {
    const [
      { data: flightsData },
      { data: hotelsData },
      { data: trainsData },
      { data: busesData },
      { data: eventsData },
      { data: expensesData },
      { data: advancesData },
      { data: allowancesData },
      { data: notesData },
      { data: docsData },
      { data: usersData }
    ] = await Promise.all([
      getSupabase().from('flights').select('*'),
      getSupabase().from('hotels').select('*'),
      getSupabase().from('trains').select('*'),
      getSupabase().from('buses').select('*'),
      getSupabase().from('events').select('*'),
      getSupabase().from('expenses').select('*'),
      getSupabase().from('advances').select('*'),
      getSupabase().from('allowances').select('*'),
      getSupabase().from('notes_reminders').select('*'),
      getSupabase().from('documents').select('*'),
      getSupabase().from('users').select('*')
    ]);

    const mapSourceRow = (items: any[] | null) => (items || []).map(item => ({ ...item, sourcerow: item.id }));

    const result: DashboardData = {
      ok: true,
      flights: mapSourceRow(flightsData) as any,
      hotels: mapSourceRow(hotelsData) as any,
      trains: mapSourceRow(trainsData) as any,
      buses: mapSourceRow(busesData) as any,
      events: mapSourceRow(eventsData) as any,
      pending: [],
      expenses: mapSourceRow(expensesData) as any,
      advances: mapSourceRow(advancesData) as any,
      allowances: (allowancesData || []).map(item => ({
        ...item,
        sourcerow: item.id,
        date: item.timestamp ? (item.timestamp.includes("T") ? item.timestamp.split("T")[0] : item.timestamp.slice(0, 10)) : ""
      })) as any,
      notesReminders: mapSourceRow(notesData) as any,
      documents: mapSourceRow(docsData) as any,
      users: mapSourceRow(usersData) as any,
      updatedAt: new Date().toISOString()
    };

    // Save offline snapshot for in-flight/airplane mode access
    saveDashboardOfflineSnapshot(result);

    // Pre-cache document URLs in background if possible
    if (docsData && Array.isArray(docsData)) {
      setTimeout(() => {
        for (const doc of docsData) {
          if (doc.fileurl) cacheDocument(doc.fileurl).catch(() => {});
        }
      }, 1000);
    }

    return result;
  } catch (err) {
    // If offline or network error, attempt to load cached snapshot
    const offlineSnapshot = getDashboardOfflineSnapshot<DashboardData>();
    if (offlineSnapshot) {
      console.info("Using cached offline dashboard snapshot");
      return offlineSnapshot;
    }
    throw err;
  }
}

const GEMINI_CACHE_KEY = "gemini_api_key";

export async function fetchGeminiKey(): Promise<string> {
  try {
    const { data, error } = await getSupabase().from('config').select('value').eq('key', 'gemini_api_key').maybeSingle();
    if (!error && data?.value) {
      localStorage.setItem(GEMINI_CACHE_KEY, data.value);
      return data.value;
    }
  } catch (e) {
    // Ignore network errors and fallback
  }
  return localStorage.getItem(GEMINI_CACHE_KEY) || "";
}

const GEMINI_MODEL_CACHE_KEY = "gemini_model";
const GEMINI_MODEL_FALLBACK = "gemini-3.1-flash-lite";

export async function fetchGeminiModel(): Promise<string> {
  try {
    const { data, error } = await getSupabase().from('config').select('value').eq('key', 'gemini_model').maybeSingle();
    if (!error && data?.value) {
      localStorage.setItem(GEMINI_MODEL_CACHE_KEY, data.value);
      return data.value;
    }
  } catch (e) {
    // Ignore network errors and fallback
  }
  return localStorage.getItem(GEMINI_MODEL_CACHE_KEY) || GEMINI_MODEL_FALLBACK;
}

export async function saveGeminiModel(newModel: string): Promise<void> {
  const { error } = await getSupabase().from('config').upsert({ key: 'gemini_model', value: newModel });
  if (error) throw new Error("Could not save model");
  localStorage.setItem(GEMINI_MODEL_CACHE_KEY, newModel);
}

export function getCachedGeminiModel(): string {
  return localStorage.getItem(GEMINI_MODEL_CACHE_KEY) || GEMINI_MODEL_FALLBACK;
}

export async function saveGeminiKey(newKey: string): Promise<void> {
  const { error } = await getSupabase().from('config').upsert({ key: 'gemini_api_key', value: newKey });
  if (error) throw new Error("Could not save config");
  localStorage.setItem(GEMINI_CACHE_KEY, newKey);
}

export function getCachedGeminiKey(): string {
  return localStorage.getItem(GEMINI_CACHE_KEY) || "";
}

export async function updateEventStatus(params: { sourceRow: number; status: string }) {
  const { error } = await getSupabase().from('events').update({ status: params.status }).eq('id', params.sourceRow);
  if (error) throw new Error("Failed to update event status");
}

export async function appendEvent(fields: {
  eventname: string;
  startdate: string;
  enddate: string;
  location: string;
  type: string;
  ourrole: string;
  notes: string;
}): Promise<void> {
  const { error } = await getSupabase().from('events').insert({ ...fields });
  if (error) throw new Error("Failed to save event");
}

export async function updateEventWithCascade(
  sourceRow: number,
  oldEventName: string,
  fields: {
    eventname: string;
    startdate: string;
    enddate: string;
    location: string;
    type: string;
    ourrole: string;
    notes: string;
  }
): Promise<void> {
  const supabase = getSupabase();
  
  // 1. Update the event
  const { error: eventError } = await supabase.from('events').update(serializeDates({ ...fields })).eq('id', sourceRow);
  if (eventError) throw new Error("Failed to update event");

  // 2. Cascade event name changes to related tables
  if (oldEventName && fields.eventname && oldEventName !== fields.eventname) {
    const tablesToUpdate = ['flights', 'hotels', 'trains', 'buses', 'expenses', 'advances', 'allowances'];
    
    for (const table of tablesToUpdate) {
      await supabase.from(table).update({ trip: fields.eventname }).eq('trip', oldEventName);
    }
  }
}


function serializeDates(fields: Record<string, any>) {
  const res = { ...fields };
  for (const k of Object.keys(res)) {
    const val = res[k];
    if (typeof val === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim())) {
      const parts = val.trim().split('/');
      res[k] = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return res;
}

export async function addBooking(kind: string, fields: any): Promise<void> {
  const table = kind === "bus" ? "buses" : kind + "s";
  const flatFields: Record<string, any> = {};
  
  for (const [k, v] of Object.entries(fields)) {
    let key = k.replace(/_/g, "");
    
    if (kind === "bus") {
      if (key === "from") key = "from_station";
      if (key === "to") key = "to_station";
    }
    
    if (kind === "flight" && key === "flightnumber") {
      continue;
    }
    
    flatFields[key] = v;
  }
  
  if (kind === "flight" && fields.flight_number) {
    flatFields.airline = flatFields.airline 
      ? `${flatFields.airline} ${fields.flight_number}` 
      : fields.flight_number;
  }

  let { error } = await getSupabase().from(table).insert(serializeDates(flatFields));

  while (error && (error.code === 'PGRST204' || error.message?.includes('Could not find the'))) {
    const match = error.message.match(/Could not find the '([^']+)' column/);
    if (match && match[1] && match[1] in flatFields) {
      delete flatFields[match[1]];
      const res = await getSupabase().from(table).insert(serializeDates(flatFields));
      error = res.error;
    } else {
      break;
    }
  }

  if (error) throw new Error("Failed to save booking: " + error.message);
}

export type Document = {
  type: "flight" | "hotel";
  category: "ticket" | "boardingpass" | "confirmation" | "digiyatra";
  confirmationcode: string;
  passengername: string;
  fileurl: string;
  uploadedat: string;
};

export async function updateBookingStatus(params: {
  kind: "flight" | "hotel" | "train" | "bus" | "event";
  sourceRow: number;
  status: "Booked" | "Cancelled";
  verifyValue: string;
}): Promise<void> {
  const table = params.kind === "bus" ? "buses" : params.kind + "s";
  const payload: Record<string, any> = params.kind === "event"
    ? { status: params.status }
    : { bookingstatus: params.status };

  let { error } = await getSupabase().from(table).update(serializeDates(payload)).eq('id', params.sourceRow);

  while (error && (error.code === 'PGRST204' || error.message?.includes('Could not find the'))) {
    const match = error.message.match(/Could not find the '([^']+)' column/);
    if (match && match[1] && match[1] in payload) {
      delete payload[match[1]];
      const res = await getSupabase().from(table).update(serializeDates(payload)).eq('id', params.sourceRow);
      error = res.error;
    } else {
      break;
    }
  }

  if (error) {
    console.error("Failed to update booking status in Supabase:", error);
    throw new Error(error.message || "Failed to update booking status");
  }
}

export async function removeBooking(params: {
  kind: "flight" | "hotel" | "train" | "bus" | "event";
  sourceRow: number;
  verifyValue: string;
}): Promise<void> {
  const table = params.kind === "bus" ? "buses" : params.kind + "s";
  const { error } = await getSupabase().from(table).delete().eq('id', params.sourceRow);
  if (error) throw new Error("Failed to remove booking");
}

export async function uploadDocument(params: {
  type: "flight" | "hotel";
  category: "ticket" | "boardingpass" | "confirmation" | "digiyatra";
  confirmationCode: string;
  passengerName?: string;
  file: File;
}): Promise<string> {
  const fileName = `${Date.now()}_${params.file.name}`;
  const { data: uploadData, error: uploadError } = await getSupabase().storage.from('documents').upload(fileName, params.file);
  
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: { publicUrl } } = getSupabase().storage.from('documents').getPublicUrl(fileName);

  const { error: dbError } = await getSupabase().from('documents').insert(serializeDates({
    type: params.type,
    category: params.category,
    confirmationcode: params.confirmationCode,
    passengername: params.passengerName || '',
    fileurl: publicUrl,
    uploadedat: new Date().toISOString()
  }));

  if (dbError) throw new Error("Failed to save document metadata");

  return publicUrl;
}

export async function updateBookingFields(params: {
  kind: "flight" | "hotel" | "train" | "bus";
  sourceRow: number;
  verifyValue: string;
  fields: Record<string, string>;
}): Promise<void> {
  const table = params.kind === "bus" ? "buses" : params.kind + "s";
  const payload: Record<string, any> = { ...params.fields };

  let { error } = await getSupabase().from(table).update(serializeDates(payload)).eq('id', params.sourceRow);

  // If a column is missing in the database schema (e.g. amounttype not in Postgres table),
  // dynamically strip the missing column and retry so saving never fails due to schema divergence.
  while (error && (error.code === 'PGRST204' || error.message?.includes('Could not find the'))) {
    const match = error.message.match(/Could not find the '([^']+)' column/);
    if (match && match[1] && match[1] in payload) {
      delete payload[match[1]];
      const res = await getSupabase().from(table).update(serializeDates(payload)).eq('id', params.sourceRow);
      error = res.error;
    } else {
      break;
    }
  }

  if (error) {
    console.error("Failed to update booking fields in Supabase:", error);
    throw new Error(error.message || "Failed to update fields");
  }
}

export async function fetchFxRate(
  isoDate: string,
  fromCurrency: string,
): Promise<{ rate: number; dateUsed: string } | null> {
  if (!isoDate || !fromCurrency || fromCurrency.trim().toUpperCase() === "INR") return null;
  try {
    const url = `https://api.frankfurter.dev/v2/rates?date=${isoDate}&base=${fromCurrency.trim().toUpperCase()}&quotes=INR`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    let rate: number | undefined;
    let dateUsed = isoDate;
    
    if (Array.isArray(json) && json.length > 0) {
      rate = json[0].rate;
      dateUsed = json[0].date || isoDate;
    } else {
      rate = json?.rates?.INR;
      dateUsed = json?.date || isoDate;
    }
    
    if (typeof rate !== "number") return null;
    return { rate, dateUsed };
  } catch {
    return null;
  }
}

export async function addExpense(params: {
  username: string;
  name: string;
  trip: string;
  category: string;
  amount: string;
  currency: string;
  description: string;
  fxRate?: string;
  inrEquivalent?: string;
  paymentMethod: string;
  cardUsed?: string;
  expenseDate?: string;
  file?: File | null;
}): Promise<string> {
  let receipturl = '';
  let receiptmimetype = '';

  if (params.file) {
    const fileName = `${Date.now()}_${params.file.name}`;
    const { error: uploadError } = await getSupabase().storage.from('documents').upload(fileName, params.file);
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    const { data: { publicUrl } } = getSupabase().storage.from('documents').getPublicUrl(fileName);
    receipturl = publicUrl;
    receiptmimetype = params.file.type || "application/octet-stream";
  }

  const { error } = await getSupabase().from('expenses').insert(serializeDates({
    timestamp: new Date().toISOString(),
    username: params.username,
    name: params.name || '',
    trip: params.trip || 'General Travel',
    category: params.category || 'Misc. Expenses',
    amount: params.amount,
    currency: params.currency || 'INR',
    description: params.description || '',
    receipturl,
    fxrate: params.fxRate || '',
    inrequivalent: params.inrEquivalent || '',
    paymentmethod: params.paymentMethod || 'Cash',
    receiptmimetype,
    cardused: params.cardUsed || '',
    expensedate: params.expenseDate || ''
  }));

  if (error) throw new Error("Failed to save expense");
  return receipturl;
}

export async function updateExpense(params: {
  sourceRow: number;
  username: string;
  fields: Record<string, string>;
  file?: File | null;
}): Promise<void> {
  let receipturl = undefined;
  let receiptmimetype = undefined;

  if (params.file) {
    const fileName = `${Date.now()}_${params.file.name}`;
    const { error: uploadError } = await getSupabase().storage.from('documents').upload(fileName, params.file);
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    const { data: { publicUrl } } = getSupabase().storage.from('documents').getPublicUrl(fileName);
    receipturl = publicUrl;
    receiptmimetype = params.file.type || "application/octet-stream";
  }

  // Normalize field keys to Supabase column names (all lowercase)
  const updatePayload: Record<string, any> = {};
  for (const [key, value] of Object.entries(params.fields)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === "paymentmethod") updatePayload.paymentmethod = value;
    else if (lowerKey === "fxrate") updatePayload.fxrate = value;
    else if (lowerKey === "inrequivalent") updatePayload.inrequivalent = value;
    else if (lowerKey === "cardused") updatePayload.cardused = value;
    else if (lowerKey === "expensedate") updatePayload.expensedate = value;
    else updatePayload[lowerKey] = value;
  }

  if (receipturl) updatePayload.receipturl = receipturl;
  if (receiptmimetype) updatePayload.receiptmimetype = receiptmimetype;

  const targetId = params.sourceRow || (params as any).id;
  const { error } = await getSupabase().from('expenses').update(serializeDates(updatePayload)).eq('id', targetId);
  if (error) {
    console.error("Failed to update expense in Supabase:", error);
    throw new Error(error.message || "Failed to update expense");
  }
}


export async function removeExpense(params: {
  sourceRow: number;
  username: string;
}): Promise<void> {
  const { error } = await getSupabase().from('expenses').delete().eq('id', params.sourceRow);
  if (error) throw new Error("Failed to remove expense");
}

export async function addAdvance(params: {
  username: string;
  name: string;
  trip: string;
  amount: string;
  method: string;
  givenBy: string;
}): Promise<void> {
  const { error } = await getSupabase().from('advances').insert(serializeDates({
    timestamp: new Date().toISOString(),
    username: params.username,
    name: params.name || '',
    trip: params.trip || 'General Travel',
    amount: params.amount,
    method: params.method || 'Cash',
    givenby: params.givenBy || ''
  }));
  if (error) throw new Error("Failed to save advance");
}

export async function removeAdvance(sourceRow: number): Promise<void> {
  const { error } = await getSupabase().from('advances').delete().eq('id', sourceRow);
  if (error) throw new Error("Failed to remove advance");
}

export async function addNoteReminder(params: {
  username: string;
  name: string;
  type: "note" | "reminder";
  text: string;
  duedate?: string;
  duetime?: string;
  category?: string;
}): Promise<void> {
  const textEnc = await encryptField(params.text);
  const catEnc = await encryptField(params.category || "");

  const { error } = await getSupabase().from('notes_reminders').insert(serializeDates({
    timestamp: new Date().toISOString(),
    username: params.username,
    name: params.name || '',
    type: params.type,
    text: textEnc,
    duedate: params.duedate || '',
    category: catEnc,
    status: params.type === "reminder" ? "Pending" : "",
    duetime: params.duetime || ''
  }));
  if (error) throw new Error("Failed to save note/reminder");
}

export async function updateNoteReminder(params: {
  sourceRow: number;
  username: string;
  fields: Record<string, string>;
}): Promise<void> {
  const encryptedFields: Record<string, string> = { ...params.fields };
  for (const key of ["text", "category"]) {
    if (key in encryptedFields) {
      encryptedFields[key] = await encryptField(encryptedFields[key]);
    }
  }
  const { error } = await getSupabase().from('notes_reminders').update(encryptedFields).eq('id', params.sourceRow);
  if (error) throw new Error("Failed to update note/reminder");
}

export async function removeNoteReminder(params: {
  sourceRow: number;
  username: string;
}): Promise<void> {
  const { error } = await getSupabase().from('notes_reminders').delete().eq('id', params.sourceRow);
  if (error) throw new Error("Failed to remove note/reminder");
}

export async function addUser(params: {
  firstName: string;
  lastName: string;
  password: string; 
  role: string;
  email?: string;
}): Promise<string> {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  
  const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  const username = `${formattedFirstName} ${lastName.charAt(0).toUpperCase()}`;
  const fullNameUpper = `${firstName} ${lastName}`.toUpperCase();
  
  const { error } = await getSupabase().from('users').insert({
    username,
    name: fullNameUpper,
    password: params.password,
    role: params.role,
    email: params.email || ''
  });
  if (error) throw new Error(error.message || "Failed to add user");
  return username;
}

export async function removeUser(username: string): Promise<void> {
  const { error } = await getSupabase().from('users').delete().eq('username', username);
  if (error) throw new Error("Failed to remove user");
}

export async function addAllowance(params: {
  username: string;
  name: string;
  trip: string;
  amount: string;
  method: string;
  setBy: string;
  date?: string;
}): Promise<void> {
  let ts = new Date().toISOString();
  if (params.date) {
    if (params.date.includes("T")) {
      ts = params.date;
    } else {
      ts = new Date(`${params.date}T12:00:00.000Z`).toISOString();
    }
  }

  const { error } = await getSupabase().from('allowances').insert(serializeDates({
    timestamp: ts,
    username: params.username,
    name: params.name || '',
    trip: params.trip || 'General Travel',
    amount: params.amount,
    method: params.method || 'Cash',
    setby: params.setBy || ''
  }));
  if (error) throw new Error("Failed to save allowance");
}

export async function removeAllowance(sourceRow: number): Promise<void> {
  const { error } = await getSupabase().from('allowances').delete().eq('id', sourceRow);
  if (error) throw new Error("Failed to remove allowance");
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Not fully implemented securely without a backend, but we can do a dummy impl for now.
  // We'll leave it as a no-op since it needs a backend to send emails safely.
}

export async function resetPasswordWithToken(token: string, hashedPassword: string): Promise<void> {
  // Not fully implemented securely without a backend.
}