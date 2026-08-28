"use client";

import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import StatusPill from "@/components/ui/StatusPill";
import { Shield, Search, Award, History } from "lucide-react";
import {
  apiGetElectionPositions,
  apiGetExcoOfficers,
  apiSearchMembers,
  apiAdminAssignOfficer,
  apiAdminEndOfficerTerm,
} from "@/lib/api";
import type { ElectionPosition, ExcoOfficer, Member } from "@/lib/types";

export default function ExcoAssignmentPanel() {
  const [positions, setPositions]     = useState<ElectionPosition[]>([]);
  const [officers, setOfficers]       = useState<ExcoOfficer[]>([]);
  const [loading, setLoading]         = useState(true);

  // Assignment form state
  const [positionId, setPositionId]   = useState("");
  const [termLabel, setTermLabel]     = useState("2026/2027");
  const [member, setMember]           = useState<Member | null>(null);
  const [message, setMessage]         = useState("");
  const [assigning, setAssigning]     = useState(false);
  const [endingId, setEndingId]       = useState<string | null>(null);

  // Member search
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState<Member[]>([]);
  const [searching, setSearching]     = useState(false);
  const [open, setOpen]               = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const [pRes, eRes] = await Promise.all([
      apiGetElectionPositions(),
      apiGetExcoOfficers(),
    ]);
    setPositions(pRes.data);
    setOfficers(eRes.data.filter((o) => o.is_current));
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, eRes] = await Promise.all([
        apiGetElectionPositions(),
        apiGetExcoOfficers(),
      ]);
      if (cancelled) return;
      setPositions(pRes.data);
      setOfficers(eRes.data.filter((o) => o.is_current));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setMember(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await apiSearchMembers(q);
      setResults(res.data);
      setOpen(true);
      setSearching(false);
    }, 300);
  }

  async function handleAssign() {
    if (!positionId || !member) return;
    setMessage("");
    setAssigning(true);
    try {
      await apiAdminAssignOfficer({ positionId, memberId: member.id, termLabel });
      setMessage(`Assigned ${member.full_name} as ${positions.find((p) => p.id === positionId)?.title ?? "officer"} for ${termLabel}.`);
      setMember(null);
      setQuery("");
      load();
    } finally {
      setAssigning(false);
    }
  }

  async function handleEndTerm(id: string) {
    setEndingId(id);
    try {
      await apiAdminEndOfficerTerm(id);
      setMessage("Term ended. The position is open for a new appointment.");
      load();
    } finally {
      setEndingId(null);
    }
  }

  const positionOptions = positions.map((p) => ({
    value: p.id,
    label: `${p.title} (${p.election_year})`,
  }));

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)] py-8 text-center">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Assign a new officer ──────────────────────────────────────────── */}
      <Card>
        <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4 flex items-center gap-2">
          <Award size={18} className="text-[var(--primary)]" /> Appoint an Exco Member
        </h2>

        {message && (
          <div className="flex items-center gap-2 bg-[var(--success-bg)] text-[#166534] rounded-xl px-4 py-3 mb-4 text-sm">
            <CheckMark /> {message}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Position"
              placeholder="Select a position…"
              options={positionOptions}
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
            />
            <Select
              label="Term"
              options={[
                { value: "2025/2026", label: "2025/2026" },
                { value: "2026/2027", label: "2026/2027" },
                { value: "2027/2028", label: "2027/2028" },
              ]}
              value={termLabel}
              onChange={(e) => setTermLabel(e.target.value)}
            />
          </div>

          {/* Member search */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
              Winning member
            </label>
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                className="input pl-9"
                placeholder="Search member by name or email…"
                value={query}
                onChange={handleSearch}
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
                    onClick={() => {
                      setMember(m);
                      setQuery(m.full_name);
                      setOpen(false);
                    }}
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
                      {m.set_name && (
                        <p className="text-xs text-[var(--text-muted)]">Class of {m.set_name}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {member && (
            <p className="text-xs text-[var(--success)]">
              ✓ Selected: {member.full_name}
            </p>
          )}

          <Button
            className="self-start"
            loading={assigning}
            disabled={!positionId || !member}
            onClick={handleAssign}
          >
            <Award size={15} /> Appoint Officer
          </Button>
        </div>
      </Card>

      {/* ── Current officers ──────────────────────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base flex items-center gap-2">
            <Shield size={18} className="text-[var(--primary)]" /> Current Exco
          </h2>
          <span className="pill pill-neutral text-xs">{officers.length} officers</span>
        </div>
        {officers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
            No officers assigned for the current term yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {officers.map((o) => (
              <div key={o.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {o.member.profile_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.member.profile_image} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                      {o.member.full_name[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--text-heading)]">{o.position}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {o.member.full_name} · Term {o.term_label}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status="paid" label="Current" />
                  <Button
                    size="sm"
                    variant="outline"
                    loading={endingId === o.id}
                    onClick={() => handleEndTerm(o.id)}
                  >
                    <History size={14} /> End Term
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}