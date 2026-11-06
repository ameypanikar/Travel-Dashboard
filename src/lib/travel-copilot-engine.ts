// Travel & Meeting Copilot Engine
// Combines Gemini Generative AI with free open-source travel datasets and APIs
// Powered by OpenStreetMap Nominatim, Open-Meteo, and Curated Airport Database

import { fetchGeminiKey, fetchGeminiModel, type Flight, type Hotel, type TravelEvent } from "./dashboard-api";
import { findNearestAirports, type NearestAirportResult } from "./airport-data";
import {
  geocodeLocation,
  searchHotelsNear,
  searchRestaurantsNear,
  searchRailwayStationsNear,
  fetchPlaceWeather,
  type GeocodedPlace,
  type HotelSuggestion,
  type RestaurantSuggestion,
  type RailwayStationSuggestion,
  type TravelWeatherSummary,
} from "./travel-places-api";

export type CopilotCardPayload = {
  airports?: NearestAirportResult[];
  stations?: RailwayStationSuggestion[];
  hotels?: HotelSuggestion[];
  restaurants?: RestaurantSuggestion[];
  weather?: TravelWeatherSummary;
  place?: GeocodedPlace;
};

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  cards?: CopilotCardPayload;
  error?: boolean;
  isStreaming?: boolean;
};

export type DashboardContext = {
  flights: Flight[];
  hotels: Hotel[];
  events: TravelEvent[];
  username?: string;
};

const COMMON_CITIES: Record<string, string> = {
  "bangalore": "Bengaluru, India",
  "bengaluru": "Bengaluru, India",
  "mumbai": "Mumbai, India",
  "delhi": "New Delhi, India",
  "new delhi": "New Delhi, India",
  "gurgaon": "Gurugram, India",
  "gurugram": "Gurugram, India",
  "noida": "Noida, India",
  "hyderabad": "Hyderabad, India",
  "chennai": "Chennai, India",
  "pune": "Pune, India",
  "kolkata": "Kolkata, India",
  "ahmedabad": "Ahmedabad, India",
  "jaipur": "Jaipur, India",
  "lucknow": "Lucknow, India",
  "chandigarh": "Chandigarh, India",
  "kochi": "Kochi, India",
  "cochin": "Kochi, India",
  "goa": "Goa, India",
  "indore": "Indore, India",
  "bhopal": "Bhopal, India",
  "patna": "Patna, India",
  "nagpur": "Nagpur, India",
  "surat": "Surat, India",
  "vadodara": "Vadodara, India",
  "varanasi": "Varanasi, India",
  "dehradun": "Dehradun, India",
  "amritsar": "Amritsar, India",
  "srinagar": "Srinagar, India",
  "singapore": "Singapore",
  "dubai": "Dubai, UAE",
  "london": "London, UK",
  "paris": "Paris, France",
  "frankfurt": "Frankfurt, Germany",
  "new york": "New York, USA",
  "san francisco": "San Francisco, USA",
  "tokyo": "Tokyo, Japan",
  "bangkok": "Bangkok, Thailand",
};

const CORPORATE_ALIASES: Record<string, string> = {
  "bel": "Bharat Electronics Limited, Bengaluru",
  "bharat electronics": "Bharat Electronics Limited, Bengaluru",
  "hal": "Hindustan Aeronautics Limited, Bengaluru",
  "itpl": "International Tech Park Bangalore, Whitefield, Bengaluru",
  "manyata": "Manyata Tech Park, Bengaluru",
  "ecity": "Electronic City, Bengaluru",
  "electronic city": "Electronic City, Bengaluru",
  "whitefield": "Whitefield, Bengaluru",
  "bkc": "Bandra Kurla Complex, Mumbai",
  "nesco": "NESCO, Goregaon, Mumbai",
  "cyber city": "DLF Cyber City, Gurugram",
  "hinjewadi": "Hinjawadi Rajiv Gandhi Infotech Park, Pune",
  "magarpatta": "Magarpatta, Pune",
};

