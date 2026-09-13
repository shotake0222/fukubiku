export type PortalTemplate = "kanko" | "shotengai" | "shisetsu" | "seichi" | "jousetsu";
export type PortalStatus = "draft" | "published" | "ended";
export type PortalBlockKind =
  | "pick"
  | "spot"
  | "banner"
  | "news"
  | "faq"
  | "outline"
  | "note"
  | "chapter"
  // テンプレートの好きな位置に差し込む自由HTML
  | "html";

export const PORTAL_TEMPLATES: {
  value: PortalTemplate;
  label: string;
  hint: string;
  /** その用途で埋めることになるブロックの説明（管理画面の案内に使う） */
  blockHints: Partial<Record<PortalBlockKind, string>>;
}[] = [
  {
    value: "kanko",
    label: "観光周遊",
    hint: "観光協会・DMO・広域自治体。見どころ→スポット→モデルコースの順で読ませます",
    blockHints: {
      pick: "見どころ（3枚程度）",
      spot: "スタンプスポット",
      banner: "クーポン・交通・宿泊などのバナー",
      news: "お知らせ",
      outline: "開催概要",
    },
  },
  {
    value: "shotengai",
    label: "商店街・食べ歩き",
    hint: "商店街振興組合・まちづくり会社。店舗カードが主役で、営業情報を前に出します",
    blockHints: {
      news: "先頭の1件がページ上部のキャンペーン帯になります",
      spot: "参加店舗",
      banner: "マップ・アクセス・SNS",
      outline: "開催概要",
    },
  },
  {
    value: "shisetsu",
    label: "施設・館内",
    hint: "博物館・水族館・商業施設・展示会。来館者がもう館内にいる前提の構成です",
    blockHints: {
      pick: "遊び方（3ステップ）",
      spot: "館内スポット（補足にフロアを書くと見やすくなります）",
      outline: "開催概要",
      banner: "フロアマップ・企画展・ショップ",
      note: "ご参加にあたっての注意",
    },
  },
  {
    value: "seichi",
    label: "IPコラボ・聖地巡礼",
    hint: "作品コラボ・ロケ地誘客。暗色でキービジュアルを主役にします",
    blockHints: {
      pick: "登場キャラクター",
      spot: "巡礼スポット（補足に話数や公開時間）",
      banner: "グッズ・マップ・公式SNS",
      note: "巡礼のマナー",
    },
  },
  {
    value: "jousetsu",
    label: "常設・通年",
    hint: "公園・テーマパーク・沿線企画。いま開催中の章とリピーター導線を前に出します",
    blockHints: {
      outline: "参加状況の数字（例：8スポット開催中）",
      spot: "今月の追加スポット",
      chapter: "季節ごとの章",
      banner: "園内マップ・年間パス・イベント",
      faq: "よくある質問",
    },
  },
];

export interface PortalBlock {
  id: string;
  kind: PortalBlockKind;
  title: string | null;
  body: string | null;
  meta: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  badge: string | null;
}

export interface PortalData {
  template: PortalTemplate;
  status: PortalStatus;
  endedMessage: string | null;
  endedLinkUrl: string | null;
  endedLinkLabel: string | null;

  brand: string;
  brandDark: string;
  accent: string;
  logoUrl: string | null;
  logoText: string | null;

  siteTitle: string;
  siteDescription: string | null;
  ogImageUrl: string | null;

  heroImageUrl: string | null;
  heroEyebrow: string | null;
  heroTitle: string | null;
  heroText: string | null;

  /** 参加導線の行き先。未設定なら導線ボタンを出さない（＝準備中） */
  arUrl: string | null;
  arHeading: string;
  arText: string | null;
  arButtonLabel: string;

  statusLine: string | null;

  ownerName: string | null;
  ownerAddress: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  contactUrl: string | null;
  copyrightText: string | null;

  /** デザイン調整。テンプレート既定＋管理画面での上書き */
  design: PortalDesign;
  /** セクションの並び順・表示/非表示・見出し */
  sections: PortalSection[];
  /** ヘッダーのリンク */
  nav: PortalNavLink[];
  /** SNS・公式サイトへのリンク */
  sns: PortalSnsLink[];

  /** ページ全体を差し替えるHTML。設定するとテンプレートを使わない */
  customHtml: string | null;
  /** テンプレートの後ろに足すCSS */
  customCss: string | null;

