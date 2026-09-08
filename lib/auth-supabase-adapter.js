import { getSupabaseAdmin } from "@/lib/db";

const randomUUID = () => crypto.randomUUID();

/**
 * NextAuth v4 adapter backed by Supabase (service-role key, bypasses RLS).
 *
 * Two things about this file are load-bearing — please keep them in mind
 * before refactoring:
 *
 * 1. NextAuth DESTRUCTURES adapter methods, e.g.
 *      const { getSessionAndUser, deleteSession } = adapter
 *    (see next-auth/core/routes/session.js and core/lib/callback-handler.js).
 *    That means `this` is undefined inside these methods. Never use `this` —
 *    call the standalone functions below directly.
 *
 * 2. Postgres `timestamptz` comes back from Supabase as an ISO *string*, but
 *    NextAuth calls `.valueOf()` and `.toISOString()` on `session.expires`
 *    and treats `emailVerified` as a Date. Every value leaving this adapter
 *    must therefore be coerced with toDate().
 */

const toDate = (value) => {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
};

/**
 * Turns a raw PostgREST/fetch error into something that says what to DO.
 *
 * Why this matters: when a write here fails, NextAuth catches the throw and
 * redirects to `/login?error=OAuthCreateAccount` — the user just lands back on
 * the login page. The only trace is this server log, so it has to name the
 * actual cause instead of a bare string like
 * "Could not find the table 'public.users' in the schema cache".
 */
function describe(operation, error) {
  const raw = error?.message || String(error);

  if (/does not exist|schema cache|not find the table/i.test(raw)) {
    return `${operation}: the Auth.js tables are missing from Supabase. Apply the migration with: npm run db:migrate  (original: ${raw})`;
  }
  if (/row-level security|permission denied/i.test(raw)) {
    return `${operation}: blocked by row-level security — SUPABASE_SERVICE_ROLE_KEY is probably an anon key. Copy the service_role key from Supabase → Project Settings → API. (original: ${raw})`;
  }
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|timeout/i.test(raw)) {
    return `${operation}: cannot reach Supabase — check NEXT_PUBLIC_SUPABASE_URL and your network. (original: ${raw})`;
  }
  if (/invalid api key|JWT|401/i.test(raw)) {
    return `${operation}: Supabase rejected the API key. Re-copy SUPABASE_SERVICE_ROLE_KEY (no quotes, no trailing spaces). (original: ${raw})`;
  }
  return `${operation}: ${raw}`;
}

/** Log + throw for writes NextAuth must not silently swallow. */
function fail(operation, error) {
  const message = describe(operation, error);
  console.error(`[adapter] ${message}`);
  const wrapped = new Error(message);
  wrapped.cause = error;
  throw wrapped;
}

/** Log only, for reads where returning null is the correct fallback. */
function soft(operation, error) {
  console.error(`[adapter] ${describe(operation, error)}`);
}

const toIso = (value) => {
  const date = toDate(value);
  return date ? date.toISOString() : null;
};

/** Shape a raw `users` row into what NextAuth expects. */
const mapUser = (row) =>
  row
    ? {
        id: row.id,
        name: row.name ?? null,
        email: row.email,
        emailVerified: toDate(row.emailVerified),
        image: row.image ?? null,
      }
    : null;

/** Shape a raw `sessions` row into what NextAuth expects. */
const mapSession = (row) =>
  row
    ? {
        id: row.id,
        sessionToken: row.sessionToken,
        userId: row.user_id,
        expires: toDate(row.expires),
      }
    : null;

