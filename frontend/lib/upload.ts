/**
 * lib/upload.ts
 * Client-side image upload for the member photo (registration + profile edit).
 *
 * Mock/demo mode: the image is resized on a canvas and kept as a data URL so the
 * ID card and profile work end-to-end without a backend.
 *
 * Production mode (NEXT_PUBLIC_API_URL set): fetch a one-time signed signature
 * from POST /api/upload/cloudinary-signature, then upload to Cloudinary with the
 * unsigned-upload API so the API secret never reaches the browser.
 */

import { apiGetCloudinarySignature } from "@/lib/api";

const MAX_DIMENSION = 600;
const JPEG_QUALITY = 0.85;

const isRealBackend = () =>
  !!process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0;

/** Downscale + compress an image file, returning a data URL (best-effort). */
export function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = url;
  });
}

/**
 * Upload a photo and return a URL to store on the member/photocard.
 * Real path: signed Cloudinary upload. If Cloudinary is not configured yet
 * (invalid cloud name), fall back to the resized data URL with a warning so
 * registration and the ID card keep working end-to-end.
 */
export async function uploadMemberPhoto(file: File): Promise<string> {
  if (!isRealBackend()) {
    return fileToResizedDataUrl(file);
  }

  // Real path: signed Cloudinary upload.
  try {
    const sigRes = await apiGetCloudinarySignature("members");
    const sig = sigRes.data;
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("signature", sig.signature);
    form.append("folder", sig.folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
      { method: "POST", body: form }
    );
    const json = await res.json();
    if (!res.ok || !json.secure_url) {
      throw new Error(json.error?.message ?? "Image upload failed");
    }
    return json.secure_url as string;
  } catch (err) {
    console.warn(
      "Cloudinary upload unavailable (" + (err instanceof Error ? err.message : "error") + ") — falling back to a local data URL."
    );
    return fileToResizedDataUrl(file);
  }
}