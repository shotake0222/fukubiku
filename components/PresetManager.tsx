"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PresetObject } from "@/lib/types";

const ASSET_BUCKET = "assets";

export default function PresetManager({ initialPresets }: { initialPresets: PresetObject[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [presets, setPresets] = useState(initialPresets);
  const [name, setName] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadToAssets(path: string, file: File) {
    const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from(ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!modelFile) {
      setError("3Dモデル(glb)ファイルを選択してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = crypto.randomUUID();
      const modelUrl = await uploadToAssets(`presets/${id}/model.glb`, modelFile);
      const thumbUrl = thumbFile
        ? await uploadToAssets(`presets/${id}/thumb${thumbFile.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg"}`, thumbFile)
        : null;

      const { data, error } = await supabase
        .from("preset_objects")
        .insert({ id, name, model_url: modelUrl, thumbnail_url: thumbUrl })
        .select("*")
        .single();
      if (error) throw error;

      setPresets((prev) => [data as PresetObject, ...prev]);
      setName("");
      setModelFile(null);
      setThumbFile(null);
    } catch (err: any) {
      setError(`登録に失敗しました: ${err.message ?? err}`);
    } finally {
      setSaving(false);
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

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-lg font-bold">表示オブジェクト管理（プリセットライブラリ）</h1>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">新規オブジェクト登録</h2>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">名前</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">3Dモデル (.glb) *</span>
          <input
            type="file"
            accept=".glb,.gltf"
            required
            onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">サムネイル画像（任意）</span>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {presets.map((p) => (
          <div key={p.id} className="border rounded-lg p-2 text-xs space-y-2 bg-white">
            {p.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnail_url} alt={p.name} className="w-full h-20 object-cover rounded" />
            ) : (
              <div className="w-full h-20 bg-slate-100 rounded" />
            )}
            <div className="truncate font-medium">{p.name}</div>
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              className="text-red-600 hover:underline"
            >
              削除
            </button>
          </div>
        ))}
        {presets.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">まだ登録されていません</p>
        )}
      </div>
    </div>
  );
}