export default function SupabaseAdapter() {
  // Methods no-op safely when Supabase isn't configured, so NextAuth treats
  // requests as unauthenticated instead of throwing at import time.
  const db = () => getSupabaseAdmin();
  const ready = () => Boolean(db());

  async function getUser(id) {
    if (!ready() || !id) return null;
    const { data, error } = await db().from("users").select("*").eq("id", id).maybeSingle();
    if (error) {
      soft("getUser failed", error);
      return null;
    }
    return mapUser(data);
  }

  async function createUser(user) {
    if (!ready()) return null;
    const row = {
      id: user.id ?? randomUUID(),
      name: user.name ?? null,
      email: user.email,
      emailVerified: toIso(user.emailVerified),
      image: user.image ?? null,
    };
    const { data, error } = await db().from("users").insert(row).select("*").single();
    if (error) fail("createUser failed", error);
    return mapUser(data);
  }

  async function getUserByEmail(email) {
    if (!ready() || !email) return null;
    const { data, error } = await db()
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      soft("getUserByEmail failed", error);
      return null;
    }
    return mapUser(data);
  }

  async function getUserByAccount({ provider, providerAccountId }) {
    if (!ready()) return null;
    // Two simple queries instead of a PostgREST embed — the embed relies on the
    // exact FK constraint name and silently returns null if it ever changes.
    const { data: account, error } = await db()
      .from("accounts")
      .select("user_id")
      .eq("provider", provider)
      .eq("providerAccountId", providerAccountId)
      .maybeSingle();
    if (error) {
      soft("getUserByAccount failed", error);
      return null;
    }
    if (!account?.user_id) return null;
    return getUser(account.user_id);
  }

  async function updateUser(user) {
    if (!ready()) return null;
    const patch = {};
    if (user.name !== undefined) patch.name = user.name;
    if (user.email !== undefined) patch.email = user.email;
    if (user.emailVerified !== undefined) patch.emailVerified = toIso(user.emailVerified);
    if (user.image !== undefined) patch.image = user.image;

    if (Object.keys(patch).length === 0) return getUser(user.id);

    const { data, error } = await db()
      .from("users")
      .update(patch)
      .eq("id", user.id)
      .select("*")
      .single();
    if (error) fail("updateUser failed", error);
    return mapUser(data);
  }

  async function deleteUser(userId) {
    if (!ready()) return;
    await db().from("users").delete().eq("id", userId);
  }

  async function linkAccount(account) {
    if (!ready()) return account;
    const row = {
      id: randomUUID(),
      user_id: account.userId,
      type: account.type,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      refresh_token: account.refresh_token ?? null,
      access_token: account.access_token ?? null,
      expires_at: account.expires_at ?? null,
      token_type: account.token_type ?? null,
      scope: account.scope ?? null,
      id_token: account.id_token ?? null,
      session_state: account.session_state ?? null,
    };
    const { error } = await db().from("accounts").insert(row);
    if (error) fail("linkAccount failed", error);
    return account;
  }

  async function unlinkAccount({ provider, providerAccountId }) {
    if (!ready()) return;
    // .delete() must come before the filters.
    const { error } = await db()
      .from("accounts")
      .delete()
      .eq("provider", provider)
      .eq("providerAccountId", providerAccountId);
    if (error) soft("unlinkAccount failed", error);
  }

  async function createSession({ sessionToken, userId, expires }) {
    if (!ready()) return null;
    const row = {
      id: randomUUID(),
      sessionToken,
      user_id: userId,
      expires: toIso(expires),
    };
    const { data, error } = await db().from("sessions").insert(row).select("*").single();
    if (error) fail("createSession failed", error);
    return mapSession(data);
  }

  async function getSessionAndUser(sessionToken) {
    if (!ready() || !sessionToken) return null;
    const { data: session, error } = await db()
      .from("sessions")
      .select("*")
      .eq("sessionToken", sessionToken)
      .maybeSingle();
    if (error) {
      soft("getSessionAndUser failed", error);
      return null;
    }
    if (!session?.user_id) return null;

    // NOTE: standalone call, not `this.getUser` — see file header.
    const user = await getUser(session.user_id);
    if (!user) return null;

    return { session: mapSession(session), user };
  }

  async function updateSession(session) {
    if (!ready() || !session?.sessionToken) return null;
    const patch = {};
    if (session.expires) patch.expires = toIso(session.expires);
    if (Object.keys(patch).length === 0) return null;

    const { data, error } = await db()
      .from("sessions")
      .update(patch)
      .eq("sessionToken", session.sessionToken)
      .select("*")
      .maybeSingle();
    if (error) {
      soft("updateSession failed", error);
      return null;
    }
    return mapSession(data);
  }

  async function deleteSession(sessionToken) {
    if (!ready() || !sessionToken) return;
    const { error } = await db().from("sessions").delete().eq("sessionToken", sessionToken);
    if (error) soft("deleteSession failed", error);
  }

  async function createVerificationToken(token) {
    if (!ready()) return null;
    const { data, error } = await db()
      .from("verification_tokens")
      .insert({
        identifier: token.identifier,
        token: token.token,
        expires: toIso(token.expires),
      })
      .select("*")
      .single();
    if (error) fail("createVerificationToken failed", error);
    return { ...data, expires: toDate(data.expires) };
  }

  async function useVerificationToken({ identifier, token }) {
    if (!ready()) return null;
    const { data, error } = await db()
      .from("verification_tokens")
      .select("*")
      .eq("identifier", identifier)
      .eq("token", token)
      .maybeSingle();
    if (error) {
      soft("useVerificationToken failed", error);
      return null;
    }
    if (!data) return null;

    // Single-use: consume it before returning.
    const { error: deleteError } = await db()
      .from("verification_tokens")
      .delete()
      .eq("identifier", identifier)
      .eq("token", token);
    if (deleteError) {
      soft("useVerificationToken cleanup failed", deleteError);
    }

    return { ...data, expires: toDate(data.expires) };
  }

  return {
    createUser,
    getUser,
    getUserByEmail,
    getUserByAccount,
    updateUser,
    deleteUser,
    linkAccount,
    unlinkAccount,
    createSession,
    getSessionAndUser,
    updateSession,
    deleteSession,
    createVerificationToken,
    useVerificationToken,
  };
}
