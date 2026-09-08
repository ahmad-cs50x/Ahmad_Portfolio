import { NextResponse } from "next/server";

export default function middleware(req) {
  const sessionCookie =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  const { pathname } = req.nextUrl;
  const isPrivate = pathname.startsWith("/admin") || pathname.startsWith("/client-portal");

  if (isPrivate && !sessionCookie) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client-portal/:path*"],
};