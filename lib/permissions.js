import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.email) return null;
  return session;
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export function isSuperAdmin(session) {
  return session?.user?.role === "SUPER_ADMIN";
}

/**
 * Resolves which client's data the current session may access.
 * - SUPER_ADMIN: any clientId they pass (or all when none given).
 * - CLIENT: strictly their own linked client_id.
 * Returns { ok, clientId?, forbidden? }
 */
export async function resolveClientScope(session, requestedClientId) {
  if (!session?.user) return { ok: false };
  if (isSuperAdmin(session)) {
    return { ok: true, clientId: requestedClientId ?? null };
  }
  const ownId = session.user.clientId;
  if (!ownId) return { ok: false, forbidden: true };
  if (requestedClientId && requestedClientId !== ownId) {
    return { ok: false, forbidden: true };
  }
  return { ok: true, clientId: ownId };
}

export async function getProfileById(profileId) {
  const sb = getSupabaseAdmin();
  if (!sb || !profileId) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", profileId).maybeSingle();
  return data ?? null;
}
