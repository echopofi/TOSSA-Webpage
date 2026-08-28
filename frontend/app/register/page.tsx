"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { GraduationCap, ArrowLeft, ArrowRight, Check, Camera, Loader2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { MOCK_SETS } from "@/lib/mockData";
import { apiRegister } from "@/lib/api";
import { saveCurrentUser } from "@/lib/session";
import { uploadMemberPhoto } from "@/lib/upload";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Account
  email: string;
  password: string;
  confirmPassword: string;
  // Step 2 — Bio-data (matches spec v2 members table fields)
  full_name: string;        // spec: users.full_name — single field, not split
  gender: string;
  phone: string;
  address: string;
  birth_day: string;
  birth_month: string;
  bio: string;
  profile_image: string;    // Cloudinary URL, uploaded at signup for the ID card
  // Step 3 — Set info
  setId: string;            // spec: "requires setId at signup" — camelCase
}

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Account"  },
  { id: 2, label: "Bio-data" },
  { id: 3, label: "Set Info" },
  { id: 4, label: "Review"   },
];

// graduation_sets.set_name is the year string e.g. "2005"
const setOptions = MOCK_SETS.map((s) => ({
  value: s.id,
  label: `Class of ${s.set_name}`,
}));

const genderOptions = [
  { value: "Male",   label: "Male"   },
  { value: "Female", label: "Female" },
];

const dayOptions = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1).padStart(2, "0"),
}));

const monthOptions = [
  { value: "January",   label: "January"   },
  { value: "February",  label: "February"  },
  { value: "March",     label: "March"     },
  { value: "April",     label: "April"     },
  { value: "May",       label: "May"       },
  { value: "June",      label: "June"      },
  { value: "July",      label: "July"      },
  { value: "August",    label: "August"    },
  { value: "September", label: "September" },
  { value: "October",   label: "October"   },
  { value: "November",  label: "November"  },
  { value: "December",  label: "December"  },
];

// ─── Photo upload ─────────────────────────────────────────────────────────────

function PhotoUploadField({
  onPhoto,
  photoUrl,
  error,
}: {
  onPhoto: (dataUrl: string) => void;
  photoUrl: string;
  error?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadMemberPhoto(file);
      onPhoto(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
        Profile photo{" "}
        <span className="text-[var(--text-muted)] font-normal">(required — used on your member ID card)</span>
      </label>

      <label
        className={`flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
          photoUrl
            ? "border-[var(--success)] bg-[var(--success-bg)]"
            : "border-[var(--border-subtle)] hover:border-[var(--primary)]"
        }`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Profile preview"
            className="w-16 h-16 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center shrink-0">
            <Camera size={24} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-heading)]">
            {photoUrl ? "Photo selected — click to change" : "Click to upload"}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {uploading ? "Uploading…" : "JPG or PNG. We use Cloudinary for secure hosting."}
          </p>
          {uploadError && <p className="text-xs text-[var(--danger)] mt-1">{uploadError}</p>}
          {!uploadError && error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
        </div>
        {uploading && (
          <Loader2 size={18} className="text-[var(--primary)] animate-spin shrink-0" />
        )}
        <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleFile} />
      </label>
    </div>
  );
}

// ─── Step 1 — Account ─────────────────────────────────────────────────────────

function Step1({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Create your account
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          You'll use this email and password to sign in.
        </p>
      </div>
      <Input
        label="Email address"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email", {
          required: "Email is required",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "Enter a valid email address",
          },
        })}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Min. 8 characters"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password", {
          required: "Password is required",
          minLength: { value: 8, message: "Password must be at least 8 characters" },
        })}
      />
      <Input
        label="Confirm password"
        type="password"
        placeholder="Re-enter your password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword", { required: "Please confirm your password" })}
      />
    </div>
  );
}

// ─── Step 2 — Bio-data ────────────────────────────────────────────────────────

