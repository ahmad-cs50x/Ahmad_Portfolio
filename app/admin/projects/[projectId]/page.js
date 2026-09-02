"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Save, Trash2, Plus } from "lucide-react";

const STATUSES = ["project", "planning", "in-progress", "review", "completed", "archived"];

const GRADIENTS = [
  "from-violet-600 via-purple-600 to-indigo-700",
  "from-cyan-500 via-sky-600 to-blue-700",
  "from-fuchsia-600 via-pink-600 to-rose-600",
  "from-indigo-500 via-blue-600 to-violet-700",
  "from-amber-500 via-orange-600 to-red-600",
  "from-teal-500 via-emerald-600 to-green-700",
];

export default function AdminProjectDetail() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setData({ project: json.project, milestones: json.milestones.map((m) => ({ title: m.title, done: m.done })) });
        } else setError(json.message);
      });
  }, [projectId]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    const p = data.project;
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: p.title,
        description: p.description,
        status: p.status,
        progress: Number(p.progress),
        liveDemoUrl: p.live_demo_url || "",
        videoUrl: p.video_explanation_url || "",
        zipUrl: p.source_zip_url || "",
        githubUrl: p.github_url || "",
        docsUrl: p.documentation_url || "",
        driveUrl: p.drive_url || "",
        techStack: p.tech_stack || "",
        coverImage: p.cover_image || "",
        featured: Boolean(p.featured),
        isPortfolio: Boolean(p.is_portfolio),
        gradientIndex: Number(p.gradient_index) || 0,
        milestones: data.milestones,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.message || "Save failed");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function archive() {
    if (!confirm("Archive this project?")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    window.location.href = "/admin/projects";
  }

  function field(label, key, type = "url") {
    return (
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">{label}</label>
        <input
          type={type}
          value={data.project[key] ?? ""}
          onChange={(e) => setData({ ...data, project: { ...data.project, [key]: e.target.value } })}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/projects" className="text-xs uppercase tracking-[0.25em] text-zinc-500 hover:text-zinc-300">
          All projects
        </Link>
        <button
          type="button"
          onClick={archive}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-500 hover:border-red-500/40 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" /> Archive
        </button>
      </div>

      <section className="glass space-y-4 rounded-2xl p-7">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">Title</label>
            <input
              required
              value={data.project.title}
              onChange={(e) => setData({ ...data, project: { ...data.project, title: e.target.value } })}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-violet-500/50"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">Status</label>
            <select
              value={data.project.status}
              onChange={(e) => setData({ ...data, project: { ...data.project, status: e.target.value } })}
              className="mt-1.5 rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">Progress %</label>
            <input
              type="number" min="0" max="100"
              value={data.project.progress}
              onChange={(e) => setData({ ...data, project: { ...data.project, progress: e.target.value } })}
              className="mt-1.5 w-24 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">Description</label>
          <textarea
            rows={3}
            value={data.project.description ?? ""}
            onChange={(e) => setData({ ...data, project: { ...data.project, description: e.target.value } })}
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("Live demo URL", "live_demo_url")}
          {field("Video explanation URL", "video_explanation_url")}
          {field("ZIP source URL", "source_zip_url")}
          {field("GitHub URL", "github_url")}
          {field("Documentation URL", "documentation_url")}
          {field("Google Drive folder URL", "drive_url")}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">Tech Stack</label>
            <input
              value={data.project.tech_stack ?? ""}
              onChange={(e) => setData({ ...data, project: { ...data.project, tech_stack: e.target.value } })}
              placeholder="React, Next.js, Tailwind CSS, etc."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
            />
            <p className="mt-1 text-[11px] text-zinc-600">Comma-separated list of technologies</p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">Cover Image URL</label>
            <input
              type="url"
              value={data.project.cover_image ?? ""}
              onChange={(e) => setData({ ...data, project: { ...data.project, cover_image: e.target.value } })}
              placeholder="https://example.com/screenshot.png"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(data.project.featured)}
            onChange={(e) => setData({ ...data, project: { ...data.project, featured: e.target.checked } })}
            className="h-4 w-4 accent-cyan-500 rounded"
          />
          <span className="text-sm text-zinc-300">Featured project (highlighted on works page)</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(data.project.is_portfolio)}
            onChange={(e) => setData({ ...data, project: { ...data.project, is_portfolio: e.target.checked } })}
            className="h-4 w-4 accent-cyan-500 rounded"
          />
          <span className="text-sm text-zinc-300">Portfolio project (public, shown on /works page)</span>
        </label>

        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">Card Gradient</label>
          <div className="flex gap-2">
            {GRADIENTS.map((g, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setData({ ...data, project: { ...data.project, gradient_index: i } })}
                className={`h-10 w-10 rounded-lg bg-gradient-to-br ${g} border-2 transition ${
                  (data.project.gradient_index ?? 0) === i ? "border-white scale-110" : "border-transparent hover:scale-105"
                }`}
                title={`Gradient ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="glass rounded-2xl p-7">
        <p className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Milestones</p>
        <div className="space-y-2">
          {data.milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(m.done)}
                onChange={(e) => {
                  const next = [...data.milestones];
                  next[i] = { ...next[i], done: e.target.checked };
                  setData({ ...data, milestones: next });
                }}
                className="h-4 w-4 accent-cyan-500"
              />
              <input
                value={m.title}
                onChange={(e) => {
                  const next = [...data.milestones];
                  next[i] = { ...next[i], title: e.target.value };
                  setData({ ...data, milestones: next });
                }}
                placeholder={`Milestone ${i + 1}`}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
              />
              <button
                type="button"
                onClick={() => setData({ ...data, milestones: data.milestones.filter((_, j) => j !== i) })}
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setData({ ...data, milestones: [...data.milestones, { title: "", done: false }] })}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add milestone
        </button>
      </section>

      <div className="flex items-center gap-4 pb-6">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 px-7 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved ✓</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}