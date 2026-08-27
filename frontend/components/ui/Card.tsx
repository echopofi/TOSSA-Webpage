import clsx from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm:   "p-4",
  md:   "p-5 md:p-6",
  lg:   "p-6 md:p-8",
};

export default function Card({
  padding = "md",
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={clsx(
        "bg-[var(--surface-card)] rounded-[var(--radius-card)]",
        "border border-[var(--border-subtle)] shadow-[var(--shadow-card)]",
        paddingMap[padding],
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
