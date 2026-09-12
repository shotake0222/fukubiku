-- あてんど: どのSQLがまだ実行されていないかを一覧で出す。
--
-- 「受け皿サイトの作成に失敗しました」のように、
-- 原因がテーブル/列の不足かどうかを一度で判断するためのものです。
-- 何も書き換えないので、安心して実行してください。
--
-- 【実行方法】Supabase ダッシュボード > SQL Editor に貼り付けて実行。
-- status 列が「NG」の行があれば、その「実行するSQL」を上から順に流してください。

with checks(sort_order, item, kind, name, needs) as (values
  -- 土台
  (1,  'attend_projects テーブル',            'table', 'attend_projects',             'supabase/schema_attend.sql'),
  (2,  'attend_items テーブル',               'table', 'attend_items',                'supabase/schema_attend.sql'),
  (3,  'attend_trigger_objects テーブル',     'table', 'attend_trigger_objects',      'supabase/schema_attend.sql'),
  (4,  'set_updated_at 関数',                 'func',  'set_updated_at',              'supabase/schema_attend.sql'),
  -- スタンプラリー
  (5,  'attend_rallies テーブル',             'table', 'attend_rallies',              'supabase/schema_attend_rally.sql'),
  (6,  'attend_rally_spots テーブル',         'table', 'attend_rally_spots',          'supabase/schema_attend_rally.sql'),
  (7,  'attend_rally_participants テーブル',  'table', 'attend_rally_participants',   'supabase/schema_attend_rally.sql'),
  (8,  'attend_rally_stamps テーブル',        'table', 'attend_rally_stamps',         'supabase/schema_attend_rally.sql'),
  (9,  'attend_rally_links テーブル',         'table', 'attend_rally_links',          'supabase/add_rally_links_and_themes.sql'),
  (10, 'attend_rallies.theme 列',             'col',   'attend_rallies.theme',        'supabase/add_rally_links_and_themes.sql'),
  -- 受け皿サイト
  (11, 'attend_portals テーブル',             'table', 'attend_portals',              'supabase/schema_attend_portal.sql'),
  (12, 'attend_portal_blocks テーブル',       'table', 'attend_portal_blocks',        'supabase/schema_attend_portal.sql'),
  (13, 'attend_rally_login_codes テーブル',   'table', 'attend_rally_login_codes',    'supabase/schema_attend_portal.sql'),
  (14, 'attend_rally_participants.email 列',  'col',   'attend_rally_participants.email', 'supabase/schema_attend_portal.sql'),
  -- テーブルがあっても、古いバージョンで作られていて列が足りないことがある。
  -- (create table if not exists は、既にあるテーブルの中身を直さないため)
  (14.1, 'attend_portals.accent_color 列',    'col',   'attend_portals.accent_color',   'supabase/repair_attend_portal.sql'),
  (14.2, 'attend_portals.logo_text 列',       'col',   'attend_portals.logo_text',      'supabase/repair_attend_portal.sql'),
  (14.3, 'attend_portals.ar_heading 列',      'col',   'attend_portals.ar_heading',     'supabase/repair_attend_portal.sql'),
  (14.4, 'attend_portals.status_line 列',     'col',   'attend_portals.status_line',    'supabase/repair_attend_portal.sql'),
  (14.5, 'attend_portals.copyright_text 列',  'col',   'attend_portals.copyright_text', 'supabase/repair_attend_portal.sql'),
  (14.6, 'attend_portals.og_image_url 列',    'col',   'attend_portals.og_image_url',   'supabase/repair_attend_portal.sql'),
  (14.7, 'attend_portal_blocks.sort_order 列','col',   'attend_portal_blocks.sort_order','supabase/repair_attend_portal.sql'),
  (14.8, 'attend_portal_blocks.enabled 列',   'col',   'attend_portal_blocks.enabled',  'supabase/repair_attend_portal.sql'),
  (14.9, 'attend_portal_blocks.link_url 列',  'col',   'attend_portal_blocks.link_url', 'supabase/repair_attend_portal.sql'),
  -- 受け皿サイトのデザイン調整
  (15, 'attend_portals.design 列',            'col',   'attend_portals.design',       'supabase/add_portal_design.sql'),
  (16, 'attend_portals.sections 列',          'col',   'attend_portals.sections',     'supabase/add_portal_design.sql'),
  (17, 'attend_portals.nav 列',               'col',   'attend_portals.nav',          'supabase/add_portal_design.sql'),
  (18, 'attend_portals.sns 列',               'col',   'attend_portals.sns',          'supabase/add_portal_design.sql')
)
select
  c.item                                  as "確認したもの",
  case
    when c.kind = 'table' then
      case when to_regclass('public.' || c.name) is not null then 'OK' else 'NG' end
    when c.kind = 'func' then
      case when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = c.name
      ) then 'OK' else 'NG' end
    else
      case when exists (
        select 1 from information_schema.columns
         where table_schema = 'public'
           and table_name = split_part(c.name, '.', 1)
           and column_name = split_part(c.name, '.', 2)
      ) then 'OK' else 'NG' end
  end                                     as "status",
  c.needs                                 as "NGなら実行するSQL"
from checks c
order by c.sort_order;
