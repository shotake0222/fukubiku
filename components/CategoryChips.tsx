"use client";

import { PRESET_CATEGORIES, type PresetObject } from "@/lib/types";
import {
  categoryHasBothFormats,
  countPresetsInCategory,
  emptyCategories,
  flatFormatLabel,
  type FormatPref,
} from "@/lib/presetMatch";
import { TIER_SET_LABEL, type TierSet } from "@/lib/presetQuickFill";

// カテゴリ選択のボタン列。
// 抽選セット作成 / 一括作成 / 抽選セット編集 / 営業デモ の4画面に同じものが
// コピーされていたため共通化した(QUICK_FILLと同じ理由。片方だけ直して
// もう片方が古いまま、という事故を防ぐ)。
//
// テンプレートが1件も登録されていないカテゴリは押せないようにして、
// 「選んだあとに全行でテンプレートが見つからない」という分かりにくい失敗を
// 起こさないようにしている。台帳が欠けている場合は上部に警告を出す。
export default function CategoryChips({
  presets,
  selectedCategory,
  selectedFormat,
  onSelect,
  suffix = "",
  showSelection = true,
  tierSet,
  onTierSetChange,
}: {
  presets: PresetObject[];
  selectedCategory?: string | null;
  selectedFormat?: FormatPref;
  onSelect: (category: string, format?: FormatPref) => void;
  suffix?: string;
  showSelection?: boolean;
  /** 景品の段階。指定するとカテゴリの上に切り替えボタンを出す。 */
  tierSet?: TierSet;
  onTierSetChange?: (set: TierSet) => void;
}) {
  const empties = emptyCategories(presets);

  return (
    <div className="space-y-2">
      {empties.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          テンプレートが登録されていないカテゴリが {empties.length} 件あります（選択できません）。
          Supabaseで <code className="font-mono">supabase/rebuild_preset_catalog.sql</code> を実行すると、
          アプリに入っているテンプレートがすべて登録されます。
        </p>
      )}
      {onTierSetChange && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">景品の段階</span>
          {(["six", "four"] as TierSet[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onTierSetChange(s)}
              className={`px-3 py-1 rounded-full border ${
                tierSet === s ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
              }`}
            >
              {TIER_SET_LABEL[s]}
            </button>
          ))}
          <span className="text-slate-400">
            どちらの段階もすべてのカテゴリで使えます
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {PRESET_CATEGORIES.map((cat) => {
          if (countPresetsInCategory(presets, cat.value) === 0) {
            return (
              <span
                key={cat.value}
                title="このカテゴリのテンプレートが台帳に登録されていません"
                className="text-xs px-3 py-1 rounded-full border border-dashed text-slate-400 cursor-not-allowed"
              >
                {cat.label}（未登録）
              </span>
            );
          }

          const active = showSelection && selectedCategory === cat.value;

          if (categoryHasBothFormats(presets, cat.value)) {
            return (
              <span key={cat.value} className="inline-flex rounded-full border overflow-hidden">
                <button
                  type="button"
                  onClick={() => onSelect(cat.value, "glb")}
                  className={`text-xs px-3 py-1 ${
                    active && selectedFormat === "glb" ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  {cat.label}（3Dオブジェクト）{suffix}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(cat.value, "flat")}
                  className={`text-xs px-3 py-1 border-l ${
                    active && selectedFormat === "flat" ? "bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  {cat.label}（{flatFormatLabel(presets, cat.value)}）{suffix}
                </button>
              </span>
            );
          }

          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onSelect(cat.value)}
              className={`text-xs px-3 py-1 rounded-full border ${
                active ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
              }`}
            >
              {cat.label}
              {suffix}
            </button>
          );
        })}
      </div>
    </div>
  );
}
