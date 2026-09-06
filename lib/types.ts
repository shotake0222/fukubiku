export type DisplayType = "aframe" | "mindar";
export type ObjectSource = "preset" | "upload";
export type OrderStatus = "draft" | "compiling" | "ready";

export const PRESET_CATEGORIES: { value: string; label: string }[] = [
  { value: "amida", label: "あみだくじ" },
  { value: "box", label: "ボックス抽選" },
  { value: "darts", label: "ダーツ" },
  { value: "garagara", label: "ガラガラ抽選" },
  { value: "omikuji", label: "おみくじ" },
  { value: "scratch", label: "スクラッチ" },
  { value: "roulette", label: "ルーレット" },
  { value: "dice", label: "サイコロ" },
  { value: "treasure", label: "宝箱" },
  { value: "slot", label: "スロット" },
  { value: "gacha", label: "ガチャガチャ" },
  { value: "mallet", label: "打ち出の小槌" },
  { value: "cat", label: "招き猫" },
  { value: "daruma", label: "だるま" },
  { value: "lantern", label: "ランタン" },
  { value: "firework", label: "打ち上げ花火" },
  { value: "airlottery", label: "エアー抽選機" },
  { value: "fan", label: "扇子" },
  { value: "pachinko", label: "パチンコ" },
  { value: "jet", label: "戦闘機の的撃ち" },
  { value: "rocket", label: "ロケット発射" },
  { value: "meteor", label: "隕石落下" },
  { value: "shuriken", label: "手裏剣ヒット" },
  { value: "dragon", label: "龍が玉を掴む" },
  { value: "iaido", label: "居合斬り" },
  { value: "ufo", label: "UFOビーム" },
  { value: "cannon", label: "大砲・クラッカー砲" },
  { value: "thunder", label: "雷神の一撃" },
  { value: "punch", label: "超パンチ" },
  // 2026-09 追加分
  { value: "sankaku", label: "三角くじ" },
  { value: "ema", label: "絵馬" },
  { value: "kagamibiraki", label: "鏡開き" },
  { value: "xmas", label: "クリスマス" },
  { value: "vending", label: "自動販売機" },
  { value: "receipt", label: "レシート" },
  { value: "ring", label: "輪投げ" },
  { value: "safe", label: "金庫" },
  { value: "fukubukuro", label: "福袋" },
  { value: "sakura", label: "桜" },
  { value: "mamemaki", label: "豆まき" },
  { value: "otoshidama", label: "お年玉" },
  { value: "crane", label: "クレーンゲーム" },
  { value: "mogura", label: "もぐらたたき" },
  { value: "bowling", label: "ボウリング" },
  { value: "makimono", label: "巻物" },
  { value: "shateki", label: "射的" },
  { value: "kingyo", label: "金魚すくい" },
  { value: "kakigori", label: "かき氷" },
  { value: "halloween", label: "ハロウィン" },
  { value: "valentine", label: "バレンタイン" },
  { value: "tanabata", label: "七夕" },
  { value: "sushi", label: "回転寿司" },
  { value: "taiyaki", label: "たい焼き" },
];

export type ServiceTag = "fukubiku" | "attend";

// あてんどのオブジェクトは「個別案件(特定クライアント向けの単発カスタム施策)」と
// 「サービスメニュー(複数クライアントへ横展開する定型施策)」で管理を分けたいという要望に対応。
// fukubiku側では使用しない(null)。
export type AttendPresetGroup = "project" | "menu";

export const ATTEND_PRESET_GROUPS: { value: AttendPresetGroup; label: string; hint: string }[] = [
  {
    value: "project",
    label: "個別案件",
    hint: "特定クライアント向けの単発カスタム施策（例: このクライアント専用のアクリルスタンド）",
  },
  {
    value: "menu",
    label: "サービスメニュー",
    hint: "複数クライアントへ横展開する定型サービス施策（例: アクリルスタンド→XR表示 のパッケージ）",
  },
];

export interface PresetObject {
  id: string;
  name: string;
  category: string | null;
  group_type: AttendPresetGroup | null;
  model_url: string;
  thumbnail_url: string | null;
  /** 表示オブジェクトの拡大率(A-Frameのscale属性値、例: "1 1 1")。
   * 管理画面(表示オブジェクト管理)から設定する。未設定(null)ならアプリ側の既定値を使う。 */
  scale: string | null;
  /** 表示オブジェクトの向き(A-Frameのrotation属性値、例: "0 180 0")。
   * マーカーに対してオブジェクトの正面が向くように調整するために使う。 */
  rotation: string | null;
  /** 表示オブジェクトの位置(A-Frameのposition属性値、例: "0 0.5 0")。
   * マーカー面からの浮き沈みを調整するために使う。 */
  position: string | null;
  service: ServiceTag | null;
  created_at: string;
}

