import Image from "next/image";
import Link from "next/link";

const services = [
  {
    href: "/admin/fukubiku",
    name: "fukubiku",
    logo: "/branding/fukubiku-logo.png",
    description: "福引ARコンテンツの注文管理・クライアント提供URL発行",
    ring: "hover:ring-emerald-300",
    glow: "from-emerald-100/80 via-emerald-50/40 to-transparent",
    tag: "bg-emerald-600",
  },
  {
    href: "/admin/attend",
    name: "あてんど",
    logo: "/branding/attend-logo.png",
    description: "聖地巡礼・展示向けXRコンテンツ(GPS/画像/顔認識AR)の案件管理",
    ring: "hover:ring-pink-300",
    glow: "from-pink-100/80 via-pink-50/40 to-transparent",
    tag: "bg-pink-500",
  },
];

export default function ServicePickerPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 py-6">
      <div className="text-center space-y-2">
        <p className="text-xs tracking-widest text-slate-400 font-medium">STRAID OPERATIONS</p>
        <h1 className="text-2xl font-bold text-slate-900">サービスを選択してください</h1>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {services.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm ring-1 ring-transparent transition hover:-translate-y-1 hover:shadow-lg ${s.ring}`}
          >
            <div
              className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${s.glow} opacity-0 transition group-hover:opacity-100`}
            />
            <div className="relative flex flex-col items-center text-center gap-4">
              <div className="relative h-24 w-24">
                <Image src={s.logo} alt={`${s.name} ロゴ`} fill className="object-contain" priority />
              </div>
              <span className={`text-[10px] tracking-wider text-white rounded-full px-3 py-1 ${s.tag}`}>
                {s.href.replace("/admin/", "").toUpperCase()}
              </span>
              <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
