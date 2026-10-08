import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { BusCard, type Bus } from "./BusCard";
import type { TravelEvent } from "@/lib/dashboard-api";
import { EmptyState } from "./EmptyState";
import { filterByRole, isAssignedToMe, FULL_ACCESS_ROLES, deduplicateAssignees, isPersonMatch } from "@/lib/role-filter";
import { getSessionUser } from "@/lib/auth";
import { getRelativeDateLabel } from "@/lib/date-utils";
import { PersonFilterBar } from "./PersonFilterBar";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toISO = (ddmmyyyy?: string): string => {
  if (!ddmmyyyy) return "";
  const parts = String(ddmmyyyy).split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
};

const busKey = (b: Bus) => `${b.ticketnumber || "noref"}-${b.busnumber || ""}-${b.departuredate || ""}`;

export function BusesList({
  buses,
  selectedDateRange,
  selectedTrip,
  events = [],
  onRefresh,
}: {
  buses: Bus[];
  selectedDateRange?: DateRange | null;
  selectedTrip?: string | null;
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const user = getSessionUser();
  const canSeeAll = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const [assignedFilter, setAssignedFilter] = useState<string>(canSeeAll ? "me" : "all");
  const [filterOpen, setFilterOpen] = useState(false);

  const visible = filterByRole(buses as unknown as Record<string, unknown>[]) as unknown as Bus[];

  const allAssignees = deduplicateAssignees(
    visible.map((b) => b.assignedto || "")
  );

  const dateFiltered = selectedDateRange?.from
    ? visible.filter((b) => {
        const iso = toISO(b.departuredate);
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
    ? dateFiltered.filter((b) => b.trip === selectedTrip)
    : dateFiltered;

  const filtered =
    !canSeeAll || assignedFilter === "all"
      ? tripFiltered
      : assignedFilter === "me"
      ? tripFiltered.filter((b) => isAssignedToMe(b.assignedto, user?.name || "") || isAssignedToMe(b.assignedto, user?.username || ""))
      : tripFiltered.filter((b) => isPersonMatch(b.assignedto, assignedFilter));

  const todayYMD = toYMD(new Date());
  const upcoming: Bus[] = [];
  const past: Bus[] = [];
  for (const b of filtered) {
    const iso = toISO(b.departuredate);
    if (iso && iso < todayYMD) past.push(b);
    else upcoming.push(b);
  }
  const byDateAsc = (a: Bus, b: Bus) => toISO(a.departuredate).localeCompare(toISO(b.departuredate));
  upcoming.sort(byDateAsc);
  past.sort(byDateAsc);

  return (
    <div>
      {canSeeAll && (
        <PersonFilterBar
          assignedFilter={assignedFilter}
          onSelectFilter={setAssignedFilter}
          allAssignees={allAssignees}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((v) => !v)}
        />
      )}
      {!filtered.length ? (
        <EmptyState
          title={selectedDateRange?.from ? "No buses on this date range" : "No buses yet"}
          message={
            selectedDateRange?.from
              ? "Try clearing the date filter or pick another date."
              : "Add a row to your Buses sheet."
          }
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-5 flex flex-col gap-3">
              {upcoming.map((b) => (
                <div key={busKey(b)}>
                  <div className="mb-1 px-1 text-xs font-semibold text-accent">
                    {getRelativeDateLabel(b.departuredate)}
                  </div>
                  <BusCard bus={b} events={events} onRefresh={onRefresh} />
                </div>
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div>
              <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Past</div>
              <div className="flex flex-col gap-3">
                {past.map((b) => (
                  <BusCard key={busKey(b)} bus={b} isPast events={events} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}