"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Satellite, Mail, Lock, AlertCircle } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }

      // Session cookie is now set server-side — hard navigate so middleware sees it
      window.location.href = "/dashboard";
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 2 + 1 + "px",
              height: Math.random() * 2 + 1 + "px",
              top: Math.random() * 100 + "%",
              left: Math.random() * 100 + "%",
              opacity: Math.random() * 0.6 + 0.1,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-space-600 mb-4">
            <Satellite className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SatTrack</h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "login" ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-space-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-space-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-space-600 hover:bg-space-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            {loading ? "Loading…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-4">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => { setMode("signup"); setError(null); }}
                className="text-space-400 hover:text-space-300"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("login"); setError(null); }}
                className="text-space-400 hover:text-space-300"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
