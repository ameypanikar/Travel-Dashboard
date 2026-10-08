import { fetchGeminiKey, fetchGeminiModel } from "@/lib/dashboard-api";

const CROP_PROMPT =
  "Look at this photo of a receipt or bill. Detect the bounding box of the receipt/document within the photo (excluding table surface, background, hands, or shadows). Return ONLY a JSON object with keys: x_min, y_min, x_max, y_max on a 0-1000 integer scale where (0,0) is top-left and (1000,1000) is bottom-right. If the receipt already fills the whole photo, return x_min: 0, y_min: 0, x_max: 1000, y_max: 1000.";

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function resolveImageMimeType(file: File): string {
  if (file.type && file.type.startsWith("image/")) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "";
}

export async function autoCropReceipt(
  file: File,
  onProgress?: (msg: string) => void
): Promise<File> {
  const log = (...args: unknown[]) => console.log("[autoCropReceipt]", ...args);

  const mimeType = resolveImageMimeType(file);
  if (!mimeType) {
    log("Skipped — not an image, type was:", file.type || "(empty)");
    return file;
  }

  try {
    onProgress?.("Locating receipt edges with AI…");
    let key = localStorage.getItem("gemini_api_key") || "";
    if (!key) {
      log("No cached key, fetching from Config sheet…");
      key = await fetchGeminiKey();
    }
    if (!key) {
      log("Skipped — no Gemini API key available.");
      return file;
    }
    const model = await fetchGeminiModel();
    log("Using model:", model);

    const objectUrl = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(objectUrl);
    } catch {
      log("Skipped — could not decode image");
      return file;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    const base64 = await fileToBase64(file);
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
                { text: CROP_PROMPT },
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

    if (!res.ok) {
      log("Skipped — Gemini request failed:", res.status, await res.text());
      return file;
    }
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    log("Raw Gemini response:", text);

    let box: any;
    try {
      box = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        box = JSON.parse(match[0]);
      } else {
        log("Skipped — no JSON found in response");
        return file;
      }
    }
    log("Parsed box:", box);

    // Support multiple key naming conventions
    const rawXMin = Number(box.x_min ?? box.xmin ?? box.xMin ?? box.box_2d?.[1]);
    const rawYMin = Number(box.y_min ?? box.ymin ?? box.yMin ?? box.box_2d?.[0]);
    const rawXMax = Number(box.x_max ?? box.xmax ?? box.xMax ?? box.box_2d?.[3]);
    const rawYMax = Number(box.y_max ?? box.ymax ?? box.yMax ?? box.box_2d?.[2]);

    if (
      [rawXMin, rawYMin, rawXMax, rawYMax].some((n) => Number.isNaN(n)) ||
      rawXMax <= rawXMin ||
      rawYMax <= rawYMin
    ) {
      log("Skipped — box values missing or out of order.");
      return file;
    }

    const maxVal = Math.max(rawXMax, rawYMax);
    let xMin: number, yMin: number, xMax: number, yMax: number;

    if (maxVal <= 1) {
      // 0-1 fractional coordinates
      xMin = rawXMin;
      yMin = rawYMin;
      xMax = rawXMax;
      yMax = rawYMax;
    } else if (maxVal > 1000) {
      // Raw pixel coordinates: only when values exceed the 0-1000 scale
      log("Box values exceed 1000 — normalizing by natural dimensions.");
      xMin = rawXMin / img.naturalWidth;
      yMin = rawYMin / img.naturalHeight;
      xMax = rawXMax / img.naturalWidth;
      yMax = rawYMax / img.naturalHeight;
    } else {
      // 0-1000 scale (standard Gemini bounding box output)
      log("Box looks like 0-1000 scale — normalizing by 1000.");
      xMin = rawXMin / 1000;
      yMin = rawYMin / 1000;
      xMax = rawXMax / 1000;
      yMax = rawYMax / 1000;
    }

    log("Normalized box:", { xMin, yMin, xMax, yMax });

    // Clamp coordinates safely between 0 and 1
    xMin = Math.max(0, Math.min(1, xMin));
    yMin = Math.max(0, Math.min(1, yMin));
    xMax = Math.max(0, Math.min(1, xMax));
    yMax = Math.max(0, Math.min(1, yMax));

    if (xMax - xMin < 0.05 || yMax - yMin < 0.05) {
      log("Skipped — bounding box is too small to be a valid receipt.");
      return file;
    }

    if (xMin < 0.02 && yMin < 0.02 && xMax > 0.98 && yMax > 0.98) {
      log("Skipped — box says receipt already fills the frame.");
      return file;
    }

    onProgress?.("Cropping receipt image…");
    const cropX = Math.floor(xMin * img.naturalWidth);
    const cropY = Math.floor(yMin * img.naturalHeight);
    const cropW = Math.ceil((xMax - xMin) * img.naturalWidth);
    const cropH = Math.ceil((yMax - yMin) * img.naturalHeight);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      log("Skipped — couldn't get canvas context.");
      return file;
    }
    ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const outputMime = mimeType === "image/png" ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outputMime, 0.92)
    );
    if (!blob) {
      log("Skipped — canvas.toBlob returned null.");
      return file;
    }

    log("Crop succeeded:", cropW, "x", cropH);
    return new File([blob], file.name, { type: outputMime });
  } catch (e) {
    log("Skipped — exception:", e);
    return file;
  }
}