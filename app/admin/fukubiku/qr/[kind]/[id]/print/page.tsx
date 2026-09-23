import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// 筐体の横に貼る掲示物。NFCが使えない端末の人に、QRから同じ福引きへ入ってもらう。
// A4 1枚に大きく1つ。印刷時は操作用のボタン類を隠す。
export default async function QrPrintPage({
  params,
}: {
  params: { kind: string; id: string };
}) {
  if (params.kind !== "order" && params.kind !== "group") notFound();
  const table = params.kind === "order" ? "orders" : "draw_groups";

  const supabase = createClient();
  const { data } = await supabase
    .from(table)
    .select("id, client_name, qr_token, qr_enabled")
    .eq("id", params.id)
    .maybeSingle();
  const row = data as
    | { id: string; client_name: string; qr_token: string | null; qr_enabled: boolean | null }
    | null;
  if (!row) notFound();

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";

  if (!row.qr_token) {
    return (
      <div className="p-8 text-sm text-slate-600">
        まだQRコードが発行されていません。編集画面の「QRコードを発行する」を押してから開いてください。
      </div>
    );
  }

  const url = `${siteOrigin}/q/${row.qr_token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="bg-white text-slate-900">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold">{row.client_name} — QRコード掲示物</h1>
          <p className="text-xs text-slate-500 mt-1">
            筐体の近くに掲示してください。NFCタグにかざせない端末でも、このQRから同じ福引きに参加できます。
          </p>
          {!row.qr_enabled && (
            <p className="text-xs text-red-600 mt-1">※ 現在このQRは停止中です。読み取っても福引きは開きません。</p>
          )}
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[170mm] border-2 border-slate-900 rounded-3xl p-10 text-center">
        <p className="text-sm tracking-[0.3em] text-slate-500">AR福引き</p>
        <h2 className="mt-2 text-3xl font-bold leading-snug">
          スマホをかざしても
          <br />
          反応しない方はこちら
        </h2>
        <div
          className="mx-auto mt-8 w-[110mm]"
          // qrcodeライブラリが生成したSVG(外部入力ではない)
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-6 text-lg font-bold">スマホのカメラでQRコードを読み取ってください</p>
        <ol className="mt-5 text-left text-sm leading-7 text-slate-600 inline-block">
          <li>1. カメラアプリでQRコードを写し、表示されたリンクを開く</li>
          <li>2. カメラの使用を「許可」する</li>
          <li>3. 筐体のマーカーにスマホを向ける（20cmほど離すとピントが合います）</li>
        </ol>
        <p className="mt-8 break-all text-[10px] text-slate-400">{url}</p>
      </div>
    </div>
  );
}
