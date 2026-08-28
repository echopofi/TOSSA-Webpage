"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { UserCheck, UserX, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  apiAdminListPendingMembers,
  apiAdminApproveMember,
  apiAdminRejectMember,
} from "@/lib/api";
import type { PendingMember } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function PendingMembersPanel() {
  const [pending, setPending]       = useState<PendingMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [error, setError]           = useState("");
  const [notice, setNotice]         = useState("");
  const [rejectTarget, setRejectTarget] = useState<PendingMember | null>(null);
  const [rejecting, setRejecting]   = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiAdminListPendingMembers();
        setPending(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load pending members.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleApprove(m: PendingMember) {
    setBusyId(m.id);
    setError("");
    setNotice("");
    try {
      const res = await apiAdminApproveMember(m.id);
      setPending((prev) => prev.filter((x) => x.id !== m.id));
      setNotice(`${m.full_name} approved — ${res.data.message ?? "they can now log in."}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    setError("");
    try {
      const res = await apiAdminRejectMember(rejectTarget.id);
      setPending((prev) => prev.filter((x) => x.id !== rejectTarget.id));
      setNotice(`${rejectTarget.full_name} rejected — registration permanently removed.`);
      setRejectTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rejection failed. Please try again.");
      setRejectTarget(null);
    } finally {
      setRejecting(false);
    }
  }

  return (
    <>
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base flex items-center gap-2">
            <Users size={18} className="text-[var(--primary)]" /> Pending Members
          </h2>
          <span className="pill pill-warning text-xs">
            {pending.length} awaiting approval
          </span>
        </div>

        {notice && (
          <div className="flex items-center gap-2 bg-[var(--success-bg)] text-[#166534] rounded-xl mx-5 mt-4 px-4 py-3 text-sm">
            <CheckCircle2 size={16} /> {notice}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-[var(--danger-bg)] text-[var(--danger)] rounded-xl mx-5 mt-4 px-4 py-3 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
            No registrations awaiting approval. New sign-ups appear here for you to review.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {["Registrant", "Set", "Registered", ""].map((h) => (
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
                {pending.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-base)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {m.profile_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.profile_image}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                            {m.full_name?.[0] ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[var(--text-heading)]">{m.full_name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)] whitespace-nowrap">
                      {m.set ? `Class of ${m.set}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDate(m.registered_at, "d MMM yyyy")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busyId === m.id}
                          onClick={() => setRejectTarget(m)}
                        >
                          <UserX size={14} /> Reject
                        </Button>
                        <Button
                          size="sm"
                          loading={busyId === m.id}
                          onClick={() => handleApprove(m)}
                        >
                          <UserCheck size={14} /> Approve
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        Approving emails the applicant ("You've been verified — you can now log in.") and lets them
        sign in. Rejecting sends them a notice, then <strong>permanently deletes</strong> their
        registration.
      </p>

      {/* ── Destructive confirmation modal ─────────────────────────────────── */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => !rejecting && setRejectTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--danger-bg)] text-[var(--danger)] flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-lg">
                  Reject this registration?
                </h3>
                <p className="text-sm text-[var(--text-body)] mt-1">
                  You're about to reject <strong>{rejectTarget.full_name}</strong>{" "}
                  ({rejectTarget.email}). A rejection notice will be emailed to them first, then
                  their registration will be{" "}
                  <strong className="text-[var(--danger)]">permanently deleted</strong>.
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  This cannot be undone. If they were a real TSSOSA alumnus, they can re-register
                  with the same email afterwards.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                disabled={rejecting}
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={rejecting}
                onClick={handleReject}
              >
                <UserX size={15} /> Yes, reject & delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}