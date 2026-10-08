import type { PendingItem } from "@/lib/dashboard-api";
import { FlightCard } from "./FlightCard";
import { HotelCard } from "./HotelCard";
import { EmptyState } from "./EmptyState";

export function PendingList({ items }: { items: PendingItem[] }) {
  if (!items.length) {
    return <EmptyState title="Nothing pending" message="Everything is booked. Nice." />;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => {
        const code = (it as unknown as Record<string, string>).confirmationcode;
        return it.type === "flight" ? (
          <FlightCard key={code} flight={it} />
        ) : it.type === "hotel" ? (
          <HotelCard key={code} hotel={it} />
        ) : null;
      })}
    </div>
  );
}
