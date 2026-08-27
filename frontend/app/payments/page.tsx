"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Receipt,
} from "lucide-react";
import {
  apiGetDuesSummary,
  apiGetDuesHistory,
  apiGetPaymentHistory,
  apiInitiateRegistration,
  apiPayDues,
  apiVerifyRegistration,
  apiVerifyDues,
} from "@/lib/api";
import type { DuesSummary, DuesPayment, Payment, DuesCycleStatus } from "@/lib/types";
import { formatNaira, formatDate } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function duesStatusToPill(
  status: DuesCycleStatus["status"]
): "paid" | "pending" | "overdue" {
  if (status === "paid")    return "paid";
  if (status === "arrears") return "overdue";
  return "pending"; // partial, unpaid
}

function paymentStatusToPill(
  status: Payment["status"]
): "paid" | "pending" | "overdue" {
  if (status === "success") return "paid";
  if (status === "failed")  return "overdue";
  return "pending";
}

// ─── Processing state banner ──────────────────────────────────────────────────

function ProcessingBanner({ reference, type }: { reference: string; type: "reg" | "dues" }) {
  const [status, setStatus] = useState<"processing" | "confirmed" | "failed">("processing");

  useEffect(() => {
    // Spec: no polling — call verify once on mount to get current state,
    // then display "processing" until webhook updates the record.
    // In production the page will refresh / receive a push when the webhook fires.
    const check = async () => {
      try {
        if (type === "reg") {
          const res = await apiVerifyRegistration(reference);
          if (res.data.status === "success") setStatus("confirmed");
          else if (res.data.status === "failed") setStatus("failed");
          // pending → stay in "processing"
        } else {
          const res = await apiVerifyDues(reference);
          if (res.data.status === "paid") setStatus("confirmed");
          else if (res.data.status === "arrears") setStatus("failed");
        }
      } catch {
        // network error — stay processing
      }
    };
    check();
  }, [reference, type]);

  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-3 bg-[var(--success-bg)] border border-[var(--success)]/20 rounded-xl px-5 py-4 text-[#166534]">
        <CheckCircle2 size={22} className="shrink-0" />
        <div>
          <p className="font-semibold">Payment confirmed!</p>
          <p className="text-sm opacity-75 mt-0.5">Your payment has been received and your records have been updated.</p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-xl px-5 py-4 text-[var(--danger)]">
        <AlertCircle size={22} className="shrink-0" />
        <div>
          <p className="font-semibold">Payment could not be confirmed</p>
          <p className="text-sm opacity-75 mt-0.5">Please contact support if you were charged. Ref: {reference}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--warning-bg)] border border-[var(--warning)]/20 rounded-xl px-5 py-4 text-[#92400E]">
      <Loader2 size={22} className="shrink-0 animate-spin" />
      <div>
        <p className="font-semibold">Processing your payment…</p>
        <p className="text-sm opacity-75 mt-0.5">
          We're waiting for confirmation from Paystack. This usually takes a few seconds. Do not refresh. Ref: {reference}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PaymentsContent() {
  const searchParams = useSearchParams();

  // ?status=success&reference=REG_xxx   → post registration redirect
  // ?dues=success&reference=DUES_xxx    → post dues payment redirect
  const returnStatus    = searchParams.get("status");
  const duesReturn      = searchParams.get("dues");
  const returnReference = searchParams.get("reference");

  const [dues, setDues]         = useState<DuesSummary | null>(null);
  const [duesHistory, setDuesHistory] = useState<DuesPayment[]>([]);
  const [regHistory, setRegHistory]   = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [payingCycle, setPayingCycle] = useState<string | null>(null);
  const [initiatingReg, setInitiatingReg] = useState(false);

  useEffect(() => {
    (async () => {
      const [dRes, dhRes, rhRes] = await Promise.all([
        apiGetDuesSummary(),
        apiGetDuesHistory(),
        apiGetPaymentHistory(),
      ]);
      setDues(dRes.data);
      setDuesHistory(dhRes.data);
      setRegHistory(rhRes.data);
      setLoading(false);
    })();
  }, []);

  // ── Registration fee payment ──────────────────────────────────────────────

  async function handlePayRegistration() {
    setInitiatingReg(true);
    try {
      const res = await apiInitiateRegistration(
        `${window.location.origin}/payments?status=success&reference=`
      );
      window.location.href = res.data.authorization_url;
    } finally {
      setInitiatingReg(false);
    }
  }

  // ── Dues payment ──────────────────────────────────────────────────────────

  async function handlePayDues(cycleId: string) {
    setPayingCycle(cycleId);
    try {
      const res = await apiPayDues(
        cycleId,
        `${window.location.origin}/payments?dues=success&reference=`
      );
      window.location.href = res.data.authorization_url;
    } finally {
      setPayingCycle(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Has member paid registration fee?
  const regPaid = regHistory.some((p) => p.payment_type === "registration_fee" && p.status === "success");

  const unpaidDuesCycles = dues?.cycles.filter(
    (c) => c.status !== "paid"
  ) ?? [];

  return (
    <div className="flex flex-col gap-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Dues & Payments
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Manage your registration fee and annual dues payments.
        </p>
      </div>

      {/* ── Post-payment processing banner ──────────────────────────────────── */}
      {returnReference && (returnStatus === "success" || duesReturn === "success") && (
        <ProcessingBanner
          reference={returnReference}
          type={duesReturn === "success" ? "dues" : "reg"}
        />
      )}

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Dues Paid",
            value:  formatNaira(dues?.total_paid ?? 0),
            icon:   TrendingUp,
            color:  "var(--success)",
            bg:     "var(--success-bg)",
          },
          {
            label: "Outstanding Dues",
            value:  formatNaira(dues?.outstanding ?? 0),
            icon:   AlertCircle,
            color:  dues?.outstanding ? "var(--warning)" : "var(--success)",
            bg:     dues?.outstanding ? "var(--warning-bg)" : "var(--success-bg)",
          },
          {
            label: "Registration Fee",
            value:  regPaid ? "Paid" : "Unpaid",
            icon:   CreditCard,
            color:  regPaid ? "var(--success)" : "var(--warning)",
            bg:     regPaid ? "var(--success-bg)" : "var(--warning-bg)",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-[var(--text-muted)] font-medium">{label}</p>
                <p className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mt-1">
                  {value}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: bg }}
              >
                <Icon size={20} style={{ color }} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Registration fee section ─────────────────────────────────────────── */}
      {!regPaid && (
        <Card>
          <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
            <Receipt size={18} className="text-[var(--warning)]" />
            Registration Fee
          </h2>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Your one-time registration fee is outstanding. You must pay this before full membership features are unlocked. The amount will be confirmed by the server.
          </p>
          <Button
            loading={initiatingReg}
            onClick={handlePayRegistration}
            className="flex items-center gap-2"
          >
            Pay Registration Fee <ExternalLink size={15} />
          </Button>
          <p className="text-xs text-[var(--text-muted)] mt-3">
            You'll be redirected to Paystack. Return here after payment to see your status.
          </p>
        </Card>
      )}

      {/* ── Outstanding dues ──────────────────────────────────────────────────── */}
      {unpaidDuesCycles.length > 0 ? (
        <Card>
          <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-[var(--warning)]" />
            Outstanding Dues
          </h2>
          <div className="flex flex-col gap-4">
            {unpaidDuesCycles.map((cs) => (
              <div
                key={cs.cycle.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)]"
              >
                <div>
                  <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-sm">
                    {cs.cycle.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Due: {formatDate(cs.cycle.due_date)} · {cs.cycle.cycle_type === "term" ? "Term" : "Annual"}
                  </p>
                  {cs.dues_payment && cs.dues_payment.amount_paid > 0 && (
                    <p className="text-xs text-[var(--warning)] mt-0.5">
                      Paid so far: {formatNaira(cs.dues_payment.amount_paid)} of {formatNaira(cs.cycle.amount)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                      {formatNaira(cs.cycle.amount)}
                    </p>
                    <StatusPill status={duesStatusToPill(cs.status)} className="mt-1" />
                  </div>
                  <Button
                    size="sm"
                    loading={payingCycle === cs.cycle.id}
                    onClick={() => handlePayDues(cs.cycle.id)}
                    className="shrink-0"
                  >
                    Pay Now <ExternalLink size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            Payment amounts are set by the association and verified server-side. You'll be redirected to Paystack to complete payment securely.
          </p>
        </Card>
      ) : regPaid && (
        <Card className="flex items-center gap-4 p-5 bg-[var(--success-bg)] border-0">
          <CheckCircle2 size={28} className="text-[var(--success)] shrink-0" />
          <div>
            <p className="font-[family-name:var(--font-heading)] font-semibold text-[#166534]">
              All dues are paid!
            </p>
            <p className="text-sm text-[#166534]/70 mt-0.5">
              You're fully up to date. Thank you for supporting the association.
            </p>
          </div>
        </Card>
      )}

      {/* ── Dues payment history ──────────────────────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
            Dues Payment History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {["Cycle", "Amount Billed", "Amount Paid", "Date", "Reference", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {duesHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">
                    No dues payment records yet.
                  </td>
                </tr>
              ) : (
                duesHistory.map((dp) => (
                  <tr
                    key={dp.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-base)] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-[var(--text-heading)] whitespace-nowrap">
                      {dp.cycle_title ?? dp.dues_cycle_id}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)]">
                      {formatNaira(dp.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)]">
                      {formatNaira(dp.amount_paid)}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                      {dp.paid_at ? formatDate(dp.paid_at) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] font-mono text-xs whitespace-nowrap">
                      {dp.paystack_reference || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill
                        status={
                          dp.status === "paid"
                            ? "paid"
                            : dp.status === "arrears"
                            ? "overdue"
                            : "pending"
                        }
                        label={dp.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Registration fee history ──────────────────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
            Registration Fee History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {["Type", "Amount", "Date", "Reference", "Status"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">
                    No registration payment on record yet.
                  </td>
                </tr>
              ) : (
                regHistory.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-base)] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-[var(--text-heading)] capitalize">
                      {p.payment_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)]">
                      {formatNaira(p.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                      {p.paid_at ? formatDate(p.paid_at) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] font-mono text-xs whitespace-nowrap">
                      {p.paystack_reference}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={paymentStatusToPill(p.status)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}
