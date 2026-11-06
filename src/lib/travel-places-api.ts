// Free Open APIs for Travel Suggestions
// Geocoding: OpenStreetMap Nominatim + Open-Meteo (100% Free, CORS-friendly)
// Hotels: OpenStreetMap Nominatim / Overpass (Free, No Key)
// Restaurants: OpenStreetMap Nominatim Amenity Search (Free, No Key)
// Weather: Open-Meteo (Free, No Key)

import { haversineDistanceKm } from "./airport-data";
import { getAirportByCode } from "./airport-data";

export type GeocodedPlace = {
  displayName: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
};

export type RailwayStationSuggestion = {
  id: string;
  name: string;
  code?: string;
  city: string;
  distanceKm: number;
  driveTimeEstimate: string;
  address: string;
  type: string;
  mapsUrl: string;
};

export type HotelSuggestion = {
  id: string;
  name: string;
  distanceKm: number;
  address: string;
  type: string;
  phone?: string;
  website?: string;
  mapsUrl: string;
};

export type RestaurantSuggestion = {
  id: string;
  name: string;
  cuisine: string;
  distanceKm: number;
  address: string;
  openingHours?: string;
  phone?: string;
  mapsUrl: string;
};

export type TravelWeatherSummary = {
  city: string;
  date?: string;
  tempMax: number;
  tempMin: number;
  currentTemp?: number;
  condition: string;
  precipitationProb: number;
};

// In-memory cache to prevent redundant network queries
const geoCache = new Map<string, GeocodedPlace>();
const hotelCache = new Map<string, HotelSuggestion[]>();
const restaurantCache = new Map<string, RestaurantSuggestion[]>();
const stationCache = new Map<string, RailwayStationSuggestion[]>();

type CuratedStation = {
  name: string;
  code: string;
  city: string;
  lat: number;
  lon: number;
  type: string;
};

