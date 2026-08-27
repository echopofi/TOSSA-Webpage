/**
 * lib/session.ts
 * Minimal client-side session store backed by localStorage.
 * In production the authoritative source is the backend (/api/auth/me);
 * this only persists the identity captured at signup so the dashboard
 * can greet the actual user while API responses are still mocked.
 */

export interface SessionUser {
  full_name: string;
  email: string;
  setId?: string;
  set_name?: string;
}

const KEY = "tssosa_current_user";

export function saveCurrentUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function clearCurrentUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}