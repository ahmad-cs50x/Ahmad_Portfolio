import { getSession } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/db";

export const metadata = { title: "Projects — Client Portal" };

const statusStyles = {
  planning: "bg-amber-500/15 text-amber-300",
  "in-progress": "bg-violet-500/15 text-violet-300",
  review: "bg-cyan-500/15 text-cyan-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  archived: "bg-zinc-500/15 text-zinc-400",
};

export default async function ProjectsPage() {
  const session = await getSession();
  const sb = getSupabaseAdmin();

  if (!sb || !session.user.clientId) {
    return <p className="text-sm text-zinc-500">Projects will appear once the database is connected.</p>;
  }

  const { data: projects } = await sb
    .from("projects")
    .select("*")
    .eq("client_id", session.user.clientId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {(projects ?? []).length === 0 && (
        <p className="col-span-full rounded-2xl border border-white/10 p-10 text-center text-sm text-zinc-600">
          No projects yet — they will appear here as work begins.
        </p>
      )}
      {(projects ?? []).map((p) => (
        <a
          key={p.id}
          href={`/client-portal/projects/${p.id}`}
          className="glass group flex flex-col rounded-2xl p-6 transition hover:border-violet-500/40"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-white">{p.title}</h3>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${statusStyles[p.status]}`}>
              {p.status.replace("-", " ")}
            </span>
          </div>
          {p.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-400">{p.description}</p>
          )}
          <div className="mt-auto pt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${p.progress}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">{p.progress}% complete</p>
          </div>
        </a>
      ))}
    </div>
  );
}
