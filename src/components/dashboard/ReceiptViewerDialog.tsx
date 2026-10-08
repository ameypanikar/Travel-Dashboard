import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
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

export function ReceiptViewerDialog({
  open,
  onClose,
  url,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
}) {
  const isPdf = /\.pdf(?:\?|$)/i.test(url);
  const driveId = getGoogleDriveId(url);

  const candidateUrls = useMemo(() => {
    if (!driveId) return [url];
    return [
      `https://drive.google.com/uc?export=view&id=${driveId}`,
      `https://lh3.googleusercontent.com/d/${driveId}`,
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`,
      `https://drive.usercontent.google.com/download?id=${driveId}&export=view`,
      url,
    ];
  }, [driveId, url]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  const handleError = () => {
    if (currentIndex + 1 < candidateUrls.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setImgFailed(true);
    }
  };

  const currentSrc = candidateUrls[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(openState: boolean) => !openState && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
        <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
          <div className="text-sm font-bold">Receipt Preview</div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline mr-6"
          >
            Open in new tab <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <div className="relative w-full h-[75vh] md:h-[80vh] flex items-center justify-center bg-black/5 dark:bg-black/40">
          {isPdf ? (
            <iframe
              src={driveId ? `https://drive.google.com/file/d/${driveId}/preview` : url}
              className="h-full w-full border-0"
              title="Receipt PDF"
            />
          ) : !imgFailed ? (
            <img
              src={currentSrc}
              alt="Receipt Preview"
              referrerPolicy="no-referrer"
              onError={handleError}
              className="max-h-full max-w-full object-contain p-2"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">Unable to preview receipt directly.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground"
              >
                Open receipt file <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}