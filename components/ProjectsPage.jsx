"use client";

import Link from "next/link";
import { Github, ExternalLink, Code, FolderOpen, Star, Home, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import Magnetic from "./Magnetic";


const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function TechBadge({ children }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-white/5 border border-white/10 text-zinc-400">
      {children}
    </span>
  );
}

function ProjectCard({ project, index }) {
  const hasGithub = project.github_url;
  const hasDemo = project.live_demo_url;
  const hasVideo = project.video_explanation_url;
  const techStack = project.tech_stack ? project.tech_stack.split(",").map(t => t.trim()).filter(Boolean) : [];
  
  // 50 color gradient taht will allocaed automatically
  const gradients = [
  "from-teal-500 via-cyan-600 to-sky-700",
  "from-rose-500 via-rose-600 to-pink-700",
  "from-indigo-600 via-indigo-700 to-blue-700",
  "from-yellow-500 via-amber-600 to-orange-700",
  "from-fuchsia-500 via-purple-600 to-violet-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-red-500 via-red-600 to-rose-700",
  "from-sky-500 via-cyan-600 to-teal-700",
  "from-purple-500 via-violet-600 to-indigo-600",
  "from-orange-500 via-red-600 to-rose-600",
  "from-blue-600 via-sky-600 to-cyan-700",
  "from-lime-500 via-green-600 to-emerald-700",
  "from-pink-600 via-fuchsia-600 to-purple-700",
  "from-cyan-600 via-sky-600 to-blue-700",
  "from-amber-600 via-orange-600 to-red-700",
  "from-teal-600 via-emerald-600 to-green-700",
  "from-violet-500 via-indigo-600 to-blue-700",
  "from-red-600 via-rose-600 to-pink-700",
  "from-sky-600 via-cyan-600 to-teal-700",
  "from-green-500 via-lime-600 to-yellow-600",
  "from-fuchsia-600 via-purple-600 to-violet-700",
  "from-blue-500 via-blue-600 to-indigo-700",
  "from-orange-600 via-red-600 to-rose-700",
  "from-emerald-500 via-green-600 to-lime-600",
  "from-purple-600 via-violet-600 to-indigo-700",
  "from-cyan-500 via-teal-600 to-emerald-600",
  "from-amber-500 via-orange-600 to-red-700",
  "from-teal-500 via-emerald-600 to-green-600",
  "from-pink-500 via-fuchsia-600 to-purple-600",
  "from-sky-500 via-blue-600 to-indigo-700",
  "from-yellow-600 via-amber-600 to-orange-700",
  "from-emerald-600 via-green-600 to-lime-700",
  "from-fuchsia-500 via-rose-600 to-red-700",
  "from-indigo-500 via-indigo-600 to-blue-600",
  "from-red-500 via-rose-600 to-pink-600",
  "from-cyan-600 via-teal-600 to-emerald-700",
  "from-rose-500 via-pink-600 to-fuchsia-600",
  "from-blue-500 via-sky-600 to-cyan-600",
  "from-green-500 via-emerald-600 to-teal-700",
  "from-purple-500 via-violet-600 to-indigo-700",
  "from-orange-500 via-orange-600 to-red-700",
  "from-indigo-600 via-blue-600 to-sky-700",
  "from-rose-600 via-pink-600 to-fuchsia-700",
  "from-pink-500 via-fuchsia-600 to-purple-700"
]; 

const gradientIdx = project.gradient_index ?? index;

// Project card structure 
  return (
    <motion.article variants={item} className="glass group relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40">
      
          <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${gradients[gradientIdx]}`}>
            <div className="bg-grid absolute inset-0 opacity-40" />
            <span className="absolute bottom-2 right-4 select-none font-display text-6xl font-bold text-white/15">
              {String(index + 1).padStart(2, "0")}
            </span>
            
            <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
              <Magnetic strength={0.3}>
                <a
                  href={project.github_url}
                  aria-label={`${project.title} source code`}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-black"
                >
                  <Github className="h-5 w-5" />
                </a>
              </Magnetic>
              <Magnetic strength={0.3}>
                <a
                  href={project.live_demo_url}
                  aria-label={`${project.title} live demo`}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur transition hover:bg-white hover:text-black"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </a>
              </Magnetic>
            </div>
          </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-display text-xl font-bold text-white group-hover:text-violet-300 transition-colors">
            {project.title}
          </h3>
          {project.featured && (
            <span className="flex items-center gap-1 text-amber-400 text-xs" title="Featured">
              <Star className="h-3 w-3 fill-current" />
            </span>
          )}
        </div>

        <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {project.description || "No description available."}
        </p>

        {techStack.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-16">
            {techStack.slice(0, 6).map((tech) => (
              <TechBadge key={tech}>{tech}</TechBadge>
            ))}
            {techStack.length > 6 && (
              <TechBadge>+{techStack.length - 6} more</TechBadge>
            )}
          </div>
        )}

        <div className="flex absolute bottom-7 left-0 right-0 px-3  items-center justify-between pt-4 border-t border-white/10">
          <span className="text-[11px] text-zinc-500 font-mono">
            {project.created_at ? format(new Date(project.created_at), "MMM yyyy") : ""}
          </span>
          <div className="flex items-center gap-1.5">
            {hasGithub ? (
              <Magnetic strength={0.3}>
                <Link
                  href={project.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Github className="h-4 w-4" />
                  View on GitHub
                </Link>
              </Magnetic>
            ) : (
              <span className="text-[11px] text-zinc-600" aria-hidden="true">—</span>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

  // if i dont have project 
export default function ProjectsPage({ projects }) {
  if (!projects.length) {
    return (
      <section id="works" className="-mt-32 ">
        <div className="container-tight">
          <div className="text-center py-8">
            <p className="font-mono text-sm text-cyan-400">{"// projects"}</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
              Projects<span className="text-gradient">.</span>
            </h2>
            <p className="mt-4 max-w-xl mx-auto leading-relaxed text-zinc-400">
              No projects published yet — check back soon.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // if i have project 
  return (
    <section id="works" className=" mt-10 ">
      <div className="container-tight">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-cyan-400">{"// projects"}</p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-tight text-white md:text-5xl">
              Projects<span className="text-gradient">.</span>
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
              A collection of projects I&apos;ve built — from open-source tools to production applications.
              Each project represents a problem I wanted to solve or a technology I wanted to explore.
            </p>
          </div>
          <Link
            href="/"
            className="btn-ghost gap-2 px-4 py-2 text-sm font-light transition-colors hover:bg-white/[0.07]"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <motion.div variants={container} initial="hidden" animate="show" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </motion.div>

        <div className="mt-12 mb-10 text-center">
          <a href="https://github.com/ahmad-cs50x/" className="btn-ghost group px-8 py-3 font-light text-sm">
            View On GitHub
            <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </section>
  );
}