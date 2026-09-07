import { createClient } from "@/lib/supabase/server";
import { toPortalData } from "@/lib/portal/load";
import { renderPortalPreview } from "@/lib/portal/render";
import type { AttendPortal, AttendPortalBlock } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 管理者向けのプレビュー。下書きでも中身を描き、画像が未設定の枠は
 * 「ここに入ります」と分かるように表示する。
 * /admin 配下なので、middlewareのログイン確認がそのまま効く。
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: row } = await supabase
    .from("attend_portals")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!row) return new Response("Not Found", { status: 404 });
  const portal = row as AttendPortal;

  const { data: blocks } = await supabase
    .from("attend_portal_blocks")
    .select("*")
    .eq("portal_id", portal.id)
    .order("sort_order", { ascending: true });

  const origin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || new URL(req.url).origin;

  // プレビューでは実際のラリーURLを引かず、参加ボタンの見た目だけ確認できれば十分。
  const arUrl = portal.rally_id ? `${origin}/r/preview` : portal.custom_ar_url;

  const data = toPortalData(portal, (blocks as AttendPortalBlock[] | null) ?? [], arUrl);
  return new Response(renderPortalPreview(data), {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}
