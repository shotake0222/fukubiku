-- ============================================================
-- ふくびく: NFC非対応端末向けの「QR専用URL」
--
-- 筐体のNFCタグに書き込んでいる URL(/v/<hash>) とは別に、
-- QRコード専用の URL(/q/<qr_token>) を注文・抽選セットごとに発行できるようにする。
--
--   ・QRは写真で共有できてしまうため、NFCとは別のURLにしておき、
--     管理画面から「QRだけ停止」「QRだけ再発行(古いQRを無効化)」ができるようにする。
--   ・NFCで引かれたか、QRで引かれたかを draw_logs.via に記録して集計する。
--   ・クールダウン(Cookie)は同じ注文/抽選セット内で共通。
--     NFCで引いた直後にQRで引き直す、ということはできない。
--
-- 何度実行しても安全(冪等)。Supabase > SQL Editor に貼り付けて Run。
-- ============================================================

-- 1) 注文(orders)
alter table orders add column if not exists qr_token     text;
alter table orders add column if not exists qr_enabled   boolean not null default false;
alter table orders add column if not exists qr_issued_at timestamptz;
create unique index if not exists orders_qr_token_idx on orders (qr_token) where qr_token is not null;

-- 2) 抽選セット(draw_groups)
alter table draw_groups add column if not exists qr_token     text;
alter table draw_groups add column if not exists qr_enabled   boolean not null default false;
alter table draw_groups add column if not exists qr_issued_at timestamptz;
create unique index if not exists draw_groups_qr_token_idx on draw_groups (qr_token) where qr_token is not null;

-- 3) 表示の記録(draw_logs)
--    add_order_draw_limit.sql を未実行の環境でも動くよう、テーブルごと用意する。
create table if not exists draw_logs (
  id uuid primary key default gen_random_uuid(),
  hash text not null,
  drawn_at timestamptz not null default now()
);
create index if not exists draw_logs_hash_drawn_at_idx on draw_logs (hash, drawn_at desc);
alter table draw_logs enable row level security;

--    どこから開かれたか。'nfc' = 通常URL(NFCタグ等) / 'qr' = QR専用URL。
--    既存の行は通常URLからのものなので 'nfc' とみなす。
alter table draw_logs add column if not exists via text not null default 'nfc';
alter table draw_logs drop constraint if exists draw_logs_via_check;
alter table draw_logs add constraint draw_logs_via_check check (via in ('nfc', 'qr'));
create index if not exists draw_logs_hash_via_idx on draw_logs (hash, via);

--    管理画面(ログイン済みユーザー)から件数を読めるようにする。
--    書き込みはビューア(サービスロール)だけが行う。
drop policy if exists "draw_logs_select_authenticated" on draw_logs;
create policy "draw_logs_select_authenticated" on draw_logs
  for select to authenticated using (true);

-- 4) PostgRESTに新しい列を認識させる
notify pgrst, 'reload schema';

-- 5) 確認: 7行(orders 3列・draw_groups 3列・draw_logs.via)表示されれば成功
select table_name, column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name in ('orders', 'draw_groups') and column_name in ('qr_token', 'qr_enabled', 'qr_issued_at'))
     or (table_name = 'draw_logs' and column_name = 'via'))
 order by table_name, column_name;
