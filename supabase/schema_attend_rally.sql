-- あてんど: スタンプラリー用スキーマ
--
-- 「設定したスポットを見に行くとスタンプが貯まるWebApp」を、案件ごとに
-- 何本でも発行できるようにする。参加者は /r/[hash] を開くだけで参加でき、
-- アカウント登録は不要（匿名の参加者IDをCookieで発行し、進捗はサーバーに保存）。
--
-- 先に schema.sql → schema_attend.sql を実行してから、こちらを実行してください。
-- 何度実行しても壊れません(冪等)。

-- ラリー本体（1案件に複数本。例: 「春の門前町めぐり」「夏の夜市スタンプ」）
create table if not exists attend_rallies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references attend_projects(id) on delete cascade,
  name text not null,
  hash text not null unique,          -- 参加者向けURL (/r/[hash])
  description text,                   -- トップに出す説明文
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),

  -- コンプリートに必要なスタンプ数。null なら「全スポット」。
  -- 「スタンプの個数」は スポットを増減する = 総数、required_count = 達成ライン。
  required_count integer,

  starts_at timestamptz,
  ends_at timestamptz,

  -- 見た目のテーマ（参加者画面の配色）
  theme text not null default 'washi' check (theme in ('washi', 'night', 'pop')),

  -- 特典1: 引換コード（コンプリート時に発行。窓口で提示して景品交換）
  reward_coupon_enabled boolean not null default true,
  reward_coupon_label text not null default '記念品引換',
  reward_coupon_note text,

  -- 特典2: 記念ARオブジェクト（コンプリート時だけ出るスペシャル）
  reward_object_source text check (reward_object_source in ('preset', 'upload')),
  reward_preset_object_id uuid references preset_objects(id),
  reward_custom_model_url text,
  reward_message text not null default 'コンプリートおめでとうございます！',

  -- 引換窓口で「使用済み」にする時に入力する暗証番号（スタッフのみが知る4〜8桁）。
  -- 参加者の画面には絶対に送らない。
  staff_pin text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_rallies_project_idx on attend_rallies (project_id);
create index if not exists attend_rallies_hash_idx on attend_rallies (hash);

drop trigger if exists attend_rallies_set_updated_at on attend_rallies;
create trigger attend_rallies_set_updated_at
before update on attend_rallies
for each row execute function set_updated_at();

-- スポット（スタンプ1個ぶん）
--
-- 取得方法は次の4つで、どれで押しても同じ1個のスタンプになる:
--   GPS  … 座標の半径内に入る（屋外向け・自動）
--   QR   … スタンプ台に掲示したQRを読む   ┐ どちらも /r/[hash]?s=<spot_code> を開くだけなので
--   NFC  … スタンプ台に貼ったタグにかざす ┘ 同じ spot_code を使う
--   コード … 台紙に印字した合言葉を手入力（電波が無い屋内の保険）
create table if not exists attend_rally_spots (
  id uuid primary key default gen_random_uuid(),
  rally_id uuid not null references attend_rallies(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,

  gps_enabled boolean not null default true,
  gps_lat double precision,
  gps_lng double precision,
  gps_radius_m integer not null default 30,

  -- 合言葉/QR/NFC 共通の識別子。ラリー内で一意。
  spot_code text,
  code_enabled boolean not null default true,   -- 手入力を受け付けるか

  -- スポットで表示するARオブジェクト
  object_source text not null default 'preset' check (object_source in ('preset', 'upload')),
  preset_object_id uuid references preset_objects(id),
  custom_model_url text,
  position text not null default '0 0 0',
  scale text,
  rotation_y integer not null default 0,

  -- スタンプ帳に押される見た目
  stamp_label text,                                  -- 未指定なら名前の先頭2文字
  stamp_color text not null default '#c0392b',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_rally_spots_rally_idx on attend_rally_spots (rally_id, sort_order);
create unique index if not exists attend_rally_spots_code_idx
  on attend_rally_spots (rally_id, spot_code) where spot_code is not null;

drop trigger if exists attend_rally_spots_set_updated_at on attend_rally_spots;
create trigger attend_rally_spots_set_updated_at
before update on attend_rally_spots
for each row execute function set_updated_at();

-- 参加者（匿名）。idはCookieに入れる。restore_codeは機種変更時の引き継ぎ用。
create table if not exists attend_rally_participants (
  id uuid primary key default gen_random_uuid(),
  rally_id uuid not null references attend_rallies(id) on delete cascade,
  restore_code text not null,
  nickname text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists attend_rally_participants_code_idx
  on attend_rally_participants (rally_id, restore_code);
create index if not exists attend_rally_participants_rally_idx
  on attend_rally_participants (rally_id);

-- 獲得したスタンプ。同じスポットは1回まで(ユニーク制約でDB側から保証)。
create table if not exists attend_rally_stamps (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references attend_rally_participants(id) on delete cascade,
  spot_id uuid not null references attend_rally_spots(id) on delete cascade,
  method text not null check (method in ('gps', 'qr', 'nfc', 'code', 'manual')),
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now()
);

create unique index if not exists attend_rally_stamps_unique_idx
  on attend_rally_stamps (participant_id, spot_id);
create index if not exists attend_rally_stamps_spot_idx on attend_rally_stamps (spot_id);

-- コンプリート特典の引換コード。1参加者につき1枚。
create table if not exists attend_rally_rewards (
  id uuid primary key default gen_random_uuid(),
  rally_id uuid not null references attend_rallies(id) on delete cascade,
  participant_id uuid not null references attend_rally_participants(id) on delete cascade,
  coupon_code text not null,
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_note text
);

create unique index if not exists attend_rally_rewards_participant_idx
  on attend_rally_rewards (participant_id);
create unique index if not exists attend_rally_rewards_code_idx
  on attend_rally_rewards (rally_id, coupon_code);

-- RLS
-- 管理系(rallies/spots)は認証済みユーザーが読み書き。
-- 参加者データ(participants/stamps/rewards)は、公開APIからは service role 経由でのみ
-- 触るため anon には一切開けず、管理画面から集計を見るために authenticated の read だけ許す。
alter table attend_rallies enable row level security;
alter table attend_rally_spots enable row level security;
alter table attend_rally_participants enable row level security;
alter table attend_rally_stamps enable row level security;
alter table attend_rally_rewards enable row level security;

drop policy if exists "authenticated read attend_rallies" on attend_rallies;
create policy "authenticated read attend_rallies" on attend_rallies
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_rallies" on attend_rallies;
create policy "authenticated write attend_rallies" on attend_rallies
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_rally_spots" on attend_rally_spots;
create policy "authenticated read attend_rally_spots" on attend_rally_spots
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_rally_spots" on attend_rally_spots;
create policy "authenticated write attend_rally_spots" on attend_rally_spots
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_rally_participants" on attend_rally_participants;
create policy "authenticated read attend_rally_participants" on attend_rally_participants
  for select to authenticated using (true);

drop policy if exists "authenticated read attend_rally_stamps" on attend_rally_stamps;
create policy "authenticated read attend_rally_stamps" on attend_rally_stamps
  for select to authenticated using (true);

drop policy if exists "authenticated read attend_rally_rewards" on attend_rally_rewards;
create policy "authenticated read attend_rally_rewards" on attend_rally_rewards
  for select to authenticated using (true);
-- 引換窓口(管理画面)から「使用済み」に更新する。
drop policy if exists "authenticated update attend_rally_rewards" on attend_rally_rewards;
create policy "authenticated update attend_rally_rewards" on attend_rally_rewards
  for update to authenticated using (true) with check (true);
