// スタンプラリー参加者画面のデザインパターン。
//
// 配色だけを差し替えるとどれも同じ画面に見えてしまうので、
// 見出しの書体・スタンプの形・角の丸みまでテーマごとに変えている。
// URL単位で切り替えられるようにしているため（attend_rally_links.theme）、
// 同じラリーでも「観光協会サイトへの埋め込みはモノトーン、SNS配布は朱」
// といった出し分けができる。

export type AttendRallyTheme =
  // 和
  | "washi"
  | "urushi"
  | "ai"
  | "shu"
  // イベント
  | "yoichi"
  | "shotengai"
  | "umi"
  | "mori"
  // モダン
  | "mono"
  | "pastel"
  | "neon"
  // 聖地巡礼
  | "anime"
  | "yakei";

export type RallyThemeGroup = "和" | "イベント" | "モダン" | "聖地巡礼";

/** スタンプの形。和の落款は角丸の四角、レトロは真四角。 */
export type StampShape = "circle" | "square" | "seal";

export interface RallyTheme {
  value: AttendRallyTheme;
  label: string;
  group: RallyThemeGroup;
  hint: string;

  bg: string;
  panel: string;
  ink: string;
  sub: string;
  accent: string;
  onAccent: string;
  line: string;

  /** 見出しの書体。和・聖地巡礼の一部は明朝にして印象を変える。 */
  heading: "serif" | "sans";
  stampShape: StampShape;
  /** パネルの角丸(px)。レトロ/モダンは角ばらせる。 */
  radius: number;
  /** 背景に薄く重ねる模様（CSSのbackground-image。無い場合はnull）。 */
  pattern: string | null;
  /** アクセントを発光させる（ネオン・夜市など暗色テーマ向け）。 */
  glow: boolean;
}

export const SERIF_STACK = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", serif';
export const SANS_STACK = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

export function headingFont(theme: RallyTheme): string {
  return theme.heading === "serif" ? SERIF_STACK : SANS_STACK;
}

// 斜めストライプ・格子など、CSSだけで描ける軽い模様。
// 画像を足すと埋め込み先での読み込みが増えるので使わない。
const ASANOHA = "repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.025) 0 1px, transparent 1px 14px)";
const GOLD_GRID = "repeating-linear-gradient(0deg, rgba(201,162,39,0.07) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(201,162,39,0.07) 0 1px, transparent 1px 22px)";
const AWNING = "repeating-linear-gradient(90deg, rgba(228,87,46,0.06) 0 12px, transparent 12px 24px)";
const WAVE = "repeating-linear-gradient(0deg, rgba(14,124,155,0.05) 0 1px, transparent 1px 16px)";
const CITY_GLOW = "radial-gradient(120% 60% at 50% 0%, rgba(255,209,102,0.14), transparent 60%)";
const NEON_GLOW = "radial-gradient(100% 50% at 50% 0%, rgba(53,240,208,0.12), transparent 65%)";
const NIGHT_MARKET = "radial-gradient(90% 45% at 50% 0%, rgba(255,159,69,0.18), transparent 60%)";

