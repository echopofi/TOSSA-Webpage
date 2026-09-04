"use client";

import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusPill from "@/components/ui/StatusPill";
import {
  Megaphone,
  Users,
  Globe,
  User,
  CheckCircle2,
  Send,
  TrendingUp,
  Bell,
  Search,
  Clock,
  CalendarDays,
} from "lucide-react";
import {
  apiSendAnnouncement,
  apiGetAnnouncements,
  apiGetAdminDashboard,
  apiGetSets,
  apiSearchMembers,
} from "@/lib/api";
import type {
  Announcement,
  AdminDashboard,
  GraduationSet,
  Member,
  BroadcastPayload,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import ElectionReviewPanel from "@/components/admin/ElectionReviewPanel";
import ExcoAssignmentPanel from "@/components/admin/ExcoAssignmentPanel";
import PendingMembersPanel from "@/components/admin/PendingMembersPanel";

// ─── Form shape ───────────────────────────────────────────────────────────────

interface FormData {
  title: string;
  content: string;               // spec v2: "content" not "body"
  target_type: "all_members" | "set" | "member";
  set_id?: string;               // spec v2: "set_id" not "target_set_id"
  target_member_id?: string;     // spec v2: new field
  scheduled_at?: string;         // spec v2: optional ISO datetime
}

// ─── Member search dropdown ───────────────────────────────────────────────────

function MemberSearchField({
  onSelect,
  selectedMember,
}: {
  onSelect: (m: Member | null) => void;
  selectedMember: Member | null;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen]         = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    onSelect(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await apiSearchMembers(q);
      setResults(res.data);
      setOpen(true);
      setSearching(false);
    }, 300);
  }

  function handleSelect(m: Member) {
    setQuery(m.full_name);
    setOpen(false);
    onSelect(m);
  }

  return (
    <div className="flex flex-col gap-1 relative">
      <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
        Search member
      </label>
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
        />
        <input
          className="input pl-9"
          placeholder="Name or email…"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-[var(--border-subtle)] rounded-xl shadow-lg overflow-hidden">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-base)] text-left transition-colors"
              onClick={() => handleSelect(m)}
            >
              {m.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-xs font-bold">
                  {m.full_name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-[var(--text-heading)]">{m.full_name}</p>
                {m.email && <p className="text-xs text-[var(--text-muted)]">{m.email}</p>}
              </div>
              {m.set_name && (
                <span className="ml-auto text-xs text-[var(--text-muted)]">Class of {m.set_name}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && !searching && results.length === 0 && query.trim() && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-[var(--border-subtle)] rounded-xl shadow-lg px-4 py-3 text-sm text-[var(--text-muted)]">
          No members found matching "{query}"
        </div>
      )}

      {selectedMember && (
        <p className="text-xs text-[var(--success)] mt-0.5">
          ✓ Selected: {selectedMember.full_name}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats]               = useState<AdminDashboard | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sets, setSets]                 = useState<GraduationSet[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [sent, setSent]                 = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ defaultValues: { target_type: "all_members" } });

  const target      = watch("target_type");
  const scheduleOn  = watch("scheduled_at");

  useEffect(() => {
    (async () => {
      try {
        const [sRes, aRes, setRes] = await Promise.all([
          apiGetAdminDashboard(),   // spec v2: /api/admin/dashboard (not /api/admin/stats)
          apiGetAnnouncements(),
          apiGetSets(),
        ]);
        setStats(sRes.data);
        setAnnouncements(aRes.data);
        setSets(setRes.data);
      } catch {
        setStats(null);
        setAnnouncements([]);
        setSets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmit(data: FormData) {
    if (data.target_type === "member" && !selectedMember) {
      return; // member must be selected
    }

    setSending(true);
    setSent(false);

    const payload: BroadcastPayload = {
      title:            data.title,
      content:          data.content,           // spec v2: "content"
      target_type:      data.target_type,        // spec v2: "target_type"
      set_id:           data.target_type === "set" ? data.set_id : undefined,
      target_member_id: data.target_type === "member" ? selectedMember?.id : undefined,
      scheduled_at:     data.scheduled_at || undefined,
    };

    try {
      const res = await apiSendAnnouncement(payload);
      setAnnouncements((prev) => [res.data, ...prev]);
      setSent(true);
      reset();
      setSelectedMember(null);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const setOptions = sets.map((s) => ({
    value: s.id,
    label: `Class of ${s.set_name}`,
  }));

  return (
    <div className="flex flex-col gap-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Admin Panel
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Broadcast announcements and monitor association activity.
        </p>
      </div>

      {/* ── Stats — GET /api/admin/dashboard ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Members",
            value: stats?.total_members.toLocaleString(),
            icon:  Users,
            bg:    "var(--primary-light)",
            color: "var(--primary)",
          },
          {
            label: "Active Members",
            value: stats?.active_members.toLocaleString(),
            icon:  CheckCircle2,
            bg:    "var(--success-bg)",
            color: "var(--success)",
          },
          {
            label: "Pending Payments",
            value: stats?.pending_payments.toLocaleString(),
            icon:  Bell,
            bg:    "var(--warning-bg)",
            color: "var(--warning)",
          },
          {
            label: "Dues Collected",
            value: `₦${((stats?.total_dues_collected ?? 0) / 1_000_000).toFixed(1)}M`,
            icon:  TrendingUp,
            bg:    "var(--success-bg)",
            color: "var(--success)",
          },
        ].map(({ label, value, icon: Icon, bg, color }) => (
          <Card key={label}>
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: bg }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mt-0.5">
                  {value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Pending member approvals — GET /api/admin/members/pending ────── */}
      <PendingMembersPanel />

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Compose form */}
        <div className="lg:col-span-3">
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <Megaphone size={18} className="text-[var(--primary)]" />
              Broadcast Announcement
            </h2>

            {sent && (
              <div className="flex items-center gap-2 bg-[var(--success-bg)] text-[#166534] rounded-xl px-4 py-3 mb-4 text-sm">
                <CheckCircle2 size={16} />
                Announcement {scheduleOn ? "scheduled" : "sent"} successfully!
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Input
                label="Subject / Title"
                placeholder="e.g. Annual General Meeting — Save the Date"
                error={errors.title?.message}
                {...register("title", { required: "Title is required" })}
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                  Message body
                </label>
                {/* spec v2: field is "content" not "body" */}
                <textarea
                  className={`input resize-none ${errors.content ? "error" : ""}`}
                  rows={5}
                  placeholder="Write your announcement here…"
                  {...register("content", {
                    required: "Message body is required",
                    minLength: { value: 20, message: "Message must be at least 20 characters" },
                  })}
                />
                {errors.content && (
                  <p className="text-xs text-[var(--danger)]">{errors.content.message}</p>
                )}
              </div>

              {/* Audience selector — spec v2: target_type field, all_members/set/member */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                  Send to
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "all_members", icon: Globe, label: "All Members" },
                    { value: "set",         icon: Users, label: "A Set"       },
                    { value: "member",      icon: User,  label: "One Member"  },
                  ].map(({ value, icon: Icon, label }) => {
                    const active = target === value;
                    return (
                      <label
                        key={value}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                          active
                            ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                            : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        }`}
                      >
                        <input
                          type="radio"
                          value={value}
                          className="sr-only"
                          {...register("target_type")}
                        />
                        <Icon size={18} />
                        <span className="text-xs">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Conditional: set picker */}
              {target === "set" && (
                <Select
                  label="Select Set"
                  placeholder="Choose a graduating set…"
                  options={setOptions}
                  error={errors.set_id?.message}
                  {...register("set_id", {
                    validate: (v) =>
                      target === "set" && !v ? "Please select a set" : true,
                  })}
                />
              )}

              {/* Conditional: member search — spec v2 Q13 resolved: GET /api/members/search?q= */}
              {target === "member" && (
                <MemberSearchField
                  onSelect={setSelectedMember}
                  selectedMember={selectedMember}
                />
              )}

              {/* Scheduled delivery — spec v2: scheduled_at field */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)] flex items-center gap-1.5">
                  <Clock size={14} className="text-[var(--text-muted)]" />
                  Schedule for later{" "}
                  <span className="font-normal text-[var(--text-muted)]">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input"
                  {...register("scheduled_at")}
                />
                {watch("scheduled_at") && (
                  <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                    <CalendarDays size={11} />
                    Will be sent at the scheduled time by the backend worker.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                loading={sending}
                disabled={target === "member" && !selectedMember}
                className="self-start mt-1"
              >
                <Send size={16} />
                {watch("scheduled_at") ? "Schedule Announcement" : "Send Now"}
              </Button>
              {target === "member" && !selectedMember && (
                <p className="text-xs text-[var(--text-muted)] -mt-2">
                  Select a member above to enable send.
                </p>
              )}
            </form>
          </Card>
        </div>

        {/* Sent announcements list */}
        <div className="lg:col-span-2">
          <Card padding="none" className="h-full flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
                Sent / Scheduled
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {announcements.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                  No announcements yet.
                </div>
              ) : (
                announcements.map((a) => (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] leading-snug line-clamp-1 flex-1">
                        {a.title}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Scheduled badge */}
                        {a.scheduled_at && !a.is_published && (
                          <span className="pill pill-warning text-xs flex items-center gap-1">
                            <Clock size={9} /> Scheduled
                          </span>
                        )}
                        {/* Target badge */}
                        {a.target_type === "all_members" && (
                          <span className="pill pill-neutral text-xs flex items-center gap-1">
                            <Globe size={9} /> All
                          </span>
                        )}
                        {a.target_type === "set" && (
                          <span className="pill pill-neutral text-xs flex items-center gap-1">
                            <Users size={9} /> Set
                          </span>
                        )}
                        {a.target_type === "member" && (
                          <span className="pill pill-neutral text-xs flex items-center gap-1">
                            <User size={9} /> 1
                          </span>
                        )}
                      </div>
                    </div>
                    {/* spec v2: content not body */}
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {a.content}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">
                      {a.scheduled_at && !a.is_published
                        ? `Scheduled: ${formatDate(a.scheduled_at, "d MMM yyyy, h:mmaaa")}`
                        : formatDate(a.published_at ?? a.created_at, "d MMM yyyy, h:mmaaa")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Elections & Exco management ───────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4">
          Elections & Exco
        </h2>
        <div className="flex flex-col gap-6">
          <ElectionReviewPanel />
          <ExcoAssignmentPanel />
        </div>
      </div>
    </div>
  );
}
