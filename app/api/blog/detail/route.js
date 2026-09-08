import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, message: "id required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: post } = await sb.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (!post) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });

  const { data: tagRows } = await sb
    .from("blog_post_tags")
    .select("tag:blog_tags(id,name)")
    .eq("post_id", id);

  return NextResponse.json({
    success: true,
    post: { ...post, tags: (tagRows ?? []).map((r) => r.tag).filter(Boolean) },
  });
}
