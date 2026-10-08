import { Plane, Hotel, Sun, Bus as BusIcon, CalendarDays, TrainFront, CalendarCheck, IndianRupee } from "lucide-react";

export type TabKey = "flights" | "hotels" | "trains" | "buses" | "day" | "monthly" | "events" | "spend";

type TabConfig = {
  key: TabKey;
  label: string;
  icon: typeof Plane;
  activeGradient: string;
  activeShadow: string;
};

const TABS: TabConfig[] = [
  {
    key: "flights",
    label: "Flights",
    icon: Plane,
    activeGradient: "linear-gradient(135deg, oklch(0.46 0.21 264) 0%, oklch(0.38 0.22 285) 100%)",
    activeShadow: "0 4px 14px oklch(0.46 0.21 264 / 40%)",
  },
  {
    key: "hotels",
    label: "Hotels",
    icon: Hotel,
    activeGradient: "linear-gradient(135deg, oklch(0.52 0.18 30) 0%, oklch(0.62 0.20 50) 100%)",
    activeShadow: "0 4px 14px oklch(0.52 0.18 30 / 40%)",
  },
  {
    key: "trains",
    label: "Trains",
    icon: TrainFront,
    activeGradient: "linear-gradient(135deg, oklch(0.48 0.16 155) 0%, oklch(0.54 0.18 170) 100%)",
    activeShadow: "0 4px 14px oklch(0.48 0.16 155 / 40%)",
  },
  {
    key: "buses",
    label: "Buses",
    icon: BusIcon,
    activeGradient: "linear-gradient(135deg, oklch(0.58 0.17 65) 0%, oklch(0.66 0.18 80) 100%)",
    activeShadow: "0 4px 14px oklch(0.58 0.17 65 / 40%)",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarCheck,
    activeGradient: "linear-gradient(135deg, oklch(0.50 0.18 300) 0%, oklch(0.56 0.20 315) 100%)",
    activeShadow: "0 4px 14px oklch(0.50 0.18 300 / 40%)",
  },
  {
    key: "day",
    label: "Itinerary",
    icon: Sun,
    activeGradient: "linear-gradient(135deg, oklch(0.62 0.19 60) 0%, oklch(0.70 0.20 45) 100%)",
    activeShadow: "0 4px 14px oklch(0.62 0.19 60 / 40%)",
  },
  {
    key: "monthly",
    label: "Month",
    icon: CalendarDays,
    activeGradient: "linear-gradient(135deg, oklch(0.52 0.16 200) 0%, oklch(0.58 0.18 220) 100%)",
    activeShadow: "0 4px 14px oklch(0.52 0.16 200 / 40%)",
  },
  {
    key: "spend",
    label: "Spend",
    icon: IndianRupee,
    activeGradient: "linear-gradient(135deg, oklch(0.48 0.18 340) 0%, oklch(0.54 0.20 355) 100%)",
    activeShadow: "0 4px 14px oklch(0.48 0.18 340 / 40%)",
  },
];

type Props = {
  value: TabKey;
  onChange: (v: TabKey) => void;
};

export function Tabs({ value, onChange }: Props) {
  return (
    <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-3 text-[11px] font-bold transition-all duration-200"
            style={
              active
                ? {
                    background: t.activeGradient,
                    boxShadow: t.activeShadow,
                    color: "white",
                    transform: "translateY(-1px)",
                  }
                : {
                    background: "var(--color-card)",
                    boxShadow: "var(--card-shadow)",
                    color: "var(--color-muted-foreground)",
                  }
            }
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.color = "var(--color-accent)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.color = "var(--color-muted-foreground)";
                e.currentTarget.style.transform = "";
              }
            }}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span>{t.label}</span>
            {active && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white opacity-70" />
            )}
          </button>
        );
      })}
    </div>
  );
}