"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, FlipHorizontal2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { MemberCardFront, MemberCardBack } from "@/components/id/MemberIdCard";
import { loadMember } from "@/lib/api";
import type { Member } from "@/lib/types";
import { IdCardSkeleton } from "@/components/skeletons/PageSkeletons";

type CardFace = "front" | "back";

/**
 * Swap every remote <img> under `root` for an inline data URL so html-to-image
 * never has to re-fetch a cross-origin URL (Cloudinary photo) during export,
 * which is what made exported cards render without the profile picture.
 * Restores the original src after the caller is done.
 */
async function inlineImagesForExport(root: HTMLElement): Promise<() => void> {
  const swaps: Array<{ img: HTMLImageElement; original: string }> = [];
  const pending: Promise<void>[] = [];

  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!/^https?:\/\//i.test(src)) return;
    swaps.push({ img, original: src });
    pending.push(
      (async () => {
        try {
          const res = await fetch(src, { mode: "cors", cache: "force-cache" });
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          img.setAttribute("src", dataUrl);
        } catch {
          /* keep the original src — export may still work without it */
        }
      })()
    );
  });

  await Promise.all(pending);

  return () => {
    for (const { img, original } of swaps) img.setAttribute("src", original);
  };
}

export default function IdCardPage() {
  const [member, setMember]           = useState<Member | null>(null);
  const [loading, setLoading]         = useState(true);
  const [facing, setFacing]           = useState<CardFace>("front");
  const [downloading, setDownloading] = useState(false);
  const [error, setError]             = useState("");

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const m = await loadMember();
      setMember(m);
      setLoading(false);
    })();
  }, []);

  async function handleDownload() {
    const node = facing === "front" ? frontRef.current : backRef.current;
    if (!member || !node) return;
    setDownloading(true);
    setError("");
    let restore: (() => void) | null = null;
    try {
      // Inline remote images (profile photo) so toPng doesn't re-fetch a
      // cross-origin URL, then export whichever face is currently showing.
      restore = await inlineImagesForExport(node);
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tssosa-id-${facing}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the image");
    } finally {
      restore?.();
      setDownloading(false);
    }
  }

  if (loading) {
    return <IdCardSkeleton />;
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Your Member ID Card
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Flip to inspect both sides, then download the card as a PNG image.
        </p>
      </div>

      {/* Flip card — front/back faces share one grid cell for a clean 3D flip */}
      <div className="relative w-full max-w-md [perspective:1500px]">
        <div
          className={`relative grid transition-transform duration-500 [transform-style:preserve-3d] ${
            facing === "back" ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          <div ref={frontRef} className="[grid-area:1/1] [backface-visibility:hidden]">
            <MemberCardFront member={member!} />
          </div>
          <div className="[grid-area:1/1] [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div ref={backRef}>
              <MemberCardBack member={member!} />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 w-full max-w-md">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="outline" onClick={() => setFacing((f) => (f === "front" ? "back" : "front"))}>
            <FlipHorizontal2 size={16} />
            Flip to {facing === "front" ? "Back" : "Front"}
          </Button>
          <Button onClick={handleDownload} loading={downloading}>
            <Download size={16} />
            Download {facing === "front" ? "Front" : "Back"} (PNG)
          </Button>
        </div>
        {error && (
          <p className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] rounded-lg px-4 py-2">
            Download failed: {error}
          </p>
        )}
      </div>
    </div>
  );
}