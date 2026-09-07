import { loadPortal } from "@/lib/portal/load";
import { renderPortal } from "@/lib/portal/render";

export const dynamic = "force-dynamic";

/**
 * 受け皿サイトの公開URL。
 *
 * Reactではなくルートハンドラで組み立てているのは、管理画面と同じ
 * グローバルCSS(Tailwind)を巻き込まずに、テンプレートのCSSだけで
 * 完結させるため。クライアントに渡していた単体HTMLと同じものを
 * こちらでホスティングする形になり、修正も提供終了も自分たちで完結する。
 */
export async function GET(req: Request, { params }: { params: { hash: string } }) {
  const origin =
    process.env.NEXT_PUBLIC_ATTEND_SITE_URL || new URL(req.url).origin;

  const data = await loadPortal(params.hash, origin);
  if (!data) {
    return new Response("Not Found", { status: 404 });
  }

  return new Response(renderPortal(data), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // 公開中だけ検索エンジンに拾わせる
      "x-robots-tag": data.status === "published" ? "all" : "noindex",
      "cache-control": "no-store",
    },
  });
}
