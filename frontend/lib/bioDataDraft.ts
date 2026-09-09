/**
 * lib/bioDataDraft.ts
 * Partial Bio Data form progress, persisted to localStorage ONLY — never to the
 * DB. getBioData on the server is the source of truth for submitted records; a
 * draft file existing here merely means the member started but hasn't submitted.
 */

import type { BioDataPayload } from "@/lib/types";

const KEY = "tssosa_bio_data_draft";

function readJSON(): BioDataPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BioDataPayload) : null;
  } catch {
    return null;
  }
}

export function saveBioDataDraft(draft: BioDataPayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage full / unavailable — drafts are best-effort only */
  }
}

export function loadBioDataDraft(): BioDataPayload | null {
  return readJSON();
}

export function hasBioDataDraft(): boolean {
  return loadBioDataDraft() !== null;
}

export function clearBioDataDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}