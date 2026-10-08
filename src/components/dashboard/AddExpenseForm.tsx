import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  Trash2,
  Receipt,
  Sparkles,
  Users,
  ChevronDown,
  Pencil,
  Paperclip,
  Images,
  CheckCircle2,
  XCircle,
  X,
  Clock,
  RotateCcw,
} from "lucide-react";
import {
  addExpense,
  removeExpense,
  fetchFxRate,
  fetchGeminiKey,
  fetchGeminiModel,
} from "@/lib/dashboard-api";
import type { Expense, TravelEvent } from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import {
  FULL_ACCESS_ROLES,
  canonicalizePersonName,
  deduplicateAssignees,
  isPersonMatch,
} from "@/lib/role-filter";
import { PersonFilterBar } from "./PersonFilterBar";
import { toast } from "sonner";
import { EditExpenseDialog } from "./EditExpenseDialog";
import { ReceiptViewerDialog } from "./ReceiptViewerDialog";
import { ExpenseUploadModal, type UploadModalState } from "./ExpenseUploadModal";
import { autoCropReceipt } from "@/lib/receipt-crop";
import {
  GENERAL_TRAVEL,
  CATEGORIES,
  PAYMENT_METHODS,
  CARDS,
  BANKS,
  toIsoDate,
  suggestTrip,
  parseAmount,
  formatInr,
  matchCategory,
  isActiveTrip,
  sortTripOptions,
} from "@/lib/expense-utils";
import {
  getExpenseDraft,
  saveExpenseDraft,
  clearExpenseDraft,
  dataUrlToFile,
  fileToDataUrl,
  formatDraftAge,
  type ExpenseDraftReceipt,
} from "@/lib/expense-draft";
import { autoRouteTransportTicket } from "@/lib/auto-router";
import type { BookableKind } from "@/lib/booking-prompts";

const RECEIPT_PROMPT =
  "Extract expense details from this receipt/bill image or PDF and return ONLY a raw JSON object with no markdown, no backticks, just the JSON. Keys:\n" +
  "- amount (numeric only)\n" +
  "- currency (ISO 4217)\n" +
  "- vendor\n" +
  "- date (DD/MM/YYYY)\n" +
  "- category (must be exactly one of: 'Food', 'Transport (Auto/Taxi)', 'Petrol/Diesel', 'Toll', 'Misc. Expenses')\n" +
  "- document_type (must be exactly one of: 'expense_receipt', 'flight_ticket', 'bus_ticket', 'train_ticket')\n" +
  "- confidence_score (number 0-100 indicating how sure you are of the document_type)\n" +
  "Use empty string for missing fields.";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseGeminiDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    } else if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
  }
  return new Date().toISOString().split("T")[0];
}

type ExtractedReceiptFields = {
  amount?: string;
  currency?: string;
  vendor?: string;
  date?: string;
  category?: string;
  document_type?: string;
  confidence_score?: number;
};

// Shared Gemini extraction call, used by both the single-receipt flow (which
// then lets the person review/edit every field before saving) and the batch
// flow (which saves directly, since reviewing N receipts one by one is the
// exact tedium this feature exists to avoid). Retries once on a 429 the same
// way AddBookingButton's flight/hotel extraction does, since batch runs are
// more likely to hit Gemini's free-tier rate limit back-to-back.
async function extractReceiptFieldsWithRetry(
  file: File,
  key: string,
  model: string,
  onStatus?: (s: string) => void,
): Promise<ExtractedReceiptFields> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let mimeType = "application/pdf";
  if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
  else if (ext === "png") mimeType = "image/png";
  else if (ext === "webp") mimeType = "image/webp";

  const base64 = await fileToBase64(file);

  let attempt = 0;
  while (attempt < 2) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: RECEIPT_PROMPT },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );

    if (res.status === 429) {
      attempt++;
      if (attempt >= 2)
        throw new Error("Rate limited by Gemini — try this receipt again in a bit.");
      onStatus?.("Rate limited — waiting…");
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Gemini error ${res.status}: ${t}`);
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    try {
      return JSON.parse(text) as ExtractedReceiptFields;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as ExtractedReceiptFields;
      }
      throw new Error(`Couldn't read this receipt: ${text.slice(0, 120)}`);
    }
  }
  throw new Error("Failed after retry.");
}

