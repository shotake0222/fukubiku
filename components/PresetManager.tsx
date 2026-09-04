"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PRESET_CATEGORIES, type PresetObject, type ServiceTag } from "@/lib/types";

const ASSET_BUCKET = "assets";
const OTHER_CATEGORY = "__other__";

const SERVICE_LABEL: Record<string, string> = {
  "": "共通(両サービス)",
  fukubiku: "fukubiku専用",
  attend: "あてんど専用",
};

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function categoryLabel(value: string | null) {
  if (!value) return "未分類";
  const found = PRESET_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value;
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

export default function PresetManager({ initialPresets }: { initialPresets: PresetObject[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [presets, setPresets] = useState(initialPresets);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(PRESET_CATEGORIES[0].value);
  const [service, setService] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [updatingServiceId, setUpdatingServiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const modelUrl = await uploadToAssets(`presets/${id}/model${extOf(modelFile.name)}`, modelFile);
      const thumbUrl = thumbFile
        ? await uploadToAssets(`presets/${id}/thumb${extOf(thumbFile.name) || ".jpg"}`, thumbFile)
        : null;

      const finalCategory = category === OTHER_CATEGORY ? customCategory.trim() || null : category;

      const { data, error } = await supabase
        .from("preset_objects")
        .insert({
          id,
          name,
          category: finalCategory,
          model_url: modelUrl,
          thumbnail_url: thumbUrl,
          service: service || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      setPresets((prev) => [data as PresetObject, ...prev]);
      setName("");
      setModelFile(null);
      setThumbFile(null);
      setCustomCategory("");
      setService("");
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

  async function handleServiceChange(id: string, nextService: string) {
    setUpdatingServiceId(id);
    setError(null);
    try {
      const { error } = await supabase
        .from("preset_objects")
        .update({ service: nextService || null })
        .eq("id", id);
      if (error) throw error;
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, service: (nextService || null) as ServiceTag | null } : p))
      );
    } catch (err: any) {
      setError(`サービス設定の変更に失敗しました: ${err.message ?? err}`);
    } finally {
      setUpdatingServiceId(null);
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

  const grouped = useMemo(() => {
    const map = new Map<string, PresetObject[]>();
    for (const p of presets) {
      const key = p.category || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const orderedKeys = [
      ...PRESET_CATEGORIES.map((c) => c.value).filter((v) => map.has(v)),
      ...Array.from(map.keys()).filter((k) => !PRESET_CATEGORIES.some((c) => c.value === k)),
    ];
    return orderedKeys.map((key) => ({ key, label: categoryLabel(key || null), items: map.get(key)! }));
  }, [presets]);

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-lg font-bold">表示オブジェクト管理（テンプレートライブラリ）</h1>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">新規オブジェクト登録</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">名前</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">カテゴリ</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {PRESET_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
              <option value={OTHER_CATEGORY}>その他（自由入力）</option>
            </select>
          </label>
        </div>
        {category === OTHER_CATEGORY && (
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
          <span className="text-sm font-medium">利用サービス</span>
          <select value={service} onChange={(e) => setService(e.target.value)} className="input">
            <option value="">共通(fukubiku / あてんど両方)</option>
            <option value="fukubiku">fukubiku専用</option>
            <option value="attend">あてんど専用</option>
          </select>
        </label>
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

      {grouped.map((group) => (
        <div key={group.key} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-500">{group.label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {group.items.map((p) => (
              <div key={p.id} className="border rounded-lg p-2 text-xs space-y-2 bg-white">
                <Preview url={p.thumbnail_url || p.model_url} />
                <div className="truncate font-medium">{p.name}</div>
                <select
                  value={p.service || ""}
                  disabled={updatingServiceId === p.id}
                  onChange={(e) => handleServiceChange(p.id, e.target.value)}
                  className="w-full text-[10px] border rounded px-1 py-0.5"
                >
                  <option value="">{SERVICE_LABEL[""]}</option>
                  <option value="fukubiku">{SERVICE_LABEL["fukubiku"]}</option>
                  <option value="attend">{SERVICE_LABEL["attend"]}</option>
                </select>
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
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="text-red-600 hover:underline"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {presets.length === 0 && <p className="text-sm text-slate-400">まだ登録されていません</p>}
    </div>
  );
}
