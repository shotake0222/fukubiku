import {
  emptyBlocks,
  resolveDesign,
  resolveSections,
  type PortalBlock,
  type PortalBlockKind,
  type PortalData,
  type PortalDesign,
  type PortalTemplate,
} from "./types";

// 受け皿サイトの見本。DBを引かずにテンプレートの見た目を出すために使う。
//
// 管理画面で「どのテンプレートがどんな見た目か」を、
// 案件を作る前・受け皿サイトを1つも作っていない状態でも見られるようにするためのもの。
// 公開ページの描画処理をそのまま通すので、ここで見えたものがそのまま出る。

function blocks(
  spec: Partial<Record<PortalBlockKind, Omit<PortalBlock, "id" | "kind">[]>>
): Record<PortalBlockKind, PortalBlock[]> {
  const out = emptyBlocks();
  for (const [kind, list] of Object.entries(spec)) {
    out[kind as PortalBlockKind] = (list ?? []).map((b, i) => ({
      ...b,
      id: `${kind}-${i}`,
      kind: kind as PortalBlockKind,
    }));
  }
  return out;
}

function b(
  title: string,
  body?: string,
  extra?: Partial<Omit<PortalBlock, "id" | "kind" | "title" | "body">>
): Omit<PortalBlock, "id" | "kind"> {
  return {
    title,
    body: body ?? null,
    meta: null,
    imageUrl: null,
    linkUrl: null,
    badge: null,
    ...extra,
  };
}

const COMMON = {
  pick: [
    b("見どころの見出し", "ここに説明が入ります。写真を入れると印象が大きく変わります。"),
    b("2つめの見どころ", "ここに説明が入ります。"),
    b("3つめの見どころ", "ここに説明が入ります。"),
  ],
  spot: [
    b("○○神社", "スポットの説明が入ります。", { meta: "9:00-17:00 / ○○駅から徒歩5分", badge: "スタンプ①", linkUrl: "#" }),
    b("商店街アーケード", "スポットの説明が入ります。", { meta: "店舗により異なります", badge: "スタンプ②" }),
    b("展望台", "スポットの説明が入ります。", { meta: "10:00-21:00", badge: "スタンプ③", linkUrl: "#" }),
    b("旧郵便局", "スポットの説明が入ります。", { meta: "見学自由", badge: "スタンプ④" }),
  ],
  banner: [
    b("クーポンを見る", undefined, { meta: "参加店舗で使えます", linkUrl: "#" }),
    b("アクセス", undefined, { meta: "電車・バス・駐車場", linkUrl: "#" }),
    b("公式SNS", undefined, { meta: "最新情報はこちら", linkUrl: "#" }),
  ],
  news: [b("2026.09.01", "スタンプラリーを開始しました。"), b("2026.08.20", "参加店舗を追加しました。")],
  outline: [
    b("開催期間", "2026年9月1日（火）〜11月30日（日）"),
    b("参加費", "無料"),
    b("景品引換", "○○観光案内所（10:00-17:00）"),
  ],
  faq: [
    b("アプリのインストールは必要ですか？", "不要です。ページを開くだけで始められます。"),
    b("スタンプが押せないときは？", "位置情報の許可をご確認ください。屋内では掲示のQRもご利用いただけます。"),
  ],
  note: [
    b("私有地への立ち入りはご遠慮ください。"),
    b("歩きながらの操作はおやめください。"),
    b("ゴミはお持ち帰りください。"),
  ],
  chapter: [
    b("第1章", "3月〜5月", { meta: "SPRING", badge: "開催中" }),
    b("第2章", "6月〜8月", { meta: "SUMMER" }),
    b("第3章", "9月〜11月", { meta: "AUTUMN" }),
    b("第4章", "12月〜2月", { meta: "WINTER" }),
  ],
};

const HERO: Record<PortalTemplate, { eyebrow: string; title: string; text: string; status: string }> = {
  kanko: {
    eyebrow: "STAMP RALLY 2026",
    title: "歩いて、かざして、\nこの街を集める。",
    text: "エリアの見どころをめぐるデジタルスタンプラリー。アプリのインストールは要りません。",
    status: "",
  },
  shotengai: {
    eyebrow: "開催中",
    title: "食べて、集めて、\nもういっぱい。",
    text: "参加店舗をめぐるスタンプラリー。お店のスタンプ台にかざすだけ。",
    status: "",
  },
  shisetsu: {
    eyebrow: "AR STAMP RALLY",
    title: "展示の前に立つと、\nもうひとつの展示が現れる。",
    text: "館内をめぐるARスタンプラリー。すべて集めると記念カードが受け取れます。",
    status: "本日開館 10:00-18:00 / スタンプラリー開催中",
  },
  seichi: {
    eyebrow: "SEICHI AR RALLY",
    title: "あの場所に立つと、\nあのシーンが動き出す。",
    text: "作品の舞台をめぐるARスタンプラリー。現地でスマホをかざすとキャラクターが現れます。",
    status: "",
  },
  jousetsu: {
    eyebrow: "ただいま開催中",
    title: "第1章\n開催中",
    text: "季節ごとにスポットが入れ替わる、通年のスタンプラリー。",
    status: "",
  },
};

const COLORS: Record<PortalTemplate, [string, string, string]> = {
  kanko: ["#0f766e", "#115e59", "#d97706"],
  shotengai: ["#e4572e", "#c33f1b", "#f2b705"],
  shisetsu: ["#1b4a7a", "#123456", "#0ea5b7"],
  seichi: ["#ff4d6d", "#d62f4e", "#5eead4"],
  jousetsu: ["#2f7a45", "#226034", "#e0a11b"],
};

/** テンプレートの見本データ。design を渡すと調整後の見た目も試せる */
export function samplePortalData(
  template: PortalTemplate,
  design?: Partial<PortalDesign>
): PortalData {
  const hero = HERO[template];
  const [brand, brandDark, accent] = COLORS[template];
  return {
    template,
    status: "published",
    endedMessage: null,
    endedLinkUrl: null,
    endedLinkLabel: null,
    brand,
    brandDark,
    accent,
    logoUrl: null,
    logoText: "○○スタンプラリー",
    siteTitle: "○○スタンプラリー",
    siteDescription: null,
    ogImageUrl: null,
    heroImageUrl: null,
    heroEyebrow: hero.eyebrow,
    heroTitle: hero.title,
    heroText: hero.text,
    arUrl: "#",
    arHeading: "スタンプラリーに参加する",
    arText: "アプリのインストールは不要です。スマホだけで参加できます。",
    arButtonLabel: "いますぐ始める",
    statusLine: hero.status || null,
    ownerName: "○○観光協会",
    ownerAddress: "○○県○○市○○町1-2-3",
    privacyUrl: "#",
    termsUrl: "#",
    contactUrl: "#",
    copyrightText: null,
    design: resolveDesign(template, design ?? null),
    sections: resolveSections(template, null),
    nav: [
      { label: "スポット", url: "#" },
      { label: "開催概要", url: "#" },
    ],
    sns: [
      { kind: "x", url: "#" },
      { kind: "instagram", url: "#" },
    ],
    customHtml: null,
    customCss: null,
    blocks: blocks(COMMON),
  };
}
