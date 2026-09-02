"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATUSES = [
  "booting shaders...",
  "compiling components...",
  "polishing pixels...",
  "almost there...",
];

const letterVariants = {
  hidden: { y: "115%" },
  show: (i) => ({
    y: "0%",
    transition: { delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Preloader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p += Math.floor(Math.random() * 8) + 3;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => setDone(true), 500);
      }
      setProgress(p);
    }, 90);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    document.body.style.overflow = done ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [done]);

  const status = STATUSES[Math.min(STATUSES.length - 1, Math.floor(progress / 25))];

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
          exit={{ y: "-100%", transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }}
        >
          <h1 className="font-display text-5xl font-bold tracking-tight text-white md:text-7xl">
            {"AHMAD".split("").map((ch, i) => (
              <span key={i} className="inline-block overflow-hidden">
                <motion.span
                  className="inline-block"
                  variants={letterVariants}
                  initial="hidden"
                  animate="show"
                  custom={i}
                >
                  {ch}
                </motion.span>
              </span>
            ))}
            <span className="text-gradient">.</span>
          </h1>

          <div className="mt-8 h-px w-56 overflow-hidden bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            {status}
          </p>

          <span className="absolute bottom-6 left-6 font-mono text-xs uppercase tracking-widest text-zinc-600">
            portfolio v1.0
          </span>
          <span className="absolute bottom-4 right-6 font-display text-7xl font-bold tabular-nums text-white/10 md:text-8xl">
            {progress}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
