"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
} from "lucide-react";
import {
  apiVerifyRegistration,
  apiRequestOtp,
  apiVerifyOtp,
  ApiRequestError,
} from "@/lib/api";
import { saveAccessToken, saveCurrentUser } from "@/lib/session";

type State =
  | "verifying"
  | "otp_sending"
  | "otp_entry"
  | "otp_verifying"
  | "otp_error"
  | "not_paid"
  | "error";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 60;

function VerifyPaymentContent() {
  const params = useSearchParams();
  const router = useRouter();
  const reference = params.get("reference");

  const [state, setState] = useState<State>(reference ? "verifying" : "error");
  const [detail, setDetail] = useState(
    reference ? "" : "No payment reference was provided."
  );
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── OTP code input state ─────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const code = digits.join("");

  // ── Cooldown timer ───────────────────────────────────────────────────────
  function startCooldown() {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldown(RESEND_COOLDOWN_SEC);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Clean up the interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ── Step 2: request OTP ──────────────────────────────────────────────────
  const triggerOtpSend = useCallback(async () => {
    if (!reference) return;
    setState("otp_sending");
    setOtpError("");
    try {
      await apiRequestOtp(reference);
      setState("otp_entry");
      startCooldown();
      // Auto-focus first input after a tick
      setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setState("otp_error");
      setDetail(
        err instanceof Error ? err.message : "Failed to send verification code."
      );
    }
  }, [reference]);

  // ── Step 1: verify payment ───────────────────────────────────────────────
  useEffect(() => {
    if (!reference) return;

    let active = true;
    (async () => {
      try {
        const res = await apiVerifyRegistration(reference);
        if (!active) return;
        if (res.data.status === "success") {
          triggerOtpSend();
        } else {
          setState("not_paid");
        }
      } catch (err) {
        if (!active) return;
        setState(
          err instanceof ApiRequestError && err.status === 404
            ? "not_paid"
            : "error"
        );
        setDetail(
          err instanceof Error ? err.message : "Unable to verify payment status."
        );
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  function updateDigit(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
      const next = [...digits];
      for (let i = 0; i < pasted.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = pasted[i];
      }
      setDigits(next);
      const focusIdx = Math.min(index + pasted.length, CODE_LENGTH - 1);
      setTimeout(() => codeInputRefs.current[focusIdx]?.focus(), 0);
      return;
    }

    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < CODE_LENGTH - 1) {
      setTimeout(() => codeInputRefs.current[index + 1]?.focus(), 0);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      setTimeout(() => codeInputRefs.current[index - 1]?.focus(), 0);
    }
  }

  // ── Step 3: verify OTP ───────────────────────────────────────────────────
  async function handleVerify() {
    if (!reference || code.length !== CODE_LENGTH) return;
    setState("otp_verifying");
    setOtpError("");
    try {
      const res = await apiVerifyOtp(reference, code);
      saveAccessToken(res.data.access_token);
      saveCurrentUser({
        full_name: res.data.user.full_name,
        email: res.data.user.email,
        role: res.data.user.role,
        is_verified: res.data.user.is_verified,
      });
      router.push("/dashboard");
    } catch (err) {
      setState("otp_entry");
      setOtpError(
        err instanceof Error ? err.message : "Verification failed."
      );
      // Clear digits on error so user can re-enter
      setDigits(Array(CODE_LENGTH).fill(""));
      setTimeout(() => codeInputRefs.current[0]?.focus(), 50);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="card max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
          {/* ── Verifying payment ── */}
          {state === "verifying" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
                <Loader2 size={28} className="text-[#92400E] animate-spin" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Verifying payment…
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                We&apos;re confirming your payment with Paystack.
              </p>
            </>
          )}

          {/* ── Sending OTP ── */}
          {state === "otp_sending" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
                <Mail size={28} className="text-[#92400E]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Sending verification code…
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Check your email for a 6-digit code.
              </p>
            </>
          )}

          {/* ── OTP entry ── */}
          {state === "otp_entry" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[var(--success)]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Enter verification code
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                We&apos;ve sent a 6-digit code to your email.
              </p>

              {otpError && (
                <p className="w-full text-left text-sm font-medium text-[var(--danger)] bg-[var(--danger-bg)] px-3 py-2 rounded-lg">
                  {otpError}
                </p>
              )}

              <div className="flex gap-2 mt-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { codeInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={d}
                    onChange={(e) => updateDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
                      if (pasted) updateDigit(i, pasted);
                    }}
                    className="w-12 h-14 text-center text-xl font-mono font-semibold border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text-heading)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={code.length !== CODE_LENGTH}
                className="btn-primary w-full mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify
              </button>

              <button
                onClick={triggerOtpSend}
                disabled={cooldown > 0}
                className="text-sm text-[var(--primary)] hover:underline disabled:text-[var(--text-muted)] disabled:no-underline disabled:cursor-not-allowed"
              >
                {cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Resend code"}
              </button>
            </>
          )}

          {/* ── OTP verifying ── */}
          {state === "otp_verifying" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
                <Loader2 size={28} className="text-[#92400E] animate-spin" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Verifying code…
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                One moment while we confirm your code.
              </p>
            </>
          )}

          {/* ── OTP send failed ── */}
          {state === "otp_error" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--danger-bg)] flex items-center justify-center">
                <AlertCircle size={28} className="text-[var(--danger)]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Failed to send code
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {detail || "Something went wrong while sending the code."}
              </p>
              <button onClick={triggerOtpSend} className="btn-primary w-full">
                Try again
              </button>
            </>
          )}

          {/* ── Not paid / abandoned ── */}
          {state === "not_paid" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
                <AlertCircle size={28} className="text-[#92400E]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                No payment received yet
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                We couldn&apos;t confirm a completed payment. You can complete
                the registration fee later from your dashboard after signing in.
              </p>
              <div className="flex flex-col w-full gap-3 mt-2">
                <Link href="/" className="btn-primary w-full">
                  Back to homepage
                </Link>
                <Link href="/login" className="btn-outline w-full">
                  Sign in
                </Link>
              </div>
            </>
          )}

          {/* ── Error ── */}
          {state === "error" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--danger-bg)] flex items-center justify-center">
                <AlertCircle size={28} className="text-[var(--danger)]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Something went wrong
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {detail ||
                  "Unable to verify payment status. Please try again later."}
              </p>
              <Link href="/" className="btn-primary w-full">
                Back to homepage
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function VerifyPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyPaymentContent />
    </Suspense>
  );
}
