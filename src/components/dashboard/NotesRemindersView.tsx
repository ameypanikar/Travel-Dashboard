import { useMemo, useState } from "react";
import { Circle, Pencil, Trash2, CalendarPlus } from "lucide-react";
import type { NoteReminder } from "@/lib/dashboard-api";
import { updateNoteReminder, removeNoteReminder } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { ConfirmDialog } from "./ConfirmDialog";
import { EditNoteReminderDialog } from "./EditNoteReminderDialog.tsx";
import { useDecryptedNotesReminders } from "@/lib/useDecryptedNotesReminders.ts";
import { generateGoogleCalendarLink } from "@/lib/utils";

function toIso(ddmmyyyy: string): string {
  const parts = (ddmmyyyy || "").split("/");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

export function NotesRemindersView({
  user,
  items,
  onRefresh,
}: {
  user: SessionUser;
  items: NoteReminder[];
  onRefresh: () => void;
}) {
  const mineRaw = useMemo(
    () =>
      items.filter((i) => {
        const iu = (i.username || "").trim().toLowerCase();
        const uUser = user.username.trim().toLowerCase();
        const uName = (user.name || "").trim().toLowerCase();
        return (uUser && iu === uUser) || (uName && iu === uName);
      }),
    [items, user.username, user.name],
  );
  const mine = useDecryptedNotesReminders(mineRaw);

  const reminders = mine
    .filter((i) => i.type === "reminder")
    .sort((a, b) => toIso(a.duedate).localeCompare(toIso(b.duedate)));
  const upcomingReminders = reminders.filter((r) => (r.status || "Pending") !== "Done");
  const notes = mine
    .filter((i) => i.type === "note")
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));

  const [editing, setEditing] = useState<NoteReminder | null>(null);
  const [removing, setRemoving] = useState<NoteReminder | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const toggleDone = async (item: NoteReminder) => {
    try {
      await updateNoteReminder({
        sourceRow: item.sourcerow,
        username: user.username,
        fields: { status: (item.status || "Pending") === "Done" ? "Pending" : "Done" },
      });
      onRefresh();
    } catch {
      // silent — user can just retry the tap
    }
  };

  const runRemove = async () => {
    if (!removing) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      await removeNoteReminder({ sourceRow: removing.sourcerow, username: user.username });
      setRemoving(null);
      onRefresh();
    } catch (e) {
      setRemoveError((e as Error).message);
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Upcoming reminders</div>
        {upcomingReminders.length === 0 ? (
          <div className="py-3 text-center text-xs text-muted-foreground">Nothing upcoming.</div>
        ) : (
          <div className="divide-y divide-border">
            {upcomingReminders.map((r) => (
              <div key={r.sourcerow} className="flex items-center gap-2 py-2 text-xs">
                <button onClick={() => toggleDone(r)} className="text-accent hover:opacity-70" aria-label="Mark done">
                  <Circle className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{r.text}</div>
                  <div className="text-muted-foreground">
                    {r.duedate || "No date"}{r.duetime ? ` at ${r.duetime}` : ""}{r.category ? ` · ${r.category}` : ""}
                  </div>
                </div>
                <a
                  href={generateGoogleCalendarLink(r.text, r.duedate, r.duetime, r.category)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:opacity-70 flex items-center justify-center p-1"
                  title="Add to Google Calendar"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                </a>
                <button onClick={() => setEditing(r)} className="text-accent hover:opacity-70" aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setRemoving(r)} className="text-destructive hover:opacity-70" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</div>
        {notes.length === 0 ? (
          <div className="py-3 text-center text-xs text-muted-foreground">No notes yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((n) => (
              <div key={n.sourcerow} className="flex items-center gap-2 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{n.text}</div>
                  <div className="text-muted-foreground">
                    {n.timestamp ? new Date(n.timestamp).toLocaleDateString() : ""}{n.category ? ` · ${n.category}` : ""}
                  </div>
                </div>
                <button onClick={() => setEditing(n)} className="text-accent hover:opacity-70" aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setRemoving(n)} className="text-destructive hover:opacity-70" aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditNoteReminderDialog
          item={editing}
          user={user}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove this permanently?"
        message="This deletes it from the sheet entirely. This can't be undone."
        confirmLabel="Remove permanently"
        destructive
        loading={removeLoading}
        error={removeError}
        onConfirm={runRemove}
        onCancel={() => { setRemoving(null); setRemoveError(""); }}
      />
    </div>
  );
}