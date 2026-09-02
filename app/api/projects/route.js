import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope, requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const scope = await resolveClientScope(session, params.get("clientId"));
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  let query = sb.from("projects").select("*").order("updated_at", { ascending: false }).limit(200);
  if (scope.clientId) query = query.eq("client_id", scope.clientId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, projects: data ?? [] });
}

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Only the admin can create projects." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const isPortfolio = Boolean(body.isPortfolio);
  if ((!isPortfolio && !body.clientId) || !body.title?.trim()) {
    return NextResponse.json({ success: false, message: isPortfolio ? "title is required." : "clientId and title are required." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Find the next unique gradient index
  const { data: existing } = await sb
    .from("projects")
    .select("gradient_index")
    .neq("status", "archived");
  const usedIndices = new Set((existing || []).map((p) => p.gradient_index));
  let nextIndex = 0;
  while (usedIndices.has(nextIndex)) nextIndex++;

  const allowedStatuses = ["project", "planning", "in-progress", "review", "completed", "archived"];
  const status = allowedStatuses.includes(body.status) ? body.status : "project";

  const { data: project, error } = await sb
    .from("projects")
    .insert({
      client_id: body.isPortfolio ? null : body.clientId,
      title: body.title.trim().slice(0, 160),
      description: body.description?.slice(0, 4000) ?? null,
      status,
      live_demo_url: body.liveDemoUrl || null,
      video_explanation_url: body.videoUrl || null,
      source_zip_url: body.zipUrl || null,
      github_url: body.githubUrl || null,
      documentation_url: body.docsUrl || null,
      drive_url: body.driveUrl || null,
      tech_stack: body.techStack || null,
      cover_image: body.coverImage || null,
      featured: Boolean(body.featured),
      is_portfolio: Boolean(body.isPortfolio),
      gradient_index: nextIndex,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  if (Array.isArray(body.milestones)) {
    const rows = body.milestones.filter((m) => m?.title?.trim()).map((m, i) => ({
      project_id: project.id,
      title: m.title.trim(),
      position: i,
    }));
    if (rows.length) await sb.from("milestones").insert(rows);
  }

  await sb.from("activity_logs").insert({
    actor_profile_id: session.user.profileId,
    client_id: isPortfolio ? null : body.clientId,
    action: "project.created",
    entity_type: "project",
    entity_id: project.id,
    metadata: { title: project.title },
  });

  return NextResponse.json({ success: true, project });
}
