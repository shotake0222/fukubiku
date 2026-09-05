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

// "glb" = 3Dモデル版, "flat" = 動画/GIF/画像などの平面表示版(旧システムではmp4と
// 決め打ちしていたが、実際には古い資産にはGIF版も混在しているため、両方まとめて
// 「3Dモデルではない版」として扱う)。
export type FormatPref = "glb" | "flat" | null;

function isMp4(p: PresetObject) {
  return /\.mp4(\?|$)/i.test(p.model_url);
}
function isGif(p: PresetObject) {
  return /\.gif(\?|$)/i.test(p.model_url);
}
function isImage(p: PresetObject) {
  return /\.(gif|png|jpe?g|webp)(\?|$)/i.test(p.model_url);
}
// 3Dモデル判定は「動画でも画像でもない」で行う(components/arObjectComponents.tsx の
// assetKind() と同じ基準)。.glb だけでなく .gltf 等、拡張子が何であれ動画/画像以外は
// すべて3Dモデル扱いにする(過去に.gltfでアップロードされたものを見落とさないため)。
function isModel(p: PresetObject) {
  return !isMp4(p) && !isImage(p);
}
// 3Dモデルではない版(動画/GIF/画像)。旧システムの資産にはMP4ではなくGIFのものも
// 多いため、「MP4かどうか」ではなくこちらを使う。
function isFlat(p: PresetObject) {
  return !isModel(p);
}

// カテゴリの一致判定。本来はスラッグ(例: "amida")で統一されているはずだが、
// 手動登録時に日本語ラベル(例: "あみだくじ")がそのまま入ってしまっているデータが
// 混在していても拾えるよう、対応するラベルとの一致も許容する。
function matchesCategory(p: PresetObject, category: string): boolean {
  if (p.category === category) return true;
  const found = PRESET_CATEGORIES.find((c) => c.value === category);
  return !!found && p.category === found.label;
}

// あるカテゴリの中に、3Dモデル版と平面(動画/GIF/画像)版の両方が(景品名を問わず)
// 存在するかどうか。両方ある場合、UI側で形式を選ばせる。
export function categoryHasBothFormats(presets: PresetObject[], category: string): boolean {
  const inCat = presets.filter((p) => matchesCategory(p, category));
  return inCat.some(isModel) && inCat.some(isFlat);
}

// 平面版のボタンに付けるラベル。実際にそのカテゴリにある拡張子を見て
// 「MP4」「GIF」「動画/画像」を出し分ける(混在している場合は汎用表記)。
export function flatFormatLabel(presets: PresetObject[], category: string): string {
  const flatItems = presets.filter((p) => matchesCategory(p, category) && isFlat(p));
  const hasMp4 = flatItems.some(isMp4);
  const hasGif = flatItems.some(isGif);
  const hasOtherImage = flatItems.some((p) => isImage(p) && !isGif(p));
  if (hasMp4 && !hasGif && !hasOtherImage) return "MP4";
  if (hasGif && !hasMp4 && !hasOtherImage) return "GIF";
  return "動画/画像";
}

// 「カテゴリ」+「景品名(1等/はずれ 等)」から、該当するテンプレートを1つ選ぶ。
// 命名規則上、プリセット名には景品名がそのまま含まれる(例:「あみだくじ - 1等（3Dオブジェクト）」)。
// formatPref を指定すると、その形式(3Dモデル/平面)を優先して探す。
// 指定がない場合は従来通り3Dモデル版を優先する(後方互換)。
export function resolvePresetForTier(
  presets: PresetObject[],
  category: string,
  label: string,
  formatPref?: FormatPref
): PresetObject | null {
  const candidates = presets.filter((p) => matchesCategory(p, category) && p.name.includes(label));
  if (candidates.length === 0) return null;
  if (formatPref === "flat") {
    return candidates.find(isFlat) ?? candidates[0];
  }
  if (formatPref === "glb") {
    return candidates.find(isModel) ?? candidates[0];
  }
  const threeD = candidates.find(isModel);
  return threeD ?? candidates[0];
}
