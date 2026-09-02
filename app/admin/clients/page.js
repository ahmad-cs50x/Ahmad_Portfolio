"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, Power, HardDrive } from "lucide-react";

const GB = 1024 ** 3;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
}

export default function ClientsPage() {
  const [clients, setClients] = useState(null);
  const [presets, setPresets] = useState([5, 20, 50, 100]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ companyName: "", contactEmail: "", storageLimitGb: 5 });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/clients");
    const json = await res.json();
    if (res.ok) {
      setClients(json.clients);
      if (json.quotaPresetsGb) setPresets(json.quotaPresetsGb);
    } else setError(json.message);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) return setError(json.message || "Failed");
    setForm({ companyName: "", contactEmail: "", storageLimitGb: 5 });
    load();
  }

  async function toggleActive(c) {
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !c.is_active }),
    });
    load();
  }

  async function setQuota(c, gb) {
    await fetch(`/api/clients/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gb === "none" ? { noPortalLimit: true } : { storageLimitGb: gb, noPortalLimit: false }),
    });
    load();
  }

  if (clients === null) {
    return <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* <section className="glass rounded-2xl p-6">
        <h3 className="mb-4 font-display text-lg font-bold text-white">Invite a client</h3>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            required
            placeholder="Company name"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
          />
          <input
            type="email"
            placeholder="Contact email (optional)"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
          />
          <select
            value={form.storageLimitGb}
            onChange={(e) => setForm({ ...form, storageLimitGb: Number(e.target.value) })}
            className="rounded-xl border border-white/10 bg-ink px-3 py-3 text-sm text-white outline-none focus:border-violet-500/50"
          >
            {presets.map((gb) => <option key={gb} value={gb}>{gb} GB</option>)}
          </select>
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create
          </button>
        </form>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Clients sign in at /login with Google or an emailed magic link — the first email that signs in is
          linked to this workspace automatically.
        </p>
      </section> */}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {clients.length === 0 && <p className="p-10 text-center text-sm text-zinc-600">No clients yet.</p>}
        {clients.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-white/5 px-5 py-4 last:border-0 hover:bg-white/[0.02]">
            <Link href={`/admin/clients/${c.id}`} className="min-w-40 flex-1">
              <span className="block truncate text-sm font-medium text-white hover:text-cyan-300">{c.company_name}</span>
              <span className="text-[11px] text-zinc-500">
                {c.contact_email || "no contact email"}
                {!c.is_active && <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">disabled</span>}
              </span>
            </Link>

            <span className="text-xs text-zinc-500">
              {formatBytes(Number(c.storage_used || c.storage_used_bytes || 0))} / {c.no_portal_limit ? "∞" : `${c.storage_limit_gb} GB`}
            </span>

            <select
              value={c.no_portal_limit ? "none" : String(c.storage_limit_gb)}
              onChange={(e) => setQuota(c, e.target.value === "none" ? "none" : Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-ink px-2.5 py-2 text-xs text-white outline-none"
            >
              {[...new Set([...presets, c.storage_limit_gb])].map((gb) => (
                <option key={gb} value={gb}>{gb} GB</option>
              ))}
              <option value="none">No Portal Limit</option>
            </select>

            <button
              type="button"
              onClick={() => toggleActive(c)}
              title={c.is_active ? "Disable client" : "Enable client"}
              className={`grid h-9 w-9 place-items-center rounded-lg border ${
                c.is_active
                  ? "border-emerald-500/30 text-emerald-300"
                  : "border-white/10 text-zinc-600"
              }`}
            >
              <Power className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}