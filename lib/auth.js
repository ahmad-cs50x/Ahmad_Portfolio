import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getSupabaseAdmin } from "@/lib/db";
import SupabaseAdapter from "@/lib/auth-supabase-adapter";
import { checkSignInAllowed, markInviteAccepted, pendingInviteFor, inviteFromToken } from "@/lib/invites";
import { verifyPassword } from "@/lib/password";

const envAdmins = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const hardcodedAdmins = ['ranaahmadranaahmad741@gmail.com', 'ahmedcs50x@gmail.com'].map(e => e.toLowerCase());
const SUPER_ADMIN_EMAILS = [...new Set([...envAdmins, ...hardcodedAdmins])];

const PLACEHOLDER_SECRETS = new Set([
  "dev-only-insecure-secret-change-me",
  "run-this-to-generate-one--openssl-rand-base64-32",
]);

const AUTH_SECRET =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-insecure-secret-change-me";

if (PLACEHOLDER_SECRETS.has(AUTH_SECRET.trim())) {
  // In production builds (e.g. Cloudflare Pages CI) the env var is injected at deploy time,
  // not available during the static build phase. Never throw here — just warn.
  console.warn(
    "[auth] AUTH_SECRET is a placeholder — ensure it is set as a build-time environment variable before deploying."
  );
}


export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isEmailAuthConfigured() {
  return Boolean(process.env.TG_BOT_TOKEN && process.env.TG_CHAT_ID && getSupabaseAdmin());
}

/**
 * Creates the app-level `profiles` row for an email if it doesn't exist yet.
 * Idempotent and safe to call on every sign-in / session read.
 *
 * Role and workspace come from the invite the admin created, so inviting
 * someone as a SUPER_ADMIN, or into an existing client workspace, actually
 * takes effect the moment they sign in.
 *
 * The first account ever to sign in becomes SUPER_ADMIN unless
 * SUPER_ADMIN_EMAILS explicitly lists addresses.
 */
async function ensureProfile(email, inviteHint) {
  const sb = getSupabaseAdmin();
  if (!sb || !email) return null;

  const normalized = email.toLowerCase();

  const { data: existing } = await sb
    .from("profiles")
    .select("id,role,client_id,timezone,full_name")
    .eq("email", normalized)
    .maybeSingle();
  if (existing) {
    // Ensure hardcoded admins stay SUPER_ADMIN even if profile already exists
    const isAdmin = SUPER_ADMIN_EMAILS.includes(normalized);
    let updatedProfile = existing;

    if (isAdmin && existing.role !== "SUPER_ADMIN") {
      await sb.from("profiles").update({ role: "SUPER_ADMIN" }).eq("email", normalized);
      updatedProfile = { ...existing, role: "SUPER_ADMIN" };
    }

    // Update name from invite hint if provided and different
    if (inviteHint?.full_name && inviteHint.full_name !== existing.full_name) {
      await sb.from("profiles").update({ full_name: inviteHint.full_name }).eq("email", normalized);
      updatedProfile = { ...updatedProfile, full_name: inviteHint.full_name };
    }

    return updatedProfile;
  }

  const invite = inviteHint ?? (await pendingInviteFor(normalized));

  let role = "CLIENT";
  if (SUPER_ADMIN_EMAILS.length > 0) {
    if (SUPER_ADMIN_EMAILS.includes(normalized)) role = "SUPER_ADMIN";
  } else {
    // No explicit allowlist: bootstrap the very first user as the admin.
    const { count, error: countError } = await sb
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "SUPER_ADMIN");
    if (countError) {
      console.error("[auth] super-admin count failed:", countError.message);
    } else if (!count) {
      role = "SUPER_ADMIN";
    }
  }
  // An invite can promote, never demote — the env allowlist stays authoritative.
  if (invite?.role === "SUPER_ADMIN") role = "SUPER_ADMIN";

  let clientId = role === "CLIENT" ? invite?.client_id ?? null : null;
  if (role === "CLIENT" && !clientId) {
    const { data: client, error: clientError } = await sb
      .from("clients")
      .insert({
        company_name: invite?.company_name || normalized,
        contact_email: normalized,
      })
      .select("id")
      .single();
    if (clientError) {
      console.error("[auth] client insert failed:", clientError.message);
    } else {
      clientId = client?.id ?? null;
    }
  }

  const { data: created, error } = await sb
    .from("profiles")
    .insert({
      email: normalized,
      full_name: normalized.split("@")[0],
      role,
      client_id: clientId,
    })
    .select("id,role,client_id,timezone,full_name")
    .single();

  if (error) {
    // 23505 = unique violation: another concurrent request created it first.
    if (error.code === "23505") return loadProfile(normalized);
    console.error("[auth] profile insert failed:", error.message);
    return null;
  }

  return created;
}

