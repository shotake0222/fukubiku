-- 表示オブジェクトのデフォルトテンプレート(透過MP4)を preset_objects に登録する。
-- 事前に schema.sql を実行してから、SQL Editor でこちらも実行してください。
-- 既にGIF版を実行済みの場合は、下記を再実行すると同名レコードが重複登録されます。
-- その場合は先に「delete from preset_objects;」などで一度空にしてから実行してください。
-- アセットは Next.js アプリの public/presets/ 配下から配信されます
-- (NEXT_PUBLIC_SITE_URL を変更した場合はURLも合わせて変更してください)。

insert into preset_objects (name, category, model_url, thumbnail_url) values
  ('あみだくじ - 1等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_1tou.mp4', null),
  ('あみだくじ - 2等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_2tou.mp4', null),
  ('あみだくじ - 3等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_3tou.mp4', null),
  ('あみだくじ - 4等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_4tou.mp4', null),
  ('あみだくじ - 5等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_5tou.mp4', null),
  ('あみだくじ - 6等', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_6tou.mp4', null),
  ('あみだくじ - 参加賞', 'amida', 'https://fukubikiu.attend-ar.com/presets/amida/amida_cookie.mp4', null),

  ('ボックス抽選 - 1等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_1tou.mp4', null),
  ('ボックス抽選 - 2等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_2tou.mp4', null),
  ('ボックス抽選 - 3等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_3tou.mp4', null),
  ('ボックス抽選 - 4等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_4tou.mp4', null),
  ('ボックス抽選 - 5等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_5tou.mp4', null),
  ('ボックス抽選 - 6等', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_6tou.mp4', null),
  ('ボックス抽選 - 参加賞', 'box', 'https://fukubikiu.attend-ar.com/presets/box/box_cookie.mp4', null),

  ('ダーツ - 当たり', 'darts', 'https://fukubikiu.attend-ar.com/presets/darts/darts_atari.mp4', null),
  ('ダーツ - 大当たり', 'darts', 'https://fukubikiu.attend-ar.com/presets/darts/darts_ohatari.mp4', null),
  ('ダーツ - クーポン', 'darts', 'https://fukubikiu.attend-ar.com/presets/darts/darts_coupon.mp4', null),
  ('ダーツ - はずれ', 'darts', 'https://fukubikiu.attend-ar.com/presets/darts/darts_hazure.mp4', null),
  ('ダーツ - 参加賞', 'darts', 'https://fukubikiu.attend-ar.com/presets/darts/darts_cookie.mp4', null),

  ('ガラガラ抽選 - 当たり', 'garagara', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_atari.mp4', null),
  ('ガラガラ抽選 - 大当たり', 'garagara', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_ohatari.mp4', null),
  ('ガラガラ抽選 - クーポン', 'garagara', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_coupon.mp4', null),
  ('ガラガラ抽選 - はずれ', 'garagara', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_hazure.mp4', null),
  ('ガラガラ抽選 - 参加賞', 'garagara', 'https://fukubikiu.attend-ar.com/presets/garagara/garagara_cookie.mp4', null),

  ('おみくじ - 1等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_1tou.mp4', null),
  ('おみくじ - 2等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_2tou.mp4', null),
  ('おみくじ - 3等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_3tou.mp4', null),
  ('おみくじ - 4等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_4tou.mp4', null),
  ('おみくじ - 5等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_5tou.mp4', null),
  ('おみくじ - 6等', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_6tou.mp4', null),
  ('おみくじ - 参加賞', 'omikuji', 'https://fukubikiu.attend-ar.com/presets/omikuji/omikuji_cookie.mp4', null),

  ('スクラッチ - 当たり', 'scratch', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_atari.mp4', null),
  ('スクラッチ - 大当たり', 'scratch', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_ohatari.mp4', null),
  ('スクラッチ - クーポン', 'scratch', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_coupon.mp4', null),
  ('スクラッチ - はずれ', 'scratch', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_hazure.mp4', null),
  ('スクラッチ - 参加賞', 'scratch', 'https://fukubikiu.attend-ar.com/presets/scratch/scratch_cookie.mp4', null)
on conflict do nothing;
