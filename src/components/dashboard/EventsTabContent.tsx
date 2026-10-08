import { useState } from "react";
import { EventsList } from "./EventsList";
import { NotesRemindersView } from "./NotesRemindersView";
import type { TravelEvent, NoteReminder } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";

export function EventsTabContent({
  user,
  events,
  notesReminders,
  onRefresh,
}: {
  user: SessionUser;
  events: TravelEvent[];
  notesReminders: NoteReminder[];
  onRefresh: () => void;
}) {
  const [view, setView] = useState<"dashboard" | "notes">("dashboard");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setView("dashboard")}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            view === "dashboard" ? "bg-accent text-accent-foreground shadow-card" : "bg-card text-accent shadow-card hover:bg-accent-soft"
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setView("notes")}
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            view === "notes" ? "bg-accent text-accent-foreground shadow-card" : "bg-card text-accent shadow-card hover:bg-accent-soft"
          }`}
        >
          Notes & Reminders
        </button>
      </div>

      {view === "dashboard" ? (
        <EventsList events={events} onRefresh={onRefresh} />
      ) : (
        <NotesRemindersView user={user} items={notesReminders} onRefresh={onRefresh} />
      )}
    </div>
  );
}