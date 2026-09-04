/**
 * lib/types.ts
 * Reconciled against alumni-website-shared-spec.md v2.
 * Field names, entity shapes, and status enums all match the DB schema in Section 3.
 */

// ─── API envelope ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;             // users.id
  full_name: string;      // users.full_name (not split first/last)
  email: string;
  role: "member" | "admin";
  is_verified: boolean;
}

/** Shape returned by GET /api/auth/me — includes nested member + set */
export interface AuthMeResponse {
  user: AuthUser;
  member: Member;
  set: GraduationSet | null;
}

/** POST /api/auth/register payload */
export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
  setId: string;          // camelCase as spec says "requires setId at signup"
  gender?: string;
  phone?: string;
  address?: string;
  birth_day?: string;
  birth_month?: string;
  bio?: string;
  profile_image?: string; // Cloudinary URL — uploaded at signup (ID card)
}

// ─── Member ───────────────────────────────────────────────────────────────────

/**
 * Mirrors the `members` table in spec v2.
 * Note: email is on `users` but returned on authenticated detail responses.
 * profile_image replaces avatar_url from v1.
 */
export interface Member {
  id: string;
  user_id: string;
  full_name: string;          // from joined users.full_name
  email?: string;             // only on authenticated responses (PII rule)
  phone?: string;             // only on authenticated responses (PII rule)
  gender?: string;
  address?: string;
  matric_number?: string;
  occupation?: string; // student | unemployed | employed | prefer_not_to_say
  bio?: string;
  profile_image?: string;     // Cloudinary URL — was avatar_url in v1
  is_active: boolean;
  joined_at: string;
  // Set info from set_members join
  set_id?: string;
  set_name?: string;          // graduation_sets.set_name
  role_in_set?: string;
  // Derived / aggregated fields on list responses
  payment_status?: "paid" | "pending" | "overdue";
}

// ─── Milestones ───────────────────────────────────────────────────────────────

/** Mirrors member_milestones table */
export interface MemberMilestone {
  id: string;
  member_id: string;
  title: string;              // e.g. "Started at Google"
  description?: string;
  milestone_date: string;     // ISO date
  created_at: string;
  updated_at: string;
}

/** The frontend falls back to this shape when no DB milestones exist */
export interface AutoMilestone {
  id: string;                 // synthetic id, e.g. "auto_graduation"
  title: string;
  description?: string;
  milestone_date: string;
  isAuto: true;               // signals this is client-generated, not from DB
}

export type AnyMilestone = MemberMilestone | AutoMilestone;

// ─── Graduation Sets ──────────────────────────────────────────────────────────

/** Mirrors graduation_sets table */
export interface GraduationSet {
  id: string;
  set_name: string;           // e.g. "2015" — the year string
  start_year: number;
  end_year: number;
  description?: string;
  group_invite_link?: string; // WhatsApp link
  is_active: boolean;
  member_count?: number;      // aggregated on list response
  created_at: string;
  updated_at: string;
}

// ─── Payments (one-time registration fee) ────────────────────────────────────

/** Mirrors the `payments` table */
export interface Payment {
  id: string;
  member_id: string;
  payment_type: "registration_fee" | "other";
  amount: number;
  paystack_reference: string;
  status: "success" | "failed" | "pending";
  paid_at?: string;
  created_at: string;
}

/** POST /api/payments/initiate-registration response */
export interface PaystackInitResponse {
  authorization_url: string;
  reference: string;
}

// ─── Dues (recurring) ─────────────────────────────────────────────────────────

/** Mirrors dues_cycles table */
export interface DuesCycle {
  id: string;
  title: string;              // e.g. "2024/2025 Term 1"
  cycle_type: "term" | "year";
  fee_type: "dues" | "web";   // annual dues vs web-fee
  start_date: string;
  end_date: string;
  amount: number;
  due_date: string;
  is_active: boolean;
  paid_count?: number;        // aggregated on list response
  created_at: string;
}

