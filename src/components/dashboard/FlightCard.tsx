import { useEffect, useRef, useState } from "react";
import type { Flight, Document, TravelEvent } from "@/lib/dashboard-api";
import { uploadDocument, updateBookingStatus, removeBooking } from "@/lib/dashboard-api";
import { ExternalLink, FileText, Ticket, Upload, Loader2, X, Ban, RotateCcw, Trash2, QrCode, PenLine, ChevronDown } from "lucide-react";
import { formatTime } from "@/lib/date-utils";
import { getSessionUser } from "@/lib/auth";
import { isAssignedToMe, FULL_ACCESS_ROLES, isPersonMatch, canonicalizePersonName, splitPassengerList } from "@/lib/role-filter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { SpendEditDialog } from "./SpendEditDialog";
import { usePinch } from "@/hooks/use-pinch";
import { WeatherBadge } from "./WeatherBadge";
import { getAirlineLiveTrackerUrl } from "./FlightLiveTrackerModal";
import { Radio } from "lucide-react";

function parseDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const dp = date.split("/");
  if (dp.length !== 3) return null;
  const [dd, mm, yyyy] = dp;
  const [hh, mn] = time.split(":");
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd), parseInt(hh || "0"), parseInt(mn || "0"), 0);
}

function getProgress(dep: Date | null, arr: Date | null): number {
  if (!dep || !arr) return 0;
  const total = arr.getTime() - dep.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (Date.now() - dep.getTime()) / total));
}

function bezierPoint(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
  };
}

function bezierAngle(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const mt = 1 - t;
  const tx = 2 * mt * (cx - x0) + 2 * t * (x1 - cx);
  const ty = 2 * mt * (cy - y0) + 2 * t * (y1 - cy);
  return (Math.atan2(ty, tx) * 180) / Math.PI;
}

// Top-down commercial aircraft SVG path (nose pointing right →)
function PlaneShape({ color }: { color: string }) {
  return (
    <g>
      <ellipse cx="0" cy="0" rx="9" ry="2.5" fill={color} />
      <ellipse cx="9" cy="0" rx="3.5" ry="1.8" fill={color} />
      <polygon points="2,-1 -4,-12 -8,-12 -3,-1" fill={color} />
      <polygon points="2,1 -4,12 -8,12 -3,1" fill={color} />
      <ellipse cx="-3.5" cy="-8" rx="3" ry="1.2" fill={color} />
      <ellipse cx="-3.5" cy="8" rx="3" ry="1.2" fill={color} />
      <polygon points="-7,-1 -12,-5 -12,-2 -7,-1" fill={color} />
      <polygon points="-7,1 -12,5 -12,2 -7,1" fill={color} />
      <ellipse cx="-9" cy="0" rx="2.5" ry="1" fill={color} />
    </g>
  );
}

