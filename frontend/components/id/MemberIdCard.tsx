/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import type { Member } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface MemberIdCardProps {
  member: Member;
  membershipNumber?: string;
}

/**
 * Virtual member ID card (front+back on a desktop, stacked vertically on mobile).
 * Uses the photo captured at registration; falls back to initials placeholder.
 */
export default function MemberIdCard({ member, membershipNumber }: MemberIdCardProps) {
  const initialsText = member.full_name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const memNumber = membershipNumber ?? member.id.toUpperCase().replace(/_/g, "-");

  const front = (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary)] to-[#1d4ed8] text-white shadow-lg">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -left-6 -bottom-12 w-36 h-36 rounded-full bg-white/10" />

      <div className="relative p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/assets/logo.jpeg"
              alt="TSSOSA logo"
              width={34}
              height={34}
              className="rounded-lg object-cover"
            />
            <div className="leading-tight">
              <p className="font-[family-name:var(--font-heading)] font-bold text-sm">TSSOSA</p>
              <p className="text-[11px] text-white/80">Alumni Association</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-white/20 rounded-md px-2 py-1">
            Member
          </span>
        </div>

        <div className="flex items-center gap-4">
          {member.profile_image ? (
            <img
              src={member.profile_image}
              alt={member.full_name}
              className="w-20 h-20 rounded-xl object-cover border-2 border-white/70 bg-white"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-white/20 border-2 border-white/70 flex items-center justify-center font-[family-name:var(--font-heading)] text-2xl font-bold">
              {initialsText || "M"}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-heading)] font-bold text-lg leading-tight truncate">
              {member.full_name}
            </p>
            <p className="text-sm text-white/85">
              Class of {(member.set_name ?? "—").length ? member.set_name : member.set_id ?? "—"}
            </p>
            {member.gender && <p className="text-xs text-white/70 mt-0.5">{member.gender}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  const back = (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Membership No.</span>
        <span className="font-mono font-semibold text-[var(--text-heading)]">{memNumber}</span>
      </div>
      <div className="h-px bg-[var(--border-subtle)]" />
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Status</span>
        <span className="font-semibold text-[var(--success)]">
          {member.is_active ? "Active Member" : "Pending Verification"}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">Joined</span>
        <span className="font-medium text-[var(--text-heading)]">{formatDate(member.joined_at, "d MMM yyyy")}</span>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-xs md:max-w-sm flex flex-col gap-3">
      {front}
      {back}
      <p className="text-[11px] text-[var(--text-muted)] text-center">
        Keep this card safe. It is your digital proof of membership.
      </p>
    </div>
  );
}