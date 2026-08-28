"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusPill from "@/components/ui/StatusPill";
import {
  Vote,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";
import {
  apiGetElectionPositions,
  apiMyElectionApplications,
  apiApplyForElection,
  apiVerifyElectionApplication,
} from "@/lib/api";
import type { ElectionPosition, ElectionApplication } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

function appStatusToPill(status: ElectionApplication["status"]): "paid" | "pending" | "overdue" {
  if (status === "approved" || status === "submitted") return "paid";
  if (status === "rejected") return "overdue";
  return "pending";
}

// ─── Post-payment confirmation banner ─────────────────────────────────────────

function ApplicationBanner({ reference }: { reference: string }) {
  const [status, setStatus] = useState<"processing" | "confirmed" | "failed">("processing");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiVerifyElectionApplication(reference);
        if (res.data.status === "submitted" || res.data.status === "approved") {
          setStatus("confirmed");
        } else if (res.data.status === "rejected") {
          setStatus("failed");
        }
      } catch {
        // stay processing
      }
    };
    check();
  }, [reference]);

  if (status === "confirmed") {
    return (
      <div className="flex items-center gap-3 bg-[var(--success-bg)] border border-[var(--success)]/20 rounded-xl px-5 py-4 text-[#166534]">
        <CheckCircle2 size={22} className="shrink-0" />
        <div>
          <p className="font-semibold">Application submitted!</p>
          <p className="text-sm opacity-75 mt-0.5">
            Your application fee was received and your contest entry is under review. Ref: {reference}
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex items-center gap-3 bg-[var(--danger-bg)] border border-[var(--danger)]/20 rounded-xl px-5 py-4 text-[var(--danger)]">
        <AlertCircle size={22} className="shrink-0" />
        <div>
          <p className="font-semibold">Application not confirmed</p>
          <p className="text-sm opacity-75 mt-0.5">
            If you were charged, please contact support. Ref: {reference}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-[var(--warning-bg)] border border-[var(--warning)]/20 rounded-xl px-5 py-4 text-[#92400E]">
      <Loader2 size={22} className="shrink-0 animate-spin" />
      <div>
        <p className="font-semibold">Confirming your application…</p>
        <p className="text-sm opacity-75 mt-0.5">
          Waiting for Paystack confirmation. Do not refresh. Ref: {reference}
        </p>
      </div>
    </div>
  );
}

// ─── Apply dialog ─────────────────────────────────────────────────────────────

function ApplyDialog({
  position,
  onClose,
}: {
  position: ElectionPosition;
  onClose: () => void;
}) {
  const [manifesto, setManifesto] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  async function handleApply() {
    setError("");
    setApplying(true);
    try {
      const res = await apiApplyForElection(
        position.id,
        manifesto.trim(),
        `${window.location.origin}/elections?election=success&reference=`
      );
      window.location.href = res.data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
        >
          <X size={18} />
        </button>

        <div className="mb-4">
          <h3 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Apply — {position.title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {position.election_year} session · Application fee {formatNaira(position.fee_amount)}, paid securely via Paystack.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
            Manifesto{" "}
            <span className="text-[var(--text-muted)] font-normal">(optional but recommended)</span>
          </label>
          <textarea
            className="input resize-none"
            rows={5}
            placeholder="Tell members why you are contesting and what you hope to achieve…"
            value={manifesto}
            onChange={(e) => setManifesto(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-xs text-[var(--danger)] mt-3 flex items-center gap-1">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <Button
          className="w-full mt-5"
          loading={applying}
          onClick={handleApply}
          disabled={!manifesto.trim()}
        >
          {manifesto.trim() ? "Proceed to Paystack" : "Write a manifesto to continue"}
          <ArrowRight size={16} />
        </Button>
        <p className="text-[11px] text-[var(--text-muted)] mt-3 text-center">
          Amount is set by the association and verified server-side.
        </p>
      </Card>
    </div>
  );
}

// ─── Page content ─────────────────────────────────────────────────────────────

function ElectionsContent() {
  const searchParams = useSearchParams();
  const returnReference = searchParams.get("reference");

  const [positions, setPositions]       = useState<ElectionPosition[]>([]);
  const [applications, setApplications] = useState<ElectionApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [applyingTo, setApplyingTo]     = useState<ElectionPosition | null>(null);

  useEffect(() => {
    (async () => {
      const [pRes, aRes] = await Promise.all([
        apiGetElectionPositions(),
        apiMyElectionApplications(),
      ]);
      setPositions(pRes.data);
      setApplications(aRes.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Elections & Contest Forms
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Contest for an executive position and serve the association.
        </p>
      </div>

      {returnReference && <ApplicationBanner reference={returnReference} />}

      {/* Open positions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base flex items-center gap-2">
            <Vote size={18} className="text-[var(--primary)]" /> Open Positions
          </h2>
          <span className="pill pill-neutral text-xs">{positions.length} open</span>
        </div>

        {positions.length === 0 ? (
          <Card className="text-center py-10 text-sm text-[var(--text-muted)]">
            No positions are open for applications right now.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {positions.map((p) => {
              const applied = applications.find((a) => a.position_id === p.id);
              return (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
                        {p.title}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {p.election_year} session · Application fee {formatNaira(p.fee_amount)}
                      </p>
                    </div>
                    {applied && (
                      <StatusPill status={appStatusToPill(applied.status)} label={applied.status.replace(/_/g, " ")} />
                    )}
                  </div>
                  {applied ? (
                    <p className="text-xs text-[var(--text-muted)] mt-4 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-[var(--success)]" />
                      You have already applied for this position.
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-4 flex items-center gap-1.5"
                      onClick={() => setApplyingTo(p)}
                    >
                      Apply Now <ExternalLink size={14} />
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-[var(--text-muted)] mt-4">
          Apply by paying the contest fee via Paystack. Your application is then reviewed by the
          association. Application fees are set per position by the admin; amounts are always
          confirmed by the server before payment.
        </p>
      </section>

      {/* My applications */}
      <section>
        <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base mb-4">
          My Applications
        </h2>
        <Card padding="none">
          {applications.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
              You have not applied for any position yet.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {applications.map((a) => (
                <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-heading)]">
                        {a.position.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {a.position.election_year} · Fee {formatNaira(a.position.fee_amount)} · Applied{" "}
                        {new Date(a.applied_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusPill status={appStatusToPill(a.status)} label={a.status.replace(/_/g, " ")} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* What happens next */}
      <Card className="bg-[var(--primary-light)] border-0">
        <h3 className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--primary)] mb-2">
          How it works
        </h3>
        <ul className="text-xs text-[var(--text-muted)] space-y-1.5 list-disc pl-4">
          <li>Pay the position&apos;s application fee to submit your contest form.</li>
          <li>The association reviews each application before the election.</li>
          <li>
            Being <em>approved</em> as a candidate does not mean you have won — winners are
            appointed to the Exco after the election.
          </li>
        </ul>
      </Card>

      {applyingTo && (
        <ApplyDialog position={applyingTo} onClose={() => setApplyingTo(null)} />
      )}
    </div>
  );
}

export default function ElectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ElectionsContent />
    </Suspense>
  );
}