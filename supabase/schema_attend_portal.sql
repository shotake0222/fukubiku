-- あてんど: 受け皿サイト（ポータル）と、参加者のメール登録
--
-- schema_attend_rally.sql / add_rally_links_and_themes.sql を実行済みのDBに追加で流す。
-- 何度実行しても壊れません(冪等)。
--
-- 【注意】create table if not exists は「テーブルが既にあれば中身を確認せず素通り」する。
-- そのため、以前のバージョンで作られたテーブルが残っていると、
-- 流し直しても列は増えない(実際に accent_color が無い状態が発生した)。
-- それを防ぐため、create のあとに add column if not exists を必ず並べてある。
-- すでに列がある場合は何も起きない。

-- ============================================================
-- 1) 受け皿サイト（ポータル）
--    テンプレートを選び、枠を埋めるだけで公開できるようにする。
--    HTMLを配って回るのをやめ、こちらでホスティングすることで
--    修正も提供終了もこちら側で完結させるための土台。
-- ============================================================
create table if not exists attend_portals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references attend_projects(id) on delete cascade,
  -- 参加導線の行き先。未設定なら custom_ar_url を使う。
  rally_id uuid references attend_rallies(id) on delete set null,
  custom_ar_url text,

  hash text not null unique,           -- 公開URL (/p/[hash])
  name text not null default '受け皿サイト',   -- 管理用の名前

  -- 用途別テンプレート
  template text not null default 'kanko'
    check (template in ('kanko', 'shotengai', 'shisetsu', 'seichi', 'jousetsu')),

  -- draft   : 関係者確認中（noindex・「準備中」表示）
  -- published: 公開
  -- ended   : 提供終了（終了画面に切り替わる。URLは生きたまま）
  status text not null default 'draft' check (status in ('draft', 'published', 'ended')),
  ended_message text,                  -- 終了画面に出す文章（未設定なら既定文）
  ended_link_url text,                 -- 終了画面に出す誘導先（クライアント公式サイトなど）
  ended_link_label text,

  -- ブランド
  brand_color text not null default '#0f766e',
  brand_color_dark text not null default '#115e59',
  accent_color text,
  logo_url text,
  logo_text text,                      -- ロゴ画像が無い場合の文字

  -- <head>
  site_title text not null default 'スタンプラリー',
  site_description text,
  og_image_url text,

  -- ヒーロー
  hero_image_url text,
  hero_eyebrow text,
  hero_title text,
  hero_text text,

  -- 参加導線（この見出しと文言だけ案件ごとに変えられる）
  ar_heading text not null default 'スタンプラリーに参加する',
  ar_text text,
  ar_button_label text not null default 'いますぐ始める',

  -- ステータス行（施設テンプレートで使う）
  status_line text,

  -- フッター
  owner_name text,
  owner_address text,
  privacy_url text,
  terms_url text,
  contact_url text,
  copyright_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 以前のバージョンで作られたテーブルが残っている場合に備えて、
-- 足りない列を1つずつ補う。create table if not exists だけでは列は増えない。
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
alter table attend_portals add column if not exists created_at timestamptz not null default now();
alter table attend_portals add column if not exists updated_at timestamptz not null default now();

alter table attend_portals drop constraint if exists attend_portals_template_check;
alter table attend_portals add constraint attend_portals_template_check
  check (template in ('kanko', 'shotengai', 'shisetsu', 'seichi', 'jousetsu'));
alter table attend_portals drop constraint if exists attend_portals_status_check;
alter table attend_portals add constraint attend_portals_status_check
  check (status in ('draft', 'published', 'ended'));
create unique index if not exists attend_portals_hash_key on attend_portals (hash);

create index if not exists attend_portals_project_idx on attend_portals (project_id);
create index if not exists attend_portals_hash_idx on attend_portals (hash);

drop trigger if exists attend_portals_set_updated_at on attend_portals;
create trigger attend_portals_set_updated_at
before update on attend_portals
for each row execute function set_updated_at();

