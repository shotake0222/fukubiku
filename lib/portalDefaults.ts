import type { SupabaseClient } from "@supabase/supabase-js";
import { generateHash } from "@/lib/hash";
import type { PortalTemplate } from "@/lib/portal/types";

/**
 * 受け皿サイトの雛形。
 * 空の器を渡すと「何を入れる場所なのか」が分からないので、
 * テンプレートごとに枠を数個だけ先に置いておく。
 */
const PRESETS: Record<
  PortalTemplate,
  {
    brand: string;
    brandDark: string;
    accent: string;
    hero: { eyebrow: string; title: string; text: string };
    blocks: { kind: string; title: string; body?: string; meta?: string }[];
  }
> = {
  kanko: {
    brand: "#0f766e", brandDark: "#115e59", accent: "#0f766e",
    hero: { eyebrow: "STAMP RALLY", title: "歩いて、かざして、\nこの街を集める。", text: "エリアの見どころをめぐるデジタルスタンプラリー。アプリのインストールは要りません。" },
    blocks: [
      { kind: "pick", title: "見どころ1" }, { kind: "pick", title: "見どころ2" }, { kind: "pick", title: "見どころ3" },
      { kind: "spot", title: "スポット1" }, { kind: "spot", title: "スポット2" }, { kind: "spot", title: "スポット3" },
      { kind: "banner", title: "バナー1" }, { kind: "banner", title: "バナー2" },
      { kind: "outline", title: "開催期間", body: "" },
      { kind: "outline", title: "参加費", body: "無料" },
      { kind: "outline", title: "景品引換", body: "" },
    ],
  },
  shotengai: {
    brand: "#e4572e", brandDark: "#c33f1b", accent: "#f2b705",
    hero: { eyebrow: "開催中", title: "食べて、集めて、\nもういっぱい。", text: "参加店舗をめぐるスタンプラリー。お店のスタンプ台にかざすだけ。" },
    blocks: [
      { kind: "news", title: "CAMPAIGN", body: "スタンプ3個でクーポンが使えます" },
      { kind: "spot", title: "参加店舗1" }, { kind: "spot", title: "参加店舗2" }, { kind: "spot", title: "参加店舗3" },
      { kind: "banner", title: "商店街マップ" }, { kind: "banner", title: "アクセス" },
      { kind: "outline", title: "開催期間", body: "" },
      { kind: "outline", title: "スタンプの押し方", body: "各店のレジ横のスタンプ台にかざす、または掲示のQRを読み取ってください。" },
    ],
  },
  shisetsu: {
    brand: "#1b4a7a", brandDark: "#123456", accent: "#0ea5b7",
    hero: { eyebrow: "AR STAMP RALLY", title: "展示の前に立つと、\nもうひとつの展示が現れる。", text: "館内をめぐるARスタンプラリー。すべて集めると記念カードが受け取れます。" },
    blocks: [
      { kind: "pick", title: "参加する", body: "上のボタンからスタンプ帳を開きます。登録や入力はありません。" },
      { kind: "pick", title: "展示にかざす", body: "各展示の脇にあるスタンプ台にスマホをかざすとスタンプが押されます。" },
      { kind: "pick", title: "受け取る", body: "すべて集めると記念カードと引換コードが出ます。" },
      { kind: "spot", title: "スポット1", meta: "1F" }, { kind: "spot", title: "スポット2", meta: "2F" },
      { kind: "outline", title: "開催期間", body: "" },
      { kind: "outline", title: "参加費", body: "無料（別途、入館料が必要です）" },
      { kind: "banner", title: "フロアマップ" },
      { kind: "note", title: "展示室内では、他のお客様の妨げにならないようご配慮ください。" },
      { kind: "note", title: "歩きながらの操作はおやめください。" },
    ],
  },
  seichi: {
    brand: "#ff4d6d", brandDark: "#d62f4e", accent: "#5eead4",
    hero: { eyebrow: "SEICHI AR RALLY", title: "あの場所に立つと、\nあのシーンが動き出す。", text: "作品の舞台をめぐるARスタンプラリー。現地でスマホをかざすとキャラクターが現れます。" },
    blocks: [
      { kind: "pick", title: "キャラクターA" }, { kind: "pick", title: "キャラクターB" },
      { kind: "spot", title: "ロケ地1", meta: "第1話" }, { kind: "spot", title: "ロケ地2", meta: "第4話" },
      { kind: "banner", title: "コラボグッズ" }, { kind: "banner", title: "公式SNS" },
      { kind: "note", title: "スポットの多くは住民の生活圏です。私有地への立ち入りはご遠慮ください。" },
      { kind: "note", title: "撮影は通行の妨げにならない場所からお願いします。" },
      { kind: "note", title: "ゴミはお持ち帰りください。" },
    ],
  },
  jousetsu: {
    brand: "#2f7a45", brandDark: "#226034", accent: "#e0a11b",
    hero: { eyebrow: "ただいま開催中", title: "第1章\n開催中", text: "季節ごとにスポットが入れ替わる、通年のスタンプラリー。" },
    blocks: [
      { kind: "outline", title: "スポット開催中", body: "8" },
      { kind: "outline", title: "人が参加中", body: "0" },
      { kind: "spot", title: "今月の追加スポット" },
      { kind: "chapter", title: "第1章", meta: "SPRING", body: "3月〜5月" },
      { kind: "chapter", title: "第2章", meta: "SUMMER", body: "6月〜8月" },
      { kind: "banner", title: "園内マップ" },
      { kind: "faq", title: "アプリのインストールは必要ですか？", body: "不要です。ページを開くだけで始められます。" },
      { kind: "faq", title: "スタンプが押せないときは？", body: "位置情報の許可をご確認ください。屋内では掲示のQRまたは合言葉をご利用ください。" },
    ],
  },
};

export async function createDefaultPortal(
  supabase: SupabaseClient,
  projectId: string,
  clientName: string,
  template: PortalTemplate,
  rallyId: string | null
): Promise<{ id: string; hash: string } | null> {
  const preset = PRESETS[template];

  const { data, error } = await supabase
    .from("attend_portals")
    .insert({
      project_id: projectId,
      rally_id: rallyId,
      hash: generateHash(),
      name: `${clientName} 受け皿サイト`,
      template,
      status: "draft",
      brand_color: preset.brand,
      brand_color_dark: preset.brandDark,
      accent_color: preset.accent,
      logo_text: clientName,
      site_title: `${clientName} スタンプラリー`,
      hero_eyebrow: preset.hero.eyebrow,
      hero_title: preset.hero.title,
      hero_text: preset.hero.text,
      owner_name: clientName,
    })
    .select("id, hash")
    .single();

  if (error || !data) return null;
  const portal = data as { id: string; hash: string };

  await supabase.from("attend_portal_blocks").insert(
    preset.blocks.map((b, i) => ({
      portal_id: portal.id,
      kind: b.kind,
      sort_order: i,
      title: b.title,
      body: b.body ?? null,
      meta: b.meta ?? null,
    }))
  );

  return portal;
}
