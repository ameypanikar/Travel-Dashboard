import { useEffect, useState } from "react";
import type { NoteReminder } from "@/lib/dashboard-api";
import { decryptField } from "@/lib/note-crypto";

export function useDecryptedNotesReminders(items: NoteReminder[]): NoteReminder[] {
  const [decrypted, setDecrypted] = useState<NoteReminder[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await Promise.all(
        items.map(async (item) => ({
          ...item,
          text: await decryptField(item.text),
          category: await decryptField(item.category),
        })),
      );
      if (!cancelled) setDecrypted(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  return decrypted;
}