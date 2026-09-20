import { PRESET_CATEGORIES, type PresetObject } from "@/lib/types";

// カテゴリを選んだときに自動で並べる「定番の景品名」。
// 以前は DrawGroupCreator / DrawGroupEditor / BulkOrderCreator / SalesDemoCreator の
// 4ファイルに同じ表がコピーされており、PRESET_CATEGORIES にカテゴリを追加しても
// こちらの追加を忘れると「このカテゴリのテンプレートが見つかりませんでした」と
// なってしまっていた。二度と取りこぼさないよう、1ファイルに集約したうえで
// 未登録のカテゴリは quickFillLabels() がDBの登録名から自動で補完する。

// 6段階(1等〜6等)。参加賞/またね はクールダウン中に出す専用オブジェクトなので、
// 抽選の景品行としては並べない。
export const TIER_LABELS_6 = ["1等", "2等", "3等", "4等", "5等", "6等"];
// 4段階(大当たり/当たり/クーポン/はずれ)。
export const TIER_LABELS_4 = ["大当たり", "当たり", "クーポン", "はずれ"];

// 景品名として認識する語。長いものを先に並べ、「大当たり」を「当たり」より
// 優先して判定できるようにしている。
export const KNOWN_TIER_LABELS = [
  "1等",
  "2等",
  "3等",
  "4等",
  "5等",
  "6等",
  "大当たり",
  "当たり",
  "クーポン",
  "はずれ",
  "参加賞",
];

const SIX_TIER_WITH_BONUS = [...TIER_LABELS_6, "参加賞"];
const FOUR_TIER_WITH_BONUS = [...TIER_LABELS_4, "参加賞"];

// 景品の段階。2026-09 以降はどのカテゴリでも両方のテンプレートがそろっている
// (tools/badge/expand_tiers.py が不足ぶんを生成し、
//  supabase/rebuild_preset_catalog.sql が台帳に登録する)。
// QUICK_FILL はあくまで「そのカテゴリを選んだときの初期表示」でしかない。
export type TierSet = "six" | "four";

export const TIER_SET_LABEL: Record<TierSet, string> = {
  six: "1等〜6等",
  four: "大当たり・当たり・クーポン・はずれ",
};

// 段階を明示的に選んだときに並べる景品名。
export function tierSetLabels(set: TierSet): string[] {
  return set === "four" ? FOUR_TIER_WITH_BONUS : SIX_TIER_WITH_BONUS;
}

// カテゴリの既定の段階(これまでの初期表示を変えないための表)。
export function defaultTierSet(category: string): TierSet {
  const labels = QUICK_FILL[category];
  return labels && labels.includes("大当たり") ? "four" : "six";
}

export const QUICK_FILL: Record<string, string[]> = {
  amida: SIX_TIER_WITH_BONUS,
  box: SIX_TIER_WITH_BONUS,
  darts: FOUR_TIER_WITH_BONUS,
  garagara: FOUR_TIER_WITH_BONUS,
  omikuji: SIX_TIER_WITH_BONUS,
  scratch: FOUR_TIER_WITH_BONUS,
  roulette: FOUR_TIER_WITH_BONUS,
  dice: SIX_TIER_WITH_BONUS,
  treasure: FOUR_TIER_WITH_BONUS,
  slot: SIX_TIER_WITH_BONUS,
  gacha: SIX_TIER_WITH_BONUS,
  mallet: FOUR_TIER_WITH_BONUS,
  cat: FOUR_TIER_WITH_BONUS,
  daruma: SIX_TIER_WITH_BONUS,
  lantern: FOUR_TIER_WITH_BONUS,
  firework: FOUR_TIER_WITH_BONUS,
  airlottery: SIX_TIER_WITH_BONUS,
  fan: FOUR_TIER_WITH_BONUS,
  pachinko: SIX_TIER_WITH_BONUS,
  jet: FOUR_TIER_WITH_BONUS,
  rocket: SIX_TIER_WITH_BONUS,
  meteor: FOUR_TIER_WITH_BONUS,
  shuriken: SIX_TIER_WITH_BONUS,
  dragon: FOUR_TIER_WITH_BONUS,
  iaido: SIX_TIER_WITH_BONUS,
  ufo: FOUR_TIER_WITH_BONUS,
  cannon: SIX_TIER_WITH_BONUS,
  thunder: FOUR_TIER_WITH_BONUS,
  punch: SIX_TIER_WITH_BONUS,

  // 2026-09 追加分(seed_object_presets_v5/v6/v7.sql)。
  // いずれも6段階と4段階の両方を用意してあるが、初期表示は6段階にしておく。
  // (景品名の欄を書き換えれば、その場で4段階のテンプレートに切り替わる)
  sankaku: TIER_LABELS_6,
  ema: TIER_LABELS_6,
  kagamibiraki: TIER_LABELS_6,
  xmas: TIER_LABELS_6,
  vending: TIER_LABELS_6,
  receipt: TIER_LABELS_6,
  ring: TIER_LABELS_6,
  safe: TIER_LABELS_6,
  fukubukuro: TIER_LABELS_6,
  sakura: TIER_LABELS_6,
  mamemaki: TIER_LABELS_6,
  otoshidama: TIER_LABELS_6,
  crane: TIER_LABELS_6,
  mogura: TIER_LABELS_6,
  bowling: TIER_LABELS_6,
  makimono: TIER_LABELS_6,
  shateki: TIER_LABELS_6,
  kingyo: TIER_LABELS_6,
  kakigori: TIER_LABELS_6,
  halloween: TIER_LABELS_6,
  valentine: TIER_LABELS_6,
  tanabata: TIER_LABELS_6,
  sushi: TIER_LABELS_6,
  taiyaki: TIER_LABELS_6,
};

function inCategory(p: PresetObject, category: string): boolean {
  if (p.category === category) return true;
  const found = PRESET_CATEGORIES.find((c) => c.value === category);
  return !!found && p.category === found.label;
}

// カテゴリに対応する景品名の並び。
// QUICK_FILL に無いカテゴリ(あとから PRESET_CATEGORIES にだけ追加された場合や、
// 手動で登録した独自カテゴリ)でも空にならないよう、実際に登録されている
// テンプレート名から景品名を拾って並べる。
export function quickFillLabels(
  presets: PresetObject[],
  category: string,
  tierSet?: TierSet | null
): string[] {
  // 段階を指定されたらそれに従う(どのカテゴリでも両方そろっているため、
  // カテゴリごとの既定に縛られる必要はない)。
  if (tierSet) return tierSetLabels(tierSet);

  const explicit = QUICK_FILL[category];
  if (explicit && explicit.length > 0) return explicit;

  const found = new Set<string>();
  for (const p of presets) {
    if (!inCategory(p, category)) continue;
    for (const tier of KNOWN_TIER_LABELS) {
      if (p.name.includes(tier)) found.add(tier);
    }
  }
  // 「大当たり」しか無いのに「当たり」も拾ってしまうケースを除く。
  if (found.has("当たり") && !presets.some((p) => inCategory(p, category) && hasPlainAtari(p.name))) {
    found.delete("当たり");
  }
  const ordered = KNOWN_TIER_LABELS.filter((t) => found.has(t));
  return ordered.length > 0 ? ordered : TIER_LABELS_6;
}

function hasPlainAtari(name: string): boolean {
  return name.replace(/大当たり/g, "").includes("当たり");
}
