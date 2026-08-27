"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface NavbarProps {
  variant?: "public" | "auth";
  userName?: string;
}

export default function Navbar({ variant = "public", userName }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-lg"
        >
          <Image
            src="/assets/logo.jpeg"
            alt="AlumniConnect logo"
            width={52}
            height={42}
            className="rounded-lg object-cover"
          />
          TSSOSA
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-body)]">
          <Link href="/sets" className="hover:text-[var(--primary)] transition-colors">
            Our Sets
          </Link>
          <Link href="/about" className="hover:text-[var(--primary)] transition-colors">
            About
          </Link>
          {variant === "public" ? (
            <>
              <Link href="/login" className="hover:text-[var(--primary)] transition-colors">
                Sign in
              </Link>
              <Button as="button" size="sm">
                <Link href="/register">Join Now</Link>
              </Button>
            </>
          ) : (
            <>
              <Link href="/dashboard" className="hover:text-[var(--primary)] transition-colors">
                Dashboard
              </Link>
              <span className="text-[var(--text-muted)] border-l border-[var(--border-subtle)] pl-4">
                {userName}
              </span>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-[var(--primary-light)] text-[var(--text-heading)]"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-white border-t border-[var(--border-subtle)] px-4 py-4 flex flex-col gap-3 text-sm font-medium">
          <Link href="/sets" className="py-2 hover:text-[var(--primary)]" onClick={() => setOpen(false)}>
            Our Sets
          </Link>
          <Link href="/about" className="py-2 hover:text-[var(--primary)]" onClick={() => setOpen(false)}>
            About
          </Link>
          {variant === "public" ? (
            <>
              <Link href="/login" className="py-2 hover:text-[var(--primary)]" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button fullWidth>Join Now</Button>
              </Link>
            </>
          ) : (
            <Link href="/dashboard" className="py-2 hover:text-[var(--primary)]" onClick={() => setOpen(false)}>
              Dashboard
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