const MAJOR_RAILWAY_STATIONS: CuratedStation[] = [
  // Bengaluru
  { name: "Lottegollahalli Railway Station", code: "LOGH", city: "Bengaluru", lat: 13.0375, lon: 77.5670, type: "Suburban" },
  { name: "Yeshwantpur Junction", code: "YPR", city: "Bengaluru", lat: 13.0238, lon: 77.5503, type: "Major Junction" },
  { name: "Chikka Banavara Junction", code: "BAW", city: "Bengaluru", lat: 13.0747, lon: 77.5056, type: "Junction" },
  { name: "Hebbal Railway Station", code: "HEB", city: "Bengaluru", lat: 13.0354, lon: 77.5975, type: "Suburban" },
  { name: "Malleswaram Railway Station", code: "MWM", city: "Bengaluru", lat: 13.0043, lon: 77.5684, type: "Suburban" },
  { name: "Bangalore Cantonment", code: "BNC", city: "Bengaluru", lat: 12.9937, lon: 77.5982, type: "Central Station" },
  { name: "KSR Bengaluru City Junction (Majestic)", code: "SBC", city: "Bengaluru", lat: 12.9782, lon: 77.5696, type: "Main Terminus" },
  { name: "Banaswadi Railway Station", code: "BAND", city: "Bengaluru", lat: 13.0058, lon: 77.6281, type: "Station" },
  { name: "Sir M. Visvesvaraya Terminal, Baiyappanahalli", code: "SMVB", city: "Bengaluru", lat: 13.0045, lon: 77.6534, type: "Modern Coaching Terminal" },
  { name: "Krishnarajapuram (K.R. Puram)", code: "KJM", city: "Bengaluru", lat: 13.0016, lon: 77.6766, type: "Major IT Corridor Junction" },
  { name: "Yelahanka Junction", code: "YNK", city: "Bengaluru", lat: 13.1050, lon: 77.5919, type: "Junction" },
  { name: "Whitefield Railway Station", code: "WFD", city: "Bengaluru", lat: 12.9928, lon: 77.7554, type: "Tech Corridor" },

  // Mumbai
  { name: "Chhatrapati Shivaji Maharaj Terminus", code: "CSMT", city: "Mumbai", lat: 18.9401, lon: 72.8354, type: "Central Terminus" },
  { name: "Mumbai Central", code: "MMCT", city: "Mumbai", lat: 18.9696, lon: 72.8194, type: "Western Terminus" },
  { name: "Dadar Junction", code: "DR", city: "Mumbai", lat: 19.0180, lon: 72.8432, type: "Major Interchange" },
  { name: "Bandra Terminus", code: "BDTS", city: "Mumbai", lat: 19.0573, lon: 72.8407, type: "Western Terminus (BKC)" },
  { name: "Lokmanya Tilak Terminus (Kurla)", code: "LTT", city: "Mumbai", lat: 19.0684, lon: 72.8906, type: "Central Terminus" },
  { name: "Andheri Railway Station", code: "ADH", city: "Mumbai", lat: 19.1197, lon: 72.8464, type: "Western Hub" },
  { name: "Borivali Railway Station", code: "BVI", city: "Mumbai", lat: 19.2290, lon: 72.8573, type: "Western Hub" },
  { name: "Thane Railway Station", code: "TNA", city: "Mumbai", lat: 19.1860, lon: 72.9759, type: "Central Junction" },
  { name: "Kalyan Junction", code: "KYN", city: "Mumbai", lat: 19.2354, lon: 73.1301, type: "Major Junction" },

  // Delhi NCR
  { name: "New Delhi Railway Station", code: "NDLS", city: "New Delhi", lat: 28.6427, lon: 77.2195, type: "Main Central Station" },
  { name: "Old Delhi Railway Station", code: "DLI", city: "Delhi", lat: 28.6606, lon: 77.2285, type: "Historic Terminal" },
  { name: "Hazrat Nizamuddin", code: "NZM", city: "New Delhi", lat: 28.5889, lon: 77.2533, type: "South Delhi Terminal" },
  { name: "Anand Vihar Terminal", code: "ANVT", city: "Delhi", lat: 28.6502, lon: 77.3152, type: "East Delhi Terminal" },
  { name: "Delhi Sarai Rohilla", code: "DEE", city: "Delhi", lat: 28.6668, lon: 77.1818, type: "West Delhi Station" },
  { name: "Gurgaon Railway Station", code: "GGN", city: "Gurugram", lat: 28.4720, lon: 77.0140, type: "NCR Station" },
  { name: "Ghaziabad Junction", code: "GZB", city: "Ghaziabad", lat: 28.6537, lon: 77.4332, type: "NCR Junction" },
  { name: "Faridabad", code: "FDB", city: "Faridabad", lat: 28.4089, lon: 77.3178, type: "NCR Station" },

  // Pune
  { name: "Pune Junction", code: "PUNE", city: "Pune", lat: 18.5284, lon: 73.8744, type: "Main Central Station" },
  { name: "Shivajinagar Railway Station", code: "SVJR", city: "Pune", lat: 18.5323, lon: 73.8524, type: "City Station" },
  { name: "Khadki Railway Station", code: "KK", city: "Pune", lat: 18.5639, lon: 73.8347, type: "Station" },
  { name: "Chinchwad Railway Station", code: "CCH", city: "Pune", lat: 18.6366, lon: 73.7917, type: "PCMC Industrial Hub" },
  { name: "Hadapsar Satellite Terminal", code: "HDP", city: "Pune", lat: 18.5089, lon: 73.9260, type: "East Terminal" },

  // Hyderabad
  { name: "Secunderabad Junction", code: "SC", city: "Hyderabad", lat: 17.4344, lon: 78.5013, type: "Main Junction" },
  { name: "Hyderabad Deccan (Nampally)", code: "HYB", city: "Hyderabad", lat: 17.3920, lon: 78.4682, type: "Central Terminal" },
  { name: "Kacheguda Railway Station", code: "KCG", city: "Hyderabad", lat: 17.3871, lon: 78.4950, type: "Historic Terminal" },
  { name: "Lingampalli Railway Station", code: "LPI", city: "Hyderabad", lat: 17.4828, lon: 78.3182, type: "Hitec City Hub" },
  { name: "Begumpet Railway Station", code: "BMT", city: "Hyderabad", lat: 17.4385, lon: 78.4608, type: "City Station" },

  // Chennai
  { name: "Puratchi Thalaivar Dr. M.G.R. Central (Chennai Central)", code: "MAS", city: "Chennai", lat: 13.0827, lon: 80.2755, type: "Main Terminus" },
  { name: "Chennai Egmore", code: "MS", city: "Chennai", lat: 13.0784, lon: 80.2613, type: "South-bound Terminus" },
  { name: "Tambaram Railway Station", code: "TBM", city: "Chennai", lat: 12.9249, lon: 80.1000, type: "South Suburban Hub" },
  { name: "Perambur Railway Station", code: "PER", city: "Chennai", lat: 13.1091, lon: 80.2452, type: "North Hub" },

  // Kolkata
  { name: "Howrah Junction", code: "HWH", city: "Kolkata", lat: 22.5839, lon: 88.3426, type: "Historic Mega-Terminal" },
  { name: "Sealdah Railway Station", code: "SDAH", city: "Kolkata", lat: 22.5670, lon: 88.3713, type: "Central Terminal" },
  { name: "Shalimar Railway Station", code: "SHM", city: "Kolkata", lat: 22.5539, lon: 88.3129, type: "South Terminal" },
  { name: "Kolkata Chitpur Terminal", code: "KOAA", city: "Kolkata", lat: 22.6033, lon: 88.3789, type: "Terminal" },

  // Ahmedabad
  { name: "Ahmedabad Junction (Kalupur)", code: "ADI", city: "Ahmedabad", lat: 23.0232, lon: 72.6006, type: "Main Central Station" },
  { name: "Sabarmati Junction", code: "SBT", city: "Ahmedabad", lat: 23.0772, lon: 72.5857, type: "North Hub" },
  { name: "Gandhinagar Capital", code: "GNC", city: "Gandhinagar", lat: 23.2323, lon: 72.6397, type: "Capital Station" },
];

