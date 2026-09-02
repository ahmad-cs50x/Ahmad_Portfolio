import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPublishedPosts } from "@/lib/blog";
import PostCard from "@/components/blog/PostCard";
import Reveal from "./Reveal";


export default async function BlogSection() {
  const { posts } = await getPublishedPosts({ limit: 3 });
  if (posts.length === 0) return null;

  return (
<section id="blog" className="section flex justify-center w-full border-t border-white/[0.06]">
  <div className="w-[90%] max-w-7xl mx-auto p-6 md:p-12 rounded-xl">
    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 w-full">
      
      {/* Container forcing left-alignment and 50% width on desktop */}
      <div className="flex w-full md:w-[50%]">
        <Reveal className="flex flex-col gap-4 items-start text-left">
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.25em] text-violet-300">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-violet-400" />
            06 · blog
          </span>
          
          <h2 className="font-display text-4xl font-bold text-white md:text-5xl">
            From the blog
          </h2>
          
          <span className="h-1 w-20 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
          
          <p className="mt-2 max-w-2xl leading-relaxed text-zinc-400">
            What I&apos;m learning while building — 3D on the web, performance work, and the occasional post-mortem.
          </p>
        </Reveal>
      </div>
      
      <Link 
        href="/blog" 
        className="btn-ghost group font-light px-6 py-3 h-12 w-48 text-sm flex items-center justify-center shrink-0 self-start md:self-auto"
      >
        All articles 
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 ml-2" />
      </Link>
    </div>

    <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  </div>
</section>



  );
}
