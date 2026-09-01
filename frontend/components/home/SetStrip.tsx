"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Users } from "lucide-react";
import type { GraduationSet } from "@/lib/types";

type SetStripProps = { sets: GraduationSet[] };

const ROTATE_MS = 3400;

const stripSlide: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60, transition: { duration: 0.3, ease: "easeIn" } }),
};

/**
 * Home-page "sets strip": shows one graduating set at a time and auto-rotates
 * through random sets with a smooth slide transition. A "See all sets" CTA
 * (rendered by the parent) links to /sets, which lists every set.
 */
export default function SetStrip({ sets }: SetStripProps) {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pickRandom = useCallback(() => {
    setIndex((prev) => {
      if (sets.length <= 1) return prev;
      let next = prev;
      while (next === prev) next = Math.floor(Math.random() * sets.length);
      setDir(next > prev ? 1 : -1);
      return next;
    });
  }, [sets.length]);

  const step = useCallback(
    (delta: number) => {
      setDir(delta);
      setIndex((prev) => (prev + delta + sets.length) % sets.length);
    },
    [sets.length],
  );

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(pickRandom, ROTATE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, paused, pickRandom]);

  const set = sets[index];
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
                <p className="mt-4 text-sm md:text-base text-[var(--text-muted)] leading-relaxed">
                  {set.description}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <Users size={14} /> {set.member_count} members
                  </span>
                  <Link
                    href={`/sets/${set.id}`}
                    className="text-sm font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    View set <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
              <div className="hidden sm:flex h-32 md:h-40 w-32 md:w-44 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white shrink-0">
                <span className="text-xl font-[family-name:var(--font-heading)] font-semibold text-white/80">
                  Set
                </span>
                <span className="text-5xl font-[family-name:var(--font-heading)] font-semibold">
                  {set.set_name}
                </span>
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
          {String(index + 1).padStart(2, "0")} / {sets.length}
        </span>
      </div>
    </div>
  );
}