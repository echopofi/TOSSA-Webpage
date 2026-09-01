"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatusPill from "@/components/ui/StatusPill";
import Card from "@/components/ui/Card";
import { Users, MessageSquare, ExternalLink, MapPin, User } from "lucide-react";
import { apiGetSet, apiGetMembers } from "@/lib/api";
import type { GraduationSet, Member } from "@/lib/types";
import { initials } from "@/lib/utils";
import { use } from "react";
import { motion } from "framer-motion";
import { Reveal, Stagger, StaggerItem, fadeUp } from "@/lib/motion";

export default function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [set, setSet]         = useState<GraduationSet | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Spec v2: members endpoint uses ?setId= filter (no /sets/:id/members endpoint)
      const [sRes, mRes] = await Promise.all([
        apiGetSet(id),
        apiGetMembers({ setId: id, limit: 50 }),
      ]);
      setSet(sRes.data);
      setMembers(mRes.data.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <>
        <Navbar variant="public" />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </>
    );
  }

  if (!set) return null;

  return (
    <>
      <Navbar variant="public" />

      <main>
        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <section className="relative h-52 md:h-72 overflow-hidden bg-[var(--text-heading)]">
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-full flex flex-col justify-end pb-8">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
            >
              <motion.p variants={fadeUp} className="text-white/50 text-sm mb-1">
                Graduating Set
              </motion.p>
              <motion.h1
                variants={fadeUp}
                className="text-3xl md:text-5xl font-[family-name:var(--font-heading)] font-semibold text-white"
              >
                Class of {set.set_name}
              </motion.h1>
              <motion.div variants={fadeUp} className="flex items-center gap-4 mt-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-white/70 text-sm">
                  <Users size={15} />
                  {set.member_count ?? members.length} members
                </span>
                {set.start_year && set.end_year && (
                  <span className="text-white/50 text-sm">
                    {set.start_year} – {set.end_year}
                  </span>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Description */}
            {set.description && (
              <Reveal>
                <Card>
                  <h2 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-3">
                    About the Class of {set.set_name}
                  </h2>
                  <p className="text-[var(--text-body)] leading-relaxed text-sm">
                    {set.description}
                  </p>
                </Card>
              </Reveal>
            )}

            {/* Members grid */}
            <div>
              <Reveal>
                <h2 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4">
                  Members ({members.length})
                </h2>
              </Reveal>
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {members.map((m) => (
                  <StaggerItem key={m.id}>
                    <Link href={`/members/${m.id}`} className="group block h-full">
                      <Card className="flex items-start gap-4 h-full transition-shadow hover:shadow-lg hover:-translate-y-0.5">
                        {/* Avatar — profile_image per spec v2 */}
                        <div className="shrink-0">
                          {m.profile_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.profile_image}
                              alt={m.full_name}
                              className="w-14 h-14 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-[family-name:var(--font-heading)] font-semibold text-lg">
                              {initials(
                                m.full_name.split(" ")[0] ?? "?",
                                m.full_name.split(" ")[1] ?? ""
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-sm group-hover:text-[var(--primary)] transition-colors truncate">
                            {m.full_name}
                          </p>
                          {m.role_in_set && m.role_in_set !== "member" && (
                            <p className="text-xs text-[var(--primary)] font-medium capitalize mt-0.5">
                              {m.role_in_set.replace(/_/g, " ")}
                            </p>
                          )}
                          {/* address replaces location in v2 */}
                          {m.address && (
                            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5 truncate">
                              <MapPin size={11} />
                              {m.address}
                            </p>
                          )}
                          <div className="mt-2">
                            <StatusPill
                              status={m.is_active ? "paid" : "pending"}
                              label={m.is_active ? "Active" : "Inactive"}
                            />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>

          {/* Sidebar */}
          <Stagger className="flex flex-col gap-5">
            {/* WhatsApp CTA — group_invite_link per spec v2 (was whatsapp_link) */}
            {set.group_invite_link && (
              <StaggerItem>
                <Card className="text-center flex flex-col items-center gap-4 p-6 bg-[#25D366] border-0 text-white">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <MessageSquare size={24} />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-heading)] font-semibold text-base">
                      Join the WhatsApp Group
                    </h3>
                    <p className="text-white/75 text-xs mt-1">
                      Connect with Class of {set.set_name} in real time.
                    </p>
                  </div>
                  <a
                    href={set.group_invite_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-white text-[#128C7E] font-[family-name:var(--font-heading)] font-semibold text-sm py-2.5 rounded-lg hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Open Group <ExternalLink size={14} />
                  </a>
                </Card>
              </StaggerItem>
            )}

            {/* Set stats */}
            <StaggerItem>
              <Card>
                <h3 className="text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-4">
                  Set at a Glance
                </h3>
                <div className="flex flex-col gap-3 text-sm">
                  {[
                    { label: "Set Year",         value: set.set_name },
                    { label: "Years Active",      value: `${set.start_year} – ${set.end_year}` },
                    { label: "Registered Members", value: set.member_count ?? members.length },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex justify-between border-b border-[var(--border-subtle)] pb-2.5 last:border-0 last:pb-0"
                    >
                      <span className="text-[var(--text-muted)]">{label}</span>
                      <span className="font-medium text-[var(--text-heading)]">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </StaggerItem>

            {/* CTA */}
            <StaggerItem>
              <Card className="bg-[var(--primary-light)] border-0">
                <p className="text-sm text-[var(--text-body)] mb-3">
                  Are you a member of the Class of {set.set_name}?
                </p>
                <Link href="/register" className="btn-primary w-full justify-center text-sm py-2.5">
                  <User size={15} /> Join Your Set
                </Link>
              </Card>
            </StaggerItem>
          </Stagger>
        </section>
      </main>

      <Footer />
    </>
  );
}
