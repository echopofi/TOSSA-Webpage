/**
 * lib/mockData.ts
 * Reconciled against alumni-website-shared-spec.md v2.
 * Field names match the DB schema in Section 3.
 */

import type {
  AuthUser,
  AuthMeResponse,
  Member,
  GraduationSet,
  Payment,
  DuesCycle,
  DuesPayment,
  DuesSummary,
  DuesCycleStatus,
  Announcement,
  AdminDashboard,
  MemberMilestone,
} from "@/lib/types";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const MOCK_AUTH_USER: AuthUser = {
  id: "usr_001",
  full_name: "Ada Okonkwo",
  email: "ada.okonkwo@email.com",
  role: "member",
  is_verified: true,
};

export const MOCK_ADMIN_USER: AuthUser = {
  id: "usr_admin_01",
  full_name: "Association Admin",
  email: "admin@alumni.ng",
  role: "admin",
  is_verified: true,
};

// ─── Graduation Sets ──────────────────────────────────────────────────────────

export const MOCK_SETS: GraduationSet[] = [
  {
    id: "set_2005",
    set_name: "2005",
    start_year: 2000,
    end_year: 2005,
    description:
      "The Class of 2005 — affectionately known as 'The Vanguards' — graduated after one of the most memorable years in school history. We have grown into professionals across every sector, but the bonds forged within those classrooms and hostels remain unbroken.",
    group_invite_link: "https://chat.whatsapp.com/mock_set_2005",
    is_active: true,
    member_count: 142,
    created_at: "2023-01-15T08:00:00Z",
    updated_at: "2025-01-10T08:00:00Z",
  },
  {
    id: "set_2008",
    set_name: "2008",
    start_year: 2003,
    end_year: 2008,
    description:
      "Class of 2008 — 'The Torchbearers.' A decade and a half later, we still carry the torch. Finance, tech, medicine, law — our set has done it all.",
    group_invite_link: "https://chat.whatsapp.com/mock_set_2008",
    is_active: true,
    member_count: 118,
    created_at: "2023-01-15T08:00:00Z",
    updated_at: "2025-01-10T08:00:00Z",
  },
  {
    id: "set_2012",
    set_name: "2012",
    start_year: 2007,
    end_year: 2012,
    description:
      "Class of 2012 — the digital natives. We grew up with the internet and are now shaping it. Stay connected, pay dues, and keep the conversation going.",
    group_invite_link: "https://chat.whatsapp.com/mock_set_2012",
    is_active: true,
    member_count: 203,
    created_at: "2023-01-15T08:00:00Z",
    updated_at: "2025-01-10T08:00:00Z",
  },
  {
    id: "set_2015",
    set_name: "2015",
    start_year: 2010,
    end_year: 2015,
    description:
      "Class of 2015 — young, driven, making noise. Our WhatsApp group has never gone quiet and neither have our ambitions.",
    group_invite_link: "https://chat.whatsapp.com/mock_set_2015",
    is_active: true,
    member_count: 87,
    created_at: "2023-06-01T08:00:00Z",
    updated_at: "2025-01-10T08:00:00Z",
  },
];

// ─── Members ──────────────────────────────────────────────────────────────────

