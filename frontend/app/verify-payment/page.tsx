"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { apiVerifyRegistration, ApiRequestError } from "@/lib/api";

type State = "verifying" | "success" | "not_paid" | "error";

function VerifyPaymentContent() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const [state, setState] = useState<State>("verifying");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!reference) {
      setState("error");
      setDetail("No payment reference was provided.");
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await apiVerifyRegistration(reference);
        if (!active) return;
        setState(res.data.status === "success" ? "success" : "not_paid");
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
  }, [reference]);

  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="card max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
          {/* ── Verifying ── */}
          {state === "verifying" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
                <Loader2
                  size={28}
                  className="text-[#92400E] animate-spin"
                />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Verifying payment…
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                We&apos;re confirming your payment with Paystack.
              </p>
            </>
          )}

          {/* ── Success ── */}
          {state === "success" && (
            <>
              <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
                <CheckCircle2 size={28} className="text-[var(--success)]" />
              </div>
              <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                Payment received
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Your registration is now awaiting admin approval. You&apos;ll receive
                an email once your account is verified.
              </p>
              <Link href="/" className="btn-primary">
                Back to homepage
              </Link>
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
                We couldn&apos;t confirm a completed payment. You can complete the
                registration fee later from your dashboard after signing in.
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
                {detail || "Unable to verify payment status. Please try again later."}
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
