-- 表示オブジェクトの3Dテンプレート(.glb)を各カテゴリに登録する。
-- 既存の透過MP4テンプレート(seed_presets.sql)に加えて、立体オブジェクト版を追加する。
-- 事前に schema.sql / schema_attend.sql を実行してから、SQL Editor でこちらも実行してください。
-- アセットは Next.js アプリの public/presets/<category>/ 配下から配信されます
-- (NEXT_PUBLIC_SITE_URL を変更した場合はURLも合わせて変更してください)。
--
-- 表示オブジェクト管理(/admin/fukubiku/presets)はservice='fukubiku'の行だけを表示するため、
-- 必ずserviceを明示する(未指定だとNULLになり画面に出てこない)。
-- model_urlに一意制約を張ったうえでon conflict (model_url)のupsertにし、
-- 再実行しても重複行が増えず、以前serviceがNULLのまま登録されてしまった行も
-- 正しく'fukubiku'に補正されるようにしている。

create unique index if not exists preset_objects_model_url_idx
  on preset_objects (model_url);

insert into preset_objects (name, category, model_url, thumbnail_url, service) values
  ('あみだくじ - 1等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_1tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_1tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 2等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_2tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_2tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 3等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_3tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_3tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 4等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_4tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_4tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 5等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_5tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_5tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 6等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_6tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_6tou_3d_thumb.png', 'fukubiku'),
  ('あみだくじ - 参加賞（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_cookie_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_cookie_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 1等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_1tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_1tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 2等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_2tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_2tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 3等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_3tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_3tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 4等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_4tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_4tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 5等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_5tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_5tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 6等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_6tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_6tou_3d_thumb.png', 'fukubiku'),
  ('ボックス抽選 - 参加賞（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_cookie_3d.glb', 'https://app.fukubikiu.com/presets/box/box_cookie_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 1等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_1tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_1tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 2等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_2tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_2tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 3等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_3tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_3tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 4等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_4tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_4tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 5等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_5tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_5tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 6等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_6tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_6tou_3d_thumb.png', 'fukubiku'),
  ('おみくじ - 参加賞（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_cookie_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_cookie_3d_thumb.png', 'fukubiku'),
  ('ダーツ - 当たり（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_atari_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_atari_3d_thumb.png', 'fukubiku'),
  ('ダーツ - 大当たり（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_ohatari_3d_thumb.png', 'fukubiku'),
  ('ダーツ - クーポン（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_coupon_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_coupon_3d_thumb.png', 'fukubiku'),
  ('ダーツ - はずれ（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_hazure_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_hazure_3d_thumb.png', 'fukubiku'),
  ('ダーツ - 参加賞（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_cookie_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_cookie_3d_thumb.png', 'fukubiku'),
  ('ガラガラ抽選 - 当たり（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_atari_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_atari_3d_thumb.png', 'fukubiku'),
  ('ガラガラ抽選 - 大当たり（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_ohatari_3d_thumb.png', 'fukubiku'),
  ('ガラガラ抽選 - クーポン（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_coupon_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_coupon_3d_thumb.png', 'fukubiku'),
  ('ガラガラ抽選 - はずれ（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_hazure_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_hazure_3d_thumb.png', 'fukubiku'),
  ('ガラガラ抽選 - 参加賞（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_cookie_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_cookie_3d_thumb.png', 'fukubiku'),
  ('スクラッチ - 当たり（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_atari_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_atari_3d_thumb.png', 'fukubiku'),
  ('スクラッチ - 大当たり（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_ohatari_3d_thumb.png', 'fukubiku'),
  ('スクラッチ - クーポン（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_coupon_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_coupon_3d_thumb.png', 'fukubiku'),
  ('スクラッチ - はずれ（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_hazure_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_hazure_3d_thumb.png', 'fukubiku'),
  ('スクラッチ - 参加賞（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_cookie_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_cookie_3d_thumb.png', 'fukubiku')
on conflict (model_url) do update set
  name = excluded.name,
  category = excluded.category,
  thumbnail_url = excluded.thumbnail_url,
  service = excluded.service;
