"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      console.log("[DEBUG] Session data:", session);
      if (session?.user.role === "CLIENT") {
        console.log("[DEBUG] Redirecting CLIENT to /client-portal");
        router.push("/client-portal");
      } else if (session?.user.role === "ADMIN") {
        console.log("[DEBUG] Redirecting ADMIN to /admin");
        router.push("/admin");
      }
    }
  }, [status, session, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Login Page</h1>
      <p>Please log in with your credentials.</p>
    </div>
  );
}