"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Trash2,
  User,
  PencilLine,
  Eye,
  Mail,
  CalendarDays,
  Loader2,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  apiAdminGetMemberDetail,
  apiAdminUpdateMemberDetails,
  apiAdminSetMemberSuspended,
  apiAdminDeleteMember,
  ApiRequestError,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/session";
import { isSuperAdmin } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { NAME_MAX, PHONE_MAX } from "@/lib/validation";
import type { AdminMemberDetail } from "@/lib/types";
import { AdminSettingsSkeleton } from "@/components/skeletons/PageSkeletons";

interface DetailsForm {
  fullName: string;
  matricNumber: string;
  gender: string;
  phone: string;
  address: string;
  bio: string;
}

/**
 * Admin user-management view (/admin/users/[id]).
 *
 * Arrived at from any admin search result (see AdminMemberSearch). Sections:
 *  1. Dashboard view — read-only snapshot (membership, set, payment history).
 *  2. Edit details — writes through the existing PATCH /api/members/:id path.
 *  3. Suspend / unsuspend — reversible, any admin; suspending revokes every
 *     live refresh token (kicks all sessions) and blocks login immediately.
 *  4. Delete — SUPER ADMIN ONLY (server-enforced + hidden for everyone else),
 *     requires typing the member's name to confirm; permanent.
 */
