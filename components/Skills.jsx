"use client";

import { motion } from "framer-motion";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import { skillGroups } from "@/lib/data";

export default function Skills() {
  return (
    <section id="skills" className="section">
      <div className="container-tight relative">
        <SectionHeading
          eyebrow="02 · expertise"
          title="My Tech Arsenal"
          description="A battle-tested toolkit refined over years of shipping real products — from pixel to pipeline."
        />

        <div className="grid gap-6 sm:grid-cols-2">
          {skillGroups.map((group, gi) => (
            <Reveal key={group.title} delay={gi * 0.08}>
              <div className="glass group relative h-full overflow-hidden rounded-3xl p-7 transition-colors duration-300 hover:border-violet-500/30 hover:bg-white/[0.05]">
                <group.Icon
                  aria-hidden="true"
                  className="absolute -right-6 -top-6 h-28 w-28 rotate-12 text-white/[0.04]"
                />

                <div className="mb-7 flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-500/20 text-violet-300 ring-1 ring-white/10">
                    <group.Icon className="h-6 w-6" />
                  </span>
                  <span>
                    <h3 className="font-display text-lg font-semibold text-white">{group.title}</h3>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">{group.blurb}</p>
                  </span>
                </div>

                <ul className="space-y-4">
                  {group.skills.map((skill, si) => (
                    <li key={skill.name}>
                      <div className="mb-1.5 flex items-baseline justify-between text-sm">
                        <span className="text-zinc-300">{skill.name}</span>
                        <span className="font-mono text-xs text-zinc-500">{skill.level}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${skill.level}%` }}
                          viewport={{ once: true }}
                          transition={{
                            duration: 1,
                            delay: 0.15 + si * 0.08,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
