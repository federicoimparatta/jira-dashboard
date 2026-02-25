"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const from = searchParams.get("from") || "/dashboard";
        router.push(from);
        router.refresh();
      } else {
        setError("Wrong password");
        setShake(true);
        setPassword("");
        setTimeout(() => setShake(false), 600);
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background — navy-to-blue gradient matching the nav bar */}
      <div className="absolute inset-0 smg-gradient-nav" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow orb */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[120px]"
        style={{
          background: "radial-gradient(circle, var(--smg-blue-light), transparent 70%)",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Login card */}
      <div
        className={`relative z-10 w-full max-w-sm mx-4 ${shake ? "animate-shake" : ""}`}
      >
        <div className="smg-card p-8 border-smg-gray-200/50">
          {/* Top accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-[16px] bg-linear-to-r from-smg-blue via-smg-magenta to-smg-teal" />

          {/* Logo / title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-smg-blue to-smg-blue-dark mb-4">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-smg-gray-900">
              Engineering Dashboard
            </h1>
            <p className="mt-1 text-sm text-smg-gray-500">
              Enter the team password to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Password"
                autoComplete="current-password"
                className={`w-full px-4 py-3 rounded-xl border bg-white text-sm text-smg-gray-900 placeholder:text-smg-gray-300 outline-none transition-all duration-200 ${
                  error
                    ? "border-smg-danger ring-2 ring-smg-danger/20"
                    : "border-smg-gray-200 focus:border-smg-blue focus:ring-2 focus:ring-smg-blue/20"
                }`}
              />
              {error && (
                <p className="mt-2 text-xs font-medium text-smg-danger">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-smg-blue to-smg-blue-light hover:shadow-lg hover:shadow-smg-blue/25 active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Verifying...
                </span>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-4px); }
          30%, 70% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
