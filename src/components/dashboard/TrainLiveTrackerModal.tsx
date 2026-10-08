import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TrainFront, ExternalLink, Radio, Copy, Check, ShieldCheck, MapPin } from "lucide-react";
import { useState } from "react";

export function TrainLiveTrackerModal({
  train,
  isOpen,
  onClose,
}: {
  train: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [copiedPnr, setCopiedPnr] = useState(false);

  if (!train) return null;

  const trainNumber = (train.trainnumber || train.trainNumber || "").trim();
  const trainName = (train.trainname || train.trainName || "Train").trim();
  const fromCode = (train.fromcode || train.fromCode || "FROM").trim();
  const toCode = (train.tocode || train.toCode || "TO").trim();
  const fromCity = train.cityfrom || train.cityFrom || "";
  const toCity = train.cityto || train.cityTo || "";
  const pnr = (train.pnr || "").trim();
  const depTime = train.departuretime || train.departureTime || "";
  const arrTime = train.arrivaltime || train.arrivalTime || "";

  const railYatriPnrUrl = pnr
    ? `https://www.railyatri.in/pnr-status/${encodeURIComponent(pnr)}`
    : `https://www.railyatri.in/pnr-status`;
  const confirmTktPnrUrl = pnr
    ? `https://www.confirmtkt.com/pnr-status/${encodeURIComponent(pnr)}`
    : `https://www.confirmtkt.com/pnr-status`;
  const liveRunningUrl = trainNumber
    ? `https://www.railyatri.in/live-train-status/${encodeURIComponent(trainNumber)}`
    : `https://enquiry.indianrail.gov.in/mntes/`;

  const copyPnr = () => {
    if (!pnr) return;
    navigator.clipboard.writeText(pnr);
    setCopiedPnr(true);
    setTimeout(() => setCopiedPnr(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md overflow-hidden rounded-3xl border-0 p-0 shadow-2xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white">
        {/* Header Hero */}
        <div className="relative p-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
              <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span>LIVE TRAIN & PNR STATUS</span>
            </div>
          </div>

          {/* Route Overview */}
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/10 backdrop-blur-md">
            <div>
              <div className="text-2xl font-black tracking-tight text-white">{fromCode}</div>
              <div className="text-xs text-white/70">{fromCity || "Origin"}</div>
              <div className="mt-1 text-xs font-semibold text-emerald-300">{depTime}</div>
            </div>

            <div className="flex flex-col items-center px-4">
              <TrainFront className="h-5 w-5 text-emerald-400" />
              <div className="mt-1 text-[10px] uppercase font-bold text-white/60">
                {trainNumber ? `#${trainNumber}` : trainName}
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black tracking-tight text-white">{toCode}</div>
              <div className="text-xs text-white/70">{toCity || "Destination"}</div>
              <div className="mt-1 text-xs font-semibold text-emerald-300">{arrTime}</div>
            </div>
          </div>

          {/* PNR quick copy */}
          {pnr && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 border border-white/10 text-xs">
              <span className="text-white/60">IRCTC 10-Digit PNR:</span>
              <button
                onClick={copyPnr}
                className="flex items-center gap-1 font-mono font-bold text-amber-300 hover:text-amber-200"
              >
                <span>{pnr}</span>
                {copiedPnr ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          )}
        </div>

        {/* Action Providers */}
        <div className="bg-white/5 p-6 pt-3 border-t border-white/10 backdrop-blur-md space-y-2.5">
          <div className="text-xs font-bold text-emerald-200 uppercase tracking-wider mb-2">
            1-Click Inquiry Engines
          </div>

          {/* 1. Live Running Status */}
          {trainNumber && (
            <a
              href={liveRunningUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/30 text-emerald-300 font-bold text-xs">
                  🚂
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Live Running Status (#{trainNumber})</span>
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[11px] text-white/60">Exact live location, delay & platform numbers</div>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-emerald-300 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}

          {/* 2. ConfirmTkt PNR Confirmation */}
          {pnr && (
            <a
              href={confirmTktPnrUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/30 text-teal-300 font-bold text-xs">
                  🎫
                </div>
                <div>
                  <div className="text-xs font-bold text-white">ConfirmTkt PNR Status</div>
                  <div className="text-[11px] text-white/60">Live coach, seat numbers & waitlist chart status</div>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-teal-300 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}

          {/* 3. RailYatri Backup */}
          {pnr && (
            <a
              href={railYatriPnrUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 p-3.5 transition-all hover:scale-[1.02] active:scale-[0.99] group"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/80 font-bold text-xs">
                  🔍
                </div>
                <div>
                  <div className="text-xs font-bold text-white">RailYatri PNR Forecast</div>
                  <div className="text-[11px] text-white/60">Alternative PNR status & chart preparation check</div>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
