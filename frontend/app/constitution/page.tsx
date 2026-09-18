"use client";

import { ScrollText } from "lucide-react";
import Card from "@/components/ui/Card";
import { Reveal, fadeUp } from "@/lib/motion";
import { CONSTITUTION_TITLE, CONSTITUTION_TEXT } from "@/lib/constitutionContent";

export default function ConstitutionPage() {
  return (
    <div className="flex flex-col gap-6">
      <Reveal variants={fadeUp}>
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] flex items-center gap-2">
            <ScrollText size={26} className="text-[var(--primary)]" />
            TSSOSA Constitution
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            The official constitution of the TSSOSA Alumni Association. View it below.
          </p>
        </div>
      </Reveal>

      <Card padding="none" className="overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3 flex items-center bg-[var(--surface-card)]">
          <span className="text-sm font-medium text-[var(--text-heading)]">
            {CONSTITUTION_TITLE}
          </span>
        </div>
        <div className="p-4 md:p-6 bg-[var(--surface-card)]">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--text-body)]">
            {CONSTITUTION_TEXT}
          </pre>
        </div>
      </Card>
    </div>
  );
}