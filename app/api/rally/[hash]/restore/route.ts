import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/rally";
import { buildState, loadRally, setParticipantCookie } from "@/lib/rallyServer";
import type { AttendRallyParticipant } from "@/lib/types";

export const dynamic = "force-dynamic";

// 機種変更・Cookie削除のあとに、引き継ぎコードでスタンプ帳を引き戻す。
export async function POST(req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = normalizeCode(body.code ?? "");
  if (!code) return NextResponse.json({ error: "empty_code" }, { status: 400 });

  const { data } = await ctx.supabase
    .from("attend_rally_participants")
    .select("*")
    .eq("rally_id", ctx.rally.id)
    .eq("restore_code", code)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "invalid_code" }, { status: 404 });

  const participant = data as AttendRallyParticipant;
  setParticipantCookie(ctx, participant.id);
  return NextResponse.json(await buildState(ctx, participant));
}
