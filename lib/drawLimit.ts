// 共有URLの「一定期間あたりの表示回数の上限」に関する共通ロジック。
//
// Cookie(lib/drawCooldown.ts)は同じ端末からの連続アクセスを抑えるためのもので、
// 端末を変えれば何度でも引けてしまう。景品の個数そのものを守るには、
// サーバー側で実際の表示回数を数える必要がある。ここではその期間の区切り方と
// 表示文言を扱う。

export type LimitPeriod = "day" | "3days" | "week" | "none";

export const LIMIT_PERIOD_OPTIONS: { value: LimitPeriod; label: string }[] = [
  { value: "none", label: "制限なし" },
  { value: "day", label: "1日あたり" },
  { value: "3days", label: "3日あたり" },
  { value: "week", label: "1週間あたり" },
];

export function isLimitPeriod(v: string | null | undefined): v is LimitPeriod {
  return v === "day" || v === "3days" || v === "week" || v === "none";
}

export function limitPeriodLabel(v: string | null | undefined): string {
  const found = LIMIT_PERIOD_OPTIONS.find((o) => o.value === v);
  return found ? found.label : "制限なし";
}

// 会場での運用に合わせ、期間の区切りは日本時間の0時に統一する。
// (「1日の上限」は暦日で数え、翌0時にリセットされるのが自然なため)
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 指定時刻が属する「日本時間のその日の0時」をUTCのDateとして返す。 */
export function jstStartOfDay(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth();
  const d = jst.getUTCDate();
  return new Date(Date.UTC(y, m, d) - JST_OFFSET_MS);
}

/**
 * 集計対象の期間の開始時刻を返す。制限しない場合は null。
 * どの期間も日本時間の0時で区切られ、翌0時にリセットされる。
 */
export function limitWindowStart(period: LimitPeriod, now: Date = new Date()): Date | null {
  if (period === "none") return null;
  const startOfToday = jstStartOfDay(now);
  const days = period === "day" ? 0 : period === "3days" ? 2 : 6;
  return new Date(startOfToday.getTime() - days * 24 * 60 * 60 * 1000);
}

/** 次にリセットされる時刻(日本時間の翌0時)。 */
export function nextResetAt(now: Date = new Date()): Date {
  return new Date(jstStartOfDay(now).getTime() + 24 * 60 * 60 * 1000);
}

/** 上限に達したときの案内文。 */
export function buildLimitReachedMessage(period: LimitPeriod, now: Date = new Date()): string {
  const reset = nextResetAt(now);
  const jst = new Date(reset.getTime() + JST_OFFSET_MS);
  const hour = jst.getUTCHours();
  const label =
    period === "day" ? "本日分" : period === "3days" ? "この3日分" : "今週分";
  return `${label}の抽選は上限に達しました。${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${hour}時以降にまたお試しください。`;
}
