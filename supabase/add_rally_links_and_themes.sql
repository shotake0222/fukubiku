-- スタンプラリー: 公開URLの複数発行（配布用・埋め込み用）とデザインパターンの拡張
--
-- schema_attend_rally.sql を実行済みのDBに対して追加で流す。
-- 何度実行しても壊れません(冪等)。

-- 1) デザインパターンを13種に増やす。
--    テーマの一覧はアプリ側(lib/rallyThemes.ts)が持つため、DB側のCHECK制約は外す。
--    制約で縛ると、テーマを追加するたびにマイグレーションが必要になり、
--    値が合わずに保存だけ失敗する事故が起きるため。
alter table attend_rallies drop constraint if exists attend_rallies_theme_check;

-- 旧テーマ名を新しい名前へ寄せる（night=夜のイベント → 夜景 / pop=明色 → パステル）
update attend_rallies set theme = 'yakei' where theme = 'night';
update attend_rallies set theme = 'pastel' where theme = 'pop';

-- 2) 公開URL。1ラリーに何本でも発行でき、URLごとにデザインと表示形式を変えられる。
--    進捗は参加者ID(Cookie)とラリーの組で持つので、どのURLから入っても同じスタンプ帳が続く。
create table if not exists attend_rally_links (
  id uuid primary key default gen_random_uuid(),
  rally_id uuid not null references attend_rallies(id) on delete cascade,
  hash text not null unique,                 -- /r/[hash] または /embed/[hash]
  name text not null default '配布用URL',     -- 管理用の名前（例: 観光協会サイト用、駅ポスター用）
  mode text not null default 'standalone' check (mode in ('standalone', 'embed')),

  -- null ならラリー既定のテーマ。URLごとに変えたい時だけ入れる。
  theme text,
  -- 埋め込み向けに説明文などを省いた詰めた表示にする
  compact boolean not null default false,
  -- 埋め込みを許可する配信元(カンマ区切り。空なら制限しない)。
  -- 例: https://www.example-kankou.jp,https://example-city.lg.jp
  allowed_origins text,
  -- 停止するとこのURLだけ開けなくなる（他のURLには影響しない）
  enabled boolean not null default true,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attend_rally_links_rally_idx on attend_rally_links (rally_id);
create index if not exists attend_rally_links_hash_idx on attend_rally_links (hash);

drop trigger if exists attend_rally_links_set_updated_at on attend_rally_links;
create trigger attend_rally_links_set_updated_at
before update on attend_rally_links
for each row execute function set_updated_at();

-- 既存ラリーのhashを「配布用URL」としてリンク表へ移す。
-- attend_rallies.hash 自体は残しておき、アプリ側でも従来どおり解決できるようにする
-- （既に配ってしまったURLを死なせないため）。
insert into attend_rally_links (rally_id, hash, name, mode)
select r.id, r.hash, '配布用URL', 'standalone'
from attend_rallies r
where not exists (select 1 from attend_rally_links l where l.hash = r.hash);

alter table attend_rally_links enable row level security;

drop policy if exists "authenticated read attend_rally_links" on attend_rally_links;
create policy "authenticated read attend_rally_links" on attend_rally_links
  for select to authenticated using (true);
drop policy if exists "authenticated write attend_rally_links" on attend_rally_links;
create policy "authenticated write attend_rally_links" on attend_rally_links
  for all to authenticated using (true) with check (true);
