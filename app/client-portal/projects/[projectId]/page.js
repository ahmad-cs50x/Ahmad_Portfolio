import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin } from "@/lib/db";
import { formatInTimeZone } from "@/lib/timezone";
import { formatFileSize } from "@/lib/utils/formatFileSize";
import { Globe, Video, FileArchive, Github, BookOpen, HardDrive, CheckCircle2, Circle } from "lucide-react";

export default async function ProjectDetailPage({ params }) {
  const session = await getSession();
  const scope = await resolveClientScope(session, null);
  const sb = getSupabaseAdmin();
  if (!sb || !scope.clientId) notFound();

  const [{ data: project }, { data: milestones }, { data: files }] = await Promise.all([
    sb.from("projects").select("*").eq("id", params.projectId).eq("client_id", scope.clientId).maybeSingle(),
    sb.from("milestones").select("*").eq("project_id", params.projectId).order("position"),
    sb.from("files").select("id,file_name,file_size,file_type,created_at").eq("project_id", params.projectId).eq("archived", false).order("created_at", { ascending: false }),
  ]);

  if (!project) notFound();

  const delivery = [
    { label: "Open Live Website", url: project.live_demo_url, Icon: Globe },
    { label: "Watch Video Explanation", url: project.video_explanation_url, Icon: Video },
    { label: "Download Source Code", url: project.source_zip_url, Icon: FileArchive },
    { label: "Open GitHub Repository", url: project.github_url, Icon: Github },
    { label: "View Documentation", url: project.documentation_url, Icon: BookOpen },
  ].filter((d) => d.url);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/client-portal/projects" className="inline-block text-xs uppercase tracking-[0.25em] text-zinc-500 hover:text-zinc-300">
        All projects
      </Link>

      <header className="glass rounded-2xl p-8">
        <h2 className="font-display text-3xl font-bold text-white">{project.title}</h2>
        {project.description && <p className="mt-3 max-w-2xl leading-relaxed text-zinc-400">{project.description}</p>}
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${project.progress}%` }} />
        </div>
        <p className="mt-2 text-xs capitalize text-zinc-500">{project.status.replace("-", " ")} · {project.progress}%</p>
      </header>

      {milestones?.length > 0 && (
        <section className="glass rounded-2xl p-8">
          <h3 className="mb-5 font-display text-lg font-bold text-white">Milestones</h3>
          <ul className="space-y-3.5">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                {m.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <Circle className="h-5 w-5 shrink-0 text-zinc-600" />}
                <span className={`text-sm ${m.done ? "text-zinc-400 line-through" : "text-white"}`}>{m.title}</span>
                {m.due_date && <span className="ml-auto text-xs text-zinc-600">{m.due_date}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(delivery.length > 0 || project.drive_url) && (
        <section className="glass rounded-2xl p-8">
          <h3 className="mb-1 font-display text-lg font-bold text-white">Project Delivery</h3>
          <p className="mb-5 text-xs uppercase tracking-wider text-zinc-600">Everything you need in one place</p>
          <div className="flex flex-wrap gap-3">
            {delivery.map(({ label, url, Icon }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
              >
                <Icon className="h-4 w-4" /> {label}
              </a>
            ))}
            {project.drive_url && (
              <a
                href={project.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/50"
              >
                <HardDrive className="h-4 w-4 text-cyan-300" /> Google Drive Folder
              </a>
            )}
          </div>
        </section>
      )}

      <section className="glass rounded-2xl p-8">
        <h3 className="mb-4 font-display text-lg font-bold text-white">Project files</h3>
        {(files ?? []).length === 0 && <p className="text-sm text-zinc-600">No files attached yet.</p>}
        <ul className="space-y-2">
          {(files ?? []).map((f) => (
            <li key={f.id}>
              <a href={`/api/files/${f.id}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <span className="truncate text-sm text-white">{f.file_name}</span>
                <span className="shrink-0 pl-4 text-[11px] text-zinc-500">{formatFileSize(f.file_size)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
