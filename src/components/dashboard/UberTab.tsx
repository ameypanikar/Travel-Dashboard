import { useMemo, useState } from "react";
import { Car, ExternalLink, MapPin, Navigation } from "lucide-react";

type Props = {
  // Optional list of hotel addresses to suggest as quick destinations.
  suggestions?: { label: string; address: string }[];
};

export function UberTab({ suggestions = [] }: Props) {
  const [destination, setDestination] = useState("");

  const { deepLink, webLink } = useMemo(() => {
    const dropoff = destination.trim();
    const params = new URLSearchParams({
      action: "setPickup",
      pickup: "my_location",
    });
    const webParams = new URLSearchParams({ "drop[0]": "" });

    if (dropoff) {
      params.set("dropoff[formatted_address]", dropoff);
      params.set("dropoff[nickname]", dropoff);
      webParams.set("drop[0]", JSON.stringify({ addr: dropoff }));
    }

    return {
      deepLink: `uber://?${params.toString()}`,
      webLink: dropoff
        ? `https://m.uber.com/ul/?${params.toString()}`
        : `https://m.uber.com/`,
    };
  }, [destination]);

  const handleBook = () => {
    // Try the app first; fall back to the mobile web after a short delay.
    const start = Date.now();
    const fallback = window.setTimeout(() => {
      // If we never lost focus, the app didn't open — go to the web.
      if (Date.now() - start < 2000) window.location.href = webLink;
    }, 1200);
    const onHide = () => {
      window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onHide);
    };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = deepLink;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent">
          <Car className="h-4 w-4" /> Ground Transport
        </div>
        <div className="text-[11px] text-muted-foreground">
          Open Uber with your destination prefilled. Pickup uses your current location.
        </div>

        <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Where to?
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Hotel name, airport, or address"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.address}
                onClick={() => setDestination(s.address)}
                className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/10"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleBook}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-card transition hover:opacity-90"
        >
          <Navigation className="h-4 w-4" /> Book an Uber
        </button>

        <a
          href={webLink}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-accent-soft px-4 py-2.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
        >
          Open on web instead <ExternalLink className="h-3 w-3" />
        </a>

        <div className="mt-3 text-center text-[10px] text-muted-foreground">
          On mobile, tapping Book opens the Uber app if installed; otherwise it falls back to the web.
        </div>
      </div>
    </div>
  );
}
