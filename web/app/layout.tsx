import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Machine",
  description: "Autopilot content generation platform — trending topics, creator analysis, and optimized social media posts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
