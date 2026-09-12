"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  COLOR_PRESETS,
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  HERO_OPTIONS,
  PORTAL_TEMPLATES,
  RADIUS_OPTIONS,
  SECTION_BLOCK,
  SECTION_LABELS,
  SNS_OPTIONS,
  TONE_OPTIONS,
  emptyBlocks,
  resolveDesign,
  resolveSections,
} from "@/lib/portal/types";
import type {
  PortalBlockKind,
  PortalData,
  PortalDesign,
  PortalNavLink,
  PortalSection,
  PortalSnsLink,
  PortalTemplate,
} from "@/lib/portal/types";
import PortalPreview from "@/components/PortalPreview";
import type { AttendPortal, AttendPortalBlock, AttendProject, AttendRally } from "@/lib/types";

const ASSET_BUCKET = "assets";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き（参加者には準備中と表示）",
  published: "公開中",
  ended: "提供終了（終了画面に切り替わる）",
};

/** ブロックの種類ごとに、どの入力欄を使うか。使わない欄は出さない。 */
const BLOCK_FIELDS: Record<
  PortalBlockKind,
  { label: string; title: string; body?: string; meta?: string; image?: boolean; link?: boolean; badge?: string }
> = {
  pick: { label: "見どころ／ステップ／キャラクター", title: "見出し", body: "説明", image: true },
  spot: { label: "スポット・店舗・ロケ地", title: "名前", body: "説明", meta: "補足（営業時間・フロア・話数など）", image: true, link: true, badge: "ラベル（スタンプ①など）" },
  banner: { label: "バナー", title: "見出し", meta: "小さい説明", image: true, link: true },
  news: { label: "お知らせ", title: "日付・ラベル", body: "本文" },
  faq: { label: "よくある質問", title: "質問", body: "回答" },
  outline: { label: "開催概要", title: "項目名", body: "内容" },
  note: { label: "注意書き・お願い", title: "本文（1行ずつ）" },
  chapter: { label: "章（季節）", title: "章の名前", body: "期間", meta: "英字ラベル（SPRINGなど）", image: true, badge: "開催中の印" },
};

interface BlockDraft {
  id: string;
  kind: PortalBlockKind;
  title: string;
  body: string;
  meta: string;
  image_url: string | null;
  link_url: string;
  badge: string;
  enabled: boolean;
}

function toDraft(b: AttendPortalBlock): BlockDraft {
  return {
    id: b.id,
    kind: b.kind as PortalBlockKind,
    title: b.title ?? "",
    body: b.body ?? "",
    meta: b.meta ?? "",
    image_url: b.image_url,
    link_url: b.link_url ?? "",
    badge: b.badge ?? "",
    enabled: b.enabled,
  };
}

function newBlock(kind: PortalBlockKind): BlockDraft {
  return {
    id: `new-${Math.random().toString(36).slice(2)}`,
    kind,
    title: "",
    body: "",
    meta: "",
    image_url: null,
    link_url: "",
    badge: "",
    enabled: true,
  };
}

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className="input w-full"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="input w-full"
        />
      )}
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** 選択肢を横並びのボタンで選ばせる。数値でない設定はすべてこれ。 */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              value === o.value ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {current?.hint && <span className="block text-[11px] text-slate-400">{current.hint}</span>}
    </div>
  );
}