async function loadProfile(email) {
  const sb = getSupabaseAdmin();
  if (!sb || !email) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id,role,client_id,timezone,full_name")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) {
    console.error("[auth] loadProfile failed:", error.message);
    return null;
  }
  return data ?? null;
}

/**
 * Sends the magic-link URL as a Telegram message via the Bot API —
 * Edge-runtime safe (fetch only, no SMTP).
 */
async function sendTelegramMessage(text) {
  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!botToken || !chatId) {
    throw new Error("Telegram is not configured (TG_BOT_TOKEN / TG_CHAT_ID).");
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: Number(chatId),
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(`Sign-in link could not be sent: ${data.description || response.status}`);
  }
}

/**
 * Telegram link provider — same browser flow as Auth.js's email provider
 * (identifier + one-time link), but delivery goes through the Bot API and it
 * never imports nodemailer, so it is safe to bundle on the Edge runtime.
 */
function TelegramLinkProvider() {
  return {
    id: "email",
    name: "Telegram",
    type: "email",
    maxAge: 24 * 60 * 60,
    async sendVerificationRequest({ identifier, url }) {
      await sendTelegramMessage(
        [
          "🔐 *Sign in to Ahmad's Portal*",
          "",
          identifier,
          "",
          url,
          "",
          "_This link expires in 24 hours and can only be used once._",
        ].join("\n")
      );
    },
  };
}

/**
 * Reasons a sign-in was refused, mapped to the `?error=` codes that
 * app/login/page.js knows how to explain. Auth.js only ever hands the browser
 * a code, so anything not in this map surfaces as a generic failure.
 */
const GATE_ERROR_CODES = {
  "not-invited": "NotInvited",
  "invite-expired": "InviteExpired",
  "no-database": "GateUnavailable",
  "database-error": "GateUnavailable",
  "no-email": "AccessDenied",
};

/**
 * Returning a string from the `signIn` callback tells Auth.js to redirect
 * there instead of showing its own error page. It must be absolute: the
 * next-auth browser client runs `new URL(data.url)` on the response, and a
 * relative path throws there.
 */
