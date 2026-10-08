import { useState, useRef, useEffect, useCallback } from "react";
import { Users, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PersonFilterBarProps {
  assignedFilter: string;
  onSelectFilter: (name: string) => void;
  allAssignees: string[];
  filterOpen: boolean;
  onToggleFilter: () => void;
  className?: string;
  rightAction?: React.ReactNode;
}

export function PersonFilterBar({
  assignedFilter,
  onSelectFilter,
  allAssignees,
  filterOpen,
  onToggleFilter,
  className = "",
  rightAction,
}: PersonFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      const atStart = el.scrollLeft <= 4;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
      setCanScrollLeft(!atStart);
      setCanScrollRight(!atEnd);
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (el) {
      const scrollAmount = Math.max(160, el.clientWidth * 0.6);
      el.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (filterOpen) {
      checkScroll();
      const t = setTimeout(checkScroll, 60);
      window.addEventListener("resize", checkScroll);
      return () => {
        clearTimeout(t);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [filterOpen, allAssignees, checkScroll]);

  if (!allAssignees || allAssignees.length === 0) return null;

  const getLabel = () => {
    if (assignedFilter === "all") return "All Travelers";
    if (assignedFilter === "me") return "Showing: Me";
    return `Showing: ${assignedFilter}`;
  };

  return (
    <div className={cn("mb-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleFilter}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15 active:scale-95 shadow-xs shrink-0"
        >
          <Users className="h-3.5 w-3.5" />
          <span>{getLabel()}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", filterOpen && "rotate-180")} />
        </button>
        {rightAction && (
          <div className="shrink-0">
            {rightAction}
          </div>
        )}
      </div>

      {filterOpen && (
        <div className="relative mt-2.5 rounded-2xl bg-card p-3 shadow-card border border-border/50 animate-fade-in-up">
          <div className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground">
            <span>Filter by traveler</span>
            {assignedFilter !== "all" && (
              <button
                type="button"
                onClick={() => onSelectFilter("all")}
                className="text-accent hover:underline text-[11px] font-medium transition active:scale-95"
              >
                Reset to All
              </button>
            )}
          </div>

          <div className="relative flex items-center">
            {/* Left Arrow Button — only shown when scrolled away from left edge */}
            {canScrollLeft && (
              <div className="absolute left-0 z-20 flex items-center pr-2 bg-gradient-to-r from-card via-card/95 to-transparent h-full">
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-foreground shadow-md transition hover:bg-muted hover:scale-110 active:scale-95"
                  title="Scroll left"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Horizontal single-line swipeable pill strip */}
            <div
              ref={scrollRef}
              onScroll={checkScroll}
              data-no-swipe="true"
              className={cn(
                "flex items-center gap-1.5 overflow-x-auto tab-strip py-1 px-1 scroll-smooth w-full",
                canScrollLeft && "pl-8",
                canScrollRight && "pr-8"
              )}
            >
              <button
                type="button"
                onClick={() => onSelectFilter("me")}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                  assignedFilter === "me"
                    ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-accent"
                    : "bg-muted/60 text-muted-foreground hover:bg-accent-soft hover:text-accent border border-border/40",
                )}
              >
                Me
              </button>

              <button
                type="button"
                onClick={() => onSelectFilter("all")}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                  assignedFilter === "all"
                    ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-accent"
                    : "bg-muted/60 text-muted-foreground hover:bg-accent-soft hover:text-accent border border-border/40",
                )}
              >
                All
              </button>

              {allAssignees.map((name) => {
                const isSelected = assignedFilter === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onSelectFilter(name)}
                    className={cn(
                      "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                      isSelected
                        ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-accent"
                        : "bg-muted/60 text-muted-foreground hover:bg-accent-soft hover:text-accent border border-border/40",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Right Arrow Button — only shown when more items exist on right */}
            {canScrollRight && (
              <div className="absolute right-0 z-20 flex items-center pl-2 bg-gradient-to-l from-card via-card/95 to-transparent h-full">
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-foreground shadow-md transition hover:bg-muted hover:scale-110 active:scale-95"
                  title="Scroll right"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
