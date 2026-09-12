-- 旧GIFテンプレートを透過MP4に貼り替える。
--
-- 【背景】
-- 初期リリース時(f82b7fd)のシードは、テンプレートをGIFで登録していた。
--   https://fukubikiu.attend-ar.com/presets/amida/amida_1tou.gif
-- その後 1af9ad2 で透過MP4化し、cd4079f で公開ドメインを app.fukubikiu.com に変更したが、
-- これらはいずれも「新規INSERT用のシード」だったため、
-- すでにGIFで登録済みのDBのレコードは古いURLのまま残っていた。
--
-- その結果:
--   * public/presets/ 配下にGIFファイルが存在しない(=404)ため、ARで何も表示されない
--   * 旧ドメイン fukubikiu.attend-ar.com も配信していないため、やはり表示されない
--   * 管理画面のカテゴリボタンが「（GIF）」と表示される(実体はMP4で用意してあるのに)
--
-- 対象は amida / box / darts / garagara / omikuji / scratch の6カテゴリ・36件で、
-- 同名の .mp4 が public/presets/ に1対1で揃っている。
--
-- 【実行方法】Supabase ダッシュボード > SQL Editor に貼り付けて実行。
-- 何度実行しても同じ結果になる(冪等)。

-- 1) 実行前の確認: GIFのまま残っているレコードを一覧する
--    (0件ならこのファイルを実行する必要はない)
select id, name, category, model_url
from preset_objects
where model_url ilike '%.gif';

-- 2) 先に「MP4版がすでに登録済みのGIF行」を削除しておく。
--    (seed_presets.sql のMP4版を後から流していた場合、そのまま貼り替えると
--     model_url の一意制約 preset_objects_model_url_idx に衝突するため)
--    draw_group_entries / orders から参照されている行は消せないので、
--    参照されていないものだけを対象にする。
delete from preset_objects g
where g.model_url ilike '%.gif'
  and exists (
    select 1 from preset_objects m
    where m.model_url = regexp_replace(
      regexp_replace(g.model_url, '^https?://[^/]+', 'https://app.fukubikiu.com'),
      '\.gif$', '.mp4')
  )
  and not exists (select 1 from draw_group_entries e where e.preset_object_id = g.id)
  and not exists (select 1 from orders o where o.preset_object_id = g.id);

-- 2b) 残ったGIFを MP4 に貼り替え、同時に公開ドメインも現行のものに揃える。
--    サムネイルはGIFを指したままなので消す(未設定ならmodel_urlからプレビューが作られる)。
update preset_objects
set model_url =
      regexp_replace(
        regexp_replace(model_url, '^https?://[^/]+', 'https://app.fukubikiu.com'),
        '\.gif$', '.mp4'
      ),
    thumbnail_url = null
where model_url ilike '%.gif'
  and model_url ~ '/presets/(amida|box|darts|garagara|omikuji|scratch)/';

-- 3) 旧ドメインのまま残っているMP4/GLBも現行ドメインに揃える。
update preset_objects
set model_url = regexp_replace(model_url, '^https?://fukubikiu\.attend-ar\.com', 'https://app.fukubikiu.com'),
    thumbnail_url = regexp_replace(thumbnail_url, '^https?://fukubikiu\.attend-ar\.com', 'https://app.fukubikiu.com')
where model_url like 'https://fukubikiu.attend-ar.com/%'
   or thumbnail_url like 'https://fukubikiu.attend-ar.com/%';

-- 4) service が未設定のレコードは fukubiku 扱いにする。
--    (初期シードには service 列が無く、NULLのままだと管理画面/営業デモ画面に出てこない)
update preset_objects set service = 'fukubiku' where service is null;

-- 5) category が未設定のレコードをファイル名から補完する。
--    (初期シードには category 列が無かった)
update preset_objects
set category = sub.guessed
from (
  select id, (regexp_match(model_url, '/presets/([a-z0-9]+)/'))[1] as guessed
  from preset_objects
  where category is null and service = 'fukubiku'
) sub
where preset_objects.id = sub.id
  and sub.guessed is not null;

-- 6) 実行後の確認。GIFが0件、MP4が36件になっていれば成功。
select
  count(*) filter (where model_url ilike '%.gif')  as gif_remaining,
  count(*) filter (where model_url ilike '%.mp4')  as mp4_total,
  count(*) filter (where model_url ilike '%.glb')  as glb_total,
  count(*) filter (where model_url like 'https://fukubikiu.attend-ar.com/%') as old_domain_remaining,
  count(*) filter (where service is null)          as service_null_remaining
from preset_objects;

-- 7) カテゴリごとの登録状況。営業デモ/抽選セット作成で
--    「このカテゴリのテンプレートが見つかりませんでした」と出る場合は、
--    そのカテゴリの行数が0になっていないか確認する。
--    0件なら seed_object_presets_v5.sql / v6.sql / v7.sql が未実行。
select category, count(*) as total,
       count(*) filter (where model_url ilike '%.glb') as glb,
       count(*) filter (where model_url ilike '%.mp4') as mp4
from preset_objects
where service = 'fukubiku'
group by category
order by category;
