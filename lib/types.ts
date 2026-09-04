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
  service: ServiceTag | null;
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

  created_at: string;
  updated_at: string;
}

// ---- あてんど (Attend) ----

export type AttendDisplayType = "aframe" | "mindar_image" | "mindar_face" | "gps";
export type AttendPlan = "light" | "standard" | "enterprise";
export type AttendProjectStatus = "draft" | "active" | "archived";
export type AttendExperienceStatus = "draft" | "ready";

export const ATTEND_DISPLAY_TYPES: { value: AttendDisplayType; label: string; hint: string }[] = [
  { value: "aframe", label: "A-Frame（マーカー画像）", hint: "AR.jsパターンマーカーでトラッキング" },
  { value: "mindar_image", label: "MindAR（画像認識）", hint: "任意の画像をアップロードしてコンパイル" },
  { value: "mindar_face", label: "MindAR（顔認識）", hint: "顔のパーツを起点にARを表示" },
  { value: "gps", label: "GPS位置トリガー", hint: "指定した緯度経度に近づくとARが起動" },
];

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
  sort_order: number;
  created_at: string;
}

export type AttendTriggerWithObjects = AttendTrigger & { objects: AttendTriggerObject[] };
