import { customAlphabet } from "nanoid";
import type { AttendRally, AttendRallySpot, AttendStampMethod } from "@/lib/types";

// 参加者が声に出して伝えたり、台紙に印刷して手入力したりするコード用の文字集合。
// 0/O/Q・1/I/L のような読み違えやすい文字を最初から除いてあるので、
// 「読み違えたので別の有効なコードになってしまう」ことが起きない。
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPRSTUVWXYZ";

const spotCodeGen = customAlphabet(CODE_ALPHABET, 5);
const restoreCodeGen = customAlphabet(CODE_ALPHABET, 8);
const couponCodeGen = customAlphabet(CODE_ALPHABET, 8);

/** スタンプ台に掲示する合言葉（QR・NFCのURLにも同じ値が入る）。 */
export function generateSpotCode(): string {
  return spotCodeGen();
}

/** 機種変更時に進捗を引き継ぐためのコード。 */
export function generateRestoreCode(): string {
  return restoreCodeGen();
}

/** コンプリート特典の引換コード。 */
export function generateCouponCode(): string {
  return couponCodeGen();
}

/**
 * 利用者が入力したコードを照合用に正規化する。
 * 全角英数・小文字・空白/ハイフン/中黒の混入を吸収するだけに留める。
 *
 * CODE_ALPHABET から紛らわしい文字(0 O Q 1 I L)を除いてあるため、
 * 「O を 0 に読み替える」ような推測変換は不要で、むしろ別コードへの
 * 誤マッチを生むのでやらない。読み違えた入力はそのまま不一致になる。
 */
export function normalizeCode(input: string): string {
  const halfWidth = input.replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  return halfWidth.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * 2点間の距離(m)。地球を半径6371kmの球とみなすハバサイン公式。
 * 数十m〜数kmのスタンプラリーには十分な精度がある。
 */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km`;
  if (m >= 100) return `${Math.round(m / 10) * 10}m`;
  return `${Math.round(m)}m`;
}

/** コンプリートに必要な個数。未設定なら全スポット。 */
export function requiredCount(rally: Pick<AttendRally, "required_count">, spotCount: number): number {
  const n = rally.required_count;
  if (n == null || n <= 0) return spotCount;
  return Math.min(n, spotCount);
}

/** スタンプ帳の升目に出す文字。未設定ならスポット名の頭2文字。 */
export function stampLabelFor(spot: Pick<AttendRallySpot, "name" | "stamp_label">): string {
  const label = spot.stamp_label?.trim();
  if (label) return label;
  return Array.from(spot.name).slice(0, 2).join("");
}

/** 開催期間内かどうか。未設定の側は無制限として扱う。 */
export function isWithinPeriod(rally: Pick<AttendRally, "starts_at" | "ends_at">, now = new Date()): boolean {
  if (rally.starts_at && now < new Date(rally.starts_at)) return false;
  if (rally.ends_at && now > new Date(rally.ends_at)) return false;
  return true;
}

/**
 * 参加者Cookie名。ラリーIDで分ける。
 *
 * URLのハッシュではなくラリーIDを使うのが要点で、同じラリーに配布用URLと
 * 埋め込み用URLの2本を発行しても、参加者から見れば1冊のスタンプ帳が続く。
 */
export function participantCookieName(rallyId: string): string {
  return `rally_p_${rallyId}`;
}

/**
 * 埋め込み(iframe)ではサードパーティCookieが落とされることがあるため、
 * 参加者IDをこのヘッダでも受け取れるようにしている。
 * 埋め込み側はlocalStorageに控えておき、毎回これで名乗る。
 */
export const PARTICIPANT_HEADER = "x-rally-participant";

/** 参加者画面へ返す公開状態。staff_pin など秘密の値は含めない。 */
export interface RallyPublicState {
  participantId: string;
  restoreCode: string;
  stamps: { spotId: string; method: AttendStampMethod; createdAt: string }[];
  completed: boolean;
  coupon: { code: string; issuedAt: string; redeemedAt: string | null } | null;
}
