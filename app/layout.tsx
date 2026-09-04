import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "fukubiku 管理ツール",
  description: "福引ARコンテンツ 管理・URL発行ツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
