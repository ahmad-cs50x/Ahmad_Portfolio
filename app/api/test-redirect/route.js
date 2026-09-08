import { NextResponse } from "next/server";

export const runtime = "edge";

/** Test redirect endpoint — removed in v2. Returns 410 Gone. */
export async function GET(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("to") || "/";
  return NextResponse.redirect(new URL(target, request.url));
}

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Test redirect endpoint disabled." },
    { status: 410 }
  );
}
