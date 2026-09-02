"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogIn } from "lucide-react";
import Magnetic from "./Magnetic";



const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Work", href: "#projects" },
  { label: "Journey", href: "#experience" },
  { label: "Contact", href: "#contact" },
  { label: "Blog", href: "#blog" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = navLinks.map((l) => l.href.slice(1));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-ink/70 backdrop-blur-xl" : ""
        }`}
    >
      <div className="container-tight flex items-center justify-between max-w-full py-3.5 ">

        <a href="#home" className="font-display text-2xl font-bold text-white">
          Ahmad<span className="text-gradient">.</span>
        </a>

        <nav className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`relative pb-1 text-sm tracking-wide transition-colors ${active === link.href ? "text-white" : "text-zinc-400 hover:text-white"
                    }`}
                >
                  {link.label}
                  {active === link.href && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    />
                  )}
                </a>
              </li>
            ))}

          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
            <a href="#contact" className="btn-primary font-light px-5 py-2.5 text-sm text-white">
          <Magnetic strength={0.25}>
              Hire Me
          </Magnetic>
            </a>
          <a href="/login" className="btn-ghost px-4 py-2.5 text-sm">
            <LogIn className="h-4 w-4 text-violet-300" />
            Login
          </a>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="glass grid h-11 w-11 place-items-center rounded-xl text-white lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-white/10 bg-ink/95 backdrop-blur-xl lg:hidden"
          >
            <ul className="container-tight flex flex-col gap-1 py-6">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-4 py-3 text-base transition-colors ${active === link.href
                        ? "bg-white/5 text-white"
                        : "text-zinc-400 hover:text-white"
                      }`}
                  >
                    {link.label}
                  </a>
                </li>
              ))}

              <li className="flex gap-3 px-4 pt-3">
                <a
                  href="#contact"
                  onClick={() => setOpen(false)}
                  className="btn-primary flex-1 px-4 py-3"
                >
                  Hire Me
                </a>
                <a
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn-ghost px-5 py-3"
                >
                  <LogIn className="h-4 w-4 text-violet-300" />
                  Login
                </a>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
