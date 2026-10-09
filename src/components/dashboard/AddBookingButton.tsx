import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  X,
  Upload,
  Loader2,
  Car,
  MapPin,
  Navigation,
  Coins,
  Clock,
  Plane,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchGeminiKey,
  fetchGeminiModel,
  uploadDocument,
  fetchFxRate,
  addBooking,
} from "@/lib/dashboard-api";
import type { TravelEvent } from "@/lib/dashboard-api";
import { getSessionToken } from "@/lib/auth";
import { ConfirmDialog } from "./ConfirmDialog";
import { triggerConfetti } from "@/lib/confetti";
import { formatInr, GENERAL_TRAVEL, isActiveTrip, sortTripOptions } from "@/lib/expense-utils";

import { Kind, BookableKind, PROMPTS, KEYS, CLIENT_COMPUTED_KEYS } from "@/lib/booking-prompts";
import { normalizeAssignedTo, computeLayover } from "@/lib/booking-utils";

// User type — matches what index.tsx already has from data.users
type UserEntry = { name: string; username: string; role: string };

const PAYMENT_METHOD_OPTIONS = ["", "Cash", "Card", "GPay"];

function normalizeToIso(dateStr?: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy.length === 4) return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}

function toIsoDate(ddmmyyyy?: string): string {
  return normalizeToIso(ddmmyyyy);
}

const TRIP_GRACE_DAYS = 1;

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function suggestTrip(dateDdMmYyyy: string, events: TravelEvent[]): string {
  const iso = toIsoDate(dateDdMmYyyy);
  if (!iso) return GENERAL_TRAVEL;
  const match = events.find((ev) => {
    if (!isActiveTrip(ev)) return false;
    const start = toIsoDate(ev.startdate);
    if (!start) return false;
    const end = toIsoDate(ev.enddate) || start;
    const graceStart = shiftIsoDate(start, -TRIP_GRACE_DAYS);
    const graceEnd = shiftIsoDate(end, TRIP_GRACE_DAYS);
    return iso >= graceStart && iso <= graceEnd;
  });
  return (match?.eventname || "").trim() || GENERAL_TRAVEL;
}

