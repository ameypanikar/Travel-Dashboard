import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { fetchDashboard } from "@/lib/dashboard-api";
import { TopBar } from "@/components/dashboard/TopBar";
import { Tabs, type TabKey } from "@/components/dashboard/Tabs";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { DailyItinerary } from "@/components/dashboard/DailyItinerary";
import { FlightsList } from "@/components/dashboard/FlightsList";
import { HotelsList } from "@/components/dashboard/HotelsList";
import { TrainsList } from "@/components/dashboard/TrainsList";
import { BusesList } from "@/components/dashboard/BusesList";
import { TripFilterBar } from "@/components/dashboard/TripFilterBar";
import { MonthlyView } from "@/components/dashboard/MonthlyView";
import type { DateRange } from "react-day-picker";
import { EventsTabContent } from "@/components/dashboard/EventsTabContent";
import { AddButtonMenu } from "@/components/dashboard/AddButtonMenu";
import { LoginPage } from "@/components/auth/LoginPage";
import { SpendTabContent } from "@/components/dashboard/SpendTabContent";
import { clearSessionUser, getSessionUser, type SessionUser } from "@/lib/auth";
import { useSwipe } from "@/hooks/use-swipe";
import { TravelSearchDialog } from "@/components/dashboard/TravelSearchDialog";
import { filterByRole } from "@/lib/role-filter";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<TabKey>("day");
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [listDateRange, setListDateRange] = useState<DateRange | null>(null);
  const [itineraryDate, setItineraryDate] = useState<Date | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const swipeRef = useRef<HTMLDivElement>(null);

  // Matches the visual left-to-right tab order exactly; no wrapping
  const TAB_ORDER: TabKey[] = ["flights", "hotels", "trains", "buses", "events", "day", "monthly", "spend"];

  const goToTab = (next: TabKey, dir: "left" | "right") => {
    setSlideDir(dir);
    setTab(next);
  };

  useSwipe(swipeRef, {
    onSwipeLeft: (e) => {
      const idx = TAB_ORDER.indexOf(tab);
      if (idx < TAB_ORDER.length - 1) {
        navigator.vibrate?.(30);
        goToTab(TAB_ORDER[idx + 1], "left");
      }
    },
    onSwipeRight: (e) => {
      const idx = TAB_ORDER.indexOf(tab);
      if (idx > 0) {
        navigator.vibrate?.(30);
        goToTab(TAB_ORDER[idx - 1], "right");
      }
    },
  });

  useEffect(() => {
    setUser(getSessionUser());
    setAuthReady(true);
  }, []);

  const { data, isLoading, isFetching, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    staleTime: 5 * 60_000,       // treat data fresh for 5 minutes
    gcTime: 30 * 60_000,         // keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData, // show old data instantly during background refresh
    enabled: !!user,
  });

  if (!authReady) return null;
  if (!user) return <LoginPage onLogin={setUser} />;

  const handleLogout = () => {
    clearSessionUser();
    setUser(null);
  };

  const allUsers = (data as unknown as { users?: { name: string; username: string; role: string }[] })
    ?.users ?? [];

  const uberSuggestions = (data?.hotels ?? [])
    .filter((hotel: { address?: string | null; hotelName?: string | null }) => Boolean(hotel.address || hotel.hotelName))
    .map((hotel: { address?: string | null; hotelName?: string | null }) => ({
      label: hotel.hotelName?.trim() || "Hotel",
      address: hotel.address?.trim() || hotel.hotelName?.trim() || "",
    }));

  const availableTrips = Array.from(
    new Set([
      ...(data?.flights ?? []).map(f => (f as unknown as Record<string, string>).trip),
      ...(data?.hotels ?? []).map(h => (h as unknown as Record<string, string>).trip),
      ...((data?.trains ?? []) as Record<string, string>[]).map(t => t.trip),
      ...((data?.buses ?? []) as Record<string, string>[]).map(b => b.trip)
    ].filter(t => t && t.trim() !== ""))
  ).sort();

  return (
    <div className="min-h-screen bg-dashboard-bg text-foreground">
      {!isLoading && allUsers.length === 0 && (
        <div className="bg-red-500/10 border-b border-red-500/20 py-2.5 overflow-hidden flex whitespace-nowrap relative w-full shadow-sm">
          <style>{`
            @keyframes marquee-rtl {
              0% { transform: translateX(100vw); }
              100% { transform: translateX(-100vw); }
            }
            .animate-marquee {
              animation: marquee-rtl 25s linear infinite;
              will-change: transform;
            }
          `}</style>
          <div className="animate-marquee text-sm font-semibold text-red-500/90 tracking-wide w-full flex-shrink-0 flex gap-12">
            <span>🚀 SYSTEM UPDATE REQUIRED: Your session token is outdated.</span>
            <span>Please log out (door icon top right) and log back in to restore your dashboard access.</span>
            <span>🚀 SYSTEM UPDATE REQUIRED: Your session token is outdated.</span>
          </div>
        </div>
      )}
      <div ref={swipeRef} className="mx-auto w-full max-w-[780px] px-4 pb-28">
        <TopBar
          onRefresh={() => refetch()}
          isFetching={isFetching}
          updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
          user={user}
          onLogout={handleLogout}
          allUsers={allUsers}
          flights={data?.flights ?? []}
          events={data?.events ?? []}
          onTabChange={(t) => setTab(t as TabKey)}
          onSearch={() => setSearchOpen(true)}
        />

        <Tabs
          value={tab}
          onChange={(next) => {
            const curIdx = TAB_ORDER.indexOf(tab);
            const nxtIdx = TAB_ORDER.indexOf(next);
            goToTab(next, nxtIdx >= curIdx ? "left" : "right");
          }}
        />
        {/* Tab position dots — visible on mobile only */}
        <div className="mb-3 flex justify-center gap-1.5 sm:hidden">
          {TAB_ORDER.map((t) => (
            <div
              key={t}
              className="rounded-full transition-all duration-300"
              style={{
                width: t === tab ? "16px" : "5px",
                height: "5px",
                background: t === tab
                  ? "var(--color-accent)"
                  : "var(--color-muted-foreground)",
                opacity: t === tab ? 1 : 0.35,
              }}
            />
          ))}
        </div>

        {(tab === "flights" || tab === "hotels" || tab === "trains" || tab === "buses" || tab === "day") && (
          <div className="mb-3 flex flex-col sm:flex-row gap-2">
            <DateFilterBar 
              mode={tab === "day" ? "single" : "range"}
              singleValue={itineraryDate}
              rangeValue={listDateRange}
              onSingleChange={setItineraryDate}
              onRangeChange={setListDateRange}
              className="flex-1"
            />
            {tab !== "day" && (
              <TripFilterBar 
                value={selectedTrip} 
                onChange={setSelectedTrip} 
                trips={availableTrips} 
                className="flex-1"
              />
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-card shadow-card overflow-hidden" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="pl-4 pr-4 pt-4 pb-4">
                  {/* Header row skeleton */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-muted animate-pulse" />
                      <div className="h-3.5 w-20 rounded-full bg-muted animate-pulse" />
                      <div className="h-3.5 w-14 rounded-md bg-muted animate-pulse" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                  </div>
                  {/* Route skeleton */}
                  <div className="flex items-center gap-3 rounded-2xl px-3 py-3 mb-3" style={{ background: "var(--color-muted)" }}>
                    <div className="flex-1 space-y-2">
                      <div className="h-7 w-16 rounded-lg bg-card animate-pulse" />
                      <div className="h-2.5 w-24 rounded-full bg-card animate-pulse" />
                      <div className="h-3 w-16 rounded-full bg-card animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center gap-2" style={{ minWidth: 80 }}>
                      <div className="h-2 w-12 rounded-full bg-card animate-pulse" />
                      <div className="h-8 w-20 rounded-full bg-card animate-pulse opacity-40" />
                    </div>
                    <div className="flex-1 space-y-2 items-end flex flex-col">
                      <div className="h-7 w-16 rounded-lg bg-card animate-pulse" />
                      <div className="h-2.5 w-20 rounded-full bg-card animate-pulse" />
                      <div className="h-3 w-16 rounded-full bg-card animate-pulse" />
                    </div>
                  </div>
                  {/* Details row skeleton */}
                  <div className="flex gap-3">
                    <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
                    <div className="h-3 w-32 rounded-full bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
            <div className="font-semibold">Couldn't reach the sheet</div>
            <div className="mt-1 opacity-80">{(error as Error).message}</div>
            <button
              onClick={() => refetch()}
              className="mt-3 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              Try again
            </button>
          </div>
        )}

        <div
          key={tab}
          className={slideDir === "left" ? "tab-slide-right" : slideDir === "right" ? "tab-slide-left" : ""}
        >
        {tab === "events" && (
          <EventsTabContent
            user={user}
            events={data?.events ?? []}
            notesReminders={data?.notesReminders ?? []}
            onRefresh={() => refetch()}
          />
        )}

        {data && !isLoading && (
          <>
            {tab === "flights" && (
              <FlightsList
                flights={data.flights}
                selectedDateRange={listDateRange}
                selectedTrip={selectedTrip}
                documents={data.documents ?? []}
                events={data.events ?? []}
                onRefresh={() => refetch()}
              />
            )}
            {tab === "hotels" && (
              <HotelsList
                hotels={data.hotels}
                selectedDateRange={listDateRange}
                selectedTrip={selectedTrip}
                documents={data.documents ?? []}
                events={data.events ?? []}
                onRefresh={() => refetch()}
              />
            )}
            {tab === "trains" && (
              <TrainsList
                trains={(data.trains ?? []) as unknown as Record<string, string>[]}
                selectedDateRange={listDateRange}
                selectedTrip={selectedTrip}
                events={data.events ?? []}
                onRefresh={() => refetch()}
              />
            )}
            {tab === "buses" && (
              <BusesList
                buses={(data.buses ?? []) as unknown as Record<string, string>[]}
                selectedDateRange={listDateRange}
                selectedTrip={selectedTrip}
                events={data.events ?? []}
                onRefresh={() => refetch()}
              />
            )}
            {tab === "spend" && (
              <SpendTabContent
                user={user}
                users={allUsers}
                flights={data.flights}
                hotels={data.hotels}
                trains={(data.trains ?? []) as unknown as Record<string, string>[]}
                buses={(data.buses ?? []) as unknown as Record<string, string>[]}
                events={data.events ?? []}
                expenses={data.expenses ?? []}
                advances={data.advances ?? []}
                allowances={data.allowances ?? []}
                onRefresh={() => refetch()}
              />
            )}
            {tab === "day" && (
              <DailyItinerary
                flights={data.flights}
                hotels={data.hotels}
                trains={data.trains ?? []}
                buses={(data.buses ?? []) as unknown as Record<string, string>[]}
                events={data.events ?? []}
                notesReminders={data.notesReminders ?? []}
                selectedDate={itineraryDate}
                onDateChange={setItineraryDate}
                users={allUsers}
              />
            )}
            {tab === "monthly" && (
              <MonthlyView
                flights={data.flights}
                hotels={data.hotels}
                trains={data.trains ?? []}
                buses={(data.buses ?? []) as unknown as Record<string, string>[]}
                events={data.events ?? []}
                notesReminders={data.notesReminders ?? []}
                users={allUsers}
              />
            )}
          </>
        )}
        </div>{/* end slide-animation wrapper */}

        <p className="mt-10 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <span>✈</span>
          <span>Travel Dashboard · live from Google Sheets</span>
          <span>✈</span>
        </p>
      </div>
      <AddButtonMenu
        user={user}
        users={allUsers}
        events={data?.events ?? []}
        uberSuggestions={uberSuggestions}
        onRefresh={() => refetch()}
      />
      <TravelSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        flights={filterByRole(data?.flights ?? []) as any}
        hotels={filterByRole(data?.hotels ?? []) as any}
        trains={filterByRole((data?.trains ?? []) as any) as any}
        buses={filterByRole((data?.buses ?? []) as any) as any}
        events={filterByRole(data?.events ?? []) as any}
        expenses={filterByRole(data?.expenses ?? []) as any}
        onNavigate={({ tab: next, trip }) => {
          const curIdx = TAB_ORDER.indexOf(tab);
          const nxtIdx = TAB_ORDER.indexOf(next);
          goToTab(next, nxtIdx >= curIdx ? "left" : "right");
          setSelectedTrip(trip);
          setListDateRange(null);
        }}
      />
    </div>
  );
}