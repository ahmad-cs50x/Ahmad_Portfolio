import Link from "next/link";
import { notFound } from "next/navigation";
import { Home } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/db";

async function getPost(slug) {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const nowIso = new Date().toISOString();
  const { data: post } = await sb
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .lte("published_at", nowIso)
    .maybeSingle();
  return post ?? null;
}

/** Match the blog index — never serve a cached copy of an edited post. */
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post not found — Ahmad" };
  return {
    title: post.seo_title || `${post.title} — Ahmad`,
    description: post.seo_description || post.excerpt || undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      images: post.cover_image ? [post.cover_image] : undefined,
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <main className="z-10 pb-24 mt-12">

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/blog" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500 transition hover:text-zinc-300">
            ← All articles
          </Link>
        </div>

      
      <div className="mx-auto max-w-3xl ">
        <article>
          <header className=" ">
            <p className="font-mono text-sm text-cyan-400">
              {post.published_at
                ? new Date(post.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : ""}
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              {post.title}
            </h1>
            {post.excerpt && <p className="mt-4 text-lg leading-relaxed text-zinc-400">{post.excerpt}</p>}
          </header>

          {post.cover_image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={post.cover_image} alt="" className="mt-10 w-full rounded-2xl object-cover" />
          )}

          <div className="prose-invert mt-10 space-y-5 leading-relaxed text-zinc-300">
            {(post.content || "").split(/\n{2,}/).map((para, i) => (
              <p key={i} className="text-[15px] md:text-base">{para}</p>
            ))}
          </div>
        </article>

        <div className="glass mt-16 rounded-2xl p-8 text-center">
          <p className="font-display text-xl font-light text-white">Work with me</p>
          <Link href="/#contact" className="btn-primary mt-4 px-7 py-3 text-sm font-light">
            <span className="relative z-10">Get in touch</span>
          </Link>
        </div>
      </div>
      </div>
    </main>
  );
}