/** 数値の調整。つまみを動かすと右のプレビューがそのまま変わる。 */
function Slider({
  label,
  hint,
  min,
  max,
  step,
  unit,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">
        {label}
        <span className="ml-2 font-mono text-slate-400">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

/** 画像の差し替え。アップロードすると公開サイトに即反映される。 */
function ImageField({
  label,
  value,
  onChange,
  storagePrefix,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  storagePrefix: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const ext = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? "";
      const path = `${storagePrefix}/${Date.now()}${ext}`;
      const { error: upErr } = await supabase.storage
        .from(ASSET_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      setError(`アップロードに失敗しました: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="flex items-start gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-24 rounded object-cover border" />
        ) : (
          <div className="h-16 w-24 rounded border bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
            未設定
          </div>
        )}
        <div className="space-y-1">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
            className="text-xs"
          />
          {busy && <p className="text-[11px] text-slate-500">アップロード中...</p>}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[11px] text-red-600 hover:underline"
            >
              画像を外す
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AttendPortalEditor({
  portal,
  project,
  blocks,
  rallies,
}: {
  portal: AttendPortal;
  project: AttendProject;
  blocks: AttendPortalBlock[];
  rallies: Pick<AttendRally, "id" | "name">[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const siteOrigin = process.env.NEXT_PUBLIC_ATTEND_SITE_URL || "https://app.attend-ar.com";
  const publicUrl = `${siteOrigin}/p/${portal.hash}`;

  const [f, setF] = useState({
    name: portal.name,
    template: portal.template as PortalTemplate,
    status: portal.status,
    rally_id: portal.rally_id ?? "",
    custom_ar_url: portal.custom_ar_url ?? "",
    brand_color: portal.brand_color,
    brand_color_dark: portal.brand_color_dark,
    accent_color: portal.accent_color ?? portal.brand_color,
    logo_url: portal.logo_url,
    logo_text: portal.logo_text ?? "",
    site_title: portal.site_title,
    site_description: portal.site_description ?? "",
    og_image_url: portal.og_image_url,
    hero_image_url: portal.hero_image_url,
    hero_eyebrow: portal.hero_eyebrow ?? "",
    hero_title: portal.hero_title ?? "",
    hero_text: portal.hero_text ?? "",
    ar_heading: portal.ar_heading,
    ar_text: portal.ar_text ?? "",
    ar_button_label: portal.ar_button_label,
    status_line: portal.status_line ?? "",
    owner_name: portal.owner_name ?? "",
    owner_address: portal.owner_address ?? "",
    privacy_url: portal.privacy_url ?? "",
    terms_url: portal.terms_url ?? "",
    contact_url: portal.contact_url ?? "",
    copyright_text: portal.copyright_text ?? "",
    ended_message: portal.ended_message ?? "",
    ended_link_url: portal.ended_link_url ?? "",
    ended_link_label: portal.ended_link_label ?? "",
  });

  const [design, setDesign] = useState<PortalDesign>(
    resolveDesign(portal.template as PortalTemplate, portal.design as Partial<PortalDesign> | null)
  );
  const [sections, setSections] = useState<PortalSection[]>(
    resolveSections(portal.template as PortalTemplate, portal.sections as PortalSection[] | null)
  );
  const [nav, setNav] = useState<PortalNavLink[]>(
    Array.isArray(portal.nav) ? (portal.nav as PortalNavLink[]) : []
  );
  const [sns, setSns] = useState<PortalSnsLink[]>(
    Array.isArray(portal.sns) ? (portal.sns as PortalSnsLink[]) : []
  );

  const [drafts, setDrafts] = useState<BlockDraft[]>(blocks.map(toDraft));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tpl = PORTAL_TEMPLATES.find((t) => t.value === f.template) ?? PORTAL_TEMPLATES[0];
  // テンプレートごとに「使う枠」だけを出す（決まった枠を埋める方式）
  const usedKinds = Object.keys(tpl.blockHints) as PortalBlockKind[];

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  // 用途を変えたら、その用途の既定の構成・見た目に寄せる。
  // 手で調整した内容が残ったままだと、選び直した意味がなくなるため。
  function changeTemplate(t: PortalTemplate) {
    set("template", t);
    setSections(resolveSections(t, null));
    setDesign(resolveDesign(t, null));
  }

  function setDesignValue<K extends keyof PortalDesign>(k: K, v: PortalDesign[K]) {
    setDesign((prev) => ({ ...prev, [k]: v }));
  }
  function moveSection(index: number, delta: number) {
    setSections((prev) => {
      const t = index + delta;
      if (t < 0 || t >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[t]] = [next[t], next[index]];
      return next;
    });
  }
  function updateSection(key: string, patch: Partial<PortalSection>) {
    setSections((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }
  function updateBlock(id: string, patch: Partial<BlockDraft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function addBlock(kind: PortalBlockKind) {
    setDrafts((prev) => [...prev, newBlock(kind)]);
  }
  function removeBlock(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (!id.startsWith("new-")) setRemovedIds((prev) => [...prev, id]);
  }
  function moveBlock(kind: PortalBlockKind, index: number, delta: number) {
    setDrafts((prev) => {
      const ofKind = prev.filter((d) => d.kind === kind);
      const target = index + delta;
      if (target < 0 || target >= ofKind.length) return prev;
      const a = ofKind[index];
      const b = ofKind[target];
      return prev.map((d) => (d.id === a.id ? b : d.id === b.id ? a : d));
    });
  }

  // いま編集中の内容を、そのまま公開ページと同じ描画処理に渡せる形にする。
  // 保存を挟まないので、入力した瞬間に横のプレビューへ反映される。
  const previewData: PortalData = useMemo(() => {
    const b = emptyBlocks();
    for (const d of drafts) {
      if (!d.enabled) continue;
      if (!b[d.kind]) continue;
      b[d.kind].push({
        id: d.id,
        kind: d.kind,
        title: d.title || null,
        body: d.body || null,
        meta: d.meta || null,
        imageUrl: d.image_url,
        linkUrl: d.link_url || null,
        badge: d.badge || null,
      });
    }
    return {
      template: f.template,
      status: f.status,
      endedMessage: f.ended_message || null,
      endedLinkUrl: f.ended_link_url || null,
      endedLinkLabel: f.ended_link_label || null,
      brand: f.brand_color,
      brandDark: f.brand_color_dark,
      accent: f.accent_color || f.brand_color,
      logoUrl: f.logo_url,
      logoText: f.logo_text || null,
      siteTitle: f.site_title || "スタンプラリー",
      siteDescription: f.site_description || null,
      ogImageUrl: f.og_image_url,
      heroImageUrl: f.hero_image_url,
      heroEyebrow: f.hero_eyebrow || null,
      heroTitle: f.hero_title || null,
      heroText: f.hero_text || null,
      // プレビューでは参加ボタンの見た目だけ確認できればよい
      arUrl: f.rally_id || f.custom_ar_url ? `${siteOrigin}/r/preview` : null,
      arHeading: f.ar_heading || "スタンプラリーに参加する",
      arText: f.ar_text || null,
      arButtonLabel: f.ar_button_label || "いますぐ始める",
      statusLine: f.status_line || null,
      ownerName: f.owner_name || null,
      ownerAddress: f.owner_address || null,
      privacyUrl: f.privacy_url || null,
      termsUrl: f.terms_url || null,
      contactUrl: f.contact_url || null,
      copyrightText: f.copyright_text || null,
      design,
      sections,
      nav: nav.filter((n) => n.label.trim() && n.url.trim()),
      sns: sns.filter((x) => x.url.trim()),
      blocks: b,
    };
  }, [f, design, sections, nav, sns, drafts, siteOrigin]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const { error: pErr } = await supabase
      .from("attend_portals")
      .update({
        name: f.name,
        template: f.template,
        status: f.status,
        rally_id: f.rally_id || null,
        custom_ar_url: f.rally_id ? null : f.custom_ar_url || null,
        brand_color: f.brand_color,
        brand_color_dark: f.brand_color_dark,
        accent_color: f.accent_color || null,
        logo_url: f.logo_url,
        logo_text: f.logo_text || null,
        site_title: f.site_title || "スタンプラリー",
        site_description: f.site_description || null,
        og_image_url: f.og_image_url,
        hero_image_url: f.hero_image_url,
        hero_eyebrow: f.hero_eyebrow || null,
        hero_title: f.hero_title || null,
        hero_text: f.hero_text || null,
        ar_heading: f.ar_heading || "スタンプラリーに参加する",
        ar_text: f.ar_text || null,
        ar_button_label: f.ar_button_label || "いますぐ始める",
        status_line: f.status_line || null,
        owner_name: f.owner_name || null,
        owner_address: f.owner_address || null,
        privacy_url: f.privacy_url || null,
        terms_url: f.terms_url || null,
        contact_url: f.contact_url || null,
        copyright_text: f.copyright_text || null,
        ended_message: f.ended_message || null,
        ended_link_url: f.ended_link_url || null,
        ended_link_label: f.ended_link_label || null,
        design,
        sections,
        nav: nav.filter((n) => n.label.trim() && n.url.trim()),
        sns: sns.filter((x) => x.url.trim()),
      })
      .eq("id", portal.id);

    if (pErr) {
      setSaving(false);
      setError(`保存に失敗しました: ${pErr.message}`);
      return;
    }

    if (removedIds.length) {
      await supabase.from("attend_portal_blocks").delete().in("id", removedIds);
    }

    // 並び順は「同じ種類の中での順番」で保存する
    const counters: Partial<Record<PortalBlockKind, number>> = {};
    for (const d of drafts) {
      const order = (counters[d.kind] = (counters[d.kind] ?? 0) + 1) - 1;
      const payload = {
        portal_id: portal.id,
        kind: d.kind,
        sort_order: order,
        title: d.title || null,
        body: d.body || null,
        meta: d.meta || null,
        image_url: d.image_url,
        link_url: d.link_url || null,
        badge: d.badge || null,
        enabled: d.enabled,
      };
      const q = d.id.startsWith("new-")
        ? supabase.from("attend_portal_blocks").insert(payload)
        : supabase.from("attend_portal_blocks").update(payload).eq("id", d.id);
      const { error: bErr } = await q;
      if (bErr) {
        setSaving(false);
        setError(`「${d.title || BLOCK_FIELDS[d.kind].label}」の保存に失敗しました: ${bErr.message}`);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setRemovedIds([]);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("この受け皿サイトを削除しますか？ URLは開けなくなります。")) return;
    const { error } = await supabase.from("attend_portals").delete().eq("id", portal.id);
    if (error) {
      setError(`削除に失敗しました: ${error.message}`);
      return;
    }
    router.push(`/admin/attend/projects/${portal.project_id}`);
  }

  return (
    <div className="xl:flex xl:gap-6 xl:items-start">
      <div className="max-w-3xl space-y-6 xl:flex-1 xl:min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/admin/attend/projects/${portal.project_id}`}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            ← {project?.client_name ?? "案件"} へ戻る
          </Link>
          <h1 className="text-lg font-bold mt-1">受け皿サイト: {portal.name}</h1>
        </div>
        <select
          value={f.status}
          onChange={(e) => set("status", e.target.value as typeof f.status)}
          className="text-xs border rounded-full px-3 py-1"
        >
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {/* URL */}
      <section className="bg-white rounded-xl shadow p-6 space-y-3">
        <h2 className="font-semibold">公開URL</h2>
        <div className="flex items-center gap-2">
          <code className="text-xs break-all flex-1">{publicUrl}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs px-2 py-1 rounded border hover:bg-slate-50 shrink-0"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          こちらでホスティングしているので、公開後もこの画面から直せます。
          提供終了にすると、URLは生きたまま終了画面に切り替わります（リンク切れになりません）。
        </p>
        <div className="flex gap-4 text-sm pt-1">
          <a
            href={`/admin/attend/portals/${portal.id}/preview`}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            プレビュー（保存前の状態は反映されません）→
          </a>
          <a href={publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            公開ページを開く →
          </a>
        </div>
      </section>

      {/* 基本 */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">基本設定</h2>
        <Field label="管理用の名前" value={f.name} onChange={(v) => set("name", v)} />

        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-600">テンプレート</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {PORTAL_TEMPLATES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => changeTemplate(t.value)}
                className={`rounded-lg border px-3 py-2 text-left ${
                  f.template === t.value ? "border-slate-900 bg-slate-50" : "border-slate-200"
                }`}
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{t.hint}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            テンプレートを変えると、入力する枠の種類も切り替わります。入力済みの内容は消えません。
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-slate-600">参加導線の行き先</span>
          <select
            value={f.rally_id}
            onChange={(e) => set("rally_id", e.target.value)}
            className="input w-full"
          >
            <option value="">（スタンプラリー以外のURLを指定する）</option>
            {rallies.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="block text-[11px] text-slate-400">
            ラリーを選ぶと、配布用URLが自動で入ります。URLを変えても貼り直し不要です。
          </span>
        </label>
        {!f.rally_id && (
          <Field
            label="行き先URL"
            value={f.custom_ar_url}
            onChange={(v) => set("custom_ar_url", v)}
            placeholder="https://app.attend-ar.com/a/xxxxxxxx"
            hint="未入力の場合、参加ボタンは表示されません。"
          />
        )}
      </section>

      {/* ブランド */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">ロゴと配色</h2>
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-600">配色を選ぶ（3色まとめて変わります）</span>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((c) => {
              const active = f.brand_color === c.brand && f.brand_color_dark === c.brandDark;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => {
                    set("brand_color", c.brand);
                    set("brand_color_dark", c.brandDark);
                    set("accent_color", c.accent);
                  }}
                  className={`flex items-center gap-2 text-xs pl-1.5 pr-3 py-1 rounded-full border ${
                    active ? "border-slate-900 bg-slate-900 text-white" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="flex">
                    <span className="w-3 h-3 rounded-l-full" style={{ background: c.brand }} />
                    <span className="w-3 h-3" style={{ background: c.brandDark }} />
                    <span className="w-3 h-3 rounded-r-full" style={{ background: c.accent }} />
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {([
            ["brand_color", "主役の色"],
            ["brand_color_dark", "濃いほう"],
            ["accent_color", "差し色"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={f[key] || "#000000"}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-9 w-12 rounded border"
                />
                <span className="text-[11px] font-mono text-slate-400">{f[key]}</span>
              </div>
            </label>
          ))}
        </div>
        <ImageField
          label="ロゴ画像（未設定なら文字で表示）"
          value={f.logo_url}
          onChange={(v) => set("logo_url", v)}
          storagePrefix={`attend/portal/${portal.id}/logo`}
        />
        <Field label="ロゴの文字" value={f.logo_text} onChange={(v) => set("logo_text", v)} />
      </section>

      {/* デザイン調整 */}
      <section className="bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <h2 className="font-semibold">デザイン調整</h2>
          <p className="text-xs text-slate-400">
            選んだ用途の見た目を土台にして、ここで細部を詰めます。右のプレビューに即座に反映されます。
          </p>
        </div>

        <Choice
          label="書体"
          options={FONT_OPTIONS}
          value={design.font}
          onChange={(v) => setDesignValue("font", v)}
        />
        <Choice
          label="角の丸み"
          options={RADIUS_OPTIONS}
          value={design.radius}
          onChange={(v) => setDesignValue("radius", v)}
        />
        <Choice
          label="余白の詰め方"
          options={DENSITY_OPTIONS}
          value={design.density}
          onChange={(v) => setDesignValue("density", v)}
        />
        <Choice
          label="トップの見せ方"
          options={HERO_OPTIONS}
          value={design.heroStyle}
          onChange={(v) => setDesignValue("heroStyle", v)}
        />
        <Choice
          label="ページの地の色"
          options={TONE_OPTIONS}
          value={design.tone}
          onChange={(v) => setDesignValue("tone", v)}
        />

        <div className="grid sm:grid-cols-3 gap-4">
          <Slider
            label="写真の上の暗幕"
            hint="文字が読みにくいときに上げる"
            min={0}
            max={80}
            step={5}
            unit="%"
            value={design.heroOverlay}
            onChange={(v) => setDesignValue("heroOverlay", v)}
          />
          <Slider
            label="トップの高さ"
            min={240}
            max={720}
            step={20}
            unit="px"
            value={design.heroHeight}
            onChange={(v) => setDesignValue("heroHeight", v)}
          />
          <Slider
            label="見出しの大きさ"
            min={80}
            max={130}
            step={5}
            unit="%"
            value={design.headingScale}
            onChange={(v) => setDesignValue("headingScale", v)}
          />
        </div>

        <div className="flex flex-wrap gap-5 border-t pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={design.stickyCta}
              onChange={(e) => setDesignValue("stickyCta", e.target.checked)}
            />
            スマホの下に参加ボタンを固定する
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={design.stickyHeader}
              onChange={(e) => setDesignValue("stickyHeader", e.target.checked)}
            />
            ヘッダーを追従させる
          </label>
        </div>
      </section>

      {/* セクション構成 */}
      <section className="bg-white rounded-xl shadow p-6 space-y-3">
        <div>
          <h2 className="font-semibold">ページの構成</h2>
          <p className="text-xs text-slate-400">
            並び順・表示/非表示・見出しを変えられます。中身が空のセクションは、公開時には出ません。
          </p>
        </div>
        <div className="divide-y border rounded-lg">
          {sections.map((sec, i) => {
            const kind = SECTION_BLOCK[sec.key];
            const count = kind ? drafts.filter((d) => d.kind === kind && d.enabled).length : null;
            return (
              <div key={sec.key} className={`p-3 space-y-2 ${sec.enabled ? "" : "bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sec.enabled}
                    onChange={(e) => updateSection(sec.key, { enabled: e.target.checked })}
                  />
                  <span className={`text-sm flex-1 ${sec.enabled ? "" : "text-slate-400"}`}>
                    {SECTION_LABELS[sec.key]}
                    {count !== null && (
                      <span className={`ml-2 text-[11px] ${count ? "text-slate-400" : "text-amber-600"}`}>
                        {count ? `${count}件` : "中身が空"}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveSection(i, -1)}
                    disabled={i === 0}
                    className="text-xs px-2 py-1 rounded border disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(i, 1)}
                    disabled={i === sections.length - 1}
                    className="text-xs px-2 py-1 rounded border disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
                {sec.enabled && (sec.eyebrow !== "" || sec.heading !== "") && (
                  <div className="grid grid-cols-3 gap-2 pl-6">
                    <input
                      value={sec.eyebrow}
                      onChange={(e) => updateSection(sec.key, { eyebrow: e.target.value })}
                      placeholder="英字ラベル"
                      className="input text-xs"
                    />
                    <input
                      value={sec.heading}
                      onChange={(e) => updateSection(sec.key, { heading: e.target.value })}
                      placeholder="見出し"
                      className="input text-xs col-span-2"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* リンク */}
      <section className="bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <h2 className="font-semibold">リンク</h2>
          <p className="text-xs text-slate-400">
            ヘッダーのメニューとSNSです。フッターの規約・問い合わせは下の「サイト情報」にあります。
          </p>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-slate-600">ヘッダーのメニュー</span>
          {nav.map((n, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={n.label}
                onChange={(e) =>
                  setNav((p) => p.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)))
                }
                placeholder="表示名（例: アクセス）"
                className="input w-40"
              />
              <input
                value={n.url}
                onChange={(e) =>
                  setNav((p) => p.map((x, j) => (i === j ? { ...x, url: e.target.value } : x)))
                }
                placeholder="https://..."
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setNav((p) => p.filter((_, j) => j !== i))}
                className="text-xs text-red-600 hover:underline"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setNav((p) => [...p, { label: "", url: "" }])}
            className="text-sm px-3 py-1 rounded-lg border hover:bg-slate-50"
          >
            + メニューを追加
          </button>
          <p className="text-[11px] text-slate-400">スマホ幅では省略されます（参加ボタンを優先するため）。</p>
        </div>

        <div className="space-y-2 border-t pt-4">
          <span className="text-xs font-medium text-slate-600">SNS・公式サイト（フッターに出ます）</span>
          {sns.map((x, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={x.kind}
                onChange={(e) =>
                  setSns((p) =>
                    p.map((y, j) => (i === j ? { ...y, kind: e.target.value as PortalSnsLink["kind"] } : y))
                  )
                }
                className="input w-40"
              >
                {SNS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={x.url}
                onChange={(e) =>
                  setSns((p) => p.map((y, j) => (i === j ? { ...y, url: e.target.value } : y)))
                }
                placeholder="https://..."
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setSns((p) => p.filter((_, j) => j !== i))}
                className="text-xs text-red-600 hover:underline"
              >
                削除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSns((p) => [...p, { kind: "x", url: "" }])}
            className="text-sm px-3 py-1 rounded-lg border hover:bg-slate-50"
          >
            + SNSを追加
          </button>
        </div>
      </section>

      {/* ヒーロー */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">トップの見せ場</h2>
        <ImageField
          label="背景・メイン画像"
          value={f.hero_image_url}
          onChange={(v) => set("hero_image_url", v)}
          storagePrefix={`attend/portal/${portal.id}/hero`}
        />
        <Field label="小見出し（英字ラベルなど）" value={f.hero_eyebrow} onChange={(v) => set("hero_eyebrow", v)} />
        <Field label="大見出し" value={f.hero_title} onChange={(v) => set("hero_title", v)} multiline hint="改行はそのまま反映されます。" />
        <Field label="説明文" value={f.hero_text} onChange={(v) => set("hero_text", v)} multiline />
        {f.template === "shisetsu" && (
          <Field
            label="開館状況の1行"
            value={f.status_line}
            onChange={(v) => set("status_line", v)}
            placeholder="開館中 9:30–17:00（最終入館 16:30）／休館日：月曜"
          />
        )}
      </section>

      {/* 参加導線 */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">参加導線の文言</h2>
        <p className="text-xs text-slate-500">
          ここで設定した文言が、ページ内の大きなボタンと、スマホ下部に常に出るボタンに使われます。
        </p>
        <Field label="見出し" value={f.ar_heading} onChange={(v) => set("ar_heading", v)} />
        <Field label="説明文" value={f.ar_text} onChange={(v) => set("ar_text", v)} multiline />
        <Field label="ボタンの文字" value={f.ar_button_label} onChange={(v) => set("ar_button_label", v)} />
      </section>

      {/* ブロック */}
      {usedKinds.map((kind) => {
        const fields = BLOCK_FIELDS[kind];
        const items = drafts.filter((d) => d.kind === kind);
        return (
          <section key={kind} className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{fields.label}</h2>
                <p className="text-xs text-slate-500 mt-1">{tpl.blockHints[kind]}</p>
              </div>
              <button
                onClick={() => addBlock(kind)}
                className="bg-pink-600 text-white text-xs rounded-lg px-3 py-2 shrink-0"
              >
                + 追加
              </button>
            </div>

            {items.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">
                まだありません。0件のままだと、このセクションはページに出ません。
              </p>
            )}

            <ul className="space-y-3">
              {items.map((d, i) => (
                <li key={d.id} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">#{i + 1}</span>
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 ml-auto">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => updateBlock(d.id, { enabled: e.target.checked })}
                      />
                      表示する
                    </label>
                    <button onClick={() => moveBlock(kind, i, -1)} className="text-xs px-2 py-1 border rounded hover:bg-slate-50">↑</button>
                    <button onClick={() => moveBlock(kind, i, 1)} className="text-xs px-2 py-1 border rounded hover:bg-slate-50">↓</button>
                    <button onClick={() => removeBlock(d.id)} className="text-xs text-red-600 hover:underline">削除</button>
                  </div>

                  <Field label={fields.title} value={d.title} onChange={(v) => updateBlock(d.id, { title: v })} />
                  {fields.body && (
                    <Field label={fields.body} value={d.body} onChange={(v) => updateBlock(d.id, { body: v })} multiline />
                  )}
                  {fields.meta && (
                    <Field label={fields.meta} value={d.meta} onChange={(v) => updateBlock(d.id, { meta: v })} />
                  )}
                  {fields.badge && (
                    <Field label={fields.badge} value={d.badge} onChange={(v) => updateBlock(d.id, { badge: v })} />
                  )}
                  {fields.link && (
                    <Field label="リンク先URL" value={d.link_url} onChange={(v) => updateBlock(d.id, { link_url: v })} placeholder="https://" />
                  )}
                  {fields.image && (
                    <ImageField
                      label="画像"
                      value={d.image_url}
                      onChange={(v) => updateBlock(d.id, { image_url: v })}
                      storagePrefix={`attend/portal/${portal.id}/blocks`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {/* フッター */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">フッター・head</h2>
        <Field label="ページタイトル（ブラウザのタブ・検索結果）" value={f.site_title} onChange={(v) => set("site_title", v)} />
        <Field label="ページの説明（検索結果・SNSシェア）" value={f.site_description} onChange={(v) => set("site_description", v)} multiline />
        <ImageField
          label="SNSシェア画像（未設定ならトップ画像を使います）"
          value={f.og_image_url}
          onChange={(v) => set("og_image_url", v)}
          storagePrefix={`attend/portal/${portal.id}/og`}
        />
        <Field label="運営者名" value={f.owner_name} onChange={(v) => set("owner_name", v)} />
        <Field label="住所・電話" value={f.owner_address} onChange={(v) => set("owner_address", v)} multiline />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="プライバシーポリシー" value={f.privacy_url} onChange={(v) => set("privacy_url", v)} placeholder="https://" />
          <Field label="利用規約" value={f.terms_url} onChange={(v) => set("terms_url", v)} placeholder="https://" />
          <Field label="お問い合わせ" value={f.contact_url} onChange={(v) => set("contact_url", v)} placeholder="https://" />
        </div>
        <p className="text-[11px] text-slate-400">
          未入力のリンクはフッターに出ません。会員登録（メール保存）を使う案件では、
          プライバシーポリシーの掲載が必要になります。
        </p>
        <Field label="コピーライト表記" value={f.copyright_text} onChange={(v) => set("copyright_text", v)} />
      </section>

      {/* 提供終了 */}
      <section className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">提供終了のときの表示</h2>
        <p className="text-xs text-slate-500">
          上の状態を「提供終了」にすると、URLは生きたままこの内容の画面に切り替わります。
          配布済みのチラシやQRからアクセスされてもリンク切れにならず、次の案内へ送れます。
        </p>
        <Field
          label="終了画面のメッセージ"
          value={f.ended_message}
          onChange={(v) => set("ended_message", v)}
          multiline
          placeholder="このスタンプラリーは終了しました。ご参加ありがとうございました。"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="誘導先URL" value={f.ended_link_url} onChange={(v) => set("ended_link_url", v)} placeholder="https://" />
          <Field label="ボタンの文字" value={f.ended_link_label} onChange={(v) => set("ended_link_label", v)} placeholder="公式サイトへ" />
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
        <button onClick={handleDelete} className="text-sm text-red-600 hover:underline ml-auto">
          この受け皿サイトを削除
        </button>
      </div>
      </div>

      {/* 編集しながら、その場で見た目を確認する。
          色や余白の詰め方は、実際の幅で見ないと判断できないため、
          スマホ/タブレット/PCを切り替えられるようにしている。 */}
      <aside className="hidden xl:block w-[520px] flex-shrink-0 sticky top-4">
        <PortalPreview data={previewData} publicUrl={publicUrl} />
      </aside>
    </div>
  );
}
