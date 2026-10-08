// Open-Meteo Weather API & Airport/City Geocoding Service
// Free, zero-API-key, CORS-enabled, reliable weather forecast

export type WeatherCondition = {
  label: string;
  icon: "sun" | "cloud-sun" | "cloud" | "cloud-rain" | "cloud-lightning" | "snowflake" | "cloud-fog" | "wind";
  gradient: string;
  badgeBg: string;
};

export type CurrentWeatherData = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  condition: WeatherCondition;
  precipitation: number;
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  localTime: string;
  city: string;
};

export type DailyForecast = {
  date: string;
  dayName: string;
  weatherCode: number;
  condition: WeatherCondition;
  tempMax: number;
  tempMin: number;
  precipitationProb: number;
  sunrise: string;
  sunset: string;
};

export type FullWeatherReport = {
  city: string;
  current: CurrentWeatherData;
  daily: DailyForecast[];
  lat: number;
  lon: number;
};

// Common Airport Code to Lat/Lon & City Name Dictionary
export const AIRPORT_COORDINATES: Record<string, { city: string; lat: number; lon: number; timezone: string }> = {
  // India
  DEL: { city: "New Delhi", lat: 28.5562, lon: 77.1000, timezone: "Asia/Kolkata" },
  BOM: { city: "Mumbai", lat: 19.0896, lon: 72.8656, timezone: "Asia/Kolkata" },
  BLR: { city: "Bengaluru", lat: 13.1986, lon: 77.7066, timezone: "Asia/Kolkata" },
  MAA: { city: "Chennai", lat: 12.9941, lon: 80.1709, timezone: "Asia/Kolkata" },
  HYD: { city: "Hyderabad", lat: 17.2403, lon: 78.4294, timezone: "Asia/Kolkata" },
  CCU: { city: "Kolkata", lat: 22.6547, lon: 88.4467, timezone: "Asia/Kolkata" },
  GOI: { city: "Goa (Dabolim)", lat: 15.3808, lon: 73.8314, timezone: "Asia/Kolkata" },
  GOX: { city: "Goa (Mopa)", lat: 15.7667, lon: 73.8667, timezone: "Asia/Kolkata" },
  PNQ: { city: "Pune", lat: 18.5822, lon: 73.9197, timezone: "Asia/Kolkata" },
  AMD: { city: "Ahmedabad", lat: 23.0772, lon: 72.6347, timezone: "Asia/Kolkata" },
  JAI: { city: "Jaipur", lat: 26.8242, lon: 75.8122, timezone: "Asia/Kolkata" },
  COK: { city: "Kochi", lat: 10.1520, lon: 76.3922, timezone: "Asia/Kolkata" },
  TRV: { city: "Thiruvananthapuram", lat: 8.4821, lon: 76.9200, timezone: "Asia/Kolkata" },
  IXC: { city: "Chandigarh", lat: 30.6735, lon: 76.7885, timezone: "Asia/Kolkata" },
  LKO: { city: "Lucknow", lat: 26.7606, lon: 80.8893, timezone: "Asia/Kolkata" },
  GAU: { city: "Guwahati", lat: 26.1061, lon: 91.5859, timezone: "Asia/Kolkata" },
  PAT: { city: "Patna", lat: 25.5913, lon: 85.0880, timezone: "Asia/Kolkata" },
  BBI: { city: "Bhubaneswar", lat: 20.2444, lon: 85.8178, timezone: "Asia/Kolkata" },
  VNS: { city: "Varanasi", lat: 25.4524, lon: 82.8593, timezone: "Asia/Kolkata" },
  SXR: { city: "Srinagar", lat: 33.9871, lon: 74.7742, timezone: "Asia/Kolkata" },
  IXB: { city: "Bagdogra", lat: 26.6812, lon: 88.3286, timezone: "Asia/Kolkata" },
  IXZ: { city: "Port Blair", lat: 11.6410, lon: 92.7297, timezone: "Asia/Kolkata" },

  // Middle East
  DXB: { city: "Dubai", lat: 25.2532, lon: 55.3657, timezone: "Asia/Dubai" },
  DWC: { city: "Dubai (Al Maktoum)", lat: 24.8960, lon: 55.1614, timezone: "Asia/Dubai" },
  AUH: { city: "Abu Dhabi", lat: 24.4330, lon: 54.6511, timezone: "Asia/Dubai" },
  DOH: { city: "Doha", lat: 25.2731, lon: 51.6081, timezone: "Asia/Qatar" },
  RUH: { city: "Riyadh", lat: 24.9576, lon: 46.6988, timezone: "Asia/Riyadh" },
  JED: { city: "Jeddah", lat: 21.6796, lon: 39.1565, timezone: "Asia/Riyadh" },
  BAH: { city: "Bahrain", lat: 26.2708, lon: 50.6336, timezone: "Asia/Bahrain" },
  MCT: { city: "Muscat", lat: 23.5933, lon: 58.2844, timezone: "Asia/Muscat" },
  KWI: { city: "Kuwait City", lat: 29.2266, lon: 47.9789, timezone: "Asia/Kuwait" },

  // Southeast & East Asia
  SIN: { city: "Singapore", lat: 1.3644, lon: 103.9915, timezone: "Asia/Singapore" },
  BKK: { city: "Bangkok", lat: 13.6900, lon: 100.7501, timezone: "Asia/Bangkok" },
  DMK: { city: "Bangkok (Don Mueang)", lat: 13.9126, lon: 100.6067, timezone: "Asia/Bangkok" },
  HKG: { city: "Hong Kong", lat: 22.3080, lon: 113.9185, timezone: "Asia/Hong_Kong" },
  TPE: { city: "Taipei", lat: 25.0797, lon: 121.2342, timezone: "Asia/Taipei" },
  TSA: { city: "Taipei (Songshan)", lat: 25.0697, lon: 121.5525, timezone: "Asia/Taipei" },
  KUL: { city: "Kuala Lumpur", lat: 2.7456, lon: 101.7072, timezone: "Asia/Kuala_Lumpur" },
  DPS: { city: "Bali", lat: -8.7482, lon: 115.1672, timezone: "Asia/Makassar" },
  HND: { city: "Tokyo (Haneda)", lat: 35.5494, lon: 139.7798, timezone: "Asia/Tokyo" },
  NRT: { city: "Tokyo (Narita)", lat: 35.7720, lon: 140.3929, timezone: "Asia/Tokyo" },
  ICN: { city: "Seoul (Incheon)", lat: 37.4602, lon: 126.4407, timezone: "Asia/Seoul" },
  PVG: { city: "Shanghai (Pudong)", lat: 31.1443, lon: 121.8083, timezone: "Asia/Shanghai" },
  PEK: { city: "Beijing", lat: 40.0799, lon: 116.6031, timezone: "Asia/Shanghai" },
  CAN: { city: "Guangzhou", lat: 23.3959, lon: 113.3080, timezone: "Asia/Shanghai" },
  SZX: { city: "Shenzhen", lat: 22.6393, lon: 113.8107, timezone: "Asia/Shanghai" },

  // Europe & UK
  LHR: { city: "London (Heathrow)", lat: 51.4700, lon: -0.4543, timezone: "Europe/London" },
  LGW: { city: "London (Gatwick)", lat: 51.1537, lon: -0.1821, timezone: "Europe/London" },
  CDG: { city: "Paris (Charles de Gaulle)", lat: 49.0097, lon: 2.5479, timezone: "Europe/Paris" },
  FRA: { city: "Frankfurt", lat: 50.0379, lon: 8.5622, timezone: "Europe/Berlin" },
  MUC: { city: "Munich", lat: 48.3537, lon: 11.7750, timezone: "Europe/Berlin" },
  HAM: { city: "Hamburg", lat: 53.6304, lon: 9.9882, timezone: "Europe/Berlin" },
  BER: { city: "Berlin", lat: 52.3667, lon: 13.5033, timezone: "Europe/Berlin" },
  DUS: { city: "Düsseldorf", lat: 51.2895, lon: 6.7668, timezone: "Europe/Berlin" },
  AMS: { city: "Amsterdam", lat: 52.3105, lon: 4.7683, timezone: "Europe/Amsterdam" },
  ZRH: { city: "Zurich", lat: 47.4582, lon: 8.5555, timezone: "Europe/Zurich" },
  VIE: { city: "Vienna", lat: 48.1103, lon: 16.5697, timezone: "Europe/Vienna" },
  FCO: { city: "Rome", lat: 41.8003, lon: 12.2389, timezone: "Europe/Rome" },
  BCN: { city: "Barcelona", lat: 41.2974, lon: 2.0833, timezone: "Europe/Madrid" },
  MAD: { city: "Madrid", lat: 40.4839, lon: -3.5680, timezone: "Europe/Madrid" },
  IST: { city: "Istanbul", lat: 41.2753, lon: 28.7519, timezone: "Europe/Istanbul" },

  // North America
  JFK: { city: "New York (JFK)", lat: 40.6413, lon: -73.7781, timezone: "America/New_York" },
  EWR: { city: "New York (Newark)", lat: 40.6895, lon: -74.1745, timezone: "America/New_York" },
  SFO: { city: "San Francisco", lat: 37.6213, lon: -122.3790, timezone: "America/Los_Angeles" },
  LAX: { city: "Los Angeles", lat: 33.9416, lon: -118.4085, timezone: "America/Los_Angeles" },
  ORD: { city: "Chicago", lat: 41.9742, lon: -87.9073, timezone: "America/Chicago" },
  DFW: { city: "Dallas", lat: 32.8998, lon: -97.0403, timezone: "America/Chicago" },
  MIA: { city: "Miami", lat: 25.7959, lon: -80.2870, timezone: "America/New_York" },
  SEA: { city: "Seattle", lat: 47.4502, lon: -122.3088, timezone: "America/Los_Angeles" },
  YYZ: { city: "Toronto", lat: 43.6777, lon: -79.6248, timezone: "America/Toronto" },
  YVR: { city: "Vancouver", lat: 49.1967, lon: -123.1815, timezone: "America/Vancouver" },

  // Oceania & Others
  SYD: { city: "Sydney", lat: -33.9399, lon: 151.1753, timezone: "Australia/Sydney" },
  MEL: { city: "Melbourne", lat: -37.6690, lon: 144.8410, timezone: "Australia/Melbourne" },
  AKL: { city: "Auckland", lat: -37.0082, lon: 174.7850, timezone: "Pacific/Auckland" },
};

