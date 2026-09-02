"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";

const titles = {
  "/admin": "Dashboard",
  "/admin/clients": "Clients",
  "/admin/invites": "Invites",
  "/admin/projects": "Projects",
  "/admin/messages": "Messages",
  "/admin/files": "Files",
  "/admin/storage": "Storage",
  "/admin/blog": "Blog",
  "/admin/notifications": "Notifications",
  "/admin/setup-totp": "TOTP Setup",
  "/admin/settings": "Settings",
};

const nav = Object.entries(titles).map(([href, label]) => ({ href, label }));

export default function AdminHeader({ user }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title =
    [...Object.entries(titles)]
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => pathname.startsWith(path))?.[1] ?? "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/70 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((o) => !o)}
            className="glass grid h-9 w-9 place-items-center rounded-lg text-white md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="font-display text-lg font-bold text-white">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            Super Admin
          </span>
          <span className="hidden text-xs text-zinc-500 sm:block">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-red-500/40 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {open && (
        <nav className="space-y-1 border-t border-white/10 px-4 py-3 md:hidden">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-4 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
