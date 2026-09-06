import { NextResponse } from "next/server";
import { buildState, ensureParticipant, loadRally, participantIdFromHeader } from "@/lib/rallyServer";

export const dynamic = "force-dynamic";

// スタンプ帳を開いた時に呼ぶ。Cookieが無ければその場で匿名参加者を作る。
// 埋め込み(iframe)でCookieが落とされる環境では、localStorageに控えた
// 参加者IDをヘッダで名乗ってもらい、同じスタンプ帳を続ける。
export async function POST(req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const participant = await ensureParticipant(ctx, participantIdFromHeader(req));
  return NextResponse.json(await buildState(ctx, participant));
}
