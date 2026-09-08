"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  MailPlus,
  RotateCcw,
  Ban,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
} from "lucide-react";
import { toast } from "@/components/Toast";

const ROLES = [
  { value: "CLIENT", label: "Client" },
  { value: "SUPER_ADMIN", label: "Admin" },
];

const STATUS_STYLES = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  accepted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  expired: "border-white/10 bg-white/5 text-zinc-500",
  revoked: "border-red-500/30 bg-red-500/10 text-red-300",
};

function statusOf(invite) {
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_at) return "accepted";
  if (new Date(invite.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function generatePassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const EMPTY_FORM = {
  email: "",
  password: "",
  role: "CLIENT",
  clientId: "",
  companyName: "",
  note: "",
};

export default function InvitesPage() {
  const [invites, setInvites] = useState(null);
  const [clients, setClients] = useState([]);
  const [mailConfigured, setMailConfigured] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/invites");
    const json = await res.json();
    if (!res.ok) {
      toast.error("Could not load invites", { detail: json.message });
      setInvites([]);
      return;
    }
    setInvites(json.invites ?? []);
    setMailConfigured(json.mailConfigured !== false);
    if (json.message)
      toast.error("Invite list problem", { detail: json.message });
  }, []);

  useEffect(() => {
    load();
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setClients(json?.clients ?? []))
      .catch(() => setClients([]));
  }, [load]);

  async function send(event, override) {
    event?.preventDefault();
    const payload = override ?? form;
    setSending(true);
    toast.loading(override ? "Resending invite…" : "Sending invite…", {
      id: "invite-send",
    });

    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { message: text || `Server error (${res.status})` };
      }

      setSending(false);

      if (!res.ok) {
        toast.error("Invite not sent", {
          id: "invite-send",
          detail: json.message || "Unknown error occurred",
        });
        if (res.status === 502) load();
        return;
      }

      toast.success(`Invite emailed to ${payload.email}`, {
        id: "invite-send",
        detail: "They can sign in with Google or an email link using that address.",
      });
      if (!override) setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setSending(false);
      toast.error("Invite not sent", {
        id: "invite-send",
        detail: err.message || "Network connection failed",
      });
    }
  }

  async function revoke(invite) {
    toast.loading("Revoking…", { id: `revoke-${invite.id}` });
    const res = await fetch(
      `/api/invites?id=${encodeURIComponent(invite.id)}`,
      {
        method: "DELETE",
      },
    );
    const json = await res.json();
    if (!res.ok) {
      toast.error("Could not revoke", {
        id: `revoke-${invite.id}`,
        detail: json.message,
      });
      return;
    }
    toast.success(`Invite for ${invite.email} revoked`, {
      id: `revoke-${invite.id}`,
    });
    load();
  }

  async function copyEmail(email) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(email);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      toast.error("Clipboard is blocked in this browser");
    }
  }

  if (invites === null) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!mailConfigured && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 text-sm leading-relaxed text-amber-200">
          Telegram isn&apos;t configured, so invite notifications cannot be sent. Set{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
            TG_BOT_TOKEN
          </code>{" "}
          and{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
            TG_CHAT_ID
          </code>{" "}
          in{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
            .env.local
          </code>
          , then restart the server.
        </div>
      )}

      <section className="glass rounded-2xl p-6">
        <h3 className="font-display text-lg font-bold text-white">
          Invite someone in
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Sign-in is invite-only. Until an address appears here, it is refused —
          with Google as well as with an email link.
        </p>

        <form onSubmit={send} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-row">
              <div className="sm:col-span-2 w-[59%]">
                <label
                  htmlFor="invite-email"
                  className="block text-xs uppercase tracking-wider text-zinc-500"
                >
                  Email address
                </label>
                <input
                  id="invite-email"
                  required
                  type="email"
                  autoComplete="off"
                  placeholder="them@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
                />
              </div>
              <div className="w-[40%] ml-[1%] ">
                <label
                  htmlFor="invite-role"
                  className="block text-xs uppercase tracking-wider text-zinc-500"
                >
                  Role
                </label>
                <select
                  id="invite-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-4 py-3.5 text-sm text-white outline-none focus:border-violet-500/50"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="invite-password"
                className="block text-xs uppercase tracking-wider text-zinc-500"
              >
                Password{" "}
                <span className="text-zinc-600 ml-1">
                  (for email/password sign-in)
                </span>
              </label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative w-[59%]">
                  <input
                    id="invite-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Auto-generated or enter manually"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 "
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    aria-label={
                      showPassword ? "Show password" : "Hide password"
                    }
                  >
                    {showPassword ? (
                      <Eye className="h-5 w-5" />
                    ) : (
                      <EyeOff className="h-5 w-5" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, password: generatePassword() })
                  }
                  className="px-4 w-[40%] py-3 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  title="Generate secure password"
                >
                  <RefreshCw className="h-4 w-4" /> Generate
                </button>
              </div>
            </div>
          </div>

          {form.role === "CLIENT" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="invite-client"
                  className="block text-xs uppercase tracking-wider text-zinc-500"
                >
                  Existing workspace
                </label>
                <select
                  id="invite-client"
                  value={form.clientId}
                  onChange={(e) =>
                    setForm({ ...form, clientId: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-4 py-3.5 text-sm text-white outline-none focus:border-violet-500/50"
                >
                  <option value="">Create a new one</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="invite-company"
                  className="block text-xs uppercase tracking-wider text-zinc-500"
                >
                  New workspace name
                </label>
                <input
                  id="invite-company"
                  placeholder="Acme Ltd"
                  disabled={Boolean(form.clientId)}
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 disabled:opacity-40"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="invite-note"
              className="block text-xs uppercase tracking-wider text-zinc-500"
            >
              Note in the email (optional)
            </label>
            <textarea
              id="invite-note"
              rows={2}
              placeholder="Hi Sara — here's access to the portal for the rebuild."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="btn-primary px-6 py-3 text-sm disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MailPlus className="h-4 w-4" />
            )}
            <span className="relative z-10">Send invite</span>
          </button>
        </form>
      </section>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {invites.length === 0 ? (
          <p className="p-10 text-center text-sm text-zinc-600">
            No invites yet. The addresses in{" "}
            <code className="font-mono text-xs text-zinc-500">
              SUPER_ADMIN_EMAILS
            </code>{" "}
            can always sign in without one.
          </p>
        ) : (
          invites.map((invite) => {
            const status = statusOf(invite);
            const showPassword = status === "pending" && invite.password;
            return (
              <div
                key={invite.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-white/5 px-5 py-4 last:border-0 hover:bg-white/[0.02]"
              >
                <div className="min-w-48 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {invite.email}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {invite.role === "SUPER_ADMIN"
                      ? "Admin"
                      : invite.company_name || "New workspace"}
                    {" · "}
                    {status === "accepted"
                      ? `joined ${formatDate(invite.accepted_at)}`
                      : `expires ${formatDate(invite.expires_at)}`}
                    {invite.send_count > 1 && ` · sent ${invite.send_count}×`}
                  </span>
                  {showPassword && (
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <Key className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="font-mono text-zinc-400 bg-black/30 px-2 py-0.5 rounded">
                        {invite.password}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(invite.password)
                        }
                        className="text-zinc-500 hover:text-cyan-400"
                        title="Copy password"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLES[status]}`}
                >
                  {status}
                </span>

                <button
                  type="button"
                  onClick={() => copyEmail(invite.email)}
                  title="Copy email address"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
                >
                  {copied === invite.email ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>

                {status !== "accepted" && (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() =>
                      send(null, {
                        email: invite.email,
                        role: invite.role,
                        companyName: invite.company_name,
                        note: invite.note,
                      })
                    }
                    title="Send a fresh link (the old one stops working)"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-violet-400/50 hover:text-violet-200 disabled:opacity-40"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}

                {status === "pending" && (
                  <button
                    type="button"
                    onClick={() => revoke(invite)}
                    title="Revoke this invite"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-300"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}