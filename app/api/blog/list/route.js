import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("blog_posts")
    .select("id,title,slug,status,published_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ success: true, posts: data ?? [] });
}
