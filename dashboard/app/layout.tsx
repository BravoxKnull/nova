import type { Metadata } from "next";
import { NavBar } from "../components/NavBar";
import "./globals.css";
import { getDashboardSession } from "../lib/session";

export const metadata: Metadata = {
  title: "NOVA Dashboard",
  description: "Discord OAuth dashboard and server install flow for NOVA",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getDashboardSession();

  return (
    <html lang="en">
      <body>
        <NavBar
          authenticated={Boolean(session)}
          userName={session?.user.global_name ?? session?.user.username}
        />
        {children}
      </body>
    </html>
  );
}
