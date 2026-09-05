-- preset_objects に表示オブジェクトの拡大率(A-Frameのscale属性値、
-- 例: "0.15 0.15 0.15")を保存できるようにする。
-- 未設定(null)の場合はアプリ側の既定値(components/arObjectComponents.tsx の
-- DEFAULT_MODEL_SCALE)を使う。
alter table preset_objects add column if not exists scale text;
