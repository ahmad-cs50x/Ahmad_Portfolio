"use client";

import Reveal from "./Reveal";

export default function SectionHeading({ eyebrow, title, description, align = "center" }) {
  const alignCls = align === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <Reveal className={`mb-16 flex flex-col gap-4 ${alignCls}`}>
      <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.25em] text-violet-300">
        <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-violet-400" />
        {eyebrow}
      </span>
      <h2 className="font-display text-4xl font-bold text-white md:text-5xl">{title}</h2>
      <span className="h-1 w-20 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
      {description && (
        <p className="mt-2 max-w-2xl leading-relaxed text-zinc-400">{description}</p>
      )}
    </Reveal>
  );
}
