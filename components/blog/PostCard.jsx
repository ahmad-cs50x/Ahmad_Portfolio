import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatPostDate } from "@/lib/blog";

/**
 * One post card. Shared by the /blog grid and the home page section so the two
 * can never drift apart visually.
 *
 * Rendered inside a <Link>, so every child is an inline/span element — nesting
 * a <div> or <p> inside an <a> is invalid HTML and trips React hydration.
 */
export default function PostCard({ post }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="glass group flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      {post.cover_image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={post.cover_image}
          alt=""
          className="h-44 w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
        />
      ) : (
        <span
          aria-hidden="true"
          className="bg-grid block h-24 w-full bg-gradient-to-br from-violet-600/15 to-cyan-500/10"
        />
      )}

      <span className="flex flex-1 flex-col p-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-400">
          {post.category?.name ?? "General"}
        </span>

        <span className="mt-2.5 font-display text-lg font-bold leading-snug text-white transition-colors group-hover:text-violet-200">
          {post.title}
        </span>

        {post.excerpt && (
          <span className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-400">
            {post.excerpt}
          </span>
        )}

        <span className="mt-auto flex items-center justify-between pt-5 text-xs text-zinc-600">
          {formatPostDate(post.published_at)}
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
        </span>
      </span>
    </Link>
  );
}
