"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ImagePlus } from "lucide-react";

const STATUSES = ["draft", "published", "scheduled", "archived"];

function slugify(v) {
  return String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function BlogForm({ existing }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "",
    coverImage: "", categoryId: "", tags: "",
    seoTitle: "", seoDescription: "",
    status: "draft", publishedAt: "",
  });
  const [categories, setCategories] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    fetch("/api/blog/categories")
      .then((r) => r.json())
      .then((json) => json.success && setCategories(json.categories));
  }, []);

  useEffect(() => {
    if (!existing) return;
    setForm({
      title: existing.title ?? "",
      slug: existing.slug ?? "",
      excerpt: existing.excerpt ?? "",
      content: existing.content ?? "",
      coverImage: existing.cover_image ?? "",
      categoryId: existing.category_id ?? "",
      tags: (existing.tags ?? []).map((t) => t.name).join(", "),
      seoTitle: existing.seo_title ?? "",
      seoDescription: existing.seo_description ?? "",
      status: existing.status ?? "draft",
      publishedAt: existing.published_at ? existing.published_at.slice(0, 16) : "",
    });
  }, [existing]);

  async function uploadCover(file) {
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/blog/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setForm((f) => ({ ...f, coverImage: json.url }));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingCover(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      categoryId: form.categoryId || null,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    };
    const res = await fetch("/api/blog", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(existing ? { id: existing.id, ...payload } : payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.message || "Save failed");
    router.push("/admin/blog");
  }

  function input(label, key, props = {}) {
    return (
      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">{label}</label>
        <input
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
          {...props}
        />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5 pb-8">
      {input("Title *", "title", { required: true })}
      <div className="grid gap-4 sm:grid-cols-2">
        {input("Slug (auto from title)", "slug", {
          placeholder: slugify(form.title),
        })}
        <div>
          <label className="block text-xs uppercase tracking-wider text-zinc-500">Category</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none"
          >
            <option value="">None</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">Excerpt</label>
        <textarea
          rows={2}
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">Content</label>
        <textarea
          rows={14}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="Write your post… (plain text / simple markdown-style paragraphs)"
          className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm leading-relaxed text-white outline-none focus:border-violet-500/50"
        />
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">Cover image</label>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <input
            type="url"
            placeholder="https://… or upload"
            value={form.coverImage}
            onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs text-zinc-300 hover:border-cyan-400/50">
            {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Upload
            <input type="file" accept="image/*" hidden onChange={(e) => uploadCover(e.target.files?.[0])} />
          </label>
        </div>
        {form.coverImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={form.coverImage} alt="Cover preview" className="mt-3 h-36 w-auto rounded-xl object-cover" />
        )}
      </div>

      {input("Tags (comma separated)", "tags")}

      <details className="rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-zinc-400">SEO fields</summary>
        <div className="mt-4 space-y-4">
          {input("SEO Title", "seoTitle")}
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500">SEO Description</label>
            <textarea
              rows={2}
              value={form.seoDescription}
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
            />
          </div>
        </div>
      </details>

      {/*
        Status and publish date are deliberately adjacent and visible — they are
        the two fields that together decide whether the post appears on /blog,
        and separating them is what made posts look "saved but missing".
      */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Visibility</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="post-status" className="block text-xs uppercase tracking-wider text-zinc-500">
              Status
            </label>
            <select
              id="post-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-ink px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="post-date" className="block text-xs uppercase tracking-wider text-zinc-500">
              Publish date
            </label>
            <input
              id="post-date"
              type="datetime-local"
              value={form.publishedAt}
              onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 [color-scheme:dark]"
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          {form.status === "published" && !form.publishedAt
            ? "Leave the date empty and it will be stamped with the current time on save — the post goes live immediately."
            : form.status === "published"
              ? "Live on /blog once the publish date has passed."
              : form.status === "scheduled"
                ? "Set a future date. The post appears automatically once that time passes."
                : `Saved as "${form.status}" — not visible on the public blog.`}
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary px-7 py-3 text-sm disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {existing ? "Update post" : "Create post"}
      </button>
    </form>
  );
}