  blocks: Record<PortalBlockKind, PortalBlock[]>;
}

/** テンプレート既定と保存値を合成して、描画に使う最終的なデザイン設定にする */
export function resolveDesign(
  template: PortalTemplate,
  saved: Partial<PortalDesign> | null | undefined
): PortalDesign {
  return { ...DEFAULT_DESIGN, ...(TEMPLATE_DEFAULT_DESIGN[template] ?? {}), ...(saved ?? {}) };
}

/**
 * 保存されているセクション構成を、既定と突き合わせて整える。
 * 既定に無いキーは捨て、既定にあって保存値に無いキー（＝あとから増やしたセクション）は
 * 無効の状態で末尾に足す。テンプレートを変えたときも破綻しない。
 */
export function resolveSections(
  template: PortalTemplate,
  saved: PortalSection[] | null | undefined
): PortalSection[] {
  const defaults = TEMPLATE_DEFAULT_SECTIONS[template] ?? TEMPLATE_DEFAULT_SECTIONS.kanko;
  if (!saved || saved.length === 0) return defaults.map((s) => ({ ...s }));
  const known = new Set(defaults.map((s) => s.key));
  const out: PortalSection[] = [];
  const seen = new Set<SectionKey>();
  for (const s of saved) {
    if (!known.has(s.key) || seen.has(s.key)) continue;
    seen.add(s.key);
    const def = defaults.find((d) => d.key === s.key)!;
    out.push({
      key: s.key,
      enabled: typeof s.enabled === "boolean" ? s.enabled : def.enabled,
      eyebrow: typeof s.eyebrow === "string" ? s.eyebrow : def.eyebrow,
      heading: typeof s.heading === "string" ? s.heading : def.heading,
    });
  }
  for (const d of defaults) if (!seen.has(d.key)) out.push({ ...d, enabled: false });
  return out;
}

export function emptyBlocks(): Record<PortalBlockKind, PortalBlock[]> {
  return { pick: [], spot: [], banner: [], news: [], faq: [], outline: [], note: [], chapter: [], html: [] };
}

// ============================================================
// セクション（並び順・表示/非表示・見出しを管理画面から変えられるようにする）
// ============================================================
export type SectionKey =
  | "hero"
  | "status"
  | "campaign"
  | "ar"
  | "picks"
  | "spots"
  | "chapters"
  | "banners"
  | "news"
  | "outline"
  | "faq"
  | "notes"
  | "html";

export interface PortalSection {
  key: SectionKey;
  enabled: boolean;
  /** 小さい英字ラベル。空にすると出ない */
  eyebrow: string;
  /** 見出し */
  heading: string;
}

export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "ヒーロー（先頭の大きい部分）",
  status: "開催状況の1行",
  campaign: "キャンペーン帯（お知らせの先頭1件）",
  ar: "スタンプラリー参加導線",
  picks: "見どころ／ステップ／キャラクター",
  spots: "スポット・店舗・ロケ地",
  chapters: "章（季節）",
  banners: "バナー",
  news: "お知らせ",
  outline: "開催概要",
  faq: "よくある質問",
  notes: "注意書き・お願い",
  html: "自由HTML（自分で書いた部分）",
};

/** そのセクションが中身として使うブロック。0件なら編集画面で「まだ空です」と出す */
export const SECTION_BLOCK: Partial<Record<SectionKey, PortalBlockKind>> = {
  campaign: "news",
  picks: "pick",
  spots: "spot",
  chapters: "chapter",
  banners: "banner",
  news: "news",
  outline: "outline",
  faq: "faq",
  notes: "note",
  html: "html",
};

function sec(key: SectionKey, eyebrow: string, heading: string, enabled = true): PortalSection {
  return { key, enabled, eyebrow, heading };
}

