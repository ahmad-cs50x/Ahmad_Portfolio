"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw, HelpCircle } from "lucide-react";
import { toast } from "@/components/Toast";

function TotpGateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);

  const provider = searchParams.get("provider") || "google";
  const callbackUrl = searchParams.get("callbackUrl") || "/client-portal";

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(30 - Math.floor((Date.now() / 1000) % 30));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setVerifying(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, provider }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.message || "Invalid code. Try again.");
        toast.error("Verification failed", { detail: json.message || "Invalid TOTP code" });
        setVerifying(false);
        return;
      }

      toast.success("Verified!", { detail: "Redirecting to Google sign-in…" });
      signIn(provider, { callbackUrl });
    } catch {
      setError("Network error. Please try again.");
      toast.error("Error", { detail: "Network error. Please try again." });
      setVerifying(false);
    }
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      setCode(pasted);
      e.preventDefault();
    }
  }

  return (
    <main className="relative min-h-screen bg-ink flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.15),transparent_70%)]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 mb-8 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
            <svg className="h-8 w-8 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Admin Verification</h1>
          <p className="mt-2 text-zinc-400">Enter the 6-digit code from your authenticator app to continue with Google sign-in.</p>
        </div>

        <div className="glass rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label htmlFor="totp-code" className="block text-sm font-mono text-zinc-400 mb-2">
                6-Digit Code
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onPaste={handlePaste}
                placeholder="000000"
                autoComplete="one-time-code"
                required
                disabled={verifying}
                className={`w-full text-center text-2xl font-mono tracking-[0.5em] rounded-xl border px-4 py-3 text-white outline-none transition ${
                  error
                    ? "border-red-500/50 bg-red-500/10 focus:border-red-400"
                    : "border-white/10 bg-white/[0.04] focus:border-violet-500/50"
                }`}
              />
              {error && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5" role="alert">
                  <AlertCircle className="h-4 w-4" /> {error}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Code refreshes in</span>
              <span className="font-mono tabular-nums text-cyan-400">{timeLeft}s</span>
            </div>

            <button
              type="submit"
              disabled={verifying || !code || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              {!verifying && <CheckCircle2 className="h-4 w-4" />}
              {verifying ? "Verifying…" : "Continue with Google"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <details className="group">
              <summary className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer hover:text-zinc-300">
                <HelpCircle className="h-4 w-4" /> How to get the code
              </summary>
              <div className="mt-3 space-y-2 text-sm text-zinc-400">
                <p>1. Open <strong>Google Authenticator</strong> (or Authy, 1Password, etc.)</p>
                <p>2. Find the entry for <strong>"Ahmad Portfolio Admin"</strong></p>
                <p>3. Enter the current <strong>6-digit code</strong> above</p>
                <p className="text-zinc-600">Codes refresh every 30 seconds.</p>
              </div>
            </details>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Only authorized admins can access Google sign-in.{" "}
          <Link href="/#contact" className="underline decoration-white/20 hover:text-cyan-300">Contact support</Link> if you need help.
        </p>
      </motion.div>
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="min-h-screen bg-ink flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
    </main>
  );
}

export default function TotpGatePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <TotpGateContent />
    </Suspense>
  );
}