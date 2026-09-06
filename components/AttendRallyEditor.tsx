"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateSpotCode } from "@/lib/rally";
import {
  ATTEND_RALLY_THEMES,
  ATTEND_STAMP_METHOD_LABEL,
  PRESET_CATEGORIES,
} from "@/lib/types";
import type {
  AttendProject,
  AttendRally,
  AttendRallySpot,
  AttendRallyStatus,
  AttendRallyTheme,
  ObjectSource,
  PresetObject,
} from "@/lib/types";

const UNCATEGORIZED = "__uncategorized__";

export interface RallySpotStat {
  total: number;
  byMethod: Record<string, number>;
}

const statusLabel: Record<AttendRallyStatus, string> = {
  draft: "下書き（参加者は開けません）",
  active: "公開中",
  archived: "アーカイブ",
};

// 編集中のスポット。新規行は id を "new-*" にしておき、保存時に insert する。
interface SpotDraft {
  id: string;
  name: string;
  description: string;
  gps_enabled: boolean;
  gps_lat: string;
  gps_lng: string;
  gps_radius_m: string;
  spot_code: string;
  code_enabled: boolean;
  object_source: ObjectSource;
  preset_object_id: string | null;
  custom_model_url: string | null;
  position: string;
  scale: string;
  rotation_y: string;
  stamp_label: string;
  stamp_color: string;
}

function toDraft(s: AttendRallySpot): SpotDraft {
  return {
    id: s.id,
    name: s.name,
    description: s.description ?? "",
    gps_enabled: s.gps_enabled,
    gps_lat: s.gps_lat != null ? String(s.gps_lat) : "",
    gps_lng: s.gps_lng != null ? String(s.gps_lng) : "",
    gps_radius_m: String(s.gps_radius_m ?? 30),
    spot_code: s.spot_code ?? "",
    code_enabled: s.code_enabled,
    object_source: s.object_source,
    preset_object_id: s.preset_object_id,
    custom_model_url: s.custom_model_url,
    position: s.position || "0 0 0",
    scale: s.scale ?? "",
    rotation_y: String(s.rotation_y ?? 0),
    stamp_label: s.stamp_label ?? "",
    stamp_color: s.stamp_color || "#c0392b",
  };
}

function newDraft(index: number): SpotDraft {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    name: `スポット${index + 1}`,
    description: "",
    gps_enabled: true,
    gps_lat: "",
    gps_lng: "",
    gps_radius_m: "30",
    spot_code: generateSpotCode(),
    code_enabled: true,
    object_source: "preset",
    preset_object_id: null,
    custom_model_url: null,
    position: "0 0 0",
    scale: "",
    rotation_y: "0",
    stamp_label: "",
    stamp_color: "#c0392b",
  };
}

/**
 * 「35.6586, 139.7454」「https://www.google.com/maps/@35.6586,139.7454,17z」
 * のような文字列から緯度経度を取り出す。
 * 現地で座標を控えてくるのが一番手間なので、地図アプリの共有URLをそのまま
 * 貼れるようにしている。
 */
