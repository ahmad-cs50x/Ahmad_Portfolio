import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "edge";

const GB = 1024 ** 3;

export async function PATCH(request, { params }) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {};

  if (body.storageLimitGb !== undefined && body.storageLimitGb !== null) {
    patch.storage_limit = Math.round(Number(body.storageLimitGb) * GB);
  }
  if (typeof body.noPortalLimit === "boolean") patch.no_portal_limit = body.noPortalLimit;
  if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
  if (typeof body.companyName === "string" && body.companyName.trim()) patch.company_name = body.companyName.trim();

  if (!Object.keys(patch).length) {
    return NextResponse.json({ success: false, message: "Nothing to update." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("clients")
    .update(patch)
    .eq("id", id)
    .select("id,company_name,is_active,no_portal_limit,storage_limit")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });

  await sb.from("activity_logs").insert({
    actor_profile_id: session.user.profileId,
    client_id: id,
    action: "client.updated",
    entity_type: "client",
    entity_id: id,
    metadata: patch,
  });

  return NextResponse.json({ success: true, client: data });
}