// Maps WMO Weather codes to descriptions, icons, and theme gradients
export function decodeWmoWeatherCode(code: number): WeatherCondition {
  switch (code) {
    case 0:
      return {
        label: "Clear Sky",
        icon: "sun",
        gradient: "from-amber-500/20 to-orange-500/10",
        badgeBg: "bg-amber-500/15 text-amber-500 border-amber-500/30",
      };
    case 1:
    case 2:
      return {
        label: "Mostly Sunny",
        icon: "cloud-sun",
        gradient: "from-sky-500/20 to-amber-500/10",
        badgeBg: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      };
    case 3:
      return {
        label: "Overcast",
        icon: "cloud",
        gradient: "from-slate-500/20 to-zinc-500/10",
        badgeBg: "bg-slate-500/15 text-slate-400 border-slate-500/30",
      };
    case 45:
    case 48:
      return {
        label: "Foggy",
        icon: "cloud-fog",
        gradient: "from-slate-600/20 to-gray-500/10",
        badgeBg: "bg-slate-500/15 text-slate-300 border-slate-500/30",
      };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return {
        label: "Drizzle",
        icon: "cloud-rain",
        gradient: "from-cyan-600/20 to-blue-500/10",
        badgeBg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
      };
    case 61:
    case 63:
    case 65:
      return {
        label: "Rain",
        icon: "cloud-rain",
        gradient: "from-blue-600/20 to-indigo-500/10",
        badgeBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
      };
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return {
        label: "Snow",
        icon: "snowflake",
        gradient: "from-blue-200/20 to-indigo-100/10",
        badgeBg: "bg-indigo-300/15 text-indigo-200 border-indigo-300/30",
      };
    case 80:
    case 81:
    case 82:
      return {
        label: "Heavy Showers",
        icon: "cloud-rain",
        gradient: "from-blue-700/20 to-cyan-600/10",
        badgeBg: "bg-blue-600/15 text-blue-300 border-blue-500/30",
      };
    case 95:
    case 96:
    case 99:
      return {
        label: "Thunderstorm",
        icon: "cloud-lightning",
        gradient: "from-purple-600/20 to-pink-500/10",
        badgeBg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
      };
    default:
      return {
        label: "Partly Cloudy",
        icon: "cloud-sun",
        gradient: "from-sky-500/20 to-indigo-500/10",
        badgeBg: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      };
  }
}

