import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireSuperAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });

  const { otpauth } = await request.json();
  if (!otpauth) return NextResponse.json({ success: false, message: "otpauth required" }, { status: 400 });

  try {
    const qrDataUrl = await QRCode.toDataURL(otpauth, { width: 256, margin: 2 });
    return NextResponse.json({ success: true, qrDataUrl });
  } catch (e) {
    return NextResponse.json({ success: false, message: "QR generation failed" }, { status: 500 });
  }
}