-- ⚠️ このファイルは使わないでください（2026-09-12 廃止）。
--
-- 旧GIFテンプレートをMP4へ貼り替えるための暫定スクリプトでしたが、
-- 途中の UPDATE が model_url の一意制約に衝突しうるなど、
-- 台帳を半端な状態にする可能性がありました。
--
-- 代わりに supabase/rebuild_preset_catalog.sql を実行してください。
-- あちらは preset_objects を「アプリに実在するテンプレート473件」と
-- 一致した状態へ、どんな状態からでも安全に戻します（何度でも実行可）。
--
-- 誤って実行しても何も起きないよう、ここで止めています。

do $$
begin
  raise exception using
    message = 'このスクリプトは廃止されました。supabase/rebuild_preset_catalog.sql を実行してください。';
end $$;
