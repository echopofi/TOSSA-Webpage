"use client";

import { FileText, ScrollText } from "lucide-react";
import Card from "@/components/ui/Card";
import { Reveal, fadeUp } from "@/lib/motion";

const PDF_URL = "/assets/constitution.pdf";

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

      <Reveal variants={fadeUp}>
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-[var(--border-subtle)] px-4 py-3 flex items-center gap-2">
            <FileText size={16} className="text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--text-heading)]">Document preview</span>
          </div>
          <iframe
            src={PDF_URL}
            title="TSSOSA Constitution"
            className="w-full h-[70vh] min-h-[480px] bg-white"
            onContextMenu={(e) => e.preventDefault()}
          />
        </Card>
      </Reveal>
    </div>
  );
}