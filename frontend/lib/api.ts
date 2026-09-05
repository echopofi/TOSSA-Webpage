/**
 * lib/api.ts
 * Reconciled against alumni-website-shared-spec.md v2.
 *
 * All endpoint paths now carry the /api/ prefix and match Section 2 exactly.
 * Replace each function body with a real fetch() call when the backend is live —
 * the signature, param names, and return types are intentionally stable.
 *
 * ⚠ STILL PENDING (from spec Section 6):
 *  P1 — Registration fee amount: placeholder ₦10,000. Awaiting confirmation.
 *  P2 — Annual dues amounts: placeholder ₦25,000–30,000. Awaiting confirmation.
 *       Do NOT hardcode these in UI — fetch from /api/dues/cycles and display server value.
 *
 * ✅ RESOLVED from v1 questions:
 *  Q1/Q2 — Amounts still pending (see P1/P2 above)
 *  Q3  — Verification is admin-side; no self-serve email confirm in scope
 *  Q4  — Pagination: limit/offset, shape { data, total, limit, offset }
 *  Q5  — Currency: NGN; hardcode label only, never amount
 *  Q6  — Gallery endpoint: NOT in spec v2 — removed from API layer
 *  Q7  — Dues cycles: GET /api/dues/cycles ✅
 *  Q8  — Admin stats: GET /api/admin/dashboard ✅
 *  Q9  — Avatar/Cloudinary: post-registration, in profile edit ✅
 *  Q10 — PII rule confirmed: email/phone omitted on public/unauth ✅
 *  Q11 — Milestones: GET/POST/DELETE /api/members/:id/milestones ✅
 *  Q12 — Payment redirect: show processing state, wait on webhook (no polling) ✅
 *  Q13 — Member search: GET /api/members/search?q= (admin) ✅
 *  Q14 — Scheduled announcements: supported via scheduled_at field ✅
 */

import type {
  AuthUser,
  AuthMeResponse,
  RegisterPayload,
  Member,
  GraduationSet,
  Payment,
  PaystackInitResponse,
  DuesCycle,
  DuesPayment,
  DuesSummary,
  Announcement,
  BroadcastPayload,
  AdminDashboard,
  MemberMilestone,
  PaginatedResponse,
  ApiSuccess,
  ElectionPosition,
  ElectionApplication,
  ExcoOfficer,
  CloudinarySignature,
  AssignOfficerPayload,
  PendingMember,
} from "@/lib/types";

import {
  MOCK_AUTH_ME_RESPONSE,
  MOCK_MEMBERS,
  MOCK_SETS,
  MOCK_PAYMENTS,
  MOCK_DUES_CYCLES,
  MOCK_DUES_PAYMENTS,
  MOCK_DUES_SUMMARY,
  MOCK_ANNOUNCEMENTS,
  MOCK_MILESTONES,
  MOCK_ELECTION_POSITIONS,
  MOCK_ELECTION_APPLICATIONS,
  MOCK_EXCO_OFFICERS,
} from "@/lib/mockData";

import { getCurrentUser, getAccessToken } from "@/lib/session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms = 400) => new Promise<void>((res) => setTimeout(res, ms));

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

/** Carries the HTTP status of a failed request so callers can branch (401 → not
 *  registered / wrong password, 403 → unverified, 0 → network failure). */
export class ApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/**
 * Shared fetch for authenticated endpoints. Attaches the Bearer access token
 * saved at login (see lib/session.ts) and normalises errors into
 * ApiRequestError so callers branch on the status code.
 */
async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const { getAccessToken } = await import("@/lib/session");
  const token = getAccessToken();

  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
      credentials: "include",
    });
  } catch {
    throw new ApiRequestError(0, "Unable to reach the server. Please try again.");
  }

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = typeof body?.error === "string" ? body.error : message;
    } catch {
      /* non-JSON error body — keep default */
    }
    throw new ApiRequestError(res.status, message);
  }
  return res;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

// Mirrors the backend seed (backend/tests/helpers/seed.js) so the "registered
// users only" contract also holds when no backend is configured.
const REGISTERED_DEMO_ACCOUNTS: Array<{ email: string; password: string; user: AuthUser }> = [
  {
    email: "admin@test.com",
    password: "admin12345",
    user: { id: "usr_admin_seed", full_name: "Admin User", email: "admin@test.com", role: "admin", is_verified: true },
  },
  {
    email: "member@test.com",
    password: "member12345",
    user: { id: "usr_member_seed", full_name: "Member User", email: "member@test.com", role: "member", is_verified: true },
  },
];

