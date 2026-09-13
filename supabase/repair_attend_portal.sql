-- あてんど: 受け皿サイトのテーブルに足りない列を補う（修復用）
--
-- 【なぜ必要か】
-- schema_attend_portal.sql は create table if not exists で書かれていた。
-- この書き方は「テーブルが既にあれば中身を一切確認せず素通りする」ため、
-- 以前のバージョンで作られたテーブルが残っていると、
-- 何度流し直しても列は増えない。
-- 実際に「attend_portals はあるのに accent_color が無い」状態が発生した。
--
-- このSQLは、あるべき列を1つずつ add column if not exists で補う。
-- すでにある列は何も起きない。何度実行しても安全。
--
-- 【実行方法】Supabase ダッシュボード > SQL Editor に全文を貼り付けて実行。

-- ============================================================
-- 1) attend_portals
-- ============================================================
alter table attend_portals add column if not exists rally_id uuid references attend_rallies(id) on delete set null;
alter table attend_portals add column if not exists custom_ar_url text;
alter table attend_portals add column if not exists name text not null default '受け皿サイト';
alter table attend_portals add column if not exists template text not null default 'kanko';
alter table attend_portals add column if not exists status text not null default 'draft';
alter table attend_portals add column if not exists ended_message text;
alter table attend_portals add column if not exists ended_link_url text;
alter table attend_portals add column if not exists ended_link_label text;

alter table attend_portals add column if not exists brand_color text not null default '#0f766e';
alter table attend_portals add column if not exists brand_color_dark text not null default '#115e59';
alter table attend_portals add column if not exists accent_color text;
alter table attend_portals add column if not exists logo_url text;
alter table attend_portals add column if not exists logo_text text;

alter table attend_portals add column if not exists site_title text not null default 'スタンプラリー';
alter table attend_portals add column if not exists site_description text;
alter table attend_portals add column if not exists og_image_url text;

alter table attend_portals add column if not exists hero_image_url text;
alter table attend_portals add column if not exists hero_eyebrow text;
alter table attend_portals add column if not exists hero_title text;
alter table attend_portals add column if not exists hero_text text;

alter table attend_portals add column if not exists ar_heading text not null default 'スタンプラリーに参加する';
alter table attend_portals add column if not exists ar_text text;
alter table attend_portals add column if not exists ar_button_label text not null default 'いますぐ始める';

alter table attend_portals add column if not exists status_line text;

alter table attend_portals add column if not exists owner_name text;
alter table attend_portals add column if not exists owner_address text;
alter table attend_portals add column if not exists privacy_url text;
alter table attend_portals add column if not exists terms_url text;
alter table attend_portals add column if not exists contact_url text;
alter table attend_portals add column if not exists copyright_text text;
alter table attend_portals add column if not exists custom_html text;
alter table attend_portals add column if not exists custom_css text;

alter table attend_portals add column if not exists created_at timestamptz not null default now();
alter table attend_portals add column if not exists updated_at timestamptz not null default now();

-- デザイン調整（add_portal_design.sql と同じもの。ここでもまとめて足しておく）
alter table attend_portals add column if not exists design jsonb;
alter table attend_portals add column if not exists sections jsonb;
alter table attend_portals add column if not exists nav jsonb;
alter table attend_portals add column if not exists sns jsonb;

-- CHECK制約は「後から列を足した場合」には付いていないので、貼り直す。
alter table attend_portals drop constraint if exists attend_portals_template_check;
alter table attend_portals add constraint attend_portals_template_check
  check (template in ('kanko', 'shotengai', 'shisetsu', 'seichi', 'jousetsu'));

alter table attend_portals drop constraint if exists attend_portals_status_check;
alter table attend_portals add constraint attend_portals_status_check
  check (status in ('draft', 'published', 'ended'));

-- hash は必須かつ重複不可
create unique index if not exists attend_portals_hash_key on attend_portals (hash);

