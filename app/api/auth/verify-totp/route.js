import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/totp";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "edge";

/**
 * Verifies the 6-digit TOTP code that the user enters on the /auth/totp-gate
 * page before Google sign-in. The ONLY accepted secret is the one the admin
 * portal TOTP setup page created (stored in the `settings` table after the
 * QR code was scanned and verified). It never falls back to a raw env secret
 * unless the database secret is entirely missing.
 */
export async function POST(request) {
  try {
    const { code, provider } = await request.json();

    if (!code || typeof code !== "string" || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, message: "Invalid code format." }, { status: 400 });
    }

    if (provider !== "google") {
      return NextResponse.json({ success: false, message: "Unsupported provider." }, { status: 400 });
    }

    if (!isDbConfigured()) {
      console.error("[verify-totp] database not configured");
      return NextResponse.json({ success: false, message: "Server misconfiguration." }, { status: 500 });
    }

    // Read the exact secret created by the admin TOTP setup page.
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("settings")
      .select("value")
      .eq("key", "totp_setup")
      .maybeSingle();

    if (error) {
      console.error("[verify-totp] settings read failed:", error.message);
      return NextResponse.json({ success: false, message: "Verification failed." }, { status: 500 });
    }

    const secret = data?.value?.secret;
    if (!secret) {
      console.error("[verify-totp] no TOTP secret configured. Complete /admin/setup-totp first.");
      return NextResponse.json({ success: false, message: "Server misconfiguration." }, { status: 500 });
    }

    const valid = await verifyCode(secret, code);
    if (!valid) {
      return NextResponse.json({ success: false, message: "Invalid or expired code." }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[verify-totp] error:", err);
    return NextResponse.json({ success: false, message: "Verification failed." }, { status: 500 });
  }
}
