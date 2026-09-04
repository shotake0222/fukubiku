-- fukubiku 管理ツール: Supabase スキーマ定義
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。

create extension if not exists pgcrypto;

-- プリセット表示オブジェクト（3Dモデルのライブラリ）
create table if not exists preset_objects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,                -- amida | box | darts | garagara | omikuji | scratch | 任意の文字列
  model_url text not null,      -- glb/gltf/gif/mp4 などアセットの公開URL
  thumbnail_url text,
  created_at timestamptz not null default now()
);

-- 既存環境向け: 既にテーブルが存在していた場合にcategory列を追加する
alter table preset_objects add column if not exists category text;

-- 注文
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,                     -- クライアント提供URLに使うハッシュ
  status text not null default 'draft'            -- draft | compiling | ready
    check (status in ('draft', 'compiling', 'ready')),

  client_name text not null,
  order_date date not null default current_date,
  due_date date,                                   -- 納期
  person_in_charge text,                           -- 担当者
  quantity integer,                                -- 個数
  renewal_check_date date,                         -- 延長確認日（1年契約の3ヶ月前を目安）
  prize_label text,                                -- 景品名(1等/はずれ等、一括作成で使用)
  notes text,

  display_type text not null check (display_type in ('aframe', 'mindar')),

  object_source text not null default 'preset' check (object_source in ('preset', 'upload')),
  preset_object_id uuid references preset_objects(id),
  custom_model_url text,                           -- object_source = 'upload' の場合の独自glb

  target_image_url text,                           -- MindAR: 元画像
  mind_file_url text,                              -- MindAR: コンパイル済み.mindファイル

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_hash_idx on orders (hash);

-- 既存環境向け: 既にテーブルが存在していた場合にprize_label列を追加する
alter table orders add column if not exists prize_label text;

-- updated_at 自動更新
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

-- RLS: 通常のクライアント(anon)からは直接読めない/書けないようにする。
-- 管理画面・公開ビューアはいずれもサーバー側(service role)経由でアクセスする。
alter table orders enable row level security;
alter table preset_objects enable row level security;

-- 認証済みユーザー（管理者アカウント）は読み書き可能
drop policy if exists "authenticated read orders" on orders;
create policy "authenticated read orders" on orders
  for select to authenticated using (true);
drop policy if exists "authenticated write orders" on orders;
create policy "authenticated write orders" on orders
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read preset_objects" on preset_objects;
create policy "authenticated read preset_objects" on preset_objects
  for select to authenticated using (true);
drop policy if exists "authenticated write preset_objects" on preset_objects;
create policy "authenticated write preset_objects" on preset_objects
  for all to authenticated using (true) with check (true);

-- ==========================================================
-- Storage: 3Dモデル・画像・コンパイル済み.mindファイル置き場
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- 誰でも読み取り可能（AR表示にはブラウザから直接アセットを取得するため）
drop policy if exists "public read assets" on storage.objects;
create policy "public read assets" on storage.objects
  for select using (bucket_id = 'assets');

-- 書き込みは認証済み管理者のみ
drop policy if exists "authenticated write assets" on storage.objects;
create policy "authenticated write assets" on storage.objects
  for insert to authenticated with check (bucket_id = 'assets');

drop policy if exists "authenticated update assets" on storage.objects;
create policy "authenticated update assets" on storage.objects
  for update to authenticated using (bucket_id = 'assets');

drop policy if exists "authenticated delete assets" on storage.objects;
create policy "authenticated delete assets" on storage.objects
  for delete to authenticated using (bucket_id = 'assets');
