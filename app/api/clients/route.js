import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

const GB = 1024 ** 3;
const QUOTA_PRESETS = [5, 20, 50, 100];

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const sb = getSupabaseAdmin();
  const [{ data: clients }, { data: profiles }, { data: files }] = await Promise.all([
    sb.from("clients").select("*").order("created_at", { ascending: false }),
    sb.from("profiles").select("id,email,full_name,client_id,role"),
    sb.from("files").select("client_id,file_size").eq("archived", false),
  ]);

  const storageByClient = new Map();
  for (const f of files ?? []) {
    if (f.client_id) {
      storageByClient.set(f.client_id, (storageByClient.get(f.client_id) || 0) + (f.file_size || 0));
    }
  }

  const enriched = (clients ?? []).map((c) => {
    const actualStorageUsed = storageByClient.get(c.id) || 0;
    return {
      id: c.id,
      company_name: c.company_name,
      contact_email: c.contact_email,
      is_active: c.is_active,
      storage_used: actualStorageUsed,
      storage_used_gb: Number((actualStorageUsed / GB).toFixed(2)),
      storage_limit_gb: Number((Number(c.storage_limit) / GB).toFixed(0)),
      no_portal_limit: c.no_portal_limit,
      members: (profiles ?? []).filter((p) => p.client_id === c.id).map((p) => ({ id: p.id, email: p.email, full_name: p.full_name })),
    };
  });

  const quotaPresetsGb = [...QUOTA_PRESETS];
  return NextResponse.json({ success: true, clients: enriched, quotaPresetsGb });
}

export async function POST(request) {
  if (!isDbConfigured()) return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (!body.companyName?.trim()) {
    return NextResponse.json({ success: false, message: "Company name is required." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const limitGb = Number(body.storageLimitGb ?? 5);
  const { data: client, error } = await sb
    .from("clients")
    .insert({
      company_name: body.companyName.trim().slice(0, 120),
      contact_email: body.contactEmail?.trim() || null,
      storage_limit: Math.round(limitGb * GB),
    })
    .select("id,company_name")
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await sb.from("activity_logs").insert({
    actor_profile_id: session.user.profileId,
    client_id: client.id,
    action: "client.created",
    entity_type: "client",
    entity_id: client.id,
    metadata: { company_name: client.company_name },
  });

  return NextResponse.json({ success: true, client });
}
