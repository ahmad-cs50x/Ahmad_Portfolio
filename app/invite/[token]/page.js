"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Lock, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "@/components/Toast";

const STUDIO_TZ = "Asia/Karachi";
const STUDIO_LABEL = "Karachi";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-ink">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </main>
      }
    >
      <InviteAcceptScreen />
    </Suspense>
  );
}

function InviteAcceptScreen() {
  const [step, setStep] = useState("verify"); // verify | set-password | success
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteData, setInviteData] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const reduceMotion = useReducedMotion();
  const token = params.token || searchParams.get("token");
  const autoLogin = searchParams.get("autologin") === "1";

  useEffect(() => {
    if (token) {
      verifyInvite(token);
    }
  }, [token]);

  async function verifyInvite(token) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/invites/verify?token=${token}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid or expired invitation");
      setInviteData(data.invite);
      setEmail(data.invite.email);

      if (autoLogin && data.invite.password) {
        await autoAcceptAndSignIn(token, data.invite.email, data.invite.password, data.invite.alreadyAccepted);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function autoAcceptAndSignIn(tokenVal, emailVal, passwordVal, alreadyAccepted) {
    try {
      if (!alreadyAccepted) {
        const acceptRes = await fetch("/api/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenVal, password: passwordVal }),
        });
        const acceptData = await acceptRes.json();
        if (!acceptRes.ok && acceptRes.status !== 409) {
          throw new Error(acceptData.message || "Failed to create account");
        }
      }

      const result = await signIn("email-password", {
        email: emailVal,
        password: passwordVal,
        callbackUrl: "/client-portal",
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/client-portal");
        router.refresh();
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    setError("");
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to set password");
      setStep("success");
      toast.success("Account created!", {
        detail: "You can now sign in with your email and password.",
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    setBusy(true);
    setError("");
    try {
      const result = await signIn("email-password", {
        email,
        password,
        callbackUrl: "/client-portal",
        redirect: false,
      });
      if (result?.error) {
        setError(result.error);
        toast.error("Sign in failed", { detail: result.error });
      } else {
        toast.success("Welcome back!");
        router.push("/client-portal");
        router.refresh();
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
      toast.error("Sign in failed", { detail: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const enter = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
      };

  if (step === "verify" && busy) {
    return (
      <main className="relative min-h-screen bg-ink lg:grid lg:grid-cols-[1fr_minmax(460px,38%)]">
        <section className="relative hidden overflow-hidden p-14 xl:p-20 lg:flex lg:flex-col lg:justify-between">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.55]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(124,58,237,0.18),transparent_58%),radial-gradient(ellipse_at_85%_85%,rgba(6,182,212,0.12),transparent_55%)]" />
          <span aria-hidden="true" className="text-outline pointer-events-none absolute -bottom-6 -left-3 select-none font-display text-[15vw] font-bold leading-none">
            PORTAL
          </span>
        </section>
        <section className="relative flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12 lg:border-l lg:border-white/[0.08] lg:bg-white/[0.015] lg:px-14">
          <motion.div {...enter} className="relative z-10 mx-auto w-full max-w-[400px] text-center">
            <Loader2 className="h-10 w-10 animate-spin text-violet-400 mx-auto" />
            <p className="mt-4 text-zinc-400">Verifying your invitation…</p>
          </motion.div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-ink lg:grid lg:grid-cols-[1fr_minmax(460px,38%)]">
      {/* ---------------- identity panel (desktop only) ---------------- */}
      <section className="relative hidden overflow-hidden p-14 xl:p-20 lg:flex lg:flex-col lg:justify-between">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.55]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(124,58,237,0.18),transparent_58%),radial-gradient(ellipse_at_85%_85%,rgba(6,182,212,0.12),transparent_55%)]" />
        <span
          aria-hidden="true"
          className="text-outline pointer-events-none absolute -bottom-6 -left-3 select-none font-display text-[15vw] font-bold leading-none"
        >
          PORTAL
        </span>

        <div className="relative z-10">
          <p className="font-display text-2xl font-bold tracking-tight text-white">
            Ahmad<span className="text-gradient-animated">.</span>
          </p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-zinc-600">
            Client Portal
          </p>
        </div>

        <p className="relative z-10 max-w-md font-display text-3xl font-bold leading-tight tracking-tight text-zinc-300 xl:text-4xl">
          {step === "verify" ? "Verify your invitation" : step === "set-password" ? "Create your password" : "You're all set!"}
        </p>

        <div className="relative z-10 space-y-7">
          {inviteData && (
            <div className="glass rounded-2xl p-4 border border-emerald-500/30 bg-emerald-500/10">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">Invitation verified</p>
              <p className="mt-1 text-sm text-zinc-300">Welcome, <span className="font-medium">{inviteData.company_name || inviteData.email}</span></p>
              <p className="mt-1 text-xs text-zinc-500">Role: {inviteData.role === "SUPER_ADMIN" ? "Admin" : "Client"}</p>
            </div>
          )}
        </div>
      </section>

      {/* ---------------- form panel ---------------- */}
      <section className="relative flex min-h-screen flex-col justify-center px-6 py-14 sm:px-12 lg:border-l lg:border-white/[0.08] lg:bg-white/[0.015] lg:px-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.1),transparent_60%)] lg:hidden" />

        <motion.div {...enter} className="relative z-10 mx-auto w-full max-w-[400px]">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 rounded text-[11px] uppercase tracking-[0.25em] text-zinc-500 transition-colors hover:text-zinc-300 ${FOCUS}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio
          </Link>

          <p className="mt-10 font-mono text-xs text-cyan-400">{"// client portal"}</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-white sm:text-5xl">
            {step === "verify" ? "Verify your invitation" : step === "set-password" ? "Set up your password" : "Account ready"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            {step === "verify"
              ? "Enter your email to verify the invitation and create your account."
              : step === "set-password"
              ? "Choose a strong password to secure your account."
              : "Your account has been created. You can now sign in."}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-8 flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-relaxed text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {step === "verify" && !busy && !inviteData && (
            <form onSubmit={async (e) => { e.preventDefault(); await verifyInvite(e.currentTarget.token.value); }} noValidate className="mt-9">
              <label
                htmlFor="invite-email"
                className="block font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500"
              >
                Email address
              </label>
              <input
                id="invite-email"
                name="token"
                type="hidden"
                value={token}
              />
              <input
                id="invite-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
              />
              <button
                type="submit"
                disabled={busy || !email}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-4 text-[15px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 ${FOCUS}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {busy ? "Verifying…" : "Verify & Continue"}
              </button>
            </form>
          )}

          {step === "set-password" && (
            <form onSubmit={handleSetPassword} noValidate className={!inviteData ? "mt-9" : "mt-6"}>
              <label
                htmlFor="invite-password"
                className="block font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500"
              >
                New password
              </label>
              <div className="mt-3 relative">
                <input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 pr-12 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              <label
                htmlFor="invite-confirm-password"
                className="block mt-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500"
              >
                Confirm password
              </label>
              <input
                id="invite-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
              />

              <button
                type="submit"
                disabled={busy || !password || !confirmPassword}
                className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-4 text-[15px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 ${FOCUS}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {busy ? "Creating account…" : "Create account"}
              </button>
              <p className="mt-4 text-xs leading-relaxed text-zinc-600">
                Your password will be securely stored. You'll use this to sign in going forward.
              </p>
            </form>
          )}

          {step === "success" && (
            <div className="mt-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <p className="mt-4 font-display text-lg font-bold text-white">Account created successfully</p>
              <p className="mt-2 text-sm text-zinc-400">You can now sign in with your email and password.</p>
              <button
                onClick={handleSignIn}
                disabled={busy}
                className={`mt-6 mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-4 text-[15px] font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 ${FOCUS}`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {busy ? "Signing in…" : "Sign in to Portal"}
              </button>
            </div>
          )}

          <p className="mt-12 border-t border-white/[0.08] pt-6 text-xs text-zinc-600">
            Trouble getting in?{" "}
            <Link
              href="/#contact"
              className={`inline-flex items-center gap-1 rounded text-zinc-400 underline decoration-white/20 underline-offset-4 transition-colors hover:text-cyan-300 ${FOCUS}`}
            >
              Send me a message
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
}