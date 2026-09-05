-- 追加カテゴリ(ルーレット/サイコロ/宝箱)の3Dテンプレートを登録する。
-- seed_object_presets.sql と同じ規約(service='fukubiku'を明示、model_urlの一意制約でupsert)。
-- 事前に seed_object_presets.sql (unique index作成含む)を実行済みであることを前提とする。

insert into preset_objects (name, category, model_url, thumbnail_url, service) values
  ('ルーレット - 当たり（3Dオブジェクト）', 'roulette', 'https://app.fukubikiu.com/presets/roulette/roulette_atari_3d.glb', 'https://app.fukubikiu.com/presets/roulette/roulette_atari_3d_thumb.png', 'fukubiku'),
  ('ルーレット - 大当たり（3Dオブジェクト）', 'roulette', 'https://app.fukubikiu.com/presets/roulette/roulette_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/roulette/roulette_ohatari_3d_thumb.png', 'fukubiku'),
  ('ルーレット - クーポン（3Dオブジェクト）', 'roulette', 'https://app.fukubikiu.com/presets/roulette/roulette_coupon_3d.glb', 'https://app.fukubikiu.com/presets/roulette/roulette_coupon_3d_thumb.png', 'fukubiku'),
  ('ルーレット - はずれ（3Dオブジェクト）', 'roulette', 'https://app.fukubikiu.com/presets/roulette/roulette_hazure_3d.glb', 'https://app.fukubikiu.com/presets/roulette/roulette_hazure_3d_thumb.png', 'fukubiku'),
  ('ルーレット - 参加賞（3Dオブジェクト）', 'roulette', 'https://app.fukubikiu.com/presets/roulette/roulette_cookie_3d.glb', 'https://app.fukubikiu.com/presets/roulette/roulette_cookie_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 1等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_1tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_1tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 2等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_2tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_2tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 3等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_3tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_3tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 4等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_4tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_4tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 5等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_5tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_5tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 6等（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_6tou_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_6tou_3d_thumb.png', 'fukubiku'),
  ('サイコロ - 参加賞（3Dオブジェクト）', 'dice', 'https://app.fukubikiu.com/presets/dice/dice_cookie_3d.glb', 'https://app.fukubikiu.com/presets/dice/dice_cookie_3d_thumb.png', 'fukubiku'),
  ('宝箱 - 当たり（3Dオブジェクト）', 'treasure', 'https://app.fukubikiu.com/presets/treasure/treasure_atari_3d.glb', 'https://app.fukubikiu.com/presets/treasure/treasure_atari_3d_thumb.png', 'fukubiku'),
  ('宝箱 - 大当たり（3Dオブジェクト）', 'treasure', 'https://app.fukubikiu.com/presets/treasure/treasure_ohatari_3d.glb', 'https://app.fukubikiu.com/presets/treasure/treasure_ohatari_3d_thumb.png', 'fukubiku'),
  ('宝箱 - クーポン（3Dオブジェクト）', 'treasure', 'https://app.fukubikiu.com/presets/treasure/treasure_coupon_3d.glb', 'https://app.fukubikiu.com/presets/treasure/treasure_coupon_3d_thumb.png', 'fukubiku'),
  ('宝箱 - はずれ（3Dオブジェクト）', 'treasure', 'https://app.fukubikiu.com/presets/treasure/treasure_hazure_3d.glb', 'https://app.fukubikiu.com/presets/treasure/treasure_hazure_3d_thumb.png', 'fukubiku'),
  ('宝箱 - 参加賞（3Dオブジェクト）', 'treasure', 'https://app.fukubikiu.com/presets/treasure/treasure_cookie_3d.glb', 'https://app.fukubikiu.com/presets/treasure/treasure_cookie_3d_thumb.png', 'fukubiku')
on conflict (model_url) do update set
  name = excluded.name,
  category = excluded.category,
  thumbnail_url = excluded.thumbnail_url,
  service = excluded.service;
