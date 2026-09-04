-- あてんど（XRコンテンツ配信サービス）用スキーマ (v2)
-- 1アイテム(柄・グッズ)に複数の発火条件(画像トラッキング+GPSなど)を持たせ、
-- 各発火条件に複数の表示オブジェクトを持たせられる構造にしています。
--
-- 先に schema.sql (fukubiku側) を実行してから、こちらをSupabase SQL Editorで実行してください。
-- 以前のバージョン(attend_experiencesに直接display_type等を持たせる構造)を既に実行済みでも、
-- このSQLはそのデータを新構造(attend_items / attend_triggers / attend_trigger_objects)へ
-- 安全に移行したうえで実行できます(再実行しても壊れません)。

alter table preset_objects add column if not exists service text; -- 'fukubiku' | 'attend' | null(共通)

-- 案件（クライアント単位）
create table if not exists attend_projects (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  order_date date not null default current_date,
  due_date date,
  person_in_charge text,
  plan text not null default 'light' check (plan in ('light', 'standard', 'enterprise')),
  nfc_tag_total integer,
  nfc_tag_used integer not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists attend_projects_set_updated_at on attend_projects;
create trigger attend_projects_set_updated_at
before update on attend_projects
for each row execute function set_updated_at();

-- 旧テーブル名からのリネーム（既に attend_experiences として作成済みの場合のみ実行される）
alter table if exists attend_experiences rename to attend_items;
drop trigger if exists attend_experiences_set_updated_at on attend_items;
drop policy if exists "authenticated read attend_experiences" on attend_items;
drop policy if exists "authenticated write attend_experiences" on attend_items;
drop index if exists attend_experiences_project_idx;
drop index if exists attend_experiences_hash_idx;

-- アイテム（柄・グッズ単位。クライアント提供URLはここに1つ発行される）
create table if not exists attend_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references attend_projects(id) on delete cascade,
  name text not null,                -- 柄・グッズ名（例: コースターA、キーホルダーB）
  hash text not null unique,         -- クライアント提供URL用 (/a/[hash])
  status text not null default 'draft' check (status in ('draft', 'ready')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_items_project_idx on attend_items (project_id);
create index if not exists attend_items_hash_idx on attend_items (hash);

drop trigger if exists attend_items_set_updated_at on attend_items;
create trigger attend_items_set_updated_at
before update on attend_items
for each row execute function set_updated_at();

-- 発火条件（1アイテムに複数持てる。例: 画像トラッキングとGPSの二本立て）
create table if not exists attend_triggers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references attend_items(id) on delete cascade,
  label text,                -- 管理用の任意ラベル（例: "本殿前GPS", "キーホルダー画像認識"）
  display_type text not null check (
    display_type in ('aframe', 'mindar_image', 'mindar_face', 'gps')
  ),
  marker_url text,
  target_image_url text,
  mind_file_url text,
  face_anchor_index integer default 10,
  gps_lat double precision,
  gps_lng double precision,
  gps_radius_m integer default 20,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_triggers_item_idx on attend_triggers (item_id);

drop trigger if exists attend_triggers_set_updated_at on attend_triggers;
create trigger attend_triggers_set_updated_at
before update on attend_triggers
for each row execute function set_updated_at();

-- 旧構造(attend_itemsに直接display_type等を持たせていた場合)からのデータ移行
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attend_items' and column_name = 'display_type'
  ) then
    insert into attend_triggers (item_id, display_type, marker_url, target_image_url, mind_file_url, face_anchor_index, gps_lat, gps_lng, gps_radius_m, sort_order)
    select id, display_type, marker_url, target_image_url, mind_file_url, face_anchor_index, gps_lat, gps_lng, gps_radius_m, 0
    from attend_items;
  end if;
end $$;

-- 表示オブジェクト（1発火条件に複数持てる。例: 1つのマーカーに複数キャラクターを配置）
create table if not exists attend_trigger_objects (
  id uuid primary key default gen_random_uuid(),
  trigger_id uuid not null references attend_triggers(id) on delete cascade,
  object_source text not null default 'preset' check (object_source in ('preset', 'upload')),
  preset_object_id uuid references preset_objects(id),
  custom_model_url text,
  position text not null default '0 0.6 0',  -- "x y z" (a-entityのposition属性値)
  scale text,                                -- 未指定時はコンポーネント側の既定値を使用
  rotation_y integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists attend_trigger_objects_trigger_idx on attend_trigger_objects (trigger_id);

-- 旧構造(attend_itemsに直接preset_object_id等を持たせていた場合)からのデータ移行
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'attend_items' and column_name = 'object_source'
  ) then
    insert into attend_trigger_objects (trigger_id, object_source, preset_object_id, custom_model_url, sort_order)
    select t.id, i.object_source, i.preset_object_id, i.custom_model_url, 0
    from attend_items i
    join attend_triggers t on t.item_id = i.id;
  end if;
end $$;

-- 旧カラムの削除（移行後は attend_triggers / attend_trigger_objects 側で管理）
alter table attend_items
  drop column if exists display_type,
  drop column if exists object_source,
  drop column if exists preset_object_id,
  drop column if exists custom_model_url,
  drop column if exists marker_url,
  drop column if exists target_image_url,
  drop column if exists mind_file_url,
  drop column if exists face_anchor_index,
  drop column if exists gps_lat,
  drop column if exists gps_lng,
  drop column if exists gps_radius_m;

-- RLS: 管理系は認証済みユーザーのみ読み書き可、公開ビューアはservice role経由
alter table attend_projects enable row level security;
alter table attend_items enable row level security;
alter table attend_triggers enable row level security;
alter table attend_trigger_objects enable row level security;

drop policy if exists "authenticated read attend_projects" on attend_projects;
create policy "authenticated read attend_projects" on attend_projects
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_projects" on attend_projects;
create policy "authenticated write attend_projects" on attend_projects
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_items" on attend_items;
create policy "authenticated read attend_items" on attend_items
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_items" on attend_items;
create policy "authenticated write attend_items" on attend_items
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_triggers" on attend_triggers;
create policy "authenticated read attend_triggers" on attend_triggers
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_triggers" on attend_triggers;
create policy "authenticated write attend_triggers" on attend_triggers
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_trigger_objects" on attend_trigger_objects;
create policy "authenticated read attend_trigger_objects" on attend_trigger_objects
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_trigger_objects" on attend_trigger_objects;
create policy "authenticated write attend_trigger_objects" on attend_trigger_objects
  for all to authenticated using (true) with check (true);
