import Link from "next/link";
import SignOutButton from "./sign-out-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="font-bold">
            fukubiku 管理画面
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="hover:underline">
              注文一覧
            </Link>
            <Link href="/admin/orders/new" className="hover:underline">
              新規注文
            </Link>
            <Link href="/admin/presets" className="hover:underline">
              オブジェクト管理
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
