import { forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "input",
            error && "error",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...rest}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-[var(--danger)] mt-0.5"
            role="alert"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
