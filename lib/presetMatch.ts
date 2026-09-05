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

// 「カテゴリ」+「景品名(1等/はずれ 等)」から、該当するテンプレートを1つ選ぶ。
// 命名規則上、プリセット名には景品名がそのまま含まれる(例:「あみだくじ - 1等（3Dオブジェクト）」)。
// 同じ景品名で複数候補(3Dオブジェクト版とmp4版など)がある場合は、3Dオブジェクト版を優先する。
export function resolvePresetForTier(
  presets: PresetObject[],
  category: string,
  label: string
): PresetObject | null {
  const candidates = presets.filter((p) => p.category === category && p.name.includes(label));
  if (candidates.length === 0) return null;
  const threeD = candidates.find((p) => /\.glb(\?|$)/i.test(p.model_url));
  return threeD ?? candidates[0];
}
