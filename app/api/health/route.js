import { NextResponse } from "next/server";

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "ahmad-portfolio",
    uptime: (Date.now() - startedAt) / 1000,
    timestamp: new Date().toISOString(),
  });
}
export const runtime = 'edge';
