import { useMemo, useState, useEffect } from "react";
import type { Flight, Hotel, Train, TravelEvent, NoteReminder } from "@/lib/dashboard-api";
import { startOfDay, isSameDay, addDays, formatDayLabel } from "@/lib/date-utils";
import { FlightCard } from "./FlightCard";
import { HotelCard } from "./HotelCard";
import { TrainCard } from "./TrainCard";
import { BusCard, type Bus } from "./BusCard";
import { EmptyState } from "./EmptyState";
import { LocalEats } from "./LocalEats";
import { Calendar as CalendarIcon, CalendarCheck, ChevronDown, MapPin, Users, UtensilsCrossed, ArrowLeft, Bell, CalendarPlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, generateGoogleCalendarLink } from "@/lib/utils";
import { filterByRole, isAssignedToMe, FULL_ACCESS_ROLES, deduplicateAssignees, isPersonMatch, setGlobalKnownUsers, splitPassengerList } from "@/lib/role-filter";
import { getSessionUser } from "@/lib/auth";
import { useDecryptedNotesReminders } from "@/lib/useDecryptedNotesReminders";
import { PersonFilterBar } from "./PersonFilterBar";


type Props = {
  flights: Flight[];
  hotels: Hotel[];
  trains?: Train[];
  buses?: Bus[];
  events?: TravelEvent[];
  notesReminders?: NoteReminder[];
  selectedDate: Date | null;
  onDateChange: (d: Date | null) => void;
  users?: { name: string; username: string; role: string }[];
};

const ROLE_COLORS: Record<string, string> = {
  "Stall Holder": "bg-green-100 text-green-700",
  "Visitor":      "bg-blue-100 text-blue-700",
  "Organiser":    "bg-orange-100 text-orange-700",
  "Sponsor":      "bg-purple-100 text-purple-700",
};

const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

const getAssignees = (r: Record<string, string>): string[] =>
  splitPassengerList(r.assignedto);

const notCancelled = (r: Record<string, string>): boolean =>
  (r.bookingstatus || "").trim().toLowerCase() !== "cancelled";