/**
 * POST /api/auth/login — registered users only (valid email + password).
 * The backend bcrypt-verifies against the DB and also rejects unverified
 * accounts (403). Unregistered or wrong-credential attempts throw an
 * ApiRequestError(401) so the login page can notify the user and route them
 * to the registration flow — the app never signs anyone in without a real,
 * verified account.
 */
export async function apiLogin(
  email: string,
  password: string
): Promise<ApiSuccess<{ user: AuthUser; access_token: string }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl) {
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // persist the httpOnly refresh-token cookie
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new ApiRequestError(0, "Unable to reach the server. Please try again.");
    }

    if (!res.ok) {
      let message = "Invalid credentials";
      try {
        const body = await res.json();
        message = typeof body?.error === "string" ? body.error : message;
      } catch {
        /* non-JSON error body — keep default */
      }
      throw new ApiRequestError(res.status, message);
    }

    const json = (await res.json()) as
      | { user?: { id: string; email: string; fullName: string; role?: string }; accessToken?: string }
      | undefined;
    const u = json?.user;
    if (!u) {
      throw new ApiRequestError(0, "Unexpected server response. Please try again.");
    }
    return ok({
      user: {
        id: u.id,
        full_name: u.fullName,
        email: u.email,
        role: u.role === "admin" ? "admin" : "member",
        is_verified: true,
      },
      access_token: json?.accessToken ?? "",
    });
  }

  // Fallback (no backend): same registered-only contract against the seeded
  // demo accounts instead of accepting arbitrary credentials.
  await delay();
  const attempt = email.trim().toLowerCase();
  const match = REGISTERED_DEMO_ACCOUNTS.find(
    (a) => a.email === attempt && a.password === password
  );
  if (!match) {
    throw new ApiRequestError(401, "Invalid credentials");
  }
  return ok({ user: match.user, access_token: "mock_access_token" });
}

/** POST /api/auth/register — creates a real account; backend returns 409 for
 *  duplicate email, 400 for missing fields / password < 8 chars / bad set id.
 *  New users are unverified (is_verified:false) until an admin approves them,
 *  so no session is created here — the caller shows a success screen.
 */
