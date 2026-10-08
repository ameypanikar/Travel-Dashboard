import { useState, useCallback, useRef } from "react";
import { MapPin, Navigation, UtensilsCrossed, Loader2, LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

type Restaurant = {
  id: string;
  name: string;
  cuisine: string;
  cuisineRaw: string;
  lat: number;
  lon: number;
  distanceKm: number;
  address: string;
  openingHours?: string;
  phone?: string;
};

type CuisineFilter = "all" | "indian" | "chinese" | "italian" | "fast_food" | "cafe" | "pizza" | "seafood" | "vegetarian";

const CUISINE_LABELS: Record<CuisineFilter, string> = {
  all: "All",
  indian: "🍛 Indian",
  chinese: "🥡 Chinese",
  italian: "🍝 Italian",
  fast_food: "🍔 Fast Food",
  cafe: "☕ Café",
  pizza: "🍕 Pizza",
  seafood: "🦞 Seafood",
  vegetarian: "🥗 Veg",
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Use Nominatim search — fully CORS-enabled, no API key needed
async function fetchNearbyRestaurants(
  lat: number,
  lon: number,
  cuisine: CuisineFilter,
  signal: AbortSignal,
): Promise<Restaurant[]> {
  // Nominatim's basic search API doesn't support arbitrary OSM tag filters (e.g. cuisine=X)
  // reliably, so we always fetch a broad amenity-based set, then filter by cuisine client-side
  // using the extratags.cuisine field returned per result.
  const amenityQueries: { amenity: string }[] =
    cuisine === "cafe"
      ? [{ amenity: "cafe" }]
      : cuisine === "fast_food"
        ? [{ amenity: "fast_food" }]
        : [{ amenity: "restaurant" }, { amenity: "fast_food" }, { amenity: "cafe" }];

  const allResults: Record<string, unknown>[] = [];

  for (const q of amenityQueries) {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json&limit=40&addressdetails=1&extratags=1` +
      `&amenity=${q.amenity}` +
      `&viewbox=${lon - 0.05},${lat + 0.05},${lon + 0.05},${lat - 0.05}` +
      `&bounded=1`;

    const res = await fetch(url, {
      signal,
      headers: { "Accept-Language": "en", "User-Agent": "TravelDashboard/1.0" },
    });
    if (!res.ok) continue; // skip this amenity type on failure, don't abort entire search
    const data = await res.json();
    if (Array.isArray(data)) allResults.push(...data);
  }

  if (allResults.length === 0) throw new Error("Search failed — no results from map service");

  // Cuisine keywords to match against each result's extratags.cuisine value
  const CUISINE_KEYWORDS: Record<string, string[]> = {
    indian: ["indian"],
    chinese: ["chinese", "asian"],
    italian: ["italian"],
    pizza: ["pizza"],
    seafood: ["seafood", "fish"],
    vegetarian: ["vegetarian", "vegan"],
  };

  // Dedupe by place_id (same place may appear in multiple amenity queries)
  const seen = new Set<string>();
  const deduped = allResults.filter((el) => {
    const id = String(el.place_id);
    if (seen.has(id)) return false;
    seen.add(id);
    return el.display_name && el.lat && el.lon;
  });

  let results: Restaurant[] = deduped
    .map((el: Record<string, unknown>) => {
      const elLat = parseFloat(el.lat as string);
      const elLon = parseFloat(el.lon as string);
      const extratags = (el.extratags as Record<string, string>) || {};
      const address = el.address as Record<string, string> || {};

      // Extract cuisine from extratags
      let cuisineLabel = extratags.cuisine
        ? extratags.cuisine.split(";")[0].replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
        : el.type === "cafe" ? "Café"
        : el.type === "fast_food" ? "Fast Food"
        : "Restaurant";

      // Build short address
      const addrParts = [
        address.road || address.pedestrian,
        address.suburb || address.neighbourhood,
      ].filter(Boolean);

      return {
        id: String(el.place_id),
        name: (el.name as string) || (el.display_name as string).split(",")[0],
        cuisine: cuisineLabel,
        cuisineRaw: (extratags.cuisine || "").toLowerCase(),
        lat: elLat,
        lon: elLon,
        distanceKm: Math.round(haversineKm(lat, lon, elLat, elLon) * 10) / 10,
        address: addrParts.join(", "),
        openingHours: extratags.opening_hours,
        phone: extratags.phone || extratags["contact:phone"],
      };
    });

  // Apply client-side cuisine filter (skip for all/cafe/fast_food which are already amenity-filtered)
  if (CUISINE_KEYWORDS[cuisine]) {
    const keywords = CUISINE_KEYWORDS[cuisine];
    results = results.filter((r) =>
      keywords.some((kw) => r.cuisineRaw.includes(kw) || r.cuisine.toLowerCase().includes(kw))
    );
  }

  results = results
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);

  return results;
}

// 24 varied food/restaurant photos from Unsplash — assigned by name hash so each restaurant gets a consistent but unique photo
// Static Unsplash photo IDs (source.unsplash.com is deprecated/shut down — must use direct photo URLs)
// These are verified working Unsplash CDN photo IDs for food/restaurant imagery
const FOOD_PHOTOS = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80",
  "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80",
  "https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=600&q=80",
  "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=600&q=80",
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80",
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80",
  "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80",
  "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&q=80",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=600&q=80",
  "https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?w=600&q=80",
  "https://images.unsplash.com/photo-1576867757603-05b134ebc379?w=600&q=80",
  "https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?w=600&q=80",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&q=80",
  "https://images.unsplash.com/photo-1493857671505-72967e2e2760?w=600&q=80",
  "https://images.unsplash.com/photo-1481833761820-0509d3217039?w=600&q=80",
  "https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=600&q=80",
  "https://images.unsplash.com/photo-1543353071-873f17a7a088?w=600&q=80",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80",
  "https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=600&q=80",
  "https://images.unsplash.com/photo-1574484284002-952d92456975?w=600&q=80",
  "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=80",
  "https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=600&q=80",
];

function getRestaurantPhoto(name: string, id: string): string {
  let hash = 0;
  const seedStr = (id || name) + name; // combine for better distribution
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return FOOD_PHOTOS[hash % FOOD_PHOTOS.length];
}
type Props = {
  defaultLocation?: string;
};
export function LocalEats({ defaultLocation = "" }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cuisine, setCuisine] = useState<CuisineFilter>("all");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationName, setLocationName] = useState(defaultLocation);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async (lat: number, lon: number, c: CuisineFilter) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setLoadingStep("Searching nearby restaurants…");
    try {
      const results = await fetchNearbyRestaurants(lat, lon, c, controller.signal);
      setRestaurants(results);
      setHasSearched(true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLoading(true);
    setLoadingStep("Getting your location…");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });

        // Reverse geocode non-blocking
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          { headers: { "Accept-Language": "en" } },
        )
          .then(r => r.json())
          .then(j => {
            const addr = j.address ?? {};
            setLocationName(
              addr.suburb || addr.neighbourhood || addr.city_district ||
              addr.city || addr.town || addr.village || "Your location",
            );
          })
          .catch(() => setLocationName(`${lat.toFixed(3)}, ${lon.toFixed(3)}`));

        await doFetch(lat, lon, cuisine);
      },
      (err) => {
        setLoading(false);
        setLoadingStep("");
        setError(
          err.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : "Could not get your location. Please try again.",
        );
      },
      { timeout: 8000, maximumAge: 30000 },
    );
  };

  const handleCuisineChange = (c: CuisineFilter) => {
    setCuisine(c);
    if (coords) doFetch(coords.lat, coords.lon, c);
  };

  const mapsUrl = (r: Restaurant) =>
    `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        {locationName && (
          <div className="mb-3 flex items-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-accent" />
            <span className="font-medium text-foreground">{locationName}</span>
          </div>
        )}

        <button
          onClick={handleLocate}
          disabled={loading}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          {loading ? (loadingStep || "Loading…") : coords ? "Refresh location" : "Use my location"}
        </button>

        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CUISINE_LABELS) as CuisineFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => handleCuisineChange(c)}
              disabled={loading}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                cuisine === c ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent-soft",
              )}
            >
              {CUISINE_LABELS[c]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Real restaurants within ~5 km · OpenStreetMap
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 shadow-card text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          {loadingStep}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasSearched && !loading && restaurants.length === 0 && !error && (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
          <UtensilsCrossed className="mx-auto mb-2 h-6 w-6" />
          No restaurants found nearby. Try a different filter or tap Refresh.
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
          <LocateFixed className="mx-auto mb-2 h-6 w-6" />
          Tap "Use my location" to find restaurants near you.
        </div>
      )}

      {!loading && restaurants.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {restaurants.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
              {/* Cuisine photo */}
              <div className="relative h-32 w-full bg-muted">
                <img
                  src={getRestaurantPhoto(r.name, r.id)}
                  alt={r.cuisine}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to a guaranteed-working default if this specific photo ID fails
                    const img = e.currentTarget;
                    if (img.dataset.fallback !== "1") {
                      img.dataset.fallback = "1";
                      img.src = FOOD_PHOTOS[0];
                    }
                  }}
                />
                {/* Name overlay at bottom */}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent px-3 pb-2">
                  <div className="truncate text-sm font-bold text-white">{r.name}</div>
                  <div className="text-[11px] text-white/80">{r.cuisine}</div>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>
                    {r.distanceKm < 1
                      ? `${Math.round(r.distanceKm * 1000)} m away`
                      : `${r.distanceKm.toFixed(1)} km away`}
                  </span>
                </div>
                {r.address && (
                  <div className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{r.address}</div>
                )}
                {r.openingHours && (
                  <div className="mt-1 text-[11px] text-muted-foreground">🕐 {r.openingHours}</div>
                )}
                {r.phone && (
                  <div className="mt-1 text-[11px] text-muted-foreground">📞 {r.phone}</div>
                )}
                <a
                  href={mapsUrl(r)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground hover:opacity-90"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  View on Map
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}