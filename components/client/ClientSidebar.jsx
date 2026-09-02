"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessagesSquare, FolderKanban, Files, PackageCheck, Activity, Settings } from "lucide-react";

const items = [
  { label: "Dashboard", href: "/client-portal", Icon: LayoutDashboard },
  { label: "Messages", href: "/client-portal/messages", Icon: MessagesSquare },
  { label: "Projects", href: "/client-portal/projects", Icon: FolderKanban },
  { label: "Files", href: "/client-portal/files", Icon: Files },
  { label: "Deliverables", href: "/client-portal/deliverables", Icon: PackageCheck },
  { label: "Activity", href: "/client-portal/activity", Icon: Activity },
  { label: "Settings", href: "/client-portal/settings", Icon: Settings },
];

export default function ClientSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-ink/60 backdrop-blur-xl md:flex">
      <div className="border-b border-white/10 px-6 py-6">
        <Link href="/" className="font-display text-xl font-bold text-white">
          Ahmad<span className="text-gradient">.</span>
        </Link>
        <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-zinc-600">Client Portal</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map(({ label, href, Icon }) => {
          const active = pathname === href || (href !== "/client-portal" && pathname.startsWith(href));
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
              <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
