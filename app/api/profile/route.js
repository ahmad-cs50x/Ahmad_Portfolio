import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { COMMON_TIMEZONES } from "@/lib/timezone";

export const runtime = "nodejs";

export async function PATCH(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session?.user?.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (typeof body.fullName === "string" && body.fullName.trim()) {
    patch.full_name = body.fullName.trim().slice(0, 80);
  }
  if (typeof body.timezone === "string") {
    try {
      new Intl.DateTimeFormat("en-GB", { timeZone: body.timezone }).format(new Date());
      patch.timezone = body.timezone;
    } catch {
      return NextResponse.json({ success: false, message: "Invalid timezone. Use an IANA name like Asia/Karachi." }, { status: 400 });
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ success: false, message: "Nothing to update." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("profiles").update(patch).eq("id", session.user.profileId);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ success: true, commonTimezones: COMMON_TIMEZONES });
}
