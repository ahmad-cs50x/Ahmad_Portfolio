"use client";

import { Github, ArrowUpRight, FolderOpen, ExternalLink } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import TiltCard from "./TiltCard";
import Magnetic from "./Magnetic";
import { projects as fallbackProjects } from "@/lib/data";

const gradients = [
  "from-violet-600 via-purple-600 to-indigo-700",
  "from-cyan-500 via-sky-600 to-blue-700",
  "from-fuchsia-600 via-pink-600 to-rose-600",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-indigo-500 via-blue-600 to-violet-700",
  "from-amber-500 via-orange-600 to-red-600",
];

function DbProjectCard({ project, index }) {
  const techStack = project.tech_stack
    ? project.tech_stack.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const gradientIdx = project.gradient_index ?? index;

  // Project card structure 
  return (
    <Reveal key={project.id} delay={(index % 3) * 0.08}>
      <TiltCard className="group h-full rounded-3xl">
        <article className="glass flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 group-hover:border-violet-500/40 group-hover:shadow-glow">
          <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${project.cover_image ? "" : gradients[gradientIdx % gradients.length]}`}>
            {project.cover_image ? (
              <img
                src={project.cover_image}
                alt={project.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <>
                <div className="bg-grid absolute inset-0 opacity-40" />
                <span className="absolute bottom-2 right-4 select-none font-display text-6xl font-bold text-white/15">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </>
            )}
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

          <div className="flex flex-1 flex-col p-6">
            <h3 className="font-display text-xl font-semibold text-white transition-colors group-hover:text-violet-300">
              {project.title}
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-400 line-clamp-2">{project.description || "No description available."}</p>
            <div className="mt-auto flex flex-wrap gap-2 pt-5">
              {techStack.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400"
                >
                  {tag}
                </span>
              ))}
              {techStack.length > 4 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  +{techStack.length - 4}
                </span>
              )}
            </div>
          </div>
        </article>
      </TiltCard>
    </Reveal>
  );
}

  // if i have projects
export default function Projects({ dbProjects = [] }) {
  const hasDbProjects = dbProjects.length > 0;
  const projectsToShow = hasDbProjects ? dbProjects : fallbackProjects;

  return (
    <section id="projects" className="section">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />
      <div className="container-tight relative">
        <SectionHeading
          eyebrow="03 · selected work"
          title="Featured Projects"
          description="A curated selection of things I've built — each one an excuse to push the stack a little further."
        />

        <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {projectsToShow.slice(0, 6).map((project, i) =>
              <DbProjectCard key={project.id} project={project} index={i} />  
          )}
        </div>

        <Reveal delay={0.2} className="mt-14 text-center">
          <Magnetic>
            <a
              href="/works"
              className="glass inline-flex items-center gap-2 rounded-xl px-8 py-4 font-medium text-white transition hover:border-violet-500/40 hover:bg-white/[0.07]"
            >
              <Github className="h-5 w-5" />
              View all projects
            </a>
          </Magnetic>
        </Reveal>
      </div>
    </section>
  );
}
