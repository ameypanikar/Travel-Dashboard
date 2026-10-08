import { Printer, X, FileText, Grid3X3, LayoutGrid } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, useMemo } from "react";

function getGoogleDriveId(fileUrl: string): string | null {
  try {
    const u = new URL(fileUrl);
    let id = u.searchParams.get("id");
    if (!id && fileUrl.includes("/file/d/")) {
      const match = fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) id = match[1];
    }
    return id || null;
  } catch {
    const match = fileUrl.match(/id=([a-zA-Z0-9_-]+)/) || fileUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
}

function isImageReceipt(r: { url: string; mimetype?: string }): boolean {
  if (r.mimetype?.startsWith("image/")) return true;
  if (r.mimetype === "application/pdf" || /\.pdf(?:\?|$)/i.test(r.url)) return false;
  if (/\.(jpe?g|png|webp|avif|gif|bmp|svg)(?:\?|$)/i.test(r.url)) return true;
  // If Google Drive link and not explicitly a PDF, treat as image receipt so mobile bill photos display
  if (r.url.includes("drive.google.com") || r.url.includes("googleusercontent.com")) return true;
  return false;
}

function ResilientReceiptImage({ url, label }: { url: string; label: string }) {
  const driveId = getGoogleDriveId(url);

  // Build candidate URLs in order of reliability:
  // 1. Direct export view (worked reliably on Supabase shift)
  // 2. Google UserContent direct CDN
  // 3. Drive Thumbnail endpoint
  // 4. Drive direct download export
  // 5. Original URL
  const candidateUrls = useMemo(() => {
    if (!driveId) return [url];
    return [
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`,
      `https://lh3.googleusercontent.com/d/${driveId}=w1000`,
      `https://drive.google.com/uc?export=view&id=${driveId}`,
      url,
    ];
  }, [driveId, url]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const handleError = () => {
    if (currentIndex + 1 < candidateUrls.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const currentSrc = candidateUrls[currentIndex];

  if (allFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-1.5 text-center">
        {/* Screen view */}
        <div className="flex flex-col items-center justify-center gap-1 print:hidden">
          <FileText className="h-5 w-5 text-muted-foreground/80" />
          <span className="text-[10px] text-muted-foreground">Google Drive Link</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent/20 transition-colors"
          >
            Open in Drive ↗
          </a>
        </div>

        {/* Print view: clean voucher box */}
        <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:h-full print:w-full print:border print:border-dashed print:border-neutral-300 print:rounded print:p-1 text-center">
          <span className="text-[8px] font-semibold text-neutral-800">Google Drive Receipt</span>
          <span className="text-[7px] text-neutral-500 line-clamp-1 mt-0.5">{url}</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={label}
      referrerPolicy="no-referrer"
      loading="eager"
      onError={handleError}
      className="max-h-full max-w-full object-contain"
    />
  );
}

export function ConsolidatedReceiptsView({
  trip,
  receipts,
  onClose,
}: {
  trip: string;
  receipts: { url: string; mimetype: string; label: string }[];
  onClose: () => void;
}) {
  const [cols, setCols] = useState<3 | 4>(3);
  const [showLabels, setShowLabels] = useState(true);

  const imageReceipts = receipts.filter(isImageReceipt);
  const otherReceipts = receipts.filter((r) => !isImageReceipt(r));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div id="print-area" className="fixed inset-0 z-50 flex flex-col bg-background print:static print:h-auto print:overflow-visible print:bg-white print:text-black">
      {/* Top action bar - hidden during print */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 bg-card/60 backdrop-blur print:hidden">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold">Receipts — {trip}</div>
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
            {imageReceipts.length} images · {otherReceipts.length} PDFs
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Density toggle: 3x3 vs 4x3 */}
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setCols(3)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                cols === 3
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="3x3 Layout (fits ~9-12 receipts per page)"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              <span>3×3 Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setCols(4)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                cols === 4
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="4x3 Layout (fits ~12-16 receipts per page)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>4×3 Dense</span>
            </button>
          </div>

          {/* Label toggle */}
          <label className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Details in print</span>
          </label>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground shadow-xs hover:bg-accent/90"
          >
            <Printer className="h-3.5 w-3.5" /> Print / Save as PDF
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 print:flex-none print:overflow-visible print:p-0">
        <div className="mb-2 hidden items-center justify-between border-b pb-1 text-xs print:flex print:text-black">
          <span className="font-bold uppercase tracking-wider text-xs">Consolidated Receipts — {trip}</span>
          <span className="text-[10px] text-neutral-500">Total Receipts: {imageReceipts.length + otherReceipts.length}</span>
        </div>

        {/* PDF / Document Receipts */}
        {otherReceipts.length > 0 && (
          <div className="mb-4 print:mb-2">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground print:text-black print:text-[9px]">
              PDF / File receipts ({otherReceipts.length})
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 print:grid-cols-3 print:gap-1">
              {otherReceipts.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded border px-2.5 py-1.5 text-xs text-accent hover:bg-accent-soft print:border-neutral-300 print:text-black print:p-1"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText className="h-3.5 w-3.5 shrink-0 print:text-black" />
                    <span className="truncate font-medium text-foreground print:text-black print:text-[9px]">{r.label}</span>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 shrink-0 text-[10px] text-accent underline print:text-neutral-700 print:no-underline print:text-[8px]"
                  >
                    Open ↗
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Image Receipts Grid */}
        {imageReceipts.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground print:text-black">
            No image receipts to preview for this trip.
          </div>
        ) : (
          <div
            className={
              cols === 4
                ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 print:gap-1.5"
                : "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 print:gap-2"
            }
          >
            {imageReceipts.map((r, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-md border border-border/60 bg-card/40 p-1.5 flex flex-col justify-between print:border-0 print:rounded-none print:p-0.5 print:bg-transparent print:m-0"
              >
                {showLabels && (
                  <div className="mb-1 text-[10px] font-medium leading-tight text-muted-foreground line-clamp-1 print:text-[8px] print:leading-tight print:font-normal print:text-neutral-700 print:mb-0.5 print:line-clamp-1">
                    {r.label}
                  </div>
                )}
                <div
                  className={`relative flex w-full items-center justify-center bg-muted/10 print:bg-transparent ${
                    cols === 4
                      ? "h-48 print:h-38"
                      : "h-60 print:h-46"
                  }`}
                >
                  <ResilientReceiptImage url={r.url} label={r.label} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}