"use client";

import { Code2, Zap, Smartphone, ShieldCheck } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

const features = [
  { Icon: Code2, title: "Clean Architecture", desc: "Maintainable, well-tested codebases" },
  { Icon: Zap, title: "Performance First", desc: "Sub-second loads, 90+ Lighthouse" },
  { Icon: Smartphone, title: "Fully Responsive", desc: "Flawless on every screen size" },
  { Icon: ShieldCheck, title: "Secure by Default", desc: "Hardened APIs & best practices" },
];

const stats = [
  { value: "30+", label: "Mounths Experience" },
  { value: "12+", label: "Projects Delivered" },
  { value: "25+", label: "Happy Clients" },
];

export default function About() {
  return (
    <section id="about" className="section w-full px-4 sm:px-6 md:px-8 overflow-hidden relative">
      <div
        aria-hidden="true"
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
      />

      {/* Changed gap-8 for mobile, gap-16 preserved for large screens */}
      <div className="container-tight relative grid items-center gap-8 lg:gap-16 lg:grid-cols-2 max-w-7xl mx-auto">
        <Reveal>
          <div className="glass overflow-hidden rounded-2xl md:rounded-3xl shadow-glow-lg w-full">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 md:px-5 md:py-4">
              <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-rose-500/80" />
              <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 md:ml-3 font-mono text-[11px] md:text-xs text-zinc-500">about-me.js</span>
            </div>

            {/* Adjusted padding and minimum text size to fit within 390px screens without clipping */}
            <pre className="overflow-x-auto p-4 md:p-6 font-mono text-[11px] leading-6 md:text-sm md:leading-7 whitespace-pre-wrap sm:whitespace-pre">
              <code>
                <span className="text-fuchsia-400">const</span>{" "}
                <span className="text-cyan-300">ahmad</span>{" "}
                <span className="text-zinc-500">= {"{"}</span>
                {"\n  "}
                <span className="text-sky-300">role</span>
                <span className="text-zinc-500">: </span>
                <span className="text-emerald-300">&quot;Full-Stack Developer&quot;</span>
                <span className="text-zinc-500">,</span>
                {"\n  "}
                <span className="text-sky-300">stack</span>
                <span className="text-zinc-500">: [</span>
                <span className="text-emerald-300">&quot;React&quot;</span>
                <span className="text-zinc-500">, </span>
                <span className="text-emerald-300">&quot;Next.js&quot;</span>
                <span className="text-zinc-500">, </span>
                <span className="text-emerald-300">&quot;Node&quot;</span>
                <span className="text-zinc-500">, </span>
                <span className="text-emerald-300">&quot;Express&quot;</span>
                <span className="text-zinc-500">],</span>
                {"\n  "}
                <span className="text-sky-300">focus</span>
                <span className="text-zinc-500">: </span>
                <span className="text-emerald-300">&quot;Immersive 3D experiences&quot;</span>
                <span className="text-zinc-500">,</span>
                {"\n  "}
                <span className="text-sky-300">coffee</span>
                <span className="text-zinc-500">: </span>
                <span className="text-amber-300">Infinity</span>
                <span className="text-zinc-500">,</span>
                {"\n  "}
                <span className="text-sky-300">openToWork</span>
                <span className="text-zinc-500">: () =&gt; </span>
                <span className="text-amber-300">true</span>
                <span className="text-zinc-500">,</span>
                {"\n"}
                <span className="text-zinc-500">{"};"}</span>
              </code>
            </pre>
            <div className="px-4 pb-4 md:px-6 md:pb-6">
              <span className="block h-4 w-2 animate-pulse bg-violet-400" />
            </div>
          </div>
        </Reveal>

        {/* Added mt-4 for separation on mobile screens when stacked vertically */}
        <div className="mt-4 lg:mt-0">
          <SectionHeading align="left" eyebrow="01 · about me" title="Turning ideas into living products" />
          <Reveal delay={0.1}>
            {/* Softened negative margin so headers don't overlap awkwardly on tiny viewpoints */}
            <p className="-mt-4 md:-mt-8 text-sm md:text-base leading-relaxed text-zinc-400">
              I&apos;m Ahmad — a full-stack developer with 5+ years of experience shipping
              production apps for startups and agencies. I live at the intersection of engineering
              and design: equally comfortable architecting scalable Node.js services and obsessing
              over buttery-smooth 60fps interactions.
            </p>
            <p className="mt-4 text-sm md:text-base leading-relaxed text-zinc-400">
              When I&apos;m not coding, you&apos;ll find me learning new skills, contributing
              to open source, or mentoring junior developers on their journey into modern web dev.
            </p>
          </Reveal>

          <div className="mt-8 md:mt-10 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={0.15 + i * 0.08}>
                <div className="glass group flex items-start gap-4 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300 transition-colors group-hover:bg-violet-500/25">
                    <f.Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{f.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{f.desc}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            {/* Changed grid-cols-3 to stack stats seamlessly on small devices if they overflow */}
            <div className="mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-white/10 pt-6 md:pt-8">
              {stats.map((s) => (
                <div key={s.label} className="last:col-span-2 sm:last:col-span-1">
                  <p className="font-display text-2xl font-bold text-gradient md:text-4xl">{s.value}</p>
                  <p className="mt-1 text-[10px] md:text-[11px] uppercase tracking-wider text-zinc-500">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>

  );
}
