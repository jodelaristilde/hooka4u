// src/lib/image-storage.ts
//
// Menu photos used to be saved inside the database as long text (a "data:"
// URL), so every phone downloaded every photo again each time the menu
// opened. When Vercel Blob storage is connected to the project (Vercel →
// Storage → Blob, which adds BLOB_READ_WRITE_TOKEN), photos are uploaded
// there instead and only their short web address is saved. Without it,
// everything keeps working the old way.

import { put } from "@vercel/blob";
import { randomUUID } from "crypto";

export function imageStorageEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Turns a "data:image/...;base64,..." photo into a stored file and returns
 * its web address. Anything else (already a web address, empty, or no
 * storage connected) is returned unchanged. */
export async function storeImage(
  image: string | null | undefined,
  site: string
): Promise<string | null | undefined> {
  if (!image || !image.startsWith("data:image/") || !imageStorageEnabled()) return image;

  const match = image.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) return image;
  const contentType = match[1].toLowerCase();
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const bytes = Buffer.from(match[2], "base64");

  try {
    const blob = await put(`menu/${site}/${randomUUID()}.${ext}`, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  } catch (err) {
    // Never lose a photo because storage had a hiccup: keep the old way.
    console.error("Image storage upload failed; saving photo in the database instead:", err);
    return image;
  }
}
