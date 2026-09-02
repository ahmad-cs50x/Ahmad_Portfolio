// import { NextResponse } from "next/server";
// import { getSupabaseAdmin, isDbConfigured } from "@/lib/db";
// import { inviteFromToken } from "@/lib/invites";

// export const runtime = "nodejs";

// export async function GET(request) {
//   if (!isDbConfigured()) {
//     return NextResponse.json({ success: false, message: "Database not configured." }, { status: 503 });
//   }

//   const token = request.nextUrl.searchParams.get("token");
//   if (!token) {
//     return NextResponse.json({ success: false, message: "Token required." }, { status: 400 });
//   }

//   const sb = getSupabaseAdmin();
//   const invite = await inviteFromToken(token);

//   if (!invite) {
//     return NextResponse.json({ success: false, message: "Invalid or expired invitation." }, { status: 404 });
//   }

//   if (invite.revoked_at) {
//     return NextResponse.json({ success: false, message: "This invitation has been revoked." }, { status: 410 });
//   }

//   if (invite.accepted_at) {
//     return NextResponse.json({
//       success: true,
//       invite: {
//         email: invite.email,
//         role: invite.role,
//         company_name: invite.company_name,
//         expires_at: invite.expires_at,
//         password: invite.password || null,
//         alreadyAccepted: true,
//       },
//     });
//   }

//   if (new Date(invite.expires_at).getTime() < Date.now()) {
//     return NextResponse.json({ success: false, message: "This invitation has expired." }, { status: 410 });
//   }

//   return NextResponse.json({
//     success: true,
//     invite: {
//       email: invite.email,
//       role: invite.role,
//       company_name: invite.company_name,
//       expires_at: invite.expires_at,
//       password: invite.password || null,
//     },
//   });
// }