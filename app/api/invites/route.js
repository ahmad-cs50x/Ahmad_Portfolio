import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/permissions";
import { revokeInvite, isInviteMailConfigured } from "@/lib/invites";
import { getSupabaseAdmin } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import crypto from "crypto";
import nodemailer from "nodemailer";

export const runtime = "nodejs";

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
    const passwordHash = hashPassword(password);

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
    const plainToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(plainToken).digest("hex");
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

    // 6. SEND EMAIL
    let mailSuccess = true;
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
        },
      });

      const domain = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const magicLink = `${domain}/api/invites/accept?token=${plainToken}`;
      const formattedDate = expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Client Portal Invitation</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #a1a1aa;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background: #121215; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    
                    <!-- Header Bar -->
                    <tr>
                      <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                        <p style="margin: 0 0 8px 0; font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.25em; color: #06b6d4;">// Client Portal</p>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em;">You've been invited to Ahmad's client portal</h1>
                      </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                      <td style="padding: 32px;">
                        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #d4d4d8;">
                          The portal is where we track project progress, share files and message each other directly. Below are your secure login credentials.
                        </p>

                        <!-- Optional Note Box -->
                        ${note ? `
                          <div style="background-color: rgba(139, 92, 246, 0.08); border-left: 3px solid #8b5cf6; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                            <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #c4b5fd;">Note from Ahmad</p>
                            <p style="margin: 0; font-size: 13px; color: #e4e4e7; line-height: 1.5; font-style: italic;">"${note}"</p>
                          </div>
                        ` : ''}

                        <!-- Credentials Box -->
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; margin-bottom: 28px;">
                          <tr>
                            <td style="padding: 20px;">
                              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="padding-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #71717a; display: block; margin-bottom: 2px;">Email Address</span>
                                    <span style="font-size: 14px; font-family: monospace; color: #ffffff; font-weight: 500;">${normalizedEmail}</span>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-top: 12px;">
                                    <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #71717a; display: block; margin-bottom: 2px;">Temporary Password</span>
                                    <span style="font-size: 14px; font-family: monospace; color: #38bdf8; font-weight: 600; background: rgba(56, 189, 248, 0.1); padding: 2px 6px; border-radius: 4px;">${password}</span>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- CTA Button -->
                        <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; width: 100%;">
                          <tr>
                            <td align="center">
                              <a href="${magicLink}" target="_blank" style="display: block; background: linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; text-align: center; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                                Access Client Portal
                              </a>
                            </td>
                          </tr>
                        </table>

                        <!-- Details & Expiry Info -->
                        <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                          This link signs you in automatically — no need to enter your password. Expires on <strong style="color: #e4e4e7;">${formattedDate}</strong> (after 15 days).
                        </p>

                        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa;">
                          You can also sign in manually at <a href="${domain}" target="_blank" style="color: #38bdf8; text-decoration: underline;">${domain}</a> using the email and password above.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 32px; background: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04); text-align: center;">
                        <p style="margin: 0; font-size: 11px; color: #52525b; line-height: 1.5;">
                          If you weren't expecting this, you can ignore it. Nothing happens until you sign in.
                        </p>
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      await transporter.sendMail({
        from: `"Ahmad's Portal" <${process.env.SMTP_USER}>`,
        to: normalizedEmail,
        subject: "You've been invited to Ahmad's client portal",
        html: emailHtml,
      });
    } catch (mailError) {
      console.error("Mail Send Error:", mailError);
      mailSuccess = false;
    }

    if (!mailSuccess) {
      return NextResponse.json({ 
        success: false, 
        message: "Accounts created successfully, but the Email failed to send. Please check your SMTP credentials.", 
        invite 
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