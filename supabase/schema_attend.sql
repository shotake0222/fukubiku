-- あてんど（XRコンテンツ配信サービス）用スキーマ
-- 先に schema.sql (fukubiku側) を実行してから、こちらをSupabase SQL Editorで実行してください。
-- assets ストレージバケット・pgcrypto拡張は schema.sql 側で作成済みの前提です。

-- 既存の preset_objects をfukubiku/あてんど間で出し分けられるようにする
alter table preset_objects add column if not exists service text; -- 'fukubiku' | 'attend' | null(共通)

-- 案件（クライアント単位）
create table if not exists attend_projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  order_date date not null default current_date,
  due_date date,
  person_in_charge text,
  plan text not null default 'light' check (plan in ('light', 'standard', 'enterprise')),
  nfc_tag_total integer,          -- NFCタグ発注枚数
  nfc_tag_used integer not null default 0, -- 使用済み(配布済み)枚数
  notes text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists attend_projects_set_updated_at on attend_projects;
create trigger attend_projects_set_updated_at
before update on attend_projects
for each row execute function set_updated_at();

-- 体験（拠点・シーン単位。1案件に複数）
create table if not exists attend_experiences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references attend_projects(id) on delete cascade,

  name text not null,                              -- 拠点名/シーン名（例: 本殿前、作品A）
  hash text not null unique,                        -- クライアント提供URL用 (/a/[hash])
  status text not null default 'draft' check (status in ('draft', 'ready')),

  display_type text not null check (
    display_type in ('aframe', 'mindar_image', 'mindar_face', 'gps')
  ),
  -- aframe        = パターンマーカー(AR.js)
  -- mindar_image  = 画像トラッキング(MindAR)
  -- mindar_face   = 顔認識AR(MindAR Face)
  -- gps           = GPS位置トリガー(AR.js location-based)

  object_source text not null default 'preset' check (object_source in ('preset', 'upload')),
  preset_object_id uuid references preset_objects(id),
  custom_model_url text,

  marker_url text,           -- aframeの場合の.pattファイル(未指定ならfukubiku共通の既定マーカーを使用)
  target_image_url text,     -- mindar_imageの場合の元画像
  mind_file_url text,        -- mindar_imageの場合のコンパイル済み.mindファイル
  face_anchor_index integer default 10, -- mindar_faceの場合のアンカー(MediaPipe FaceMeshランドマーク番号。例: 10=額, 1=鼻先, 152=顎, 234=左頬, 454=右頬)

  gps_lat double precision,  -- gpsの場合の緯度
  gps_lng double precision,  -- gpsの場合の経度
  gps_radius_m integer default 20, -- 起動半径(メートル)

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_experiences_project_idx on attend_experiences (project_id);
create index if not exists attend_experiences_hash_idx on attend_experiences (hash);

drop trigger if exists attend_experiences_set_updated_at on attend_experiences;
create trigger attend_experiences_set_updated_at
before update on attend_experiences
for each row execute function set_updated_at();

-- RLS: fukubikuと同様、管理系は認証済みユーザーのみ読み書き可、公開ビューアはservice role経由
alter table attend_projects enable row level security;
alter table attend_experiences enable row level security;

drop policy if exists "authenticated read attend_projects" on attend_projects;
create policy "authenticated read attend_projects" on attend_projects
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_projects" on attend_projects;
create policy "authenticated write attend_projects" on attend_projects
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_experiences" on attend_experiences;
create policy "authenticated read attend_experiences" on attend_experiences
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_experiences" on attend_experiences;
create policy "authenticated write attend_experiences" on attend_experiences
  for all to authenticated using (true) with check (true);
