"use client";

import { useState } from "react";
import { Mail, MapPin, Zap, Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";
import Magnetic from "./Magnetic";
import { toast } from "./Toast";
import { socials } from "@/lib/data";

const API_URL = "";

const INITIAL_FORM = { name: "", email: "", subject: "", message: "" };

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-violet-500/20";

const infoItems = [
  { Icon: Mail, label: "Mail me at", value: "ahmedcs50x@gmail.com" },
  { Icon: MapPin, label: "Based in", value: "Remote — Worldwide" },
  { Icon: Zap, label: "Response time", value: "Within 24 hours" },
];

export default function Contact() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState("idle");

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to send message.");
      }
      toast.success(data.message || "Message sent successfully!");
      setForm(INITIAL_FORM);
      setStatus("idle");
    } catch (err) {
      toast.error(err.message || "Network error — is the backend running?");
      setStatus("idle");
    }
  }

  return (
    <section id="contact" className="section">
      <div className="container-tight relative">
        <SectionHeading
          eyebrow="05 · contact"
          title="Let's Build Something Great"
          description="Have a project in mind, a role to fill, or just want to say hi? My inbox is always open."
        />

        <div className="grid gap-10 lg:grid-cols-5">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Reveal>
              <p className="leading-relaxed text-zinc-400">
                Whether you have a question, a proposal, or just want to talk shop about the web —
                I&apos;ll do my best to get back to you quickly.
              </p>
            </Reveal>

            <div className="flex flex-col gap-4">
              {infoItems.map((item, i) => (
                <Reveal key={item.label} delay={0.1 + i * 0.08}>
                  <div className="glass flex items-center gap-4 rounded-xl p-4 transition-colors hover:border-violet-500/30">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300">
                      <item.Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-[11px] uppercase tracking-wider text-zinc-500">
                        {item.label}
                      </span>
                      <span className="block text-sm font-medium text-white">{item.value}</span>
                    </span>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.35}>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">
                Find me on
              </p>
              <div className="flex gap-3">
                {socials.map(({ label, href, Icon }) => (
                  <Magnetic key={label} strength={0.4}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      className="glass grid h-11 w-11 place-items-center rounded-xl text-zinc-400 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/50 hover:text-white"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  </Magnetic>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.15} className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="glass relative overflow-hidden rounded-3xl p-7 md:p-9"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl"
              />

              <div className="relative grid gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Your Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={onChange}
                    placeholder="John Doe"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Your Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onChange}
                    placeholder="john@example.com"
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="subject" className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Subject
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    maxLength={120}
                    value={form.subject}
                    onChange={onChange}
                    placeholder="Project inquiry, collaboration, hello..."
                    className={inputCls}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="message" className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-400">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    minLength={10}
                    maxLength={2000}
                    value={form.message}
                    onChange={onChange}
                    placeholder="Tell me about your project..."
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="btn-primary text-white px-8 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "sending" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
