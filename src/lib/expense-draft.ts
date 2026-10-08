/**
 * Expense Draft Management
 * 
 * Safely persists uncommitted expense form data to localStorage scoped by username.
 * Supports auto-restoration across tab changes, accidental swipes, browser reloads,
 * and app-switching on mobile devices.
 * 
 * Expiration: 24 hours (configurable TTL).
 */

export interface ExpenseDraftReceipt {
  name: string;
  type: string;
  dataUrl: string;
}

export interface ExpenseDraft {
  amount: string;
  currency: string;
  category: string;
  description: string;
  expenseDate: string;
  trip: string;
  paymentMethod: string;
  cardUsed: string;
  bankUsed?: string;
  fxRate: string;
  inrEquivalent: string;
  receipt: ExpenseDraftReceipt | null;
  savedAt: number;
}

const DRAFT_PREFIX = "expense_draft_";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getDraftStorageKey(username: string): string {
  const clean = (username || "default").trim().toLowerCase().replace(/\s+/g, "_");
  return `${DRAFT_PREFIX}${clean}`;
}

/**
 * Checks whether an unsubmitted draft exists for this user.
 */
export function hasExpenseDraft(username: string, maxAgeMs = DEFAULT_TTL_MS): boolean {
  return getExpenseDraft(username, maxAgeMs) !== null;
}

/**
 * Retrieves the stored draft if it exists and has not expired.
 */
export function getExpenseDraft(username: string, maxAgeMs = DEFAULT_TTL_MS): ExpenseDraft | null {
  if (typeof window === "undefined" || !username) return null;
  const key = getDraftStorageKey(username);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const draft = JSON.parse(raw) as ExpenseDraft;
    if (!draft || typeof draft.savedAt !== "number") {
      clearExpenseDraft(username);
      return null;
    }

    // Check expiration
    const age = Date.now() - draft.savedAt;
    if (age > maxAgeMs) {
      clearExpenseDraft(username);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn("[expense-draft] Failed to read draft:", err);
    return null;
  }
}

/**
 * Saves the draft to localStorage with quota-safety handling.
 */
export function saveExpenseDraft(username: string, draft: Omit<ExpenseDraft, "savedAt">): void {
  if (typeof window === "undefined" || !username) return;
  const key = getDraftStorageKey(username);
  const payload: ExpenseDraft = {
    ...draft,
    savedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    // If quota exceeded, attempt saving without the receipt image dataUrl
    if (payload.receipt) {
      try {
        const fallback: ExpenseDraft = {
          ...payload,
          receipt: null,
        };
        window.localStorage.setItem(key, JSON.stringify(fallback));
        console.warn("[expense-draft] Saved draft without receipt image due to storage quota limits");
      } catch (quotaErr) {
        console.error("[expense-draft] Failed to save draft:", quotaErr);
      }
    } else {
      console.error("[expense-draft] Failed to save draft:", err);
    }
  }
}

/**
 * Removes the draft for this user.
 */
export function clearExpenseDraft(username: string): void {
  if (typeof window === "undefined" || !username) return;
  const key = getDraftStorageKey(username);
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn("[expense-draft] Failed to clear draft:", err);
  }
}

/**
 * Converts a File into a base64 Data URL for persistent storage.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Reconstructs a File object from a base64 Data URL.
 */
export function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string): File {
  const parts = dataUrl.split(",");
  const base64Str = parts.length > 1 ? parts[1] : parts[0];
  const binaryStr = atob(base64Str);
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }
  return new File([u8arr], fileName, { type: mimeType || "image/jpeg" });
}

/**
 * Formats time elapsed since draft was saved (e.g. "just now", "5m ago", "2h ago").
 */
export function formatDraftAge(savedAt: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
