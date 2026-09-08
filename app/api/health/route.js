import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    service: "ahmad-portfolio",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
export const runtime = 'edge';
