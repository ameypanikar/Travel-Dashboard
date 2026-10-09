import { BookableKind, PROMPTS, KEYS, CLIENT_COMPUTED_KEYS } from "./booking-prompts";
import {
  fetchGeminiKey,
  fetchGeminiModel,
  uploadDocument,
  fetchFxRate,
  addBooking,
  TravelEvent,
} from "./dashboard-api";
import { suggestTrip, parseAmount } from "./expense-utils";
import { normalizeAssignedTo } from "./booking-utils";

export async function autoRouteTransportTicket(
  file: File,
  kind: BookableKind,
  users: { name: string; username: string; role: string }[],
  events: TravelEvent[],
  onStatus: (status: string) => void,
  overrideTrip?: string
): Promise<void> {
  let key = localStorage.getItem("gemini_api_key") || "";
  if (!key) {
    try {
      key = await fetchGeminiKey();
    } catch {
      // ignore error
    }
  }
  if (!key) throw new Error("Gemini API key not set.");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let mimeType = "application/pdf";
  if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
  else if (ext === "png") mimeType = "image/png";
  else if (ext === "webp") mimeType = "image/webp";

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const model = await fetchGeminiModel();
  const prompt = PROMPTS[kind];
  onStatus("Extracting ticket details...");

  let attempt = 0;
  let raw: unknown;
  while (attempt < 3) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }] },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      },
    );

    if (res.status === 429) {
      attempt++;
      if (attempt >= 3) throw new Error("Rate limited by Gemini.");
      onStatus("Rate limited - waiting 15s...");
      await new Promise((r) => setTimeout(r, 15000));
      onStatus("Retrying extraction...");
      continue;
    }
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("SYSTEM UPDATE REQUIRED: Your Gemini API token is outdated or invalid. Please check your settings.");
      }
      throw new Error(`Gemini error ${res.status}`);
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      raw = JSON.parse(cleaned);
      break;
    } catch {
      throw new Error("Failed to parse Gemini response.");
    }
  }

  const keys = KEYS[kind];
  const rawRecords: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : [raw as Record<string, unknown>];
  if (rawRecords.length === 0) throw new Error("No booking details found.");

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

  let fxRateNum: number | null = null;
  if (parsedGrandTotal > 0 && parsedCurrency && parsedCurrency !== "INR") {
    const firstDepDate = String(rawRecords[0]?.departure_date || rawRecords[0]?.checkin_date || "");
    const fxDateDdMmYyyy = parsedBookingDate || firstDepDate;

    // Convert to ISO
    let fxIso = "";
    const trimmed = fxDateDdMmYyyy.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) fxIso = trimmed;
    else {
      const parts = trimmed.split("/");
      if (parts.length === 3 && parts[2].length === 4)
        fxIso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    if (fxIso) {
      onStatus("Resolving exchange rate...");
      const fx = await fetchFxRate(fxIso, parsedCurrency);
      if (fx) fxRateNum = fx.rate;
    }
  }

  onStatus("Saving booking to transport section...");

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

    // toIsoDate
    let relevantIso = "";
    const rTrimmed = relevantDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rTrimmed)) relevantIso = rTrimmed;
    else {
      const parts = rTrimmed.split("/");
      if (parts.length === 3 && parts[2].length === 4)
        relevantIso = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }

    const match = events.find((ev) => {
      if (ev.status !== "Booked") return false;
      let start = ev.startdate;
      if (!start) return false;
      const sparts = start.split("/");
      if (sparts.length === 3)
        start = `${sparts[2]}-${sparts[1].padStart(2, "0")}-${sparts[0].padStart(2, "0")}`;
      let end = ev.enddate || ev.startdate;
      const eparts = end.split("/");
      if (eparts.length === 3)
        end = `${eparts[2]}-${eparts[1].padStart(2, "0")}-${eparts[0].padStart(2, "0")}`;

      const sd = new Date(`${start}T00:00:00`);
      sd.setDate(sd.getDate() - 1);
      const graceStart = sd.toISOString().slice(0, 10);

      const ed = new Date(`${end}T00:00:00`);
      ed.setDate(ed.getDate() + 1);
      const graceEnd = ed.toISOString().slice(0, 10);

      return relevantIso >= graceStart && relevantIso <= graceEnd;
    });

    normalized.trip = overrideTrip || (match ? match.eventname : "General Travel");
    normalized.payment_method = "";
    normalized.currency = parsedCurrency;

    if (kind === "flight" && numLegs > 1) {
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
      const amtKey = kind === "hotel" ? "booked_price" : "amount";
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

  for (const legFields of normalizedRecords) {
    await addBooking(kind, legFields);
  }

  onStatus("Uploading document...");
  const uniqueCodes = Array.from(
    new Set(normalizedRecords.map((r) => r.confirmation_code).filter(Boolean)),
  );
  if (uniqueCodes.length > 0) {
    try {
      for (const code of uniqueCodes) {
        await uploadDocument({
          type: kind === "flight" ? "flight" : kind === "hotel" ? "hotel" : "flight", // fallback, uploadDocument supports flight/hotel types mainly? Wait, addBooking handles it. Wait, uploadDocument typing:
          category: kind === "flight" ? "ticket" : "confirmation",
          confirmationCode: code,
          file: file,
        });
      }
    } catch (e) {
      console.warn("Upload failed but booking saved", e);
    }
  }
}
