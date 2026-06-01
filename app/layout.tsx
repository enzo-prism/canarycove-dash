import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canary Cove — Submissions",
  description: "Website form submissions for canarycove.com",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
