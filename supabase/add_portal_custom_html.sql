-- 受け皿サイト: HTML/CSSを直接書けるようにするための列を追加する
--
-- schema_attend_portal.sql を実行済みのDBに追加で流してください。
-- 何度実行しても同じ結果になります（冪等）。
--
-- 3段階の自由度を用意します。
--   1. HTMLブロック   … テンプレートの好きな位置に、部分的にHTMLを差し込む
--                        （attend_portal_blocks の kind に 'html' を追加）
--   2. 追加CSS        … テンプレートの見た目を上書きする
--   3. 全面HTML       … ページ全体を自分で書く（最後の逃げ道）

alter table attend_portals add column if not exists custom_html text;
alter table attend_portals add column if not exists custom_css text;

comment on column attend_portals.custom_html is
  'ページ全体を差し替えるHTML。設定するとテンプレートを使わず、この内容をそのまま配信する';
comment on column attend_portals.custom_css is
  'テンプレートの後ろに足すCSS。部分的な見た目の調整に使う';

-- HTMLブロックを使えるようにする（既存のCHECK制約を貼り直す）
alter table attend_portal_blocks drop constraint if exists attend_portal_blocks_kind_check;
alter table attend_portal_blocks add constraint attend_portal_blocks_kind_check
  check (kind in ('pick', 'spot', 'banner', 'news', 'faq', 'outline', 'note', 'chapter', 'html'));

notify pgrst, 'reload schema';

-- 確認（3行返れば成功）
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'attend_portals' and column_name in ('custom_html', 'custom_css'))
     or (table_name = 'attend_portal_blocks' and column_name = 'kind'))
 order by table_name, column_name;