// In-memory cache for weather results to prevent duplicate fetches
const weatherCache = new Map<string, { data: FullWeatherReport; timestamp: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Resolves location string (e.g. "DEL", "Dubai", "Bengaluru", "London Heathrow") to Lat/Lon & Timezone
 */
export async function resolveLocationCoords(query: string): Promise<{ city: string; lat: number; lon: number; timezone?: string } | null> {
  if (!query || !query.trim()) return null;
  const clean = query.trim().toUpperCase();

  // 1. Direct Airport Code lookup
  if (AIRPORT_COORDINATES[clean]) {
    return {
      city: AIRPORT_COORDINATES[clean].city,
      lat: AIRPORT_COORDINATES[clean].lat,
      lon: AIRPORT_COORDINATES[clean].lon,
      timezone: AIRPORT_COORDINATES[clean].timezone,
    };
  }

  // 2. Search by key in airport dictionary
  for (const [code, info] of Object.entries(AIRPORT_COORDINATES)) {
    if (query.toLowerCase().includes(info.city.toLowerCase()) || query.toLowerCase().includes(code.toLowerCase())) {
      return {
        city: info.city,
        lat: info.lat,
        lon: info.lon,
        timezone: info.timezone,
      };
    }
  }

  // 3. Fallback to Open-Meteo Geocoding API
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
    const res = await fetch(geoUrl);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.results?.[0];
    if (result) {
      return {
        city: result.name || query,
        lat: result.latitude,
        lon: result.longitude,
        timezone: result.timezone,
      };
    }
  } catch (e) {
    console.warn("Geocoding lookup failed for:", query, e);
  }

  return null;
}

