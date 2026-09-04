"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateHash } from "@/lib/hash";
import AttendProjectForm, { type AttendProjectFormValue } from "@/components/AttendProjectForm";
import type { AttendExperience, AttendProject, AttendProjectStatus } from "@/lib/types";
import { ATTEND_DISPLAY_TYPES } from "@/lib/types";

const displayTypeLabel: Record<string, string> = Object.fromEntries(
  ATTEND_DISPLAY_TYPES.map((d) => [d.value, d.label])
);

const experienceStatusLabel: Record<string, string> = {
  draft: "下書き",
  ready: "公開準備完了",
};

const projectStatusLabel: Record<AttendProjectStatus, string> = {
  draft: "下書き",
  active: "運用中",
  archived: "アーカイブ",
};

export default function AttendProjectEditor({
  project,
  experiences,
}: {
  project: AttendProject;
  experiences: AttendExperience[];
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
  const [addingExperience, setAddingExperience] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://app.fukubikiu.com";

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

  async function handleAddExperience() {
    setAddingExperience(true);
    setError(null);
    const { data, error } = await supabase
      .from("attend_experiences")
      .insert({
        project_id: project.id,
        name: `新しい体験 ${experiences.length + 1}`,
        hash: generateHash(),
        display_type: "aframe",
        object_source: "preset",
        status: "draft",
      })
      .select("id")
      .single();
    setAddingExperience(false);
    if (error || !data) {
      setError(`体験の追加に失敗しました: ${error?.message ?? ""}`);
      return;
    }
    router.push(`/admin/attend/experiences/${data.id}`);
  }

  async function handleDeleteExperience(id: string) {
    if (!confirm("この体験を削除しますか？")) return;
    const { error } = await supabase.from("attend_experiences").delete().eq("id", id);
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
          <h2 className="font-semibold">体験（拠点・シーン）一覧</h2>
          <button
            onClick={handleAddExperience}
            disabled={addingExperience}
            className="bg-sky-600 text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          >
            {addingExperience ? "追加中..." : "+ 体験を追加"}
          </button>
        </div>

        <div className="divide-y">
          {experiences.map((ex) => (
            <div key={ex.id} className="py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{ex.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                  <span>{displayTypeLabel[ex.display_type]}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      ex.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {experienceStatusLabel[ex.status]}
                  </span>
                  {ex.status === "ready" && (
                    <code className="break-all">{`${siteOrigin}/a/${ex.hash}`}</code>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link href={`/admin/attend/experiences/${ex.id}`} className="text-blue-600 hover:underline">
                  編集
                </Link>
                <button onClick={() => handleDeleteExperience(ex.id)} className="text-red-600 hover:underline">
                  削除
                </button>
              </div>
            </div>
          ))}
          {experiences.length === 0 && (
            <p className="text-sm text-slate-400 py-4">まだ体験が登録されていません</p>
          )}
        </div>
      </section>
    </div>
  );
}
