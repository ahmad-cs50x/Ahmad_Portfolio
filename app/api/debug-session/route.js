import { NextResponse } from "next/server";

export const runtime = "edge";

/** Debug endpoint — removed in v2. Returns 410 Gone. */
export async function GET() {
  return NextResponse.json(
    { success: false, message: "Debug session endpoint has been removed." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Debug session endpoint has been removed." },
    { status: 410 }
  );
}
