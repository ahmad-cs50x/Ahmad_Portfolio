"use client";

import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import { experience } from "@/lib/data";

export default function zExperience() {
  return (
    <section id="experience" className="section">
      <div className="container-tight relative">
        <SectionHeading
          eyebrow="04 · journey"
          title="Where I've Worked"
          description="The road so far — teams, products and lessons that shaped how I build."
        />

        <div className="relative mx-auto max-w-3xl">
          <motion.span
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden="true"
            className="absolute bottom-2 left-[9px] top-2 w-px origin-top bg-gradient-to-b from-violet-500 via-fuchsia-500/50 to-transparent"
          />

          <ol className="space-y-12">
            {experience.map((job, i) => (
              <li key={job.company} className="relative pl-12">
                <span className="absolute left-0 top-1.5 grid h-[19px] w-[19px] place-items-center rounded-full border border-violet-500/60 bg-ink">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 shadow-glow" />
                </span>

                <Reveal delay={i * 0.1}>
                  <div className="glass rounded-2xl p-6 transition-colors duration-300 hover:border-violet-500/30 hover:bg-white/[0.05] md:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <h3 className="font-display text-xl font-semibold text-white">{job.role}</h3>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-wider text-zinc-400">
                        {job.period}
                      </span>
                    </div>

                    <p className="mt-1.5 flex items-center gap-2 text-sm font-medium text-violet-300">
                      <Briefcase className="h-4 w-4" />
                      {job.company}
                    </p>

                    <p className="mt-3.5 text-sm leading-relaxed text-zinc-400">{job.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
