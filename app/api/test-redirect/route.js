import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  console.log("[DEBUG] Session from test endpoint:", session);

  if (session?.user.role === "CLIENT") {
    console.log("[DEBUG] Redirecting CLIENT to /client-portal");
    return NextResponse.redirect(new URL("/client-portal", "http://localhost:3002"));
  }
  console.log("[DEBUG] Default redirect to:", "http://localhost:3002");
  return NextResponse.redirect(new URL("/", "http://localhost:3002"));
}