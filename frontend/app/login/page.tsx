"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { GraduationCap } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { apiLogin } from "@/lib/api";

interface FormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");
    try {
      await apiLogin(data.email, data.password);
      window.location.href = "/dashboard";
    } catch {
      setError("Invalid email or password. Please try again.");
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
                {...register("email", { required: "Email is required" })}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password", { required: "Password is required" })}
              />
              <Button type="submit" fullWidth loading={loading} className="mt-1">
                Sign In
              </Button>
            </form>

            <p className="text-xs text-center text-[var(--text-muted)] mt-1">
              Don't have an account?{" "}
              <Link href="/register" className="text-[var(--primary)] font-medium hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
