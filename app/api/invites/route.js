import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import {
  revokeInvite,
  isInviteMailConfigured,
  generateToken,
  hashToken,
  sendInviteNotification,
} from "@/lib/invites";
import { getSupabaseAdmin } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "edge";

export async function GET() {
  try {
    const session = await requireSuperAdmin();
    if (!session) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    const { data: invites, error } = await sb
      .from("invites")
      .select("*")
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: !error,
      invites: invites || [],
      mailConfigured: isInviteMailConfigured(),
      message: error?.message ?? null,
    });
  } catch (error) {
    console.error("GET /api/invites Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await requireSuperAdmin();
    if (!session) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const { email, password, role, clientId, companyName, note } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const sb = getSupabaseAdmin();

    // 1. CREATE OR ASSIGN WORKSPACE (CLIENT)
    let finalClientId = clientId || null;
    if (role === "CLIENT" && !finalClientId && companyName) {
      // Check if client workspace already exists by name
      const { data: existingClient } = await sb
        .from("clients")
        .select("id")
        .eq("company_name", companyName)
        .maybeSingle();

      if (existingClient) {
        finalClientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await sb
          .from("clients")
          .insert({ company_name: companyName, contact_email: normalizedEmail })
          .select("id")
          .single();

        if (clientError) {
          return NextResponse.json({ success: false, message: "Failed to create Workspace: " + clientError.message }, { status: 400 });
        }
        finalClientId = newClient.id;
      }
    }

    // 2. CREATE OR UPDATE NEXTAUTH USER
    let userId;
    const { data: existingUser } = await sb
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      userId = crypto.randomUUID();
      const { error: userError } = await sb.from("users").insert({
        id: userId,
        email: normalizedEmail,
        name: normalizedEmail.split("@")[0],
        emailVerified: new Date().toISOString(),
      });
      if (userError) {
        return NextResponse.json({ success: false, message: "Failed to create Auth User: " + userError.message }, { status: 400 });
      }
    }

    // 3. CREATE OR UPDATE CREDENTIALS ACCOUNT (Password Hash)
    const passwordHash = await hashPassword(password);

    // Check if account already exists for this provider
    const { data: existingAccount } = await sb
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "credentials")
      .maybeSingle();

    if (existingAccount) {
      const { error: updateAccError } = await sb
        .from("accounts")
        .update({ password_hash: passwordHash })
        .eq("id", existingAccount.id);

      if (updateAccError) {
        return NextResponse.json({ success: false, message: "Failed to update credentials password: " + updateAccError.message }, { status: 400 });
      }
    } else {
      const { error: accountError } = await sb.from("accounts").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        type: "credentials",
        provider: "credentials",
        providerAccountId: normalizedEmail,
        password_hash: passwordHash,
      });
      if (accountError) {
        return NextResponse.json({ success: false, message: "Failed to create Credentials: " + accountError.message }, { status: 400 });
      }
    }

    // 4. CREATE OR UPDATE PROFILE
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateProfError } = await sb
        .from("profiles")
        .update({
          role: role,
          client_id: finalClientId,
        })
        .eq("id", existingProfile.id);

      if (updateProfError) {
        return NextResponse.json({ success: false, message: "Failed to update Profile: " + updateProfError.message }, { status: 400 });
      }
    } else {
      const { error: profileError } = await sb.from("profiles").insert({
        email: normalizedEmail,
        full_name: normalizedEmail.split("@")[0],
        role: role,
        client_id: finalClientId,
        timezone: "Asia/Karachi",
      });
      if (profileError) {
        return NextResponse.json({ success: false, message: "Failed to create Profile: " + profileError.message }, { status: 400 });
      }
    }

    // 5. GENERATE TOKEN & CREATE INVITE ROW
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days

    const invitePayload = {
      email: normalizedEmail,
      role: role,
      company_name: companyName || null,
      client_id: finalClientId,
      invited_by: session?.user?.profileId ?? null,
      password: password,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      note: note || null,
      revoked_at: null,
      accepted_at: null,
    };

    // Remove old invite to prevent unique constraint conflicts
    await sb.from("invites").delete().eq("email", normalizedEmail);

    const { data: invite, error: inviteError } = await sb
      .from("invites")
      .insert(invitePayload)
      .select()
      .single();

    if (inviteError) {
      return NextResponse.json({ success: false, message: "Failed to create Invite Row: " + inviteError.message }, { status: 400 });
    }

    // 6. SEND TELEGRAM NOTIFICATION
    const sent = await sendInviteNotification({
      email: normalizedEmail,
      token: plainToken,
      expiresAt: expiresAt.toISOString(),
      note,
      password,
    });

    if (!sent.ok) {
      return NextResponse.json({
        success: false,
        message: `Accounts created successfully, but the Telegram notification failed to send: ${sent.message}`,
        invite,
      }, { status: 502 });
    }

    return NextResponse.json({ success: true, invite });

  } catch (error) {
    console.error("POST /api/invites Route Crash:", error);
    return NextResponse.json({
      success: false,
      message: error?.message || "Internal Server Error"
    }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireSuperAdmin();
    if (!session) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }
    const id = new URL(request.url).searchParams.get("id");
    const result = await revokeInvite(id);
    return NextResponse.json({ success: result.ok, message: result.message }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    console.error("DELETE /api/invites Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}