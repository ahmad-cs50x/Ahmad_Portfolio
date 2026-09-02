import Preloader from "@/components/Preloader";
import Navbar from "@/components/Navbar";
import ScrollProgress from "@/components/ScrollProgress";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import About from "@/components/About";
import Skills from "@/components/Skills";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import BlogSection from "@/components/BlogSection";
import Footer from "@/components/Footer";
import { getSupabaseAdmin } from "@/lib/db";

/**
 * The blog section queries Supabase at render time, so this page must be
 * rendered per-request. Without this, `next build` snapshots the home page and
 * a post published afterwards never appears until the next deploy.
 */
export const revalidate = 0;

async function getHomeProjects() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data: projects } = await sb
    .from("projects")
    .select("*")
    .neq("status", "archived")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  return projects ?? [];
}

export default async function Home() {
  const dbProjects = await getHomeProjects();

  return (
    <>
      <Preloader />
      <ScrollProgress />
      <Navbar />
      <main className="relative">
        <Hero />
        <Marquee />
        <About />
        <Skills />
        <Projects dbProjects={dbProjects} />
        <Experience />
        <Contact />
        <BlogSection />
      </main>
      <Footer />
    </>
  );
}
