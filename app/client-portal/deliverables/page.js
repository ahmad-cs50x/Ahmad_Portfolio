import { getSession, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/db";
import { formatInTimeZone } from "@/lib/timezone";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import Link from "next/link";

export const metadata = { title: "Deliverables — Client Portal" };

const buttons = [
  ["Live Demo", "live_demo_url"],
  ["Video Explanation", "video_explanation_url"],
  ["Source Code (ZIP)", "source_zip_url"],
  ["GitHub Repository", "github_url"],
  ["Documentation", "documentation_url"],
];

export default async function DeliverablesPage() {
  const session = await getSession();
  const scope = await resolveClientScope(session, null);
  const sb = getSupabaseAdmin();

  if (!sb || !scope.clientId) {
    return <p className="text-sm text-zinc-500">Deliverables appear once the database is connected.</p>;
  }

  const { data: projects } = await sb
    .from("projects")
    .select("id,title,status,live_demo_url,video_explanation_url,source_zip_url,github_url,documentation_url,drive_url,updated_at")
    .eq("client_id", scope.clientId)
    .in("status", ["completed", "review", "archived"])
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      {(projects ?? []).length === 0 && (
        <p className="rounded-2xl border border-white/10 p-10 text-center text-sm text-zinc-600">
          Deliverables will appear here when a project is completed.
        </p>
      )}
      {(projects ?? []).map((p) => (
        <section key={p.id} className="glass rounded-2xl p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-xl font-bold text-white">{p.title}</h3>
            <span className="text-xs text-zinc-600">Updated {formatInTimeZone(p.updated_at, session.user.timezone)}</span>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">Project Delivery</p>
            <div className="flex flex-wrap gap-3">
              {buttons
                .filter(([, field]) => p[field])
                .map(([label, field]) => (
                  <a
                    key={field}
                    href={p[field]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2.5 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
                  >
                    {label}
                  </a>
                ))}
              {p.drive_url && (
                <a href={p.drive_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-cyan-400/50">
                  Google Drive
                </a>
              )}
              {!buttons.some(([, f]) => p[f]) && !p.drive_url && (
                <Link href={`/client-portal/projects/${p.id}`} className="text-sm text-cyan-400 hover:text-cyan-300">
                  View project details
                </Link>
              )}
            </div>
          </div>

          {p.status === "completed" && (
            <p className="mt-4 inline-block rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-300">
              Completed
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
