import { useEffect, useMemo, useState } from "react";
import {
  Bus,
  CalendarCheck,
  Hotel,
  IndianRupee,
  Plane,
  Search,
  Sun,
  TrainFront,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import type { Bus as BusBooking, Expense, Flight, Hotel as HotelBooking, Train, TravelEvent } from "@/lib/dashboard-api";
import { buildTravelSearchHits, filterSearchHits, type SearchHit } from "@/lib/travel-search";
import type { TabKey } from "./Tabs";

type SearchTarget = {
  tab: TabKey;
  trip: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flights: Flight[];
  hotels: HotelBooking[];
  trains: Train[];
  buses: BusBooking[];
  events: TravelEvent[];
  expenses: Expense[];
  onNavigate: (target: SearchTarget) => void;
};

const TAB_JUMPS: { tab: TabKey; label: string; hint: string; icon: typeof Plane }[] = [
  { tab: "flights", label: "Flights", hint: "Bookings & PNRs", icon: Plane },
  { tab: "hotels", label: "Hotels", hint: "Stays & confirmations", icon: Hotel },
  { tab: "trains", label: "Trains", hint: "PNR & live status", icon: TrainFront },
  { tab: "buses", label: "Buses", hint: "Operators & tickets", icon: Bus },
  { tab: "events", label: "Events", hint: "Meetings & shows", icon: CalendarCheck },
  { tab: "day", label: "Itinerary", hint: "Today’s timeline", icon: Sun },
  { tab: "spend", label: "Spend", hint: "Expenses & vouchers", icon: IndianRupee },
];

const GROUP_ICON: Record<TabKey, typeof Plane> = {
  flights: Plane,
  hotels: Hotel,
  trains: TrainFront,
  buses: Bus,
  events: CalendarCheck,
  day: Sun,
  monthly: CalendarCheck,
  spend: IndianRupee,
};

const GROUP_LABEL: Partial<Record<TabKey, string>> = {
  flights: "Flights",
  hotels: "Hotels",
  trains: "Trains",
  buses: "Buses",
  events: "Events",
  spend: "Spend",
};

export function TravelSearchDialog({
  open,
  onOpenChange,
  flights,
  hotels,
  trains,
  buses,
  events,
  expenses,
  onNavigate,
}: Props) {
  const [query, setQuery] = useState("");

  const allHits = useMemo(
    () => buildTravelSearchHits({ flights, hotels, trains, buses, events, expenses }),
    [flights, hotels, trains, buses, events, expenses],
  );

  const matches = useMemo(() => filterSearchHits(allHits, query), [allHits, query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (target: SearchTarget) => {
    onNavigate(target);
    onOpenChange(false);
  };

  const grouped = matches.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    (acc[hit.tab] ??= []).push(hit);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Search itinerary</DialogTitle>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search PNR, hotel, trip, city…"
      />
      <CommandList>
        <CommandEmpty>No matching travel found.</CommandEmpty>

        {query.trim().length < 2 && (
          <CommandGroup heading="Jump to">
            {TAB_JUMPS.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.tab}
                  value={`tab ${item.label} ${item.hint}`}
                  onSelect={() => go({ tab: item.tab, trip: null })}
                >
                  <Icon />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {matches.length > 0 && <CommandSeparator />}

        {Object.entries(grouped).map(([tab, hits]) => {
          const Icon = GROUP_ICON[tab as TabKey] ?? Search;
          return (
            <CommandGroup key={tab} heading={GROUP_LABEL[tab as TabKey] ?? tab}>
              {hits.map((hit) => (
                <CommandItem
                  key={hit.id}
                  value={`${hit.id} ${hit.keywords}`}
                  onSelect={() => go({ tab: hit.tab, trip: hit.trip })}
                >
                  <Icon />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{hit.heading}</span>
                    {hit.detail && (
                      <span className="truncate text-xs text-muted-foreground">{hit.detail}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
