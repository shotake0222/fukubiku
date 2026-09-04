"use client";

import type { AttendPlan } from "@/lib/types";
import { ATTEND_PLAN_LIMITS } from "@/lib/types";

export interface AttendProjectFormValue {
  client_name: string;
  order_date: string;
  due_date: string;
  person_in_charge: string;
  plan: AttendPlan;
  nfc_tag_total: string;
  notes: string;
}

export function emptyAttendProjectForm(): AttendProjectFormValue {
  return {
    client_name: "",
    order_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    person_in_charge: "",
    plan: "light",
    nfc_tag_total: "",
    notes: "",
  };
}

export default function AttendProjectForm({
  value,
  onChange,
}: {
  value: AttendProjectFormValue;
  onChange: (v: AttendProjectFormValue) => void;
}) {
  function set<K extends keyof AttendProjectFormValue>(key: K, v: AttendProjectFormValue[K]) {
    onChange({ ...value, [key]: v });
  }

  const limits = ATTEND_PLAN_LIMITS[value.plan];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-1 block">
          <span className="text-sm font-medium">クライアント名</span>
          <input
            required
            value={value.client_name}
            onChange={(e) => set("client_name", e.target.value)}
            className="input"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">担当者</span>
          <input
            value={value.person_in_charge}
            onChange={(e) => set("person_in_charge", e.target.value)}
            className="input"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">受注日</span>
          <input
            type="date"
            required
            value={value.order_date}
            onChange={(e) => set("order_date", e.target.value)}
            className="input"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">納期</span>
          <input
            type="date"
            value={value.due_date}
            onChange={(e) => set("due_date", e.target.value)}
            className="input"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">プラン</span>
          <select value={value.plan} onChange={(e) => set("plan", e.target.value as AttendPlan)} className="input">
            {(Object.keys(ATTEND_PLAN_LIMITS) as AttendPlan[]).map((p) => (
              <option key={p} value={p}>
                {ATTEND_PLAN_LIMITS[p].label}（{ATTEND_PLAN_LIMITS[p].price}）
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 block">
          <span className="text-sm font-medium">NFCタグ発注枚数</span>
          <input
            type="number"
            min={0}
            value={value.nfc_tag_total}
            onChange={(e) => set("nfc_tag_total", e.target.value)}
            className="input"
            placeholder="例: 100"
          />
        </label>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-sky-800">
          {limits.label}プランの目安（表示のみ・強制制限はありません）
        </p>
        <p>GPS拠点数: {limits.gpsPoints} / ARモデル種類: {limits.arModels} / NFCタグ: {limits.nfcTags} / 解析: {limits.analytics}</p>
      </div>

      <label className="space-y-1 block">
        <span className="text-sm font-medium">メモ</span>
        <textarea
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="input"
          rows={3}
        />
      </label>
    </div>
  );
}
