import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plane, ExternalLink, Radio, Copy, Check, Info, ShieldCheck, MapPin } from "lucide-react";
import { useState } from "react";
import type { Flight } from "@/lib/dashboard-api";

export function getAirlineLiveTrackerUrl(airlineName: string, flightNumber: string, dateDdMmYyyy?: string): string {
  const norm = (airlineName || "").toLowerCase();
  const cleanNum = (flightNumber || "").replace(/[^a-zA-Z0-9]/g, "");

  if (norm.includes("indigo") || norm.includes("6e")) {
    return `https://www.goindigo.in/flight-status.html`;
  }
  if (norm.includes("air india") || norm.includes("ai")) {
    return `https://www.airindia.com/in/en/manage/flight-status.html`;
  }
  if (norm.includes("akasa") || norm.includes("qp")) {
    return `https://www.akasaair.com/flight-status`;
  }
  if (norm.includes("spicejet") || norm.includes("sg")) {
    return `https://www.spicejet.com/flightstatus`;
  }
  if (norm.includes("emirates") || norm.includes("ek")) {
    return `https://www.emirates.com/in/english/manage-booking/flight-status/`;
  }
  if (norm.includes("qatar") || norm.includes("qr")) {
    return `https://www.qatarairways.com/en/flight-status.html`;
  }
  if (norm.includes("singapore") || norm.includes("sq")) {
    return `https://www.singaporeair.com/en_UK/sg/plan-travel/flight-status/`;
  }
  if (norm.includes("british") || norm.includes("ba")) {
    return `https://www.britishairways.com/travel/flightstatus/`;
  }
  if (norm.includes("lufthansa") || norm.includes("lh")) {
    return `https://www.lufthansa.com/in/en/flight-status`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${airlineName} ${flightNumber} flight status`)}`;
}

export function FlightLiveTrackerModal({
  flight,
  isOpen,
  onClose,
}: {
  flight: Flight | Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const f = flight as Record<string, string>;
  const [copiedCode, setCopiedCode] = useState(false);

  if (!flight) return null;

  const airline = f.airline || "Flight";
  const fromCode = f.fromcode || f.fromCode || "DEP";
  const toCode = f.tocode || f.toCode || "ARR";
  const fromCity = f.cityfrom || f.cityFrom || "";
  const toCity = f.cityto || f.cityTo || "";
  const depTime = f.departuretime || f.departureTime || "";
  const arrTime = f.arrivaltime || f.arrivalTime || "";
  const depDate = f.departuredate || f.departureDate || "";
  const pnr = f.confirmationcode || f.confirmationCode || "";

  // Extract alphanumeric flight code (e.g., "6E 204", "AI 101", "EK 512")
  const flightCodeMatch = (airline + " " + (f.flightnumber || "")).match(/([A-Z0-9]{2,3}\s?[0-9]{1,4})/i);
  const flightSearchCode = flightCodeMatch ? flightCodeMatch[0] : `${airline} ${fromCode}-${toCode}`;

  const airlineUrl = getAirlineLiveTrackerUrl(airline, flightSearchCode, depDate);
  const flightRadarUrl = `https://www.flightradar24.com/data/flights/${encodeURIComponent(flightSearchCode.replace(/\s+/g, ""))}`;
  const flightAwareUrl = `https://flightaware.com/live/flight/${encodeURIComponent(flightSearchCode.replace(/\s+/g, ""))}`;
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${airline} ${flightSearchCode} flight status ${depDate}`)}`;

  const copyPnr = () => {
    if (!pnr) return;
    navigator.clipboard.writeText(pnr);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0 shadow-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
        {/* Header Hero */}
        <div className="relative p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 border border-blue-400/30">
              <Radio className="h-3 w-3 text-blue-400 animate-pulse" />
              <span>LIVE FLIGHT RADAR & STATUS</span>
            </div>
          </div>

          {/* Route Overview */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/10 backdrop-blur-md">
            <div>
              <div className="text-2xl font-black tracking-tight text-white">{fromCode}</div>
              <div className="text-xs text-white/70">{fromCity || "Departure"}</div>
              <div className="mt-1 text-xs font-semibold text-blue-300">{depTime}</div>
            </div>

            <div className="flex flex-col items-center px-4">
              <Plane className="h-5 w-5 text-blue-400 rotate-90" />
              <div className="mt-1 text-[10px] uppercase font-bold text-white/50">{airline}</div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black tracking-tight text-white">{toCode}</div>
              <div className="text-xs text-white/70">{toCity || "Arrival"}</div>
              <div className="mt-1 text-xs font-semibold text-blue-300">{arrTime}</div>
            </div>
          </div>

          {/* PNR quick copy */}
          {pnr && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/10 text-xs">
              <span className="text-white/60">Confirmation / PNR:</span>
              <button
                onClick={copyPnr}
                className="flex items-center gap-1 font-mono font-bold text-amber-300 hover:text-amber-200"
              >
                <span>{pnr}</span>
                {copiedCode ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Action Providers */}
        <div className="bg-white/5 p-6 pt-3 border-t border-white/10 backdrop-blur-md space-y-2.5">
          <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-2">
            Real-Time Tracking Providers
          </div>

          {/* 1. Official Airline Tracker */}
          <a
            href={airlineUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl bg-blue-600/30 hover:bg-blue-600/40 border border-blue-500/40 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/30 text-blue-300 font-bold text-xs">
                ✈
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Official {airline} Tracker</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="text-[11px] text-white/60">Live gate, baggage carousel & departure status</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-blue-300 transition-transform group-hover:translate-x-0.5" />
          </a>

          {/* 2. FlightRadar24 Live Radar */}
          <a
            href={flightRadarUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/30 text-amber-300 font-bold text-xs">
                🛰
              </div>
              <div>
                <div className="text-xs font-bold text-white">FlightRadar24 Live Map</div>
                <div className="text-[11px] text-white/60">Real-time aircraft radar position & altitude</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-amber-300 transition-transform group-hover:translate-x-0.5" />
          </a>

          {/* 3. FlightAware / Google Live Status */}
          <a
            href={googleSearchUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80 font-bold text-xs">
                🔍
              </div>
              <div>
                <div className="text-xs font-bold text-white">Google Live Status Engine</div>
                <div className="text-[11px] text-white/60">Fast delay estimates & airport terminal updates</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