function refusalRedirect(code) {
  const base = (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/login?error=${encodeURIComponent(code)}`;
}

export const authConfig = {
  adapter: SupabaseAdapter(),
  secret: AUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
  providers: [
    ...(isGoogleConfigured()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(isEmailAuthConfigured()
      ? [
          TelegramLinkProvider(),
        ]
      : []),
    CredentialsProvider({
      id: "email-password",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@company.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn(`[auth] Missing credentials:`, !!credentials?.email, !!credentials?.password);
          return null;
        }

        const sb = getSupabaseAdmin();
        if (!sb) {
          console.error("[auth] Supabase client not available");
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        console.log(`[auth] Attempting sign-in for: ${normalizedEmail}`);

        try {
          // Check if user has a profile (was invited and accepted)
          const { data: profile, error: profileError } = await sb
            .from("profiles")
            .select("id, email, full_name, role, client_id, timezone")
            .eq("email", normalizedEmail)
            .maybeSingle();

          if (profileError) {
            console.error(`[auth] Profile query error:`, profileError.message);
            return null;
          }

          if (!profile) {
            console.warn(`[auth] No profile found for ${normalizedEmail}`);
            return null;
          }
          console.log(`[auth] Profile found: ${profile.id}, role: ${profile.role}`);

          // Check if user exists in Auth.js users table
          const { data: user, error: userError } = await sb
            .from("users")
            .select("id, email, emailVerified")
            .eq("email", normalizedEmail)
            .maybeSingle();

          if (userError) {
            console.error(`[auth] User query error:`, userError.message);
            return null;
          }

          if (!user) {
            console.warn(`[auth] No auth user found for ${normalizedEmail}`);
            return null;
          }
          console.log(`[auth] Auth user found: ${user.id}, verified: ${user.emailVerified}`);

          // The password digest is stored on the credentials account row.
          const { data: account, error: accountError } = await sb
            .from("accounts")
            .select("providerAccountId, password_hash")
            .eq("provider", "credentials")
            .eq("user_id", user.id)
            .maybeSingle();

          if (accountError) {
            console.error(`[auth] Account query error:`, accountError.message);
            return null;
          }

          if (!account) {
            console.warn(`[auth] No credentials account found for ${normalizedEmail}`);
            console.warn(`[auth] Check if password was set during invitation`);
            return null;
          }
          console.log(`[auth] Account found, verifying password...`);

          // THIS is the check that was missing: only a correct password may sign
          // in. The hash is sha256(password + AUTH_SECRET) — see lib/password.js.
          const isValid = await verifyPassword(credentials.password, account.password_hash);
          console.log(`[auth] Password valid: ${isValid}`);

          if (!isValid) {
            console.warn(`[auth] Invalid password for ${normalizedEmail}`);
            return null;
          }

          console.log(`[auth] Sign-in successful for ${normalizedEmail}`);
          return {
            id: user.id,
            email: user.email,
            name: profile.full_name,
          };
        } catch (error) {
          console.error(`[auth] Authorize error for ${normalizedEmail}:`, error.message, error.stack);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    /**
     * The invite gate. Runs for EVERY provider — Google included — because an
     * invite-only portal that anyone with a Google account can walk into is
     * only decorative.
     *
     * Auth.js calls this twice for the email provider: once when the link is
     * requested (`email.verificationRequest === true`) and again when it is
     * clicked. Gating the first call means an uninvited address never even
     * receives a link.
     */
    async signIn({ user, email, account }) {
      const address = user?.email;

      // Skip invite gate for credentials provider (password auth)
      if (account?.provider === "credentials") return true;

      try {
        // For OAuth providers (Google), check if user already exists with different provider
        if (account?.provider !== "credentials" && address) {
          const sb = getSupabaseAdmin();
          if (sb) {
            // Check if user exists with a different provider
            const { data: existingAccounts } = await sb
              .from("accounts")
              .select("provider, providerAccountId")
              .eq("user_id", user.id);

            const hasOtherProvider = existingAccounts?.some(
              acc => acc.provider !== account.provider
            );

            if (hasOtherProvider) {
              // Link the new OAuth account to the existing user
              try {
                await sb.from("accounts").insert({
                  id: crypto.randomUUID(),
                  user_id: user.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                });
                console.log(`[auth] Linked ${account.provider} account to existing user ${address}`);
              } catch (linkError) {
                console.error("[auth] Failed to link account:", linkError.message);
                // Continue anyway - let Auth.js handle the linking
              }
            }
          }
        }

        const gate = await checkSignInAllowed(address);

        if (!gate.allowed) {
          console.warn(`[auth] sign-in refused for ${address || "unknown"}: ${gate.reason}`);
          return refusalRedirect(GATE_ERROR_CODES[gate.reason] ?? "AccessDenied");
        }

        // Asking for a magic link is not signing in yet. Creating the profile now
        // would permanently whitelist the address (rule 2 of the gate) even if
        // the invite were revoked before the link was ever clicked.
        if (email?.verificationRequest) return true;

        // Make sure an app profile exists before the portal layouts read the role.
        await ensureProfile(address, gate.invite);
        await markInviteAccepted(address);
        return true;
      } catch (error) {
        console.error("[auth] signIn callback error:", error.message);
        return refusalRedirect("GateUnavailable");
      }
    },

    /**
     * JWT strategy (required by the Credentials provider — see `session`
     * at the bottom). On first sign-in (`user` present) we resolve the app
     * profile and stamp role/clientId/timezone/profileId onto the token so
     * every session read below can rely on them without another database
     * round-trip.
     */
    async jwt({ token, user, trigger }) {
      if (user) {
        const email = (user.email || "").toLowerCase();
        const profile = (await loadProfile(email)) ?? (await ensureProfile(email));
        token.id = user.id ?? null;
        token.role = profile?.role ?? "CLIENT";
        token.clientId = profile?.client_id ?? null;
        token.timezone = profile?.timezone ?? "Asia/Karachi";
        token.profileId = profile?.id ?? null;
        if (profile?.full_name) token.name = profile.full_name;
      } else if ((trigger === "update" || trigger === "getSession") && token?.email) {
        // Refresh the token whenever the client explicitly asks for an updated
        // session (via session.update() / `update()`) or when the session is
        // being fetched on subsequent page loads.  This ensures the JWT always
        // reflects the latest profile row (name, timezone, etc.) from the DB.
        const profile = await loadProfile(token.email.toLowerCase());
        if (profile) {
          token.timezone = profile.timezone ?? token.timezone;
          if (profile.full_name) token.name = profile.full_name;
          if (profile.client_id !== undefined) token.clientId = profile.client_id;
          if (profile.role) token.role = profile.role;
          token.profileId = profile.id;
        }
      }
      return token;
    },

    /**
     * `session.strategy` is "jwt", so Auth.js gives us `{ session, token }`.
     * Surface the fields the layouts and API routes consume (role, clientId,
     * timezone, profileId, id) from the token.
     */
    async session({ session, token }) {
      if (!session?.user) return session;

      session.user.id = token?.id ?? null;
      session.user.role = token?.role ?? "CLIENT";
      session.user.clientId = token?.clientId ?? null;
      session.user.timezone = token?.timezone ?? "Asia/Karachi";
      session.user.profileId = token?.profileId ?? null;
      // Always update name from token if available (handles profile updates)
      if (token?.name) session.user.name = token.name;

      return session;
    },
    redirect: async ({ url, baseUrl }, token) => {
      if (url === baseUrl || url === '/') {
        const role = token?.role || 'CLIENT';
        return role === 'SUPER_ADMIN' ? '/admin' : '/client-portal';
      }
      return url;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/auth/verify-request",
    error: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);