"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Heart } from "lucide-react";
import Magnetic from "./Magnetic";
import { socials } from "@/lib/data";

const quickLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Work", href: "#projects" },
  { label: "Journey", href: "#experience" },
  { label: "Contact", href: "#contact" },
];

/**
 * Real routes rather than in-page anchors. These used to sit in the navbar;
 * they moved here to keep the top nav down to the six sections plus Blog.
 * `download` on the resume so it saves rather than opening in a tab.
 */
const siteLinks = [
  { label: "Blog", href: "/blog" },
  { label: "Client Portal", href: "/client-portal" },
  { label: "Resume", href: "/resume.pdf", download: true },
];

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="glass fixed bottom-8 right-8 z-40 grid h-11 w-11 place-items-center rounded-full text-white shadow-glow transition hover:border-violet-400/50"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 bg-white/[0.02]">
      <BackToTop />

      <div className="container-tight flex flex-col items-center gap-8 py-14">
        <a href="#home" className="font-display text-3xl font-bold text-white">
          Ahmad<span className="text-gradient">.</span>
        </a>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {quickLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="text-sm text-zinc-400 transition-colors hover:text-white">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {siteLinks.map((link, i) => (
              <li key={link.href} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden="true" className="h-3 w-px bg-white/10" />}
                <a
                  href={link.href}
                  {...(link.download ? { download: true } : {})}
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex gap-3">
          {socials.map(({ label, href, Icon }) => (
            <Magnetic key={label} strength={0.35}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="glass grid h-10 w-10 place-items-center rounded-xl text-zinc-400 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/50 hover:text-white"
              >
                <Icon className="h-[18px] w-[18px]" />
              </a>
            </Magnetic>
          ))}
        </div>

        <div className="h-px w-full bg-white/5" />

        <div className="flex w-full flex-col items-center justify-between gap-3 text-xs text-zinc-500 sm:flex-row">
          <p>&copy; {year} Ahmad. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Designed &amp; built
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
            with using Next.js, Three.js &amp; Express JS
          </p>
        </div>
      </div>
    </footer>
  );
}
