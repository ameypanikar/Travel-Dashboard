import { useMemo, useState, useRef } from "react";
import { FULL_ACCESS_ROLES, isAssignedToMe, isPersonMatch } from "@/lib/role-filter";
import { SpendView } from "./SpendView";
import { AddExpenseForm } from "./AddExpenseForm";
import { TripExpensesPanel } from "./TripExpensesPanel";
import { useSwipe } from "@/hooks/use-swipe";
import { hasExpenseDraft } from "@/lib/expense-draft";
import type { Flight, Hotel, Train, Bus, TravelEvent, Expense, Advance, Allowance } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";

type UserEntry = { name: string; username: string; role: string };

// Scopes a list of bookings (flights/hotels/trains/buses) down to just the
// ones assigned to this user, by name or username — same matching rule
// used everywhere else in the app (role-filter.ts). Full-access roles see
// everything, unfiltered.
function scopeBookingsToUser<T>(items: T[], user: SessionUser, canSeeAll: boolean): T[] {
  if (canSeeAll) return items;
  return (items as unknown as Record<string, string>[]).filter(
    (r) => isAssignedToMe(r.assignedto, user.name) || isAssignedToMe(r.assignedto, user.username),
  ) as unknown as T[];
}

// Scopes expenses down to this user by matching either username or name,
// handling database schema naming differences (e.g. Heramb M vs HERAMB MANDKE).
function scopeExpensesToUser(
  items: Expense[],
  user: SessionUser,
  canSeeAll: boolean,
  users?: { name: string; username: string }[],
): Expense[] {
  if (canSeeAll) return items;
  return items.filter((e) => {
    const ePerson = (e.username || e.name || "").trim();
    if (!ePerson) return false;
    return (
      (Boolean(user.username) && isPersonMatch(ePerson, user.username, users)) ||
      (Boolean(user.name) && isPersonMatch(ePerson, user.name, users))
    );
  });
}

export function SpendTabContent({
  user,
  users,
  flights,
  hotels,
  trains,
  buses,
  events,
  expenses,
  advances,
  allowances,
  onRefresh,
}: {
  user: SessionUser;
  users: UserEntry[];
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  events: TravelEvent[];
  expenses: Expense[];
  advances: Advance[];
  allowances: Allowance[];
  onRefresh: () => void;
}) {
  const canSeeAll = FULL_ACCESS_ROLES.includes((user.role || "").trim().toLowerCase());
  // Automatically resume 'add' view if a draft is in progress, or restore from session
  const [view, setView] = useState<"dashboard" | "add">(() => {
    if (typeof window !== "undefined" && hasExpenseDraft(user.username)) return "add";
    if (typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage?.getItem(`spend_active_view_${user.username}`);
        if (saved === "add" || saved === "dashboard") return saved;
      } catch {}
    }
    return "dashboard";
  });

  const handleSetView = (next: "dashboard" | "add") => {
    setView(next);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage?.setItem(`spend_active_view_${user.username}`, next);
      } catch {}
    }
  };

  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipe(swipeRef, {
    onSwipeLeft: (e) => {
      e.stopPropagation();
      if (view === "dashboard") {
        navigator.vibrate?.(30);
        handleSetView("add");
      }
    },
    onSwipeRight: (e) => {
      // Intentionally do NOT swipe back to dashboard while in "add" view
      // to protect users entering expense data from accidental gestures.
    },
  });

  const scopedFlights = useMemo(() => scopeBookingsToUser(flights, user, canSeeAll), [flights, user, canSeeAll]);
  const scopedHotels = useMemo(() => scopeBookingsToUser(hotels, user, canSeeAll), [hotels, user, canSeeAll]);
  const scopedTrains = useMemo(() => scopeBookingsToUser(trains, user, canSeeAll), [trains, user, canSeeAll]);
  const scopedBuses = useMemo(() => scopeBookingsToUser(buses, user, canSeeAll), [buses, user, canSeeAll]);
  const scopedExpenses = useMemo(() => scopeExpensesToUser(expenses, user, canSeeAll, users), [expenses, user, canSeeAll, users]);

  return (
    <div ref={swipeRef} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSetView("dashboard")}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            view === "dashboard" ? "bg-accent text-accent-foreground shadow-card" : "bg-card text-accent shadow-card hover:bg-accent-soft"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => handleSetView("add")}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            view === "add" ? "bg-accent text-accent-foreground shadow-card" : "bg-card text-accent shadow-card hover:bg-accent-soft"
          }`}
        >
          Add Expense
        </button>
      </div>

      {view === "dashboard" ? (
        <SpendView
          flights={scopedFlights}
          hotels={scopedHotels}
          trains={scopedTrains}
          buses={scopedBuses}
          events={events}
          expenses={scopedExpenses}
          canSeeAll={canSeeAll}
          users={users}
        />
      ) : (
        <>
          <AddExpenseForm user={user} users={users} expenses={expenses} events={events} onRefresh={onRefresh} />
          {canSeeAll && (
            <TripExpensesPanel
              flights={flights}
              hotels={hotels}
              trains={trains}
              buses={buses}
              events={events}
              expenses={expenses}
              advances={advances}
              allowances={allowances}
              users={users}
              user={user}
              onRefresh={onRefresh}
            />
          )}
        </>
      )}
    </div>
  );
}