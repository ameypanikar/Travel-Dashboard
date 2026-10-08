import { useState } from "react";
import type { Hotel, Document, TravelEvent } from "@/lib/dashboard-api";
import { uploadDocument, updateBookingStatus, removeBooking } from "@/lib/dashboard-api";
import { Hotel as HotelIcon, ExternalLink, MapPin, DoorOpen, FileText, Upload, Loader2, X, Ban, RotateCcw, Trash2, PenLine } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getSessionUser } from "@/lib/auth";
import { ConfirmDialog } from "./ConfirmDialog";
import { SpendEditDialog } from "./SpendEditDialog";
import { FULL_ACCESS_ROLES, canonicalizePersonName, splitPassengerList } from "@/lib/role-filter";
import { WeatherBadge } from "./WeatherBadge";

// Robust amount display — strips thousands-separator commas and any
// currency-code text (legacy rows sometimes have "9,348.02 INR" baked into
// the amount itself, from before Currency was a separate column) and
// reformats cleanly. Falls back to the raw text if it can't be parsed at all.
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

export function HotelCard({
  hotel,
  isPast = false,
  documents = [],
  events = [],
  onRefresh,
}: {
  hotel: Hotel;
  isPast?: boolean;
  documents?: Document[];
  events?: TravelEvent[];
  onRefresh?: () => void;
}) {
  const h = hotel as unknown as Record<string, string>;
  const status = (h.bookingstatus || "").toUpperCase();
  const isCancelled = status === "CANCELLED";

  const roomAssignmentsRaw = h.roomassignments || "";
  const roomList = roomAssignmentsRaw
    ? roomAssignmentsRaw.split(",").map((r) => r.trim()).filter(Boolean)
    : [];
  const numRooms = h.numberofrooms ? parseInt(h.numberofrooms, 10) : roomList.length || null;

  const existingConfirmationDoc = documents.find(
    (d) => d.type === "hotel" && d.category === "confirmation" && d.confirmationcode === h.confirmationcode,
  );

  // Locally tracks a just-uploaded file so the button updates immediately,
  // without needing to wait for the next full data refresh.
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const fileUrl = localFileUrl || existingConfirmationDoc?.fileurl || null;

  // Upload window closes 3 days after checkout — viewing stays available regardless.
  const uploadWindowClosed = isUploadWindowClosed(h.checkoutdate);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // ── Cancel / Uncancel / Remove ──────────────────────────────────
  const user = getSessionUser();
  const isSystemManager = (user?.role || "").trim().toLowerCase() === "system manager";
  const canEditAssignedTo = ["accounts", "hr", "system manager"].includes((user?.role || "").toLowerCase());

  // ── Spend info (amount/currency/booking date/trip/FX) — System Manager,
  // Owner, HR, and Accounts only; hidden entirely for everyone else. ──────
  const canSeeSpend = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());
  const [spendEditOpen, setSpendEditOpen] = useState(false);
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
        kind: "hotel",
        sourceRow: Number(h.sourcerow),
        status: nextStatus,
        verifyValue: h.confirmationcode || "",
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
        kind: "hotel",
        sourceRow: Number(h.sourcerow),
        verifyValue: h.confirmationcode || "",
      });
      setRemoveOpen(false);
      onRefresh?.();
    } catch (e) {
      setStatusActionError((e as Error).message);
    } finally {
      setStatusActionLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!h.confirmationcode) {
      setUploadError("This hotel has no confirmation code yet — can't attach a document.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadDocument({
        type: "hotel",
        category: "confirmation",
        confirmationCode: h.confirmationcode,
        file,
      });
      setLocalFileUrl(url);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className={`relative rounded-2xl bg-card shadow-card transition-all duration-200 overflow-hidden ${
        isPast ? "opacity-60 grayscale saturate-50" : "card-hover"
      } ${isCancelled ? "ring-1 ring-destructive/25" : ""}`}
    >
      {/* Hotel-colored left accent border */}
      {!isCancelled && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
          style={{ background: "linear-gradient(180deg, oklch(0.52 0.18 30) 0%, oklch(0.62 0.20 50) 100%)" }}
        />
      )}
      {isCancelled && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-destructive/40" />
      )}

      <div className="pl-4 pr-4 pt-4 pb-4">

      {isPast && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Past
        </span>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: "oklch(0.52 0.18 30 / 12%)" }}
          >
            <HotelIcon className="h-3.5 w-3.5" style={{ color: "oklch(0.52 0.18 30)" }} />
          </div>
          <span className="text-sm font-bold" style={{ color: "oklch(0.52 0.18 30)" }}>{h.hotelname || "Hotel"}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <WeatherBadge
            locationQuery={h.city || h.hotelname || ""}
            targetDate={h.checkindate}
            dateLabel="Check-in"
          />
          {numRooms && (
            <span className="flex items-center gap-0.5 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              <DoorOpen className="h-3 w-3" />
              {numRooms} {numRooms === 1 ? "room" : "rooms"}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              status === "BOOKED"
                ? "bg-success-soft text-success"
                : status === "PENDING"
                  ? "bg-destructive/10 text-destructive"
                  : status === "CANCELLED"
                    ? "bg-destructive/10 text-destructive line-through"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {status || "—"}
          </span>
        </div>
      </div>

      {h.city && (
        <div className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{h.city}</span>
        </div>
      )}

      <div
        className="grid grid-cols-2 gap-3 rounded-xl px-3 py-2.5 mb-1"
        style={{ background: "linear-gradient(135deg, oklch(0.52 0.18 30 / 8%) 0%, oklch(0.62 0.20 50 / 5%) 100%)" }}
      >
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "oklch(0.52 0.18 30 / 70%)" }}>
            Check-in
          </div>
          <div className="text-sm font-bold">{h.checkindate || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "oklch(0.52 0.18 30 / 70%)" }}>
            Check-out
          </div>
          <div className="text-sm font-bold">{h.checkoutdate || "—"}</div>
        </div>
      </div>

      {roomList.length > 0 && (
        <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Room Assignments
          </div>
          <div className="space-y-0.5">
            {roomList.map((r, i) => {
              const parts = r.split(/[-–→]+/).map((p) => p.trim());
              return (
                <div key={i} className="flex items-center gap-1 text-xs">
                  {parts.length === 2 ? (
                    <>
                      <span className="font-medium">{parts[0]}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono font-semibold text-accent">Room {parts[1]}</span>
                    </>
                  ) : (
                    <span>{r}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(h.confirmationcode || h.googlemapslink || h.assignedto) && (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {h.confirmationcode && (
              <span className="font-mono text-muted-foreground">{h.confirmationcode}</span>
            )}
            {h.googlemapslink && (
              <a
                href={h.googlemapslink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                Map <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          {h.assignedto && (
            <div className="text-[11px] text-muted-foreground">
              👤 {splitPassengerList(h.assignedto).map((p) => canonicalizePersonName(p)).join(", ")}
            </div>
          )}
          {canSeeSpend && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {h.bookedprice ? (
                  (h.currency || "INR").toUpperCase() === "INR" ? (
                    <>💰 ₹{formatAmount(h.bookedprice)}{h.trip ? ` · ${h.trip}` : ""}</>
                  ) : h.inrequivalent ? (
                    <>💰 ₹{formatAmount(h.inrequivalent)} ({formatAmount(h.bookedprice)} {h.currency}){h.trip ? ` · ${h.trip}` : ""}</>
                  ) : (
                    <>💰 {formatAmount(h.bookedprice)} {h.currency} (rate not resolved){h.trip ? ` · ${h.trip}` : ""}</>
                  )
                ) : (
                  <span className="italic">No cost recorded{h.trip ? ` · ${h.trip}` : ""}</span>
                )}
              </span>
              <button
                onClick={() => setSpendEditOpen(true)}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-accent hover:bg-accent-soft"
              >
                <PenLine className="h-3 w-3" /> {h.bookedprice ? "Edit" : "Add cost"}
              </button>
            </div>
          )}
        </div>
      )}

      {canSeeSpend && (
        <SpendEditDialog
          open={spendEditOpen}
          onClose={() => setSpendEditOpen(false)}
          onSaved={() => onRefresh?.()}
          kind="hotel"
          sourceRow={Number(h.sourcerow)}
          verifyValue={h.confirmationcode || ""}
          amountFieldSlug="bookedprice"
          amountLabel="Booked price"
          fallbackDateDdMmYyyy={h.checkindate}
          assignedTo={h.assignedto}
          canEditAssignedTo={canEditAssignedTo}
          events={events}
          initial={{
            amount: h.bookedprice || "",
            currency: h.currency || "INR",
            bookingDate: h.bookingdate || "",
            trip: h.trip || "",
            fxRate: h.fxrate || "",
            inrEquivalent: h.inrequivalent || "",
            paymentMethod: h.paymentmethod || "", 
            amountType: h.amounttype || "total",
          }}
        />
      )}

      {/* Document row — view if one exists (always); offer to attach only if window's open and not cancelled */}
      {(fileUrl || (!uploadWindowClosed && !isCancelled)) && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
          {fileUrl ? (
            <button
              onClick={() => setViewerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10"
            >
              <FileText className="h-3 w-3" /> View booking confirmation
            </button>
          ) : (
            !uploadWindowClosed &&
            !isCancelled && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted/80">
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                {uploading ? "Uploading…" : "Attach confirmation PDF"}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                />
              </label>
            )
          )}
        </div>
      )}

      {uploadError && (
        <div className="mt-1.5 text-[11px] text-destructive">{uploadError}</div>
      )}

      {viewerOpen && fileUrl && (
        <DocumentViewerDialog
          title="Booking confirmation"
          fileUrl={fileUrl}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Cancel / Uncancel / Remove — Cancel & Uncancel only offered on upcoming
          cards; Remove is System Manager only and works regardless of past/cancelled. */}
      {(!isPast || isSystemManager) && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
          {!isPast && !isCancelled && (
            <button
              onClick={() => setCancelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
            >
              <Ban className="h-3 w-3" /> Cancel hotel
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
        title="Cancel this hotel booking?"
        message={`${h.hotelname || "This hotel"} (${h.checkindate || "?"} – ${h.checkoutdate || "?"}) will be marked as cancelled. You can uncancel it later if needed.`}
        confirmLabel="Cancel hotel"
        destructive
        loading={statusActionLoading}
        error={statusActionError}
        onConfirm={() => runStatusChange("Cancelled")}
        onCancel={() => { setCancelOpen(false); setStatusActionError(""); }}
      />
      <ConfirmDialog
        open={uncancelOpen}
        title="Uncancel this hotel booking?"
        message={`${h.hotelname || "This hotel"} (${h.checkindate || "?"} – ${h.checkoutdate || "?"}) will be marked as booked again.`}
        confirmLabel="Uncancel"
        loading={statusActionLoading}
        error={statusActionError}
        onConfirm={() => runStatusChange("Booked")}
        onCancel={() => { setUncancelOpen(false); setStatusActionError(""); }}
      />
      <ConfirmDialog
        open={removeOpen}
        title="Remove this hotel permanently?"
        message={`This deletes ${h.hotelname || "this hotel"} (${h.checkindate || "?"} – ${h.checkoutdate || "?"}) from the sheet entirely, along with any attached documents. This can't be undone.`}
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