import { useMemo, useState, useEffect } from "react";
import type { Flight, Hotel, Train, TravelEvent, NoteReminder } from "@/lib/dashboard-api";
import { parseAnyDate, isSameDay, startOfDay, formatTime, formatDayLabel } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, Plane, Hotel as HotelIcon, Bed, TrainFront, Bus as BusIcon, CalendarCheck, MapPin, Users, ChevronDown, BookOpen, Bell } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { filterByRole, isAssignedToMe, FULL_ACCESS_ROLES, deduplicateAssignees, isPersonMatch, setGlobalKnownUsers, canonicalizePersonName, splitPassengerList } from "@/lib/role-filter";
import { getSessionUser } from "@/lib/auth";
import { useDecryptedNotesReminders } from "@/lib/useDecryptedNotesReminders";
import { PersonFilterBar } from "./PersonFilterBar";
import type { Bus } from "./BusCard";

type Props = {
  flights: Flight[];
  hotels: Hotel[];
  trains?: Train[];
  buses?: Bus[];
  events?: TravelEvent[];
  notesReminders?: NoteReminder[];
  users?: { name: string; username: string; role: string }[];
};

type DayEvents = {
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  events: TravelEvent[];
  notes: NoteReminder[];
  reminders: NoteReminder[];
};

