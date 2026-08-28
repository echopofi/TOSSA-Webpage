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

const subscribeNoop = () => () => {};

/**
 * True once we've hydrated on the client (false during SSR). The server never
 * calls subscribe, so it always sees the server snapshot (false).
 */
const useHydrated = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

/**
 * Frontend route guard. Renders nothing until we've confirmed a valid local
 * session (AuthGuard wraps the whole protected layout, so the page shell itself
 * is not shown to unauthenticated users):
 *   - no session            → redirect to /login?next=<original url>
 *   - session but not admin → redirect to /dashboard (admin-only routes)
 *   - valid session         → render children
 *
 * Hydration note: during the initial client render React commits the SSR snapshots
 * (null / not-hydrated), so the redirect is gated on `hydrated`; otherwise the
 * very first committed effect would bounce logged-in users to /login before the
 * real localStorage snapshot is applied.
 *
 * NOTE: middleware.ts can't read localStorage (no httpOnly auth cookie in this
 * mock phase), which is why this is a client-side guard. Once the real backend
 * issues httpOnly cookies, add a server middleware.ts check for that cookie and
 * rely on /api/auth/me server-side; keep this guard as a defensive layer.
 */
export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeAuth, getCurrentUserSnapshot, () => null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (user === null) {
      const dest =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/dashboard";
      router.replace(`/login?next=${encodeURIComponent(dest)}`);
    } else if (requireAdmin && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [hydrated, user, requireAdmin, router]);

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