/** 用途別の初期構成。管理画面で並べ替え・ON/OFF・見出し変更ができる */
export const TEMPLATE_DEFAULT_SECTIONS: Record<PortalTemplate, PortalSection[]> = {
  kanko: [
    sec("hero", "", ""),
    sec("ar", "", ""),
    sec("picks", "HIGHLIGHTS", "この街の見どころ"),
    sec("spots", "SPOTS", "スタンプスポット"),
    sec("banners", "PICK UP", "おすすめ・お得な情報"),
    sec("news", "NEWS", "お知らせ"),
    sec("outline", "ACCESS", "開催概要"),
    sec("faq", "FAQ", "よくあるご質問", false),
    sec("notes", "", "ご参加にあたって", false),
    sec("chapters", "CHAPTERS", "これまでの章", false),
    sec("status", "", "", false),
    sec("campaign", "", "", false),
    sec("html", "", "", false),
  ],
  shotengai: [
    sec("hero", "", ""),
    sec("ar", "", ""),
    sec("campaign", "", ""),
    sec("spots", "SHOPS", "参加店舗"),
    sec("banners", "INFORMATION", "おすすめ・関連情報"),
    sec("outline", "OUTLINE", "開催概要"),
    sec("news", "NEWS", "お知らせ", false),
    sec("picks", "HIGHLIGHTS", "見どころ", false),
    sec("faq", "FAQ", "よくあるご質問", false),
    sec("notes", "", "ご参加にあたって", false),
    sec("chapters", "CHAPTERS", "これまでの章", false),
    sec("status", "", "", false),
    sec("html", "", "", false),
  ],
  shisetsu: [
    sec("status", "", ""),
    sec("hero", "", ""),
    sec("ar", "", ""),
    sec("picks", "HOW TO PLAY", "遊び方"),
    sec("spots", "SPOTS", "館内スポット"),
    sec("outline", "SCHEDULE", "開催概要"),
    sec("banners", "INFORMATION", "館内のご案内"),
    sec("notes", "", "ご参加にあたって"),
    sec("faq", "FAQ", "よくあるご質問", false),
    sec("news", "NEWS", "お知らせ", false),
    sec("chapters", "CHAPTERS", "これまでの章", false),
    sec("campaign", "", "", false),
    sec("html", "", "", false),
  ],
  seichi: [
    sec("hero", "", ""),
    sec("picks", "CHARACTERS", "登場キャラクター"),
    sec("ar", "", ""),
    sec("spots", "LOCATIONS", "巡礼スポット"),
    sec("banners", "INFORMATION", "関連情報"),
    sec("notes", "", "巡礼にあたってのお願い"),
    sec("outline", "OUTLINE", "開催概要", false),
    sec("news", "NEWS", "お知らせ", false),
    sec("faq", "FAQ", "よくあるご質問", false),
    sec("chapters", "CHAPTERS", "これまでの章", false),
    sec("status", "", "", false),
    sec("campaign", "", "", false),
    sec("html", "", "", false),
  ],
  jousetsu: [
    sec("hero", "", ""),
    sec("outline", "STATUS", "開催状況"),
    sec("spots", "NEW SPOT", "今月の追加スポット"),
    sec("chapters", "CHAPTERS", "これまでの章"),
    sec("banners", "INFORMATION", "園内のご案内"),
    sec("faq", "FAQ", "よくあるご質問"),
    sec("ar", "", "", false),
    sec("picks", "HIGHLIGHTS", "見どころ", false),
    sec("news", "NEWS", "お知らせ", false),
    sec("notes", "", "ご参加にあたって", false),
    sec("status", "", "", false),
    sec("campaign", "", "", false),
    sec("html", "", "", false),
  ],
};

// ============================================================
// デザイン調整（テンプレートを選んだうえで、見た目を詰められるようにする）
// ============================================================
export type PortalFont = "gothic" | "mincho" | "rounded";
export type PortalRadius = "sharp" | "soft" | "round";
export type PortalDensity = "compact" | "normal" | "airy";
export type PortalHeroStyle = "cover" | "split" | "band";
export type PortalPageTone = "default" | "white" | "cream" | "gray" | "dark";

export interface PortalDesign {
  font: PortalFont;
  radius: PortalRadius;
  density: PortalDensity;
  /** ヒーローの見せ方。テンプレート既定を上書きする */
  heroStyle: PortalHeroStyle;
  /** ヒーロー画像にかける暗幕の濃さ(0〜80%)。文字が読めないときに上げる */
  heroOverlay: number;
  /** ヒーローの高さ(px) */
  heroHeight: number;
  /** 見出しの大きさ(80〜130%) */
  headingScale: number;
  /** ページの地の色 */
  tone: PortalPageTone;
  /** 画面下に常時出す参加ボタン */
  stickyCta: boolean;
  /** ヘッダーを追従させる */
  stickyHeader: boolean;
}

