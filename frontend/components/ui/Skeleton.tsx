import clsx from "clsx";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base skeleton placeholder — a shimmering greyed-out block that matches the
 * design system (surface/border tokens from globals.css). Compose the smaller
 * helpers below to mirror the eventual layout of a page.
 */
export function Skeleton({ className, ...rest }: SkeletonProps) {
  return <div aria-hidden="true" className={clsx("skeleton", className)} {...rest} />;
}

/** A short text line. */
export function SkText({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-3 rounded", className)} />;
}

/** A heading-sized block. */
export function SkTitle({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-5 rounded-md", className)} />;
}

/** An input-shaped block. */
export function SkInput({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-10 rounded-lg", className)} />;
}

/** A button-shaped block. */
export function SkButton({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-10 rounded-lg", className)} />;
}

/** A status-pill-shaped block. */
export function SkPill({ className }: { className?: string }) {
  return <Skeleton className={clsx("h-6 w-20 rounded-full", className)} />;
}

/** A circular (avatar / icon) block. */
export function SkCircle({ className }: { className?: string }) {
  return <Skeleton className={clsx("rounded-full", className)} />;
}

/** An image / accent block. */
export function SkImage({ className }: { className?: string }) {
  return <Skeleton className={clsx("rounded-xl", className)} />;
}