import { useState } from "react";
import type { TravelEvent } from "@/lib/dashboard-api";
import { appendEvent, removeBooking, updateEventWithCascade } from "@/lib/dashboard-api";
import { getRelativeDateLabel } from "@/lib/date-utils";
import { CalendarCheck, MapPin, Plus, Trash2, Pencil } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { FULL_ACCESS_ROLES } from "@/lib/role-filter";
import { ConfirmDialog } from "./ConfirmDialog";

const ROLE_COLORS: Record<string, string> = {
  "Stall Holder": "bg-green-100 text-green-700",
  "Visitor": "bg-blue-100 text-blue-700",
  "Organiser": "bg-orange-100 text-orange-700",
  "Sponsor": "bg-purple-100 text-purple-700",
};

const EVENT_TYPES = ["Exhibition", "Conference", "Trade Show", "Meeting", "Standing Tour", "Other"];
const OUR_ROLES = ["Stall Holder", "Visitor", "Organiser", "Sponsor"];

type Props = {
  events: TravelEvent[];
  onRefresh: () => void;
};

const EMPTY_FORM = {
  eventname: "", startdate: "", enddate: "",
  location: "", type: "Exhibition", ourrole: "Visitor", notes: "",
};

// Events use plain "YYYY-MM-DD" (from <input type="date">), unlike flights/hotels
// which use DD/MM/YYYY — so no conversion needed here, just string comparison.
const pad = (n: number) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// getRelativeDateLabel expects DD/MM/YYYY, but events store YYYY-MM-DD — convert first.
function ymdToDdMmYyyy(ymd: string): string {
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
}

function EventCard({
  ev,
  isPast = false,
  onRefresh,
  onEdit,
}: {
  ev: TravelEvent;
  isPast?: boolean;
  onRefresh?: () => void;
  onEdit?: (ev: TravelEvent) => void;
}) {
  const user = getSessionUser();
  // Events remove permission is intentionally broader than flights/hotels/trains
  // (System Manager only there) — events extend it to Owner/HR/Accounts too,
  // since events have no per-user assignment to piggyback visibility on.
  const canRemove = FULL_ACCESS_ROLES.includes((user?.role || "").trim().toLowerCase());

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const runRemove = async () => {
    setRemoveLoading(true);
    setRemoveError("");
    try {
      await removeBooking({
        kind: "event",
        sourceRow: Number(ev.sourcerow),
        verifyValue: ev.eventname || "",
      });
      setRemoveOpen(false);
      onRefresh?.();
    } catch (e) {
      setRemoveError((e as Error).message);
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div
      className={`relative rounded-2xl bg-card p-4 shadow-card transition ${isPast ? "opacity-60 grayscale saturate-50" : ""
        }`}
    >
      {isPast && (
        <span className="absolute right-3 top-3 z-10 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          Past
        </span>
      )}
      <div className="mb-1 flex items-start justify-between gap-2 pr-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-accent">
          <CalendarCheck className="h-4 w-4 shrink-0" />
          <span>{ev.eventname}</span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLORS[ev.ourrole] ?? "bg-muted text-muted-foreground"}`}>
          {ev.ourrole || "—"}
        </span>
      </div>

      {ev.location && (
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{ev.location}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-xs">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Start</div>
          <div className="mt-0.5 font-semibold">{ev.startdate || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">End</div>
          <div className="mt-0.5 font-semibold">{ev.enddate || "—"}</div>
        </div>
      </div>

      {(ev.type || ev.notes) && (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {ev.type && <div>📋 {ev.type}</div>}
          {ev.notes && <div>📝 {ev.notes}</div>}
        </div>
      )}

      {canRemove && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border pt-2">
          <button
            onClick={() => onEdit?.(ev)}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent/10 hover:text-accent"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          <button
            onClick={() => setRemoveOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        </div>
      )}

      <ConfirmDialog
        open={removeOpen}
        title="Remove this event permanently?"
        message={`This deletes "${ev.eventname || "this event"}" from the sheet entirely. This can't be undone.`}
        confirmLabel="Remove permanently"
        destructive
        loading={removeLoading}
        error={removeError}
        onConfirm={runRemove}
        onCancel={() => { setRemoveOpen(false); setRemoveError(""); }}
      />
    </div>
  );
}

