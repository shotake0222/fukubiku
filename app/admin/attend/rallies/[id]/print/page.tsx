import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import type { AttendRally, AttendRallySpot } from "@/lib/types";

export const dynamic = "force-dynamic";

// スタンプ台に貼る掲示物。QRと合言葉を1スポット1枚で並べ、そのまま印刷できるようにする。
export default async function RallyPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: rallyRow } = await supabase
    .from("attend_rallies")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!rallyRow) notFound();
  const rally = rallyRow as AttendRally;

  const { data: spotRows } = await supabase
    .from("attend_rally_spots")
    .select("*")
    .eq("rally_id", rally.id)
    .order("sort_order", { ascending: true });
  const spots = (spotRows as AttendRallySpot[] | null) ?? [];

  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";
  const rallyUrl = `${siteOrigin}/r/${rally.hash}`;

  const cards = await Promise.all(
    spots.map(async (s) => ({
      spot: s,
      url: s.spot_code ? `${rallyUrl}?s=${s.spot_code}` : rallyUrl,
      svg: await QRCode.toString(s.spot_code ? `${rallyUrl}?s=${s.spot_code}` : rallyUrl, {
        type: "svg",
        margin: 1,
        errorCorrectionLevel: "M",
      }),
    }))
  );

  return (
    <div className="bg-white text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{rally.name} — スタンプ台の掲示物</h1>
          <p className="text-xs text-slate-500 mt-1">
            このページを印刷して、各スポットのスタンプ台に掲示してください。
            QRを読んでも、下の合言葉を手で入力しても、同じスタンプが押せます。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {cards.map(({ spot, svg, url }, i) => (
          <div key={spot.id} className="card border-2 border-slate-900 rounded-2xl p-6 text-center">
            <p className="text-[11px] tracking-[0.3em] text-slate-500">
              SPOT {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1 text-xl font-bold">{spot.name}</h2>
            <div
              className="mx-auto mt-4 w-48"
              // qrcodeライブラリが生成したSVGをそのまま埋め込む(外部入力ではない)
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-3 text-xs text-slate-500">スマホのカメラで読み取ってください</p>
            {spot.spot_code && (
              <div className="mt-4 border-t border-dashed pt-4">
                <p className="text-xs text-slate-500">読み取れないときの合言葉</p>
                <p className="mt-1 font-mono text-3xl font-bold tracking-[0.35em]">{spot.spot_code}</p>
              </div>
            )}
            <p className="mt-4 break-all text-[10px] text-slate-400">{url}</p>
          </div>
        ))}
      </div>

      {spots.length === 0 && (
        <p className="py-16 text-center text-sm text-slate-400">スポットがまだありません。</p>
      )}
    </div>
  );
}
