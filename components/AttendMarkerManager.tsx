"use client";

import { useMemo, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { compileMindTargets, loadImageElement, loadImageElementFromUrl, ensureMindArCompiler } from "@/lib/mindCompiler";
import type { AttendMarkerType, AttendMarkerWithProject, AttendProject } from "@/lib/types";

const ASSET_BUCKET = "assets";

function extOf(name: string) {
  const m = name.match(/\.[a-zA-Z0-9]+$/);
  return m ? m[0] : "";
}

function Preview({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="w-full h-16 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">
        画像なし
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="w-full h-16 object-contain rounded bg-slate-50 border" />;
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
  const [targetImageFiles, setTargetImageFiles] = useState<File[]>([]);
  const [compileProgress, setCompileProgress] = useState<number | null>(null);
  const [mindarReady, setMindarReady] = useState(false);
  const [mindarError, setMindarError] = useState<string | null>(null);

  // MindARのコンパイラはESモジュールのため、通常の<script>では読み込めない
  // (詳細は lib/mindCompiler.ts のコメント)。専用ローダーで読み込む。
  useEffect(() => {
    let alive = true;
    ensureMindArCompiler()
      .then(() => alive && setMindarReady(true))
      .catch((e) => alive && setMindarError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addingImageToId, setAddingImageToId] = useState<string | null>(null);

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
    if (type === "mindar_image" && targetImageFiles.length === 0) {
      setError("MindARのターゲット画像を1枚以上選択してください（複数選択可）");
      return;
    }

    setSaving(true);
    try {
      const id = crypto.randomUUID();
      let previewImageUrl: string | null = null;
      let patternFileUrl: string | null = null;
      let mindFileUrl: string | null = null;
      let imageRows: { target_index: number; name: string | null; image_url: string }[] = [];

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
        setCompileProgress(0);
        const uploadedUrls: string[] = [];
        for (let i = 0; i < targetImageFiles.length; i++) {
          const f = targetImageFiles[i];
          const url = await uploadToAssets(
            supabase,
            `attend-markers/${id}/image-${i}${extOf(f.name) || ".jpg"}`,
            f,
            f.type || "image/jpeg"
          );
          uploadedUrls.push(url);
        }
        previewImageUrl = uploadedUrls[0] ?? null;
        imageRows = uploadedUrls.map((url, i) => ({ target_index: i, name: targetImageFiles[i].name, image_url: url }));

        const imgElements = await Promise.all(targetImageFiles.map((f) => loadImageElement(f)));
        const blob = await compileMindTargets(imgElements, (p) => setCompileProgress(p));
        mindFileUrl = await uploadToAssets(supabase, `attend-markers/${id}/target.mind`, blob, "application/octet-stream");
        setCompileProgress(null);
      }

      const { data: markerRow, error: insertError } = await supabase
        .from("attend_markers")
        .insert({
          id,
          project_id: projectId,
          type,
          name: name || (type === "aframe" ? "無題のマーカー" : "無題のターゲット画像セット"),
          preview_image_url: previewImageUrl,
          pattern_file_url: patternFileUrl,
          mind_file_url: mindFileUrl,
          notes: notes || null,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      let insertedImages: any[] = [];
      if (imageRows.length > 0) {
        const { data: imgData, error: imgError } = await supabase
          .from("attend_marker_images")
          .insert(imageRows.map((r) => ({ marker_id: id, ...r })))
          .select("*");
        if (imgError) throw imgError;
        insertedImages = imgData ?? [];
      }

      const project = projects.find((p) => p.id === projectId);
      setMarkers((prev) => [
        { ...(markerRow as any), images: insertedImages, project_name: project?.client_name ?? "" },
        ...prev,
      ]);
      setName("");
      setNotes("");
      setPreviewFile(null);
      setPatternFile(null);
      setTargetImageFiles([]);
    } catch (err: any) {
      setError(`登録に失敗しました: ${err.message ?? err}`);
      setCompileProgress(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddImageToMarker(marker: AttendMarkerWithProject, files: FileList) {
    setError(null);
    setAddingImageToId(marker.id);
    setCompileProgress(0);
    try {
      const newFiles = Array.from(files);
      const startIndex = marker.images.length;
      const uploadedNew: { target_index: number; name: string | null; image_url: string }[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        const url = await uploadToAssets(
          supabase,
          `attend-markers/${marker.id}/image-${startIndex + i}-${Date.now()}${extOf(f.name) || ".jpg"}`,
          f,
          f.type || "image/jpeg"
        );
        uploadedNew.push({ target_index: startIndex + i, name: f.name, image_url: url });
      }

      // 既存画像 + 新規画像 をすべて読み込み直して.mindを再コンパイル(順序=targetIndexを維持)
      const existingElements = await Promise.all(
        marker.images.map((im) => loadImageElementFromUrl(im.image_url))
      );
      const newElements = await Promise.all(newFiles.map((f) => loadImageElement(f)));
      const blob = await compileMindTargets([...existingElements, ...newElements], (p) => setCompileProgress(p));
      const mindFileUrl = await uploadToAssets(
        supabase,
        `attend-markers/${marker.id}/target-${Date.now()}.mind`,
        blob,
        "application/octet-stream"
      );

      const { data: imgData, error: imgError } = await supabase
        .from("attend_marker_images")
        .insert(uploadedNew.map((r) => ({ marker_id: marker.id, ...r })))
        .select("*");
      if (imgError) throw imgError;

      const { error: updateError } = await supabase
        .from("attend_markers")
        .update({ mind_file_url: mindFileUrl })
        .eq("id", marker.id);
      if (updateError) throw updateError;

      setMarkers((prev) =>
        prev.map((m) =>
          m.id === marker.id
            ? { ...m, mind_file_url: mindFileUrl, images: [...m.images, ...((imgData as any) ?? [])] }
            : m
        )
      );
    } catch (err: any) {
      setError(`画像の追加に失敗しました: ${err.message ?? err}`);
    } finally {
      setCompileProgress(null);
      setAddingImageToId(null);
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

      <h1 className="text-lg font-bold">マーカー管理</h1>
      <p className="text-xs text-slate-500">
        A-Frame(AR.js)のマーカーとMindARのイメージトラッキング用画像を、案件・企業ごとに登録して管理します。
        MindARは複数の画像を1つの.mindファイルにまとめて同時にトラッキングできるのが標準の使い方のため、
        1つのマーカーに画像を複数枚登録できます（例: シリーズ物のグッズをまとめて1つのマーカーとして管理）。
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: パンフレット表紙シリーズ"
              className="input"
            />
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
              <span className="text-sm font-medium">ターゲット画像 *（複数選択可）</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={!mindarReady}
                onChange={(e) => setTargetImageFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
            </label>
            {targetImageFiles.length > 0 && (
              <p className="text-xs text-slate-500">{targetImageFiles.length}枚選択中（この順番でtargetIndexが割り当てられます）</p>
            )}
            <p className="text-xs text-slate-500">
              アップロードすると自動で1つの.mindファイルにまとめてコンパイルされます。あとから画像を追加登録することもできます。
            </p>
            {!mindarReady && (
              <p className={mindarError ? "text-xs text-red-600" : "text-xs text-slate-400"}>
                {mindarError ?? "コンパイラを読み込み中..."}
              </p>
            )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {g.items.map((m) => (
              <div key={m.id} className="border rounded-lg p-2 text-xs space-y-2 bg-white">
                {m.type === "mindar_image" && m.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
                    {m.images.map((im) => (
                      <div key={im.id} className="relative">
                        <Preview url={im.image_url} />
                        <span className="absolute top-0 left-0 bg-black/60 text-white text-[9px] px-1 rounded-br">
                          {im.target_index}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Preview url={m.preview_image_url} />
                )}
                <div className="truncate font-medium">{m.name}</div>
                <div className="text-[10px] text-slate-400">
                  {m.type === "aframe" ? "A-Frame(.patt)" : `MindAR(画像 ${m.images.length}枚)`}
                </div>
                <div className="flex items-center justify-between gap-1">
                  {m.type === "mindar_image" && (
                    <label className="text-blue-600 hover:underline cursor-pointer">
                      {addingImageToId === m.id ? "追加中..." : "+ 画像を追加"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={addingImageToId === m.id || !mindarReady}
                        onChange={(e) => e.target.files?.length && handleAddImageToMarker(m, e.target.files)}
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="text-red-600 hover:underline ml-auto"
                  >
                    {deletingId === m.id ? "削除中..." : "削除"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {markers.length === 0 && <p className="text-sm text-slate-400">まだ登録されていません</p>}
    </div>
  );
}
