import React, { useEffect, useState } from "react";
import { Loader2, ThumbsUp, Sparkles, CheckCircle2 } from "lucide-react";

export type UploadModalState = {
  isOpen: boolean;
  status: "processing" | "success" | "error";
  title?: string;
  message?: string;
  stepDetail?: string;
  batchCurrent?: number;
  batchTotal?: number;
  successDetails?: {
    amount?: string;
    currency?: string;
    trip?: string;
    description?: string;
    category?: string;
    count?: number;
  };
};

interface ExpenseUploadModalProps {
  state: UploadModalState;
  onClose: () => void;
}

// Synthesize pleasant UPI-style two-tone success chime (e.g., G5 then C6)
function playUpiSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    
    // Tone 1: 784 Hz (G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: 1046.5 Hz (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch {
    // Audio policies might block on un-interacted windows, safe to ignore
  }
}

export function ExpenseUploadModal({ state, onClose }: ExpenseUploadModalProps) {
  const [playedSound, setPlayedSound] = useState(false);

  useEffect(() => {
    if (state.isOpen && state.status === "success" && !playedSound) {
      playUpiSuccessChime();
      setPlayedSound(true);

      const timer = setTimeout(() => {
        onClose();
      }, 2200);
      return () => clearTimeout(timer);
    }
    if (!state.isOpen) {
      setPlayedSound(false);
    }
  }, [state.isOpen, state.status, playedSound, onClose]);

  if (!state.isOpen) return null;

  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border/80 bg-card p-6 text-center shadow-2xl transition-all duration-300 sm:p-8">
        {/* Glow ambient background effect */}
        <div
          className={`pointer-events-none absolute -top-20 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full blur-3xl transition-colors duration-500 ${
            isSuccess ? "bg-emerald-500/25" : isError ? "bg-destructive/25" : "bg-accent/25"
          }`}
        />

        {isSuccess ? (
          /* ================= UPI SUCCESS SCREEN ================= */
          <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-300">
            {/* Concentric ripple rings */}
            <div className="relative mb-5 flex items-center justify-center">
              <span className="absolute inline-flex h-24 w-24 animate-ping rounded-full bg-emerald-400/30 opacity-75 duration-1000" />
              <span className="absolute inline-flex h-28 w-28 rounded-full bg-emerald-500/10" />
              
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/35 transition-transform">
                <ThumbsUp className="h-9 w-9 stroke-[2.2] transition-transform animate-in zoom-in-75 duration-300" />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-amber-300 animate-pulse" />
              </div>
            </div>

            <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {state.title || "Uploaded Successfully!"}
            </h3>

            {state.successDetails?.count && state.successDetails.count > 1 ? (
              <p className="mt-1 text-sm font-medium text-emerald-500 dark:text-emerald-400">
                {state.successDetails.count} receipts processed and recorded
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-emerald-500 dark:text-emerald-400">
                Expense recorded & synced
              </p>
            )}

            {/* Receipt Summary Card */}
            {state.successDetails && (
              <div className="mt-4 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-left text-xs">
                {state.successDetails.amount && (
                  <div className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-foreground text-sm">
                      {state.successDetails.currency === "INR" || !state.successDetails.currency ? "₹" : `${state.successDetails.currency} `}
                      {state.successDetails.amount}
                    </span>
                  </div>
                )}
                {state.successDetails.category && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium text-foreground">{state.successDetails.category}</span>
                  </div>
                )}
                {state.successDetails.trip && (
                  <div className="flex items-center justify-between pt-1.5">
                    <span className="text-muted-foreground">Trip</span>
                    <span className="font-medium text-foreground truncate max-w-[180px]">{state.successDetails.trip}</span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              Done
            </button>
          </div>
        ) : (
          /* ================= PLEASE WAIT / PROCESSING SCREEN ================= */
          <div className="relative z-10 flex flex-col items-center">
            {/* Animated spinning loader badge */}
            <div className="relative mb-5 flex items-center justify-center">
              <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-accent">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            </div>

            <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {state.title || "Please wait, uploading..."}
            </h3>

            {state.batchTotal && state.batchTotal > 1 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                Receipt {state.batchCurrent || 1} of {state.batchTotal}
              </div>
            )}

            <p className="mt-2 text-xs text-muted-foreground">
              {state.message || "Our AI is cropping the receipt and reading details..."}
            </p>

            {state.stepDetail && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse shrink-0" />
                <span className="truncate">{state.stepDetail}</span>
              </div>
            )}

            {/* Progress bar animation */}
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full bg-gradient-to-r from-accent via-emerald-400 to-accent animate-[pulse_1.5s_ease-in-out_infinite]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
