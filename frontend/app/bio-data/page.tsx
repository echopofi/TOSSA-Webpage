"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusPill from "@/components/ui/StatusPill";
import {
  User,
  MapPin,
  HeartPulse,
  Briefcase,
  ShieldCheck,
  FileCheck2,
  Save,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiMe, apiGetBioData, apiSubmitBioData } from "@/lib/api";
import {
  loadBioDataDraft,
  saveBioDataDraft,
  clearBioDataDraft,
} from "@/lib/bioDataDraft";
import { EMAIL_REGEX, EMAIL_MAX, NAME_MAX, PHONE_MAX } from "@/lib/validation";
import type {
  BioData,
  BioDataPayload,
  BloodGroup,
  OccupationCategory,
} from "@/lib/types";
import { Reveal, fadeUp } from "@/lib/motion";

interface BioDataForm {
  fullName: string;
  formerNickname: string;
  gender: string;
  setYear: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  bloodGroup: string;
  displayBloodGroupOnId: boolean;
  occupationCategory: string;
  specialization: string;
  membershipDeclaration: boolean;
  dataPrivacyConsent: boolean;
}

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const OCCUPATION_OPTIONS: { value: OccupationCategory; label: string }[] = [
  { value: "employed",              label: "Employed" },
  { value: "self_employed",         label: "Self-employed / Business Owner" },
  { value: "entrepreneur",          label: "Entrepreneur" },
  { value: "student",               label: "Student" },
  { value: "civil_public_servant",  label: "Civil / Public Servant" },
  { value: "clergy_ministry",       label: "Clergy / Ministry" },
  { value: "professional_practice", label: "Professional Practice" },
  { value: "retired",               label: "Retired" },
  { value: "unemployed",            label: "Unemployed" },
  { value: "other",                 label: "Other" },
];

const EMPTY_FORM: BioDataForm = {
  fullName: "",
  formerNickname: "",
  gender: "",
  setYear: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "",
  bloodGroup: "",
  displayBloodGroupOnId: false,
  occupationCategory: "",
  specialization: "",
  membershipDeclaration: false,
  dataPrivacyConsent: false,
};

function toPayload(f: BioDataForm): BioDataPayload {
  return {
    fullName: f.fullName.trim(),
    formerNickname: f.formerNickname.trim() || undefined,
    gender: f.gender,
    setYear: Number(f.setYear),
    phone: f.phone.trim(),
    email: f.email.trim(),
    city: f.city.trim(),
    state: f.state.trim(),
    country: f.country.trim(),
    bloodGroup: f.bloodGroup as BloodGroup,
    displayBloodGroupOnId: f.displayBloodGroupOnId,
    occupationCategory: f.occupationCategory as OccupationCategory,
    specialization: f.specialization.trim(),
    membershipDeclaration: f.membershipDeclaration,
    dataPrivacyConsent: f.dataPrivacyConsent,
  };
}

