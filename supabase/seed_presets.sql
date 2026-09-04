-- 表示オブジェクトのデフォルトテンプレート(GIF)を preset_objects に登録する。
-- 事前に schema.sql を実行してから、SQL Editor でこちらも実行してください。
-- アセットは Next.js アプリの public/presets/ 配下から配信されます
-- (NEXT_PUBLIC_SITE_URL を変更した場合はURLも合わせて変更してください)。

insert into preset_objects (name, model_url, thumbnail_url) values
  ('あみだくじ - 1等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_1tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_1tou.gif'),
  ('あみだくじ - 2等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_2tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_2tou.gif'),
  ('あみだくじ - 3等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_3tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_3tou.gif'),
  ('あみだくじ - 4等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_4tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_4tou.gif'),
  ('あみだくじ - 5等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_5tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_5tou.gif'),
  ('あみだくじ - 6等', 'https://fukubikiu.attend-ar.com/presets/amida/amida_6tou.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_6tou.gif'),
  ('あみだくじ - 参加賞', 'https://fukubikiu.attend-ar.com/presets/amida/amida_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/amida/amida_cookie.gif'),

  ('ボックス抽選 - 1等', 'https://fukubikiu.attend-ar.com/presets/box/box_1tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_1tou.gif'),
  ('ボックス抽選 - 2等', 'https://fukubikiu.attend-ar.com/presets/box/box_2tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_2tou.gif'),
  ('ボックス抽選 - 3等', 'https://fukubikiu.attend-ar.com/presets/box/box_3tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_3tou.gif'),
  ('ボックス抽選 - 4等', 'https://fukubikiu.attend-ar.com/presets/box/box_4tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_4tou.gif'),
  ('ボックス抽選 - 5等', 'https://fukubikiu.attend-ar.com/presets/box/box_5tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_5tou.gif'),
  ('ボックス抽選 - 6等', 'https://fukubikiu.attend-ar.com/presets/box/box_6tou.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_6tou.gif'),
  ('ボックス抽選 - 参加賞', 'https://fukubikiu.attend-ar.com/presets/box/box_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/box/box_cookie.gif'),

  ('ダーツ - 当たり', 'https://fukubikiu.attend-ar.com/presets/darts/darts_atari.gif', 'https://fukubikiu.attend-ar.com/presets/darts/darts_atari.gif'),
  ('ダーツ - 大当たり', 'https://fukubikiu.attend-ar.com/presets/darts/darts_ohatari.gif', 'https://fukubikiu.attend-ar.com/presets/darts/darts_ohatari.gif'),
  ('ダーツ - クーポン', 'https://fukubikiu.attend-ar.com/presets/darts/darts_coupon.gif', 'https://fukubikiu.attend-ar.com/presets/darts/darts_coupon.gif'),
  ('ダーツ - はずれ', 'https://fukubikiu.attend-ar.com/presets/darts/darts_hazure.gif', 'https://fukubikiu.attend-ar.com/presets/darts/darts_hazure.gif'),
  ('ダーツ - 参加賞', 'https://fukubikiu.attend-ar.com/presets/darts/darts_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/darts/darts_cookie.gif'),

  ('ガラガラ抽選 - 当たり', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_atari.gif', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_atari.gif'),
  ('ガラガラ抽選 - 大当たり', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_ohatari.gif', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_ohatari.gif'),
  ('ガラガラ抽選 - クーポン', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_coupon.gif', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_coupon.gif'),
  ('ガラガラ抽選 - はずれ', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_hazure.gif', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_hazure.gif'),
  ('ガラガラ抽選 - 参加賞', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_cookie.gif'),

  ('おみくじ - 1等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_1tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_1tou.gif'),
  ('おみくじ - 2等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_2tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_2tou.gif'),
  ('おみくじ - 3等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_3tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_3tou.gif'),
  ('おみくじ - 4等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_4tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_4tou.gif'),
  ('おみくじ - 5等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_5tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_5tou.gif'),
  ('おみくじ - 6等', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_6tou.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_6tou.gif'),
  ('おみくじ - 参加賞', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_cookie.gif'),

  ('スクラッチ - 当たり', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_atari.gif', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_atari.gif'),
  ('スクラッチ - 大当たり', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_ohatari.gif', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_ohatari.gif'),
  ('スクラッチ - クーポン', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_coupon.gif', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_coupon.gif'),
  ('スクラッチ - はずれ', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_hazure.gif', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_hazure.gif'),
  ('スクラッチ - 参加賞', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_cookie.gif', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_cookie.gif')
on conflict do nothing;
