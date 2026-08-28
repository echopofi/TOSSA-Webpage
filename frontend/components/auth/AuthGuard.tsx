"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { subscribeAuth, getCurrentUserSnapshot } from "@/lib/session";

interface AuthGuardProps {
  children: React.ReactNode;
  /** When true, also requires the logged-in user to be an admin. */
  requireAdmin?: boolean;
}

/**
 * Frontend route guard. Renders nothing until we've confirmed a valid local
 * session (AuthGuard wraps the whole protected layout, so the page shell itself
 * is not shown to unauthenticated users):
 *   - no session            → redirect to /login?next=<original url>
 *   - session but not admin → redirect to /dashboard (admin-only routes)
 *   - valid session         → render children
 *
 * NOTE: middleware.ts can't read localStorage (no httpOnly auth cookie in this
 * mock phase), which is why this is a client-side guard. Once the real backend
 * issues httpOnly cookies, add a server middleware.ts check for that cookie and
 * rely on /api/auth/me server-side; keep this guard as a defensive layer.
 */
export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeAuth, getCurrentUserSnapshot, () => null);

  useEffect(() => {
    if (user === null) {
      const dest =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(dest)}`);
    } else if (requireAdmin && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [user, requireAdmin, router]);

  const denied = user === null || (requireAdmin && user.role !== "admin");

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}