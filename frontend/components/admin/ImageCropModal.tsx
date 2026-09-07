"use client";

import { useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import Button from "@/components/ui/Button";
import { X } from "lucide-react";

interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  title: string;
  /** Crop aspect locked in — 3/4 (portrait) for both cover and gallery. */
  aspect: number;
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}

const OUTPUT_WIDTH = 1200;

/** Draw the cropped area (original-image pixels) onto a canvas at a fixed
 *  output resolution matching the aspect, then return it as a JPEG File. */
async function cropToFile(
  source: File,
  areaPixels: Area,
  aspect: number
): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(source);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load image"));
    i.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = Math.round(OUTPUT_WIDTH / aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode image"));
          return;
        }
        const name = source.name.replace(/\.[^.]+$/, "") || "image";
        resolve(new File([blob], `${name}-crop.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  });
}

/**
 * Owns the interoperable crop state for a single image. Keyed by the file URL
 * in the parent so switching files remounts it, resetting crop + zoom without
 * any setState-in-effect.
 */
function CropBody({
  srcUrl,
  aspect,
  onAreaChange,
}: {
  srcUrl: string;
  aspect: number;
  onAreaChange: (areaPixels: Area | null) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  return (
    <>
      <div className="relative h-80 bg-black">
        <Cropper
          image={srcUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          showGrid
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, px) => onAreaChange(px)}
        />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <span className="text-[var(--text-muted)] shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={4}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[var(--primary)]"
        />
      </label>
    </>
  );
}

export default function ImageCropModal({
  open,
  file,
  title,
  aspect,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving]         = useState(false);

  const srcUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : ""),
    [file]
  );

  // Clean up the object URL when the opened file changes or unmounts.
  useEffect(() => {
    return () => {
      if (srcUrl) URL.revokeObjectURL(srcUrl);
    };
  }, [srcUrl]);

  if (!open || !file) return null;

  async function handleConfirm() {
    if (!areaPixels || saving || !file) return;
    setSaving(true);
    try {
      const cropped = await cropToFile(file, areaPixels, aspect);
      onConfirm(cropped);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-xl rounded-[var(--radius-card)] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-base)] hover:text-[var(--text-heading)] cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cropper — keyed by URL so each new file starts fresh */}
        <CropBody key={srcUrl || "empty"} srcUrl={srcUrl} aspect={aspect} onAreaChange={setAreaPixels} />

        {/* Body + actions */}
        <div className="px-5 pb-4 flex flex-col gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            Drag to frame the photo — it will be cropped to a portrait 3:4 ratio
            before uploading.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleConfirm}>
              Crop & Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}