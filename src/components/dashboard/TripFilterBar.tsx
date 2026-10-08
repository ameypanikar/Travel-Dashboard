import { useState } from "react";
import { Filter, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  trips: string[];
  className?: string;
};

export function TripFilterBar({ value, onChange, trips, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 flex-1 justify-start gap-2 rounded-xl border-border bg-card text-left text-sm font-semibold shadow-card hover:bg-accent-soft",
              value ? "text-accent" : "text-muted-foreground",
            )}
          >
            <Filter className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {value ? `Trip: ${value}` : "Filter by trip"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-2" align="start">
          <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
            {trips.length === 0 ? (
              <div className="text-sm text-muted-foreground p-2 text-center">No trips found</div>
            ) : (
              trips.map((trip) => {
                const isActive = value === trip;
                return (
                  <button
                    key={trip}
                    onClick={() => {
                      onChange(isActive ? null : trip);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors text-left",
                      isActive
                        ? "bg-accent/10 text-accent font-semibold"
                        : "hover:bg-accent-soft text-foreground",
                    )}
                  >
                    <span className="truncate">{trip}</span>
                    {isActive && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="outline"
          onClick={() => onChange(null)}
          className="h-10 rounded-xl border-border bg-card text-accent shadow-card hover:bg-accent-soft px-3"
          aria-label="Clear trip filter"
        >
          <X className="h-4 w-4 shrink-0" />
          <span className="sr-only">Clear</span>
        </Button>
      )}
    </div>
  );
}
