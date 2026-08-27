import { forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  as?: "button";
}

const sizeMap: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-[0.9375rem] gap-2",
  lg: "px-7 py-3 text-base gap-2",
};

const variantMap: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.98] disabled:opacity-55",
  outline:
    "bg-transparent text-[var(--primary)] border border-[var(--primary)] hover:bg-[var(--primary-light)] disabled:opacity-55",
  ghost:
    "bg-transparent text-[var(--text-body)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] disabled:opacity-55",
  danger:
    "bg-[var(--danger)] text-white hover:bg-red-600 disabled:opacity-55",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      children,
      className,
      disabled,
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          "inline-flex items-center justify-center font-[family-name:var(--font-heading)] font-semibold",
          "rounded-lg transition-all duration-150 cursor-pointer select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2",
          sizeMap[size],
          variantMap[variant],
          fullWidth && "w-full",
          (disabled || loading) && "cursor-not-allowed",
          className
        )}
        {...rest}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>Loading…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