export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const memberId = params.id;

  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [suspending, setSuspending] = useState(false);
  const [suspensionMessage, setSuspensionMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const session = getCurrentUser();
  const superAdmin = isSuperAdmin(session);

  const detailsForm = useForm<DetailsForm>();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await apiAdminGetMemberDetail(memberId);
      setDetail(res.data);
      detailsForm.reset({
        fullName: res.data.user.fullName,
        matricNumber: res.data.member.matricNumber ?? "",
        gender: res.data.member.gender ?? "",
        phone: res.data.member.phone ?? "",
        address: res.data.member.address ?? "",
        bio: res.data.member.bio ?? "",
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load member.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSuspend() {
    if (!detail) return;
    setSuspending(true);
    setSuspensionMessage(null);
    try {
      const res = await apiAdminSetMemberSuspended(memberId, true);
      setDetail(res.data);
      setSuspensionMessage({
        type: "ok",
        text: "Account suspended. All of their sessions have been revoked and login is now blocked.",
      });
    } catch (err) {
      setSuspensionMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to suspend." });
    } finally {
      setSuspending(false);
    }
  }

  async function onUnsuspend() {
    if (!detail) return;
    setSuspending(true);
    setSuspensionMessage(null);
    try {
      const res = await apiAdminSetMemberSuspended(memberId, false);
      setDetail(res.data);
      setSuspensionMessage({
        type: "ok",
        text: "Account restored. The member can sign in again.",
      });
    } catch (err) {
      setSuspensionMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to restore." });
    } finally {
      setSuspending(false);
    }
  }

  async function onSaveDetails(data: DetailsForm) {
    setSavingDetails(true);
    setDetailsMessage(null);
    try {
      await apiAdminUpdateMemberDetails(memberId, {
        fullName: data.fullName.trim(),
        matricNumber: data.matricNumber.trim() || undefined,
        gender: data.gender || undefined,
        phone: data.phone.trim() || undefined,
        address: data.address.trim() || undefined,
        bio: data.bio.trim() || undefined,
      });
      setDetailsMessage({ type: "ok", text: "Member details updated." });
      load();
    } catch (err) {
      setDetailsMessage({ type: "err", text: err instanceof Error ? err.message : "Failed to update details." });
    } finally {
      setSavingDetails(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await apiAdminDeleteMember(memberId);
      router.push("/admin");
    } catch (err) {
      setDeleteError(err instanceof ApiRequestError ? err.message : "Failed to delete user.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <AdminSettingsSkeleton />;
  }

  if (loadError || !detail) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle size={28} className="text-[var(--danger)]" />
          <p className="text-sm text-[var(--text-muted)]">{loadError || "Member not found."}</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
            <ArrowLeft size={14} />
            Back to Admin
          </Button>
        </div>
      </Card>
    );
  }

  const suspended = !detail.member.isActive;

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors w-fit"
      >
        <ArrowLeft size={15} />
        Back to Admin
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            {detail.user.fullName}
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 flex items-center gap-1.5">
            <Mail size={13} /> {detail.user.email}
            <span className="mx-1 text-[var(--border-strong)]">•</span>
            Joined {formatDate(detail.member.joinedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {suspended ? (
            <span className="pill pill-warning">Suspended</span>
          ) : (
            <span className="pill pill-success">Active</span>
          )}
          <span className="pill pill-neutral">{(detail.member.membershipNumber ?? "").slice(0, 3).toUpperCase() || "MEM"}</span>
        </div>
      </div>

      {/* Suspend / restore banner */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {suspended ? (
              <Ban size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert size={18} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-[var(--text-heading)]">
                {suspended ? "Account suspended" : "Current status: active"}
              </p>
              {suspended ? (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Login is blocked and every open session has been revoked. Restore to allow sign-in again.
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Suspending immediately blocks their login and signs out every device they&apos;re on.
                </p>
              )}
            </div>
          </div>
          {suspended ? (
            <Button variant="outline" onClick={onUnsuspend} loading={suspending}>
              <CheckCircle2 size={15} />
              Restore Access
            </Button>
          ) : (
            <Button variant="outline" onClick={onSuspend} loading={suspending}>
              <Ban size={15} />
              Suspend Account
            </Button>
          )}
        </div>
        {suspensionMessage && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 mt-4 text-sm ${
              suspensionMessage.type === "ok"
                ? "bg-[var(--success-bg)] text-[#166534]"
                : "bg-[var(--danger-bg)] text-[var(--danger)]"
            }`}
          >
            {suspensionMessage.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {suspensionMessage.text}
          </div>
        )}
      </Card>

      {/* Section selector */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Dashboard view — read-only */}
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <Eye size={18} className="text-[var(--primary)]" />
              Dashboard view
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="rounded-xl bg-[var(--bg-base)] px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">Membership number</p>
                <p className="text-sm font-semibold text-[var(--text-heading)] mt-0.5">
                  {detail.member.membershipNumber ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-base)] px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">Set(s)</p>
                <p className="text-sm font-semibold text-[var(--text-heading)] mt-0.5">
                  {detail.sets.length > 0 ? detail.sets.map((s) => `Class of ${s.name}`).join(", ") : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--bg-base)] px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">Matric number</p>
                <p className="text-sm font-semibold text-[var(--text-heading)] mt-0.5">
                  {detail.member.matricNumber ?? "—"}
                </p>
              </div>
            </div>

            {detail.bioData ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Bio data</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">{detail.bioData.fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Gender</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">{detail.bioData.gender}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Blood group</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">{detail.bioData.bloodGroup}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Phone</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">{detail.bioData.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Email</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">{detail.bioData.email}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Location</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">
                    {[detail.bioData.city, detail.bioData.state, detail.bioData.country].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Occupation</p>
                  <p className="mt-0.5 text-[var(--text-heading)]">
                    {detail.bioData.occupationCategory.replace(/_/g, " ")} — {detail.bioData.specialization}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                This member has not submitted their bio data form yet.
              </p>
            )}

            {/* Bank/payment summary */}
            {detail.payments.length > 0 || detail.duesPayments.length > 0 ? (
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-5">
                <p className="text-sm font-medium text-[var(--text-heading)] mb-3">Payment history</p>
                {detail.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-[var(--text-muted)]">Registration — {p.reference ?? ""}</span>
                    <span className="flex items-center gap-2">
                      <span className={`pill ${p.status === "success" ? "pill-success" : "pill-neutral"}`}>{p.status}</span>
                      <span className="font-medium text-[var(--text-heading)]">
                        ₦{(p.amount / 100).toLocaleString()}
                      </span>
                    </span>
                  </div>
                ))}
                {detail.duesPayments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-[var(--text-muted)]">{d.cycle ?? "Dues"}</span>
                    <span className="flex items-center gap-2">
                      <span className={`pill ${d.status === "success" ? "pill-success" : "pill-neutral"}`}>{d.status}</span>
                      <span className="font-medium text-[var(--text-heading)]">
                        ₦{(d.amount / 100).toLocaleString()}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          {/* Edit details */}
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <PencilLine size={18} className="text-[var(--primary)]" />
              Edit member details
            </h2>

            {detailsMessage && (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm ${
                  detailsMessage.type === "ok"
                    ? "bg-[var(--success-bg)] text-[#166534]"
                    : "bg-[var(--danger-bg)] text-[var(--danger)]"
                }`}
              >
                {detailsMessage.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {detailsMessage.text}
              </div>
            )}

            <form onSubmit={detailsForm.handleSubmit(onSaveDetails)} className="flex flex-col gap-4">
              <Input
                label="Full name"
                error={detailsForm.formState.errors.fullName?.message}
                {...detailsForm.register("fullName", {
                  required: "Full name is required",
                  maxLength: { value: NAME_MAX, message: "Full name is too long" },
                })}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Matric number"
                  error={detailsForm.formState.errors.matricNumber?.message}
                  {...detailsForm.register("matricNumber")}
                />
                <Select
                  label="Gender"
                  placeholder="Select gender"
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                  ]}
                  {...detailsForm.register("gender")}
                />
              </div>
              <Input
                label="Phone"
                type="tel"
                error={detailsForm.formState.errors.phone?.message}
                {...detailsForm.register("phone", {
                  maxLength: { value: PHONE_MAX, message: "Phone number is too long" },
                })}
              />
              <Input
                label="Address"
                error={detailsForm.formState.errors.address?.message}
                {...detailsForm.register("address")}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                  Short bio
                </label>
                <textarea
                  className={`input resize-none ${detailsForm.formState.errors.bio ? "error" : ""}`}
                  rows={3}
                  {...detailsForm.register("bio")}
                />
                {detailsForm.formState.errors.bio && (
                  <p className="text-xs text-[var(--danger)]">{detailsForm.formState.errors.bio.message}</p>
                )}
              </div>
              <Button type="submit" loading={savingDetails} className="self-start mt-1">
                Save Changes
              </Button>
            </form>
          </Card>
        </div>

        {/* Side column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Bio data summary */}
          <Card>
            <h2 className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
              <User size={16} className="text-[var(--primary)]" />
              Bio data
            </h2>
            <dl className="divide-y divide-[var(--border-subtle)] text-sm">
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Set year</dt>
                <dd className="text-[var(--text-heading)] font-medium">{detail.bioData?.setYear ?? "—"}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Submitted</dt>
                <dd className="text-[var(--text-heading)] font-medium">
                  {detail.bioData ? formatDate(detail.bioData.updatedAt) : "No"}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Verified</dt>
                <dd className="text-[var(--text-heading)] font-medium">
                  {detail.user.isVerified ? "Yes" : "No"}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Role</dt>
                <dd className="text-[var(--text-heading)] font-medium">{detail.user.role}</dd>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Active sessions</dt>
                <dd className="text-[var(--text-heading)] font-medium">{detail.activeSessions}</dd>
              </div>
            </dl>
          </Card>

          {/* Danger zone — super admin only */}
          {superAdmin && (
            <Card className="border-[var(--danger)]/40">
              <h2 className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--danger)] mb-2 flex items-center gap-2">
                <Trash2 size={16} />
                Danger zone
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Permanently deletes this user, their member profile, and every related record
                (payments, dues, milestones, applications, exco history, bio data, sessions).
                This cannot be undone.
              </p>

              {!confirmOpen ? (
                <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
                  <Trash2 size={14} />
                  Delete user
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-[var(--text-heading)]">
                    Type{" "}
                    <span className="font-mono font-semibold">{detail.user.fullName}</span> to confirm
                    permanent deletion.
                  </p>
                  <input
                    className="input"
                    placeholder={detail.user.fullName}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    autoFocus
                  />
                  {deleteError && (
                    <p className="text-xs text-[var(--danger)] flex items-center gap-1">
                      <AlertCircle size={12} /> {deleteError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={confirmText.trim() !== detail.user.fullName}
                      loading={deleting}
                      onClick={onDelete}
                    >
                      <Trash2 size={14} />
                      Delete permanently
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Super-admin hint for non-super admins */}
          {!superAdmin && (
            <Card>
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                <ShieldAlert size={14} className="text-[var(--text-muted)] shrink-0" />
                Only the Super Admin can permanently delete a user. You can edit details and suspend /
                restore this account.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Hidden-but-relevant loader state to keep screen readers informed */}
      {deleting && (
        <div className="sr-only" role="status">
          <Loader2 className="animate-spin" /> Deleting user…
        </div>
      )}
    </div>
  );
}