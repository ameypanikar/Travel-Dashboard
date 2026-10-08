import { useState } from "react";
import { Plus, X, Ticket, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddBookingButton } from "./AddBookingButton";
import { AddNoteReminderModal } from "./AddNoteReminderModal.tsx";
import type { TravelEvent } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";

type UserEntry = { name: string; username: string; role: string };

export function AddButtonMenu({
  user,
  users,
  events,
  uberSuggestions,
  onRefresh,
}: {
  user: SessionUser;
  users: UserEntry[];
  events: TravelEvent[];
  uberSuggestions: { label: string; address: string }[];
  onRefresh: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-6 right-5 z-40 flex flex-col items-end gap-2.5">
        {menuOpen && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => { setNoteOpen(true); setMenuOpen(false); }}
              className="animate-fade-in-up stagger-1 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-bold text-accent shadow-card transition-all hover:bg-accent-soft hover:shadow-lg hover:-translate-y-0.5"
            >
              <NotebookPen className="h-4 w-4" /> Add Note/Reminder
            </button>
            <button
              onClick={() => { setBookingOpen(true); setMenuOpen(false); }}
              className="animate-fade-in-up stagger-2 inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-bold text-accent shadow-card transition-all hover:bg-accent-soft hover:shadow-lg hover:-translate-y-0.5"
            >
              <Ticket className="h-4 w-4" /> Add Booking
            </button>
          </div>
        )}

        <button
          onClick={() => { navigator.vibrate?.(30); setMenuOpen((v) => !v); }}
          className={cn(
            "fab-shadow inline-flex h-14 w-14 items-center justify-center rounded-full text-white transition-all duration-300",
            menuOpen ? "rotate-45 scale-95" : "scale-100 hover:scale-105",
          )}
          style={{
            background: "linear-gradient(135deg, oklch(0.46 0.19 264) 0%, oklch(0.52 0.20 240) 100%)",
          }}
          aria-label="Add"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

      <AddBookingButton
        users={users}
        events={events}
        uberSuggestions={uberSuggestions}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        hideTrigger
      />
      <AddNoteReminderModal
        user={user}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        onSaved={onRefresh}
      />
    </>
  );
}