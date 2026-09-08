/**
 * exco-data.ts
 * Static data for the public "National Exco" page.
 *
 * NOTE: this page is intentionally NOT wired to the backend/DB. Edit the
 * EXCO_MEMBERS array below directly to change the committee. The interface is
 * open-ended (index signature) so extra fields (bio, quote, term, set, ...)
 * can be added later without a rebuild — just extend an entry.
 *
 * IMAGE CONVENTION
 *  - Folder:  public/assets/exco/
 *  - Naming:  <position-slug>.jpg  (lowercase, hyphens), e.g. president.jpg
 *  - Path in data: /assets/exco/<position-slug>.jpg
 *  - Until a real photo exists for an entry, the page renders an initials
 *    monogram in its place (no broken image). Drop the file in with the exact
 *    name below and it appears automatically — no code change required.
 */

export interface ExcoMember {
  /** Stable slug/id, e.g. "president" */
  id: string;
  name: string;
  position: string;
  /** Path under /assets/exco/ — see image convention above */
  image: string;
  /** Optional: current term label, e.g. "2026/2027" */
  term?: string;
  /** Optional: graduating set, e.g. "Class of 2005" */
  set?: string;
  /** Open for future fields (bio, quote, email, ...) — add freely here. */
  [key: string]: unknown;
}

export const EXCO_MEMBERS: ExcoMember[] = [
  {
    id: "president",
    name: "BENEDICT O. SOLOMON",
    position: "President",
    image: "/assets/exco/boss.jpeg",
    term: "2026/2027",
    set: "Class of 2001",
  },
  {
    id: "vice-president",
    name: "GOPUK ROTDUNG DOUGLAS",
    position: "Vice President",
    image: "/assets/exco/square.jpeg",
    term: "2026/2027",
    set: "Class of 2005",
  },
  {
    id: "assistant general-secretary",
    name: "DALOK PANAN DAVID",
    position: "Assistant General Secretary",
    image: "/assets/exco/dalokpanan.jpeg",
    term: "2026/2027",
    set: "Class of 2007",
  },
  {
    id: "treasurer",
    name: "YUSUF JANG DAVOU",
    position: "Treasurer",
    image: "/assets/exco/yusufjang.jpeg",
    term: "2026/2027",
    set: "Class of 2009",
  },
  {
    id: "financial-secretary",
    name: "LONGMAIAP FAITH NANDAK",
    position: "Financial Secretary",
    image: "/assets/exco/longmaiap.jpeg",
    term: "2026/2027",
    set: "Class of 2012",
  },
  {
    id: "pro",
    name: "MAFENG BULUS DANKE",
    position: "Public Relations Officer",
    image: "/assets/exco/mafeng-bulus.jpeg",
    term: "2026/2027",
    set: "Class of 2014",
  },
  {
    id: "assistant pro",
    name: "JOTHAM NZEE YAKUBU",
    position: "Assistant PRO",
    image: "/assets/exco/jothe.jpeg",
    term: "2026/2027",
    set: "Class of 2014",
  },
];

/** Small helper so the page can display a monogram fallback for missing photos. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}