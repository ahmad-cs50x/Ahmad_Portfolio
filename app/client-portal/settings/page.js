"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { COMMON_TIMEZONES, browserTimezone } from "@/lib/timezone";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session?.user) {
      setFullName(session.user.name || "");
      setTimezone(session.user.timezone || browserTimezone());
    }
  }, [session]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, timezone }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || "Failed to save");
        setSaving(false);
        return;
      }
      // Force NextAuth to re-fetch the session from the DB
      await update();
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="glass mx-auto max-w-xl space-y-6 rounded-2xl p-8">
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-zinc-300">Full name</label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
        />
      </div>

      <div>
        <label htmlFor="tz" className="block text-sm font-medium text-zinc-300">
          Timezone
          <span className="ml-2 text-xs font-normal text-zinc-600">All timestamps are shown in this zone</span>
        </label>
        <select
          id="tz"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
        >
          {COMMON_TIMEZONES.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        {session?.user?.timezone && session.user.timezone !== timezone && (
          <button
            type="button"
            onClick={() => setTimezone(session.user.timezone)}
            className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            Reset to saved ({session.user.timezone})
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
        {error && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-zinc-600">
        When you and the other party use the same timezone, messages show one timestamp.
        With different timezones, both are shown side by side.
      </p>
    </form>
  );
}
