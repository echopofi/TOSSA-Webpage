"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import StatusPill from "@/components/ui/StatusPill";
import {
  MapPin,
  Briefcase,
  Phone,
  Mail,
  GraduationCap,
  Camera,
  ArrowLeft,
  CalendarDays,
  User,
} from "lucide-react";
import { apiGetMember, apiGetMilestones } from "@/lib/api";
import type { Member, MemberMilestone, AutoMilestone, AnyMilestone } from "@/lib/types";
import { formatDate, initials } from "@/lib/utils";
import { use } from "react";

// ─── Auto-generate default timeline when member has no saved milestones ───────

function buildAutoTimeline(member: Member): AutoMilestone[] {
  const milestones: AutoMilestone[] = [];

  if (member.set_name) {
    milestones.push({
      id:             "auto_graduation",
      title:          `Graduated — Class of ${member.set_name}`,
      description:    "Completed secondary school education and became part of the alumni community.",
      milestone_date: `${member.set_name}-07-15`,
      isAuto:         true,
    });
  }

  milestones.push({
    id:             "auto_joined",
    title:          "Joined Alumni Network",
    description:    "Registered on AlumniConnect and reconnected with classmates.",
    milestone_date: member.joined_at.slice(0, 10),
    isAuto:         true,
  });

  return milestones;
}

// ─── Timeline component ───────────────────────────────────────────────────────

function Timeline({ milestones, isAuto }: { milestones: AnyMilestone[]; isAuto: boolean }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] flex items-center gap-2">
          <GraduationCap size={17} className="text-[var(--primary)]" />
          Journey
        </h2>
        {isAuto && (
          <span className="text-xs text-[var(--text-muted)] italic">
            Auto-generated · member can customise
          </span>
        )}
      </div>

      <ol className="relative border-l-2 border-[var(--border-subtle)] ml-2 flex flex-col gap-6">
        {milestones.map((ms) => (
          <li key={ms.id} className="ml-5">
            <span className="absolute -left-[9px] mt-1 w-4 h-4 rounded-full bg-[var(--primary)] border-2 border-white" />
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[var(--primary)] bg-[var(--primary-light)] px-2 py-0.5 rounded flex items-center gap-1">
                <CalendarDays size={10} />
                {formatDate(ms.milestone_date, "MMM yyyy")}
              </span>
              <h3 className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                {ms.title}
              </h3>
            </div>
            {ms.description && (
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {ms.description}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [member, setMember]     = useState<Member | null>(null);
  const [milestones, setMilestones] = useState<AnyMilestone[]>([]);
  const [milestonesAuto, setMilestonesAuto] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      // Fetch member + milestones in parallel
      const [mRes, msRes] = await Promise.all([
        apiGetMember(id),
        apiGetMilestones(id),
      ]);

      const m = mRes.data;
      setMember(m);

      // Spec: if no milestones exist, fall back to auto-generated default
      if (msRes.data.length > 0) {
        setMilestones(msRes.data as AnyMilestone[]);
        setMilestonesAuto(false);
      } else {
        setMilestones(buildAutoTimeline(m));
        setMilestonesAuto(true);
      }

      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar variant="public" />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </>
    );
  }

  if (!member) return null;

  const fullName = member.full_name;

  return (
    <>
      <Navbar variant="public" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Back link */}
        <Link
          href={member.set_id ? `/sets/${member.set_id}` : "/sets"}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--primary)] mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          Back to {member.set_name ? `Class of ${member.set_name}` : "Sets"}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Identity card sidebar ────────────────────────────────────── */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <Card className="flex flex-col items-center text-center gap-4 py-8 px-5">
              {/* Avatar — profile_image per spec v2 (was avatar_url in v1) */}
              {member.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.profile_image}
                  alt={fullName}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-[var(--primary-light)]"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-[family-name:var(--font-heading)] font-semibold text-3xl ring-4 ring-[var(--border-subtle)]">
                  {initials(fullName.split(" ")[0] ?? "?", fullName.split(" ")[1] ?? "")}
                </div>
              )}

              <div>
                <h1 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                  {fullName}
                </h1>
                {member.role_in_set && member.role_in_set !== "member" && (
                  <p className="text-xs text-[var(--primary)] font-medium mt-0.5 capitalize">
                    {member.role_in_set.replace(/_/g, " ")}
                  </p>
                )}
                <div className="mt-2 flex justify-center gap-2 flex-wrap">
                  <StatusPill
                    status={member.is_active ? "paid" : "pending"}
                    label={member.is_active ? "Active" : "Inactive"}
                  />
                  {member.payment_status && (
                    <StatusPill status={member.payment_status} />
                  )}
                </div>
              </div>

              {/* Detail rows */}
              <div className="w-full flex flex-col gap-2.5 text-sm border-t border-[var(--border-subtle)] pt-4">
                {member.set_name && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <GraduationCap size={14} className="shrink-0" />
                    <Link
                      href={`/sets/${member.set_id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      Class of {member.set_name}
                    </Link>
                  </div>
                )}

                {/* PII fields — email/phone only shown on authenticated responses */}
                {/* In production these will be undefined for unauthenticated visitors */}
                {member.email && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate text-xs">{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <Phone size={14} className="shrink-0" />
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.address && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <MapPin size={14} className="shrink-0" />
                    <span className="text-xs">{member.address}</span>
                  </div>
                )}
                {member.gender && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <User size={14} className="shrink-0" />
                    <span className="text-xs">{member.gender}</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Main column ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Bio */}
            {member.bio && (
              <Card>
                <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-3 flex items-center gap-2">
                  <Briefcase size={17} className="text-[var(--primary)]" />
                  About
                </h2>
                <p className="text-[var(--text-body)] text-sm leading-relaxed">
                  {member.bio}
                </p>
              </Card>
            )}

            {/* Journey timeline */}
            <Timeline milestones={milestones} isAuto={milestonesAuto} />

            {/* Gallery placeholder — spec v2 has no /gallery endpoint */}
            {/* If a gallery feature is added to the spec, wire it up here */}
            <Card className="border-dashed opacity-60">
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Camera size={24} className="text-[var(--text-muted)]" />
                <p className="text-sm font-medium text-[var(--text-muted)]">Photo gallery</p>
                <p className="text-xs text-[var(--text-muted)]">
                  No gallery endpoint in spec v2 — placeholder for future feature.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