export async function apiRegister(
  payload: RegisterPayload
): Promise<ApiSuccess<{ user: AuthUser; access_token: string }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    // Strict like login: registration requires a real backend.
    throw new ApiRequestError(0, "Registration isn't available yet. Please try again later.");
  }

  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    res = await fetch(`${apiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fullName: payload.full_name,
        email: payload.email,
        password: payload.password,
        setId: payload.setId,
        gender: payload.gender,
        phone: payload.phone,
        address: payload.address,
        bio: payload.bio,
        profileImage: payload.profile_image,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new ApiRequestError(
      0,
      controller.signal.aborted
        ? "The server took too long to respond. Please try again."
        : "Unable to reach the server. Please try again."
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = "Registration failed";
    try {
      const body = await res.json();
      message = typeof body?.error === "string" ? body.error : message;
    } catch {
      /* non-JSON error body — keep default */
    }
    throw new ApiRequestError(res.status, message);
  }

  const json = (await res.json()) as
    | { user?: { id: string; email: string; fullName: string; role?: string; isVerified?: boolean } }
    | undefined;
  const u = json?.user;
  if (!u) {
    throw new ApiRequestError(0, "Unexpected server response. Please try again.");
  }
  return ok({
    user: {
      id: u.id,
      full_name: u.fullName,
      email: u.email,
      role: u.role === "admin" ? "admin" : "member",
      is_verified: !!u.isVerified,
    },
    access_token: "",
  });
}

/**
 * GET /api/auth/me — returns user + member + set.
 * Prefers the live backend (requires a saved access token). Falls back to the
 * identity captured at signup (see lib/session.ts) only when no backend/token
 * exists — so dashboards never silently show stale data once the backend is up.
 */
export async function apiMe(): Promise<ApiSuccess<AuthMeResponse>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (apiUrl && getAccessToken()) {
    const res = await authedFetch("/api/auth/me");
    const json = (await res.json()) as
      | {
          user?: { id: string; email: string; fullName: string; role?: string; isVerified?: boolean };
          member?: {
            id: string;
            matricNumber?: string | null;
            occupation?: string | null;
            gender?: string | null;
            phone?: string | null;
            address?: string | null;
            bio?: string | null;
            profileImage?: string | null;
            isActive?: boolean;
            joinedAt?: string;
            sets?: Array<{ id: string; setName: string; roleInSet?: string | null }>;
          };
        }
      | undefined;
    const u = json?.user;
    if (!u) {
      throw new ApiRequestError(0, "Unexpected server response. Please try again.");
    }
    const firstSet = json?.member?.sets?.[0];
    return ok({
      user: {
        id: u.id,
        full_name: u.fullName,
        email: u.email,
        role: u.role === "admin" ? "admin" : "member",
        is_verified: !!u.isVerified,
      },
      member: {
        id: json?.member?.id ?? "",
        user_id: u.id,
        full_name: u.fullName,
        email: u.email,
        matric_number: json?.member?.matricNumber ?? undefined,
        occupation: json?.member?.occupation ?? undefined,
        gender: json?.member?.gender ?? undefined,
        phone: json?.member?.phone ?? undefined,
        address: json?.member?.address ?? undefined,
        bio: json?.member?.bio ?? undefined,
        profile_image: json?.member?.profileImage ?? undefined,
        is_active: json?.member?.isActive ?? true,
        joined_at: json?.member?.joinedAt ?? new Date().toISOString(),
        set_id: firstSet?.id,
        set_name: firstSet?.setName,
        role_in_set: firstSet?.roleInSet ?? undefined,
      },
      set: firstSet
        ? {
            id: firstSet.id,
            set_name: firstSet.setName,
            start_year: undefined as unknown as number,
            end_year: undefined as unknown as number,
            description: undefined,
            group_invite_link: undefined,
            is_active: true,
            member_count: 0,
            created_at: "",
            updated_at: "",
          }
        : null,
    });
  }

  await delay(200);
  const session = getCurrentUser();
  if (session) {
    const user: AuthUser = {
      id: `usr_${Date.now()}`,
      full_name: session.full_name,
      email: session.email,
      role: session.role === "admin" ? "admin" : "member",
      is_verified: true,
    };
    const member: Member = {
      id: `mem_${Date.now()}`,
      user_id: user.id,
      full_name: session.full_name,
      email: session.email,
      gender: session.gender,
      phone: session.phone,
      address: session.address,
      bio: session.bio,
      profile_image: session.profile_image,
      is_active: true,
      joined_at: new Date().toISOString(),
      set_id: session.setId,
      set_name: session.set_name,
    };
    const set = session.setId
      ? MOCK_SETS.find((s) => s.id === session.setId) ?? null
      : null;
    return ok({ user, member, set });
  }
  return ok(MOCK_AUTH_ME_RESPONSE);
}

/**
 * Builds a best-effort Member from the localStorage session (used only when the
 * live /api/auth/me is unreachable or the access token is missing/expired, so
 * the protected pages can still render instead of hanging or blanking).
 * Returns null when there is no session.
 */
function memberFromSession(): Member | null {
  const session = getCurrentUser();
  if (!session) return null;
  const user: AuthUser = {
    id: `usr_${Date.now()}`,
    full_name: session.full_name,
    email: session.email,
    role: session.role === "admin" ? "admin" : "member",
    is_verified: true,
  };
  return {
    id: `mem_${Date.now()}`,
    user_id: user.id,
    full_name: session.full_name,
    email: session.email,
    gender: session.gender,
    phone: session.phone,
    address: session.address,
    bio: session.bio,
    profile_image: session.profile_image,
    is_active: true,
    joined_at: new Date().toISOString(),
    set_id: session.setId,
    set_name: session.set_name,
  };
}

/**
 * Member source for dashboard / ID-card views: fresh server data first, a
 * deliberate localStorage fallback only if the live call fails.
 */
export async function loadMember(): Promise<Member | null> {
  try {
    return (await apiMe()).data.member;
  } catch {
    return memberFromSession();
  }
}

/** POST /api/auth/refresh */
export async function apiRefresh(): Promise<ApiSuccess<{ access_token: string }>> {
  await delay(200);
  return ok({ access_token: "mock_access_token_refreshed" });
}

/** PATCH /api/auth/me — authenticated user edits their own profile. */
export async function apiUpdateProfile(payload: {
  fullName?: string;
  gender?: string;
  phone?: string;
  address?: string;
  bio?: string;
  profileImage?: string;
  matricNumber?: string;
  occupation?: string;
}): Promise<ApiSuccess<{ user: AuthUser; member: Member }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Profile editing requires the backend. Please sign in again.");
  }
  const res = await authedFetch("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  // Backend returns camelCase — normalise into the shared snake_case types so
  // callers can read .user.full_name / .member.profile_image directly.
  const json = (await res.json()) as
    | {
        user?: { id?: string; email?: string; fullName?: string; role?: string };
        member?: {
          id?: string;
          matricNumber?: string | null;
          occupation?: string | null;
          gender?: string | null;
          phone?: string | null;
          address?: string | null;
          bio?: string | null;
          profileImage?: string | null;
        };
      }
    | undefined;
  const u = json?.user;
  if (!u) {
    throw new ApiRequestError(0, "Unexpected server response. Please try again.");
  }
  const m = json?.member;
  const member: Member = {
    id: m?.id ?? "",
    user_id: u.id ?? "",
    full_name: u.fullName ?? "",
    email: u.email ?? "",
    matric_number: m?.matricNumber ?? undefined,
    occupation: m?.occupation ?? undefined,
    gender: m?.gender ?? undefined,
    phone: m?.phone ?? undefined,
    address: m?.address ?? undefined,
    bio: m?.bio ?? undefined,
    profile_image: m?.profileImage ?? undefined,
    is_active: true,
    joined_at: new Date().toISOString(),
  };
  return ok({
    user: {
      id: u.id ?? "",
      full_name: u.fullName ?? "",
      email: u.email ?? "",
      role: u.role === "admin" ? "admin" : "member",
      is_verified: true,
    },
    member,
  });
}

/** PATCH /api/auth/password — requires the current password; revokes other sessions. */
export async function apiChangePassword(
  currentPassword: string,
  newPassword: string
): Promise<ApiSuccess<{ message: string }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Changing the password requires the backend. Please sign in again.");
  }
  const res = await authedFetch("/api/auth/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return ok({ message: "Password changed successfully" });
}

/** POST /api/auth/logout */
export async function apiLogout(): Promise<ApiSuccess<null>> {
  await delay(200);
  return ok(null);
}

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * GET /api/members
 * Optional ?setId= filter, paginated.
 * Returns email/phone only on authenticated responses (PII rule — enforced server-side).
 */
export async function apiGetMembers(
  params?: { setId?: string; limit?: number; offset?: number }
): Promise<ApiSuccess<PaginatedResponse<Member>>> {
  await delay();
  let results = MOCK_MEMBERS;
  if (params?.setId) {
    results = results.filter((m) => m.set_id === params.setId);
  }
  const limit  = params?.limit  ?? 20;
  const offset = params?.offset ?? 0;
  const slice  = results.slice(offset, offset + limit);
  return ok({ data: slice, total: results.length, limit, offset });
}

/** GET /api/members/:id — authenticated; email/phone PII included on auth responses */
export async function apiGetMember(id: string): Promise<ApiSuccess<Member>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl && getAccessToken()) {
    const res = await authedFetch(`/api/members/${id}`);
    const json = (await res.json()) as
      | {
          id?: string;
          fullName?: string;
          email?: string | null;
          matricNumber?: string | null;
          occupation?: string | null;
          gender?: string | null;
          phone?: string | null;
          address?: string | null;
          bio?: string | null;
          profileImage?: string | null;
          isActive?: boolean;
          joinedAt?: string;
          sets?: Array<{ id: string; setName: string; roleInSet?: string | null }>;
        }
      | undefined;
    if (!json || !json.id || !json.fullName) {
      throw new ApiRequestError(0, "Unexpected server response. Please try again.");
    }
    // Backend returns camelCase — normalise into the shared snake_case Member shape.
    const firstSet = Array.isArray(json.sets) ? json.sets[0] : undefined;
    return ok({
      id: json.id,
      user_id: "", // not returned by the detail endpoint
      full_name: json.fullName,
      email: json.email ?? undefined,
      matric_number: json.matricNumber ?? undefined,
      occupation: json.occupation ?? undefined,
      gender: json.gender ?? undefined,
      phone: json.phone ?? undefined,
      address: json.address ?? undefined,
      bio: json.bio ?? undefined,
      profile_image: json.profileImage ?? undefined,
      is_active: json.isActive ?? true,
      joined_at: json.joinedAt ?? new Date().toISOString(),
      set_id: firstSet?.id,
      set_name: firstSet?.setName,
      role_in_set: firstSet?.roleInSet ?? undefined,
    });
  }

  // Non-real-backend fallback: best-effort match, else first mock member
  await delay();
  const member = MOCK_MEMBERS.find((m) => m.id === id) ?? MOCK_MEMBERS[0];
  return ok(member);
}

/**
 * GET /api/members/search?q=
 * Admin only — powers individual announcement targeting.
 */
export async function apiSearchMembers(
  q: string
): Promise<ApiSuccess<Member[]>> {
  await delay(300);
  const lower = q.toLowerCase();
  const results = MOCK_MEMBERS.filter(
    (m) =>
      m.full_name.toLowerCase().includes(lower) ||
      (m.email ?? "").toLowerCase().includes(lower)
  );
  return ok(results);
}

/** PATCH /api/members/:id (admin) */
export async function apiUpdateMember(
  id: string,
  payload: Partial<Member>
): Promise<ApiSuccess<Member>> {
  await delay(500);
  const member = MOCK_MEMBERS.find((m) => m.id === id) ?? MOCK_MEMBERS[0];
  return ok({ ...member, ...payload });
}

// ─── Sets ─────────────────────────────────────────────────────────────────────

/** GET /api/sets — public, includes member_count */
export async function apiGetSets(): Promise<ApiSuccess<GraduationSet[]>> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sets`);
  interface SetsEntry {
    id: string;
    setName: string;
    startYear: number;
    endYear: number;
    description?: string | null;
    groupInviteLink?: string | null;
    memberCount?: number;
    createdAt: string;
  }
  const json = (await res.json()) as { sets?: SetsEntry[] } | undefined;
  // Backend returns { sets: [...] } — normalise to { success, data }
  const sets: GraduationSet[] = (json?.sets ?? []).map((s) => ({
    id:               s.id,
    set_name:         s.setName,
    start_year:       s.startYear,
    end_year:         s.endYear,
    description:      s.description ?? undefined,
    group_invite_link: s.groupInviteLink ?? undefined,
    is_active:        true,
    member_count:     s.memberCount,
    created_at:       s.createdAt,
    updated_at:       s.createdAt,
  }));
  return { success: true, data: sets };
}