function parseAmount(raw?: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AddBookingButton({
  users = [],
  events = [],
  uberSuggestions = [],
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  users?: UserEntry[];
  events?: TravelEvent[];
  uberSuggestions?: { label: string; address: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [kind, setKind] = useState<Kind>("flight");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Multi-leg records (supports 1, 2, 3, 4+ flight segments)
  const [records, setRecords] = useState<Record<string, string>[] | null>(null);
  const [activeLeg, setActiveLeg] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uberDestination, setUberDestination] = useState("");
  const [uberConfirmOpen, setUberConfirmOpen] = useState(false);

  // Multi-leg smart fare allocation state
  const [totalExtractedFare, setTotalExtractedFare] = useState<number>(0);
  const [extractedCurrency, setExtractedCurrency] = useState<string>("INR");
  const [extractedFxRate, setExtractedFxRate] = useState<number | null>(null);
  const [fareAllocationMode, setFareAllocationMode] = useState<
    "first_leg" | "split_evenly" | "custom"
  >("first_leg");

  // Document attach state
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string>("");

  const getApiKey = () => localStorage.getItem("gemini_api_key") || "";

  useEffect(() => {
    if (open) {
      if (!getApiKey()) {
        fetchGeminiKey().catch(() => {});
      }
      fetchGeminiModel().catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    const handleOpenBooking = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.file && detail.kind) {
        setKind(detail.kind);
        setOpen(true);
        handleFile(detail.file, detail.kind);
      }
    };
    window.addEventListener("open-add-booking", handleOpenBooking);
    return () => window.removeEventListener("open-add-booking", handleOpenBooking);
  }, []);

  const reset = useCallback(() => {
    setRecords(null);
    setActiveLeg(0);
    setError("");
    setStatus("");
    setLoading(false);
    setDocumentFile(null);
    setDocUploadError("");
    setTotalExtractedFare(0);
    setExtractedCurrency("INR");
    setExtractedFxRate(null);
    setFareAllocationMode("first_leg");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const extractWithGemini = async (
    base64: string,
    k: BookableKind,
    mimeType: string,
  ): Promise<unknown> => {
    const key = getApiKey();
    if (!key)
      throw new Error("Gemini API key not set. Use the ⚙️ Settings icon in the top bar to add it.");
    const model = await fetchGeminiModel();
    const prompt = PROMPTS[k];

    let attempt = 0;
    while (attempt < 3) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }],
              },
            ],
          }),
        },
      );

      if (res.status === 429) {
        attempt++;
        if (attempt >= 3) throw new Error("Rate limited after 3 attempts. Please try again later.");
        for (let s = 15; s > 0; s--) {
          setStatus(`Rate limited - retrying in ${s}s...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setStatus("Reading file... please wait");
        continue;
      }

      if (!res.ok) {
        const t = await res.text();
        if (res.status === 401) {
          throw new Error("SYSTEM UPDATE REQUIRED: Your Gemini API token is outdated or invalid. Please check your settings.");
        }
        throw new Error(`Gemini error ${res.status}: ${t}`);
      }

      const json = await res.json();
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        throw new Error(`Failed to parse response: ${cleaned.slice(0, 200)}`);
      }
    }
    throw new Error("Failed after retries");
  };

  const handleFile = async (file: File, overrideKind?: Kind) => {
    const activeKind = overrideKind || kind;
    reset();
    let key = getApiKey();
    if (!key) {
      try {
        key = await fetchGeminiKey();
      } catch {
        // ignore
      }
    }
    if (!key) {
      setError(
        "Could not load the shared Gemini API key. Please ask your System Manager to set it in Settings.",
      );
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    let mimeType = "application/pdf";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";

    setLoading(true);
    setStatus("Reading ticket details & extracting flight segments... please wait");
    try {
      const base64 = await fileToBase64(file);
      const raw = await extractWithGemini(base64, activeKind as BookableKind, mimeType);
      const keys = KEYS[activeKind as BookableKind];

      const rawRecords: Record<string, unknown>[] = Array.isArray(raw)
        ? (raw as Record<string, unknown>[])
        : [raw as Record<string, unknown>];

      if (rawRecords.length === 0) {
        throw new Error("No booking details could be parsed from the document.");
      }

      // Discover total fare and currency from extracted records
      let parsedGrandTotal = 0;
      let parsedCurrency = "INR";
      let parsedBookingDate = "";

      for (const r of rawRecords) {
        const amt = parseAmount(String(r.amount || r.booked_price || r.total_fare || ""));
        if (!Number.isNaN(amt) && amt > 0 && parsedGrandTotal === 0) {
          parsedGrandTotal = amt;
        }
        if (r.currency && String(r.currency).trim()) {
          parsedCurrency = String(r.currency).trim().toUpperCase();
        }
        if (r.booking_date && String(r.booking_date).trim()) {
          parsedBookingDate = String(r.booking_date).trim();
        }
      }

      setTotalExtractedFare(parsedGrandTotal);
      setExtractedCurrency(parsedCurrency);

      // Resolve FX rate if non-INR
      let fxRateNum: number | null = null;
      if (parsedGrandTotal > 0 && parsedCurrency && parsedCurrency !== "INR") {
        const firstDepDate = String(
          rawRecords[0]?.departure_date || rawRecords[0]?.checkin_date || "",
        );
        const fxDateDdMmYyyy = parsedBookingDate || firstDepDate;
        const fxIso = toIsoDate(fxDateDdMmYyyy);
        if (fxIso) {
          setStatus("Resolving exchange rate...");
          const fx = await fetchFxRate(fxIso, parsedCurrency);
          setStatus("Normalizing flight legs...");
          if (fx) {
            fxRateNum = fx.rate;
            setExtractedFxRate(fx.rate);
          }
        }
      }

      // Normalize all legs (multi-leg without hard limit)
      const normalizedRecords: Record<string, string>[] = [];
      const numLegs = rawRecords.length;

      for (let idx = 0; idx < numLegs; idx++) {
        const data = rawRecords[idx];
        const normalized: Record<string, string> = {};
        for (const k of keys) {
          if (CLIENT_COMPUTED_KEYS.has(k)) continue;
          normalized[k] = String(data[k] ?? "");
        }

        if (normalized.assigned_to && users.length > 0) {
          normalized.assigned_to = normalizeAssignedTo(normalized.assigned_to, users);
        }

        const relevantDate = normalized.departure_date || normalized.checkin_date || "";
        normalized.trip = suggestTrip(relevantDate, events);
        normalized.payment_method = "";
        normalized.currency = parsedCurrency;

        // Smart fare allocation:
        // By default, assign full ticket price to Leg 1 (index 0) and leave subsequent connecting legs blank
        // to prevent doubling/quadrupling the cost in spend views!
        if (activeKind === "flight" && numLegs > 1) {
          if (idx === 0) {
            normalized.amount = parsedGrandTotal > 0 ? String(parsedGrandTotal) : "";
            normalized.fx_rate = fxRateNum ? fxRateNum.toFixed(4) : "";
            normalized.inr_equivalent =
              fxRateNum && parsedGrandTotal > 0
                ? (parsedGrandTotal * fxRateNum).toFixed(2)
                : parsedGrandTotal > 0 && parsedCurrency === "INR"
                  ? String(parsedGrandTotal)
                  : "";
          } else {
            normalized.amount = "";
            normalized.fx_rate = "";
            normalized.inr_equivalent = "";
          }
        } else {
          // Single leg or hotel/train/bus
          const amtKey = activeKind === "hotel" ? "booked_price" : "amount";
          normalized[amtKey] =
            parsedGrandTotal > 0 ? String(parsedGrandTotal) : String(normalized[amtKey] || "");
          normalized.fx_rate = fxRateNum ? fxRateNum.toFixed(4) : "";
          const amtNum = parseAmount(normalized[amtKey]);
          if (!Number.isNaN(amtNum)) {
            normalized.inr_equivalent = fxRateNum
              ? (amtNum * fxRateNum).toFixed(2)
              : parsedCurrency === "INR"
                ? String(amtNum)
                : "";
          } else {
            normalized.inr_equivalent = "";
          }
        }

        normalizedRecords.push(normalized);
      }

      setRecords(normalizedRecords);
      setActiveLeg(0);
      setFareAllocationMode("first_leg");
      setStatus("");
    } catch (e) {
      setError((e as Error).message);
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleBookUber = () => {
    const dropoff = uberDestination.trim();
    const params = new URLSearchParams({ action: "setPickup", pickup: "my_location" });
    if (dropoff) {
      params.set("dropoff[formatted_address]", dropoff);
      params.set("dropoff[nickname]", dropoff);
    }
    const deepLink = `uber://?${params.toString()}`;
    const webLink = dropoff ? `https://m.uber.com/ul/?${params.toString()}` : `https://m.uber.com/`;

    const start = Date.now();
    const fallback = window.setTimeout(() => {
      if (Date.now() - start < 2000) window.location.href = webLink;
    }, 1200);
    const onHide = () => {
      window.clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onHide);
    };
    document.addEventListener("visibilitychange", onHide);
    window.location.href = deepLink;
    setUberConfirmOpen(false);
    setOpen(false);
  };

  const currentRecord = records ? records[activeLeg] : null;

  const updateActiveRecord = (key: string, value: string) => {
    if (!records) return;
    const next = records.slice();
    next[activeLeg] = { ...next[activeLeg], [key]: value };
    if (key === "amount") {
      setFareAllocationMode("custom");
    }
    setRecords(next);
  };

  /**
   * Applies selected fare allocation strategy across all legs
   */
  const handleFareAllocationChange = (mode: "first_leg" | "split_evenly") => {
    if (!records || records.length === 0 || totalExtractedFare <= 0) return;
    setFareAllocationMode(mode);
    const updated = records.map((rec, idx) => {
      const next = { ...rec };
      if (mode === "first_leg") {
        if (idx === 0) {
          next.amount = String(totalExtractedFare);
          next.inr_equivalent = extractedFxRate
            ? (totalExtractedFare * extractedFxRate).toFixed(2)
            : extractedCurrency === "INR"
              ? String(totalExtractedFare)
              : "";
          next.fx_rate = extractedFxRate ? extractedFxRate.toFixed(4) : "";
        } else {
          next.amount = "";
          next.inr_equivalent = "";
          next.fx_rate = "";
        }
      } else if (mode === "split_evenly") {
        const splitAmount = Math.round((totalExtractedFare / records.length) * 100) / 100;
        next.amount = String(splitAmount);
        next.inr_equivalent = extractedFxRate
          ? (splitAmount * extractedFxRate).toFixed(2)
          : extractedCurrency === "INR"
            ? String(splitAmount)
            : "";
        next.fx_rate = extractedFxRate ? extractedFxRate.toFixed(4) : "";
      }
      return next;
    });
    setRecords(updated);
  };

  const onSave = async () => {
    if (!records || records.length === 0) return;

    const hasStandingTour = records.some((r) => {
      const matchingEvent = events.find((e) => e.eventname === r.trip);
      return matchingEvent?.type === "Standing Tour";
    });

    if (hasStandingTour) {
      if (
        !window.confirm(
          "You are logging this against a long-running Standing Tour instead of a specific trip. Are you sure you want to proceed?",
        )
      ) {
        return;
      }
    }

    setSaving(true);
    try {
      // Save all flight legs / segments
      for (const legFields of records) {
        await addBooking(kind, legFields);
      }

      // Attach document to unique confirmation codes
      const uniqueCodes = Array.from(
        new Set(records.map((r) => r.confirmation_code).filter(Boolean)),
      );
      if (documentFile && uniqueCodes.length > 0) {
        setUploadingDoc(true);
        setDocUploadError("");
        try {
          for (const code of uniqueCodes) {
            await uploadDocument({
              type: kind === "flight" ? "flight" : "hotel",
              category: kind === "flight" ? "ticket" : "confirmation",
              confirmationCode: code,
              file: documentFile,
            });
          }
        } catch (docErr) {
          setDocUploadError(
            `Booking saved, but document upload failed: ${(docErr as Error).message}`,
          );
          setUploadingDoc(false);
          setSaving(false);
          return;
        }
        setUploadingDoc(false);
      }

      const count = records.length;
      if (count > 2) {
        toast.success(`✅ All ${count} flight legs added to sheet!`);
      } else if (count === 2) {
        toast.success("✅ Both flight legs added to sheet!");
      } else {
        toast.success("✅ Booking added to sheet!");
      }

      navigator.vibrate?.([40, 30, 60]);
      setTimeout(() => triggerConfetti(), 150);
      reset();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const keys = kind === "uber" ? [] : KEYS[kind as BookableKind];
  const canAttachDocument = kind === "flight" || kind === "hotel";
  const tripOptions = sortTripOptions(
    Array.from(
      new Set([
        "General Travel",
        ...events
          .filter((e) => isActiveTrip(e))
          .map((e) => (e.eventname || "").trim())
          .filter(Boolean),
        ...(currentRecord?.trip ? [currentRecord.trip] : []),
      ]),
    ),
    events,
  );

  // Layover info with next leg if available
  const nextLeg = records && activeLeg < records.length - 1 ? records[activeLeg + 1] : undefined;
  const currentLayover = records && nextLeg ? computeLayover(records[activeLeg], nextLeg) : null;

  return (
    <>
      {!hideTrigger && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-accent-foreground shadow-lg transition hover:scale-105"
          aria-label="Add booking"
        >
          <Plus className="h-4 w-4" /> Add Booking
        </button>
      )}

      <Dialog
        open={open}
        onOpenChange={(isOpen: boolean) => {
          setOpen(isOpen);
          if (!isOpen) reset();
        }}
      >
        <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[90dvh]">
          <div className="flex shrink-0 items-center justify-between border-b p-4">
            <div className="text-base font-bold flex items-center gap-2">
              <span>Add Booking</span>
              {records && records.length > 1 && (
                <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">
                  {records.length} Flight Segments
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4 p-4 overflow-y-auto">
            {/* Booking type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["flight", "hotel", "train"] as Kind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setKind(k);
                    reset();
                  }}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    kind === k
                      ? "bg-accent text-accent-foreground"
                      : "bg-card hover:bg-accent-soft",
                  )}
                >
                  {k === "flight" ? "✈️ Flight" : k === "hotel" ? "🏨 Hotel" : "🚂 Train"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setKind("bus");
                  reset();
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition",
                  kind === "bus"
                    ? "bg-accent text-accent-foreground"
                    : "bg-card hover:bg-accent-soft",
                )}
              >
                🚌 Bus
              </button>
              <button
                onClick={() => {
                  setKind("uber");
                  reset();
                }}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition",
                  kind === "uber"
                    ? "bg-accent text-accent-foreground"
                    : "bg-card hover:bg-accent-soft",
                )}
              >
                🚗 Uber
              </button>
            </div>

            {/* Drop zone — hidden for Uber */}
            {kind !== "uber" && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition",
                  dragOver ? "border-accent bg-accent-soft" : "border-border hover:bg-muted/40",
                )}
              >
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="font-semibold text-foreground">
                  Drop your booking PDF or image here or click to browse
                </div>
                <div className="text-xs text-muted-foreground">
                  Supports multi-leg flights, layovers & round trips
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            )}

            {kind === "uber" && (
              <div className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-accent">
                  <Car className="h-4 w-4" /> Book a ride
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Opens the Uber app (or uber.com) with pickup set to your current location.
                </p>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Where to? (optional)
                </label>
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <input
                    value={uberDestination}
                    onChange={(e) => setUberDestination(e.target.value)}
                    placeholder="Hotel name, airport, or address"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                {uberSuggestions.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {uberSuggestions.map((s) => (
                      <button
                        key={s.address}
                        onClick={() => setUberDestination(s.address)}
                        className="rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/10"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setUberConfirmOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-card transition hover:opacity-90"
                >
                  <Navigation className="h-4 w-4" /> Go to Uber
                </button>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 p-4 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span>{status || "Reading file... please wait"}</span>
              </div>
            )}

            {error && (
              error.includes("SYSTEM UPDATE REQUIRED") ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 py-3 overflow-hidden flex whitespace-nowrap relative w-full">
                  <style>{`
                    @keyframes marquee-rtl {
                      0% { transform: translateX(100%); }
                      100% { transform: translateX(-100%); }
                    }
                    .animate-marquee-local {
                      animation: marquee-rtl 15s linear infinite;
                      will-change: transform;
                    }
                  `}</style>
                  <div className="animate-marquee-local text-xs font-semibold text-destructive tracking-wide w-full flex-shrink-0 flex gap-8">
                    <span>🚀 {error}</span>
                    <span>🚀 {error}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                  {error}
                </div>
              )
            )}

            {/* Smart Multi-Leg Fare Allocation Banner */}
            {records && records.length > 1 && kind === "flight" && totalExtractedFare > 0 && (
              <div className="rounded-2xl border border-accent/20 bg-accent-soft/30 p-3.5 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-accent">
                    <Coins className="h-4 w-4" />
                    <span>
                      Total Ticket Fare: {extractedCurrency}{" "}
                      {totalExtractedFare.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Prevents duplicate spend across {records.length} legs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleFareAllocationChange("first_leg")}
                    className={cn(
                      "flex flex-col items-start rounded-xl p-2.5 border transition text-left",
                      fareAllocationMode === "first_leg"
                        ? "border-accent bg-accent text-accent-foreground font-semibold shadow-sm"
                        : "border-border bg-card hover:bg-muted/60 text-foreground",
                    )}
                  >
                    <span className="font-bold text-xs">Attach all to Leg 1 (Recommended)</span>
                    <span className="text-[10px] opacity-80 mt-0.5">
                      Leg 1: {extractedCurrency} {totalExtractedFare.toLocaleString("en-IN")} ·
                      Connecting legs: {extractedCurrency} 0
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFareAllocationChange("split_evenly")}
                    className={cn(
                      "flex flex-col items-start rounded-xl p-2.5 border transition text-left",
                      fareAllocationMode === "split_evenly"
                        ? "border-accent bg-accent text-accent-foreground font-semibold shadow-sm"
                        : "border-border bg-card hover:bg-muted/60 text-foreground",
                    )}
                  >
                    <span className="font-bold text-xs">Split evenly across legs</span>
                    <span className="text-[10px] opacity-80 mt-0.5">
                      {extractedCurrency}{" "}
                      {Math.round(totalExtractedFare / records.length).toLocaleString("en-IN")} per
                      leg
                    </span>
                  </button>
                </div>
              </div>
            )}

            {currentRecord && (
              <div className="rounded-2xl border overflow-hidden shadow-sm">
                {/* Dynamic Multi-Leg Tab Header */}
                <div className="border-b bg-muted/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Preview & Edit Segments
                    </div>
                  </div>

                  {records && records.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {records.map((r, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveLeg(i)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs",
                            activeLeg === i
                              ? "bg-accent text-accent-foreground shadow-sm"
                              : "bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <Plane className="h-3 w-3" />
                          <span>
                            Leg {i + 1}: {r.from_code || "?"} → {r.to_code || "?"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Layover banner between connecting legs */}
                  {currentLayover && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Layover at {currentLayover.layoverAirport}: {currentLayover.layoverDuration}{" "}
                        before Leg {activeLeg + 2}
                      </span>
                    </div>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {keys.map((k) => (
                        <tr
                          key={k}
                          className={cn(
                            "border-b last:border-0",
                            k === "assigned_to" && "bg-accent-soft/40",
                            k === "amount" && "bg-emerald-500/[0.04]",
                          )}
                        >
                          <td className="w-1/3 px-3 py-2 text-xs font-semibold text-muted-foreground">
                            {k === "assigned_to"
                              ? "👤 assigned_to"
                              : k === "amount"
                                ? "💰 amount (fare)"
                                : k}
                          </td>
                          <td className="px-3 py-1.5">
                            {k === "trip" ? (
                              <select
                                value={currentRecord[k] ?? GENERAL_TRAVEL}
                                onChange={(e) => updateActiveRecord(k, e.target.value)}
                                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                              >
                                {tripOptions.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            ) : k === "payment_method" ? (
                              <select
                                value={currentRecord[k] ?? ""}
                                onChange={(e) => updateActiveRecord(k, e.target.value)}
                                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                              >
                                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                                  <option key={opt || "none"} value={opt}>
                                    {opt || "Not set — edit later"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={currentRecord[k] ?? ""}
                                onChange={(e) => updateActiveRecord(k, e.target.value)}
                                placeholder={
                                  k === "amount" && activeLeg > 0 ? "0 (Included in Leg 1)" : ""
                                }
                                className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Document attach section */}
            {currentRecord && canAttachDocument && (
              <div className="rounded-2xl border p-3.5 bg-muted/20">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {kind === "flight"
                    ? "E-Ticket Document (Attaches to all legs)"
                    : "Booking confirmation PDF (optional)"}
                </div>

                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs"
                />

                {documentFile && (
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground bg-background rounded-xl p-2 border">
                    <span>📎 {documentFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setDocumentFile(null)}
                      className="text-destructive hover:underline text-xs font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {docUploadError && (
                  <div className="mt-2 text-xs text-destructive">{docUploadError}</div>
                )}
              </div>
            )}
          </div>

          {currentRecord && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t bg-background p-4 pb-8 sm:pb-4">
              <button
                type="button"
                onClick={reset}
                disabled={saving || uploadingDoc}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || uploadingDoc}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-foreground shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-50"
              >
                {saving || uploadingDoc ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Saving{" "}
                      {records && records.length > 1 ? `${records.length} legs...` : "booking..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      Save{" "}
                      {records && records.length > 1
                        ? `All ${records.length} Flight Legs`
                        : "Booking"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={uberConfirmOpen}
        title="Open Uber"
        message={
          uberDestination
            ? `Open Uber with dropoff set to "${uberDestination}"?`
            : "Open Uber to book a ride from your current location?"
        }
        confirmLabel="Open Uber"
        onConfirm={handleBookUber}
        onCancel={() => setUberConfirmOpen(false)}
      />
    </>
  );
}
