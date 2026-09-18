"use client";

import Link from "next/link";
import { ArrowRight, Construction } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function AboutPage() {
  return (
    <>
      <Navbar variant="public" />

      <main>
        <section className="relative overflow-hidden bg-[var(--text-heading)] text-white">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at 70% 50%, #7C6FD1 0%, transparent 60%)",
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 lg:py-32 text-center">
            <div className="mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold mb-6">
                <Construction size={13} />
                Coming Soon
              </span>
              <h1
                className="text-4xl md:text-5xl font-[family-name:var(--font-heading)] font-semibold leading-[1.1] mb-6"
                style={{ color: "#141727" }}
              >
                About TCNN Alumni
                <br />
                <span className="text-[var(--primary)]">In Progress.</span>
              </h1>
              <p className="text-white/70 text-lg md:text-xl leading-relaxed mb-8 max-w-lg mx-auto">
                We&apos;re putting the finishing touches on this page so you can
                learn more about the association that keeps every set connected.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Link href="/" className="btn-primary text-base px-7 py-3">
                  Back to Home
                </Link>
                <Link
                  href="/sets"
                  className="btn-outline text-base px-7 py-3 border-white/30 text-white hover:bg-white/10"
                >
                  Browse Sets
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}