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
  PenLine,
  Trash2,
  PlusCircle,
  ArrowLeft,
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
import { getSessionToken, getSessionUser, type SessionUser } from "@/lib/auth";
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
  const parts = (trimmed.includes('-') ? trimmed.split('-').reverse() : trimmed.split('/'));
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

function getFieldLabel(key: string, kind: Kind): { label: string; placeholder: string; icon?: string } {
  switch (key) {
    case "airline":
      return { label: "Airline Name", placeholder: "e.g. IndiGo, Air India, Emirates", icon: "✈️" };
    case "flight_number":
      return { label: "Flight Number", placeholder: "e.g. 6E 204, AI 102" };
    case "from_code":
      return {
        label: kind === "train" ? "From Station Code" : "From Airport Code",
        placeholder: kind === "train" ? "e.g. PUNE, NDLS" : "e.g. BOM, DEL, DXB",
      };
    case "city_from":
      return { label: "Origin City", placeholder: "e.g. Mumbai, Pune, Delhi" };
    case "to_code":
      return {
        label: kind === "train" ? "To Station Code" : "To Airport Code",
        placeholder: kind === "train" ? "e.g. CSMT, BCT" : "e.g. DEL, BLR, LHR",
      };
    case "city_to":
      return { label: "Destination City", placeholder: "e.g. Delhi, Bangalore, London" };
    case "departure_date":
      return { label: "Departure Date", placeholder: "DD/MM/YYYY" };
    case "departure_time":
      return { label: "Departure Time", placeholder: "HH:MM (24-hr, e.g. 14:30)" };
    case "arrival_date":
      return { label: "Arrival Date", placeholder: "DD/MM/YYYY" };
    case "arrival_time":
      return { label: "Arrival Time", placeholder: "HH:MM (24-hr, e.g. 16:45)" };
    case "confirmation_code":
      return { label: kind === "flight" ? "PNR / Confirmation" : "Confirmation / Booking ID", placeholder: "e.g. W9Q7KL" };
    case "duration":
      return { label: "Duration", placeholder: "e.g. 02h 15m" };
    case "manage_link":
      return { label: "Check-in / Manage Link", placeholder: "https://..." };
    case "assigned_to":
      return { label: "Assigned Traveler(s)", placeholder: "Search or type traveler name", icon: "👤" };
    case "amount":
      return { label: "Fare Amount", placeholder: "e.g. 5400", icon: "💰" };
    case "currency":
      return { label: "Currency", placeholder: "INR, USD, EUR..." };
    case "booking_date":
      return { label: "Date of Booking", placeholder: "DD/MM/YYYY" };
    case "payment_method":
      return { label: "Payment Method", placeholder: "" };
    case "trip":
      return { label: "Trip Assignment", placeholder: "" };
    case "fx_rate":
      return { label: "Exchange Rate (FX)", placeholder: "e.g. 85.50 (if non-INR)" };
    case "inr_equivalent":
      return { label: "INR Equivalent", placeholder: "Calculated INR amount" };
    case "hotel_name":
      return { label: "Hotel Name", placeholder: "e.g. The Taj Mahal Palace", icon: "🏨" };
    case "address":
      return { label: "Hotel Address", placeholder: "Street address or landmark" };
    case "city":
      return { label: "City", placeholder: "e.g. Mumbai, New Delhi" };
    case "checkin_date":
      return { label: "Check-in Date", placeholder: "DD/MM/YYYY" };
    case "checkout_date":
      return { label: "Check-out Date", placeholder: "DD/MM/YYYY" };
    case "booking_link":
      return { label: "Booking Link", placeholder: "https://..." };
    case "cancellation_deadline":
      return { label: "Free Cancellation Deadline", placeholder: "DD/MM/YYYY (optional)" };
    case "booked_price":
      return { label: "Total Booked Price", placeholder: "e.g. 12000", icon: "💰" };
    case "train_name":
      return { label: "Train Name", placeholder: "e.g. Vande Bharat Express", icon: "🚂" };
    case "train_number":
      return { label: "Train Number", placeholder: "e.g. 22222" };
    case "pnr":
      return { label: "10-digit PNR", placeholder: "e.g. 8421098765" };
    case "class":
      return { label: "Travel Class", placeholder: "e.g. 2A, 3A, CC, EC, SL" };
    case "bus_operator":
      return { label: "Bus Operator Name", placeholder: "e.g. Neeta Tours, Zingbus", icon: "🚌" };
    case "bus_number":
      return { label: "Bus / Service Number", placeholder: "e.g. MH 12 AB 1234" };
    case "from":
      return { label: "Boarding Point", placeholder: "e.g. Swargate, Pune" };
    case "to":
      return { label: "Drop Point", placeholder: "e.g. Borivali, Mumbai" };
    case "ticket_number":
      return { label: "Ticket Number / Ref", placeholder: "e.g. TKT-987654" };
    default:
      return { label: key.replace(/_/g, " "), placeholder: "" };
  }
}

