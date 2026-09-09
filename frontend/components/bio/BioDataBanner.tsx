"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ClipboardList, ArrowRight, CheckCircle2, PencilLine } from "lucide-react";
import { apiGetBioData } from "@/lib/api";
import { hasBioDataDraft } from "@/lib/bioDataDraft";

type BioDataStatus = "loading" | "not_started" | "in_progress" | "submitted";

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

  if (status === "loading") return null;

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
    <Card className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <ClipboardList size={20} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--text-heading)]">
            {inProgress ? "Bio Data form in progress" : "Please fill Bio Data form"}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {inProgress
              ? "Pick up where you left off — your progress is saved on this device."
              : "Complete your details once to update your membership record."}
          </p>
        </div>
      </div>
      <Link href="/bio-data" className="shrink-0">
        <Button size="sm">
          {inProgress ? "Continue" : "Fill Bio Data"}
          <ArrowRight size={14} />
        </Button>
      </Link>
    </Card>
  );
}