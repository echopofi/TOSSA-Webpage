"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ClipboardList, ArrowRight, CheckCircle2, PencilLine, User, IdCard, BadgeCheck, Lock } from "lucide-react";
import { apiGetBioData } from "@/lib/api";
import { hasBioDataDraft } from "@/lib/bioDataDraft";
import { BioBannerSkeleton } from "@/components/skeletons/PageSkeletons";

type BioDataStatus = "loading" | "not_started" | "in_progress" | "submitted";

// What a verified member gets only after their bio data is on file.
const unlockItems = [
  {
    icon: User,
    label: "My Profile",
    desc: "View and update your member profile.",
  },
  {
    icon: IdCard,
    label: "Your ID Card",
    desc: "Full digital ID front and back.",
  },
  {
    icon: BadgeCheck,
    label: "Membership Number",
    desc: "TOSA/{year}/{seq} — issued on submission.",
  },
];

/**
 * Dashboard bio data panel with the three states from the feature spec:
 *  - not started  → "Please fill Bio Data form" notification + button
 *  - in progress  → resume (a localStorage draft exists, no DB record)
 *  - submitted    → the fill prompt disappears, replaced by "Edit Bio Data"
 */
export default function BioDataBanner() {
  const [status, setStatus] = useState<BioDataStatus>("loading");

  useEffect(() => {
    (async () => {
      // Source of truth is the DB record; the draft only matters when there is
      // no record yet (partial progress is kept in localStorage, never the DB).
      let recordExists = false;
      try {
        const res = await apiGetBioData();
        recordExists = res.data !== null;
      } catch {
        recordExists = false;
      }
      if (recordExists) {
        setStatus("submitted");
      } else {
        setStatus(hasBioDataDraft() ? "in_progress" : "not_started");
      }
    })();
  }, []);

  if (status === "loading") return <BioBannerSkeleton />;

  if (status === "submitted") {
    return (
      <Card padding="sm">
        <Link
          href="/bio-data"
          className="flex items-center justify-between gap-3 w-full group"
        >
          <span className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[var(--success-bg)] text-[var(--success)] flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </span>
            <span>
              <span className="block text-sm font-medium text-[var(--text-heading)]">
                Bio Data submitted
              </span>
              <span className="block text-xs text-[var(--text-muted)] mt-0.5">
                Your record is on file.
              </span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] font-medium group-hover:underline">
            <PencilLine size={14} />
            Edit Bio Data
          </span>
        </Link>
      </Card>
    );
  }

  const inProgress = status === "in_progress";

  return (
    <Card className="bg-[var(--primary-light)] border-0 flex flex-col sm:flex-row items-start gap-5">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="w-10 h-10 rounded-xl bg-white text-[var(--primary)] flex items-center justify-center shrink-0">
          <ClipboardList size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {inProgress ? "Bio Data form in progress" : "Complete your bio data to unlock member features"}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {inProgress
              ? "Pick up where you left off — your progress is saved on this device."
              : "These are locked until you submit your bio data once."}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {unlockItems.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm">
                <Icon size={15} className="text-[var(--primary)] shrink-0" />
                <span className="font-medium text-[var(--text-heading)]">{label}</span>
                <span className="text-xs text-[var(--text-muted)] hidden sm:inline">{desc}</span>
              </li>
            ))}
            <li className="flex items-center gap-2.5">
              <Lock size={13} className="text-[var(--text-muted)] shrink-0" />
              <span className="text-xs text-[var(--text-muted)]">
                Locked until you submit the form.
              </span>
            </li>
          </ul>
        </div>
      </div>
      <Link href="/bio-data" className="shrink-0">
        <Button size="sm" variant="outline">
          {inProgress ? "Continue" : "Fill Bio Data"}
          <ArrowRight size={14} />
        </Button>
      </Link>
    </Card>
  );
}