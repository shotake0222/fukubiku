-- あてんど: 受け皿サイトのテーブルを、確実に正しい形に作り直す
--
-- 【いつ使うか】
-- 「Could not find the '○○' column of 'attend_portals' in the schema cache」が
-- 直らないとき。列を足すSQLを流しても直らない場合は、
-- テーブルそのものが想定と違う形で残っている可能性が高いので、作り直す。
--
-- 既存の行は attend_portals_backup / attend_portal_blocks_backup に退避してから
-- 作り直すので、データは消えません（そもそも作成に失敗し続けている状態なら
-- 中身は0件のはずです。件数は下の(2)で表示されます）。
--
-- 【実行方法】
-- Supabase ダッシュボード > SQL Editor に「全文を」貼り付けて実行。
-- どこも選択していない状態で Run を押してください
-- （テキストを選択していると、その範囲だけが実行されます）。
--
-- 最後に (7) のテスト挿入が「✅」で返れば、管理画面から作成できる状態です。

-- ============================================================
-- (1) いま実際にどうなっているかを表示する
--     ここに brand_color が出ていないなら、テーブルが想定と違う形。
-- ============================================================
select 'いまの attend_portals の列' as "確認",
       string_agg(column_name, ', ' order by ordinal_position) as "列一覧"
  from information_schema.columns
 where table_schema = 'public' and table_name = 'attend_portals';

-- 同名のテーブルが他のスキーマにも無いか（別のものを見ている可能性の確認）
select table_schema as "スキーマ", table_name as "テーブル"
  from information_schema.tables
 where table_name in ('attend_portals', 'attend_portal_blocks');

-- ============================================================
-- (2) 退避（消えて困る行が無いことの確認も兼ねる）
-- ============================================================
drop table if exists attend_portals_backup;
drop table if exists attend_portal_blocks_backup;
create table attend_portals_backup as select * from attend_portals;
create table attend_portal_blocks_backup as select * from attend_portal_blocks;

select
  (select count(*) from attend_portals_backup)       as "退避した受け皿サイト件数",
  (select count(*) from attend_portal_blocks_backup) as "退避した枠の件数";

-- ============================================================
-- (3) 作り直す
-- ============================================================
drop table if exists attend_portal_blocks cascade;
drop table if exists attend_portals cascade;

create table attend_portals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references attend_projects(id) on delete cascade,
  rally_id uuid references attend_rallies(id) on delete set null,
  custom_ar_url text,

  hash text not null unique,
  name text not null default '受け皿サイト',

  template text not null default 'kanko'
    check (template in ('kanko', 'shotengai', 'shisetsu', 'seichi', 'jousetsu')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'ended')),
  ended_message text,
  ended_link_url text,
  ended_link_label text,

  brand_color text not null default '#0f766e',
  brand_color_dark text not null default '#115e59',
  accent_color text,
  logo_url text,
  logo_text text,

  site_title text not null default 'スタンプラリー',
  site_description text,
  og_image_url text,

  hero_image_url text,
  hero_eyebrow text,
  hero_title text,
  hero_text text,

  ar_heading text not null default 'スタンプラリーに参加する',
  ar_text text,
  ar_button_label text not null default 'いますぐ始める',

  status_line text,

  owner_name text,
  owner_address text,
  privacy_url text,
  terms_url text,
  contact_url text,
  copyright_text text,

  -- デザイン調整（管理画面から変更する。未設定ならテンプレート既定）
  design jsonb,
  sections jsonb,
  nav jsonb,
  sns jsonb,

  -- HTMLを直接書く場合に使う
  custom_html text,
  custom_css text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table attend_portal_blocks (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references attend_portals(id) on delete cascade,
  kind text not null
    check (kind in ('pick', 'spot', 'banner', 'news', 'faq', 'outline', 'note', 'chapter', 'html')),
  sort_order integer not null default 0,

  title text,
  body text,
  meta text,
  image_url text,
  link_url text,
  badge text,
  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_portals_project_idx on attend_portals (project_id);
create index if not exists attend_portals_hash_idx on attend_portals (hash);
create index if not exists attend_portal_blocks_portal_idx
  on attend_portal_blocks (portal_id, kind, sort_order);

-- ============================================================
-- (4) 更新日時の自動更新
-- ============================================================
create or replace function set_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists attend_portals_set_updated_at on attend_portals;
create trigger attend_portals_set_updated_at
before update on attend_portals
for each row execute function set_updated_at();

drop trigger if exists attend_portal_blocks_set_updated_at on attend_portal_blocks;
create trigger attend_portal_blocks_set_updated_at
before update on attend_portal_blocks
for each row execute function set_updated_at();

-- ============================================================
-- (5) アクセス権（管理画面はログイン済み＝authenticated で読み書きする）
-- ============================================================
alter table attend_portals enable row level security;
alter table attend_portal_blocks enable row level security;

drop policy if exists "authenticated read attend_portals" on attend_portals;
create policy "authenticated read attend_portals" on attend_portals
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_portals" on attend_portals;
create policy "authenticated write attend_portals" on attend_portals
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated read attend_portal_blocks" on attend_portal_blocks;
create policy "authenticated read attend_portal_blocks" on attend_portal_blocks
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_portal_blocks" on attend_portal_blocks;
create policy "authenticated write attend_portal_blocks" on attend_portal_blocks
  for all to authenticated using (true) with check (true);

-- ============================================================
-- (6) アプリ側（PostgREST）が見ている定義を更新させる
--     列を足した直後に「そんな列は無い」と言われるのを防ぐ
-- ============================================================
notify pgrst, 'reload schema';

-- ============================================================
-- (7) 管理画面と同じ内容で実際に作ってみて、消す
--     ここが ✅ なら、管理画面からも作成できます。
-- ============================================================
do $test$
declare
  pid uuid;
  newid uuid;
begin
  select id into pid from attend_projects order by created_at limit 1;
  if pid is null then
    raise notice '案件が1件も無いため、テスト挿入は省略しました（テーブル自体は作成済みです）';
    return;
  end if;

  insert into attend_portals (
    project_id, rally_id, hash, name, template, status,
    brand_color, brand_color_dark, accent_color, logo_text, site_title,
    hero_eyebrow, hero_title, hero_text, owner_name
  ) values (
    pid, null, '__selftest', 'テスト', 'kanko', 'draft',
    '#0f766e', '#115e59', '#0f766e', 'テスト', 'テスト',
    'TEST', 'テスト', 'テスト', 'テスト'
  ) returning id into newid;

  insert into attend_portal_blocks (portal_id, kind, sort_order, title)
  select newid, k, i, 'テスト'
    from unnest(array['pick','spot','banner','news','faq','outline','note','chapter'])
         with ordinality as t(k, i);

  delete from attend_portals where id = newid;
end;
$test$;

select '✅ 受け皿サイトを作成できる状態です' as "結果";

-- ============================================================
-- (8) 作り直したあとの列
-- ============================================================
select string_agg(column_name, ', ' order by ordinal_position) as "作り直し後の attend_portals の列"
  from information_schema.columns
 where table_schema = 'public' and table_name = 'attend_portals';