/** GET individual set (no dedicated endpoint in spec — use sets list + filter client-side) */
export async function apiGetSet(id: string): Promise<ApiSuccess<GraduationSet>> {
  const { data: sets } = await apiGetSets();
  const set = sets.find((s) => s.id === id) ?? sets[0];
  return { success: true, data: set };
}

// ─── Member Milestones ────────────────────────────────────────────────────────

/**
 * GET /api/members/:id/milestones
 * Returns empty array if member has never customised their timeline.
 * Frontend falls back to auto-generated default in that case.
 */
export async function apiGetMilestones(
  memberId: string
): Promise<ApiSuccess<MemberMilestone[]>> {
  await delay();
  return ok(MOCK_MILESTONES.filter((m) => m.member_id === memberId));
}

/** POST /api/members/:id/milestones (member, own only) */
export async function apiCreateMilestone(
  memberId: string,
  payload: { title: string; description?: string; milestone_date: string }
): Promise<ApiSuccess<MemberMilestone>> {
  await delay(500);
  const ms: MemberMilestone = {
    id:             `ms_${Date.now()}`,
    member_id:      memberId,
    title:          payload.title,
    description:    payload.description,
    milestone_date: payload.milestone_date,
    created_at:     new Date().toISOString(),
    updated_at:     new Date().toISOString(),
  };
  return ok(ms);
}

