import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  const sb = getSupabaseAdmin();

  if (session?.user?.email) {
    const email = session.user.email.toLowerCase();
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("email", email)
      .maybeSingle();

    return new Response(JSON.stringify({
      session,
      profileRole: profile?.role,
    }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ session }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}