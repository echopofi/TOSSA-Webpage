"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { KeyRound, UserCircle2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  apiMe,
  apiUpdateProfile,
  apiChangePassword,
  ApiRequestError,
} from "@/lib/api";
import { saveCurrentUser, getCurrentUser } from "@/lib/session";
import { NAME_MAX, PHONE_MAX, PASSWORD_MAX } from "@/lib/validation";

interface ProfileForm {
  fullName: string;
  phone: string;
  address: string;
  bio: string;
  gender: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const session = getCurrentUser();

  const profileForm = useForm<ProfileForm>();
  const passwordForm = useForm<PasswordForm>();
  const watchNew = passwordForm.watch("newPassword");

  useEffect(() => {
    (async () => {
      try {
        const res = await apiMe();
        const m = res.data.member;
        profileForm.reset({
          fullName: res.data.user.full_name,
          phone: m?.phone ?? "",
          address: m?.address ?? "",
          bio: m?.bio ?? "",
          gender: m?.gender
            ? m.gender.charAt(0).toUpperCase() + m.gender.slice(1)
            : "",
        });
      } catch {
        profileForm.reset({
          fullName: session?.full_name ?? "",
          phone: session?.phone ?? "",
          address: session?.address ?? "",
          bio: session?.bio ?? "",
          gender: session?.gender ?? "",
        });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSaveProfile(data: ProfileForm) {
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const res = await apiUpdateProfile({
        fullName: data.fullName.trim(),
        phone: data.phone.trim() || undefined,
        address: data.address.trim() || undefined,
        bio: data.bio.trim() || undefined,
        gender: data.gender || undefined,
      });
      saveCurrentUser({
        full_name: res.data.user.full_name,
        email: res.data.user.email,
        role: res.data.user.role,
        phone: res.data.member?.phone,
        address: res.data.member?.address,
        bio: res.data.member?.bio,
        gender: res.data.member?.gender,
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
      const res = await apiChangePassword(
        data.currentPassword,
        data.newPassword
      );
      setPasswordMessage({
        type: "ok",
        text: res.data.message + " Please sign out and sign in again on other devices.",
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
          Admin Settings
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Update your profile and change your password.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <h2 className="text-base font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] mb-5 flex items-center gap-2">
          <UserCircle2 size={18} className="text-[var(--primary)]" />
          Profile
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

      {/* Password */}
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

        <form
          onSubmit={passwordForm.handleSubmit(onChangePassword)}
          className="flex flex-col gap-4"
        >
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
    </div>
  );
}