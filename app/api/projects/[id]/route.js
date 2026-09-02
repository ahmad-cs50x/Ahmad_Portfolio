import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const FIELDS = {
  title: "title",
  description: "description",
  status: "status",
  progress: "progress",
  live_demo_url: "liveDemoUrl",
  video_explanation_url: "videoUrl",
  source_zip_url: "zipUrl",
  github_url: "githubUrl",
  documentation_url: "docsUrl",
  drive_url: "driveUrl",
  tech_stack: "techStack",
  cover_image: "coverImage",
  featured: "featured",
  gradient_index: "gradientIndex",
  is_portfolio: "isPortfolio",
  client_id: "clientId",
};

export async function GET(request, { params }) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  const [{ data: project }, { data: milestones }] = await Promise.all([
    sb.from("projects").select("*, client:clients(company_name)").eq("id", params.id).maybeSingle(),
    sb.from("milestones").select("*").eq("project_id", params.id).order("position"),
  ]);
  if (!project) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ success: true, project, milestones: milestones ?? [] });
}

export async function PATCH(request, { params }) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const sb = getSupabaseAdmin();

  const patch = {};
  for (const [dbField, apiKey] of Object.entries(FIELDS)) {
    if (body[apiKey] !== undefined) {
      if (dbField === "progress") {
        const value = Math.max(0, Math.min(100, Number(body[apiKey]) || 0));
        patch[dbField] = value;
      } else if (dbField === "gradient_index") {
        patch[dbField] = Math.max(0, Math.min(7, Number(body[apiKey]) || 0));
      } else if (dbField === "status") {
        if (["project", "planning", "in-progress", "review", "completed", "archived"].includes(body[apiKey])) {
          patch.status = body[apiKey];
        }
      } else if (dbField === "featured") {
        patch[dbField] = Boolean(body[apiKey]);
      } else if (dbField === "is_portfolio") {
        patch[dbField] = Boolean(body[apiKey]);
      } else if (dbField === "client_id") {
        // If project is portfolio, client_id must be null
        const isPortfolio = body.isPortfolio !== undefined ? Boolean(body.isPortfolio) : false;
        patch[dbField] = isPortfolio ? null : body[apiKey];
      } else {
        patch[dbField] = body[apiKey];
      }
    }
  }

  let project = null;
  if (Object.keys(patch).length) {
    const { data, error } = await sb.from("projects").update(patch).eq("id", params.id).select("*").maybeSingle();
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
    project = data;

    await sb.from("activity_logs").insert({
      actor_profile_id: session.user.profileId,
      client_id: data.client_id,
      action: "project.updated",
      entity_type: "project",
      entity_id: params.id,
      metadata: { title: data.title },
    });
  }

  if (Array.isArray(body.milestones)) {
    await sb.from("milestones").delete().eq("project_id", params.id);
    const rows = body.milestones
      .filter((m) => m?.title?.trim())
      .map((m, i) => ({
        project_id: params.id,
        title: String(m.title).trim().slice(0, 160),
        done: Boolean(m.done),
        position: i,
      }));
    if (rows.length) await sb.from("milestones").insert(rows);
  }

  return NextResponse.json({ success: true, project });
}

export async function DELETE(request, { params }) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("projects").update({ status: "archived" }).eq("id", params.id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, archived: true });
}