/**
 * Helper to safely parse dates in various formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
 */
function parseBookingDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD/MM/YYYY
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    } else if (parts[0].length === 4) {
      // YYYY/MM/DD
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Builds an authentic, date-anchored summary of the user's dashboard travel context
 * Strictly separates upcoming future trips from completed past history.
 */
function buildContextPrompt(context: DashboardContext): string {
  const now = new Date();
  const todayFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [];
  lines.push(`CURRENT REAL-WORLD DATE TODAY: ${todayFormatted}`);
  lines.push(`Active User: ${context.username || "Amey P"}`);

  // 1. Flights
  if (context.flights && context.flights.length > 0) {
    const upcomingFlights: Flight[] = [];
    const pastFlights: Flight[] = [];

    context.flights.forEach((f) => {
      const r = f as unknown as Record<string, string>;
      const dateStr = r.departureDate || r.departuredate || r.departureIso || "";
      const d = parseBookingDate(dateStr);
      // If date is before yesterday, it's a completed past flight
      if (d && d.getTime() < now.getTime() - 24 * 3600 * 1000) {
        pastFlights.push(f);
      } else {
        upcomingFlights.push(f);
      }
    });

    if (upcomingFlights.length > 0) {
      lines.push("\nUPCOMING Booked Flights (Scheduled in future dates):");
      upcomingFlights.slice(0, 6).forEach((f) => {
        const r = f as unknown as Record<string, string>;
        const from = r.fromCode || r.fromcode || r.fromCity || r.cityfrom || "";
        const to = r.toCode || r.tocode || r.toCity || r.cityto || "";
        const date = r.departureDate || r.departuredate || "";
        const time = r.departureTime || r.departuretime || "";
        const airline = r.airline || "";
        const flNumber = r.flightNumber || r.flightnumber || "";
        const pnr = r.confirmationCode || r.confirmationcode || "";
        lines.push(`- Upcoming Flight: ${airline} ${flNumber} (${from} → ${to}) on ${date} at ${time}${pnr ? `, PNR: ${pnr}` : ""}`);
      });
    } else {
      lines.push("\nUPCOMING Booked Flights: None currently booked for future dates.");
    }

    if (pastFlights.length > 0) {
      lines.push("\nPAST Flight History (COMPLETED trips in earlier months):");
      pastFlights.slice(0, 5).forEach((f) => {
        const r = f as unknown as Record<string, string>;
        const from = r.fromCode || r.fromcode || r.fromCity || "";
        const to = r.toCode || r.tocode || r.toCity || "";
        const date = r.departureDate || r.departuredate || "";
        const airline = r.airline || "";
        const flNumber = r.flightNumber || r.flightnumber || "";
        lines.push(`- Past Flight [COMPLETED]: ${airline} ${flNumber} (${from} → ${to}) on ${date}`);
      });
    }
  } else {
    lines.push("\nNo flights recorded in dashboard.");
  }

  // 2. Hotels
  if (context.hotels && context.hotels.length > 0) {
    const upcomingHotels: Hotel[] = [];
    const pastHotels: Hotel[] = [];

    context.hotels.forEach((h) => {
      const r = h as unknown as Record<string, string>;
      const dateStr = r.checkInDate || r.checkindate || r.checkInIso || "";
      const d = parseBookingDate(dateStr);
      if (d && d.getTime() < now.getTime() - 24 * 3600 * 1000) {
        pastHotels.push(h);
      } else {
        upcomingHotels.push(h);
      }
    });

    if (upcomingHotels.length > 0) {
      lines.push("\nUPCOMING Hotel Stays (Future confirmed reservations):");
      upcomingHotels.slice(0, 5).forEach((h) => {
        const r = h as unknown as Record<string, string>;
        const name = r.hotelName || r.hotelname || "Hotel";
        const city = r.city || "";
        const checkIn = r.checkInDate || r.checkindate || "";
        const checkOut = r.checkOutDate || r.checkoutdate || "";
        lines.push(`- Upcoming Stay: ${name} in ${city} (Check-in: ${checkIn}, Check-out: ${checkOut})`);
      });
    } else {
      lines.push("\nUPCOMING Hotel Stays: None currently booked for future dates.");
    }

    if (pastHotels.length > 0) {
      lines.push("\nPAST Hotel Stays (COMPLETED visits in earlier months):");
      pastHotels.slice(0, 5).forEach((h) => {
        const r = h as unknown as Record<string, string>;
        const name = r.hotelName || r.hotelname || "Hotel";
        const city = r.city || "";
        const checkIn = r.checkInDate || r.checkindate || "";
        const checkOut = r.checkOutDate || r.checkoutdate || "";
        lines.push(`- Past Stay [COMPLETED]: ${name} in ${city} (Stayed: ${checkIn} to ${checkOut})`);
      });
    }
  }

  // 3. Events & Client Visits
  if (context.events && context.events.length > 0) {
    lines.push("\nScheduled Client Visits & Travel Events on Dashboard:");
    context.events.slice(0, 5).forEach((ev) => {
      lines.push(`- Event: "${ev.eventname}" in ${ev.location || "TBD"} (Dates: ${ev.startdate} to ${ev.enddate || ev.startdate})`);
    });
  }

  return lines.join("\n");
}

/**
 * Extracts possible location or city entities from user text
 */
function extractPotentialLocation(text: string, lastKnownPlace?: GeocodedPlace | null): string {
  const clean = text.toLowerCase();

  // 1. Check corporate & tech campus aliases first (e.g. "BEL", "ITPL", "Electronic City")
  for (const [alias, fullTarget] of Object.entries(CORPORATE_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, "i").test(clean)) {
      return fullTarget;
    }
  }

  // 2. Check known city names (e.g. "banglore", "bengaluru", "mumbai")
  for (const [cityName, fullCity] of Object.entries(COMMON_CITIES)) {
    if (new RegExp(`\\b${cityName}\\b`, "i").test(clean)) {
      // Check if there is an area or client name before or after (e.g. "BEL bangalore" -> "BEL, Bengaluru")
      const belMatch = clean.match(/(?:visit|client|at|in|near)?\s*([a-z0-9\s]+?)\s+(?:in|at|near)?\s*(?:bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai)/i);
      if (belMatch && belMatch[1]) {
        const area = belMatch[1].replace(/^(i want to visit|visit|going to|meeting with|client)\s+/i, "").trim();
        if (area.length > 1 && area.length < 25 && !["the", "a", "an", "my", "this"].includes(area)) {
          return `${area}, ${fullCity}`;
        }
      }
      return fullCity;
    }
  }

  // 2. Generic patterns
  const match = text.match(/(?:visit|going to|travel to|meeting at|in|near)\s+([A-Za-z0-9\s,]{3,30}?)(?:\s+(?:next|around|on|for|what|where|how|this|tomorrow)|\?|\.|$)/i);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (!["this", "that", "the", "a", "an", "here", "there"].includes(candidate.toLowerCase())) {
      return candidate;
    }
  }

  if (lastKnownPlace) {
    return lastKnownPlace.name || lastKnownPlace.city;
  }

  return "";
}

