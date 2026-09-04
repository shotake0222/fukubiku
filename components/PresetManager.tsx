"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AttendPresetGroup, PresetObject, ServiceTag } from "@/lib/types";

const ASSET_BUCKET = "assets";
const OTHER_CATEGORY = "__other__";
const UNCATEGORIZED = "__uncategorized__";

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function Preview({ url }: { url: string }) {
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
  return (
    <div className="w-full h-20 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">
      3Dモデル
    </div>
  );
}

export interface FixedCategoryOption {
  value: string;
  label: string;
}

export interface GroupOption {
  value: AttendPresetGroup;
  label: string;
  hint?: string;
}

export default function PresetManager({
  initialPresets,
  service,
  serviceLabel,
  fixedCategories,
  groups,
}: {
  initialPresets: PresetObject[];
  service: ServiceTag;
  serviceLabel: string;
  /** 指定するとカテゴリはこのリストからの選択(+その他自由入力)になる。未指定なら完全自由入力。 */
  fixedCategories?: FixedCategoryOption[];
  /** 指定すると「分類」の選択が追加され、一覧も分類→カテゴリの二階層で表示される。 */
  groups?: GroupOption[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [presets, setPresets] = useState(initialPresets);
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState<AttendPresetGroup | "">(groups?.[0]?.value ?? "");
  const [category, setCategory] = useState<string>(fixedCategories?.[0]?.value ?? "");
  const [customCategory, setCustomCategory] = useState("");
  const [freeCategory, setFreeCategory] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categorySuggestions = useMemo(() => {
    const relevant = groups
      ? presets.filter((p) => p.group_type === (groupType || null))
      : presets;
    return Array.from(new Set(relevant.map((p) => p.category).filter((c): c is string => !!c))).sort();
  }, [presets, groups, groupType]);

  function categoryLabel(value: string | null) {
    if (!value) return "未分類";
    if (fixedCategories) {
      const found = fixedCategories.find((c) => c.value === value);
      if (found) return found.label;
    }
    return value;
  }

  async function uploadToAssets(path: string, file: File) {
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) throw error;
    const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!modelFile) {
      setError("表示オブジェクト(動画/GIF/画像/.glb)ファイルを選択してください");
      return;
    }
    if (groups && !groupType) {
      setError("分類を選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const modelUrl = await uploadToAssets(`presets/${id}/model${extOf(modelFile.name)}`, modelFile);
      const thumbUrl = thumbFile
        ? await uploadToAssets(`presets/${id}/thumb${extOf(thumbFile.name) || ".jpg"}`, thumbFile)
        : null;

      const finalCategory = fixedCategories
        ? (category === OTHER_CATEGORY ? customCategory.trim() || null : category)
        : freeCategory.trim() || null;

      const { data, error } = await supabase
        .from("preset_objects")
        .insert({
          id,
          name,
          category: finalCategory,
          group_type: groups ? groupType || null : null,
          model_url: modelUrl,
          thumbnail_url: thumbUrl,
          service,
        })
        .select("*")
        .single();
      if (error) throw error;

      setPresets((prev) => [data as PresetObject, ...prev]);
      setName("");
      setModelFile(null);
      setThumbFile(null);
      setCustomCategory("");
      setFreeCategory("");
    } catch (err: any) {
      setError(`登録に失敗しました: ${err.message ?? err}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReplace(preset: PresetObject, file: File) {
    setReplacingId(preset.id);
    setError(null);
    try {
      // 同じファイル名だとブラウザ/CDNにキャッシュされる場合があるため、都度パスを変える
      const path = `presets/${preset.id}/model-${Date.now()}${extOf(file.name)}`;
      const modelUrl = await uploadToAssets(path, file);
      const { error } = await supabase
        .from("preset_objects")
        .update({ model_url: modelUrl })
        .eq("id", preset.id);
      if (error) throw error;
      setPresets((prev) => prev.map((p) => (p.id === preset.id ? { ...p, model_url: modelUrl } : p)));
    } catch (err: any) {
      setError(`差し替えに失敗しました: ${err.message ?? err}`);
    } finally {
      setReplacingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このプリセットオブジェクトを削除しますか？")) return;
    const { error } = await supabase.from("preset_objects").delete().eq("id", id);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function groupByCategory(items: PresetObject[]) {
    const map = new Map<string, PresetObject[]>();
    for (const p of items) {
      const key = p.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const fixedOrder = fixedCategories?.map((c) => c.value).filter((v) => map.has(v)) ?? [];
    const orderedKeys = [
      ...fixedOrder,
      ...Array.from(map.keys())
        .filter((k) => !fixedOrder.includes(k))
        .sort(),
    ];
    return orderedKeys.map((key) => ({
      key: key || UNCATEGORIZED,
      label: categoryLabel(key || null),
      items: map.get(key)!,
    }));
  }

  const groupedByGroupType = useMemo(() => {
    if (!groups) return null;
    return groups.map((g) => ({
      group: g,
      categories: groupByCategory(presets.filter((p) => p.group_type === g.value)),
    }));
  }, [presets, groups]);

  const groupedFlat = useMemo(() => {
    if (groups) return null;
    return groupByCategory(presets);
  }, [presets, groups]);

  function renderCard(p: PresetObject) {
    return (
      <div key={p.id} className="border rounded-lg p-2 text-xs space-y-2 bg-white">
        <Preview url={p.thumbnail_url || p.model_url} />
        <div className="truncate font-medium">{p.name}</div>
        <div className="flex items-center justify-between gap-1">
          <label className="text-blue-600 hover:underline cursor-pointer">
            {replacingId === p.id ? "差し替え中..." : "ファイル差し替え"}
            <input
              type="file"
              accept=".glb,.gltf,video/mp4,image/gif,image/*"
              className="hidden"
              disabled={replacingId === p.id}
              onChange={(e) => e.target.files?.[0] && handleReplace(p, e.target.files[0])}
            />
          </label>
          <button type="button" onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline">
            削除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-lg font-bold">表示オブジェクト管理（{serviceLabel}専用テンプレートライブラリ）</h1>
      <p className="text-xs text-slate-500">
        ここに登録したオブジェクトは{serviceLabel}の編集画面にのみ表示されます。他サービスとは完全に分かれています。
      </p>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">新規オブジェクト登録</h2>

        {groups && (
          <div className="space-y-2">
            <span className="text-sm font-medium">分類</span>
            <div className="grid sm:grid-cols-2 gap-2">
              {groups.map((g) => (
                <label
                  key={g.value}
                  className={`flex items-start gap-2 text-xs border rounded-lg p-2 cursor-pointer ${
                    groupType === g.value ? "border-slate-900 ring-1 ring-slate-900" : ""
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-0.5"
                    checked={groupType === g.value}
                    onChange={() => setGroupType(g.value)}
                  />
                  <span>
                    <span className="block font-medium">{g.label}</span>
                    {g.hint && <span className="block text-[10px] text-slate-500">{g.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">名前</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>

          {fixedCategories ? (
            <label className="space-y-1 block">
              <span className="text-sm font-medium">カテゴリ</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {fixedCategories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
                <option value={OTHER_CATEGORY}>その他（自由入力）</option>
              </select>
            </label>
          ) : (
            <label className="space-y-1 block">
              <span className="text-sm font-medium">カテゴリ（自由入力）</span>
              <input
                list="preset-category-suggestions"
                value={freeCategory}
                onChange={(e) => setFreeCategory(e.target.value)}
                placeholder="例: アクリルスタンド、コースター"
                className="input"
              />
              <datalist id="preset-category-suggestions">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          )}
        </div>
        {fixedCategories && category === OTHER_CATEGORY && (
          <label className="space-y-1 block">
            <span className="text-sm font-medium">カテゴリ名（新規）</span>
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="例: ルーレット"
              className="input"
            />
          </label>
        )}
        <label className="space-y-1 block">
          <span className="text-sm font-medium">表示オブジェクト（動画.mp4 / GIF / 画像 / .glb） *</span>
          <input
            type="file"
            accept=".glb,.gltf,video/mp4,image/gif,image/*"
            required
            onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">サムネイル画像（任意・省略時は本体を使用）</span>
          <input type="file" accept="image/*" onChange={(e) => setThumbFile(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "登録中..." : "登録"}
        </button>
      </form>

      {groupedByGroupType &&
        groupedByGroupType.map(({ group, categories }) => (
          <div key={group.value} className="space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
            <div>
              <h2 className="text-base font-bold">{group.label}</h2>
              {group.hint && <p className="text-xs text-slate-500">{group.hint}</p>}
            </div>
            {categories.map((cat) => (
              <div key={cat.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-500">{cat.label}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{cat.items.map(renderCard)}</div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-slate-400">まだ登録されていません</p>}
          </div>
        ))}

      {groupedFlat &&
        groupedFlat.map((cat) => (
          <div key={cat.key} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-500">{cat.label}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{cat.items.map(renderCard)}</div>
          </div>
        ))}

      {presets.length === 0 && <p className="text-sm text-slate-400">まだ登録されていません</p>}
    </div>
  );
}
