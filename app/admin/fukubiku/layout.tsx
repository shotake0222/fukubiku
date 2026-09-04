import Link from "next/link";

export default function FukubikuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-4 text-sm border-b pb-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-900">
          ← サービス切替
        </Link>
        <span className="font-bold">fukubiku</span>
        <Link href="/admin/fukubiku" className="hover:underline">
          注文一覧
        </Link>
        <Link href="/admin/fukubiku/orders/new" className="hover:underline">
          新規注文
        </Link>
        <Link href="/admin/fukubiku/orders/bulk" className="hover:underline">
          一括作成
        </Link>
        <Link href="/admin/fukubiku/presets" className="hover:underline">
          オブジェクト管理
        </Link>
      </nav>
      {children}
    </div>
  );
}
