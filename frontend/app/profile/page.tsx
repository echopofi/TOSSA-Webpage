"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import StatusPill from "@/components/ui/StatusPill";
import {
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  UserCircle2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Camera,
  CalendarDays,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import {
  apiMe,
  apiUpdateProfile,
  apiChangePassword,
  ApiRequestError,
} from "@/lib/api";
import { saveCurrentUser } from "@/lib/session";
import { uploadMemberPhoto } from "@/lib/upload";
import { initials, formatDate } from "@/lib/utils";
import type { Member } from "@/lib/types";
import { NAME_MAX, PHONE_MAX, PASSWORD_MAX } from "@/lib/validation";
import { Reveal, Stagger, StaggerItem, fadeUp } from "@/lib/motion";

interface ProfileForm {
  fullName: string;
  gender: string;
  phone: string;
  occupation: string;
  address: string;
  bio: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const [member, setMember]         = useState<Member | null>(null);
  const [photo, setPhoto]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileForm>();
  const passwordForm = useForm<PasswordForm>();
  const watchNew = passwordForm.watch("newPassword");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiMe();
        const m = res.data.member;
        setMember(m);
        setPhoto(m.profile_image ?? "");
        profileForm.reset({
          fullName: res.data.user.full_name,
          gender: m.gender ? m.gender.charAt(0).toUpperCase() + m.gender.slice(1) : "",
          phone: m.phone ?? "",
          occupation: m.occupation ?? "",
          address: m.address ?? "",
          bio: m.bio ?? "",
        });
      } catch {
        const session = (await import("@/lib/session")).getCurrentUser();
        if (session) {
          const fallback: Member = {
            id: `mem_${Date.now()}`,
            user_id: `usr_${Date.now()}`,
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
          setMember(fallback);
          setPhoto(session.profile_image ?? "");
          profileForm.reset({
            fullName: session.full_name,
            gender: session.gender ?? "",
            phone: session.phone ?? "",
            occupation: "",
            address: session.address ?? "",
            bio: session.bio ?? "",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProfileMessage(null);
    try {
      const url = await uploadMemberPhoto(file);
      setPhoto(url);
      setProfileMessage({ type: "ok", text: "Photo uploaded — save your profile to keep it." });
    } catch (err) {
      setProfileMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Could not upload photo.",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onSaveProfile(data: ProfileForm) {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await apiUpdateProfile({
        fullName: data.fullName.trim(),
        gender: data.gender || undefined,
        phone: data.phone.trim() || undefined,
        occupation: data.occupation || undefined,
        address: data.address.trim() || undefined,
        bio: data.bio.trim() || undefined,
        profileImage: photo || undefined,
      });
      // Keep the local identity + session fresh with the server response.
      const updated = res.data;
      setMember((prev) => ({
        id: updated.member.id,
        user_id: updated.member.user_id,
        full_name: updated.member.full_name,
        email: updated.user.email,
        gender: updated.member.gender,
        phone: updated.member.phone,
        address: updated.member.address,
        bio: updated.member.bio,
        profile_image: updated.member.profile_image,
        is_active: prev?.is_active ?? true,
        joined_at: prev?.joined_at ?? new Date().toISOString(),
        set_id: prev?.set_id,
        set_name: prev?.set_name,
        role_in_set: prev?.role_in_set,
        matric_number: updated.member.matric_number,
        occupation: updated.member.occupation,
      }));
      saveCurrentUser({
        full_name: updated.user.full_name,
        email: updated.user.email,
        role: updated.user.role,
        gender: updated.member.gender,
        phone: updated.member.phone,
        address: updated.member.address,
        bio: updated.member.bio,
        profile_image: updated.member.profile_image,
        setId: member?.set_id,
        set_name: member?.set_name,
      });
      setProfileMessage({ type: "ok", text: "Profile saved successfully." });
    } catch (err) {
      setProfileMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to save profile.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(data: PasswordForm) {
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await apiChangePassword(data.currentPassword, data.newPassword);
      setPasswordMessage({
        type: "ok",
        text: res.data.message + " Please sign in again on your other devices.",
      });
      passwordForm.reset();
    } catch (err) {
      setPasswordMessage({
        type: "err",
        text: err instanceof ApiRequestError ? err.message : "Failed to change password.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!member) return null;

  const nameParts = member.full_name.split(" ").filter(Boolean);
  const initialText = initials(nameParts[0] ?? "?", nameParts[1] ?? "");

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Reveal variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
            My Profile
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Your details are visible to the alumni community.
          </p>
        </div>
        <div className="shrink-0">
          <StatusPill
            status={member.is_active ? "paid" : "pending"}
            label={member.is_active ? "Active" : "Inactive"}
          />
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Identity card ────────────────────────────────────────────────── */}
        <Stagger className="lg:col-span-1 flex flex-col gap-5">
          <StaggerItem>
            <Card className="flex flex-col items-center text-center gap-4 py-8 px-5">
              <div className="relative">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={member.full_name}
                    className="w-28 h-28 rounded-full object-cover ring-4 ring-[var(--primary-light)]"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center font-[family-name:var(--font-heading)] font-semibold text-4xl ring-4 ring-[var(--border-subtle)]">
                    {initialText || "M"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-55"
                  aria-label="Change photo"
                >
                  {uploading ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickPhoto}
                />
              </div>

              <div>
                <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
                  {member.full_name}
                </h2>
                {member.role_in_set && member.role_in_set !== "member" && (
                  <p className="text-xs text-[var(--primary)] font-medium mt-0.5 capitalize">
                    {member.role_in_set.replace(/_/g, " ")}
                  </p>
                )}
                <div className="mt-2 flex justify-center gap-2 flex-wrap">
                  {member.is_active ? (
                    <StatusPill status="paid" label="Verified" />
                  ) : (
                    <StatusPill status="pending" label="Pending verification" />
                  )}
                </div>
              </div>

              {/* Detail rows */}
              <div className="w-full flex flex-col gap-2.5 text-sm border-t border-[var(--border-subtle)] pt-4 text-left">
                {member.set_name && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <GraduationCap size={14} className="shrink-0" />
                    <Link
                      href={member.set_id ? `/sets/${member.set_id}` : "/sets"}
                      className="text-[var(--primary)] hover:underline"
                    >
                      Class of {member.set_name}
                    </Link>
                  </div>
                )}
                {member.email && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate text-xs">{member.email}</span>
                  </div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <Phone size={14} className="shrink-0" />
                    <span className="truncate text-xs">{member.phone}</span>
                  </div>
                )}
                {member.address && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate text-xs">{member.address}</span>
                  </div>
                )}
                {member.occupation && (
                  <div className="flex items-center gap-2 text-[var(--text-muted)]">
                    <UserCircle2 size={14} className="shrink-0" />
                    <span className="truncate text-xs capitalize">
                      {member.occupation.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full border-t border-[var(--border-subtle)] pt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} />
                  Joined {formatDate(member.joined_at, "d MMM yyyy")}
                </span>
                <span className="font-mono">{member.id.slice(-6).toUpperCase()}</span>
              </div>

              <Link
                href="/id-card"
                className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] font-medium hover:underline mt-1"
              >
                View ID Card <ArrowRight size={14} />
              </Link>
            </Card>
          </StaggerItem>
        </Stagger>

        {/* ── Forms column ───────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Edit profile */}
          <Reveal variants={fadeUp}>
            <Card>
              <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
                <UserCircle2 size={18} className="text-[var(--primary)]" />
                Edit Profile
              </h2>

              {profileMessage && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm ${
                    profileMessage.type === "ok"
                      ? "bg-[var(--success-bg)] text-[#166534]"
                      : "bg-[var(--danger-bg)] text-[var(--danger)]"
                  }`}
                >
                  {profileMessage.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {profileMessage.text}
                </div>
              )}

              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="flex flex-col gap-4">
                <Input
                  label="Full name"
                  placeholder="Your full name"
                  error={profileForm.formState.errors.fullName?.message}
                  {...profileForm.register("fullName", {
                    required: "Full name is required",
                    maxLength: { value: NAME_MAX, message: "Full name is too long" },
                  })}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Gender"
                    placeholder="Select gender"
                    options={[
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                    ]}
                    {...profileForm.register("gender")}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    error={profileForm.formState.errors.phone?.message}
                    {...profileForm.register("phone", {
                      maxLength: { value: PHONE_MAX, message: "Phone number is too long" },
                    })}
                  />
                </div>
                <Select
                  label="Occupation Status"
                  placeholder="Select your occupation status"
                  options={[
                    { value: "student", label: "Student" },
                    { value: "unemployed", label: "Unemployed" },
                    { value: "employed", label: "Employed" },
                    { value: "prefer_not_to_say", label: "Prefer not to say" },
                  ]}
                  {...profileForm.register("occupation")}
                />
                <Input
                  label="Address"
                  placeholder="City, State, Country"
                  error={profileForm.formState.errors.address?.message}
                  {...profileForm.register("address")}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                    Short bio
                  </label>
                  <textarea
                    className={`input resize-none ${profileForm.formState.errors.bio ? "error" : ""}`}
                    rows={3}
                    placeholder="A few words about you…"
                    {...profileForm.register("bio")}
                  />
                  {profileForm.formState.errors.bio && (
                    <p className="text-xs text-[var(--danger)]">{profileForm.formState.errors.bio.message}</p>
                  )}
                </div>
                <Button type="submit" loading={savingProfile} className="self-start mt-1">
                  Save Profile
                </Button>
              </form>
            </Card>
          </Reveal>

          {/* Change password */}
          <Reveal variants={fadeUp}>
            <Card>
              <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
                <KeyRound size={18} className="text-[var(--primary)]" />
                Change Password
              </h2>

              {passwordMessage && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm ${
                    passwordMessage.type === "ok"
                      ? "bg-[var(--success-bg)] text-[#166534]"
                      : "bg-[var(--danger-bg)] text-[var(--danger)]"
                  }`}
                >
                  {passwordMessage.type === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {passwordMessage.text}
                </div>
              )}

              <p className="text-xs text-[var(--text-muted)] mb-4">
                Changing your password signs you out on every other device.
              </p>

              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="flex flex-col gap-4">
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  error={passwordForm.formState.errors.currentPassword?.message}
                  {...passwordForm.register("currentPassword", {
                    required: "Current password is required",
                    maxLength: { value: PASSWORD_MAX, message: "Password is too long" },
                  })}
                />
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.newPassword?.message}
                  {...passwordForm.register("newPassword", {
                    required: "New password is required",
                    minLength: { value: 8, message: "Password must be at least 8 characters" },
                    maxLength: { value: PASSWORD_MAX, message: "Password is too long" },
                  })}
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  {...passwordForm.register("confirmPassword", {
                    required: "Please confirm your new password",
                    validate: (v) => v === watchNew || "Passwords do not match",
                  })}
                />
                <Button type="submit" loading={savingPassword} className="self-start mt-1">
                  Change Password
                </Button>
              </form>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}