"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MailCheck, ArrowLeft } from "lucide-react";

export default function VerifyRequestPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.12),transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="glass relative z-10 w-full max-w-md rounded-3xl p-10 text-center"
      >
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
          <MailCheck className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-white">
          Check your email<span className="text-gradient">.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          We sent you a secure sign-in link. Click it to continue — it expires in 24 hours.
        </p>
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-500">
          Didn&apos;t receive it? Check your Telegram chat, or make sure the Telegram
          bot is configured in the project environment.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to portfolio
        </Link>
      </motion.div>
    </main>
  );
}
