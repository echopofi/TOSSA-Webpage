"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Users, ArrowRight } from "lucide-react";
import { apiGetSets } from "@/lib/api";
import type { GraduationSet } from "@/lib/types";

export default function SetsPage() {
  const [sets, setSets]       = useState<GraduationSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetSets().then((r) => {
      setSets(r.data);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Navbar variant="public" />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Our Graduating Sets
          </h1>
          <div className="section-divider mt-3" />
          <p className="text-[var(--text-muted)] mt-2 max-w-lg">
            Each set represents a chapter in our school's story. Find yours and reconnect with your classmates.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sets.map((set) => (
              <Link key={set.id} href={`/sets/${set.id}`} className="group">
                <div className="card h-full flex flex-col overflow-hidden group-hover:shadow-lg transition-shadow">
                  {/* Coloured header band in place of banner (no banner_url in spec v2) */}
                  <div className="h-28 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center">
                    <span className="text-4xl font-[family-name:var(--font-heading)] font-semibold text-white/90">
                      {set.set_name}
                    </span>
                  </div>
                  {/* Content */}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-lg group-hover:text-[var(--primary)] transition-colors">
                      Class of {set.set_name}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {set.start_year} – {set.end_year}
                    </p>
                    {set.description && (
                      <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed line-clamp-2">
                        {set.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-4 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {set.member_count ?? "—"} members
                      </span>
                      <span className="text-[var(--primary)] font-medium flex items-center gap-1">
                        View Set <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
