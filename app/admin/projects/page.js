"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, Trash2, Filter } from "lucide-react";

const STATUSES = [
  "project",
  "planning",
  "in-progress",
  "review",
  "completed",
  "archived",
];

const STATUS_COLORS = {
  project: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  planning: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  "in-progress": "border-violet-500/30 bg-violet-500/10 text-violet-300",
  review: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  archived: "border-white/10 bg-white/5 text-zinc-500",
};

const emptyForm = {
  clientId: "",
  title: "",
  description: "",
  liveDemoUrl: "",
  videoUrl: "",
  zipUrl: "",
  githubUrl: "",
  docsUrl: "",
  driveUrl: "",
  techStack: "",
  coverImage: "",
  featured: false,
  isPortfolio: false,
  status: "project",
  progress: 0,
  milestones: [{ title: "" }, { title: "" }, { title: "" }],
};

export function ProjectCreateForm({ clients, open, onToggle }) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const clientId = searchParams.get("clientId");
    if (clientId) {
      setForm((f) => ({ ...f, clientId }));
      onToggle(true);
    }
  }, [searchParams]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      clientId: form.isPortfolio ? null : form.clientId || clients[0]?.id,
      isPortfolio: form.isPortfolio,
    };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.message || "Failed to create project");
    setForm(emptyForm);
    onToggle(false);
    window.location.reload();
  }

  if (!open) return null;

  return (
    <section className="glass rounded-2xl p-6">
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPortfolio}
              onChange={(e) =>
                setForm({ ...form, isPortfolio: e.target.checked })
              }
              className="h-4 w-4 accent-cyan-500 rounded"
            />
            <span className="text-sm text-zinc-300">
              Portfolio project (public, shown on /works)
            </span>
          </label>
        </div>

        <div className="flex flew-row w-full">
          <div className="w-[65%]">
            <input
              required
              placeholder="Project title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3  mt-5 w-full text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="w-[25%] ml-[1%]">
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              {form.isPortfolio ? "Client (optional)" : "Client"}
            </label>
            <select
              required={!form.isPortfolio}
              disabled={form.isPortfolio && !form.clientId}
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className={`rounded-xl border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50 ${
                form.isPortfolio ? "bg-white/[0.02]" : "bg-ink"
              }`}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          placeholder="Description"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-ink px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("-", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Progress %
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.progress}
              onChange={(e) =>
                setForm({
                  ...form,
                  progress: Math.max(
                    0,
                    Math.min(100, parseInt(e.target.value) || 0),
                  ),
                })
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Live demo URL", "liveDemoUrl"],
            ["Video explanation URL", "videoUrl"],
            ["ZIP source URL", "zipUrl"],
            ["GitHub URL", "githubUrl"],
            ["Documentation URL", "docsUrl"],
            ["Google Drive folder URL", "driveUrl"],
          ].map(([label, key]) => (
            <input
              key={key}
              type="url"
              placeholder={label}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            />
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Tech Stack
            </label>
            <input
              placeholder="React, Next.js, Tailwind CSS, etc."
              value={form.techStack}
              onChange={(e) =>
                setForm({ ...form, techStack: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              Comma-separated list of technologies
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-1.5">
              Cover Image URL
            </label>
            <input
              type="url"
              placeholder="https://example.com/screenshot.png"
              value={form.coverImage}
              onChange={(e) =>
                setForm({ ...form, coverImage: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-violet-500/50"
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              URL to a project screenshot or hero image
            </p>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            className="h-4 w-4 accent-cyan-500 rounded"
          />
          <span className="text-sm text-zinc-300">
            Featured project (highlighted on works page)
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Milestones
          </p>
          {form.milestones.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder={`Milestone ${i + 1}`}
                value={m.title}
                onChange={(e) => {
                  const next = [...form.milestones];
                  next[i] = { title: e.target.value };
                  setForm({ ...form, milestones: next });
                }}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
              />
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    milestones: form.milestones.filter((_, j) => j !== i),
                  })
                }
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                milestones: [...form.milestones, { title: "" }],
              })
            }
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            + Add milestone
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || (!form.isPortfolio && !clients.length)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Create project
        </button>
      </form>
    </section>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [clients, setClients] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const statusCounts = useMemo(() => {
    if (!projects) return {};
    return projects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
  }, [projects]);

  const load = useCallback(async () => {
    const [pr, cl] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/clients"),
    ]);
    const prj = await pr.json();
    const clj = await cl.json();
    if (pr.ok) setProjects(prj.projects ?? []);
    if (cl.ok) setClients(clj.clients ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (statusFilter === "all") return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  if (projects === null) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-5 py-3 text-sm font-semibold text-white shadow-glow"
        >
          <Plus className="h-4 w-4" /> New project
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-5 w-5 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-300">
            Filter by status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-white/10 bg-ink px-4 py-2 text-sm text-white outline-none focus:border-violet-500/50"
          >
            <option value="all">All ({projects.length})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("-", " ")} ({statusCounts[s] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      <ProjectCreateForm clients={clients} open={open} onToggle={setOpen} />

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {filteredProjects.length === 0 && (
          <p className="p-10 text-center text-sm text-zinc-600">
            {statusFilter !== "all"
              ? `No projects with status "${statusFilter.replace("-", " ")}"`
              : "No projects yet."}
          </p>
        )}
        {filteredProjects.map((p) => (
          <Link
            key={p.id}
            href={`/admin/projects/${p.id}`}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/5 px-5 py-4 last:border-0 hover:bg-white/[0.03]"
          >
            <span className="min-w-48 flex-1 truncate text-sm font-medium text-white">
              {p.title}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLORS[p.status] || STATUS_COLORS.planning}`}
            >
              {p.status.replace("-", " ")}
            </span>
            <span className="w-32">
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{ width: `${p.progress}%` }}
                />
              </span>
            </span>
            <span className="text-[11px] text-zinc-600">{p.progress}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}