import "./globals.css";
import { Inter, Space_Grotesk } from "next/font/google";
import CursorGlow from "@/components/CursorGlow";
import { Toaster } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata = {
  title: "Ahmad's Portfolio",
  description:
    "Portfolio of Ahmad, a full-stack developer crafting immersive, high-performance web experiences with Next.js, Node.js and Three.js.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} bg-ink font-sans text-zinc-300 antialiased`}
      >
        <div className="noise" aria-hidden="true" />
        <CursorGlow />
        {children}
        {/* One toast host for the whole app â€” the portal, the admin console and
            the login page all publish to it. */}
        <Toaster />
      </body>
    </html>
  );
}