export const RALLY_THEMES: Record<AttendRallyTheme, RallyTheme> = {
  washi: {
    value: "washi", label: "和紙", group: "和",
    hint: "生成りの紙に朱。門前町・寺社の定番",
    bg: "#f3ede0", panel: "#fffdf6", ink: "#33291f", sub: "#8a7a66",
    accent: "#b03a2e", onAccent: "#fffaf2", line: "#e2d7c3",
    heading: "serif", stampShape: "circle", radius: 16, pattern: ASANOHA, glow: false,
  },
  urushi: {
    value: "urushi", label: "漆黒金", group: "和",
    hint: "黒漆に金。夜間拝観・高級旅館・城のライトアップ",
    bg: "#14100c", panel: "#201a13", ink: "#f4ecd8", sub: "#a89473",
    accent: "#c9a227", onAccent: "#14100c", line: "#3a2f22",
    heading: "serif", stampShape: "seal", radius: 8, pattern: GOLD_GRID, glow: true,
  },
  ai: {
    value: "ai", label: "藍染", group: "和",
    hint: "藍と白。城下町・宿場町・工芸のまち",
    bg: "#eef2f7", panel: "#ffffff", ink: "#14243f", sub: "#6b7c96",
    accent: "#1b4a7a", onAccent: "#ffffff", line: "#ccd8e6",
    heading: "serif", stampShape: "circle", radius: 14, pattern: null, glow: false,
  },
  shu: {
    value: "shu", label: "朱", group: "和",
    hint: "朱塗りの鳥居。神社・初詣・祭事",
    bg: "#fff5f0", panel: "#fffaf7", ink: "#3a1f18", sub: "#9b6a5c",
    accent: "#d1382a", onAccent: "#fff5f0", line: "#f3d6cb",
    heading: "serif", stampShape: "seal", radius: 12, pattern: null, glow: false,
  },

  yoichi: {
    value: "yoichi", label: "夕市", group: "イベント",
    hint: "提灯の灯り。夜市・縁日・ナイトマーケット",
    bg: "#1a1026", panel: "#271a38", ink: "#f6ecff", sub: "#b39fd0",
    accent: "#ff9f45", onAccent: "#1a1026", line: "#3d2b54",
    heading: "sans", stampShape: "circle", radius: 20, pattern: NIGHT_MARKET, glow: true,
  },
  shotengai: {
    value: "shotengai", label: "商店街", group: "イベント",
    hint: "昭和レトロな看板色。アーケード・食べ歩き",
    bg: "#fdf6e3", panel: "#fffdf5", ink: "#2e2a20", sub: "#8a8067",
    accent: "#e4572e", onAccent: "#fffdf5", line: "#ece0c0",
    heading: "sans", stampShape: "square", radius: 6, pattern: AWNING, glow: false,
  },
  umi: {
    value: "umi", label: "海", group: "イベント",
    hint: "港町の青。離島・海沿い・マリンイベント",
    bg: "#eff8fb", panel: "#ffffff", ink: "#10333f", sub: "#6d8e9b",
    accent: "#0e7c9b", onAccent: "#ffffff", line: "#cfe6ee",
    heading: "sans", stampShape: "circle", radius: 22, pattern: WAVE, glow: false,
  },
  mori: {
    value: "mori", label: "森", group: "イベント",
    hint: "深い緑。国立公園・トレイル・キャンプ場",
    bg: "#f2f6ee", panel: "#ffffff", ink: "#1e2c1c", sub: "#6f8168",
    accent: "#2f7a45", onAccent: "#ffffff", line: "#d8e5cf",
    heading: "sans", stampShape: "circle", radius: 18, pattern: null, glow: false,
  },

  mono: {
    value: "mono", label: "モノトーン", group: "モダン",
    hint: "無彩色・角ばった構成。企業サイトに埋めても浮かない",
    bg: "#f5f5f5", panel: "#ffffff", ink: "#111111", sub: "#767676",
    accent: "#111111", onAccent: "#ffffff", line: "#e0e0e0",
    heading: "sans", stampShape: "square", radius: 4, pattern: null, glow: false,
  },
  pastel: {
    value: "pastel", label: "パステル", group: "モダン",
    hint: "やわらかい配色と大きな角丸。ファミリー・子ども向け",
    bg: "#fff7fb", panel: "#ffffff", ink: "#3b3050", sub: "#9086a6",
    accent: "#ff8fb1", onAccent: "#ffffff", line: "#f6e3ec",
    heading: "sans", stampShape: "circle", radius: 24, pattern: null, glow: false,
  },
  neon: {
    value: "neon", label: "ネオン", group: "モダン",
    hint: "暗背景に発光。テック系・eスポーツ・近未来演出",
    bg: "#07080f", panel: "#10131f", ink: "#e8f4ff", sub: "#7d8bb0",
    accent: "#35f0d0", onAccent: "#07080f", line: "#1e2740",
    heading: "sans", stampShape: "circle", radius: 16, pattern: NEON_GLOW, glow: true,
  },

  anime: {
    value: "anime", label: "アニメ調", group: "聖地巡礼",
    hint: "白抜けに高彩度。作品コラボ・キャラクター前面",
    bg: "#ffffff", panel: "#fbfcff", ink: "#1b2340", sub: "#7c86a8",
    accent: "#ff4d6d", onAccent: "#ffffff", line: "#e6e9f5",
    heading: "sans", stampShape: "circle", radius: 20, pattern: null, glow: false,
  },
  yakei: {
    value: "yakei", label: "夜景", group: "聖地巡礼",
    hint: "夜の街の灯り。ロケ地めぐり・夜間イベント",
    bg: "#0b1220", panel: "#151f33", ink: "#eaf0ff", sub: "#8fa0c0",
    accent: "#ffd166", onAccent: "#0b1220", line: "#24314d",
    heading: "sans", stampShape: "circle", radius: 16, pattern: CITY_GLOW, glow: true,
  },
};

export const RALLY_THEME_LIST: RallyTheme[] = Object.values(RALLY_THEMES);

export const RALLY_THEME_GROUPS: RallyThemeGroup[] = ["和", "イベント", "モダン", "聖地巡礼"];

/** 保存値が未知（テーマを減らした後など）でも画面が壊れないようにする。 */
export function resolveTheme(value: string | null | undefined): RallyTheme {
  if (value && value in RALLY_THEMES) return RALLY_THEMES[value as AttendRallyTheme];
  return RALLY_THEMES.washi;
}

/** スタンプ枠の角丸。形ごとに決める。 */
export function stampRadius(shape: StampShape): string {
  if (shape === "circle") return "9999px";
  if (shape === "seal") return "14%";
  return "0px";
}
