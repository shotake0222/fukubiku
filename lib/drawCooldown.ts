// 抽選セット(draw_groups)の共有URLは、アクセスの都度サーバー側で確率抽選をやり直す仕組みのため、
// 何の制限もないと同じ人がページを再読み込みするだけで際限なく再抽選できてしまう。
// これを防ぐため、Cookieに前回の抽選時刻(とカテゴリ)を記録しておき、一定時間は再抽選せず
// 「時間をおいて再チャレンジしてください」という案内を表示する。
// (注文ごとに固定の景品が割り当てられる orders 側のフローはランダム再抽選ではないため対象外)

// クールダウン時間(何時間に1回、再抽選させるか)のデフォルト値/フォールバック値。
// 実際の値は抽選セット(draw_groups.cooldown_hours)ごとに管理画面から設定でき、
// これはその初期値、および値が未設定の場合のフォールバックとして使う。
// 例: 1 なら1時間に1回、0.5なら30分に1回、24なら1日1回。
export const DRAW_COOLDOWN_HOURS = 1;

export function drawCookieName(hash: string): string {
  return `fukubiku_draw_${hash}`;
}

// Cookieの値は "<抽選時刻(ms)>-<カテゴリ>" という単純な文字列で保持する
// (カテゴリ値は英数字のみなのでエンコード不要)。
export function encodeDrawCookieValue(category: string | null): string {
  return `${Date.now()}-${category ?? "none"}`;
}

export function decodeDrawCookieValue(
  raw: string | undefined
): { drawnAtMs: number; category: string | null } | null {
  if (!raw) return null;
  const [tsRaw, categoryRaw] = raw.split("-");
  const drawnAtMs = Number(tsRaw);
  if (!Number.isFinite(drawnAtMs)) return null;
  return { drawnAtMs, category: categoryRaw && categoryRaw !== "none" ? categoryRaw : null };
}

export function getRemainingCooldownMs(
  drawnAtMs: number,
  cooldownHours: number = DRAW_COOLDOWN_HOURS
): number {
  const totalMs = cooldownHours * 60 * 60 * 1000;
  const elapsed = Date.now() - drawnAtMs;
  return Math.max(0, totalMs - elapsed);
}

// 残りミリ秒を「1時間20分」のような日本語表記に変換する。
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "まもなく";
  const totalMinutes = Math.ceil(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}

// カテゴリ(テンプレート)ごとの「時間をおいて再チャレンジ」文言。
// 各テンプレートに1パターンずつ用意している。{remaining} は残り時間の文字列に置き換わる。
export const RETRY_MESSAGES: Record<string, string> = {
  amida: "あみだくじの道はまだ絡んだまま。次の挑戦まで あと{remaining}です。",
  box: "抽選ボックスは今しばらく休憩中。次の挑戦まで あと{remaining}です。",
  darts: "ダーツの的が入れ替わるのを待っています。次の挑戦まで あと{remaining}です。",
  garagara: "ガラガラの玉はまだ補充中です。次の挑戦まで あと{remaining}です。",
  omikuji: "おみくじの結び目がほどけるまでもう少し。次の挑戦まで あと{remaining}です。",
  scratch: "スクラッチカードは新しいものと交換中です。次の挑戦まで あと{remaining}です。",
  roulette: "ルーレットの針が止まるのを待っています。次の挑戦まで あと{remaining}です。",
  dice: "サイコロは次の出目を準備中です。次の挑戦まで あと{remaining}です。",
  treasure: "宝箱の鍵はまだ見つかっていません。次の挑戦まで あと{remaining}です。",
  slot: "スロットのリールはただいま調整中です。次の挑戦まで あと{remaining}です。",
  gacha: "ガチャガチャのカプセルを補充しています。次の挑戦まで あと{remaining}です。",
  mallet: "打ち出の小槌は力をため直しています。次の挑戦まで あと{remaining}です。",
  cat: "招き猫はただいまお昼寝中です。次の挑戦まで あと{remaining}です。",
  daruma: "だるまはまだ片目のまま願掛け中です。次の挑戦まで あと{remaining}です。",
  lantern: "ランタンの灯りが再び灯るのを待っています。次の挑戦まで あと{remaining}です。",
  firework: "打ち上げ花火の準備中です。次の挑戦まで あと{remaining}です。",
  airlottery: "エアー抽選機は送風を再充填しています。次の挑戦まで あと{remaining}です。",
  fan: "扇子はゆっくり閉じて休んでいます。次の挑戦まで あと{remaining}です。",
  pachinko: "パチンコ玉はまだ補充中です。次の挑戦まで あと{remaining}です。",
  jet: "戦闘機は次の出撃に向けて整備中です。次の挑戦まで あと{remaining}です。",
  rocket: "ロケットは燃料を再注入しています。次の挑戦まで あと{remaining}です。",
  meteor: "隕石はまだ大気圏の向こうです。次の挑戦まで あと{remaining}です。",
  shuriken: "手裏剣は鞘の中で研ぎ直し中です。次の挑戦まで あと{remaining}です。",
  dragon: "龍は珠を抱えたまま眠っています。次の挑戦まで あと{remaining}です。",
  iaido: "刀はまだ鞘に納まったままです。次の挑戦まで あと{remaining}です。",
  ufo: "UFOはビームを再充電しています。次の挑戦まで あと{remaining}です。",
  cannon: "大砲は次の一発を装填中です。次の挑戦まで あと{remaining}です。",
  thunder: "雷神は次の一撃をためています。次の挑戦まで あと{remaining}です。",
  punch: "拳はまだ力をため直している最中です。次の挑戦まで あと{remaining}です。",
  sankaku: "三角くじの折り目がまだ乾いていません。次の挑戦まで あと{remaining}です。",
  ema: "絵馬はまだ願いを受け取っている最中です。次の挑戦まで あと{remaining}です。",
  kagamibiraki: "樽の用意が整うまでもう少しです。次の挑戦まで あと{remaining}です。",
  xmas: "プレゼントはただいま包み直し中です。次の挑戦まで あと{remaining}です。",
  vending: "自動販売機は商品を補充しています。次の挑戦まで あと{remaining}です。",
  receipt: "レジのロール紙を交換しています。次の挑戦まで あと{remaining}です。",
  ring: "輪はまだ拾い集めている途中です。次の挑戦まで あと{remaining}です。",
  safe: "金庫のダイヤルを掛け直しています。次の挑戦まで あと{remaining}です。",
};

export const DEFAULT_RETRY_MESSAGE =
  "少し時間をおいてから、もう一度お試しください。次の挑戦まで あと{remaining}です。";

export function buildRetryMessage(category: string | null, remainingMs: number): string {
  const template = (category && RETRY_MESSAGES[category]) || DEFAULT_RETRY_MESSAGE;
  return template.replace("{remaining}", formatRemaining(remainingMs));
}
