"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { apiSearchMembers } from "@/lib/api";
import type { Member } from "@/lib/types";

interface AdminMemberSearchProps {
  /** "icon" = compact circular button (mobile Navbar); "row" = full-width row (Sidebar). */
  variant?: "icon" | "row";
  /** Which edge the results panel should hug. */
  align?: "left" | "right";
}

/**
 * Admin-global member search. Toggles a debounced live-search overlay that
 * queries GET /api/members/search?q= (name / email / membership number) and
 * links each result to the member's public profile page.
 *
 * Used from the admin shell (Sidebar on desktop, Navbar on mobile) and made
 * available to admin panels — the single shared search component.
 */
export default function AdminMemberSearch({
  variant = "icon",
  align = "right",
}: AdminMemberSearchProps) {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapperRef                = useRef<HTMLDivElement | null>(null);
  const inputRef                  = useRef<HTMLInputElement | null>(null);
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Focus the input as soon as the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function toggle() {
    setOpen((v) => !v);
    if (open) {
      setQuery("");
      setResults([]);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiSearchMembers(q);
        setResults(res.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      {variant === "row" ? (
        <button
          type="button"
          onClick={toggle}
          aria-label="Search members"
          aria-expanded={open}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-body)] hover:bg-[var(--bg-base)] hover:text-[var(--primary)] transition-colors"
        >
          <Search size={18} />
          Search members
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-label="Search members"
          aria-expanded={open}
          className="p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-heading)] transition-colors"
        >
          <Search size={20} className="text-[#1A1528]" />
        </button>
      )}

      {open && (
        <div
          className={`absolute top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-[var(--border-subtle)] rounded-xl shadow-lg overflow-hidden z-[70] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {/* Input */}
          <div className="relative border-b border-[var(--border-subtle)]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              ref={inputRef}
              className="w-full pl-9 pr-9 py-3 text-sm outline-none"
              placeholder="Name, email, or TOSA number…"
              value={query}
              onChange={handleChange}
              autoComplete="off"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {results.length > 0 ? (
              results.map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-base)] transition-colors"
                >
                  {m.profile_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.profile_image} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">
                      {m.full_name[0] ?? "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--text-heading)] truncate">
                      {m.full_name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {m.membership_number ? (
                        <span className="font-medium text-[var(--primary)]">
                          {m.membership_number}
                        </span>
                      ) : m.set_name ? (
                        `Class of ${m.set_name}`
                      ) : (
                        m.email ?? "—"
                      )}
                    </p>
                  </div>
                  {m.set_name && m.membership_number ? (
                    <span className="text-xs text-[var(--text-muted)] shrink-0">
                      Class of {m.set_name}
                    </span>
                  ) : m.email ? (
                    <span className="text-xs text-[var(--text-muted)] truncate shrink-0 max-w-[8rem]">
                      {m.email}
                    </span>
                  ) : null}
                </Link>
              ))
            ) : searching ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                Searching…
              </div>
            ) : query.trim() ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                No members found matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                Type a name, email, or TOSA number to find a member.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}