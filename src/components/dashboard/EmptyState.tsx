const ICONS: Record<string, string> = {
  flights: "✈️",
  hotels: "🏨",
  trains: "🚆",
  buses: "🚌",
  events: "🗓️",
  spend: "💳",
  day: "🌅",
  default: "🗺️",
};

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string;
  message: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}) {
  const emoji = icon ? (ICONS[icon] ?? ICONS.default) : ICONS.default;
  return (
    <div className="animate-fade-in-up rounded-2xl bg-card shadow-card overflow-hidden">
      {/* Subtle gradient top strip */}
      <div
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, oklch(0.46 0.19 264 / 40%) 0%, oklch(0.52 0.18 30 / 30%) 50%, oklch(0.48 0.16 155 / 40%) 100%)",
        }}
      />
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.46 0.19 264 / 10%) 0%, oklch(0.52 0.18 30 / 8%) 100%)",
          }}
        >
          {emoji}
        </div>
        <div className="text-base font-bold text-foreground">{title}</div>
        <div className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
          {message}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.46 0.19 264) 0%, oklch(0.52 0.20 240) 100%)",
              boxShadow: "0 4px 12px oklch(0.46 0.19 264 / 30%)",
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
