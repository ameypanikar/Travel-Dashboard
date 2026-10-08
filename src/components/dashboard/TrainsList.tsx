import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { TrainCard, type Train } from "./TrainCard";
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

// Preventive fix, same idea as Flights: if a PNR is ever shared across two
// train rows (e.g. connecting-train legs booked under one PNR), keying on
// PNR alone would collide. Combining it with train number + date keeps each
// row's key unique.
const trainKey = (t: Train) => `${t.pnr || "noref"}-${t.trainnumber || ""}-${t.departuredate || ""}`;

export function TrainsList({
  trains,
  selectedDateRange,
  selectedTrip,
  events = [],
  onRefresh,
}: {
  trains: Train[];
  selectedDateRange?: DateRange | null;
  selectedTrip?: string | null;
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const user = getSessionUser();
  const canSeeAll = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const [assignedFilter, setAssignedFilter] = useState<string>(canSeeAll ? "me" : "all");
  const [filterOpen, setFilterOpen] = useState(false);

  const visible = filterByRole(
    trains as unknown as Record<string, unknown>[],
  ) as unknown as Train[];

  const allAssignees = deduplicateAssignees(
    visible.map((t) => t.assignedto || "")
  );

  const dateFiltered = selectedDateRange?.from
    ? visible.filter((t) => {
        const iso = toISO(t.departuredate);
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
    ? dateFiltered.filter((t) => t.trip === selectedTrip)
    : dateFiltered;

  const filtered =
    !canSeeAll || assignedFilter === "all"
      ? tripFiltered
      : assignedFilter === "me"
      ? tripFiltered.filter((t) => isAssignedToMe(t.assignedto, user?.name || "") || isAssignedToMe(t.assignedto, user?.username || ""))
      : tripFiltered.filter((t) => isPersonMatch(t.assignedto, assignedFilter));

  const todayYMD = toYMD(new Date());
  const upcoming: Train[] = [];
  const past: Train[] = [];
  for (const t of filtered) {
    const iso = toISO(t.departuredate);
    if (iso && iso < todayYMD) past.push(t);
    else upcoming.push(t);
  }
  const byDateAsc = (a: Train, b: Train) => toISO(a.departuredate).localeCompare(toISO(b.departuredate));
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
          title={selectedDateRange?.from ? "No trains on this date range" : "No trains yet"}
          message={
            selectedDateRange?.from
              ? "Try clearing the date filter or pick another date."
              : "Add a row to your Trains sheet."
          }
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-5 flex flex-col gap-3">
              {upcoming.map((t, i) => (
                <div key={trainKey(t)}>
                  <div className="mb-1 px-1 text-xs font-semibold text-accent">
                    {getRelativeDateLabel(t.departuredate)}
                  </div>
                  <TrainCard train={t} events={events} onRefresh={onRefresh} />
                </div>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Past
              </div>
              <div className="flex flex-col gap-3">
                {past.map((t, i) => (
                  <TrainCard key={trainKey(t)} train={t} isPast events={events} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}