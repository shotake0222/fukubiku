"use client";

import { useMemo, useState } from "react";
import type { ObjectSource, PresetObject } from "@/lib/types";
import { PRESET_CATEGORIES } from "@/lib/types";

const UNCATEGORIZED = "__uncategorized__";

function categoryLabel(value: string) {
  if (value === UNCATEGORIZED) return "未分類";
  const found = PRESET_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value;
}

export function PresetPreview({ url }: { url: string }) {
  if (/\.mp4(\?|$)/i.test(url)) {
    return (
      <video
        src={url}
        className="w-full h-20 object-cover rounded bg-slate-100"
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }
  if (/\.(gif|png|jpe?g|webp)(\?|$)/i.test(url)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="w-full h-20 object-cover rounded" />;
  }
  return <div className="w-full h-20 bg-slate-100 rounded" />;
}

// 表示オブジェクトの選択UI(テンプレートライブラリから選ぶ/独自ファイルをアップロードする)。
// OrderEditor.tsxにあった同種のUIを、一括作成画面や抽選セット画面でも使い回せるよう
// 汎用コンポーネントとして切り出したもの。何か選択済みの場合はデフォルトで折りたたみ表示にし、
// 複数行(景品ごと)を並べたときに画面が縦に長くなりすぎないようにしている。
export default function TemplatePicker({
  presets,
  objectSource,
  presetObjectId,
  customModelUrl,
  uploading,
  onObjectSourceChange,
  onPresetObjectIdChange,
  onUploadFile,
}: {
  presets: PresetObject[];
  objectSource: ObjectSource;
  presetObjectId: string | null;
  customModelUrl: string | null;
  uploading?: boolean;
  onObjectSourceChange: (s: ObjectSource) => void;
  onPresetObjectIdChange: (id: string) => void;
  onUploadFile: (file: File) => void;
}) {
  const categoriesInUse = useMemo(() => {
    const set = new Set(presets.map((p) => p.category || UNCATEGORIZED));
    const ordered = [
      ...PRESET_CATEGORIES.map((c) => c.value).filter((v) => set.has(v)),
      ...Array.from(set).filter((v) => !PRESET_CATEGORIES.some((c) => c.value === v)),
    ];
    return ordered;
  }, [presets]);

  const selectedPreset = presets.find((p) => p.id === presetObjectId) || null;
  const [selectedCategory, setSelectedCategory] = useState<string>(
    selectedPreset?.category || categoriesInUse[0] || UNCATEGORIZED
  );
  const hasSelection = !!presetObjectId || !!customModelUrl;
  const [expanded, setExpanded] = useState(!hasSelection);

  const presetsInCategory = presets.filter((p) => (p.category || UNCATEGORIZED) === selectedCategory);

  if (!expanded) {
    const previewUrl = selectedPreset?.thumbnail_url || selectedPreset?.model_url || customModelUrl || "";
    return (
      <div className="flex items-center gap-2 border rounded-lg p-2 text-xs">
        <div className="w-14 h-14 flex-shrink-0 overflow-hidden rounded">
          {previewUrl ? <PresetPreview url={previewUrl} /> : null}
        </div>
        <div className="flex-1 truncate">{selectedPreset?.name || customModelUrl || "未選択"}</div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="px-2 py-1 rounded border hover:bg-slate-50 whitespace-nowrap"
        >
          変更
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border rounded-lg p-3">
      <div className="flex gap-4">
        {(["preset", "upload"] as ObjectSource[]).map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <input type="radio" checked={objectSource === s} onChange={() => onObjectSourceChange(s)} />
            {s === "preset" ? "テンプレートから選択" : "独自にアップロード"}
          </label>
        ))}
      </div>

      {objectSource === "preset" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {categoriesInUse.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-3 py-1 rounded-full border ${
                  selectedCategory === cat ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
            {categoriesInUse.length === 0 && (
              <p className="text-sm text-slate-400">
                テンプレートがありません。「オブジェクト管理」から登録してください。
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {presetsInCategory.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => onPresetObjectIdChange(p.id)}
                className={`border rounded-lg p-2 text-xs text-left space-y-2 ${
                  presetObjectId === p.id ? "ring-2 ring-slate-900 border-slate-900" : ""
                }`}
              >
                <PresetPreview url={p.thumbnail_url || p.model_url} />
                <div className="truncate">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="file"
            accept=".glb,.gltf,video/mp4,image/gif,image/*"
            onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])}
          />
          <p className="text-xs text-slate-400">
            動画(.mp4)、GIF/画像、または.glb形式の3Dモデルをアップロードできます。
          </p>
          {uploading && <p className="text-sm text-slate-500">アップロード中...</p>}
          {customModelUrl && (
            <div className="space-y-1">
              <PresetPreview url={customModelUrl} />
              <p className="text-xs text-emerald-700 break-all">アップロード済み: {customModelUrl}</p>
            </div>
          )}
        </div>
      )}

      {hasSelection && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs px-3 py-1 rounded-lg border hover:bg-slate-50"
        >
          閉じる
        </button>
      )}
    </div>
  );
}
