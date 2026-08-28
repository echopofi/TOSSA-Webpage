"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiLogin, ApiRequestError } from "@/lib/api";
import { saveCurrentUser } from "@/lib/session";
import { EMAIL_REGEX, EMAIL_MAX, PASSWORD_MAX } from "@/lib/validation";

interface FormData {
  email: string;
  password: string;
}

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");
    try {
      const res = await apiLogin(data.email, data.password);
      // Persist the session so route guards can verify it before rendering.
      saveCurrentUser({
        full_name: res.data.user.full_name,
        email: res.data.user.email,
        role: res.data.user.role,
      });
      // Only allow relative destinations (never open redirects).
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(target);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.status === 401) {
          // Not a registered account (or wrong password) — never sign in.
          // Notify on the registration page and carry them there.
          router.push("/register?notice=invalid-login");
          return;
        }
        if (err.status === 403) {
          setError(
            "Your account has not been verified yet. An admin will verify your account before you can sign in."
          );
          return;
        }
      }
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center mx-auto mb-4">
              <GraduationCap size={24} />
            </div>
            <h1 className="text-2xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Sign in to your alumni account
            </p>
          </div>

          {/* Card */}
          <div className="card p-6 flex flex-col gap-4">
            {error && (
              <div className="bg-[var(--danger-bg)] text-[var(--danger)] text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email", {
                  required: "Email is required",
                  pattern: { value: EMAIL_REGEX, message: "Enter a valid email address" },
                  maxLength: { value: EMAIL_MAX, message: "Email is too long" },
                })}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password", {
                  required: "Password is required",
                  maxLength: { value: PASSWORD_MAX, message: "Password is too long" },
                })}
              />
              <Button type="submit" fullWidth loading={loading} className="mt-1">
                Sign In
              </Button>
            </form>

            <p className="text-xs text-center text-[var(--text-muted)] mt-1">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-[var(--primary)] font-medium hover:underline">
                Register
              </Link>
            </p>
            <p className="text-[11px] text-center text-[var(--text-muted)]">
              Demo accounts: <span className="font-mono">member@test.com</span> /{" "}
              <span className="font-mono">member12345</span> ·{" "}
              <span className="font-mono">admin@test.com</span> /{" "}
              <span className="font-mono">admin12345</span>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}