export function EventsList({ events, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingOldName, setEditingOldName] = useState("");

  // Summary counts
  const stallCount = events.filter((e) => e.ourrole === "Stall Holder").length;
  const visitorCount = events.filter((e) => e.ourrole === "Visitor").length;
  const organiserCount = events.filter((e) => e.ourrole === "Organiser").length;

  // Split into upcoming (enddate today-or-future) and past (enddate before today),
  // each sorted ascending by startdate.
  const today = todayYMD();
  const upcoming: TravelEvent[] = [];
  const past: TravelEvent[] = [];
  for (const ev of events) {
    const end = ev.enddate || ev.startdate;
    if (end && end < today) past.push(ev);
    else upcoming.push(ev);
  }
  const byStartAsc = (a: TravelEvent, b: TravelEvent) => {
    if (a.type === "Standing Tour" && b.type !== "Standing Tour") return 1;
    if (a.type !== "Standing Tour" && b.type === "Standing Tour") return -1;
    return (a.startdate || "").localeCompare(b.startdate || "");
  };
  upcoming.sort(byStartAsc);
  past.sort(byStartAsc);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(null);
    try {
      if (editingId) {
        await updateEventWithCascade(editingId, editingOldName, form);
      } else {
        await appendEvent(form);
      }
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      setEditingId(null);
      setEditingOldName("");
      onRefresh();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditClick(ev: TravelEvent) {
    if (ev.sourcerow) {
      setEditingId(ev.sourcerow);
      setEditingOldName(ev.eventname);
      setForm({
        eventname: ev.eventname || "",
        startdate: ev.startdate || "",
        enddate: ev.enddate || "",
        location: ev.location || "",
        type: ev.type || "Exhibition",
        ourrole: ev.ourrole || "Visitor",
        notes: ev.notes || "",
      });
      setShowForm(true);
    }
  }

  return (
    <div>
      {/* Summary banner */}
      <div className="mb-3 flex flex-wrap gap-2 rounded-2xl bg-card px-4 py-3 shadow-card text-xs font-semibold">
        <span className="text-muted-foreground">{upcoming.length} upcoming</span>
        {upcoming.filter((e) => e.ourrole === "Stall Holder").length > 0 && (
          <span className="text-green-700">
            · {upcoming.filter((e) => e.ourrole === "Stall Holder").length} Stall Holder
          </span>
        )}
        {upcoming.filter((e) => e.ourrole === "Visitor").length > 0 && (
          <span className="text-blue-700">
            · {upcoming.filter((e) => e.ourrole === "Visitor").length} Visitor
          </span>
        )}
        {upcoming.filter((e) => e.ourrole === "Organiser").length > 0 && (
          <span className="text-orange-700">
            · {upcoming.filter((e) => e.ourrole === "Organiser").length} Organiser
          </span>
        )}
      </div>

      {/* Add event button */}
      <button
        onClick={() => {
          setEditingId(null);
          setEditingOldName("");
          setForm({ ...EMPTY_FORM });
          setShowForm(true);
        }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Add Event
      </button>

      {/* Events list — split into Upcoming / Past sections */}
      {events.length === 0 && !showForm && (
        <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
          No events yet. Add one above.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Upcoming
          </div>
          <div className="flex flex-col gap-3">
            {upcoming.map((ev, i) => (
              <div key={`upcoming-${ev.eventname}-${ev.startdate}-${i}`}>
                <div className="mb-1 px-1 text-xs font-semibold text-accent">
                  {getRelativeDateLabel(ymdToDdMmYyyy(ev.startdate))}
                </div>
                <EventCard ev={ev} onRefresh={onRefresh} onEdit={handleEditClick} />
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Past
          </div>
          <div className="flex flex-col gap-3">
            {past.map((ev, i) => (
              <EventCard key={`past-${ev.eventname}-${ev.startdate}-${i}`} ev={ev} isPast onRefresh={onRefresh} onEdit={handleEditClick} />
            ))}
          </div>
        </div>
      )}

      {/* Add event modal — anchored near the top of the viewport (not
          vertically centered) so it always opens in the same place
          regardless of how far down the list the user had scrolled. */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 pb-8 pt-16 sm:pt-20">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-accent">{editingId ? "Edit Event" : "Add Event"}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <input
                required
                type="text"
                placeholder="Event Name *"
                value={form.eventname}
                onChange={(e) => setForm({ ...form, eventname: e.target.value })}
                className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">Start Date</label>
                  <input
                    required
                    type="date"
                    value={form.startdate}
                    onChange={(e) => setForm({ ...form, startdate: e.target.value })}
                    className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    value={form.enddate}
                    onChange={(e) => setForm({ ...form, enddate: e.target.value })}
                    className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">Our Role</label>
                  <select
                    value={form.ourrole}
                    onChange={(e) => setForm({ ...form, ourrole: e.target.value })}
                    className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    {OUR_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <textarea
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-input bg-slate-50 dark:bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
                >
                  {saving ? "Saving…" : (editingId ? "Save Changes" : "Add Event")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}