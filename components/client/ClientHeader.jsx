"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

const titles = {
  "/client-portal": "Dashboard",
  "/client-portal/messages": "Messages",
  "/client-portal/projects": "Projects",
  "/client-portal/files": "Shared Files",
  "/client-portal/deliverables": "Deliverables",
  "/client-portal/activity": "Recent Activity",
  "/client-portal/settings": "Settings",
};

export default function ClientHeader({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title =
    Object.entries(titles)
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
          {[
            ["Dashboard", "/client-portal"],
            ["Messages", "/client-portal/messages"],
            ["Projects", "/client-portal/projects"],
            ["Files", "/client-portal/files"],
            ["Deliverables", "/client-portal/deliverables"],
            ["Activity", "/client-portal/activity"],
            ["Settings", "/client-portal/settings"],
          ].map(([label, href]) => (
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