/**
 * Main query processor: Orchestrates local free APIs with Gemini for intelligent answers
 */
export async function askTravelCopilot(
  userQuery: string,
  history: CopilotMessage[],
  context: DashboardContext,
  lastKnownPlace?: GeocodedPlace | null
): Promise<{ reply: string; cards: CopilotCardPayload; detectedPlace?: GeocodedPlace }> {
  // 1. Verify Gemini API Key
  let apiKey = localStorage.getItem("gemini_api_key") || "";
  if (!apiKey) {
    try {
      apiKey = await fetchGeminiKey();
    } catch {
      // ignore
    }
  }

  if (!apiKey) {
    return {
      reply: "⚠️ **Gemini API Key is not configured.**\n\nPlease open **Settings** (top right gear icon) → **AI Settings** and enter your free Gemini API key to activate the Travel Copilot.",
      cards: {},
    };
  }

  const model = await fetchGeminiModel();
  const lowerQuery = userQuery.toLowerCase();

  // 2. Pre-extract location if mentioned directly in user text
  let targetPlace: GeocodedPlace | null = lastKnownPlace || null;
  const potentialLoc = extractPotentialLocation(userQuery, lastKnownPlace);
  
  if (potentialLoc) {
    const geocoded = await geocodeLocation(potentialLoc);
    if (geocoded) {
      targetPlace = geocoded;
    }
  }

  // ONLY fall back to booked flight destination if user explicitly asks about their booked flight!
  const isExplicitBookingQuery = /my flight|booked flight|upcoming flight|booked trip|current trip|where am i flying|my ticket/i.test(userQuery);
  if (!targetPlace && isExplicitBookingQuery && context.flights && context.flights.length > 0) {
    const firstFlight = context.flights[0] as unknown as Record<string, string>;
    const dest = firstFlight.toCity || firstFlight.cityto || firstFlight.toCode || firstFlight.tocode;
    if (dest) {
      targetPlace = await geocodeLocation(dest);
    }
  }

  const preToolContext: string[] = [];
  if (targetPlace) {
    preToolContext.push(`Target Location: ${targetPlace.displayName} (Lat: ${targetPlace.lat.toFixed(4)}, Lon: ${targetPlace.lon.toFixed(4)})`);
    const airports = findNearestAirports(targetPlace.lat, targetPlace.lon, 3);
    if (airports.length > 0) {
      preToolContext.push(
        `Nearest Airports via Spatial Database:\n` +
        airports.map((a) => `• ${a.name} (${a.iata}): ${a.distanceKm} km away, ${a.driveTimeEstimate}`).join("\n")
      );
    }
  }

  // 3. Formulate System Prompt with strict formatting, date anchoring, and metadata tagging
  const now = new Date();
  const todayFormatted = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemPrompt = `You are the smart, proactive Travel & Itinerary Copilot integrated inside the user's business travel dashboard.
Your goal is to provide concise, friendly, executive-ready advice for business visits, flights, railway stations, accommodations, client meetings, and dining.

REAL-WORLD DATE ANCHOR:
• TODAY IS: ${todayFormatted} (Current year: ${now.getFullYear()}).
• When the user refers to dates (e.g. "next month", "15th of dec", "tomorrow"), calculate them strictly relative to TODAY (${todayFormatted}).
• CRITICAL: Do NOT refer to past months or earlier dates (e.g. July, September) as "upcoming" or suggest booking them! Those were past visits that already concluded.
• If mentioning past visits, treat them as past historical context: "Based on your previous visit in July to Holiday Inn Express Yeshwantpur...".

CURRENT DASHBOARD CONTEXT:
${buildContextPrompt(context)}

${preToolContext.length > 0 ? `PRE-RESOLVED REAL-WORLD DATA:\n${preToolContext.join("\n\n")}` : ""}

STRICT FORMATTING GUIDELINES:
1. Do NOT use markdown header hashes like '###' or '##' or wrap titles in asterisks like '### **Title**'.
   Instead, write section titles simply on their own line with an emoji:
   Example:
   ✈️ Airport Recommendation
   or
   🚆 Nearest Railway Stations
   or
   🏨 Recommended Accommodations
   or
   🍽️ Recommended Restaurants
   or
   📋 Dashboard Review & Notes
2. Use clean bullet points using '• ' and bold important labels:
   Example:
   • **Distance:** 3.8 km from client
   • **Travel Time:** ~12-15 mins drive
3. When discussing airports or railway stations, state distance from the client and realistic city traffic drive time.
4. Cross-reference the user's dashboard bookings naturally when relevant.
5. MANDATORY METADATA: At the very end of your response, on a new line, output an exact machine-readable metadata tag:
   <!--COPILOT_META:{"specificLocation":"<Exact Company/Campus/Neighborhood, e.g. Bharat Electronics Limited, Bengaluru>","city":"<City Name>","showAirports":true/false,"showTrainStations":true/false,"showHotels":true/false,"showRestaurants":true/false,"showWeather":true/false}-->
   IMPORTANT CARD RULES:
   - If user asked about train or railway stations: set showTrainStations: true, showAirports: false!
   - If user asked about hotels/places to stay: set showHotels: true, showAirports: false!
   - If user asked about food/restaurants: set showRestaurants: true, showAirports: false!
   - Only set showAirports: true if user asked about airports, flights, or flying!
   - Always provide the expanded company/campus name in specificLocation (e.g. if user says 'BEL', use 'Bharat Electronics Limited, Bengaluru') so distances are calculated from the exact client campus!`;

  // 4. Construct Multi-turn Chat for Gemini API
  const contents = [
    {
      role: "user",
      parts: [{ text: systemPrompt + "\n\nPlease acknowledge your role as the Travel Copilot." }],
    },
    {
      role: "model",
      parts: [{ text: "Understood! I am your Travel & Itinerary Copilot, ready to help plan your client meetings, flights, hotels, and dining with real-time dashboard context." }],
    },
  ];

  // Include recent conversation turns (up to 6)
  const recentTurns = history.slice(-6);
  for (const turn of recentTurns) {
    contents.push({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.content }],
    });
  }

  // Append latest user message
  contents.push({
    role: "user",
    parts: [{ text: userQuery }],
  });

  // 5. Call Gemini API with automatic fallback models and 503 resilience
  try {
    let rawReply = "";
    const candidateModels = Array.from(
      new Set([model, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"])
    ).filter(Boolean);

    for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
      const currentModel = candidateModels[mIdx];
      let attempt = 0;

      while (attempt < 3) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 1024,
              },
            }),
          }
        );

        if (response.status === 429) {
          attempt++;
          if (attempt >= 3) break; // try next candidate model
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }

        if (response.status === 503 || response.status === 500 || response.status === 502) {
          attempt++;
          if (attempt >= 2) break; // try next candidate model
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        if (response.status === 404) {
          break; // model not available on endpoint, try next candidate
        }

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        rawReply = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (rawReply) break;
      }

      if (rawReply) break;
    }

    if (!rawReply) {
      rawReply = "I was unable to generate a response from the AI service. Please try again.";
    }

    // 6. User Intent Analysis & Metadata Parsing
    const isTrainQuery = /\b(train|trains|station|stations|railway|railways|junction|junctions|metro|irctc)\b/i.test(lowerQuery);
    const isAirportQuery = /\b(airport|airports|flight|flights|fly|flying|airline|airlines|plane|airfield|iata)\b/i.test(lowerQuery);
    const isHotelQuery = /\b(hotel|hotels|stay|staying|live|living|accommodation|accommodations|resort|resorts|lodge|lodging|hostel|inn|rooms?|check-?in)\b/i.test(lowerQuery);
    const isFoodQuery = /\b(eat|eating|food|restaurant|restaurants|dining|cafe|cafes|lunch|dinner|breakfast|coffee|bakery|drinks|bar)\b/i.test(lowerQuery);
    const isWeatherQuery = /\b(weather|forecast|rain|temperature|temp|climate)\b/i.test(lowerQuery);

    let cleanReply = rawReply;
    let metaSpecificLocation = "";
    let metaCity = "";

    // Default card visibility strictly anchored to user's question
    let showAirports = isAirportQuery;
    let showTrainStations = isTrainQuery;
    let showHotels = isHotelQuery;
    let showRestaurants = isFoodQuery;
    let showWeather = isWeatherQuery;

    // For general trip planning inquiries where no specific mode is asked (e.g. "I want to visit BEL Bangalore next month 15th")
    const isGeneralTripQuery = !isTrainQuery && !isHotelQuery && !isFoodQuery && !isAirportQuery &&
      (lowerQuery.includes("visit") || lowerQuery.includes("going to") || lowerQuery.includes("meeting"));
    if (isGeneralTripQuery) {
      showAirports = true;
      showWeather = true;
    }

    const metaMatch = rawReply.match(/<!--COPILOT_META:(.*?)-->/s);
    if (metaMatch) {
      cleanReply = rawReply.replace(/<!--COPILOT_META:(.*?)-->/s, "").trim();
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta.specificLocation && typeof meta.specificLocation === "string" && meta.specificLocation.trim()) {
          metaSpecificLocation = meta.specificLocation.trim();
        } else if (meta.destination && typeof meta.destination === "string" && meta.destination.trim()) {
          metaSpecificLocation = meta.destination.trim();
        }
        if (meta.city && typeof meta.city === "string" && meta.city.trim()) {
          metaCity = meta.city.trim();
        }

        if (meta.showTrainStations) showTrainStations = true;
        if (meta.showHotels) showHotels = true;
        if (meta.showRestaurants && (isFoodQuery || isHotelQuery || isGeneralTripQuery)) showRestaurants = true;
        if (meta.showWeather) showWeather = true;
      } catch (e) {
        console.warn("Failed to parse COPILOT_META json:", e);
      }
    }

    // STRICT GATING RULES (Prevents irrelevant cards):
    // 1. If user asked about trains/railways, NEVER show airport cards unless they explicitly asked for flights
    if (isTrainQuery && !isAirportQuery) {
      showAirports = false;
      showTrainStations = true;
    }
    // 2. If user asked about hotels or restaurants, NEVER show airport cards unless they explicitly asked for flights
    if ((isHotelQuery || isFoodQuery) && !isAirportQuery) {
      showAirports = false;
    }

    // Prefer specific client location (e.g. "Bharat Electronics Limited, Bengaluru") for precise hotel/food proximity!
    if (metaSpecificLocation) {
      const geoSpecific = await geocodeLocation(metaSpecificLocation);
      if (geoSpecific) {
        targetPlace = geoSpecific;
      } else if (metaCity) {
        const geoCity = await geocodeLocation(metaCity);
        if (geoCity) targetPlace = geoCity;
      }
    } else if (metaCity && !targetPlace) {
      const geoCity = await geocodeLocation(metaCity);
      if (geoCity) targetPlace = geoCity;
    }

    // 7. Populate Cards based on the verified target place
    const cards: CopilotCardPayload = {};

    if (targetPlace) {
      cards.place = targetPlace;

      if (showAirports) {
        const nearestAirports = findNearestAirports(targetPlace.lat, targetPlace.lon, 3);
        if (nearestAirports.length > 0) {
          cards.airports = nearestAirports;
        }
      }

      if (showTrainStations) {
        const stations = await searchRailwayStationsNear(targetPlace.lat, targetPlace.lon, 35, 5);
        if (stations.length > 0) {
          cards.stations = stations;
        }
      }

      if (showHotels) {
        const hotels = await searchHotelsNear(targetPlace.lat, targetPlace.lon, 10, 4);
        if (hotels.length > 0) {
          cards.hotels = hotels;
        }
      }

      if (showRestaurants) {
        const restaurants = await searchRestaurantsNear(targetPlace.lat, targetPlace.lon, "all", 6, 5);
        if (restaurants.length > 0) {
          cards.restaurants = restaurants;
        }
      }

      if (showWeather) {
        const weather = await fetchPlaceWeather(targetPlace.lat, targetPlace.lon, targetPlace.city || targetPlace.name);
        if (weather) {
          cards.weather = weather;
        }
      }
    }

    return {
      reply: cleanReply,
      cards,
      detectedPlace: targetPlace || undefined,
    };
  } catch (err) {
    console.error("Travel Copilot API error:", err);
    return {
      reply: `Sorry, I encountered an issue contacting the AI service: ${(err as Error).message}.`,
      cards: {},
      detectedPlace: targetPlace || undefined,
    };
  }
}