export function estimateRailwayDriveTime(distanceKm: number): string {
  if (distanceKm < 2.5) return `~5-8m drive (${distanceKm.toFixed(1)} km)`;
  if (distanceKm < 5) return `~10-15m drive (${distanceKm.toFixed(1)} km)`;
  if (distanceKm < 10) return `~18-25m drive (${distanceKm.toFixed(1)} km)`;
  if (distanceKm < 20) return `~30-45m drive (${distanceKm.toFixed(1)} km)`;
  const hours = Math.floor(distanceKm / 35);
  const mins = Math.round((distanceKm % 35) * 1.7);
  return `~${hours}h ${mins > 0 ? `${mins}m` : ""} drive (${distanceKm.toFixed(1)} km)`;
}

/**
 * Geocodes any address, customer company, road, or city name
 * Uses OpenStreetMap Nominatim with Open-Meteo fallback
 */
export async function geocodeLocation(query: string): Promise<GeocodedPlace | null> {
  if (!query || !query.trim()) return null;
  const clean = query.trim();
  const cacheKey = clean.toLowerCase();

  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!;
  }

  // 1. Check if it's a known airport code
  const airport = getAirportByCode(clean);
  if (airport) {
    const res: GeocodedPlace = {
      displayName: `${airport.name} (${airport.iata}), ${airport.city}, ${airport.country}`,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      lat: airport.lat,
      lon: airport.lon,
    };
    geoCache.set(cacheKey, res);
    return res;
  }

  // 2. OpenStreetMap Nominatim Search (Detailed address matching)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=6&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "TravelTrackerDashboard-Copilot/1.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Filter out accidental natural matches (e.g. botanical trees or streams named after acronyms)
        const validItem = data.find((d: any) => d.type !== "tree" && d.class !== "natural") || data[0];
        const addr = validItem.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.state_district || addr.county || "";
        const country = addr.country || "";
        const name = validItem.name || validItem.display_name.split(",")[0] || clean;

        const result: GeocodedPlace = {
          displayName: validItem.display_name,
          name,
          city: city || name,
          country,
          lat: parseFloat(validItem.lat),
          lon: parseFloat(validItem.lon),
        };
        geoCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn("Nominatim geocoding failed, trying Open-Meteo fallback:", err);
  }

  // 3. Open-Meteo Geocoding Fallback
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=en&format=json`;
    const res = await fetch(geoUrl);
    if (res.ok) {
      const json = await res.json();
      const first = json.results?.[0];
      if (first) {
        const result: GeocodedPlace = {
          displayName: `${first.name}${first.admin1 ? ", " + first.admin1 : ""}, ${first.country}`,
          name: first.name,
          city: first.name,
          country: first.country || "",
          lat: first.latitude,
          lon: first.longitude,
        };
        geoCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn("Open-Meteo geocoding fallback failed:", err);
  }

  return null;
}

/**
 * Searches for hotels and accommodations near lat/lon coordinates using OpenStreetMap Nominatim
 */
export async function searchHotelsNear(
  lat: number,
  lon: number,
  radiusKm = 10,
  limit = 5
): Promise<HotelSuggestion[]> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}_${radiusKm}`;
  if (hotelCache.has(cacheKey)) {
    return hotelCache.get(cacheKey)!;
  }

  const degOffset = radiusKm / 111; // ~111km per degree latitude
  const viewbox = `${lon - degOffset},${lat + degOffset},${lon + degOffset},${lat - degOffset}`;

  const queries = ["hotel", "resort", "guest house"];
  const allRaw: Record<string, unknown>[] = [];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=25&addressdetails=1&extratags=1&viewbox=${viewbox}&bounded=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "TravelTrackerDashboard-Copilot/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) allRaw.push(...data);
      }
    } catch (e) {
      console.warn("Hotel search step failed:", e);
    }
  }

  const seen = new Set<string>();
  const parsed: HotelSuggestion[] = [];

  for (const item of allRaw) {
    const id = String(item.place_id);
    if (seen.has(id)) continue;
    seen.add(id);

    const name = String(item.name || (item.display_name ? String(item.display_name).split(",")[0] : "")).trim();
    if (!name || name.length < 3) continue;

    const itemLat = parseFloat(String(item.lat));
    const itemLon = parseFloat(String(item.lon));
    if (isNaN(itemLat) || isNaN(itemLon)) continue;

    const distanceKm = haversineDistanceKm(lat, lon, itemLat, itemLon);
    const extratags = (item.extratags || {}) as Record<string, string>;
    const address = String(item.display_name || "");

    parsed.push({
      id,
      name,
      distanceKm,
      address,
      type: extratags.tourism || "Hotel",
      phone: extratags.phone || extratags["contact:phone"],
      website: extratags.website || extratags["contact:website"],
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + (item.address ? (item.address as Record<string, string>).city || "" : ""))}`,
    });
  }

  parsed.sort((a, b) => a.distanceKm - b.distanceKm);
  const result = parsed.slice(0, limit);
  hotelCache.set(cacheKey, result);
  return result;
}

function normalizeStationKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(railway|station|junction|jn|terminal|terminals|halt)\b/gi, "")
    .replace(/sh/g, "s")
    .replace(/w/g, "v")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Searches for railway stations near lat/lon coordinates
 * Combines curated major railway junction dataset with OpenStreetMap Nominatim spatial queries
 */
export async function searchRailwayStationsNear(
  lat: number,
  lon: number,
  radiusKm = 35,
  limit = 5
): Promise<RailwayStationSuggestion[]> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}_${radiusKm}`;
  if (stationCache.has(cacheKey)) {
    return stationCache.get(cacheKey)!;
  }

  const results: RailwayStationSuggestion[] = [];
  const seenKeys = new Set<string>();

  // 1. Check curated major stations first for instant, accurate results
  for (const st of MAJOR_RAILWAY_STATIONS) {
    const dist = haversineDistanceKm(lat, lon, st.lat, st.lon);
    if (dist <= radiusKm) {
      results.push({
        id: `curated-${st.code}`,
        name: st.name,
        code: st.code,
        city: st.city,
        distanceKm: dist,
        driveTimeEstimate: estimateRailwayDriveTime(dist),
        address: `${st.name}, ${st.city}`,
        type: st.type,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(st.name + " " + st.city)}`,
      });
      seenKeys.add(normalizeStationKey(st.name));
      if (st.code) seenKeys.add(st.code.toLowerCase());
    }
  }

  // 2. Query OpenStreetMap Nominatim for local railway stations in the vicinity
  try {
    const degOffset = radiusKm / 111;
    const viewbox = `${lon - degOffset},${lat + degOffset},${lon + degOffset},${lat - degOffset}`;
    const url = `https://nominatim.openstreetmap.org/search?q=railway+station&format=json&limit=20&addressdetails=1&viewbox=${viewbox}&bounded=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "TravelTrackerDashboard-Copilot/1.0" },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const itemLat = parseFloat(String(item.lat));
          const itemLon = parseFloat(String(item.lon));
          if (isNaN(itemLat) || isNaN(itemLon)) continue;

          const dist = haversineDistanceKm(lat, lon, itemLat, itemLon);
          if (dist > radiusKm) continue;

          const rawName = String(item.name || (item.display_name ? String(item.display_name).split(",")[0] : "")).trim();
          if (!rawName || rawName.length < 3) continue;

          const normKey = normalizeStationKey(rawName);
          if (seenKeys.has(normKey) || Array.from(seenKeys).some((k) => k.length > 3 && (normKey.includes(k) || k.includes(normKey)))) {
            continue;
          }

          // Also check proximity against existing results (within 0.8 km is likely same station)
          const isNearbyDuplicate = results.some((existing) => {
            return Math.abs(existing.distanceKm - dist) < 0.8;
          });
          if (isNearbyDuplicate) continue;

          seenKeys.add(normKey);

          const addr = (item.address || {}) as Record<string, string>;
          const city = addr.city || addr.town || addr.state_district || "";

          results.push({
            id: `osm-${item.place_id}`,
            name: rawName.includes("Station") || rawName.includes("Junction") ? rawName : `${rawName} Railway Station`,
            city: city || "Nearby",
            distanceKm: dist,
            driveTimeEstimate: estimateRailwayDriveTime(dist),
            address: String(item.display_name || ""),
            type: rawName.toLowerCase().includes("junction") ? "Junction" : "Railway Station",
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawName + " Railway Station " + city)}`,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Nominatim railway station query failed:", err);
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  const finalResult = results.slice(0, limit);
  stationCache.set(cacheKey, finalResult);
  return finalResult;
}

/**
 * Searches for places to eat and restaurants near lat/lon coordinates
 */
export async function searchRestaurantsNear(
  lat: number,
  lon: number,
  cuisineFilter = "all",
  radiusKm = 6,
  limit = 6
): Promise<RestaurantSuggestion[]> {
  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}_${cuisineFilter}_${radiusKm}`;
  if (restaurantCache.has(cacheKey)) {
    return restaurantCache.get(cacheKey)!;
  }

  const degOffset = radiusKm / 111;
  const viewbox = `${lon - degOffset},${lat + degOffset},${lon + degOffset},${lat - degOffset}`;

  const amenities = cuisineFilter === "cafe" 
    ? ["cafe"] 
    : cuisineFilter === "fast_food" 
    ? ["fast_food"] 
    : ["restaurant", "cafe", "fast_food"];

  const allRaw: Record<string, unknown>[] = [];

  for (const amenity of amenities) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=25&addressdetails=1&extratags=1&amenity=${amenity}&viewbox=${viewbox}&bounded=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "TravelTrackerDashboard-Copilot/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) allRaw.push(...data);
      }
    } catch (e) {
      console.warn("Restaurant search step failed:", e);
    }
  }

  const seen = new Set<string>();
  const parsed: RestaurantSuggestion[] = [];

  for (const item of allRaw) {
    const id = String(item.place_id);
    if (seen.has(id)) continue;
    seen.add(id);

    const name = String(item.name || (item.display_name ? String(item.display_name).split(",")[0] : "")).trim();
    if (!name || name.length < 3) continue;

    const itemLat = parseFloat(String(item.lat));
    const itemLon = parseFloat(String(item.lon));
    if (isNaN(itemLat) || isNaN(itemLon)) continue;

    const distanceKm = haversineDistanceKm(lat, lon, itemLat, itemLon);
    const extratags = (item.extratags || {}) as Record<string, string>;
    const cuisine = extratags.cuisine || (item.type === "cafe" ? "Café" : "Multi-Cuisine");

    parsed.push({
      id,
      name,
      cuisine: cuisine.replace(/;/g, ", ").trim(),
      distanceKm,
      address: String(item.display_name || ""),
      openingHours: extratags.opening_hours,
      phone: extratags.phone || extratags["contact:phone"],
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + (item.address ? (item.address as Record<string, string>).city || "" : ""))}`,
    });
  }

  parsed.sort((a, b) => a.distanceKm - b.distanceKm);
  const result = parsed.slice(0, limit);
  restaurantCache.set(cacheKey, result);
  return result;
}

/**
 * Fetches destination weather forecast using Open-Meteo (100% Free)
 */
export async function fetchPlaceWeather(
  lat: number,
  lon: number,
  cityName: string,
  targetDate?: string // YYYY-MM-DD
): Promise<TravelWeatherSummary | null> {
  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=10&timezone=auto`;
    const res = await fetch(weatherUrl);
    if (!res.ok) return null;

    const json = await res.json();
    const daily = json.daily;
    if (!daily || !daily.time) return null;

    let targetIdx = 0;
    if (targetDate) {
      const idx = (daily.time as string[]).indexOf(targetDate);
      if (idx !== -1) targetIdx = idx;
    }

    const weatherCode = daily.weather_code?.[targetIdx] ?? 0;
    const tempMax = Math.round(daily.temperature_2m_max?.[targetIdx] ?? 0);
    const tempMin = Math.round(daily.temperature_2m_min?.[targetIdx] ?? 0);
    const precipitationProb = daily.precipitation_probability_max?.[targetIdx] ?? 0;

    // Condition label from WMO code
    let condition = "Clear Sky";
    if (weatherCode === 1 || weatherCode === 2) condition = "Mostly Sunny";
    else if (weatherCode === 3) condition = "Overcast";
    else if (weatherCode >= 45 && weatherCode <= 48) condition = "Foggy";
    else if (weatherCode >= 51 && weatherCode <= 67) condition = "Rain Showers";
    else if (weatherCode >= 71 && weatherCode <= 77) condition = "Snow";
    else if (weatherCode >= 80 && weatherCode <= 82) condition = "Heavy Rain";
    else if (weatherCode >= 95) condition = "Thunderstorm";

    return {
      city: cityName,
      date: daily.time?.[targetIdx] || targetDate,
      tempMax,
      tempMin,
      currentTemp: json.current?.temperature_2m ? Math.round(json.current.temperature_2m) : undefined,
      condition,
      precipitationProb,
    };
  } catch (e) {
    console.warn("Weather fetch failed:", e);
    return null;
  }
}

