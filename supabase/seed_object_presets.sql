-- 表示オブジェクトの3Dテンプレート(.glb)を各カテゴリに登録する。
-- 既存の透過MP4テンプレート(seed_presets.sql)に加えて、立体オブジェクト版を追加する。
-- 事前に schema.sql を実行してから、SQL Editor でこちらも実行してください。
-- アセットは Next.js アプリの public/presets/<category>/ 配下から配信されます
-- (NEXT_PUBLIC_SITE_URL を変更した場合はURLも合わせて変更してください)。

insert into preset_objects (name, category, model_url, thumbnail_url) values
  ('あみだくじ - 1等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_1tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_1tou_3d_thumb.png'),
  ('あみだくじ - 2等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_2tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_2tou_3d_thumb.png'),
  ('あみだくじ - 3等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_3tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_3tou_3d_thumb.png'),
  ('あみだくじ - 4等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_4tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_4tou_3d_thumb.png'),
  ('あみだくじ - 5等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_5tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_5tou_3d_thumb.png'),
  ('あみだくじ - 6等（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_6tou_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_6tou_3d_thumb.png'),
  ('あみだくじ - 参加賞（3Dオブジェクト）', 'amida', 'https://app.fukubikiu.com/presets/amida/amida_cookie_3d.glb', 'https://app.fukubikiu.com/presets/amida/amida_cookie_3d_thumb.png'),
  ('ボックス抽選 - 1等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_1tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_1tou_3d_thumb.png'),
  ('ボックス抽選 - 2等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_2tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_2tou_3d_thumb.png'),
  ('ボックス抽選 - 3等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_3tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_3tou_3d_thumb.png'),
  ('ボックス抽選 - 4等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_4tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_4tou_3d_thumb.png'),
  ('ボックス抽選 - 5等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_5tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_5tou_3d_thumb.png'),
  ('ボックス抽選 - 6等（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_6tou_3d.glb', 'https://app.fukubikiu.com/presets/box/box_6tou_3d_thumb.png'),
  ('ボックス抽選 - 参加賞（3Dオブジェクト）', 'box', 'https://app.fukubikiu.com/presets/box/box_cookie_3d.glb', 'https://app.fukubikiu.com/presets/box/box_cookie_3d_thumb.png'),
  ('おみくじ - 1等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_1tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_1tou_3d_thumb.png'),
  ('おみくじ - 2等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_2tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_2tou_3d_thumb.png'),
  ('おみくじ - 3等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_3tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_3tou_3d_thumb.png'),
  ('おみくじ - 4等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_4tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_4tou_3d_thumb.png'),
  ('おみくじ - 5等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_5tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_5tou_3d_thumb.png'),
  ('おみくじ - 6等（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_6tou_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_6tou_3d_thumb.png'),
  ('おみくじ - 参加賞（3Dオブジェクト）', 'omikuji', 'https://app.fukubikiu.com/presets/omikuji/omikuji_cookie_3d.glb', 'https://app.fukubikiu.com/presets/omikuji/omikuji_cookie_3d_thumb.png'),
  ('ダーツ - 当たり（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_atari_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_atari_3d_thumb.png'),
  ('ダーツ - 大当たり（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_ohatari_3d_thumb.png'),
  ('ダーツ - クーポン（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_coupon_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_coupon_3d_thumb.png'),
  ('ダーツ - はずれ（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_hazure_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_hazure_3d_thumb.png'),
  ('ダーツ - 参加賞（3Dオブジェクト）', 'darts', 'https://app.fukubikiu.com/presets/darts/darts_cookie_3d.glb', 'https://app.fukubikiu.com/presets/darts/darts_cookie_3d_thumb.png'),
  ('ガラガラ抽選 - 当たり（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_atari_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_atari_3d_thumb.png'),
  ('ガラガラ抽選 - 大当たり（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_ohatari_3d_thumb.png'),
  ('ガラガラ抽選 - クーポン（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_coupon_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_coupon_3d_thumb.png'),
  ('ガラガラ抽選 - はずれ（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_hazure_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_hazure_3d_thumb.png'),
  ('ガラガラ抽選 - 参加賞（3Dオブジェクト）', 'garagara', 'https://app.fukubikiu.com/presets/garagara/garagara_cookie_3d.glb', 'https://app.fukubikiu.com/presets/garagara/garagara_cookie_3d_thumb.png'),
  ('スクラッチ - 当たり（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_atari_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_atari_3d_thumb.png'),
  ('スクラッチ - 大当たり（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_ohatari_3d_thumb.png'),
  ('スクラッチ - クーポン（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_coupon_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_coupon_3d_thumb.png'),
  ('スクラッチ - はずれ（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_hazure_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_hazure_3d_thumb.png'),
  ('スクラッチ - 参加賞（3Dオブジェクト）', 'scratch', 'https://app.fukubikiu.com/presets/scratch/scratch_cookie_3d.glb', 'https://app.fukubikiu.com/presets/scratch/scratch_cookie_3d_thumb.png')
on conflict do nothing;
