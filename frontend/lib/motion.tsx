"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// ── Shared animation vocabulary ─────────────────────────────────────────────
// Used across public pages so the motion feel stays consistent (like the
// digi-exp project). Everything is scroll-triggered (whileInView) and purely
// presentational — no logic or data is affected.

export const VIEWPORT = { once: true, amount: 0.2 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

export const fadeRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
};

// Parent/child stagger: parent sets the stagger delay, children inherit.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

// ── Reusable wrappers ───────────────────────────────────────────────────────

type RevealProps = {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
};

/** Scroll-triggered fade-up reveal (motion.div). Defaults to fadeUp. */
export function Reveal({ children, className, variants = fadeUp, delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Container that staggers its <StaggerItem> children on scroll into view. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

/** Single item to be placed inside a <Stagger>. Inherits the parent's stagger. */
export function StaggerItem({
  children,
  className,
  variants = fadeUp,
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

// ── CSS-enhancing utilities (pure presentation) ─────────────────────────────

/** Hoverable sheen + lift used on cards: a diagonal light sweep on hover. */
export const sheenClass =
  "relative overflow-hidden transition-all duration-300 hover:-translate-y-1 " +
  "hover:shadow-[0_12px_30px_-8px_rgba(124,111,209,0.35)] " +
  "after:absolute after:inset-0 after:translate-x-[-150%] after:bg-gradient-to-r " +
  "after:from-transparent after:via-white/40 after:to-transparent hover:after:translate-x-[150%] " +
  "after:transition-transform after:duration-700";