/** Mirrors dues_payments table */
export interface DuesPayment {
  id: string;
  member_id: string;
  dues_cycle_id: string;
  cycle_title?: string;       // joined from dues_cycles
  amount: number;
  amount_paid: number;
  paystack_reference: string;
  status: "paid" | "partial" | "arrears"; // spec v2 — not success/failed/pending
  paid_at?: string;
  created_at: string;
}

/** Aggregated view for the member's dues screen */
export interface DuesSummary {
  total_owed: number;
  total_paid: number;
  outstanding: number;
  cycles: DuesCycleStatus[];
}

export interface DuesCycleStatus {
  cycle: DuesCycle;
  dues_payment?: DuesPayment; // undefined if never initiated
  status: "paid" | "partial" | "arrears" | "unpaid"; // unpaid = no record yet
}

// ─── Elections ─────────────────────────────────────────────────────────────────

export type ElectionApplicationStatus =
  | "pending_payment"
  | "submitted"
  | "approved"
  | "rejected";

/** Mirrors election_positions table */
export interface ElectionPosition {
  id: string;
  title: string;                  // e.g. "President"
  fee_amount: number;             // set by admin; always served from DB
  election_year: string;          // e.g. "2026/2027"
  is_open: boolean;
  created_at: string;
}

/** Mirrors election_applications table */
export interface ElectionApplication {
  id: string;
  position_id: string;
  position: Pick<ElectionPosition, "id" | "title" | "fee_amount" | "election_year">;
  paystack_reference: string;
  status: ElectionApplicationStatus;
  manifesto?: string;
  applied_at: string;
  created_at: string;
  // Admin review responses also nest the applicant:
  member?: {
    id: string;
    full_name: string;
    email?: string;
    profile_image?: string;
    set_name?: string;
  };
}

// ─── Exco ─────────────────────────────────────────────────────────────────────

/** Mirrors exco_officers table (joined with member + position) */
export interface ExcoOfficer {
  id: string;
  member_id: string;
  position_id: string;
  position: string;               // position title, e.g. "President"
  term_label: string;             // e.g. "2026/2027"
  is_current: boolean;
  started_at: string;
  ended_at?: string;
  member: {
    id: string;
    full_name: string;
    profile_image?: string;
    set_name?: string;
  };
}

/** POST /api/admin/exco payload */
export interface AssignOfficerPayload {
  positionId: string;
  memberId: string;
  termLabel: string;
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────

/** POST /api/upload/cloudinary-signature response */
export interface CloudinarySignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export type TargetType = "all_members" | "set" | "member";

/** Mirrors announcements table */
export interface Announcement {
  id: string;
  created_by: string;         // FK to users.id
  author_name?: string;       // joined display field
  title: string;
  content: string;            // was "body" in v1 — now "content" per DB schema
  target_type: TargetType;    // was "target" in v1
  set_id?: string;            // was "target_set_id" in v1
  set_name?: string;          // joined display field
  target_member_id?: string;  // new in v2
  is_published: boolean;
  scheduled_at?: string;      // nullable — future delivery
  published_at?: string;
  created_at: string;
  read?: boolean;             // client-side tracking / returned per-member
}

/** POST /api/announcements payload */
export interface BroadcastPayload {
  title: string;
  content: string;            // was "body" in v1
  target_type: TargetType;    // was "target" in v1
  set_id?: string;            // was "target_set_id" in v1
  target_member_id?: string;  // new in v2
  scheduled_at?: string;      // ISO datetime, optional
}

// ─── Admin ────────────────────────────────────────────────────────────────────

/** GET /api/admin/dashboard response — was /api/admin/stats in v1 */
export interface AdminDashboard {
  total_members: number;
  active_members: number;
  total_sets: number;
  total_dues_collected: number;
  pending_payments: number;
  total_registration_payments: number;
}

/** GET /api/admin/members/pending — one applicant awaiting review */
export interface PendingMember {
  id: string;             // member id (used by approve/reject)
  user_id: string;
  full_name: string;
  email: string;
  matric_number?: string;
  profile_image?: string;
  set?: string;           // e.g. "2021" or "2020, 2021"
  registered_at: string;  // users.created_at
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
