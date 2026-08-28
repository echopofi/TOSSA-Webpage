/**
 * lib/session.ts
 * Client-side session store backed by localStorage.
 * In production the authoritative source is the backend (/api/auth/me);
 * this only persists the identity captured at signup/login so the dashboard
 * can greet the actual user while API responses are still mocked.
 *
 * Exposes a subscribe() + getSnapshot() pair so components can react to auth
 * changes via useSyncExternalStore (used by AuthGuard and the Navbar).
 */

export interface SessionUser {
  full_name: string;
  email: string;
  role?: "member" | "admin";
  setId?: string;
  set_name?: string;
  gender?: string;
  phone?: string;
  address?: string;
  birth_day?: string;
  birth_month?: string;
  bio?: string;
  profile_image?: string;
}

const KEY = "tssosa_current_user";
const listeners = new Set<() => void>();
// undefined = not read yet this session; null = explicitly logged out/none.
let cached: SessionUser | null | undefined = undefined;

function readFromStorage(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

// Keep in sync across browser tabs/windows.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    cached = e.newValue ? JSON.parse(e.newValue) : null;
    notifyListeners();
  });
}

export function saveCurrentUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(user));
  cached = user;
  notifyListeners();
}

export function getCurrentUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  if (cached === undefined) cached = readFromStorage();
  return cached;
}

export function clearCurrentUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  cached = null;
  notifyListeners();
}

/** Subscribe to session changes (returns an unsubscribe fn). */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot for useSyncExternalStore getSnapshot. */
export function getCurrentUserSnapshot(): SessionUser | null {
  if (cached === undefined) cached = readFromStorage();
  return cached;
}