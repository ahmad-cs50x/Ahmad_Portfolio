import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
import { publish, channels } from "@/lib/realtime";

export const runtime = "edge";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session?.user?.profileId) return NextResponse.json({ success: true, notifications: [] });

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("profile_id", session.user.profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ success: true, notifications: data ?? [] });
}

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session?.user?.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sb = getSupabaseAdmin();

  if (body.id) {
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id).eq("profile_id", session.user.profileId);
  } else {
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("profile_id", session.user.profileId).is("read_at", null);
  }

  publish(channels.user(session.user.profileId), "refresh", {});
  return NextResponse.json({ success: true });
}
