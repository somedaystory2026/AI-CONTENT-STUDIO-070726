import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Content Studio",
  description: "AI content automation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Sidebar />
        <main style={{ marginLeft: 260, minHeight: "100vh", background: "#f8fafc" }}>
          {children}
        </main>
      </body>
    </html>
  );
}