"use client";

import Link from "next/link";
import { useState } from "react";
import { UsersRound, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { EXCO_MEMBERS, initials } from "@/lib/exco-data";

/** Photo with graceful fallback to an initials monogram — mirrors the /exco page. */
function Photo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white">
        <span className="text-lg font-[family-name:var(--font-heading)] font-semibold">
          {initials(alt)}
        </span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />;
}

/** Small photo grid of the real National Exco committee for dashboard surfaces. */
export default function NationalExcoStrip() {
  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
          <UsersRound size={18} className="text-[var(--primary)]" /> National Exco
        </h2>
        <Link
          href="/exco"
          className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
        >
          Full page <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
        {EXCO_MEMBERS.map((m) => (
          <Link
            key={m.id}
            href="/exco"
            className="group flex flex-col items-center gap-2 min-w-0"
          >
            <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-[var(--border-subtle)] group-hover:ring-2 group-hover:ring-[var(--primary)] transition-all">
              <Photo src={m.image} alt={m.name} />
            </div>
            <div className="w-full text-center min-w-0">
              <p className="text-xs font-semibold text-[var(--text-heading)] leading-snug truncate">
                {m.name}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">{m.position}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}