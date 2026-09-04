import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Straid 運用管理システム",
  description: "fukubiku・あてんど 各サービスのARコンテンツ運用管理ツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