function Step2({
  register,
  errors,
  onPhoto,
  photoUrl,
  photoError,
}: {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
  onPhoto: (dataUrl: string) => void;
  photoUrl: string;
  photoError?: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Tell us about yourself
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          This information builds your alumni profile and member ID card.
        </p>
      </div>

      <PhotoUploadField onPhoto={onPhoto} photoUrl={photoUrl} error={photoError} />

      {/* Spec v2: users.full_name — single combined field */}
      <Input
        label="Full name"
        placeholder="Ada Okonkwo"
        error={errors.full_name?.message}
        {...register("full_name", { required: "Full name is required" })}
      />

      <Select
        label="Gender"
        placeholder="Select…"
        options={genderOptions}
        {...register("gender")}
      />

      <Input
        label="Phone number"
        type="tel"
        placeholder="+234 800 000 0000"
        {...register("phone")}
      />

      <Input
        label="Current address"
        placeholder="e.g. Victoria Island, Lagos"
        {...register("address")}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Birth day"
          placeholder="Day"
          options={dayOptions}
          {...register("birth_day")}
        />
        <Select
          label="Birth month"
          placeholder="Month"
          options={monthOptions}
          {...register("birth_month")}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
          Short bio <span className="text-[var(--text-muted)] font-normal">(optional)</span>
        </label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="A sentence or two about what you do and your connection to the school…"
          {...register("bio")}
        />
      </div>
    </div>
  );
}

// ─── Step 3 — Set info ────────────────────────────────────────────────────────

function Step3({
  register,
  errors,
}: {
  register: ReturnType<typeof useForm<FormData>>["register"];
  errors: ReturnType<typeof useForm<FormData>>["formState"]["errors"];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Your graduating set
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Select your graduating set. This links you to your set's community page, WhatsApp group, and dues cycle.
        </p>
      </div>

      {/* spec: "requires setId at signup" */}
      <Select
        label="Graduating set"
        placeholder="Select your set…"
        options={setOptions}
        error={errors.setId?.message}
        {...register("setId", { required: "Please select your graduating set" })}
      />

      <div className="bg-[var(--primary-light)] rounded-xl p-4 text-sm text-[var(--text-body)]">
        <p className="font-semibold text-[var(--primary)] mb-1">Registration fee</p>
        <p className="text-[var(--text-muted)]">
          A one-time registration fee is payable after your account is verified. You'll be redirected to Paystack to complete payment securely. The exact amount will be shown at that step.
        </p>
      </div>
    </div>
  );
}

// ─── Step 4 — Review ──────────────────────────────────────────────────────────