export function parseLatLng(input: string): { lat: number; lng: number } | null {
  const at = input.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  const plain = input.match(/(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  const m = at ?? plain;
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function categoryLabel(value: string) {
  if (value === UNCATEGORIZED) return "未分類";
  return PRESET_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function ObjectPicker({
  presets,
  value,
  onChange,
  label,
}: {
  presets: PresetObject[];
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  const current = presets.find((p) => p.id === value) ?? null;
  const [category, setCategory] = useState<string>(
    current?.category || presets[0]?.category || UNCATEGORIZED
  );
  const categories = useMemo(() => {
    const set = new Set(presets.map((p) => p.category || UNCATEGORIZED));
    return Array.from(set);
  }, [presets]);
  const inCategory = presets.filter((p) => (p.category || UNCATEGORIZED) === category);

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="input text-sm flex-1"
        >
          <option value="">選択してください</option>
          {inCategory.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {current && (
        <p className="text-[11px] text-slate-400 break-all">現在: {current.name}（{current.model_url}）</p>
      )}
    </div>
  );
}

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-600 w-28 shrink-0">{label}</span>
        <code className="text-xs break-all flex-1">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs px-2 py-0.5 rounded border hover:bg-slate-50 shrink-0"
        >
          {copied ? "コピーしました" : "コピー"}
        </button>
      </div>
      {hint && <p className="text-[11px] text-slate-400 pl-30">{hint}</p>}
    </div>
  );
}

export default function AttendRallyEditor({
  rally,
  project,
  spots,
  presets,
  spotStats,
  summary,
}: {
  rally: AttendRally;
  project: AttendProject;
  spots: AttendRallySpot[];
  presets: PresetObject[];
  spotStats: Record<string, RallySpotStat>;
  summary: { participants: number; completed: number; redeemed: number };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";
  const rallyUrl = `${siteOrigin}/r/${rally.hash}`;
  const staffUrl = `${rallyUrl}/staff`;

  const [name, setName] = useState(rally.name);
  const [description, setDescription] = useState(rally.description ?? "");
  const [status, setStatus] = useState<AttendRallyStatus>(rally.status);
  const [theme, setTheme] = useState<AttendRallyTheme>(rally.theme);
  const [requiredCount, setRequiredCount] = useState(
    rally.required_count != null ? String(rally.required_count) : ""
  );
  const [startsAt, setStartsAt] = useState(rally.starts_at ? rally.starts_at.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState(rally.ends_at ? rally.ends_at.slice(0, 10) : "");

  const [couponEnabled, setCouponEnabled] = useState(rally.reward_coupon_enabled);
  const [couponLabel, setCouponLabel] = useState(rally.reward_coupon_label);
  const [couponNote, setCouponNote] = useState(rally.reward_coupon_note ?? "");
  const [rewardPresetId, setRewardPresetId] = useState<string | null>(rally.reward_preset_object_id);
  const [rewardMessage, setRewardMessage] = useState(rally.reward_message);
  const [staffPin, setStaffPin] = useState(rally.staff_pin ?? "");

  const [drafts, setDrafts] = useState<SpotDraft[]>(spots.map(toDraft));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(spots[0]?.id ?? null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateDraft(id: string, patch: Partial<SpotDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function addSpot() {
    setDrafts((prev) => {
      const next = [...prev, newDraft(prev.length)];
      setOpenId(next[next.length - 1].id);
      return next;
    });
  }

  function removeSpot(id: string) {
    const stat = spotStats[id];
    if (stat && stat.total > 0) {
      if (!confirm(`このスポットは既に${stat.total}人が取得しています。削除すると取得記録も消えます。よろしいですか？`))
        return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (!id.startsWith("new-")) setRemovedIds((prev) => [...prev, id]);
  }

  function moveSpot(index: number, delta: number) {
    setDrafts((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // 「スタンプ何個のラリーにするか」を数字で決められるようにする。
  // 増やす場合は雛形を足し、減らす場合は末尾から外す（取得済みがあれば確認する）。
  function resizeSpots(target: number) {
    if (!Number.isFinite(target) || target < 0 || target > 30) return;
    if (target > drafts.length) {
      const add = Array.from({ length: target - drafts.length }, (_, i) => newDraft(drafts.length + i));
      setDrafts((prev) => [...prev, ...add]);
      return;
    }
    if (target < drafts.length) {
      const cut = drafts.slice(target);
      const withStamps = cut.filter((d) => (spotStats[d.id]?.total ?? 0) > 0);
      if (withStamps.length > 0 && !confirm(`末尾${cut.length}件を削除します。うち${withStamps.length}件は取得記録があり、それも消えます。よろしいですか？`))
        return;
      setDrafts(drafts.slice(0, target));
      setRemovedIds((prev) => [...prev, ...cut.filter((d) => !d.id.startsWith("new-")).map((d) => d.id)]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    // 合言葉はラリー内で一意でなければならない（QR/NFCの宛先になるため）。
    const codes = drafts.map((d) => d.spot_code.trim().toUpperCase()).filter(Boolean);
    if (new Set(codes).size !== codes.length) {
      setSaving(false);
      setError("合言葉が重複しています。スポットごとに違うコードにしてください。");
      return;
    }

    const { error: rallyError } = await supabase
      .from("attend_rallies")
      .update({
        name,
        description: description || null,
        status,
        theme,
        required_count: requiredCount ? Number(requiredCount) : null,
        starts_at: startsAt ? new Date(`${startsAt}T00:00:00+09:00`).toISOString() : null,
        ends_at: endsAt ? new Date(`${endsAt}T23:59:59+09:00`).toISOString() : null,
        reward_coupon_enabled: couponEnabled,
        reward_coupon_label: couponLabel || "記念品引換",
        reward_coupon_note: couponNote || null,
        reward_object_source: rewardPresetId ? "preset" : null,
        reward_preset_object_id: rewardPresetId,
        reward_message: rewardMessage || "コンプリートおめでとうございます！",
        staff_pin: staffPin || null,
      })
      .eq("id", rally.id);

    if (rallyError) {
      setSaving(false);
      setError(`保存に失敗しました: ${rallyError.message}`);
      return;
    }

    if (removedIds.length) {
      const { error: delError } = await supabase
        .from("attend_rally_spots")
        .delete()
        .in("id", removedIds);
      if (delError) {
        setSaving(false);
        setError(`スポットの削除に失敗しました: ${delError.message}`);
        return;
      }
    }

    for (const [index, d] of drafts.entries()) {
      const payload = {
        rally_id: rally.id,
        name: d.name || `スポット${index + 1}`,
        description: d.description || null,
        sort_order: index,
        gps_enabled: d.gps_enabled,
        gps_lat: d.gps_lat ? Number(d.gps_lat) : null,
        gps_lng: d.gps_lng ? Number(d.gps_lng) : null,
        gps_radius_m: Number(d.gps_radius_m) || 30,
        spot_code: d.spot_code ? d.spot_code.trim().toUpperCase() : null,
        code_enabled: d.code_enabled,
        object_source: d.object_source,
        preset_object_id: d.object_source === "preset" ? d.preset_object_id : null,
        custom_model_url: d.object_source === "upload" ? d.custom_model_url : null,
        position: d.position || "0 0 0",
        scale: d.scale || null,
        rotation_y: Number(d.rotation_y) || 0,
        stamp_label: d.stamp_label || null,
        stamp_color: d.stamp_color || "#c0392b",
      };
      const query = d.id.startsWith("new-")
        ? supabase.from("attend_rally_spots").insert(payload)
        : supabase.from("attend_rally_spots").update(payload).eq("id", d.id);
      const { error: spotError } = await query;
      if (spotError) {
        setSaving(false);
        setError(`「${payload.name}」の保存に失敗しました: ${spotError.message}`);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setRemovedIds([]);
    router.refresh();
  }

  async function handleDeleteRally() {
    if (!confirm("このスタンプラリーを削除しますか？参加者の進捗もすべて消えます。")) return;
    const { error } = await supabase.from("attend_rallies").delete().eq("id", rally.id);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    router.push(`/admin/attend/projects/${rally.project_id}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/attend/projects/${rally.project_id}`}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            ← {project?.client_name ?? "案件"} へ戻る
          </Link>
          <h1 className="text-lg font-bold mt-1">スタンプラリー編集: {rally.name}</h1>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AttendRallyStatus)}
          className="text-xs border rounded-full px-3 py-1"
        >
          {(Object.keys(statusLabel) as AttendRallyStatus[]).map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
      </div>

      {/* ---- URL ---- */}
      <section className="bg-white rounded-xl shadow p-6 space-y-3">
        <h2 className="font-semibold">配布するURL</h2>
        <CopyRow
          label="参加者用"
          value={rallyUrl}
          hint="ポスター・チラシ・SNSに載せるURL。開いた瞬間にスタンプ帳が始まります（登録不要）。"
        />
        <CopyRow
          label="引換窓口用"
          value={staffUrl}
          hint="スタッフ用。引換コードを照合して使用済みにします。下で設定する暗証番号が必要です。"
        />
        <div className="pt-2 flex gap-3 text-sm">
          <Link
            href={`/admin/attend/rallies/${rally.id}/print`}
            target="_blank"
            className="text-blue-600 hover:underline"
          >
            スタンプ台用のQR・合言葉を印刷する →
          </Link>
          <a href={rallyUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            参加者画面を開く →
          </a>
        </div>
      </section>

      {/* ---- 参加状況 ---- */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="font-semibold mb-3">参加状況</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{summary.participants}</p>
            <p className="text-xs text-slate-500">参加者</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.completed}</p>
            <p className="text-xs text-slate-500">コンプリート</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{summary.redeemed}</p>
            <p className="text-xs text-slate-500">景品引換済み</p>
          </div>
        </div>
      </section>

      {/* ---- 基本設定 ---- */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">基本設定</h2>
        <label className="block space-y-1">
          <span className="text-sm font-medium">ラリー名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">説明（参加者画面の冒頭に出ます）</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input w-full"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">開始日</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input w-full" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">終了日</span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input w-full" />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">配色テーマ</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as AttendRallyTheme)}
            className="input w-full"
          >
            {ATTEND_RALLY_THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.hint}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* ---- スポット ---- */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <h2 className="font-semibold">スポット（スタンプ）</h2>
          <p className="text-xs text-slate-500 mt-1">
            1スポット＝スタンプ1個です。スタンプの個数はここでスポットを増減して決めます。
            1つのスポットは「GPSで近づく」「QRを読む」「NFCにかざす」「合言葉を入力」のどれでも押せます。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
          <span className="text-sm">スタンプの個数</span>
          <input
            type="number"
            min={0}
            max={30}
            defaultValue={drafts.length}
            key={drafts.length}
            onBlur={(e) => resizeSpots(Number(e.target.value))}
            className="input w-20"
          />
          <span className="text-xs text-slate-500">個（数字を変えると末尾を増減します）</span>
          <button
            type="button"
            onClick={addSpot}
            className="ml-auto text-sm bg-pink-600 text-white rounded-lg px-3 py-1.5"
          >
            + スポットを追加
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">コンプリートに必要な個数</span>
          <select
            value={requiredCount}
            onChange={(e) => setRequiredCount(e.target.value)}
            className="input w-full"
          >
            <option value="">全スポット（{drafts.length}個）を集めたら達成</option>
            {Array.from({ length: drafts.length }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}個集めたら達成
              </option>
            ))}
          </select>
          <span className="text-[11px] text-slate-400">
            全部回るのが難しい広域イベントでは「10個中5個で達成」のような設定にできます。
          </span>
        </label>

        <ul className="space-y-3">
          {drafts.map((d, i) => {
            const stat = spotStats[d.id];
            const open = openId === d.id;
            const spotUrl = d.spot_code ? `${rallyUrl}?s=${d.spot_code.trim().toUpperCase()}` : null;
            const nfcUrl = d.spot_code ? `${rallyUrl}?n=${d.spot_code.trim().toUpperCase()}` : null;
            return (
              <li key={d.id} className="border rounded-xl">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.id)}
                    className="flex-1 text-left"
                  >
                    <span className="text-[11px] text-slate-400">SPOT {String(i + 1).padStart(2, "0")}</span>
                    <p className="font-medium">{d.name || "（名前未設定）"}</p>
                    <p className="text-[11px] text-slate-500">
                      {d.gps_enabled && d.gps_lat && d.gps_lng
                        ? `GPS ${Number(d.gps_lat).toFixed(4)}, ${Number(d.gps_lng).toFixed(4)} / 半径${d.gps_radius_m}m`
                        : "GPS未設定"}
                      {d.spot_code ? ` ・ 合言葉 ${d.spot_code}` : ""}
                      {stat ? ` ・ 取得 ${stat.total}件` : ""}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => moveSpot(i, -1)} className="text-xs px-2 py-1 border rounded hover:bg-slate-50">↑</button>
                    <button type="button" onClick={() => moveSpot(i, 1)} className="text-xs px-2 py-1 border rounded hover:bg-slate-50">↓</button>
                    <button type="button" onClick={() => removeSpot(d.id)} className="text-xs px-2 py-1 text-red-600 hover:underline">削除</button>
                  </div>
                </div>

                {open && (
                  <div className="border-t px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">スポット名</span>
                        <input value={d.name} onChange={(e) => updateDraft(d.id, { name: e.target.value })} className="input w-full" />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-600">スタンプの文字（2文字程度）</span>
                        <input
                          value={d.stamp_label}
                          onChange={(e) => updateDraft(d.id, { stamp_label: e.target.value })}
                          placeholder="未入力ならスポット名の頭2文字"
                          className="input w-full"
                        />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-600">説明</span>
                      <input value={d.description} onChange={(e) => updateDraft(d.id, { description: e.target.value })} className="input w-full" />
                    </label>

                    {/* GPS */}
                    <div className="rounded-lg bg-sky-50 p-4 space-y-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={d.gps_enabled}
                          onChange={(e) => updateDraft(d.id, { gps_enabled: e.target.checked })}
                        />
                        GPSで押せるようにする（近づくと自動でスタンプ）
                      </label>
                      {d.gps_enabled && (
                        <>
                          <div className="grid grid-cols-3 gap-3">
                            <label className="block space-y-1">
                              <span className="text-xs text-slate-600">緯度</span>
                              <input value={d.gps_lat} onChange={(e) => updateDraft(d.id, { gps_lat: e.target.value })} placeholder="35.658581" className="input w-full" />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-xs text-slate-600">経度</span>
                              <input value={d.gps_lng} onChange={(e) => updateDraft(d.id, { gps_lng: e.target.value })} placeholder="139.745433" className="input w-full" />
                            </label>
                            <label className="block space-y-1">
                              <span className="text-xs text-slate-600">半径(m)</span>
                              <input type="number" min={5} value={d.gps_radius_m} onChange={(e) => updateDraft(d.id, { gps_radius_m: e.target.value })} className="input w-full" />
                            </label>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              placeholder="Googleマップのリンクや「35.6586, 139.7454」を貼り付け"
                              onChange={(e) => {
                                const parsed = parseLatLng(e.target.value);
                                if (parsed) {
                                  updateDraft(d.id, { gps_lat: String(parsed.lat), gps_lng: String(parsed.lng) });
                                  e.target.value = "";
                                }
                              }}
                              className="input flex-1 min-w-[16rem]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                navigator.geolocation?.getCurrentPosition(
                                  (p) =>
                                    updateDraft(d.id, {
                                      gps_lat: p.coords.latitude.toFixed(6),
                                      gps_lng: p.coords.longitude.toFixed(6),
                                    }),
                                  () => setError("現在地を取得できませんでした")
                                );
                              }}
                              className="text-xs border rounded-lg px-3 py-2 bg-white hover:bg-slate-50"
                            >
                              現在地を取り込む
                            </button>
                            {d.gps_lat && d.gps_lng && (
                              <a
                                href={`https://www.google.com/maps?q=${d.gps_lat},${d.gps_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 hover:underline self-center"
                              >
                                地図で確認
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* 合言葉 / QR / NFC */}
                    <div className="rounded-lg bg-violet-50 p-4 space-y-3">
                      <p className="text-sm font-medium">物理スタンプ台との連携</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs text-slate-600">合言葉（QR・NFCにも同じ値が入ります）</span>
                          <input
                            value={d.spot_code}
                            onChange={(e) => updateDraft(d.id, { spot_code: e.target.value.toUpperCase() })}
                            className="input w-40 font-mono tracking-widest"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => updateDraft(d.id, { spot_code: generateSpotCode() })}
                          className="text-xs border rounded-lg px-3 py-2 bg-white hover:bg-slate-50"
                        >
                          作り直す
                        </button>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={d.code_enabled}
                            onChange={(e) => updateDraft(d.id, { code_enabled: e.target.checked })}
                          />
                          手入力を受け付ける
                        </label>
                      </div>
                      {spotUrl && nfcUrl && (
                        <div className="space-y-1.5 pt-1">
                          <CopyRow label="QR用URL" value={spotUrl} />
                          <CopyRow label="NFC書込用URL" value={nfcUrl} />
                        </div>
                      )}
                    </div>

                    {/* AR */}
                    <div className="rounded-lg bg-slate-50 p-4 space-y-3">
                      <p className="text-sm font-medium">スタンプ獲得時に出るARオブジェクト</p>
                      <ObjectPicker
                        presets={presets}
                        value={d.preset_object_id}
                        onChange={(id) => updateDraft(d.id, { preset_object_id: id, object_source: "preset" })}
                        label="プリセットから選ぶ"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <label className="block space-y-1">
                          <span className="text-xs text-slate-600">位置 (x y z)</span>
                          <input value={d.position} onChange={(e) => updateDraft(d.id, { position: e.target.value })} className="input w-full" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-slate-600">大きさ (x y z)</span>
                          <input value={d.scale} onChange={(e) => updateDraft(d.id, { scale: e.target.value })} placeholder="未指定で既定" className="input w-full" />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs text-slate-600">向き Y(度)</span>
                          <input type="number" value={d.rotation_y} onChange={(e) => updateDraft(d.id, { rotation_y: e.target.value })} className="input w-full" />
                        </label>
                      </div>
                      <label className="flex items-center gap-3">
                        <span className="text-xs text-slate-600">スタンプの色</span>
                        <input
                          type="color"
                          value={d.stamp_color}
                          onChange={(e) => updateDraft(d.id, { stamp_color: e.target.value })}
                          className="h-8 w-14 rounded border"
                        />
                        <span className="text-xs font-mono text-slate-400">{d.stamp_color}</span>
                      </label>
                    </div>

                    {stat && stat.total > 0 && (
                      <p className="text-xs text-slate-500">
                        取得内訳:{" "}
                        {Object.entries(stat.byMethod)
                          .map(([m, n]) => `${ATTEND_STAMP_METHOD_LABEL[m as keyof typeof ATTEND_STAMP_METHOD_LABEL] ?? m} ${n}件`)
                          .join(" / ")}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {drafts.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">
            スポットがありません。「+ スポットを追加」から作成してください。
          </p>
        )}
      </section>

      {/* ---- 特典 ---- */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">コンプリート特典</h2>

        <label className="block space-y-1">
          <span className="text-sm font-medium">達成メッセージ</span>
          <input value={rewardMessage} onChange={(e) => setRewardMessage(e.target.value)} className="input w-full" />
        </label>

        <ObjectPicker
          presets={presets}
          value={rewardPresetId}
          onChange={setRewardPresetId}
          label="記念ARオブジェクト（達成画面から見られます）"
        />

        <div className="rounded-lg bg-amber-50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={couponEnabled} onChange={(e) => setCouponEnabled(e.target.checked)} />
            引換コードを発行する（窓口で景品と交換）
          </label>
          {couponEnabled && (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">引換の名前</span>
                <input value={couponLabel} onChange={(e) => setCouponLabel(e.target.value)} className="input w-full" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">注意書き（引換場所・期限など）</span>
                <input value={couponNote} onChange={(e) => setCouponNote(e.target.value)} className="input w-full" />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-600">窓口の暗証番号（スタッフのみに共有）</span>
                <input
                  value={staffPin}
                  onChange={(e) => setStaffPin(e.target.value)}
                  placeholder="例: 4821"
                  className="input w-40 font-mono tracking-widest"
                />
                <span className="block text-[11px] text-slate-400">
                  未設定のあいだは引換窓口の画面で処理できません。
                </span>
              </label>
            </>
          )}
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">保存しました</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 text-white rounded-lg px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button onClick={handleDeleteRally} className="text-sm text-red-600 hover:underline ml-auto">
          このラリーを削除
        </button>
      </div>
    </div>
  );
}
