import { PRESET_CATEGORIES, type PresetObject } from "@/lib/types";

// アップロードされたファイル名(またはmodel_url)から、既知のカテゴリを推測する。
// テンプレートの命名規則(例: amida_1tou_3d.glb, garagara_atari.mp4)が
// 「<カテゴリ>_...」で始まっていることを利用する。
export function guessCategoryFromFilename(nameOrUrl: string): string | null {
  const base = nameOrUrl.split("/").pop() || nameOrUrl;
  const lower = base.toLowerCase();
  for (const c of PRESET_CATEGORIES) {
    if (lower.startsWith(`${c.value}_`) || lower === c.value) {
      return c.value;
    }
  }
  return null;
}

export type FormatPref = "glb" | "mp4" | null;

function isGlb(p: PresetObject) {
  return /\.glb(\?|$)/i.test(p.model_url);
}
function isMp4(p: PresetObject) {
  return /\.mp4(\?|$)/i.test(p.model_url);
}

// あるカテゴリの中に、3Dオブジェクト(glb)版とMP4版の両方が(景品名を問わず)
// 存在するかどうか。両方ある場合、UI側で「3Dオブジェクト/MP4」を選ばせる。
export function categoryHasBothFormats(presets: PresetObject[], category: string): boolean {
  const inCat = presets.filter((p) => p.category === category);
  return inCat.some(isGlb) && inCat.some(isMp4);
}

// 「カテゴリ」+「景品名(1等/はずれ 等)」から、該当するテンプレートを1つ選ぶ。
// 命名規則上、プリセット名には景品名がそのまま含まれる(例:「あみだくじ - 1等（3Dオブジェクト）」)。
// formatPref を指定すると、その形式(3Dオブジェクト/MP4)を優先して探す。
// 指定がない場合は従来通り3Dオブジェクト版を優先する(後方互換)。
export function resolvePresetForTier(
  presets: PresetObject[],
  category: string,
  label: string,
  formatPref?: FormatPref
): PresetObject | null {
  const candidates = presets.filter((p) => p.category === category && p.name.includes(label));
  if (candidates.length === 0) return null;
  if (formatPref === "mp4") {
    return candidates.find(isMp4) ?? candidates.find((p) => !isGlb(p)) ?? candidates[0];
  }
  if (formatPref === "glb") {
    return candidates.find(isGlb) ?? candidates[0];
  }
  const threeD = candidates.find(isGlb);
  return threeD ?? candidates[0];
}
