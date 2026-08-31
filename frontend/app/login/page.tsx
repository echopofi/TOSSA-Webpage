"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { GraduationCap, User, Lock, Mail } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { apiLogin, apiRegister, ApiRequestError, apiGetSets } from "@/lib/api";
import { saveCurrentUser, saveAccessToken } from "@/lib/session";
import { MOCK_SETS } from "@/lib/mockData";
import type { GraduationSet } from "@/lib/types";
import { EMAIL_REGEX, EMAIL_MAX, NAME_MAX, PASSWORD_MAX } from "@/lib/validation";

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  setId: string;
}

const NOTICES: Record<string, string> = {
  "invalid-login":
    "We couldn't find an account matching that email and password. Create your account below to get started.",
};

function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramNotice = searchParams.get("notice");

  const [active, setActive] = useState(() => (paramNotice && NOTICES[paramNotice] ? true : false));
  const [loading, setLoading] = useState<"login" | "register" | null>(null);
  const [notice, setNotice] = useState(() =>
    paramNotice && NOTICES[paramNotice] ? NOTICES[paramNotice] : ""
  );
  const [regError, setRegError] = useState("");
  const [sets, setSets] = useState<GraduationSet[]>([]);
  const [received, setReceived] = useState(false);
  useEffect(() => {
    let activeFlag = true;
    apiGetSets()
      .then((res) => {
        if (activeFlag && res.data.length > 0) setSets(res.data);
      })
      .catch(() => {
        if (activeFlag) setSets(MOCK_SETS);
      });
    return () => {
      activeFlag = false;
    };
  }, []);

  const setOptions = (sets.length > 0 ? sets : MOCK_SETS).map((s) => ({
    value: s.id,
    label: `Class of ${s.set_name}`,
  }));

  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  async function onLogin(data: LoginForm) {
    setLoading("login");
    try {
      const res = await apiLogin(data.email, data.password);
      saveCurrentUser({
        full_name: res.data.user.full_name,
        email: res.data.user.email,
        role: res.data.user.role,
      });
      saveAccessToken(res.data.access_token);
      const fallback = res.data.user.role === "admin" ? "/admin" : "/dashboard";
      router.push(fallback);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 403) {
        setNotice(
          "Your account has not been verified yet. An admin will verify your account before you can sign in."
        );
        return;
      }
      setNotice(
        err instanceof ApiRequestError && err.status === 401
          ? NOTICES["invalid-login"]
          : err instanceof Error
          ? err.message
          : "Unable to reach the server. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  async function onRegister(data: RegisterForm) {
    setLoading("register");
    setRegError("");
    try {
      let setId = data.setId;
      if (setId.startsWith("set_")) {
        const fallbackName = MOCK_SETS.find((s) => s.id === setId)?.set_name;
        let fresh: { data: GraduationSet[] } | null = null;
        try {
          fresh = await apiGetSets();
        } catch {
          /* surfaced below */
        }
        const real = fresh?.data.find((s) => s.set_name === fallbackName);
        if (real) setId = real.id;
      }
      if (setId.startsWith("set_")) {
        throw new ApiRequestError(
          0,
          "Graduating sets couldn't be loaded from the server. Please reload this page and try again."
        );
      }
      await apiRegister({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        setId,
      });
      setReceived(true);
    } catch (err) {
      setRegError(
        err instanceof ApiRequestError
          ? err.status === 409
            ? "That email is already registered. Sign in instead."
            : err.message
          : "Unable to reach the server. Please try again."
      );
    } finally {
      setLoading(null);
    }
  }

  if (received) {
    return (
      <>
        <Navbar variant="public" />
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="card max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--success-bg)] flex items-center justify-center">
              <GraduationCap size={28} className="text-[var(--success)]" />
            </div>
            <h2 className="text-xl font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)]">
              Registration submitted
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Your account is under review. You&apos;ll receive an email once it&apos;s verified, then you can sign in.
            </p>
            <button
              onClick={() => {
                setReceived(false);
                setActive(false);
                setRegError("");
                registerForm.reset();
              }}
              className="btn-outline w-full justify-center"
            >
              Back to sign in
            </button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar variant="public" />
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className={`authcard ${active ? "active" : ""}`}>
          {/* ── Login form ── */}
          <div className="form-box login">
            <form
              noValidate
              onSubmit={loginForm.handleSubmit(onLogin)}
              className="auth-form"
            >
              <h1 className="auth-heading">Login</h1>
              <div className="input-box">
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...loginForm.register("email", {
                    required: "Email is required",
                    pattern: { value: EMAIL_REGEX, message: "Enter a valid email address" },
                    maxLength: { value: EMAIL_MAX, message: "Email is too long" },
                  })}
                />
                <Mail size={20} />
              </div>
              <div className="input-box">
                <input
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  {...loginForm.register("password", {
                    required: "Password is required",
                    maxLength: { value: PASSWORD_MAX, message: "Password is too long" },
                  })}
                />
                <Lock size={20} />
              </div>
              {notice && (
                <p className={`auth-notice ${loading === "login" ? "" : ""}`}>{notice}</p>
              )}
              <button type="submit" className="auth-btn" disabled={loading === "login"}>
                {loading === "login" ? "Signing in…" : "Login"}
              </button>
            </form>
          </div>

          {/* ── Register form ── */}
          <div className="form-box register">
            <form
              noValidate
              onSubmit={registerForm.handleSubmit(onRegister)}
              className="auth-form"
            >
              <h1 className="auth-heading">Registration</h1>
              <div className="input-box">
                <input
                  type="text"
                  placeholder="Full Name"
                  autoComplete="name"
                  {...registerForm.register("full_name", {
                    required: "Full name is required",
                    maxLength: { value: NAME_MAX, message: "Full name is too long" },
                  })}
                />
                <User size={20} />
              </div>
              <div className="input-box">
                <input
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  {...registerForm.register("email", {
                    required: "Email is required",
                    pattern: { value: EMAIL_REGEX, message: "Enter a valid email address" },
                    maxLength: { value: EMAIL_MAX, message: "Email is too long" },
                  })}
                />
                <Mail size={20} />
              </div>
              <div className="input-box">
                <input
                  type="password"
                  placeholder="Password"
                  autoComplete="new-password"
                  {...registerForm.register("password", {
                    required: "Password is required",
                    minLength: { value: 8, message: "Password must be at least 8 characters" },
                    maxLength: { value: PASSWORD_MAX, message: "Password is too long" },
                  })}
                />
                <Lock size={20} />
              </div>
              <div className="input-box">
                <select
                  className="auth-select"
                  defaultValue=""
                  {...registerForm.register("setId", {
                    required: "Please select your graduating set",
                  })}
                >
                  <option value="" disabled>
                    Graduating set
                  </option>
                  {setOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {regError && <p className="auth-notice">{regError}</p>}
              <button type="submit" className="auth-btn" disabled={loading === "register"}>
                {loading === "register" ? "Submitting…" : "Register"}
              </button>
            </form>
          </div>

          {/* ── Toggle overlay ── */}
          <div className="toggle-box">
            <div className="toggle-panel toggle-left">
              <h1 className="auth-heading light">Hello, Welcome!</h1>
              <p>Don&apos;t have an account?</p>
              <button className="auth-btn light" onClick={() => setActive(true)}>
                Register
              </button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1 className="auth-heading light">Welcome Back!</h1>
              <p>Already have an account?</p>
              <button className="auth-btn light" onClick={() => setActive(false)}>
                Login
              </button>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .authcard {
          position: relative;
          width: 850px;
          max-width: 94vw;
          height: 550px;
          max-height: 92vh;
          background: var(--surface-card);
          border-radius: var(--radius-card);
          box-shadow: var(--shadow-card);
          overflow: hidden;
          font-family: "Poppins", sans-serif;
        }
        .authcard h1 {
          font-size: 36px;
          margin: -10px 0 4px;
          font-weight: 600;
          color: var(--text-heading);
        }
        .authcard p {
          font-size: 14.5px;
          margin: 6px 0 16px;
          color: #fff;
        }
        .auth-heading.light { color: #fff; }

        .form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: var(--surface-card);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-body);
          text-align: center;
          padding: 40px;
          z-index: 1;
          transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
        }
        .authcard.active .form-box { right: 50%; }

        .form-box.register {
          visibility: hidden;
        }
        .authcard.active .form-box.register {
          visibility: visible;
        }

        .auth-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-box {
          position: relative;
          margin: 10px 0;
        }
        .input-box input,
        .input-box select {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: var(--bg-base);
          border-radius: 8px;
          border: 1.5px solid transparent;
          outline: none;
          font-size: 16px;
          color: var(--text-body);
          font-weight: 500;
          font-family: "Inter", sans-serif;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .input-box input::placeholder { color: var(--text-muted); font-weight: 400; }
        .input-box input:focus,
        .input-box select:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(124, 111, 209, 0.15);
          background: var(--surface-card);
        }
        .auth-select {
          color: var(--text-muted);
          cursor: pointer;
        }
        .auth-select:has(option:checked:not([value=""])) { color: var(--text-body); }
        .input-box i, .input-box svg {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 20px;
          color: var(--text-muted);
          pointer-events: none;
        }

        .auth-notice {
          margin: 2px 0 10px;
          color: var(--danger);
          font-size: 13px;
          font-family: "Inter", sans-serif;
          background: var(--danger-bg);
          padding: 8px 12px;
          border-radius: 8px;
          text-align: left;
        }

        .auth-btn {
          width: 100%;
          height: 48px;
          background: var(--primary);
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(44, 36, 80, 0.15);
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #fff;
          font-weight: 600;
          font-family: "Poppins", sans-serif;
          transition: background 0.15s ease, transform 0.1s ease;
          margin-top: 8px;
        }
        .auth-btn:hover { background: var(--primary-hover); }
        .auth-btn:active { transform: scale(0.98); }
        .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .auth-btn.light {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid #fff;
          box-shadow: none;
        }
        .auth-btn.light:hover { background: rgba(255, 255, 255, 0.15); }

        .toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
        }
        .toggle-box::before {
          content: "";
          position: absolute;
          left: -250%;
          width: 300%;
          height: 100%;
          background: var(--primary);
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }
        .authcard.active .toggle-box::before { left: 50%; }

        .toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 2;
          transition: 0.6s ease-in-out;
        }
        .toggle-panel.toggle-left {
          left: 0;
          transition-delay: 1.2s;
        }
        .authcard.active .toggle-panel.toggle-left {
          left: -50%;
          transition-delay: 0.6s;
        }
        .toggle-panel.toggle-right {
          right: -50%;
          transition-delay: 0.6s;
        }
        .authcard.active .toggle-panel.toggle-right {
          right: 0;
          transition-delay: 1.2s;
        }
        .toggle-panel p { margin-bottom: 20px; }

        @media screen and (max-width: 650px) {
          .authcard { height: calc(100vh - 40px); }
          .form-box {
            bottom: 0;
            width: 100%;
            height: 70%;
            transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
          }
          .authcard.active .form-box { right: 0; bottom: 30%; }
          .toggle-box::before {
            left: 0;
            top: -270%;
            width: 100%;
            height: 300%;
            border-radius: 20vw;
          }
          .authcard.active .toggle-box::before { left: 0; top: 70%; }
          .toggle-panel { width: 100%; height: 30%; }
          .toggle-panel.toggle-left { left: 0; top: 0; }
          .authcard.active .toggle-panel.toggle-left { left: 0; top: -30%; }
          .toggle-panel.toggle-right { right: 0; bottom: -30%; }
          .authcard.active .toggle-panel.toggle-right { bottom: 0; }
        }
        @media screen and (max-width: 400px) {
          .form-box { padding: 20px; }
          .toggle-panel h1 { font-size: 30px; }
        }
      `}</style>
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
      <AuthCard />
    </Suspense>
  );
}
