// src/lib/process-image.ts
//
// Client-side photo prep used by the step-by-step "Add Items" flow
// (/dashboard/quick-add). Every photo comes out the same:
//   - 900 × 900 square JPEG
//   - the WHOLE item fitted inside the square (nothing cut off), with the
//     leftover space filled using the photo's own edge color so it blends in
//   - auto-levels + a gentle saturation boost, then a light sharpen (the same
//     enhancement the Menu page uses)
// iPhone .HEIC photos are converted automatically, and big phone photos are
// fine because everything is shrunk to 900 × 900 anyway.
// The Menu page still has its own copy of the older crop-to-square version;
// nothing there was changed.

/** Photos below this size get a "low resolution" warning. */
export const MIN_DIMENSION = 600;
/** Every photo ends up as a square of this size. */
export const OUTPUT_SIZE = 900;
/** Largest file accepted. Phone photos are often 5–15MB; all get shrunk. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i;
const HEIC_EXTENSIONS = /\.(heic|heif)$/i;

/**
 * True for anything that looks like a photo. Checks the file name too,
 * because Windows often reports iPhone .HEIC files with no type at all.
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(file.name);
}

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || HEIC_EXTENSIONS.test(file.name);
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    image.src = url;
  });
}

/**
 * Opens any photo, including iPhone .HEIC. Safari can open HEIC itself;
 * Chrome on Windows/Android can't, so those get converted to JPEG first.
 */
async function openPhoto(file: File): Promise<HTMLImageElement> {
  try {
    return await loadImage(file);
  } catch (err) {
    if (!isHeic(file)) throw err;
    // Loaded only when needed — it's a large library.
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
    return loadImage(Array.isArray(converted) ? converted[0] : converted);
  }
}

/**
 * Looks at the photo's edges that will touch the empty space (the left and
 * right sides of a tall photo, or the top and bottom of a wide one): their
 * average color, and whether they are plain or busy. Reads the
 * already-enhanced photo so the fill matches it exactly.
 */
function edgeInfo(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { color: string; busy: boolean } {
  const STRIP = 4;
  const tall = height > width;
  let r = 0;
  let g = 0;
  let b = 0;
  let lum = 0;
  let lum2 = 0;
  let n = 0;
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum += l;
    lum2 += l * l;
    n++;
  };
  if (tall) {
    for (let y = 0; y < height; y++) {
      for (let k = 0; k < Math.min(STRIP, width); k++) {
        add(k, y);
        add(width - 1 - k, y);
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < Math.min(STRIP, height); k++) {
        add(x, k);
        add(x, height - 1 - k);
      }
    }
  }
  if (n === 0) return { color: "#000000", busy: false };
  const mean = lum / n;
  const spread = Math.sqrt(Math.max(0, lum2 / n - mean * mean));
  return {
    color: `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`,
    // A plain backdrop (black, white, a wall) barely varies along the edge.
    // Fruit, people or a busy table do — a solid color looks wrong there.
    busy: spread > 22,
  };
}

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
 * Turns any photo into the standard menu image: 900 × 900 JPEG, whole item
 * visible, enhanced and sharpened. Returns a data URL (what MenuItems.image
 * stores) plus the original dimensions so callers can warn about small photos.
 */
export async function processImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await openPhoto(file);
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  // 1. Shrink the whole photo to fit inside the square (never cut off),
  //    then enhance and sharpen just the photo.
  const scale = Math.min(OUTPUT_SIZE / originalWidth, OUTPUT_SIZE / originalHeight);
  const drawW = Math.max(1, Math.round(originalWidth * scale));
  const drawH = Math.max(1, Math.round(originalHeight * scale));

  const photo = document.createElement("canvas");
  photo.width = drawW;
  photo.height = drawH;
  const pctx = photo.getContext("2d");
  if (!pctx) throw new Error("Canvas not available");
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(img, 0, 0, drawW, drawH);

  const imageData = pctx.getImageData(0, 0, drawW, drawH);
  autoEnhanceImageData(imageData.data, drawW, drawH);
  const sharpened = sharpenImageData(imageData.data, drawW, drawH);
  pctx.putImageData(
    new ImageData(sharpened as unknown as Uint8ClampedArray<ArrayBuffer>, drawW, drawH),
    0,
    0
  );

  // 2. Center it on a 900 × 900 square. Plain backdrop: fill with its own
  //    edge color so it blends in. Busy edges: use a soft, blurred, slightly
  //    darker copy of the photo instead (like a phone showing a wide photo
  //    in a square).
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  const edge = edgeInfo(sharpened, drawW, drawH);
  ctx.fillStyle = edge.color;
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  if (edge.busy && (drawW < OUTPUT_SIZE || drawH < OUTPUT_SIZE)) {
    // Blur without canvas filters (not in every browser): shrink a
    // square crop to a few pixels, then stretch it back up smoothly.
    const TINY = 20;
    const tiny = document.createElement("canvas");
    tiny.width = TINY;
    tiny.height = TINY;
    const tctx = tiny.getContext("2d");
    if (tctx) {
      const side = Math.min(drawW, drawH);
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = "high";
      tctx.drawImage(photo, (drawW - side) / 2, (drawH - side) / 2, side, side, 0, 0, TINY, TINY);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(tiny, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    }
  }
  ctx.drawImage(
    photo,
    Math.round((OUTPUT_SIZE - drawW) / 2),
    Math.round((OUTPUT_SIZE - drawH) / 2)
  );

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
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