const ROLE_COLORS: Record<string, string> = {
  "Stall Holder": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Visitor":      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Organiser":    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "Sponsor":      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toISO = (dateStr?: string): string => {
  if (!dateStr) return "";
  const trimmed = String(dateStr).trim();
  if (trimmed.length === 10 && trimmed.indexOf("-") === 4) return trimmed;
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    const [dd, mm, yyyy] = parts;
    if (yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
};

const flightIso = (f: unknown): string => toISO((f as Record<string, string>)?.departuredate);
const trainIso = (t: unknown): string => toISO((t as Record<string, string>)?.departuredate);
const busIso = (b: unknown): string => toISO((b as Record<string, string>)?.departuredate);

const getAssignees = (r: Record<string, string>): string[] =>
  splitPassengerList(r.assignedto);

const notCancelled = (r: Record<string, string>): boolean =>
  (r.bookingstatus || "").trim().toLowerCase() !== "cancelled";

export function MonthlyView({
  flights: rawFlights,
  hotels: rawHotels,
  trains: rawTrains = [],
  buses: rawBuses = [],
  events = [],
  notesReminders = [],
  users = [],
}: Props) {
  useEffect(() => {
    if (users && users.length > 0) {
      setGlobalKnownUsers(users);
    }
  }, [users]);

  const user = getSessionUser();
  const canSeeAll = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());

  const flights = (filterByRole(rawFlights as unknown as Record<string, unknown>[], users) as unknown as Flight[])
    .filter((f) => notCancelled(f as unknown as Record<string, string>));
  const hotels = (filterByRole(rawHotels as unknown as Record<string, unknown>[], users) as unknown as Hotel[])
    .filter((h) => notCancelled(h as unknown as Record<string, string>));
  const trains = (filterByRole(rawTrains as unknown as Record<string, unknown>[], users) as unknown as Train[])
    .filter((t) => notCancelled(t as unknown as Record<string, string>));
  const buses = (filterByRole(rawBuses as unknown as Record<string, unknown>[], users) as unknown as Bus[])
    .filter((b) => notCancelled(b as unknown as Record<string, string>));
  // Only show active, standard events on the calendar. Standing Tours are hidden from the calendar view to prevent clutter.
  events = events.filter((e) => (e.status || "Booked").trim().toLowerCase() !== "cancelled" && e.type !== "Standing Tour");
  // Notes/Reminders are private to the logged-in user. Match against both username and name due to database schema variations.
  const myNotesRemindersRaw = useMemo(
    () =>
      notesReminders.filter((n) => {
        const nu = (n.username || "").trim().toLowerCase();
        const uUser = (user?.username || "").trim().toLowerCase();
        const uName = (user?.name || "").trim().toLowerCase();
        return (uUser && nu === uUser) || (uName && nu === uName);
      }),
    [notesReminders, user?.username, user?.name],
  );
  const myNotesReminders = useDecryptedNotesReminders(myNotesRemindersRaw);

  const today = startOfDay(new Date());
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [assignedFilter, setAssignedFilter] = useState<string>("me");

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const allAssignees = useMemo(() => {
    const list: string[] = [];
    [...flights, ...hotels, ...trains, ...buses].forEach((item) => {
      getAssignees(item as unknown as Record<string, string>).forEach((name) => list.push(name));
    });
    return deduplicateAssignees(list, users);
  }, [flights, hotels, trains, buses, users]);

  const personFilter = <T,>(items: T[]): T[] => {
    if (!canSeeAll || assignedFilter === "all") return items;
    if (assignedFilter === "me") {
      return items.filter((it) => {
        const r = it as unknown as Record<string, string>;
        return (
          (Boolean(user?.name) && isPersonMatch(r.assignedto, user!.name, users)) ||
          (Boolean(user?.username) && isPersonMatch(r.assignedto, user!.username, users)) ||
          isAssignedToMe(r.assignedto, user?.name || "") ||
          isAssignedToMe(r.assignedto, user?.username || "")
        );
      });
    }
    return items.filter((it) => {
      const r = it as unknown as Record<string, string>;
      return isPersonMatch(r.assignedto, assignedFilter, users);
    });
  };

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(startOfDay(d));
    }
    return out;
  }, [cursor]);

  const eventsByDay = (day: Date): DayEvents => {
    const fl = personFilter(flights).filter((f) => {
      const d = parseAnyDate(flightIso(f));
      return d && isSameDay(d, day);
    });
    const ht = personFilter(hotels).filter((h) => {
      const startIso = toISO((h as unknown as Record<string, string>)?.checkindate);
      const endIso = toISO((h as unknown as Record<string, string>)?.checkoutdate);
      const start = parseAnyDate(startIso);
      const end = parseAnyDate(endIso) ?? start;
      if (!start) return false;
      const t = startOfDay(day).getTime();
      return t >= startOfDay(start).getTime() && t <= startOfDay(end!).getTime();
    });
    const tr = personFilter(trains).filter((t) => {
      const d = parseAnyDate(trainIso(t));
      return d && isSameDay(d, day);
    });
    const bs = personFilter(buses).filter((b) => {
      const d = parseAnyDate(busIso(b));
      return d && isSameDay(d, day);
    });
    const ev = events.filter((e) => {
      const start = parseAnyDate(e.startdate);
      const end = parseAnyDate(e.enddate) ?? start;
      if (!start) return false;
      const t = startOfDay(day).getTime();
      return t >= startOfDay(start).getTime() && t <= startOfDay(end!).getTime();
    });
    const notes = myNotesReminders.filter((n) => {
      if (n.type !== "note") return false;
      const d = parseAnyDate(n.timestamp);
      return d && isSameDay(d, day);
    });
    const reminders = myNotesReminders.filter((n) => {
      if (n.type !== "reminder") return false;
      const d = parseAnyDate(n.duedate);
      return d && isSameDay(d, day);
    });
    return { flights: fl, hotels: ht, trains: tr, buses: bs, events: ev, notes, reminders };
  };

  const openEvents = openDay ? eventsByDay(openDay) : null;
  const hasAny = (e: DayEvents) =>
    e.flights.length + e.hotels.length + e.trains.length + e.buses.length + e.events.length + e.notes.length + e.reminders.length > 0;
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-lg p-2 hover:bg-accent-soft"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-bold">{monthLabel}</div>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-lg p-2 hover:bg-accent-soft"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {canSeeAll && (
        <PersonFilterBar
          assignedFilter={assignedFilter}
          onSelectFilter={setAssignedFilter}
          allAssignees={allAssignees}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
        />
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = isSameDay(d, today);
          const ev = eventsByDay(d);
          const any = hasAny(ev);
          return (
            <button
              key={i}
              onClick={() => any && setOpenDay(d)}
              disabled={!any}
              className={cn(
                "relative flex min-h-[56px] flex-col items-stretch rounded-lg border p-1 text-left transition sm:min-h-[80px]",
                inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground",
                isToday ? "border-accent" : "border-border",
                any ? "cursor-pointer hover:bg-accent-soft" : "cursor-default"
              )}
            >
              {/* Event / note / reminder markers — stacked top-right */}
              <div className="absolute right-1 top-1 flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-0.5">
                {ev.notes.length > 0 && (
                  <BookOpen className="h-3 w-3 text-amber-800 dark:text-amber-400" aria-label="note" />
                )}
                {ev.events.length > 0 && (
                  <CalendarCheck className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-label="event" />
                )}
              </div>
              {ev.reminders.length > 0 && (
                <Bell
                  className="h-3 w-3 text-yellow-500"
                  fill="currentColor"
                  stroke="black"
                  strokeWidth={1.5}
                  aria-label="reminder"
                />
              )}
            </div>

              <div className={cn("text-[11px] font-semibold", isToday && "text-accent")}>
                {d.getDate()}
              </div>

              <div className="mt-auto flex items-center gap-1">
                {ev.flights.length > 0 && (
                  <Plane className="h-4 w-4 text-blue-700 dark:text-blue-400" aria-label="flight" />
                )}
                {ev.hotels.length > 0 && (
                  <HotelIcon className="h-4 w-4 text-green-700 dark:text-green-400" aria-label="hotel" />
                )}
                {ev.trains.length > 0 && (
                  <TrainFront className="h-4 w-4 text-foreground/70" aria-label="train" />
                )}
                {ev.buses.length > 0 && (
                  <BusIcon className="h-4 w-4 text-pink-600 dark:text-pink-400" aria-label="bus" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{openDay ? formatDayLabel(openDay) : ""}</DialogTitle>
          </DialogHeader>
          {openEvents && (
            <div className="space-y-3">
              {openEvents.reminders.map((r) => (
                <div key={`reminder-${r.sourcerow}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-yellow-700 dark:text-yellow-400">
                    <Bell className="h-3.5 w-3.5" fill="currentColor" /> Reminder
                  </div>
                  <div className="mt-1 text-sm">{r.text}</div>
                  {r.category && <div className="mt-1 text-[11px] text-muted-foreground">{r.category}</div>}
                </div>
              ))}

              {openEvents.notes.map((n) => (
                <div key={`note-${n.sourcerow}`} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <BookOpen className="h-3.5 w-3.5" /> Note
                  </div>
                  <div className="mt-1 text-sm">{n.text}</div>
                  {n.category && <div className="mt-1 text-[11px] text-muted-foreground">{n.category}</div>}
                </div>
              ))}

              {openEvents.events.map((event, idx) => (
                <div key={`${event.eventname}-${idx}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-accent">
                      <CalendarCheck className="h-3.5 w-3.5" /> {event.eventname}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[event.ourrole] ?? "bg-muted text-muted-foreground"}`}>
                      {event.ourrole || "—"}
                    </span>
                  </div>
                  {event.location && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {event.location}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {event.startdate} → {event.enddate || event.startdate}
                  </div>
                  {event.type && (
                    <div className="mt-1 text-[11px] text-muted-foreground">📋 {event.type}</div>
                  )}
                  {event.notes && (
                    <div className="mt-1 text-[11px] text-muted-foreground">📝 {event.notes}</div>
                  )}
                </div>
              ))}

              {openEvents.flights.map((flight) => {
                const f = flight as unknown as Record<string, string>;
                return (
                  <div key={f.confirmationcode || `${f.fromcode}-${f.tocode}-${f.departuretime}`} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                      <Plane className="h-3.5 w-3.5" /> Flight {f.airline}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {f.fromcode} → {f.tocode}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(f.departuretime)} — {formatTime(f.arrivaltime)}
                    </div>
                    {f.confirmationcode && (
                      <div className="mt-1 text-[11px] text-muted-foreground">Conf: {f.confirmationcode}</div>
                    )}
                    {f.assignedto && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        👤 Assigned: {splitPassengerList(f.assignedto).map((p) => canonicalizePersonName(p, users)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {openEvents.trains.map((train, idx) => {
                const t = train as unknown as Record<string, string>;
                return (
                  <div key={t.pnr || `${t.trainnumber}-${idx}`} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-accent">
                      <TrainFront className="h-3.5 w-3.5" /> {t.trainname || "Train"}{t.trainnumber ? ` · ${t.trainnumber}` : ""}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {t.fromcode} → {t.tocode}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(t.departuretime)} — {formatTime(t.arrivaltime)}
                    </div>
                    {t.pnr && (
                      <div className="mt-1 text-[11px] text-muted-foreground">PNR: {t.pnr}</div>
                    )}
                    {t.assignedto && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        👤 Assigned: {splitPassengerList(t.assignedto).map((p) => canonicalizePersonName(p, users)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {openEvents.buses.map((bus, idx) => {
                const b = bus as unknown as Record<string, string>;
                return (
                  <div key={b.ticketnumber || `${b.busnumber}-${idx}`} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-pink-600 dark:text-pink-400">
                      <BusIcon className="h-3.5 w-3.5" /> {b.busoperator || "Bus"}{b.busnumber ? ` · ${b.busnumber}` : ""}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {b.from_station} → {b.to_station}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(b.departuretime)} — {formatTime(b.arrivaltime)}
                    </div>
                    {b.ticketnumber && (
                      <div className="mt-1 text-[11px] text-muted-foreground">Ticket: {b.ticketnumber}</div>
                    )}
                    {b.assignedto && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        👤 Assigned: {splitPassengerList(b.assignedto).map((p) => canonicalizePersonName(p, users)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}

              {openEvents.hotels.map((hotel) => {
                const h = hotel as unknown as Record<string, string>;
                return (
                  <div key={h.confirmationcode || h.hotelname} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Bed className="h-3.5 w-3.5" /> Hotel
                    </div>
                    <div className="mt-1 text-sm font-semibold">{h.hotelname}</div>
                    {h.city && <div className="text-xs text-muted-foreground">{h.city}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {h.checkindate} → {h.checkoutdate}
                    </div>
                    {h.assignedto && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        👤 Assigned: {splitPassengerList(h.assignedto).map((p) => canonicalizePersonName(p, users)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}