/**
 * Fetches current weather + 5-day daily forecast for a given airport code or city name.
 */
export async function fetchWeather(locationQuery: string): Promise<FullWeatherReport | null> {
  if (!locationQuery || !locationQuery.trim()) return null;
  const cacheKey = locationQuery.trim().toLowerCase();

  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const coords = await resolveLocationCoords(locationQuery);
  if (!coords) return null;

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&forecast_days=16&timezone=auto`;
    const res = await fetch(weatherUrl);
    if (!res.ok) return null;
    const data = await res.json();

    const current = data.current || {};
    const daily = data.daily || {};
    const timezone = data.timezone || coords.timezone || "UTC";
    const utcOffsetSeconds = data.utc_offset_seconds || 0;

    const weatherCode = current.weather_code ?? 0;
    const condition = decodeWmoWeatherCode(weatherCode);

    const now = new Date();
    // Compute local time in target timezone
    let localTimeStr = "";
    try {
      localTimeStr = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(now);
    } catch {
      localTimeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    }

    const currentData: CurrentWeatherData = {
      temperature: Math.round(current.temperature_2m ?? 0),
      feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      windSpeed: Math.round(current.wind_speed_10m ?? 0),
      precipitation: current.precipitation ?? 0,
      weatherCode,
      condition,
      timezone,
      timezoneAbbreviation: data.timezone_abbreviation || timezone.split("/").pop() || "",
      utcOffsetSeconds,
      localTime: localTimeStr,
      city: coords.city,
    };

    const days: DailyForecast[] = (daily.time || []).map((dateStr: string, idx: number) => {
      const d = new Date(dateStr);
      const dayName = idx === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" });
      const wCode = daily.weather_code?.[idx] ?? 0;
      return {
        date: dateStr,
        dayName,
        weatherCode: wCode,
        condition: decodeWmoWeatherCode(wCode),
        tempMax: Math.round(daily.temperature_2m_max?.[idx] ?? 0),
        tempMin: Math.round(daily.temperature_2m_min?.[idx] ?? 0),
        precipitationProb: Math.round(daily.precipitation_probability_max?.[idx] ?? 0),
        sunrise: (daily.sunrise?.[idx] || "").split("T")[1]?.slice(0, 5) || "",
        sunset: (daily.sunset?.[idx] || "").split("T")[1]?.slice(0, 5) || "",
      };
    });

    const report: FullWeatherReport = {
      city: coords.city,
      current: currentData,
      daily: days,
      lat: coords.lat,
      lon: coords.lon,
    };

    weatherCache.set(cacheKey, { data: report, timestamp: Date.now() });
    return report;
  } catch (err) {
    console.error("Failed to fetch weather from Open-Meteo:", err);
    return null;
  }
}

/**
 * Normalizes DD/MM/YYYY or YYYY-MM-DD into YYYY-MM-DD
 */
export function normalizeDateToYmd(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return "";
  const s = dateStr.trim();
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) {
      return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  return s.slice(0, 10);
}

export type TripWeatherSegment = {
  displayTemp: number;
  displayCondition: WeatherCondition;
  displayTempMax: number;
  displayTempMin: number;
  displayDateLabel: string;
  isExactTripDate: boolean;
  forecastDays: DailyForecast[];
};

/**
 * Extracts weather tailored for the day of arrival / check-in and the 5 days ahead!
 */
export function getTripWeatherSegment(
  report: FullWeatherReport,
  targetDate?: string,
): TripWeatherSegment {
  const targetYmd = normalizeDateToYmd(targetDate);
  const daily = report.daily || [];

  if (targetYmd) {
    const idx = daily.findIndex((d) => d.date === targetYmd);
    if (idx !== -1) {
      const match = daily[idx];
      const sliceEnd = Math.min(daily.length, idx + 5);
      const segmentDays = daily.slice(idx, sliceEnd);

      // If we are close to the end of the 16 days, ensure we show up to 5 days
      const days = segmentDays.length < 5 && idx > 0
        ? daily.slice(Math.max(0, idx - (5 - segmentDays.length)), sliceEnd)
        : segmentDays;

      const dateObj = new Date(match.date);
      const formatted = dateObj.toLocaleDateString("en-US", { day: "numeric", month: "short" });

      return {
        displayTemp: match.tempMax,
        displayCondition: match.condition,
        displayTempMax: match.tempMax,
        displayTempMin: match.tempMin,
        displayDateLabel: formatted,
        isExactTripDate: true,
        forecastDays: days,
      };
    }
  }

  // Fallback: Show current live weather + next 5 days
  const current = report.current;
  const today = daily[0];
  return {
    displayTemp: current.temperature,
    displayCondition: current.condition,
    displayTempMax: today?.tempMax ?? current.temperature,
    displayTempMin: today?.tempMin ?? current.temperature,
    displayDateLabel: "Today",
    isExactTripDate: false,
    forecastDays: daily.slice(0, 5),
  };
}

/**
 * Formats time difference offset between user's browser timezone and destination timezone
 */
export function formatTimeDifference(destUtcOffsetSeconds: number): {
  diffHours: number;
  label: string;
  isSameTime: boolean;
} {
  const localOffsetMinutes = -new Date().getTimezoneOffset(); // in minutes
  const destOffsetMinutes = destUtcOffsetSeconds / 60;
  const diffMinutes = destOffsetMinutes - localOffsetMinutes;
  const diffHours = diffMinutes / 60;

  if (Math.abs(diffMinutes) < 5) {
    return { diffHours: 0, label: "Same time as home", isSameTime: true };
  }

  const sign = diffHours > 0 ? "+" : "";
  const formattedHours = Math.abs(diffHours % 1) > 0.01 
    ? `${sign}${diffHours.toFixed(1)} hrs` 
    : `${sign}${diffHours} hrs`;

  const relation = diffHours > 0 ? "ahead of home" : "behind home";
  return {
    diffHours,
    label: `${formattedHours} ${relation}`,
    isSameTime: false,
  };
}
