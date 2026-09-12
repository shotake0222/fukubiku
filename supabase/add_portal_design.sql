-- 受け皿サイト（あてんど）: デザイン調整・セクション構成・リンクを管理画面から
-- 変えられるようにするための列を追加する。
--
-- schema_attend_portal.sql を実行済みのDBに、追加で流してください。
-- 何度実行しても同じ結果になります（冪等）。
--
-- いずれもJSONBで、未設定(null)ならテンプレートの既定が使われます。
-- 列を増やさずに項目を足していけるので、デザイン項目が増えても
-- そのたびにマイグレーションを流す必要がありません。

alter table attend_portals add column if not exists design jsonb;
alter table attend_portals add column if not exists sections jsonb;
alter table attend_portals add column if not exists nav jsonb;
alter table attend_portals add column if not exists sns jsonb;

comment on column attend_portals.design is
  'デザイン調整。{font,radius,density,heroStyle,heroOverlay,heroHeight,headingScale,tone,stickyCta,stickyHeader}';
comment on column attend_portals.sections is
  'セクションの並び順・表示/非表示・見出し。[{key,enabled,eyebrow,heading}]';
comment on column attend_portals.nav is 'ヘッダーのリンク。[{label,url}]';
comment on column attend_portals.sns is 'SNSリンク。[{kind,url}]';

-- 確認
select column_name, data_type
  from information_schema.columns
 where table_name = 'attend_portals'
   and column_name in ('design', 'sections', 'nav', 'sns')
 order by column_name;