export const MOCK_MEMBERS: Member[] = [
  {
    id: "mem_001",
    user_id: "usr_001",
    full_name: "Ada Okonkwo",
    email: "ada.okonkwo@email.com",    // returned on authenticated detail
    phone: "+2348012345678",           // returned on authenticated detail
    gender: "Female",
    address: "Victoria Island, Lagos",
    matric_number: "2001/001",
    bio: "Software engineer and open-source enthusiast. I love building products that matter. Class of 2005 proud!",
    profile_image: "https://i.pravatar.cc/150?img=47",
    is_active: true,
    joined_at: "2024-01-10T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "member",
    payment_status: "paid",
  },
  {
    id: "mem_002",
    user_id: "usr_002",
    full_name: "Emeka Nwosu",
    email: "emeka.nwosu@email.com",
    gender: "Male",
    matric_number: "2001/002",
    bio: "Physician, public health advocate, and proud alumnus.",
    profile_image: "https://i.pravatar.cc/150?img=12",
    is_active: true,
    joined_at: "2024-01-12T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "member",
    payment_status: "pending",
  },
  {
    id: "mem_003",
    user_id: "usr_003",
    full_name: "Ngozi Adesanya",
    email: "ngozi.adesanya@email.com",
    gender: "Female",
    matric_number: "2001/003",
    bio: "Chartered accountant by day, bookworm by night.",
    profile_image: "https://i.pravatar.cc/150?img=32",
    is_active: true,
    joined_at: "2024-02-01T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "member",
    payment_status: "paid",
  },
  {
    id: "mem_004",
    user_id: "usr_004",
    full_name: "Biodun Fashola",
    gender: "Male",
    matric_number: "2001/004",
    profile_image: "https://i.pravatar.cc/150?img=18",
    is_active: true,
    joined_at: "2024-03-05T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "member",
    payment_status: "overdue",
  },
  {
    id: "mem_005",
    user_id: "usr_005",
    full_name: "Chiamaka Eze",
    email: "chiamaka.eze@email.com",
    gender: "Female",
    matric_number: "2001/005",
    bio: "Journalist, storyteller, and advocate for African narratives.",
    profile_image: "https://i.pravatar.cc/150?img=45",
    is_active: true,
    joined_at: "2024-02-20T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "member",
    payment_status: "paid",
  },
  {
    id: "mem_006",
    user_id: "usr_006",
    full_name: "Tunde Adeyemi",
    gender: "Male",
    matric_number: "2001/006",
    profile_image: "https://i.pravatar.cc/150?img=6",
    is_active: true,
    joined_at: "2024-04-01T09:00:00Z",
    set_id: "set_2005",
    set_name: "2005",
    role_in_set: "set_president",
    payment_status: "paid",
  },
];

export const MOCK_AUTH_ME_RESPONSE: AuthMeResponse = {
  user: MOCK_AUTH_USER,
  member: MOCK_MEMBERS[0],
  set: MOCK_SETS[0],
};

// ─── Milestones ───────────────────────────────────────────────────────────────

export const MOCK_MILESTONES: MemberMilestone[] = [
  {
    id: "ms_001",
    member_id: "mem_001",
    title: "Graduated — Class of 2005",
    description: "Completed secondary school education and became part of the alumni community.",
    milestone_date: "2005-07-15",
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2024-01-10T09:00:00Z",
  },
  {
    id: "ms_002",
    member_id: "mem_001",
    title: "B.Sc. Computer Science — University of Lagos",
    description: "Graduated with second class upper honours.",
    milestone_date: "2010-06-30",
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2024-01-10T09:00:00Z",
  },
  {
    id: "ms_003",
    member_id: "mem_001",
    title: "Software Engineer at Andela",
    description: "Joined Andela's remote engineering network, working with global clients.",
    milestone_date: "2012-03-01",
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2024-01-10T09:00:00Z",
  },
  {
    id: "ms_004",
    member_id: "mem_001",
    title: "Joined Alumni Network",
    description: "Registered on AlumniConnect and reconnected with Class of 2005.",
    milestone_date: "2024-01-10",
    created_at: "2024-01-10T09:00:00Z",
    updated_at: "2024-01-10T09:00:00Z",
  },
];

// ─── Dues Cycles ──────────────────────────────────────────────────────────────