export const DEFAULT_DESIGN: PortalDesign = {
  font: "gothic",
  radius: "soft",
  density: "normal",
  heroStyle: "cover",
  heroOverlay: 35,
  heroHeight: 460,
  headingScale: 100,
  tone: "default",
  stickyCta: true,
  stickyHeader: true,
};

export const TEMPLATE_DEFAULT_DESIGN: Record<PortalTemplate, Partial<PortalDesign>> = {
  kanko: { heroStyle: "cover", font: "mincho" },
  shotengai: { heroStyle: "cover", radius: "round" },
  shisetsu: { heroStyle: "split", radius: "soft" },
  seichi: { heroStyle: "cover", heroOverlay: 45, heroHeight: 560, radius: "sharp" },
  jousetsu: { heroStyle: "band", radius: "round" },
};

export const FONT_OPTIONS: { value: PortalFont; label: string; hint: string }[] = [
  { value: "gothic", label: "ゴシック", hint: "読みやすい。迷ったらこれ" },
  { value: "mincho", label: "明朝", hint: "落ち着いた印象。観光・神社仏閣向け" },
  { value: "rounded", label: "丸ゴシック", hint: "やわらかい印象。family向け" },
];
export const RADIUS_OPTIONS: { value: PortalRadius; label: string }[] = [
  { value: "sharp", label: "角を立てる" },
  { value: "soft", label: "ほどよく丸める" },
  { value: "round", label: "しっかり丸める" },
];
export const DENSITY_OPTIONS: { value: PortalDensity; label: string; hint: string }[] = [
  { value: "compact", label: "詰める", hint: "情報量が多いとき" },
  { value: "normal", label: "標準", hint: "" },
  { value: "airy", label: "ゆったり", hint: "写真を大きく見せたいとき" },
];
export const HERO_OPTIONS: { value: PortalHeroStyle; label: string; hint: string }[] = [
  { value: "cover", label: "全面に写真", hint: "写真の上に文字を重ねる" },
  { value: "split", label: "左右2分割", hint: "文字と写真を並べる。文字が読みやすい" },
  { value: "band", label: "帯＋参加ボタン", hint: "先頭から参加させたいとき" },
];
export const TONE_OPTIONS: { value: PortalPageTone; label: string }[] = [
  { value: "default", label: "テンプレート既定" },
  { value: "white", label: "白" },
  { value: "cream", label: "生成り" },
  { value: "gray", label: "うすいグレー" },
  { value: "dark", label: "濃色" },
];

/** 配色プリセット。3色を1クリックで揃えられるようにする */
export const COLOR_PRESETS: { label: string; brand: string; brandDark: string; accent: string }[] = [
  { label: "深緑（和・観光）", brand: "#0f766e", brandDark: "#115e59", accent: "#d97706" },
  { label: "藍", brand: "#1d4ed8", brandDark: "#1e3a8a", accent: "#f59e0b" },
  { label: "臙脂", brand: "#9f1239", brandDark: "#7f1d3a", accent: "#b45309" },
  { label: "柿（商店街）", brand: "#c2410c", brandDark: "#9a3412", accent: "#0f766e" },
  { label: "紫紺（聖地巡礼）", brand: "#6d28d9", brandDark: "#4c1d95", accent: "#f472b6" },
  { label: "海（水族館）", brand: "#0891b2", brandDark: "#0e7490", accent: "#fbbf24" },
  { label: "若草（公園）", brand: "#4d7c0f", brandDark: "#3f6212", accent: "#ea580c" },
  { label: "墨（モノトーン）", brand: "#27272a", brandDark: "#18181b", accent: "#a1a1aa" },
];

// ============================================================
// リンク
// ============================================================
export interface PortalNavLink {
  label: string;
  url: string;
}

export type PortalSnsKind = "x" | "instagram" | "line" | "youtube" | "facebook" | "tiktok" | "web";

export const SNS_OPTIONS: { value: PortalSnsKind; label: string }[] = [
  { value: "x", label: "X（旧Twitter）" },
  { value: "instagram", label: "Instagram" },
  { value: "line", label: "LINE" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "web", label: "公式サイト" },
];

export interface PortalSnsLink {
  kind: PortalSnsKind;
  url: string;
}