function Step4({ data, photoUrl }: { data: Partial<FormData>; photoUrl?: string }) {
  const set = MOCK_SETS.find((s) => s.id === data.setId);
  const preview = photoUrl || data.profile_image;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Review your details
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Check everything is correct before submitting.
        </p>
      </div>
      {preview && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Profile preview"
            className="w-14 h-14 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-medium text-[var(--text-heading)]">Profile photo</p>
            <p className="text-xs text-[var(--text-muted)]">
              This will appear on your member ID card.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-0 text-sm">
        {[
          { label: "Email",       value: data.email },
          { label: "Full name",   value: data.full_name },
          { label: "Gender",      value: data.gender || "—" },
          { label: "Phone",       value: data.phone || "—" },
          { label: "Address",     value: data.address || "—" },
          {
            label: "Birthday",
            value:
              data.birth_day && data.birth_month
                ? `${data.birth_day} ${data.birth_month}`
                : "—",
          },
          { label: "Set",         value: set ? `Class of ${set.set_name}` : data.setId },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex items-start justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0"
          >
            <span className="text-[var(--text-muted)] w-28 shrink-0">{label}</span>
            <span className="text-[var(--text-heading)] font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
      <div className="bg-[var(--success-bg)] rounded-xl p-4 text-sm text-[#166534]">
        <p className="font-semibold mb-1 flex items-center gap-1.5">
          <Check size={15} /> Ready to submit
        </p>
        <p className="opacity-80">
          By submitting, you agree to the association's terms. Your account will be reviewed and verified by an admin. Once verified, you'll be prompted to pay the registration fee to gain full access.
        </p>
      </div>
    </div>
  );
}

// Notice banners (e.g. login → register redirect) passed via ?notice=
const NOTICES: Record<string, string> = {
  "invalid-login":
    "We couldn't find an account matching that email and password. Create your account below to get started.",
};

// ─── Main page ────────────────────────────────────────────────────────────────

function RegisterContent() {
  const [step, setStep]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");

  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");

  const {
    register,
    control,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormData>({ mode: "onTouched" });

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: ["email", "password", "confirmPassword"],
    2: ["full_name"],
    3: ["setId"],
  };

  const handleNext = async () => {
    if (step === 2 && !photoUrl) {
      setPhotoError("Please upload a profile photo");
      return;
    }
    const fields = stepFields[step];
    if (fields) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      await apiRegister({
        full_name:     data.full_name,
        email:         data.email,
        password:      data.password,
        setId:         data.setId,         // spec: camelCase setId at signup
        gender:        data.gender || undefined,
        phone:         data.phone  || undefined,
        address:       data.address || undefined,
        birth_day:     data.birth_day || undefined,
        birth_month:   data.birth_month || undefined,
        bio:           data.bio    || undefined,
        profile_image: photoUrl || undefined,
      });
      const set = MOCK_SETS.find((s) => s.id === data.setId);
      saveCurrentUser({
        full_name:     data.full_name,
        email:         data.email,
        role:          "member",
        setId:         data.setId,
        set_name:      set?.set_name,
        gender:        data.gender,
        phone:         data.phone,
        address:       data.address,
        birth_day:     data.birth_day,
        birth_month:   data.birth_month,
        bio:           data.bio,
        profile_image: photoUrl || undefined,
      });
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <>
        <Navbar variant="public" />
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="card max-w-md w-full p-8 text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
              <Check size={32} className="text-[var(--success)]" />
            </div>
            <h2 className="text-2xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
              Application submitted!
            </h2>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed">
              Your registration is under review. You'll receive an email once your account is verified. After verification, you'll be prompted to pay the registration fee to gain full access.
            </p>
            <Link href="/" className="btn-primary w-full justify-center mt-2">
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar variant="public" />

      <main className="flex-1 flex flex-col items-center px-4 py-10">
        {/* Page header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center mb-3">
            <span className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center">
              <GraduationCap size={20} />
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            Join AlumniConnect
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Already a member?{" "}
            <Link href="/login" className="text-[var(--primary)] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* Notice from a failed login attempt */}
        {notice && NOTICES[notice] && (
          <div className="w-full max-w-md mb-6 rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] px-4 py-3 text-sm text-[var(--text-body)]">
            {NOTICES[notice]}
          </div>
        )}

        {/* Stepper */}
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center">
            {STEPS.map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      step > s.id
                        ? "bg-[var(--success)] text-white"
                        : step === s.id
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--border-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    {step > s.id ? <Check size={14} /> : s.id}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      step >= s.id ? "text-[var(--text-heading)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${
                      step > s.id ? "bg-[var(--success)]" : "bg-[var(--border-subtle)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="card w-full max-w-md p-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {step === 1 && <Step1 register={register} errors={errors} />}
            {step === 2 && (
              <Step2
                register={register}
                errors={errors}
                onPhoto={(url) => {
                  setPhotoUrl(url);
                  setPhotoError("");
                }}
                photoUrl={photoUrl}
                photoError={photoError}
              />
            )}
            {step === 3 && <Step3 register={register} errors={errors} />}
            {step === 4 && <Step4 data={getValues()} photoUrl={photoUrl} />}

            <div className="flex justify-between mt-7 gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ArrowLeft size={16} /> Back
                </Button>
              ) : (
                <div />
              )}
              {step < 4 ? (
                <Button type="button" onClick={handleNext} className="ml-auto">
                  Next <ArrowRight size={16} />
                </Button>
              ) : (
                <Button type="submit" loading={loading} className="ml-auto">
                  Submit Application
                </Button>
              )}
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
