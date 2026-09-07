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
  | "chapter";

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

  blocks: Record<PortalBlockKind, PortalBlock[]>;
}

export function emptyBlocks(): Record<PortalBlockKind, PortalBlock[]> {
  return { pick: [], spot: [], banner: [], news: [], faq: [], outline: [], note: [], chapter: [] };
}