function EventBanner({ ev }: { ev: TravelEvent }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <CalendarCheck className="h-4 w-4 shrink-0 text-accent" />
        <span className="flex-1 truncate text-sm font-semibold text-foreground">
          {ev.eventname}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {ev.startdate}{ev.enddate && ev.enddate !== ev.startdate ? ` – ${ev.enddate}` : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[ev.ourrole] ?? "bg-muted text-muted-foreground"}`}>
              {ev.ourrole || "—"}
            </span>
            {ev.type && <span className="text-[11px] text-muted-foreground">📋 {ev.type}</span>}
          </div>
          {ev.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{ev.location}</span>
            </div>
          )}
          {ev.notes && (
            <div className="mt-1 text-xs text-muted-foreground">📝 {ev.notes}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderBanner({ r }: { r: NoteReminder }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <Bell className="h-4 w-4 shrink-0 text-yellow-500" fill="currentColor" />
        <span className="flex-1 truncate text-sm font-semibold text-foreground">
          {r.text}
        </span>
        {r.category && (
          <span className="shrink-0 text-[11px] text-muted-foreground">{r.category}</span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && r.duedate && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <div>Due {r.duedate}</div>
          <a
            href={generateGoogleCalendarLink(r.text, r.duedate, r.duetime, r.category)}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:opacity-70 flex items-center justify-center p-1"
            title="Add to Google Calendar"
          >
            <CalendarPlus className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export function DailyItinerary({
  flights,
  hotels,
  trains = [],
  buses = [],
  events = [],
  notesReminders = [],
  selectedDate,
  onDateChange,
  users = [],
}: Props) {
  useEffect(() => {
    if (users && users.length > 0) {
      setGlobalKnownUsers(users);
    }
  }, [users]);

  const user = getSessionUser();
  const canSeeAll = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());

  const today = startOfDay(new Date());
  const selected = selectedDate ?? today;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assignedFilter, setAssignedFilter] = useState<string>("me");
  const [showFood, setShowFood] = useState(false);
  const foodDefaultLocation =
    (hotels[0] as unknown as Record<string, string>)?.city ||
    (hotels[0] as unknown as Record<string, string>)?.address ||
    "";

  const stripStart = addDays(selected, -3);
  const strip = Array.from({ length: 14 }, (_, i) => addDays(stripStart, i));

  const visFlights = useMemo(
    () =>
      (filterByRole(flights as unknown as Record<string, unknown>[], users) as unknown as Flight[])
        .filter((f) => notCancelled(f as unknown as Record<string, string>)),
    [flights, users],
  );
  const visHotels = useMemo(
    () =>
      (filterByRole(hotels as unknown as Record<string, unknown>[], users) as unknown as Hotel[])
        .filter((h) => notCancelled(h as unknown as Record<string, string>)),
    [hotels, users],
  );
  const visTrains = useMemo(
    () =>
      (filterByRole(trains as unknown as Record<string, unknown>[], users) as unknown as Train[])
        .filter((t) => notCancelled(t as unknown as Record<string, string>)),
    [trains, users],
  );
  const visBuses = useMemo(
    () =>
      (filterByRole(buses as unknown as Record<string, unknown>[], users) as unknown as Bus[])
        .filter((b) => notCancelled(b as unknown as Record<string, string>)),
    [buses, users],
  );
  const visEvents = useMemo(
    () => events.filter((e) => (e.status || "Booked").trim().toLowerCase() !== "cancelled"),
    [events],
  );

  // Notes/Reminders are private to the logged-in user. Match against both username and name due to database schema variations.
  const myRemindersRaw = useMemo(
    () =>
      notesReminders.filter((n) => {
        if (n.type !== "reminder") return false;
        const nu = (n.username || "").trim().toLowerCase();
        const uUser = (user?.username || "").trim().toLowerCase();
        const uName = (user?.name || "").trim().toLowerCase();
        return (uUser && nu === uUser) || (uName && nu === uName);
      }),
    [notesReminders, user?.username, user?.name],
  );
  const myReminders = useDecryptedNotesReminders(myRemindersRaw).filter(
    (r) => (r.status || "Pending") !== "Done",
  );
  const allAssignees = useMemo(() => {
    const list: string[] = [];
    [...visFlights, ...visHotels, ...visTrains, ...visBuses].forEach((item) => {
      getAssignees(item as unknown as Record<string, string>).forEach((name) => list.push(name));
    });
    return deduplicateAssignees(list, users);
  }, [visFlights, visHotels, visTrains, visBuses, users]);

  const { matchedFlights, matchedHotels, matchedTrains, matchedBuses, matchedEvents, matchedReminders } = useMemo(() => {
    const ymd = toYMD(selected);
    const personFiltered = <T,>(items: T[]) => {
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

    const mf = personFiltered(visFlights).filter((f) => {
      const r = f as unknown as Record<string, string>;
      const departureDate = r.departuredate || (f as unknown as { departureDate?: string }).departureDate;
      return toISO(departureDate) === ymd;
    });
    const mh = personFiltered(visHotels).filter((h) => {
      const r = h as unknown as Record<string, string>;
      const start = toISO(r.checkindate);
      const end = toISO(r.checkoutdate) || start;
      if (!start) return false;
      return ymd >= start && ymd <= end;
    });
    const mt = personFiltered(visTrains).filter(
      (t) => toISO((t as unknown as Record<string, string>).departuredate) === ymd,
    );
    const mb = personFiltered(visBuses).filter(
      (b) => toISO((b as unknown as Record<string, string>).departuredate) === ymd,
    );
    const me = visEvents.filter((ev) => {
      if (ev.type === "Standing Tour") return false;
      const start = ev.startdate;
      const end = ev.enddate || start;
      if (!start) return false;
      const onDay = ymd >= start && ymd <= end;
      if (!onDay) return false;

      if (!canSeeAll || assignedFilter === "all") return true;

      const matchesTarget = (field: string | undefined) => {
        if (!field) return false;
        if (assignedFilter === "me") {
          return (
            (Boolean(user?.name) && isPersonMatch(field, user!.name, users)) ||
            (Boolean(user?.username) && isPersonMatch(field, user!.username, users)) ||
            isAssignedToMe(field, user?.name || "") ||
            isAssignedToMe(field, user?.username || "")
          );
        }
        return isPersonMatch(field, assignedFilter, users);
      };

      // 1. Direct match in event name or notes (e.g. "Taiwan (mohit , Mansi)")
      if (matchesTarget(ev.eventname) || matchesTarget(ev.notes)) {
        return true;
      }

      // 2. Check bookings associated with this event/trip
      const tripName = (ev.eventname || "").trim().toLowerCase();
      const allBookings = [...visFlights, ...visHotels, ...visTrains, ...visBuses];
      const tripBookings = allBookings.filter(
        (b) => ((b as unknown as Record<string, string>).trip || "").trim().toLowerCase() === tripName
      );

      if (tripBookings.length > 0) {
        // If there are bookings for this trip, only show event if target person has a booking on it
        return tripBookings.some((b) =>
          matchesTarget((b as unknown as Record<string, string>).assignedto)
        );
      }

      // 3. If no bookings exist, check if event title has other travelers in parentheses like "(mohit , Mansi)"
      const parenthesized = ev.eventname.match(/\(([^)]+)\)/);
      if (parenthesized && parenthesized[1]) {
        return matchesTarget(parenthesized[1]);
      }

      // General company event without specific traveler restrictions
      return true;
    });
    const mr = myReminders.filter((r) => toISO(r.duedate) === ymd);
    return { matchedFlights: mf, matchedHotels: mh, matchedTrains: mt, matchedBuses: mb, matchedEvents: me, matchedReminders: mr };
  }, [visFlights, visHotels, visTrains, visBuses, visEvents, myReminders, selected, assignedFilter, canSeeAll, user?.name, user?.username, users]);

  const total =
    matchedFlights.length + matchedHotels.length + matchedTrains.length + matchedBuses.length + matchedEvents.length + matchedReminders.length;
  const setDate = (d: Date) => onDateChange(startOfDay(d));
  const [filterOpen, setFilterOpen] = useState(false);

  if (showFood) {
    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setShowFood(false)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to itinerary
        </button>
        <LocalEats defaultLocation={foodDefaultLocation} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-foreground">{formatDayLabel(selected)}</div>
            <div className="text-[11px] text-muted-foreground">
              {total} event{total === 1 ? "" : "s"} today
            </div>
          </div>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10">
                <CalendarIcon className="h-3.5 w-3.5" /> Pick a date
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(d) => {
                  if (d) {
                    setDate(d);
                    setPickerOpen(false);
                  }
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex gap-2">
            {strip.map((d) => {
              const active = isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setDate(d)}
                  className={`flex w-12 shrink-0 flex-col items-center rounded-2xl px-1 py-2 text-[10px] font-bold uppercase transition ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-accent-soft text-accent hover:bg-accent/10"
                  }`}
                >
                  <span className="opacity-70">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  <span className="text-base font-extrabold leading-none">{d.getDate()}</span>
                  <span className="opacity-70">
                    {d.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  {isToday && !active && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setDate(today)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
          >
            Today
          </button>
          {selectedDate && (
            <button
              onClick={() => onDateChange(null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted/80"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {canSeeAll ? (
        <PersonFilterBar
          assignedFilter={assignedFilter}
          onSelectFilter={setAssignedFilter}
          allAssignees={allAssignees}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
          className="mb-2"
          rightAction={
            <button
              onClick={() => setShowFood(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 active:scale-95 shrink-0 shadow-xs"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" /> Grab Food
            </button>
          }
        />
      ) : (
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setShowFood(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 active:scale-95 shrink-0 shadow-xs"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" /> Grab Food
          </button>
        </div>
      )}

      {total === 0 ? (
        <EmptyState
          title={assignedFilter !== "all" ? `Nothing on this day for ${assignedFilter === "me" ? "you" : assignedFilter}` : "Nothing on this day"}
          message={
            assignedFilter !== "all"
              ? `No flights, trains, buses, hotel stays, or events scheduled for ${assignedFilter === "me" ? "you" : assignedFilter}.`
              : "No flights, trains, buses, hotel stays, or events scheduled."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {matchedEvents.map((ev, i) => (
            <EventBanner key={`event-${ev.eventname}-${ev.startdate}-${i}`} ev={ev} />
          ))}
          {matchedReminders.map((r) => (
            <ReminderBanner key={`reminder-${r.sourcerow}`} r={r} />
          ))}
          {matchedFlights.map((f) => (
            <FlightCard
              key={(f as unknown as Record<string, string>).confirmationcode}
              flight={f}
            />
          ))}
          {matchedTrains.map((t, i) => {
            const r = t as unknown as Record<string, string>;
            return <TrainCard key={r.pnr || `${r.trainnumber}-${i}`} train={t} />;
          })}
          {matchedBuses.map((b, i) => {
            const r = b as unknown as Record<string, string>;
            return <BusCard key={r.ticketnumber || `${r.busnumber}-${i}`} bus={b} />;
          })}
          {matchedHotels.map((h) => (
            <HotelCard
              key={(h as unknown as Record<string, string>).confirmationcode}
              hotel={h}
            />
          ))}
        </div>
      )}
    </div>
  );
}