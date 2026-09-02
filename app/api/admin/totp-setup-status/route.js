import { NextResponse } from "next/server";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: true, done: false });

  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdmin();
  const { data } = await sb.from("settings").select("value").eq("key", "totp_setup").maybeSingle();
  return NextResponse.json({ success: true, done: Boolean(data?.value?.done) });
}