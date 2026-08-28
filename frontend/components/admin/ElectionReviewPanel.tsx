"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatusPill from "@/components/ui/StatusPill";
import { CheckCircle2, XCircle, Plus, ClipboardCheck } from "lucide-react";
import {
  apiAdminListElectionApplications,
  apiAdminUpdateElectionApplication,
  apiAdminCreateElectionPosition,
} from "@/lib/api";
import type { ElectionApplication } from "@/lib/types";
import { formatNaira, formatDate } from "@/lib/utils";

function appStatusToPill(status: ElectionApplication["status"]): "paid" | "pending" | "overdue" {
  if (status === "approved" || status === "submitted") return "paid";
  if (status === "rejected") return "overdue";
  return "pending";
}

interface PositionForm {
  title: string;
  feeAmount: number;
  election_year: string;
}

export default function ElectionReviewPanel() {
  const [applications, setApplications] = useState<ElectionApplication[]>([]);
  const [loading, setLoading]           = useState(true);
  const [updatingId, setUpdatingId]     = useState<string | null>(null);
  const [creating, setCreating]         = useState(false);
  const [createdMsg, setCreatedMsg]     = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PositionForm>();

  useEffect(() => {
    (async () => {
      const res = await apiAdminListElectionApplications();
      setApplications(res.data);
      setLoading(false);
    })();
  }, []);

  async function handleStatus(id: string, status: ElectionApplication["status"]) {
    setUpdatingId(id);
    try {
      const res = await apiAdminUpdateElectionApplication(id, status);
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: res.data.status } : a)));
    } finally {
      setUpdatingId(null);
    }
  }

  async function onCreate(data: PositionForm) {
    setCreating(true);
    setCreatedMsg("");
    try {
      await apiAdminCreateElectionPosition({
        title: data.title,
        feeAmount: Number(data.feeAmount),
        election_year: data.election_year,
      });
      setCreatedMsg(`Position "${data.title}" created and opened for applications.`);
      reset();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Create a position ─────────────────────────────────────────────── */}
      <Card>
        <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[var(--primary)]" /> Open a Position
        </h2>
        {createdMsg && (
          <div className="flex items-center gap-2 bg-[var(--success-bg)] text-[#166534] rounded-xl px-4 py-3 mb-4 text-sm">
            <CheckCircle2 size={16} /> {createdMsg}
          </div>
        )}
        <form onSubmit={handleSubmit(onCreate)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <Input
              label="Position title"
              placeholder="e.g. Treasurer"
              error={errors.title?.message}
              {...register("title", { required: "Title is required" })}
            />
          </div>
          <div>
            <Input
              label="Fee (₦)"
              type="number"
              placeholder="e.g. 15000"
              error={errors.feeAmount?.message}
              {...register("feeAmount", {
                required: "Fee is required",
                min: { value: 1, message: "Fee must be > 0" },
              })}
            />
          </div>
          <div>
            <Input
              label="Election year"
              placeholder="e.g. 2026/2027"
              error={errors.election_year?.message}
              {...register("election_year", { required: "Election year is required" })}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" loading={creating}>
              <Plus size={15} /> Create & Open
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Applications to review ────────────────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base flex items-center gap-2">
            <ClipboardCheck size={18} className="text-[var(--primary)]" /> Applications
          </h2>
          <span className="pill pill-neutral text-xs">
            {applications.filter((a) => a.status === "submitted").length} pending review
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>
        ) : applications.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
            No election applications yet. Applications appear here once members pay the contest fee.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  {["Applicant", "Position", "Fee", "Applied", "Status", ""].map((h) => (
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
                {applications.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-base)] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {a.member?.profile_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.member.profile_image}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                            {a.member?.full_name?.[0] ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[var(--text-heading)]">
                            {a.member?.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {a.member?.set_name ? `Class of ${a.member.set_name}` : a.member?.email ?? ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)] whitespace-nowrap">
                      {a.position.title}
                      <span className="block text-xs text-[var(--text-muted)]">{a.position.election_year}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[var(--text-body)]">{formatNaira(a.position.fee_amount)}</td>
                    <td className="px-5 py-3.5 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDate(a.applied_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={appStatusToPill(a.status)} label={a.status.replace(/_/g, " ")} />
                    </td>
                    <td className="px-5 py-3.5">
                      {a.status === "submitted" && (
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={updatingId === a.id}
                            onClick={() => handleStatus(a.id, "rejected")}
                          >
                            <XCircle size={14} /> Reject
                          </Button>
                          <Button
                            size="sm"
                            loading={updatingId === a.id}
                            onClick={() => handleStatus(a.id, "approved")}
                          >
                            <CheckCircle2 size={14} /> Approve
                          </Button>
                        </div>
                      )}
                      {(a.status === "approved" || a.status === "rejected") && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            loading={updatingId === a.id}
                            onClick={() =>
                              handleStatus(a.id, a.status === "approved" ? "rejected" : "submitted")
                            }
                          >
                            Undo
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-[var(--text-muted)]">
        Approving an application qualifies the member as a candidate. Winners of the election are
        separately assigned to the Exco.
      </p>
    </div>
  );
}