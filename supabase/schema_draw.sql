-- fukubiku 抽選セット(確率抽選)機能のスキーマ追加。
-- Supabase ダッシュボード > SQL Editor で、schema.sql の後に実行してください。
--
-- 背景: 従来のordersテーブルは「1景品=1固定URL」で、確率は物理的な印刷枚数の比率で
-- 表現するモデルだった。この draw_groups / draw_group_entries は、1つの共有URL(QRコード)
-- に対してアクセスの都度サーバーが weight(重み)に従って抽選するモデルを追加するもの。
-- 既存のorders/個別注文の仕組みとは独立して共存する(置き換えではない)。

create table if not exists draw_groups (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  status text not null default 'draft' check (status in ('draft', 'ready')),

  client_name text not null,
  order_date date not null default current_date,
  due_date date,
  person_in_charge text,
  renewal_check_date date,
  notes text,

  display_type text not null check (display_type in ('aframe', 'mindar')),
  target_image_url text,   -- MindAR: 元画像
  mind_file_url text,      -- MindAR: コンパイル済み.mindファイル(抽選セット全体で共有の1つのマーカー)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists draw_groups_hash_idx on draw_groups (hash);

-- 抽選の各選択肢(景品)。weightは相対的な重みで、合計に対する比率で抽選される
-- (合計100である必要はない。例: 1等=1, 2等=2, 参加賞=90 のように相対値でよい)。
create table if not exists draw_group_entries (
  id uuid primary key default gen_random_uuid(),
  draw_group_id uuid not null references draw_groups(id) on delete cascade,
  label text not null,
  weight numeric not null default 1 check (weight >= 0),

  object_source text not null default 'preset' check (object_source in ('preset', 'upload')),
  preset_object_id uuid references preset_objects(id),
  custom_model_url text,

  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists draw_group_entries_group_idx on draw_group_entries (draw_group_id);

drop trigger if exists draw_groups_set_updated_at on draw_groups;
create trigger draw_groups_set_updated_at
before update on draw_groups
for each row execute function set_updated_at();

alter table draw_groups enable row level security;
alter table draw_group_entries enable row level security;

drop policy if exists "authenticated read draw_groups" on draw_groups;
create policy "authenticated read draw_groups" on draw_groups
  for select to authenticated using (true);
drop policy if exists "authenticated write draw_groups" on draw_groups;
create policy "authenticated write draw_groups" on draw_groups
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read draw_group_entries" on draw_group_entries;
create policy "authenticated read draw_group_entries" on draw_group_entries
  for select to authenticated using (true);
drop policy if exists "authenticated write draw_group_entries" on draw_group_entries;
create policy "authenticated write draw_group_entries" on draw_group_entries
  for all to authenticated using (true) with check (true);
