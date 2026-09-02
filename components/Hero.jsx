"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Rocket, Gauge, Award, FileDown } from "lucide-react";
import TypeWriter from "./TypeWriter";
import Magnetic from "./Magnetic";

const Scene3D = dynamic(() => import("./Scene3D"), { ssr: false });

const WORDS = [
  "UI/UX Engineer.",
  "3D Web Explorer.",
  "Figma Expert.",
  "Full-Stack Developer.",
  "MERN Stack Developer.",
  "Open Source Contributor.",
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 1.6 } },
};

const item = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const chips = [
  { Icon: Rocket, value: "40+", label: "Projects Shipped", anim: "animate-float" },
  { Icon: Award, value: "30+", label: "Mounths Experience", anim: "animate-float-delayed" },
  { Icon: Gauge, value: "99%", label: "Avg. Lighthouse", anim: "animate-float" },
];

export default function Hero() {
  return (
    <section id="home" className="relative flex min-h-screen items-center overflow-hidden">
      <div className="absolute inset-0">
        <Scene3D />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050505_82%)]" />

      <span
        aria-hidden="true"
        className="text-outline pointer-events-none absolute -bottom-4 left-1/2 z-[1] -translate-x-1/2 select-none whitespace-nowrap font-display text-[17vw] font-bold leading-none"
      >
        PORTFOLIO
      </span>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="w-[100%] lg:mx-12 mx-8 relative z-10 pb-24 pt-32">
        <motion.div variants={item} className=" ">
          <span className="glass inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-xs uppercase tracking-widest text-zinc-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Available for new opportunities
          </span>
        </motion.div>

        <motion.p variants={item} className="mb-4 mt-8 font-mono text-sm text-cyan-400 md:text-base">
          {"// Hello world, my name is"}
        </motion.p>

        <motion.h1
          variants={item}
          className="font-display text-6xl font-bold leading-none tracking-tight text-white sm:text-7xl lg:text-8xl"
        >
          Ahmad<span className="text-gradient-animated">.</span>
        </motion.h1>

        <motion.h2
          variants={item}
          className="mt-4 font-display text-3xl font-bold tracking-tight md:text-5xl"
        >
          <span className="sr-only">{WORDS[0]}</span>
          <span aria-hidden="true" className="relative block h-[1.2em] overflow-visible">
            <span className="invisible block">Open Source Contributor.</span>
            <span className="text-gradient-animated absolute inset-0 whitespace-nowrap">
              <TypeWriter words={WORDS} />
            </span>
          </span>
        </motion.h2>

        <motion.p variants={item} className="mt-6 max-w-xl leading-relaxed text-zinc-400">
          I design &amp; engineer immersive digital experiences — blending sleek interfaces,
          robust Node.js backends and real-time 3D graphics into products people love to use.
        </motion.p>

        <motion.div variants={item} className="mt-10 flex flex-wrap items-center gap-5">

          <a href="#projects" className="btn-primary">
            <Magnetic>
              <div className="h-14 w-full flex flex-row">
                <p className=" text-white group pl-8 mr-3 mb-2 mt-4">Explore My Work</p>
                <ArrowRight className="  mr-3 mb-2 mt-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Magnetic>
          </a>

          <Magnetic>
            <a href="#contact" className="btn-ghost px-8 py-4">
              Let&apos;s Talk
            </a>
          </Magnetic>
          <Magnetic>
            <a href="/resume.pdf" download className="btn-ghost px-8 py-4">
              <FileDown className="h-4 w-4 text-cyan-400" />
              Resume
            </a>
          </Magnetic>
        </motion.div>
      </motion.div>

      <div className="pointer-events-none absolute right-8 top-1/4 z-10 hidden flex-col gap-8 xl:flex">
        {chips.map((chip, i) => (
          <motion.div
            key={chip.label}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 2 + i * 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={`${chip.anim} flex items-center gap-4 rounded-2xl glass px-5 py-4 shadow-glow`}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
              <chip.Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-display text-xl font-bold text-white">{chip.value}</span>
              <span className="block text-[11px] uppercase tracking-wider text-zinc-500">
                {chip.label}
              </span>
            </span>
          </motion.div>
        ))}
      </div>

      <motion.a
        href="#about"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
        <span className="flex h-10 w-6 justify-center rounded-full border border-zinc-600 pt-2">
          <motion.span
            animate={{ y: [0, 12, 0], opacity: [1, 0.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="h-2 w-1 rounded-full bg-zinc-400"
          />
        </span>
        <ChevronDown className="h-3.5 w-3.5 animate-bounce" />
      </motion.a>
    </section>
  );
}
