import { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  FileDown,
  Receipt as ReceiptIcon,
  Calendar,
  Sparkles,
  CalendarDays,
  Users,
  Pencil,
  RotateCcw,
  Eye,
  Filter,
} from "lucide-react";
import type {
  Flight,
  Hotel,
  Train,
  Bus,
  Expense,
  Advance,
  Allowance,
  StandingTourBatch,
} from "@/lib/dashboard-api";
import {
  createStandingTourBatch,
  updateStandingTourBatch,
  deleteStandingTourBatch,
} from "@/lib/dashboard-api";
import type { SessionUser } from "@/lib/auth";
import {
  formatInr,
  parseAmount,
  GENERAL_TRAVEL,
  isTripMatch,
  formatIsoToDisplay,
  getTripParticipants,
  isIsoInRange,
  isOwnerEntry,
} from "@/lib/expense-utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type UserEntry = { name: string; username: string; role: string };

interface StandingTourBatchesPanelProps {
  trip: string;
  batches: StandingTourBatch[];
  expenses: Expense[];
  advances: Advance[];
  allowances: Allowance[];
  flights: Flight[];
  hotels: Hotel[];
  trains: Train[];
  buses: Bus[];
  users: UserEntry[];
  user: SessionUser;
  onRefresh: () => void;
  activeDateFrom?: string;
  activeDateTo?: string;
  onClearDateRange?: () => void;
  onSelectBatchDateRange?: (fromDate: string, toDate: string) => void;
  onOpenVoucher: (trip: string, group: "staff" | "owner", dateRange?: { from: string; to: string }) => void;
  onOpenReceipts: (trip: string, dateRange?: { from: string; to: string }) => void;
}

