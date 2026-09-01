"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SetStrip from "@/components/home/SetStrip";
import { MOCK_SETS } from "@/lib/mockData";
import { GraduationCap, CreditCard, MessageSquare, ArrowRight, CheckCircle } from "lucide-react";
import { Reveal, Stagger, StaggerItem, fadeLeft, fadeRight, fadeUp, sheenClass } from "@/lib/motion";

export default function HomePage() {

  return (
    <>
      <Navbar variant="public" />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[var(--text-heading)] text-white">
          {/* Background gradient overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at 70% 50%, #7C6FD1 0%, transparent 60%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 lg:py-32">
            <div className="max-w-2xl">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.12 } },
                }}
              >
                <motion.span
                  variants={fadeUp}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold mb-6"
                >
                  <GraduationCap size={13} />
                  TCNN Alumni Network
                </motion.span>
                <motion.h1
                  variants={fadeUp}
                  className="text-4xl md:text-5xl lg:text-6xl font-[family-name:var(--font-heading)] font-semibold leading-[1.1] mb-6"
                  style={{ color: '#141727' }}
                >
                  Every Set.
                  <br />
                  Every Story.
                  <br />
                  <span className="text-[var(--primary)]">One Community.</span>
                </motion.h1>
                <motion.p variants={fadeUp} className="text-white/70 text-lg md:text-xl leading-relaxed mb-8 max-w-lg">
                  Register, connect with your graduating set, pay dues, and stay part of the community that shaped you.
                </motion.p>
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/register"
                    className="btn-primary text-base px-7 py-3"
                  >
                    Join Your Set
                    <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="/sets"
                    className="btn-outline text-base px-7 py-3 border-white/30 text-white hover:bg-white/10"
                  >
                    Browse Sets
                  </Link>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] text-[var(--text-heading)]">
              How it works
            </h2>
            <div className="section-divider mx-auto mt-3" />
            <p className="text-[var(--text-muted)] mt-2 max-w-md mx-auto">
              Three simple steps to become a verified member of your alumni community.
            </p>
          </Reveal>

          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: GraduationCap,
                step: "01",
                title: "Register & Join Your Set",
                desc: "Create your account, fill in your bio-data, and select your graduating year. Your profile will be reviewed and verified.",
              },
              {
                icon: CreditCard,
                step: "02",
                title: "Pay Registration Fee & Dues",
                desc: "A one-time registration fee gets you started. Annual dues keep the association running and fund community initiatives.",
              },
              {
                icon: MessageSquare,
                step: "03",
                title: "Connect & Stay Involved",
                desc: "Access your set's WhatsApp group, browse member profiles, and receive announcements from the association.",
              },
            ].map(({ icon: Icon, step, title, desc }) => (
              <StaggerItem key={step}>
                <div className={`card p-6 flex flex-col gap-4 h-full ${sheenClass}`}>
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-[var(--primary)]">
                      <Icon size={22} />
                    </div>
                    <span className="text-4xl font-[family-name:var(--font-heading)] font-semibold text-[var(--border-subtle)]">
                      {step}
                    </span>
                  </div>
                  <h3 className="text-lg font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                    {title}
                  </h3>
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">{desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ── Sets spotlight ─────────────────────────────────────────────────── */}
        <section className="bg-[var(--surface-card)] border-y border-[var(--border-subtle)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
            <Reveal className="mb-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] text-[var(--text-heading)]">
                  Our Sets
                </h2>
                <div className="section-divider mt-3" />
                <p className="text-[var(--text-muted)] mt-2">
                  Each set is a chapter in our school&apos;s story.
                </p>
              </div>
            </Reveal>

            <SetStrip sets={MOCK_SETS} />

            <div className="mt-12 text-center">
              <Link
                href="/sets"
                className="btn-primary text-base px-7 py-3 inline-flex items-center gap-2"
              >
                See all sets <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Why join CTA ──────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <Reveal variants={fadeLeft}>
            <h2 className="text-3xl md:text-4xl font-[family-name:var(--font-heading)] text-[var(--text-heading)]">
              Why join the alumni association?
            </h2>
            <div className="section-divider mt-3" />
            <ul className="mt-6 space-y-3">
              {[
                "Access your set's private WhatsApp community",
                "Build your professional profile and network",
                "Attend reunions, events, and AGMs",
                "Fund scholarships and school development through dues",
                "Receive updates on association activities",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[var(--text-body)]">
                  <CheckCircle
                    size={18}
                    className="text-[var(--success)] mt-0.5 shrink-0"
                  />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal variants={fadeRight}>
            <div className="card p-8 flex flex-col items-center text-center gap-5 bg-[var(--primary)] text-white border-0">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
                <GraduationCap size={28} />
              </div>
              <h3 className="text-2xl font-[family-name:var(--font-heading)] font-semibold">
                Ready to reconnect?
              </h3>
              <p className="text-white/75 text-sm leading-relaxed">
                It takes about 3 minutes to register. Your set is waiting.
              </p>
              <Link
                href="/register"
                className="w-full bg-white text-[var(--primary)] hover:bg-white/90 font-[family-name:var(--font-heading)] font-semibold py-3 rounded-lg transition-colors text-sm"
              >
                Get Started Free
              </Link>
              <p className="text-white/50 text-xs">
                Registration fee: ₦10,000 (one-time)
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </>
  );
}
