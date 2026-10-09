import { useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchGeminiKey, fetchGeminiModel, addNoteReminder } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";

type ItemType = "note" | "reminder";
type DraftItem = { type: ItemType; text: string; duedate: string; duetime: string; category: string };

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayDdMmYyyy(): string {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const buildPrompt = (today: string) =>
  `Today's date is ${today} (DD/MM/YYYY). The user has spoken or typed a short note, which may describe something that already happened, something upcoming, or both. Extract it into a JSON array of items, with no markdown or backticks, just raw JSON. Each item must have keys: type ("note" or "reminder"), text (a clean, concise rewrite of what was said), duedate (DD/MM/YYYY if the item refers to a specific date — resolve relative dates like "Friday", "next Monday", "tomorrow" against today's date given above; empty string if no date is mentioned or the date is in the past), duetime (HH:MM in 24-hour time, if a specific time was mentioned, e.g. "11am" -> "11:00", "3:30pm" -> "15:30"; empty string if no time was mentioned), category (a short 1-2 word tag such as "Meeting", "Work", "Personal", "Follow-up", empty string if unclear), relatedpeople (names mentioned, comma-separated, empty string if none). Classification rule: if the item has a duedate that is today or in the future, mark it as type "reminder" even if the user didn't explicitly ask to be reminded — a mentioned future date is enough on its own. If the item describes something in the past, or has no date at all, mark it as type "note". A single utterance can produce multiple items (e.g. one note about something that already happened, and a separate reminder about something upcoming) — return all of them as separate array entries.`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function AddNoteReminderModal({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reset = useCallback(() => {
    setItems(null);
    setError("");
    setStatus("");
    setTextInput("");
    setLoading(false);
  }, []);

  const getApiKey = () => localStorage.getItem("gemini_api_key") || "";

  const parseWithGemini = async (
    content: { inline_data?: { mime_type: string; data: string }; text?: string }[],
  ) => {
    let key = getApiKey();
    if (!key) {
      try { key = await fetchGeminiKey(); } catch { /* fall through to error below */ }
    }
    if (!key) throw new Error("Could not load the shared Gemini API key. Ask your System Manager to set it in Settings.");
    const model = await fetchGeminiModel();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: content }] }),
      },
    );
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
      const parsed = JSON.parse(cleaned);
      return (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
    } catch {
      throw new Error(`Failed to parse response: ${cleaned.slice(0, 200)}`);
    }
  };

  const handleParsed = (raw: Record<string, unknown>[]) => {
    setItems(
      raw.map((r) => ({
        type: r.type === "reminder" ? "reminder" : "note",
        text: String(r.text ?? ""),
        duedate: String(r.duedate ?? ""),
        duetime: String(r.duetime ?? ""),
        category: String(r.category ?? ""),
      })),
    );
  };

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setLoading(true);
        setStatus("Transcribing & understanding…");
        try {
          const base64 = await blobToBase64(blob);
          const raw = await parseWithGemini([
            { inline_data: { mime_type: "audio/webm", data: base64 } },
            { text: buildPrompt(todayDdMmYyyy()) },
          ]);
          handleParsed(raw);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
          setStatus("");
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Couldn't access microphone. Check browser permissions, or type instead.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleParseText = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setStatus("Understanding…");
    setError("");
    try {
      const raw = await parseWithGemini([
        { text: `${buildPrompt(todayDdMmYyyy())}\n\nUser's note: "${textInput.trim()}"` },
      ]);
      handleParsed(raw);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    if (!items) return;
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch };
    setItems(next);
  };

  const removeItem = (idx: number) => {
    if (!items) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const addBlankItem = () => {
    setItems((prev) => [...(prev ?? []), { type: "note", text: "", duedate: "", duetime: "", category: "" }]);
  };

  const handleSave = async () => {
    if (!items || items.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const item of items) {
        if (!item.text.trim()) continue;
        await addNoteReminder({
          username: user.username,
          name: user.name,
          type: item.type,
          text: item.text.trim(),
          duedate: item.duedate,
          duetime: item.duetime,
          category: item.category,
        });
      }
      toast.success("✅ Saved");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(openState: boolean) => { onOpenChange(openState); if (!openState) reset(); }}>
      <DialogContent className="max-w-lg p-0">
        <div className="border-b p-4 text-base font-bold">Add Note / Reminder</div>
        <div className="space-y-4 p-4">
          {!items && (
            <>
              <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center">
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={loading}
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full transition",
                    recording ? "animate-pulse bg-destructive text-white" : "bg-accent text-accent-foreground",
                  )}
                >
                  {recording ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
                </button>
                <div className="text-xs text-muted-foreground">
                  {recording ? "Recording… tap to stop" : "Tap to record a voice note"}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> or type <div className="h-px flex-1 bg-border" />
              </div>

              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder='e.g. "Had a meeting with Shubham, follow up with him on Friday"'
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleParseText}
                  disabled={loading || !textInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Understand
                </button>
              </div>
            </>
          )}

          {loading && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{status || "Working…"}</span>
            </div>
          )}

          {error && (
            error.includes("SYSTEM UPDATE REQUIRED") ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 py-3 overflow-hidden flex whitespace-nowrap relative w-full">
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
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )
          )}

          {items && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview & edit</div>
                <button onClick={addBlankItem} className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline">
                  <Plus className="h-3 w-3" /> Add item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex gap-1">
                      {(["note", "reminder"] as ItemType[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateItem(idx, { type: t })}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                            item.type === t ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:bg-accent-soft",
                          )}
                        >
                          {t === "note" ? "📝 Note" : "⏰ Reminder"}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeItem(idx)} className="text-destructive hover:opacity-70">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={item.text}
                    onChange={(e) => updateItem(idx, { text: e.target.value })}
                    rows={2}
                    className="mb-2 w-full rounded border bg-background px-2 py-1.5 text-xs"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">
                        Due date {item.type === "note" && "(optional)"}
                      </label>
                      <input
                        value={item.duedate}
                        onChange={(e) => updateItem(idx, { duedate: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Time</label>
                      <input
                        value={item.duetime}
                        onChange={(e) => updateItem(idx, { duetime: e.target.value })}
                        placeholder="HH:MM"
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Category</label>
                      <input
                        value={item.category}
                        onChange={(e) => updateItem(idx, { category: e.target.value })}
                        className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button onClick={reset} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft">
                  Start over
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save all"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}