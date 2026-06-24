import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "跨境选品四要素分析",
  description: "增速 · 市场容量 · 竞争度（HHI）· 利润率",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
