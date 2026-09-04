import Link from "next/link";

const services = [
  {
    href: "/admin/fukubiku",
    name: "fukubiku",
    description: "福引ARコンテンツの注文管理・クライアント提供URL発行",
    accent: "bg-amber-50 border-amber-200 hover:border-amber-400",
  },
  {
    href: "/admin/attend",
    name: "あてんど",
    description: "聖地巡礼・展示向けXRコンテンツ(GPS/画像/顔認識AR)の案件管理",
    accent: "bg-sky-50 border-sky-200 hover:border-sky-400",
  },
];

export default function ServicePickerPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-lg font-bold">サービスを選択してください</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {services.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`block rounded-xl border-2 p-6 transition ${s.accent}`}
          >
            <div className="text-xl font-bold mb-2">{s.name}</div>
            <p className="text-sm text-slate-600">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
