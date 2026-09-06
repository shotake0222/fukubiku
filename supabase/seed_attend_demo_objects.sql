-- あてんど(観光・聖地巡礼)向けのデモ表示オブジェクトを登録する。
--
-- 福引きと違い賞の段数は無く、1モチーフにつき.glbは1つ。
-- GPSやNFCで「その場所へ行くと現れる」使い方を想定し、
-- アニメーションはすべてループ(ゆっくり漂う・揺れる)になっている。
--
-- group_type = 'menu' は「複数クライアントへ横展開する定型施策」の意味
-- (schema_attend.sql 参照)。個別案件用のカスタムは 'project' を使う。
--
-- 同じ名前で二重登録されないよう、既存を消してから入れ直す。

delete from preset_objects where service = 'attend' and category in ('ランドマーク', '案内・誘導', '記念・演出');

insert into preset_objects (name, category, model_url, service, group_type) values
  ('鳥居', 'ランドマーク', '/presets/attend/torii_3d.glb', 'attend', 'menu'),
  ('五重塔', 'ランドマーク', '/presets/attend/pagoda_3d.glb', 'attend', 'menu'),
  ('天守閣', 'ランドマーク', '/presets/attend/castle_3d.glb', 'attend', 'menu'),
  ('案内看板（ようこそ）', '案内・誘導', '/presets/attend/signboard_3d.glb', 'attend', 'menu'),
  ('吹き出し（ここです！）', '案内・誘導', '/presets/attend/balloon_3d.glb', 'attend', 'menu'),
  ('道案内の矢印（この先）', '案内・誘導', '/presets/attend/arrow_3d.glb', 'attend', 'menu'),
  ('記念スタンプ（訪問）', '記念・演出', '/presets/attend/stamp_3d.glb', 'attend', 'menu'),
  ('提灯（祭）', '記念・演出', '/presets/attend/chochin_3d.glb', 'attend', 'menu');
