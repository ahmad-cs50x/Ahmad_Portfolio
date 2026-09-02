import { NextResponse } from "next/server";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("blog_categories").select("id,name,slug").order("name");
  return NextResponse.json({ success: true, categories: data ?? [] });
}
