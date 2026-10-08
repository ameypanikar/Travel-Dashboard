# 04. Core Features & User Workflows

This guide covers the user-facing capabilities, transit intelligence modules, Gemini AI integrations, and mobile workflows implemented in the **Travel Tracker Dashboard**.

---

## 1. Multi-Modal Transit & Accommodation Cards

The platform organizes corporate travel across four distinct transit cards, each optimized for its specific transport mode:

### 1.1 Flight Bookings (`FlightsList.tsx`, `FlightCard.tsx`)
- **Route & Visual Branding**: Displays origin and destination airport IATA codes, cities, flight numbers, and airline branding.
- **Destination Weather Pill**: Automatically displays real-time weather and temperature for the arrival airport on the date of landing.
- **Airline Live Tracker Modal** ([FlightLiveTrackerModal.tsx](file:///home/embedded4/travel-tracker-dashboard/src/components/dashboard/FlightLiveTrackerModal.tsx)):
  - Generates direct tracking links to airline status portals for **IndiGo**, **Air India**, **Akasa Air**, **SpiceJet**, **Emirates**, **Qatar Airways**, **Singapore Airlines**, **British Airways**, and **Lufthansa**.
  - One-click copy for the 6-character PNR.
- **Document Attachment Drawer**: Instant viewing and downloading of DigiYatra QR passes, e-tickets, and boarding passes.

### 1.2 Hotel Bookings (`HotelsList.tsx`, `HotelCard.tsx`)
- **Check-In & Stay Details**: Prominently highlights check-in date, check-out date, number of nights, and total booked price.
- **Room Allocations**: Explicitly indicates which employees are assigned to which rooms (e.g. `Room 102: Somning G & Rajesh K`).
- **One-Click Navigation**: Deep links directly to Google Maps coordinates or verified street addresses.
- **Cancellation Cutoff**: Displays cancellation deadlines to prevent corporate financial penalties.

### 1.3 Train Bookings (`TrainsList.tsx`, `TrainCard.tsx`)
- **IRCTC Transit Details**: Displays 5-digit train numbers, official train names (e.g. *Deccan Queen*, *Vande Bharat*), and class (`1A`, `2A`, `3A`, `CC`, `EC`).
- **Live Train & PNR Status Modal** ([TrainLiveTrackerModal.tsx](file:///home/embedded4/travel-tracker-dashboard/src/components/dashboard/TrainLiveTrackerModal.tsx)):
  - Direct integration links to **RailYatri** and **ConfirmTkt** for live PNR confirmation probability and coach positions.
  - Direct link to the official Indian Railways National Train Enquiry System (NTES) for real-time GPS running delays.

### 1.4 Bus Bookings (`BusesList.tsx`, `BusCard.tsx`)
- **Intercity Transit**: Details operator names, bus numbers, boarding station addresses, drop-off points, departure timings, and ticket numbers.

---

## 2. Daily Itinerary & Monthly Travel Views

### 2.1 Daily Itinerary (`DailyItinerary.tsx`)
The Daily Itinerary compiles all transit modes, hotel check-ins, events, and reminders for any selected date into a unified chronological timeline:
- **Time-Ordered Cards**: Flights departing at 06:00, hotel check-ins at 14:00, client meetings at 16:00, and evening dinner expenses appear in exact chronological sequence.
- **Quick Date Navigation**: Provides "Previous Day", "Today", and "Next Day" controls, with an interactive calendar picker.
- **Assigned Passenger Badges**: Highlights traveler avatars and names associated with each event.

### 2.2 Monthly View (`MonthlyView.tsx`)
A high-level executive calendar view mapping out upcoming travel commitments across the entire month:
- Visual event bars indicate multi-day trade shows, exhibitions, and customer on-site visits.
- Helps HR and management prevent scheduling conflicts and track travel density across teams.

---

## 3. Real-Time Transit Intelligence

```
[ TopBar Intelligence Center ]
  ├── 1. Active Trip Indicator: Automatically detects whether a trip is "Currently Active" or "Up Next" (within 3 days).
  ├── 2. T-Minus Countdown: Live ticking countdown to the next flight departure (e.g. "T-minus 4h 22m").
  └── 3. Dual Timezone Clock: Real-time display of Home time vs Destination time with live ticking seconds.
```

### 3.1 Dual-Timezone Clock Widget ([TopBar.tsx](file:///home/embedded4/travel-tracker-dashboard/src/components/dashboard/TopBar.tsx))
- Determines the destination timezone by inspecting the next upcoming flight or corporate event.
- Queries the airport geocoding dictionary in `src/lib/weather-api.ts` to locate the destination timezone (e.g., `Asia/Dubai`, `Europe/Berlin`, `America/New_York`).
- Displays both **Home Time (IST)** and **Destination Local Time** side-by-side with live seconds, preventing missed calls or confusion across time zones.

### 3.2 Open-Meteo Weather Integration (`src/lib/weather-api.ts`)
- **Zero-Key, CORS-Enabled**: Connects to Open-Meteo without requiring paid API keys or exposing credentials.
- **Airport Code Dictionary**: Pre-indexed coordinates and timezones for major hubs across India, Middle East, Europe, East Asia, and North America.
- **WMO Code Decoding**: Converts standard World Meteorological Organization weather codes (0–99) into human-readable descriptions, weather icons (`sun`, `cloud-rain`, `snowflake`, `cloud-lightning`), and custom CSS background gradients.
- **Arrival Date Matching**: `getTripWeatherSegment()` matches the exact arrival date of a trip to provide a 5-day destination forecast covering the duration of the stay.

### 3.3 Universal Travel Omnisearch & Command Palette (`TravelSearchDialog.tsx`, `Ctrl+K`)
Traveling employees manage complex multi-leg itineraries with flight PNRs, hotel confirmations, IRCTC train numbers, and bus tickets scattered across different tabs. 

To provide instantaneous access without manual tab switching, the platform includes a global **Command Palette & Omnisearch Dialog**:
- **Triggers**: Accessible anywhere via keyboard shortcut `Ctrl+K` (or `Cmd+K` on macOS) or the search icon in the [TopBar.tsx](file:///home/embedded4/travel-tracker-dashboard/src/components/dashboard/TopBar.tsx).
- **Comprehensive Cross-Category Indexing** (`src/lib/travel-search.ts`):
  - **Flights**: Airport IATA codes (e.g. `PNQ`, `DEL`, `BLR`), cities, 6-character airline PNRs, and flight numbers.
  - **Hotels**: Hotel names, cities, check-in dates, and reservation confirmation codes.
  - **Trains**: 5-digit IRCTC train numbers, train names (*Vande Bharat*, *Deccan Queen*), and PNRs.
  - **Buses**: Bus operators, boarding points, drop-off locations, and ticket IDs.
  - **Events & Standing Tours**: Corporate exhibition names, locations, and trade shows.
  - **Expenses**: Vendors, payment methods, categories, and spend descriptions.
- **Instant Deep Navigation**: Selecting any search result instantly switches to the corresponding tab, sets the trip scope, and clears interfering date filters so the record is immediately in view.

---

## 4. Google Gemini AI Integrations

The dashboard embeds Google Gemini (`gemini-3.1-flash-lite`) for automated computer vision and natural language tasks:

### 4.1 Vision-Based Receipt Auto-Cropping (`src/lib/receipt-crop.ts`)
When employees photograph receipts on tables or restaurant counters, images often contain background clutter, fingers, or poor angles:
1. **MIME Type Resolution**: Automatically resolves image MIME types from file extensions (`.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.heif`) to support raw camera uploads and iPhone images lacking standard headers.
2. **Strict Schema Generation**: Calls Gemini Vision with `generationConfig: { response_mime_type: "application/json", temperature: 0.1 }` and structured prompts, ensuring pure JSON output without conversational markdown preamble.
3. **Dual Coordinate Scaling**: Detects coordinate formats across 0–1 fractions, 0–1000 normalized integer scales, and literal pixel bounds. Coordinates on Gemini's standard 0–1000 scale are correctly mapped to image dimensions, preventing tall/narrow receipts from being prematurely truncated at the header.
4. **HTML5 Canvas Cropping**: Crops the image precisely to the detected receipt box, producing an audit-ready, high-resolution JPEG.

```
[ Unprocessed Photo ]                    [ Gemini Vision AI ]               [ Cropped Audit Receipt ]
┌─────────────────────────┐               ┌──────────────────┐               ┌─────────────────┐
│ [Coffee Cup]   [Table]  │               │ Analyzes image   │               │ HOTEL RESTAURANT│
│    ┌──────────────┐     │  ──────────>  │ Detects receipt  │  ──────────>  │ Date: 12/03/26  │
│    │ BILL RECEIPT │     │               │ Bounding Box     │               │ Total: ₹ 1,420  │
│    │ Total: ₹1420 │     │               │ [0–1000 scale]   │               └─────────────────┘
│    └──────────────┘     │               └──────────────────┘
└─────────────────────────┘
```

### 4.2 AI Receipt Expense Parsing (`AddExpenseForm.tsx`)
In addition to cropping, Gemini analyzes the receipt text to automatically pre-fill:
- Expense Amount (e.g. `1420.00`)
- Currency (e.g. `INR`, `EUR`, `USD`)
- Transaction Date (`DD/MM/YYYY`)
- Appropriate Category (`Food`, `Transport`, `Hotel`, `Misc. Expenses`)
- Merchant & Description (e.g. `Dinner at Mainland China`)

### 4.3 Multimodal Voice & Note Parsing (`AddNoteReminderModal.tsx`)
Travelers can dictate spoken voice notes or type rough thoughts into the Quick Note modal:
- Gemini parses natural phrases like *"Remind me to submit board presentation by tomorrow 4pm"* into a structured reminder with:
  - `type: "reminder"`
  - `duedate: "2026-09-09"`
  - `duetime: "16:00"`
  - `category: "Work"`
- The parsed text is then automatically encrypted with AES-256-GCM before writing to Supabase.

### 4.4 UPI-Style Animated Upload & Success Experience (`ExpenseUploadModal.tsx`)
Logging expenses on mobile now provides instant, satisfying feedback inspired by leading Indian UPI applications (Google Pay, PhonePe):
1. **Live Processing Overlay**:
   - Translucent backdrop blur with an animated spinning gradient indicator.
   - Real-time step progress broadcasts: *"Locating receipt edges with AI…"*, *"Cropping receipt image…"*, *"Extracting details with Gemini AI…"*, and *"Uploading receipt to cloud storage…"*.
   - Dynamic batch counters (e.g. *"Receipt 2 of 3"*).
2. **Celebratory UPI Success Screen**:
   - Vibrant emerald-green badge with concentric expanding ripple pulses (`animate-ping`).
   - Animated spring-bounce **Thumbs-Up** icon and celebration sparkles.
   - Expense summary card detailing the formatted amount, currency, category, and trip.
   - **Synthesized Web Audio Chime**: Generates a pleasant two-tone UPI success chime (`G5` 784 Hz to `C6` 1046.5 Hz) natively in the browser with zero external audio assets.
   - Auto-dismisses after 2 seconds with an immediate "Done" escape hatch.
3. **Immediate Form & Batch Reset**:
   - Batch receipts and the *"Add N expenses"* button are cleared immediately upon success, preventing confusing duplicate submissions.

### 4.5 Form Draft Auto-Saving & Accidental Navigation Protection (`src/lib/expense-draft.ts`)
Field travelers entering expense amounts often switch tabs to copy a phone number or accidentally trigger a swipe or pinch-zoom gesture:
- **Continuous Local Draft Storage**: Keyed by employee username, preserving entered amount, currency, trip, category, description, and attached receipt.
- **Accidental Navigation Guardrails**: Forms are annotated with `data-no-swipe="true"` to prevent horizontal touch gestures and pinch-zoom from triggering tab navigation.
- **Overflow-Protected File Badges**: Long unbroken filenames are cleanly truncated (`min-w-0 flex-1 truncate`) with docked `shrink-0` remove buttons, preventing layout overflows into adjacent columns.

---

## 5. Offline & In-Flight Mode (`src/lib/offline-storage.ts`)

Business travelers frequently enter flight transit or underground railway stations where cellular connectivity drops:
1. **Background Document Pre-Caching**:
   - Whenever the dashboard loads online, it iterates through all linked document URLs (PDF boarding passes, DigiYatra QR images) and writes them into the browser's native `CacheStorage` (`travel-dashboard-docs-v1`).
2. **Instant Offline Blob Delivery**:
   - If `navigator.onLine === false`, the document viewer retrieves the file directly from `CacheStorage` via `getCachedDocumentBlobUrl()`, rendering tickets instantly without network requests.
3. **LocalStorage Dashboard Snapshot**:
   - Upon every successful fetch of `fetchDashboard()`, a complete JSON snapshot is serialized to `localStorage`.
   - If an API request fails due to lack of connectivity, the app falls back to this snapshot, ensuring travelers can view their flight times, seat numbers, and hotel addresses mid-flight.

---

## 6. Uber Quick-Ride Integration (`UberTab.tsx`)

A dedicated transit shortcut modal pre-configured with the traveler's upcoming destinations:
- Extracts hotel addresses and airport coordinates from active bookings.
- Generates deep-linked Uber URLs:
  `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=...`
- Allows travelers landing at unfamiliar airports to summon an Uber to their exact hotel with a single tap, eliminating manual address typing.

---

## 7. Multilingual Support (`src/lib/i18n.ts`)

The entire interface is localized using `i18next` across three languages:
- **English** (Default)
- **Hindi (हिन्दी)**
- **Marathi (मराठी)**

Translations cover all transit labels, expense categories, settings controls, and error alerts, enabling non-English speaking field staff and drivers to operate the platform with confidence.
