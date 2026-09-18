import { format, parseISO, isValid } from "date-fns";

/** Format a number as Nigerian Naira */
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Format an ISO date string */
export function formatDate(
  iso: string | undefined | null,
  fmt = "d MMM yyyy"
): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  return isValid(d) ? format(d, fmt) : "—";
}

/** Truncate text to a max length */
export function truncate(text: string, max = 100): string {
  return text.length > max ? text.slice(0, max).trim() + "…" : text;
}

/**
 * Map a spec v2 Payment.status to a pill status.
 * payments table uses: success / failed / pending
 */
export function paymentStatusToPill(
  status: "success" | "failed" | "pending"
): "paid" | "overdue" | "pending" {
  if (status === "success") return "paid";
  if (status === "failed")  return "overdue";
  return "pending";
}

/**
 * Map a spec v2 DuesPayment.status to a pill status.
 * dues_payments table uses: paid / partial / arrears
 */
export function duesStatusToPill(
  status: "paid" | "partial" | "arrears"
): "paid" | "pending" | "overdue" {
  if (status === "paid")    return "paid";
  if (status === "arrears") return "overdue";
  return "pending"; // partial
}

/** Initials from a full name string */
export function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// Stopgap super-admin identity — mirrors the backend constant
// (backend/src/config/index.js → superAdminEmail). The role system only
// distinguishes member/admin today; this flag is swapped for a real DB flag
// once there is more than one admin to manage.
export const SUPER_ADMIN_EMAIL = "echopofii@gmail.com";

/** Super Admin = an admin whose email matches the configured super-admin address. */
export function isSuperAdmin(user?: {
  email?: string | null;
  role?: string | null;
} | null): boolean {
  return user?.role === "admin" && user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
}
