// src/lib/process-image.ts
//
// Client-side photo prep used by the step-by-step "Add Items" flow
// (/dashboard/quick-add). It is the same processing the Menu page applies
// (src/app/(dashboard)/dashboard/(admin)/menu/page.tsx): center-crop to a
// square, scale to 900x900, auto-levels + a gentle saturation boost, then a
// light sharpen. Kept identical so photos added either way look the same on
// the ordering screens. The Menu page still has its own copy — nothing there
// was changed.

/** Photos below this size get a "low resolution" warning. */
export const MIN_DIMENSION = 600;
/** Every photo is center-cropped to a square of this size. */
export const OUTPUT_SIZE = 900;
/** Largest file accepted, same limit as the Menu page. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

function autoEnhanceImageData(data: Uint8ClampedArray, width: number, height: number) {
  const totalPixels = width * height;
  const histR = new Array(256).fill(0);
  const histG = new Array(256).fill(0);
  const histB = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    histR[data[i]]++;
    histG[data[i + 1]]++;
    histB[data[i + 2]]++;
  }

  const findBounds = (hist: number[]) => {
    const lowCutoff = totalPixels * 0.01;
    const highCutoff = totalPixels * 0.99;
    let cumulative = 0;
    let low = 0;
    let high = 255;

    for (let v = 0; v < 256; v++) {
      cumulative += hist[v];
      if (cumulative >= lowCutoff) {
        low = v;
        break;
      }
    }

    cumulative = 0;
    for (let v = 255; v >= 0; v--) {
      cumulative += hist[v];
      if (cumulative >= totalPixels - highCutoff) {
        high = v;
        break;
      }
    }

    if (high <= low) return { low: 0, high: 255 };
    return { low, high };
  };

  const buildLut = (low: number, high: number) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      lut[v] = Math.round(((v - low) * 255) / (high - low));
    }
    return lut;
  };

  const r = findBounds(histR);
  const g = findBounds(histG);
  const b = findBounds(histB);
  const lutR = buildLut(r.low, r.high);
  const lutG = buildLut(g.low, g.high);
  const lutB = buildLut(b.low, b.high);

  const saturationBoost = 1.15;

  for (let i = 0; i < data.length; i += 4) {
    const rr = lutR[data[i]];
    const gg = lutG[data[i + 1]];
    const bb = lutB[data[i + 2]];
    const gray = 0.299 * rr + 0.587 * gg + 0.114 * bb;
    data[i] = Math.min(255, Math.max(0, gray + (rr - gray) * saturationBoost));
    data[i + 1] = Math.min(255, Math.max(0, gray + (gg - gray) * saturationBoost));
    data[i + 2] = Math.min(255, Math.max(0, gray + (bb - gray) * saturationBoost));
  }
}

function sharpenImageData(data: Uint8ClampedArray, width: number, height: number) {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const output = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const sx = Math.min(width - 1, Math.max(0, x + kx));
            const sy = Math.min(height - 1, Math.max(0, y + ky));
            sum += data[(sy * width + sx) * 4 + c] * kernel[k];
            k++;
          }
        }
        output[(y * width + x) * 4 + c] = sum;
      }
      output[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
    }
  }

  return output;
}

/**
 * Crops, resizes, enhances and sharpens a photo. Returns a JPEG data URL
 * (what MenuItems.image stores) plus the original dimensions so callers can
 * warn about low-resolution photos.
 */
export async function processImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = rawDataUrl;
  });

  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;
  const side = Math.min(originalWidth, originalHeight);
  const sx = (originalWidth - side) / 2;
  const sy = (originalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: rawDataUrl, width: originalWidth, height: originalHeight };
  }

  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const imageData = ctx.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  autoEnhanceImageData(imageData.data, OUTPUT_SIZE, OUTPUT_SIZE);
  const sharpened = sharpenImageData(imageData.data, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.putImageData(
    new ImageData(sharpened as unknown as Uint8ClampedArray<ArrayBuffer>, OUTPUT_SIZE, OUTPUT_SIZE),
    0,
    0
  );

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    width: originalWidth,
    height: originalHeight,
  };
}

/**
 * Turns a file name like "blue-mist_hookah.jpg" into "Blue mist hookah".
 * Returns "" for camera-style names (IMG_1234, long hex IDs) so the person
 * types a real name instead of saving a photo ID as the item name.
 */
export function nameFromFileName(fileName: string): string {
  const base = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = base.replace(/\s+/g, "");
  if (!base) return "";
  if (/^(img|dsc|pxl|photo|image|screenshot)\s*\d*/i.test(base) && /\d/.test(base)) return "";
  if (compact.length >= 20 && /^[0-9a-fA-F]+$/.test(compact)) return "";
  if (/^\d+$/.test(compact)) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Same check the Menu page uses before saving. */
export function looksLikeFilenameId(name: string): boolean {
  const compact = name.replace(/\s+/g, "");
  return compact.length >= 20 && /^[0-9a-fA-F]+$/.test(compact);
}