/** DELETE /api/members/:id/milestones/:milestoneId (member, own only) */
export async function apiDeleteMilestone(
  _memberId: string,
  _milestoneId: string
): Promise<ApiSuccess<null>> {
  await delay(300);
  return ok(null);
}

// ─── Payments (registration fee — one-time) ───────────────────────────────────

/**
 * POST /api/payments/initiate-registration
 * Backend computes amount from config; frontend never sends an amount.
 * Returns Paystack authorization_url — redirect user there.
 * On return, show "processing" state and wait for webhook to confirm.
 */
export async function apiInitiateRegistration(
  callbackUrl: string
): Promise<ApiSuccess<PaystackInitResponse>> {
  await delay(800);
  return ok({
    authorization_url: "https://checkout.paystack.com/mock_reg_checkout",
    reference: `REG_MOCK_${Date.now()}`,
  });
}

/**
 * GET /api/payments/verify/:reference
 * Called after payment redirect to check status before webhook arrives.
 * Shows "processing" if still pending — do NOT poll; rely on webhook.
 */
export async function apiVerifyRegistration(
  reference: string
): Promise<ApiSuccess<Payment>> {
  await delay(600);
  return ok({
    id:                  "pay_001",
    member_id:           "mem_001",
    payment_type:        "registration_fee",
    amount:              1000, // confirmed one-time fee ₦1,000
    paystack_reference:  reference,
    status:              "success",
    paid_at:             new Date().toISOString(),
    created_at:          new Date().toISOString(),
  });
}