type BatchResult = {
  name: string;
  status: "pending" | "processing" | "done" | "error";
  message?: string;
};

export function AddExpenseForm({
  user,
  expenses,
  events,
  onRefresh,
  users = [],
}: {
  user: SessionUser;
  expenses: Expense[];
  events: TravelEvent[];
  onRefresh: () => void;
  users?: { name: string; username: string; role: string }[];
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [trip, setTrip] = useState(() => suggestTrip(events));
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  // Which card was used — only relevant/shown when paymentMethod === "Card".
  const [cardUsed, setCardUsed] = useState(CARDS[0]);
  const [bankUsed, setBankUsed] = useState(BANKS[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const [fxRate, setFxRate] = useState("");
  const [inrEquivalent, setInrEquivalent] = useState("");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [removingRow, setRemovingRow] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [extracted, setExtracted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [uploadModal, setUploadModal] = useState<UploadModalState>({
    isOpen: false,
    status: "processing",
  });

  // ── Form Draft Persistence ──────────────────────────────────────────────
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [isRestoredDraft, setIsRestoredDraft] = useState(false);
  const isInitialLoad = useRef(true);

  // Load draft from localStorage on initial mount
  useEffect(() => {
    const draft = getExpenseDraft(user.username);
    if (draft) {
      if (draft.amount) setAmount(draft.amount);
      if (draft.currency) setCurrency(draft.currency);
      if (draft.category) setCategory(draft.category);
      if (draft.description) setDescription(draft.description);
      if (draft.expenseDate) setExpenseDate(draft.expenseDate);
      if (draft.trip) setTrip(draft.trip);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (draft.cardUsed) setCardUsed(draft.cardUsed);
      if (draft.bankUsed) setBankUsed(draft.bankUsed);
      if (draft.fxRate) setFxRate(draft.fxRate);
      if (draft.inrEquivalent) setInrEquivalent(draft.inrEquivalent);

      if (draft.receipt) {
        try {
          const file = dataUrlToFile(draft.receipt.dataUrl, draft.receipt.name, draft.receipt.type);
          setReceiptFile(file);
          setExtracted(true);
        } catch (e) {
          console.warn("[AddExpenseForm] Could not restore receipt file:", e);
        }
      }

      setDraftSavedAt(draft.savedAt);
      setIsRestoredDraft(true);
    }
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 150);
    return () => clearTimeout(timer);
  }, [user.username]);

  // Auto-save draft on any change (debounced 400ms)
  useEffect(() => {
    if (isInitialLoad.current) return;

    const hasContent = Boolean(
      amount.trim() ||
      description.trim() ||
      receiptFile ||
      fxRate.trim() ||
      category !== CATEGORIES[0] ||
      paymentMethod !== PAYMENT_METHODS[0],
    );

    if (!hasContent) {
      clearExpenseDraft(user.username);
      setDraftSavedAt(null);
      setIsRestoredDraft(false);
      return;
    }

    const timer = setTimeout(async () => {
      let receiptPayload: ExpenseDraftReceipt | null = null;
      if (receiptFile) {
        try {
          const dataUrl = await fileToDataUrl(receiptFile);
          receiptPayload = {
            name: receiptFile.name,
            type: receiptFile.type,
            dataUrl,
          };
        } catch (e) {
          console.warn("[AddExpenseForm] Could not encode receipt file:", e);
        }
      }

      saveExpenseDraft(user.username, {
        amount,
        currency,
        category,
        description,
        expenseDate,
        trip,
        paymentMethod,
        cardUsed,
        bankUsed,
        fxRate,
        inrEquivalent,
        receipt: receiptPayload,
      });
      setDraftSavedAt(Date.now());
    }, 400);

    return () => clearTimeout(timer);
  }, [
    user.username,
    amount,
    currency,
    category,
    description,
    expenseDate,
    trip,
    paymentMethod,
    cardUsed,
    fxRate,
    inrEquivalent,
    receiptFile,
    bankUsed,
  ]);

  // ── Batch upload: multiple receipts selected at once, each becomes its own
  // expense entry (auto-extracted), sharing whichever Trip/Payment method are
  // currently selected in the single-expense form above. ────────────────────
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  const canFilterOthers = FULL_ACCESS_ROLES.includes((user.role || "").trim().toLowerCase());
  const [personFilter, setPersonFilter] = useState<string>("");
  const [personFilterOpen, setPersonFilterOpen] = useState(false);

  // Required trip filter — everyone (User or full-access) must pick a trip
  // before any list/total shows, so the view stays scoped instead of
  // dumping every expense ever logged (which won't scale as history grows).
  const [tripFilter, setTripFilter] = useState("");
  const [tripFilterOpen, setTripFilterOpen] = useState(false);

  const deduplicatedPeople = useMemo(() => {
    const rawNames = expenses.map((e) => (e.username || e.name || "").trim()).filter(Boolean);
    return deduplicateAssignees(rawNames, users);
  }, [expenses, users]);

  const viewingUsername = personFilter || user.username;
  const isViewingSelf =
    !personFilter ||
    personFilter === "me" ||
    isPersonMatch(user.username, viewingUsername, users) ||
    isPersonMatch(user.name, viewingUsername, users);
  const viewingPersonCanonical = isViewingSelf
    ? "me"
    : canonicalizePersonName(viewingUsername, users);
  const listHeading = isViewingSelf ? "My expenses" : `${viewingPersonCanonical}'s expenses`;

  const tripOptions = sortTripOptions(
    Array.from(
      new Set([
        GENERAL_TRAVEL,
        ...events
          .filter((e) => isActiveTrip(e))
          .map((e) => (e.eventname || "").trim())
          .filter(Boolean),
        trip,
      ]),
    ),
    events,
  );

  const isForeign = currency.trim().toUpperCase() !== "INR";
  const isCard = paymentMethod === "Card";
  const isCash = paymentMethod === "Cash";

  // Base = everything for whoever is being viewed (self, or another person
  // if a full-access role picked one). Trip filter narrows it further.
  const baseExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const ePerson = e.username || e.name || "";
      if (isViewingSelf) {
        return (
          isPersonMatch(ePerson, user.username, users) || isPersonMatch(ePerson, user.name, users)
        );
      }
      return isPersonMatch(ePerson, viewingUsername, users);
    });
  }, [expenses, isViewingSelf, user, viewingUsername, users]);

  const myTripOptions = useMemo(
    () =>
      Array.from(
        new Set(baseExpenses.map((e) => (e.trip || GENERAL_TRAVEL).trim() || GENERAL_TRAVEL)),
      ).sort(),
    [baseExpenses],
  );

  const displayedExpenses = useMemo(
    () =>
      baseExpenses
        .filter((e) => (e.trip || GENERAL_TRAVEL).trim() === tripFilter)
        .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")),
    [baseExpenses, tripFilter],
  );

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of displayedExpenses) {
      const cur = (e.currency || "INR").trim().toUpperCase();
      const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
      if (Number.isNaN(n)) continue;
      map.set(e.category, (map.get(e.category) || 0) + n);
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [displayedExpenses]);

  const grandTotal = categoryBreakdown.reduce((sum, c) => sum + c.total, 0);

  const applyFx = async (cur: string, amountStr: string, dateDdMmYyyy?: string) => {
    const iso = toIsoDate(dateDdMmYyyy) || new Date().toISOString().slice(0, 10);
    const fx = await fetchFxRate(iso, cur);
    if (!fx) return;
    setFxRate(fx.rate.toFixed(4));
    const amountNum = parseAmount(amountStr);
    if (!Number.isNaN(amountNum)) setInrEquivalent((amountNum * fx.rate).toFixed(2));
  };

  const handleResolveFx = useCallback(async () => {
    const cur = currency.trim().toUpperCase();
    if (!cur || cur === "INR") return;
    setResolving(true);
    setError("");
    try {
      const fx = await fetchFxRate(expenseDate || new Date().toISOString().split("T")[0], cur);
      if (!fx) {
        setError("Couldn't resolve today's rate — enter it manually below.");
        return;
      }
      setFxRate(fx.rate.toFixed(4));
      const amountNum = parseAmount(amount);
      if (!Number.isNaN(amountNum)) setInrEquivalent((amountNum * fx.rate).toFixed(2));
    } finally {
      setResolving(false);
    }
  }, [currency, expenseDate, amount]);

  useEffect(() => {
    const cur = currency.trim().toUpperCase();
    if (cur && cur !== "INR" && amount) {
      const timer = setTimeout(() => {
        handleResolveFx();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currency, amount, expenseDate, handleResolveFx]);

  const handleExtractReceipt = async (fileOverride?: File) => {
    const file = fileOverride ?? receiptFile;
    if (!file) return;
    setExtracting(true);
    setExtractError("");
    try {
      let key = localStorage.getItem("gemini_api_key") || "";
      if (!key) {
        try {
          key = await fetchGeminiKey();
        } catch {
          /* fall through to error below */
        }
      }
      if (!key) {
        setExtractError(
          "Could not load the shared Gemini API key. Ask your System Manager to set it in Settings.",
        );
        return;
      }
      const model = await fetchGeminiModel();
      const parsed = await extractReceiptFieldsWithRetry(file, key, model);

      if (
        parsed.confidence_score === 100 &&
        parsed.document_type &&
        ["flight_ticket", "bus_ticket", "train_ticket"].includes(parsed.document_type)
      ) {
        const kindMap: Record<string, BookableKind> = {
          flight_ticket: "flight",
          bus_ticket: "bus",
          train_ticket: "train",
        };
        const ticketKind = kindMap[parsed.document_type] as BookableKind;

        toast.info(`100% Match: Identified as a ${ticketKind} ticket. Opening in Transport view for review...`);

        try {
          window.dispatchEvent(
            new CustomEvent("open-add-booking", {
              detail: { file, kind: ticketKind },
            })
          );
          setReceiptFile(null);
          setExtracted(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setExtracting(false);
          return;
        } catch (routeErr) {
          toast.error(
            `Failed to open Transport view: ${(routeErr as Error).message}. Falling back to expense.`,
          );
        }
      }

      if (parsed.amount) setAmount(String(parsed.amount));
      const cur = (parsed.currency || "").trim().toUpperCase();
      if (cur) setCurrency(cur);
      setCategory(matchCategory(parsed.category));
      setDescription((prev) => (prev.trim() ? prev : parsed.vendor || prev));
      if (parsed.date) setExpenseDate(parseGeminiDate(parsed.date));

      if (cur && cur !== "INR" && parsed.amount) {
        await applyFx(cur, parsed.amount, parsed.date);
      }

      setExtracted(true);
      toast.success("Receipt read — check the fields below and adjust if needed");
    } catch (e) {
      setExtractError(
        (e as Error).message ||
          "Couldn't read the receipt automatically. Fill the fields in manually.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const handleFileSelected = async (file: File | null) => {
    setExtractError("");
    setExtracted(false);
    if (!file) {
      setReceiptFile(null);
      return;
    }
    setCropping(true);
    const cropped = await autoCropReceipt(file);
    setCropping(false);
    setReceiptFile(cropped);
    handleExtractReceipt(cropped);
  };

  // ── Batch upload handlers ──────────────────────────────────────────────
  const handleBatchFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBatchFiles(files);
    setBatchResults(files.map((f) => ({ name: f.name, status: "pending" })));
  };

  const clearBatch = () => {
    setBatchFiles([]);
    setBatchResults([]);
    if (batchFileInputRef.current) batchFileInputRef.current.value = "";
  };

  const processBatch = async () => {
    if (batchFiles.length === 0) return;
    setBatchProcessing(true);
    setUploadModal({
      isOpen: true,
      status: "processing",
      title: "Please wait, uploading...",
      message: `Processing ${batchFiles.length} receipt${batchFiles.length === 1 ? "" : "s"}...`,
      stepDetail: "Connecting to Gemini AI…",
      batchCurrent: 1,
      batchTotal: batchFiles.length,
    });

    let key = localStorage.getItem("gemini_api_key") || "";
    if (!key) {
      try {
        key = await fetchGeminiKey();
      } catch {
        /* handled below */
      }
    }
    if (!key) {
      toast.error(
        "Could not load the shared Gemini API key. Ask your System Manager to set it in Settings.",
      );
      setBatchProcessing(false);
      setUploadModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    const model = await fetchGeminiModel();

    let succeeded = 0;
    for (let i = 0; i < batchFiles.length; i++) {
      const file = batchFiles[i];
      setUploadModal((prev) => ({
        ...prev,
        batchCurrent: i + 1,
        message: `Processing receipt ${i + 1} of ${batchFiles.length}...`,
        stepDetail: `Auto-cropping ${file.name}…`,
      }));
      setBatchResults((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "processing" } : r)),
      );

      try {
        const cropped = await autoCropReceipt(file, (msg) => {
          setUploadModal((prev) => ({
            ...prev,
            stepDetail: `[${i + 1}/${batchFiles.length}] ${msg}`,
          }));
        });

        setUploadModal((prev) => ({
          ...prev,
          stepDetail: `[${i + 1}/${batchFiles.length}] Extracting details…`,
        }));

        const parsed = await extractReceiptFieldsWithRetry(cropped, key, model, (s) => {
          setBatchResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, message: s } : r)));
          setUploadModal((prev) => ({
            ...prev,
            stepDetail: `[${i + 1}/${batchFiles.length}] ${s}`,
          }));
        });

        if (
          parsed.confidence_score === 100 &&
          parsed.document_type &&
          ["flight_ticket", "bus_ticket", "train_ticket"].includes(parsed.document_type)
        ) {
          const kindMap: Record<string, BookableKind> = {
            flight_ticket: "flight",
            bus_ticket: "bus",
            train_ticket: "train",
          };
          const ticketKind = kindMap[parsed.document_type] as BookableKind;

          setUploadModal((prev) => ({
            ...prev,
            stepDetail: `[${i + 1}/${batchFiles.length}] Identified as ${ticketKind}, routing to Transport…`,
          }));

          await autoRouteTransportTicket(cropped, ticketKind, users, events, (s) => {
            setUploadModal((prev) => ({
              ...prev,
              stepDetail: `[${i + 1}/${batchFiles.length}] ${s}`,
            }));
          }, trip);

          succeeded++;
          setBatchResults((prev) =>
            prev.map((r, idx) =>
              idx === i ? { ...r, status: "done", message: `Auto-routed to ${ticketKind}` } : r,
            ),
          );
          continue;
        }

        if (!parsed.amount) {
          throw new Error("No amount found on this receipt — add it manually instead.");
        }

        const cur = (parsed.currency || "INR").trim().toUpperCase();
        let itemFxRate = "";
        let itemInrEquivalent = "";
        const itemExpenseDate = parseGeminiDate(parsed.date || "");

        if (cur && cur !== "INR") {
          const fx = await fetchFxRate(itemExpenseDate, cur);
          if (fx) {
            itemFxRate = fx.rate.toFixed(4);
            const amountNum = parseAmount(parsed.amount);
            if (!Number.isNaN(amountNum)) itemInrEquivalent = (amountNum * fx.rate).toFixed(2);
          }
        }

        setUploadModal((prev) => ({
          ...prev,
          stepDetail: `[${i + 1}/${batchFiles.length}] Uploading receipt to cloud storage…`,
        }));

        await addExpense({
          username: user.username,
          name: user.name,
          trip,
          category: matchCategory(parsed.category),
          amount: String(parsed.amount),
          currency: cur || "INR",
          description: parsed.vendor || "",
          fxRate: itemFxRate,
          inrEquivalent: itemInrEquivalent,
          paymentMethod,
          cardUsed: isCard ? cardUsed : isCash ? bankUsed : "",
          expenseDate: itemExpenseDate,
          file: cropped,
        });

        succeeded++;
        setBatchResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "done", message: undefined } : r)),
        );
      } catch (e) {
        setBatchResults((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", message: (e as Error).message } : r,
          ),
        );
      }
    }

    setBatchProcessing(false);
    if (succeeded > 0) {
      setUploadModal({
        isOpen: true,
        status: "success",
        title: "Uploaded Successfully!",
        successDetails: {
          count: succeeded,
          trip,
        },
      });
      // Clear batch so the "Add N expenses" box disappears immediately!
      clearBatch();
      toast.success(
        `✅ ${succeeded} of ${batchFiles.length} receipt${batchFiles.length === 1 ? "" : "s"} added`,
      );
      onRefresh();
    } else {
      setUploadModal((prev) => ({ ...prev, isOpen: false }));
      toast.error("None of the receipts could be added — see the errors below.");
    }
  };

  const reset = () => {
    setAmount("");
    setCurrency("INR");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setCategory(CATEGORIES[0]);
    setDescription("");
    setTrip(suggestTrip(events));
    setPaymentMethod(PAYMENT_METHODS[0]);
    setCardUsed(CARDS[0]);
    setBankUsed(BANKS[0]);
    setReceiptFile(null);
    setFxRate("");
    setInrEquivalent("");
    setError("");
    setExtractError("");
    setExtracted(false);
    setIsRestoredDraft(false);
    setDraftSavedAt(null);
    clearExpenseDraft(user.username);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDiscardDraft = () => {
    reset();
    toast.info("Draft discarded");
  };

  const handleSubmit = async () => {
    if (!amount.trim()) {
      setError("Enter an amount.");
      return;
    }

    const matchingEvent = events.find((e) => e.eventname === trip);
    if (matchingEvent?.type === "Standing Tour") {
      if (
        !window.confirm(
          "You are logging this against a long-running Standing Tour instead of a specific trip. Are you sure you want to proceed?",
        )
      ) {
        return;
      }
    }

    setSaving(true);
    setError("");
    setUploadModal({
      isOpen: true,
      status: "processing",
      title: "Please wait, uploading...",
      message: receiptFile ? "Uploading receipt & recording expense…" : "Recording expense…",
      stepDetail: "Syncing with cloud database…",
    });

    try {
      await addExpense({
        username: user.username,
        name: user.name,
        trip,
        category,
        amount,
        currency,
        description,
        fxRate,
        inrEquivalent,
        paymentMethod,
        cardUsed: isCard ? cardUsed : isCash ? bankUsed : "",
        expenseDate,
        file: receiptFile,
      });
      setUploadModal({
        isOpen: true,
        status: "success",
        title: "Expense Added Successfully!",
        successDetails: {
          amount,
          currency,
          category,
          trip,
          description,
        },
      });
      toast.success("✅ Expense added");
      clearExpenseDraft(user.username);
      reset();
      onRefresh();
    } catch (e) {
      setUploadModal((prev) => ({ ...prev, isOpen: false }));
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row: number) => {
    if (
      !window.confirm(
        t(
          "add_expense.confirm_delete",
          "Are you sure you want to delete this expense? This action cannot be undone.",
        ),
      )
    ) {
      return;
    }
    setRemovingRow(row);
    try {
      await removeExpense({ sourceRow: row, username: user.username });
      toast.success("Removed");
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRemovingRow(null);
    }
  };

  return (
    <div data-no-swipe="true" className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold">{t("add_expense.title")}</div>
        </div>

        {isRestoredDraft && draftSavedAt && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-accent-soft border border-accent/20 px-3 py-2 text-xs text-accent">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Draft restored ({formatDraftAge(draftSavedAt)})</span>
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline ml-2"
            >
              <RotateCcw className="h-3 w-3" /> Discard
            </button>
          </div>
        )}

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("add_expense.receipt")}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />

            {!receiptFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={cropping}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-4 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {cropping ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {cropping ? (
                  <span>{t("add_expense.cropping")}</span>
                ) : (
                  <span>{t("add_expense.attach_receipt")}</span>
                )}
              </button>
            ) : (
              <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg bg-accent-soft px-3 py-2 text-[11px]">
                <span className="flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-accent">
                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{receiptFile.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFile(null);
                    setExtracted(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="shrink-0 ml-2 font-medium text-destructive hover:underline"
                >
                  {t("add_expense.remove")}
                </button>
              </div>
            )}

            {receiptFile && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={() => handleExtractReceipt()}
                  disabled={extracting}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  {extracting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {extracting ? (
                    <span>{t("add_expense.reading")}</span>
                  ) : extracted ? (
                    <span>{t("add_expense.re_read_receipt")}</span>
                  ) : (
                    <span>{t("add_expense.read_receipt")}</span>
                  )}
                </button>
              </div>
            )}

            {extractError && (
              <div className="mt-2 rounded border border-destructive/20 bg-destructive/5 p-2 text-[11px] text-destructive">
                {extractError}
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              {t("add_expense.receipt_desc")}
            </p>
          </div>

          {/* Batch upload — pick several receipts at once; each becomes its own
              expense entry, sharing the Trip and Payment method selected below. */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("add_expense.several_receipts")}
              </div>
              {batchFiles.length > 0 && !batchProcessing && (
                <button
                  onClick={clearBatch}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-destructive"
                >
                  {t("add_expense.clear")}
                </button>
              )}
            </div>

            <input
              ref={batchFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={(e) => handleBatchFilesSelected(e.target.files)}
            />

            {batchFiles.length === 0 ? (
              <button
                type="button"
                onClick={() => batchFileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-4 text-xs font-semibold text-muted-foreground transition hover:border-accent hover:text-accent"
              >
                <Images className="h-4 w-4" />
                {t("add_expense.select_multiple")}
              </button>
            ) : (
              <>
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {batchResults.map((r, i) => (
                    <div
                      key={`${r.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {r.status === "pending" && (
                          <span className="text-muted-foreground">{t("add_expense.waiting")}</span>
                        )}
                        {r.status === "processing" && (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                            <span className="text-accent">
                              {r.message || t("add_expense.reading")}
                            </span>
                          </>
                        )}
                        {r.status === "done" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        )}
                        {r.status === "error" && (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {batchResults.some((r) => r.status === "error") && (
                  <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
                    {batchResults
                      .filter((r) => r.status === "error")
                      .map((r, i) => (
                        <div
                          key={`err-${i}`}
                          className="rounded border border-destructive/20 bg-destructive/5 p-2 text-[10px] text-destructive"
                        >
                          <span className="font-semibold">{r.name}:</span> {r.message}
                        </div>
                      ))}
                  </div>
                )}

                <p className="mt-2 text-[10px] text-muted-foreground">
                  {t("add_expense.batch_desc")}
                </p>

                <div className="mt-2 flex justify-end">
                  <button
                    onClick={processBatch}
                    disabled={batchProcessing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60"
                  >
                    {batchProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {batchProcessing ? (
                      <span>{`${batchResults.filter((r) => r.status === "done" || r.status === "error").length}/${batchFiles.length}…`}</span>
                    ) : (
                      <span>
                        {t(
                          `add_expense.add_n_expenses${batchFiles.length === 1 ? "" : "_plural"}`,
                          { count: batchFiles.length },
                        )}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {t("add_expense.amount")}
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                className="w-full rounded border bg-background px-2 py-1.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {t("add_expense.currency")}
              </label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="w-full rounded border bg-background px-2 py-1.5 uppercase"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5 text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {t("add_expense.category")}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {t("add_expense.payment_method")}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card picker — only appears once "Card" is chosen above. Shared by
              both the single-expense form and the batch-upload flow, since
              both submit using this same paymentMethod/cardUsed state. */}
          {isCard && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">
                {t("add_expense.which_card")}
              </label>
              <select
                value={cardUsed}
                onChange={(e) => setCardUsed(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5"
              >
                {CARDS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isCash && (
            <div>
              <label className="mb-1 block font-semibold text-muted-foreground">Which bank?</label>
              <select
                value={bankUsed}
                onChange={(e) => setBankUsed(e.target.value)}
                className="w-full rounded border bg-background px-2 py-1.5"
              >
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              {t("add_expense.trip")}
            </label>
            <select
              value={trip}
              onChange={(e) => setTrip(e.target.value)}
              className="w-full rounded border bg-background px-2 py-1.5"
            >
              {tripOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-muted-foreground">
              {t("add_expense.description")}
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner with client"
              className="w-full rounded border bg-background px-2 py-1.5"
            />
          </div>

          {isForeign && (
            <div className="rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-muted-foreground">
                  {t("add_expense.exchange_rate")}
                </span>
                <button
                  onClick={handleResolveFx}
                  disabled={resolving}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
                >
                  {resolving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  {resolving ? (
                    <span>{t("add_expense.resolving")}</span>
                  ) : (
                    <span>{t("add_expense.resolve_rate")}</span>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">
                    {t("add_expense.fx_rate")}
                  </label>
                  <input
                    value={fxRate}
                    onChange={(e) => setFxRate(e.target.value)}
                    className="w-full rounded border bg-background px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">
                    {t("add_expense.inr_equivalent")}
                  </label>
                  <input
                    value={inrEquivalent}
                    onChange={(e) => setInrEquivalent(e.target.value)}
                    className="w-full rounded border bg-background px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {saving ? (
              <span>{t("settings.saving")}</span>
            ) : (
              <span>{t("add_expense.add_expense_btn")}</span>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-3 flex flex-col gap-2">
          {canFilterOthers && deduplicatedPeople.length > 0 && (
            <PersonFilterBar
              assignedFilter={isViewingSelf ? "me" : viewingPersonCanonical}
              onSelectFilter={(selected) => {
                if (selected === "me" || selected === "all") {
                  setPersonFilter("");
                } else {
                  setPersonFilter(selected);
                }
                setTripFilter("");
              }}
              allAssignees={deduplicatedPeople.filter(
                (p) =>
                  canonicalizePersonName(p, users).toLowerCase() !==
                    user.username.trim().toLowerCase() &&
                  canonicalizePersonName(p, users).toLowerCase() !==
                    (user.name || "").trim().toLowerCase(),
              )}
              filterOpen={personFilterOpen}
              onToggleFilter={() => setPersonFilterOpen((v) => !v)}
              className="mb-1"
            />
          )}

          <div>
            <button
              onClick={() => setTripFilterOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/10"
            >
              {tripFilter || "Select trip"}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${tripFilterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {tripFilterOpen && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {myTripOptions.length === 0 ? (
                  <span className="text-[11px] italic text-muted-foreground">
                    No expenses logged yet.
                  </span>
                ) : (
                  myTripOptions.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTripFilter(t);
                        setTripFilterOpen(false);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        tripFilter === t
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent-soft"
                      }`}
                    >
                      {t}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {listHeading}
        </div>

        {!tripFilter ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Select a trip above to see expenses and totals.
          </div>
        ) : displayedExpenses.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            No expenses logged for this trip.
          </div>
        ) : (
          <>
            <div className="mb-3 rounded-lg bg-muted/30 p-3">
              {categoryBreakdown.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{c.category}</span>
                  <span className="font-semibold">{formatInr(c.total)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-bold">
                <span>Grand total</span>
                <span className="text-accent">{formatInr(grandTotal)}</span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {displayedExpenses.map((e) => (
                <div
                  key={e.sourcerow}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {e.category}
                      {e.description ? ` · ${e.description}` : ""}
                    </div>
                    <div className="text-muted-foreground">
                      {e.trip} ·{" "}
                      {e.expensedate
                        ? new Date(e.expensedate).toLocaleDateString()
                        : e.timestamp
                          ? new Date(e.timestamp).toLocaleDateString()
                          : ""}
                      {e.paymentmethod ? ` · ${e.paymentmethod}` : ""}
                      {e.paymentmethod === "Card" && e.cardused ? ` (${e.cardused.slice(-4)})` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.receipturl && (
                      <button
                        onClick={() => setViewingReceipt(e.receipturl)}
                        className="text-accent hover:opacity-70"
                        aria-label="View receipt"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="font-semibold">
                      {(e.currency || "INR").toUpperCase() === "INR"
                        ? formatInr(parseAmount(e.amount) || 0)
                        : `${e.amount} ${e.currency}`}
                    </span>
                    {(isViewingSelf || canFilterOthers) && (
                      <button
                        onClick={() => setEditingExpense(e)}
                        className="text-accent hover:opacity-70"
                        aria-label="Edit expense"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {(isViewingSelf || canFilterOthers) && (
                      <button
                        onClick={() => handleRemove(e.sourcerow)}
                        disabled={removingRow === e.sourcerow}
                        className="text-destructive hover:opacity-70 disabled:opacity-40"
                      >
                        {removingRow === e.sourcerow ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {viewingReceipt && (
        <ReceiptViewerDialog
          url={viewingReceipt}
          open={!!viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {editingExpense && (
        <EditExpenseDialog
          expense={editingExpense}
          user={user}
          events={events}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            onRefresh();
          }}
          restricted={
            (editingExpense.username || "").trim().toLowerCase() !==
              user.username.trim().toLowerCase() &&
            !["system manager", "accounts", "owner"].includes(
              (user.role || "").trim().toLowerCase(),
            )
          }
        />
      )}

      <ExpenseUploadModal
        state={uploadModal}
        onClose={() => setUploadModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
