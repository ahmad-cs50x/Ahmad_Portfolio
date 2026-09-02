"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FolderKanban, MessagesSquare, Files,
  HardDrive, Newspaper, Bell, Settings, MailPlus, ShieldCheck,
} from "lucide-react";

const items = [
  { label: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { label: "Clients", href: "/admin/clients", Icon: Users },
  { label: "Invites", href: "/admin/invites", Icon: MailPlus },
  { label: "Projects", href: "/admin/projects", Icon: FolderKanban },
  { label: "Messages", href: "/admin/messages", Icon: MessagesSquare },
  { label: "Files", href: "/admin/files", Icon: Files },
  { label: "Blog", href: "/admin/blog", Icon: Newspaper },
  { label: "Notifications", href: "/admin/notifications", Icon: Bell },
  { label: "TOTP Setup", href: "/admin/setup-totp", Icon: ShieldCheck },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-full w-64 shrink-0 flex-col border-r border-white/10 bg-ink/60 backdrop-blur-xl md:flex">
      <div className="border-b border-white/10 px-6 py-6">
        <Link href="/" className="font-display text-xl font-bold text-white">
          Ahmad<span className="text-gradient">.</span>
        </Link>
        <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-zinc-600">Admin Console</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map(({ label, href, Icon }) => {
          const active = pathname === href || (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                active
                  ? "bg-gradient-to-r from-violet-600/25 to-cyan-500/15 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