-- ============================================================
-- 2) attend_portal_blocks
-- ============================================================
alter table attend_portal_blocks add column if not exists sort_order integer not null default 0;
alter table attend_portal_blocks add column if not exists title text;
alter table attend_portal_blocks add column if not exists body text;
alter table attend_portal_blocks add column if not exists meta text;
alter table attend_portal_blocks add column if not exists image_url text;
alter table attend_portal_blocks add column if not exists link_url text;
alter table attend_portal_blocks add column if not exists badge text;
alter table attend_portal_blocks add column if not exists enabled boolean not null default true;
alter table attend_portal_blocks add column if not exists created_at timestamptz not null default now();
alter table attend_portal_blocks add column if not exists updated_at timestamptz not null default now();

alter table attend_portal_blocks drop constraint if exists attend_portal_blocks_kind_check;
alter table attend_portal_blocks add constraint attend_portal_blocks_kind_check
  check (kind in ('pick', 'spot', 'banner', 'news', 'faq', 'outline', 'note', 'chapter', 'html'));

-- ============================================================
-- 3) 参加者のメール登録（同じ理由で足りていない可能性がある）
-- ============================================================
alter table attend_rally_participants add column if not exists email text;
alter table attend_rally_participants add column if not exists email_verified_at timestamptz;
alter table attend_rally_participants add column if not exists display_name text;

-- ============================================================
-- 4) PostgRESTのスキーマキャッシュを更新する
--    列を足した直後は、アプリ側から「そんな列は無い」と見えることがある。
--    通常は自動で反映されるが、明示的に促しておく。
-- ============================================================
notify pgrst, 'reload schema';

-- ============================================================
-- 5) 確認：不足している列が無いか
--    1行も返らなければ完了。
-- ============================================================
with required(tbl, col) as (values
  ('attend_portals','project_id'),('attend_portals','rally_id'),('attend_portals','custom_ar_url'),
  ('attend_portals','hash'),('attend_portals','name'),('attend_portals','template'),
  ('attend_portals','status'),('attend_portals','ended_message'),('attend_portals','ended_link_url'),
  ('attend_portals','ended_link_label'),('attend_portals','brand_color'),('attend_portals','brand_color_dark'),
  ('attend_portals','accent_color'),('attend_portals','logo_url'),('attend_portals','logo_text'),
  ('attend_portals','site_title'),('attend_portals','site_description'),('attend_portals','og_image_url'),
  ('attend_portals','hero_image_url'),('attend_portals','hero_eyebrow'),('attend_portals','hero_title'),
  ('attend_portals','hero_text'),('attend_portals','ar_heading'),('attend_portals','ar_text'),
  ('attend_portals','ar_button_label'),('attend_portals','status_line'),('attend_portals','owner_name'),
  ('attend_portals','owner_address'),('attend_portals','privacy_url'),('attend_portals','terms_url'),
  ('attend_portals','contact_url'),('attend_portals','copyright_text'),('attend_portals','created_at'),
  ('attend_portals','updated_at'),('attend_portals','design'),('attend_portals','sections'),
  ('attend_portals','nav'),('attend_portals','sns'),
  ('attend_portal_blocks','portal_id'),('attend_portal_blocks','kind'),('attend_portal_blocks','sort_order'),
  ('attend_portal_blocks','title'),('attend_portal_blocks','body'),('attend_portal_blocks','meta'),
  ('attend_portal_blocks','image_url'),('attend_portal_blocks','link_url'),('attend_portal_blocks','badge'),
  ('attend_portal_blocks','enabled'),('attend_portal_blocks','created_at'),('attend_portal_blocks','updated_at'),
  ('attend_rally_participants','email'),('attend_rally_participants','email_verified_at'),
  ('attend_rally_participants','display_name')
)
select r.tbl as "テーブル", r.col as "まだ足りない列"
  from required r
 where not exists (
   select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col
 );
