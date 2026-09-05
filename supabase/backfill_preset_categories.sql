-- 表示オブジェクト管理(preset_objects)で category が未設定(null)のままになっている
-- 既存レコードを、model_url のファイル名から推測して埋める一括更新。
-- (例: .../garagara/garagara_atari.mp4 → category='garagara')
-- 命名規則に沿っていない/推測できないものはnullのまま残る(その場合は手動で設定してください)。
-- fukubiku側の固定カテゴリのみを対象にし、あてんど側の自由入力カテゴリには影響しない。

update preset_objects
set category = sub.guessed
from (
  select id,
    (regexp_match(model_url, '/([a-z0-9]+)_[^/]*$'))[1] as guessed
  from preset_objects
  where category is null
    and service = 'fukubiku'
) sub
where preset_objects.id = sub.id
  and sub.guessed in ('amida', 'box', 'darts', 'garagara', 'omikuji', 'scratch', 'roulette', 'dice', 'treasure');

-- 実行後、対象がどれだけ残っているか確認する場合は以下を使ってください:
-- select id, name, model_url from preset_objects where category is null and service = 'fukubiku';
