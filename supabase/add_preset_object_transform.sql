-- preset_objects に表示オブジェクトの向き(rotation)と位置(position)を保存できるようにする。
-- どちらもA-Frameの属性値と同じ "x y z" 形式の文字列(例: "0 180 0")。
-- 未設定(null)の場合はアプリ側の既定値
-- (components/arObjectComponents.tsx の DEFAULT_MODEL_ROTATION / 位置は "0 0 0")を使う。
alter table preset_objects add column if not exists rotation text;
alter table preset_objects add column if not exists position text;
