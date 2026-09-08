"use client";

import { useSession } from "next-auth/react";

export default function AdminSettingsPage() {
  const { data: session } = useSession();

  const config = [
    ["Signed in as", session?.user?.email],
    ["Role", "SUPER_ADMIN"],
    ["Your timezone", session?.user?.timezone || "—"],
    ["Auth providers", "Google OAuth + Email magic link (Telegram)"],
    ["Database", "Supabase PostgreSQL"],
    ["File storage", "Telegram (private, bot-only)"],
    ["Contact form API", "Next.js API routes (built-in)"],
  ];

  return (
    <div className="glass mx-auto max-w-2xl rounded-2xl p-8">
      <h3 className="font-display text-lg font-bold text-white">Application configuration</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
        Values are managed through environment variables (.env.local). Restart the dev server after changes.
      </p>

      <dl className="mt-6 space-y-3">
        {config.map(([label, value]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-white/[0.03] px-4 py-3">
            <dt className="text-xs uppercase tracking-wider text-zinc-500">{label}</dt>
            <dd className="text-sm text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
