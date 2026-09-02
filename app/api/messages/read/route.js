import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireAuth();
  if (!session || !session.user.profileId) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const scope = await resolveClientScope(session, body.clientId);
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  if (!scope.clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

  const sb = getSupabaseAdmin();
  await sb
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", scope.clientId)
    .neq("sender_profile_id", session.user.profileId)
    .is("read_at", null);

  return NextResponse.json({ success: true });
}
