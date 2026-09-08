import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/totp";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/permissions";

export const runtime = "edge";

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured" }, { status: 503 });

  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { code, secret } = await request.json();
  if (!code || typeof code !== "string" || code.length !== 6 || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ success: false, message: "Invalid code format" }, { status: 400 });
  }
  if (!secret) return NextResponse.json({ success: false, message: "Secret required" }, { status: 400 });

  const valid = await verifyCode(secret, code);
  if (!valid) {
    return NextResponse.json({ success: false, message: "Invalid or expired code" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("settings").upsert({
    key: "totp_setup",
    value: { done: true, secret, completed_by: session.user.profileId, completed_at: new Date().toISOString() },
  });

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}