/** GET /api/payments/history — member's registration payment history */
export async function apiGetPaymentHistory(): Promise<ApiSuccess<Payment[]>> {
  await delay();
  return ok(MOCK_PAYMENTS);
}

// ─── Dues (recurring) ─────────────────────────────────────────────────────────

/** GET /api/dues/cycles — public, includes paid_count */
export async function apiGetDuesCycles(): Promise<ApiSuccess<DuesCycle[]>> {
  await delay();
  return ok(MOCK_DUES_CYCLES);
}

/**
 * POST /api/dues/pay/:cycleId
 * Backend looks up amount from dues_cycles table — frontend never sends amount.
 * Returns Paystack authorization_url.
 */
export async function apiPayDues(
  cycleId: string,
  callbackUrl: string
): Promise<ApiSuccess<PaystackInitResponse>> {
  await delay(800);
  return ok({
    authorization_url: `https://checkout.paystack.com/mock_dues_${cycleId}`,
    reference: `DUES_MOCK_${Date.now()}`,
  });
}

/**
 * GET /api/dues/verify/:reference
 * Same pattern as payment verify — show "processing" if pending, wait for webhook.
 */
export async function apiVerifyDues(
  reference: string
): Promise<ApiSuccess<DuesPayment>> {
  await delay(600);
  return ok(MOCK_DUES_PAYMENTS[0]);
}

/** GET /api/dues/history — member's dues payment history */
export async function apiGetDuesHistory(): Promise<ApiSuccess<DuesPayment[]>> {
  await delay();
  return ok(MOCK_DUES_PAYMENTS);
}

/**
 * Client-side helper: build a DuesSummary by combining cycle list + dues history.
 * In production the backend may provide this as a single endpoint;
 * for now we construct it client-side from two calls.
 */
export async function apiGetDuesSummary(): Promise<ApiSuccess<DuesSummary>> {
  await delay();
  return ok(MOCK_DUES_SUMMARY);
}

// ─── Elections (member) ───────────────────────────────────────────────────────

/** GET /api/elections/positions — public, open positions only */
export async function apiGetElectionPositions(): Promise<ApiSuccess<ElectionPosition[]>> {
  await delay();
  return ok(MOCK_ELECTION_POSITIONS.filter((p) => p.is_open));
}

/** GET /api/elections/my-applications — member's own applications */
export async function apiMyElectionApplications(): Promise<ApiSuccess<ElectionApplication[]>> {
  await delay();
  return ok(MOCK_ELECTION_APPLICATIONS);
}

/** POST /api/elections/apply — member applies to a position */
export async function apiApplyForElection(
  positionId: string,
  manifesto: string,
  callbackUrl: string
): Promise<ApiSuccess<PaystackInitResponse>> {
  await delay(800);
  return ok({
    authorization_url: `https://checkout.paystack.com/mock_election_${positionId}`,
    reference: `ELE_MOCK_${Date.now()}`,
  });
}

