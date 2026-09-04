import Image from "next/image";
import Link from "next/link";

export default function FukubikuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-4 text-sm border-b-2 border-emerald-100 pb-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-900">
          ← サービス切替
        </Link>
        <Link href="/admin/fukubiku" className="flex items-center gap-1.5 font-bold text-slate-900">
          <span className="relative h-6 w-6 shrink-0">
            <Image src="/branding/fukubiku-logo.png" alt="fukubiku" fill className="object-contain" />
          </span>
          fukubiku
        </Link>
        <Link href="/admin/fukubiku" className="hover:text-emerald-600">
          注文一覧
        </Link>
        <Link href="/admin/fukubiku/orders/new" className="hover:text-emerald-600">
          新規注文
        </Link>
        <Link href="/admin/fukubiku/orders/bulk" className="hover:text-emerald-600">
          一括作成
        </Link>
        <Link href="/admin/fukubiku/presets" className="hover:text-emerald-600">
          オブジェクト管理
        </Link>
      </nav>
      {children}
    </div>
  );
}
