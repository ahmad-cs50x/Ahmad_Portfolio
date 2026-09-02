import { redirect } from "next/navigation";
import { getSession } from "@/lib/permissions";
import ClientSidebar from "@/components/client/ClientSidebar";
import ClientHeader from "@/components/client/ClientHeader";
import AuthProvider from "@/components/AuthProvider";

export const metadata = { title: "Client Portal — Portfolio" };

export default async function ClientPortalLayout({ children }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role === "SUPER_ADMIN") redirect("/admin");

  return (
    <AuthProvider session={session}>
      <div className="relative flex min-h-screen">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.06),transparent_50%)]" />
        <ClientSidebar />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <ClientHeader user={session.user} />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
