"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Users } from "lucide-react";
import type { GraduationSet } from "@/lib/types";
import { apiGetSets } from "@/lib/api";

type SetStripProps = { sets?: GraduationSet[] };

const ROTATE_MS = 3400;

const stripSlide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60, transition: { duration: 0.3, ease: "easeIn" } }),
};

/**
 * Home-page "sets strip": shows one graduating set at a time and auto-rotates
 * with a smooth slide transition. Data source is the live GET /api/sets feed
 * (real covers, captions, descriptions) so the highlight reel reflects the DB,
 * not placeholder mock content.
 *
 * Missing-data handling:
 *  - Sets without a cover image are skipped for the rotation when any sets have
 *    one; if no set has a cover yet, the gradient fallback tile is used so the
 *    strip still renders.
 *  - No sets / fetch failure hides the strip entirely (the section header and
 *    "See all sets" CTA remain rendered by the parent).
 */
export default function SetStrip({ sets: staticSets }: SetStripProps) {
  const [sets, setSets] = useState<GraduationSet[]>(staticSets ?? []);
  const [fanned, setFanned] = useState(!!staticSets);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (staticSets) return; // static sets provided by caller — nothing to fetch
    let cancelled = false;
    apiGetSets()
      .then((r) => {
        if (cancelled) return;
        setSets(r.data);
        setFanned(true);
      })
      .catch(() => {
        /* network/API failure → hide the strip, don't crash */
      });
    return () => {
      cancelled = true;
    };
  }, [staticSets]);

  // Skip coverless sets for the highlight rotation (they'd show a bare tile);
  // if none have a cover, fall back to all sets so the strip always has content.
  const withCover = sets.filter((s) => s.cover_image);
  const rotation = withCover.length > 0 ? withCover : sets;
  const ready = fanned && rotation.length > 0;

  const pickRandom = useCallback(() => {
    setIndex((prev) => {
      if (rotation.length <= 1) return prev;
      let next = prev;
      while (next === prev) next = Math.floor(Math.random() * rotation.length);
      setDir(next > prev ? 1 : -1);
      return next;
    });
  }, [rotation.length]);

  const step = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((prev) => (prev + delta + rotation.length) % rotation.length);
    },
    [rotation.length],
  );

  useEffect(() => {
    if (!ready || paused) return;
    timerRef.current = setTimeout(pickRandom, ROTATE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, ready, paused, pickRandom]);

  if (!ready) return null;

  const safeIndex = rotation.length > 0 ? index % rotation.length : 0;
  const set = rotation[safeIndex];
  if (!set) return null;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative overflow-hidden rounded-[var(--radius-card)]" aria-live="polite">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={set.id}
            custom={dir}
            variants={stripSlide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div className="card p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 md:gap-10 items-center">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-semibold">
                  <GraduationCap size={13} /> Class of {set.set_name}
                </span>
                <p className="mt-4 text-sm md:text-base text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
                  {set.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Users size={14} /> {set.member_count ?? 0} members
                  </span>
                  <Link
                    href={`/sets/${set.id}`}
                    className="text-sm font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    View set <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="hidden sm:block h-32 md:h-40 w-32 md:w-44 shrink-0">
                {set.cover_image ? (
                  <div className="relative w-full h-full rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={set.cover_image}
                      alt={`Class of ${set.set_name}`}
                      className="w-full h-full object-cover"
                    />
                    {set.cover_image_caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/55 backdrop-blur-sm px-2 py-1">
                        <p className="text-white text-[11px] font-medium truncate">
                          {set.cover_image_caption}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white">
                    <span className="text-xl font-[family-name:var(--font-heading)] font-semibold text-white/80">
                      Set
                    </span>
                    <span className="text-5xl font-[family-name:var(--font-heading)] font-semibold">
                      {set.set_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => step(-1)}
            aria-label="Previous set"
            className="h-10 w-10 flex items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Next set"
            className="h-10 w-10 flex items-center justify-center rounded-full border border-[var(--border-subtle)] text-[var(--text-body)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {String(safeIndex + 1).padStart(2, "0")} / {rotation.length}
        </span>
      </div>
    </div>
  );
}