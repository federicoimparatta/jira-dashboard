"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
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
        body: JSON.stringify({ jiraBaseUrl, email, apiToken }),
      });

      if (res.ok) {
        const from = searchParams.get("from") || "/setup";
        router.push(from);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isValid = jiraBaseUrl && email && apiToken;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 dash-gradient-nav" />

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
          background: "radial-gradient(circle, var(--dash-blue-light), transparent 70%)",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Login card */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 ${shake ? "animate-shake" : ""}`}
      >
        <div className="dash-card p-8 border-dash-gray-200/50">
          {/* Top accent bar */}
          <div className="absolute inset-x-0 top-0 h-1 rounded-t-[16px] bg-linear-to-r from-dash-blue via-dash-magenta to-dash-teal" />

          {/* Logo / title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-linear-to-br from-dash-blue to-dash-blue-dark mb-4">
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
            <h1 className="text-xl font-bold text-dash-gray-900">
              Connect to Jira
            </h1>
            <p className="mt-1 text-sm text-dash-gray-500">
              Enter your Jira Cloud credentials to get started
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dash-gray-500 mb-1.5">
                Jira Instance URL
              </label>
              <input
                ref={inputRef}
                type="url"
                value={jiraBaseUrl}
                onChange={(e) => {
                  setJiraBaseUrl(e.target.value);
                  if (error) setError("");
                }}
                placeholder="https://your-team.atlassian.net"
                className={`w-full px-4 py-3 rounded-xl border bg-white text-sm text-dash-gray-900 placeholder:text-dash-gray-300 outline-none transition-all duration-200 ${
                  error
                    ? "border-dash-danger ring-2 ring-dash-danger/20"
                    : "border-dash-gray-200 focus:border-dash-blue focus:ring-2 focus:ring-dash-blue/20"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dash-gray-500 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                placeholder="you@company.com"
                autoComplete="email"
                className={`w-full px-4 py-3 rounded-xl border bg-white text-sm text-dash-gray-900 placeholder:text-dash-gray-300 outline-none transition-all duration-200 ${
                  error
                    ? "border-dash-danger ring-2 ring-dash-danger/20"
                    : "border-dash-gray-200 focus:border-dash-blue focus:ring-2 focus:ring-dash-blue/20"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dash-gray-500 mb-1.5">
                API Token
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => {
                  setApiToken(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Your Jira API token"
                autoComplete="off"
                className={`w-full px-4 py-3 rounded-xl border bg-white text-sm text-dash-gray-900 placeholder:text-dash-gray-300 outline-none transition-all duration-200 ${
                  error
                    ? "border-dash-danger ring-2 ring-dash-danger/20"
                    : "border-dash-gray-200 focus:border-dash-blue focus:ring-2 focus:ring-dash-blue/20"
                }`}
              />
              <p className="mt-1.5 text-[11px] text-dash-gray-500">
                Generate one at{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-dash-blue hover:underline"
                >
                  id.atlassian.com
                </a>
              </p>
            </div>

            {error && (
              <p className="text-xs font-medium text-dash-danger bg-dash-danger/5 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !isValid}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-dash-blue to-dash-blue-light hover:shadow-lg hover:shadow-dash-blue/25 active:scale-[0.98]"
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
                  Connecting to Jira...
                </span>
              ) : (
                "Connect"
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
