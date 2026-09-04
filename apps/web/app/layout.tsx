import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoxMate — HYROX partner identity",
  description: "A neon performance identity for every HYROX partnership.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
