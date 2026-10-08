import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { startOfDay } from "@/lib/date-utils";
import type { DateRange } from "react-day-picker";

type Props = {
  mode?: "single" | "range";
  singleValue?: Date | null;
  rangeValue?: DateRange | null;
  onSingleChange?: (d: Date | null) => void;
  onRangeChange?: (d: DateRange | null) => void;
  className?: string;
};

export function DateFilterBar({ 
  mode = "single", 
  singleValue, 
  rangeValue, 
  onSingleChange, 
  onRangeChange, 
  className 
}: Props) {
  const [open, setOpen] = useState(false);

  let displayLabel = "Filter by date";
  if (mode === "single" && singleValue) {
    displayLabel = `Filtering: ${format(singleValue, "EEE, MMM d, yyyy")}`;
  } else if (mode === "range" && rangeValue?.from) {
    if (rangeValue.to) {
      displayLabel = `${format(rangeValue.from, "MMM d")} - ${format(rangeValue.to, "MMM d, yyyy")}`;
    } else {
      displayLabel = format(rangeValue.from, "MMM d, yyyy");
    }
  }

  const hasValue = mode === "single" ? !!singleValue : !!rangeValue?.from;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 flex-1 justify-start gap-2 rounded-xl border-border bg-card text-left text-sm font-semibold shadow-card hover:bg-accent-soft",
              hasValue ? "text-accent" : "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="truncate">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {mode === "single" ? (
            <Calendar
              mode="single"
              selected={singleValue ?? undefined}
              onSelect={(d) => {
                onSingleChange?.(d ? startOfDay(d) : null);
                setOpen(false);
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          ) : (
            <Calendar
              mode="range"
              selected={rangeValue ?? undefined}
              onSelect={(d) => {
                if (d) {
                  const normalized = {
                    from: d.from ? startOfDay(d.from) : undefined,
                    to: d.to ? startOfDay(d.to) : undefined,
                  };
                  onRangeChange?.(normalized);
                } else {
                  onRangeChange?.(null);
                }
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          )}
        </PopoverContent>
      </Popover>
      {hasValue && (
        <Button
          variant="outline"
          onClick={() => {
            if (mode === "single") onSingleChange?.(null);
            else onRangeChange?.(null);
          }}
          className="h-10 rounded-xl border-border bg-card text-accent shadow-card hover:bg-accent-soft"
          aria-label="Clear date filter"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