function fromPayload(b: BioData): BioDataForm {
  return {
    fullName: b.full_name,
    formerNickname: b.former_nickname ?? "",
    gender: b.gender,
    setYear: String(b.set_year),
    phone: b.phone,
    email: b.email,
    city: b.city,
    state: b.state,
    country: b.country,
    bloodGroup: b.blood_group,
    displayBloodGroupOnId: b.display_blood_group_on_id,
    occupationCategory: b.occupation_category,
    specialization: b.specialization,
    membershipDeclaration: b.membership_declaration,
    dataPrivacyConsent: b.data_privacy_consent,
  };
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_SET_YEAR = 1950;

export default function BioDataPage() {
  const [loading, setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt]    = useState<BioData | null>(null);
  const [message, setMessage]    = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const loadedRef = useRef(false);
  const submittingRef = useRef(false);

  const bioForm = useForm<BioDataForm>({
    mode: "onChange",
    defaultValues: EMPTY_FORM,
  });

  const watched = bioForm.watch();
  const consentsTicketed =
    bioForm.watch("membershipDeclaration") === true &&
    bioForm.watch("dataPrivacyConsent") === true;

  const canSubmit =
    bioForm.formState.isValid &&
    consentsTicketed &&
    !submitting;

  // Initial load: prefer a server record, else a saved draft, else member data.
  useEffect(() => {
    (async () => {
      try {
        const [meRes, bioRes] = await Promise.all([
          apiMe(),
          apiGetBioData(),
        ]);
        const me = meRes.data;
        const record = bioRes.data;

        const memberSetYear = Number.parseInt(me?.member?.set_name ?? "", 10);

        if (record) {
          bioForm.reset(fromPayload(record));
          setSavedAt(record);
        } else {
          const draft = loadBioDataDraft();
          if (draft) {
            bioForm.reset({
              ...EMPTY_FORM,
              ...draft,
              setYear: String(draft.setYear),
            });
          } else {
            bioForm.reset({
              ...EMPTY_FORM,
              fullName: me?.user?.full_name ?? "",
              gender: me?.member?.gender
                ? me.member.gender.charAt(0).toUpperCase() + me.member.gender.slice(1)
                : "",
              setYear: Number.isInteger(memberSetYear) ? String(memberSetYear) : "",
              phone: me?.member?.phone ?? "",
              email: me?.member?.email ?? "",
            });
          }
        }
      } catch {
        // Backend unreachable — fall back to a saved draft so progress is kept.
        const draft = loadBioDataDraft();
        if (draft) {
          bioForm.reset({ ...EMPTY_FORM, ...draft, setYear: String(draft.setYear) });
        }
      } finally {
        loadedRef.current = true;
        setLoading(false);
      }
    })();
  }, [bioForm]);

  // Partial progress → localStorage only (never pushed to the DB until the
  // member explicitly submits a fully-validated form).
  const isDirty = bioForm.formState.isDirty;
  useEffect(() => {
    if (!loadedRef.current || submittingRef.current || isDirty === false) return;
    const timer = setTimeout(() => saveBioDataDraft(toPayload(watched)), 400);
    return () => clearTimeout(timer);
  }, [watched, isDirty]);

  async function onSubmit() {
    const payload = toPayload(bioForm.getValues());
    setSubmitting(true);
    submittingRef.current = true;
    setMessage(null);
    try {
      const res = await apiSubmitBioData(payload);
      clearBioDataDraft();
      // The successful server response is authoritative for the form state.
      bioForm.reset(fromPayload(res.data));
      setSavedAt(res.data);
      setMessage({ type: "ok", text: "Your Bio Data has been saved successfully." });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to save Bio Data. Please try again.",
      });
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Reveal variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Bio Data Form
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {savedAt
              ? "Your record is on file — you can update it any time."
              : "Complete your details once to update your membership record."}
          </p>
        </div>
        <div className="shrink-0">
          {savedAt ? (
            <StatusPill status="paid" label="Submitted" />
          ) : (
            <StatusPill status="pending" label="Not submitted" />
          )}
        </div>
      </Reveal>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            message.type === "ok"
              ? "bg-[var(--success-bg)] text-[#166534]"
              : "bg-[var(--danger-bg)] text-[var(--danger)]"
          }`}
        >
          {message.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}

      <form onSubmit={bioForm.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* ── Personal details ─────────────────────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <User size={18} className="text-[var(--primary)]" />
              Personal Details
            </h2>
            <div className="flex flex-col gap-4">
              <Input
                label="Full name"
                placeholder="Your full legal name"
                error={bioForm.formState.errors.fullName?.message}
                {...bioForm.register("fullName", {
                  required: "Full name is required",
                  maxLength: { value: NAME_MAX, message: "Full name is too long" },
                })}
              />
              <Input
                label="Former nickname (optional)"
                placeholder="What were you known as in school? (echos optional)"
                error={bioForm.formState.errors.formerNickname?.message}
                {...bioForm.register("formerNickname")}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Gender"
                  placeholder="Select gender"
                  error={bioForm.formState.errors.gender?.message}
                  options={[
                    { value: "Male", label: "Male" },
                    { value: "Female", label: "Female" },
                  ]}
                  {...bioForm.register("gender", { required: "Gender is required" })}
                />
                <Input
                  label="Set / Admission year"
                  type="number"
                  placeholder="e.g. 2015"
                  error={bioForm.formState.errors.setYear?.message}
                  {...bioForm.register("setYear", {
                    required: "Admission year is required",
                    min: { value: MIN_SET_YEAR, message: "Admission year is too early" },
                    max: { value: CURRENT_YEAR + 1, message: "Admission year is invalid" },
                  })}
                />
              </div>
            </div>
          </Card>
        </Reveal>

        {/* ── Contact & location ───────────────────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <MapPin size={18} className="text-[var(--primary)]" />
              Contact & Location
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone / WhatsApp"
                  type="tel"
                  placeholder="+234 800 000 0000"
                  error={bioForm.formState.errors.phone?.message}
                  {...bioForm.register("phone", {
                    required: "Phone / WhatsApp is required",
                    maxLength: { value: PHONE_MAX, message: "Phone number is too long" },
                  })}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={bioForm.formState.errors.email?.message}
                  {...bioForm.register("email", {
                    required: "Email is required",
                    maxLength: { value: EMAIL_MAX, message: "Email is too long" },
                    pattern: { value: EMAIL_REGEX, message: "Enter a valid email address" },
                  })}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="City / Town"
                  placeholder="Jos"
                  error={bioForm.formState.errors.city?.message}
                  {...bioForm.register("city", { required: "City / Town is required" })}
                />
                <Input
                  label="State / Province"
                  placeholder="Plateau"
                  error={bioForm.formState.errors.state?.message}
                  {...bioForm.register("state", { required: "State / Province is required" })}
                />
                <Input
                  label="Country"
                  placeholder="Nigeria"
                  error={bioForm.formState.errors.country?.message}
                  {...bioForm.register("country", { required: "Country is required" })}
                />
              </div>
            </div>
          </Card>
        </Reveal>

        {/* ── Medical ──────────────────────────────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <HeartPulse size={18} className="text-[var(--primary)]" />
              Medical Information
            </h2>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <Select
                  label="Blood Group"
                  placeholder="Select blood group"
                  error={bioForm.formState.errors.bloodGroup?.message}
                  options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))}
                  {...bioForm.register("bloodGroup", { required: "Blood group is required" })}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                    Display on ID card?
                  </span>
                  <div className="flex gap-2 mt-1">
                    {[
                      { value: true, label: "Yes" },
                      { value: false, label: "No" },
                    ].map((opt) => {
                      const active = bioForm.watch("displayBloodGroupOnId") === opt.value;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => bioForm.setValue("displayBloodGroupOnId", opt.value)}
                          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                            active
                              ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]"
                              : "border-[var(--border-subtle)] bg-transparent text-[var(--text-body)] hover:bg-[var(--bg-base)]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Only shown on your ID card if you choose Yes.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* ── Professional info ────────────────────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <Briefcase size={18} className="text-[var(--primary)]" />
              Professional Info
            </h2>
            <div className="flex flex-col gap-4">
              <Select
                label="Occupation Category"
                placeholder="Select occupation category"
                error={bioForm.formState.errors.occupationCategory?.message}
                options={OCCUPATION_OPTIONS}
                {...bioForm.register("occupationCategory", {
                  required: "Occupation category is required",
                })}
              />
              <Input
                label="Profession / Area of Specialization"
                placeholder="e.g. Software Engineer, Surgeon, Teacher…"
                error={bioForm.formState.errors.specialization?.message}
                {...bioForm.register("specialization", {
                  required: "Profession is required",
                  maxLength: { value: 255, message: "Profession is too long" },
                })}
              />
            </div>
          </Card>
        </Reveal>

        {/* ── Section I — declaration & consent ────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card>
            <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
              <ShieldCheck size={18} className="text-[var(--primary)]" />
              Section I — Declaration & Consent
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Both boxes must be ticked before you can submit your Bio Data.
            </p>
            <div className="flex flex-col gap-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4"
                  {...bioForm.register("membershipDeclaration")}
                />
                <span className="text-sm text-[var(--text-body)]">
                  <strong className="text-[var(--text-heading)]">Membership Declaration.</strong> I
                  declare that I am a member of the Taraba State Special Science School Old
                  Students&apos; Association, and that the information I provide here is true, complete,
                  and accurate to the best of my knowledge. I understand that providing false
                  information may affect my membership and ID card.
                </span>
              </label>
              <div className="border-t border-[var(--border-subtle)]" />
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 w-4 h-4"
                  {...bioForm.register("dataPrivacyConsent")}
                />
                <span className="text-sm text-[var(--text-body)]">
                  <strong className="text-[var(--text-heading)]">Data &amp; Privacy Consent.</strong>{" "}
                  I consent to the Association collecting, storing, and processing my personal data
                  (including my blood group) for membership administration, ID card issuance, and
                  official alumni communications. I understand my data will be handled confidentially
                  and will not be shared with third parties for marketing.
                </span>
              </label>
            </div>
          </Card>
        </Reveal>

        {/* ── Submit bar ───────────────────────────────────────────────────── */}
        <Reveal variants={fadeUp}>
          <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-2 text-xs text-[var(--text-muted)] max-w-md">
              <FileCheck2 size={15} className="shrink-0 mt-0.5" />
              <span>
                {savedAt
                  ? "Your Bio Data is saved. Updating it writes a fresh, fully-validated record."
                  : "Submit once all required fields are filled and both Section I boxes are ticked."}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!canSubmit && !savedAt && (
                <span className="hidden sm:inline text-xs text-[var(--warning)] font-medium">
                  Complete all fields to submit
                </span>
              )}
              <Button
                type="submit"
                loading={submitting}
                disabled={!canSubmit}
                className="min-w-[10rem]"
              >
                {!submitting && <Save size={16} />}
                {savedAt ? "Save Changes" : "Submit Bio Data"}
              </Button>
            </div>
          </Card>
        </Reveal>
      </form>
    </div>
  );
}