import { createAdminClient } from "@/lib/supabase/admin";
import { GET as viewerGET } from "@/app/v/[hash]/route";

// QR専用URL: /q/<qr_token>
//
// 筐体のNFCタグに書き込んだURL(/v/<hash>)とは別に、NFCを使えない端末向けに
// 発行するURL。中身は /v/<hash> とまったく同じ表示を返すが、
//   ・管理画面から QR だけを停止/再発行できる(写真で拡散されたときに止められる)
//   ・どちらから引かれたかを集計できる(draw_logs.via = 'qr')
// という点が違う。クールダウンのCookieは hash 単位なので NFC と共通になる。
//
// ブラウザのアドレスバーは /q/<token> のまま変わらない(内部で表示を組み立てて返す)。
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9_-]{6,40}$/;

function page(title: string, body: string, status: number): Response {
  const html =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    "<title>fukubiku</title><style>" +
    "html,body{height:100%;margin:0;background:#0f172a;color:#fff;" +
    "font-family:system-ui,-apple-system,'Hiragino Sans','Noto Sans JP',sans-serif}" +
    ".box{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "padding:24px;box-sizing:border-box;text-align:center}" +
    "h1{font-size:18px;margin:0 0 12px}p{font-size:14px;line-height:1.8;color:#cbd5e1;margin:0}" +
    "</style></head><body><div class=\"box\"><h1>" +
    title +
    "</h1><p>" +
    body +
    "</p></div></body></html>";
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

type Row = { hash: string; qr_enabled: boolean | null };

export async function GET(request: Request, { params }: { params: { token: string } }) {
  const token = params.token;
  if (!TOKEN_RE.test(token)) {
    return page("このQRコードは使えません", "QRコードをもう一度読み取ってください。", 404);
  }

  const supabase = createAdminClient();
  const [o, g] = await Promise.all([
    supabase.from("orders").select("hash, qr_enabled").eq("qr_token", token).maybeSingle(),
    supabase.from("draw_groups").select("hash, qr_enabled").eq("qr_token", token).maybeSingle(),
  ]);

  // add_qr_access.sql が未実行(列が無い)
  const missingColumn = [o.error, g.error].some((e) => {
    const code = (e as { code?: string } | null)?.code;
    return code === "42703" || code === "PGRST204";
  });
  if (missingColumn) {
    return page(
      "QRコードの準備中です",
      "しばらくしてからもう一度お試しください。<br>（管理者の方へ: supabase/add_qr_access.sql が未実行です）",
      503
    );
  }

  const row = ((o.data as Row | null) ?? (g.data as Row | null)) || null;
  if (!row) {
    return page(
      "このQRコードは使えません",
      "QRコードが新しいものに差し替えられた可能性があります。<br>会場に掲示されている最新のQRコードを読み取ってください。",
      404
    );
  }
  if (!row.qr_enabled) {
    return page(
      "このQRコードは現在停止中です",
      "会場のスタッフにお問い合わせいただくか、<br>NFCタグにスマホをかざしてお試しください。",
      403
    );
  }

  // /v/<hash> と同じ表示を返す。どこから来たかだけをヘッダで伝える。
  const headers = new Headers(request.headers);
  headers.set("x-fukubiku-via", "qr");
  const forwarded = new Request(request.url, { method: "GET", headers });
  return viewerGET(forwarded, { params: { hash: row.hash } });
}