// Extracts the Drive file ID from our stored "https://drive.google.com/uc?id=XXXX" URL
// and builds an embeddable preview link that works for both images and PDFs.
// Robust amount display — strips thousands-separator commas and any
// currency-code text (legacy rows sometimes have currency baked into the
// amount itself) and reformats cleanly. Falls back to raw text if unparseable.
function formatAmount(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? raw : n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function toPreviewUrl(fileUrl: string): string {
  try {
    const u = new URL(fileUrl);
    const id = u.searchParams.get("id");
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  } catch {
    // fall through
  }
  return fileUrl;
}

function DocumentViewerDialog({
  title,
  fileUrl,
  onClose,
}: {
  title: string;
  fileUrl: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-bold">{title}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <iframe
          src={toPreviewUrl(fileUrl)}
          className="h-[70vh] w-full"
          title={title}
        />
      </DialogContent>
    </Dialog>
  );
}

const namesMatch = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase() ||
  isPersonMatch(a, b) ||
  isPersonMatch(b, a);

// Parses a DD/MM/YYYY string (the format used throughout this app for dates) into a Date.
function parseDdMmYyyy(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => parseInt(p, 10));
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

// Returns true once we're more than `graceDays` past the given reference date —
// used to hide upload buttons once a document is unlikely to ever be needed again.
// If the reference date can't be parsed, we default to NOT blocking uploads.
function isUploadWindowClosed(referenceDateStr?: string, graceDays = 3): boolean {
  const ref = parseDdMmYyyy(referenceDateStr);
  if (!ref) return false;
  const cutoff = new Date(ref);
  cutoff.setDate(cutoff.getDate() + graceDays);
  cutoff.setHours(23, 59, 59, 999);
  return Date.now() > cutoff.getTime();
}

export function FlightCard({
  flight,
  isPast = false,
  documents = [],
  events = [],
  onRefresh,
}: {
  flight: Flight;
  isPast?: boolean;
  documents?: Document[];
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const f = flight as unknown as Record<string, string>;
  const status = (f.bookingstatus || "").toUpperCase();
  const isCancelled = status === "CANCELLED";
  const depDate = parseDateTime(f.departuredate, f.departuretime);
  const arrDate = parseDateTime(f.arrivaldate, f.arrivaltime);
  const [progress, setProgress] = useState(() => getProgress(depDate, arrDate));
  const [expanded, setExpanded] = useState(false);
  const pinchRef = useRef<HTMLDivElement>(null);

  usePinch(pinchRef, {
    onPinchOpen: () => setExpanded(true),
    onPinchClose: () => setExpanded(false),
  });

  useEffect(() => {
    if (!depDate || !arrDate) return;
    const now = Date.now();
    if (now < depDate.getTime() || now > arrDate.getTime()) return;
    const interval = setInterval(() => setProgress(getProgress(depDate, arrDate)), 30_000);
    return () => clearInterval(interval);
  }, [f.departuredate, f.departuretime, f.arrivaldate, f.arrivaltime]);

  const isInFlight = !!(depDate && arrDate && Date.now() >= depDate.getTime() && Date.now() <= arrDate.getTime());
  const hasLanded = !!(arrDate && Date.now() > arrDate.getTime());
  const planeColor = isInFlight ? "#3B82F6" : hasLanded ? "#94A3B8" : "#CBD5E1";

  const W = 160, H = 48;
  const x0 = 8, y0 = H - 10;
  const x1 = W - 8, y1 = H - 10;
  const cx = W / 2, cy = 6;

  const planePos = bezierPoint(progress, x0, y0, cx, cy, x1, y1);
  const planeAngle = bezierAngle(progress, x0, y0, cx, cy, x1, y1);

  // Upload window closes 3 days after arrival — viewing stays available regardless.
  const uploadWindowClosed = isUploadWindowClosed(f.arrivaldate);

  // ── Documents: ticket (shared, anyone can view) + boarding pass (per-person, view-locked) ──
  const user = getSessionUser();
  const userName = user?.name || "";
  const userUsername = user?.username || "";
  const isSystemManager = (user?.role || "").trim().toLowerCase() === "system manager";
  const canEditAssignedTo = ["accounts", "hr", "system manager"].includes((user?.role || "").toLowerCase());

  // ── Spend info (amount/currency/booking date/trip/FX) — System Manager,
  // Owner, HR, and Accounts only; hidden entirely for everyone else. ──────
  const canSeeSpend = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const [spendEditOpen, setSpendEditOpen] = useState(false);

  // ── Cancel / Uncancel / Remove ──────────────────────────────────
  const [cancelOpen, setCancelOpen] = useState(false);
  const [uncancelOpen, setUncancelOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [statusActionError, setStatusActionError] = useState("");

  const runStatusChange = async (nextStatus: "Booked" | "Cancelled") => {
    setStatusActionLoading(true);
    setStatusActionError("");
    try {
      await updateBookingStatus({
        kind: "flight",
        sourceRow: Number(f.sourcerow),
        status: nextStatus,
        verifyValue: f.confirmationcode || "",
      });
      setCancelOpen(false);
      setUncancelOpen(false);
      onRefresh?.();
    } catch (e) {
      setStatusActionError((e as Error).message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const runRemove = async () => {
    setStatusActionLoading(true);
    setStatusActionError("");
    try {
      await removeBooking({
        kind: "flight",
        sourceRow: Number(f.sourcerow),
        verifyValue: f.confirmationcode || "",
      });
      setRemoveOpen(false);
      onRefresh?.();
    } catch (e) {
      setStatusActionError((e as Error).message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  // isMine: true if either name or username appears in assigned_to
  const isMine = isAssignedToMe(f.assignedto, userName) ||
    isAssignedToMe(f.assignedto, userUsername);


  const assignedNames = splitPassengerList(f.assignedto)
    .map((s) => canonicalizePersonName(s))
    .filter(Boolean);

  // Tracks boarding passes / DigiYatra QRs uploaded during this session, keyed
  // by passenger name, so the UI updates immediately without waiting for a
  // full data refetch.
  const [localPasses, setLocalPasses] = useState<Record<string, string>>({});
  const [localDigiyatra, setLocalDigiyatra] = useState<Record<string, string>>({});

  // Most recent ticket for this flight (anyone can view).
  const ticketDoc = documents
    .filter((d) => d.type === "flight" && d.category === "ticket" && d.confirmationcode === f.confirmationcode)
    .pop();

  // Look up a boarding pass for a given passenger name — checks this session's
  // local uploads first, then falls back to the most recent matching sheet row.
  // Strictly matches the requested name only; "my own pass" fallback handling
  // (in case the sheet's assigned_to spelling differs from the session name)
  // lives in myBoardingPassUrl below, not here — otherwise this function would
  // incorrectly report other passengers as "done" whenever the viewer had
  // uploaded their own.
  const getBoardingPassFor = (name: string): string | null => {
    if (localPasses[name]) return localPasses[name];
    const match = documents
      .filter(
        (d) =>
          d.type === "flight" &&
          d.category === "boardingpass" &&
          d.confirmationcode === f.confirmationcode &&
          namesMatch(d.passengername, name),
      )
      .pop();
    return match?.fileurl ?? null;
  };

  // Same lookup, for the DigiYatra QR screenshot.
  const getDigiyatraFor = (name: string): string | null => {
    if (localDigiyatra[name]) return localDigiyatra[name];
    const match = documents
      .filter(
        (d) =>
          d.type === "flight" &&
          d.category === "digiyatra" &&
          d.confirmationcode === f.confirmationcode &&
          namesMatch(d.passengername, name),
      )
      .pop();
    return match?.fileurl ?? null;
  };

  // "My own" pass may be filed under either the display name or the username
  // (sheet spelling can vary) — that fallback belongs here, scoped to the
  // viewer's own two identifiers only, not to arbitrary passenger names.
  const myBoardingPassUrl = isMine ? getBoardingPassFor(userName) || getBoardingPassFor(userUsername) : null;
  const myDigiyatraUrl = isMine ? getDigiyatraFor(userName) || getDigiyatraFor(userUsername) : null;

  // ── Ticket upload (shared document, no passenger needed) ─────────
  const [localTicketUrl, setLocalTicketUrl] = useState<string | null>(null);
  const [uploadingTicket, setUploadingTicket] = useState(false);
  const [ticketUploadError, setTicketUploadError] = useState("");
  const ticketUrl = localTicketUrl || ticketDoc?.fileurl || null;

  const handleTicketUpload = async (file: File) => {
    setUploadingTicket(true);
    setTicketUploadError("");
    try {
      const url = await uploadDocument({
        type: "flight",
        category: "ticket",
        confirmationCode: f.confirmationcode,
        file,
      });
      setLocalTicketUrl(url);
    } catch (e) {
      setTicketUploadError((e as Error).message);
    } finally {
      setUploadingTicket(false);
    }
  };

  // ── Boarding pass / DigiYatra upload (per-passenger, anyone can upload on
  // behalf of any assigned passenger) — a single hidden file input is reused
  // for both, since only one upload can be in flight from this card at a time.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState("");
  const [activeUploadCategory, setActiveUploadCategory] = useState<"boardingpass" | "digiyatra" | null>(null);
  const [pickerOpenFor, setPickerOpenFor] = useState<"boardingpass" | "digiyatra" | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<"boardingpass" | "digiyatra" | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [viewerDoc, setViewerDoc] = useState<{ title: string; url: string } | null>(null);

  // Single passenger: skip the picker, upload for them directly.
  // Multiple passengers: show a tiny inline picker only for the moment it takes to choose.
  const beginUpload = (category: "boardingpass" | "digiyatra") => {
    if (assignedNames.length > 1) {
      setPickerOpenFor(category);
      return;
    }
    setUploadFor(assignedNames[0] || "");
    setActiveUploadCategory(category);
    fileInputRef.current?.click();
  };

  const choosePassengerAndUpload = (category: "boardingpass" | "digiyatra", name: string) => {
    setUploadFor(name);
    setActiveUploadCategory(category);
    setPickerOpenFor(null);
    fileInputRef.current?.click();
  };

  const handleDocUpload = async (file: File) => {
    const category = activeUploadCategory;
    if (!category || !uploadFor) return;
    setUploadingCategory(category);
    setUploadError("");
    try {
      const url = await uploadDocument({
        type: "flight",
        category,
        confirmationCode: f.confirmationcode,
        passengerName: uploadFor,
        file,
      });
      if (category === "boardingpass") {
        setLocalPasses((prev) => ({ ...prev, [uploadFor]: url }));
      } else {
        setLocalDigiyatra((prev) => ({ ...prev, [uploadFor]: url }));
      }
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploadingCategory(null);
    }
  };

  // Highlight the boarding-pass/DigiYatra links starting 48 hours before
  // departure, until the flight actually departs — visible the rest of the
  // time regardless.
  const isCheckInWindow = !!(
    depDate &&
    Date.now() >= depDate.getTime() - 48 * 60 * 60 * 1000 &&
    Date.now() < depDate.getTime()
  );

  return (
    <div
      ref={pinchRef}
      className={`relative rounded-2xl bg-card shadow-card transition-all duration-200 overflow-hidden ${isPast ? "opacity-60 grayscale saturate-50" : "card-hover"
        } ${isCancelled ? "ring-1 ring-destructive/25" : ""}${isInFlight && !isCancelled ? " ring-2" : ""
        }`}
      style={isInFlight && !isCancelled ? { outline: "2px solid oklch(0.46 0.19 264 / 40%)", outlineOffset: "0px" } : {}}
    >
      {/* Colored left accent border */}
      {!isCancelled && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: "linear-gradient(180deg, oklch(0.46 0.21 264) 0%, oklch(0.52 0.20 240) 100%)" }}
        />
      )}
      {isCancelled && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-destructive/40" />
      )}

      <div className="pl-4 pr-4 pt-4 pb-4">
        {isPast && (
          <div className="absolute right-3 top-3 z-10">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              Past
            </span>
          </div>
        )}
        {isInFlight && (
          <div className="absolute right-3 top-3 z-10">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white flex items-center gap-1"
              style={{ background: "linear-gradient(135deg, oklch(0.46 0.21 264), oklch(0.52 0.20 240))", boxShadow: "0 2px 8px oklch(0.46 0.21 264 / 40%)" }}
            >
              ✈ Flying now
            </span>
          </div>
        )}
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: "oklch(0.46 0.21 264 / 12%)" }}
            >
              <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-accent">{f.airline || "Flight"}</span>
            {f.flightnumber && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{f.flightnumber}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <WeatherBadge
              locationQuery={f.tocode || f.cityto || ""}
              targetDate={f.arrivaldate || f.departuredate}
              dateLabel="Arrival"
            />
            {!isCancelled && (
              <a
                href={getAirlineLiveTrackerUrl(f.airline || "", f.flightnumber || f.airline || "", f.departuredate)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/25 px-2 py-1 text-[11px] font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                title={`Track ${f.airline || "flight"} status directly`}
              >
                <Radio className="h-3 w-3 text-blue-500 animate-pulse" />
                <span className="hidden sm:inline">Status</span>
              </a>
            )}
            <StatusBadge status={status} />
          </div>
        </div>

        {/* Route row */}
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-3 mb-3"
          style={{ background: "linear-gradient(135deg, oklch(0.46 0.21 264 / 7%) 0%, oklch(0.52 0.20 240 / 5%) 100%)" }}
        >
          <div className="flex-1">
            <div className="text-3xl font-black leading-none tracking-tight text-foreground">{f.fromcode || "—"}</div>
            <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{f.cityfrom}</div>
            <div className="mt-2 text-sm font-semibold">{formatTime(f.departuretime)}</div>
            <div className="text-[11px] text-muted-foreground">{f.departuredate}</div>
          </div>

          <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {f.duration || ""}
            </div>
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              style={{ minWidth: 80, maxWidth: 160 }}
              aria-hidden="true"
              overflow="visible"
            >
              <path
                d={`M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1}`}
                stroke="oklch(0.46 0.21 264 / 25%)"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                fill="none"
              />
              <circle cx={x0} cy={y0} r="3" fill="oklch(0.46 0.21 264 / 50%)" />
              <circle cx={x1} cy={y1} r="3" fill="oklch(0.46 0.21 264 / 50%)" />
              <g transform={`translate(${planePos.x}, ${planePos.y}) rotate(${planeAngle}) scale(0.7)`}>
                <PlaneShape color={planeColor} />
              </g>
            </svg>
          </div>

          <div className="flex-1 text-right">
            <div className="text-3xl font-black leading-none tracking-tight text-foreground">{f.tocode || "—"}</div>
            <div className="mt-0.5 text-[11px] font-medium text-muted-foreground">{f.cityto}</div>
            <div className="mt-2 text-sm font-semibold">{formatTime(f.arrivaltime)}</div>
            <div className="text-[11px] text-muted-foreground">{f.arrivaldate}</div>
          </div>
        </div>

        {/* Footer — pinch-to-expand or tap chevron */}
        {(f.confirmationcode || f.managelink || f.assignedto) && (
          <div className="mt-3 border-t border-border pt-2">
            {/* Expand toggle */}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-0 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              title={expanded ? "Collapse details" : "Expand details (or pinch outward)"}
            >
              <span className="font-mono">{f.confirmationcode ? `PNR  ${f.confirmationcode}` : "No PNR"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              />
            </button>

            {/* Expandable details section */}
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ maxHeight: expanded ? "600px" : "0px", opacity: expanded ? 1 : 0 }}
            >
              <div className="space-y-1 pb-1 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span />
                  {!isCancelled && (
                    <div className="flex items-center gap-3">
                      {f.managelink && (
                        <a
                          href={f.managelink}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-1 rounded px-1 font-semibold text-accent hover:underline ${isCheckInWindow ? "ring-1 ring-accent" : ""
                            }`}
                        >
                          Boarding pass <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <a
                        href="https://digiyatrafoundation.com/"
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1 rounded px-1 font-semibold text-accent hover:underline ${isCheckInWindow ? "ring-1 ring-accent" : ""
                          }`}
                      >
                        DigiYatra <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
                {f.assignedto && (
                  <div className="text-[11px] text-muted-foreground">
                    👤 {splitPassengerList(f.assignedto).map((p) => canonicalizePersonName(p)).join(", ")}
                  </div>
                )}
                {canSeeSpend && (
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {f.amount ? (
                        (f.currency || "INR").toUpperCase() === "INR" ? (
                          <>💰 ₹{formatAmount(f.amount)}{f.trip ? ` · ${f.trip}` : ""}</>
                        ) : f.inrequivalent ? (
                          <>💰 ₹{formatAmount(f.inrequivalent)} ({formatAmount(f.amount)} {f.currency}){f.trip ? ` · ${f.trip}` : ""}</>
                        ) : (
                          <>💰 {formatAmount(f.amount)} {f.currency} (rate not resolved){f.trip ? ` · ${f.trip}` : ""}</>
                        )
                      ) : (
                        <span className="italic">No cost recorded{f.trip ? ` · ${f.trip}` : ""}</span>
                      )}
                    </span>
                    <button
                      onClick={() => setSpendEditOpen(true)}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-accent hover:bg-accent-soft"
                    >
                      <PenLine className="h-3 w-3" /> {f.amount ? "Edit" : "Add cost"}
                    </button>
                  </div>
                )}

                {canSeeSpend && (
                  <SpendEditDialog
                    open={spendEditOpen}
                    onClose={() => setSpendEditOpen(false)}
                    onSaved={() => onRefresh?.()}
                    kind="flight"
                    sourceRow={Number(f.sourcerow)}
                    verifyValue={f.confirmationcode || ""}
                    amountFieldSlug="amount"
                    amountLabel="Amount paid"
                    fallbackDateDdMmYyyy={f.departuredate}
                    assignedTo={f.assignedto}
                    canEditAssignedTo={canEditAssignedTo}
                    events={events}
                    initial={{
                      amount: f.amount || "",
                      currency: f.currency || "INR",
                      bookingDate: f.bookingdate || "",
                      trip: f.trip || "",
                      fxRate: f.fxrate || "",
                      inrEquivalent: f.inrequivalent || "",
                      paymentMethod: f.paymentmethod || "",
                      amountType: f.amounttype || "total",
                    }}
                  />
                )}

                {/* Ticket / Boarding pass / DigiYatra QR — three slots, always visible,
          no toggle. Each slot shows exactly one button: "View" once that
          document exists (ticket: for anyone; boarding pass/QR: for you
          specifically), otherwise "Upload". Hidden entirely once we're more
          than 3 days past arrival, and not shown at all once cancelled. */}
                {!isCancelled && !uploadWindowClosed && (
                  <div className="mt-2 border-t border-border pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        {/* Ticket slot — shared document, no passenger needed */}
                        {ticketUrl ? (
                          <button
                            onClick={() => setViewerDoc({ title: "Ticket", url: ticketUrl })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
                          >
                            <FileText className="h-3 w-3" /> View ticket
                          </button>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80">
                            {uploadingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            {uploadingTicket ? "Uploading…" : "Upload ticket"}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              disabled={uploadingTicket}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleTicketUpload(file);
                              }}
                            />
                          </label>
                        )}

                        {/* Boarding pass slot — per-passenger */}
                        {myBoardingPassUrl ? (
                          <button
                            onClick={() => setViewerDoc({ title: "My boarding pass", url: myBoardingPassUrl })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
                          >
                            <Ticket className="h-3 w-3" /> View boarding pass
                          </button>
                        ) : pickerOpenFor === "boardingpass" ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onBlur={() => setPickerOpenFor(null)}
                            onChange={(e) => {
                              if (e.target.value) choosePassengerAndUpload("boardingpass", e.target.value);
                            }}
                            className="rounded-full border bg-background px-2 py-1 text-[11px]"
                          >
                            <option value="" disabled>Choose passenger…</option>
                            {assignedNames.filter((name) => !getBoardingPassFor(name)).map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => beginUpload("boardingpass")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80"
                          >
                            {uploadingCategory === "boardingpass" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            {uploadingCategory === "boardingpass" ? "Uploading…" : "Upload boarding pass"}
                          </button>
                        )}

                        {/* DigiYatra QR slot — per-passenger */}
                        {myDigiyatraUrl ? (
                          <button
                            onClick={() => setViewerDoc({ title: "My DigiYatra QR", url: myDigiyatraUrl })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
                          >
                            <QrCode className="h-3 w-3" /> View DigiYatra QR
                          </button>
                        ) : pickerOpenFor === "digiyatra" ? (
                          <select
                            autoFocus
                            defaultValue=""
                            onBlur={() => setPickerOpenFor(null)}
                            onChange={(e) => {
                              if (e.target.value) choosePassengerAndUpload("digiyatra", e.target.value);
                            }}
                            className="rounded-full border bg-background px-2 py-1 text-[11px]"
                          >
                            <option value="" disabled>Choose passenger…</option>
                            {assignedNames.filter((name) => !getDigiyatraFor(name)).map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => beginUpload("digiyatra")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80"
                          >
                            {uploadingCategory === "digiyatra" ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            {uploadingCategory === "digiyatra" ? "Uploading…" : "Upload DigiYatra QR"}
                          </button>
                        )}
                      </div>

                      {assignedNames.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                          {assignedNames.map((name) => {
                            const hasPass = !!getBoardingPassFor(name);
                            const hasDigi = !!getDigiyatraFor(name);
                            return (
                              <span key={name} className="inline-flex items-center gap-1">
                                {assignedNames.length > 1 && name}
                                <span className={hasPass ? "font-semibold text-success" : ""}>BP{hasPass ? "✓" : "○"}</span>
                                <span className={hasDigi ? "font-semibold text-success" : ""}>DY{hasDigi ? "✓" : "○"}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Shared hidden file input for the boarding pass / DigiYatra uploads above */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocUpload(file);
                        e.target.value = "";
                      }}
                    />

                    {(ticketUploadError || uploadError) && (
                      <div className="mt-1.5 text-[11px] text-destructive">{ticketUploadError || uploadError}</div>
                    )}
                  </div>
                )}
              </div>{/* end space-y-1 */}
            </div>{/* end maxHeight transition wrapper */}
          </div>
        )}

        {viewerDoc && (
          <DocumentViewerDialog
            title={viewerDoc.title}
            fileUrl={viewerDoc.url}
            onClose={() => setViewerDoc(null)}
          />
        )}

        {/* Cancel / Uncancel / Remove — Cancel & Uncancel only offered on upcoming
          cards (a past trip cancelling/uncancelling doesn't mean anything);
          Remove is System Manager only and works regardless of past/cancelled. */}
        {(!isPast || isSystemManager) && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
            {!isPast && !isCancelled && (
              <button
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
              >
                <Ban className="h-3 w-3" /> Cancel flight
              </button>
            )}
            {!isPast && isCancelled && (
              <button
                onClick={() => setUncancelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
              >
                <RotateCcw className="h-3 w-3" /> Uncancel
              </button>
            )}
            {isSystemManager && (
              <button
                onClick={() => setRemoveOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            )}
          </div>
        )}

        <ConfirmDialog
          open={cancelOpen}
          title="Cancel this flight?"
          message={`${f.fromcode || "—"} → ${f.tocode || "—"} on ${f.departuredate || "this date"} will be marked as cancelled. You can uncancel it later if needed.`}
          confirmLabel="Cancel flight"
          destructive
          loading={statusActionLoading}
          error={statusActionError}
          onConfirm={() => runStatusChange("Cancelled")}
          onCancel={() => { setCancelOpen(false); setStatusActionError(""); }}
        />
        <ConfirmDialog
          open={uncancelOpen}
          title="Uncancel this flight?"
          message={`${f.fromcode || "—"} → ${f.tocode || "—"} on ${f.departuredate || "this date"} will be marked as booked again.`}
          confirmLabel="Uncancel"
          loading={statusActionLoading}
          error={statusActionError}
          onConfirm={() => runStatusChange("Booked")}
          onCancel={() => { setUncancelOpen(false); setStatusActionError(""); }}
        />
        <ConfirmDialog
          open={removeOpen}
          title="Remove this flight permanently?"
          message={`This deletes ${f.fromcode || "—"} → ${f.tocode || "—"} on ${f.departuredate || "this date"} from the sheet entirely, along with any attached documents. This can't be undone.`}
          confirmLabel="Remove permanently"
          destructive
          loading={statusActionLoading}
          error={statusActionError}
          onConfirm={runRemove}
          onCancel={() => { setRemoveOpen(false); setStatusActionError(""); }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${status === "BOOKED" ? "bg-success-soft text-success"
        : status === "PENDING" ? "bg-destructive/10 text-destructive"
          : status === "CANCELLED" ? "bg-destructive/10 text-destructive line-through"
            : "bg-muted text-muted-foreground"
      }`}>
      {status || "—"}
    </span>
  );
}