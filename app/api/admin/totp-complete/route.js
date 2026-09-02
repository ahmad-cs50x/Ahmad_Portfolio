import { NextResponse } from "next/server";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST() {
  if (!isDbConfigured()) return NextResponse.redirect(new URL("/admin/setup-totp?error=db", "/"));

  const session = await requireSuperAdmin();
  if (!session) return NextResponse.redirect(new URL("/admin/setup-totp?error=auth", "/"));

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("settings").upsert({
    key: "totp_setup",
    value: { done: true, completed_by: session.user.profileId, completed_at: new Date().toISOString() },
  });

  if (error) return NextResponse.redirect(new URL("/admin/setup-totp?error=save", "/"));

  return NextResponse.redirect(new URL("/admin", "/"));
}