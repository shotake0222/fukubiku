"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { createClient } from "@/lib/supabase/client";
import { compileMindTarget } from "@/lib/mindCompiler";
import type { AttendMarkerType, AttendMarkerWithProject, AttendProject } from "@/lib/types";

const ASSET_BUCKET = "assets";

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function Preview({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-full h-20 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">
        画像なし
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="w-full h-20 object-contain rounded bg-slate-50 border" />;
}

async function uploadToAssets(supabase: ReturnType<typeof createClient>, path: string, file: File | Blob, contentType?: string) {
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, { upsert: true, contentType });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function AttendMarkerManager({
  initialMarkers,
  projects,
}: {
  initialMarkers: AttendMarkerWithProject[];
  projects: AttendProject[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [markers, setMarkers] = useState(initialMarkers);
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [type, setType] = useState<AttendMarkerType>("aframe");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [targetImageFile, setTargetImageFile] = useState<File | null>(null);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) {
      setError("案件を選択してください");
      return;
    }
    if (type === "aframe" && !patternFile) {
      setError("AR.jsマーカーの.pattファイルを選択してください（AR.js Marker Trainingツールで生成したもの）");
      return;
    }
    if (type === "mindar_image" && !targetImageFile) {
      setError("MindARのターゲット画像を選択してください");
      return;
    }

    setSaving(true);
    try {
      const id = crypto.randomUUID();
      let previewImageUrl: string | null = null;
      let patternFileUrl: string | null = null;
      let targetImageUrl: string | null = null;
      let mindFileUrl: string | null = null;

      if (type === "aframe") {
        patternFileUrl = await uploadToAssets(
          supabase,
          `attend-markers/${id}/pattern${extOf(patternFile!.name) || ".patt"}`,
          patternFile!,
          "text/plain"
        );
        if (previewFile) {
          previewImageUrl = await uploadToAssets(
            supabase,
            `attend-markers/${id}/preview${extOf(previewFile.name) || ".png"}`,
            previewFile,
            previewFile.type || "image/png"
          );
        }
      } else {
        targetImageUrl = await uploadToAssets(
          supabase,
          `attend-markers/${id}/target-original${extOf(targetImageFile!.name) || ".jpg"}`,
          targetImageFile!,
          targetImageFile!.type || "image/jpeg"
        );
        previewImageUrl = targetImageUrl;
        setCompileProgress(0);
        const blob = await compileMindTarget(targetImageFile!, (p) => setCompileProgress(p));
        mindFileUrl = await uploadToAssets(
          supabase,
          `attend-markers/${id}/target.mind`,
          blob,
          "application/octet-stream"
        );
        setCompileProgress(null);
      }

      const { data, error } = await supabase
        .from("attend_markers")
        .insert({
          id,
          project_id: projectId,
          type,
          name: name || (type === "aframe" ? "無題のマーカー" : "無題のターゲット画像"),
          preview_image_url: previewImageUrl,
          pattern_file_url: patternFileUrl,
          target_image_url: targetImageUrl,
          mind_file_url: mindFileUrl,
          notes: notes || null,
        })
        .select("*")
        .single();
      if (error) throw error;

      const project = projects.find((p) => p.id === projectId);
      setMarkers((prev) => [{ ...(data as any), project_name: project?.client_name ?? "" }, ...prev]);
      setName("");
      setNotes("");
      setPreviewFile(null);
      setPatternFile(null);
      setTargetImageFile(null);
    } catch (err: any) {
      setError(`登録に失敗しました: ${err.message ?? err}`);
      setCompileProgress(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("このマーカーを削除しますか？（既存の発火条件からの参照は影響を受けません）")) return;
    setDeletingId(id);
    const { error } = await supabase.from("attend_markers").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }

  const groupedByProject = useMemo(() => {
    const map = new Map<string, { name: string; items: AttendMarkerWithProject[] }>();
    for (const m of markers) {
      if (!map.has(m.project_id)) map.set(m.project_id, { name: m.project_name, items: [] });
      map.get(m.project_id)!.items.push(m);
    }
    return Array.from(map.entries()).map(([projectId, v]) => ({ projectId, ...v }));
  }, [markers]);

  return (
    <div className="max-w-4xl space-y-6">
      <Script
        src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js"
        strategy="afterInteractive"
        onLoad={() => setMindarReady(true)}
      />

      <h1 className="text-lg font-bold">マーカー管理</h1>
      <p className="text-xs text-slate-500">
        A-Frame(AR.js)のマーカーとMindARのイメージトラッキング用画像を、案件・企業ごとに登録して管理します。
        発火条件の編集画面から選択して使い回せます。
      </p>

      <form onSubmit={handleAdd} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">新規マーカー登録</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1 block">
            <span className="text-sm font-medium">案件（企業・クライアント）</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.client_name}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-xs text-amber-600">先に「新規案件」で案件を作成してください</p>
            )}
          </label>
          <label className="space-y-1 block">
            <span className="text-sm font-medium">マーカー名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: パンフレット表紙" className="input" />
          </label>
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={type === "aframe"} onChange={() => setType("aframe")} />
            A-Frame（AR.jsパターンマーカー）
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={type === "mindar_image"} onChange={() => setType("mindar_image")} />
            MindAR（画像トラッキング）
          </label>
        </div>

        {type === "aframe" ? (
          <div className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-sm font-medium">
                .pattファイル（
                <a
                  href="https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  AR.js Marker Trainingツール
                </a>
                で画像から生成したものをアップロード） *
              </span>
              <input type="file" accept=".patt" onChange={(e) => setPatternFile(e.target.files?.[0] ?? null)} />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">プレビュー画像（任意・印刷用マーカー画像など）</span>
              <input type="file" accept="image/*" onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="space-y-1 block">
              <span className="text-sm font-medium">ターゲット画像 *</span>
              <input
                type="file"
                accept="image/*"
                disabled={!mindarReady}
                onChange={(e) => setTargetImageFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs text-slate-500">アップロードすると自動で.mindファイルにコンパイルされます。</p>
            {!mindarReady && <p className="text-xs text-slate-400">コンパイラを読み込み中...</p>}
            {compileProgress !== null && <p className="text-sm text-slate-500">コンパイル中... {Math.round(compileProgress)}%</p>}
          </div>
        )}

        <label className="space-y-1 block">
          <span className="text-sm font-medium">メモ</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || projects.length === 0}
          className="bg-pink-600 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "登録中..." : "登録"}
        </button>
      </form>

      {groupedByProject.map((g) => (
        <div key={g.projectId} className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">{g.name}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {g.items.map((m) => (
              <div key={m.id} className="border rounded-lg p-2 text-xs space-y-2 bg-white">
                <Preview url={m.preview_image_url} />
                <div className="truncate font-medium">{m.name}</div>
                <div className="text-[10px] text-slate-400">
                  {m.type === "aframe" ? "A-Frame(.patt)" : "MindAR(画像)"}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id)}
                  disabled={deletingId === m.id}
                  className="text-red-600 hover:underline"
                >
                  {deletingId === m.id ? "削除中..." : "削除"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {markers.length === 0 && <p className="text-sm text-slate-400">まだ登録されていません</p>}
    </div>
  );
}
