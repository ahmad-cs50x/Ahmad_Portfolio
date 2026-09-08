"use client";
import { Suspense, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, AlertCircle, ArrowUpRight, CheckCircle2, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/Toast";


const STUDIO_TZ = "Asia/Karachi";
const STUDIO_LABEL = "Karachi";
const INSIDE = ["Projects", "Messages", "Files", "Deliverables"];


const ERROR_MESSAGES = {
  // adapter.createUser / linkAccount threw — i.e. the DB write failed.
  OAuthCreateAccount:
    "Signed in with Google, but your account could not be saved to the database. The Auth.js tables are probably missing — run `npm run db:migrate`, then try again.",
  EmailCreateAccount:
    "Your email link was valid, but the account could not be saved to the database. The Auth.js tables are probably missing — run `npm run db:migrate`, then try again.",
  // createSession / getSessionAndUser threw, or the session callback errored.
  Callback:
    "Sign-in completed but the session could not be stored. Run `npm run auth:check` to see which database step is failing.",
  OAuthAccountNotLinked:
    "That email already exists using a different sign-in method. Use the method you signed up with.",
  OAuthSignin:
    "Could not start Google sign-in. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  OAuthCallback:
    "Google rejected the sign-in. Make sure the redirect URI in Google Cloud Console is exactly <origin>/api/auth/callback/google.",
  EmailSignin:
    "Could not send the sign-in link. Check TG_BOT_TOKEN / TG_CHAT_ID.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "Access denied. This account is not allowed to sign in.",
  Configuration:
    "Server auth configuration error. Check AUTH_SECRET and NEXTAUTH_URL, then restart the server.",
  SessionRequired: "Please sign in to continue.",
};

const DEFAULT_ERROR = "Something went wrong during sign-in. Please try again.";

/* ------------------------------------------------------------------ */
/* Time helpers — the signature element of this page                    */
/* ------------------------------------------------------------------ */

/** Wall-clock time in a given zone, 24h. */
function timeIn(date, timeZone) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/**
 * Minutes that `timeZone` sits ahead of UTC at `date`.
 * Formats the instant in the zone, reads it back as if it were UTC, and
 * diffs — the standard trick for getting a zone offset without a date lib.
 */
function offsetMinutes(date, timeZone) {
  const parts = {};
  for (const part of new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  // en-US hour12:false renders midnight as "24" in some engines.
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** "8h behind Karachi", "4h 30m ahead of Karachi", or null when identical. */
function relationToStudio(date, visitorTz) {
  const diff = offsetMinutes(date, visitorTz) - offsetMinutes(date, STUDIO_TZ);
  if (diff === 0) return null;
  const hours = Math.floor(Math.abs(diff) / 60);
  const minutes = Math.abs(diff) % 60;
  const span = [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null]
    .filter(Boolean)
    .join(" ");
  return `${span} ${diff > 0 ? "ahead of" : "behind"} ${STUDIO_LABEL}`;
}

/**
 * Ticks once a minute. Starts null and fills in after mount — rendering a
 * clock during SSR would guarantee a hydration mismatch.
 */
function useWallClock() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return now;
}

function TimezoneStrip() {
  const now = useWallClock();
  const [visitorTz, setVisitorTz] = useState(null);

  useEffect(() => {
    try {
      setVisitorTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setVisitorTz(null);
    }
  }, []);

  const sameZone = visitorTz === STUDIO_TZ;
  const relation = now && visitorTz && !sameZone ? relationToStudio(now, visitorTz) : null;

  return (
    <div className="border-t border-white/[0.08] pt-6">
      <div className="flex items-start gap-12">
        <Clock
          label={STUDIO_LABEL}
          time={now ? timeIn(now, STUDIO_TZ) : null}
          sub="Where the work happens"
        />
        {visitorTz && !sameZone && (
          <Clock
            label="Your time"
            time={now ? timeIn(now, visitorTz) : null}
            sub={relation ?? visitorTz.replace(/_/g, " ")}
          />
        )}
      </div>
    </div>
  );
}

function Clock({ label, time, sub }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">{label}</p>
      <p className="mt-1.5 font-display text-3xl font-bold tabular-nums tracking-tight text-zinc-200">
        {time ?? <span className="text-zinc-700">--:--</span>}
      </p>
      <p className="mt-1 text-[11px] text-zinc-600">{sub}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-ink">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </main>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const [providers, setProviders] = useState(undefined); // undefined = still loading
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credBusy, setCredBusy] = useState(false);
  const [credError, setCredError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const callbackUrl = searchParams.get("callbackUrl") || "/client-portal";

  // Sign-in failures arrive here as ?error=<code> and nowhere else.
  const errorCode = searchParams.get("error");
  const authError = errorCode ? (ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR) : "";

  useEffect(() => {
    let active = true;
    // NOTE: next-auth's getProviders() resolves to null when no providers
    // are configured — normalize to an empty object so the UI can react.
    Promise.resolve(getProviders())
      .catch(() => null)
      .then((p) => {
        if (active) setProviders(p ?? {});
      });
    return () => {
      active = false;
    };
  }, []);

  // --- NEW: Auto-Login Effect ---
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const autoEmail = hashParams.get("autoEmail");
      const autoPassword = hashParams.get("autoPassword");

      if (autoEmail && autoPassword) {
        setCredEmail(autoEmail);
        setCredPassword(autoPassword);
        // Remove the credentials from the URL so it looks clean and secure
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        
        // Trigger sign-in automatically
        handleCredentialsSubmit(null, autoEmail, autoPassword);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await signIn("email", { email, callbackUrl });
      toast.success("Sign-in link sent!", {
        detail: "Check your email for the magic link. It expires in 24 hours.",
      });
    } catch {
      setError("Could not send the sign-in link. Please try again.");
      toast.error("Failed to send sign-in link", {
        detail: "Please check your Telegram bot configuration and try again.",
      });
      setBusy(false);
    }
  }

  // Adjusted to accept direct parameters for the auto-login
  async function handleCredentialsSubmit(e, autoEmailParam, autoPasswordParam) {
    if (e) e.preventDefault();

    const emailToSubmit = autoEmailParam || credEmail;
    const passwordToSubmit = autoPasswordParam || credPassword;

    setCredError("");
    if (!emailToSubmit || !passwordToSubmit) {
      setCredError("Please enter both email and password.");
      return;
    }

    setCredBusy(true);
    try {
      // Use redirect: true (default) so NextAuth handles the navigation
      // and sets the session cookie properly. Errors will be shown via
      // the ?error= query parameter which the page already handles.
      // Pass welcome=true so the portal shows a success toast after redirect.
      await signIn("email-password", {
        email: emailToSubmit,
        password: passwordToSubmit,
        callbackUrl: `${callbackUrl}?welcome=true`,
      });
    } catch {
      // Catch network errors only; auth errors are handled by the redirect
      setCredError("Unable to connect. Please try again.");
      toast.error("Sign in failed", { detail: "Check your network connection." });
    } finally {
      setCredBusy(false);
    }
  }

  const hasGoogle = Boolean(providers?.google);
  const hasEmail = Boolean(providers?.email);

  const enter = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
      };

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
          One place for everything
          <br />
          we&apos;re building together.
        </p>

        <div className="relative z-10 space-y-7">
          <TimezoneStrip />
          <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-600">
            {INSIDE.map((label, i) => (
              <span key={label} className="flex items-center gap-4">
                {i > 0 && <span aria-hidden="true" className="h-3 w-px bg-white/10" />}
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- form panel ---------------- */}
      <section className="relative flex min-h-screen flex-col justify-center px-6 pt-4 sm:px-12 lg:px-14 lg:border-l lg:border-white/[0.08] lg:bg-white/[0.015] ">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.1),transparent_60%)] lg:hidden" />

         <Link  href="/" className={`inline-flex items-center mt-2 mb-8 gap-1.5 rounded text-[11px] uppercase tracking-[0.25em] text-zinc-500 transition-colors hover:text-zinc-300 ${FOCUS}`}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio
          </Link>

        <motion.div {...enter} className="relative z-10 mx-auto w-full max-w-[400px]">
          <p className="font-mono text-xs text-cyan-400">{"// client portal"}</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight text-white sm:text-5xl">
            Sign in to your
            <br />
            workspace<span className="text-gradient-animated">.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Track project progress, trade files, and message me directly — without digging
            through an email thread.
          </p>

          {authError && (
            <div
              role="alert"
              className="mt-8 flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-relaxed text-red-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {authError}
                <span className="mt-1 block font-mono text-[11px] text-red-300/60">
                  code: {errorCode}
                </span>
              </span>
            </div>
          )}

          {!providers ? (
            <div className="mt-10 flex items-center gap-3 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sign-in options…
            </div>
          ) : !hasGoogle && !hasEmail ? (
            <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-200">
              Authentication isn&apos;t configured yet. Add your credentials to{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
                .env.local
              </code>{" "}
              (Google OAuth and/or Telegram) and restart the server.
            </div>
          ) : (
            <>
              {hasGoogle && (
                <Link
                  href={`/auth/totp-gate?provider=google&callbackUrl=${encodeURIComponent(callbackUrl)}`}
                  className={`mt-9 flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-[15px] font-semibold text-zinc-900 transition hover:bg-zinc-200 ${FOCUS}`}
                >
                  <GoogleIcon />
                  Continue with Google
                </Link>
              )}

              {(hasGoogle || hasEmail) && (
                <div className="my-7 flex items-center gap-4">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600">
                    or
                  </span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              )}

              <div className="mt-6">
                <form onSubmit={handleCredentialsSubmit} noValidate className="mt-4 space-y-4">
                  <label
                    htmlFor="cred-email"
                    className="block font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500"
                  >
                    Email
                  </label>
                  <input
                    id="cred-email"
                    type="email"
                    autoComplete="email"
                    value={credEmail}
                    onChange={(e) => setCredEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
                    required
                  />

                  <div className="relative">
                    <label
                      htmlFor="cred-password"
                      className="block font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500"
                    >
                      Password
                    </label>
                    <input
                      id="cred-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={credPassword}
                      onChange={(e) => setCredPassword(e.target.value)}
                      placeholder="Your password"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 pr-12 text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/25"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-9 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5 mt-6" /> : <Eye className="h-5 w-5 mt-6" />}
                    </button>
                  </div>

                  {credError && (
                    <p className="text-sm text-red-400" role="alert">{credError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={busy || credBusy}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-4 text-[15px] font-light text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 ${FOCUS}`}
                  >
                    {(credBusy || busy) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {(credBusy || busy) ? "Signing in…" : "Sign in with password"}
                  </button>
                </form>
              </div>
            </>
          )}

          <p className="mt-8 pt-5 border-t border-white/[0.08] text-xs text-zinc-600">
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