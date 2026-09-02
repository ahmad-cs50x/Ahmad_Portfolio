"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  QrCode,
  Copy,
  Check,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/components/Toast";

function generateSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export default function TotpSetupPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    try {
      const res = await fetch("/api/admin/totp-setup-status");
      const json = await res.json();
      if (json.success) {
        if (json.done && json.secret) {
          setSecret(json.secret);
          setDone(true);
        } else if (json.secret) {
          setSecret(json.secret);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  }

  async function generateQR() {
    setGenerating(true);
    const newSecret = generateSecret();
    setSecret(newSecret);
    const otpauth = `otpauth://totp/Ahmad%20Portfolio%20Admin?secret=${newSecret}&issuer=Ahmad%20Portfolio`;
    try {
      const res = await fetch("/api/admin/generate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpauth }),
      });
      const json = await res.json();
      if (json.success) setQrDataUrl(json.qrDataUrl);
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function deleteSecret() {
    if (
      !confirm(
        "Delete current secret and generate a new one? This will invalidate the current QR code.",
      )
    )
      return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/totp-setup-status", {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        const newSecret = generateSecret();
        setSecret(newSecret);
        const otpauth = `otpauth://totp/Ahmad%20Portfolio%20Admin?secret=${newSecret}&issuer=Ahmad%20Portfolio`;
        const qrRes = await fetch("/api/admin/generate-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otpauth }),
        });
        const qrJson = await qrRes.json();
        if (qrJson.success) setQrDataUrl(qrJson.qrDataUrl);
        toast.success("Secret reset", { detail: "New secret generated" });
      } else {
        toast.error("Failed to reset", { detail: json.message });
      }
    } catch (e) {
      toast.error("Error", { detail: "Failed to reset secret" });
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (secret) {
      const otpauth = `otpauth://totp/Ahmad%20Portfolio%20Admin?secret=${secret}&issuer=Ahmad%20Portfolio`;
      import("qrcode").then(({ default: QRCode }) =>
        QRCode.toDataURL(otpauth, { width: 256, margin: 2 })
          .then(setQrDataUrl)
          .catch(console.error),
      );
    }
  }, [secret]);

  async function handleVerify() {
    if (!verifyCode || verifyCode.length !== 6 || !/^\d{6}$/.test(verifyCode)) {
      setVerifyError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/admin/verify-totp-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode, secret }),
      });
      const json = await res.json();
      if (!res.ok) {
        setVerifyError(json.message || "Invalid code");
        toast.error("Verification failed", {
          detail: json.message || "Invalid TOTP code",
        });
        setVerifying(false);
        return;
      }
      toast.success("Verified!", { detail: "TOTP gate enabled" });
      setDone(true);
    } catch (e) {
      setVerifyError("Network error");
      toast.error("Error", { detail: "Network error" });
    } finally {
      setVerifying(false);
    }
  }

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied("secret");
      setTimeout(() => setCopied(""), 1500);
      toast.success("Copied!", { detail: "Secret copied to clipboard" });
    } catch {
      toast.error("Failed to copy");
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex h-[300px] absolute top-0 left-0 right-0">
        <main className="flex-1 min-h-screen flex items-center justify-center px-4">
          <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
            <svg
              className="mx-auto h-16 w-16 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              Already Configured
            </h1>
            <p className="mt-2 text-zinc-400">
              TOTP is already set up.{" "}
              <a href="/admin" className="underline text-cyan-400">
                Go to dashboard
              </a>
              .
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex absolute top-0 left-0 right-0 min-h-screen w-full">
      <main className="w-full mt-16 left-0 min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            <div className="glass rounded-2xl p-6 md:p-8">
              <div className="mb-8">
                <h2 className="font-display text-2xl font-bold text-white">
                  TOTP Setup
                </h2>
                <p className="mt-2 text-zinc-400">
                  Scan the QR code with Google Authenticator. Regenerate if
                  needed.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="bg-white/5 rounded-xl p-4 inline-block">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="TOTP QR Code"
                          className="mx-auto"
                        />
                      ) : (
                        <div className="w-64 h-64 flex items-center justify-center text-zinc-600">
                          <QrCode className="h-16 w-16" />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={generateQR}
                      disabled={generating}
                      className="absolute bottom-2 right-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-400 hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 text-center">
                    Click refresh to generate a new secret
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <label className="block text-sm font-mono text-zinc-400">
                    Manual Entry Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={secret}
                      className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-mono text-white outline-none"
                    />
                    <button
                      onClick={copySecret}
                      className="px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                    >
                      {copied === "secret" ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="w-full space-y-2 text-sm text-zinc-400">
                  <p>
                    1. Open <strong>Google Authenticator</strong> → tap{" "}
                    <strong>+</strong> → <strong>Scan QR code</strong>
                  </p>
                  <p>2. Or enter the key above manually</p>
                  <p>
                    3. Name it <strong>"Ahmad Portfolio Admin"</strong>
                  </p>
                  <p className="text-zinc-600">
                    4. Add{" "}
                    <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs">
                      TOTP_SECRET={secret}
                    </code>{" "}
                    to{" "}
                    <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs">
                      .env.local
                    </code>{" "}
                    and restart
                  </p>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <p className="font-medium text-white mb-4">Verify Setup</p>
                  <p className="text-sm text-zinc-400 mb-4">
                    Enter the 6-digit code from your authenticator app to
                    confirm the secret works.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => {
                        setVerifyCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        );
                        setVerifyError("");
                      }}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      className="flex-1 w-[60%] text-center text-2xl font-mono tracking-[0.5em] rounded-xl border px-4 py-2 text-white outline-none transition"
                    />
                    <button
                      onClick={handleVerify}
                      disabled={
                        verifying || !verifyCode || verifyCode.length !== 6
                      }
                      className="px-4 py-2 items-center justify-center w-[20%] flex flex-row rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {verifying ? (
                        <Loader2 className="h-4 w-4 mt-0.5 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 mr-2 " />
                      )}
                      {verifying ? "Verifying…" : "Enable"}
                    </button>
                  </div>
                  {verifyError && (
                    <p
                      className="mt-2 text-sm text-red-400 flex items-center gap-1.5"
                      role="alert"
                    >
                      <AlertCircle className="h-4 w-4" /> {verifyError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-zinc-600">
              Keep the secret safe! This page disappears after successful
              verification.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
