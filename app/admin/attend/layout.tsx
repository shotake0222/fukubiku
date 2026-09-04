import Image from "next/image";
import Link from "next/link";

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-4 text-sm border-b-2 border-pink-100 pb-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-900">
          ← サービス切替
        </Link>
        <Link href="/admin/attend" className="flex items-center gap-1.5 font-bold text-slate-900">
          <span className="relative h-6 w-6 shrink-0">
            <Image src="/branding/attend-logo.png" alt="あてんど" fill className="object-contain" />
          </span>
          あてんど
        </Link>
        <Link href="/admin/attend" className="hover:text-pink-600">
          案件一覧
        </Link>
        <Link href="/admin/attend/projects/new" className="hover:text-pink-600">
          新規案件
        </Link>
        <Link href="/admin/attend/presets" className="hover:text-pink-600">
          オブジェクト管理
        </Link>
        <Link href="/admin/attend/markers" className="hover:text-pink-600">
          マーカー管理
        </Link>
      </nav>
      {children}
    </div>
  );
}
