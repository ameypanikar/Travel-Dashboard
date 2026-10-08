import { useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Flight, Document, TravelEvent } from "@/lib/dashboard-api";
import { FlightCard } from "./FlightCard";
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

const flightKey = (r: Record<string, string>) =>
  `${r.confirmationcode || "noref"}-${r.fromcode || ""}-${r.tocode || ""}-${r.departuredate || ""}`;

export function FlightsList({
  flights,
  selectedDateRange,
  selectedTrip,
  documents = [],
  events = [],
  onRefresh,
}: {
  flights: Flight[];
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
    flights as unknown as Record<string, unknown>[],
  ) as unknown as Flight[];

  const allAssignees = deduplicateAssignees(
    visible.map((f) => (f as unknown as Record<string, string>).assignedto || "")
  );

  const dateFiltered = selectedDateRange?.from
    ? visible.filter((f) => {
        const r = f as unknown as Record<string, string>;
        const iso = toISO(r.departuredate);
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
    ? dateFiltered.filter((f) => (f as unknown as Record<string, string>).trip === selectedTrip)
    : dateFiltered;

  const filtered =
    !canSeeAll || assignedFilter === "all"
      ? tripFiltered
      : assignedFilter === "me"
      ? tripFiltered.filter((f) => {
          const r = f as unknown as Record<string, string>;
          return isAssignedToMe(r.assignedto, user?.name || "") || isAssignedToMe(r.assignedto, user?.username || "");
        })
      : tripFiltered.filter((f) => {
          const r = f as unknown as Record<string, string>;
          return isPersonMatch(r.assignedto, assignedFilter);
        });

  const todayYMD = toYMD(new Date());
  const upcoming: Flight[] = [];
  const past: Flight[] = [];
  for (const f of filtered) {
    const r = f as unknown as Record<string, string>;
    const iso = toISO(r.departuredate);
    if (iso && iso < todayYMD) past.push(f);
    else upcoming.push(f);
  }
  const byDateAsc = (a: Flight, b: Flight) => {
    const ra = a as unknown as Record<string, string>;
    const rb = b as unknown as Record<string, string>;
    return toISO(ra.departuredate).localeCompare(toISO(rb.departuredate));
  };
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
          title={selectedDateRange?.from ? "No flights on this date range" : "No flights yet"}
          message={
            selectedDateRange?.from
              ? "Try clearing the date filter or pick another date."
              : "Add a row to your Flights sheet."
          }
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="mb-5 flex flex-col gap-3">
              {upcoming.map((f, idx) => {
                const r = f as unknown as Record<string, string>;
                return (
                  <div
                    key={flightKey(r)}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${idx * 0.06}s` }}
                  >
                    <div className="mb-1.5 px-1 flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: "linear-gradient(135deg, oklch(0.46 0.21 264), oklch(0.52 0.20 240))" }}
                      />
                      <span className="text-xs font-semibold text-accent">
                        {getRelativeDateLabel(r.departuredate)}
                      </span>
                    </div>
                    <FlightCard flight={f} documents={documents} events={events} onRefresh={onRefresh} />
                  </div>
                );
              })}
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="section-label mb-2.5 px-1">
                Past
              </div>
              <div className="flex flex-col gap-3">
                {past.map((f) => {
                  const r = f as unknown as Record<string, string>;
                  return (
                    <FlightCard
                      key={flightKey(r)}
                      flight={f}
                      isPast
                      documents={documents}
                      events={events}
                      onRefresh={onRefresh}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}