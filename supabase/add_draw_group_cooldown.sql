-- draw_groups(確率抽選セット)に、共有URLの再抽選クールダウン時間を追加。
-- Supabase ダッシュボード > SQL Editor で実行してください。
--
-- 背景: 共有URLはアクセスの都度サーバー側で再抽選される仕組みのため、Cookieで
-- 前回の抽選時刻を記録し、一定時間は再抽選させないようにしている(lib/drawCooldown.ts)。
-- この「何時間に1回」を、確率(重み)とは別に管理画面から抽選セットごとに設定できるようにする。

alter table draw_groups
  add column if not exists cooldown_hours numeric not null default 1;