// ---- 抽選セット (draw_groups) ----
// 1つの共有URL(QRコード)に対して、アクセスの都度サーバーがweightに従って
// 結果を抽選するモデル。ordersテーブル(1景品=1固定URL)とは独立して共存する。

// カテゴリでよく使われる景品名の既定の重み(相対値)。テンプレート選択後にこの値を
// プリフィルし、管理画面から自由に上書きできるようにする。合計が100である必要はない。
export const DEFAULT_TIER_WEIGHTS: Record<string, number> = {
  "1等": 1,
  "2等": 2,
  "3等": 3,
  "4等": 5,
  "5等": 8,
  "6等": 12,
  "大当たり": 1,
  "当たり": 9,
  "クーポン": 20,
  "はずれ": 70,
  "参加賞": 69,
};

export interface DrawGroup {
  id: string;
  hash: string;
  status: "draft" | "ready";

  client_name: string;
  order_date: string;
  due_date: string | null;
  person_in_charge: string | null;
  renewal_check_date: string | null;
  notes: string | null;

  display_type: DisplayType;
  target_image_url: string | null;
  mind_file_url: string | null;

  /** 共有URLの再抽選クールダウン時間(時間単位)。何時間に1回、再抽選させるかを
   * 確率(重み)とは別に抽選セットごとに設定する(lib/drawCooldown.ts参照)。 */
  cooldown_hours: number;

  created_at: string;
  updated_at: string;
}

export interface DrawGroupEntry {
  id: string;
  draw_group_id: string;
  label: string;
  weight: number;

  object_source: ObjectSource;
  preset_object_id: string | null;
  custom_model_url: string | null;

  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  hash: string;
  status: OrderStatus;

  client_name: string;
  order_date: string;
  due_date: string | null;
  person_in_charge: string | null;
  quantity: number | null;
  renewal_check_date: string | null;
  prize_label: string | null;
  notes: string | null;

  display_type: DisplayType;

  object_source: ObjectSource;
  preset_object_id: string | null;
  custom_model_url: string | null;

  target_image_url: string | null;
  mind_file_url: string | null;

  /** 共有URLの再表示クールダウン時間(時間単位)。null なら既定値(DRAW_COOLDOWN_HOURS)、
   * 0 なら制限なし。抽選セット側の draw_groups.cooldown_hours と同じ役割。 */
  cooldown_hours: number | null;

  /** quantity(個数)を「どの期間あたりの上限」とみなすか。
   * "day" | "3days" | "week" | "none"(既定)。lib/drawLimit.ts 参照。 */
  limit_period: string | null;

  created_at: string;
  updated_at: string;
}

// ---- あてんど (Attend) ----

export type AttendDisplayType = "aframe" | "mindar_image" | "mindar_face" | "gps" | "nfc";
export type AttendPlan = "light" | "standard" | "enterprise";
export type AttendProjectStatus = "draft" | "active" | "archived";
export type AttendExperienceStatus = "draft" | "ready";

export const ATTEND_DISPLAY_TYPES: {
  value: AttendDisplayType;
  /** 一覧のバッジなどに出す短い名前 */
  short: string;
  label: string;
  hint: string;
  /** 何をかざす/どこへ行くのか、現場での使われ方 */
  usage: string;
}[] = [
  {
    value: "nfc",
    short: "NFC",
    label: "NFCタグ（かざすだけ）",
    hint: "タグにURLを書き込んでおき、スマホをかざすと開く",
    usage: "マーカーも位置も見ずに、開いた瞬間にカメラ映像の手前へ表示します。",
  },
  {
    value: "gps",
    short: "GPS",
    label: "GPS（その場所へ行く）",
    hint: "指定した緯度経度の半径内に入ると表示",
    usage: "聖地巡礼やスタンプラリー向け。圏外では目的地までの距離を案内します。",
  },
  {
    value: "mindar_image",
    short: "画像認識",
    label: "MindAR（画像認識）",
    hint: "任意の画像を登録して、その絵柄にかざすと表示",
    usage: "ポスター・パッケージ・カードなど、絵柄そのものを目印にします。",
  },
  {
    value: "aframe",
    short: "マーカー",
    label: "AR.js（白黒マーカー）",
    hint: ".pattマーカーにかざすと表示",
    usage: "専用の白黒マーカーを印刷して使う方式。認識が軽く安定します。",
  },
  {
    value: "mindar_face",
    short: "顔",
    label: "MindAR（顔認識）",
    hint: "インカメラで顔のパーツを起点に表示",
    usage: "顔にお面やエフェクトを重ねる用途。",
  },
];

/** 一覧のバッジ表示などで使う短い名前。 */
export function attendDisplayTypeShort(v: string | null | undefined): string {
  const found = ATTEND_DISPLAY_TYPES.find((t) => t.value === v);
  return found ? found.short : "未設定";
}

