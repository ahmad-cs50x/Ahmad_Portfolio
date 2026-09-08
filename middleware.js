import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export default async function middleware(req) {
  const token = await getToken({ req });
  const { pathname } = req.nextUrl;

  // Redirect CLIENT role to client-portal
  if (token?.role === "CLIENT" && !pathname.startsWith("/client-portal")) {
    return NextResponse.redirect(new URL("/client-portal", req.url));
  }

  // Redirect ADMIN to admin dashboard
  if (token?.role === "ADMIN" && !pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Redirect unauthenticated users to login
  if (!token && (pathname.startsWith("/admin") || pathname.startsWith("/client-portal"))) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/client-portal/:path*"],
};