/** GET /api/elections/verify/:reference — one-shot check after Paystack redirect */
export async function apiVerifyElectionApplication(
  reference: string
): Promise<ApiSuccess<ElectionApplication>> {
  await delay(600);
  return ok({
    id: `elec_app_${reference}`,
    position_id: "elec_pos_president",
    position: {
      id: "elec_pos_president",
      title: "President",
      fee_amount: 40000,
      election_year: "2026/2027",
    },
    paystack_reference: reference,
    status: "submitted",
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
}

// ─── Announcements ────────────────────────────────────────────────────────────

/** GET /api/announcements — members see global + their set's; admins see all */
export async function apiGetAnnouncements(): Promise<ApiSuccess<Announcement[]>> {
  await delay();
  return ok(MOCK_ANNOUNCEMENTS);
}

/** POST /api/announcements (admin only) */
export async function apiSendAnnouncement(
  payload: BroadcastPayload
): Promise<ApiSuccess<Announcement>> {
  await delay(700);
  const ann: Announcement = {
    id:               `ann_${Date.now()}`,
    created_by:       "usr_admin_01",
    author_name:      "Alumni Association Admin",
    title:            payload.title,
    content:          payload.content,
    target_type:      payload.target_type,
    set_id:           payload.set_id,
    target_member_id: payload.target_member_id,
    scheduled_at:     payload.scheduled_at,
    is_published:     !payload.scheduled_at,
    published_at:     payload.scheduled_at ? undefined : new Date().toISOString(),
    created_at:       new Date().toISOString(),
    read:             false,
  };
  return ok(ann);
}

// ─── Exco ─────────────────────────────────────────────────────────────────────

/** GET /api/exco — public, current officers only */
export async function apiGetExcoOfficers(): Promise<ApiSuccess<ExcoOfficer[]>> {
  await delay();
  return ok(MOCK_EXCO_OFFICERS);
}

// ─── Cloudinary upload ─────────────────────────────────────────────────────────

/** POST /api/upload/cloudinary-signature — signed upload params, no secrets shipped */
export async function apiGetCloudinarySignature(
  folder = "members"
): Promise<ApiSuccess<CloudinarySignature>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    await delay(150);
    return ok({
      signature: `mock_sig_${Date.now()}`,
      timestamp: Math.round(Date.now() / 1000),
      apiKey: "mock_cloudinary_key",
      cloudName: "tssosa",
      folder,
    });
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/upload/cloudinary-signature`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder }),
    });
  } catch {
    throw new ApiRequestError(0, "Unable to reach the server. Please try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiRequestError(res.status, body?.error ?? "Signature request failed");
  }
  const json = (await res.json()) as Partial<CloudinarySignature>;
  if (!json.signature || !json.apiKey || !json.cloudName) {
    throw new ApiRequestError(0, "Invalid signature response");
  }
  return ok({
    signature: json.signature,
    timestamp: json.timestamp ?? Math.round(Date.now() / 1000),
    apiKey: json.apiKey,
    cloudName: json.cloudName,
    folder: json.folder ?? folder,
  });
}

// ─── Admin (elections + exco) ─────────────────────────────────────────────────

/** GET /api/admin/elections/applications */
export async function apiAdminListElectionApplications(
  params?: { positionId?: string; status?: string }
): Promise<ApiSuccess<ElectionApplication[]>> {
  await delay();
  return ok(MOCK_ELECTION_APPLICATIONS);
}

/** PATCH /api/admin/elections/applications/:id */
export async function apiAdminUpdateElectionApplication(
  id: string,
  status: ElectionApplication["status"]
): Promise<ApiSuccess<ElectionApplication>> {
  await delay(400);
  const app = MOCK_ELECTION_APPLICATIONS.find((a) => a.id === id);
  return ok({ ...(app ?? ({} as ElectionApplication)), id, status });
}

/** POST /api/admin/elections/positions */
export async function apiAdminCreateElectionPosition(
  payload: { title: string; feeAmount: number; election_year: string }
): Promise<ApiSuccess<ElectionPosition>> {
  await delay(400);
  return ok({
    id: `elec_pos_${Date.now()}`,
    title: payload.title,
    fee_amount: payload.feeAmount,
    election_year: payload.election_year,
    is_open: true,
    created_at: new Date().toISOString(),
  });
}

/** POST /api/admin/exco */
export async function apiAdminAssignOfficer(
  payload: AssignOfficerPayload
): Promise<ApiSuccess<ExcoOfficer>> {
  await delay(400);
  return ok({
    id: `exco_${Date.now()}`,
    member_id: payload.memberId,
    position_id: payload.positionId,
    position: payload.positionId,
    term_label: payload.termLabel,
    is_current: true,
    started_at: new Date().toISOString(),
    member: { id: payload.memberId, full_name: "Assigned Member" },
  });
}

/** PATCH /api/admin/exco/:id — end a term */
export async function apiAdminEndOfficerTerm(
  id: string
): Promise<ApiSuccess<ExcoOfficer>> {
  await delay(300);
  return ok({
    id,
    member_id: "",
    position_id: "",
    position: "",
    term_label: "",
    is_current: false,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    member: { id: "", full_name: "" },
  });
}

/** GET /api/admin/dashboard — was /api/admin/stats in v1 */
export async function apiGetAdminDashboard(): Promise<ApiSuccess<AdminDashboard>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Admin dashboard requires the backend. Please sign in again.");
  }
  const res = await authedFetch("/api/admin/dashboard");
  const json = (await res.json()) as
    | {
        totalMembers?: number;
        activeMembers?: number;
        totalSets?: number;
        pendingPayments?: number;
        totalDuesCollected?: number;
        totalRegistrationPayments?: number;
      }
    | undefined;
  // Backend returns camelCase — normalise into the shared snake_case shape the
  // admin page renders. Never fall back to mock values here.
  return ok({
    total_members: json?.totalMembers ?? 0,
    active_members: json?.activeMembers ?? 0,
    total_sets: json?.totalSets ?? 0,
    pending_payments: json?.pendingPayments ?? 0,
    total_dues_collected: json?.totalDuesCollected ?? 0,
    total_registration_payments: json?.totalRegistrationPayments ?? 0,
  });
}

// ─── Admin (pending member approvals) ─────────────────────────────────────────

/**
 * GET /api/admin/members/pending — real endpoint, never mock/cached data (Bug 2
 * pattern: authenticated fetch only). Returns unverified registrants awaiting
 * review with name, email, set, registration date, and photo.
 */
export async function apiAdminListPendingMembers(): Promise<ApiSuccess<PendingMember[]>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Pending members require the backend. Please sign in again.");
  }
  const res = await authedFetch("/api/admin/members/pending");
  const json = (await res.json()) as
    | {
        members?: Array<{
          id: string;
          userId: string;
          fullName: string;
          email: string;
          matricNumber?: string | null;
          profileImage?: string | null;
          set?: string | null;
          registeredAt: string;
        }>;
      }
    | undefined;
  // Backend returns camelCase — normalize to the Member-style snake_case shape.
  return ok(
    (json?.members ?? []).map((m) => ({
      id: m.id,
      user_id: m.userId,
      full_name: m.fullName,
      email: m.email,
      matric_number: m.matricNumber ?? undefined,
      profile_image: m.profileImage ?? undefined,
      set: m.set ?? undefined,
      registered_at: m.registeredAt,
    }))
  );
}

/** PATCH /api/admin/members/:id/approve — verify + email the applicant. */
export async function apiAdminApproveMember(
  id: string
): Promise<ApiSuccess<{ message: string }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Requires the backend. Please sign in again.");
  }
  const res = await authedFetch(`/api/admin/members/${id}/approve`, { method: "PATCH" });
  const json = (await res.json()) as { message?: string } | undefined;
  return ok({ message: json?.message ?? "Member approved" });
}

/** PATCH /api/admin/members/:id/reject — email then PERMANENTLY delete the record. */
export async function apiAdminRejectMember(
  id: string
): Promise<ApiSuccess<{ message: string }>> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl || !getAccessToken()) {
    throw new ApiRequestError(0, "Requires the backend. Please sign in again.");
  }
  const res = await authedFetch(`/api/admin/members/${id}/reject`, { method: "PATCH" });
  const json = (await res.json()) as { message?: string } | undefined;
  return ok({ message: json?.message ?? "Registration rejected and removed" });
}

/** GET /api/admin/payments */
export async function apiGetAdminPayments(
  limit = 20,
  offset = 0
): Promise<ApiSuccess<PaginatedResponse<Payment>>> {
  await delay();
  return ok({ data: MOCK_PAYMENTS, total: MOCK_PAYMENTS.length, limit, offset });
}

/** GET /api/admin/dues-payments */
export async function apiGetAdminDuesPayments(
  limit = 20,
  offset = 0
): Promise<ApiSuccess<PaginatedResponse<DuesPayment>>> {
  await delay();
  return ok({ data: MOCK_DUES_PAYMENTS, total: MOCK_DUES_PAYMENTS.length, limit, offset });
}
