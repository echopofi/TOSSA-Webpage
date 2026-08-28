"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { UsersRound, Shield, CalendarDays } from "lucide-react";
import { apiGetExcoOfficers } from "@/lib/api";
import type { ExcoOfficer } from "@/lib/types";

export default function ExcoPage() {
  const [officers, setOfficers] = useState<ExcoOfficer[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiGetExcoOfficers();
      setOfficers(res.data.filter((o) => o.is_current));
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

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Our Exco
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            The elected executive committee steering the association this session.
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
          <UsersRound size={20} />
        </div>
      </div>

      {/* ── Current officers grid ──────────────────────────────────────────── */}
      {officers.length === 0 ? (
        <Card className="text-center py-12 text-sm text-[var(--text-muted)] flex flex-col items-center gap-2">
          <Shield size={28} className="text-[var(--text-muted)]" />
          The executive committee for this session has not been announced yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {officers.map((o) => (
            <Card key={o.id} className="flex flex-col items-center text-center py-6">
              {o.member.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={o.member.profile_image}
                  alt={o.member.full_name}
                  className="w-20 h-20 rounded-full object-cover border-[3px] border-[var(--primary)]"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-2xl font-bold flex items-center justify-center border-[3px] border-[var(--primary)]">
                  {o.member.full_name[0]}
                </div>
              )}
              <h2 className="mt-3 font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                {o.position}
              </h2>
              <p className="text-sm text-[var(--text-body)] mt-0.5">{o.member.full_name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Class of {o.member.set_name ?? "—"}
              </p>
              <span className="pill pill-neutral text-[11px] mt-3 flex items-center gap-1">
                <CalendarDays size={10} /> Term {o.term_label}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* ── Note ───────────────────────────────────────────────────────────── */}
      <p className="text-xs text-[var(--text-muted)]">
        Exco members are appointed by the association after each election. Officers change per
        elected term.
      </p>
    </div>
  );
}