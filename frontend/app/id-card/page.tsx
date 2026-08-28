"use client";

import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, FlipHorizontal2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { MemberCardFront, MemberCardBack } from "@/components/id/MemberIdCard";
import { apiMe } from "@/lib/api";
import type { Member } from "@/lib/types";

type CardFace = "front" | "back";

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
      const res = await apiMe();
      setMember(res.data.member);
      setLoading(false);
    })();
  }, []);

  async function handleDownload() {
    const node = facing === "front" ? frontRef.current : backRef.current;
    if (!member || !node) return;
    setDownloading(true);
    setError("");
    try {
      // Export whichever face is currently showing — entirely client-side.
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `tssosa-id-${facing}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the image");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
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