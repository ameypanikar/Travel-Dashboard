import { LogOut, RefreshCw, Search, Settings, KeyRound, Sun, Moon, Plane, Clock, MapPin, Globe, WifiOff } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { SessionUser } from "@/lib/auth";
import { SettingsModal } from "./SettingsModal";
import { ChangePasswordModal } from "../auth/ChangePasswordModal";
import { useTheme } from "@/hooks/use-theme";
import { isAssignedToMe } from "@/lib/role-filter";
import type { Flight, TravelEvent } from "@/lib/dashboard-api";
import { resolveLocationCoords } from "@/lib/weather-api";
import { useOnlineStatus } from "@/lib/offline-storage";

type Props = {
  onRefresh: () => void;
  isFetching: boolean;
  updatedAt: Date | null;
  user?: SessionUser | null;
  onLogout?: () => void;
  allUsers?: { name: string; username: string; role: string }[];
  flights?: Flight[];
  events?: TravelEvent[];
  onTabChange?: (tab: string) => void;
  onSearch?: () => void;
};

function toYMD(ddmmyyyy: string): string {
  const p = ddmmyyyy.split("/");
  if (p.length !== 3) return "";
  return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
}

function getActiveTrip(flights: Flight[], events: TravelEvent[]): { label: string; name: string } | null {
  const todayStr = new Date().toISOString().slice(0, 10);
  const threeDaysStr = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

  // Check events first — most authoritative source of trip name
  for (const ev of events) {
    if ((ev.status || "").toLowerCase() === "cancelled") continue;
    const start = ev.startdate?.includes("/") ? toYMD(ev.startdate) : ev.startdate;
    const end = (ev.enddate?.includes("/") ? toYMD(ev.enddate) : ev.enddate) || start;
    if (!start) continue;
    if (todayStr >= start && todayStr <= end) return { label: "Currently", name: ev.eventname };
    if (start > todayStr && start <= threeDaysStr) return { label: "Up next", name: ev.eventname };
  }

  // Fallback: look at upcoming/in-progress flights for their trip field
  for (const flight of flights) {
    const f = flight as unknown as Record<string, string>;
    if ((f.bookingstatus || "").toLowerCase() === "cancelled") continue;
    const depIso = f.departuredate?.includes("/") ? toYMD(f.departuredate) : f.departuredate;
    const arrIso = f.arrivaldate?.includes("/") ? toYMD(f.arrivaldate) : f.arrivaldate;
    if (!depIso) continue;
    const trip = (f.trip || "").trim();
    if (!trip || trip.toLowerCase() === "general travel") continue;
    if (todayStr >= depIso && todayStr <= (arrIso || depIso)) return { label: "Currently", name: trip };
    if (depIso > todayStr && depIso <= threeDaysStr) return { label: "Up next", name: trip };
  }

  return null;
}

function parseDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const dp = date.split("/");
  if (dp.length !== 3) return null;
  const [dd, mm, yyyy] = dp;
  const [hh, mn] = time.split(":");
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh || "0"), parseInt(mn || "0"), 0);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function DualTimezoneWidget({
  flights,
  events,
}: {
  flights: Flight[];
  events: TravelEvent[];
}) {
  const [now, setNow] = useState(() => new Date());
  const [destInfo, setDestInfo] = useState<{ city: string; timezone: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine target destination from upcoming flight or event
  useEffect(() => {
    let target = "";
    const todayIso = new Date().toISOString().slice(0, 10);

    // 1. Try finding upcoming flight
    for (const flight of flights) {
      const r = flight as unknown as Record<string, string>;
      if ((r.bookingstatus || "").toLowerCase() === "cancelled") continue;
      const to = (r.cityto || r.toCity || r.tocode || r.toCode || "").trim();
      const depIso = r.departuredate?.includes("/") ? toYMD(r.departuredate) : (r.departuredate || "");
      if (to && (!depIso || depIso >= todayIso)) {
        target = to;
        break;
      }
    }

    // 2. Fallback to any valid flight destination
    if (!target) {
      for (const flight of flights) {
        const r = flight as unknown as Record<string, string>;
        if ((r.bookingstatus || "").toLowerCase() === "cancelled") continue;
        const to = (r.cityto || r.toCity || r.tocode || r.toCode || "").trim();
        if (to) {
          target = to;
          break;
        }
      }
    }

    // 3. Fallback to events
    if (!target) {
      for (const ev of events) {
        if ((ev.status || "").toLowerCase() === "cancelled") continue;
        if (ev.location) {
          target = ev.location;
          break;
        }
      }
    }

    if (target) {
      resolveLocationCoords(target).then((coords) => {
        if (coords?.timezone) {
          setDestInfo({ city: coords.city, timezone: coords.timezone });
        }
      });
    }
  }, [flights, events]);

  const homeTimeStr = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(now);

  const homeTzName = Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop()?.replace(/_/g, " ") || "Home";

  if (!destInfo || destInfo.timezone === Intl.DateTimeFormat().resolvedOptions().timeZone) {
    return (
      <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 backdrop-blur-md border border-white/15 text-xs text-white shadow-sm">
        <Clock className="h-3.5 w-3.5 text-indigo-200" />
        <span className="font-semibold text-white/80">{homeTzName}:</span>
        <span className="font-mono font-bold tracking-tight text-white tabular-nums">{homeTimeStr}</span>
      </div>
    );
  }

  let destTimeStr = "";
  let isDestDay = true;
  try {
    destTimeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: destInfo.timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(now);

    const destHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: destInfo.timezone,
        hour: "numeric",
        hour12: false,
      }).format(now),
      10,
    );
    isDestDay = destHour >= 6 && destHour < 18;
  } catch {
    destTimeStr = homeTimeStr;
  }

  let diffLabel = "";
  try {
    const destDate = new Date(now.toLocaleString("en-US", { timeZone: destInfo.timezone }));
    const localDate = new Date(now.toLocaleString("en-US", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
    const diffMs = destDate.getTime() - localDate.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    const sign = diffHrs >= 0 ? "+" : "";
    diffLabel = `${sign}${diffHrs.toFixed(1).replace(".0", "")}h`;
  } catch {
    diffLabel = "";
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-white/15 px-3 py-1.5 backdrop-blur-md border border-white/20 text-xs text-white shadow-sm">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 text-indigo-300" />
        <span className="text-[11px] text-white/70">Home:</span>
        <span className="font-mono font-bold tabular-nums text-white/90">{homeTimeStr}</span>
      </div>

      <span className="text-white/40 font-light hidden sm:inline">|</span>

      <div className="flex items-center gap-1.5">
        {isDestDay ? (
          <Sun className="h-3 w-3 text-amber-300" />
        ) : (
          <Moon className="h-3 w-3 text-indigo-200" />
        )}
        <span className="text-[11px] text-white/70">{destInfo.city}:</span>
        <span className="font-mono font-bold tabular-nums text-amber-300">{destTimeStr}</span>
        {diffLabel && (
          <span className="rounded-md bg-white/15 px-1 py-0.5 text-[10px] font-semibold text-white/80">
            {diffLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function NextFlightBanner({ flights, onTabChange }: { flights: Flight[]; onTabChange?: (tab: string) => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Find the next upcoming or currently-in-air flight
  const active = flights
    .filter((f) => {
      const r = f as unknown as Record<string, string>;
      if ((r.bookingstatus || "").toLowerCase() === "cancelled") return false;
      const dep = parseDateTime(r.departuredate, r.departuretime);
      const arr = parseDateTime(r.arrivaldate || r.departuredate, r.arrivaltime || r.departuretime);
      if (!dep) return false;
      // Include: departing within next 24h OR currently in-air
      const inAir = arr && dep.getTime() <= now && arr.getTime() >= now;
      const soonDep = dep.getTime() > now && dep.getTime() - now < 24 * 60 * 60 * 1000;
      return inAir || soonDep;
    })
    .sort((a, b) => {
      const ra = a as unknown as Record<string, string>;
      const rb = b as unknown as Record<string, string>;
      const da = parseDateTime(ra.departuredate, ra.departuretime);
      const db = parseDateTime(rb.departuredate, rb.departuretime);
      return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
    })[0];

  if (!active) return null;

  const r = active as unknown as Record<string, string>;
  const dep = parseDateTime(r.departuredate, r.departuretime)!;
  const arr = parseDateTime(r.arrivaldate || r.departuredate, r.arrivaltime || r.departuretime);
  const isInAir = arr && dep.getTime() <= now && arr.getTime() >= now;
  const msUntilDep = dep.getTime() - now;
  const progress = arr ? Math.max(0, Math.min(1, (now - dep.getTime()) / (arr.getTime() - dep.getTime()))) : 0;

  return (
    <button
      onClick={() => onTabChange?.("flights")}
      className="mt-3 w-full rounded-2xl px-3.5 py-2.5 text-left transition-all hover:brightness-110 active:scale-[0.99]"
      style={{
        background: isInAir
          ? "linear-gradient(135deg, oklch(0.38 0.18 270 / 80%) 0%, oklch(0.32 0.20 290 / 80%) 100%)"
          : "linear-gradient(135deg, oklch(1 0 0 / 12%) 0%, oklch(1 0 0 / 8%) 100%)",
        backdropFilter: "blur(12px)",
        border: "1px solid oklch(1 0 0 / 20%)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Animated plane icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ background: isInAir ? "oklch(1 0 0 / 20%)" : "oklch(1 0 0 / 15%)" }}
        >
          <Plane
            className={`h-4 w-4 text-white ${isInAir ? "animate-pulse" : ""}`}
            style={{ transform: "rotate(45deg)" }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white">{r.fromcode || r.fromcode}</span>
            <span className="text-white/50">→</span>
            <span className="text-sm font-bold text-white">{r.tocode || r.tocode}</span>
            <span className="ml-1 text-[10px] font-medium text-white/60 truncate">{r.airline}</span>
          </div>
          {/* Progress bar when in air */}
          {isInAir && (
            <div className="mt-1.5 h-1 w-full rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 15%)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, oklch(0.75 0.18 220), white)",
                }}
              />
            </div>
          )}
        </div>

        {/* Countdown */}
        <div className="shrink-0 flex items-center gap-1 text-white">
          <Clock className="h-3 w-3 opacity-70" />
          <span className="text-xs font-bold tabular-nums">
            {isInAir ? `${Math.round(progress * 100)}%` : formatCountdown(msUntilDep)}
          </span>
        </div>
      </div>

      <div className="mt-0.5 ml-11 text-[10px] font-medium text-white/55">
        {isInAir
          ? `In flight · lands ${r.arrivaltime} ${r.arrivaldate !== r.departuredate ? r.arrivaldate : ""}`
          : `Departs ${r.departuretime} · ${r.departuredate}`}
      </div>
    </button>
  );
}

export function TopBar({ onRefresh, isFetching, updatedAt, user, onLogout, allUsers = [], flights = [], events = [], onTabChange, onSearch }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Both the "Currently/Up next" pill and the live next-flight banner are
  // personal, top-of-dashboard context for whoever is logged in — so both
  // are scoped to bookings assigned to this user (matched on name or
  // username, same as boarding-pass/DigiYatra lookups elsewhere) rather
  // than the full org-wide flights/events list. Without this, whichever
  // booking across the whole team departs soonest would show up for
  // everyone, regardless of who it belongs to.
  const myFlights = useMemo(() => {
    if (!user) return flights;
    return flights.filter((flight) => {
      const f = flight as unknown as Record<string, string>;
      return isAssignedToMe(f.assignedto, user.name) || isAssignedToMe(f.assignedto, user.username);
    });
  }, [flights, user]);

  const myEvents = useMemo(() => {
    if (!user) return events;
    return events.filter((ev) => {
      const e = ev as unknown as Record<string, string>;
      return isAssignedToMe(e.assignedto, user.name) || isAssignedToMe(e.assignedto, user.username);
    });
  }, [events, user]);

  const activeTrip = useMemo(() => getActiveTrip(myFlights, myEvents), [myFlights, myEvents]);
  const isOnline = useOnlineStatus();

  return (
    <>
      {!isOnline && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-2xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-500 border border-amber-500/30 backdrop-blur-md animate-fade-in-up">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode · Cached Itinerary & Documents Ready</span>
        </div>
      )}

      {/* Hero gradient header */}
      <div className="mb-5 -mx-4 px-4 pt-6 pb-4 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, oklch(0.46 0.19 264) 0%, oklch(0.38 0.22 285) 50%, oklch(0.52 0.20 240) 100%)",
          borderRadius: "0 0 1.5rem 1.5rem",
        }}
      >
        {/* Decorative plane trails */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <svg className="absolute top-0 left-0 w-full h-full opacity-[0.07]" viewBox="0 0 400 120" preserveAspectRatio="none">
            <path d="M-20 100 Q100 20 220 60 Q340 100 440 30" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="8 6" />
            <path d="M-20 70 Q80 10 180 45 Q280 80 400 20" stroke="white" strokeWidth="1" fill="none" strokeDasharray="5 8" />
          </svg>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-20"
            style={{ background: "oklch(0.75 0.18 220)" }} />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full opacity-10"
            style={{ background: "oklch(0.38 0.22 285)" }} />
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl"
                style={{ background: "oklch(1 0 0 / 20%)" }}>
                <Plane className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-[26px] font-extrabold leading-none tracking-tight text-white">
                Travel Dashboard
              </h1>
            </div>
            <div className="ml-10 flex flex-wrap items-center gap-2">
              {activeTrip ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold animate-fade-in-up"
                  style={{
                    background: "oklch(1 0 0 / 18%)",
                    color: "white",
                    border: "1px solid oklch(1 0 0 / 25%)",
                  }}
                >
                  <MapPin className="h-3 w-3 opacity-80" />
                  <span className="opacity-70">{activeTrip.label}:</span>
                  <span className="truncate max-w-[160px]">{activeTrip.name}</span>
                </span>
              ) : (
                <p className="text-xs font-medium" style={{ color: "oklch(1 0 0 / 70%)" }}>
                  Flights, hotels &amp; what's next
                </p>
              )}
            </div>

            {/* Dual Timezone Live Clock */}
            <div className="mt-2.5 ml-10">
              <DualTimezoneWidget flights={myFlights} events={myEvents} />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {onSearch && (
                <IconBtn onClick={onSearch} label="Search itinerary (Ctrl+K)">
                  <Search className="h-4 w-4" />
                </IconBtn>
              )}
              <IconBtn onClick={onRefresh} disabled={isFetching} label="Refresh">
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </IconBtn>
              {user && (
                <IconBtn onClick={() => setShowSettings(true)} label="Settings">
                  <Settings className="h-4 w-4" />
                </IconBtn>
              )}
              {user && onLogout && (
                <IconBtn onClick={onLogout} label="Logout">
                  <LogOut className="h-4 w-4" />
                </IconBtn>
              )}
            </div>

            {user && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[11px] font-semibold leading-none text-white">
                  {user.name}
                  <span className="ml-1 opacity-70">· {user.role}</span>
                </span>
                <span className="text-[10px] leading-none" style={{ color: "oklch(1 0 0 / 55%)" }}>
                  {updatedAt ? `Synced ${updatedAt.toLocaleTimeString()}` : "—"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live next-flight banner — only shown when there's something imminent
            among the logged-in user's own flights */}
        {myFlights.length > 0 && (
          <div className="relative mt-1">
            <NextFlightBanner flights={myFlights} onTabChange={onTabChange} />
          </div>
        )}
      </div>

      {showSettings && user && (
        <SettingsModal
          user={user}
          users={allUsers}
          onClose={() => setShowSettings(false)}
          onRefresh={onRefresh}
          onChangePassword={() => {
            setShowSettings(false);
            setShowPassword(true);
          }}
        />
      )}

      {showPassword && user && (
        <ChangePasswordModal
          user={user}
          allUsers={allUsers}
          onClose={() => setShowPassword(false)}
        />
      )}
    </>
  );
}

function IconBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-all disabled:opacity-50"
      style={{ background: "oklch(1 0 0 / 18%)", backdropFilter: "blur(8px)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 28%)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "oklch(1 0 0 / 18%)")}
    >
      {children}
    </button>
  );
}