export function AddBookingButton({
  user: propUser,
  users = [],
  events = [],
  uberSuggestions = [],
  open: controlledOpen,
  onOpenChange,
  onRefresh,
  hideTrigger = false,
}: {
  user?: SessionUser;
  users?: UserEntry[];
  events?: TravelEvent[];
  uberSuggestions?: { label: string; address: string }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onRefresh?: () => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [kind, setKind] = useState<Kind>("flight");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const user = propUser || getSessionUser();
  const userRole = (user?.role || "").trim().toLowerCase();
  const canAddManually = ["accounts", "system manager", "owner"].includes(userRole);
  const [entryMode, setEntryMode] = useState<"upload" | "manual">("upload");

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
        setEntryMode("upload");
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
    setEntryMode("upload");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const initManualRecordForKind = useCallback(
    (k: Kind) => {
      if (k === "uber") return;
      const bookableKind = k as BookableKind;
      const keys = KEYS[bookableKind];
      const newRecord: Record<string, string> = {};
      for (const field of keys) {
        if (CLIENT_COMPUTED_KEYS.has(field)) continue;
        newRecord[field] = "";
      }
      const activeEv = events.find((e) => isActiveTrip(e));
      newRecord.trip = activeEv ? (activeEv.eventname || "").trim() : GENERAL_TRAVEL;
      newRecord.currency = "INR";
      newRecord.payment_method = "";
      newRecord.assigned_to = "";
      newRecord.amount = "";
      newRecord.fx_rate = "";
      newRecord.inr_equivalent = "";

      setRecords([newRecord]);
      setActiveLeg(0);
      setError("");
      setStatus("");
      setTotalExtractedFare(0);
      setExtractedCurrency("INR");
      setExtractedFxRate(null);
      setFareAllocationMode("first_leg");
    },
    [events],
  );

  const handleStartManualEntry = useCallback(() => {
    setEntryMode("manual");
    initManualRecordForKind(kind);
  }, [kind, initManualRecordForKind]);

  const handleSwitchToUpload = useCallback(() => {
    setEntryMode("upload");
    reset();
  }, [reset]);

  const handleSelectKind = (k: Kind) => {
    setKind(k);
    if (k === "uber") {
      reset();
      return;
    }
    if (entryMode === "manual") {
      initManualRecordForKind(k);
    } else {
      reset();
    }
  };

  const handleAddFlightLeg = () => {
    if (!records || kind !== "flight") return;
    const newLeg: Record<string, string> = {};
    for (const key of KEYS.flight) {
      if (CLIENT_COMPUTED_KEYS.has(key)) continue;
      newLeg[key] = "";
    }
    const prevLeg = records[records.length - 1];
    newLeg.airline = prevLeg?.airline || "";
    newLeg.confirmation_code = prevLeg?.confirmation_code || "";
    newLeg.from_code = prevLeg?.to_code || "";
    newLeg.city_from = prevLeg?.city_to || "";
    newLeg.assigned_to = records[0]?.assigned_to || "";
    newLeg.trip = records[0]?.trip || GENERAL_TRAVEL;
    newLeg.currency = records[0]?.currency || "INR";
    newLeg.payment_method = records[0]?.payment_method || "";
    newLeg.amount = "";
    newLeg.fx_rate = "";
    newLeg.inr_equivalent = "";
    const nextList = [...records, newLeg];
    setRecords(nextList);
    setActiveLeg(nextList.length - 1);
  };

  const handleRemoveFlightLeg = (indexToRemove: number) => {
    if (!records || records.length <= 1) return;
    const nextList = records.filter((_, i) => i !== indexToRemove);
    setRecords(nextList);
    if (activeLeg >= nextList.length) {
      setActiveLeg(nextList.length - 1);
    }
  };

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
        if (res.status === 401 || res.status === 403) {
          throw new Error("API Authentication failed. Please check your credentials or log in again.");
        }
        throw new Error(`Failed to process document (Error ${res.status}). Please try again.`);
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
    const updated = { ...next[activeLeg], [key]: value };

    if (key === "amount" || key === "booked_price") {
      setFareAllocationMode("custom");
      const amtNum = parseAmount(value);
      const cur = (updated.currency || "").trim().toUpperCase();
      if (!Number.isNaN(amtNum)) {
        if (cur === "INR") {
          updated.inr_equivalent = String(amtNum);
        } else if (updated.fx_rate) {
          const fxNum = parseFloat(updated.fx_rate);
          if (!Number.isNaN(fxNum)) {
            updated.inr_equivalent = (amtNum * fxNum).toFixed(2);
          }
        }
      }
    } else if (key === "fx_rate") {
      const fxNum = parseFloat(value);
      const amtNum = parseAmount(updated.amount || updated.booked_price);
      if (!Number.isNaN(fxNum) && !Number.isNaN(amtNum) && amtNum > 0) {
        updated.inr_equivalent = (amtNum * fxNum).toFixed(2);
      }
    } else if (key === "inr_equivalent") {
      const inrNum = parseAmount(value);
      const amtNum = parseAmount(updated.amount || updated.booked_price);
      if (!Number.isNaN(inrNum) && !Number.isNaN(amtNum) && amtNum > 0) {
        updated.fx_rate = (inrNum / amtNum).toFixed(4);
      }
    } else if (key === "currency") {
      const cur = value.trim().toUpperCase();
      if (cur === "INR") {
        updated.fx_rate = "";
        const amtNum = parseAmount(updated.amount || updated.booked_price);
        if (!Number.isNaN(amtNum)) {
          updated.inr_equivalent = String(amtNum);
        }
      }
    }

    next[activeLeg] = updated;
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

    if (entryMode === "manual") {
      if (kind === "flight") {
        const first = records[0];
        if (!first.airline?.trim() && !first.flight_number?.trim() && !first.from_code?.trim() && !first.city_from?.trim()) {
          toast.error("Please enter at least an Airline Name, Flight Number, or Origin City.");
          return;
        }
      } else if (kind === "hotel") {
        const first = records[0];
        if (!first.hotel_name?.trim()) {
          toast.error("Please enter the Hotel Name.");
          return;
        }
      } else if (kind === "train") {
        const first = records[0];
        if (!first.train_name?.trim() && !first.train_number?.trim() && !first.pnr?.trim()) {
          toast.error("Please enter at least Train Name, Number, or PNR.");
          return;
        }
      } else if (kind === "bus") {
        const first = records[0];
        if (!first.bus_operator?.trim() && !first.from?.trim() && !first.city_from?.trim()) {
          toast.error("Please enter at least Bus Operator Name or Boarding City.");
          return;
        }
      }
    }

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
      onRefresh?.();
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
                  onClick={() => handleSelectKind(k)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer",
                    kind === k
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "bg-card hover:bg-accent-soft text-foreground",
                  )}
                >
                  {k === "flight" ? "✈️ Flight" : k === "hotel" ? "🏨 Hotel" : "🚂 Train"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSelectKind("bus")}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer",
                  kind === "bus"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-card hover:bg-accent-soft text-foreground",
                )}
              >
                🚌 Bus
              </button>
              <button
                onClick={() => handleSelectKind("uber")}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition cursor-pointer",
                  kind === "uber"
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "bg-card hover:bg-accent-soft text-foreground",
                )}
              >
                🚗 Uber
              </button>
            </div>

            {/* Segmented Mode Selector for Accounts / System Manager */}
            {canAddManually && kind !== "uber" && (
              <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-border/60">
                <button
                  type="button"
                  onClick={handleSwitchToUpload}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer",
                    entryMode === "upload"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Ticket (PDF / Image)
                </button>
                <button
                  type="button"
                  onClick={handleStartManualEntry}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer",
                    entryMode === "manual"
                      ? "bg-accent text-accent-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Manual Entry (No Ticket)
                </button>
              </div>
            )}

            {/* Drop zone — shown only in upload mode and when no records parsed yet */}
            {kind !== "uber" && entryMode === "upload" && !records && (
              <div className="space-y-2">
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

                {canAddManually && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={handleStartManualEntry}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline cursor-pointer"
                    >
                      <PenLine className="h-3.5 w-3.5" /> Don't have a confirmation ticket? Enter details manually
                    </button>
                  </div>
                )}
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
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
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
                      {entryMode === "manual"
                        ? `Manual ${kind === "flight" ? "Flight" : kind === "hotel" ? "Hotel" : kind === "train" ? "Train" : "Bus"} Details`
                        : "Preview & Edit Segments"}
                    </div>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground underline cursor-pointer"
                    >
                      Clear & Start Over
                    </button>
                  </div>

                  {kind === "flight" && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {records &&
                        records.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveLeg(i)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer",
                              activeLeg === i
                                ? "bg-accent text-accent-foreground shadow-sm"
                                : "bg-background border border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <Plane className="h-3 w-3" />
                            <span>
                              Leg {i + 1}: {r.from_code || r.city_from || "?"} →{" "}
                              {r.to_code || r.city_to || "?"}
                            </span>
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={handleAddFlightLeg}
                        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-accent/60 bg-accent-soft/40 px-2.5 py-1.5 text-xs font-bold text-accent hover:bg-accent-soft transition cursor-pointer"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span>Add Leg</span>
                      </button>
                      {records && records.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFlightLeg(activeLeg)}
                          className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition cursor-pointer ml-auto"
                          title={`Remove Leg ${activeLeg + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove Leg {activeLeg + 1}</span>
                        </button>
                      )}
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

                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {keys.map((k) => {
                        const { label, placeholder, icon } = getFieldLabel(k, kind);
                        return (
                          <tr
                            key={k}
                            className={cn(
                              "border-b last:border-0",
                              k === "assigned_to" && "bg-accent-soft/40",
                              k === "amount" && "bg-emerald-500/[0.04]",
                            )}
                          >
                            <td className="w-1/3 px-3 py-2 text-xs font-semibold text-muted-foreground">
                              {icon ? `${icon} ${label}` : label}
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
                              ) : k === "assigned_to" ? (
                                <input
                                  list="booking_users_datalist"
                                  value={currentRecord[k] ?? ""}
                                  onChange={(e) => updateActiveRecord(k, e.target.value)}
                                  placeholder={placeholder || "Search traveler name..."}
                                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                              ) : k === "currency" ? (
                                <input
                                  list="booking_currency_datalist"
                                  value={currentRecord[k] ?? ""}
                                  onChange={(e) => updateActiveRecord(k, e.target.value)}
                                  placeholder={placeholder || "INR"}
                                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent uppercase"
                                />
                              ) : (
                                <input
                                  value={currentRecord[k] ?? ""}
                                  onChange={(e) => updateActiveRecord(k, e.target.value)}
                                  placeholder={
                                    k === "amount" && activeLeg > 0
                                      ? "0 (Included in Leg 1)"
                                      : placeholder
                                  }
                                  className="w-full rounded-lg border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <datalist id="booking_users_datalist">
                  {users.map((u) => (
                    <option key={u.username} value={u.name || u.username}>
                      {u.username} ({u.role})
                    </option>
                  ))}
                </datalist>
                <datalist id="booking_currency_datalist">
                  {["INR", "USD", "EUR", "GBP", "AED", "SGD", "THB", "JPY", "SAR"].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            )}

            {/* Document attach section */}
            {currentRecord && canAttachDocument && (
              <div className="rounded-2xl border p-3.5 bg-muted/20">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {entryMode === "manual"
                    ? "Attach Ticket or Confirmation (Optional)"
                    : kind === "flight"
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
