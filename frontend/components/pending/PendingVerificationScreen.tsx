"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Clock, CreditCard, AlertCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SignOutButton from "@/components/layout/SignOutButton";
import { apiGetPaymentHistory, apiInitiateRegistration, ApiRequestError } from "@/lib/api";
import type { Payment } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export default function PendingVerificationScreen() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  useEffect(() => {
    let active = true;
    apiGetPaymentHistory()
      .then((res) => {
        if (active) setPayments(res.data);
      })
      .catch(() => {
        if (active) setPayments([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const regPayment = payments?.find((p) => p.payment_type === "registration_fee");
  const paid = regPayment?.status === "success";

  async function handlePay() {
    setPaying(true);
    setPayError("");
    try {
      const res = await apiInitiateRegistration();
      window.location.assign(res.data.authorization_url);
    } catch (err) {
      setPayError(
        err instanceof ApiRequestError && err.status === 409
          ? "You already have a payment in progress. Finish it from your email receipt or try again in a few minutes."
          : err instanceof Error
          ? err.message
          : "Unable to start payment. Please try again."
      );
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="flex items-center justify-center py-10">
      <Card className="max-w-lg w-full p-8 text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--warning-bg)] flex items-center justify-center">
          {paid ? (
            <ShieldCheck size={28} className="text-[var(--success)]" />
          ) : (
            <Clock size={28} className="text-[#92400E]" />
          )}
        </div>

        <div>
          <h1 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Your account is under review
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            An admin needs to verify your registration before your dashboard unlocks.
          </p>
        </div>

        {payments === null ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
            <span className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            Checking payment status…
          </div>
        ) : paid ? (
          <div className="w-full text-left flex items-start gap-3 bg-[var(--success-bg)] border border-[var(--success)]/20 rounded-xl px-5 py-4 text-[#166534]">
            <ShieldCheck size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Payment received</p>
              <p className="text-sm opacity-80 mt-0.5">
                Your registration is now awaiting admin approval. You&apos;ll receive an email
                once your account is verified.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-3">
            {regPayment?.status === "failed" || regPayment?.status === "abandoned" ? (
              <div className="flex items-start gap-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-xl px-5 py-4 text-[var(--danger)]">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm">
                  Your previous payment attempt didn&apos;t go through. Complete the one-time
                  registration fee below to continue.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-[var(--warning-bg)] border border-[var(--warning)]/20 rounded-xl px-5 py-4 text-[#92400E]">
                <CreditCard size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm">
                  Your registration isn&apos;t complete yet — the one-time registration fee
                  {regPayment?.amount ? ` (${formatNaira(regPayment.amount / 100)})` : ""} is
                  outstanding.
                </p>
              </div>
            )}

            <Button size="lg" fullWidth disabled={paying} onClick={handlePay}>
              {paying ? "Opening Paystack…" : "Pay registration fee"}
            </Button>

            {payError && (
              <p className="text-sm font-medium text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-lg px-4 py-3 text-left">
                {payError}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 w-full justify-center">
          <SignOutButton />
        </div>
      </Card>
    </div>
  );
}