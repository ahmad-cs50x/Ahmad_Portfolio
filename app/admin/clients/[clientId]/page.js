import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/db";
import { formatFileSize } from "@/lib/utils/formatFileSize";

export default async function AdminClientDetail({ params }) {
  const { clientId } = await params;
  const sb = getSupabaseAdmin();
  if (!sb) return <p className="text-sm text-zinc-500">Database not connected.</p>;

  const [{ data: client }, { data: profiles }, { data: projects }] = await Promise.all([
    sb.from("clients").select("*").eq("id", clientId).maybeSingle(),
    sb.from("profiles").select("id,email,full_name").eq("client_id", params.clientId),
    sb.from("projects").select("id,title,status,progress").eq("client_id", params.clientId).order("created_at", { ascending: false }),
  ]);

  if (!client) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/admin/clients" className="inline-block text-xs uppercase tracking-[0.25em] text-zinc-500 hover:text-zinc-300">
        All clients
      </Link>

      <header className="glass rounded-2xl p-8">
        <h2 className="font-display text-2xl font-bold text-white">{client.company_name}</h2>
        <p className="mt-1 text-sm text-zinc-500">{client.contact_email || "No contact email"}</p>
        <div className="mt-5 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Used</p>
            <p className="mt-1 font-display text-xl font-bold text-white">{formatFileSize(client.storage_used)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Quota</p>
            <p className="mt-1 font-display text-xl font-bold text-white">
              {client.no_portal_limit ? "No limit" : formatFileSize(client.storage_limit)}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-4">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Projects</p>
            <p className="mt-1 font-display text-xl font-bold text-white">{projects?.length ?? 0}</p>
          </div>
        </div>
      </header>

      <section className="glass rounded-2xl p-6">
        <h3 className="mb-4 font-display text-lg font-bold text-white">Portal users</h3>
        {(profiles ?? []).length === 0 && (
          <p className="text-sm text-zinc-600">
            No one has signed in yet. Users appear here after their first login with this client&apos;s email.
          </p>
        )}
        <ul className="space-y-2">
          {(profiles ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 text-sm">
              <span className="text-white">{p.full_name || p.email}</span>
              <span className="text-xs text-zinc-500">{p.email}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">Projects</h3>
          <Link href={`/admin/projects?clientId=${client.id}`} className="text-xs uppercase tracking-[0.2em] text-cyan-400 hover:text-cyan-300">
            Manage
          </Link>
        </div>
        {(projects ?? []).length === 0 && <p className="text-sm text-zinc-600">No projects yet.</p>}
        <ul className="space-y-2">
          {(projects ?? []).map((p) => (
            <li key={p.id}>
              <Link href={`/admin/projects/${p.id}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <span className="truncate text-sm text-white">{p.title}</span>
                <span className="shrink-0 pl-4 text-xs capitalize text-cyan-300">{p.status.replace("-", " ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