export const MOCK_DUES_CYCLES: DuesCycle[] = [
  {
    id: "cycle_2023",
    title: "2023/2024 Annual Dues",
    cycle_type: "year",
    start_date: "2023-01-01T00:00:00Z",
    end_date:   "2024-12-31T23:59:59Z",
    amount: 25000,
    due_date: "2024-03-31T00:00:00Z",
    is_active: false,
    paid_count: 380,
    created_at: "2023-01-01T08:00:00Z",
  },
  {
    id: "cycle_2025",
    title: "2025/2026 Annual Dues",
    cycle_type: "year",
    start_date: "2025-01-01T00:00:00Z",
    end_date:   "2026-12-31T23:59:59Z",
    amount: 30000,
    due_date: "2025-12-31T00:00:00Z",
    is_active: true,
    paid_count: 203,
    created_at: "2025-01-01T08:00:00Z",
  },
];

// ─── Dues Payments ────────────────────────────────────────────────────────────

// A newly registered member has no dues payment records yet.
export const MOCK_DUES_PAYMENTS: DuesPayment[] = [];

export const MOCK_DUES_SUMMARY: DuesSummary = {
  total_owed: 55000,
  total_paid: 0,
  outstanding: 55000,
  cycles: [
    {
      cycle: MOCK_DUES_CYCLES[0],
      status: "unpaid",
    },
    {
      cycle: MOCK_DUES_CYCLES[1],
      status: "unpaid",
    },
  ] satisfies DuesCycleStatus[],
};

// ─── Registration Payment ─────────────────────────────────────────────────────

// No registration fee has been paid yet for a newly registered member.
export const MOCK_PAYMENTS: Payment[] = [];

// ─── Announcements ────────────────────────────────────────────────────────────

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann_001",
    created_by: "usr_admin_01",
    author_name: "Alumni Association Admin",
    title: "Annual General Meeting — Save the Date",
    content:
      "Dear alumni, our Annual General Meeting is scheduled for Saturday, 15 November 2025, at 10am. Venue: School Assembly Hall, Lagos. Attendance is free for dues-paying members. Register your interest via the dashboard.",
    target_type: "all_members",
    is_published: true,
    published_at: "2025-08-20T09:00:00Z",
    created_at: "2025-08-20T09:00:00Z",
    read: false,
  },
  {
    id: "ann_002",
    created_by: "usr_admin_01",
    author_name: "Alumni Association Admin",
    title: "Class of 2005 — WhatsApp Group Link Renewal",
    content:
      "Our WhatsApp group link has been refreshed. Please use the updated link on your set page to rejoin. The old link has been deactivated.",
    target_type: "set",
    set_id: "set_2005",
    set_name: "2005",
    is_published: true,
    published_at: "2025-08-10T14:30:00Z",
    created_at: "2025-08-10T14:30:00Z",
    read: true,
  },
  {
    id: "ann_003",
    created_by: "usr_admin_01",
    author_name: "Alumni Association Admin",
    title: "2025 Dues Reminder",
    content:
      "This is a friendly reminder that the 2025/2026 annual dues are due by 31 December 2025. Members with outstanding dues are encouraged to pay promptly to retain full membership benefits.",
    target_type: "all_members",
    is_published: true,
    published_at: "2025-07-01T08:00:00Z",
    created_at: "2025-07-01T08:00:00Z",
    read: true,
  },
  {
    id: "ann_004",
    created_by: "usr_admin_01",
    author_name: "Alumni Association Admin",
    title: "End-of-Year Gala — Tickets Now Available",
    content:
      "Tickets for the 2025 Alumni Gala Night are now available. Early-bird pricing applies until 30 September. Visit the dashboard to reserve your spot.",
    target_type: "all_members",
    is_published: false,
    scheduled_at: "2025-09-01T08:00:00Z",
    created_at: "2025-08-26T10:00:00Z",
    read: false,
  },
];

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export const MOCK_ADMIN_DASHBOARD: AdminDashboard = {
  total_members: 550,
  active_members: 423,
  total_sets: 20,
  total_dues_collected: 18850000,
  pending_payments: 127,
  total_registration_payments: 5500000,
};
