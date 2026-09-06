import { NextResponse } from "next/server";
import { distanceMeters, isWithinPeriod, normalizeCode } from "@/lib/rally";
import { buildState, ensureParticipant, loadRally, participantIdFromHeader } from "@/lib/rallyServer";
import type { AttendRallySpot, AttendStampMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

// 測位誤差の加算上限(m)。誤差の大きい端末を救いつつ、
// 「誤差100mです」と言い張れば遠くから押せてしまう状態は避ける。
const MAX_ACCURACY_BONUS = 30;

interface StampBody {
  /** GPSで押す場合の対象スポット */
  spotId?: string;
  /** 合言葉・QR・NFCで押す場合のコード */
  code?: string;
  /** コードがどこから来たか（QR/NFCで開いた場合に記録して集計に使う） */
  via?: AttendStampMethod;
  lat?: number;
  lng?: number;
  accuracy?: number;
}

export async function POST(req: Request, { params }: { params: { hash: string } }) {
  const ctx = await loadRally(params.hash);
  if (!ctx) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (ctx.rally.status !== "active") {
    return NextResponse.json({ error: "not_active" }, { status: 403 });
  }
  if (!isWithinPeriod(ctx.rally)) {
    return NextResponse.json({ error: "out_of_period" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as StampBody;

  let spot: AttendRallySpot | undefined;
  let method: AttendStampMethod;

  if (body.code) {
    const code = normalizeCode(body.code);
    spot = ctx.spots.find((s) => s.spot_code && normalizeCode(s.spot_code) === code);
    if (!spot) return NextResponse.json({ error: "invalid_code" }, { status: 404 });
    // QR/NFCで開いた場合はコード入力欄を通らないので code_enabled を要求しない。
    const via = body.via === "qr" || body.via === "nfc" ? body.via : "code";
    if (via === "code" && !spot.code_enabled) {
      return NextResponse.json({ error: "code_disabled" }, { status: 403 });
    }
    method = via;
  } else if (body.spotId) {
    spot = ctx.spots.find((s) => s.id === body.spotId);
    if (!spot) return NextResponse.json({ error: "invalid_spot" }, { status: 404 });
    if (!spot.gps_enabled || spot.gps_lat == null || spot.gps_lng == null) {
      return NextResponse.json({ error: "gps_disabled" }, { status: 403 });
    }
    if (body.lat == null || body.lng == null) {
      return NextResponse.json({ error: "no_location" }, { status: 400 });
    }
    // 距離判定はサーバー側で行う。クライアントの「着いた」という自己申告は信じない。
    const d = distanceMeters(body.lat, body.lng, spot.gps_lat, spot.gps_lng);
    const bonus = Math.min(Math.max(body.accuracy ?? 0, 0), MAX_ACCURACY_BONUS);
    if (d > spot.gps_radius_m + bonus) {
      return NextResponse.json(
        { error: "too_far", distance: Math.round(d), radius: spot.gps_radius_m },
        { status: 403 }
      );
    }
    method = "gps";
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const participant = await ensureParticipant(ctx, participantIdFromHeader(req));

  const { error } = await ctx.supabase.from("attend_rally_stamps").insert({
    participant_id: participant.id,
    spot_id: spot.id,
    method,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    accuracy_m: body.accuracy ?? null,
  });

  // 23505 = 一意制約違反。同じスポットを二度押した場合で、エラーではなく
  // 「すでに押してあります」として扱う（連打やQR再読み込みで壊れないように）。
  const already = error?.code === "23505";
  if (error && !already) {
    return NextResponse.json({ error: "insert_failed", detail: error.message }, { status: 500 });
  }

  const state = await buildState(ctx, participant);
  return NextResponse.json({ ...state, granted: !already, already, spotId: spot.id, method });
}
