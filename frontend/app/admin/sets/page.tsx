"use client";

import SetManagePanel from "@/components/admin/SetManagePanel";

export default function AdminSetsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Graduating Set Media
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Manage cover photos, chairman captions, write-ups, and galleries for each set.
        </p>
      </div>
      <SetManagePanel />
    </div>
  );
}