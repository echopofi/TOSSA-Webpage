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
} from "@/lib/types";

import {
  MOCK_AUTH_USER,
  MOCK_AUTH_ME_RESPONSE,
  MOCK_MEMBERS,
  MOCK_SETS,
  MOCK_PAYMENTS,
  MOCK_DUES_CYCLES,
  MOCK_DUES_PAYMENTS,
  MOCK_DUES_SUMMARY,
  MOCK_ANNOUNCEMENTS,
  MOCK_ADMIN_DASHBOARD,
  MOCK_MILESTONES,
} from "@/lib/mockData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const delay = (ms = 400) => new Promise<void>((res) => setTimeout(res, ms));

function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** POST /api/auth/login */
export async function apiLogin(
  email: string,
  _password: string
): Promise<ApiSuccess<{ user: AuthUser; access_token: string }>> {
  await delay();
  return ok({ user: MOCK_AUTH_USER, access_token: "mock_access_token" });
}

/** POST /api/auth/register */
export async function apiRegister(
  payload: RegisterPayload
): Promise<ApiSuccess<{ user: AuthUser; access_token: string }>> {
  await delay(600);
  return ok({ user: MOCK_AUTH_USER, access_token: "mock_access_token" });
}

/** GET /api/auth/me — returns user + member + set */
export async function apiMe(): Promise<ApiSuccess<AuthMeResponse>> {
  await delay(200);
  return ok(MOCK_AUTH_ME_RESPONSE);
}

/** POST /api/auth/refresh */
export async function apiRefresh(): Promise<ApiSuccess<{ access_token: string }>> {
  await delay(200);
  return ok({ access_token: "mock_access_token_refreshed" });
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

/** GET /api/members/:id */
export async function apiGetMember(id: string): Promise<ApiSuccess<Member>> {
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
  const json = await res.json();
  // Backend returns { sets: [...] } — normalise to { success, data }
  const sets: GraduationSet[] = (json.sets ?? []).map((s: any) => ({
    id:               s.id,
    set_name:         s.setName,
    start_year:       s.startYear,
    end_year:         s.endYear,
    description:      s.description,
    group_invite_link: s.groupInviteLink,
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
    amount:              10000, // placeholder
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

// ─── Admin ────────────────────────────────────────────────────────────────────

/** GET /api/admin/dashboard — was /api/admin/stats in v1 */
export async function apiGetAdminDashboard(): Promise<ApiSuccess<AdminDashboard>> {
  await delay();
  return ok(MOCK_ADMIN_DASHBOARD);
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
