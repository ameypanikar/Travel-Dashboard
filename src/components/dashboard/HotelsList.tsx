import { useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Hotel, Document, TravelEvent } from "@/lib/dashboard-api";
import { HotelCard } from "./HotelCard";
import { EmptyState } from "./EmptyState";
import { filterByRole, isAssignedToMe, FULL_ACCESS_ROLES, deduplicateAssignees, isPersonMatch } from "@/lib/role-filter";
import { getSessionUser } from "@/lib/auth";
import { getRelativeDateLabel } from "@/lib/date-utils";
import { PersonFilterBar } from "./PersonFilterBar";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toISO = (ddmmyyyy?: string): string => {
  if (!ddmmyyyy) return "";
  const parts = String(ddmmyyyy).split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
};

const hotelKey = (r: Record<string, string>) =>
  `${r.confirmationcode || "noref"}-${r.hotelname || ""}-${r.checkindate || ""}`;

export function HotelsList({
  hotels,
  selectedDateRange,
  selectedTrip,
  documents = [],
  events = [],
  onRefresh,
}: {
  hotels: Hotel[];
  selectedDateRange?: DateRange | null;
  selectedTrip?: string | null;
  documents?: Document[];
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const user = getSessionUser();
  const canSeeAll = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const [assignedFilter, setAssignedFilter] = useState<string>(canSeeAll ? "me" : "all");
  const [filterOpen, setFilterOpen] = useState(false);

  const visible = filterByRole(
    hotels as unknown as Record<string, unknown>[],
  ) as unknown as Hotel[];

  const allAssignees = deduplicateAssignees(
    visible.map((h) => (h as unknown as Record<string, string>).assignedto || "")
  );

  const dateFiltered = selectedDateRange?.from
    ? visible.filter((h) => {
        const r = h as unknown as Record<string, string>;
        const iso = toISO(r.checkindate);
        if (!iso) return false;
        const fromYMD = selectedDateRange.from ? toYMD(selectedDateRange.from) : null;
        const toYMDStr = selectedDateRange.to ? toYMD(selectedDateRange.to) : null;
        if (fromYMD && toYMDStr) return iso >= fromYMD && iso <= toYMDStr;
        if (fromYMD) return iso >= fromYMD;
        if (toYMDStr) return iso <= toYMDStr;
        return true;
      })
    : visible;

  const tripFiltered = selectedTrip
    ? dateFiltered.filter((h) => (h as unknown as Record<string, string>).trip === selectedTrip)
    : dateFiltered;

  const filtered =
    !canSeeAll || assignedFilter === "all"
      ? tripFiltered
      : assignedFilter === "me"
      ? tripFiltered.filter((h) => {
          const r = h as unknown as Record<string, string>;
          return isAssignedToMe(r.assignedto, user?.name || "") || isAssignedToMe(r.assignedto, user?.username || "");
        })
      : tripFiltered.filter((h) => {
          const r = h as unknown as Record<string, string>;
          return isPersonMatch(r.assignedto, assignedFilter);
        });

  const todayYMD = toYMD(new Date());
  const upcoming: Hotel[] = [];
  const past: Hotel[] = [];
  for (const h of filtered) {
    const r = h as unknown as Record<string, string>;
    const checkout = toISO(r.checkoutdate) || toISO(r.checkindate);
    if (checkout && checkout < todayYMD) past.push(h);
    else upcoming.push(h);
  }
  const byCheckinAsc = (a: Hotel, b: Hotel) => {
    const ra = a as unknown as Record<string, string>;
    const rb = b as unknown as Record<string, string>;
    return toISO(ra.checkindate).localeCompare(toISO(rb.checkindate));
  };
  upcoming.sort(byCheckinAsc);
  past.sort(byCheckinAsc);

  const totalRooms = upcoming.reduce((sum, h) => {
    const r = h as unknown as Record<string, string>;
    const n = parseInt(r.numberofrooms || "0", 10);
    const assignmentCount = r.roomassignments
      ? r.roomassignments.split(",").filter(Boolean).length
      : 0;
    return sum + (n || assignmentCount || 1);
  }, 0);

  const cityMap: Record<string, number> = {};
  upcoming.forEach((h) => {
    const r = h as unknown as Record<string, string>;
    const city = r.city || "Unknown";
    const n = parseInt(r.numberofrooms || "0", 10);
    const assignmentCount = r.roomassignments
      ? r.roomassignments.split(",").filter(Boolean).length
      : 0;
    cityMap[city] = (cityMap[city] || 0) + (n || assignmentCount || 1);
  });

  const filterBlock = canSeeAll && (
    <PersonFilterBar
      assignedFilter={assignedFilter}
      onSelectFilter={setAssignedFilter}
      allAssignees={allAssignees}
      filterOpen={filterOpen}
      onToggleFilter={() => setFilterOpen((v) => !v)}
    />
  );

  if (!filtered.length) {
    return (
      <div className="flex flex-col gap-3">
        {filterBlock}
        <EmptyState
          title={selectedDateRange?.from ? "No active stay on this date range" : "No hotels yet"}
          message={
            selectedDateRange?.from
              ? "Try clearing the date filter or pick another date."
              : assignedFilter === "me"
              ? "No hotels assigned to you. Try 'All' or another person in the filter above."
              : "Add a row to your Hotels sheet."
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {filterBlock}

      <div className="rounded-2xl bg-card px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <span className="text-accent">
            🏨 {upcoming.length} {upcoming.length === 1 ? "hotel" : "hotels"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-accent">
            🚪 {totalRooms} {totalRooms === 1 ? "room" : "rooms"} total
          </span>
          {Object.entries(cityMap).map(([city, count]) => (
            <span key={city} className="text-muted-foreground">
              · {city}: {count} {count === 1 ? "room" : "rooms"}
            </span>
          ))}
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          {upcoming.map((h) => {
            const r = h as unknown as Record<string, string>;
            return (
              <div key={hotelKey(r)}>
                <div className="mb-1 px-1 text-xs font-semibold text-accent">
                  {getRelativeDateLabel(r.checkindate)}
                </div>
                <HotelCard hotel={h} documents={documents} events={events} onRefresh={onRefresh} />
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Past
          </div>
          <div className="flex flex-col gap-3">
            {past.map((h) => {
              const r = h as unknown as Record<string, string>;
              return (
                <HotelCard key={hotelKey(r)} hotel={h} isPast documents={documents} events={events} onRefresh={onRefresh} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}