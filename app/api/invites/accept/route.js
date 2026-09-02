import { NextResponse } from "next/server";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }

  const plainToken = request.nextUrl.searchParams.get("token");
  if (!plainToken) {
    return NextResponse.redirect(new URL("/login?error=MissingToken", request.url));
  }

  const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");

  const sb = getSupabaseAdmin();
  const { data: invite } = await sb
    .from("invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite) {
    return NextResponse.redirect(new URL("/login?error=InvalidToken", request.url));
  }
  
  if (invite.revoked_at || new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL("/login?error=ExpiredToken", request.url));
  }

  if (!invite.accepted_at) {
    await sb.from("invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  }

  const autoLoginUrl = new URL("/login", request.url);
  autoLoginUrl.hash = `autoEmail=${encodeURIComponent(invite.email)}&autoPassword=${encodeURIComponent(invite.password)}`;
  
  return NextResponse.redirect(autoLoginUrl);
}