import { getSupabaseAdmin } from "@/lib/db";
import { projects as fallbackProjects } from "@/lib/data";
import ProjectsPage from "@/components/ProjectsPage";

export const metadata = {
  title: "Projects — Ahmad",
  description: "Browse all projects, open-source work, and case studies.",
};

export const revalidate = 0;

async function getProjects() {
  const sb = getSupabaseAdmin();
  if (!sb) return [];

  const { data: projects, error } = await sb
    .from("projects")
    .select("*")
    .eq("is_portfolio", true)
    .neq("status", "archived")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[works] failed to fetch projects:", error.message);
    return [];
  }

  return projects ?? [];
}

export default async function WorksPage() {
  const dbProjects = await getProjects();

  const allProjects = dbProjects.length > 0
    ? dbProjects
    : fallbackProjects.map((p, i) => ({
        id: `fallback-${i}`,
        title: p.title,
        description: p.description,
        tech_stack: p.tags?.join(", ") || "",
        cover_image: null,
        github_url: p.repo,
        live_demo_url: p.demo,
        video_explanation_url: null,
        featured: false,
        status: "completed",
        gradient_index: i,
        created_at: new Date().toISOString(),
      }));

  return <ProjectsPage projects={allProjects} />;
}