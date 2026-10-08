import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { updateNoteReminder } from "@/lib/dashboard-api";
import { decryptField } from "@/lib/note-crypto";
import type { NoteReminder } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function EditNoteReminderDialog({
  item,
  user,
  onClose,
  onSaved,
}: {
  item: NoteReminder;
  user: SessionUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"note" | "reminder">(item.type);
  const [text, setText] = useState("");
  const [duedate, setDuedate] = useState("");
  const [duetime, setDuetime] = useState(item.duetime || "");
  const [category, setCategory] = useState("");
  const [loadingFields, setLoadingFields] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // item.text/duedate/category arrive as ciphertext — decrypt them once when
  // the dialog opens, before the fields become usable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      const [t, c] = await Promise.all([
        decryptField(item.text),
        decryptField(item.category),
      ]);
      if (!cancelled) {
        setText(t);
        setDuedate(item.duedate || "");
        setCategory(c);
        setLoadingFields(false);
      }
    })();
    return () => { cancelled = true; };
  }, [item]);

  const handleSave = async () => {
    if (!text.trim()) {
      setError("Text can't be empty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // updateNoteReminder encrypts text/duedate/category/status internally —
      // we just pass plain values here, same as before.
      await updateNoteReminder({
        sourceRow: item.sourcerow,
        username: user.username,
        fields: { type, text: text.trim(), duedate, category, duetime },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-w-sm p-5">
        <div className="text-base font-bold">Edit {item.type === "reminder" ? "reminder" : "note"}</div>

        <div className="mt-3 space-y-2.5 text-xs">
          <div className="flex gap-1">
            {(["note", "reminder"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                disabled={loadingFields}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50",
                  type === t ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent-soft",
                )}
              >
                {t === "note" ? "📝 Note" : "⏰ Reminder"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              disabled={loadingFields}
              placeholder={loadingFields ? "Decrypting…" : ""}
              className="w-full rounded border bg-background px-2 py-1.5 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Due date</label>
              <input
                value={duedate}
                onChange={(e) => setDuedate(e.target.value)}
                placeholder={loadingFields ? "Decrypting…" : "DD/MM/YYYY"}
                disabled={loadingFields}
                className="w-full rounded border bg-background px-2 py-1.5 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Time</label>
              <input value={duetime} onChange={(e) => setDuetime(e.target.value)} placeholder="HH:MM" className="w-full rounded border bg-background px-2 py-1.5" />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={loadingFields ? "Decrypting…" : ""}
                disabled={loadingFields}
                className="w-full rounded border bg-background px-2 py-1.5 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft disabled:opacity-60">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loadingFields}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}