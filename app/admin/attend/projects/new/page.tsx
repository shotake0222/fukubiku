"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AttendProjectForm, {
  emptyAttendProjectForm,
  type AttendProjectFormValue,
} from "@/components/AttendProjectForm";
import { createDefaultRally } from "@/lib/rallyDefaults";

export default function NewAttendProjectPage() {
  const router = useRouter();
  const [value, setValue] = useState<AttendProjectFormValue>(emptyAttendProjectForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("attend_projects")
      .insert({
        client_name: value.client_name,
        order_date: value.order_date,
        due_date: value.due_date || null,
        person_in_charge: value.person_in_charge || null,
        plan: value.plan,
        nfc_tag_total: value.nfc_tag_total ? Number(value.nfc_tag_total) : null,
        notes: value.notes || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      setError(`保存に失敗しました: ${error?.message ?? ""}`);
      return;
    }

    // あてんどの標準機能としてスタンプラリーを1本用意しておく。
    // 失敗しても案件自体は作れているので、案件画面から作り直せるよう握りつぶす。
    await createDefaultRally(supabase, data.id, value.client_name).catch(() => null);

    setSaving(false);
    router.push(`/admin/attend/projects/${data.id}`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-bold">新規案件</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">
        <AttendProjectForm value={value} onChange={setValue} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存して体験を追加する"}
        </button>
      </form>
    </div>
  );
}