-- ブロック（繰り返し要素）。kind ごとに使う列が違う。
--   pick    : 見どころ（画像＋見出し＋説明）
--   spot    : スポット/店舗/ロケ地（画像＋見出し＋説明＋補足）
--   banner  : 自由バナー（画像＋見出し＋補足＋リンク）
--   news    : お知らせ（日付＋本文）
--   faq     : よくある質問（質問＋回答）
--   outline : 開催概要（項目名＋内容）
--   note    : 注意書き・マナー（1行ずつ）
--   chapter : 章（常設テンプレート用。画像＋見出し＋期間）
-- 使わない kind のブロックを0件にすれば、そのセクションごと描画されない。
create table if not exists attend_portal_blocks (
  id uuid primary key default gen_random_uuid(),
  portal_id uuid not null references attend_portals(id) on delete cascade,
  kind text not null check (kind in ('pick', 'spot', 'banner', 'news', 'faq', 'outline', 'note', 'chapter')),
  sort_order integer not null default 0,

  title text,        -- 見出し／項目名／質問／日付
  body text,         -- 説明／回答／本文
  meta text,         -- 営業時間・話数・期間などの補足
  image_url text,
  link_url text,
  badge text,        -- 「開催中」「スタンプ①」などの小さなラベル
  enabled boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- 同上。以前のバージョンのテーブルが残っていても列が揃うようにする。
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
  check (kind in ('pick', 'spot', 'banner', 'news', 'faq', 'outline', 'note', 'chapter'));

create index if not exists attend_portal_blocks_portal_idx
  on attend_portal_blocks (portal_id, kind, sort_order);

drop trigger if exists attend_portal_blocks_set_updated_at on attend_portal_blocks;
create trigger attend_portal_blocks_set_updated_at
before update on attend_portal_blocks
for each row execute function set_updated_at();

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
-- 2) 参加者のメール登録（任意）
--
--    Cookieを消すと「自分が誰か」を示す鍵を失い、サーバーに残っている
--    スタンプを取り出せなくなる。引き継ぎコードは、失う前に控えていないと
--    間に合わない。そこでメールアドレスを鍵として預かれるようにする。
--
--    Supabase Auth は使わない。参加者が authenticated ロールになると、
--    管理系テーブルのRLS（authenticated に読み書きを許可）を通過して
--    しまうため、参加者の認証は完全に独立した仕組みで持つ。
-- ============================================================
alter table attend_rally_participants add column if not exists email text;
alter table attend_rally_participants add column if not exists email_verified_at timestamptz;
alter table attend_rally_participants add column if not exists display_name text;

-- 同じラリーに同じメールで二重登録されないようにする（未登録=null は重複可）
create unique index if not exists attend_rally_participants_email_idx
  on attend_rally_participants (rally_id, lower(email)) where email is not null;

-- ワンタイムコード。平文は保存せず、SHA-256のハッシュだけを持つ。
create table if not exists attend_rally_login_codes (
  id uuid primary key default gen_random_uuid(),
  rally_id uuid not null references attend_rallies(id) on delete cascade,
  email text not null,
  code_hash text not null,
  purpose text not null default 'link' check (purpose in ('link', 'restore')),
  -- 'link'    : いま使っているスタンプ帳にメールを紐づける
  -- 'restore' : 別端末でメールからスタンプ帳を呼び戻す
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists attend_rally_login_codes_lookup_idx
  on attend_rally_login_codes (rally_id, email, created_at desc);

alter table attend_rally_login_codes enable row level security;
-- 参加者側の認証はすべて service role 経由のルートハンドラで行うため、
-- anon にも authenticated にもポリシーを与えない（管理画面からも見えない）。

-- 参加者のメールアドレスは個人情報。RLSは行単位なので列を隠せないため、
-- 「管理画面には表示しない」をアプリ側の約束として守る
-- (管理画面の参加状況は件数だけを出し、本文は取得しない)。
-- ここでは従来どおり authenticated の読み取りだけを許可する。
drop policy if exists "authenticated read attend_rally_participants" on attend_rally_participants;
create policy "authenticated read attend_rally_participants" on attend_rally_participants
  for select to authenticated using (true);

-- 期限切れのワンタイムコードを溜め込まないための掃除用。
-- 定期実行の仕組みが無いので、コード発行のたびにアプリ側から呼ぶ。
create or replace function purge_expired_rally_login_codes() returns void
language sql as $$
  delete from attend_rally_login_codes
   where expires_at < now() - interval '1 day';
$$;

-- 列を足した直後は、アプリ側から「そんな列は無い」と見えることがある。
-- 通常は自動で反映されるが、明示的に促しておく。
notify pgrst, 'reload schema';
