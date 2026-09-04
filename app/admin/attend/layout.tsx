import Link from "next/link";

export default function AttendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-4 text-sm border-b pb-3">
        <Link href="/admin" className="text-slate-400 hover:text-slate-900">← サービス切替</Link>
        <span className="font-bold">あてんど</span>
        <Link href="/admin/attend" className="hover:underline">案件一覧</Link>
        <Link href="/admin/attend/projects/new" className="hover:underline">新規案件</Link>
        <Link href="/admin/presets" className="hover:underline">オブジェクト管理</Link>
      </nav>
      {children}
    </div>
  );
}