export const ATTEND_PLAN_LIMITS: Record<
  AttendPlan,
  {
    label: string;
    price: string;
    gpsPoints: string;
    arModels: string;
    nfcTags: string;
    analytics: string;
  }
> = {
  light: {
    label: "ライト",
    price: "¥300,000〜",
    gpsPoints: "1〜3拠点",
    arModels: "1点",
    nfcTags: "50枚",
    analytics: "なし",
  },
  standard: {
    label: "スタンダード",
    price: "¥800,000〜",
    gpsPoints: "最大10拠点",
    arModels: "最大5種",
    nfcTags: "100枚",
    analytics: "あり",
  },
  enterprise: {
    label: "エンタープライズ",
    price: "個別見積",
    gpsPoints: "無制限",
    arModels: "フルカスタム",
    nfcTags: "1,000枚〜",
    analytics: "詳細解析",
  },
};

// MindAR Face の主なアンカー候補（MediaPipe FaceMeshランドマーク番号）
export const FACE_ANCHOR_PRESETS: { value: number; label: string }[] = [
  { value: 10, label: "額" },
  { value: 1, label: "鼻先" },
  { value: 152, label: "顎" },
  { value: 234, label: "左頬" },
  { value: 454, label: "右頬" },
  { value: 168, label: "両目の間" },
];

export interface AttendProject {
  id: string;
  client_name: string;
  order_date: string;
  due_date: string | null;
  person_in_charge: string | null;
  plan: AttendPlan;
  nfc_tag_total: number | null;
  nfc_tag_used: number;
  notes: string | null;
  status: AttendProjectStatus;
  created_at: string;
  updated_at: string;
}

// あてんどの「アイテム」= 柄・グッズ単位。クライアント提供URLはアイテムに1つ発行される。
// 1アイテムは複数の「発火条件」(attend_triggers)を持て、
// 例えば同じキーホルダーで「画像トラッキング」と「GPS」の両方を用意できる。
export interface AttendItem {
  id: string;
  project_id: string;
  name: string;
  hash: string;
  status: AttendExperienceStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 発火条件。1つのアイテムに複数持てる。
export interface AttendTrigger {
  id: string;
  item_id: string;
  label: string | null;
  display_type: AttendDisplayType;

  marker_url: string | null;
  target_image_url: string | null;
  mind_file_url: string | null;
  face_anchor_index: number | null;

  // マーカーライブラリ(attend_markers)のどのマーカーを使っているか。
  // mindar_imageで複数画像セットのマーカーを使う場合、対象画像の解決に必要。
  marker_id: string | null;

  gps_lat: number | null;
  gps_lng: number | null;
  gps_radius_m: number | null;

  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 表示オブジェクト。1つの発火条件に複数持てる(例: 1つのマーカーに複数キャラクターを配置)。
export interface AttendTriggerObject {
  id: string;
  trigger_id: string;
  object_source: ObjectSource;
  preset_object_id: string | null;
  custom_model_url: string | null;
  position: string;
  scale: string | null;
  rotation_y: number;
  // mindar_imageで複数画像セットのマーカーを使う場合、どの画像(targetIndex)が
  // 検出された時にこのオブジェクトを表示するか。null=常に表示(単一画像時など)。
  target_index: number | null;
  sort_order: number;
  created_at: string;
}

export type AttendTriggerWithObjects = AttendTrigger & { objects: AttendTriggerObject[] };

// マーカー管理（案件ごとのAR.jsマーカー/MindARターゲット画像のライブラリ）。
// 発火条件から選んで使い回せるようにするための、案件に紐づいたマーカーレジストリ。
//
// mindar_imageタイプは、MindARの標準機能である「複数画像を1つの.mindにまとめて同時
// トラッキングする」構成をそのまま使う。1つのattend_markersが「画像セット」を表し、
// 実際の画像は複数枚持てる attend_marker_images に格納、mind_file_url はその画像セット
// 全体をコンパイルした結果(1ファイル)を指す。
export type AttendMarkerType = "aframe" | "mindar_image";

export interface AttendMarkerImage {
  id: string;
  marker_id: string;
  target_index: number;
  name: string | null;
  image_url: string;
  created_at: string;
}

export interface AttendMarker {
  id: string;
  project_id: string;
  type: AttendMarkerType;
  name: string;
  preview_image_url: string | null;
  pattern_file_url: string | null; // aframe用 .patt
  target_image_url: string | null; // 旧: mindar_image単一画像時代の元画像(互換用、新規には使わない)
  mind_file_url: string | null; // mindar_image用: 画像セット全体をコンパイルした.mind
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendMarkerWithImages extends AttendMarker {
  images: AttendMarkerImage[];
}

export interface AttendMarkerWithProject extends AttendMarkerWithImages {
  project_name: string;
}
