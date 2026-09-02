import { NextResponse } from "next/server";
import { requireAuth, resolveClientScope, isSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const GB = 1024 ** 3;

export async function GET(request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  }
  const session = await requireAuth();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const sb = getSupabaseAdmin();
  const params = new URL(request.url).searchParams;

  if (isSuperAdmin(session) && params.get("all") === "true") {
    const { data } = await sb.from("clients").select("id,company_name,storage_limit,storage_used,no_portal_limit").order("company_name");
    const clients = (data ?? []).map((c) => ({
      ...c,
      percent: c.no_portal_limit ? null : Math.min(100, Math.round((Number(c.storage_used) / Math.max(1, Number(c.storage_limit))) * 100)),
    }));
    return NextResponse.json({ success: true, clients });
  }

  const scope = await resolveClientScope(session, params.get("clientId"));
  if (!scope.ok) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  if (!scope.clientId) return NextResponse.json({ success: false, message: "clientId required." }, { status: 400 });

  const { data: client } = await sb
    .from("clients")
    .select("storage_limit,storage_used,no_portal_limit")
    .eq("id", scope.clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });

  const usedGb = Number(client.storage_used) / GB;
  return NextResponse.json({
    success: true,
    usage: {
      used_bytes: Number(client.storage_used),
      limit_bytes: client.no_portal_limit ? null : Number(client.storage_limit),
      no_limit: client.no_portal_limit,
      used_gb: Number(usedGb.toFixed(2)),
      limit_gb: client.no_portal_limit ? null : Number((Number(client.storage_limit) / GB).toFixed(1)),
      percent: client.no_portal_limit
        ? null
        : Math.min(100, Math.round((Number(client.storage_used) / Math.max(1, Number(client.storage_limit))) * 100)),
    },
  });
}
