/**
 * lib/validation.ts
 * Shared client-side validation rules. Mirrors the backend checks in
 * backend/src/controllers/authController.js (EMAIL_REGEX + length caps).
 * Client validation only catches typos — the server re-validates everything.
 */

/** Basic "local@domain.tld" shape used by login + registration. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_MAX = 254;
export const NAME_MAX = 255;
export const PHONE_MAX = 30;
export const PASSWORD_MAX = 128;