import Link from "next/link";
import Image from "next/image";
import AuthGuard from "@/components/auth/AuthGuard";
import { ArrowLeft } from "lucide-react";

export default function IdCardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
        {/* Minimal top bar — no sidebar competing for attention */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <Image
                src="/assets/logo.jpeg"
                alt="TSSOSA logo"
                width={34}
                height={30}
                className="rounded-lg object-cover"
              />
              <div className="leading-tight truncate">
                <p className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-sm">
                  My ID Card
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">TSSOSA Alumni Association</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-[var(--text-body)] hover:text-[var(--primary)] font-medium flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}