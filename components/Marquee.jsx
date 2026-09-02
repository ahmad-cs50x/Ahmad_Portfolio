"use client";

import { Sparkles } from "lucide-react";
import { marqueeItems } from "@/lib/data";

export default function Marquee() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-white/[0.02] py-5">
      
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
            {marqueeItems.map((tech) => (
              <span
                key={`${tech}-${copy}`}
                className="flex items-center gap-6 px-6 font-display text-sm uppercase tracking-[0.3em] text-zinc-500"
              >
                {tech}
                <Sparkles className="h-4 w-4 text-violet-500/70" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink to-transparent" />
    </section>
  );
}
