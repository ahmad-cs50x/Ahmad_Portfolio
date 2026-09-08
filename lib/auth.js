import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/db";
import SupabaseAdapter from "@/lib/auth-supabase-adapter";
import { checkSignInAllowed, markInviteAccepted, pendingInviteFor, inviteFromToken } from "@/lib/invites";
import { verifyPassword } from "@/lib/password";
import { getSession } from "next-auth/react";

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const PLACEHOLDER_SECRETS = new Set([
  "dev-only-insecure-secret-change-me",
  "run-this-to-generate-one--openssl-rand-base64-32",
]);

const AUTH_SECRET =
  process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev-only-insecure-secret-change-me";

if (PLACEHOLDER_SECRETS.has(AUTH_SECRET.trim())) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is still a placeholder. Generate a real one with: openssl rand -base64 32"
    );
  }
  console.warn(
    "[auth] AUTH_SECRET is a placeholder — fine for local dev, but generate a real one before deploying: openssl rand -base64 32"
  );
}

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isEmailAuthConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && getSupabaseAdmin());
}

function smtpTransportOptions() {
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  };
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
  if (existing) return existing;

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

function verificationEmailHtml(url) {
  return `
  <div style="background:#050505;padding:40px;font-family:sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#101014;border:1px solid #26262e;border-radius:16px;padding:32px;text-align:center">
      <h1 style="color:#fff;font-size:22px;margin:0 0 12px">Sign in to Ahmad's Portal</h1>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px">
        Click the button below to sign in. This link expires in 24 hours and can only be used once.
      </p>
      <a href="${url}" style="display:inline-block;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 32px;border-radius:12px">
        Sign In
      </a>
      <p style="color:#52525b;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
    </div>
  </div>`;
}

/**
 * Reasons a sign-in was refused, mapped to the `?error=` codes that
 * app/login/page.js knows how to explain. NextAuth only ever hands the browser
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
 * Returning a string from the `signIn` callback tells NextAuth to redirect
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

export const authOptions = {
  adapter: SupabaseAdapter(),
  secret: AUTH_SECRET,
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
          EmailProvider({
            server: smtpTransportOptions(),
            from: `"Ahmad Portfolio" <${process.env.SMTP_USER}>`,
            maxAge: 24 * 60 * 60,
            // Custom sender so the branded template is actually used, and so
            // SMTP failures surface as an error instead of a silent success.
            async sendVerificationRequest({ identifier, url }) {
              const transport = nodemailer.createTransport(smtpTransportOptions());
              const result = await transport.sendMail({
                to: identifier,
                from: `"Ahmad Portfolio" <${process.env.SMTP_USER}>`,
                subject: "Sign in to Ahmad's Portal",
                text: `Sign in to Ahmad's Portal\n\n${url}\n\nThis link expires in 24 hours and can only be used once.\nIf you didn't request this, ignore this email.\n`,
                html: verificationEmailHtml(url),
              });
              const failed = [...(result.rejected || []), ...(result.pending || [])].filter(
                Boolean
              );
              if (failed.length) {
                throw new Error(`Email (${failed.join(", ")}) could not be sent`);
              }
            },
          }),
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
        if (!credentials?.email || !credentials?.password) return null;

        const sb = getSupabaseAdmin();
        if (!sb) return null;

        const normalizedEmail = credentials.email.toLowerCase().trim();

        // Check if user has a profile (was invited and accepted)
        const { data: profile, error: profileError } = await sb
          .from("profiles")
          .select("id, email, full_name, role, client_id, timezone")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (profileError || !profile) {
          // No profile means they were never invited or didn't accept
          return null;
        }

        // Check if user exists in NextAuth users table
        const { data: user, error: userError } = await sb
          .from("users")
          .select("id, email, emailVerified")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (userError || !user) return null;

        // The password digest is stored on the credentials account row.
        const { data: account, error: accountError } = await sb
          .from("accounts")
          .select("providerAccountId, password_hash")
          .eq("provider", "credentials")
          .eq("user_id", user.id)
          .maybeSingle();

        if (accountError || !account) return null;

        // THIS is the check that was missing: only a correct password may sign
        // in. The hash is sha256(password + AUTH_SECRET) — see lib/password.js.
        if (!verifyPassword(credentials.password, account.password_hash)) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: profile.full_name,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * The invite gate. Runs for EVERY provider — Google included — because an
     * invite-only portal that anyone with a Google account can walk into is
     * only decorative.
     *
     * NextAuth calls this twice for the email provider: once when the link is
     * requested (`email.verificationRequest === true`) and again when it is
     * clicked. Gating the first call means an uninvited address never even
     * receives mail.
     */
    async signIn({ user, email }) {
      const address = user?.email;
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
    },

    /**
     * JWT strategy (required by the Credentials provider — see `session`
     * at the bottom). On first sign-in (`user` present) we resolve the app
     * profile and stamp role/clientId/timezone/profileId onto the token so
     * every `getServerSession` read below can rely on them without another
     * database round-trip.
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
      } else if (trigger === "update" && token?.profileId) {
        // The client called session.update() (e.g. after saving profile
        // settings). Re-read the row so the JWT reflects the saved timezone /
        // name on the very next read instead of keeping the stale values.
        const email = (token.email || "").toLowerCase();
        const profile = await loadProfile(email);
        if (profile) {
          token.timezone = profile.timezone ?? token.timezone;
          if (profile.full_name) token.name = profile.full_name;
          if (profile.client_id !== undefined) token.clientId = profile.client_id;
          if (profile.role) token.role = profile.role;
        }
      }
      return token;
    },

    /**
     * `session.strategy` is "jwt", so NextAuth gives us `{ session, token }`.
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
      if (token?.name && !session.user.name) session.user.name = token.name;

      return session;
    },

    /**
     * Redirect based on role after sign-in.
     */
    async redirect({ url, baseUrl, token }) {
      console.log("[DEBUG] Redirect callback called with:", { url, baseUrl });
      console.log("[DEBUG] Token in redirect:", token);
      if (token?.role === "CLIENT") {
        console.log("[DEBUG] Redirecting CLIENT to /client-portal");
        return `${baseUrl}/client-portal`;
      }
      console.log("[DEBUG] Default redirect to:", baseUrl);
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/auth/verify-request",
    error: "/login",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
}