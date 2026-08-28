"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusPill from "@/components/ui/StatusPill";
import Card from "@/components/ui/Card";
import {
  CreditCard,
  Users,
  Bell,
  ArrowRight,
  TrendingUp,
  Calendar,
  User,
  Vote,
} from "lucide-react";
import {
  apiMe,
  apiGetDuesSummary,
  apiGetAnnouncements,
  apiMyElectionApplications,
} from "@/lib/api";
import type { Member, DuesSummary, Announcement, ElectionApplication } from "@/lib/types";
import { formatNaira, formatDate, initials } from "@/lib/utils";
import MemberIdCard from "@/components/id/MemberIdCard";

export default function DashboardPage() {
  const [member, setMember]               = useState<Member | null>(null);
  const [dues, setDues]                   = useState<DuesSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [applications, setApplications]   = useState<ElectionApplication[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    (async () => {
      // apiMe returns { user, member, set } — richer than a plain member fetch
      const [meRes, dRes, aRes, eRes] = await Promise.all([
        apiMe(),
        apiGetDuesSummary(),
        apiGetAnnouncements(),
        apiMyElectionApplications(),
      ]);
      setMember(meRes.data.member);
      setDues(dRes.data);
      setAnnouncements(aRes.data.slice(0, 3));
      setApplications(eRes.data);
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

  const outstandingCycle = dues?.cycles.find((c) => c.status !== "paid");

  return (
    <div className="flex flex-col gap-8">

      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Welcome back, {member?.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {member?.set_name ? `Class of ${member.set_name}` : "Alumni Member"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusPill
            status={member?.is_active ? "paid" : "pending"}
            label={member?.is_active ? "Active" : "Inactive"}
          />
        </div>
      </div>

      {/* ── Member ID card + Elections ─────────────────────────────────────── */}
      {member && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 flex justify-center lg:justify-start">
            <MemberIdCard member={member} />
          </div>

          {/* My election applications */}
          <div className="lg:col-span-3">
            <Card padding="none" className="h-full flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
                  My Election Applications
                </h2>
                <Link
                  href="/elections"
                  className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
                >
                  Elections <ArrowRight size={14} />
                </Link>
              </div>
              <div className="flex-1 divide-y divide-[var(--border-subtle)]">
                {applications.length === 0 ? (
                  <div className="px-5 py-8 text-center flex flex-col items-center gap-3">
                    <User size={28} className="text-[var(--text-muted)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--text-heading)]">
                        No applications yet
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Contest for a position in this session's elections.
                      </p>
                    </div>
                    <Link
                      href="/elections"
                      className="text-xs text-[var(--primary)] font-semibold hover:underline"
                    >
                      View open positions →
                    </Link>
                  </div>
                ) : (
                  applications.map((a) => (
                    <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-heading)]">
                          {a.position.title}
                        </p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {a.position.election_year} · {formatNaira(a.position.fee_amount)} fee
                        </p>
                      </div>
                      <StatusPill
                        status={
                          a.status === "approved" || a.status === "submitted"
                            ? "paid"
                            : a.status === "rejected"
                            ? "overdue"
                            : "pending"
                        }
                        label={a.status.replace(/_/g, " ")}
                      />
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Dues summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label:  "Total Dues Paid",
            value:  formatNaira(dues?.total_paid ?? 0),
            icon:   TrendingUp,
            color:  "var(--success)",
            bg:     "var(--success-bg)",
          },
          {
            label:  "Outstanding",
            value:  formatNaira(dues?.outstanding ?? 0),
            icon:   CreditCard,
            color:  dues?.outstanding ? "var(--warning)" : "var(--success)",
            bg:     dues?.outstanding ? "var(--warning-bg)" : "var(--success-bg)",
          },
          {
            label:  "Next Due",
            value:  outstandingCycle
              ? formatNaira(outstandingCycle.cycle.amount)
              : "All clear",
            icon:   Calendar,
            color:  outstandingCycle ? "var(--primary)" : "var(--success)",
            bg:     outstandingCycle ? "var(--primary-light)" : "var(--success-bg)",
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

      {/* ── Dues overview table ────────────────────────────────────────────── */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
            Dues Overview
          </h2>
          <Link
            href="/payments"
            className="text-sm text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
          >
            Manage <ArrowRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {["Cycle", "Amount", "Due Date", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dues?.cycles.map((cs) => (
                <tr
                  key={cs.cycle.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-base)] transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-[var(--text-heading)]">
                    {cs.cycle.title}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--text-body)]">
                    {formatNaira(cs.cycle.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-[var(--text-muted)]">
                    {formatDate(cs.cycle.due_date)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill
                      status={
                        cs.status === "paid"
                          ? "paid"
                          : cs.status === "arrears"
                          ? "overdue"
                          : "pending"
                      }
                      label={cs.status}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {cs.status !== "paid" && (
                      <Link
                        href="/payments"
                        className="text-xs text-[var(--primary)] font-medium hover:underline"
                      >
                        Pay now
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Quick links + Announcements ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Quick links */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
              Quick Links
            </h2>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {[
              { href: member?.set_id ? `/sets/${member.set_id}` : "/sets", icon: Users,    label: "Visit My Set Page"           },
              { href: "/payments",                                          icon: CreditCard, label: "Pay / View Dues"           },
              { href: "/elections",                                         icon: Vote,       label: "Elections & Contest Forms" },
              { href: "/exco",                                              icon: Users,      label: "Our Executives (Exco)"      },
              { href: member?.id ? `/members/${member.id}` : "/profile",   icon: User,       label: "View My Profile"            },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[var(--bg-base)] text-sm font-medium text-[var(--text-body)] hover:text-[var(--primary)] transition-colors"
              >
                <Icon size={18} className="text-[var(--primary)]" />
                {label}
                <ArrowRight size={14} className="ml-auto text-[var(--text-muted)]" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Announcements */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base">
              Announcements
            </h2>
            <Bell size={16} className="text-[var(--text-muted)]" />
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {announcements.map((a) => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex items-start gap-2">
                  {!a.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-heading)] leading-snug">
                      {a.title}
                    </p>
                    {/* spec v2: field is "content" not "body" */}
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      {a.content}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {formatDate(a.published_at ?? a.created_at, "d MMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
