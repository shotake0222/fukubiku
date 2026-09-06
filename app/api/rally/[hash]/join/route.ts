import { NextResponse } from "next/server";
import { buildState, ensureParticipant, loadRally } from "@/lib/rallyServer";

export const dynamic = "force-dynamic";

// スタンプ帳を開いた時に呼ぶ。Cookieが無ければその場で匿名参加者を作る。
export async function POST(_req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const participant = await ensureParticipant(ctx, params.hash);
  return NextResponse.json(await buildState(ctx, participant));
}
