"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UsersRound, ChevronLeft, ChevronRight } from "lucide-react";
import { EXCO_MEMBERS, initials } from "@/lib/exco-data";
import { Reveal, fadeUp } from "@/lib/motion";

const COUNT = EXCO_MEMBERS.length;

/** Offset of member i relative to the focused index (-2 … 2, wrapping). */
function relativeOffset(index: number, focus: number): number {
  const n = COUNT;
  let d = (index - focus) % n;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

/** Photo with graceful fallback to an initials monogram until real photos
 *  are dropped into public/assets/exco/. */
function ExcoPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white">
        <span className="text-3xl font-[family-name:var(--font-heading)] font-semibold">{initials(alt)}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} onError={() => setFailed(true)} className="w-full h-full object-cover" />;
}

function ExcoCard({ member, offset }: {
  member: (typeof EXCO_MEMBERS)[number];
  offset: number;
}) {
  const isCenter = offset === 0;
  const left = offset < 0;

  const gap = 0.08; // equal visual gap between each adjacent pair (in card-width units)
  const s0 = 1;                      // center scale
  const s1 = Math.pow(0.72, 1);      // ±1 scale
  const s2 = Math.pow(0.72, 2);      // ±2 scale
  const pos1 = (s0 / 2 + s1 / 2 + gap) * 100; // center-to-±1 distance as %
  const pos2 = pos1 + (s1 / 2 + s2 / 2 + gap) * 100; // center-to-±2 distance as %
  const xMap: Record<number, string> = {
    0: "0%",
    1: `${pos1}%`,
    "-1": `-${pos1}%`,
    2: `${pos2}%`,
    "-2": `-${pos2}%`,
  };
  const x = xMap[offset] ?? (offset < 0 ? `-${pos2 + 100}%` : `${pos2 + 100}%`);
  const rotate = 0;

  return (
    <motion.div
      animate={{
        x,
        rotate,
        scale: isCenter ? 1 : Math.pow(0.72, Math.abs(offset)),
        opacity: Math.abs(offset) > 2 ? 0 : isCenter ? 1 : 0.9,
        zIndex: isCenter ? 30 : 20 - Math.abs(offset) * 5,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="absolute left-1/2 top-[10%] w-36 md:w-52 lg:w-56"
      aria-hidden={!isCenter}
    >
      <div
        className={`card overflow-hidden ${isCenter ? "" : "pointer-events-none"} ${
          Math.abs(offset) > 2 ? "invisible" : ""
        }`}
        style={{ transform: "translateX(-50%)" }}
      >
        <div className="aspect-[3/4]">
          <ExcoPhoto src={member.image} alt={member.name} />
        </div>
        <div className={`px-3 py-2.5 text-center ${isCenter ? "" : "opacity-70"}`}>
          <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-sm leading-snug truncate">
            {member.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
            {member.position}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function ExcoPage() {
  const [focus, setFocus] = useState(0);

  // Auto-advance every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFocus((prev) => (prev + 1 + COUNT) % COUNT);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const go = (delta: number) =>
    setFocus((prev) => (prev + delta + COUNT) % COUNT);

  if (COUNT === 0) {
    return (
      <div className="text-center text-sm text-[var(--text-muted)]">
        The executive committee for this session has not been announced yet.
      </div>
    );
  }

  const focused = EXCO_MEMBERS[focus % COUNT];

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Reveal variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            National Exco
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            The elected executive committee steering the association this session.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <UsersRound size={20} />
        </div>
      </Reveal>

      {/* ── Layered photo carousel ─────────────────────────────────────────── */}
      <div className="relative h-[19rem] sm:h-[24rem] md:h-[26rem] overflow-hidden" aria-live="polite">
        {EXCO_MEMBERS.map((member, i) => (
          <ExcoCard
            key={member.id}
            member={member}
            offset={relativeOffset(i, focus)}
          />
        ))}
      </div>

      {/* ── Focused officer details + controls ─────────────────────────────── */}
      <div className="flex flex-col items-center gap-5">
        <div className="text-center">
          <h2 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            {focused.name}
          </h2>
          <p className="text-sm text-[var(--primary)] font-medium mt-0.5">{focused.position}</p>
          {focused.term && (
            <span className="pill pill-neutral text-[11px] mt-2">Term {focused.term}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => go(-1)}
            aria-label="Previous officer"
            className="h-10 w-10 flex items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs text-[var(--text-muted)] tabular-nums min-w-[3rem] text-center">
            {String(focus + 1).padStart(2, "0")} / {String(COUNT).padStart(2, "0")}
          </span>
          <button
            onClick={() => go(1)}
            aria-label="Next officer"
            className="h-10 w-10 flex items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* ── Note ───────────────────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--text-muted)] text-center">
        Exco members are appointed by the association after each election. Officers change per elected term.
      </p>
    </div>
  );
}