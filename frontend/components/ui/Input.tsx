import { forwardRef, useState } from "react";
import clsx from "clsx";
import { Eye, EyeOff } from "lucide-react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, type = "text", ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const [visible, setVisible] = useState(false);
    const isPassword = type === "password";
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
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && visible ? "text" : type}
            className={clsx(
              "input",
              isPassword && "pr-11",
              error && "error",
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text-heading)] focus:outline-none"
            >
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          )}
        </div>
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