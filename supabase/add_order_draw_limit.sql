-- 注文(orders)ごとに「一定期間あたりの表示回数の上限」を設定できるようにする。
--
-- orders.quantity(個数)を上限回数として使い、その個数を「どの期間あたりの上限とみなすか」を
-- limit_period で指定する。
--   'day'    : 1日あたり
--   '3days'  : 3日あたり
--   'week'   : 1週間あたり
--   'none'   : 制限なし(既定)
-- null / 'none' の場合、および quantity が未設定の場合は制限しない。
--
-- Cookieは端末ごとにしか効かないため、全体の回数上限は必ずサーバー側で数える必要がある。
-- そのために表示のたびに1行を記録するテーブルを用意する。
alter table orders add column if not exists limit_period text;

create table if not exists draw_logs (
  id uuid primary key default gen_random_uuid(),
  -- 共有URLのハッシュ(orders.hash / draw_groups.hash)。
  -- 注文が削除されても集計履歴が壊れないよう、外部キーではなくハッシュで持つ。
  hash text not null,
  drawn_at timestamptz not null default now()
);

-- 「このハッシュの、この期間内の件数」を数えるための索引。
create index if not exists draw_logs_hash_drawn_at_idx on draw_logs (hash, drawn_at desc);

-- ビューアはサービスロールキーで参照するため、一般公開のRLSポリシーは付けない。
alter table draw_logs enable row level security;
