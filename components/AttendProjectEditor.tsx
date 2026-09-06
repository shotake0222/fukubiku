"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateHash } from "@/lib/hash";
import AttendProjectForm, { type AttendProjectFormValue } from "@/components/AttendProjectForm";
import { attendDisplayTypeShort } from "@/lib/types";
import type { AttendItem, AttendProject, AttendProjectStatus } from "@/lib/types";

const itemStatusLabel: Record<string, string> = {
  draft: "下書き",
  ready: "公開準備完了",
};

const projectStatusLabel: Record<AttendProjectStatus, string> = {
  draft: "下書き",
  active: "運用中",
  archived: "アーカイブ",
};

export interface AttendItemWithTriggerCount extends AttendItem {
  trigger_count: number;
  /** この発行URLがどの発火条件を持っているか(NFC/GPS/画像認識/マーカー/顔) */
  trigger_types: string[];
}

// 発火条件の種類ごとに色を変え、一覧で見分けられるようにする。
const TRIGGER_BADGE_CLASS: Record<string, string> = {
  nfc: "bg-violet-100 text-violet-700",
  gps: "bg-sky-100 text-sky-700",
  mindar_image: "bg-amber-100 text-amber-700",
  aframe: "bg-slate-200 text-slate-700",
  mindar_face: "bg-rose-100 text-rose-700",
};

export default function AttendProjectEditor({
  project,
  items,
}: {
  project: AttendProject;
  items: AttendItemWithTriggerCount[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState<AttendProjectFormValue>({
    client_name: project.client_name,
    order_date: project.order_date,
    due_date: project.due_date ?? "",
    person_in_charge: project.person_in_charge ?? "",
    plan: project.plan,
    nfc_tag_total: project.nfc_tag_total != null ? String(project.nfc_tag_total) : "",
    notes: project.notes ?? "",
  });
  const [nfcUsed, setNfcUsed] = useState(String(project.nfc_tag_used ?? 0));
  const [status, setStatus] = useState<AttendProjectStatus>(project.status);
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";

  const nfcTotal = form.nfc_tag_total ? Number(form.nfc_tag_total) : null;
  const nfcUsedNum = Number(nfcUsed) || 0;
  const nfcPct = nfcTotal ? Math.min(100, Math.round((nfcUsedNum / nfcTotal) * 100)) : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from("attend_projects")
      .update({
        client_name: form.client_name,
        order_date: form.order_date,
        due_date: form.due_date || null,
        person_in_charge: form.person_in_charge || null,
        plan: form.plan,
        nfc_tag_total: form.nfc_tag_total ? Number(form.nfc_tag_total) : null,
        nfc_tag_used: nfcUsedNum,
        notes: form.notes || null,
        status,
      })
      .eq("id", project.id);
    setSaving(false);
    if (error) {
      setError(`保存に失敗しました: ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function handleAddItem() {
    setAddingItem(true);
    setError(null);
    const { data, error } = await supabase
      .from("attend_items")
      .insert({
        project_id: project.id,
        name: `新しいアイテム ${items.length + 1}`,
        hash: generateHash(),
        status: "draft",
      })
      .select("id")
      .single();
    setAddingItem(false);
    if (error || !data) {
      setError(`アイテムの追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    router.push(`/admin/attend/items/${data.id}`);
  }

  async function handleDeleteItem(id: string) {
    if (!confirm("このアイテムを削除しますか？（内包する発火条件・オブジェクトも削除されます）")) return;
    const { error } = await supabase.from("attend_items").delete().eq("id", id);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">案件編集: {project.client_name}</h1>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AttendProjectStatus)}
          className="text-xs border rounded-full px-3 py-1"
        >
          {(Object.keys(projectStatusLabel) as AttendProjectStatus[]).map((s) => (
            <option key={s} value={s}>
              {projectStatusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">案件情報</h2>
        <AttendProjectForm value={form} onChange={setForm} />

        <div className="space-y-2">
          <span className="text-sm font-medium">NFCタグ配布進捗（使用済み枚数）</span>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              value={nfcUsed}
              onChange={(e) => setNfcUsed(e.target.value)}
              className="input w-32"
            />
            <span className="text-sm text-slate-500">/ {nfcTotal ?? "未設定"} 枚</span>
          </div>
          {nfcPct !== null && (
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-pink-500 h-2" style={{ width: `${nfcPct}%` }} />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </section>

      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">発行URL一覧</h2>
            <p className="text-xs text-slate-500 mt-1">
              1つの案件で何本でもURLを発行できます。URLは「柄・グッズ・スポット」など、
              配布する単位ごとに1本ずつ作ってください。
            </p>
          </div>
          <button
            onClick={handleAddItem}
            disabled={addingItem}
            className="bg-pink-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50 shrink-0"
          >
            {addingItem ? "追加中..." : "+ URLを発行"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          1本のURLに、NFC・GPS・画像認識・マーカーを何種類でも組み合わせられます
          （例: 同じキーホルダーで「かざす」と「その場所へ行く」の両方を用意する）。
          利用者側では発火条件が複数あると切り替えボタンが出ます。
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-3 font-medium">名前</th>
                <th className="py-2 pr-3 font-medium">発火条件</th>
                <th className="py-2 pr-3 font-medium">状態</th>
                <th className="py-2 pr-3 font-medium">クライアント提供URL</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => {
                const url = `${siteOrigin}/a/${it.hash}`;
                return (
                  <tr key={it.id} className="align-top">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/attend/items/${it.id}`} className="font-medium text-blue-600 hover:underline">
                        {it.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      {it.trigger_types.length === 0 ? (
                        <span className="text-xs text-amber-600">未設定</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {it.trigger_types.map((t, i) => (
                            <span
                              key={i}
                              className={`px-2 py-0.5 rounded-full text-[11px] ${
                                TRIGGER_BADGE_CLASS[t] ?? "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {attendDisplayTypeShort(t)}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] ${
                          it.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {itemStatusLabel[it.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {it.status === "ready" ? (
                        <div className="flex items-center gap-2">
                          <code className="text-xs break-all">{url}</code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(url);
                              setCopiedId(it.id);
                              setTimeout(() => setCopiedId(null), 1500);
                            }}
                            className="text-xs px-2 py-0.5 rounded border hover:bg-slate-50 shrink-0"
                          >
                            {copiedId === it.id ? "コピーしました" : "コピー"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">公開準備完了にすると発行されます</span>
                      )}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/attend/items/${it.id}`} className="text-blue-600 hover:underline">
                        編集
                      </Link>
                      <button onClick={() => handleDeleteItem(it.id)} className="text-red-600 hover:underline ml-3">
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              まだURLがありません。「+ URLを発行」から作成してください。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
