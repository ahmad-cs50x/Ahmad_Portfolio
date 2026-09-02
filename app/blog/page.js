import Link from "next/link";
import { AlertTriangle, PenLine, Home } from "lucide-react";
import { getPublishedPosts, diagnoseEmptyBlog } from "@/lib/blog";
import { getSession, isSuperAdmin } from "@/lib/permissions";
import PostCard from "@/components/blog/PostCard";

export const metadata = {
  title: "Blog — Ahmad",
  description: "Articles on full-stack development, 3D web experiences and design engineering.",
};

/** Always render fresh — a post published in the admin should appear immediately. */
export const revalidate = 0;

export default async function BlogIndexPage() {
  const { posts, error } = await getPublishedPosts({ limit: 50 });

  // Only an admin gets told *why* the page is empty; draft counts aren't public.
  const session = await getSession();
  const admin = isSuperAdmin(session);
  const diagnosis = posts.length === 0 && admin ? await diagnoseEmptyBlog() : null;

  return (
    <main className="container-tight relative z-10 pb-24 pt-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm text-cyan-400">{"// writing & notes"}</p>
          <h1 className="mt-2 font-display text-5xl font-bold tracking-tight text-white md:text-6xl">
            Blog<span className="text-gradient">.</span>
          </h1>
        </div>
        <Link
          href="/"
          className="btn-ghost gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/[0.07]"
        >
          <Home className="h-4 w-4 font-light" />
          Back to Home
        </Link>
      </div>
      <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
        Thoughts on building immersive, high-performance products for the web.
      </p>

      {error && admin && (
        <div
          role="alert"
          className="mt-10 flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-sm leading-relaxed text-red-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            The post query failed, so this page is empty for a reason unrelated to your content.
            <span className="mt-1.5 block font-mono text-[11px] text-red-300/70">{error}</span>
          </span>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="glass mt-14 rounded-2xl p-10 text-center">
          <p className="text-sm text-zinc-500">No articles published yet — check back soon.</p>

          {diagnosis && diagnosis.total > 0 && (
            <div className="mx-auto mt-6 max-w-md border-t border-white/10 pt-6 text-left text-sm leading-relaxed text-zinc-400">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-400">
                Visible to you only
              </p>
              <p className="mt-3">
                You have {diagnosis.total} post{diagnosis.total === 1 ? "" : "s"} saved, but none
                are publicly visible.
                {diagnosis.draft > 0 &&
                  ` ${diagnosis.draft} ${diagnosis.draft === 1 ? "is a draft" : "are drafts"}.`}
                {diagnosis.scheduled > 0 && ` ${diagnosis.scheduled} scheduled.`}
                {diagnosis.archived > 0 && ` ${diagnosis.archived} archived.`}
                {diagnosis.publishedButHidden > 0 &&
                  ` ${diagnosis.publishedButHidden} marked published but with a missing or future publish date.`}
              </p>
              <p className="mt-3 text-zinc-500">
                A post appears here only when its status is <strong>published</strong> and its
                publish date is in the past.
              </p>
              <Link href="/admin/blog" className="btn-primary mt-5 px-5 py-2.5 text-sm">
                <PenLine className="h-4 w-4" />
                Open the blog editor
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