export function StandingTourBatchesPanel({
  trip,
  batches = [],
  expenses,
  advances,
  allowances,
  flights,
  hotels,
  trains,
  buses,
  users,
  user,
  onRefresh,
  activeDateFrom = "",
  activeDateTo = "",
  onClearDateRange,
  onSelectBatchDateRange,
  onOpenVoucher,
  onOpenReceipts,
}: StandingTourBatchesPanelProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<StandingTourBatch | null>(null);
  const [batchTitle, setBatchTitle] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [initialStatus, setInitialStatus] = useState<"open" | "completed">("open");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter batches specifically belonging to this trip
  const tripBatches = useMemo(() => {
    return batches
      .filter((b) => isTripMatch(b.trip, trip))
      .sort((a, b) => (b.fromDate || "").localeCompare(a.fromDate || ""));
  }, [batches, trip]);

  // All expenses belonging to this standing tour
  const tripExpenses = useMemo(() => {
    return expenses.filter((e) => isTripMatch(e.trip || GENERAL_TRAVEL, trip));
  }, [expenses, trip]);

  // Compute metrics for a given date range
  const computeBatchMetrics = (from: string, to: string) => {
    const inRange = (iso: string) => isIsoInRange(iso, from, to);

    const matchingExpenses = tripExpenses.filter((e) => {
      let iso = "";
      if (e.expensedate && e.expensedate.trim()) {
        iso = e.expensedate.trim().slice(0, 10);
      } else if (e.timestamp) {
        const d = new Date(e.timestamp);
        if (!Number.isNaN(d.getTime())) iso = d.toISOString().slice(0, 10);
      }
      return inRange(iso);
    });

    const totalSpend = matchingExpenses.reduce((sum, e) => {
      const cur = (e.currency || "INR").trim().toUpperCase();
      const n = cur === "INR" ? parseAmount(e.amount) : parseAmount(e.inrequivalent || "");
      return sum + (Number.isNaN(n) ? 0 : n);
    }, 0);

    const receiptsCount = matchingExpenses.filter((e) => Boolean(e.receipturl)).length;

    const participants = getTripParticipants(
      trip,
      {
        flights: flights as unknown as Record<string, string>[],
        hotels: hotels as unknown as Record<string, string>[],
        trains: trains as unknown as Record<string, string>[],
        buses: buses as unknown as Record<string, string>[],
        expenses: matchingExpenses,
        advances,
        allowances,
      },
      users,
    );

    const hasStaff = participants.some((p) => !isOwnerEntry(p.username, p.name, users));
    const hasOwner = participants.some((p) => isOwnerEntry(p.username, p.name, users));

    return {
      expenses: matchingExpenses,
      totalSpend,
      expensesCount: matchingExpenses.length,
      receiptsCount,
      participants,
      hasStaff,
      hasOwner,
    };
  };

  // Live preview metrics for the creation modal
  const modalPreview = useMemo(() => {
    if (!fromDate && !toDate) return null;
    return computeBatchMetrics(fromDate, toDate);
  }, [fromDate, toDate, tripExpenses]);

  // Smart Detection: Find expense date clusters in the tour that aren't yet in any batch
  const detectedClusters = useMemo(() => {
    const dates = new Set<string>();
    tripExpenses.forEach((e) => {
      const iso = (e.expensedate?.trim().slice(0, 10) || (e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 10) : "")).trim();
      if (iso && iso.length === 10) dates.add(iso);
    });

    const sortedDates = Array.from(dates).sort();
    if (sortedDates.length === 0) return [];

    const clusters: { from: string; to: string; count: number }[] = [];
    let currentCluster: string[] = [];

    for (const d of sortedDates) {
      if (currentCluster.length === 0) {
        currentCluster.push(d);
      } else {
        const lastDate = new Date(currentCluster[currentCluster.length - 1]);
        const thisDate = new Date(d);
        const diffDays = Math.round((thisDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) {
          currentCluster.push(d);
        } else {
          clusters.push({
            from: currentCluster[0],
            to: currentCluster[currentCluster.length - 1],
            count: currentCluster.length,
          });
          currentCluster = [d];
        }
      }
    }
    if (currentCluster.length > 0) {
      clusters.push({
        from: currentCluster[0],
        to: currentCluster[currentCluster.length - 1],
        count: currentCluster.length,
      });
    }

    return clusters
      .filter((c) => !tripBatches.some((b) => b.fromDate === c.from && b.toDate === c.to))
      .slice(0, 3);
  }, [tripExpenses, tripBatches]);

  // Group batches by Month (YYYY-MM)
  const batchesByMonth = useMemo(() => {
    const map = new Map<string, StandingTourBatch[]>();
    tripBatches.forEach((b) => {
      const monthKey = b.fromDate ? b.fromDate.slice(0, 7) : "Undated";
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(b);
    });

    return Array.from(map.entries()).map(([monthKey, items]) => {
      let monthLabel = monthKey;
      if (monthKey !== "Undated") {
        const [y, m] = monthKey.split("-");
        const dt = new Date(Number(y), Number(m) - 1, 1);
        monthLabel = dt.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }

      const completedCount = items.filter((x) => x.status === "completed").length;
      let monthTotalSpend = 0;

      items.forEach((b) => {
        const m = computeBatchMetrics(b.fromDate, b.toDate);
        monthTotalSpend += m.totalSpend;
      });

      return {
        monthKey,
        monthLabel,
        batches: items,
        totalVisits: items.length,
        completedCount,
        allCompleted: completedCount === items.length,
        monthTotalSpend,
      };
    });
  }, [tripBatches, tripExpenses]);

  const totalCompletedBatches = tripBatches.filter((b) => b.status === "completed").length;

  const handleOpenCreateModal = (prefill?: { from: string; to: string; title?: string }) => {
    setEditingBatch(null);
    if (prefill) {
      setFromDate(prefill.from);
      setToDate(prefill.to);
      setBatchTitle(prefill.title || `Visit ${tripBatches.length + 1}`);
    } else if (activeDateFrom && activeDateTo) {
      setFromDate(activeDateFrom);
      setToDate(activeDateTo);
      setBatchTitle(`Visit ${tripBatches.length + 1} (${formatIsoToDisplay(activeDateFrom)} – ${formatIsoToDisplay(activeDateTo)})`);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setFromDate(today);
      setToDate(today);
      setBatchTitle(`Visit ${tripBatches.length + 1}`);
    }
    setNotes("");
    setInitialStatus("open");
    setModalOpen(true);
  };

  const handleOpenEditModal = (batch: StandingTourBatch) => {
    setEditingBatch(batch);
    setBatchTitle(batch.title);
    setFromDate(batch.fromDate);
    setToDate(batch.toDate);
    setNotes(batch.notes || "");
    setInitialStatus(batch.status);
    setModalOpen(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate) {
      toast.error("Please provide both From date and To date");
      return;
    }
    if (fromDate > toDate) {
      toast.error("From date cannot be after To date");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingBatch) {
        await updateStandingTourBatch(editingBatch.id, {
          title: batchTitle.trim() || `Visit (${formatIsoToDisplay(fromDate)} – ${formatIsoToDisplay(toDate)})`,
          fromDate,
          toDate,
          status: initialStatus,
          notes: notes.trim() || undefined,
          completedAt: initialStatus === "completed" ? (editingBatch.completedAt || new Date().toISOString()) : undefined,
          completedBy: initialStatus === "completed" ? (editingBatch.completedBy || user.username) : undefined,
        });
        toast.success("Visit batch updated!");
      } else {
        await createStandingTourBatch({
          trip,
          title: batchTitle.trim() || `Visit ${tripBatches.length + 1}`,
          fromDate,
          toDate,
          status: initialStatus,
          notes: notes.trim() || undefined,
          createdBy: user.username,
          completedAt: initialStatus === "completed" ? new Date().toISOString() : undefined,
          completedBy: initialStatus === "completed" ? user.username : undefined,
        });
        toast.success("Visit batch created!");
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleBatchStatus = async (batch: StandingTourBatch) => {
    const nextStatus = batch.status === "completed" ? "open" : "completed";
    const promptMsg =
      batch.status === "completed"
        ? `Re-open "${batch.title}"? It will be marked as in progress / unsettled.`
        : `Mark "${batch.title}" as completed / settled?`;

    if (!window.confirm(promptMsg)) return;

    try {
      await updateStandingTourBatch(batch.id, {
        status: nextStatus,
        completedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
        completedBy: nextStatus === "completed" ? user.username : undefined,
      });
      toast.success(nextStatus === "completed" ? `"${batch.title}" marked as settled!` : `"${batch.title}" reopened.`);
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteBatch = async (batch: StandingTourBatch) => {
    if (!window.confirm(`Delete batch "${batch.title}"? This will not delete the underlying expenses.`)) return;
    try {
      await deleteStandingTourBatch(batch.id);
      toast.success("Batch removed.");
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-bold text-foreground truncate">Visit Settlement Batches</h3>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent shrink-0">
              {tripBatches.length} {tripBatches.length === 1 ? "Visit" : "Visits"}
              {tripBatches.length > 0 && ` · ${totalCompletedBatches} Completed`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateModal()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground hover:bg-accent/90 active:scale-[0.98] transition cursor-pointer shrink-0 shadow-2xs"
        >
          <Plus className="h-3 w-3" />
          <span>New Visit Batch</span>
        </button>
      </div>

      {/* Active Scope Filter Indicator */}
      {(activeDateFrom || activeDateTo) && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft/40 border border-accent/25 px-3 py-1.5 text-xs text-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <Filter className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="truncate">
              Filtered below to: <strong>{activeDateFrom ? formatIsoToDisplay(activeDateFrom) : "Start"} → {activeDateTo ? formatIsoToDisplay(activeDateTo) : "Present"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeDateFrom && activeDateTo && (
              <button
                type="button"
                onClick={() => handleOpenCreateModal()}
                className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground hover:bg-accent/90 cursor-pointer shadow-2xs"
              >
                <Plus className="h-3 w-3" />
                <span>Save as Batch</span>
              </button>
            )}
            {onClearDateRange && (
              <button
                type="button"
                onClick={onClearDateRange}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Show Full Tour</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Suggested Unbatched Visits Chips */}
      {detectedClusters.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 border border-border/50 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground shrink-0">
            <Sparkles className="h-3 w-3 text-accent" />
            <span>Suggested visits:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {detectedClusters.map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  handleOpenCreateModal({
                    from: c.from,
                    to: c.to,
                    title: `Visit ${tripBatches.length + 1} (${formatIsoToDisplay(c.from)} – ${formatIsoToDisplay(c.to)})`,
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent-soft hover:border-accent/40 transition cursor-pointer"
              >
                <span>{formatIsoToDisplay(c.from)} → {formatIsoToDisplay(c.to)}</span>
                <span className="font-bold text-accent">+ Create</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Batches Content */}
      {batchesByMonth.length === 0 ? (
        <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-dashed border-border bg-muted/10 p-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            <span>No visit batches created yet for <strong>{trip}</strong>. Group recurring visits into monthly batches to settle them independently.</span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline shrink-0 cursor-pointer self-start sm:self-center"
          >
            <Plus className="h-3 w-3" /> Create first batch
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {batchesByMonth.map((group) => (
            <div key={group.monthKey} className="space-y-1.5">
              {/* Month Subheader */}
              <div className="flex items-center justify-between px-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-muted-foreground">
                  <span>{group.monthLabel}</span>
                  <span>·</span>
                  <span>{group.totalVisits} {group.totalVisits === 1 ? "visit" : "visits"}</span>
                  <span>·</span>
                  <span className="text-foreground">{formatInr(group.monthTotalSpend)}</span>
                </div>
                <div>
                  {group.allCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" /> All completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3" /> {group.completedCount} of {group.totalVisits} completed
                    </span>
                  )}
                </div>
              </div>

              {/* Batches Cards */}
              <div className="grid grid-cols-1 gap-2">
                {group.batches.map((batch) => {
                  const metrics = computeBatchMetrics(batch.fromDate, batch.toDate);
                  const isCompleted = batch.status === "completed";
                  const isScoped = activeDateFrom === batch.fromDate && activeDateTo === batch.toDate;

                  return (
                    <div
                      key={batch.id}
                      className={`rounded-xl border p-2.5 transition shadow-2xs ${
                        isScoped
                          ? "border-accent ring-1 ring-accent/30 bg-accent-soft/20"
                          : isCompleted
                          ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      {/* Top Row: Title, Status, Spend */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleBatchStatus(batch)}
                            className="cursor-pointer shrink-0"
                            title={isCompleted ? "Re-open visit" : "Mark visit completed"}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-foreground truncate">{batch.title}</span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                                  isCompleted
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                {isCompleted ? "Completed" : "Open"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="h-2.5 w-2.5 shrink-0" />
                              <span>{formatIsoToDisplay(batch.fromDate)} → {formatIsoToDisplay(batch.toDate)}</span>
                              {batch.completedBy && isCompleted && (
                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                  · Settled by {batch.completedBy}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Spend & Edit/Delete */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-bold text-foreground">{formatInr(metrics.totalSpend)}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {metrics.expensesCount} exp · {metrics.receiptsCount} rec
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(batch)}
                              className="rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(batch)}
                              className="rounded p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Actions */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {metrics.participants.length > 0
                              ? metrics.participants.map((p) => p.username).join(", ")
                              : "No participants logged"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {onSelectBatchDateRange && (
                            <button
                              type="button"
                              onClick={() => onSelectBatchDateRange(batch.fromDate, batch.toDate)}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                                isScoped
                                  ? "bg-accent text-accent-foreground"
                                  : "border border-border bg-card text-foreground hover:bg-accent-soft"
                              }`}
                            >
                              <Eye className="h-2.5 w-2.5" />
                              <span>{isScoped ? "Scoped Active" : "Scope Below"}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenReceipts(trip, { from: batch.fromDate, to: batch.toDate })}
                            disabled={metrics.receiptsCount === 0}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-accent-soft disabled:opacity-40 cursor-pointer"
                          >
                            <ReceiptIcon className="h-2.5 w-2.5 text-accent" />
                            <span>Receipts ({metrics.receiptsCount})</span>
                          </button>

                          {metrics.hasStaff && metrics.hasOwner ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenVoucher(trip, "staff", { from: batch.fromDate, to: batch.toDate })}
                                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground hover:opacity-90 cursor-pointer"
                              >
                                <FileDown className="h-2.5 w-2.5" /> Staff
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenVoucher(trip, "owner", { from: batch.fromDate, to: batch.toDate })}
                                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground hover:opacity-90 cursor-pointer"
                              >
                                <FileDown className="h-2.5 w-2.5" /> Owner
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenVoucher(
                                  trip,
                                  metrics.hasOwner ? "owner" : "staff",
                                  { from: batch.fromDate, to: batch.toDate },
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground hover:opacity-90 cursor-pointer"
                            >
                              <FileDown className="h-2.5 w-2.5" /> Voucher
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleBatchStatus(batch)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                              isCompleted
                                ? "border border-border bg-card text-muted-foreground hover:bg-muted"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>{isCompleted ? "Re-open" : "Complete"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Batch Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" />
              <span>{editingBatch ? `Edit "${editingBatch.title}"` : `Create Visit Batch for ${trip}`}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBatch} className="space-y-3.5 mt-2">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Batch Title / Visit Name
              </label>
              <input
                type="text"
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
                placeholder="e.g. Visit 1 (Site Inspection & Client Demo)"
                className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Visit Start Date (From)
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Visit End Date (To)
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
                  required
                />
              </div>
            </div>

            {/* Quick date shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-medium">Quick Dates:</span>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = String(now.getMonth() + 1).padStart(2, "0");
                  setFromDate(`${y}-${m}-01`);
                  setToDate(now.toISOString().slice(0, 10));
                }}
                className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground hover:bg-accent-soft cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const past14 = new Date();
                  past14.setDate(past14.getDate() - 14);
                  setFromDate(past14.toISOString().slice(0, 10));
                  setToDate(now.toISOString().slice(0, 10));
                }}
                className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground hover:bg-accent-soft cursor-pointer"
              >
                Past 14 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setFromDate(today);
                  setToDate(today);
                }}
                className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground hover:bg-accent-soft cursor-pointer"
              >
                Single Day (Today)
              </button>
            </div>

            {/* Real-time Matching Records Preview */}
            {modalPreview && (
              <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-xs space-y-1">
                <div className="font-semibold text-foreground flex items-center justify-between">
                  <span>Matching Activity in this window:</span>
                  <span className="text-accent font-bold">{formatInr(modalPreview.totalSpend)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                  <span>{modalPreview.expensesCount} expenses</span>
                  <span>{modalPreview.receiptsCount} receipts</span>
                  <span>
                    {modalPreview.participants.length} participant
                    {modalPreview.participants.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Settlement Status selection */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Settlement Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInitialStatus("open")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer ${
                    initialStatus === "open"
                      ? "border-amber-500 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span>In Progress / Open</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInitialStatus("completed")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition cursor-pointer ${
                    initialStatus === "completed"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Mark Completed</span>
                </button>
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Notes / Scope Summary (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Phase 1 installation & client sign-off"
                className="w-full rounded-lg border border-input bg-card px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-accent/40"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Saving..." : editingBatch ? "Save Changes" : "Create Batch"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
