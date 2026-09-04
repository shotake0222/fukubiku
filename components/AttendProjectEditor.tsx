"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateHash } from "@/lib/hash";
import AttendProjectForm, { type AttendProjectFormValue } from "@/components/AttendProjectForm";
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
}

export default function AttendProjectEditor({
  project,
  items,
}: {
  project: AttendProject;
  items: AttendItemWithTriggerCount[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

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
              <div className="bg-sky-500 h-2" style={{ width: `${nfcPct}%` }} />
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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">アイテム（柄・グッズ）一覧</h2>
          <button
            onClick={handleAddItem}
            disabled={addingItem}
            className="bg-sky-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {addingItem ? "追加中..." : "+ アイテムを追加"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          1アイテムに複数の発火条件（画像トラッキング＋GPSなど）と、各発火条件に複数のARオブジェクトを設定できます。
        </p>

        <div className="divide-y">
          {items.map((it) => (
            <div key={it.id} className="py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>発火条件 {it.trigger_count}件</span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      it.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {itemStatusLabel[it.status]}
                  </span>
                  {it.status === "ready" && <code className="break-all">{`${siteOrigin}/a/${it.hash}`}</code>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={`/admin/attend/items/${it.id}`} className="text-blue-600 hover:underline">
                  編集
                </Link>
                <button onClick={() => handleDeleteItem(it.id)} className="text-red-600 hover:underline">
                  削除
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-400 py-4">まだアイテムが登録されていません</p>}
        </div>
      </section>
    </div>
  );
}
